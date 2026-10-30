import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { MicrophoneButton } from '../src/room/MicrophoneButton';
import { useLivestreamMicrophone } from '../src/room/useLivestreamMicrophone';

const mockCapture = jest.fn();
let mockForeground = true;
jest.mock('@fishjam-cloud/react-native-webrtc', () => ({
  mediaDevices: { getUserMedia: (...args: unknown[]) => mockCapture(...args) },
}));
jest.mock('../src/useForeground', () => ({ useForeground: () => mockForeground }));
function audio() {
  const track = { enabled: true };
  return { track, stream: { getAudioTracks: () => [track], release: jest.fn() } };
}
beforeEach(() => {
  mockForeground = true;
  mockCapture.mockReset();
});

test('negotiates a muted audio track, then toggles it without replacing or stopping it', async () => {
  const { track, stream } = audio();
  mockCapture.mockResolvedValue(stream);
  const { result } = renderHook(() => useLivestreamMicrophone());
  await act(async () => {
    await result.current.prepare(new AbortController().signal);
  });
  expect(mockCapture).toHaveBeenCalledWith({ video: false, audio: true });
  expect(track.enabled).toBe(false);
  expect(result.current.muted).toBe(true);
  act(() => result.current.toggle());
  expect(track.enabled).toBe(true);
  act(() => result.current.toggle());
  expect(track.enabled).toBe(false);
  expect(stream.release).not.toHaveBeenCalled();
  act(() => result.current.stop());
  expect(stream.release).toHaveBeenCalledTimes(1);
});

test('releases a late microphone capture after cancellation', async () => {
  let complete!: (stream: unknown) => void;
  mockCapture.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { stream } = audio();
  const controller = new AbortController();
  const { result } = renderHook(() => useLivestreamMicrophone());
  let preparing!: Promise<unknown>;
  act(() => {
    preparing = result.current.prepare(controller.signal);
  });
  controller.abort();
  await act(async () => {
    complete(stream);
    await preparing;
  });
  expect(stream.release).toHaveBeenCalledTimes(1);
  expect(result.current.available).toBe(false);
});

test('permission denial allows video-only streaming and explains how to enable audio', async () => {
  mockCapture.mockRejectedValue(new Error('Permission denied'));
  const { result } = renderHook(() => useLivestreamMicrophone());
  await act(async () => {
    expect(await result.current.prepare(new AbortController().signal)).toBeNull();
  });
  expect(result.current.warning).toContain('Streaming without audio');
  expect(result.current.available).toBe(false);
});

test('backgrounding mutes the negotiated track; resume stays muted', async () => {
  const { stream, track } = audio();
  mockCapture.mockResolvedValue(stream);
  const { result, rerender, unmount } = renderHook(() => useLivestreamMicrophone());
  await act(async () => {
    await result.current.prepare(new AbortController().signal);
  });
  act(() => result.current.toggle());
  mockForeground = false;
  rerender({});
  expect(track.enabled).toBe(false);
  mockForeground = true;
  rerender({});
  expect(track.enabled).toBe(false);
  unmount();
  expect(stream.release).toHaveBeenCalledTimes(1);
});

test('the microphone button controls the negotiated track only while connected', async () => {
  const { stream, track } = audio();
  mockCapture.mockResolvedValue(stream);
  const { result } = renderHook(() => useLivestreamMicrophone());
  await act(async () => {
    await result.current.prepare(new AbortController().signal);
  });
  const view = render(<MicrophoneButton connected microphone={result.current} />);
  fireEvent.press(screen.getByRole('button', { name: 'Enable microphone' }));
  expect(track.enabled).toBe(true);
  view.rerender(<MicrophoneButton connected={false} microphone={result.current} />);
  expect(screen.getByRole('button', { name: 'Mute microphone' })).toBeDisabled();
});
