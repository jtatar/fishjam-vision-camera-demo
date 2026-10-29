import { fireEvent, render, screen } from '@testing-library/react-native';
import { RemoteStreams } from '../src/room/RemoteStreams';

let mockPeers: unknown[] = [];
jest.mock('@fishjam-cloud/react-native-client', () => {
  const { Text } = require('react-native');
  return {
    usePeers: () => ({ remotePeers: mockPeers }),
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

function publisher() {
  return {
    id: 'peer',
    metadata: { peer: { name: 'Publisher' } },
    cameraTrack: null,
    customVideoTracks: [{ trackId: 'custom', stream: { id: 'controlled-camera-feed' } }],
  };
}

test('receives custom VisionCamera video as well as ordinary camera tracks', () => {
  mockPeers = [
    {
      id: 'peer',
      metadata: { peer: { name: 'Publisher' } },
      cameraTrack: { trackId: 'camera', stream: { id: 'ordinary-feed' } },
      customVideoTracks: [
        { trackId: 'custom', stream: { id: 'controlled-camera-feed' } },
        { trackId: 'pending', stream: null },
      ],
    },
  ];
  render(<RemoteStreams />);
  expect(screen.getByText('controlled-camera-feed')).toBeTruthy();
  expect(screen.getByText('ordinary-feed')).toBeTruthy();
  expect(screen.getAllByText('Publisher')).toHaveLength(2);
});

test('shows the waiting state when there are no published tracks', () => {
  mockPeers = [];
  render(<RemoteStreams />);
  expect(screen.getByText(/Your host’s video/)).toBeTruthy();
});

test('expands the existing custom stream and closes without duplicating its renderer', () => {
  mockPeers = [publisher()];
  render(<RemoteStreams />);
  fireEvent.press(screen.getByRole('button', { name: 'View Publisher fullscreen' }));
  expect(screen.getByTestId('fullscreen-stream')).toBeTruthy();
  expect(screen.getAllByText('controlled-camera-feed')).toHaveLength(1);

  fireEvent.press(screen.getByRole('button', { name: 'Exit fullscreen' }));
  expect(screen.queryByTestId('fullscreen-stream')).toBeNull();
  expect(screen.getByText('controlled-camera-feed')).toBeTruthy();
});

test('tapping the video opens fullscreen and Android Back returns to the room', () => {
  mockPeers = [publisher()];
  render(<RemoteStreams />);
  fireEvent.press(screen.getByRole('button', { name: 'Open Publisher video fullscreen' }));
  fireEvent(screen.getByTestId('fullscreen-stream'), 'requestClose');
  expect(screen.queryByTestId('fullscreen-stream')).toBeNull();
  expect(screen.getByText('controlled-camera-feed')).toBeTruthy();
});

test('a removed track dismisses fullscreen and does not reopen when the publisher returns', () => {
  mockPeers = [publisher()];
  const { rerender } = render(<RemoteStreams />);
  fireEvent.press(screen.getByRole('button', { name: 'View Publisher fullscreen' }));

  mockPeers = [];
  rerender(<RemoteStreams />);
  expect(screen.queryByTestId('fullscreen-stream')).toBeNull();
  expect(screen.getByText(/Your host’s video/)).toBeTruthy();

  mockPeers = [publisher()];
  rerender(<RemoteStreams />);
  expect(screen.queryByTestId('fullscreen-stream')).toBeNull();
  expect(screen.getByText('controlled-camera-feed')).toBeTruthy();
});
