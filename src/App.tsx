import React, { useCallback, useEffect, useMemo, useState } from 'react';
import UploadArea from './components/UploadArea';
import Controls from './components/Controls';
import CalibrationPanel from './components/CalibrationPanel';
import ScoreViewer from './components/ScoreViewer';
import VexFlowScore from './components/VexFlowScore';
import EditNoteModal from './components/EditNoteModal';
import { parseScore, PAGE_W, PAGE_H, LEFT_MARGIN, TOP_MARGIN } from './utils/scoreParser';
import type { NoteData, PartInfo, CalibrationState, NoteCorrection } from './types';

const DEFAULT_CALIB: CalibrationState = {
  offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, noteScale: 1,
};

export default function App() {
  // ── Core state ──────────────────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.75);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [parts, setParts] = useState<PartInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Calibration ─────────────────────────────────────────────────────────
  const [calibration, setCalibration] = useState<CalibrationState>(DEFAULT_CALIB);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // ── Note corrections ────────────────────────────────────────────────────
  const [corrections, setCorrections] = useState<Map<string, NoteCorrection>>(new Map());
  const [editingNote, setEditingNote] = useState<NoteData | null>(null);

  // ── Effective notes (with corrections applied) ──────────────────────────
  const effectiveNotes = useMemo(() =>
    notes.map(n => {
      const c = corrections.get(n.id);
      if (!c) return n;
      return {
        ...n,
        step: c.step ?? n.step,
        octave: c.octave ?? n.octave,
        alter: c.alter ?? n.alter,
        noteType: c.noteType ?? n.noteType,
        status: c.status,
      };
    }),
    [notes, corrections],
  );

  // ── Load scores.json on startup ─────────────────────────────────────────
  useEffect(() => {
    fetch('/scores.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(json => {
        const result = parseScore(json);
        setNotes(result.notes);
        setParts(result.parts);
      })
      .catch(err => {
        console.error('Failed to load scores.json:', err);
        setLoadError(String(err));
      });
  }, []);

  // ── Image upload ────────────────────────────────────────────────────────
  const handleUpload = useCallback((file: File) => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
  }, [imageUrl]);

  useEffect(() => {
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [imageUrl]);

  // ── Calibration click handler ───────────────────────────────────────────
  const handleCalibrationClick = useCallback(
    (px: number, py: number, canvasW: number, canvasH: number) => {
      // User clicked where the score top-left corner is in the image.
      // Compute offset so that note positions match this origin.
      const refRawX = (LEFT_MARGIN / PAGE_W) * canvasW;
      const refRawY = (TOP_MARGIN / PAGE_H) * canvasH;
      setCalibration(prev => ({
        ...prev,
        offsetX: px - refRawX * prev.scaleX,
        offsetY: py - refRawY * prev.scaleY,
      }));
      setIsCalibrating(false);
    },
    [],
  );

  // ── Note correction handlers ────────────────────────────────────────────
  const handleSaveCorrection = useCallback((id: string, correction: NoteCorrection) => {
    setCorrections(prev => {
      const next = new Map(prev);
      next.set(id, correction);
      return next;
    });
  }, []);

  const handleMarkOK = useCallback((id: string) => {
    setCorrections(prev => {
      const next = new Map(prev);
      next.set(id, { status: 'verified' });
      return next;
    });
  }, []);

  // ── Stats ───────────────────────────────────────────────────────────────
  const correctedCount = [...corrections.values()].filter(c => c.status === 'corrected' || c.status === 'verified').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
            <span className="font-bold text-lg tracking-tight">Harmonia</span>
          </div>
          <span className="text-slate-500 text-sm hidden sm:block">
            Optical Music Recognition &middot; Review &amp; Correction
          </span>

          <div className="ml-auto flex items-center gap-3">
            {correctedCount > 0 && (
              <span className="text-xs text-green-400 bg-green-950 rounded-full px-3 py-1">
                {correctedCount} corrected
              </span>
            )}
            {effectiveNotes.length > 0 && (
              <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-3 py-1">
                {effectiveNotes.length} notes loaded
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main layout: sidebar | image overlay | VexFlow ─────────────── */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 xl:grid-cols-[260px_1fr_1fr] gap-6">

        {/* ─ Left sidebar ─ */}
        <aside className="flex flex-col gap-4 order-1 xl:order-1">
          <SectionHeader
            icon={<UploadIcon />}
            title="Upload Image"
            subtitle="Original sheet music scan"
          />
          <UploadArea onUpload={handleUpload} hasImage={!!imageUrl} />

          <SectionHeader
            icon={<SlidersIcon />}
            title="Controls"
            subtitle="Adjust recognition threshold"
          />
          <Controls threshold={threshold} onChange={setThreshold} notes={effectiveNotes} />

          <SectionHeader
            icon={<TargetIcon />}
            title="Calibration"
            subtitle="Align overlay to image"
          />
          <CalibrationPanel
            calibration={calibration}
            onChange={setCalibration}
            isCalibrating={isCalibrating}
            onStartCalibrate={() => setIsCalibrating(true)}
            onCancelCalibrate={() => setIsCalibrating(false)}
          />

          {/* Key signature info */}
          {parts.length > 0 && (
            <div className="rounded-xl bg-slate-800/40 border border-slate-700 p-4 text-xs text-slate-400 space-y-1.5">
              <p className="font-semibold text-slate-300 text-sm">Score Info</p>
              {parts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-slate-500">Part {i + 1}:</span>
                  <span className="text-slate-300">
                    {p.clef.sign === 'G' ? 'Treble' : p.clef.sign === 'F' ? 'Bass' : p.clef.sign} clef
                    {p.clef.octaveChange === -1 && ' (8vb)'}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Key:</span>
                <span className="text-slate-300">
                  {keyLabel(parts[0]?.key.fifths ?? 0)} ({parts[0]?.key.fifths ?? 0} {(parts[0]?.key.fifths ?? 0) < 0 ? 'flats' : 'sharps'})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Time:</span>
                <span className="text-slate-300">
                  {parts[0]?.time.senzaMisura ? 'Senza misura (free time)' : `${parts[0]?.time.beats}/${parts[0]?.time.beatType}`}
                </span>
              </div>
            </div>
          )}

          {loadError && (
            <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
              <strong>Error loading score:</strong> {loadError}
            </div>
          )}
        </aside>

        {/* ─ Center: Original image + overlay ─ */}
        <section className="flex flex-col gap-3 order-2 xl:order-2">
          <SectionHeader
            icon={<ImageIcon />}
            title="Original + Overlay"
            subtitle="OMR overlay on uploaded image &middot; Click notes to edit"
          />
          <ScoreViewer
            imageUrl={imageUrl}
            notes={effectiveNotes}
            threshold={threshold}
            calibration={calibration}
            isCalibrating={isCalibrating}
            onCalibrationClick={handleCalibrationClick}
            onNoteClick={setEditingNote}
          />
        </section>

        {/* ─ Right: VexFlow clean score ─ */}
        <section className="flex flex-col gap-3 order-3 xl:order-3">
          <SectionHeader
            icon={<MusicIcon />}
            title="Clean Digitized Score"
            subtitle="VexFlow rendering with clef, key &amp; time signatures"
          />
          <VexFlowScore
            notes={effectiveNotes}
            parts={parts}
            threshold={threshold}
            corrections={corrections}
          />
        </section>
      </main>

      {/* ── Edit Note Modal ────────────────────────────────────────────── */}
      {editingNote && (
        <EditNoteModal
          note={editingNote}
          onSave={handleSaveCorrection}
          onMarkOK={handleMarkOK}
          onClose={() => setEditingNote(null)}
        />
      )}
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────

function keyLabel(fifths: number): string {
  const map: Record<number, string> = {
    [-7]: 'C\u266D', [-6]: 'G\u266D', [-5]: 'D\u266D', [-4]: 'A\u266D', [-3]: 'E\u266D',
    [-2]: 'B\u266D', [-1]: 'F', [0]: 'C', [1]: 'G', [2]: 'D',
    [3]: 'A', [4]: 'E', [5]: 'B', [6]: 'F\u266F', [7]: 'C\u266F',
  };
  return map[fifths] ?? 'C';
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-blue-400">{icon}</span>
      <div>
        <h2 className="text-sm font-semibold text-slate-200 leading-tight">{title}</h2>
        <p className="text-[11px] text-slate-500 leading-tight" dangerouslySetInnerHTML={{ __html: subtitle }} />
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
    </svg>
  );
}
