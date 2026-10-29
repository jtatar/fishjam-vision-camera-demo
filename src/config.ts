export type RoomConfig = {
  fishjamId: string;
  sandboxUrl: string;
  roomName: string;
  peerName: string;
};

export const initialConfig: RoomConfig = {
  fishjamId: process.env.EXPO_PUBLIC_FISHJAM_ID ?? '',
  sandboxUrl: process.env.EXPO_PUBLIC_FISHJAM_SANDBOX_URL ?? '',
  roomName: process.env.EXPO_PUBLIC_ROOM_NAME ?? 'camera-controls',
  peerName: `phone-${Math.random().toString(36).slice(2, 8)}`,
};

export function validateConfig(config: RoomConfig) {
  if (!config.fishjamId.trim()) throw new Error('Enter your Fishjam ID in room settings.');
  if (!config.roomName.trim() || !config.peerName.trim())
    throw new Error('Room and participant names are required.');
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

export async function requestPeerToken(config: RoomConfig, signal: AbortSignal) {
  const url = validateConfig(config);
  url.searchParams.set('roomName', config.roomName.trim());
  url.searchParams.set('peerName', config.peerName.trim());
  url.searchParams.set('roomType', 'conference');
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(
      response.status === 409
        ? 'This room name already uses a different room type. Choose another name.'
        : `Could not get a peer token (HTTP ${response.status}). Check your Sandbox API URL.`,
    );
  }
  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== 'object' ||
    !('peerToken' in data) ||
    typeof data.peerToken !== 'string' ||
    !data.peerToken
  ) {
    throw new Error('The Sandbox API did not return a peer token.');
  }
  return data.peerToken;
}
