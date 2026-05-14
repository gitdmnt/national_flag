import { describe, expect, test } from "bun:test";
import { hintsForPhase, keyToAction, type Phase } from "./keybindings";

describe("hintsForPhase", () => {
  test("briefing returns next + skip", () => {
    const hints = hintsForPhase("briefing");
    const actions = hints.map((h) => h.action);
    expect(actions).toContain("next");
    expect(actions).toContain("skip");
  });

  test("playing returns three brush actions, submit, reset", () => {
    const hints = hintsForPhase("playing");
    const actions = hints.map((h) => h.action);
    expect(actions).toContain("brush_small");
    expect(actions).toContain("brush_medium");
    expect(actions).toContain("brush_large");
    expect(actions).toContain("submit");
    expect(actions).toContain("reset");
  });

  test("result returns retry and back", () => {
    const hints = hintsForPhase("result");
    const actions = hints.map((h) => h.action);
    expect(actions).toContain("retry");
    expect(actions).toContain("back");
  });

  test("judging returns empty", () => {
    expect(hintsForPhase("judging")).toEqual([]);
  });

  test.each<Phase>(["briefing", "playing", "result"])(
    "%s hints expose non-empty key labels and human labels",
    (phase) => {
      for (const h of hintsForPhase(phase)) {
        expect(h.keyLabel.length).toBeGreaterThan(0);
        expect(h.label.length).toBeGreaterThan(0);
      }
    },
  );
});

describe("keyToAction", () => {
  test("Enter submits in playing", () => {
    expect(keyToAction("Enter", "playing")).toBe("submit");
  });

  test("r and R both reset in playing", () => {
    expect(keyToAction("r", "playing")).toBe("reset");
    expect(keyToAction("R", "playing")).toBe("reset");
  });

  test("digit keys switch brush in playing", () => {
    expect(keyToAction("1", "playing")).toBe("brush_small");
    expect(keyToAction("2", "playing")).toBe("brush_medium");
    expect(keyToAction("3", "playing")).toBe("brush_large");
  });

  test("Enter advances in briefing, Space advances too, Escape skips", () => {
    expect(keyToAction("Enter", "briefing")).toBe("next");
    expect(keyToAction(" ", "briefing")).toBe("next");
    expect(keyToAction("Escape", "briefing")).toBe("skip");
  });

  test("Enter retries in result", () => {
    expect(keyToAction("Enter", "result")).toBe("retry");
  });

  test("b and B return back in result", () => {
    expect(keyToAction("b", "result")).toBe("back");
    expect(keyToAction("B", "result")).toBe("back");
  });

  test("judging ignores all input", () => {
    expect(keyToAction("Enter", "judging")).toBeNull();
    expect(keyToAction("1", "judging")).toBeNull();
    expect(keyToAction("Escape", "judging")).toBeNull();
  });

  test("unknown keys return null", () => {
    expect(keyToAction("x", "playing")).toBeNull();
    expect(keyToAction("F1", "briefing")).toBeNull();
  });
});
