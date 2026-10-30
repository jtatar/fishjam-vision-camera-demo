export type RoomConfig = {
  fishjamId: string;
  sandboxUrl: string;
  roomName: string;
};

export const initialConfig: RoomConfig = {
  fishjamId: process.env.EXPO_PUBLIC_FISHJAM_ID ?? '',
  sandboxUrl: process.env.EXPO_PUBLIC_FISHJAM_SANDBOX_URL ?? '',
  roomName: process.env.EXPO_PUBLIC_ROOM_NAME ?? 'camera-controls-live',
};

export function validateConfig(config: RoomConfig) {
  if (!config.fishjamId.trim()) throw new Error('Enter your Fishjam ID in room settings.');
  if (!config.roomName.trim()) throw new Error('A livestream name is required.');
  let url: URL;
  try {
    url = new URL(config.sandboxUrl.trim());
  } catch {
    throw new Error('Enter a valid Sandbox API URL in room settings.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Use the HTTPS Sandbox API URL from your Fishjam dashboard.');
  }
  return url;
}

// Same Sandbox endpoints as useSandbox, with cancellation and response validation.
export async function requestLivestreamToken(
  config: RoomConfig,
  role: 'streamer' | 'viewer',
  signal: AbortSignal,
) {
  const url = validateConfig(config);
  url.search = '';
  url.hash = '';
  const basePath = url.pathname.replace(/\/+$/, '');
  if (role === 'streamer') {
    url.pathname = `${basePath}/livestream`;
    url.searchParams.set('roomName', config.roomName.trim());
    url.searchParams.set('public', 'false');
  } else {
    url.pathname = `${basePath}/${encodeURIComponent(config.roomName.trim())}/livestream-viewer-token`;
  }
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(
      response.status === 409
        ? 'This room name already uses a different room type. Choose another name.'
        : response.status === 404 && role === 'viewer'
          ? 'This livestream does not exist yet. Ask your host to go live first.'
          : `Could not get a ${role} token (HTTP ${response.status}). Check your Sandbox API URL.`,
    );
  }
  const data: unknown = await response.json();
  const field = role === 'streamer' ? 'streamerToken' : 'token';
  const token =
    data && typeof data === 'object' && field in data
      ? (data as Record<string, unknown>)[field]
      : null;
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(`The Sandbox API did not return a ${role} token.`);
  }
  return token;
}
