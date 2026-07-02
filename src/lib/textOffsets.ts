// The Rust DBML parser reports spans as UTF-8 byte offsets, while CodeMirror
// (and JS strings generally) measure positions in UTF-16 code units. Any
// non-ASCII character before a span makes the two disagree, so offsets must be
// converted at the boundary. Both conversions run in O(offset).

function codePointLengths(cp: number): { utf8: number; utf16: number } {
  if (cp <= 0x7f) return { utf8: 1, utf16: 1 };
  if (cp <= 0x7ff) return { utf8: 2, utf16: 1 };
  if (cp <= 0xffff) return { utf8: 3, utf16: 1 };
  return { utf8: 4, utf16: 2 };
}

/** Convert a UTF-16 code-unit offset into `text` to a UTF-8 byte offset. */
export function utf16ToUtf8Offset(text: string, utf16Offset: number): number {
  const end = Math.min(Math.max(utf16Offset, 0), text.length);
  let bytes = 0;
  let i = 0;
  while (i < end) {
    const cp = text.codePointAt(i)!;
    const len = codePointLengths(cp);
    bytes += len.utf8;
    i += len.utf16;
  }
  return bytes;
}

/** Convert a UTF-8 byte offset into `text` to a UTF-16 code-unit offset. */
export function utf8ToUtf16Offset(text: string, utf8Offset: number): number {
  let bytes = 0;
  let i = 0;
  while (i < text.length && bytes < utf8Offset) {
    const cp = text.codePointAt(i)!;
    const len = codePointLengths(cp);
    bytes += len.utf8;
    i += len.utf16;
  }
  return i;
}
