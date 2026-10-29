import { act, renderHook } from '@testing-library/react-native';
import * as Worklets from 'react-native-worklets';
import { scheduleOnUI } from 'react-native-worklets';
import type { CameraController } from 'react-native-vision-camera';
import { useCameraControls } from '../src/camera/core/useCameraControls';
import { flushUI } from './flushUI';

// Keep the real schedulers, with configurable exports for stalled-RN regressions.
jest.mock('react-native-worklets', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-worklets'),
}));

async function settleTorch() {
  // UI request -> RN hardware queue -> UI reconciliation -> React confirmation.
  await flushUI();
  await flushUI();
}

const torchDevice = {
  hasTorch: true,
  supportsTorchStrength: false,
  minTorchStrength: 0.001,
  maxTorchStrength: 1,
};

function camera() {
  return {
    zoom: 1,
    minZoom: 1,
    maxZoom: 8,
    setZoom: jest.fn().mockResolvedValue(undefined),
    setTorchMode: jest.fn().mockResolvedValue(undefined),
    enableTorchWithStrength: jest.fn().mockResolvedValue(undefined),
  };
}

test('applies real camera zoom and clamps button requests to device limits', async () => {
  const native = camera();
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, torchDevice),
  );
  await act(async () => scheduleOnUI(result.current.changeZoomOnUI, 20));
  await flushUI();
  expect(native.setZoom).toHaveBeenCalledWith(8);
  expect(result.current.liveZoom.get()).toBe(8);
});

test('unsupported cameras never receive torch commands', async () => {
  const native = camera();
  const device = { ...torchDevice, hasTorch: false };
  const { result, unmount } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, device),
  );
  await act(async () => scheduleOnUI(result.current.toggleTorchOnUI));
  await settleTorch();
  unmount();
  expect(native.setTorchMode).not.toHaveBeenCalled();
});

test('confirms torch only after native success and resets on background', async () => {
  const native = camera();
  const { result, rerender } = renderHook(
    ({ active }: { active: boolean }) =>
      useCameraControls(native as unknown as CameraController, active, torchDevice),
    { initialProps: { active: true } },
  );
  await act(async () => scheduleOnUI(result.current.toggleTorchOnUI));
  await settleTorch();
  expect(native.setTorchMode).toHaveBeenCalledWith('on');
  expect(result.current.confirmedTorchEnabled).toBe(true);
  rerender({ active: false });
  await act(async () => {});
  await settleTorch();
  expect(native.setTorchMode).toHaveBeenLastCalledWith('off');
  expect(result.current.confirmedTorchEnabled).toBe(false);
  expect(result.current.ready).toBe(false);
});

test('shows native torch rejection without pretending the lamp is on', async () => {
  const native = camera();
  native.setTorchMode.mockRejectedValue(new Error('Torch is unavailable while overheating'));
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, torchDevice),
  );
  await act(async () => scheduleOnUI(result.current.toggleTorchOnUI));
  await settleTorch();
  expect(result.current.confirmedTorchEnabled).toBe(false);
  expect(result.current.error).toContain('overheating');
});

test('ignores controls while the camera is paused', async () => {
  const native = camera();
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, false, torchDevice),
  );
  await act(async () => {
    scheduleOnUI(result.current.changeZoomOnUI, 4);
    scheduleOnUI(result.current.toggleTorchOnUI);
  });
  await settleTorch();
  expect(native.setZoom).not.toHaveBeenCalled();
  expect(native.setTorchMode).not.toHaveBeenCalled();
});

test('applies brightness and remembers it across off/on toggles', async () => {
  const native = camera();
  const device = { ...torchDevice, supportsTorchStrength: true };
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, device),
  );
  await act(async () => scheduleOnUI(result.current.requestTorchOnUI, 0.25));
  await settleTorch();
  expect(native.enableTorchWithStrength).toHaveBeenLastCalledWith(0.25);
  expect(result.current.confirmedTorchEnabled).toBe(true);
  expect(result.current.confirmedTorchStrength).toBe(0.25);
  await act(async () => scheduleOnUI(result.current.toggleTorchOnUI));
  await settleTorch();
  expect(native.setTorchMode).toHaveBeenLastCalledWith('off');
  expect(result.current.confirmedTorchEnabled).toBe(false);
  await act(async () => scheduleOnUI(result.current.toggleTorchOnUI));
  await settleTorch();
  expect(native.enableTorchWithStrength).toHaveBeenLastCalledWith(0.25);
  expect(result.current.confirmedTorchEnabled).toBe(true);
});

