export const TABLE_WIDTH = 260;
export const HEADER_HEIGHT = 36;
export const ROW_HEIGHT = 28;
export const TABLE_PADDING = 4;
export const TABLE_BORDER_RADIUS = 6;

export const NODE_SEP = 60;
export const RANK_SEP = 80;
export const MARGIN_X = 40;
export const MARGIN_Y = 40;

// Below this zoom scale, column text is unreadable (<5px): tables render as
// simple boxes (render-only LOD; layout geometry is untouched).
export const LOD_BOX_SCALE = 0.4;

// Sticky notes
export const NOTE_WIDTH = 240;
export const NOTE_LINE_HEIGHT = 18;
export const NOTE_PADDING = 12;
// Approx advance width of the 11px monospace body font; slightly over-estimated
// so wrapped lines never overflow the note box.
export const NOTE_CHAR_WIDTH = 7;
