import React, { useEffect, useRef, useCallback } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Beam, Stem } from 'vexflow';
import type { NoteData, NoteCorrection, PartInfo } from '../types';

// ─── Duration → VexFlow duration string ────────────────────────────────────
const DUR: Record<string, string> = {
  whole: 'w', half: 'h', quarter: 'q', eighth: '8',
  '16th': '16', '32nd': '32', '64th': '64',
};

// ─── Key fifths → VexFlow key spec ─────────────────────────────────────────
const KEY_MAP: Record<number, string> = {
  [-7]: 'Cb', [-6]: 'Gb', [-5]: 'Db', [-4]: 'Ab', [-3]: 'Eb',
  [-2]: 'Bb', [-1]: 'F', [0]: 'C', [1]: 'G', [2]: 'D',
  [3]: 'A', [4]: 'E', [5]: 'B', [6]: 'F#', [7]: 'C#',
};

// ─── Accidental alter → VexFlow string ─────────────────────────────────────
const ACC: Record<number, string> = {
  [-2]: 'bb', [-1]: 'b', [1]: '#', [2]: '##',
};

// ─── Layout constants ──────────────────────────────────────────────────────
const NUM_SYSTEMS = 2;
const NUM_PARTS = 3;
const MEAS_PER_SYS = 4;
const STAVE_SPACING = 90;   // px between stave tops within a system
const SYSTEM_GAP = 50;      // extra gap between systems
const MARGIN_X = 12;
const MARGIN_Y = 20;

interface Props {
  notes: NoteData[];
  parts: PartInfo[];
  threshold: number;
  corrections: Map<string, NoteCorrection>;
}

export default function VexFlowScore({ notes, parts, threshold, corrections }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    const el = containerRef.current;
    if (!el || notes.length === 0) return;

    // Clear previous render
    el.innerHTML = '';

    const width = el.clientWidth || 700;
    const systemH = NUM_PARTS * STAVE_SPACING;
    const totalH = MARGIN_Y + NUM_SYSTEMS * systemH + (NUM_SYSTEMS - 1) * SYSTEM_GAP + 40;
    const staveW = width - MARGIN_X * 2;

    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, totalH);
    const ctx = renderer.getContext();

    // Determine key spec from first part
    const keyFifths = parts[0]?.key.fifths ?? -2;
    const keySpec = KEY_MAP[keyFifths] ?? 'C';

    // Clef names for each part
    const clefNames = parts.map(p => {
      if (p.clef.sign === 'F') return 'bass';
      return 'treble';
    });

    // 8vb annotation for parts with octave change
    const clefAnnotations = parts.map(p => {
      if (p.clef.octaveChange === -1) return '8vb';
      if (p.clef.octaveChange === 1) return '8va';
      return undefined;
    });

    for (let sysIdx = 0; sysIdx < NUM_SYSTEMS; sysIdx++) {
      const sysY = MARGIN_Y + sysIdx * (systemH + SYSTEM_GAP);
      const measStart = sysIdx * MEAS_PER_SYS; // 0 or 4

      for (let partIdx = 0; partIdx < NUM_PARTS; partIdx++) {
        const staveY = sysY + partIdx * STAVE_SPACING;

        const stave = new Stave(MARGIN_X, staveY, staveW);
        stave.addClef(clefNames[partIdx], undefined, clefAnnotations[partIdx]);
        stave.addKeySignature(keySpec);
        stave.setContext(ctx).draw();

        // Collect notes for this part in this system
        const partNotes = notes.filter(n =>
          n.partIndex === partIdx &&
          n.measureIndex >= measStart &&
          n.measureIndex < measStart + MEAS_PER_SYS &&
          !n.isRest
        );

        if (partNotes.length === 0) continue;

        // Create VexFlow StaveNotes
        const vfNotes: StaveNote[] = [];
        for (const n of partNotes) {
          const corr = corrections.get(n.id);
          const step = (corr?.step ?? n.step).toLowerCase();
          const alter = corr?.alter ?? n.alter;
          const octave = corr?.octave ?? n.octave;
          const noteType = corr?.noteType ?? n.noteType;
          const status = corr?.status ?? n.status;

          // For 8vb treble display, transpose sounding pitch up 1 octave for written
          const displayOctave = (partIdx < 2 && parts[partIdx]?.clef.octaveChange === -1)
            ? octave + 1
            : octave;

          const dur = DUR[noteType] ?? 'q';
          const stemDir = n.stemDir === 'up' ? Stem.UP : Stem.DOWN;

          const sn = new StaveNote({
            keys: [`${step}/${displayOctave}`],
            duration: dur,
            stemDirection: stemDir,
            clef: clefNames[partIdx],
          });

          // Add accidentals
          if (alter !== 0 && ACC[alter]) {
            sn.addModifier(new Accidental(ACC[alter]));
          }

          // Color by status / confidence
          let color: string;
          if (status === 'verified' || status === 'corrected') {
            color = '#16a34a'; // green
          } else if (n.confidence >= threshold) {
            color = '#2563eb'; // blue
          } else {
            color = '#dc2626'; // red
          }
          sn.setStyle({ fillStyle: color, strokeStyle: color });
          sn.setStemStyle({ fillStyle: color, strokeStyle: color });

          vfNotes.push(sn);
        }

        if (vfNotes.length === 0) continue;

        // Auto-beam eighth notes and shorter
        let beams: Beam[] = [];
        try {
          beams = Beam.generateBeams(vfNotes);
        } catch {
          // Beaming can fail on unusual note groupings — skip
        }

        // Create voice in SOFT mode
        const voice = new Voice({ numBeats: 4, beatValue: 4 });
        voice.setMode(Voice.Mode.SOFT);
        voice.addTickables(vfNotes);

        // Format & draw
        try {
          const noteStartX = stave.getNoteStartX();
          const noteEndX = stave.getNoteEndX();
          new Formatter().joinVoices([voice]).format([voice], noteEndX - noteStartX - 10);
          voice.draw(ctx, stave);
          beams.forEach(b => b.setContext(ctx).draw());
        } catch (e) {
          console.warn(`VexFlow render error (sys ${sysIdx} part ${partIdx}):`, e);
        }
      }
    }
  }, [notes, parts, threshold, corrections]);

  // Render on changes
  useEffect(() => {
    render();
  }, [render]);

  // Re-render on container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => render());
    ro.observe(el);
    return () => ro.disconnect();
  }, [render]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="rounded-xl overflow-hidden border border-slate-600 bg-white min-h-[300px]"
      />
      {notes.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-slate-400 text-sm">No score data loaded</p>
        </div>
      )}
    </div>
  );
}
