import React, { useCallback, useEffect, useState } from 'react';
import UploadArea from './components/UploadArea';
import Controls from './components/Controls';
import ScoreViewer from './components/ScoreViewer';
import { parseScore } from './utils/scoreParser';
import type { NoteData } from './types';

export default function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.75);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load and parse the score JSON on startup
  useEffect(() => {
    fetch('/scores.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const result = parseScore(json);
        setNotes(result.notes);
      })
      .catch((err) => {
        console.error('Failed to load scores.json:', err);
        setLoadError(String(err));
      });
  }, []);

  const handleUpload = useCallback((file: File) => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
  }, [imageUrl]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-blue-500"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
            <span className="font-bold text-lg tracking-tight">Harmonia</span>
          </div>
          <span className="text-slate-500 text-sm hidden sm:block">
            Optical Music Recognition · Review &amp; Correction
          </span>

          {notes.length > 0 && (
            <span className="ml-auto text-xs text-slate-500 bg-slate-800 rounded-full px-3 py-1">
              {notes.length} notes loaded
            </span>
          )}
        </div>
      </header>

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        {/* Score viewer — takes up most of the width */}
        <section className="flex flex-col gap-4 order-2 xl:order-1">
          <SectionHeader
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            }
            title="Score Viewer"
            subtitle="OMR overlay on original image"
          />
          <ScoreViewer imageUrl={imageUrl} notes={notes} threshold={threshold} />
        </section>

        {/* Right sidebar */}
        <aside className="flex flex-col gap-4 order-1 xl:order-2">
          <SectionHeader
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            }
            title="Upload Image"
            subtitle="Original sheet music photo or scan"
          />
          <UploadArea onUpload={handleUpload} hasImage={!!imageUrl} />

          <SectionHeader
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            }
            title="Controls"
            subtitle="Adjust recognition threshold"
          />
          <Controls threshold={threshold} onChange={setThreshold} notes={notes} />

          {/* Info card */}
          <InfoCard />

          {/* Error display */}
          {loadError && (
            <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
              <strong>Error loading score:</strong> {loadError}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
        <p className="text-[11px] text-slate-500 leading-tight">{subtitle}</p>
      </div>
    </div>
  );
}

function InfoCard() {
  return (
    <div className="rounded-xl bg-slate-800/40 border border-slate-700 p-4 text-xs text-slate-400 space-y-2">
      <p className="font-semibold text-slate-300 text-sm">How to use</p>
      <ol className="list-decimal list-inside space-y-1 leading-relaxed">
        <li>Upload the <strong className="text-slate-300">original sheet music</strong> image.</li>
        <li>Note symbols are drawn on top in real time.</li>
        <li>
          <span className="text-blue-400 font-medium">Blue</span> notes meet the confidence
          threshold;{' '}
          <span className="text-red-400 font-medium">Red</span> notes fall below it.
        </li>
        <li>Drag the slider to change the threshold.</li>
        <li>Hover over any note to see its name &amp; confidence score.</li>
      </ol>
    </div>
  );
}
