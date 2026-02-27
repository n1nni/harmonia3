import React from 'react';
import { COLOR_ABOVE, COLOR_BELOW } from '../utils/noteRenderer';
import type { NoteData } from '../types';

interface Props {
  threshold: number;
  onChange: (v: number) => void;
  notes: NoteData[];
}

export default function Controls({ threshold, onChange, notes }: Props) {
  const total = notes.filter((n) => !n.isRest).length;
  const above = notes.filter((n) => !n.isRest && n.confidence >= threshold).length;
  const below = total - above;
  const pct = total > 0 ? Math.round((above / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-slate-800/70 border border-slate-700 p-5">
      {/* Threshold slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-slate-200">
            Confidence Threshold
          </label>
          <span className="text-base font-bold tabular-nums text-blue-300">
            {(threshold * 100).toFixed(0)}%
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(threshold * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full h-2 rounded-full appearance-none cursor-pointer
                     bg-gradient-to-r from-red-600 via-yellow-400 to-blue-500
                     accent-blue-500"
          style={{ accentColor: COLOR_ABOVE }}
        />

        <div className="flex justify-between mt-1 text-xs text-slate-500">
          <span>0 %</span>
          <span>50 %</span>
          <span>100 %</span>
        </div>
      </div>

      {/* Stats */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <StatBox label="Total notes" value={total} color="text-slate-200" />
          <StatBox
            label="Above threshold"
            value={above}
            color="text-blue-400"
            dot={COLOR_ABOVE}
          />
          <StatBox
            label="Below threshold"
            value={below}
            color="text-red-400"
            dot={COLOR_BELOW}
          />
        </div>
      )}

      {/* Accuracy bar */}
      {total > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Recognition rate</span>
            <span className="text-xs font-bold text-slate-300">{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(to right, ${COLOR_ABOVE}, #60a5fa)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-5">
        <LegendItem color={COLOR_ABOVE} label="Confidence ≥ threshold" />
        <LegendItem color={COLOR_BELOW} label="Confidence < threshold" />
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
  dot,
}: {
  label: string;
  value: number;
  color: string;
  dot?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-700/50 px-3 py-2">
      <div className={`text-xl font-bold tabular-nums ${color}`}>
        {dot && (
          <span
            className="inline-block mr-1 rounded-full"
            style={{ width: 10, height: 10, background: dot, verticalAlign: 'middle' }}
          />
        )}
        {value}
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block rounded-sm flex-shrink-0"
        style={{ width: 14, height: 14, background: color }}
      />
      <span className="text-xs text-slate-300">{label}</span>
    </div>
  );
}
