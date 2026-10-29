import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const background = fileURLToPath(new URL('../docs/recording/scene.png', import.meta.url));
const frameRate = 30;
const slot = { width: 392, height: 848, top: 196, iphoneLeft: 480, androidLeft: 1048 };

const help = `Compose an iPhone and Android screen recording into the demo layout.

Usage:
  node scripts/compose-demo.mjs --iphone iphone.mov --android android.mp4 --output demo.mp4

Options:
  --iphone PATH          iPhone recording (required).
  --android PATH         Android recording (required).
  --output PATH          New .mp4 destination (required; never overwritten).
  --iphone-start SECONDS Trim the beginning of the iPhone recording (default: 0).
  --android-start SECONDS Trim the beginning of the Android recording (default: 0).
  --help                 Show this help.

Requires ffmpeg and ffprobe on PATH and docs/recording/scene.png.
Both recordings keep their full aspect ratio, centered in the labeled slots.
Output: 1920×1080, 30 fps, H.264, no audio, ending with the shorter trimmed clip.
A PNG preview is saved beside the video as <output-name>-preview.png.
Use start offsets to align recording clocks and preserve actual stream delay.
`;

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    maxBuffer: 8 * 1024 * 1024,
  });

  if (result.error?.code === 'ENOENT') {
    throw new Error(`${command} is missing. Install FFmpeg and make it available on PATH.`);
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed${capture ? `: ${result.stderr.trim()}` : '.'}`);
  }

  return result.stdout;
}

function requireFile(path) {
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`File not found: ${path}`);
  }
}

function requireNewFile(path) {
  if (lstatSync(path, { throwIfNoEntry: false })) {
    throw new Error(`Refusing to overwrite: ${path}`);
  }
}

function probe(path) {
  requireFile(path);
  const metadata = JSON.parse(
    run(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height,duration:format=duration',
        '-of',
        'json',
        path,
      ],
      true,
    ),
  );
  const video = metadata.streams?.[0];
  if (!video) throw new Error(`No video stream found: ${path}`);

  const durations = [Number(video.duration), Number(metadata.format?.duration)];
  const duration = durations.find((value) => Number.isFinite(value) && value > 0);
  return { ...video, duration };
}

function startOffset(value, name) {
  const seconds = Number(value);
  if (value.trim() === '' || !Number.isFinite(seconds) || seconds < 0) {
    throw new Error(`--${name} must be a nonnegative number of seconds.`);
  }
  return seconds;
}

function fitVideo(input, name) {
  return (
    `[${input}:v:0]setpts=PTS-STARTPTS,fps=${frameRate},` +
    `scale=${slot.width}:${slot.height}:force_original_aspect_ratio=decrease:` +
    `force_divisible_by=2:reset_sar=1[${name}]`
  );
}

function overlayVideo(base, video, left, output) {
  return (
    `[${base}][${video}]overlay=x=${left}+(${slot.width}-overlay_w)/2:` +
    `y=${slot.top}+(${slot.height}-overlay_h)/2:shortest=1[${output}]`
  );
}

function main() {
  const { values } = parseArgs({
    options: {
      iphone: { type: 'string' },
      android: { type: 'string' },
      output: { type: 'string' },
      'iphone-start': { type: 'string', default: '0' },
      'android-start': { type: 'string', default: '0' },
      help: { type: 'boolean' },
    },
  });

  if (values.help) {
    console.log(help);
    return;
  }
  for (const name of ['iphone', 'android', 'output']) {
    if (!values[name]?.trim()) throw new Error(`--${name} is required. Run with --help for usage.`);
  }

  const iphone = resolve(values.iphone);
  const android = resolve(values.android);
  const output = resolve(values.output);
  if (extname(output).toLowerCase() !== '.mp4') throw new Error('--output must end in .mp4.');
  const preview = `${output.slice(0, -4)}-preview.png`;
  requireNewFile(output);
  requireNewFile(preview);

  const iphoneStart = startOffset(values['iphone-start'], 'iphone-start');
  const androidStart = startOffset(values['android-start'], 'android-start');
  const scene = probe(background);
  if (scene.width !== 1920 || scene.height !== 1080) {
    throw new Error('docs/recording/scene.png must be 1920×1080.');
  }

  const durations = [probe(iphone).duration - iphoneStart, probe(android).duration - androidStart];
  if (durations.some((duration) => !Number.isFinite(duration) || duration < 1 / frameRate)) {
    throw new Error(
      'Each recording must have a known duration and at least one frame after trimming.',
    );
  }
  const duration = Math.min(...durations);
  const filters = [
    fitVideo(1, 'iphone'),
    fitVideo(2, 'android'),
    overlayVideo('0:v:0', 'iphone', slot.iphoneLeft, 'withIphone'),
    overlayVideo('withIphone', 'android', slot.androidLeft, 'withAndroid'),
    '[withAndroid]scale=out_range=tv,format=yuv420p[composed]',
  ].join(';');

  mkdirSync(dirname(output), { recursive: true });
  console.log(`Composing ${duration.toFixed(2)} seconds into ${output}`);
  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-nostdin',
    '-n',
    '-loop',
    '1',
    '-framerate',
    String(frameRate),
    '-i',
    background,
    '-ss',
    String(iphoneStart),
    '-i',
    iphone,
    '-ss',
    String(androidStart),
    '-i',
    android,
    '-filter_complex',
    filters,
    '-map',
    '[composed]',
    '-an',
    '-t',
    String(duration),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-color_range',
    'tv',
    '-r',
    String(frameRate),
    '-movflags',
    '+faststart',
    output,
  ]);

  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-n',
    '-i',
    output,
    '-frames:v',
    '1',
    '-update',
    '1',
    preview,
  ]);
  console.log(`Video: ${output}\nPreview: ${preview}`);
}

try {
  main();
} catch (error) {
  console.error(`Could not compose demo: ${error.message}`);
  process.exitCode = 1;
}
