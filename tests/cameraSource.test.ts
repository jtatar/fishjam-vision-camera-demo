import { act, renderHook } from '@testing-library/react-native';
import type { Frame } from 'react-native-vision-camera';
import { useCameraSource } from '../src/camera/core/useCameraSource';

const mockStream = {};
const mockTrack = {};
const mockSetStream = jest.fn().mockResolvedValue(undefined);
const mockForward = jest.fn();
const mockOutput = jest.fn((options) => options);
jest.mock('@fishjam-cloud/react-native-client', () => ({
  useCustomSource: () => ({ setStream: mockSetStream }),
}));
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

test('publishes and unregisters the exact managed camera stream', async () => {
  const { unmount } = renderHook(() => useCameraSource('camera', true));
  await act(async () => {});
  expect(mockSetStream).toHaveBeenCalledWith(mockStream);
  unmount();
  expect(mockSetStream).toHaveBeenLastCalledWith(null);
});

test('forwards native buffers and always releases both buffer and frame', () => {
  renderHook(() => useCameraSource('camera', true));
  const input = frame();
  mockOutput.mock.calls.at(-1)![0].onFrame(input.value);
  expect(mockForward).toHaveBeenCalledWith(mockTrack, { nativeBuffer: 123n, rotation: 90 });
  expect(input.release).toHaveBeenCalledTimes(1);
  expect(input.dispose).toHaveBeenCalledTimes(1);
});

test('releases camera resources even when the native forwarder rejects a frame', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    mockForward.mockImplementationOnce(() => {
      throw new Error('Stopped');
    });
    renderHook(() => useCameraSource('camera', true));
    const input = frame();
    mockOutput.mock.calls.at(-1)![0].onFrame(input.value);
    expect(input.release).toHaveBeenCalledTimes(1);
    expect(input.dispose).toHaveBeenCalledTimes(1);
  } finally {
    warn.mockRestore();
  }
});

test('disposes late frames after capture is disabled without forwarding them', () => {
  renderHook(() => useCameraSource('camera', false));
  const input = frame();
  mockOutput.mock.calls.at(-1)![0].onFrame(input.value);
  expect(mockForward).not.toHaveBeenCalled();
  expect(input.dispose).toHaveBeenCalledTimes(1);
});
