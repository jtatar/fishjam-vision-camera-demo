import { memo, useMemo, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { NativePreviewView, type CameraPreviewOutput } from 'react-native-vision-camera';

type CameraPreviewProps = {
  previewOutput: CameraPreviewOutput;
  gesture: ComponentProps<typeof GestureDetector>['gesture'];
  mirrored: boolean;
  onTap: () => void;
};

export const CameraPreview = memo(function CameraPreview({
  previewOutput,
  gesture,
  mirrored,
  onTap,
}: CameraPreviewProps) {
  const previewGesture = useMemo(
    () =>
      Gesture.Race(
        gesture,
        Gesture.Tap()
          .maxDistance(10)
          .onEnd((_, success) => {
            if (success) scheduleOnRN(onTap);
          }),
      ),
    [gesture, onTap],
  );

  return (
    <GestureDetector gesture={previewGesture}>
      <View collapsable={false} testID="camera-preview" style={StyleSheet.absoluteFill}>
        <NativePreviewView
          previewOutput={previewOutput}
          resizeMode="cover"
          implementationMode="compatible"
          style={[StyleSheet.absoluteFill, mirrored && local.mirrored]}
        />
      </View>
    </GestureDetector>
  );
});

const local = StyleSheet.create({
  mirrored: { transform: [{ scaleX: -1 }] },
});
