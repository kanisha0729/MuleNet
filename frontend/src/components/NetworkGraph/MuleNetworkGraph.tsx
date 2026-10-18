import React, { useState } from 'react';
import { 
  Network, 
  RefreshCw, 
  Layers, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  DollarSign
} from 'lucide-react';
import { MuleGraphData, GraphNode } from '../../types';

interface MuleNetworkGraphProps {
  graphData: MuleGraphData | null;
  isLoading: boolean;
  selectedTxnId?: string;
}

export const MuleNetworkGraph: React.FC<MuleNetworkGraphProps> = ({
  graphData,
  isLoading,
  selectedTxnId
}) => {
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (isLoading || !graphData || !graphData.nodes.length) {
    return (
      <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-6 flex flex-col items-center justify-center text-slate-500 font-mono h-full">
        <RefreshCw className="h-6 w-6 animate-spin text-ibm-cyan mb-2" />
        <span className="text-xs">Loading counterparty neighbourhood...</span>
      </div>
    );
  }

  // Layout node coordinates cleanly across an SVG canvas
  // Width: 700, Height: 240
  const nodePositions: Record<string, { x: number; y: number }> = {
    'orig-1': { x: 70, y: 120 },
    'mule-in-1': { x: 230, y: 65 },
    'mule-in-2': { x: 230, y: 175 },
    'target-suspect': { x: 420, y: 120 },
    'cashout-1': { x: 620, y: 65 },
    'cashout-2': { x: 620, y: 175 }
  };

  const getNodeColor = (node: GraphNode) => {
    if (node.type === 'VICTIM') return '#0f62fe'; // IBM Blue
    if (node.type === 'SUSPECT_TARGET') {
      return node.riskScore >= 70 ? '#ef4444' : (node.riskScore >= 35 ? '#f59e0b' : '#10b981');
    }
    if (node.type === 'CRYPTO_EXCHANGE') return '#8a3ffc'; // IBM Purple
    if (node.type === 'CASHOUT') return '#f43f5e';
    return '#f59e0b';
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/80 rounded-lg overflow-hidden shadow-lg">
      {/* Graph Header */}
      <div className="p-2.5 px-3 border-b border-slate-700/80 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-ibm-cyan" />
          <h3 className="text-xs font-semibold text-white tracking-tight font-mono">
            Counterparty neighbourhood
          </h3>
          <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
            {graphData.nodes.length} Nodes • {graphData.links.length} Hops
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.1))}
              className="p-1 text-slate-400 hover:text-slate-200"
              title="Zoom out"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-400 px-1">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
              className="p-1 text-slate-400 hover:text-slate-200"
              title="Zoom in"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-ibm-blue inline-block"></span>
              Origin
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400 inline-block"></span>
              Layer Mule
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500 inline-block"></span>
              Suspect Hub
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-500 inline-block"></span>
              Off-Ramp
            </span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden min-h-[220px]">
        {/* Subtle grid pattern background */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#334155 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        />

        <svg
          viewBox="0 0 700 240"
          className="w-full h-full max-h-[240px] select-none transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <defs>
            {/* Arrow Marker */}
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
            </marker>

            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
            </marker>

            {/* Glowing filter for high-risk suspect hub */}
            <filter id="glow-suspect" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Links / Edges */}
          {graphData.links.map((link, idx) => {
            const p1 = nodePositions[link.source] || { x: 50, y: 50 };
            const p2 = nodePositions[link.target] || { x: 600, y: 150 };
            const isPending = link.timestamp === 'PENDING';

            return (
              <g key={idx}>
                {/* Link line */}
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={isPending ? '#ef4444' : '#334155'}
                  strokeWidth={isPending ? 2.5 : 1.8}
                  strokeDasharray={isPending ? '5,4' : 'none'}
                  markerEnd={isPending ? 'url(#arrow-active)' : 'url(#arrow)'}
                  className={isPending ? 'animate-pulse' : ''}
                />

                {/* Animated flowing money particle */}
                <circle r="3" fill={isPending ? '#f43f5e' : '#38bdf8'}>
                  <animateMotion
                    path={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
                    dur={`${2.2 + (idx % 3) * 0.4}s`}
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Amount Label on Edge */}
                <text
                  x={(p1.x + p2.x) / 2}
                  y={(p1.y + p2.y) / 2 - 6}
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                  className="bg-slate-900 font-bold"
                >
                  {link.currency} {link.amount.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {graphData.nodes.map((node) => {
            const pos = nodePositions[node.id] || { x: 100, y: 100 };
            const isHovered = hoveredNode?.id === node.id;
            const nodeColor = getNodeColor(node);
            const isSuspect = node.type === 'SUSPECT_TARGET';

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer group"
              >
                {/* Outer Pulse Ring for Flagged Hub */}
                {isSuspect && node.riskScore >= 70 && (
                  <circle
                    r="24"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    opacity="0.4"
                    className="animate-ping"
                  />
                )}

                {/* Main Node Body */}
                <circle
                  r={isSuspect ? 18 : 14}
                  fill="#1e293b"
                  stroke={nodeColor}
                  strokeWidth={isHovered ? 3 : 2}
                  filter={isSuspect && node.riskScore >= 70 ? 'url(#glow-suspect)' : undefined}
                  className="transition-all duration-200"
                />

                {/* Node Center Pip / Icon representation */}
                <circle
                  r={isSuspect ? 6 : 4}
                  fill={nodeColor}
                />

                {/* Node Label Below */}
                <text
                  y={isSuspect ? 30 : 25}
                  fill="#e2e8f0"
                  fontSize="10"
                  fontFamily="Inter, sans-serif"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {node.label}
                </text>

                {/* Country and Risk score sublabel */}
                <text
                  y={isSuspect ? 41 : 36}
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                >
                  {node.country} • {node.riskScore}% Risk
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hovered Node Tooltip Overlay */}
        {hoveredNode && (
          <div className="absolute top-2 left-2 bg-slate-900/95 border border-slate-700 rounded p-2 text-xs font-mono shadow-xl backdrop-blur-md z-20 pointer-events-none">
            <div className="flex items-center justify-between gap-3 text-slate-200 font-bold mb-1">
              <span>{hoveredNode.label}</span>
              <span className="text-amber-400 font-bold">{hoveredNode.riskScore}% Mule Risk</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Account: <span className="text-slate-200">{hoveredNode.account}</span>
            </div>
            <div className="text-[10px] text-slate-400">
              Role: <span className="text-ibm-cyan uppercase">{hoveredNode.type.replace('_', ' ')}</span>
            </div>
            {hoveredNode.amount && (
              <div className="text-[10px] text-emerald-400 mt-0.5">
                Volume: ${hoveredNode.amount.toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Graph Footer Explanation */}
      <div className="p-2 border-t border-slate-700/80 bg-slate-950 text-[11px] font-mono text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-ibm-cyan">GNN Analysis:</span>
          <span>Layering fan-in detected from 2 multi-country intermediate hops into central beneficiary hub</span>
        </div>
        <div className="text-slate-500 text-[10px]">
          Hover nodes to inspect IBAN & Risk PageRank
        </div>
      </div>
    </div>
  );
};
