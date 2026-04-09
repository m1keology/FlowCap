import { useRef, useCallback } from 'react';

export function useCanvasRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback((canvas: HTMLCanvasElement, audioStreams: MediaStream[]) => {
    chunksRef.current = [];

    // Get canvas video stream at 60fps
    const canvasStream = canvas.captureStream(60);

    // Mix in audio tracks
    const audioContext = new AudioContext();
    const dest = audioContext.createMediaStreamDestination();
    audioStreams.forEach(stream => {
      stream.getAudioTracks().forEach(() => {
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(dest);
      });
    });

    // Combine canvas + audio
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);

    // Choose best supported codec
    const mimeType = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(100); // collect chunks every 100ms
    mediaRecorderRef.current = recorder;

    return () => audioContext.close();
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return resolve(new Blob());

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  return { startRecording, stopRecording };
}
