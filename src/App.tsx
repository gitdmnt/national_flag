import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import "./index.css";
import {
  detectCircle,
  evaluate,
  type DetectedCircle,
  type ScoreBreakdown,
} from "./scoring";
import { BRUSH_PRESETS, interpolateStamps, type BrushSize } from "./brush";
import {
  BriefingScreen,
  DialogBox,
  HintBar,
  KeyCap,
} from "./ui/BriefingScreen";
import { useKeyBindings } from "./ui/useKeyBindings";
import type { Action } from "./ui/keybindings";

const CANVAS_W = 600;
const CANVAS_H = 400;
const FLAG_RED = "#ef1c21";
const DETECTED_LINE_COLOR = "#22c55e";
const DETECTED_LINE_WIDTH = 3;
const JUDGING_DURATION_MS = 900;

type Phase = "briefing" | "playing" | "judging" | "result";

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

const BRUSH_OPTIONS = [
  { size: "small", label: "ジェットノズル", short: "ジェット", key: "1" },
  { size: "medium", label: "セミワイドノズル", short: "セミワイド", key: "2" },
  { size: "large", label: "ワイドノズル", short: "ワイド", key: "3" },
] as const satisfies readonly {
  readonly size: BrushSize;
  readonly label: string;
  readonly short: string;
  readonly key: string;
}[];

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = useState<Phase>("briefing");
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);
  const [detected, setDetected] = useState<DetectedCircle | null>(null);
  const [brushSize, setBrushSize] = useState<BrushSize>("medium");
  const reduced = useReducedMotion();

  const reset = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas !== null) paintRed(canvas);
    setBreakdown(null);
    setDetected(null);
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    paintRed(canvas);
  }, [phase]);

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
    setPhase("judging");
    const wait = reduced ? 200 : JUDGING_DURATION_MS;
    window.setTimeout(() => setPhase("result"), wait);
  }, [reduced]);

  const handleAction = useCallback(
    (action: Action) => {
      switch (action) {
        case "brush_small":
          setBrushSize("small");
          break;
        case "brush_medium":
          setBrushSize("medium");
          break;
        case "brush_large":
          setBrushSize("large");
          break;
        case "submit":
          handleSubmit();
          break;
        case "reset":
          reset();
          break;
        case "retry":
          reset();
          break;
        default:
          break;
      }
    },
    [handleSubmit, reset],
  );

  useKeyBindings(phase, handleAction);

  const verdict = breakdown === null ? null : verdictOf(breakdown.total);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-start py-6 sm:py-10 px-4 gap-6">
      <AnimatePresence mode="wait">
        {phase === "briefing" && (
          <motion.div
            key="briefing"
            className="w-full flex justify-center"
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
          >
            <BriefingScreen onFinish={() => setPhase("playing")} />
          </motion.div>
        )}
      </AnimatePresence>

      {phase !== "briefing" && (
        <GameScreen
          canvasRef={canvasRef}
          brushSize={brushSize}
          onSelectBrush={setBrushSize}
          onSubmit={handleSubmit}
          onReset={reset}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerEnd={handlePointerEnd}
          phase={phase}
        />
      )}

      <AnimatePresence>
        {phase === "judging" && <JudgingOverlay key="judging" />}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "result" && breakdown !== null && verdict !== null && (
          <ResultPanel
            key="result"
            breakdown={breakdown}
            detected={detected}
            verdict={verdict}
            onRetry={reset}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

type GameScreenProps = {
  readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
  readonly brushSize: BrushSize;
  readonly onSelectBrush: (s: BrushSize) => void;
  readonly onSubmit: () => void;
  readonly onReset: () => void;
  readonly onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  readonly onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  readonly onPointerEnd: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  readonly phase: Phase;
};

function GameScreen({
  canvasRef,
  brushSize,
  onSelectBrush,
  onSubmit,
  onReset,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  phase,
}: GameScreenProps) {
  const reduced = useReducedMotion();
  const disabled = phase !== "playing";

  return (
    <motion.div
      className="w-full max-w-3xl flex flex-col items-center gap-5"
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.35 }}
    >
      <div className="w-full flex items-center justify-between gap-4 px-1">
        <div className="flex items-baseline gap-3">
          <span
            className="text-[0.65rem] tracking-[0.4em] text-gold"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ── MISSION 001 ──
          </span>
          <span
            className="text-[0.6rem] tracking-[0.3em] text-silver"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            STATUS: 作戦遂行中
          </span>
        </div>
        <span
          className="hidden sm:inline text-[0.65rem] tracking-widest text-paper/60"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          OPERATOR: 愛国者
        </span>
      </div>

      <div
        className="relative p-1.5"
        style={{
          width: "min(92vw, 640px)",
        }}
      >
        <div
          className="absolute -inset-px"
          style={{
            background:
              "linear-gradient(140deg, vargold 0%, #5a4623 50%, vargold 100%)",
          }}
          aria-hidden
        />
        <div className="relative bg-ink p-1.5">
          <div
            className="relative bg-white shadow-[0_24px_60px_-20px_rgba(188,0,45,0.45)] scanlines"
            style={{ aspectRatio: "3 / 2" }}
          >
            <span className="bracket-tl" aria-hidden />
            <span className="bracket-tr" aria-hidden />
            <span className="bracket-bl" aria-hidden />
            <span className="bracket-br" aria-hidden />
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              className="w-full h-full block cursor-crosshair touch-none select-none"
              style={{ pointerEvents: disabled ? "none" : "auto" }}
            />
          </div>
        </div>
        <div className="absolute -top-3 left-3 px-2 py-0.5 bg-ink border border-gold/60">
          <span
            className="text-[0.6rem] tracking-[0.3em] text-gold-bright"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            TARGET ‒ NATIONAL FLAG
          </span>
        </div>
        <div className="absolute -bottom-3 right-3 px-2 py-0.5 bg-ink border border-hinomaru/70">
          <span
            className="text-[0.6rem] tracking-[0.3em] text-hinomaru-bright"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            REC ●
          </span>
        </div>
      </div>

      <BrushPanel
        selected={brushSize}
        onSelect={onSelectBrush}
        disabled={disabled}
      />

      <div className="flex flex-wrap items-center justify-center gap-4 px-1">
        <ActionButton
          onClick={onSubmit}
          disabled={disabled}
          tone="primary"
          keyLabel="Enter"
        >
          提出
        </ActionButton>
        <ActionButton onClick={onReset} tone="ghost" keyLabel="R">
          やりなおす
        </ActionButton>
      </div>

      <HintBar phase={phase} />
    </motion.div>
  );
}

