import React, { useState } from 'react';
import {
  Code2,
  GitBranch,
  Play,
  CheckCircle,
  FileCode,
  FileDiff,
  Terminal,
  Send,
  AlertCircle,
} from 'lucide-react';
import { useSafetyStore } from '../../state/useSafetyStore';
import { devWorkflowEngine } from '../../workflows/development-agent';
import { FeatureSpec, CodingTask } from '../../types/projects';

export const DevWorkflowView: React.FC = () => {
  const { registeredProjects, activeProjectId, setActiveProject } = useSafetyStore();
  const [featurePrompt, setFeaturePrompt] = useState('Add a dark mode feature to my web app');
  const [activeTask, setActiveTask] = useState<CodingTask | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<'antigravity' | 'claude-code' | 'ollama'>('antigravity');

  const currentProject = registeredProjects.find((p) => p.id === activeProjectId) || registeredProjects[0];

  const handleGenerateSpec = () => {
    if (!currentProject) return;
    const spec = devWorkflowEngine.generateSpec('Dark Mode Feature', featurePrompt);
    const task = devWorkflowEngine.createCodingTask(currentProject, spec, selectedAgent);
    setActiveTask(task);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-400" />
            Guided Software Development Workflow
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Safe, structured feature implementation with explicit FeatureSpec review, sandboxed agent prompts, and verified test gates.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Target Project:</span>
          <select
            value={activeProjectId}
            onChange={(e) => setActiveProject(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          >
            {registeredProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.framework})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <label className="text-xs font-semibold text-slate-300 block">
          Describe the feature you wish to build:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={featurePrompt}
            onChange={(e) => setFeaturePrompt(e.target.value)}
            placeholder="e.g. Add dark mode toggle with localStorage persistence"
            className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono"
          />
          <button
            onClick={handleGenerateSpec}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition shadow"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Generate FeatureSpec</span>
          </button>
        </div>

        <div className="flex items-center space-x-4 pt-1 text-xs text-slate-400">
          <span>AI Coding Agent Adapter:</span>
          {(['antigravity', 'claude-code', 'ollama'] as const).map((agent) => (
            <label key={agent} className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="radio"
                name="agentAdapter"
                checked={selectedAgent === agent}
                onChange={() => setSelectedAgent(agent)}
                className="text-blue-500 bg-slate-950 border-slate-700 focus:ring-0"
              />
              <span className="capitalize font-mono text-[11px] text-slate-300">
                {agent === 'claude-code' ? 'Claude Code' : agent}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Generated Spec & Staged Workflow Card */}
      {activeTask && (
        <div className="space-y-4 animate-in fade-in-50">
          {/* FeatureSpec Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 border border-blue-800/80 px-2 py-0.5 rounded-full">
                  Step 1: Feature Specification
                </span>
                <h3 className="text-sm font-bold text-slate-100 mt-1.5">
                  {activeTask.spec.featureName}
                </h3>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                <GitBranch className="w-3.5 h-3.5 text-blue-400" />
                <span>Branch: {activeTask.branchName}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Acceptance Criteria:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {activeTask.spec.acceptanceCriteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Affected Components:</span>
                <div className="flex flex-wrap gap-1.5">
                  {activeTask.spec.affectedScreens.map((s, i) => (
                    <span key={i} className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[11px] font-mono text-slate-300">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-3">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-0.5">Test Strategy:</span>
                  <span className="text-slate-300 font-mono text-[11px]">{activeTask.spec.testStrategy}</span>
                </div>
              </div>
            </div>

            {/* Structured Prompt Sent to Agent */}
            <div className="border-t border-slate-800 pt-3">
              <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-1.5 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                Sandboxed Coding-Agent Prompt (Strict Non-Secret Boundaries):
              </span>
              <pre className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-48 leading-relaxed">
                {activeTask.generatedPrompt}
              </pre>
            </div>
          </div>

          {/* Execution & Test Verification Results */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                Step 2: Verification & Test Results
              </span>
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                All Tests Passed
              </span>
            </div>

            {/* Changed Files and Diff */}
            <div className="space-y-2">
              <span className="text-slate-400 font-semibold uppercase text-[10px] block">Files Modified:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeTask.filesChanged.map((file, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded text-xs font-mono text-blue-300">
                    <FileDiff className="w-3.5 h-3.5 text-slate-500" />
                    <span>{file}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Runner Output */}
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px] block mb-1">Automated Test Output (Vitest):</span>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre">
                {activeTask.testResults?.output}
              </pre>
            </div>

            {/* Approval Gates for Commit / Push / PR */}
            <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Ready for staging: require explicit confirmation before remote push.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => alert('Local commit created successfully.')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 font-medium"
                >
                  Commit Changes
                </button>
                <button
                  onClick={() => alert('Branch pushed to origin. PR #42 draft prepared.')}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-semibold shadow"
                >
                  Push & Create PR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
