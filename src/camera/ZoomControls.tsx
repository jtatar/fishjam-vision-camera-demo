import { StyleSheet, Text, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';
import { colors } from '../ui';
import type { CameraControls } from './core';
import { CameraControlButton } from './CameraControlButton';
import { CameraValueLabel } from './CameraValueLabel';

type ZoomControlsState = Pick<
  CameraControls,
  'liveZoom' | 'min' | 'max' | 'ready' | 'changeZoomOnUI' | 'stepZoomOnUI'
>;

type ZoomControlsProps = { controls: ZoomControlsState };
type ZoomPresetProps = ZoomControlsProps & { value: number };

const ZOOM_STEP_FACTOR = 1.25;

export function ZoomControls({ controls }: ZoomControlsProps) {
  const { liveZoom, min, max, ready, stepZoomOnUI } = controls;
  const zoomLabel = useDerivedValue(() => `${liveZoom.get().toFixed(1)}×`);
  const cannotZoomOut = useDerivedValue(() => liveZoom.get() <= min);
  const cannotZoomIn = useDerivedValue(() => liveZoom.get() >= max);
  const presets = [1, 2, 3].filter((value) => value >= min && value <= max);

  return (
    <View pointerEvents="box-none" style={local.zoomGroup}>
      <View style={local.labelRow}>
        <CameraValueLabel
          testID="zoom-value"
          accessibilityLabel="Camera zoom"
          value={zoomLabel}
          style={local.zoomLabel}
        />
        <Text style={local.zoomHint}>· Pinch to zoom</Text>
      </View>
      <View style={local.zoomRow}>
        <CameraControlButton
          icon="remove"
          label="Zoom out"
          ready={ready}
          disabled={cannotZoomOut}
          onPressOnUI={() => {
            'worklet';
            stepZoomOnUI(1 / ZOOM_STEP_FACTOR);
          }}
        />
        <View style={local.presets}>
          {presets.map((value) => (
            <ZoomPreset key={value} value={value} controls={controls} />
          ))}
        </View>
        <CameraControlButton
          icon="add"
          label="Zoom in"
          ready={ready}
          disabled={cannotZoomIn}
          onPressOnUI={() => {
            'worklet';
            stepZoomOnUI(ZOOM_STEP_FACTOR);
          }}
        />
      </View>
    </View>
  );
}

function ZoomPreset({ value, controls }: ZoomPresetProps) {
  const { liveZoom, changeZoomOnUI } = controls;
  const selected = useDerivedValue(() => Math.abs(liveZoom.get() - value) < 0.05);

  return (
    <CameraControlButton
      label={`${value}×`}
      text={`${value}×`}
      variant="preset"
      ready={controls.ready}
      selected={selected}
      onPressOnUI={() => {
        'worklet';
        changeZoomOnUI(value);
      }}
    />
  );
}

const local = StyleSheet.create({
  zoomGroup: { alignItems: 'center', gap: 10 },
  labelRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  zoomHint: { color: '#DDD', fontSize: 11, textShadowColor: '#000', textShadowRadius: 4 },
  zoomLabel: {
    padding: 0,
    minWidth: 34,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  presets: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderRadius: 28,
    backgroundColor: '#14191FD9',
    borderWidth: 1,
    borderColor: '#FFFFFF20',
  },
});
