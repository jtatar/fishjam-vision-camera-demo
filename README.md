# Fishjam × VisionCamera

A React Native example that streams a VisionCamera feed through Fishjam’s livestream API (WHIP publishing and WHEP playback), with native camera zoom, torch control, and responsive Reanimated UI.

[![Checks](https://github.com/jtatar/fishjam-vision-camera-demo/actions/workflows/check.yml/badge.svg)](https://github.com/jtatar/fishjam-vision-camera-demo/actions/workflows/check.yml)

[Run the app](#run-the-app) · [Reuse the integration](#reuse-the-integration) · [How it works](docs/architecture.md)

https://github.com/user-attachments/assets/5755872f-873d-480e-b7d5-042a719b4046

**iPhone publisher → Fishjam → Android viewer.** This recording predates the livestream API migration. Zoom and torch changes reach the receiving device. This 23-second clip uses one recording timeline, preserving the stream's actual delay. [Download the demo](docs/media/demo.mp4).

## What the example covers

- **Camera zoom:** pinch, presets, and step buttons change the capture itself.
- **Torch:** brightness levels where supported; a circular on/off button otherwise.
- **UI-thread feedback:** gestures, labels, selected states, and slider movement use worklets and shared values.
- **Live video:** native camera buffers become a Fishjam custom video track, with a fullscreen viewer on another device.
- **Lifecycle handling:** camera switching, foreground/background transitions, cleanup, and failed hardware requests.

The app also includes microphone audio that starts muted and a local stream check for trying the encoder/decoder without a Fishjam account.

## Run the app

Use **Node.js 22.13+**, npm, and a native build environment: Xcode/CocoaPods for iOS or the Android SDK/JDK 17 for Android. Use a physical phone to test the torch; Android requires API 26 or newer.

```sh
git clone https://github.com/jtatar/fishjam-vision-camera-demo.git
cd fishjam-vision-camera-demo
npm ci

# Choose a platform:
npm run ios -- --device
npm run android -- --device
```

These commands generate and build the native project. **Expo Go cannot run this example** because VisionCamera and WebRTC contain native code.

Tap **Open studio**, allow camera access, and try zoom and lighting. Tap **Check** to see a locally encoded and decoded stream. Fishjam credentials are only needed to stream between devices.

### Stream to another device

1. Get your **Fishjam ID** and **Sandbox API URL** from the [Fishjam dashboard](https://fishjam.io/app).
2. Enter them in the app's **Stream details** on both devices. Use the same livestream room name. The default is `camera-controls-live`; choose a new name if your old room was a conference.
3. On the publishing phone, open the studio and tap **Go live**.
4. On the second device, choose **Join as a viewer**, then tap **Watch livestream** after the host is live. Tap the video to open it fullscreen.

You can also provide defaults through `.env.local`; see [configuration and development](docs/development.md). Sandbox is for development. In production, create rooms with `roomType: 'livestream'` and fetch separate streamer/viewer tokens from your authenticated backend. Never put a management token in `EXPO_PUBLIC_*` variables.

When migrating from the conference version, keep the same Fishjam ID and Sandbox base URL, and choose a fresh room name if the old name belongs to a conference. The app requests livestream tokens automatically; there is no room-type toggle to configure. If you copied the camera hooks, also apply the [core API migration notes](src/camera/core/README.md#upgrading-from-the-conference-example).

## Reuse the integration

Copy [`src/camera/core/`](src/camera/core/) into your own project. It contains the Fishjam frame adapter and independent zoom/torch hooks, with no imports from this demo's screens, theme, navigation, or settings.

```ts
import {
  useCameraSource,
  useCameraFrameOutput,
  useCaptureSession,
  useCameraZoom,
  useCameraTorch,
  useCameraControls,
} from './camera/core';
```

Follow the **[copy-ready integration guide](src/camera/core/README.md)** for required dependencies, native configuration, providers, and a complete publishing component. Your app supplies camera permission, device selection, session state, and UI. Keep the entire folder so frame ownership and cleanup stay intact.

## Start reading here

| Code                                                                             | What it demonstrates                                                               |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`useCameraSource` / `useCameraFrameOutput`](src/camera/core/useCameraSource.ts) | Keep the publishing track stable and forward each camera session's frames into it. |
| [`useCaptureSession`](src/camera/core/useCaptureSession.ts)                      | Configure portrait capture and serialize camera-session lifecycle.                 |
| [`useCameraZoom`](src/camera/core/useCameraZoom.ts)                              | Drive camera zoom and feedback from the UI runtime.                                |
| [`useCameraTorch`](src/camera/core/useCameraTorch.ts)                            | Reconcile immediate UI feedback with serialized hardware commands.                 |
| [`CameraPublisher`](src/camera/CameraPublisher.tsx)                              | Connect one camera session, preview, controls, and publishing output.              |
| [`useLivestreamSession`](src/room/useLivestreamSession.ts)                       | Connect the publisher/viewer with role-specific tokens and handle cancellation.    |
| [`RemoteStreams`](src/room/RemoteStreams.tsx)                                    | Render the received livestream and open it fullscreen.                             |

**Runtime responsibilities:** Reanimated handles interactive feedback on UI. Camera frames are forwarded on VisionCamera's separate frame-processing runtime. React handles lifecycle, room state, errors, and the torch command queue. Continuous gestures and frame forwarding stay independent of React renders.

The example uses **Expo 57, React Native 0.86, VisionCamera 5, Fishjam 0.31, and Reanimated 4**. Exact versions are in the lockfile and [integration guide](src/camera/core/README.md). Frame orientation and teardown helpers are specific to the tested camera stack; review them when upgrading.

## Development

```sh
npm run check   # lint, TypeScript, unit/component tests, formatting
```

- [Architecture and threading](docs/architecture.md)
- [Configuration, builds, and troubleshooting](docs/development.md)
- [Tests and physical-device verification](TESTING.md)
- [Recording a side-by-side demo](docs/recording/README.md)

## License

[MIT](LICENSE).
