import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { NoteData } from '../types';
import { drawAllNotes, findNoteAt } from '../utils/noteRenderer';
import Tooltip from './Tooltip';

interface Props {
  imageUrl: string | null;
  notes: NoteData[];
  threshold: number;
}

export default function ScoreViewer({ imageUrl, notes, threshold }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hovered, setHovered] = useState<NoteData | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // ── Redraw canvas whenever image size, notes, or threshold changes ────────
  const redraw = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const w = img.clientWidth;
    const h = img.clientHeight;
    if (w === 0 || h === 0) return;

    // Match canvas logical resolution to rendered size (crisp at any zoom)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    drawAllNotes(ctx, notes, threshold, w, h);
  }, [notes, threshold]);

  // Redraw on image load
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => redraw();
    img.addEventListener('load', onLoad);
    if (img.complete) redraw();
    return () => img.removeEventListener('load', onLoad);
  }, [redraw, imageUrl]);

  // Redraw on threshold / notes change (image already loaded)
  useEffect(() => {
    if (imgRef.current?.complete) redraw();
  }, [redraw]);

  // Redraw on container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(el);
    return () => ro.disconnect();
  }, [redraw]);

  // ── Mouse hover for tooltip ───────────────────────────────────────────────
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });
    setHovered(findNoteAt(notes, px, py, canvas.clientWidth, canvas.clientHeight));
  };

  const onMouseLeave = () => setHovered(null);

  return (
    <div className="flex flex-col gap-3">
      {/* Viewer box */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden border border-slate-600 bg-slate-900
                   min-h-[300px] flex items-center justify-center"
      >
        {imageUrl ? (
          <>
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Score"
              className="block w-full h-auto select-none"
              draggable={false}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 cursor-crosshair"
              style={{ pointerEvents: 'all' }}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
            />
          </>
        ) : (
          <Placeholder />
        )}
      </div>

      {/* Tooltip (portal-style fixed positioning) */}
      {hovered && <Tooltip note={hovered} x={mousePos.x} y={mousePos.y} threshold={threshold} />}
    </div>
  );
}

function Placeholder() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 px-8 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-16 w-16 text-slate-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
      <div>
        <p className="text-slate-400 font-medium">No score image uploaded</p>
        <p className="text-slate-500 text-sm mt-1">
          Upload a photo or scan of the original sheet music above to see the OMR overlay.
        </p>
      </div>
    </div>
  );
}
