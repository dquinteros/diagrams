import type { ArrowKind, SequenceIR } from "./types";

const COL_W = 170;
const MARGIN_X = 30;
const HEADER_TOP = 16;
const HEADER_H = 36;
const HEADER_W = 130;
const TOP_GAP = 34;
const ROW_H = 46;
const SELF_EXTRA = 18;
const BOTTOM_MARGIN = 30;
const NOTE_LINE_H = 16;
const NOTE_PAD = 8;
const ACT_W = 10;
const FRAG_HEADER = 40; // gap below a fragment header before its first content
const FRAG_ELSE_GAP = 30; // gap below an `else` divider before its first content
const FRAG_PAD = 10;
const CHAR_W = 7;

export interface SeqLayoutParticipant {
  id: string;
  label: string;
  isActor: boolean;
  cx: number;
}

export interface SeqLayoutMessage {
  from: string;
  to: string;
  x1: number;
  x2: number;
  y: number;
  text: string;
  arrow: ArrowKind;
  self: boolean;
}

export interface SeqLayoutNote {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
}

export interface SeqLayoutActivation {
  id: string;
  x: number;
  y1: number;
  y2: number;
}

export interface SeqLayoutFragment {
  x: number;
  y: number;
  w: number;
  h: number;
  fragType: string;
  label: string;
  elses: { y: number; label: string }[];
}

export interface SeqLayout {
  width: number;
  height: number;
  lifelineTop: number;
  lifelineBottom: number;
  participants: SeqLayoutParticipant[];
  messages: SeqLayoutMessage[];
  notes: SeqLayoutNote[];
  activations: SeqLayoutActivation[];
  fragments: SeqLayoutFragment[];
}

export function layoutSequence(ir: SequenceIR): SeqLayout {
  const participants: SeqLayoutParticipant[] = ir.participants.map((p, i) => ({
    id: p.id,
    label: p.label,
    isActor: p.isActor,
    cx: MARGIN_X + COL_W / 2 + i * COL_W,
  }));
  const cxOf = (id: string) => participants.find((p) => p.id === id)?.cx ?? MARGIN_X;

  const lifelineTop = HEADER_TOP + HEADER_H;
  let y = lifelineTop + TOP_GAP;

  const messages: SeqLayoutMessage[] = [];
  const notes: SeqLayoutNote[] = [];
  const activations: SeqLayoutActivation[] = [];
  const fragments: SeqLayoutFragment[] = [];

  // Activation stacks per participant (for nested activation rectangles).
  const actStacks = new Map<string, number[]>();
  const pushAct = (id: string) => {
    const s = actStacks.get(id) ?? [];
    s.push(y);
    actStacks.set(id, s);
  };
  const popAct = (id: string) => {
    const s = actStacks.get(id);
    if (!s || s.length === 0) return;
    const y1 = s.pop()!;
    activations.push({ id, x: cxOf(id), y1, y2: y });
  };

  // Open fragment frames.
  const fragStack: { startY: number; fragType: string; label: string; elses: { y: number; label: string }[] }[] = [];

  for (const ev of ir.events) {
    switch (ev.kind) {
      case "message": {
        const self = ev.from === ev.to;
        if (ev.activate) pushAct(ev.to);
        messages.push({
          from: ev.from,
          to: ev.to,
          x1: cxOf(ev.from),
          x2: cxOf(ev.to),
          y,
          text: ev.text,
          arrow: ev.arrow,
          self,
        });
        if (ev.deactivate) popAct(ev.from);
        y += self ? ROW_H + SELF_EXTRA : ROW_H;
        break;
      }
      case "activate":
        pushAct(ev.participant);
        break;
      case "deactivate":
        popAct(ev.participant);
        break;
      case "note": {
        const lines = ev.text.split("\\n");
        const textW = Math.max(60, ...lines.map((l) => l.length * CHAR_W)) + NOTE_PAD * 2;
        const h = lines.length * NOTE_LINE_H + NOTE_PAD * 2;
        let x: number;
        let w: number;
        if (ev.position === "over") {
          const xs = ev.participants.map(cxOf);
          const min = Math.min(...xs);
          const max = Math.max(...xs);
          w = Math.max(textW, max - min + HEADER_W);
          x = (min + max) / 2 - w / 2;
        } else {
          const c = cxOf(ev.participants[0] ?? "");
          w = textW;
          x = ev.position === "left" ? c - COL_W / 2 - w : c + COL_W / 2;
        }
        notes.push({ x, y, w, h, lines });
        y += h + 12;
        break;
      }
      case "fragment-start":
        fragStack.push({ startY: y, fragType: ev.fragType, label: ev.label, elses: [] });
        y += FRAG_HEADER;
        break;
      case "fragment-else": {
        const top = fragStack[fragStack.length - 1];
        if (top) top.elses.push({ y, label: ev.label });
        y += FRAG_ELSE_GAP;
        break;
      }
      case "fragment-end": {
        const frag = fragStack.pop();
        if (frag) {
          const minX = MARGIN_X;
          const maxX = participants.length
            ? participants[participants.length - 1].cx + COL_W / 2
            : MARGIN_X + COL_W;
          fragments.push({
            x: minX,
            y: frag.startY,
            w: maxX - minX,
            h: y - frag.startY + FRAG_PAD,
            fragType: frag.fragType,
            label: frag.label,
            elses: frag.elses,
          });
          y += FRAG_PAD * 2;
        }
        break;
      }
    }
  }

  // Close any activations left open.
  for (const id of actStacks.keys()) {
    const s = actStacks.get(id)!;
    while (s.length) {
      const y1 = s.pop()!;
      activations.push({ id, x: cxOf(id), y1, y2: y });
    }
  }

  const height = y + BOTTOM_MARGIN;

  // Notes placed left of the first participant can extend into negative x and
  // notes right of the last one past the participant-based width; shift all
  // geometry right so nothing starts before MARGIN_X, then grow the width to
  // cover the rightmost note.
  const minNoteX = notes.length ? Math.min(...notes.map((n) => n.x)) : Infinity;
  const shift = minNoteX < MARGIN_X ? MARGIN_X - minNoteX : 0;
  const shiftedParticipants = shift
    ? participants.map((p) => ({ ...p, cx: p.cx + shift }))
    : participants;
  const shiftedMessages = shift
    ? messages.map((m) => ({ ...m, x1: m.x1 + shift, x2: m.x2 + shift }))
    : messages;
  const shiftedNotes = shift ? notes.map((n) => ({ ...n, x: n.x + shift })) : notes;
  const shiftedActivations = shift
    ? activations.map((a) => ({ ...a, x: a.x + shift }))
    : activations;
  const shiftedFragments = shift
    ? fragments.map((f) => ({ ...f, x: f.x + shift }))
    : fragments;

  const participantWidth = shiftedParticipants.length
    ? shiftedParticipants[shiftedParticipants.length - 1].cx + COL_W / 2 + MARGIN_X
    : MARGIN_X * 2 + COL_W;
  const maxNoteRight = shiftedNotes.length
    ? Math.max(...shiftedNotes.map((n) => n.x + n.w))
    : 0;
  const width = Math.max(participantWidth, maxNoteRight + MARGIN_X);

  return {
    width,
    height,
    lifelineTop,
    lifelineBottom: height - BOTTOM_MARGIN / 2,
    participants: shiftedParticipants,
    messages: shiftedMessages,
    notes: shiftedNotes,
    activations: shiftedActivations,
    fragments: shiftedFragments,
  };
}

export const SEQ_CONSTANTS = { HEADER_TOP, HEADER_H, HEADER_W, ACT_W };
