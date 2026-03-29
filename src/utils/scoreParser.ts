import type { NoteData, NoteType, StemDir, ScoreLayout, SystemLayout, PartInfo, ClefInfo, KeyInfo, TimeInfo } from '../types';

// ─── Pitch → staff-Y-offset mapping ──────────────────────────────────────────
const STEP_NUM: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
};

function pitchToYOffset(step: string, octave: number, clefSign: string): number {
  const p = octave * 7 + STEP_NUM[step];
  return clefSign === 'F'
    ? 130 - 5 * p  // bass clef
    : 155 - 5 * p; // treble (or octave treble)
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
  '_default-x'?: string;
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
  print?: {
    '_new-system'?: string;
    '_new-page'?: string;
    'system-layout'?: {
      'top-system-distance'?: string;
      'system-distance'?: string;
    };
    [key: string]: unknown;
  };
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
  'score-instrument'?: { 'instrument-name'?: string } | Array<{ 'instrument-name'?: string }>;
  _id?: string;
  [key: string]: unknown;
}

interface RawScore {
  'score-partwise'?: {
    part?: RawPart | RawPart[];
    defaults?: {
      'page-layout'?: {
        'page-height'?: string;
        'page-width'?: string;
        'page-margins'?: {
          'left-margin'?: string;
          'right-margin'?: string;
          'top-margin'?: string;
          'bottom-margin'?: string;
        };
      };
      'system-layout'?: {
        'system-distance'?: string;
        'top-system-distance'?: string;
      };
      'staff-layout'?: {
        'staff-distance'?: string;
      };
      [key: string]: unknown;
    };
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

  // ── Read page defaults ──────────────────────────────────────────────────
  const defaults = partwise.defaults ?? {};
  const pageLay = defaults['page-layout'] ?? {};
  const PAGE_W = Number(pageLay['page-width'] ?? 1365);
  const PAGE_H = Number(pageLay['page-height'] ?? 1922);
  const margins = pageLay['page-margins'] ?? {};
  const LEFT_MARGIN = Number(margins['left-margin'] ?? 130);
  const TOP_MARGIN = Number(margins['top-margin'] ?? 97);
  const STAFF_H = 40; // always 4 staff-spaces × 10 tenths

  const sysLay = defaults['system-layout'] ?? {};
  const DEFAULT_SYS_DIST = Number(sysLay['system-distance'] ?? 109);
  const DEFAULT_TOP_SYS_DIST = Number(sysLay['top-system-distance'] ?? 109);
  const STAFF_DIST = Number(defaults['staff-layout']?.['staff-distance'] ?? 82);

  const rawParts = toArray(partwise.part);
  const rawScoreParts = toArray(partwise['part-list']?.['score-part']);
  const numParts = rawParts.length;

  // ── Detect system breaks from Part 1 measures ─────────────────────────
  const p1Measures = toArray(rawParts[0]?.measure);
  const totalMeasures = p1Measures.length;

  // Build system info: which measures belong to each system and on which page
  interface SysBuild {
    startMeasure: number;
    endMeasure: number; // exclusive
    page: number;
    topSystemDist: number | null;
    systemDist: number | null;
  }
  const systemBuilds: SysBuild[] = [];
  let currentPage = 0;
  let currentSysStart = 0;

  for (let mi = 0; mi < totalMeasures; mi++) {
    const m = p1Measures[mi] as RawMeasure;
    const pr = m.print;
    const isNewPage = pr?.['_new-page'] === 'yes';
    const isNewSystem = pr?.['_new-system'] === 'yes';
    const tsd = pr?.['system-layout']?.['top-system-distance'];
    const sd = pr?.['system-layout']?.['system-distance'];

    if (mi === 0) {
      // First measure always starts system 0
      systemBuilds.push({
        startMeasure: 0,
        endMeasure: totalMeasures, // will be updated
        page: 0,
        topSystemDist: tsd ? Number(tsd) : null,
        systemDist: null,
      });
    } else if (isNewPage || isNewSystem) {
      // Close previous system
      systemBuilds[systemBuilds.length - 1].endMeasure = mi;
      if (isNewPage) currentPage++;
      systemBuilds.push({
        startMeasure: mi,
        endMeasure: totalMeasures,
        page: currentPage,
        topSystemDist: tsd ? Number(tsd) : null,
        systemDist: sd ? Number(sd) : null,
      });
    }
  }
  const numPages = currentPage + 1;

  // ── Compute staff top Y for each system ─────────────────────────────
  // Staff distance between parts within a system:
  //   partN_top = system_first_staff_top + N * (STAFF_H + STAFF_DIST)
  const partSpacing = STAFF_H + STAFF_DIST; // distance between consecutive part staff tops

  // Compute the Y of the bottom of a system (last staff bottom)
  const systemHeight = (numParts - 1) * partSpacing + STAFF_H;

  const systems: SystemLayout[] = [];
  // Track last system bottom per page for system-distance calculation
  const pageLastBottom: Map<number, number> = new Map();

  for (const sb of systemBuilds) {
    let firstStaffTop: number;

    if (!pageLastBottom.has(sb.page)) {
      // First system on this page
      const tsd = sb.topSystemDist ?? DEFAULT_TOP_SYS_DIST;
      firstStaffTop = sb.page * PAGE_H + TOP_MARGIN + tsd;
    } else {
      // Subsequent system — use system-distance from bottom of previous system
      const sd = sb.systemDist ?? DEFAULT_SYS_DIST;
      const prevBottom = pageLastBottom.get(sb.page)!;
      firstStaffTop = prevBottom + sd;
    }

    const staffTops: number[] = [];
    for (let p = 0; p < numParts; p++) {
      staffTops.push(firstStaffTop + p * partSpacing);
    }

    pageLastBottom.set(sb.page, firstStaffTop + systemHeight);

    systems.push({
      staffTops,
      measureRange: [sb.startMeasure, sb.endMeasure],
      page: sb.page,
    });
  }

  // Build a quick lookup: measureIndex → systemIndex
  const measureToSystem = new Array<number>(totalMeasures);
  for (let si = 0; si < systems.length; si++) {
    const [start, end] = systems[si].measureRange;
    for (let mi = start; mi < end; mi++) {
      measureToSystem[mi] = si;
    }
  }

  // ── Parse parts and notes ───────────────────────────────────────────────
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
    const instrRaw = rawSP?.['score-instrument'];
    const instrName = Array.isArray(instrRaw) ? instrRaw[0]?.['instrument-name'] : instrRaw?.['instrument-name'];
    const name =
      typeof nameRaw === 'string'
        ? nameRaw
        : (nameRaw as { __text?: string })?.__text ??
          instrName ??
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
      const sysIdx = measureToSystem[measureIdx] ?? 0;
      const sys = systems[sysIdx];

      // Compute measure start X: left margin + cumulative width of preceding measures in this system
      const [sysStart] = sys.measureRange;
      let mStartX = LEFT_MARGIN;
      for (let i = sysStart; i < measureIdx; i++) {
        const w = Number((p1Measures[i] as RawMeasure)?._width ?? 0);
        mStartX += w;
      }

      const staffTop = sys.staffTops[partIdx] ?? 0;
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

        const yOffset = pitchToYOffset(step, octave, clef.sign);
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

  const layout: ScoreLayout = {
    pageWidth: PAGE_W,
    pageHeight: PAGE_H,
    totalHeight: PAGE_H * numPages,
    numPages,
    numParts,
    systems,
  };

  return { notes, layout, parts };
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
