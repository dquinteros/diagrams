import type {
  ArrowKind,
  SeqEvent,
  SeqParticipant,
  SequenceIR,
  SequenceParseResult,
} from "./types";

// Arrow tokens, longest-first so "-->>" matches before "->" etc.
const ARROWS: { token: string; kind: ArrowKind }[] = [
  { token: "-->>", kind: "dashed-arrow" },
  { token: "--x", kind: "cross" },
  { token: "-->", kind: "dashed-open" },
  { token: "->>", kind: "solid-arrow" },
  { token: "-x", kind: "cross" },
  { token: "->", kind: "solid-open" },
];

const FRAGMENT_KEYWORDS = ["loop", "alt", "opt", "par", "critical", "break"];

export function parseSequence(input: string): SequenceParseResult {
  const participants: SeqParticipant[] = [];
  const byId = new Map<string, SeqParticipant>();
  const events: SeqEvent[] = [];
  let error: SequenceParseResult["error"] = null;
  let fragmentDepth = 0;

  function ensureParticipant(id: string, label?: string, isActor = false) {
    const trimmed = id.trim();
    if (!trimmed) return;
    const existing = byId.get(trimmed);
    if (existing) {
      if (label) existing.label = label;
      return;
    }
    const p: SeqParticipant = { id: trimmed, label: label ?? trimmed, isActor };
    byId.set(trimmed, p);
    participants.push(p);
  }

  const lines = input.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;
    if (/^sequenceDiagram\b/i.test(line)) continue;

    // participant / actor declaration
    const decl = /^(participant|actor)\s+(.+)$/i.exec(line);
    if (decl) {
      const isActor = decl[1].toLowerCase() === "actor";
      const rest = decl[2];
      const asMatch = /^(.+?)\s+as\s+(.+)$/i.exec(rest);
      if (asMatch) ensureParticipant(asMatch[1].trim(), asMatch[2].trim(), isActor);
      else ensureParticipant(rest.trim(), undefined, isActor);
      continue;
    }

    // activate / deactivate
    const act = /^(activate|deactivate)\s+(.+)$/i.exec(line);
    if (act) {
      const participant = act[2].trim();
      ensureParticipant(participant);
      events.push(
        act[1].toLowerCase() === "activate"
          ? { kind: "activate", participant }
          : { kind: "deactivate", participant }
      );
      continue;
    }

    // note
    const note = /^note\s+(over|left of|right of)\s+(.+)$/i.exec(line);
    if (note) {
      const posRaw = note[1].toLowerCase();
      const position = posRaw === "over" ? "over" : posRaw === "left of" ? "left" : "right";
      const afterColon = note[2].split(":");
      const targets = afterColon[0].split(",").map((s) => s.trim()).filter(Boolean);
      const text = afterColon.slice(1).join(":").trim();
      targets.forEach((t) => ensureParticipant(t));
      events.push({ kind: "note", position, participants: targets, text });
      continue;
    }

    // fragments
    const fragStart = new RegExp(`^(${FRAGMENT_KEYWORDS.join("|")})\\b(.*)$`, "i").exec(line);
    if (fragStart) {
      fragmentDepth++;
      events.push({
        kind: "fragment-start",
        fragType: fragStart[1].toLowerCase(),
        label: fragStart[2].trim(),
      });
      continue;
    }
    const elseMatch = /^else\b(.*)$/i.exec(line);
    if (elseMatch) {
      events.push({ kind: "fragment-else", label: elseMatch[1].trim() });
      continue;
    }
    if (/^end$/i.test(line)) {
      if (fragmentDepth > 0) {
        fragmentDepth--;
        events.push({ kind: "fragment-end" });
      }
      continue;
    }

    // message: <from> <arrow>[+|-] <to> : <text>
    const msg = parseMessage(line);
    if (msg) {
      ensureParticipant(msg.from);
      ensureParticipant(msg.to);
      events.push(msg);
      continue;
    }

    if (!error) error = { message: `Unrecognized line: "${line}"`, line: i + 1 };
  }

  const ir: SequenceIR = { participants, events };
  return { ir, error };
}

function parseMessage(line: string): Extract<SeqEvent, { kind: "message" }> | null {
  // Pick the arrow occurring earliest in the line so an arrow-like token in the
  // message text never wins over the real arrow. ARROWS is ordered longest-first,
  // so ties at the same index resolve to the longer token ("-->>" over "-->").
  let best: { token: string; kind: ArrowKind; idx: number } | null = null;
  for (const { token, kind } of ARROWS) {
    const idx = line.indexOf(token);
    if (idx <= 0) continue;
    if (!best || idx < best.idx) best = { token, kind, idx };
  }
  if (best) {
    const { token, kind, idx } = best;
    const from = line.slice(0, idx).trim();
    let rest = line.slice(idx + token.length);
    let activate = false;
    let deactivate = false;
    if (rest.startsWith("+")) {
      activate = true;
      rest = rest.slice(1);
    } else if (rest.startsWith("-")) {
      deactivate = true;
      rest = rest.slice(1);
    }
    const colon = rest.indexOf(":");
    const to = (colon >= 0 ? rest.slice(0, colon) : rest).trim();
    const text = colon >= 0 ? rest.slice(colon + 1).trim() : "";
    if (!from || !to) return null;
    return { kind: "message", from, to, text, arrow: kind, activate, deactivate };
  }
  return null;
}

