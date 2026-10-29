import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const release = process.argv.includes('--release');
const variant = release ? 'release' : 'debug';
const testClass = process.env.TEST_CLASS ?? 'CameraSmokeTest';
if (!['CameraSmokeTest', 'ViewerStreamTest'].includes(testClass)) {
  throw new Error('TEST_CLASS must be CameraSmokeTest or ViewerStreamTest.');
}
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
}

if (!existsSync(resolve(root, 'android/app/build.gradle'))) {
  throw new Error('Run npm run prebuild first. Start Metro with npm start in another terminal.');
}
const testDirectory = resolve(root, 'android/app/src/androidTest/java/com/jtatar/fishjamcamera');
mkdirSync(testDirectory, { recursive: true });
copyFileSync(
  resolve(root, `e2e/android/${testClass}.java`),
  resolve(testDirectory, `${testClass}.java`),
);
const gradleFile = resolve(root, 'android/app/build.gradle');
const gradle = readFileSync(gradleFile, 'utf8');
if (!gradle.includes('// fishjam-camera-e2e')) {
  writeFileSync(
    gradleFile,
    gradle +
      `
// fishjam-camera-e2e
android { defaultConfig { testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner" } }
dependencies {
  androidTestImplementation 'androidx.test:runner:1.6.2'
  androidTestImplementation 'androidx.test.ext:junit:1.2.1'
  androidTestImplementation 'androidx.test.uiautomator:uiautomator:2.3.0'
}
`,
  );
}
run(
  './gradlew',
  [
    release ? ':app:assembleRelease' : ':app:assembleDebug',
    ':app:assembleDebugAndroidTest',
    '-PreactNativeArchitectures=arm64-v8a',
    '--no-daemon',
  ],
  resolve(root, 'android'),
);
run('adb', ['install', '-r', `android/app/build/outputs/apk/${variant}/app-${variant}.apk`]);
run('adb', [
  'install',
  '-r',
  'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
]);
if (!release) run('adb', ['reverse', 'tcp:8081', 'tcp:8081']);
run('adb', ['shell', 'pm', 'grant', 'com.jtatar.fishjamcamera', 'android.permission.CAMERA']);
run('adb', ['shell', 'am', 'force-stop', 'com.jtatar.fishjamcamera']);
run('adb', ['shell', 'rm', '-rf', '/sdcard/Android/data/com.jtatar.fishjamcamera/files/e2e']);
mkdirSync(resolve(root, 'artifacts/screenshots'), { recursive: true });
rmSync(resolve(root, 'artifacts/screenshots/e2e'), { recursive: true, force: true });
const result = spawnSync(
  'adb',
  [
    'shell',
    'am',
    'instrument',
    '-w',
    '-e',
    'class',
    `com.jtatar.fishjamcamera.${testClass}`,
    'com.jtatar.fishjamcamera.test/androidx.test.runner.AndroidJUnitRunner',
  ],
  { cwd: root, encoding: 'utf8' },
);
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
const output = (result.stdout ?? '') + (result.stderr ?? '');
writeFileSync(resolve(root, `artifacts/android-e2e-${variant}.txt`), output);
console.log(output);
spawnSync(
  'adb',
  ['pull', '/sdcard/Android/data/com.jtatar.fishjamcamera/files/e2e', 'artifacts/screenshots'],
  { cwd: root, stdio: 'inherit' },
);
if (result.status !== 0 || !output.includes('OK (1 test)')) process.exitCode = 1;
