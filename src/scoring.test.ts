import { describe, expect, test } from "bun:test";
import {
  buildRedMask,
  detectCircle,
  evaluate,
  regionStats,
  scoreCenter,
  scoreCircularity,
  scoreDiameter,
  effectiveRadius,
} from "./scoring";

const makeImageData = (w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]): ImageData => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b, a] = fill(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
};

const RED: [number, number, number, number] = [220, 20, 30, 255];
const WHITE: [number, number, number, number] = [0, 0, 0, 0];

const idealFlag = (w: number, h: number): ImageData => {
  const cx = w / 2;
  const cy = h / 2;
  const r = (h * 3) / 5 / 2;
  return makeImageData(w, h, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    return dx * dx + dy * dy <= r * r ? RED : WHITE;
  });
};

describe("buildRedMask", () => {
  test("flags red pixels (R high, G/B low, alpha opaque)", () => {
    const img = makeImageData(2, 1, () => RED);
    const mask = buildRedMask(img);
    expect(mask[0]).toBe(1);
    expect(mask[1]).toBe(1);
  });

  test("rejects transparent pixels even if red", () => {
    const img = makeImageData(1, 1, () => [220, 20, 30, 127]);
    const mask = buildRedMask(img);
    expect(mask[0]).toBe(0);
  });

  test("rejects non-red pixels", () => {
    const img = makeImageData(2, 1, (x) => (x === 0 ? [199, 0, 0, 255] : [255, 150, 150, 255]));
    const mask = buildRedMask(img);
    expect(mask[0]).toBe(0);
    expect(mask[1]).toBe(0);
  });

  test("accepts boundary thresholds (R=200, G=100, B=100, A=128)", () => {
    const img = makeImageData(1, 1, () => [200, 100, 100, 128]);
    const mask = buildRedMask(img);
    expect(mask[0]).toBe(1);
  });
});

describe("regionStats", () => {
  test("returns null for empty mask", () => {
    const mask = new Uint8Array(100);
    expect(regionStats(mask, 10, 10)).toBeNull();
  });

  test("computes centroid for a single pixel", () => {
    const mask = new Uint8Array(9);
    mask[1 * 3 + 1] = 1;
    const stats = regionStats(mask, 3, 3);
    expect(stats).not.toBeNull();
    expect(stats!.area).toBe(1);
    expect(stats!.cx).toBeCloseTo(1.5, 5);
    expect(stats!.cy).toBeCloseTo(1.5, 5);
  });

  test("computes centroid of a centered square", () => {
    const w = 10;
    const h = 10;
    const mask = new Uint8Array(w * h);
    for (let y = 3; y < 7; y++) {
      for (let x = 3; x < 7; x++) {
        mask[y * w + x] = 1;
      }
    }
    const stats = regionStats(mask, w, h);
    expect(stats!.area).toBe(16);
    expect(stats!.cx).toBeCloseTo(5, 5);
    expect(stats!.cy).toBeCloseTo(5, 5);
  });
});

describe("effectiveRadius", () => {
  test("returns sqrt(area / pi)", () => {
    expect(effectiveRadius(Math.PI * 100)).toBeCloseTo(10, 6);
  });
});

describe("scoreCircularity", () => {
  test("perfect circle scores ~100", () => {
    const img = idealFlag(100, 150);
    expect(scoreCircularity(img)).toBeGreaterThanOrEqual(95);
  });

  test("square scores lower", () => {
    const w = 100;
    const h = 150;
    const img = makeImageData(w, h, (x, y) => {
      const inSquare = x >= 30 && x < 70 && y >= 55 && y < 95;
      return inSquare ? RED : WHITE;
    });
    expect(scoreCircularity(img)).toBeLessThan(85);
  });

  test("empty image scores 0", () => {
    const img = makeImageData(10, 10, () => WHITE);
    expect(scoreCircularity(img)).toBe(0);
  });
});

