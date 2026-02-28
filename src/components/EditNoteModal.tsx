import React, { useState } from 'react';
import type { NoteData, NoteType, NoteCorrection } from '../types';

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

const ALTERS = [
  { value: -2, label: '𝄫 Double flat' },
  { value: -1, label: '♭ Flat' },
  { value:  0, label: '♮ Natural' },
  { value:  1, label: '♯ Sharp' },
  { value:  2, label: '𝄪 Double sharp' },
];

const DURATIONS: NoteType[] = ['whole', 'half', 'quarter', 'eighth', '16th', '32nd', '64th'];

function accSym(alter: number): string {
  if (alter === -2) return '𝄫';
  if (alter === -1) return '♭';
  if (alter ===  1) return '♯';
  if (alter ===  2) return '𝄪';
  return '';
}

interface Props {
  note: NoteData;
  onSave: (id: string, correction: NoteCorrection) => void;
  onMarkOK: (id: string) => void;
  onClose: () => void;
}

export default function EditNoteModal({ note, onSave, onMarkOK, onClose }: Props) {
  const [step, setStep]         = useState(note.step);
  const [octave, setOctave]     = useState(note.octave);
  const [alter, setAlter]       = useState(note.alter);
  const [noteType, setNoteType] = useState<NoteType>(note.noteType);

  const isBelow = note.confidence < 0.75; // visual indicator only

  function handleSave() {
    onSave(note.id, { step, octave, alter, noteType, status: 'corrected' });
    onClose();
  }

  function handleMarkOK() {
    onMarkOK(note.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-600 rounded-2xl p-6 w-80 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">Edit Note</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Part {note.partIndex + 1} · Measure {note.measureNum}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Confidence badge */}
        <div className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-slate-800 border border-slate-700">
          <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${note.confidence * 100}%`,
                background: isBelow ? '#dc2626' : '#2563eb',
              }}
            />
          </div>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: isBelow ? '#fca5a5' : '#93c5fd' }}
          >
            {(note.confidence * 100).toFixed(1)}%
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: isBelow ? '#7f1d1d' : '#1e3a8a',
              color: isBelow ? '#fca5a5' : '#93c5fd',
            }}
          >
            {isBelow ? 'LOW' : 'OK'}
          </span>
        </div>

        {/* Pitch row */}
        <div className="mb-4">
          <label className="text-slate-400 text-xs font-medium block mb-1.5">Pitch</label>
          <div className="flex gap-2">
            {/* Step */}
            <select
              value={step}
              onChange={(e) => setStep(e.target.value)}
              className="flex-1 bg-slate-800 text-white rounded-lg px-2 py-2
                         border border-slate-600 text-sm focus:outline-none focus:border-blue-500"
            >
              {STEPS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Accidental */}
            <select
              value={alter}
              onChange={(e) => setAlter(Number(e.target.value))}
              className="flex-1 bg-slate-800 text-white rounded-lg px-2 py-2
                         border border-slate-600 text-sm focus:outline-none focus:border-blue-500"
            >
              {ALTERS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>

            {/* Octave */}
            <input
              type="number"
              min={0}
              max={9}
              value={octave}
              onChange={(e) => setOctave(Number(e.target.value))}
              className="w-16 bg-slate-800 text-white rounded-lg px-2 py-2
                         border border-slate-600 text-sm text-center focus:outline-none focus:border-blue-500"
            />
          </div>
          {/* Preview */}
          <p className="text-slate-400 text-xs mt-1.5">
            Preview:{' '}
            <span className="text-blue-300 font-bold text-sm">
              {step}{accSym(alter)}{octave}
            </span>
          </p>
        </div>

        {/* Duration */}
        <div className="mb-5">
          <label className="text-slate-400 text-xs font-medium block mb-1.5">Duration</label>
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value as NoteType)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2
                       border border-slate-600 text-sm focus:outline-none focus:border-blue-500"
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl
                       px-3 py-2.5 text-sm font-semibold transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleMarkOK}
            className="flex-1 bg-green-700 hover:bg-green-600 text-white rounded-xl
                       px-3 py-2.5 text-sm font-semibold transition-colors"
          >
            Mark OK
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-xl
                       px-3 py-2.5 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
