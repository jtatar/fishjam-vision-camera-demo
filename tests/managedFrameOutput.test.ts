import { createElement, StrictMode, type PropsWithChildren } from 'react';
import { renderHook } from '@testing-library/react-native';
import type { Frame } from 'react-native-vision-camera';
import { useManagedFrameOutput } from '../src/camera/core/useManagedFrameOutput';

type Callback = ((frame: Frame) => void) | undefined;
type MockOutput = ReturnType<typeof makeOutput>;
const mockNativeTasks: (() => void)[] = [];
const mockRNTasks: (() => void)[] = [];
const mockEvents: string[] = [];
const mockOutputs: MockOutput[] = [];

function makeOutput() {
  const output = {
    callback: undefined as Callback,
    thread: {
      runOnThread: jest.fn((task: () => void) => {
        mockNativeTasks.push(() => {
          mockEvents.push('barrier');
          // Nitro dispatches this ordinary JS callback back to the RN runtime.
          mockRNTasks.push(task);
        });
      }),
    },
  };
  return output;
}

const mockCreateOutput = jest.fn((_options?: unknown) => {
  const output = makeOutput();
  mockOutputs.push(output);
  return output;
});
const mockCreateRuntime = jest.fn((_thread?: unknown) => ({
  setOnFrameCallback: jest.fn((output: MockOutput, callback: Callback) => {
    mockNativeTasks.push(() => {
      output.callback = callback;
      mockEvents.push(callback ? 'install' : 'clear');
    });
  }),
}));

jest.mock('react-native-vision-camera', () => ({
  VisionCamera: { createFrameOutput: (options: unknown) => mockCreateOutput(options) },
}));
jest.mock('react-native-vision-camera-worklets', () => ({
  provider: { createRuntimeForThread: (thread: unknown) => mockCreateRuntime(thread) },
}));

function drain() {
  while (mockNativeTasks.length || mockRNTasks.length) {
    while (mockNativeTasks.length) mockNativeTasks.shift()!();
    while (mockRNTasks.length) mockRNTasks.shift()!();
  }
}

afterEach(() => {
  drain();
  mockEvents.length = 0;
  mockOutputs.length = 0;
});

test('replaces the frame callback without recreating or retiring the output', () => {
  const first = jest.fn();
  const second = jest.fn();
  const { result, rerender, unmount } = renderHook(
    ({ onFrame }: { onFrame: (frame: Frame) => void }) =>
      useManagedFrameOutput({ targetResolution: { width: 1280, height: 720 }, onFrame }),
    { initialProps: { onFrame: first } },
  );
  const output = result.current;
  drain();
  rerender({ onFrame: second });
  drain();

  expect(result.current).toBe(output);
  expect(mockCreateOutput).toHaveBeenCalledTimes(1);
  expect(mockCreateRuntime).toHaveBeenCalledTimes(1);
  expect(mockOutputs[0].callback).toBe(second);
  expect(mockEvents).toEqual(['install', 'install']);

  unmount();
  drain();
  expect(mockOutputs[0].callback).toBeUndefined();
  expect(mockEvents).toEqual(['install', 'install', 'clear', 'barrier', 'barrier']);
});

test('drains an analyzer queued by acquisition before releasing the retiring runtime', () => {
  const onFrame = jest.fn(() => mockEvents.push('frame'));
  const { unmount } = renderHook(() => useManagedFrameOutput({ onFrame }));
  drain();
  const output = mockOutputs[0];
  const frame = {} as Frame;

  // CameraX acquisition snapshots the analyzer and queues its delivery on the
  // same executor. It can append that delivery behind the first barrier.
  mockNativeTasks.push(() => {
    const callback = output.callback;
    if (callback) mockNativeTasks.push(() => callback(frame));
  });
  unmount();
  mockNativeTasks.shift()!(); // Acquisition queues its analyzer at the end.
  mockNativeTasks.shift()!(); // Clear the subscribed native callback.
  mockNativeTasks.shift()!(); // First barrier schedules the RN callback.
  mockRNTasks.shift()!(); // RN schedules the second native barrier.
  expect(output.thread.runOnThread).toHaveBeenCalledTimes(2);
  expect(onFrame).not.toHaveBeenCalled();

  drain();
  expect(mockEvents).toEqual(['install', 'clear', 'barrier', 'frame', 'barrier']);
  expect(onFrame).toHaveBeenCalledWith(frame);
  expect(output.callback).toBeUndefined();
});

test('retires an old output when resolution changes and keeps the new callback installed', () => {
  const onFrame = jest.fn();
  const { rerender, unmount } = renderHook(
    ({ width }: { width: number }) =>
      useManagedFrameOutput({ targetResolution: { width, height: 720 }, onFrame }),
    { initialProps: { width: 1280 } },
  );
  drain();
  rerender({ width: 1920 });
  drain();

  expect(mockOutputs[0].callback).toBeUndefined();
  expect(mockOutputs[1].callback).toBe(onFrame);
  expect(mockOutputs[0].thread.runOnThread).toHaveBeenCalledTimes(2);
  expect(mockOutputs[1].thread.runOnThread).not.toHaveBeenCalled();
  unmount();
});

test('Strict Mode installs the callback only on the committed output', () => {
  const onFrame = jest.fn();
  const { result, unmount } = renderHook(() => useManagedFrameOutput({ onFrame }), {
    wrapper: ({ children }: PropsWithChildren) => createElement(StrictMode, null, children),
  });
  drain();
  const output = result.current as unknown as MockOutput;
  expect(output.callback).toBe(onFrame);
  expect(mockOutputs.filter((item) => item.callback)).toEqual([output]);

  unmount();
  drain();
  expect(output.callback).toBeUndefined();
});
