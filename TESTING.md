# Testing the example

## Automated checks

```sh
npm ci
npm run check
```

The same command runs in GitHub Actions. It includes ESLint, TypeScript, Jest/React Native Testing Library, and Prettier.

Tests cover zoom bounds and UI-worklet feedback; torch capabilities, ordering, cleanup and rollback; frame ownership and teardown; preview render isolation; permission fallback; livestream token roles, WHIP/WHEP connection/cancellation; microphone state; and fullscreen playback.

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

Disconnect physical-device screen interaction in Xcode Device Hub before camera tests. Apple documents that it blocks camera and microphone capture while connected, producing empty video or silence. Quit Device Hub and reopen the studio before testing; closing its compact window can leave interaction connected. See [Device Hub limitations](https://developer.apple.com/documentation/xcode/interacting-with-your-app-in-device-hub).

For simulator navigation/permission fallback, use `SIMULATOR_UDID=<simulator-udid> npm run test:ios` with Metro running. This is not a camera hardware test.

## Fishjam and fullscreen playback

Use matching Fishjam settings and room names, using a new name if the previous room was a conference. Keep the publisher live before running the Android viewer test:

```sh
TEST_CLASS=ViewerStreamTest ANDROID_SERIAL=<device-serial> npm run test:android -- --release
```

It checks visible video within 15 seconds of opening fullscreen, fullscreen bounds, Android Back, explicit collapse, and livestream connection. Keep the publisher's lens uncovered and aimed at a lit scene. Compare the actual picture with the publisher to verify orientation.

To automate the iPhone publisher while another device is watching the room:

```sh
TEST_CLASS=LiveStreamTests DEVICE_UDID=<iphone-udid> \
  DEVELOPMENT_TEAM=<apple-team-id> npm run test:ios
```

This checks that publishing remains Live through zoom, torch, microphone and camera changes, then background/resume. It verifies that audio stays muted after resuming and ends the broadcast. Observe or record the viewer separately; publisher assertions alone cannot establish remote rendering or audible audio.

After installing both Android APKs, keep the viewer connected and capture screenshots every four seconds during the publisher test with:

```sh
adb -s <device-serial> shell am instrument -w \
  -e class com.jtatar.fishjamcamera.ViewerStreamTest \
  -e observeSeconds 140 \
  com.jtatar.fishjamcamera.test/androidx.test.runner.AndroidJUnitRunner
```

The optional observation window accepts 0–300 seconds. The viewer disconnects at the end. Pull screenshots from `/sdcard/Android/data/com.jtatar.fishjamcamera/files/e2e` for comparison with the iPhone XCTest attachments.

## What to check manually

1. Publish a clearly identifiable scene and confirm the viewer shows it upright.
2. Change zoom with presets and pinch. Confirm both capture and received video change.
3. On a real phone, verify the flashlight illuminates the scene. Test brightness levels or the direct on/off button, depending on capabilities.
4. Switch cameras, background/resume, and leave/reopen the studio. Confirm torch cleanup and resumed video.
5. Open/close fullscreen playback, including Android Back. The viewer should stay in the room.

**Check** tests local capture → forwarding → encoding → decoding. It does not test Fishjam signaling, token acquisition, SFU forwarding, or network connectivity. Successful commands and frame counts cannot prove illumination or image orientation.

## Livestream migration checks (30 October 2026)

Lint, TypeScript, formatting, and 133 unit/component tests pass in 17 suites. A live Sandbox check returned separate streamer and viewer tokens through the livestream endpoints using the locally configured project.

The physical iPhone 13 publisher and Pixel 9 Pro Android emulator connected through WHIP/WHEP. The final iPhone control test passed in 156 seconds, covering zoom, torch levels, microphone state, both camera switches, background/resume, and ending the broadcast. The Android viewer test passed during the same broadcast, including visible video, fullscreen, Back, and collapse. Receiver logs show frames continuing through camera switches and returning after the intentional background pause, generally around 30 fps. Front-camera screenshots match the upright ceiling scene. The first rear-camera image assertion failed on an entirely dark view; a retry received a lit but obscured rear image. Repeat the visual rear-camera check with an unobstructed scene. Microphone audibility has not been verified.

The Android Release capture suite also passed in 108 seconds with both emulator cameras set to **Emulated**. It covers nonblack local decoded video, pinch/presets, torch controls, switching, background/resume, reopening, and repeated lifecycle transitions. The default **Virtual Scene** rear camera has no 2× zoom preset, so it cannot satisfy this suite's zoom assertions.

Two capture fixes followed hardware testing. Physical buffer rotation on iOS avoids a WebRTC I420 rotation path that retained over 1 GB and triggered memory-pressure termination; a subsequent 20-second Allocations trace showed about 57 MB retained allocations and no accumulating I420 frames. This is an allocation measurement, not total process memory. Explicit session constraints also avoid the screen-sized preview bias that selected oversized formats. The final receiver starts at 720×1280 portrait video and can adapt downward with network conditions. The revised Release builds are installed on both devices.

Local evidence is retained under ignored `artifacts/`: `livestream-ios-paired.log`, `livestream-ios-paired-attachments/`, `livestream-viewer-paired-retry.log`, `livestream-viewer-paired-retry-final/`, and `livestream-viewer-paired-retry-logcat.log` cover the final device run. `livestream-android-capture-smoke-emulated.log` records the Android capture suite. `livestream-memory-pid.trace` and `livestream-memory-final.trace` contain the allocation profiles before and after the rotation fix. `livestream-final-check.log` records lint, TypeScript, all 133 tests, and formatting.

## Previous verification snapshot

These device results predate the livestream API migration and do not verify WHIP/WHEP playback. Repeat the two-device checks for the migrated flow, including microphone mute/unmute, camera switching, and background/resume.

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
