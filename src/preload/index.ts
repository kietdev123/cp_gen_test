import { contextBridge, ipcRenderer } from 'electron';
import type { AiRequest, AppApi, Project, ProgramKind, Provider, Settings, TestCase } from '../shared/types';

const api: AppApi = {
  getStatus: () => ipcRenderer.invoke('app:status'),
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (name: string) => ipcRenderer.invoke('projects:create', name),
  saveProject: (project: Project) => ipcRenderer.invoke('projects:save', project),
  deleteProject: (id: string) => ipcRenderer.invoke('projects:delete', id),
  chooseProjectFolder: (id: string) => ipcRenderer.invoke('projects:choose-folder', id),
  saveProjectImage: (projectId: string, name: string, mimeType: string, data: string) => ipcRenderer.invoke('projects:image:save', projectId, name, mimeType, data),
  readProjectImage: (projectId: string, imageId: string) => ipcRenderer.invoke('projects:image:read', projectId, imageId),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Settings) => ipcRenderer.invoke('settings:save', settings),
  saveApiKey: (provider: Provider, key: string) => ipcRenderer.invoke('settings:key:save', provider, key),
  removeApiKey: (provider: Provider) => ipcRenderer.invoke('settings:key:remove', provider),
  hasApiKey: (provider: Provider) => ipcRenderer.invoke('settings:key:has', provider),
  testAiConnection: (request: AiRequest) => ipcRenderer.invoke('ai:test', request),
  askAi: (request: AiRequest) => ipcRenderer.invoke('ai:ask', request),
  chooseCompiler: () => ipcRenderer.invoke('settings:compiler:choose'),
  compile: (projectId: string, kind: ProgramKind, source: string) => ipcRenderer.invoke('code:compile', projectId, kind, source),
  run: (projectId: string, kind: ProgramKind, input: string, args?: string[], timeoutMs?: number) => ipcRenderer.invoke('code:run', projectId, kind, input, args, timeoutMs),
  generateTests: (projectId: string, count: number, seed: number, mode: string, source: string) => ipcRenderer.invoke('tests:generate', projectId, count, seed, mode, source),
  runTests: (projectId: string, solution: string, tests: TestCase[], timeLimitMs: number) => ipcRenderer.invoke('tests:run', projectId, solution, tests, timeLimitMs),
  exportThemis: (project: Project) => ipcRenderer.invoke('export:themis', project),
  exportMarkdown: (project: Project) => ipcRenderer.invoke('export:markdown', project),
  exportPdf: (project: Project) => ipcRenderer.invoke('export:pdf', project),
  exportDocx: (project: Project) => ipcRenderer.invoke('export:docx', project),
  exportAll: (project: Project) => ipcRenderer.invoke('export:all', project),
};

contextBridge.exposeInMainWorld('studio', api);