test('a failed brightness change preserves the last confirmed level', async () => {
  const native = camera();
  const device = { ...torchDevice, supportsTorchStrength: true };
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, device),
  );
  await act(async () => scheduleOnUI(result.current.requestTorchOnUI, 0.25));
  await settleTorch();
  native.enableTorchWithStrength.mockRejectedValueOnce(new Error('Device is too hot'));
  await act(async () => scheduleOnUI(result.current.requestTorchOnUI, 1));
  await settleTorch();
  expect(result.current.confirmedTorchStrength).toBe(0.25);
  expect(result.current.confirmedTorchEnabled).toBe(true);
  expect(result.current.error).toBe('Device is too hot');
});

test('waits for brightness confirmation and turns off after an in-flight change on background', async () => {
  const native = camera();
  const device = { ...torchDevice, supportsTorchStrength: true };
  let finish!: () => void;
  native.enableTorchWithStrength.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { result, rerender } = renderHook(
    ({ active }: { active: boolean }) =>
      useCameraControls(native as unknown as CameraController, active, device),
    { initialProps: { active: true } },
  );
  act(() => {
    scheduleOnUI(result.current.requestTorchOnUI, 0.25);
    scheduleOnUI(result.current.requestTorchOnUI, 0.5);
  });
  await settleTorch();
  expect(native.enableTorchWithStrength).toHaveBeenCalledTimes(1);
  expect(result.current.confirmedTorchEnabled).toBe(false);
  rerender({ active: false });
  await act(async () => finish());
  await settleTorch();
  expect(native.setTorchMode).toHaveBeenLastCalledWith('off');
  expect(result.current.confirmedTorchEnabled).toBe(false);
  expect(result.current.confirmedTorchStrength).toBe(1);
});

test('only supported brightness presets reach the native camera', async () => {
  const native = camera();
  const device = { ...torchDevice, supportsTorchStrength: true };
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, device),
  );
  await act(async () => {
    for (const strength of [-1, 0.3, 5, Number.NaN])
      scheduleOnUI(result.current.requestTorchOnUI, strength);
  });
  await settleTorch();
  expect(native.enableTorchWithStrength).not.toHaveBeenCalled();
  expect(native.setTorchMode).not.toHaveBeenCalled();
});

test('on/off-only devices retain the default torch API', async () => {
  const native = camera();
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, torchDevice),
  );
  expect(result.current.torchLevels).toEqual([]);
  await act(async () => scheduleOnUI(result.current.requestTorchOnUI, 0.25));
  await settleTorch();
  await act(async () => scheduleOnUI(result.current.toggleTorchOnUI));
  await settleTorch();
  expect(native.enableTorchWithStrength).not.toHaveBeenCalled();
  expect(native.setTorchMode).toHaveBeenCalledWith('on');
});

test('coalesces rapid slider levels and keeps the last requested brightness', async () => {
  const native = camera();
  const device = { ...torchDevice, supportsTorchStrength: true };
  let finish!: () => void;
  native.enableTorchWithStrength.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, device),
  );
  act(() => {
    scheduleOnUI(result.current.requestTorchOnUI, 0.25);
    scheduleOnUI(result.current.requestTorchOnUI, 0.5);
    scheduleOnUI(result.current.requestTorchOnUI, 0.75);
  });
  await settleTorch();
  expect(native.enableTorchWithStrength.mock.calls).toEqual([[0.25]]);
  await act(async () => finish());
  await settleTorch();
  expect(native.enableTorchWithStrength.mock.calls).toEqual([[0.25], [0.75]]);
  expect(result.current.confirmedTorchStrength).toBe(0.75);
});

