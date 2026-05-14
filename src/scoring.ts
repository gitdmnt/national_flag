export const RED_THRESHOLDS = {
  rMin: 200,
  gMax: 100,
  bMax: 100,
  aMin: 128,
} as const;

export type RegionStats = {
  readonly area: number;
  readonly cx: number;
  readonly cy: number;
};

export type CircleDetail = {
  /** |actual ∩ ¬ideal| / |ideal| — fraction of the detected circle area that is overflowed by red pixels outside it. */
  readonly overflowRatio: number;
  /** |¬actual ∩ ideal| / |ideal| — fraction of the detected circle area that is not filled with red. */
  readonly shortfallRatio: number;
};

export type ScoreBreakdown = {
  readonly circle: number;
  readonly center: number;
  readonly diameter: number;
  readonly total: number;
  readonly circleDetail: CircleDetail;
};

const DIAMETER_RATIO = 3 / 5;

export const buildRedMask = (img: ImageData): Uint8Array => {
  const { data, width, height } = img;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    const r = data[p]!;
    const g = data[p + 1]!;
    const b = data[p + 2]!;
    const a = data[p + 3]!;
    mask[i] =
      a >= RED_THRESHOLDS.aMin &&
      r >= RED_THRESHOLDS.rMin &&
      g <= RED_THRESHOLDS.gMax &&
      b <= RED_THRESHOLDS.bMax
        ? 1
        : 0;
  }
  return mask;
};

export const regionStats = (mask: Uint8Array, w: number, h: number): RegionStats | null => {
  let area = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] === 1) {
        area++;
        sumX += x + 0.5;
        sumY += y + 0.5;
      }
    }
  }
  if (area === 0) return null;
  return { area, cx: sumX / area, cy: sumY / area };
};

export const effectiveRadius = (area: number): number => Math.sqrt(area / Math.PI);

export type DetectedCircle = {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
};

export const detectCircle = (img: ImageData): DetectedCircle | null => {
  const mask = buildRedMask(img);
  const stats = regionStats(mask, img.width, img.height);
  if (stats === null) return null;
  return { cx: stats.cx, cy: stats.cy, r: effectiveRadius(stats.area) };
};

const clampScore = (s: number): number => Math.max(0, Math.min(100, s));

export const scoreCircularity = (img: ImageData): number => {
  const mask = buildRedMask(img);
  const stats = regionStats(mask, img.width, img.height);
  if (stats === null) return 0;
  const r = effectiveRadius(stats.area);
  const rSq = r * r;
  let intersection = 0;
  let union = 0;
  const { width: w, height: h } = img;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const actual = mask[y * w + x] === 1;
      const dx = x + 0.5 - stats.cx;
      const dy = y + 0.5 - stats.cy;
      const ideal = dx * dx + dy * dy <= rSq;
      if (actual && ideal) intersection++;
      if (actual || ideal) union++;
    }
  }
  if (union === 0) return 0;
  return clampScore((intersection / union) * 100);
};

export const scoreCenter = (img: ImageData): number => {
  const mask = buildRedMask(img);
  const stats = regionStats(mask, img.width, img.height);
  if (stats === null) return 0;
  const dx = stats.cx - img.width / 2;
  const dy = stats.cy - img.height / 2;
  const dist = Math.hypot(dx, dy);
  const maxDist = img.height / 2;
  return clampScore(100 * (1 - dist / maxDist));
};

export const scoreDiameter = (img: ImageData): number => {
  const mask = buildRedMask(img);
  const stats = regionStats(mask, img.width, img.height);
  if (stats === null) return 0;
  const target = DIAMETER_RATIO * img.height;
  const actual = 2 * effectiveRadius(stats.area);
  const diff = Math.abs(actual - target) / target;
  return clampScore(100 * (1 - diff));
};

const ZERO_DETAIL: CircleDetail = {
  overflowRatio: 0,
  shortfallRatio: 0,
};

export const evaluate = (img: ImageData): ScoreBreakdown => {
  const mask = buildRedMask(img);
  const stats = regionStats(mask, img.width, img.height);
  if (stats === null) {
    return {
      circle: 0,
      center: 0,
      diameter: 0,
      total: 0,
      circleDetail: ZERO_DETAIL,
    };
  }

  const r = effectiveRadius(stats.area);
  const rSq = r * r;
  const { width: w, height: h } = img;

  let actualCount = 0;
  let idealCount = 0;
  let intersection = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const actual = mask[y * w + x] === 1;
      const dx = x + 0.5 - stats.cx;
      const dy = y + 0.5 - stats.cy;
      const ideal = dx * dx + dy * dy <= rSq;
      if (actual) actualCount++;
      if (ideal) idealCount++;
      if (actual && ideal) intersection++;
    }
  }
  const union = actualCount + idealCount - intersection;
  const circle = union === 0 ? 0 : clampScore((intersection / union) * 100);
  const overflowRatio = idealCount === 0 ? 0 : (actualCount - intersection) / idealCount;
  const shortfallRatio = idealCount === 0 ? 0 : (idealCount - intersection) / idealCount;

  const cdx = stats.cx - w / 2;
  const cdy = stats.cy - h / 2;
  const center = clampScore(100 * (1 - Math.hypot(cdx, cdy) / (h / 2)));

  const target = DIAMETER_RATIO * h;
  const actualDiameter = 2 * r;
  const diameter = clampScore(100 * (1 - Math.abs(actualDiameter - target) / target));

  const total = Math.round((circle + center + diameter) / 3);
  return {
    circle,
    center,
    diameter,
    total,
    circleDetail: { overflowRatio, shortfallRatio },
  };
};
