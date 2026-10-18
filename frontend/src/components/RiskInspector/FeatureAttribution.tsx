import React from 'react';
import { FeatureAttribution as IFeatureAttribution } from '../../types';
import { HelpCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface FeatureAttributionProps {
  features: IFeatureAttribution[];
}

export const FeatureAttribution: React.FC<FeatureAttributionProps> = ({ features }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
        <span className="flex items-center gap-1 font-semibold text-slate-300">
          <span>Feature attribution (SIMULATED data)</span>
        </span>
        <span className="text-[10px] text-slate-500">Weight delta</span>
      </div>

      <div className="space-y-1.5">
        {features.map((feat, idx) => {
          const isPositiveRisk = feat.impact > 0;
          const absImpact = Math.abs(feat.impact);
          const maxScale = 50; // max expected impact for scale
          const barWidthPercent = Math.min(100, (absImpact / maxScale) * 100);

          return (
            <div 
              key={idx}
              className="bg-slate-950/70 border border-slate-800 rounded p-1.5 flex flex-col gap-1 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                    feat.category === 'VELOCITY' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    feat.category === 'GRAPH' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                    feat.category === 'AMOUNT' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                    feat.category === 'DEVICE' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                    'bg-slate-700/30 text-slate-400 border border-slate-600/30'
                  }`}>
                    {feat.category}
                  </span>
                  <span className="font-medium text-slate-200 text-[11px]">{feat.feature}</span>
                </div>

                <div className="flex items-center gap-1 font-mono font-bold text-[11px] tabular-nums">
                  {isPositiveRisk ? (
                    <span className="text-rose-400 flex items-center">
                      <TrendingUp className="h-3 w-3 mr-0.5 inline" />
                      +{feat.impact.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center">
                      <TrendingDown className="h-3 w-3 mr-0.5 inline" />
                      {feat.impact.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Impact Bar */}
              <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden flex">
                {isPositiveRisk ? (
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                    style={{ width: `${barWidthPercent}%` }}
                  />
                ) : (
                  <div 
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${barWidthPercent}%` }}
                  />
                )}
              </div>

              <div className="text-[10px] text-slate-400 font-sans leading-tight">
                {feat.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
