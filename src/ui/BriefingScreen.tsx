import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { hintsForPhase, type KeyHint, type Phase } from "./keybindings";
import { useKeyBindings } from "./useKeyBindings";

const BRIEFING_PAGES: readonly string[] = [
  "大変だ！　日本の破壊を目論む悪の共産主義者スパイ軍団が——",
  "我々の誇りであり、魂の宿り木でもある日本国旗を、真っ赤に汚してしまいました！！",
  "このままでは日本は完全に共産主義の国になり、大量の移民が押し寄せ、天皇制が廃止され、なんと夫婦まで別姓になってしまいます！！",
  "愛国者よ——ジェット水流で真っ赤に汚されたキャンバスを洗い流し、完璧な日の丸を復元せよ！",
];

type BriefingScreenProps = {
  readonly onFinish: () => void;
};

export function BriefingScreen({ onFinish }: BriefingScreenProps) {
  const [page, setPage] = useState(0);
  const reduced = useReducedMotion();
  const isLast = page === BRIEFING_PAGES.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      onFinish();
      return;
    }
    setPage((p) => p + 1);
  }, [isLast, onFinish]);

  const handleAction = useCallback(
    (action: string) => {
      if (action === "next") handleNext();
      else if (action === "skip") onFinish();
    },
    [handleNext, onFinish],
  );

  useKeyBindings("briefing", handleAction);

  return (
    <motion.div
      className="relative z-30 flex flex-col items-center w-full max-w-3xl gap-6 px-4"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.4 }}
    >
      <motion.div
        className="w-full flex items-end justify-between gap-4"
        initial={reduced ? false : { y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 220,
          damping: 22,
          delay: reduced ? 0 : 0.05,
        }}
      >
        <div className="flex items-baseline gap-3">
          <span
            className="text-[0.7rem] tracking-[0.4em] text-gold uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ── MISSION 001 ──
          </span>
          <span
            className="text-[0.65rem] tracking-[0.3em] text-silver"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            CLASSIFIED / 極秘
          </span>
        </div>
        <span
          className="text-xs tracking-widest text-silver"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {String(page + 1).padStart(2, "0")} / {String(BRIEFING_PAGES.length).padStart(2, "0")}
        </span>
      </motion.div>

      <motion.h1
        className="w-full text-center text-3xl sm:text-5xl leading-tight text-paper"
        style={{ fontFamily: "var(--font-display)" }}
        initial={reduced ? false : { y: -32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 180,
          damping: 18,
          delay: reduced ? 0 : 0.15,
        }}
      >
        <span className="text-hinomaru-bright">汚された</span>
        日の丸を
        <span className="text-gold">修復</span>せよ
      </motion.h1>

      <motion.div
        className="relative w-full"
        initial={reduced ? false : { y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 24,
          delay: reduced ? 0 : 0.3,
        }}
      >
        <DialogBox>
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[0.65rem] tracking-[0.3em] text-hinomaru"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              ▼ 本部より通信
            </span>
            <span className="text-[0.6rem] tracking-widest text-silver/70">
              {String(page + 1)} / {BRIEFING_PAGES.length}
            </span>
          </div>
          <div className="relative min-h-[7rem] sm:min-h-[8rem]">
            <AnimatePresence mode="wait">
              <motion.p
                key={page}
                initial={reduced ? false : { x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={reduced ? { opacity: 0 } : { x: -24, opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.28, ease: "easeOut" }}
                className="text-lg sm:text-xl leading-relaxed text-ink"
                style={{ fontFamily: "var(--font-body)", fontWeight: 500 }}
              >
                {BRIEFING_PAGES[page]}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <motion.button
              type="button"
              onClick={onFinish}
              className="text-xs tracking-widest px-3 py-1.5 border border-ink/30 text-ink/60 hover:text-ink hover:border-ink/70 transition"
              style={{ fontFamily: "var(--font-mono)" }}
              whileHover={{ scale: reduced ? 1 : 1.03 }}
              whileTap={{ scale: reduced ? 1 : 0.97 }}
            >
              スキップ <KeyCapInline label="Esc" tone="dark" />
            </motion.button>
            <motion.button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 bg-ink text-paper tracking-widest text-sm flex items-center gap-3 hover:bg-hinomaru transition"
              style={{ fontFamily: "var(--font-body)", fontWeight: 700 }}
              whileHover={{ scale: reduced ? 1 : 1.03 }}
              whileTap={{ scale: reduced ? 1 : 0.97 }}
            >
              <span>{isLast ? "任務開始" : "次へ"}</span>
              <KeyCapInline label="Enter" tone="light" />
              <motion.span
                animate={reduced ? undefined : { x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                aria-hidden
              >
                ▶
              </motion.span>
            </motion.button>
          </div>
        </DialogBox>
      </motion.div>

      <HintBar phase="briefing" />
    </motion.div>
  );
}

export function DialogBox({ children }: { readonly children: React.ReactNode }) {
  return (
    <div
      className="relative bg-paper text-ink p-6 sm:p-7 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]"
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(0,0,0,0.025) 0%, transparent 40%, rgba(0,0,0,0.04) 100%)",
      }}
    >
      <span className="bracket-tl" aria-hidden />
      <span className="bracket-tr" aria-hidden />
      <span className="bracket-bl" aria-hidden />
      <span className="bracket-br" aria-hidden />
      <div className="absolute left-0 right-0 top-0 h-[3px] bg-hinomaru" aria-hidden />
      <div
        className="absolute left-0 right-0 bottom-0 h-[2px] bg-ink/80"
        aria-hidden
      />
      {children}
    </div>
  );
}

export function KeyCap({
  label,
  size = "md",
  tone = "dark",
}: {
  readonly label: string;
  readonly size?: "sm" | "md";
  readonly tone?: "dark" | "light";
}) {
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[0.65rem]" : "px-2 py-0.5 text-xs";
  const colors =
    tone === "dark"
      ? "bg-ink text-gold-bright border-gold/60 shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.6),0_2px_0_0_rgba(201,169,97,0.25)]"
      : "bg-paper text-ink border-ink/30 shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.18),0_2px_0_0_rgba(0,0,0,0.35)]";
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.5rem] border tracking-widest ${padding} ${colors}`}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {label}
    </span>
  );
}

export function KeyCapInline({
  label,
  tone = "dark",
}: {
  readonly label: string;
  readonly tone?: "dark" | "light";
}) {
  return (
    <span className="inline-flex" aria-hidden>
      <KeyCap label={label} size="sm" tone={tone} />
    </span>
  );
}

export function HintBar({ phase }: { readonly phase: Phase }) {
  const hints = hintsForPhase(phase);
  if (hints.length === 0) return null;
  return (
    <motion.div
      className="w-full flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-3 py-2 border-t border-b border-gold/30 bg-ink-2/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      role="region"
      aria-label="キー操作"
    >
      {hints.map((h: KeyHint) => (
        <span
          key={h.action}
          className="inline-flex items-center gap-1.5 text-[0.7rem] tracking-widest text-paper/80"
        >
          <KeyCap label={h.keyLabel} size="sm" />
          <span style={{ fontFamily: "var(--font-body)", fontWeight: 500 }}>{h.label}</span>
        </span>
      ))}
    </motion.div>
  );
}
