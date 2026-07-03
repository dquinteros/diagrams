/**
 * Return the final path segment (file name) from a full path, handling both
 * POSIX (`/`) and Windows (`\`) separators. Tauri returns native paths, so on
 * Windows a plain `split("/")` would leave the whole path intact.
 */
export function basename(path: string): string {
  const segments = path.split(/[/\\]/);
  // Ignore a trailing separator (e.g. "C:\dir\") by taking the last non-empty.
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i]) return segments[i];
  }
  return path;
}
