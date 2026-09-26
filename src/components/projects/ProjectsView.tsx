import React, { useState } from 'react';
import { FolderGit2, Plus, Terminal, CheckCircle2, ShieldCheck, Folder } from 'lucide-react';
import { useSafetyStore } from '../../state/useSafetyStore';
import { RegisteredProject } from '../../types/projects';

export const ProjectsView: React.FC = () => {
  const { registeredProjects, addProject, activeProjectId, setActiveProject } = useSafetyStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [framework, setFramework] = useState('React / Vite');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rootPath.trim()) return;

    const newProject: RegisteredProject = {
      id: `proj-${Date.now()}`,
      name: name.trim(),
      rootPath: rootPath.trim(),
      defaultBranch: 'main',
      framework,
      allowedCommands: ['npm test', 'npm run dev', 'npm run build', 'npm run lint', 'git status', 'git diff'],
      packageScripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        test: 'vitest',
      },
      instructions: '# Project Conventions\n- macOS native dark UI\n- Strict zero-secret policy\n- Vitest tests required',
      createdAt: new Date().toISOString(),
    };

    addProject(newProject);
    setShowAddModal(false);
    setName('');
    setRootPath('');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-blue-400" />
            Approved Project Workspaces
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Janki only operates inside explicitly registered project directories. Arbitrary filesystem execution is prohibited.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium shadow transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {registeredProjects.map((project) => {
          const isSelected = project.id === activeProjectId;
          return (
            <div
              key={project.id}
              onClick={() => setActiveProject(project.id)}
              className={`bg-slate-900 border rounded-xl p-5 cursor-pointer transition space-y-3 ${
                isSelected
                  ? 'border-blue-500/80 shadow-lg ring-1 ring-blue-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-blue-950/60 rounded-lg border border-blue-800/60 text-blue-400">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">{project.name}</h3>
                    <span className="text-[10px] text-slate-400 font-mono">{project.framework}</span>
                  </div>
                </div>

                {isSelected ? (
                  <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-800 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    ACTIVE
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">Click to activate</span>
                )}
              </div>

              {/* Path */}
              <div className="bg-slate-950 p-2 rounded text-[11px] font-mono text-slate-300 border border-slate-800/80 truncate">
                {project.rootPath}
              </div>

              {/* Allowed Commands */}
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Allowed Commands Catalog:
                </span>
                <div className="flex flex-wrap gap-1">
                  {project.allowedCommands.map((cmd, i) => (
                    <span
                      key={i}
                      className="bg-slate-950 text-slate-300 border border-slate-800 text-[10px] font-mono px-2 py-0.5 rounded"
                    >
                      {cmd}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Register Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRegister}
            className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Register Approved Project Directory
            </h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Project Name:</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Next.js Web App"
                className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Absolute Directory Path:</label>
              <input
                type="text"
                required
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="/Users/username/Projects/my-app"
                className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Framework / Runtime:</label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-xs text-slate-200 font-mono"
              >
                <option value="React / Vite">React / Vite</option>
                <option value="Next.js">Next.js</option>
                <option value="Node / TypeScript">Node / TypeScript</option>
                <option value="Python / FastAPI">Python / FastAPI</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow"
              >
                Save Registration
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
