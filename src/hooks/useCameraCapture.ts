import { useRef, useCallback } from 'react';

export function useCameraCapture() {
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async (): Promise<MediaStream> => {
    // Try progressively looser constraints so we never hard-crash on desktop webcams.
    // facingMode:'user' is mobile-only and throws on many desktop drivers.
    const attempts: MediaStreamConstraints[] = [
      // 1st choice: 720p square crop (good for pip overlay)
      { video: { width: { ideal: 720 }, height: { ideal: 720 } }, audio: false },
      // 2nd choice: any video, no size constraints
      { video: true, audio: false },
    ];

    let lastErr: unknown;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        return stream;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }, []);

  const startMic = useCallback(async (): Promise<MediaStream> => {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
      },
      video: false,
    });
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  return { startCamera, startMic, stopCamera, streamRef };
}
