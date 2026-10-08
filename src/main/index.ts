import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import archiver from 'archiver';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import type { AiRequest, CompileResult, Project, ProgramKind, Provider, RunResult, Settings, TestCase } from '../shared/types';

const DEFAULT_SETTINGS: Settings = {
  onboardingComplete: false,
  provider: 'openai',
  models: { openai: 'gpt-4.1-mini', gemini: 'gemini-2.5-flash' },
  compilerPath: '', pandocPath: '', theme: 'light',
};
const DEFAULT_GENERATOR = `#include <bits/stdc++.h>
using namespace std;
int main(int argc, char** argv) {
    unsigned seed = argc > 1 ? stoul(argv[1]) : 1;
    int testIndex = argc > 2 ? stoi(argv[2]) : 1;
    mt19937 rng(seed + testIndex);
    // TODO: Thay bằng cấu trúc input của đề bài.
    cout << uniform_int_distribution<int>(1, 100)(rng) << '\\n';
}`;
const DEFAULT_SOLUTION = `#include <bits/stdc++.h>
using namespace std;
int main() {
    ios::sync_with_stdio(false); cin.tie(nullptr);
    // TODO: Dán lời giải C++17 của bạn tại đây.
    return 0;
}`;
const DEFAULT_PROJECT: Omit<Project, 'id' | 'name' | 'createdAt' | 'updatedAt'> = {
  statement: '# Đề bài mới\n\nNhập đề bài Markdown tại đây. Có thể viết công thức LaTeX như `$O(n \\log n)$`.\n',
  generator: DEFAULT_GENERATOR, solution: DEFAULT_SOLUTION, validator: '', images: [], tests: [],
  generatorMode: 'random', seed: 2026, timeLimitMs: 2000,
};

let mainWindow: BrowserWindow | null = null;
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const keysFile = () => path.join(app.getPath('userData'), 'secure-keys.json');
const projectsRoot = () => path.join(app.getPath('userData'), 'projects');
const buildRoot = () => path.join(app.getPath('userData'), 'build');
let activeCompilerPath = '';
let activeCompilerIsBundled = false;
let cachedBundledRoot: string | null | undefined;

function shortWindowsPath(value: string): string {
  if (process.platform !== 'win32') return value;
  try {
    const result = spawnSync('cmd.exe', ['/d', '/c', 'for %I in ("%CP_STUDIO_TOOLCHAIN%") do @echo %~sI'], {
      env: { ...process.env, CP_STUDIO_TOOLCHAIN: value }, encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true,
    });
    const shortPath = result.stdout?.trim().split(/\r?\n/).pop();
    if (result.status === 0 && shortPath && !shortPath.includes(' ')) return shortPath;
  } catch { /* Keep the original path if Windows has no short-name alias. */ }
  return value;
}

function bundledCompilerRoot(): string | undefined {
  if (cachedBundledRoot !== undefined) return cachedBundledRoot ?? undefined;
  const root = app.isPackaged
    ? path.join(process.resourcesPath, 'toolchain', 'mingw64')
    : path.join(app.getAppPath(), '.tools', 'mingw64');
  if (!existsSync(path.join(root, 'bin', 'g++.exe'))) {
    cachedBundledRoot = null;
    return undefined;
  }
  cachedBundledRoot = shortWindowsPath(root);
  return cachedBundledRoot;
}

function bundledCompilerBin(): string | undefined {
  if (process.platform !== 'win32') return undefined;
  const root = bundledCompilerRoot();
  if (!root) return undefined;
  const bin = path.join(root, 'bin');
  return existsSync(path.join(bin, 'g++.exe')) ? bin : undefined;
}

function childEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  const extraDirs = [activeCompilerPath ? path.dirname(activeCompilerPath) : '', bundledCompilerBin() ?? ''];
  env[pathKey] = [...new Set([...extraDirs, env[pathKey] ?? ''].filter(Boolean))].join(path.delimiter);
  const bundledBin = activeCompilerIsBundled ? bundledCompilerBin() : undefined;
  if (bundledBin) env.GCC_EXEC_PREFIX = `${path.join(path.dirname(bundledBin), 'lib', 'gcc')}${path.sep}`;
  return env;
}
const safeId = (value: string) => /^[a-f0-9-]{8,64}$/i.test(value);
const projectPath = (id: string) => {
  if (!safeId(id)) throw new Error('Mã dự án không hợp lệ.');
  return path.join(projectsRoot(), id);
};
const projectFile = (id: string) => path.join(projectPath(id), 'project.json');

async function readSettings(): Promise<Settings> {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(await fs.readFile(settingsFile(), 'utf8')) }; }
  catch { return { ...DEFAULT_SETTINGS, models: { ...DEFAULT_SETTINGS.models } }; }
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(temp, file);
}

async function readProject(id: string): Promise<Project> {
  const project = JSON.parse(await fs.readFile(projectFile(id), 'utf8')) as Project;
  return { ...project, images: project.images ?? [], tests: project.tests ?? [] };
}

function runChild(command: string, args: string[], options: { cwd?: string; input?: string; timeoutMs?: number; outputLimit?: number; env?: NodeJS.ProcessEnv } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let stdout = '', stderr = '', timedOut = false, outputLimited = false;
    const limit = options.outputLimit ?? 2 * 1024 * 1024;
    let child: ChildProcessWithoutNullStreams;
    try { child = spawn(command, args, { cwd: options.cwd, env: options.env ?? childEnvironment(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (error) { reject(error); return; }
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
    child.on('error', reject);
    const timer = options.timeoutMs ? setTimeout(() => { timedOut = true; child.kill(); }, options.timeoutMs) : undefined;
    child.on('close', (exitCode) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, runtimeMs: Date.now() - start, timedOut, outputLimited });
    });
    child.stdin.end(options.input ?? '');
  });
}

async function compiler(): Promise<string> {
  const settings = await readSettings();
  const bundledBin = bundledCompilerBin();
  const candidates = [settings.compilerPath, bundledBin ? path.join(bundledBin, 'g++.exe') : '', ...((process.env.PATH ?? '').split(path.delimiter).map((part) => path.join(part, process.platform === 'win32' ? 'g++.exe' : 'g++')))];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (existsSync(candidate)) {
      const result = await runChild(candidate, ['--version'], { timeoutMs: 4000, outputLimit: 16_000 }).catch(() => null);
      if (result?.exitCode === 0) {
        activeCompilerPath = candidate;
        activeCompilerIsBundled = bundledBin !== undefined && path.resolve(candidate).toLowerCase() === path.resolve(path.join(bundledBin, 'g++.exe')).toLowerCase();
        return candidate;
      }
    }
  }
  throw new Error('Không tìm thấy g++. Hãy cài lại ứng dụng hoặc chọn g++.exe trong Cài đặt.');
}

