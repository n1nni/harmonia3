import type { NoteData, NoteType, StemDir, ScoreLayout } from '../types';

// ─── Page / layout constants (from scores.json defaults) ─────────────────────
const PAGE_W = 1365;
const PAGE_H = 1922;
const LEFT_MARGIN = 130;
const TOP_MARGIN = 97;

// Staff height is always 40 tenths (4 staff-spaces × 10 tenths each)
const STAFF_H = 40;

/**
 * Staff top-Y positions (in tenths from page top) for each part × system.
 *
 * System 1 (measures 1–4):
 *   P1 top = TOP_MARGIN + top-system-distance  = 97 + 236 = 333
 *   P2 top = P1-bottom + staff-distance(P2)    = 373 + 72  = 445
 *   P3 top = P2-bottom + staff-distance(P3)    = 485 + 71  = 556
 *
 * System 2 (measures 5–8):
 *   P1 top = P3(sys1)-bottom + system-distance = 596 + 189 = 785
 *   P2 top = P1-bottom + staff-distance(P2)    = 825 + 72  = 897
 *   P3 top = P2-bottom + staff-distance(P3)    = 937 + 71  = 1008
 */
const STAFF_TOPS: readonly [readonly number[], readonly number[]] = [
  [333, 445, 556], // system 1: [P1, P2, P3]
  [785, 897, 1008], // system 2: [P1, P2, P3]
] as const;

/** Cumulative measure-start x positions per system (in tenths from page left). */
const MEASURE_WIDTHS = [292, 226, 295, 293, 378, 306, 340, 83];

// Measures 1–4 → system 0 (indices 0-3), measures 5–8 → system 1 (indices 4-7)
const SYS_OF_MEASURE = (i: number) => (i < 4 ? 0 : 1);

function measureStartX(measureIdx: number): number {
  const sysStart = measureIdx < 4 ? 0 : 4;
  const cumW = MEASURE_WIDTHS.slice(sysStart, measureIdx).reduce((a, b) => a + b, 0);
  return LEFT_MARGIN + cumW;
}

// ─── Pitch → staff-Y-offset mapping ──────────────────────────────────────────
const STEP_NUM: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
};

/**
 * Returns the Y offset (in tenths, positive = DOWN) of the note-head centre
 * relative to the staff top line.
 *
 *  Parts 1 & 2  →  G clef  clef-octave-change=-1  (octave / 8vb treble)
 *    Reference: G3 sits on staff line 2 (from bottom) = 30 tenths below top
 *    Formula:   yOffset = 155 − 5 × pitchNum    where pitchNum = octave×7 + stepNum
 *
 *  Part 3  →  F clef on line 4  (bass clef)
 *    Reference: F3 sits on staff line 4 (from bottom) = 10 tenths below top
 *    Formula:   yOffset = 130 − 5 × pitchNum
 */
function pitchToYOffset(step: string, octave: number, partIndex: number): number {
  const p = octave * 7 + STEP_NUM[step];
  return partIndex === 2
    ? 130 - 5 * p  // bass clef
    : 155 - 5 * p; // octave treble
}

// ─── Deterministic mock confidence ──────────────────────────────────────────
/**
 * Returns a plausible OMR confidence in [0.52, 1.00].
 * Uses a hash-like formula so the same note always gets the same value.
 */
function mockConfidence(partIdx: number, measureIdx: number, noteIdx: number): number {
  const seed = partIdx * 1000 + measureIdx * 100 + noteIdx;
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  const r = x - Math.floor(x); // uniform [0, 1)
  // Skew toward higher values: most notes correctly recognised
  return 0.52 + 0.48 * Math.pow(r, 0.55);
}

// ─── JSON shape (minimal) ────────────────────────────────────────────────────
interface RawPitch {
  step: string;
  octave: string;
  alter?: string;
}

interface RawStem {
  __text?: string;
  _default_y?: string;
}

interface RawNote {
  pitch?: RawPitch;
  rest?: unknown;
  type?: string;
  stem?: RawStem;
  chord?: unknown;
  _default_x?: string;
  // Finale XML-to-JSON uses "_attribute" keys with hyphens, but the actual
  // keys depend on the converter. We handle both underscore and original.
  [key: string]: unknown;
}

interface RawMeasure {
  note?: RawNote | RawNote[];
  _number?: string;
  _width?: string;
  [key: string]: unknown;
}

interface RawPart {
  measure?: RawMeasure | RawMeasure[];
  [key: string]: unknown;
}

interface RawScore {
  'score-partwise'?: {
    part?: RawPart | RawPart[];
    [key: string]: unknown;
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────
export interface ParseResult {
  notes: NoteData[];
  layout: ScoreLayout;
}

export function parseScore(json: RawScore): ParseResult {
  const partwise = json['score-partwise'];
  if (!partwise) throw new Error('Not a score-partwise JSON');

  const rawParts = toArray(partwise.part);
  const notes: NoteData[] = [];

  rawParts.forEach((part, partIdx) => {
    const measures = toArray(part.measure);

    measures.forEach((measure, measureIdx) => {
      const mNum = String((measure as { _number?: string })._number ?? measureIdx + 1);
      const mStartX = measureStartX(measureIdx);
      const sysIdx = SYS_OF_MEASURE(measureIdx);
      const staffTop = STAFF_TOPS[sysIdx][partIdx];

      const rawNotes = toArray((measure as { note?: RawNote | RawNote[] }).note);

      rawNotes.forEach((rawNote, noteIdx) => {
        if (!rawNote || rawNote.rest !== undefined) return; // skip rests

        const pitch = rawNote.pitch;
        if (!pitch) return;

        const step = String(pitch.step ?? 'C').toUpperCase();
        const octave = Number(pitch.octave ?? 4);
        const alter = pitch.alter != null ? Number(pitch.alter) : 0;

        const noteType = normaliseNoteType(String(rawNote.type ?? 'quarter'));

        // x: note attribute uses key _default-x (hyphen) in the source JSON
        const noteX = Number(
          rawNote['_default-x'] ??
          rawNote._default_x ??
          0
        );

        // stem direction
        const stemObj = rawNote.stem as (RawStem & Record<string, unknown>) | undefined;
        const stemText = String(stemObj?.__text ?? stemObj?.['__text'] ?? '').toLowerCase();
        const stemDir: StemDir =
          noteType === 'whole'
            ? 'none'
            : stemText === 'up'
              ? 'up'
              : stemText === 'down'
                ? 'down'
                : 'none';

        const yOffset = pitchToYOffset(step, octave, partIdx);
        const absX = mStartX + noteX;
        const absY = staffTop + yOffset;

        notes.push({
          id: `p${partIdx}-m${mNum}-n${noteIdx}`,
          step,
          octave,
          alter,
          noteType,
          absX,
          absY,
          stemDir,
          confidence: mockConfidence(partIdx, measureIdx, noteIdx),
          partIndex: partIdx,
          measureNum: mNum,
          isRest: false,
        });
      });
    });
  });

  return {
    notes,
    layout: { pageWidth: PAGE_W, pageHeight: PAGE_H },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function normaliseNoteType(raw: string): NoteType {
  const map: Record<string, NoteType> = {
    whole: 'whole',
    half: 'half',
    quarter: 'quarter',
    eighth: 'eighth',
    '16th': '16th',
    '32nd': '32nd',
    '64th': '64th',
  };
  return map[raw] ?? 'quarter';
}

// Re-export layout constants for canvas renderer
export { PAGE_W, PAGE_H, STAFF_H, TOP_MARGIN, LEFT_MARGIN };
