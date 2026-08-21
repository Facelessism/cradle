import React, { useState, useRef } from 'react';
import { GitCommit, Layout, Workflow, Network, Download, Copy, Check, RefreshCw } from 'lucide-react';

const DIAGRAM_TEMPLATES = {
  flowchart: {
    name: 'Process Flowchart',
    icon: Workflow,
    defaultData: `[Start] -> (Validate Input)
(Validate Input) ? {Valid?}
{Valid?} -- Yes --> [Process Data]
{Valid?} -- No --> [Show Error]
[Process Data] -> [Save to DB] -> [End]`
  },
  pipeline: {
    name: 'CI/CD Pipeline',
    icon: Layout,
    defaultData: `[Code Commit] -> [Lint & Test] -> [Docker Build] -> [Security Scan] -> [Production Deploy]`
  },
  mindmap: {
    name: 'Mind Map',
    icon: Network,
    defaultData: `(Central Topic)
-- Branch A --> [Idea 1]
-- Branch A --> [Idea 2]
-- Branch B --> [Sub-system X]
-- Branch B --> [Sub-system Y]`
  },
  timeline: {
    name: 'Roadmap Timeline',
    icon: GitCommit,
    defaultData: `[Q1 2026] : Discovery & Wireframing
[Q2 2026] : MVP Development & Alpha Testing
[Q3 2026] : Public Beta Launch
[Q4 2026] : Enterprise Scaling & Audit`
  }
};

export default function DiagramToolkit() {
  const [activeType, setActiveType] = useState('flowchart');
  const [inputData, setInputData] = useState(DIAGRAM_TEMPLATES.flowchart.defaultData);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  // Handle template switching
  const handleTemplateChange = (type) => {
    setActiveType(type);
    setInputData(DIAGRAM_TEMPLATES[type].defaultData);
  };

  // Copy raw diagram text
  const handleCopy = () => {
    navigator.clipboard.writeText(inputData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check reduced motion preference
  const prefersReducedMotion = () => 
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl text-zinc-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Diagram & Visual Planning Toolkit</h2>
          <p className="text-sm text-zinc-400">Generate lightweight structural maps, pipelines, and flowcharts instantly.</p>
        </div>
        
        {/* Template Selector Tabs */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(DIAGRAM_TEMPLATES).map(([key, template]) => {
            const Icon = template.icon;
            const isActive = activeType === key;
            return (
              <button
                key={key}
                onClick={() => handleTemplateChange(key)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all min-h-[40px] cursor-pointer ${
                  isActive 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                } motion-safe:hover:scale-102`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{template.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Editor Panel */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label htmlFor="diagram-syntax" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Diagram Syntax / Nodes
            </label>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
          <textarea
            id="diagram-syntax"
            value={inputData}
            onChange={(e) => setInputData(e.target.value)}
            rows={10}
            className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-sm font-mono text-zinc-200 focus:outline-none focus:border-purple-500 transition-colors resize-y shadow-inner"
            placeholder="Type your structural nodes here..."
          />
          <p className="text-xs text-zinc-500">Tip: Use arrows (`->`) to connect nodes and define flow steps.</p>
        </div>

        {/* Live Visual Preview Panel */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Visual Preview Canvas
            </span>
            <span className="text-xs text-purple-400 font-mono">Live Render</span>
          </div>
          
          <div 
            ref={canvasRef}
            className="w-full h-64 sm:h-[280px] bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col justify-center items-center overflow-auto shadow-inner relative"
          >
            {/* Visual Node Rendering simulation based on input lines */}
            <div className="flex flex-col items-center gap-3 w-full max-w-sm">
              {inputData.split('\n').filter(Boolean).map((line, idx) => (
                <div key={idx} className="flex flex-col items-center w-full">
                  <div className={`px-4 py-2.5 bg-zinc-900 border border-purple-500/40 rounded-lg text-xs font-medium text-purple-200 shadow-md text-center w-full truncate transition-transform ${
                    prefersReducedMotion() ? '' : 'motion-safe:hover:scale-102'
                  }`}>
                    {line}
                  </div>
                  {idx < inputData.split('\n').filter(Boolean).length - 1 && (
                    <div className="w-0.5 h-4 bg-purple-500/50 my-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
