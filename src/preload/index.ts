import { contextBridge, ipcRenderer } from 'electron';
import type { AiRequest, AppApi, GeminiModelCatalog, Project, ProgramKind, Provider, Settings, TestCase, TestGenerationProgress, TestGroup, TestPlan, TestRunProgress } from '../shared/types';

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
  getGeminiModelCatalog: (): Promise<GeminiModelCatalog> => ipcRenderer.invoke('settings:gemini-model-catalog'),
  resetOperationCancellation: () => ipcRenderer.invoke('operation:reset-cancellation'),
  cancelCurrentOperation: () => ipcRenderer.invoke('operation:cancel-current'),
  saveSettings: (settings: Settings) => ipcRenderer.invoke('settings:save', settings),
  saveApiKey: (provider: Provider, key: string) => ipcRenderer.invoke('settings:key:save', provider, key),
  removeApiKey: (provider: Provider) => ipcRenderer.invoke('settings:key:remove', provider),
  hasApiKey: (provider: Provider) => ipcRenderer.invoke('settings:key:has', provider),
  testAiConnection: (request: AiRequest) => ipcRenderer.invoke('ai:test', request),
  askAi: (request: AiRequest) => ipcRenderer.invoke('ai:ask', request),
  chooseCompiler: () => ipcRenderer.invoke('settings:compiler:choose'),
  chooseDocumentTools: () => ipcRenderer.invoke('settings:document-tools:choose'),
  compile: (projectId: string, kind: ProgramKind, source: string) => ipcRenderer.invoke('code:compile', projectId, kind, source),
  run: (projectId: string, kind: ProgramKind, input: string, args?: string[], timeoutMs?: number) => ipcRenderer.invoke('code:run', projectId, kind, input, args, timeoutMs),
  generateTests: (projectId: string, plan: TestPlan, seed: number, source: string, validator: string, statementVersion: string, excludedHashes: string[] = []) => ipcRenderer.invoke('tests:generate', projectId, plan, seed, source, validator, statementVersion, excludedHashes),
  regenerateTest: (projectId: string, group: TestGroup, seed: number, testIndex: number, source: string, validator: string, statementVersion: string, excludedHashes: string[]) => ipcRenderer.invoke('tests:regenerate-one', projectId, group, seed, testIndex, source, validator, statementVersion, excludedHashes),
  onGenerationProgress: (callback: (progress: TestGenerationProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: TestGenerationProgress) => callback(progress);
    ipcRenderer.on('tests:generation-progress', listener);
    return () => ipcRenderer.removeListener('tests:generation-progress', listener);
  },
  runTests: (projectId: string, solution: string, tests: TestCase[], timeLimitMs: number, testIds?: string[], oracleSolution?: string) => ipcRenderer.invoke('tests:run', projectId, solution, tests, timeLimitMs, testIds, oracleSolution),
  onTestRunProgress: (callback: (progress: TestRunProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: TestRunProgress) => callback(progress);
    ipcRenderer.on('tests:run-progress', listener);
    return () => ipcRenderer.removeListener('tests:run-progress', listener);
  },
  exportThemis: (project: Project) => ipcRenderer.invoke('export:themis', project),
  exportMarkdown: (project: Project) => ipcRenderer.invoke('export:markdown', project),
  exportPdf: (project: Project) => ipcRenderer.invoke('export:pdf', project),
  exportDocx: (project: Project) => ipcRenderer.invoke('export:docx', project),
  exportAll: (project: Project) => ipcRenderer.invoke('export:all', project),
  openDirectory: (directory: string) => ipcRenderer.invoke('export:open-directory', directory),
};

contextBridge.exposeInMainWorld('studio', api);
