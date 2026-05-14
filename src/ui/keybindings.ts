export type Phase = "briefing" | "playing" | "judging" | "result";

export type Action =
  | "next"
  | "skip"
  | "brush_small"
  | "brush_medium"
  | "brush_large"
  | "submit"
  | "reset"
  | "retry";

export type KeyHint = {
  readonly keyLabel: string;
  readonly label: string;
  readonly action: Action;
};

const BRIEFING_HINTS: readonly KeyHint[] = [
  { keyLabel: "Enter", label: "次へ", action: "next" },
  { keyLabel: "Esc", label: "スキップ", action: "skip" },
];

const PLAYING_HINTS: readonly KeyHint[] = [
  { keyLabel: "1", label: "ジェット", action: "brush_small" },
  { keyLabel: "2", label: "セミワイド", action: "brush_medium" },
  { keyLabel: "3", label: "ワイド", action: "brush_large" },
  { keyLabel: "Enter", label: "提出", action: "submit" },
  { keyLabel: "R", label: "やり直し", action: "reset" },
];

const RESULT_HINTS: readonly KeyHint[] = [
  { keyLabel: "Enter", label: "もう一度", action: "retry" },
];

export const hintsForPhase = (phase: Phase): readonly KeyHint[] => {
  switch (phase) {
    case "briefing":
      return BRIEFING_HINTS;
    case "playing":
      return PLAYING_HINTS;
    case "result":
      return RESULT_HINTS;
    case "judging":
      return [];
  }
};

export const keyToAction = (key: string, phase: Phase): Action | null => {
  if (phase === "judging") return null;
  const k = key.length === 1 ? key.toLowerCase() : key;

  if (phase === "briefing") {
    if (k === "enter" || key === "Enter") return "next";
    if (k === " ") return "next";
    if (key === "Escape") return "skip";
    return null;
  }

  if (phase === "playing") {
    if (key === "Enter") return "submit";
    if (k === "r") return "reset";
    if (k === "1") return "brush_small";
    if (k === "2") return "brush_medium";
    if (k === "3") return "brush_large";
    return null;
  }

  if (phase === "result") {
    if (key === "Enter") return "retry";
    return null;
  }

  return null;
};
