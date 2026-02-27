import type { NoteData, NoteType, StemDir } from '../types';

// ─── Colours ─────────────────────────────────────────────────────────────────
export const COLOR_ABOVE = '#2563eb'; // blue-600
export const COLOR_BELOW = '#dc2626'; // red-600

function noteColor(note: NoteData, threshold: number): string {
  return note.confidence >= threshold ? COLOR_ABOVE : COLOR_BELOW;
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

/**
 * Draw a tilted oval note-head centred at (cx, cy).
 * open = true for whole / half notes (hollow), false for quarter and smaller.
 */
function drawHead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  open: boolean,
): void {
  const TILT = -Math.PI / 9; // ~−20 °
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(TILT);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  if (open) {
    // Hollow: punch out the inside so background shows through
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, rx * 0.4);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

/** Draw a vertical stem. Returns the tip (x,y) for flag attachment. */
function drawStem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  stemDir: StemDir,
  stemLen: number,
  color: string,
): [number, number] {
  if (stemDir === 'none') return [cx, cy];

  const sx = stemDir === 'up' ? cx + rx * 0.85 : cx - rx * 0.85;
  const sy = stemDir === 'up' ? cy - stemLen : cy + stemLen;

  ctx.beginPath();
  ctx.moveTo(sx, cy);
  ctx.lineTo(sx, sy);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, rx * 0.22);
  ctx.stroke();

  return [sx, sy];
}

/**
 * Draw 1-3 flags at the tip of the stem.
 * flags: 1 = eighth, 2 = 16th, 3 = 32nd
 */
function drawFlags(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  stemDir: StemDir,
  flagCount: number,
  rx: number,
  ry: number,
  color: string,
): void {
  if (stemDir === 'none' || flagCount === 0) return;

  const spacing = ry * 1.8;
  const sweep = stemDir === 'up' ? 1 : -1;
  const flagW = rx * 3.5;
  const flagH = ry * 2.6;

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, rx * 0.2);

  for (let f = 0; f < flagCount; f++) {
    const startY = ty + sweep * f * spacing * -1;
    const cp1x = tx + flagW * 0.4;
    const cp1y = startY + sweep * flagH * 0.5;
    const cp2x = tx + flagW;
    const cp2y = startY + sweep * flagH * 0.9;
    const endX = tx + flagW * 0.5;
    const endY = startY + sweep * flagH;

    ctx.beginPath();
    ctx.moveTo(tx, startY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    ctx.stroke();
  }
}

function flagsForType(t: NoteType): number {
  return { whole: 0, half: 0, quarter: 0, eighth: 1, '16th': 2, '32nd': 3, '64th': 4 }[t] ?? 0;
}

// ─── Accidental symbol ───────────────────────────────────────────────────────
function drawAccidental(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  alter: number,
  ry: number,
  color: string,
): void {
  if (alter === 0) return;
  const size = ry * 1.7;
  const ax = cx - ry * 2.6;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.font = `bold ${size * 2}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const sym = alter < 0 ? '♭' : '♯';
  ctx.fillText(sym, ax, cy);
  ctx.restore();
}

// ─── Ledger lines ─────────────────────────────────────────────────────────────
/**
 * Draw ledger lines for notes outside the staff.
 * staffTop is the canvas-Y of the top staff line.
 * staffLineSpacing is 10 tenths × scaleY pixels.
 */
function drawLedgerLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  staffTop: number,
  staffBottom: number,
  lineSpacing: number,
  rx: number,
  color: string,
): void {
  const ledgerW = rx * 2.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, rx * 0.2);

  // Above staff (cy < staffTop)
  if (cy < staffTop - lineSpacing * 0.4) {
    let ly = staffTop - lineSpacing;
    while (ly >= cy - lineSpacing * 0.4) {
      ctx.beginPath();
      ctx.moveTo(cx - ledgerW, ly);
      ctx.lineTo(cx + ledgerW, ly);
      ctx.stroke();
      ly -= lineSpacing;
    }
  }

  // Below staff (cy > staffBottom)
  if (cy > staffBottom + lineSpacing * 0.4) {
    let ly = staffBottom + lineSpacing;
    while (ly <= cy + lineSpacing * 0.4) {
      ctx.beginPath();
      ctx.moveTo(cx - ledgerW, ly);
      ctx.lineTo(cx + ledgerW, ly);
      ctx.stroke();
      ly += lineSpacing;
    }
  }
}

// ─── Main draw function ───────────────────────────────────────────────────────

/** Score page dimensions (tenths) — kept in sync with scoreParser.ts constants */
const PAGE_W = 1365;
const PAGE_H = 1922;
const STAFF_H_TENTHS = 40; // 4 staff-spaces × 10 tenths

/** Staff top-Y positions (tenths, from page top) for each part × system */
const STAFF_TOPS: number[][] = [
  [333, 445, 556],  // system 1
  [785, 897, 1008], // system 2
];
const SYS_OF_MEASURE = (mi: number) => (mi < 4 ? 0 : 1);

export function drawAllNotes(
  ctx: CanvasRenderingContext2D,
  notes: NoteData[],
  threshold: number,
  canvasW: number,
  canvasH: number,
): void {
  const sx = canvasW / PAGE_W;
  const sy = canvasH / PAGE_H;

  // Note head radius in pixels (proportional to staff height)
  const staffPx = STAFF_H_TENTHS * sy;
  const rx = Math.max(3.5, staffPx * 0.22); // horizontal
  const ry = Math.max(2.5, staffPx * 0.13); // vertical
  const stemLen = Math.max(12, staffPx * 0.88);
  const lineSpacing = Math.max(2, staffPx * 0.25); // 10 tenths scaled

  ctx.clearRect(0, 0, canvasW, canvasH);

  for (const note of notes) {
    if (note.isRest) continue;

    const color = noteColor(note, threshold);
    const cx = note.absX * sx;
    const cy = note.absY * sy;

    // Compute staff boundaries for ledger lines
    const measureIdx = Number(note.measureNum) - 1;
    const sysIdx = SYS_OF_MEASURE(measureIdx);
    const rawStaffTop = STAFF_TOPS[sysIdx]?.[note.partIndex] ?? 0;
    const staffTopPx = rawStaffTop * sy;
    const staffBottomPx = (rawStaffTop + STAFF_H_TENTHS) * sy;

    // Ledger lines
    drawLedgerLines(ctx, cx, cy, staffTopPx, staffBottomPx, lineSpacing * 2, rx, color);

    // Accidental
    drawAccidental(ctx, cx, cy, note.alter, ry, color);

    const open = note.noteType === 'whole' || note.noteType === 'half';

    // Note head
    drawHead(ctx, cx, cy, rx, ry, color, open);

    // Stem + flags
    const [tx, ty] = drawStem(ctx, cx, cy, rx, note.stemDir, stemLen, color);
    const fc = flagsForType(note.noteType);
    if (fc > 0) {
      drawFlags(ctx, tx, ty, note.stemDir, fc, rx, ry, color);
    }
  }
}

// ─── Hit-test: find nearest note to a canvas point ──────────────────────────
export function findNoteAt(
  notes: NoteData[],
  px: number,
  py: number,
  canvasW: number,
  canvasH: number,
  radius = 18,
): NoteData | null {
  const sx = canvasW / PAGE_W;
  const sy = canvasH / PAGE_H;

  let best: NoteData | null = null;
  let bestDist = radius * radius;

  for (const note of notes) {
    if (note.isRest) continue;
    const dx = note.absX * sx - px;
    const dy = note.absY * sy - py;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      best = note;
    }
  }
  return best;
}
