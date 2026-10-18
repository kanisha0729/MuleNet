import React from 'react';

interface RiskGaugeProps {
  score: number; // 0 to 100
  size?: number;
  /** When given (real model output), colour/label follow the model decision instead of score bands. */
  decision?: 'ALLOW' | 'REVIEW' | 'BLOCK';
  valueLabel?: string;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ score, size = 150, decision, valueLabel }) => {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // We use a 240 degree arc (3/4 of a circle)
  const arcDegree = 240;
  const arcLength = (circumference * arcDegree) / 360;
  const strokeDashoffset = arcLength - (score / 100) * arcLength;

  const getColor = (s: number) => {
    if (decision === 'BLOCK') return '#ef4444';
    if (decision === 'REVIEW') return '#f59e0b';
    if (decision === 'ALLOW') return '#10b981';
    if (s >= 80) return '#ef4444'; // rose-500
    if (s >= 35) return '#f59e0b'; // amber-500
    return '#10b981'; // emerald-500
  };

  const getLabel = (s: number) => {
    if (decision === 'BLOCK') return 'HOLD FOR OFFICER';
    if (decision === 'REVIEW') return 'STEP-UP VERIFY';
    if (decision === 'ALLOW') return 'NO ALERT';
    if (s >= 80) return 'CRITICAL MULE RISK';
    if (s >= 35) return 'ELEVATED SUSPICION';
    return 'STANDARD LEGITIMATE';
  };

  const color = getColor(score);

  return (
    <div className="flex flex-col items-center justify-center relative">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size * 0.85 }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-[210deg] overflow-visible"
        >
          {/* Background Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Animated Value Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
            style={{
              filter: score >= 80 ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' : 'none'
            }}
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center -mt-2">
          <span className="font-mono text-3xl font-extrabold tracking-tight tabular-nums text-white">
            {valueLabel ?? `${score}%`}
          </span>
          <span 
            className="text-[10px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.5 rounded mt-0.5"
            style={{ color, backgroundColor: `${color}18` }}
          >
            {getLabel(score)}
          </span>
        </div>
      </div>
    </div>
  );
};
