import { requestPeerToken, validateConfig, type RoomConfig } from '../src/config';

const config: RoomConfig = {
  fishjamId: 'test-id',
  sandboxUrl: 'https://example.com/sandbox/key',
  roomName: 'room & one',
  peerName: 'Alice phone',
};
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

test.each([
  { fishjamId: '' },
  { sandboxUrl: '' },
  { sandboxUrl: 'http://example.com' },
  { sandboxUrl: 'https://user:secret@example.com' },
  { roomName: ' ' },
  { peerName: '' },
])('rejects invalid connection settings: %s', (change) => {
  expect(() => validateConfig({ ...config, ...change })).toThrow();
});

test('encodes room names and returns only the peer token', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ peerToken: 'peer-scoped-token' }) });
  global.fetch = fetchMock;
  const signal = new AbortController().signal;
  await expect(requestPeerToken(config, signal)).resolves.toBe('peer-scoped-token');
  const [url, options] = fetchMock.mock.calls[0];
  expect(new URL(url).searchParams.get('roomName')).toBe('room & one');
  expect(new URL(url).searchParams.get('roomType')).toBe('conference');
  expect(options.signal).toBe(signal);
});

test.each([{}, { peerToken: '' }, { peerToken: 42 }, null])(
  'rejects malformed token responses: %s',
  async (body) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body });
    await expect(requestPeerToken(config, new AbortController().signal)).rejects.toThrow(
      'peer token',
    );
  },
);

test('reports conflicting room types without echoing credentials', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 409 });
  await expect(requestPeerToken(config, new AbortController().signal)).rejects.toThrow(
    'different room type',
  );
});
