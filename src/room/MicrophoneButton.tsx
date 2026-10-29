import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useInitializeDevices, useMicrophone } from '@fishjam-cloud/react-native-client';
import { useMicrophonePermission } from 'react-native-vision-camera';
import { useForeground } from '../useForeground';
import { errorMessage } from '../errors';
import { Button, Notice } from '../ui';
import { IconButton } from '../studio/controls';

export function MicrophoneButton({
  connected,
  compact = false,
}: {
  connected: boolean;
  compact?: boolean;
}) {
  const { initializeDevices } = useInitializeDevices();
  const { isMicrophoneOn, stopMicrophone } = useMicrophone();
  const permission = useMicrophonePermission();
  const active = useForeground();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = useRef(active && connected);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      allowed.current = false;
    };
  }, []);

  useEffect(() => {
    allowed.current = active && connected;
    if (!allowed.current) void stopMicrophone();
    return () => {
      void stopMicrophone();
    };
  }, [active, connected, stopMicrophone]);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (isMicrophoneOn) {
        await stopMicrophone();
        return;
      }
      if (!permission.hasPermission) {
        if (!permission.canRequestPermission) {
          await Linking.openSettings();
          return;
        }
        if (!(await permission.requestPermission())) return;
      }
      if (!allowed.current) return;
      await initializeDevices({ enableVideo: false, enableAudio: true });
      if (!allowed.current) await stopMicrophone();
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <>
      {compact ? (
        <IconButton
          icon={isMicrophoneOn ? 'mic-outline' : 'mic-off-outline'}
          label={isMicrophoneOn ? 'Mute microphone' : 'Enable microphone'}
          caption={isMicrophoneOn ? 'Mic on' : 'Mic off'}
          selected={isMicrophoneOn}
          disabled={busy || !active || !connected}
          onPress={() => {
            void toggle();
          }}
        />
      ) : (
        <Button
          label={isMicrophoneOn ? 'Mute microphone' : 'Enable microphone'}
          disabled={busy || !active || !connected}
          onPress={() => {
            void toggle();
          }}
        />
      )}
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
