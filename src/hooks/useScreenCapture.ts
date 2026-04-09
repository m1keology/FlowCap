import { useRef, useCallback } from 'react';

/**
 * Screen capture hook — pure web API, works in both:
 *   • Browser (Chrome / Edge): getDisplayMedia shows the OS picker
 *   • Tauri (WebView2 on Windows, WebKit on macOS): same OS picker via the
 *     built-in webview — no native plugin, no desktopCapturer, no interceptors.
 */
export function useScreenCapture() {
  const streamRef = useRef<MediaStream | null>(null);

  const startCapture = useCallback(async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width:     { ideal: 1920 },
        height:    { ideal: 1080 },
        frameRate: { ideal: 60  },
        cursor:    'always',
      } as MediaTrackConstraints,
      audio: false,
    });

    streamRef.current = stream;
    return stream;
  }, []);

  const stopCapture = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  return { startCapture, stopCapture, streamRef };
}
