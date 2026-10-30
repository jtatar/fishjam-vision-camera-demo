import { act, renderHook } from '@testing-library/react-native';
import type {
  CameraDevice,
  CameraFrameOutput,
  CameraPreviewOutput,
} from 'react-native-vision-camera';
import { useCaptureSession } from '../src/camera/core/useCaptureSession';

const mockCreate = jest.fn();
jest.mock('react-native-vision-camera', () => ({
  VisionCamera: { createCameraSession: () => mockCreate() },
}));
const device = {} as CameraDevice;
const frames = {} as CameraFrameOutput;
const preview = {} as CameraPreviewOutput;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function settle() {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
}
function session() {
  const started = jest.fn();
  const remove = jest.fn();
  return {
    isRunning: true,
    controller: {},
    configure: jest.fn().mockResolvedValue([{}]),
    start: jest.fn().mockImplementation(async () => started()),
    stop: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
    addOnStartedListener: (fn: () => void) => {
      started.mockImplementation(fn);
      return { remove };
    },
    addOnStoppedListener: () => ({ remove }),
    addOnInterruptionStartedListener: () => ({ remove }),
    addOnInterruptionEndedListener: () => ({ remove }),
    addOnErrorListener: () => ({ remove }),
    remove,
  };
}
function mount(active = true) {
  return renderHook(
    ({ active }: { active: boolean }) => useCaptureSession(device, preview, frames, active),
    {
      initialProps: { active },
    },
  );
}

test('negotiates stream resolution without a preview size constraint before starting', async () => {
  const native = session();
  const configuration = deferred<unknown[]>();
  native.configure.mockReturnValueOnce(configuration.promise);
  mockCreate.mockResolvedValue(native);
  const view = mount();
  await settle();
  expect(native.start).not.toHaveBeenCalled();
  expect(native.configure.mock.calls[0][0][0].constraints).toEqual([
    { resolutionBias: frames },
    { fps: 30 },
  ]);
  expect(preview.outputOrientation).toBe('up');
  expect(frames.outputOrientation).toBe('up');
  configuration.resolve([native.controller]);
  await settle();
  expect(view.result.current.camera).toBe(native.controller);
  expect(view.result.current.running).toBe(true);
  view.unmount();
  await settle();
  expect(native.remove).toHaveBeenCalledTimes(5);
  expect(native.configure).toHaveBeenLastCalledWith([]);
  expect(native.dispose).toHaveBeenCalledTimes(1);
});

test('waits for background stop before starting capture again', async () => {
  const native = session();
  mockCreate.mockResolvedValue(native);
  const view = mount();
  await settle();
  const stopping = deferred<void>();
  native.stop.mockReturnValueOnce(stopping.promise);
  view.rerender({ active: false });
  await settle();
  view.rerender({ active: true });
  await settle();
  expect(native.start).toHaveBeenCalledTimes(1);
  stopping.resolve();
  await settle();
  expect(native.start).toHaveBeenCalledTimes(2);
  view.unmount();
  await settle();
});

test('drains a cancelled late session before opening the next camera', async () => {
  const old = session();
  const next = session();
  const creation = deferred<ReturnType<typeof session>>();
  mockCreate.mockReturnValueOnce(creation.promise).mockResolvedValueOnce(next);
  const first = mount();
  await settle();
  first.unmount();
  const second = mount();
  await settle();
  expect(mockCreate).toHaveBeenCalledTimes(1);
  creation.resolve(old);
  await settle();
  expect(old.start).not.toHaveBeenCalled();
  expect(old.stop).toHaveBeenCalledTimes(1);
  expect(old.dispose).toHaveBeenCalledTimes(1);
  expect(next.start).toHaveBeenCalledTimes(1);
  expect(old.dispose.mock.invocationCallOrder[0]).toBeLessThan(
    next.configure.mock.invocationCallOrder[0],
  );
  second.unmount();
  await settle();
});

test('reports configuration failure without starting an unconfigured session', async () => {
  const native = session();
  native.configure.mockRejectedValueOnce(new Error('Camera unavailable'));
  mockCreate.mockResolvedValue(native);
  const view = mount();
  await settle();
  expect(view.result.current.error).toBe('Camera unavailable');
  expect(native.start).not.toHaveBeenCalled();
  view.unmount();
  await settle();
  expect(native.dispose).toHaveBeenCalledTimes(1);
});