test('dragging to off wins over an in-flight brightness change', async () => {
  const native = camera();
  const device = { ...torchDevice, supportsTorchStrength: true };
  let finish!: () => void;
  native.enableTorchWithStrength.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, device),
  );
  act(() => {
    scheduleOnUI(result.current.requestTorchOnUI, 0.5);
    scheduleOnUI(result.current.requestTorchOnUI, 1);
    scheduleOnUI(result.current.requestTorchOnUI, 0);
  });
  await settleTorch();
  await act(async () => finish());
  await settleTorch();
  expect(native.enableTorchWithStrength.mock.calls).toEqual([[0.5]]);
  expect(native.setTorchMode).toHaveBeenLastCalledWith('off');
  expect(result.current.confirmedTorchEnabled).toBe(false);
});

test('an intermediate slider failure does not discard the final selection', async () => {
  const native = camera();
  const device = { ...torchDevice, supportsTorchStrength: true };
  let fail!: (cause: Error) => void;
  native.enableTorchWithStrength.mockImplementationOnce(
    () =>
      new Promise<void>((_, reject) => {
        fail = reject;
      }),
  );
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, device),
  );
  act(() => {
    scheduleOnUI(result.current.requestTorchOnUI, 0.25);
    scheduleOnUI(result.current.requestTorchOnUI, 0.75);
  });
  await settleTorch();
  await act(async () => fail(new Error('Temporary camera interruption')));
  await settleTorch();
  expect(native.enableTorchWithStrength).toHaveBeenLastCalledWith(0.75);
  expect(result.current.confirmedTorchStrength).toBe(0.75);
  expect(result.current.error).toBeNull();
});

test('repeated requests for an in-flight level only reach hardware once', async () => {
  const native = camera();
  let finish!: () => void;
  native.enableTorchWithStrength.mockImplementationOnce(
    () => new Promise<void>((resolve) => (finish = resolve)),
  );
  const device = { ...torchDevice, supportsTorchStrength: true };
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, device),
  );
  act(() => {
    scheduleOnUI(result.current.requestTorchOnUI, 0.5);
    scheduleOnUI(result.current.requestTorchOnUI, 0.5);
  });
  await settleTorch();
  await act(async () => finish());
  await settleTorch();
  expect(native.enableTorchWithStrength.mock.calls).toEqual([[0.5]]);
  expect(result.current.confirmedTorchStrength).toBe(0.5);
});

test('power can cancel torch-on before the native operation completes', async () => {
  const native = camera();
  let finish!: () => void;
  native.setTorchMode.mockImplementationOnce(
    () => new Promise<void>((resolve) => (finish = resolve)),
  );
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, torchDevice),
  );
  act(() => {
    scheduleOnUI(result.current.toggleTorchOnUI);
    scheduleOnUI(result.current.toggleTorchOnUI);
  });
  await settleTorch();
  await act(async () => finish());
  await settleTorch();
  expect(native.setTorchMode.mock.calls).toEqual([['on'], ['off']]);
  expect(result.current.confirmedTorchEnabled).toBe(false);
});

test('returning to an in-flight target cancels the queued change without reapplying it', async () => {
  const native = camera();
  let finish!: () => void;
  native.setTorchMode.mockImplementationOnce(
    () => new Promise<void>((resolve) => (finish = resolve)),
  );
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, torchDevice),
  );
  act(() => {
    scheduleOnUI(result.current.toggleTorchOnUI);
    scheduleOnUI(result.current.toggleTorchOnUI);
    scheduleOnUI(result.current.toggleTorchOnUI);
  });
  await settleTorch();
  await act(async () => finish());
  await settleTorch();
  expect(native.setTorchMode.mock.calls).toEqual([['on']]);
  expect(result.current.confirmedTorchEnabled).toBe(true);
});

test('a failed level remains retryable despite duplicate request suppression', async () => {
  const native = camera();
  native.enableTorchWithStrength.mockRejectedValueOnce(new Error('Camera busy'));
  const device = { ...torchDevice, supportsTorchStrength: true };
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, device),
  );
  await act(async () => scheduleOnUI(result.current.requestTorchOnUI, 0.5));
  await settleTorch();
  expect(result.current.confirmedTorchEnabled).toBe(false);
  await act(async () => scheduleOnUI(result.current.requestTorchOnUI, 0.5));
  await settleTorch();
  expect(native.enableTorchWithStrength.mock.calls).toEqual([[0.5], [0.5]]);
  expect(result.current.confirmedTorchStrength).toBe(0.5);
  expect(result.current.confirmedTorchEnabled).toBe(true);
  expect(result.current.error).toBeNull();
});

