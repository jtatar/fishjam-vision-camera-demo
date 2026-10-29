# Testing the example

## Automated checks

```sh
npm ci
npm run check
```

The same command runs in GitHub Actions. It includes ESLint, TypeScript, Jest/React Native Testing Library, and Prettier.

Tests cover zoom bounds and UI-worklet feedback; torch capabilities, ordering, cleanup and rollback; frame ownership and teardown; preview render isolation; permission fallback; room joining/cancellation; microphone state; and fullscreen playback.

## Android device tests

Set `ANDROID_HOME` and put `adb` on `PATH`. Use an ARM64 device or emulator. Set emulator front/rear cameras to **Emulated**; emulated torch commands cannot establish physical illumination.

```sh
npm run prebuild -- --platform android
ANDROID_SERIAL=<device-serial> npm run test:android -- --release
```

The script builds and installs a standalone Release app and its instrumentation test. It grants camera permission and exercises pinch/presets, torch controls, local decoding, switching, background/resume, and reopening. Reports/screenshots go under ignored `artifacts/`. The full test expects a visible, nonblack camera scene.

For a development build, omit `--release` and run `npm start` in another terminal.

After installing the app and instrumentation APK, run just the controls portion with:

```sh
adb -s <device-serial> shell am instrument -w \
  -e class com.jtatar.fishjamcamera.CameraSmokeTest \
  -e controlsOnly true \
  com.jtatar.fishjamcamera.test/androidx.test.runner.AndroidJUnitRunner
```

This skips stream and lifecycle checks and can run with the physical camera covered.

## iPhone device tests

Use a connected, unlocked iPhone with Developer Mode, Apple development signing, and UI automation enabled when prompted. The script needs Ruby's `xcodeproj` gem, which CocoaPods also uses.

```sh
npm run prebuild -- --platform ios
DEVICE_UDID=<iphone-udid> DEVELOPMENT_TEAM=<apple-team-id> npm run test:ios
```

With Homebrew CocoaPods, expose its gem environment if needed through `GEM_HOME="$(brew --prefix cocoapods)/libexec"`. The script builds a signed Release app and exercises actual camera controls and local decoding. It adds a test target only to the generated native project and retains `.xcresult` bundles under `artifacts/`.

For simulator navigation/permission fallback, use `SIMULATOR_UDID=<simulator-udid> npm run test:ios` with Metro running. This is not a camera hardware test.

## Fishjam and fullscreen playback

Use matching Fishjam settings and room names, with distinct participant names. Keep the publisher live before running the Android viewer test:

```sh
TEST_CLASS=ViewerStreamTest ANDROID_SERIAL=<device-serial> npm run test:android -- --release
```

It checks fullscreen bounds, Android Back, explicit collapse, and room membership. Compare the actual picture with the publisher to verify orientation.

To automate the iPhone publisher while another device is watching the room:

```sh
TEST_CLASS=LiveStreamTests DEVICE_UDID=<iphone-udid> \
  DEVELOPMENT_TEAM=<apple-team-id> npm run test:ios
```

This checks that publishing remains Live through zoom and torch changes. Observe or record the viewer separately; publisher assertions alone cannot establish remote rendering. XCTest closes the broadcaster after the test.

## What to check manually

1. Publish a clearly identifiable scene and confirm the viewer shows it upright.
2. Change zoom with presets and pinch. Confirm both capture and received video change.
3. On a real phone, verify the flashlight illuminates the scene. Test brightness levels or the direct on/off button, depending on capabilities.
4. Switch cameras, background/resume, and leave/reopen the studio. Confirm torch cleanup and resumed video.
5. Open/close fullscreen playback, including Android Back. The viewer should stay in the room.

**Check** tests local capture → forwarding → encoding → decoding. It does not test Fishjam signaling, token acquisition, SFU forwarding, or network connectivity. Successful commands and frame counts cannot prove illumination or image orientation.

## Verification snapshot

Checked on **29 October 2026** with the committed dependency versions:

| Check                                 | Result                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Lint, TypeScript, formatting          | Passed.                                                                                                     |
| Unit/component tests                  | 116 passed in 16 suites.                                                                                    |
| Samsung Galaxy A55 Release controls   | Passed: pinch/reset and circular torch on/off, with no brightness panel.                                    |
| Android emulator Release camera suite | Passed before the circular-button refinement; covers brightness, local decoding, and lifecycle transitions. |
| iPhone 13 Release camera suite        | Passed before the later orientation/fullscreen changes.                                                     |
| Side-by-side demo                     | Recorded iPhone publisher and Android viewer show received zoom and torch changes.                          |

A broader A55 smoke run stopped at its nonblack-image assertion with a dark preview. The subsequent controls-only run passed. The showcase is a functional demonstration, not a latency or frame-rate benchmark. Repeat physical-device checks after dependency upgrades.

[Architecture](docs/architecture.md) · [Development](docs/development.md) · [Back to the example](README.md)
