import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import archiver from 'archiver';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import type { AiCachedResult, AiRequest, AiResponse, CompileResult, GeminiModelCatalog, GeminiModelInfo, GeneratorMode, Project, ProgramKind, Provider, RunResult, Settings, TestCase, TestGenerationLog, TestGenerationProgress, TestGroup, TestPlan, TestRunProgress } from '../shared/types';
import { AI_PROMPT_VERSION, AI_PROMPTS } from '../shared/ai-prompts';
import { createDefaultTestPlan, normalizeProjectJson, TestGroupSchema, TestPlanSchema, statementVersion } from '../shared/validation';
import { DEFAULT_GENERATOR_TEMPLATE } from '../shared/generator-template';

const DEFAULT_SETTINGS: Settings = {
  onboardingComplete: false,
  provider: 'gemini',
  models: { openai: 'gpt-4.1-mini', gemini: 'gemini-2.5-flash' },
  compilerPath: '', documentToolsPath: '', theme: 'light', themisInputFile: 'BAI.INP', themisOutputFile: 'BAI.OUT',
};
const GEMINI_DEPRECATIONS_URL = 'https://ai.google.dev/gemini-api/docs/deprecations?hl=en';
let lastGeminiModelCatalog: GeminiModelCatalog | null = null;
let pendingGeminiModelCatalog: Promise<GeminiModelCatalog> | null = null;
let operationCancelled = false;
const activeChildProcesses = new Set<ChildProcessWithoutNullStreams>();
const activeAiAbortControllers = new Set<AbortController>();
const DEFAULT_GENERATOR = DEFAULT_GENERATOR_TEMPLATE;
const DEFAULT_SOLUTION = `#include <bits/stdc++.h>
using namespace std;
int main() {
    ios::sync_with_stdio(false); cin.tie(nullptr);
    // TODO: Dán lời giải C++17 của bạn tại đây.
    return 0;
}`;
const DEFAULT_PROJECT: Omit<Project, 'id' | 'name' | 'createdAt' | 'updatedAt'> = {
  statement: '',
  generator: DEFAULT_GENERATOR, solution: DEFAULT_SOLUTION, solutionGuide: '', validator: '', images: [], tests: [],
  testPlan: createDefaultTestPlan(), generationLogs: [], aiCache: {},
  generatorMode: 'random', seed: 2026, timeLimitMs: 2000, oracleSolution: '',
};

let mainWindow: BrowserWindow | null = null;
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const keysFile = () => path.join(app.getPath('userData'), 'secure-keys.json');
const projectsRoot = () => path.join(app.getPath('userData'), 'projects');
const buildRoot = () => path.join(app.getPath('userData'), 'build');
const testlibRoot = () => app.isPackaged ? path.join(process.resourcesPath, 'testlib') : path.join(app.getAppPath(), 'vendor', 'testlib');
let activeCompilerPath = '';

function shortWindowsPath(value: string): string {
  if (process.platform !== 'win32') return value;
  try {
    const result = spawnSync('cmd.exe', ['/d', '/c', 'for %I in ("%CP_STUDIO_COMPILER%") do @echo %~sI'], {
      env: { ...process.env, CP_STUDIO_COMPILER: value }, encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true,
    });
    const shortPath = result.stdout?.trim().split(/\r?\n/).pop();
    if (result.status === 0 && shortPath && !shortPath.includes(' ')) return shortPath;
  } catch { /* Keep the original path if Windows has no short-name alias. */ }
  return value;
}

function childEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  const extraDirs = [activeCompilerPath ? path.dirname(activeCompilerPath) : ''];
  env[pathKey] = [...new Set([...extraDirs, env[pathKey] ?? ''].filter(Boolean))].join(path.delimiter);
  if (process.platform === 'win32' && activeCompilerPath) {
    const compilerRoot = path.dirname(path.dirname(activeCompilerPath));
    env.GCC_EXEC_PREFIX = `${path.join(compilerRoot, 'lib', 'gcc')}${path.sep}`;
  }
  return env;
}
const safeId = (value: string) => /^[a-f0-9-]{8,64}$/i.test(value);
const projectPath = (id: string) => {
  if (!safeId(id)) throw new Error('Mã dự án không hợp lệ.');
  return path.join(projectsRoot(), id);
};
const projectFile = (id: string) => path.join(projectPath(id), 'project.json');

async function readSettings(): Promise<Settings> {
  try {
    const savedSettings = JSON.parse(await fs.readFile(settingsFile(), 'utf8')) as Record<string, unknown>;
    delete savedSettings.themisTestPrefix;
    const saved = savedSettings as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...saved, provider: 'gemini', models: { ...DEFAULT_SETTINGS.models, ...saved.models } };
  }
  catch { return { ...DEFAULT_SETTINGS, models: { ...DEFAULT_SETTINGS.models } }; }
}

function htmlText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
}

function parseGeminiModelCatalog(html: string): GeminiModelInfo[] {
  const sections = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|$)/gi)];
  const modelMap = new Map<string, GeminiModelInfo>();
  const recommendationNames: string[] = [];

  for (const [, , sectionHtml] of sections) {
    for (const [, noteHtml] of sectionHtml.matchAll(/<aside\b[^>]*class="[^"]*note[^"]*"[^>]*>([\s\S]*?)<\/aside>/gi)) {
      const note = htmlText(noteHtml);
      recommendationNames.push(...(note.match(/\d+(?:\.\d+)?\s+Flash(?:-Lite)?/gi) ?? []));
    }

    for (const [, rowHtml] of sectionHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, cell]) => cell);
      if (cells.length < 3) continue;
      const modelId = htmlText(cells[0].match(/<code\b[^>]*>([\s\S]*?)<\/code>/i)?.[1] ?? '');
      if (!/^gemini-\d+(?:\.\d+)?-(?:flash|pro)(?:-lite)?(?:-\d+)?(?:-preview[-\w.]*)?$/i.test(modelId)) continue;
      const shutdownDate = htmlText(cells[2]);
      const replacement = htmlText(cells[3] ?? '').match(/\bgemini-[a-z0-9.-]+\b/i)?.[0] ?? '';
      modelMap.set(modelId, { id: modelId, shutdownDate, replacement, recommended: false, shutdown: /\brow-gray\b/i.test(rowHtml), preview: /preview/i.test(modelId) });
    }
  }

  for (const name of recommendationNames) {
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const model of modelMap.values()) {
      const normalizedId = model.id.toLowerCase().replace(/^gemini-/, '').replace(/[^a-z0-9]/g, '');
      if (normalizedId === normalizedName) model.recommended = true;
    }
  }

  return [...modelMap.values()].sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.id.localeCompare(b.id));
}