async function compile(projectId: string, kind: ProgramKind, source: string): Promise<CompileResult> {
  const selectedCompiler = await compiler();
  const dir = path.join(buildRoot(), projectId);
  await fs.mkdir(dir, { recursive: true });
  const sourceFile = path.join(dir, `${kind}.cpp`);
  const binary = path.join(dir, `${kind}${process.platform === 'win32' ? '.exe' : ''}`);
  await fs.writeFile(sourceFile, source, 'utf8');
  const result = await runChild(selectedCompiler, ['-std=c++17', '-O2', '-pipe', path.basename(sourceFile), '-o', path.basename(binary)], { timeoutMs: 60_000, outputLimit: 1_000_000, cwd: dir });
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

async function callAi(request: AiRequest, test = false): Promise<string> {
  const settings = await readSettings();
  const provider = request.provider ?? settings.provider;
  const model = request.model || settings.models[provider];
  const key = await aiKey(provider);
  if (provider === 'openai') {
    const client = new OpenAI({ apiKey: key });
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: 'text', text: request.prompt }];
    if (request.image) content.push({ type: 'image_url', image_url: { url: `data:${request.image.mimeType};base64,${request.image.data}` } });
    const result = await client.chat.completions.create({ model, messages: [{ role: 'user', content }], max_tokens: test ? 24 : request.maxOutputTokens ?? 3000 });
    return result.choices[0]?.message?.content ?? '';
  }
  const client = new GoogleGenAI({ apiKey: key });
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: request.prompt }];
  if (request.image) parts.push({ inlineData: request.image });
  const result = await client.models.generateContent({ model, contents: [{ role: 'user', parts }], config: { maxOutputTokens: test ? 24 : request.maxOutputTokens ?? 3000 } });
  return result.text ?? '';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 960, minHeight: 650,
    backgroundColor: '#f5f7fb', show: false,
    webPreferences: { preload: path.join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
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
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('app:status', async () => {
  const settings = await readSettings();
  try {
    const selectedCompiler = await compiler();
    return { compilerAvailable: true, compiler: activeCompilerIsBundled ? 'MinGW-w64 đi kèm ứng dụng' : selectedCompiler, onboardingComplete: settings.onboardingComplete };
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
ipcMain.handle('projects:save', async (_event, input: Project) => {
  if (!safeId(input.id)) throw new Error('Mã dự án không hợp lệ.');
  const project = { ...input, name: input.name.trim().slice(0, 100) || 'Dự án', updatedAt: new Date().toISOString() };
  const dir = projectPath(project.id);
  await fs.mkdir(path.join(dir, 'tests'), { recursive: true });
  await writeJson(projectFile(project.id), project);
  await fs.writeFile(path.join(dir, 'statement.md'), project.statement, 'utf8');
  await fs.writeFile(path.join(dir, 'generator.cpp'), project.generator, 'utf8');
  await fs.writeFile(path.join(dir, 'solution.cpp'), project.solution, 'utf8');
  await fs.writeFile(path.join(dir, 'validator.cpp'), project.validator, 'utf8');
  for (const test of project.tests) {
    const base = path.join(dir, 'tests', test.name);
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
ipcMain.handle('settings:pandoc:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, { title: 'Chọn Pandoc', filters: [{ name: 'Ứng dụng', extensions: ['exe'] }], properties: ['openFile'] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('ai:test', async (_event, request: AiRequest) => callAi({ ...request, prompt: 'Trả lời ngắn gọn: kết nối thành công.' }, true));
ipcMain.handle('ai:ask', async (_event, request: AiRequest) => callAi(request));

ipcMain.handle('code:compile', async (_event, projectId: string, kind: ProgramKind, source: string) => compile(projectId, kind, source));
ipcMain.handle('code:run', async (_event, projectId: string, kind: ProgramKind, input: string, args: string[] = [], timeoutMs = 2000) => {
  const file = binaryPath(projectId, kind);
  if (!existsSync(file)) throw new Error('Chưa biên dịch chương trình.');
  return runChild(file, args.map(String).slice(0, 32), { input, timeoutMs: Math.max(100, Math.min(timeoutMs, 30_000)), outputLimit: 2 * 1024 * 1024 });
});
ipcMain.handle('tests:generate', async (_event, projectId: string, count: number, seed: number, mode: string, source: string) => {
  const result = await compile(projectId, 'generator', source);
  if (!result.ok) throw new Error(`Generator biên dịch lỗi:\n${result.diagnostics}`);
  const tests: TestCase[] = [];
  const total = Math.min(Math.max(Math.floor(count), 1), 500);
  const modeId = ['random', 'boundary', 'constructive', 'stress'].includes(mode) ? mode : 'random';
  for (let i = 1; i <= total; i++) {
    const run = await runChild(binaryPath(projectId, 'generator'), [String(seed), String(i), modeId], { timeoutMs: 2500, outputLimit: 2 * 1024 * 1024, cwd: path.join(buildRoot(), projectId) });
    if (run.timedOut || run.exitCode !== 0 || run.outputLimited) throw new Error(`Generator lỗi ở test ${i}: ${run.stderr || 'quá thời gian hoặc output quá lớn'}`);
    tests.push({ id: randomUUID(), name: `TEST${String(i).padStart(2, '0')}`, input: run.stdout, output: '', status: 'pending' });
  }
  return tests;
});
ipcMain.handle('tests:run', async (_event, projectId: string, solution: string, tests: TestCase[], timeLimitMs: number) => {
  const compiled = await compile(projectId, 'solution', solution);
  if (!compiled.ok) throw new Error(`Lời giải biên dịch lỗi:\n${compiled.diagnostics}`);
  const outputs: TestCase[] = [];
  for (const test of tests) {
    const result = await runChild(binaryPath(projectId, 'solution'), [], { input: test.input, timeoutMs: Math.max(100, Math.min(timeLimitMs, 30_000)), outputLimit: 2 * 1024 * 1024, cwd: path.join(buildRoot(), projectId) });
    if (!result.timedOut && result.exitCode === 0 && !result.outputLimited) outputs.push({ ...test, output: result.stdout, status: 'passed', runtimeMs: result.runtimeMs, stderr: result.stderr });
    else outputs.push({ ...test, status: result.timedOut ? 'timeout' : 'failed', runtimeMs: result.runtimeMs, stderr: result.stderr || `Mã thoát: ${result.exitCode}` });
  }
  return outputs;
});

ipcMain.handle('export:themis', async (_event, project: Project) => {
  const ready = project.tests.filter((test) => test.status === 'passed');
  if (ready.length !== project.tests.length || ready.length === 0) throw new Error('Cần có input và output hợp lệ cho tất cả testcase trước khi xuất.');
  const choice = await dialog.showSaveDialog(mainWindow!, { title: 'Xuất bộ test Themis', defaultPath: `${project.name.replace(/[\\/:*?"<>|]/g, '_')}.zip`, filters: [{ name: 'Tệp ZIP', extensions: ['zip'] }] });
  if (choice.canceled || !choice.filePath) return null;
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(choice.filePath!);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve()); archive.on('error', reject); archive.pipe(output);
    ready.forEach((test, index) => {
      const folder = `BAI/TEST${String(index + 1).padStart(2, '0')}`;
      archive.append(test.input, { name: `${folder}/BAI.INP` }); archive.append(test.output, { name: `${folder}/BAI.OUT` });
    });
    void archive.finalize();
  });
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
  const printWindow = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } });
  const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><style>body{font:14px Arial,sans-serif;line-height:1.65;margin:24mm;color:#172033}pre{white-space:pre-wrap;font:inherit}h1{font-size:24px}</style><body><h1>${escapeHtml(project.name)}</h1><pre>${escapeHtml(project.statement)}</pre></body></html>`;
  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdf = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  await fs.writeFile(choice.filePath, pdf); printWindow.close(); return choice.filePath;
});
ipcMain.handle('export:docx', async (_event, project: Project) => {
  const settings = await readSettings();
  const pandoc = settings.pandocPath || 'pandoc';
  const choice = await dialog.showSaveDialog(mainWindow!, { title: 'Xuất đề DOCX', defaultPath: `${project.name.replace(/[\\/:*?"<>|]/g, '_')}.docx`, filters: [{ name: 'Word', extensions: ['docx'] }] });
  if (choice.canceled || !choice.filePath) return null;
  const md = path.join(app.getPath('temp'), `${randomUUID()}.md`); await fs.writeFile(md, `# ${project.name}\n\n${project.statement}`, 'utf8');
  const result = await runChild(pandoc, [md, '-o', choice.filePath], { timeoutMs: 30_000, outputLimit: 200_000 });
  await fs.rm(md, { force: true });
  if (result.exitCode !== 0) throw new Error(`Không chạy được Pandoc. Hãy cài Pandoc hoặc chọn pandoc.exe trong Cài đặt.\n${result.stderr}`);
  return choice.filePath;
});

ipcMain.handle('projects:open-folder', async (_event, id: string) => shell.openPath(projectPath(id)));

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}
