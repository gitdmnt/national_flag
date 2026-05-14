import { useEffect } from "react";
import { keyToAction, type Action, type Phase } from "./keybindings";

export const useKeyBindings = (
  phase: Phase,
  handler: (action: Action) => void,
): void => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      const action = keyToAction(e.key, phase);
      if (action === null) return;
      e.preventDefault();
      handler(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, handler]);
};
