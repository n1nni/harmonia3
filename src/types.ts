export type NoteType =
  | 'whole'
  | 'half'
  | 'quarter'
  | 'eighth'
  | '16th'
  | '32nd'
  | '64th';

export type StemDir = 'up' | 'down' | 'none';

export interface NoteData {
  id: string;
  step: string;       // C D E F G A B
  octave: number;
  alter: number;      // 0 = natural, -1 = flat, 1 = sharp
  noteType: NoteType;
  /** Absolute x position in score tenths (from page left) */
  absX: number;
  /** Absolute y position in score tenths (from page top) — note head centre */
  absY: number;
  stemDir: StemDir;
  confidence: number; // 0–1 mock value
  partIndex: number;
  measureNum: string;
  isRest: boolean;
}

export interface ScoreLayout {
  pageWidth: number;
  pageHeight: number;
}
