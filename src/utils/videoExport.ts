import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading = false;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) {
    await new Promise<void>(resolve => {
      const check = setInterval(() => {
        if (ffmpegInstance) { clearInterval(check); resolve(); }
      }, 100);
    });
    return ffmpegInstance!;
  }

  ffmpegLoading = true;
  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpegInstance = ffmpeg;
  ffmpegLoading = false;
  return ffmpeg;
}

export async function convertToMp4(
  webmBlob: Blob,
  onProgress?: (p: number) => void,
  extraArgs: string[] = [],
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  ffmpeg.on('progress', ({ progress }) => onProgress?.(Math.min(progress * 100, 100)));

  await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
  await ffmpeg.exec([
    ...extraArgs,
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    'output.mp4',
  ]);

  const data = await ffmpeg.readFile('output.mp4');
  return new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' });
}

export async function convertToGif(
  webmBlob: Blob,
  fps = 15,
  width = 800,
  onProgress?: (p: number) => void,
  extraArgs: string[] = [],
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  ffmpeg.on('progress', ({ progress }) => onProgress?.(Math.min(progress * 100, 100)));

  await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
  await ffmpeg.exec([
    ...extraArgs,
    '-i', 'input.webm',
    '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`,
    'palette.png',
  ]);
  await ffmpeg.exec([
    ...extraArgs,
    '-i', 'input.webm',
    '-i', 'palette.png',
    '-lavfi', `fps=${fps},scale=${width}:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5`,
    'output.gif',
  ]);

  const data = await ffmpeg.readFile('output.gif');
  return new Blob([new Uint8Array(data as Uint8Array)], { type: 'image/gif' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
