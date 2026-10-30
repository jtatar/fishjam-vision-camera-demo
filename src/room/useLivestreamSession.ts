import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useLivestreamStreamer,
  useLivestreamViewer,
  type MediaStream,
} from '@fishjam-cloud/react-native-client';
import { requestLivestreamToken, type RoomConfig } from '../config';
import { errorMessage } from '../errors';
import { useLivestreamMicrophone } from './useLivestreamMicrophone';

type Attempt = {
  controller: AbortController;
  timeout?: ReturnType<typeof setTimeout>;
  connected: boolean;
};

function livestreamError(error: string) {
  switch (error) {
    case 'unauthorized':
      return 'The livestream token was rejected. Check your Fishjam settings and try again.';
    case 'stream_not_found':
      return 'The host is not live. Ask them to start streaming, then try again.';
    case 'streamer_already_connected':
      return 'Another host is already streaming to this room. Stop that stream or choose another room name.';
    default:
      return 'Couldn’t connect to the livestream. Check your connection and try again.';
  }
}

export function useLivestreamSession(
  config: RoomConfig,
  mode: 'camera' | 'viewer',
  video: MediaStream | null,
) {
  const streamer = useLivestreamStreamer();
  const viewer = useLivestreamViewer();
  const microphone = useLivestreamMicrophone();
  const { prepare, stop } = microphone;
  const { disconnect, isConnected, error: sdkError } = mode === 'camera' ? streamer : viewer;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [negotiated, setNegotiated] = useState<Attempt | null>(null);
  const current = useRef<Attempt | null>(null);
  const inFlight = useRef<Promise<void>>(Promise.resolve());

  const cleanup = useCallback(() => {
    const attempt = current.current;
    current.current = null;
    attempt?.controller.abort();
    clearTimeout(attempt?.timeout);
    disconnect();
    stop();
  }, [disconnect, stop]);

  useEffect(() => cleanup, [cleanup]);

  const fail = useCallback(
    (message: string) => {
      cleanup();
      setBusy(false);
      setNegotiated(null);
      setError(message);
    },
    [cleanup],
  );

  useEffect(() => {
    const attempt = current.current;
    // SDK connect() resolves on SDP negotiation, not necessarily ICE connection,
    // and reports server failures through error instead of rejecting its promise.
    if (!attempt || negotiated !== attempt) return;
    if (sdkError) fail(livestreamError(sdkError));
    else if (isConnected) {
      attempt.connected = true;
      clearTimeout(attempt.timeout);
      setBusy(false);
    } else if (attempt.connected) {
      fail('Connection lost. Start the livestream again to reconnect.');
    }
  }, [negotiated, sdkError, isConnected, fail]);

  async function join() {
    if (current.current) return;
    if (mode === 'camera' && !video) {
      setError('Wait for the camera preview before going live.');
      return;
    }
    const attempt: Attempt = { controller: new AbortController(), connected: false };
    current.current = attempt;
    setBusy(true);
    setError(null);
    setNegotiated(null);
    attempt.timeout = setTimeout(() => {
      if (current.current === attempt)
        fail('Connecting timed out. Check your connection and stream settings.');
    }, 20000);
    const previous = inFlight.current;
    const operation = (async () => {
      // The SDK cannot abort an in-flight WHIP/WHEP request. Drain it before
      // retrying so its late disconnect cannot terminate the next connection.
      await previous;
      const { signal } = attempt.controller;
      if (signal.aborted) return;
      try {
        const token = await requestLivestreamToken(
          config,
          mode === 'camera' ? 'streamer' : 'viewer',
          signal,
        );
        if (signal.aborted) return;
        if (mode === 'camera' && video) {
          const audio = await prepare(signal);
          if (signal.aborted) return;
          await streamer.connect({ token, inputs: { video, audio } });
        } else {
          await viewer.connect({ token });
        }
        if (signal.aborted) disconnect();
        else setNegotiated(attempt);
      } catch (cause) {
        if (current.current === attempt) fail(errorMessage(cause));
      }
    })();
    inFlight.current = operation;
    await operation;
  }

  const leave = useCallback(() => {
    cleanup();
    setBusy(false);
    setNegotiated(null);
    setError(null);
  }, [cleanup]);

  const connected = !!negotiated && isConnected && !sdkError;
  return {
    join,
    leave,
    busy,
    error,
    connected,
    stream: connected ? viewer.stream : null,
    microphone,
  };
}
