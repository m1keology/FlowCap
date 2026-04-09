import type { RecordingConfig } from '../types';

// ── Spring physics ──────────────────────────────────────────────────────────
interface Spring {
  pos: number;
  vel: number;
}

function springStep(spring: Spring, target: number, dt: number, stiffness = 180, damping = 26): number {
  const safeDt = Math.min(dt, 0.05);
  const force = (target - spring.pos) * stiffness - spring.vel * damping;
  spring.vel += force * safeDt;
  spring.pos += spring.vel * safeDt;
  return spring.pos;
}

// ── State ───────────────────────────────────────────────────────────────────
interface CompositeState {
  zoomSpring: Spring;
  panXSpring: Spring;
  panYSpring: Spring;
  targetZoom: number;
  targetPanX: number;
  targetPanY: number;
  lastMoveTime: number;
  lastCursorX: number;
  lastCursorY: number;
  lastFrameTime: number;
  spotlightAlpha: Spring;
  clickRipples: Array<{ x: number; y: number; t: number }>;
}

export function createCompositor(config: RecordingConfig) {
  const state: CompositeState = {
    zoomSpring:     { pos: 1,   vel: 0 },
    panXSpring:     { pos: 0,   vel: 0 },
    panYSpring:     { pos: 0,   vel: 0 },
    targetZoom: 1, targetPanX: 0, targetPanY: 0,
    lastMoveTime: performance.now(),
    lastCursorX: 0.5, lastCursorY: 0.5,
    lastFrameTime: performance.now(),
    spotlightAlpha: { pos: 0, vel: 0 },
    clickRipples: [],
  };

  // Off-screen canvas for spotlight – prevents destination-out from erasing main canvas
  let spotlightCanvas: OffscreenCanvas | null = null;
  let spotlightCtx: OffscreenCanvasRenderingContext2D | null = null;

  let bgGradientCache: CanvasGradient | null = null;
  let bgCacheKey = '';

  function getSpotlightLayer(w: number, h: number): [OffscreenCanvas, OffscreenCanvasRenderingContext2D] {
    if (!spotlightCanvas || spotlightCanvas.width !== w || spotlightCanvas.height !== h) {
      spotlightCanvas = new OffscreenCanvas(w, h);
      spotlightCtx = spotlightCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    }
    return [spotlightCanvas, spotlightCtx!];
  }

  // ── Zoom update (returns dt for reuse) ────────────────────────────────
  function updateZoom(cursorX: number, cursorY: number, canvasW: number, canvasH: number, now: number): number {
    const dt = Math.max(0, (now - state.lastFrameTime) / 1000);
    // lastFrameTime updated in frame() AFTER all spring steps so every effect
    // in this frame shares the same dt.

    const moved = Math.abs(cursorX - state.lastCursorX) > 0.0012 ||
                  Math.abs(cursorY - state.lastCursorY) > 0.0012;
    if (moved) {
      state.lastMoveTime = now;
      state.lastCursorX = cursorX;
      state.lastCursorY = cursorY;
    }

    const dwellTime = now - state.lastMoveTime;
    const { zoom: zoomCfg } = config;

    if (!zoomCfg.enabled) {
      state.targetZoom = 1;
      state.targetPanX = 0;
      state.targetPanY = 0;
    } else if (dwellTime > zoomCfg.dwellMs) {
      state.targetZoom = zoomCfg.maxZoom;
      state.targetPanX = (0.5 - cursorX) * canvasW * (zoomCfg.maxZoom - 1);
      state.targetPanY = (0.5 - cursorY) * canvasH * (zoomCfg.maxZoom - 1);
    } else {
      state.targetZoom = 1;
      state.targetPanX = 0;
      state.targetPanY = 0;
    }

    springStep(state.zoomSpring, state.targetZoom, dt, 120, 22);
    springStep(state.panXSpring, state.targetPanX, dt, 120, 22);
    springStep(state.panYSpring, state.targetPanY, dt, 120, 22);

    return dt;
  }

  // ── Background ────────────────────────────────────────────────────────
  function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const bg = config.background;
    const key = `${bg.type}-${bg.gradient}-${bg.color}-${w}-${h}`;

    if (bg.type === 'solid') {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    if (bgCacheKey !== key || !bgGradientCache) {
      bgCacheKey = key;
      bgGradientCache = parseAndCreateGradient(ctx, bg.gradient, w, h);
    }
    ctx.fillStyle = bgGradientCache ?? '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
  }

  function parseAndCreateGradient(ctx: CanvasRenderingContext2D, css: string, w: number, h: number): CanvasGradient | null {
    const colorRegex = /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g;
    const colors = css.match(colorRegex) || [];
    if (colors.length < 2) return null;

    const angleMatch = css.match(/(\d+)deg/);
    const angleDeg = angleMatch ? parseInt(angleMatch[1]) : 135;
    const angleRad = (angleDeg - 90) * (Math.PI / 180);

    const x0 = w / 2 - Math.cos(angleRad) * w;
    const y0 = h / 2 - Math.sin(angleRad) * h;
    const x1 = w / 2 + Math.cos(angleRad) * w;
    const y1 = h / 2 + Math.sin(angleRad) * h;

    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
    return gradient;
  }

  // ── Screen rendering ──────────────────────────────────────────────────
  function drawScreenWithEffects(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, w: number, h: number) {
    const pad = config.padding;
    const cr = config.cornerRadius;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    ctx.save();
    ctx.translate(w / 2 + state.panXSpring.pos, h / 2 + state.panYSpring.pos);
    ctx.scale(state.zoomSpring.pos, state.zoomSpring.pos);
    ctx.translate(-w / 2, -h / 2);

    // Step 1: render the drop shadow by filling the rounded rect shape
    // (shadow only renders on actual draw calls, not clip())
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    roundRect(ctx, pad, pad, innerW, innerH, cr);
    ctx.fill();

    // Step 2: clip to the rounded rect and draw the video (no shadow)
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    roundRect(ctx, pad, pad, innerW, innerH, cr);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, pad, pad, innerW, innerH);
    ctx.restore();
  }

  // ── Spotlight mode ────────────────────────────────────────────────────
  // Uses an off-screen canvas so destination-out only punches a hole in
  // the overlay layer — not in the video/background pixels on the main canvas.
  function drawSpotlight(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cursorX: number,
    cursorY: number,
    dt: number,
  ) {
    const targetAlpha = config.spotlight?.enabled ? 1 : 0;
    springStep(state.spotlightAlpha, targetAlpha, dt, 80, 18);

    const alpha = Math.max(0, Math.min(1, state.spotlightAlpha.pos));
    if (alpha < 0.01) return;

    const pad = config.padding;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    // Map cursor from normalised → canvas space (accounting for zoom/pan)
    const cx = (cursorX * innerW + pad - w / 2) * state.zoomSpring.pos + w / 2 + state.panXSpring.pos;
    const cy = (cursorY * innerH + pad - h / 2) * state.zoomSpring.pos + h / 2 + state.panYSpring.pos;
    const spotR = (config.spotlight.radius ?? 180) * state.zoomSpring.pos;

    const [offscreen, offCtx] = getSpotlightLayer(w, h);

    // 1. Clear the off-screen layer
    offCtx.clearRect(0, 0, w, h);

    // 2. Fill with the dark overlay
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.fillStyle = `rgba(0, 0, 0, ${0.6 * alpha})`;
    offCtx.fillRect(0, 0, w, h);

    // 3. Punch a transparent hole around the cursor (only on off-screen canvas)
    offCtx.globalCompositeOperation = 'destination-out';
    const grd = offCtx.createRadialGradient(cx, cy, 0, cx, cy, spotR);
    grd.addColorStop(0,    'rgba(0,0,0,1)');
    grd.addColorStop(0.55, 'rgba(0,0,0,1)');
    grd.addColorStop(1,    'rgba(0,0,0,0)');
    offCtx.fillStyle = grd;
    offCtx.beginPath();
    offCtx.arc(cx, cy, spotR, 0, Math.PI * 2);
    offCtx.fill();

    // Reset off-screen composite op
    offCtx.globalCompositeOperation = 'source-over';

    // 4. Composite the spotlight overlay onto the main canvas
    ctx.drawImage(offscreen, 0, 0);
  }

  // ── Cursor effects ────────────────────────────────────────────────────
  function drawCursorEffects(ctx: CanvasRenderingContext2D, w: number, h: number, cursorX: number, cursorY: number, now: number) {
    const pad = config.padding;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    const cx = (cursorX * innerW + pad - w / 2) * state.zoomSpring.pos + w / 2 + state.panXSpring.pos;
    const cy = (cursorY * innerH + pad - h / 2) * state.zoomSpring.pos + h / 2 + state.panYSpring.pos;
    const radius = 18 * state.zoomSpring.pos;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Click ripples
    state.clickRipples = state.clickRipples.filter(r => now - r.t < 700);
    for (const r of state.clickRipples) {
      const age = (now - r.t) / 700;
      const eased = 1 - Math.pow(1 - age, 3);
      const rippleR = (16 + eased * 52) * state.zoomSpring.pos;
      const rx = (r.x * innerW + pad - w / 2) * state.zoomSpring.pos + w / 2 + state.panXSpring.pos;
      const ry = (r.y * innerH + pad - h / 2) * state.zoomSpring.pos + h / 2 + state.panYSpring.pos;

      ctx.save();
      ctx.beginPath();
      ctx.arc(rx, ry, rippleR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 92, 246, ${(1 - age) * 0.75})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rx, ry, rippleR * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(167, 139, 250, ${(1 - age) * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Camera overlay ────────────────────────────────────────────────────
  function drawCameraOverlay(ctx: CanvasRenderingContext2D, camera: HTMLVideoElement, w: number, h: number) {
    const cam = config.camera;
    const sizes = { sm: 120, md: 160, lg: 210 };
    const size = sizes[cam.size];
    const pad = 20;

    const positions: Record<string, [number, number]> = {
      'bottom-right': [w - size - pad, h - size - pad],
      'bottom-left':  [pad, h - size - pad],
      'top-right':    [w - size - pad, pad],
      'top-left':     [pad, pad],
    };

    const [x, y] = positions[cam.position];

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;

    ctx.beginPath();
    if (cam.shape === 'circle') {
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    } else {
      roundRect(ctx, x, y, size, size, 16);
    }
    ctx.clip();
    ctx.shadowColor = 'transparent';
    ctx.drawImage(camera, x, y, size, size);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    if (cam.shape === 'circle') {
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    } else {
      roundRect(ctx, x, y, size, size, 16);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function roundRect(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
  ) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Main frame ────────────────────────────────────────────────────────
  function frame(
    ctx: CanvasRenderingContext2D,
    screenVideo: HTMLVideoElement,
    cameraVideo: HTMLVideoElement | null,
    cursorX: number,
    cursorY: number,
    now: number,
  ) {
    const { width: w, height: h } = ctx.canvas;

    // Always reset rendering state at frame start to prevent leaks from previous frame
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowOffsetX = 0;

    // Compute dt once; update lastFrameTime AFTER so all effects share the same dt
    const dt = updateZoom(cursorX, cursorY, w, h, now);
    state.lastFrameTime = now;

    drawBackground(ctx, w, h);

    if (screenVideo.readyState >= 2) {
      drawScreenWithEffects(ctx, screenVideo, w, h);
    }

    // Spotlight uses correct dt (not zero) because lastFrameTime was NOT yet updated
    drawSpotlight(ctx, w, h, cursorX, cursorY, dt);

    // Ensure composite op is clean before further draws
    ctx.globalCompositeOperation = 'source-over';

    drawCursorEffects(ctx, w, h, cursorX, cursorY, now);

    if (cameraVideo && config.camera.enabled && cameraVideo.readyState >= 2) {
      drawCameraOverlay(ctx, cameraVideo, w, h);
    }

    // Safety reset
    ctx.globalCompositeOperation = 'source-over';
  }

  function addClickRipple(x: number, y: number) {
    state.clickRipples.push({ x, y, t: performance.now() });
  }

  function updateConfig(newConfig: RecordingConfig) {
    Object.assign(config, newConfig);
    bgCacheKey = '';
    bgGradientCache = null;
  }

  return { frame, addClickRipple, updateConfig, state };
}