async function fetchGeminiModelCatalog(): Promise<GeminiModelCatalog> {
  try {
    const response = await fetch(GEMINI_DEPRECATIONS_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { accept: 'text/html', 'user-agent': 'CP-Test-Studio' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const models = parseGeminiModelCatalog(await response.text());
    if (!models.length) throw new Error('Không nhận diện được danh sách model trong trang tài liệu.');
    const catalog: GeminiModelCatalog = { models, fetchedAt: new Date().toISOString(), stale: false };
    lastGeminiModelCatalog = catalog;
    return catalog;
  } catch (error) {
    const warning = `Không tải được dữ liệu model mới nhất từ Google: ${(error as Error).message}`;
    if (lastGeminiModelCatalog) return { ...lastGeminiModelCatalog, stale: true, warning };
    return { models: [], fetchedAt: '', stale: true, warning };
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(temp, file);
}

async function readProject(id: string): Promise<Project> {
  const project = normalizeProjectJson(JSON.parse(await fs.readFile(projectFile(id), 'utf8')));
  const currentStatementVersion = statementVersion(project.statement);
  const currentGeneratorVersion = createHash('sha256').update(project.generator).digest('hex');
  const currentSolutionVersion = createHash('sha256').update(project.solution).digest('hex');
  return {
    ...project,
    testPlan: project.testPlan ?? createDefaultTestPlan(project.statement),
    tests: project.tests.map((test) => {
      const legacyPassed = test.status === 'passed';
      const storedStatementVersion = test.statementVersion ?? currentStatementVersion;
      const storedGeneratorVersion = test.generatorVersion ?? currentGeneratorVersion;
      const storedSolutionVersion = test.solutionVersion ?? (legacyPassed ? currentSolutionVersion : undefined);
      return {
        ...test,
        status: legacyPassed ? 'generated' : test.status,
        statementVersion: storedStatementVersion,
        generatorVersion: storedGeneratorVersion,
        solutionVersion: storedSolutionVersion,
        inputStale: Boolean(test.inputStale || storedStatementVersion !== currentStatementVersion || storedGeneratorVersion !== currentGeneratorVersion),
        outputStale: Boolean(test.outputStale || (storedSolutionVersion && storedSolutionVersion !== currentSolutionVersion)),
      };
    }),
  };
}

function runChild(command: string, args: string[], options: { cwd?: string; input?: string; timeoutMs?: number; outputLimit?: number; env?: NodeJS.ProcessEnv } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    if (operationCancelled) { reject(new Error('CANCELLED_OPERATION')); return; }
    const start = Date.now();
    let stdout = '', stderr = '', timedOut = false, outputLimited = false;
    let stdinError: Error | null = null;
    const limit = options.outputLimit ?? 2 * 1024 * 1024;
    let child: ChildProcessWithoutNullStreams;
    try { child = spawn(command, args, { cwd: options.cwd, env: options.env ?? childEnvironment(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (error) { reject(error); return; }
    activeChildProcesses.add(child);
    const collect = (target: 'stdout' | 'stderr', chunk: Buffer) => {
      const left = limit - Buffer.byteLength(target === 'stdout' ? stdout : stderr, 'utf8');
      if (left <= 0) { outputLimited = true; child.kill(); return; }
      const text = chunk.toString('utf8');
      if (Buffer.byteLength(text, 'utf8') > left) {
        const clipped = Buffer.from(text).subarray(0, left).toString('utf8');
        if (target === 'stdout') stdout += clipped; else stderr += clipped;
        outputLimited = true; child.kill();
      } else if (target === 'stdout') stdout += text; else stderr += text;
    };
    child.stdout.on('data', (chunk: Buffer) => collect('stdout', chunk));
    child.stderr.on('data', (chunk: Buffer) => collect('stderr', chunk));
    child.stdin.on('error', (error: NodeJS.ErrnoException) => {
      // A program may exit before consuming all input (for example, after a parse error).
      // Windows reports this closed pipe as EOF; it must not become an uncaught main-process error.
      if (error.code !== 'EPIPE' && error.code !== 'EOF' && error.code !== 'ERR_STREAM_DESTROYED') stdinError = error;
    });
    child.on('error', (error) => { activeChildProcesses.delete(child); reject(error); });
    const timer = options.timeoutMs ? setTimeout(() => { timedOut = true; child.kill(); }, options.timeoutMs) : undefined;
    child.on('close', (exitCode) => {
      activeChildProcesses.delete(child);
      if (timer) clearTimeout(timer);
      if (operationCancelled) { reject(new Error('CANCELLED_OPERATION')); return; }
      if (stdinError) { reject(new Error(`Không ghi được input cho chương trình: ${stdinError.message}`)); return; }
      resolve({ stdout, stderr, exitCode, runtimeMs: Date.now() - start, timedOut, outputLimited });
    });
    try { child.stdin.end(options.input ?? ''); }
    catch (error) {
      const streamError = error as NodeJS.ErrnoException;
      if (streamError.code !== 'EPIPE' && streamError.code !== 'EOF' && streamError.code !== 'ERR_STREAM_DESTROYED') stdinError = streamError;
    }
  });
}

async function compiler(): Promise<string> {
  const settings = await readSettings();
  const configuredPath = settings.compilerPath.trim();
  if (!configuredPath) throw new Error('Chưa chọn compiler C++ bên ngoài. Hãy chọn g++.exe tại Cài đặt → Compiler C++.');
  const applicationDirectory = `${path.resolve(app.getAppPath()).toLowerCase()}${path.sep}`;
  const selectedPath = path.resolve(configuredPath).toLowerCase();
  if (selectedPath.startsWith(applicationDirectory)) {
    throw new Error('Compiler đã chọn đang nằm trong thư mục source/ứng dụng. Hãy chọn g++.exe từ bộ GCC đã import bên ngoài.');
  }
  const executable = shortWindowsPath(configuredPath);
  if (!existsSync(executable)) throw new Error(`Không tìm thấy compiler đã chọn: ${configuredPath}. Hãy chọn lại g++.exe trong Cài đặt.`);
  const result = await runChild(executable, ['--version'], { timeoutMs: 4000, outputLimit: 16_000 }).catch(() => null);
  if (result?.exitCode !== 0) {
    const diagnostics = `${result?.stderr ?? ''}${result?.stdout ?? ''}`.trim();
    throw new Error(`Không chạy được compiler đã chọn: ${configuredPath}.${diagnostics ? `\n${diagnostics}` : ''}`);
  }
  activeCompilerPath = executable;
  return configuredPath;
}

async function compile(projectId: string, kind: ProgramKind, source: string): Promise<CompileResult> {
  const selectedCompiler = await compiler();
  const dir = path.join(buildRoot(), projectId);
  await fs.mkdir(dir, { recursive: true });
  const sourceFile = path.join(dir, `${kind}.cpp`);
  const binary = path.join(dir, `${kind}${process.platform === 'win32' ? '.exe' : ''}`);
  await fs.writeFile(sourceFile, source, 'utf8');
  const runtimeLinking = process.platform === 'win32' ? ['-static'] : [];
  const testlibInclude = ['-I', testlibRoot()];
  const result = await runChild(selectedCompiler, ['-std=c++17', '-O2', '-pipe', ...runtimeLinking, ...testlibInclude, path.basename(sourceFile), '-o', path.basename(binary)], { timeoutMs: 60_000, outputLimit: 1_000_000, cwd: dir });
  return { ok: result.exitCode === 0 && !result.timedOut, diagnostics: result.timedOut ? 'Biên dịch quá thời gian 60 giây.' : `${result.stderr}${result.stdout}`.trim(), compiler: selectedCompiler };
}

function binaryPath(projectId: string, kind: ProgramKind) {
  if (!safeId(projectId)) throw new Error('Mã dự án không hợp lệ.');
  return path.join(buildRoot(), projectId, `${kind}${process.platform === 'win32' ? '.exe' : ''}`);
}

async function aiKey(provider: Provider): Promise<string> {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows chưa bật được mã hóa API key an toàn.');
  try {
    const saved = JSON.parse(await fs.readFile(keysFile(), 'utf8')) as Record<string, string>;
    if (!saved[provider]) throw new Error('Chưa có API key cho nhà cung cấp này.');
    return safeStorage.decryptString(Buffer.from(saved[provider], 'base64'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('API key')) throw error;
    throw new Error('Chưa có API key cho nhà cung cấp này.');
  }
}

async function callAi(request: AiRequest, test = false): Promise<AiResponse> {
  if (operationCancelled) throw new Error('CANCELLED_OPERATION');
  const abortController = new AbortController();
  activeAiAbortControllers.add(abortController);
  try {
  const settings = await readSettings();
  const provider = request.provider ?? settings.provider;
  const model = request.model || settings.models[provider];
  const key = await aiKey(provider);
  if (provider === 'openai') {
    const client = new OpenAI({ apiKey: key });
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: 'text', text: request.prompt }];
    if (request.image) content.push({ type: 'image_url', image_url: { url: `data:${request.image.mimeType};base64,${request.image.data}` } });
    const result = await client.chat.completions.create({
      model, messages: [{ role: 'user', content }], max_tokens: test ? 24 : request.maxOutputTokens ?? 3000,
      ...(request.outputFormat === 'json' ? { response_format: { type: 'json_object' as const } } : {}),
    }, { signal: abortController.signal });
    return {
      text: result.choices[0]?.message?.content ?? '',
      usage: result.usage ? { inputTokens: result.usage.prompt_tokens, outputTokens: result.usage.completion_tokens, totalTokens: result.usage.total_tokens } : undefined,
    };
  }
  const client = new GoogleGenAI({ apiKey: key });
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: request.prompt }];
  if (request.image) parts.push({ inlineData: request.image });
  const result = await client.models.generateContent({
    model, contents: [{ role: 'user', parts }],
    config: { maxOutputTokens: test ? 24 : request.maxOutputTokens ?? 3000, abortSignal: abortController.signal, ...(request.outputFormat === 'json' ? { responseMimeType: 'application/json' } : {}) },
  });
  const usage = result.usageMetadata;
  return {
    text: result.text ?? '',
    usage: usage ? { inputTokens: usage.promptTokenCount, outputTokens: usage.candidatesTokenCount, totalTokens: usage.totalTokenCount } : undefined,
  };
  } finally {
    activeAiAbortControllers.delete(abortController);
  }
}

function aiRequestCacheKey(request: AiRequest, provider: Provider, model: string, promptVersion: string): string {
  const hash = createHash('sha256');
  hash.update(provider).update('\0').update(model).update('\0').update(promptVersion).update('\0').update(request.outputFormat ?? 'text').update('\0').update(request.prompt);
  if (request.image) hash.update('\0').update(request.image.mimeType).update('\0').update(request.image.data);
  return hash.digest('hex');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 960, minHeight: 650,
    backgroundColor: '#f5f7fb', show: false,
    webPreferences: { preload: path.join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const externalUrl = new URL(url);
      if (externalUrl.protocol === 'https:' && externalUrl.hostname === 'ai.google.dev') void shell.openExternal(externalUrl.toString());
    } catch { /* Ignore malformed external links. */ }
    return { action: 'deny' };
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  app.setAppUserModelId('vn.cpteststudio.desktop');
  Menu.setApplicationMenu(null);
  await Promise.all([fs.mkdir(projectsRoot(), { recursive: true }), fs.mkdir(buildRoot(), { recursive: true })]);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

ipcMain.handle('operation:reset-cancellation', () => { operationCancelled = false; });
ipcMain.handle('operation:cancel-current', () => {
  operationCancelled = true;
  for (const controller of activeAiAbortControllers) controller.abort();
  for (const child of activeChildProcesses) child.kill();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('app:status', async () => {
  const settings = await readSettings();
  try {
    const selectedCompiler = await compiler();
    return { compilerAvailable: true, compiler: selectedCompiler, onboardingComplete: settings.onboardingComplete };
  }
  catch { return { compilerAvailable: false, compiler: '', onboardingComplete: settings.onboardingComplete }; }
});
ipcMain.handle('projects:list', async () => {
  await fs.mkdir(projectsRoot(), { recursive: true });
  const dirs = await fs.readdir(projectsRoot(), { withFileTypes: true });
  const all = await Promise.all(dirs.filter((entry) => entry.isDirectory()).map((entry) => readProject(entry.name).catch(() => null)));
  return all.filter((project): project is Project => project !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
});
ipcMain.handle('projects:create', async (_event, rawName: string) => {
  const name = String(rawName).trim().slice(0, 100) || 'Dự án mới';
  const now = new Date().toISOString();
  const project: Project = { ...DEFAULT_PROJECT, id: randomUUID(), name, createdAt: now, updatedAt: now, tests: [] };
  await fs.mkdir(path.join(projectPath(project.id), 'tests'), { recursive: true });
  await writeJson(projectFile(project.id), project);
  await fs.writeFile(path.join(projectPath(project.id), 'generator.cpp'), project.generator, 'utf8');
  await fs.writeFile(path.join(projectPath(project.id), 'solution.cpp'), project.solution, 'utf8');
  return project;
});
ipcMain.handle('projects:save', async (_event, rawInput: Project) => {
  const input = normalizeProjectJson(rawInput);
  if (!safeId(input.id)) throw new Error('Mã dự án không hợp lệ.');
  const previous = await readProject(input.id).catch(() => null);
  const statementChanged = Boolean(previous && previous.statement !== input.statement);
  const generatorChanged = Boolean(previous && previous.generator !== input.generator);
  const solutionChanged = Boolean(previous && previous.solution !== input.solution);
  const inputVersion = statementVersion(input.statement);
  const generatorVersion = sha256(input.generator);
  const solutionVersion = sha256(input.solution);
  const project = {
    ...input,
    aiCache: { ...(previous?.aiCache ?? {}), ...input.aiCache },
    name: input.name.trim().slice(0, 100) || 'Dự án',
    updatedAt: new Date().toISOString(),
    tests: input.tests.map((test) => {
      const inputStale = Boolean(test.inputStale
        || (test.statementVersion ? test.statementVersion !== inputVersion : statementChanged)
        || (test.generatorVersion ? test.generatorVersion !== generatorVersion : generatorChanged));
      return {
        ...test,
        inputStale,
        outputStale: Boolean(test.outputStale
          || (test.solutionVersion ? test.solutionVersion !== solutionVersion : solutionChanged)
          || (inputStale && test.output)),
      };
    }),
  };
  const dir = projectPath(project.id);
  await fs.mkdir(path.join(dir, 'tests'), { recursive: true });
  await writeJson(projectFile(project.id), project);
  await fs.writeFile(path.join(dir, 'statement.md'), project.statement, 'utf8');
  await fs.writeFile(path.join(dir, 'generator.cpp'), project.generator, 'utf8');
  await fs.writeFile(path.join(dir, 'solution.cpp'), project.solution, 'utf8');
  await fs.writeFile(path.join(dir, 'validator.cpp'), project.validator, 'utf8');
  for (const test of project.tests) {
    const base = path.join(dir, 'tests', safeFileName(test.name));
    await fs.writeFile(`${base}.INP`, test.input, 'utf8');
    if (test.output) await fs.writeFile(`${base}.OUT`, test.output, 'utf8');
  }
  return project;
});
ipcMain.handle('projects:delete', async (_event, id: string) => fs.rm(projectPath(id), { recursive: true, force: true }));
ipcMain.handle('projects:choose-folder', async (_event, id: string) => {
  const location = projectPath(id);
  await shell.openPath(location);
  return location;
});
ipcMain.handle('projects:image:save', async (_event, projectId: string, rawName: string, mimeType: string, encoded: string) => {
  if (!safeId(projectId)) throw new Error('Mã dự án không hợp lệ.');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) throw new Error('Định dạng ảnh không được hỗ trợ.');
  const bytes = Buffer.from(String(encoded), 'base64');
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('Ảnh rỗng hoặc vượt quá 10 MB.');
  const project = await readProject(projectId);
  const image = { id: randomUUID(), name: path.basename(String(rawName)).slice(0, 150), mimeType, addedAt: new Date().toISOString() };
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
  const imagePath = path.join(projectPath(projectId), 'images', `${image.id}.${extension}`);
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.writeFile(imagePath, bytes);
  project.images = [...(project.images ?? []), image]; project.updatedAt = new Date().toISOString();
  await writeJson(projectFile(projectId), project);
  return image;
});
ipcMain.handle('projects:image:read', async (_event, projectId: string, imageId: string) => {
  if (!safeId(projectId) || !safeId(imageId)) throw new Error('Mã ảnh không hợp lệ.');
  const project = await readProject(projectId);
  const image = (project.images ?? []).find((item) => item.id === imageId);
  if (!image) return null;
  const extension = image.mimeType === 'image/jpeg' ? 'jpg' : image.mimeType.split('/')[1];
  const imagePath = path.join(projectPath(projectId), 'images', `${image.id}.${extension}`);
  const data = await fs.readFile(imagePath).then((buffer) => buffer.toString('base64')).catch(() => null);
  return data ? { data, mimeType: image.mimeType } : null;
});

ipcMain.handle('settings:get', readSettings);
ipcMain.handle('settings:gemini-model-catalog', () => {
  if (!pendingGeminiModelCatalog) {
    pendingGeminiModelCatalog = fetchGeminiModelCatalog().finally(() => { pendingGeminiModelCatalog = null; });
  }
  return pendingGeminiModelCatalog;
});
ipcMain.handle('settings:save', async (_event, settings: Settings) => writeJson(settingsFile(), settings));
ipcMain.handle('settings:key:save', async (_event, provider: Provider, key: string) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Không thể mã hóa API key trên máy này.');
  const store: Record<string, string> = await fs.readFile(keysFile(), 'utf8').then((data) => JSON.parse(data) as Record<string, string>).catch(() => ({}));
  if (key.trim()) store[provider] = safeStorage.encryptString(key.trim()).toString('base64');
  else delete store[provider];
  await writeJson(keysFile(), store);
});
ipcMain.handle('settings:key:remove', async (_event, provider: Provider) => {
  const store: Record<string, string> = await fs.readFile(keysFile(), 'utf8').then((data) => JSON.parse(data) as Record<string, string>).catch(() => ({}));
  delete store[provider]; await writeJson(keysFile(), store);
});
ipcMain.handle('settings:key:has', async (_event, provider: Provider) => {
  const store: Record<string, string> = await fs.readFile(keysFile(), 'utf8').then((data) => JSON.parse(data) as Record<string, string>).catch(() => ({}));
  return Boolean(store[provider]);
});
ipcMain.handle('settings:compiler:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, { title: 'Chọn trình biên dịch C++', filters: [{ name: 'Ứng dụng', extensions: ['exe'] }], properties: ['openFile'] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('settings:document-tools:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, { title: 'Chọn thư mục công cụ xuất tài liệu', properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('ai:test', async (_event, request: AiRequest) => (await callAi({ ...request, prompt: AI_PROMPTS.connectionTest }, true)).text);
ipcMain.handle('ai:ask', async (_event, request: AiRequest): Promise<AiResponse> => {
  const settings = await readSettings();
  const provider = request.provider ?? settings.provider;
  const model = request.model || settings.models[provider];
  const promptVersion = request.promptVersion ?? AI_PROMPT_VERSION;
  const cacheKey = aiRequestCacheKey(request, provider, model, promptVersion);
  let cachedProject: Project | null = null;
  if (request.projectId && safeId(request.projectId)) {
    cachedProject = await readProject(request.projectId).catch(() => null);
    const cached = cachedProject?.aiCache[cacheKey];
    if (cached && cached.provider === provider && cached.model === model && cached.promptVersion === promptVersion) {
      return { ...cached.response, cached: true };
    }
  }
  const response = await callAi(request);
  if (cachedProject) {
    const record: AiCachedResult = { provider, model, promptVersion, response, savedAt: new Date().toISOString() };
    const cacheEntries = Object.entries({ ...cachedProject.aiCache, [cacheKey]: record }).sort((a, b) => a[1].savedAt.localeCompare(b[1].savedAt)).slice(-40);
    cachedProject.aiCache = Object.fromEntries(cacheEntries);
    await writeJson(projectFile(cachedProject.id), cachedProject);
  }
  return response;
});

ipcMain.handle('code:compile', async (_event, projectId: string, kind: ProgramKind, source: string) => compile(projectId, kind, source));
ipcMain.handle('code:run', async (_event, projectId: string, kind: ProgramKind, input: string, args: string[] = [], timeoutMs = 2000) => {
  const file = binaryPath(projectId, kind);
  if (!existsSync(file)) throw new Error('Chưa biên dịch chương trình.');
  return runChild(file, args.map(String).slice(0, 32), { input, timeoutMs: Math.max(100, Math.min(timeoutMs, 30_000)), outputLimit: 2 * 1024 * 1024, cwd: path.dirname(file) });
});
const MAX_GENERATOR_RETRIES = 8;
const GENERATOR_TIMEOUT_MS = 2500;
const MAX_GENERATOR_OUTPUT = 2 * 1024 * 1024;
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const testInputHash = (input: string) => sha256(input);

function generatorArgs(seed: number, testIndex: number, group: TestGroup): string[] {
  const args = [String(seed >>> 0), `--testIndex=${testIndex}`, `--mode=${group.mode}`];
  for (const [key, value] of Object.entries(group.params)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(key) || ['testIndex', 'mode'].includes(key)) throw new Error(`Tên tham số generator không hợp lệ: ${key}`);
    if (/[\r\n\0]/.test(value)) throw new Error(`Giá trị tham số ${key} chứa ký tự không hợp lệ.`);
    args.push(`--${key}=${value}`);
  }
  return args;
}

function sendGenerationProgress(progress: TestGenerationProgress) {
  mainWindow?.webContents.send('tests:generation-progress', progress);
}

function sendTestRunProgress(progress: TestRunProgress) {
  mainWindow?.webContents.send('tests:run-progress', progress);
}

async function compileTestPrograms(projectId: string, generatorSource: string, validatorSource: string) {
  const generator = await compile(projectId, 'generator', generatorSource);
  if (!generator.ok) throw new Error(`Generator biên dịch lỗi:\n${generator.diagnostics}`);
  if (validatorSource.trim()) {
    const validator = await compile(projectId, 'validator', validatorSource);
    if (!validator.ok) throw new Error(`Validator biên dịch lỗi:\n${validator.diagnostics}`);
  }
}

async function validateGeneratedInput(projectId: string, validatorSource: string, input: string): Promise<{ valid: boolean; stderr: string }> {
  if (!validatorSource.trim()) return { valid: true, stderr: '' };
  const result = await runChild(binaryPath(projectId, 'validator'), [], { input, timeoutMs: GENERATOR_TIMEOUT_MS, outputLimit: 64_000, cwd: path.join(buildRoot(), projectId) });
  return { valid: !result.timedOut && !result.outputLimited && result.exitCode === 0, stderr: result.stderr || (result.timedOut ? 'Validator quá thời gian.' : result.outputLimited ? 'Validator tạo output quá lớn.' : `Validator thoát mã ${result.exitCode}.`) };
}

ipcMain.handle('tests:generate', async (_event, projectId: string, rawPlan: TestPlan, baseSeed: number, source: string, validatorSource: string, sourceVersion: string, excludedHashes: string[] = []) => {
  if (!safeId(projectId)) throw new Error('Mã dự án không hợp lệ.');
  const plan = TestPlanSchema.parse(rawPlan);
  const total = plan.groups.reduce((sum, group) => sum + group.count, 0);
  if (total > 500) throw new Error('Test Plan tối đa 500 testcase.');
  await compileTestPrograms(projectId, source, validatorSource);

  const tests: TestCase[] = [];
  const seen = new Set(excludedHashes.filter((hash) => /^[a-f0-9]{64}$/i.test(hash)));
  const log: TestGenerationLog = { id: randomUUID(), createdAt: new Date().toISOString(), requested: total, generated: 0, duplicates: 0, invalid: 0, errors: 0, retries: 0, warnings: [] };
  sendGenerationProgress({ current: 0, total, generated: 0, duplicates: 0, invalid: 0, errors: 0 });
  let completed = 0;
  let globalIndex = 0;

  for (const group of plan.groups) {
    for (let groupIndex = 1; groupIndex <= group.count; groupIndex++) {
      globalIndex++;
      let accepted: TestCase | null = null;
      let lastRejected: TestCase | null = null;
      for (let attempt = 0; attempt < MAX_GENERATOR_RETRIES; attempt++) {
        if (attempt > 0) log.retries++;
        const testIndex = globalIndex + attempt * total;
        const runSeed = (Math.trunc(baseSeed) + globalIndex * 1009 + attempt * 104729) >>> 0;
        let run: RunResult;
        try {
          run = await runChild(binaryPath(projectId, 'generator'), generatorArgs(runSeed, testIndex, group), { timeoutMs: GENERATOR_TIMEOUT_MS, outputLimit: MAX_GENERATOR_OUTPUT, cwd: path.join(buildRoot(), projectId) });
        } catch (error) {
          if (operationCancelled) throw error;
          log.errors++;
          lastRejected = { id: randomUUID(), name: `ERROR${String(globalIndex).padStart(2, '0')}`, input: '', output: '', status: 'error', stderr: (error as Error).message, groupId: group.id, groupName: group.name, testIndex, seed: runSeed, mode: group.mode, params: group.params, statementVersion: sourceVersion, generatorVersion: sha256(source) };
          continue;
        }
        if (run.timedOut || run.exitCode !== 0 || run.outputLimited) {
          log.errors++;
          lastRejected = { id: randomUUID(), name: `ERROR${String(globalIndex).padStart(2, '0')}`, input: run.stdout, output: '', status: run.timedOut ? 'timeout' : 'error', stderr: run.stderr || (run.outputLimited ? 'Generator vượt quá giới hạn output.' : `Generator thoát mã ${run.exitCode}.`), runtimeMs: run.runtimeMs, groupId: group.id, groupName: group.name, testIndex, seed: runSeed, mode: group.mode, params: group.params, sha256: testInputHash(run.stdout), statementVersion: sourceVersion, generatorVersion: sha256(source) };
          continue;
        }
        const hash = testInputHash(run.stdout);
        if (seen.has(hash)) {
          log.duplicates++;
          lastRejected = { id: randomUUID(), name: `DUP${String(globalIndex).padStart(2, '0')}`, input: run.stdout, output: '', status: 'duplicate', stderr: 'Input trùng với testcase khác; ứng dụng sẽ thử sinh bù.', runtimeMs: run.runtimeMs, groupId: group.id, groupName: group.name, testIndex, seed: runSeed, mode: group.mode, params: group.params, sha256: hash, statementVersion: sourceVersion, generatorVersion: sha256(source) };
          continue;
        }
        const validation = await validateGeneratedInput(projectId, validatorSource, run.stdout);
        if (!validation.valid) {
          log.invalid++;
          lastRejected = { id: randomUUID(), name: `INVALID${String(globalIndex).padStart(2, '0')}`, input: run.stdout, output: '', status: 'invalid', stderr: validation.stderr, runtimeMs: run.runtimeMs, groupId: group.id, groupName: group.name, testIndex, seed: runSeed, mode: group.mode, params: group.params, sha256: hash, statementVersion: sourceVersion, generatorVersion: sha256(source) };
          continue;
        }
        accepted = { id: randomUUID(), name: `TEST${String(tests.filter((test) => ['pending', 'generated', 'verified'].includes(test.status)).length + 1).padStart(2, '0')}`, input: run.stdout, output: '', status: 'pending', runtimeMs: run.runtimeMs, groupId: group.id, groupName: group.name, testIndex, seed: runSeed, mode: group.mode, params: group.params, sha256: hash, statementVersion: sourceVersion, generatorVersion: sha256(source), inputStale: false, outputStale: false };
        seen.add(hash);
        log.generated++;
        break;
      }
      if (accepted) tests.push(accepted);
      else if (lastRejected) tests.push(lastRejected);
      else tests.push({ id: randomUUID(), name: `ERROR${String(globalIndex).padStart(2, '0')}`, input: '', output: '', status: 'error', stderr: 'Không sinh được input sau số lần thử tối đa.', groupId: group.id, groupName: group.name, testIndex: globalIndex, seed: baseSeed >>> 0, mode: group.mode, params: group.params, statementVersion: sourceVersion, generatorVersion: sha256(source) });
      completed++;
      sendGenerationProgress({ current: completed, total, generated: log.generated, duplicates: log.duplicates, invalid: log.invalid, errors: log.errors });
    }
  }
  if (log.generated < total) log.warnings.push(`Sinh được ${log.generated}/${total} input duy nhất hợp lệ. Miền dữ liệu nhỏ hoặc generator chưa đa dạng; có thể sửa Test Plan/generator rồi thử lại.`);
  return { tests, log };
});

ipcMain.handle('tests:regenerate-one', async (_event, projectId: string, rawGroup: TestGroup, baseSeed: number, testIndex: number, source: string, validatorSource: string, sourceVersion: string, excludedHashes: string[]) => {
  if (!safeId(projectId)) throw new Error('Mã dự án không hợp lệ.');
  const group = TestGroupSchema.parse(rawGroup);
  await compileTestPrograms(projectId, source, validatorSource);
  const seen = new Set(excludedHashes);
  for (let attempt = 0; attempt < MAX_GENERATOR_RETRIES; attempt++) {
    const nextIndex = testIndex + attempt;
    const runSeed = (Math.trunc(baseSeed) + testIndex * 1009 + attempt * 104729) >>> 0;
    const run = await runChild(binaryPath(projectId, 'generator'), generatorArgs(runSeed, nextIndex, group), { timeoutMs: GENERATOR_TIMEOUT_MS, outputLimit: MAX_GENERATOR_OUTPUT, cwd: path.join(buildRoot(), projectId) });
    if (run.timedOut || run.exitCode !== 0 || run.outputLimited) continue;
    const hash = testInputHash(run.stdout);
    if (seen.has(hash)) continue;
    const validation = await validateGeneratedInput(projectId, validatorSource, run.stdout);
    if (!validation.valid) continue;
    return { id: randomUUID(), name: `TEST${String(testIndex).padStart(2, '0')}`, input: run.stdout, output: '', status: 'pending', runtimeMs: run.runtimeMs, groupId: group.id, groupName: group.name, testIndex: nextIndex, seed: runSeed, mode: group.mode, params: group.params, sha256: hash, statementVersion: sourceVersion, generatorVersion: sha256(source), inputStale: false, outputStale: false } satisfies TestCase;
  }
  throw new Error(`Không thể sinh testcase duy nhất hợp lệ sau ${MAX_GENERATOR_RETRIES} lần thử. Hãy đổi seed, tham số hoặc generator.`);
});

const outputTokens = (value: string) => value.trim().split(/\s+/).filter(Boolean).join(' ');

ipcMain.handle('tests:run', async (_event, projectId: string, solution: string, tests: TestCase[], timeLimitMs: number, testIds?: string[], oracleSolution?: string) => {
  if (!safeId(projectId)) throw new Error('Mã dự án không hợp lệ.');
  const compiled = await compile(projectId, 'solution', solution);
  if (!compiled.ok) throw new Error(`Lời giải biên dịch lỗi:\n${compiled.diagnostics}`);
  if (oracleSolution?.trim()) {
    const oracle = await compile(projectId, 'oracle', oracleSolution);
    if (!oracle.ok) throw new Error(`Oracle biên dịch lỗi:\n${oracle.diagnostics}`);
  }
  const selectedIds = testIds ? new Set(testIds) : null;
  const eligible = tests.filter((test) => (!selectedIds || selectedIds.has(test.id)) && !test.inputStale && !['duplicate', 'invalid', 'error'].includes(test.status));
  if (!eligible.length) throw new Error('Không có testcase hợp lệ để chạy.');
  const updates = new Map<string, TestCase>();
  const solutionVersion = sha256(solution);
  let completed = 0;
  let errors = 0;
  sendTestRunProgress({ current: 0, total: eligible.length, completed: 0, errors: 0 });
  for (const test of eligible) {
    const timeout = Math.max(100, Math.min(timeLimitMs, 30_000));
    const result = await runChild(binaryPath(projectId, 'solution'), [], { input: test.input, timeoutMs: timeout, outputLimit: 2 * 1024 * 1024, cwd: path.join(buildRoot(), projectId) });
    if (!result.timedOut && result.exitCode === 0 && !result.outputLimited) {
      let status: TestCase['status'] = 'generated';
      let output = result.stdout;
      let stderr = result.stderr;
      if (oracleSolution?.trim()) {
        const oracle = await runChild(binaryPath(projectId, 'oracle'), [], { input: test.input, timeoutMs: timeout, outputLimit: 2 * 1024 * 1024, cwd: path.join(buildRoot(), projectId) });
        if (oracle.timedOut || oracle.exitCode !== 0 || oracle.outputLimited) {
          status = oracle.timedOut ? 'timeout' : 'error';
          stderr = oracle.stderr || 'Oracle chạy lỗi; không thể xác minh output.';
        } else if (outputTokens(result.stdout) !== outputTokens(oracle.stdout)) {
          status = 'error';
          stderr = 'Differential mismatch: output lời giải khác output oracle.';
        } else {
          status = 'verified';
          output = oracle.stdout;
        }
      }
      const successful = status === 'generated' || status === 'verified';
      if (!successful) errors++;
      updates.set(test.id, { ...test, output: successful ? output : test.output, status, runtimeMs: result.runtimeMs, stderr, solutionVersion: successful ? solutionVersion : test.solutionVersion, outputStale: !successful && Boolean(test.output) });
    } else {
      errors++;
      updates.set(test.id, { ...test, status: result.timedOut ? 'timeout' : 'failed', runtimeMs: result.runtimeMs, stderr: result.stderr || (result.outputLimited ? 'Output vượt quá giới hạn.' : `Mã thoát: ${result.exitCode}`), outputStale: Boolean(test.output) || test.outputStale });
    }
    completed++;
    sendTestRunProgress({ current: completed, total: eligible.length, completed, errors });
  }
  return tests.map((test) => updates.get(test.id) ?? test);
});

ipcMain.handle('export:themis', async (_event, project: Project) => {
  const ready = exportableTests(project.tests);
  if (!ready.length) throw new Error('Chưa có testcase hợp lệ với output mới để xuất.');
  if (!(await confirmTestExport(project.tests, ready))) return null;
  const choice = await dialog.showSaveDialog(mainWindow!, { title: 'Xuất bộ test Themis', defaultPath: `${project.name.replace(/[\\/:*?"<>|]/g, '_')}.zip`, filters: [{ name: 'Tệp ZIP', extensions: ['zip'] }] });
  if (choice.canceled || !choice.filePath) return null;
  await createThemisArchive(choice.filePath, ready, await readSettings());
  return choice.filePath;
});
ipcMain.handle('export:markdown', async (_event, project: Project) => {
  const choice = await dialog.showSaveDialog(mainWindow!, { title: 'Xuất đề Markdown', defaultPath: `${project.name.replace(/[\\/:*?"<>|]/g, '_')}.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] });
  if (choice.canceled || !choice.filePath) return null;
  await fs.writeFile(choice.filePath, project.statement, 'utf8'); return choice.filePath;
});
ipcMain.handle('export:pdf', async (_event, project: Project) => {
  const choice = await dialog.showSaveDialog(mainWindow!, { title: 'Xuất đề PDF', defaultPath: `${project.name.replace(/[\\/:*?"<>|]/g, '_')}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (choice.canceled || !choice.filePath) return null;
  await fs.writeFile(choice.filePath, await createPdf(project, true)); return choice.filePath;
});
ipcMain.handle('export:docx', async (_event, project: Project) => {
  const choice = await dialog.showSaveDialog(mainWindow!, { title: 'Xuất đề DOCX', defaultPath: `${project.name.replace(/[\\/:*?"<>|]/g, '_')}.docx`, filters: [{ name: 'Word', extensions: ['docx'] }] });
  if (choice.canceled || !choice.filePath) return null;
  await fs.writeFile(choice.filePath, await createDocx(project, true));
  return choice.filePath;
});
ipcMain.handle('export:all', async (_event, project: Project) => {
  const ready = exportableTests(project.tests);
  if (!ready.length) throw new Error('Chưa có testcase hợp lệ với output mới để xuất.');
  const exportSettings = await readSettings();
  const themisInputName = safeThemisFilename(exportSettings.themisInputFile, 'INP', 'BAI').replace(/\.INP$/i, '');
  const base = safeFileName(themisInputName);
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const archiveName = `CP_Test_Studio_${base}_${timestamp}.zip`;
  const choice = await dialog.showSaveDialog(mainWindow!, {
    title: 'Lưu bộ đề CP Test Studio',
    defaultPath: path.join(app.getPath('downloads'), archiveName),
    filters: [{ name: 'Tệp ZIP', extensions: ['zip'] }],
  });
  if (choice.canceled || !choice.filePath) return null;

  const stagingDirectory = await fs.mkdtemp(path.join(app.getPath('temp'), 'cp-test-studio-export-'));
  try {
  const statementProject = { ...project, name: `${base}_DeBai` };
  const guideContent = [
    project.solutionGuide?.trim() ?? '',
    '## Lời giải tham khảo C++17',
    '```cpp',
    project.solution.trim(),
    '```',
  ].join('\n\n');
  const guideProject = { ...project, name: `${base}_HuongDan`, statement: guideContent };
  const directories = ['DeBai', 'HuongDan', 'LoiGiai', 'BoTest'];
  await Promise.all(directories.map((name) => fs.mkdir(path.join(stagingDirectory, name), { recursive: true })));
  const files = [
    path.join('DeBai', `${base}_DeBai.md`),
    path.join('DeBai', `${base}_DeBai.pdf`),
    path.join('DeBai', `${base}_DeBai.docx`),
    path.join('HuongDan', `${base}_HuongDan.md`),
    path.join('HuongDan', `${base}_HuongDan.pdf`),
    path.join('HuongDan', `${base}_HuongDan.docx`),
    path.join('LoiGiai', `${base}_solution.cpp`),
    path.join('BoTest', 'KeHoachSinhTest.txt'),
    path.join('BoTest', 'generator.cpp'),
    path.join('BoTest', 'bo_test_themis.zip'),
  ];
  const testPlanText = formatTestPlan(project, base);
  await fs.writeFile(path.join(stagingDirectory, files[0]), `# ${statementProject.name}\n\n${statementProject.statement}`, 'utf8');
  await fs.writeFile(path.join(stagingDirectory, files[1]), await createPdf(statementProject, true));
  await fs.writeFile(path.join(stagingDirectory, files[2]), await createDocx(statementProject, true));
  await fs.writeFile(path.join(stagingDirectory, files[3]), `# ${guideProject.name}\n\n${guideProject.statement}`, 'utf8');
  await fs.writeFile(path.join(stagingDirectory, files[4]), await createPdf(guideProject, true));
  await fs.writeFile(path.join(stagingDirectory, files[5]), await createDocx(guideProject, true));
  await fs.writeFile(path.join(stagingDirectory, files[6]), project.solution, 'utf8');
  await fs.writeFile(path.join(stagingDirectory, files[7]), testPlanText, 'utf8');
  await fs.writeFile(path.join(stagingDirectory, files[8]), project.generator, 'utf8');
  await createThemisArchive(path.join(stagingDirectory, files[9]), ready, exportSettings);
  await createDirectoryArchive(choice.filePath, stagingDirectory);
  return { directory: path.dirname(choice.filePath), files: [path.basename(choice.filePath)] };
  } finally {
    await fs.rm(stagingDirectory, { recursive: true, force: true });
  }
});

async function createDirectoryArchive(filePath: string, directory: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.once('close', resolve);
    output.once('error', reject);
    archive.once('error', reject);
    archive.pipe(output);
    archive.directory(directory, false);
    void archive.finalize();
  });
}

function formatTestPlan(project: Project, exportBase: string): string {
  const spec = project.testPlan.problemSpec;
  const groups = project.testPlan.groups.map((group, index) => {
    const params = Object.entries(group.params).map(([key, value]) => `${key}=${value}`).join(', ') || 'Không có';
    return [
      `${index + 1}. ${group.name}`,
      `   Chế độ: ${group.mode}`,
      `   Số testcase: ${group.count}`,
      `   Mô tả: ${group.description || 'Không có'}`,
      `   Tham số: ${params}`,
    ].join('\n');
  }).join('\n\n');
  return [
    `KẾ HOẠCH SINH TEST: ${exportBase}`,
    `Seed gốc: ${project.seed}`,
    '',
    'Tóm tắt bài toán:', spec.summary || 'Chưa có',
    '',
    'Định dạng input:', spec.inputFormat || 'Chưa có',
    '',
    'Định dạng output:', spec.outputFormat || 'Chưa có',
    '',
    'Ràng buộc:', ...(spec.constraints.length ? spec.constraints.map((constraint) => `- ${constraint}`) : ['- Chưa có']),
    '',
    'Các nhóm testcase:', groups || 'Chưa có nhóm testcase.',
    '',
  ].join('\n');
}

ipcMain.handle('projects:open-folder', async (_event, id: string) => shell.openPath(projectPath(id)));
ipcMain.handle('export:open-directory', async (_event, rawDirectory: string) => {
  const rawValue = String(rawDirectory ?? '').trim();
  if (!rawValue) throw new Error('Chưa có thư mục đã xuất để mở.');
  const directory = path.resolve(rawValue);
  const info = await fs.stat(directory).catch(() => null);
  if (!info?.isDirectory()) throw new Error('Không tìm thấy thư mục đã xuất.');
  const error = await shell.openPath(directory);
  if (error) throw new Error(error);
});

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim().replace(/[. ]+$/g, '') || 'De-bai';
}

async function createPdf(project: Project, preserveLineBreaks = false): Promise<Buffer> {
  return convertMarkdown(project, 'pdf', preserveLineBreaks);
}

async function createDocx(project: Project, preserveLineBreaks = false): Promise<Buffer> {
  return convertMarkdown(project, 'docx', preserveLineBreaks);
}

async function convertMarkdown(project: Project, format: 'pdf' | 'docx', preserveLineBreaks = false): Promise<Buffer> {
  const settings = await readSettings();
  const root = settings.documentToolsPath?.trim() || (app.isPackaged
    ? path.join(process.resourcesPath, 'tools', 'document-export')
    : path.join(app.getAppPath(), '.tools', 'document-export'));
  const pandoc = path.join(root, process.platform === 'win32' ? 'pandoc.exe' : 'pandoc');
  const typst = path.join(root, process.platform === 'win32' ? 'typst.exe' : 'typst');
  const fontDirectory = path.join(root, 'fonts');
  const referenceDoc = path.join(root, 'reference.docx');
  const filter = path.join(root, 'pandoc-normalize.lua');
  if (!existsSync(pandoc) || !existsSync(referenceDoc) || !existsSync(filter) || (format === 'pdf' && (!existsSync(typst) || !existsSync(path.join(fontDirectory, 'Roboto.ttf'))))) {
    throw new Error('Chưa tìm thấy công cụ xuất tài liệu. Hãy tải bộ Pandoc/Typst, giải nén thư mục document-export rồi chọn thư mục đó trong Cài đặt → Xuất tài liệu.');
  }

  const workingDirectory = await fs.mkdtemp(path.join(app.getPath('temp'), 'cp-test-studio-export-'));
  const sourceFile = path.join(workingDirectory, 'statement.md');
  const outputFile = path.join(workingDirectory, `statement.${format}`);
  const documentTitle = project.name.replace(/[\r\n]/g, ' ');
  const args = [
    `--from=${preserveLineBreaks ? 'markdown+hard_line_breaks+pipe_tables' : 'markdown'}`,
    `--lua-filter=${filter}`,
    '--variable=papersize:a4',
    `--output=${outputFile}`,
    sourceFile,
  ];
  if (format === 'docx') args.push(`--metadata=title:${documentTitle}`, `--reference-doc=${referenceDoc}`);
  if (format === 'pdf') args.push(`--pdf-engine=${typst}`, `--pdf-engine-opt=--font-path=${fontDirectory}`, '--variable=mainfont:Roboto');

  try {
    const markdown = '# ' + documentTitle + '\n\n' + project.statement;
    const exportMarkdown = preserveLineBreaks ? normalizePipeTablesForExport(markdown) : markdown;
    await fs.writeFile(sourceFile, exportMarkdown, 'utf8');
    const result = await runChild(pandoc, args, { cwd: workingDirectory, timeoutMs: 120_000, outputLimit: 1_000_000 });
    if (result.exitCode !== 0 || result.timedOut) {
      const detail = (result.stderr || result.stdout).trim();
      throw new Error(result.timedOut ? 'Xuất tài liệu quá thời gian 120 giây.' : `Pandoc không thể xuất ${format.toUpperCase()}.${detail ? `\n${detail}` : ''}`);
    }
    return await fs.readFile(outputFile);
  } finally {
    await fs.rm(workingDirectory, { recursive: true, force: true });
  }
}

function normalizePipeTablesForExport(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  const isDivider = (line: string) => /^\s*\|?\s*:?-{1,}:?\s*(?:\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(line);
  let inCodeFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(```|~~~)/.test(line)) {
      inCodeFence = !inCodeFence;
      output.push(line);
      continue;
    }
    if (!inCodeFence && isDivider(line) && index > 0 && lines[index - 1].includes('|')) {
      const header = lines[index - 1].trim();
      const firstPipe = header.indexOf('|');
      const label = header.slice(0, firstPipe).trim();
      const tableHeader = header.slice(firstPipe).trim();
      output.pop();
      if (label) output.push(label);
      if (output.length && output[output.length - 1] !== '') output.push('');
      output.push(tableHeader, line.trim());
      index += 1;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
        output.push(lines[index].trim());
        index += 1;
      }
      if (index < lines.length) {
        if (output[output.length - 1] !== '') output.push('');
        output.push(lines[index]);
      }
      continue;
    }
    output.push(line);
  }
  return output.join('\n');
}
function exportableTests(tests: TestCase[]) {
  return tests.filter((test) => ['generated', 'verified', 'passed'].includes(test.status) && !test.inputStale && !test.outputStale);
}

async function confirmTestExport(allTests: TestCase[], ready: TestCase[]): Promise<boolean> {
  const unverified = ready.filter((test) => test.status !== 'verified').length;
  const excluded = allTests.length - ready.length;
  if (!unverified && !excluded) return true;
  const details = [
    unverified ? `${unverified} testcase có output do lời giải tạo, chưa đối chiếu độc lập.` : '',
    excluded ? `${excluded} testcase lỗi, trùng, chưa có output hoặc đã cũ sẽ bị bỏ qua.` : '',
    `Sẽ xuất ${ready.length} testcase hợp lệ. Hãy xem lại input/output trong mục Kiểm tra trước khi tiếp tục.`,
  ].filter(Boolean).join('\n');
  const choice = await dialog.showMessageBox(mainWindow!, {
    type: 'warning', title: 'Xác nhận xuất testcase', message: 'Bộ testcase có nội dung chưa được xác minh độc lập.', detail: details,
    buttons: ['Quay lại kiểm tra', 'Tiếp tục xuất'], defaultId: 0, cancelId: 0,
  });
  return choice.response === 1;
}

function safeThemisFilename(raw: string, extension: 'INP' | 'OUT', fallback: string): string {
  const cleaned = String(raw ?? '').trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\.+$/g, '');
  const withoutExtension = cleaned.replace(/\.(inp|out)$/i, '');
  return `${safeFileName(withoutExtension || fallback)}.${extension}`;
}

async function createThemisArchive(filePath: string, tests: TestCase[], settings: Settings) {
  const inputFile = safeThemisFilename(settings.themisInputFile, 'INP', 'BAI');
  const outputFile = safeThemisFilename(settings.themisOutputFile, 'OUT', 'BAI');
  const rootFolder = inputFile.replace(/\.INP$/i, '');
  const prefix = 'TEST';
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.once('close', resolve);
    output.once('error', reject);
    archive.once('error', reject);
    archive.pipe(output);
    tests.forEach((test, index) => {
      const folder = `${rootFolder}/${prefix}${String(index + 1).padStart(2, '0')}`;
      archive.append(test.input, { name: `${folder}/${inputFile}` });
      archive.append(test.output, { name: `${folder}/${outputFile}` });
    });
    void archive.finalize();
  });
}
