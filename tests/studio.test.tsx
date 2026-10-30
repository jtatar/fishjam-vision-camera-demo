import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { RoomScreen } from '../src/room/RoomScreen';

const mockJoin = jest.fn();
const mockLeave = jest.fn();
let mockReady = true;
let mockSession = {
  connected: false,
  busy: false,
  error: null as string | null,
};
jest.mock('../src/room/useLivestreamSession', () => ({
  useLivestreamSession: () => ({
    ...mockSession,
    join: mockJoin,
    leave: mockLeave,
    microphone: { warning: null },
  }),
}));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../src/camera/CameraPublisher', () => ({
  CameraPublisher: ({ header, footer, onReadyChange }: any) => {
    const React = require('react');
    React.useEffect(() => onReadyChange(mockReady), [onReadyChange]);
    return (
      <>
        {header}
        {footer}
      </>
    );
  },
}));
jest.mock('../src/room/MicrophoneButton', () => ({ MicrophoneButton: () => null }));
jest.mock('../src/room/RemoteStreams', () => ({ RemoteStreams: () => null }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
jest.mock('../src/studio/StreamSettings', () => ({
  StreamSettings: () => {
    const { Text } = require('react-native');
    return <Text>Connection editor</Text>;
  },
}));
const config = {
  fishjamId: 'test-id',
  sandboxUrl: 'https://example.com/token',
  roomName: 'showcase',
};
const onBack = jest.fn();
function open(connection = config) {
  return render(
    <RoomScreen config={connection} title="Product launch" mode="camera" onBack={onBack} />,
  );
}

beforeEach(() => {
  mockSession = {
    connected: false,
    busy: false,
    error: null,
  };
  mockReady = true;
});

test('unconfigured preview opens setup without attempting to broadcast', () => {
  open({ ...config, fishjamId: '' });
  expect(screen.getByTestId('stream-status')).toHaveTextContent('PREVIEW');
  fireEvent.press(screen.getByRole('button', { name: 'Set up stream' }));
  expect(screen.getByText('Connection editor')).toBeOnTheScreen();
  expect(mockJoin).not.toHaveBeenCalled();
});

test('publishing waits for a ready camera', () => {
  mockReady = false;
  open();
  expect(screen.getByRole('button', { name: 'Go live' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Go live' }));
  expect(mockJoin).not.toHaveBeenCalled();
});

test('ready preview can start a livestream', () => {
  open();
  fireEvent.press(screen.getByRole('button', { name: 'Go live' }));
  expect(mockJoin).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('stream-status')).toHaveTextContent('PREVIEW');
});

test('connecting is cancellable and is not displayed as live', () => {
  mockSession.busy = true;
  open();
  expect(screen.getByTestId('stream-status')).toHaveTextContent('CONNECTING');
  fireEvent.press(screen.getByRole('button', { name: 'Cancel connecting' }));
  expect(mockLeave).toHaveBeenCalledTimes(1);
});

test('ending a live stream requires the destructive confirmation', () => {
  mockSession.connected = true;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  open();
  expect(screen.getByTestId('stream-status')).toHaveTextContent('LIVE');
  expect(screen.getByRole('button', { name: 'Stream details' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'End live' }));
  expect(mockLeave).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  expect(buttons[0].style).toBe('cancel');
  act(() => buttons[1].onPress!());
  expect(mockLeave).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});

test('closing a live publisher confirms ending the session', () => {
  mockSession.connected = true;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  open();
  expect(screen.getByTestId('stream-status')).toHaveTextContent('LIVE');
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).not.toHaveBeenCalled();
  act(() => alert.mock.calls[0][2]![1].onPress!());
  expect(mockLeave).toHaveBeenCalledTimes(1);
  expect(onBack).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});
