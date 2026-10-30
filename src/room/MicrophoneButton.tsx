import { Button } from '../ui';
import { IconButton } from '../studio/controls';
import type { useLivestreamMicrophone } from './useLivestreamMicrophone';

export function MicrophoneButton({
  connected,
  microphone,
  compact = false,
}: {
  connected: boolean;
  microphone: ReturnType<typeof useLivestreamMicrophone>;
  compact?: boolean;
}) {
  const { muted, available, foreground, toggle } = microphone;
  const label =
    !available && connected
      ? 'Microphone unavailable'
      : muted
        ? 'Enable microphone'
        : 'Mute microphone';
  const disabled = !connected || !available || !foreground;
  return compact ? (
    <IconButton
      icon={muted ? 'mic-off-outline' : 'mic-outline'}
      label={label}
      caption="Mic"
      selected={!muted}
      disabled={disabled}
      onPress={toggle}
    />
  ) : (
    <Button label={label} disabled={disabled} onPress={toggle} />
  );
}