type BrushPanelProps = {
  readonly selected: BrushSize;
  readonly onSelect: (s: BrushSize) => void;
  readonly disabled: boolean;
};

function BrushPanel({ selected, onSelect, disabled }: BrushPanelProps) {
  const reduced = useReducedMotion();
  return (
    <div
      role="group"
      aria-label="ブラシサイズ"
      className="w-full max-w-2xl flex items-stretch gap-2 sm:gap-3"
    >
      {BRUSH_OPTIONS.map((opt) => {
        const active = selected === opt.size;
        return (
          <motion.button
            key={opt.size}
            type="button"
            onClick={() => onSelect(opt.size)}
            aria-pressed={active}
            disabled={disabled}
            className={
              "relative flex-1 px-3 py-3 border text-left transition-colors disabled:opacity-50 " +
              (active
                ? "bg-paper text-ink border-gold"
                : "bg-ink-2 text-paper border-paper/15 hover:border-gold/60")
            }
            whileHover={disabled ? undefined : { y: reduced ? 0 : -2 }}
            whileTap={disabled ? undefined : { scale: reduced ? 1 : 0.97 }}
          >
            {active && (
              <motion.span
                layoutId="brush-glow"
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow:
                    "0 0 0 1px vargold, 0 0 18px 2px rgba(240,210,124,0.45)",
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 28,
                }}
              />
            )}
            <div className="relative flex items-center justify-between gap-2">
              <KeyCap
                label={opt.key}
                size="sm"
                tone={active ? "light" : "dark"}
              />
              <BrushPreview size={opt.size} active={active} />
            </div>
            <div
              className="relative mt-2 text-sm sm:text-base"
              style={{ fontFamily: "var(--font-body)", fontWeight: 700 }}
            >
              {opt.short}
            </div>
            <div
              className={
                "relative text-[0.65rem] tracking-widest mt-0.5 " +
                (active ? "text-ink/60" : "text-paper/50")
              }
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {opt.label}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

function BrushPreview({
  size,
  active,
}: {
  readonly size: BrushSize;
  readonly active: boolean;
}) {
  const { radiusX, radiusY } = BRUSH_PRESETS[size];
  const max = BRUSH_PRESETS.large.radiusX;
  const w = 6 + (radiusX / max) * 42;
  const h = 6 + (radiusY / max) * 18;
  return (
    <span
      aria-hidden
      className={
        "inline-block rounded-full " + (active ? "bg-hinomaru" : "bg-paper/70")
      }
      style={{ width: `${w}px`, height: `${h}px` }}
    />
  );
}

type ActionButtonProps = {
  readonly children: React.ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly tone: "primary" | "ghost";
  readonly keyLabel: string;
};

function ActionButton({
  children,
  onClick,
  disabled = false,
  tone,
  keyLabel,
}: ActionButtonProps) {
  const reduced = useReducedMotion();
  const base =
    tone === "primary"
      ? "bg-paper text-ink border-gold hover:bg-gold-bright"
      : "bg-transparent text-paper border-paper/40 hover:border-paper";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: reduced ? 0 : -2 }}
      whileTap={disabled ? undefined : { scale: reduced ? 1 : 0.97 }}
      className={
        "relative inline-flex items-center gap-3 px-6 py-2.5 border-2 tracking-widest text-sm disabled:opacity-40 disabled:cursor-not-allowed " +
        base
      }
      style={{ fontFamily: "var(--font-body)", fontWeight: 700 }}
    >
      <KeyCap
        label={keyLabel}
        size="sm"
        tone={tone === "primary" ? "dark" : "dark"}
      />
      <span>{children}</span>
    </motion.button>
  );
}

function JudgingOverlay() {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/70 backdrop-blur-sm pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="absolute inset-0 bg-paper"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: reduced ? 0 : 0.55, times: [0, 0.15, 1] }}
      />
      <div className="relative text-center">
        <motion.div
          className="text-gold-bright text-xs tracking-[0.6em]"
          style={{ fontFamily: "var(--font-mono)" }}
          animate={reduced ? undefined : { opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        >
          ── JUDGING ──
        </motion.div>
        <div
          className="text-paper text-3xl sm:text-4xl mt-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          判 定 中
          <motion.span
            className="inline-block"
            animate={reduced ? undefined : { opacity: [0, 1, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            ‧‧‧
          </motion.span>
        </div>
      </div>
    </motion.div>
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

const verdictHeadline = (v: "fail" | "success" | "perfect"): string => {
  switch (v) {
    case "perfect":
      return "完璧";
    case "success":
      return "成功";
    case "fail":
      return "国旗損壊罪";
  }
};

const verdictMessage = (v: "fail" | "success" | "perfect"): string => {
  switch (v) {
    case "perfect":
      return "あなたこそが真の日本国民です！！";
    case "success":
      return "あなたは真の愛国者です！！";
    case "fail":
      return "あなたのもとに警察がやってきました……";
  }
};

const verdictColor = (v: "fail" | "success" | "perfect"): string => {
  switch (v) {
    case "perfect":
      return "vargold-bright";
    case "success":
      return "varpaper";
    case "fail":
      return "varhinomaru-bright";
  }
};

function ResultPanel({
  breakdown,
  detected,
  verdict,
  onRetry,
}: ResultPanelProps) {
  const reduced = useReducedMotion();
  const shake =
    verdict === "fail" && !reduced
      ? {
          x: [0, -8, 7, -6, 5, -3, 0],
        }
      : { x: 0 };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 pointer-events-none">
      {verdict === "fail" && (
        <div className="fixed inset-0 z-10 pointer-events-none flag-flash" />
      )}
      {verdict === "perfect" && <Confetti />}
      <motion.div
        className="fixed inset-0 bg-ink/75 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        aria-hidden
      />
      <motion.div
        className="relative z-20 w-full max-w-md pointer-events-auto"
        initial={reduced ? { opacity: 0 } : { y: 32, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1, ...shake }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{
          type: "spring",
          stiffness: 220,
          damping: 22,
          x: { duration: 0.55 },
        }}
      >
        <DialogBox>
          <VerdictStamp verdict={verdict} />
          <motion.p
            className="text-center text-base sm:text-lg mt-1"
            style={{ fontFamily: "var(--font-body)", fontWeight: 700 }}
            initial={reduced ? false : { y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: reduced ? 0 : 0.5, duration: 0.35 }}
          >
            {verdictMessage(verdict)}
          </motion.p>

          <motion.div
            className="my-5 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, varink/40, transparent)",
            }}
            initial={reduced ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: reduced ? 0 : 0.55, duration: 0.4 }}
            aria-hidden
          />

          <motion.div
            className="space-y-3"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduced ? 0 : 0.6, duration: 0.3 }}
          >
            <ScoreBar label="中心" value={breakdown.center}>
              {detected !== null && (
                <SubRow
                  label="重心のキャンバス中央からの差分"
                  value={`(${fmtSigned(detected.cx - CANVAS_W / 2)}, ${fmtSigned(detected.cy - CANVAS_H / 2)})`}
                />
              )}
            </ScoreBar>
            <ScoreBar label="直径" value={breakdown.diameter}>
              {detected !== null && (
                <SubRow
                  label="検出された直径比率"
                  value={`${diameterRatio5(detected.r, CANVAS_H).toFixed(1)} : 5`}
                />
              )}
            </ScoreBar>
            <ScoreBar label="真円度" value={breakdown.circle}>
              <SubRow
                label="円からはみ出た割合"
                value={fmtPercent(breakdown.circleDetail.overflowRatio)}
              />
              <SubRow
                label="円から不足した割合"
                value={fmtPercent(breakdown.circleDetail.shortfallRatio)}
              />
            </ScoreBar>
          </motion.div>

          <motion.div
            className="mt-5 pt-4 border-t-2 border-dashed border-ink/30 flex items-baseline justify-between"
            initial={reduced ? false : { y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: reduced ? 0 : 1.2, duration: 0.35 }}
          >
            <span
              className="text-sm tracking-[0.3em] text-ink/70"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              総 合
            </span>
            <div className="flex items-baseline gap-2">
              <CountUp
                target={breakdown.total}
                duration={reduced ? 0 : 1.1}
                delay={reduced ? 0 : 1.3}
                className="text-5xl"
                style={{
                  fontFamily: "var(--font-display)",
                  color: verdictColor(verdict),
                }}
              />
              <span
                className="text-base text-ink/70"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                / 100
              </span>
            </div>
          </motion.div>

          {verdict === "perfect" && (
            <motion.div
              className="aspect-video mt-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 1.8, duration: 0.4 }}
            >
              <iframe
                title="君が代"
                src="https://www.youtube.com/embed/8kFWwuiUdT4?autoplay=1"
                allow="autoplay; encrypted-media"
                className="w-full h-full"
              />
            </motion.div>
          )}

          <motion.div
            className="mt-5 flex justify-center"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 1.55, duration: 0.3 }}
          >
            <motion.button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-3 px-6 py-2.5 bg-ink text-paper tracking-widest border-2 border-gold hover:bg-hinomaru transition"
              style={{ fontFamily: "var(--font-body)", fontWeight: 700 }}
              whileHover={{ scale: reduced ? 1 : 1.04 }}
              whileTap={{ scale: reduced ? 1 : 0.97 }}
            >
              <KeyCap label="Enter" size="sm" tone="dark" />
              <span>もう一度</span>
              <motion.span
                aria-hidden
                animate={reduced ? undefined : { x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                ▶
              </motion.span>
            </motion.button>
          </motion.div>
        </DialogBox>
      </motion.div>
    </div>
  );
}

