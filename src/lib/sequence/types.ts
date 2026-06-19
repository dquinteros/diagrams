// Intermediate representation for sequence diagrams (parsed from the DSL).

export type ArrowKind =
  | "solid-arrow" // ->>
  | "dashed-arrow" // -->>
  | "solid-open" // ->
  | "dashed-open" // -->
  | "cross"; // -x / --x

export interface SeqParticipant {
  id: string;
  label: string;
  isActor: boolean;
}

export type SeqEvent =
  | {
      kind: "message";
      from: string;
      to: string;
      text: string;
      arrow: ArrowKind;
      activate: boolean; // activate target after the message
      deactivate: boolean; // deactivate source after the message
    }
  | { kind: "activate"; participant: string }
  | { kind: "deactivate"; participant: string }
  | {
      kind: "note";
      position: "over" | "left" | "right";
      participants: string[];
      text: string;
    }
  | { kind: "fragment-start"; fragType: string; label: string }
  | { kind: "fragment-else"; label: string }
  | { kind: "fragment-end" };

export interface SequenceIR {
  participants: SeqParticipant[];
  events: SeqEvent[];
}

export interface ParseError {
  message: string;
  line: number;
}

export interface SequenceParseResult {
  ir: SequenceIR;
  error: ParseError | null;
}
