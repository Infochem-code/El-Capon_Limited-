import React from 'react';

interface BarcodeSvgProps {
  value: string;
  height?: number;
}

/**
 * Deterministic visual linear barcode renderer for material labels and quick visual verification.
 */
export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({ value, height = 42 }) => {
  const safeVal = value || '000000';
  const bars: Array<{ x: number; w: number }> = [];
  let cursor = 4;

  // Start guard
  bars.push({ x: cursor, w: 2 });
  cursor += 4;
  bars.push({ x: cursor, w: 1 });
  cursor += 3;

  for (let i = 0; i < safeVal.length; i++) {
    const code = safeVal.charCodeAt(i);
    const pattern = [
      ((code >> 0) & 1) + 1,
      ((code >> 1) & 1) + 1,
      ((code >> 2) & 1) + 1,
      ((code >> 3) & 1) + 1,
    ];
    for (let j = 0; j < pattern.length; j++) {
      if (j % 2 === 0) {
        bars.push({ x: cursor, w: pattern[j] });
      }
      cursor += pattern[j] + 1;
    }
  }

  // Stop guard
  bars.push({ x: cursor, w: 2 });
  cursor += 4;
  bars.push({ x: cursor, w: 1 });
  cursor += 5;

  return (
    <div className="inline-flex flex-col items-center bg-white border border-slate-200 rounded-md px-3 py-2">
      <svg
        viewBox={`0 0 ${cursor} ${height}`}
        className="w-full max-w-[180px]"
        style={{ height: `${height}px` }}
        aria-label={`Barcode for ${safeVal}`}
      >
        {bars.map((bar, idx) => (
          <rect key={idx} x={bar.x} y={0} width={bar.w} height={height} fill="#0F172A" />
        ))}
      </svg>
      <span className="mt-1 font-mono text-[11px] tracking-wider text-slate-700">{safeVal}</span>
    </div>
  );
};