test('intermediate zoom completion does not move the UI back from the latest target', async () => {
  const native = camera();
  let finishFirst!: () => void;
  let finishLast!: () => void;
  native.setZoom
    .mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)))
    .mockImplementationOnce(() => new Promise<void>((resolve) => (finishLast = resolve)));
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, torchDevice),
  );
  act(() => {
    scheduleOnUI(result.current.changeZoomOnUI, 2);
    scheduleOnUI(result.current.changeZoomOnUI, 3);
  });
  await flushUI();
  await act(async () => finishFirst());
  expect(result.current.liveZoom.get()).toBe(3);
  await act(async () => finishLast());
  expect(result.current.liveZoom.get()).toBe(3);
});

test('the final zoom succeeds after an earlier native request fails', async () => {
  const native = camera();
  let fail!: (error: Error) => void;
  native.setZoom.mockImplementationOnce(() => new Promise<void>((_, reject) => (fail = reject)));
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, torchDevice),
  );
  act(() => {
    scheduleOnUI(result.current.changeZoomOnUI, 2);
    scheduleOnUI(result.current.changeZoomOnUI, 3);
  });
  await flushUI();
  await act(async () => fail(new Error('Camera busy')));
  expect(result.current.liveZoom.get()).toBe(3);
  expect(result.current.error).toBeNull();
});

test('resume waits for an old enable and its torch-off before applying the new selection', async () => {
  const native = camera();
  const device = { ...torchDevice, supportsTorchStrength: true };
  const order: string[] = [];
  let finishOldEnable!: () => void;
  let finishCleanup!: () => void;
  native.enableTorchWithStrength
    .mockImplementationOnce(() => {
      order.push('old on');
      return new Promise<void>((resolve) => (finishOldEnable = resolve));
    })
    .mockImplementationOnce(async () => {
      order.push('new on');
    });
  native.setTorchMode.mockImplementationOnce(() => {
    order.push('old off');
    return new Promise<void>((resolve) => (finishCleanup = resolve));
  });
  const { result, rerender } = renderHook(
    ({ active }: { active: boolean }) =>
      useCameraControls(native as unknown as CameraController, active, device),
    { initialProps: { active: true } },
  );
  act(() => scheduleOnUI(result.current.requestTorchOnUI, 0.25));
  await settleTorch();
  rerender({ active: false });
  rerender({ active: true });
  act(() => scheduleOnUI(result.current.requestTorchOnUI, 0.75));
  await settleTorch();
  expect(order).toEqual(['old on']);
  expect(result.current.desiredTorchStrength.get()).toBe(0.75);
  await act(async () => finishOldEnable());
  await settleTorch();
  expect(order).toEqual(['old on', 'old off']);
  expect(result.current.confirmedTorchEnabled).toBe(false);
  await act(async () => finishCleanup());
  await settleTorch();
  expect(order).toEqual(['old on', 'old off', 'new on']);
  expect(result.current.desiredTorchStrength.get()).toBe(0.75);
  expect(result.current.confirmedTorchStrength).toBe(0.75);
  expect(result.current.confirmedTorchEnabled).toBe(true);
});

test('latest failure restores the last hardware success without intermediate UI jumps', async () => {
  const native = camera();
  const device = { ...torchDevice, supportsTorchStrength: true };
  let finishFirst!: () => void;
  let failLast!: (cause: Error) => void;
  native.enableTorchWithStrength
    .mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)))
    .mockImplementationOnce(() => new Promise<void>((_, reject) => (failLast = reject)));
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, device),
  );
  act(() => {
    scheduleOnUI(result.current.requestTorchOnUI, 0.25);
    scheduleOnUI(result.current.requestTorchOnUI, 0.75);
  });
  await settleTorch();
  expect(result.current.desiredTorchStrength.get()).toBe(0.75);
  await act(async () => finishFirst());
  await settleTorch();
  expect(result.current.desiredTorchStrength.get()).toBe(0.75);
  expect(result.current.error).toBeNull();
  await act(async () => failLast(new Error('Too hot')));
  await settleTorch();
  expect(result.current.desiredTorchStrength.get()).toBe(0.25);
  expect(result.current.confirmedTorchStrength).toBe(0.25);
  expect(result.current.error).toBe('Too hot');
});

