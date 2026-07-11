import { useEffect, useRef, useState } from "react";

/**
 * Debounce a changing value. Consumers re-render with the trailing value
 * `delayMs` after the last change — used to keep parse+layout off the
 * per-keystroke path.
 *
 * `resetKey` (e.g. the active document id) bypasses the delay: when it
 * changes the new value propagates on the same render, so switching tabs
 * never shows a stale diagram.
 */
export function useDebouncedValue<T>(value: T, delayMs = 150, resetKey?: unknown): T {
  const [debounced, setDebounced] = useState(value);
  const prevResetKeyRef = useRef(resetKey);

  // Render-phase reset (the officially supported "adjust state during render"
  // pattern): React re-renders immediately with the new value, before effects.
  if (prevResetKeyRef.current !== resetKey) {
    prevResetKeyRef.current = resetKey;
    setDebounced(value);
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
