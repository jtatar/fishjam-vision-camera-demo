import { createCameraCommandQueue } from '../src/camera/core/cameraCommandQueue';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test('coalesces torch strength updates while the native camera is busy', async () => {
  let finish!: () => void;
  const apply = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const queue = createCameraCommandQueue({ apply, onError: jest.fn() });
  queue.submit(1);
  queue.submit(2);
  queue.submit(3);
  expect(apply.mock.calls).toEqual([[1]]);
  finish();
  await flush();
  expect(apply.mock.calls).toEqual([[1], [3]]);
});

test('a rejected native command does not poison subsequent commands', async () => {
  const error = new Error('Camera unavailable');
  const apply = jest.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
  const onError = jest.fn();
  const queue = createCameraCommandQueue({ apply, onError });
  queue.submit(2);
  await flush();
  queue.submit(3);
  await flush();
  expect(onError).toHaveBeenCalledWith(error, undefined);
  expect(apply.mock.calls).toEqual([[2], [3]]);
});

test('turns the torch off after an in-flight on command when closed', async () => {
  let finish!: () => void;
  const apply = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const queue = createCameraCommandQueue({ apply, onError: jest.fn() });
  queue.submit(1);
  queue.close({ value: 0 });
  queue.submit(1);
  finish();
  await flush();
  expect(apply.mock.calls).toEqual([[1], [0]]);
});

test('closing discards queued commands and suppresses callbacks after unmount', async () => {
  let fail!: (error: Error) => void;
  const apply = jest.fn(
    () =>
      new Promise<void>((_, reject) => {
        fail = reject;
      }),
  );
  const onError = jest.fn();
  const queue = createCameraCommandQueue({ apply, onError });
  queue.submit(2);
  queue.submit(3);
  queue.close();
  fail(new Error('Session stopped'));
  await flush();
  expect(apply).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
});

test('applies a pending zero after an in-flight nonzero command', async () => {
  let finish!: () => void;
  const apply = jest
    .fn()
    .mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))
    .mockResolvedValue(undefined);
  const queue = createCameraCommandQueue({ apply, onError: jest.fn() });
  queue.submit(1);
  queue.submit(0);
  expect(apply.mock.calls).toEqual([[1]]);
  finish();
  await flush();
  expect(apply.mock.calls).toEqual([[1], [0]]);
});

test('failed commands remain retryable and do not change the last applied value', async () => {
  const apply = jest.fn().mockResolvedValue(undefined);
  const onApplied = jest.fn();
  const queue = createCameraCommandQueue({ apply, onApplied, onError: jest.fn() });
  queue.submit(0.25);
  await flush();
  apply.mockRejectedValueOnce(new Error('Camera busy'));
  queue.submit(0.75);
  await flush();
  expect(onApplied.mock.calls).toEqual([[0.25, undefined]]);
  queue.submit(0.25);
  await flush();
  expect(apply.mock.calls).toEqual([[0.25], [0.75]]);
  queue.submit(0.75);
  await flush();
  expect(onApplied).toHaveBeenLastCalledWith(0.75, undefined);
  expect(apply.mock.calls).toEqual([[0.25], [0.75], [0.75]]);
});

test('closing suppresses late success callbacks and runs cleanup only once', async () => {
  let finish!: () => void;
  const apply = jest
    .fn()
    .mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))
    .mockResolvedValue(undefined);
  const onApplied = jest.fn();
  const queue = createCameraCommandQueue({ apply, onApplied, onError: jest.fn() });
  queue.submit(1);
  queue.close({ value: 0 });
  queue.close({ value: 0 });
  finish();
  await flush();
  expect(apply.mock.calls).toEqual([[1], [0]]);
  expect(onApplied).not.toHaveBeenCalled();
});

test('close completion includes the final cleanup and serializes the next session', async () => {
  let finishEnable!: () => void;
  let finishOff!: () => void;
  const apply = jest
    .fn()
    .mockImplementationOnce(() => new Promise<void>((resolve) => (finishEnable = resolve)))
    .mockImplementationOnce(() => new Promise<void>((resolve) => (finishOff = resolve)))
    .mockResolvedValue(undefined);
  const first = createCameraCommandQueue({ apply, onError: jest.fn() });
  first.submit(1);
  const completion = first.close({ value: 0 });
  const second = createCameraCommandQueue({ apply, after: completion, onError: jest.fn() });
  second.submit(0.5);
  expect(apply.mock.calls).toEqual([[1]]);
  finishEnable();
  await flush();
  expect(apply.mock.calls).toEqual([[1], [0]]);
  finishOff();
  await completion;
  await flush();
  expect(apply.mock.calls).toEqual([[1], [0], [0.5]]);
});

test('coalescing preserves the latest request identity even when its value is already applied', async () => {
  let finish!: () => void;
  const apply = jest
    .fn()
    .mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
  const onApplied = jest.fn();
  const queue = createCameraCommandQueue({ apply, onApplied, onError: jest.fn() });
  queue.submit(1, 10);
  queue.submit(0, 11);
  queue.submit(1, 12);
  finish();
  await flush();
  expect(apply.mock.calls).toEqual([[1]]);
  expect(onApplied.mock.calls).toEqual([
    [1, 10],
    [1, 12],
  ]);
});