function VerdictStamp({
  verdict,
}: {
  readonly verdict: "fail" | "success" | "perfect";
}) {
  const reduced = useReducedMotion();
  const label = verdictHeadline(verdict);
  const border =
    verdict === "perfect" ? "vargold-bright" : verdictColor(verdict);
  return (
    <div className="relative h-24 flex items-center justify-center">
      <div
        className="absolute text-[0.6rem] tracking-[0.4em] text-ink/40 -top-1"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        ── VERDICT ──
      </div>
      <motion.div
        className="relative inline-flex items-center justify-center"
        initial={
          reduced ? { opacity: 0 } : { scale: 2.2, rotate: -12, opacity: 0 }
        }
        animate={{ scale: 1, rotate: -8, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 600,
          damping: 18,
          delay: reduced ? 0 : 0.15,
        }}
      >
        <div
          className="relative px-6 sm:px-8 py-2"
          style={{
            border: `4px double ${border}`,
            color: border,
            fontFamily: "var(--font-display)",
            letterSpacing: "0.3em",
          }}
        >
          <span className="text-4xl sm:text-5xl">{label}</span>
          <span
            className="absolute -top-3 -right-3 text-[0.55rem] px-1.5 py-0.5 bg-ink text-paper"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {verdict === "perfect" ? "S+" : verdict === "success" ? "A" : "F"}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

type CountUpProps = {
  readonly target: number;
  readonly duration: number;
  readonly delay: number;
  readonly className?: string;
  readonly style?: React.CSSProperties;
};

function CountUp({ target, duration, delay, className, style }: CountUpProps) {
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => Math.round(v).toString());
  useEffect(() => {
    if (duration === 0) {
      value.set(target);
      return;
    }
    const controls = animate(value, target, {
      duration,
      delay,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [target, duration, delay, value]);
  return (
    <motion.span className={className} style={style}>
      {text}
    </motion.span>
  );
}

type ScoreBarProps = {
  readonly label: string;
  readonly value: number;
  readonly children?: React.ReactNode;
};

function ScoreBar({ label, value, children }: ScoreBarProps) {
  const reduced = useReducedMotion();
  const rounded = Math.round(value);
  const widthPct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span
          className="text-xs tracking-[0.3em] text-ink/80"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {label}
        </span>
        <span
          className="text-ink"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem" }}
        >
          <CountUp
            target={rounded}
            duration={reduced ? 0 : 0.7}
            delay={reduced ? 0 : 0.7}
          />
          <span
            className="ml-1 text-xs text-ink/60"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            / 100
          </span>
        </span>
      </div>
      <div className="mt-1 h-1.5 bg-ink/10 relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-hinomaru"
          initial={reduced ? { width: `${widthPct}%` } : { width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{
            delay: reduced ? 0 : 0.7,
            duration: reduced ? 0 : 0.7,
            ease: "easeOut",
          }}
        />
      </div>
      {children && <div className="mt-1.5 space-y-0.5">{children}</div>}
    </div>
  );
}

function SubRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="pl-2 flex justify-between text-[0.7rem] text-ink/60">
      <span>└ {label}</span>
      <span style={{ fontFamily: "var(--font-mono)" }}>{value}</span>
    </div>
  );
}

function Confetti() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const pieces = Array.from({ length: 30 }, (_, i) => i);
  return (
    <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
      {pieces.map((i) => {
        const left = (i * 97) % 100;
        const delay = (i % 10) * 0.12;
        const dur = 2.6 + ((i * 31) % 100) / 70;
        const colors = ["vargold-bright", "varhinomaru-bright", "varpaper"];
        const color = colors[i % colors.length];
        const size = 6 + (i % 4) * 3;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "-20px",
              left: `${left}%`,
              width: `${size}px`,
              height: `${size * 0.4}px`,
              backgroundColor: color,
              animation: `confetti-fall ${dur}s ${delay}s ease-in infinite`,
              transform: "rotate(0deg)",
            }}
          />
        );
      })}
    </div>
  );
}

export default App;
