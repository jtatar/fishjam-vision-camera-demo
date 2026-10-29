import { clampZoom, zoomForPinch } from '../src/camera/core/zoom';

test.each([
  [0.5, 1],
  [2, 2],
  [15, 8],
  [NaN, 1],
  [Infinity, 1],
])('clamps %s to %s', (input, expected) => {
  expect(clampZoom(input, 1, 8)).toBe(expected);
});

test('pinch scales relative to gesture start, including zoom out', () => {
  expect(zoomForPinch(2, 1.5, 1, 8)).toBe(3);
  expect(zoomForPinch(2, 0.5, 1, 8)).toBe(1);
  expect(zoomForPinch(4, 10, 1, 8)).toBe(8);
});

test('handles fixed zoom, ultra-wide minimums and invalid gesture values', () => {
  expect(zoomForPinch(1, 2, 1, 1)).toBe(1);
  expect(zoomForPinch(1, 0.5, 0.5, 8)).toBe(0.5);
  expect(zoomForPinch(2, NaN, 1, 8)).toBe(2);
  expect(zoomForPinch(2, -1, 1, 8)).toBe(2);
});
