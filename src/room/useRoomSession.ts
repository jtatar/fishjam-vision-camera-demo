import { useEffect, useRef, useState } from 'react';
import { useConnection } from '@fishjam-cloud/react-native-client';
import { requestPeerToken, type RoomConfig } from '../config';
import { errorMessage } from '../errors';

export function useRoomSession(config: RoomConfig) {
  const { joinRoom, leaveRoom, peerStatus, reconnectionStatus } = useConnection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
      leaveRoom();
    },
    [leaveRoom],
  );

  async function join() {
    if (pending.current || peerStatus === 'connected') return;
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setError(null);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let removeAbortListener = () => {};
    try {
      await Promise.race([
        (async () => {
          const peerToken = await requestPeerToken(config, request.signal);
          if (request.signal.aborted) return;
          await joinRoom({ peerToken, peerMetadata: { name: config.peerName.trim() } });
        })(),
        new Promise<never>((_, reject) => {
          const cancel = () => reject(new Error('Joining cancelled.'));
          request.signal.addEventListener('abort', cancel, { once: true });
          removeAbortListener = () => request.signal.removeEventListener('abort', cancel);
          timeout = setTimeout(
            () => reject(new Error('Joining timed out. Check your connection and room settings.')),
            20000,
          );
        }),
      ]);
    } catch (cause) {
      if (pending.current === request) {
        request.abort();
        leaveRoom();
        setError(errorMessage(cause));
      }
    } finally {
      clearTimeout(timeout);
      removeAbortListener();
      if (pending.current === request) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  function leave() {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setError(null);
    leaveRoom();
  }

  return { join, leave, busy, error, peerStatus, reconnectionStatus };
}
