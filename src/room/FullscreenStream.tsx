import { Modal, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RTCView, type MediaStream } from '@fishjam-cloud/react-native-client';
import { IconButton } from '../studio/controls';

type FullscreenStreamProps = {
  stream: MediaStream;
  onClose: () => void;
};

// Present the existing stream without leaving the room or subscribing again.
export function FullscreenStream({ stream, onClose }: FullscreenStreamProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      testID="fullscreen-stream"
      presentationStyle="fullScreen"
      hardwareAccelerated
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={local.screen}>
        <RTCView
          testID="fullscreen-video"
          mediaStream={stream}
          objectFit="contain"
          style={StyleSheet.absoluteFill}
        />
        <View style={[local.close, { top: insets.top + 12, right: insets.right + 16 }]}>
          <IconButton icon="contract-outline" label="Exit fullscreen" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const local = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  close: { position: 'absolute' },
});
