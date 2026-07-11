// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 150));
    expect(result.current).toBe("a");
  });

  it("propagates a change only after the delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 150),
      { initialProps: { value: "a" } }
    );
    rerender({ value: "b" });
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(149));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("b");
  });

  it("coalesces rapid changes to the trailing value", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 150),
      { initialProps: { value: "a" } }
    );
    for (const value of ["b", "c", "d"]) {
      rerender({ value });
      act(() => vi.advanceTimersByTime(50));
    }
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(150));
    expect(result.current).toBe("d");
  });

  it("bypasses the delay when resetKey changes (tab switch)", () => {
    const { result, rerender } = renderHook(
      ({ value, key }) => useDebouncedValue(value, 150, key),
      { initialProps: { value: "doc1 content", key: "doc1" } }
    );
    rerender({ value: "doc2 content", key: "doc2" });
    expect(result.current).toBe("doc2 content");
  });

  it("cleans up the pending timer on unmount", () => {
    const { rerender, unmount } = renderHook(
      ({ value }) => useDebouncedValue(value, 150),
      { initialProps: { value: "a" } }
    );
    rerender({ value: "b" });
    unmount();
    expect(() => vi.runAllTimers()).not.toThrow();
  });
});
