import React from 'react';
import type { NoteData } from '../types';

const STEP_LABEL: Record<string, string> = {
  C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'B',
};

function accidentalSymbol(alter: number): string {
  if (alter === -1) return '♭';
  if (alter === 1) return '♯';
  if (alter === -2) return '𝄫';
  if (alter === 2) return '𝄪';
  return '';
}

interface Props {
  note: NoteData;
  x: number;
  y: number;
  threshold: number;
}

export default function Tooltip({ note, x, y, threshold }: Props) {
  const noteName = `${STEP_LABEL[note.step]}${accidentalSymbol(note.alter)}${note.octave}`;
  const pct = (note.confidence * 100).toFixed(1);
  const isAboveMid = y > window.innerHeight / 2;
  const isAbove = note.confidence >= threshold;
  const noteColor = isAbove ? '#2563eb' : '#dc2626';
  const textColor = isAbove ? '#93c5fd' : '#fca5a5';

  return (
    <div
      className="pointer-events-none fixed z-50 px-3 py-2 rounded-lg
                 bg-slate-900/95 border border-slate-600 shadow-xl text-xs
                 min-w-[150px]"
      style={{
        left: x + 14,
        top: isAboveMid ? y - 90 : y + 14,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-bold text-base" style={{ color: noteColor }}>
          {noteName}
        </span>
        <span className="text-slate-400 text-[10px] capitalize">{note.noteType}</span>
        <span
          className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: isAbove ? '#1e3a8a' : '#7f1d1d', color: textColor }}
        >
          {isAbove ? 'OK' : 'LOW'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${note.confidence * 100}%`, background: noteColor }}
          />
        </div>
        <span className="font-semibold tabular-nums" style={{ color: textColor }}>
          {pct}%
        </span>
      </div>

      <div className="mt-1.5 text-slate-500 text-[10px]">
        Part {note.partIndex + 1} · Measure {note.measureNum}
      </div>
    </div>
  );
}