test('an older failure cannot roll back a newer UI choice while hardware is pending', async () => {
  const native = camera();
  const device = { ...torchDevice, supportsTorchStrength: true };
  let failFirst!: (cause: Error) => void;
  let finishLast!: () => void;
  native.enableTorchWithStrength
    .mockImplementationOnce(() => new Promise<void>((_, reject) => (failFirst = reject)))
    .mockImplementationOnce(() => new Promise<void>((resolve) => (finishLast = resolve)));
  const { result } = renderHook(() =>
    useCameraControls(native as unknown as CameraController, true, device),
  );
  act(() => {
    scheduleOnUI(result.current.requestTorchOnUI, 0.25);
    scheduleOnUI(result.current.requestTorchOnUI, 0.75);
  });
  await settleTorch();
  await act(async () => failFirst(new Error('Temporary failure')));
  await settleTorch();
  expect(result.current.desiredTorchStrength.get()).toBe(0.75);
  expect(result.current.error).toBeNull();
  await act(async () => finishLast());
  await settleTorch();
  expect(result.current.confirmedTorchStrength).toBe(0.75);
});

test('UI toggles update immediately without React renders or RN delivery', async () => {
  const queued: (() => void)[] = [];
  const schedule = jest.spyOn(Worklets, 'scheduleOnRN').mockImplementation((fn, ...args) => {
    queued.push(() => fn(...args));
  });
  const native = camera();
  let renders = 0;
  const { result } = renderHook(() => {
    renders++;
    return useCameraControls(native as unknown as CameraController, true, torchDevice);
  });
  await settleTorch();
  const initialRenders = renders;
  try {
    const { toggleTorchOnUI, desiredTorchStrength } = result.current;
    await act(async () => {
      const values = await Worklets.runOnUIAsync(() => {
        toggleTorchOnUI();
        const on = desiredTorchStrength.get();
        toggleTorchOnUI();
        const off = desiredTorchStrength.get();
        toggleTorchOnUI();
        return [on, off, desiredTorchStrength.get()];
      });
      expect(values).toEqual([1, 0, 1]);
    });
    expect(renders).toBe(initialRenders);
    expect(native.setTorchMode).not.toHaveBeenCalled();
    expect(queued).toHaveLength(3);
  } finally {
    schedule.mockRestore();
  }
});

test('RN requests delivered after pause and resume cannot change the resumed session', async () => {
  const queued: (() => void)[] = [];
  const schedule = jest.spyOn(Worklets, 'scheduleOnRN').mockImplementation((fn, ...args) => {
    queued.push(() => fn(...args));
  });
  const native = camera();
  const { result, rerender } = renderHook(
    ({ active }: { active: boolean }) =>
      useCameraControls(native as unknown as CameraController, active, torchDevice),
    { initialProps: { active: true } },
  );
  await settleTorch();
  try {
    act(() => scheduleOnUI(result.current.toggleTorchOnUI));
    await flushUI();
    expect(queued).toHaveLength(1);
    expect(result.current.desiredTorchStrength.get()).toBe(1);
    rerender({ active: false });
    rerender({ active: true });
    await settleTorch();
    await act(async () => queued[0]());
    await settleTorch();
    expect(native.setTorchMode.mock.calls).toEqual([['off']]);
    expect(result.current.desiredTorchStrength.get()).toBe(0);
    expect(result.current.confirmedTorchEnabled).toBe(false);
    schedule.mockImplementation(jest.requireActual('react-native-worklets').scheduleOnRN);
    act(() => scheduleOnUI(result.current.toggleTorchOnUI));
    await settleTorch();
    expect(native.setTorchMode.mock.calls).toEqual([['off'], ['on']]);
    expect(result.current.desiredTorchStrength.get()).toBe(1);
    expect(result.current.confirmedTorchEnabled).toBe(true);
  } finally {
    schedule.mockRestore();
  }
});
