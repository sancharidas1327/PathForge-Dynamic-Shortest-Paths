import React, { useRef, useState } from 'react';
import { EngineEdgeState, GraphNode } from '../types/pathforge';
import { ZoomIn, ZoomOut, Maximize2, Eye, GitBranch } from 'lucide-react';

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: EngineEdgeState[];
  distances: number[];
  source: number;
  targetVertex: number;
  affectedVertices: number[];
  recomputedVertices: number[];
  selectedPathEdges: number[];
  updatedEdgeId?: number;
  onMoveNode?: (id: number, x: number, y: number) => void;
  onSelectEdge?: (edge: EngineEdgeState) => void;
  onSelectNode?: (nodeId: number) => void;
  height?: number;
  interactive?: boolean;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  edges,
  distances,
  source,
  targetVertex,
  affectedVertices,
  recomputedVertices,
  selectedPathEdges,
  updatedEdgeId,
  onMoveNode,
  onSelectEdge,
  onSelectNode,
  height = 500,
  interactive = true,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingNode, setDraggingNode] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [treeOnlyOverlay, setTreeOnlyOverlay] = useState<boolean>(false);

  const affectedSet = new Set(affectedVertices);
  const recomputedSet = new Set(recomputedVertices);
  const selectedPathSet = new Set(selectedPathEdges);

  // Group parallel edges between same (u, v) to offset curves cleanly
  const pairCounts = new Map<string, number>();
  const pairIndices = new Map<number, number>();
  edges.forEach((e) => {
    const key = `${e.u}->${e.v}`;
    const c = pairCounts.get(key) || 0;
    pairIndices.set(e.id, c);
    pairCounts.set(key, c + 1);
  });

  const handleMouseDownSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive) return;
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'canvas-bg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMoveSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive) return;
    if (draggingNode !== null && onMoveNode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left - pan.x) / zoom);
      const y = Math.round((e.clientY - rect.top - pan.y) / zoom);
      onMoveNode(draggingNode, Math.max(40, Math.min(880, x)), Math.max(40, Math.min(height - 40, y)));
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUpSvg = () => {
    setDraggingNode(null);
    setIsPanning(false);
  };

  const nodeMap = new Map<number, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  return (
    <div className="relative w-full rounded-xl border border-slate-800/90 bg-[#080b12] overflow-hidden shadow-inner">
      {/* Top Toolbar Overlay */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 pointer-events-auto">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-[0_0_8px_#22d3ee]" />
            Tree Edge (T)
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_#34d399]" />
            Shortest Path
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            Updated Edge
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            Closed / Invalidated
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block" />
            Affected Subtree
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 rounded-lg pointer-events-auto">
          <button
            type="button"
            onClick={() => setTreeOnlyOverlay(!treeOnlyOverlay)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
              treeOnlyOverlay
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Toggle Shortest-Path Tree T Overlay"
          >
            <GitBranch className="w-3.5 h-3.5" />
            {treeOnlyOverlay ? 'Tree T Only' : 'All Edges'}
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.55, +(z - 0.15).toFixed(2)))}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1.0);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
            title="Reset View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 920 ${height}`}
        style={{ height: `${height}px` }}
        className="w-full select-none cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDownSvg}
        onMouseMove={handleMouseMoveSvg}
        onMouseUp={handleMouseUpSvg}
        onMouseLeave={handleMouseUpSvg}
      >
        <defs>
          <pattern id="pf-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148, 163, 184, 0.06)" strokeWidth="1" />
          </pattern>
          <marker id="arrow-normal" viewBox="0 0 10 10" refX="25" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
          </marker>
          <marker id="arrow-tree" viewBox="0 0 10 10" refX="23" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#22d3ee" />
          </marker>
          <marker id="arrow-path" viewBox="0 0 10 10" refX="23" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#34d399" />
          </marker>
          <marker id="arrow-updated" viewBox="0 0 10 10" refX="23" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#fb923c" />
          </marker>
          <marker id="arrow-closed" viewBox="0 0 10 10" refX="25" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
          </marker>
          <marker id="arrow-subtree" viewBox="0 0 10 10" refX="23" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#a78bfa" />
          </marker>
        </defs>

        <rect id="canvas-bg" width="920" height={height} fill="url(#pf-grid)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Render Edges */}
          {edges.map((e) => {
            if (treeOnlyOverlay && !e.in_tree) return null;
            const uNode = nodeMap.get(e.u);
            const vNode = nodeMap.get(e.v);
            if (!uNode || !vNode) return null;

            const isPath = selectedPathSet.has(e.id) && e.live;
            const isUpdated = updatedEdgeId === e.id;
            const isClosed = !e.live;
            const isSubtreeEdge = e.in_tree && (affectedSet.has(e.v) || recomputedSet.has(e.v));
            const isTree = e.in_tree;

            let stroke = '#475569';
            let strokeWidth = 1.75;
            let dashArray = 'none';
            let marker = 'url(#arrow-normal)';
            let opacity = 0.72;

            if (isClosed) {
              stroke = '#f43f5e';
              strokeWidth = 1.75;
              dashArray = '6,5';
              marker = 'url(#arrow-closed)';
              opacity = 0.65;
            } else if (isUpdated) {
              stroke = '#fb923c';
              strokeWidth = 3.2;
              marker = 'url(#arrow-updated)';
              opacity = 1;
            } else if (isPath) {
              stroke = '#34d399';
              strokeWidth = 3.4;
              marker = 'url(#arrow-path)';
              opacity = 1;
            } else if (isSubtreeEdge) {
              stroke = '#a78bfa';
              strokeWidth = 2.8;
              marker = 'url(#arrow-subtree)';
              opacity = 0.95;
            } else if (isTree) {
              stroke = '#22d3ee';
              strokeWidth = 2.6;
              marker = 'url(#arrow-tree)';
              opacity = 0.95;
            }

            const idx = pairIndices.get(e.id) || 0;
            const dx = vNode.x - uNode.x;
            const dy = vNode.y - uNode.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            const nx = -dy / len;
            const ny = dx / len;
            const curveOffset = idx === 0 ? 0 : (idx % 2 === 1 ? 26 * Math.ceil(idx / 2) : -26 * Math.ceil(idx / 2));

            const mx = (uNode.x + vNode.x) / 2 + nx * curveOffset;
            const my = (uNode.y + vNode.y) / 2 + ny * curveOffset;

            const pathD =
              curveOffset === 0
                ? `M ${uNode.x} ${uNode.y} L ${vNode.x} ${vNode.y}`
                : `M ${uNode.x} ${uNode.y} Q ${mx} ${my} ${vNode.x} ${vNode.y}`;

            const labelX = curveOffset === 0 ? mx : (uNode.x + 2 * mx + vNode.x) / 4;
            const labelY = curveOffset === 0 ? my : (uNode.y + 2 * my + vNode.y) / 4;

            return (
              <g
                key={e.id}
                onClick={() => onSelectEdge && onSelectEdge(e)}
                className="cursor-pointer group"
                style={{ opacity }}
              >
                <path d={pathD} fill="none" stroke="transparent" strokeWidth={14} />
                <path
                  d={pathD}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  markerEnd={marker}
                  className="transition-all duration-300"
                />
                <g transform={`translate(${labelX}, ${labelY})`}>
                  <rect
                    x={-16}
                    y={-10}
                    width={32}
                    height={19}
                    rx={5}
                    fill="#0c1018"
                    stroke={stroke}
                    strokeWidth={1}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <text
                    textAnchor="middle"
                    dy="3.5"
                    className="text-[10px] font-mono fill-slate-200 font-medium"
                  >
                    {e.weight}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Render Nodes */}
          {nodes.map((n) => {
            const dist = distances[n.id] !== undefined ? distances[n.id] : -1;
            const isSource = n.id === source;
            const isTarget = n.id === targetVertex;
            const isAffected = affectedSet.has(n.id);
            const isRecomputed = recomputedSet.has(n.id);

            let ringColor = '#334155';
            let fillBg = '#0f172a';
            let pulseGlow = false;

            if (isSource) {
              ringColor = '#22d3ee';
              fillBg = '#083344';
            } else if (isTarget) {
              ringColor = '#34d399';
              fillBg = '#064e3b';
            } else if (isAffected) {
              ringColor = '#f43f5e';
              fillBg = '#4c0519';
              pulseGlow = true;
            } else if (isRecomputed) {
              ringColor = '#a78bfa';
              fillBg = '#2e1065';
              pulseGlow = true;
            }

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (interactive) setDraggingNode(n.id);
                  if (onSelectNode) onSelectNode(n.id);
                }}
                className="cursor-pointer"
              >
                {pulseGlow && (
                  <circle
                    r={27}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth={2}
                    strokeOpacity={0.45}
                    className="animate-ping"
                  />
                )}
                <circle
                  r={21}
                  fill={fillBg}
                  stroke={ringColor}
                  strokeWidth={2.5}
                  className="transition-colors duration-300 shadow-lg"
                />
                <text
                  textAnchor="middle"
                  dy="-2"
                  className="text-[11px] font-semibold fill-slate-100 pointer-events-none"
                >
                  v{n.id}
                </text>
                <text
                  textAnchor="middle"
                  dy="11"
                  className="text-[9.5px] font-mono fill-cyan-300 pointer-events-none"
                >
                  {dist < 0 ? '∞' : `d=${dist}`}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
