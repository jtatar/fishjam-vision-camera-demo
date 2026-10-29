# Configuration and development

## Requirements

- Node.js 22.13 or newer and npm. Use `npm ci` with the committed lockfile.
- iOS: macOS, Xcode, CocoaPods, and a physical iPhone for camera/torch testing. Device builds need Apple development signing.
- Android: Android SDK, JDK 17, and a device running API 26 or newer.

This Expo 57 / React Native 0.86 app uses the New Architecture. The native camera and WebRTC dependencies require a native build; Expo Go is unsupported.

## Local configuration

Camera preview and **Check** work without account configuration. To supply Fishjam defaults:

```sh
cp .env.example .env.local
```

Fill in the Fishjam ID and Sandbox API URL from your dashboard:

```dotenv
EXPO_PUBLIC_FISHJAM_ID=
EXPO_PUBLIC_FISHJAM_SANDBOX_URL=
EXPO_PUBLIC_ROOM_NAME=camera-controls
```

Restart Metro after changing values. A standalone Release app bundles them at build time, so rebuild it to change defaults. Alternatively, enter settings through **Stream details**. Runtime settings are held in memory.

`EXPO_PUBLIC_*` values are visible in the application bundle. Keep management credentials on your backend. For production, replace [`requestPeerToken`](../src/config.ts) with a call to an authenticated backend returning a peer-scoped token.

## Common commands

| Command                       | Purpose                                             |
| ----------------------------- | --------------------------------------------------- |
| `npm start`                   | Start Metro for an installed development build.     |
| `npm run ios -- --device`     | Build and run on a selected iPhone.                 |
| `npm run android -- --device` | Build and run on a selected Android device.         |
| `npm run prebuild`            | Regenerate native configuration.                    |
| `npm run check`               | Run lint, TypeScript, tests, and formatting checks. |
| `npm run format`              | Format source and documentation.                    |

The generated `ios/` and `android/` directories are ignored. Configure native settings through [`app.json`](../app.json), then prebuild and rebuild when they change. Install additional dependencies through `npx expo install` so Expo checks SDK compatibility.

Android's minimum SDK is 26 because native hardware-buffer forwarding requires it. Keep this build setting even when running on a newer phone. For Expo 57 builds with Xcode 27 / iOS 27, `expo-build-properties` enables iOS scene support. The supplied config and lockfile include both requirements.

## Standalone Android demo

```sh
npm run prebuild -- --platform android
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

The APK is `android/app/build/outputs/apk/release/app-release.apk`. It bundles JavaScript and runs without Metro. This command targets ARM64 devices. Expo's generated release configuration uses the development signing key; configure production signing before store distribution.

Install from the repository root:

```sh
adb devices
adb -s <device-serial> install -r android/app/build/outputs/apk/release/app-release.apk
```

## Camera and room behavior

- Camera switching resets zoom and torch. Backgrounding pauses capture, releases its source, and turns the torch off.
- Leaving the camera screen releases capture. Leaving only the Fishjam room keeps the local preview open.
- The microphone starts muted and can be enabled after joining. The viewer requests neither camera nor microphone permission.
- Both devices need matching Fishjam settings and room names, with different participant names.
- The example uses a real-time WebRTC conference room. It does not create an HLS broadcast or a server-side catalogue of streams.
- The stream title is local draft metadata. Settings cannot change during a live session.

## Troubleshooting

| Symptom                             | Check                                                                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera module missing               | Use a native build; rebuild after changing native dependencies.                                                                                    |
| Android phone absent                | Check `adb devices`, USB, and debugging authorization on the phone.                                                                                |
| No camera in an iOS simulator       | Use a physical iPhone for camera and torch verification.                                                                                           |
| Emulator has fixed zoom or no torch | Use **Emulated** front/rear cameras. VirtualScene capabilities differ; physical illumination needs a real phone.                                   |
| No brightness slider                | The selected camera reports no adjustable levels; use the circular on/off control.                                                                 |
| Viewer shows no custom camera feed  | Render `peer.customVideoTracks`, as demonstrated in `RemoteStreams`.                                                                               |
| Room join fails                     | Check the Fishjam ID, HTTPS Sandbox API URL, room, participant name, and network. A room already created with another type needs a different name. |
| Dark or rotated remote picture      | Compare it with the publisher's scene. Frame counts alone cannot prove correctness. See [orientation](architecture.md#orientation-and-teardown).   |

[Testing](../TESTING.md) · [Reusable integration](../src/camera/core/README.md) · [Back to the example](../README.md)
