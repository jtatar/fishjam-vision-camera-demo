import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MicrophoneButton } from '../src/room/MicrophoneButton';

const mockInitialize = jest.fn();
const mockStop = jest.fn().mockResolvedValue(undefined);
jest.mock('@fishjam-cloud/react-native-client', () => ({
  useInitializeDevices: () => ({ initializeDevices: mockInitialize }),
  useMicrophone: () => ({ isMicrophoneOn: false, stopMicrophone: mockStop }),
}));
jest.mock('react-native-vision-camera', () => ({
  useMicrophonePermission: () => ({ hasPermission: true }),
}));
jest.mock('../src/useForeground', () => ({ useForeground: () => true }));

test('microphone initialization never opens the Fishjam camera', async () => {
  mockInitialize.mockResolvedValue(undefined);
  render(<MicrophoneButton connected />);
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Enable microphone' })));
  expect(mockInitialize).toHaveBeenCalledWith({ enableVideo: false, enableAudio: true });
});

test('stops a late microphone initialization after leaving the room', async () => {
  let complete!: () => void;
  mockInitialize.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const view = render(<MicrophoneButton connected />);
  fireEvent.press(screen.getByRole('button', { name: 'Enable microphone' }));
  view.rerender(<MicrophoneButton connected={false} />);
  mockStop.mockClear();
  await act(async () => complete());
  expect(mockStop).toHaveBeenCalled();
});
