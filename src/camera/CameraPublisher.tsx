import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDerivedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  useCameraDevice,
  useCameraPermission,
  usePreviewOutput,
  type CameraDevice,
} from 'react-native-vision-camera';
import { useCameraControls, useCameraSource, useCameraFrameOutput } from './core';
import type { CameraSource } from './core/useCameraSource';
import { useCaptureSession } from './core/useCaptureSession';
import type { MediaStream } from '@fishjam-cloud/react-native-client';
import { ZoomControls } from './ZoomControls';
import { TorchControls } from './TorchControls';
import { CameraControlButton } from './CameraControlButton';
import { CameraPreview } from './CameraPreview';
import { useForeground } from '../useForeground';
import { LocalReceiver } from '../diagnostics/LocalReceiver';
import { Button, Card, Notice, colors, styles } from '../ui';
import { Icon, IconButton } from '../studio/controls';
import { errorMessage } from '../errors';

type CameraPublisherProps = {
  header: ReactNode;
  footer: ReactNode;
  microphone: ReactNode;
  onReadyChange: (ready: boolean) => void;
  onStreamChange: (stream: MediaStream | null) => void;
};

type CameraUnavailableProps = Pick<CameraPublisherProps, 'header' | 'footer'> & {
  permission: ReturnType<typeof useCameraPermission>;
  position: 'front' | 'back';
  canSwitch: boolean;
  onSwitch: () => void;
};

type CameraCaptureProps = CameraPublisherProps & {
  source: CameraSource;
  device: CameraDevice;
  active: boolean;
  canSwitch: boolean;
  onSwitch: () => void;
};

export function CameraPublisher(props: CameraPublisherProps) {
  const [position, setPosition] = useState<'back' | 'front'>('back');
  const permission = useCameraPermission();
  const device = useCameraDevice(position);
  const alternateDevice = useCameraDevice(position === 'back' ? 'front' : 'back');
  const active = useForeground();
  const source = useCameraSource(permission.hasPermission && !!device);
  const { onStreamChange } = props;
  useEffect(() => {
    onStreamChange(source.stream ?? null);
    return () => onStreamChange(null);
  }, [source.stream, onStreamChange]);
  const switchCamera = () => setPosition((current) => (current === 'back' ? 'front' : 'back'));

  if (!permission.hasPermission || !device) {
    return (
      <CameraUnavailable
        permission={permission}
        position={position}
        canSwitch={!!alternateDevice}
        onSwitch={switchCamera}
        header={props.header}
        footer={props.footer}
      />
    );
  }

  return (
    <CameraCapture
      key={device.id}
      device={device}
      active={active}
      canSwitch={!!alternateDevice}
      onSwitch={switchCamera}
      source={source}
      {...props}
    />
  );
}

