const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', 'artifacts/**', 'ios/**', 'android/**'],
  },
  {
    files: [
      'src/camera/core/useCameraZoom.ts',
      'src/camera/core/useCameraTorch.ts',
      'src/room/useLivestreamSession.ts',
      'src/room/useLivestreamMicrophone.ts',
      'src/diagnostics/LocalReceiver.tsx',
    ],
    // These effects reset state when their native camera, microphone or stream resource changes.
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
]);
