export type Provider = 'openai' | 'gemini';
export type ProgramKind = 'generator' | 'solution' | 'validator';
export type TestStatus = 'pending' | 'passed' | 'failed' | 'timeout' | 'invalid';

export interface TestCase {
  id: string;
  name: string;
  input: string;
  output: string;
  status: TestStatus;
  stderr?: string;
  runtimeMs?: number;
}

export interface ProjectImage {
  id: string;
  name: string;
  mimeType: string;
  addedAt: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  statement: string;
  generator: string;
  solution: string;
  validator: string;
  images: ProjectImage[];
  tests: TestCase[];
  generatorMode: 'random' | 'boundary' | 'constructive' | 'stress';
  seed: number;
  timeLimitMs: number;
}

export interface Settings {
  onboardingComplete: boolean;
  provider: Provider;
  models: Record<Provider, string>;
  compilerPath: string;
  pandocPath: string;
  theme: 'light' | 'dark';
}

export interface AiRequest {
  provider?: Provider;
  model?: string;
  prompt: string;
  image?: { data: string; mimeType: string };
  maxOutputTokens?: number;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  runtimeMs: number;
  timedOut: boolean;
  outputLimited: boolean;
}

export interface CompileResult {
  ok: boolean;
  diagnostics: string;
  compiler: string;
}

export interface AppApi {
  getStatus(): Promise<{ compilerAvailable: boolean; compiler: string; onboardingComplete: boolean }>;
  listProjects(): Promise<Project[]>;
  createProject(name: string): Promise<Project>;
  saveProject(project: Project): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  chooseProjectFolder(id: string): Promise<string | null>;
  saveProjectImage(projectId: string, name: string, mimeType: string, data: string): Promise<ProjectImage>;
  readProjectImage(projectId: string, imageId: string): Promise<{ data: string; mimeType: string } | null>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  saveApiKey(provider: Provider, key: string): Promise<void>;
  removeApiKey(provider: Provider): Promise<void>;
  hasApiKey(provider: Provider): Promise<boolean>;
  testAiConnection(request: AiRequest): Promise<string>;
  askAi(request: AiRequest): Promise<string>;
  chooseCompiler(): Promise<string | null>;
  choosePandoc(): Promise<string | null>;
  compile(projectId: string, kind: ProgramKind, source: string): Promise<CompileResult>;
  run(projectId: string, kind: ProgramKind, input: string, args?: string[], timeoutMs?: number): Promise<RunResult>;
  generateTests(projectId: string, count: number, seed: number, mode: string, source: string): Promise<TestCase[]>;
  runTests(projectId: string, solution: string, tests: TestCase[], timeLimitMs: number): Promise<TestCase[]>;
  exportThemis(project: Project): Promise<string | null>;
  exportMarkdown(project: Project): Promise<string | null>;
  exportPdf(project: Project): Promise<string | null>;
  exportDocx(project: Project): Promise<string | null>;
  exportAll(project: Project): Promise<{ directory: string; files: string[] } | null>;
}
