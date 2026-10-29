import { RTCPeerConnection, type MediaStream } from '@fishjam-cloud/react-native-webrtc';

function waitForIce(peer: RTCPeerConnection, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      peer.onicegatheringstatechange = null;
      signal.removeEventListener('abort', aborted);
      if (error) reject(error);
      else resolve();
    };
    const changed = () => {
      if (peer.iceGatheringState === 'complete') finish();
    };
    const aborted = () => finish(new Error('Local check stopped.'));
    const timeout = setTimeout(() => finish(new Error('Local ICE gathering timed out.')), 10000);
    peer.onicegatheringstatechange = changed;
    signal.addEventListener('abort', aborted);
    if (signal.aborted) aborted();
    else changed();
  });
}

export function createLoopback(
  stream: MediaStream,
  onStream: (stream: MediaStream) => void,
  onState: (state: string) => void,
) {
  const sender = new RTCPeerConnection({ iceServers: [] });
  const receiver = new RTCPeerConnection({ iceServers: [] });
  const abort = new AbortController();
  receiver.ontrack = (event: { streams: MediaStream[] }) => {
    if (!abort.signal.aborted && event.streams[0]) onStream(event.streams[0]);
  };
  receiver.onconnectionstatechange = () => {
    if (!abort.signal.aborted) onState(receiver.connectionState);
  };

  return {
    async connect() {
      for (const track of stream.getVideoTracks()) sender.addTrack(track, stream);
      await sender.setLocalDescription(await sender.createOffer());
      await waitForIce(sender, abort.signal);
      await receiver.setRemoteDescription(sender.localDescription!);
      if (abort.signal.aborted) return;
      await receiver.setLocalDescription(await receiver.createAnswer());
      await waitForIce(receiver, abort.signal);
      await sender.setRemoteDescription(receiver.localDescription!);
    },
    async stats() {
      const report = await receiver.getStats();
      for (const value of report.values()) {
        if (
          value.type === 'inbound-rtp' &&
          (value.kind === 'video' || value.mediaType === 'video')
        ) {
          return {
            frames: Number(value.framesDecoded ?? 0),
            width: Number(value.frameWidth ?? 0),
            height: Number(value.frameHeight ?? 0),
            fps: Number(value.framesPerSecond ?? 0),
          };
        }
      }
      return null;
    },
    close() {
      abort.abort();
      sender.close();
      receiver.close();
    },
  };
}
