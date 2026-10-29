export function clampZoom(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function zoomForPinch(start: number, scale: number, min: number, max: number) {
  'worklet';
  return clampZoom(start * (Number.isFinite(scale) && scale > 0 ? scale : 1), min, max);
}
