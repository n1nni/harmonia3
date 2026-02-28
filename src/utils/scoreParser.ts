import type { NoteData, NoteType, StemDir, ScoreLayout, PartInfo, ClefInfo, KeyInfo, TimeInfo } from '../types';

// ─── Page / layout constants (from scores.json defaults) ─────────────────────
const PAGE_W = 1365;
const PAGE_H = 1922;
const LEFT_MARGIN = 130;
const TOP_MARGIN = 97;

// Staff height is always 40 tenths (4 staff-spaces × 10 tenths each)
const STAFF_H = 40;

/**
 * Staff top-Y positions (in tenths from page top) for each part × system.
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

function pitchToYOffset(step: string, octave: number, partIndex: number): number {
  const p = octave * 7 + STEP_NUM[step];
  return partIndex === 2
    ? 130 - 5 * p  // bass clef
    : 155 - 5 * p; // octave treble
}

// ─── Deterministic mock confidence ──────────────────────────────────────────
function mockConfidence(partIdx: number, measureIdx: number, noteIdx: number): number {
  const seed = partIdx * 1000 + measureIdx * 100 + noteIdx;
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  const r = x - Math.floor(x);
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
  [key: string]: unknown;
}

interface RawAttributes {
  divisions?: string;
  key?: { fifths?: string; mode?: string };
  time?: { beats?: string; 'beat-type'?: string; 'senza-misura'?: unknown };
  clef?: {
    sign?: string;
    line?: string;
    'clef-octave-change'?: string;
  };
  [key: string]: unknown;
}

interface RawMeasure {
  note?: RawNote | RawNote[];
  attributes?: RawAttributes;
  _number?: string;
  _width?: string;
  [key: string]: unknown;
}

interface RawPart {
  measure?: RawMeasure | RawMeasure[];
  [key: string]: unknown;
}

interface RawScorePart {
  'part-name'?: { __text?: string } | string;
  'score-instrument'?: { 'instrument-name'?: string };
  _id?: string;
  [key: string]: unknown;
}

interface RawScore {
  'score-partwise'?: {
    part?: RawPart | RawPart[];
    'part-list'?: {
      'score-part'?: RawScorePart | RawScorePart[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────
export interface ParseResult {
  notes: NoteData[];
  layout: ScoreLayout;
  parts: PartInfo[];
}

export function parseScore(json: RawScore): ParseResult {
  const partwise = json['score-partwise'];
  if (!partwise) throw new Error('Not a score-partwise JSON');

  const rawParts = toArray(partwise.part);
  const rawScoreParts = toArray(partwise['part-list']?.['score-part']);
  const notes: NoteData[] = [];
  const parts: PartInfo[] = [];

  rawParts.forEach((part, partIdx) => {
    const measures = toArray(part.measure);

    // Parse clef/key/time from the first measure's attributes
    const firstAttrs = (measures[0] as RawMeasure | undefined)?.attributes ?? {};
    const clef = parseClef(firstAttrs.clef);
    const key = parseKey(firstAttrs.key);
    const time = parseTime(firstAttrs.time);

    // Part name
    const rawSP = rawScoreParts[partIdx];
    const nameRaw = rawSP?.['part-name'];
    const name =
      typeof nameRaw === 'string'
        ? nameRaw
        : (nameRaw as { __text?: string })?.__text ??
          rawSP?.['score-instrument']?.['instrument-name'] ??
          `Part ${partIdx + 1}`;

    parts.push({
      id: rawSP?._id ?? `P${partIdx + 1}`,
      name,
      clef,
      key,
      time,
    });

    measures.forEach((measure, measureIdx) => {
      const mNum = String((measure as { _number?: string })._number ?? measureIdx + 1);
      const mStartX = measureStartX(measureIdx);
      const sysIdx = SYS_OF_MEASURE(measureIdx);
      const staffTop = STAFF_TOPS[sysIdx][partIdx];

      const rawNotes = toArray((measure as { note?: RawNote | RawNote[] }).note);

      rawNotes.forEach((rawNote, noteIdx) => {
        if (!rawNote || rawNote.rest !== undefined) return;

        const pitch = rawNote.pitch;
        if (!pitch) return;

        const step = String(pitch.step ?? 'C').toUpperCase();
        const octave = Number(pitch.octave ?? 4);
        const alter = pitch.alter != null ? Number(pitch.alter) : 0;

        const noteType = normaliseNoteType(String(rawNote.type ?? 'quarter'));

        const noteX = Number(
          rawNote['_default-x'] ??
          rawNote._default_x ??
          0
        );

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
          measureIndex: measureIdx,
          systemIndex: sysIdx,
          isRest: false,
          status: 'unreviewed',
        });
      });
    });
  });

  return {
    notes,
    layout: { pageWidth: PAGE_W, pageHeight: PAGE_H },
    parts,
  };
}

// ─── Attribute parsers ────────────────────────────────────────────────────────
function parseClef(raw: RawAttributes['clef']): ClefInfo {
  if (!raw) return { sign: 'G', line: 2, octaveChange: 0 };
  const sign = (String(raw.sign ?? 'G').toUpperCase()) as 'G' | 'F' | 'C';
  const line = Number(raw.line ?? 2);
  const octaveChange = Number(raw['clef-octave-change'] ?? 0);
  return { sign, line, octaveChange };
}

function parseKey(raw: RawAttributes['key']): KeyInfo {
  if (!raw) return { fifths: 0, mode: 'major' };
  return {
    fifths: Number(raw.fifths ?? 0),
    mode: String(raw.mode ?? 'major'),
  };
}

function parseTime(raw: RawAttributes['time']): TimeInfo {
  if (!raw) return { beats: 4, beatType: 4, senzaMisura: false };
  const isSenza = 'senza-misura' in raw;
  return {
    beats: raw.beats != null ? Number(raw.beats) : null,
    beatType: raw['beat-type'] != null ? Number(raw['beat-type']) : null,
    senzaMisura: isSenza,
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
export { PAGE_W, PAGE_H, STAFF_H, TOP_MARGIN, LEFT_MARGIN, STAFF_TOPS };
