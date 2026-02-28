import React from 'react';
import type { CalibrationState } from '../types';

interface Props {
  calibration: CalibrationState;
  onChange: (c: CalibrationState) => void;
  isCalibrating: boolean;
  onStartCalibrate: () => void;
  onCancelCalibrate: () => void;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-mono tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-600"
      />
    </div>
  );
}

export default function CalibrationPanel({
  calibration,
  onChange,
  isCalibrating,
  onStartCalibrate,
  onCancelCalibrate,
}: Props) {
  const set = (patch: Partial<CalibrationState>) => onChange({ ...calibration, ...patch });

  return (
    <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-4 flex flex-col gap-3">
      {/* Click-to-calibrate */}
      <div className="flex flex-col gap-2">
        {isCalibrating ? (
          <div className="rounded-lg bg-amber-950/60 border border-amber-700 p-3 text-xs text-amber-300">
            <p className="font-semibold mb-1">▶ Click on the score image</p>
            <p className="text-amber-400/80">
              Click where the top-left corner of the printed score area begins. The overlay will shift to align there.
            </p>
            <button
              onClick={onCancelCalibrate}
              className="mt-2 text-xs text-amber-400 underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onStartCalibrate}
            className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600
                       text-slate-200 text-xs font-medium py-2 px-3 transition-colors text-left flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
            </svg>
            Click to set origin point
          </button>
        )}
      </div>

      {/* Offset X */}
      <SliderRow
        label="X Offset (px)"
        value={calibration.offsetX}
        min={-500}
        max={500}
        step={1}
        display={`${calibration.offsetX > 0 ? '+' : ''}${calibration.offsetX}`}
        onChange={(v) => set({ offsetX: v })}
      />

      {/* Offset Y */}
      <SliderRow
        label="Y Offset (px)"
        value={calibration.offsetY}
        min={-500}
        max={500}
        step={1}
        display={`${calibration.offsetY > 0 ? '+' : ''}${calibration.offsetY}`}
        onChange={(v) => set({ offsetY: v })}
      />

      {/* Scale (uniform) */}
      <SliderRow
        label="Scale"
        value={Math.round(calibration.scaleX * 100)}
        min={50}
        max={200}
        step={1}
        display={`${calibration.scaleX.toFixed(2)}×`}
        onChange={(v) => set({ scaleX: v / 100, scaleY: v / 100 })}
      />

      {/* Note size */}
      <SliderRow
        label="Note size"
        value={Math.round(calibration.noteScale * 100)}
        min={40}
        max={200}
        step={1}
        display={`${calibration.noteScale.toFixed(2)}×`}
        onChange={(v) => set({ noteScale: v / 100 })}
      />

      {/* Reset */}
      <button
        onClick={() => onChange({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, noteScale: 1 })}
        className="w-full rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600
                   text-slate-400 hover:text-slate-200 text-xs py-1.5 transition-colors"
      >
        Reset to defaults
      </button>
    </div>
  );
}
