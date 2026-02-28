export type NoteType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd' | '64th';
export type StemDir = 'up' | 'down' | 'none';
export type NoteStatus = 'unreviewed' | 'verified' | 'corrected';

export interface NoteData {
  id: string;
  step: string;        // C D E F G A B
  octave: number;
  alter: number;       // 0=natural, -1=flat, 1=sharp
  noteType: NoteType;
  absX: number;        // absolute x in score tenths (from page left)
  absY: number;        // absolute y in score tenths (from page top) — note head centre
  stemDir: StemDir;
  confidence: number;  // 0–1 mock value
  partIndex: number;
  measureNum: string;
  measureIndex: number; // 0-based global measure index (0–7)
  systemIndex: number;  // 0 or 1
  isRest: boolean;
  status: NoteStatus;
}

export interface ScoreLayout {
  pageWidth: number;
  pageHeight: number;
}

export interface CalibrationState {
  offsetX: number;    // canvas-pixel shift horizontally
  offsetY: number;    // canvas-pixel shift vertically
  scaleX: number;     // horizontal scale multiplier (1 = no change)
  scaleY: number;     // vertical scale multiplier
  noteScale: number;  // note head / symbol size multiplier
}

export interface ClefInfo {
  sign: 'G' | 'F' | 'C';
  line: number;
  octaveChange: number; // -1, 0, +1
}

export interface KeyInfo {
  fifths: number; // −7 to +7
  mode: string;   // 'major' | 'minor'
}

export interface TimeInfo {
  beats: number | null;
  beatType: number | null;
  senzaMisura: boolean;
}

export interface PartInfo {
  id: string;
  name: string;
  clef: ClefInfo;
  key: KeyInfo;
  time: TimeInfo;
}

export interface NoteCorrection {
  step?: string;
  octave?: number;
  alter?: number;
  noteType?: NoteType;
  status: NoteStatus;
}
