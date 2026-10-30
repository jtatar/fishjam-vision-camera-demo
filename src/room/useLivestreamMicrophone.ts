import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaDevices, type MediaStream } from '@fishjam-cloud/react-native-webrtc';
import { useForeground } from '../useForeground';

export function useLivestreamMicrophone() {
  const stream = useRef<MediaStream | null>(null);
  const [available, setAvailable] = useState(false);
  const [muted, setMuted] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const foreground = useForeground();

  const mute = useCallback(() => {
    stream.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setMuted(true);
  }, []);

  const stop = useCallback(() => {
    stream.current?.release();
    stream.current = null;
    setAvailable(false);
    setMuted(true);
    setWarning(null);
  }, []);

  useEffect(() => {
    if (!foreground) mute();
  }, [foreground, mute]);
  useEffect(
    () => () => {
      stream.current?.release();
      stream.current = null;
    },
    [],
  );

  const prepare = useCallback(
    async (signal: AbortSignal) => {
      stop();
      try {
        // WHIP negotiates audio at connect time. Retain this muted track so enabling
        // the microphone later does not require a new publisher/viewer connection.
        const audio = await mediaDevices.getUserMedia({ audio: true, video: false });
        audio.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
        if (signal.aborted) {
          audio.release();
          return null;
        }
        stream.current = audio;
        setAvailable(true);
        return audio;
      } catch {
        if (!signal.aborted) {
          setWarning(
            'Streaming without audio. To use your mic, allow microphone access in Settings, then end and restart the stream.',
          );
        }
        return null;
      }
    },
    [stop],
  );

  function toggle() {
    if (!foreground || !stream.current) return;
    const tracks = stream.current.getAudioTracks();
    const enabled = !tracks.some((track) => track.enabled);
    tracks.forEach((track) => {
      track.enabled = enabled;
    });
    setMuted(!enabled);
  }

  return { prepare, stop, mute, toggle, available, muted, warning, foreground };
}
