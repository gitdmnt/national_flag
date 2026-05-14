export const BRUSH_PRESETS = {
  small: { radiusX: 5, radiusY: 5 },
  medium: { radiusX: 25, radiusY: 10 },
  large: { radiusX: 80, radiusY: 24 },
} as const;

export type BrushSize = keyof typeof BRUSH_PRESETS;

export type Stamp = {
  readonly x: number;
  readonly y: number;
};

export const interpolateStamps = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  step: number,
): readonly Stamp[] => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (!(step > 0) || dist === 0) {
    return [{ x: x2, y: y2 }];
  }
  const steps = Math.max(1, Math.ceil(dist / step));
  const out: Stamp[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    out.push({ x: x1 + dx * t, y: y1 + dy * t });
  }
  return out;
};
