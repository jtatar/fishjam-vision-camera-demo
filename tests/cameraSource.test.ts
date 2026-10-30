import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import type { Frame } from 'react-native-vision-camera';
import { useCameraSource, useCameraFrameOutput } from '../src/camera/core/useCameraSource';

const mockStream = {};
const mockTrack = {};
const mockForward = jest.fn();
const mockOutput = jest.fn((options) => options);
jest.mock('@fishjam-cloud/react-native-custom-video-source', () => ({
  useManagedForwardTrack: (enabled: boolean) => ({
    track: enabled ? mockTrack : null,
    stream: enabled ? mockStream : null,
    error: null,
  }),
}));
jest.mock('@fishjam-cloud/react-native-webrtc', () => ({
  forwardFrame: (...args: unknown[]) => mockForward(...args),
}));
jest.mock('../src/camera/core/useManagedFrameOutput', () => ({
  useManagedFrameOutput: (options: unknown) => mockOutput(options),
}));

function frame() {
  const release = jest.fn();
  const dispose = jest.fn();
  return {
    release,
    dispose,
    value: {
      orientation: 'left',
      getNativeBuffer: () => ({ pointer: 123n, release }),
      dispose,
    } as unknown as Frame,
  };
}

function useTestCapture(enabled: boolean) {
  const source = useCameraSource(enabled);
  useCameraFrameOutput(source.track);
  return source;
}

test('exposes the managed stream directly and clears it when disabled', () => {
  const { result, rerender } = renderHook(
    ({ enabled }: { enabled: boolean }) => useCameraSource(enabled),
    {
      initialProps: { enabled: true },
    },
  );
  expect(result.current.stream).toBe(mockStream);
  rerender({ enabled: false });
  expect(result.current.stream).toBeNull();
});

test('forwards native buffers and always releases both buffer and frame', () => {
  renderHook(() => useTestCapture(true));
  const input = frame();
  mockOutput.mock.calls.at(-1)![0].onFrame(input.value);
  expect(mockForward).toHaveBeenCalledWith(mockTrack, { nativeBuffer: 123n, rotation: 90 });
  expect(input.release).toHaveBeenCalledTimes(1);
  expect(input.dispose).toHaveBeenCalledTimes(1);
});

test.each(['ios', 'android'] as const)('%s configures rotation before forwarding', (platform) => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  try {
    renderHook(() => useTestCapture(true));
    const options = mockOutput.mock.calls.at(-1)![0];
    expect(options.enablePhysicalBufferRotation).toBe(platform === 'ios');
    const input = frame();
    if (platform === 'ios') Object.assign(input.value, { orientation: 'up' });
    options.onFrame(input.value);
    expect(mockForward).toHaveBeenCalledWith(mockTrack, {
      nativeBuffer: 123n,
      rotation: platform === 'ios' ? 0 : 90,
    });
    expect(input.release).toHaveBeenCalledTimes(1);
    expect(input.dispose).toHaveBeenCalledTimes(1);
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  }
});

test('releases camera resources even when the native forwarder rejects a frame', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    mockForward.mockImplementationOnce(() => {
      throw new Error('Stopped');
    });
    renderHook(() => useTestCapture(true));
    const input = frame();
    mockOutput.mock.calls.at(-1)![0].onFrame(input.value);
    expect(input.release).toHaveBeenCalledTimes(1);
    expect(input.dispose).toHaveBeenCalledTimes(1);
  } finally {
    warn.mockRestore();
  }
});

test('disposes late frames after capture is disabled without forwarding them', () => {
  renderHook(() => useTestCapture(false));
  const input = frame();
  mockOutput.mock.calls.at(-1)![0].onFrame(input.value);
  expect(mockForward).not.toHaveBeenCalled();
  expect(input.dispose).toHaveBeenCalledTimes(1);
});
