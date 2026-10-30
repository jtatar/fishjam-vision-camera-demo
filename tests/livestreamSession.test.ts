import { act, renderHook } from '@testing-library/react-native';
import type { MediaStream } from '@fishjam-cloud/react-native-client';
import { useLivestreamSession } from '../src/room/useLivestreamSession';

const mockPublish = jest.fn();
const mockWatch = jest.fn();
const mockDisconnect = jest.fn();
const mockViewerDisconnect = jest.fn();
const mockToken = jest.fn();
const mockPrepare = jest.fn();
const mockStop = jest.fn();
let mockConnected = false;
let mockError: string | null = null;
const video = { id: 'camera' } as MediaStream;
const audio = { id: 'microphone' } as MediaStream;
const mockReceived = { id: 'received' } as MediaStream;
jest.mock('@fishjam-cloud/react-native-client', () => ({
  useLivestreamStreamer: () => ({
    connect: mockPublish,
    disconnect: mockDisconnect,
    isConnected: mockConnected,
    error: mockError,
  }),
  useLivestreamViewer: () => ({
    connect: mockWatch,
    disconnect: mockViewerDisconnect,
    isConnected: mockConnected,
    error: mockError,
    stream: mockReceived,
  }),
}));
jest.mock('../src/config', () => ({
  requestLivestreamToken: (...args: unknown[]) => mockToken(...args),
}));
jest.mock('../src/room/useLivestreamMicrophone', () => ({
  useLivestreamMicrophone: () => ({ prepare: mockPrepare, stop: mockStop }),
}));
const config = { fishjamId: 'id', sandboxUrl: 'https://example.com', roomName: 'room' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  mockConnected = false;
  mockError = null;
  mockPublish.mockReset().mockResolvedValue(undefined);
  mockWatch.mockReset().mockResolvedValue(undefined);
  mockPrepare.mockReset().mockResolvedValue(audio);
  mockToken.mockReset().mockResolvedValue('token');
});

test('publishes the actual camera and microphone streams with a streamer token', async () => {
  const { result, rerender } = renderHook(() => useLivestreamSession(config, 'camera', video));
  await act(async () => result.current.join());
  expect(mockToken).toHaveBeenCalledWith(config, 'streamer', expect.any(AbortSignal));
  expect(mockPublish).toHaveBeenCalledWith({ token: 'token', inputs: { video, audio } });
  expect(mockWatch).not.toHaveBeenCalled();
  expect(result.current.busy).toBe(true);
  expect(result.current.connected).toBe(false);
  mockConnected = true;
  rerender({});
  expect(result.current.connected).toBe(true);
  expect(result.current.busy).toBe(false);
  act(() => result.current.leave());
  expect(result.current.connected).toBe(false);
  expect(mockStop).toHaveBeenCalled();
});

test('viewer connects with a viewer token without capturing any media', async () => {
  const { result, rerender } = renderHook(() => useLivestreamSession(config, 'viewer', null));
  await act(async () => result.current.join());
  expect(mockToken).toHaveBeenCalledWith(config, 'viewer', expect.any(AbortSignal));
  expect(mockWatch).toHaveBeenCalledWith({ token: 'token' });
  expect(mockPublish).not.toHaveBeenCalled();
  expect(mockPrepare).not.toHaveBeenCalled();
  mockConnected = true;
  rerender({});
  expect(result.current.stream).toBe(mockReceived);
  act(() => result.current.leave());
  expect(result.current.stream).toBeNull();
  expect(mockViewerDisconnect).toHaveBeenCalled();
});

test('requires camera input before requesting a streamer token', async () => {
  const { result } = renderHook(() => useLivestreamSession(config, 'camera', null));
  await act(async () => result.current.join());
  expect(mockToken).not.toHaveBeenCalled();
  expect(result.current.error).toContain('camera preview');
});

test('a failed token request releases media and allows retry', async () => {
  mockToken.mockRejectedValueOnce(new Error('Offline'));
  const { result } = renderHook(() => useLivestreamSession(config, 'camera', video));
  await act(async () => result.current.join());
  expect(result.current.error).toBe('Offline');
  expect(mockPublish).not.toHaveBeenCalled();
  await act(async () => result.current.join());
  expect(mockPublish).toHaveBeenCalledTimes(1);
});

