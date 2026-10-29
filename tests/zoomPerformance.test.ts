import { act, renderHook } from '@testing-library/react-native';
import type { CameraController } from 'react-native-vision-camera';
import { useCameraZoom } from '../src/camera/core/useCameraZoom';
import { flushUI } from './flushUI';

test('continuous pinch updates do not render React', async () => {
  let renders = 0;
  const camera = {
    zoom: 1,
    minZoom: 1,
    maxZoom: 8,
    setZoom: jest.fn().mockResolvedValue(undefined),
  };
  const { result } = renderHook(() => {
    renders += 1;
    return useCameraZoom(camera as unknown as CameraController, true);
  });
  const handlers = result.current.pinch.handlers;
  expect(result.current.pinch.config.runOnJS).not.toBe(true);
  expect(handlers.isWorklet.filter((value) => value !== undefined)).toEqual([true, true]);
  await flushUI();
  await act(async () => {
    handlers.onBegin?.({} as never);
    handlers.onStart?.({} as never);
  });
  const before = renders;
  for (let index = 1; index <= 60; index += 1) {
    await act(async () => handlers.onUpdate?.({ scale: 1 + index / 60 } as never));
  }
  const updateRenders = renders - before;
  console.info(
    JSON.stringify({
      pinchUpdates: 60,
      updateRenders,
      cameraCalls: camera.setZoom.mock.calls.length,
    }),
  );
  expect(camera.setZoom).toHaveBeenLastCalledWith(2);
  expect(updateRenders).toBe(0);
  expect(result.current.liveZoom.get()).toBe(2);
  await act(async () => handlers.onFinalize?.({} as never, true));
  expect(result.current.liveZoom.get()).toBe(2);
  expect(renders - before).toBe(0);
});
