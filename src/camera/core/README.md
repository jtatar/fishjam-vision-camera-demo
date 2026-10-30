# Copy the camera integration

Copy this entire `core/` directory into your project, for example to `src/camera/core`. Import from its `index.ts` entrypoint:

```ts
import {
  useCameraSource,
  useCameraFrameOutput,
  useCaptureSession,
  useCameraControls,
  type CameraControls,
} from './camera/core';
```

The directory has no imports from the demo, no theme, no navigation and no environment variables. It contains the Fishjam frame adapter and independent zoom/torch hooks. Your screen owns permission requests, device selection, foreground/navigation state, connection to a livestream, and the visual controls.

## Upgrading from the conference example

Replace the entire `core/` folder and update its callers together. The source hook's API and publishing lifecycle changed:

| Previous integration                                          | Livestream integration                                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useCameraSource(sourceId, enabled)`                          | `useCameraSource(enabled)` returns `{ track, stream, error }`; remove the source ID.                                                                         |
| `source.frameOutput`                                          | Call `useCameraFrameOutput(source.track)` inside each keyed camera capture.                                                                                  |
| The source hook registers a stream through `useCustomSource`. | The parent explicitly passes `source.stream` to `useLivestreamStreamer().connect({ token, inputs: { video: source.stream } })` once the stream is available. |
| Camera setup uses `useCamera`.                                | Use `useCaptureSession(device, previewOutput, frameOutput, active)` for the tested portrait capture configuration.                                           |
| Conference connection and peer tracks                         | Use livestream streamer/viewer tokens and render the stream returned by `useLivestreamViewer`.                                                               |

Keep `useCameraSource` mounted above the camera keyed by `device.id`. Its `enabled` argument controls ownership of the publishing track: retain it during camera switches and background pauses. Pause capture through `useCaptureSession`'s `active` argument instead. Zoom and torch hook signatures stay the same. The complete example below shows this ownership split and includes the iOS orientation and resolution fixes.

## Install and configure the native dependencies

These are the versions used together in this demo. The core targets native iOS and Android, with the New Architecture enabled.

| Package                                           | Tested version      |
| ------------------------------------------------- | ------------------- |
| `react` / `react-native`                          | `19.2.3` / `0.86.3` |
| `expo`                                            | `57.0.31`           |
| `@fishjam-cloud/react-native-client`              | `0.31.1`            |
| `@fishjam-cloud/react-native-custom-video-source` | `0.31.1`            |
| `@fishjam-cloud/react-native-webrtc`              | `0.31.1`            |
| `react-native-vision-camera`                      | `5.0.10`            |
| `react-native-vision-camera-worklets`             | `5.0.10`            |
| `react-native-nitro-modules`                      | `0.35.7`            |
| `react-native-nitro-image`                        | `0.15.1`            |
| `react-native-reanimated`                         | `4.5.1`             |
| `react-native-worklets`                           | `0.10.1`            |
| `react-native-gesture-handler`                    | `2.32.0`            |

In an existing Expo 57 project, install through Expo so it checks SDK compatibility:

```sh
npx expo install \
  @fishjam-cloud/react-native-client@0.31.1 \
  @fishjam-cloud/react-native-custom-video-source@0.31.1 \
  @fishjam-cloud/react-native-webrtc@0.31.1 \
  react-native-vision-camera@5.0.10 \
  react-native-vision-camera-worklets@5.0.10 \
  react-native-nitro-modules@0.35.7 \
  react-native-nitro-image@0.15.1 \
  react-native-reanimated@4.5.1 \
  react-native-worklets@0.10.1 \
  react-native-gesture-handler@2.32.0 \
  expo-build-properties
```

Merge these settings into your existing `app.json`; retain your other permissions and plugins:

```json
{
  "expo": {
    "orientation": "portrait",
    "plugins": [["expo-build-properties", { "android": { "minSdkVersion": 26 } }]],
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "Use the camera to stream video."
      }
    },
    "android": {
      "permissions": ["android.permission.CAMERA", "android.permission.ACCESS_NETWORK_STATE"]
    }
  }
}
```

Android API 26 is needed for the native hardware-buffer forwarding path. If your app also captures microphone audio, configure its microphone permission separately. The hooks here publish video only. For Expo 57 with Xcode 27 / iOS 27, also enable `ios.enableSceneSupport` in `expo-build-properties`, as in the demo's `app.json`.

Use `babel-preset-expo` and keep `react-native-worklets/plugin` last in the Babel plugin list, as in this demo. Rebuild the native app after installing these packages; Expo Go cannot run this camera stack. See the [Expo 57 Reanimated setup](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/), [build properties](https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/) and [development build guide](https://docs.expo.dev/develop/development-builds/introduction/).

## Connect the camera to Fishjam

The following component can be pasted into `src/PublishingCamera.tsx`. It expects a granted camera permission, a selected VisionCamera device, and `active` from your app's foreground and screen-focus state. Mount it inside `FishjamProvider` and `GestureHandlerRootView`. Keep the forwarding source above the keyed camera so switching lenses retains the negotiated livestream track.

```tsx
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MediaStream } from '@fishjam-cloud/react-native-client';
import { GestureDetector } from 'react-native-gesture-handler';
import { NativePreviewView, usePreviewOutput, type CameraDevice } from 'react-native-vision-camera';
import {
  useCameraSource,
  useCameraFrameOutput,
  useCaptureSession,
  useCameraControls,
  type CameraControls,
  type CameraSource,
} from './camera/core';

