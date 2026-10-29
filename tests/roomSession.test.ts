import { act, renderHook } from '@testing-library/react-native';
import { useRoomSession } from '../src/room/useRoomSession';

const mockJoin = jest.fn();
const mockLeave = jest.fn();
const mockToken = jest.fn();
jest.mock('@fishjam-cloud/react-native-client', () => ({
  useConnection: () => ({
    joinRoom: mockJoin,
    leaveRoom: mockLeave,
    peerStatus: 'idle',
    reconnectionStatus: 'idle',
  }),
}));
jest.mock('../src/config', () => ({
  requestPeerToken: (...args: unknown[]) => mockToken(...args),
}));
const config = {
  fishjamId: 'id',
  sandboxUrl: 'https://example.com',
  roomName: 'room',
  peerName: 'phone',
};
beforeEach(() => {
  mockJoin.mockResolvedValue(undefined);
  mockToken.mockResolvedValue('token');
});

test('joins with a scoped token and participant metadata', async () => {
  const { result } = renderHook(() => useRoomSession(config));
  await act(async () => result.current.join());
  expect(mockJoin).toHaveBeenCalledWith({ peerToken: 'token', peerMetadata: { name: 'phone' } });
  expect(result.current.busy).toBe(false);
});

test('a failed token request leaves no connection and allows retry', async () => {
  mockToken.mockRejectedValueOnce(new Error('Offline'));
  const { result } = renderHook(() => useRoomSession(config));
  await act(async () => result.current.join());
  expect(result.current.error).toBe('Offline');
  expect(mockJoin).not.toHaveBeenCalled();
  await act(async () => result.current.join());
  expect(mockJoin).toHaveBeenCalledTimes(1);
});

test('unmount aborts token retrieval and prevents a late join', async () => {
  let complete!: (token: string) => void;
  mockToken.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
  );
  const { result, unmount } = renderHook(() => useRoomSession(config));
  let joining!: Promise<void>;
  act(() => {
    joining = result.current.join();
  });
  const signal = mockToken.mock.calls[0][1] as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    complete('late-token');
    await joining;
  });
  expect(mockJoin).not.toHaveBeenCalled();
  expect(mockLeave).toHaveBeenCalled();
});

test('duplicate taps issue only one request and cancel prevents late joins', async () => {
  let complete!: (token: string) => void;
  mockToken.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
  );
  const { result } = renderHook(() => useRoomSession(config));
  let first!: Promise<void>;
  act(() => {
    first = result.current.join();
    void result.current.join();
  });
  expect(mockToken).toHaveBeenCalledTimes(1);
  act(() => result.current.leave());
  await act(async () => {
    complete('late');
    await first;
  });
  expect(mockJoin).not.toHaveBeenCalled();
  expect(result.current.busy).toBe(false);
});

test('times out a stalled connection, disconnects, and allows retry', async () => {
  jest.useFakeTimers();
  try {
    mockJoin.mockImplementationOnce(() => new Promise<void>(() => {}));
    const { result } = renderHook(() => useRoomSession(config));
    let joining!: Promise<void>;
    await act(async () => {
      joining = result.current.join();
    });
    expect(mockJoin).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(20000);
      await joining;
    });
    expect(result.current.error).toContain('timed out');
    expect(result.current.busy).toBe(false);
    expect(mockLeave).toHaveBeenCalled();
    await act(async () => result.current.join());
    expect(mockJoin).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});
