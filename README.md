# FlowCap

**Open source screen recorder for Windows** — built with Tauri + React.

Record your screen, add cursor focus effects and webcam overlay, and export to MP4, GIF, or WebM. No subscription, no watermark, no cloud upload. Everything stays on your machine.

## Features

- **Auto-zoom** — spring physics zoom that follows your cursor while idle; zooms back out when you move
- **Spotlight mode** — dims the screen outside the cursor area to focus viewer attention
- **Webcam overlay** — circle or rounded-rectangle bubble, four corner positions, three sizes
- **Microphone recording** — audio mixed directly into the output file
- **Countdown timer** — 3 s / 5 s / 10 s countdown before recording starts
- **Gradient backgrounds** — 8 built-in gradients with configurable padding and corner radius
- **Trim editor** — drag handles to trim the start/end before export
- **Export** — MP4 (H.264 via FFmpeg WASM), WebM (instant, no encode), or animated GIF
- **Tray icon** — close-to-tray; left-click to restore, right-click for menu

## Download

Head to the [Releases](../../releases) page and download the Windows installer (`FlowCap_x.x.x_x64-setup.exe`).

## Building from source

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Rust | stable | `winget install Rustlang.Rustup` (then reopen terminal) |
| VS Build Tools | 2022 | `winget install Microsoft.VisualStudio.2022.BuildTools` → select "Desktop development with C++" |

### Run in development (browser only, no Rust needed)

```bash
npm install
npm run dev
# Open http://localhost:5173 in Chrome or Edge
```

### Run as desktop app (hot-reload)

```bash
npm install
npm run dev:tauri
# First run compiles Rust (~1–2 min); subsequent runs are fast
```

### Build a Windows installer

```bash
npm run build:tauri
# Output: src-tauri/target/release/bundle/nsis/FlowCap_*_x64-setup.exe
```

## Tech stack

- [Tauri 2](https://tauri.app) — native desktop shell (~8 MB vs 150 MB for Electron)
- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite 8](https://vitejs.dev) — build tooling
- [Tailwind CSS 4](https://tailwindcss.com) — styling
- [Framer Motion](https://www.framer.com/motion/) — animations
- [FFmpeg WASM](https://ffmpegwasm.netlify.app) — in-browser MP4/GIF encoding (no server, no install)

## How it works

Screen capture uses `getDisplayMedia()` — the OS native picker, works in both the browser and Tauri's WebView2 without interceptors or native plugins.

The canvas compositor renders at 60 fps, applying zoom (spring physics), spotlight, corner radius, padding, background gradient, and webcam overlay in a single `drawImage` pass. `canvas.captureStream(60)` feeds that into a `MediaRecorder` to produce a WebM file.

During recording, `window.__TAURI_INTERNALS__.invoke('get_cursor_pos')` polls the real OS cursor position at ~60 fps so zoom and spotlight keep tracking the cursor even while the FlowCap window is hidden.

## Contributing

Pull requests welcome. Please open an issue first for significant changes.

## License

MIT — see [LICENSE](LICENSE).
