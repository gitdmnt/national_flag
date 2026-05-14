import { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";
import {
  detectCircle,
  evaluate,
  type DetectedCircle,
  type ScoreBreakdown,
} from "./scoring";
import { BRUSH_PRESETS, interpolateStamps, type BrushSize } from "./brush";

const CANVAS_W = 600;
const CANVAS_H = 400;
const FLAG_RED = "#ef1c21";
const DETECTED_LINE_COLOR = "#22c55e";
const DETECTED_LINE_WIDTH = 3;

type Phase = "playing" | "result";

const paintRed = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = FLAG_RED;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const wipeStroke = (
  canvas: HTMLCanvasElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: BrushSize,
): void => {
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  const { radiusX, radiusY } = BRUSH_PRESETS[size];
  const step = Math.max(1, Math.min(radiusX, radiusY) / 2);
  const stamps = interpolateStamps(x1, y1, x2, y2, step);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,1)";
  for (const s of stamps) {
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawDetectedCircle = (
  canvas: HTMLCanvasElement,
  detected: DetectedCircle,
): void => {
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineWidth = DETECTED_LINE_WIDTH;
  ctx.strokeStyle = DETECTED_LINE_COLOR;
  ctx.beginPath();
  ctx.arc(detected.cx, detected.cy, detected.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const verdictOf = (total: number): "fail" | "success" | "perfect" => {
  if (total >= 100) return "perfect";
  if (total >= 90) return "success";
  return "fail";
};

const toCanvasCoords = (
  canvas: HTMLCanvasElement,
  e: React.PointerEvent<HTMLCanvasElement>,
): { x: number; y: number } => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * canvas.width) / rect.width,
    y: ((e.clientY - rect.top) * canvas.height) / rect.height,
  };
};

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = useState<Phase>("playing");
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);
  const [detected, setDetected] = useState<DetectedCircle | null>(null);
  const [brushSize, setBrushSize] = useState<BrushSize>("medium");

  const reset = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    paintRed(canvas);
    setBreakdown(null);
    setDetected(null);
    setPhase("playing");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    paintRed(canvas);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (phase !== "playing") return;
      const canvas = canvasRef.current;
      if (canvas === null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const { x, y } = toCanvasCoords(canvas, e);
      isDrawingRef.current = true;
      lastPosRef.current = { x, y };
      wipeStroke(canvas, x, y, x, y, brushSize);
    },
    [phase, brushSize],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      const canvas = canvasRef.current;
      if (canvas === null) return;
      const { x, y } = toCanvasCoords(canvas, e);
      const prev = lastPosRef.current;
      if (prev !== null) {
        wipeStroke(canvas, prev.x, prev.y, x, y, brushSize);
      }
      lastPosRef.current = { x, y };
    },
    [brushSize],
  );

  const handlePointerEnd = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      isDrawingRef.current = false;
      lastPosRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = evaluate(img);
    const detectedNow = detectCircle(img);
    if (detectedNow !== null) drawDetectedCircle(canvas, detectedNow);
    setBreakdown(result);
    setDetected(detectedNow);
    setPhase("result");
  }, []);

  const verdict = breakdown === null ? null : verdictOf(breakdown.total);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold text-white">
        汚された日の丸を修復せよ！
      </h1>
      <p className="text-sm text-white/80 text-center max-w-md">
        大変だ！　日本の破壊を目論む悪の共産主義者スパイ軍団が、我々の誇りであり魂の宿り木でもある日本国旗を真っ赤に汚してしまいました！！
        このままでは、日本は完全に共産主義の国になり、大量の移民が押し寄せ、天皇制が廃止され、なんと夫婦まで別姓になってしまいます！！
        愛国者よ、悪の共産主義者の手によって真っ赤に汚されてしまったキャンバスをジェット水流で洗い流して、完璧な日の丸を復元してください！
      </p>

      <div
        className="relative bg-white shadow-lg"
        style={{
          width: "min(90vw, 600px)",
          aspectRatio: "3 / 2",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className="w-full h-full block cursor-crosshair touch-none select-none"
        />
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-center">
        <div
          role="group"
          aria-label="ブラシサイズ"
          className="inline-flex rounded overflow-hidden border border-white/40"
        >
          {(
            [
              { size: "small", label: "ジェットノズル" },
              { size: "medium", label: "セミワイドノズル" },
              { size: "large", label: "ワイドノズル" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.size}
              type="button"
              onClick={() => setBrushSize(opt.size)}
              aria-pressed={brushSize === opt.size}
              className={
                "px-4 py-2 text-sm font-semibold " +
                (brushSize === opt.size
                  ? "bg-white text-black"
                  : "bg-white/10 text-white")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={phase !== "playing"}
          className="px-6 py-2 rounded bg-white text-black font-semibold disabled:opacity-40"
        >
          提出
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-6 py-2 rounded bg-white/20 text-white font-semibold"
        >
          やりなおす
        </button>
      </div>

      {phase === "result" && breakdown !== null && verdict !== null && (
        <ResultPanel
          breakdown={breakdown}
          detected={detected}
          verdict={verdict}
          onRetry={reset}
        />
      )}
    </div>
  );
}

type ResultPanelProps = {
  readonly breakdown: ScoreBreakdown;
  readonly detected: DetectedCircle | null;
  readonly verdict: "fail" | "success" | "perfect";
  readonly onRetry: () => void;
};

const fmtPercent = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`;

const fmtSigned = (n: number): string => {
  const r = Math.round(n);
  return r >= 0 ? `+${r}` : `${r}`;
};

const diameterRatio5 = (radius: number, height: number): number =>
  ((2 * radius) / height) * 5;

function ResultPanel({
  breakdown,
  detected,
  verdict,
  onRetry,
}: ResultPanelProps) {
  return (
    <>
      {verdict === "fail" && (
        <div className="fixed inset-0 z-10 pointer-events-none flag-flash" />
      )}
      <div className="relative z-20 bg-neutral-900 text-white rounded-lg shadow-2xl p-6 max-w-md w-full border border-white/20">
        <h2 className="text-xl font-bold text-center">
          {verdict === "perfect" && "完璧！！"}
          {verdict === "success" && "成功！"}
          {verdict === "fail" && "失敗！"}
        </h2>
        <p className="text-md font-bold mb-3 text-center">
          {verdict === "perfect" && "あなたこそが真の日本国民です！！"}
          {verdict === "success" && "あなたは真の愛国者です！！"}
          {verdict === "fail" && "あなたのもとに警察がやってきました……"}
        </p>
        <div className="space-y-1 text-sm mb-4">
          <ScoreRow label="中心" value={breakdown.center} />
          {detected !== null && (
            <SubRow
              label="検出された中心 (キャンバス中央からの差分)"
              value={`(${fmtSigned(detected.cx - CANVAS_W / 2)}, ${fmtSigned(detected.cy - CANVAS_H / 2)})`}
            />
          )}
          <ScoreRow label="直径" value={breakdown.diameter} />
          {detected !== null && (
            <SubRow
              label="検出された直径比率"
              value={`${diameterRatio5(detected.r, CANVAS_H).toFixed(1)} : 5`}
            />
          )}
          <ScoreRow label="真円度" value={breakdown.circle} />
          <SubRow
            label="円からはみ出た割合"
            value={fmtPercent(breakdown.circleDetail.overflowRatio)}
          />
          <SubRow
            label="円から不足した割合"
            value={fmtPercent(breakdown.circleDetail.shortfallRatio)}
          />
          <div className="border-t border-white/30 pt-1 mt-2 flex justify-between font-bold text-lg">
            <span>総合</span>
            <span>{breakdown.total} 点</span>
          </div>
        </div>
        {verdict === "perfect" && (
          <div className="aspect-video mb-4">
            <iframe
              title="君が代"
              src="https://www.youtube.com/embed/8kFWwuiUdT4?autoplay=1"
              allow="autoplay; encrypted-media"
              className="w-full h-full rounded"
            />
          </div>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="w-full py-2 rounded bg-white text-black font-semibold"
        >
          もう一度
        </button>
      </div>
    </>
  );
}

function ScoreRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{Math.round(value)} 点</span>
    </div>
  );
}

function SubRow({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}) {
  return (
    <div className="pl-4 flex justify-between text-xs text-white/70">
      <span>
        {label}
        {hint !== undefined && (
          <span className="ml-1 text-white/40">{hint}</span>
        )}
      </span>
      <span>{value}</span>
    </div>
  );
}

export default App;