type PublishingCameraProps = {
  device: CameraDevice;
  active: boolean;
  onStreamChange: (stream: MediaStream | null) => void;
  renderControls?: (controls: CameraControls) => ReactNode;
};

export function PublishingCamera(props: PublishingCameraProps) {
  const source = useCameraSource(true);
  const { onStreamChange } = props;
  useEffect(() => {
    onStreamChange(source.stream ?? null);
    return () => onStreamChange(null);
  }, [source.stream, onStreamChange]);
  return <CameraSession key={props.device.id} source={source} {...props} />;
}

function CameraSession({
  device,
  active,
  source,
  renderControls,
}: PublishingCameraProps & { source: CameraSource }) {
  const { stream, error: sourceError } = source;
  const frameOutput = useCameraFrameOutput(source.track);
  const previewOutput = usePreviewOutput();
  const {
    camera,
    running,
    error: captureError,
  } = useCaptureSession(device, previewOutput, frameOutput, active && !!stream);
  const controls = useCameraControls(camera, active && running, device);
  const error = sourceError ?? captureError ?? controls.error;

  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={controls.pinch}>
        <View collapsable={false} style={StyleSheet.absoluteFill}>
          <NativePreviewView
            previewOutput={previewOutput}
            implementationMode="compatible"
            resizeMode="cover"
            style={[
              StyleSheet.absoluteFill,
              device.position === 'front' && { transform: [{ scaleX: -1 }] },
            ]}
          />
        </View>
      </GestureDetector>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {renderControls?.(controls)}
        {error && <Text accessibilityRole="alert">{error}</Text>}
      </View>
    </View>
  );
}
```

Keep the provider mounted for the whole room session:

```tsx
import type { PropsWithChildren } from 'react';
import { FishjamProvider } from '@fishjam-cloud/react-native-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export function CameraProviders({ fishjamId, children }: PropsWithChildren<{ fishjamId: string }>) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FishjamProvider fishjamId={fishjamId}>{children}</FishjamProvider>
    </GestureHandlerRootView>
  );
}
```

Use VisionCamera's `useCameraPermission` and `useCameraDevice` in the parent. Render `PublishingCamera` only after permission is granted and a device exists. Set `active` to false when the app backgrounds or the camera screen loses focus; unmount when capture ends. Do not remount it on every zoom or torch change.

Starting/stopping the livestream remains an explicit app action. Store the stream from `onStreamChange` in the parent and pass it to `useLivestreamStreamer().connect({ token: streamerToken, inputs: { video: stream } })`; use `disconnect()` to end it. Obtain a streamer token for a room of type `livestream` from your backend or the Sandbox `/livestream` endpoint. A viewer uses a separate viewer token with `useLivestreamViewer().connect({ token: viewerToken })` and renders the returned `stream` in `RTCView`. See [Fishjam's livestream tutorial](https://fishjam.swmansion.com/docs/tutorials/livestreaming) and this demo's [`useLivestreamSession`](../../room/useLivestreamSession.ts) for cancellation and connection errors.

For microphone support, include a live audio track in the initial `inputs.audio`; muting should disable that track rather than stop/recreate it. WHIP cannot add a new audio track to an already negotiated video-only session. The demo retains a muted track from connection time and releases it on exit.

## Add your controls without leaving the UI runtime

Bind animated styles/props to `liveZoom` and `desiredTorchStrength`. Actions ending in `OnUI` are worklets; call them in gesture callbacks. For a React event such as an accessibility action, schedule the same action with `scheduleOnUI`.

This small torch button can be passed through `renderControls`. It updates its background and selected accessibility state on UI. Render it only when `device.hasTorch` is true.

```tsx
import { useCallback, useMemo } from 'react';
import { Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import type { CameraControls } from './camera/core';

export function TorchButton({ controls }: { controls: CameraControls }) {
  const { desiredTorchStrength, toggleTorchOnUI, ready } = controls;
  const activateOnUI = useCallback(() => {
    'worklet';
    if (ready) toggleTorchOnUI();
  }, [ready, toggleTorchOnUI]);
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(ready)
        .onEnd((_, success) => {
          if (success) activateOnUI();
        }),
    [ready, activateOnUI],
  );
  const style = useAnimatedStyle(() => ({
    backgroundColor: desiredTorchStrength.get() > 0 ? '#2BD9B4' : '#CCCCCC',
  }));
  const animatedProps = useAnimatedProps(() => ({
    accessibilityState: { selected: desiredTorchStrength.get() > 0, disabled: !ready },
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        accessible
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel="Toggle flashlight"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityTap={() => scheduleOnUI(activateOnUI)}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'activate') scheduleOnUI(activateOnUI);
        }}
        animatedProps={animatedProps}
        style={[{ padding: 16, minHeight: 48, alignSelf: 'flex-end' }, style]}
      >
        <Text>Light</Text>
      </Animated.View>
    </GestureDetector>
  );
}
```

For a zoom preset, call `changeZoomOnUI(2)` and derive selection from `liveZoom`. For relative steps, call `stepZoomOnUI(1.25)` or `stepZoomOnUI(1 / 1.25)`. For a brightness slider, map the pointer position to an entry in `torchLevels` and call `requestTorchOnUI(level.strength)`; use `requestTorchOnUI(0)` for Off. Android strengths are native integer levels, not normalized percentages. An empty `torchLevels` array means brightness adjustment is unavailable; on/off still works when `device.hasTorch` is true.

The surrounding demo's `ZoomControls`, `TorchControls`, `CameraControlButton` and `CameraValueLabel` show complete controls, including animated numeric labels. They are optional UI examples and import the demo's theme. Copying only `core/` gives you the integration and state; bring your own UI or adapt those components.

## Public API and state ownership

| Export                                                        | Responsibility                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `useCameraSource(enabled)`                                    | Own the Fishjam forwarding track and expose its stream across camera switches              |
| `useCameraFrameOutput(track)`                                 | Create a native frame output for one camera session, forwarding to the stable track        |
| `useCaptureSession(device, preview, frames, active)`          | Configure portrait capture for the frame output and serialize native camera teardown       |
| `useCameraZoom(camera, active)`                               | Pinch gesture, live zoom, UI actions, camera limits and errors                             |
| `useCameraTorch(camera, active, device)`                      | Desired torch strength, confirmed hardware state, supported levels and serialized commands |
| `useCameraControls(camera, active, device)`                   | Compose zoom and torch for one running camera; expose `ready` and a combined error         |
| `CameraSource`, `CameraZoom`, `CameraTorch`, `CameraControls` | Result types for the hooks                                                                 |
| `TorchDevice`, `TorchLevel`                                   | Torch capabilities and the strength/label entries                                          |

Use the zoom/torch hooks separately if you only need one control. They require no Fishjam provider. `useCameraSource` also works without the provider; it only forwards frames and does not request permissions or connect to Fishjam. The livestream connection hooks require `FishjamProvider`.

| Value                    | Runtime         | Use                                                   |
| ------------------------ | --------------- | ----------------------------------------------------- |
| `liveZoom`               | UI shared value | Zoom label, selected preset and boundary feedback     |
| `desiredTorchStrength`   | UI shared value | Current selection; `0` means Off                      |
| `confirmedTorchEnabled`  | React           | Confirmed hardware status                             |
| `confirmedTorchStrength` | React           | Last confirmed nonzero strength, remembered while Off |
| `error` / `ready`        | React           | Error messages and camera lifecycle                   |

The frame callback runs on a separate camera worklet runtime. Zoom gestures and animated feedback run on UI. Discrete torch requests cross to RN and are serialized; confirmation cannot overwrite a newer selection. Keep lifecycle and room actions in React.

The example prefers 1280×720 capture at 30 fps and caps zoom at 10× within the device limits. `useCaptureSession` selects the format from the frame output's target, avoiding the screen-sized preview constraint added by VisionCamera's `useCamera` hook. That default constraint selected oversized formats on the tested iPhone 13. If your product needs different defaults, change `TARGET_RESOLUTION` in `useCameraSource.ts`, the constraints in `useCaptureSession.ts` and the cap in `useCameraZoom.ts`; verify actual received resolution on hardware. The supplied session is portrait-only, matching the app's orientation setting.

## Keep these lifecycle details when copying

Copy the whole folder, including the internal queue, rotation mapping and managed output. They are part of the working integration:

- Every frame and native buffer reference is released in `finally`.
- Camera-session teardown drains before configuring a replacement; each session owns its frame output, while the publishing track survives lens switches.
- Torch requests coalesce; teardown waits for an in-flight request and turns the light off. A resumed session waits for that cleanup.
- Old zoom and torch completions cannot replace a newer UI request.
- `useManagedFrameOutput` detaches the frame callback and retains its runtime while queued frames drain. This addresses an Android teardown crash observed with VisionCamera `5.0.10`, Worklets `0.10.1` and CameraX `1.7.0-alpha01`.
- `frameRotation` converts pixel orientation into WebRTC's clockwise correction (`left` → 90°, `right` → 270°). iOS requests physical buffer rotation from AVFoundation, delivering upright buffers with zero rotation metadata. This avoids retained I420 rotation buffers observed with the pinned SDK's WHIP path. Android keeps metadata rotation. Keep this handling in the source rather than applying a viewer-only transform.

Review the last two compatibility helpers when upgrading those packages. Before shipping a copied integration, exercise capture, pinch, torch, camera switching, background/resume and unmount on the physical devices you support. An emulator can check command flow but cannot verify flashlight output.
