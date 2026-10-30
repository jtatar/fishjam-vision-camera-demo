import { requestLivestreamToken, validateConfig, type RoomConfig } from '../src/config';

const config: RoomConfig = {
  fishjamId: 'test-id',
  sandboxUrl: 'https://example.com/sandbox/key/',
  roomName: 'room & one/#?',
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
])('rejects invalid connection settings: %s', (change) => {
  expect(() => validateConfig({ ...config, ...change })).toThrow();
});

test('requests a private livestream and returns its streamer token', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ streamerToken: 'streamer-token', peerToken: 'wrong' }),
  });
  global.fetch = fetchMock;
  const signal = new AbortController().signal;
  await expect(requestLivestreamToken(config, 'streamer', signal)).resolves.toBe('streamer-token');
  const [url, options] = fetchMock.mock.calls[0];
  expect(new URL(url).pathname).toBe('/sandbox/key/livestream');
  expect(new URL(url).searchParams.get('roomName')).toBe(config.roomName);
  expect(new URL(url).searchParams.get('public')).toBe('false');
  expect(new URL(url).searchParams.has('peerName')).toBe(false);
  expect(new URL(url).searchParams.has('roomType')).toBe(false);
  expect(options.signal).toBe(signal);
});

test('viewers request only a viewer token and encode the room as one path segment', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ token: 'viewer-token' }) });
  global.fetch = fetchMock;
  const signal = new AbortController().signal;
  await expect(requestLivestreamToken(config, 'viewer', signal)).resolves.toBe('viewer-token');
  expect(fetchMock).toHaveBeenCalledWith(
    'https://example.com/sandbox/key/room%20%26%20one%2F%23%3F/livestream-viewer-token',
    { signal },
  );
});

test.each(['streamer', 'viewer'] as const)(
  '%s rejects conference and malformed token responses',
  async (role) => {
    for (const body of [
      {},
      { peerToken: 'conference-token' },
      { streamerToken: '', token: '' },
      { streamerToken: 42, token: 42 },
      null,
    ]) {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body });
      await expect(
        requestLivestreamToken(config, role, new AbortController().signal),
      ).rejects.toThrow(`${role} token`);
    }
  },
);

test('reports conflicting room types without echoing credentials', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 409 });
  await expect(
    requestLivestreamToken(config, 'streamer', new AbortController().signal),
  ).rejects.toThrow('different room type');
});
test('tells a viewer to start the host first when the stream is missing', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
  await expect(
    requestLivestreamToken(config, 'viewer', new AbortController().signal),
  ).rejects.toThrow('go live first');
});
