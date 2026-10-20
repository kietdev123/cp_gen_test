export type Provider = 'openai' | 'gemini';
export type ProgramKind = 'generator' | 'solution' | 'validator' | 'oracle';
export type IoMode = 'stdin-stdout' | 'file-io';
export type GeneratorMode = 'random' | 'boundary' | 'constructive' | 'stress';
export type TestStatus = 'pending' | 'running' | 'generated' | 'verified' | 'duplicate' | 'failed' | 'timeout' | 'invalid' | 'error' | 'passed';

export interface ProblemSpec {
  summary: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  statementVersion: string;
}

export interface TestGroup {
  id: string;
  name: string;
  description: string;
  mode: GeneratorMode;
  count: number;
  params: Record<string, string>;
}

export interface TestPlan {
  problemSpec: ProblemSpec;
  groups: TestGroup[];
  updatedAt: string;
}

export interface TestGenerationLog {
  id: string;
  createdAt: string;
  requested: number;
  generated: number;
  duplicates: number;
  invalid: number;
  errors: number;
  retries: number;
  warnings: string[];
}

export interface TestGenerationResult {
  tests: TestCase[];
  log: TestGenerationLog;
}

export interface TestGenerationProgress {
  current: number;
  total: number;
  generated: number;
  duplicates: number;
  invalid: number;
  errors: number;
}

export interface TestRunProgress {
  current: number;
  total: number;
  completed: number;
  errors: number;
}

export interface TestCaseRecord {
  id: string;
  name: string;
  input: string;
  output: string;
  status: TestStatus;
  stderr?: string;
  runtimeMs?: number;
  groupId?: string;
  groupName?: string;
  testIndex?: number;
  seed?: number;
  mode?: GeneratorMode;
  params?: Record<string, string>;
  sha256?: string;
  statementVersion?: string;
  generatorVersion?: string;
  solutionVersion?: string;
  inputStale?: boolean;
  outputStale?: boolean;
}

export type TestCase = TestCaseRecord;

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AiResponse {
  text: string;
  usage?: AiUsage;
  cached?: boolean;
}

export interface AiCachedResult {
  provider: Provider;
  model: string;
  promptVersion: string;
  response: AiResponse;
  savedAt: string;
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
  ioMode: IoMode;
  generator: string;
  solution: string;
  solutionGuide: string;
  validator: string;
  images: ProjectImage[];
  tests: TestCase[];
  testPlan: TestPlan;
  generationLogs: TestGenerationLog[];
  aiCache: Record<string, AiCachedResult>;
  generatorMode: GeneratorMode;
  seed: number;
  timeLimitMs: number;
  oracleSolution?: string;
}

export interface Settings {
  onboardingComplete: boolean;
  provider: Provider;
  models: Record<Provider, string>;
  compilerPath: string;
  documentToolsPath: string;
  theme: 'light' | 'dark';
  themisInputFile: string;
  themisOutputFile: string;
}

export interface GeminiModelInfo {
  id: string;
  shutdownDate: string;
  replacement: string;
  recommended: boolean;
  shutdown: boolean;
  preview: boolean;
}

export interface GeminiModelCatalog {
  models: GeminiModelInfo[];
  fetchedAt: string;
  stale: boolean;
  warning?: string;
}

export interface AiRequest {
  provider?: Provider;
  model?: string;
  prompt: string;
  image?: { data: string; mimeType: string };
  maxOutputTokens?: number;
  outputFormat?: 'text' | 'json';
  projectId?: string;
  promptVersion?: string;
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
  getGeminiModelCatalog(): Promise<GeminiModelCatalog>;
  resetOperationCancellation(): Promise<void>;
  cancelCurrentOperation(): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  saveApiKey(provider: Provider, key: string): Promise<void>;
  removeApiKey(provider: Provider): Promise<void>;
  hasApiKey(provider: Provider): Promise<boolean>;
  testAiConnection(request: AiRequest): Promise<string>;
  askAi(request: AiRequest): Promise<AiResponse>;
  chooseCompiler(): Promise<string | null>;
  chooseDocumentTools(): Promise<string | null>;
  compile(projectId: string, kind: ProgramKind, source: string): Promise<CompileResult>;
  run(projectId: string, kind: ProgramKind, input: string, args?: string[], timeoutMs?: number, ioOptions?: { mode: IoMode; inputFile: string; outputFile: string }): Promise<RunResult>;
  generateTests(projectId: string, plan: TestPlan, seed: number, source: string, validator: string, statementVersion: string, excludedHashes?: string[]): Promise<TestGenerationResult>;
  regenerateTest(projectId: string, group: TestGroup, seed: number, testIndex: number, source: string, validator: string, statementVersion: string, excludedHashes: string[]): Promise<TestCase>;
  onGenerationProgress(callback: (progress: TestGenerationProgress) => void): () => void;
  runTests(projectId: string, solution: string, tests: TestCase[], timeLimitMs: number, testIds?: string[], oracleSolution?: string, ioOptions?: { mode: IoMode; inputFile: string; outputFile: string }): Promise<TestCase[]>;
  onTestRunProgress(callback: (progress: TestRunProgress) => void): () => void;
  exportThemis(project: Project): Promise<string | null>;
  exportMarkdown(project: Project): Promise<string | null>;
  exportPdf(project: Project): Promise<string | null>;
  exportDocx(project: Project): Promise<string | null>;
  exportAll(project: Project): Promise<{ directory: string; files: string[] } | null>;
  openDirectory(directory: string): Promise<void>;
}
