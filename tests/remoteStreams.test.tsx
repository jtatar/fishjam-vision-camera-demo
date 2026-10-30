import { fireEvent, render, screen } from '@testing-library/react-native';
import type { MediaStream } from '@fishjam-cloud/react-native-client';
import { RemoteStreams } from '../src/room/RemoteStreams';

const stream = { id: 'controlled-camera-feed' } as MediaStream;
jest.mock('@fishjam-cloud/react-native-client', () => {
  const { Text } = require('react-native');
  return {
    RTCView: ({ mediaStream }: { mediaStream: { id: string } }) => <Text>{mediaStream.id}</Text>,
  };
});
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../src/studio/controls', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Icon: () => null,
    IconButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

test('renders the WHEP stream without conference peers', () => {
  render(<RemoteStreams stream={stream} name="Publisher" />);
  expect(screen.getByText('controlled-camera-feed')).toBeTruthy();
  expect(screen.getByText('Publisher')).toBeTruthy();
});

test('shows the waiting state when there is no livestream', () => {
  render(<RemoteStreams stream={null} name="Publisher" />);
  expect(screen.getByText(/Your host’s video/)).toBeTruthy();
});

test('expands the existing custom stream and closes without duplicating its renderer', () => {
  render(<RemoteStreams stream={stream} name="Publisher" />);
  fireEvent.press(screen.getByRole('button', { name: 'View Publisher fullscreen' }));
  expect(screen.getByTestId('fullscreen-stream')).toBeTruthy();
  expect(screen.getAllByText('controlled-camera-feed')).toHaveLength(1);

  fireEvent.press(screen.getByRole('button', { name: 'Exit fullscreen' }));
  expect(screen.queryByTestId('fullscreen-stream')).toBeNull();
  expect(screen.getByText('controlled-camera-feed')).toBeTruthy();
});

test('tapping the video opens fullscreen and Android Back returns to the room', () => {
  render(<RemoteStreams stream={stream} name="Publisher" />);
  fireEvent.press(screen.getByRole('button', { name: 'Open Publisher video fullscreen' }));
  fireEvent(screen.getByTestId('fullscreen-stream'), 'requestClose');
  expect(screen.queryByTestId('fullscreen-stream')).toBeNull();
  expect(screen.getByText('controlled-camera-feed')).toBeTruthy();
});

test('a removed track dismisses fullscreen and does not reopen when the publisher returns', () => {
  const { rerender } = render(<RemoteStreams stream={stream} name="Publisher" />);
  fireEvent.press(screen.getByRole('button', { name: 'View Publisher fullscreen' }));

  rerender(<RemoteStreams stream={null} name="Publisher" />);
  expect(screen.queryByTestId('fullscreen-stream')).toBeNull();
  expect(screen.getByText(/Your host’s video/)).toBeTruthy();

  rerender(<RemoteStreams stream={stream} name="Publisher" />);
  expect(screen.queryByTestId('fullscreen-stream')).toBeNull();
  expect(screen.getByText('controlled-camera-feed')).toBeTruthy();
});