test('unmount aborts token retrieval and prevents a late publisher', async () => {
  const token = deferred<string>();
  mockToken.mockReturnValueOnce(token.promise);
  const { result, unmount } = renderHook(() => useLivestreamSession(config, 'camera', video));
  let joining!: Promise<void>;
  await act(async () => {
    joining = result.current.join();
  });
  const signal = mockToken.mock.calls[0][2] as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    token.resolve('late');
    await joining;
  });
  expect(mockPublish).not.toHaveBeenCalled();
});

test('duplicate taps issue one request; cancel prevents late connections', async () => {
  const token = deferred<string>();
  mockToken.mockReturnValueOnce(token.promise);
  const { result } = renderHook(() => useLivestreamSession(config, 'camera', video));
  let joining!: Promise<void>;
  await act(async () => {
    joining = result.current.join();
    void result.current.join();
  });
  expect(mockToken).toHaveBeenCalledTimes(1);
  act(() => result.current.leave());
  await act(async () => {
    token.resolve('late');
    await joining;
  });
  expect(mockPublish).not.toHaveBeenCalled();
  expect(result.current.busy).toBe(false);
});

test('disconnects a late WHIP completion before allowing the next attempt', async () => {
  const handshake = deferred<void>();
  mockPublish.mockReturnValueOnce(handshake.promise);
  const { result } = renderHook(() => useLivestreamSession(config, 'camera', video));
  let first!: Promise<void>;
  let retry!: Promise<void>;
  await act(async () => {
    first = result.current.join();
  });
  act(() => result.current.leave());
  await act(async () => {
    retry = result.current.join();
  });
  expect(mockPublish).toHaveBeenCalledTimes(1);
  mockDisconnect.mockClear();
  await act(async () => {
    handshake.resolve();
    await first;
    await retry;
  });
  expect(mockDisconnect).toHaveBeenCalledTimes(1);
  expect(mockPublish).toHaveBeenCalledTimes(2);
  expect(mockDisconnect.mock.invocationCallOrder[0]).toBeLessThan(
    mockPublish.mock.invocationCallOrder[1],
  );
});

test.each(['unauthorized', 'stream_not_found', 'streamer_already_connected'])(
  'handles SDK-reported %s even when connect resolves',
  async (error) => {
    mockPublish.mockImplementationOnce(async () => {
      mockError = error;
    });
    const { result } = renderHook(() => useLivestreamSession(config, 'camera', video));
    await act(async () => result.current.join());
    expect(result.current.error).toBeTruthy();
    expect(result.current.busy).toBe(false);
    expect(result.current.connected).toBe(false);
  },
);

test('connection loss releases the microphone and offers a fresh start', async () => {
  mockConnected = true;
  const { result, rerender } = renderHook(() => useLivestreamSession(config, 'camera', video));
  await act(async () => result.current.join());
  mockConnected = false;
  rerender({});
  expect(result.current.error).toContain('Connection lost');
  expect(mockStop).toHaveBeenCalled();
});

test('times out stalled ICE after SDP completes, and allows retry', async () => {
  jest.useFakeTimers();
  try {
    const { result } = renderHook(() => useLivestreamSession(config, 'camera', video));
    await act(async () => result.current.join());
    await act(async () => jest.advanceTimersByTime(20000));
    expect(result.current.error).toContain('timed out');
    expect(result.current.busy).toBe(false);
    expect(mockDisconnect).toHaveBeenCalled();
    await act(async () => result.current.join());
    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

test('unmount disconnects a late WHEP handshake without starting media capture', async () => {
  const handshake = deferred<void>();
  mockWatch.mockReturnValueOnce(handshake.promise);
  const { result, unmount } = renderHook(() => useLivestreamSession(config, 'viewer', null));
  let watching!: Promise<void>;
  await act(async () => {
    watching = result.current.join();
  });
  unmount();
  mockViewerDisconnect.mockClear();
  await act(async () => {
    handshake.resolve();
    await watching;
  });
  expect(mockViewerDisconnect).toHaveBeenCalledTimes(1);
  expect(mockPrepare).not.toHaveBeenCalled();
});
