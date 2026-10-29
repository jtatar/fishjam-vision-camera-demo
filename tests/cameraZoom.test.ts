import { act, renderHook } from '@testing-library/react-native';
import type { CameraController } from 'react-native-vision-camera';
import { useCameraZoom } from '../src/camera/core/useCameraZoom';
import { scheduleOnUI } from 'react-native-worklets';
import { flushUI } from './flushUI';

function camera() {
  return { zoom: 1, minZoom: 1, maxZoom: 8, setZoom: jest.fn().mockResolvedValue(undefined) };
}

test('successive pinches start from the current UI zoom, including cancelled gestures', async () => {
  const native = camera();
  const { result } = renderHook(() => useCameraZoom(native as unknown as CameraController, true));
  await flushUI();
  const handlers = result.current.pinch.handlers;
  await act(async () => {
    handlers.onStart?.({} as never);
    handlers.onUpdate?.({ scale: 1.5 } as never);
    handlers.onFinalize?.({} as never, false);
  });
  expect(result.current.liveZoom.get()).toBe(1.5);
  await act(async () => {
    handlers.onStart?.({} as never);
    handlers.onUpdate?.({ scale: 2 } as never);
    handlers.onFinalize?.({} as never, true);
  });
  expect(native.setZoom.mock.calls).toEqual([[1.5], [3]]);
  expect(result.current.liveZoom.get()).toBe(3);
});

test('zoom steps use the latest pinch value on the UI runtime', async () => {
  const native = camera();
  const { result } = renderHook(() => useCameraZoom(native as unknown as CameraController, true));
  await flushUI();
  act(() => {
    result.current.pinch.handlers.onStart?.({} as never);
    result.current.pinch.handlers.onUpdate?.({ scale: 2 } as never);
  });
  expect(result.current.liveZoom.get()).toBe(2);
  act(() => scheduleOnUI(result.current.stepZoomOnUI, 1.25));
  await flushUI();
  expect(native.setZoom).toHaveBeenLastCalledWith(2.5);
  expect(result.current.liveZoom.get()).toBe(2.5);
});

test('the latest native failure restores actual zoom and remains retryable', async () => {
  const native = camera();
  native.setZoom.mockRejectedValueOnce(new Error('Camera busy'));
  const { result } = renderHook(() => useCameraZoom(native as unknown as CameraController, true));
  act(() => scheduleOnUI(result.current.changeZoomOnUI, 3));
  await flushUI();
  expect(result.current.liveZoom.get()).toBe(1);
  expect(result.current.error).toBe('Camera busy');
  act(() => scheduleOnUI(result.current.changeZoomOnUI, 3));
  await flushUI();
  expect(result.current.liveZoom.get()).toBe(3);
  expect(result.current.error).toBeNull();
});

test('backgrounding ignores late errors and stops subsequent gesture commands', async () => {
  const native = camera();
  let fail!: (error: Error) => void;
  native.setZoom.mockImplementationOnce(() => new Promise<void>((_, reject) => (fail = reject)));
  const { result, rerender } = renderHook(
    ({ active }: { active: boolean }) =>
      useCameraZoom(native as unknown as CameraController, active),
    { initialProps: { active: true } },
  );
  act(() => scheduleOnUI(result.current.changeZoomOnUI, 2));
  await flushUI();
  const handlers = result.current.pinch.handlers;
  rerender({ active: false });
  await flushUI();
  await act(async () => {
    fail(new Error('Camera stopped'));
    handlers.onUpdate?.({ scale: 4 } as never);
    handlers.onFinalize?.({} as never, false);
  });
  expect(native.setZoom).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBeNull();
  expect(result.current.liveZoom.get()).toBe(1);
});

test('pinching beyond a limit does not repeatedly submit the same native zoom', async () => {
  const native = camera();
  const { result } = renderHook(() => useCameraZoom(native as unknown as CameraController, true));
  await flushUI();
  await act(async () => {
    result.current.pinch.handlers.onStart?.({} as never);
    for (const scale of [10, 20, 30]) result.current.pinch.handlers.onUpdate?.({ scale } as never);
    result.current.pinch.handlers.onFinalize?.({} as never, true);
  });
  expect(native.setZoom.mock.calls).toEqual([[8]]);
  expect(result.current.liveZoom.get()).toBe(8);
});