function CameraUnavailable({
  permission,
  position,
  canSwitch,
  onSwitch,
  header,
  footer,
}: CameraUnavailableProps) {
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const requestCameraAccess = async () => {
    try {
      if (permission.canRequestPermission) await permission.requestPermission();
      else await Linking.openSettings();
    } catch (cause) {
      setPermissionError(errorMessage(cause));
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={local.header}>{header}</View>
      <View style={local.fallback}>
        <Card>
          <Icon name="videocam-outline" size={36} color={colors.accent} />
          <Text style={styles.heading}>
            {!permission.hasPermission
              ? 'Let’s open your camera'
              : `No ${position} camera available`}
          </Text>
          <Notice>
            {!permission.hasPermission
              ? 'Allow camera access to frame your shot and find your light. You decide when to go live.'
              : 'A physical camera is needed to preview your stream.'}
          </Notice>
          {!permission.hasPermission ? (
            <Button
              primary
              label={permission.canRequestPermission ? 'Allow camera' : 'Open camera settings'}
              onPress={requestCameraAccess}
            />
          ) : (
            canSwitch && <Button label="Switch camera" onPress={onSwitch} />
          )}
          {permissionError && <Notice error>{permissionError}</Notice>}
        </Card>
      </View>
      <View style={local.footer}>{footer}</View>
    </View>
  );
}

function CameraCapture({
  device,
  active,
  canSwitch,
  onSwitch,
  header,
  footer,
  microphone,
  onReadyChange,
  source,
}: CameraCaptureProps) {
  const [isTorchPanelVisible, setIsTorchPanelVisible] = useState(false);
  const [isStreamCheckVisible, setIsStreamCheckVisible] = useState(false);

  const toggleTorchPanel = useCallback(() => setIsTorchPanelVisible((shown) => !shown), []);
  const toggleTorchPanelOnUI = useCallback(() => {
    'worklet';
    scheduleOnRN(toggleTorchPanel);
  }, [toggleTorchPanel]);
  const dismissControls = useCallback(() => {
    setIsTorchPanelVisible(false);
    setIsStreamCheckVisible(false);
  }, []);
  const insets = useSafeAreaInsets();

  const { stream, error: sourceError } = source;
  const frameOutput = useCameraFrameOutput(source.track);
  const previewOutput = usePreviewOutput();
  const {
    camera,
    running: isRunning,
    error: captureError,
  } = useCaptureSession(device, previewOutput, frameOutput, active && !!stream);
  const controls = useCameraControls(camera, active && isRunning, device);
  const { desiredTorchStrength } = controls;
  const torchSelected = useDerivedValue(() => desiredTorchStrength.get() > 0);

  useEffect(() => {
    onReadyChange(controls.ready);
    return () => onReadyChange(false);
  }, [controls.ready, onReadyChange]);

  const cameraError = sourceError ?? captureError ?? controls.error;

  return (
    <View style={styles.screen}>
      <CameraPreview
        previewOutput={previewOutput}
        gesture={controls.pinch}
        mirrored={device.position === 'front'}
        onTap={dismissControls}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['#00000099', '#00000000']}
        style={local.topShade}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['#00000000', '#000000CC', '#000000F2']}
        style={local.bottomShade}
      />
      <View
        pointerEvents="box-none"
        style={[
          local.overlay,
          { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <View pointerEvents="box-none" style={local.header}>
          {header}
        </View>
        <View pointerEvents="box-none" style={local.middle}>
          {isStreamCheckVisible && stream && active && (
            <View style={local.receiver}>
              <LocalReceiver stream={stream} onClose={() => setIsStreamCheckVisible(false)} />
            </View>
          )}
          <View pointerEvents="box-none" style={local.toolbar}>
            <IconButton
              icon="camera-reverse-outline"
              label="Switch camera"
              caption="Flip"
              disabled={!canSwitch}
              onPress={onSwitch}
            />
            {microphone}
            {device.hasTorch && controls.torchLevels.length === 0 ? (
              <CameraControlButton
                testID="torch-toggle"
                icon="flash-outline"
                label="Flashlight"
                caption="Light"
                selected={torchSelected}
                ready={controls.ready}
                onPressOnUI={controls.toggleTorchOnUI}
              />
            ) : (
              <View>
                <CameraControlButton
                  icon="flash-outline"
                  label={device.hasTorch ? 'Lighting' : 'Torch unavailable'}
                  caption="Light"
                  selected={torchSelected}
                  ready={device.hasTorch && controls.ready}
                  onPressOnUI={toggleTorchPanelOnUI}
                />
                {isTorchPanelVisible && (
                  <View style={local.torchPopover}>
                    <TorchControls key={controls.ready ? 'active' : 'paused'} controls={controls} />
                  </View>
                )}
              </View>
            )}
            <IconButton
              icon="desktop-outline"
              label={isStreamCheckVisible ? 'Stop stream check' : 'Check stream'}
              caption="Check"
              selected={isStreamCheckVisible}
              disabled={!isStreamCheckVisible && (!stream || !controls.ready)}
              onPress={() => {
                setIsTorchPanelVisible(false);
                setIsStreamCheckVisible(!isStreamCheckVisible);
              }}
            />
          </View>
        </View>
        <View pointerEvents="box-none" style={local.bottom}>
          {cameraError && (
            <View style={local.error}>
              <Notice error>{cameraError}</Notice>
            </View>
          )}
          {!controls.ready && (
            <Text testID="camera-state" style={local.paused}>
              Camera paused
            </Text>
          )}
          <ZoomControls controls={controls} />
          <View pointerEvents="box-none" style={local.footer}>
            {footer}
          </View>
        </View>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 350 },
  header: { paddingHorizontal: 20 },
  middle: { flex: 1, alignItems: 'flex-end', paddingRight: 16, paddingTop: 24 },
  receiver: { position: 'absolute', top: 24, left: 16, right: 196, maxWidth: 260 },
  toolbar: { gap: 20 },
  torchPopover: { position: 'absolute', right: 62, top: -110, width: 112, zIndex: 1 },
  bottom: { gap: 18 },
  footer: { paddingHorizontal: 24, gap: 14 },
  fallback: { flex: 1, justifyContent: 'center', padding: 24 },
  paused: { color: colors.text, textAlign: 'center', fontSize: 13 },
  error: { marginHorizontal: 20, padding: 12, borderRadius: 12, backgroundColor: '#231519ED' },
});
