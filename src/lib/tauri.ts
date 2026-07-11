// Runtime detection for the Tauri desktop shell.
//
// Backend features (DBML parsing, file I/O, SQL generation) are Rust commands
// reached over Tauri's IPC bridge. In a plain browser that bridge is absent, so
// `invoke` throws "Cannot read properties of undefined (reading 'invoke')".
// Guard call sites with `isTauri()` to degrade gracefully instead.

/** True when running inside the Tauri desktop runtime (vs a plain browser). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