describe("scoreCenter", () => {
  test("centered shape scores ~100", () => {
    const img = idealFlag(100, 150);
    expect(scoreCenter(img)).toBeGreaterThanOrEqual(99);
  });

  test("off-center circle scores lower", () => {
    const w = 100;
    const h = 150;
    const r = (h * 3) / 5 / 2;
    const img = makeImageData(w, h, (x, y) => {
      const dx = x + 0.5 - 20;
      const dy = y + 0.5 - 20;
      return dx * dx + dy * dy <= r * r ? RED : WHITE;
    });
    expect(scoreCenter(img)).toBeLessThan(50);
  });

  test("empty image scores 0", () => {
    const img = makeImageData(10, 10, () => WHITE);
    expect(scoreCenter(img)).toBe(0);
  });
});

describe("scoreDiameter", () => {
  test("ideal diameter (0.6H) scores ~100", () => {
    const img = idealFlag(100, 150);
    expect(scoreDiameter(img)).toBeGreaterThanOrEqual(99);
  });

  test("too-small circle scores lower", () => {
    const w = 100;
    const h = 150;
    const r = 10;
    const img = makeImageData(w, h, (x, y) => {
      const dx = x + 0.5 - w / 2;
      const dy = y + 0.5 - h / 2;
      return dx * dx + dy * dy <= r * r ? RED : WHITE;
    });
    expect(scoreDiameter(img)).toBeLessThan(50);
  });

  test("empty image scores 0", () => {
    const img = makeImageData(10, 10, () => WHITE);
    expect(scoreDiameter(img)).toBe(0);
  });
});

describe("detectCircle", () => {
  test("returns null for an empty image", () => {
    const img = makeImageData(10, 10, () => WHITE);
    expect(detectCircle(img)).toBeNull();
  });

  test("recovers center and effective radius of an ideal flag circle", () => {
    const w = 200;
    const h = 300;
    const img = idealFlag(w, h);
    const detected = detectCircle(img);
    expect(detected).not.toBeNull();
    expect(detected!.cx).toBeCloseTo(w / 2, 0);
    expect(detected!.cy).toBeCloseTo(h / 2, 0);
    // Expected diameter is 0.6 * h = 180 → radius 90
    expect(detected!.r).toBeCloseTo(90, 0);
  });
});

describe("evaluate", () => {
  test("ideal flag scores 100 across the board", () => {
    const img = idealFlag(200, 300);
    const result = evaluate(img);
    expect(result.circle).toBeGreaterThanOrEqual(99);
    expect(result.center).toBeGreaterThanOrEqual(99);
    expect(result.diameter).toBeGreaterThanOrEqual(99);
    expect(result.total).toBe(100);
  });

  test("empty image scores zero with zero circleDetail", () => {
    const img = makeImageData(10, 10, () => WHITE);
    expect(evaluate(img)).toEqual({
      circle: 0,
      center: 0,
      diameter: 0,
      total: 0,
      circleDetail: { overflowRatio: 0, shortfallRatio: 0 },
    });
  });

  test("total is the rounded average of the three score axes", () => {
    const img = idealFlag(200, 300);
    const r = evaluate(img);
    expect(r.total).toBe(Math.round((r.circle + r.center + r.diameter) / 3));
  });

  test("ideal flag has near-zero overflow and shortfall", () => {
    const img = idealFlag(200, 300);
    const r = evaluate(img);
    expect(r.circleDetail.overflowRatio).toBeLessThan(0.02);
    expect(r.circleDetail.shortfallRatio).toBeLessThan(0.02);
  });

  test("a fully red canvas produces overflow with zero shortfall", () => {
    // Every pixel is red, so nothing inside the ideal circle is missing (shortfall=0),
    // but plenty of red exists outside the ideal circle (overflow>0).
    const img = makeImageData(100, 150, () => RED);
    const r = evaluate(img);
    expect(r.circleDetail.overflowRatio).toBeGreaterThan(0);
    expect(r.circleDetail.shortfallRatio).toBe(0);
  });
});
