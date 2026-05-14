import { describe, expect, test } from "bun:test";
import { BRUSH_PRESETS, interpolateStamps, type BrushSize } from "./brush";

const SIZES: readonly BrushSize[] = ["small", "medium", "large"];

describe("BRUSH_PRESETS", () => {
  test.each(SIZES)("%s has radiusX >= radiusY (horizontal or circular)", (size) => {
    const { radiusX, radiusY } = BRUSH_PRESETS[size];
    expect(radiusX).toBeGreaterThanOrEqual(radiusY);
  });

  test("presets are ordered small < medium < large on both axes", () => {
    expect(BRUSH_PRESETS.medium.radiusX).toBeGreaterThan(BRUSH_PRESETS.small.radiusX);
    expect(BRUSH_PRESETS.large.radiusX).toBeGreaterThan(BRUSH_PRESETS.medium.radiusX);
    expect(BRUSH_PRESETS.medium.radiusY).toBeGreaterThan(BRUSH_PRESETS.small.radiusY);
    expect(BRUSH_PRESETS.large.radiusY).toBeGreaterThan(BRUSH_PRESETS.medium.radiusY);
  });
});

describe("interpolateStamps", () => {
  test("returns a single stamp at the endpoint when start equals end", () => {
    expect(interpolateStamps(10, 10, 10, 10, 5)).toEqual([{ x: 10, y: 10 }]);
  });

  test("places evenly spaced stamps along the line, last at endpoint", () => {
    const stamps = interpolateStamps(0, 0, 10, 0, 2);
    expect(stamps).toHaveLength(5);
    expect(stamps[0]).toEqual({ x: 2, y: 0 });
    expect(stamps[stamps.length - 1]).toEqual({ x: 10, y: 0 });
  });

  test("rounds the number of stamps up so spacing never exceeds the step", () => {
    const stamps = interpolateStamps(0, 0, 7, 0, 2);
    // ceil(7/2) = 4
    expect(stamps).toHaveLength(4);
    expect(stamps[stamps.length - 1]).toEqual({ x: 7, y: 0 });
    // every consecutive pair within `step`
    for (let i = 1; i < stamps.length; i++) {
      const a = stamps[i - 1]!;
      const b = stamps[i]!;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(2);
    }
  });

  test("works for diagonal movement", () => {
    const stamps = interpolateStamps(0, 0, 6, 8, 5);
    // dist = 10, ceil(10/5) = 2
    expect(stamps).toHaveLength(2);
    expect(stamps[0]).toEqual({ x: 3, y: 4 });
    expect(stamps[1]).toEqual({ x: 6, y: 8 });
  });

  test("throws or treats non-positive step as a single endpoint stamp", () => {
    // Defensive: step <= 0 should not loop forever.
    expect(interpolateStamps(0, 0, 5, 0, 0)).toEqual([{ x: 5, y: 0 }]);
  });
});
