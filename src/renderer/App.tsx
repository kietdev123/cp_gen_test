import { useCallback, useEffect, useRef, useState } from 'react';
import packageJson from '../../package.json';
import appIcon from '../../build/icon.svg';
import userGuideMarkdown from '../../docs/USER_GUIDE.md?raw';
import ReactMarkdown from 'react-markdown';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import 'monaco-editor/languages/definitions/cpp/register.js';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Activity, ArrowDownToLine, ArrowRight, BadgeCheck, BookOpen, Braces, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Code2, Command, Download, FileCode2, FileImage, FileText, Folder,
  FolderOpen, KeyRound, ListChecks, LoaderCircle,
  Moon, Play, Plus, RefreshCw, Rocket, Save, Settings as SettingsIcon, Shield, Sparkles,
  Sun, Trash2, TriangleAlert, X,
} from 'lucide-react';
import type { AiRequest, GeneratorMode, Project, ProgramKind, Provider, Settings, TestCase, TestGenerationProgress, TestGroup, TestPlan, TestRunProgress } from '../shared/types';
import { AI_PROMPT_VERSION, AI_PROMPTS } from '../shared/ai-prompts';
import { AiQuickResultSchema, AiStatementDraftSchema, AiTestPlanSchema, statementVersion } from '../shared/validation';
import { DEFAULT_GENERATOR_TEMPLATE, DEFAULT_VALIDATOR_TEMPLATE } from '../shared/generator-template';
import { useApp, type Page } from './stores/app';

Object.assign(self, { MonacoEnvironment: { getWorker: () => new editorWorker() } });
loader.config({ monaco });

const nav: { id: Page; label: string; icon: typeof FolderOpen; section?: string }[] = [
  { id: 'projects', label: 'Bài thi', icon: FolderOpen, section: 'KHÔNG GIAN' },
  { id: 'settings', label: 'Cài đặt', icon: SettingsIcon, section: 'ỨNG DỤNG' },
  { id: 'help', label: 'Hướng dẫn sử dụng', icon: CircleHelp, section: 'TRỢ GIÚP' },
];

const workflowSteps: { id: Extract<Page, 'problem' | 'test-plan' | 'generator' | 'solution' | 'runner' | 'export'>; label: string; description: string; icon: typeof BookOpen }[] = [
  { id: 'problem', label: 'Biên soạn đề', description: 'Ý tưởng hoặc ảnh đề', icon: BookOpen },
  { id: 'test-plan', label: 'Test Plan', description: 'Nhóm test và tham số', icon: ListChecks },
  { id: 'generator', label: 'Generator', description: 'Tạo dữ liệu đầu vào', icon: Braces },
  { id: 'solution', label: 'Lời giải', description: 'Viết chương trình chuẩn', icon: Code2 },
  { id: 'runner', label: 'Kiểm tra', description: 'Chạy trên các testcase', icon: ListChecks },
  { id: 'export', label: 'Xuất bộ đề', description: 'Đóng gói và chia sẻ', icon: ArrowDownToLine },
];

const isWorkflowPage = (page: Page) => workflowSteps.some((step) => step.id === page);
type AiWorkflowStep = 'generator' | 'solution';
type AiWorkflowChoice = 'unasked' | 'ai';

async function retryOnce<T>(operation: () => Promise<T>, shouldRetry: (result: T) => boolean, onRetry: () => void): Promise<T> {
  let failed = false;
  try {
    const result = await operation();
    if (!shouldRetry(result)) return result;
    failed = true;
  } catch {
    failed = true;
  }
  if (failed) {
    onRetry();
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    return operation();
  }
  throw new Error('Thao tác thất bại.');
}

function parseJsonResponse(text: string): unknown {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI không trả về JSON hợp lệ.');
  return JSON.parse(withoutFence.slice(start, end + 1)) as unknown;
}

function buildTestPlanFromAi(value: ReturnType<typeof AiTestPlanSchema.parse>, statement: string): TestPlan {
  return {
    problemSpec: { ...value.problemSpec, statementVersion: statementVersion(statement) },
    groups: value.groups.map((group) => ({ ...group, id: globalThis.crypto.randomUUID() })),
    updatedAt: new Date().toISOString(),
  };
}

const pageInfo: Record<Page, { title: string; subtitle: string }> = {
  projects: { title: 'Bài thi của bạn', subtitle: 'Tất cả đề bài và bộ test được lưu ngay trên máy.' },
  problem: { title: 'Biên soạn đề', subtitle: 'Viết đề bằng Markdown, xem trước định dạng và công thức.' },
  'test-plan': { title: 'Test Plan', subtitle: 'Chia testcase thành nhóm, chọn mode và tham số; có thể chỉnh sửa mà không cần AI.' },
  generator: { title: 'Sinh testcase', subtitle: 'Tự viết generator C++17, biên dịch và tạo dữ liệu đầu vào.' },
  solution: { title: 'Lời giải chuẩn', subtitle: 'Biên dịch, chạy thử và tạo output bằng chương trình C++.' },
  runner: { title: 'Chạy & kiểm tra', subtitle: 'Chạy lời giải trên bộ test và xem trạng thái từng trường hợp.' },
  export: { title: 'Xuất bộ đề', subtitle: 'Tạo ZIP theo cấu trúc thư mục Themis hoặc xuất bản đề.' },
  settings: { title: 'Cài đặt', subtitle: 'Thiết lập AI, compiler và giao diện theo cách bạn làm việc.' },
  help: { title: 'Hướng dẫn sử dụng', subtitle: 'Các bước tạo đề, sinh testcase, kiểm tra và xuất bộ đề.' },
};

function App() {
  const { projects, active, settings, page, dirty, setProjects, upsertProject, setActive, setSettings, setPage, setDirty, updateActive } = useApp();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('sidebar-collapsed') === 'true');
  const [onboarding, setOnboarding] = useState(false);
  const [aiKey, setAiKey] = useState('');
  const [aiKeyModal, setAiKeyModal] = useState<Provider | null>(null);
  const [pendingAiRequest, setPendingAiRequest] = useState<AiRequest | null>(null);
  const [hasKeys, setHasKeys] = useState<Record<Provider, boolean>>({ openai: false, gemini: false });
  const [compilerAvailable, setCompilerAvailable] = useState(false);
  const [compilerName, setCompilerName] = useState('');
  const [toast, setToast] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectModal, setProjectModal] = useState(false);
  const [stepAiChoices, setStepAiChoices] = useState<Record<AiWorkflowStep, AiWorkflowChoice>>({ generator: 'unasked', solution: 'unasked' });
  const [solutionCheckKey, setSolutionCheckKey] = useState('');
  const [exportDirectory, setExportDirectory] = useState('');
  const [exportedProjectId, setExportedProjectId] = useState('');
  const [runInput, setRunInput] = useState('');
  const [runOutput, setRunOutput] = useState('');
  const [compileDiagnostics, setCompileDiagnostics] = useState<Partial<Record<ProgramKind, string>>>({});
  const [generationProgress, setGenerationProgress] = useState<TestGenerationProgress | null>(null);
  const [runProgress, setRunProgress] = useState<TestRunProgress | null>(null);
  const [ideaPrompt, setIdeaPrompt] = useState('');
  const [sourceMode, setSourceMode] = useState<'text' | 'image'>('text');
  const [photo, setPhoto] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ideaPromptRef = useRef<HTMLTextAreaElement>(null);
  const autoRunnerKey = useRef('');
  const autoTestPlanKey = useRef('');
  const autoCodeKey = useRef('');
  const pendingAiResolve = useRef<((value: string) => void) | null>(null);

  const notify = useCallback((text: string, kind: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, kind }); window.setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(() => {
    void Promise.all([window.studio.getSettings(), window.studio.listProjects(), window.studio.getStatus()]).then(([prefs, savedProjects, status]) => {
      setSettings(prefs); setProjects(savedProjects); setCompilerAvailable(status.compilerAvailable); setCompilerName(status.compiler);
      setOnboarding(!prefs.onboardingComplete);
      void Promise.all([window.studio.hasApiKey('openai'), window.studio.hasApiKey('gemini')]).then(([openai, gemini]) => setHasKeys({ openai, gemini }));
    }).catch((error: Error) => notify(error.message, 'error'));
  }, [notify, setProjects, setSettings]);

  useEffect(() => {
    if (!dirty || !active) return;
    const timer = window.setTimeout(() => {
      void window.studio.saveProject(active).then((saved) => {
        upsertProject(saved); setActive(saved); setDirty(false);
      }).catch((error: Error) => notify(`Không lưu được: ${error.message}`, 'error'));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [active, dirty, notify, setActive, setDirty, upsertProject]);

  useEffect(() => { document.documentElement.dataset.theme = settings?.theme ?? 'light'; }, [settings?.theme]);

  useEffect(() => { window.localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed)); }, [sidebarCollapsed]);

  useEffect(() => {
    const stopGeneration = window.studio.onGenerationProgress(setGenerationProgress);
    const stopRun = window.studio.onTestRunProgress(setRunProgress);
    return () => { stopGeneration(); stopRun(); };
  }, []);

  const persistActiveProject = async () => {
    if (!active) return false;
    try {
      const saved = await window.studio.saveProject(active);
      upsertProject(saved); setActive(saved); setDirty(false);
      return true;
    } catch (error) { notify(`Không lưu được: ${(error as Error).message}`, 'error'); return false; }
  };

  const createProject = async () => {
    const value = projectName.trim();
    if (!value) return;
    try {
      const project = await window.studio.createProject(value);
      autoTestPlanKey.current = '';
      autoCodeKey.current = '';
      setActive(project); setProjects([project, ...projects]); setPage('problem'); setSourceMode('text'); setIdeaPrompt(''); setPhoto(null); setStepAiChoices({ generator: 'unasked', solution: 'unasked' }); setSolutionCheckKey(''); setExportDirectory(''); setExportedProjectId(''); setProjectModal(false); setProjectName('');
      notify('Đã tạo bài thi mới.');
    } catch (error) { notify((error as Error).message, 'error'); }
  };

  const openProject = async (project: Project) => {
    if (active && dirty && !(await persistActiveProject())) return;
    try {
      const latestProjects = await window.studio.listProjects();
      const latestProject = latestProjects.find((item) => item.id === project.id);
      if (!latestProject) throw new Error('Không tìm thấy bài thi đã lưu.');
      setProjects(latestProjects);
      autoTestPlanKey.current = ''; autoCodeKey.current = '';
      setActive(latestProject); setPage('problem'); setSourceMode(latestProject.images.length ? 'image' : 'text'); setIdeaPrompt(''); setPhoto(null); setStepAiChoices({ generator: 'unasked', solution: 'unasked' }); setSolutionCheckKey(''); setExportDirectory(''); setExportedProjectId('');
    } catch (error) { notify(`Không mở được bài thi: ${(error as Error).message}`, 'error'); }
  };

  const removeProject = async (project: Project) => {
    if (!window.confirm(`Xóa bài thi “${project.name}” và các tệp liên quan?`)) return;
    try {
      await window.studio.deleteProject(project.id); const all = projects.filter((item) => item.id !== project.id);
      setProjects(all); if (active?.id === project.id) setActive(null); notify('Đã xóa bài thi.');
    } catch (error) { notify((error as Error).message, 'error'); }
  };

  const updateSettings = async (next: Settings) => {
    setSettings(next);
    try { await window.studio.saveSettings(next); }
    catch (error) { notify((error as Error).message, 'error'); }
  };

  const saveKey = async (provider: Provider) => {
    if (!aiKey.trim()) { notify('Hãy nhập API key trước.', 'error'); return; }
    setBusy('key');
    try {
      await window.studio.saveApiKey(provider, aiKey); setHasKeys({ ...hasKeys, [provider]: true }); setAiKey('');
      notify(`Đã lưu API key ${provider === 'openai' ? 'OpenAI' : 'Gemini'} an toàn.`);
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(''); }
  };

  const finishOnboarding = async (skip = false) => {
    if (!settings) return;
    if (!skip && aiKey.trim()) {
      await saveKey(settings.provider);
    }
    const next = { ...settings, onboardingComplete: true };
    await updateSettings(next); setOnboarding(false);
  };

  const performAiRequest = async (request: AiRequest, label: string) => {
    setBusy(label);
    try {
      const response = await window.studio.askAi(request);
      return response.text;
    } catch (error) { notify((error as Error).message, 'error'); return ''; }
    finally { setBusy(''); }
  };

  const runAi = async (request: AiRequest, label = 'Đang hỏi AI…') => {
    if (!settings) return '';
    const provider = request.provider ?? settings.provider;
    const requestWithContext = { ...request, projectId: request.projectId ?? active?.id, promptVersion: request.promptVersion ?? AI_PROMPT_VERSION };
    if (!hasKeys[provider]) {
      setPendingAiRequest(requestWithContext);
      setAiKeyModal(provider);
      return new Promise<string>((resolve) => { pendingAiResolve.current = resolve; });
    }
    return performAiRequest(requestWithContext, label);
  };

  const cancelAiKeySetup = () => {
    setAiKeyModal(null); setPendingAiRequest(null); setAiKey('');
    pendingAiResolve.current?.(''); pendingAiResolve.current = null;
  };

  const saveAiKeyAndContinue = async () => {
    if (!aiKeyModal || !aiKey.trim()) { notify('Hãy nhập API key trước.', 'error'); return; }
    const provider = aiKeyModal;
    setBusy('key');
    try {
      await window.studio.saveApiKey(provider, aiKey);
      setHasKeys((current) => ({ ...current, [provider]: true }));
      setAiKey(''); setAiKeyModal(null);
      const request = pendingAiRequest;
      setPendingAiRequest(null);
      if (request) {
        const response = await performAiRequest(request, 'Đang hỏi AI…');
        pendingAiResolve.current?.(response); pendingAiResolve.current = null;
      }
      setBusy('');
      notify(`Đã lưu API key ${provider === 'openai' ? 'OpenAI' : 'Gemini'} an toàn.`);
    } catch (error) {
      notify((error as Error).message, 'error');
      setBusy('');
    }
  };

  const compileSource = async (kind: ProgramKind, source: string) => {
    if (!active) { notify('Hãy mở hoặc tạo bài thi trước.', 'info'); return false; }
    setBusy(`compile-${kind}`);
    try {
      const label = kind === 'generator' ? 'Generator' : kind === 'solution' ? 'Lời giải' : 'Validator';
      const result = await retryOnce(() => window.studio.compile(active.id, kind, source), (attempt) => !attempt.ok, () => notify(`Biên dịch ${label} lỗi, sẽ thử lại sau 1 giây…`, 'info'));
      setCompileDiagnostics((current) => ({ ...current, [kind]: result.ok ? '' : result.diagnostics }));
      if (result.ok) notify(`${kind === 'generator' ? 'Generator' : kind === 'solution' ? 'Lời giải' : 'Validator'} biên dịch thành công với ${result.compiler}.`);
      else notify(result.diagnostics || 'Biên dịch chưa thành công.', 'error');
      setCompilerAvailable(result.ok || compilerAvailable); setCompilerName(result.compiler);
      return result.ok;
    } catch (error) { notify((error as Error).message, 'error'); return false; }
    finally { setBusy(''); }
  };

  const runSolution = async () => {
    if (!active) return;
    const ok = await compileSource('solution', active.solution);
    if (!ok) return;
    setBusy('run');
    try {
      const result = await retryOnce(() => window.studio.run(active.id, 'solution', runInput, [], active.timeLimitMs), (attempt) => attempt.timedOut || attempt.exitCode !== 0 || attempt.outputLimited, () => notify('Chạy thử lời giải gặp lỗi, sẽ thử lại sau 1 giây…', 'info'));
      setRunOutput(`${result.timedOut ? 'Quá thời gian.\n' : ''}${result.stdout}${result.stderr ? `\n[stderr]\n${result.stderr}` : ''}${result.exitCode !== 0 && !result.timedOut ? `\nMã thoát: ${result.exitCode}` : ''}`);
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(''); }
  };

  const runAllTests = async () => {
    if (!active || !active.tests.some((test) => !test.inputStale && !['duplicate', 'invalid', 'error'].includes(test.status))) { notify('Chưa có testcase hợp lệ để chạy.', 'info'); return; }
    setBusy('run-tests');
    setRunProgress(null);
    try {
      const result = await window.studio.runTests(active.id, active.solution, active.tests, active.timeLimitMs, undefined, active.oracleSolution);
      updateActive({ tests: result });
      const eligible = result.filter((test) => !test.inputStale && !['duplicate', 'invalid', 'error'].includes(test.status));
      const ready = eligible.filter((test) => ['generated', 'verified'].includes(test.status) && !test.outputStale).length;
      const verified = eligible.filter((test) => test.status === 'verified').length;
      notify(`Hoàn tất: ${ready}/${eligible.length} có output; ${verified} đã đối chiếu với oracle.`, ready === eligible.length ? 'success' : 'error');
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(''); }
  };

  const runTestGroup = async (groupId: string) => {
    if (!active) return;
    const ids = active.tests.filter((test) => test.groupId === groupId && !test.inputStale && !['duplicate', 'invalid', 'error'].includes(test.status)).map((test) => test.id);
    if (!ids.length) { notify('Nhóm này không có testcase hợp lệ để chạy.', 'info'); return; }
    setBusy('run-tests');
    setRunProgress(null);
    try {
      const result = await window.studio.runTests(active.id, active.solution, active.tests, active.timeLimitMs, ids, active.oracleSolution);
      updateActive({ tests: result });
      notify(`Đã chạy ${ids.length} testcase trong nhóm.`);
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(''); }
  };

  const exportAllFiles = async () => {
    if (!active) { notify('Hãy mở bài thi trước.', 'info'); return; }
    setBusy('export');
    try {
      const result = await window.studio.exportAll(active);
      if (result) {
        setExportDirectory(result.directory);
        setExportedProjectId(active.id);
        notify(`Đã xuất ${result.files.length} tệp vào ${result.directory}.`);
      } else notify('Đã hủy chọn thư mục xuất.', 'info');
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(''); }
  };

  useEffect(() => {
    if (page !== 'runner' || !active?.tests.length) return;
    const key = `${active.id}:${active.solution}:${active.tests.map((test) => test.id).join(',')}`;
    const runnable = active.tests.filter((test) => !test.inputStale && !['duplicate', 'invalid', 'error'].includes(test.status));
    if (!runnable.length || runnable.every((test) => ['generated', 'verified'].includes(test.status) && !test.outputStale) || autoRunnerKey.current === key) return;
    autoRunnerKey.current = key;
    void runAllTests();
  }, [page, active?.id, active?.solution, active?.tests, runAllTests]);

  const pickImage = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { notify('Chọn ảnh PNG, JPG hoặc WebP.', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { notify('Ảnh tối đa 10 MB để lưu bài thi và gửi AI ổn định.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const [, data = ''] = String(reader.result).split(',');
      setSourceMode('image');
      setPhoto({ data, mimeType: file.type, name: file.name });
      if (!active) { notify('Hãy mở bài thi trước khi thêm ảnh.', 'error'); return; }
      void window.studio.saveProjectImage(active.id, file.name, file.type, data).then((image) => {
        updateActive({ images: [...active.images, image] });
        notify(`Đã lưu ảnh ${file.name} trong bài thi. Bấm “Đọc ảnh bằng AI” để trích nội dung.`, 'info');
      }).catch((error: Error) => notify(error.message, 'error'));
    };
    reader.readAsDataURL(file);
  };

  const extractImage = async () => {
    if (!active) return;
    let image = photo;
    if (!image) {
      const saved = active.images.at(-1);
      if (saved) {
        const file = await window.studio.readProjectImage(active.id, saved.id);
        if (file) image = { ...file, name: saved.name };
      }
    }
    if (!image) { notify('Chưa có ảnh đề trong bài thi.', 'info'); return; }
    const answer = await runAi({ prompt: AI_PROMPTS.imageToStatement, image: { data: image.data, mimeType: image.mimeType }, maxOutputTokens: 4000, outputFormat: 'json' }, 'Đang đọc ảnh…');
    if (answer) {
      try {
        const draft = AiStatementDraftSchema.parse(parseJsonResponse(answer));
        updateActive({ statement: draft.statement, tests: active.tests.map((test) => ({ ...test, inputStale: true, outputStale: Boolean(test.output) || test.outputStale })) });
        if (settings) await updateSettings({ ...settings, themisInputFile: draft.themisInputFile, themisOutputFile: draft.themisOutputFile });
        notify('Đã đưa nội dung đề và tên file Themis do AI đề xuất vào bước 1.');
      } catch (error) { notify(`AI trả về dữ liệu đề hoặc tên file Themis không hợp lệ: ${(error as Error).message}`, 'error'); }
    }
  };

  const draftStatementFromIdea = async () => {
    const idea = ideaPrompt.trim();
    if (!idea) { notify('Hãy mô tả ý tưởng bài toán trước.', 'info'); return; }
    if (active?.statement.trim() && !window.confirm('AI sẽ thay thế nội dung đề hiện tại. Bạn muốn tiếp tục?')) return;
    const answer = await runAi({ prompt: AI_PROMPTS.statementFromIdea(idea), maxOutputTokens: 5000, outputFormat: 'json' }, 'Đang soạn đề từ ý tưởng…');
    if (answer && active) {
      try {
        const draft = AiStatementDraftSchema.parse(parseJsonResponse(answer));
        updateActive({ statement: draft.statement, tests: active.tests.map((test) => ({ ...test, inputStale: true, outputStale: Boolean(test.output) || test.outputStale })) });
        if (settings) await updateSettings({ ...settings, themisInputFile: draft.themisInputFile, themisOutputFile: draft.themisOutputFile });
        notify('AI đã đưa bản đề và tên file Themis vào bước 1 để bạn kiểm tra, chỉnh sửa.');
      } catch (error) { notify(`AI trả về dữ liệu đề hoặc tên file Themis không hợp lệ: ${(error as Error).message}`, 'error'); }
    }
  };

  const fixCodeWithAi = async (kind: ProgramKind, source: string) => {
    const diagnostics = compileDiagnostics[kind];
    if (!diagnostics) { notify('Biên dịch mã trước để lấy diagnostics.', 'info'); return; }
    const prompt = AI_PROMPTS.codeFix.replace('${diagnostics}', () => diagnostics).replace('${source}', () => source);
    const answer = await runAi({ prompt, maxOutputTokens: 5000 }, 'Đang đề xuất sửa lỗi C++…');
    if (!answer) return;
    const code = answer.match(/```(?:cpp|c\+\+)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? answer.trim();
    if (kind === 'generator' && active) updateActive({ generator: code, tests: active.tests.map((test) => ({ ...test, inputStale: true, outputStale: Boolean(test.output) || test.outputStale })) });
    if (kind === 'solution' && active) updateActive({ solution: code, tests: active.tests.map((test) => ({ ...test, outputStale: Boolean(test.output) || test.outputStale })) });
    if (kind === 'validator' && active) updateActive({ validator: code, tests: active.tests.map((test) => ({ ...test, inputStale: true, outputStale: Boolean(test.output) || test.outputStale })) });
    if (kind === 'oracle' && active) updateActive({ oracleSolution: code, tests: active.tests.map((test) => test.status === 'verified' ? { ...test, outputStale: true } : test) });
    notify('Đã đưa bản sửa AI vào trình soạn thảo. Hãy rà soát trước khi biên dịch lại.', 'info');
  };

  const analyzeTestPlan = async () => {
    if (!active) return;
    const prompt = AI_PROMPTS.testPlan.replace('${statement}', active.statement);
    const answer = await runAi({ prompt, outputFormat: 'json', maxOutputTokens: 3000 }, 'Đang phân tích đề và lập Test Plan…');
    if (!answer) return;
    try {
      const parsed = AiTestPlanSchema.parse(parseJsonResponse(answer));
      updateActive({ testPlan: buildTestPlanFromAi(parsed, active.statement) });
      notify('Đã tạo Test Plan. Hãy rà soát nhóm, mode và tham số trước khi sinh test.');
    } catch (error) { notify(`Test Plan AI không hợp lệ: ${(error as Error).message}`, 'error'); }
  };

  const quickCreateWithAi = async () => {
    if (!active) return;
    const prompt = AI_PROMPTS.quick.replace('${statement}', active.statement);
    const answer = await runAi({ prompt, outputFormat: 'json', maxOutputTokens: 7000 }, 'Đang tạo Test Plan và generator…');
    if (!answer) return;
    try {
      const result = AiQuickResultSchema.parse(parseJsonResponse(answer));
      const testPlan = buildTestPlanFromAi(result.testPlan, active.statement);
      updateActive({ testPlan, generator: result.generator, tests: active.tests.map((test) => ({ ...test, inputStale: true, outputStale: Boolean(test.output) || test.outputStale })) });
      setStepAiChoices((current) => ({ ...current, generator: 'ai' }));
      notify('Đã tạo Test Plan và generator trong một request. Hãy rà soát rồi sinh testcase.');
    } catch (error) { notify(`Kết quả Quick AI không hợp lệ: ${(error as Error).message}`, 'error'); }
  };

  const generateValidatorWithAi = async () => {
    if (!active) return;
    const answer = await runAi({ prompt: `${AI_PROMPTS.validator}\n\nĐề bài:\n${active.statement}`, maxOutputTokens: 5000 }, 'Đang tạo validator C++17…');
    if (!answer) return;
    const code = answer.match(/```(?:cpp|c\+\+)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? answer.trim();
    updateActive({ validator: code, tests: active.tests.map((test) => ({ ...test, inputStale: true, outputStale: Boolean(test.output) || test.outputStale })) });
  };

  const generateCodeWithAi = async (kind: AiWorkflowStep): Promise<string> => {
    if (!active) return '';
    const task = kind === 'generator' ? AI_PROMPTS.generator : AI_PROMPTS.solution;
    const generatorForSolution = kind === 'solution' ? active.generator.trim().slice(0, 16_000) : '';
    const generatorExcerptNote = kind === 'solution' && active.generator.trim().length > 16_000 ? '\n[Generator đã được rút gọn tại 16.000 ký tự.]' : '';
    const context = kind === 'generator'
      ? `\n\nTest Plan:\n${JSON.stringify(active.testPlan, null, 2)}\n\nĐề bài:\n${active.statement}`
      : `\n\nĐề bài (đặc tả có thẩm quyền):\n${active.statement}\n\nTest Plan từ bước trước (dùng để hiểu các nhóm dữ liệu cần bao phủ; nếu khác đề bài thì ưu tiên đề bài):\n${JSON.stringify(active.testPlan, null, 2)}\n\nGenerator C++ từ bước trước (chỉ tham khảo cách tạo input; không xem đây là đặc tả):\n\`\`\`cpp\n${generatorForSolution}${generatorExcerptNote}\n\`\`\``;
    const answer = await runAi({ prompt: `${task}${context}`, maxOutputTokens: 5000 }, `Đang tạo ${kind === 'generator' ? 'generator' : 'lời giải'}…`);
    const code = answer.match(/```(?:cpp|c\+\+)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? answer.trim();
    if (code && kind === 'generator') updateActive({ generator: code, tests: active.tests.map((test) => ({ ...test, inputStale: true, outputStale: Boolean(test.output) || test.outputStale })) });
    if (code && kind === 'solution') updateActive({ solution: code, tests: active.tests.map((test) => ({ ...test, outputStale: Boolean(test.output) || test.outputStale })) });
    return code;
  };

  const isReadyStatement = (project: Project) => Boolean(project.statement.trim() && !project.statement.includes('Nhập đề bài Markdown tại đây'));
  const isReadyGenerator = (project: Project, source = project.generator) => {
    const normalized = source.trim().replace(/\r\n/g, '\n');
    const starter = DEFAULT_GENERATOR_TEMPLATE.trim().replace(/\r\n/g, '\n');
    return Boolean(normalized && normalized !== starter && !normalized.includes('TODO: Thay'));
  };
  const isReadySolution = (project: Project, source = project.solution) => Boolean(source.trim() && !source.includes('TODO: Dán'));
  const validPlanTotal = (plan: TestPlan) => plan.groups.reduce((sum, group) => sum + group.count, 0);
  const isTestPlanCurrent = (project: Project) => project.testPlan.problemSpec.statementVersion === statementVersion(project.statement);
  const isTestPlanAnalyzed = (project: Project) => Boolean(
    project.testPlan.problemSpec.summary.trim()
    && project.testPlan.problemSpec.inputFormat.trim()
    && project.testPlan.problemSpec.outputFormat.trim(),
  );
  const usableTests = (project: Project) => project.tests.filter((test) => !test.inputStale && !['duplicate', 'invalid', 'error'].includes(test.status));
  const solutionKey = (project: Project, source = project.solution) => `${project.id}:${source}:${project.tests.map((test) => test.id).join(',')}`;

  useEffect(() => {
    if (!active || page !== 'test-plan' || !isReadyStatement(active)) return;
    if (isTestPlanCurrent(active) && isTestPlanAnalyzed(active)) return;
    const key = `${active.id}:${statementVersion(active.statement)}`;
    if (autoTestPlanKey.current === key) return;
    autoTestPlanKey.current = key;
    void analyzeTestPlan();
  }, [active?.id, active?.statement, active?.testPlan.problemSpec.statementVersion, active?.testPlan.problemSpec.summary, active?.testPlan.problemSpec.inputFormat, active?.testPlan.problemSpec.outputFormat, page]);

  useEffect(() => {
    if (!active || (page !== 'generator' && page !== 'solution') || stepAiChoices[page] !== 'unasked') return;
    const ready = page === 'generator' ? isReadyGenerator(active) : isReadySolution(active);
    if (ready) return;
    const key = `${active.id}:${page}`;
    if (autoCodeKey.current === key) return;
    autoCodeKey.current = key;
    setStepAiChoices((current) => ({ ...current, [page]: 'ai' }));
    void generateCodeWithAi(page);
  }, [active?.id, active?.statement, active?.testPlan, active?.generator, active?.solution, page, stepAiChoices]);
  const isStepDone = (project: Project, step: typeof workflowSteps[number]) => {
    if (step.id === 'problem') return isReadyStatement(project);
    if (step.id === 'test-plan') return isTestPlanCurrent(project) && isTestPlanAnalyzed(project) && validPlanTotal(project.testPlan) > 0 && validPlanTotal(project.testPlan) <= 500;
    if (step.id === 'generator') return isReadyGenerator(project) && usableTests(project).some((test) => test.status === 'pending' || test.status === 'generated' || test.status === 'verified');
    if (step.id === 'solution') return isReadySolution(project) && (solutionCheckKey === solutionKey(project, project.solution) || usableTests(project).some((test) => ['generated', 'verified'].includes(test.status)));
    if (step.id === 'runner') {
      const runnable = usableTests(project);
      return runnable.length > 0 && runnable.every((test) => ['generated', 'verified'].includes(test.status) && !test.outputStale);
    }
    return exportedProjectId === project.id;
  };

  const runGeneratorStep = async () => {
    if (!active) return false;
    const source = active.generator;
    if (!isReadyGenerator(active, source)) { notify('Generator chưa sẵn sàng. Hãy sửa mã hoặc dùng nút AI trên màn hình.', 'info'); return false; }
    setBusy('generate');
    setGenerationProgress(null);
    try {
      const result = await window.studio.generateTests(active.id, active.testPlan, active.seed, source, active.validator, statementVersion(active.statement), active.tests.map((test) => test.sha256).filter((hash): hash is string => Boolean(hash)));
      const additions = result.tests.map((test, index) => ({ ...test, name: `TEST${String(active.tests.length + index + 1).padStart(2, '0')}` }));
      const saved = await window.studio.saveProject({ ...active, generator: source, tests: [...active.tests, ...additions], generationLogs: [...active.generationLogs, result.log].slice(-100) });
      upsertProject(saved); setActive(saved); setDirty(false);
      setSolutionCheckKey('');
      setGenerationProgress(null);
      notify(result.log.warnings[0] ?? `Đã sinh ${result.log.generated}/${result.log.requested} input duy nhất và hợp lệ.`, result.log.warnings.length ? 'info' : 'success');
      return result.log.generated > 0;
    } catch (error) { notify((error as Error).message, 'error'); return false; }
    finally { setBusy(''); }
  };

  const verifySolutionStep = async () => {
    if (!active) return false;
    const source = active.solution;
    if (!isReadySolution(active, source)) { notify('Lời giải chưa sẵn sàng. Hãy sửa mã hoặc dùng nút AI trên màn hình.', 'info'); return false; }
    const compiled = await compileSource('solution', source);
    if (!compiled) return false;
    setBusy('run');
    try {
      const input = runInput || usableTests(active)[0]?.input || '';
      if (!input) { notify('Hãy sinh ít nhất một testcase hợp lệ trước khi kiểm tra lời giải.', 'info'); return false; }
      const result = await retryOnce(() => window.studio.run(active.id, 'solution', input, [], active.timeLimitMs), (attempt) => attempt.timedOut || attempt.exitCode !== 0 || attempt.outputLimited, () => notify('Chạy thử lời giải gặp lỗi, sẽ thử lại sau 1 giây…', 'info'));
      setRunInput(input);
      setRunOutput(`${result.timedOut ? 'Quá thời gian.\n' : ''}${result.stdout}${result.stderr ? `\n[stderr]\n${result.stderr}` : ''}${result.exitCode !== 0 && !result.timedOut ? `\nMã thoát: ${result.exitCode}` : ''}`);
      if (result.timedOut || result.exitCode !== 0 || result.outputLimited) {
        notify(result.timedOut ? 'Lời giải chạy quá thời gian trên testcase đầu.' : result.outputLimited ? 'Lời giải tạo output quá lớn.' : `Lời giải thoát với mã ${result.exitCode}.`, 'error');
        return false;
      }
      const saved = await window.studio.saveProject({ ...active, solution: source });
      upsertProject(saved); setActive(saved); setDirty(false);
      setSolutionCheckKey(solutionKey(active, source));
      notify('Đã tự biên dịch và chạy thử lời giải trên testcase đầu.');
      return true;
    } catch (error) { notify((error as Error).message, 'error'); return false; }
    finally { setBusy(''); }
  };

  const analyzeFileImage = () => fileInput.current?.click();
  const pageContent = () => {
    if (page === 'projects') return <Projects projects={projects} openProject={openProject} create={() => setProjectModal(true)} remove={removeProject} />;
    if (page === 'problem') return active ? <Problem project={active} update={updateActive} settings={settings} updateSettings={updateSettings} sourceMode={sourceMode} setSourceMode={setSourceMode} ideaPrompt={ideaPrompt} setIdeaPrompt={setIdeaPrompt} ideaPromptRef={ideaPromptRef} onDraftFromIdea={draftStatementFromIdea} onPickImage={analyzeFileImage} onExtract={extractImage} photoName={photo?.name ?? active.images.at(-1)?.name} aiBusy={Boolean(busy && busy.startsWith('Đang'))} /> : <EmptyProject create={() => setProjectModal(true)} />;
    if (page === 'test-plan') return active ? <TestPlanEditor project={active} update={updateActive} analyze={analyzeTestPlan} quickCreate={quickCreateWithAi} busy={busy} /> : <EmptyProject create={() => setProjectModal(true)} />;
    if (page === 'generator') return active ? <Generator project={active} update={updateActive} progress={generationProgress} goToPlan={() => setPage('test-plan')} askAi={() => generateCodeWithAi('generator')} askValidator={generateValidatorWithAi} compile={() => compileSource('generator', active.generator)} compileValidator={() => compileSource('validator', active.validator)} fix={() => void fixCodeWithAi('generator', active.generator)} fixValidator={() => void fixCodeWithAi('validator', active.validator)} diagnostics={compileDiagnostics.generator ?? ''} validatorDiagnostics={compileDiagnostics.validator ?? ''} busy={busy} /> : <EmptyProject create={() => setProjectModal(true)} />;
    if (page === 'solution') return active ? <Solution project={active} update={updateActive} input={runInput} setInput={setRunInput} output={runOutput} busy={busy} compile={() => compileSource('solution', active.solution)} run={runSolution} askAi={() => generateCodeWithAi('solution')} fix={() => void fixCodeWithAi('solution', active.solution)} diagnostics={compileDiagnostics.solution ?? ''} /> : <EmptyProject create={() => setProjectModal(true)} />;
    if (page === 'runner') return active ? <Runner project={active} busy={busy} progress={runProgress} runAll={runAllTests} clear={() => updateActive({ tests: [] })} regenerate={async (test) => {
      const group = active.testPlan.groups.find((item) => item.id === test.groupId);
      if (!group) { notify('Không tìm thấy nhóm Test Plan để sinh lại testcase.', 'error'); return; }
      setBusy('generate');
      try {
        const regenerated = await window.studio.regenerateTest(active.id, group, active.seed, test.testIndex ?? 1, active.generator, active.validator, statementVersion(active.statement), active.tests.filter((item) => item.id !== test.id && item.sha256).map((item) => item.sha256!));
        updateActive({ tests: active.tests.map((item) => item.id === test.id ? regenerated : item) });
        notify(`Đã sinh lại ${test.name}.`);
      } catch (error) { notify((error as Error).message, 'error'); }
      finally { setBusy(''); }
    }} remove={(test) => updateActive({ tests: active.tests.filter((item) => item.id !== test.id) })} runGroup={runTestGroup} /> : <EmptyProject create={() => setProjectModal(true)} />;
    if (page === 'export') return active ? <Export project={active} busy={busy} directory={exportDirectory} exported={exportedProjectId === active.id} exportAgain={exportAllFiles} /> : <EmptyProject create={() => setProjectModal(true)} />;
    if (page === 'help') return <HelpPage />;
    return <SettingsPage settings={settings} hasKeys={hasKeys} aiKey={aiKey} setAiKey={setAiKey} saveKey={saveKey} update={updateSettings} busy={busy} compilerAvailable={compilerAvailable} compilerName={compilerName} test={async () => { setBusy('Đang kiểm tra kết nối AI…'); try { const result = await window.studio.testAiConnection({ provider: settings?.provider, prompt: AI_PROMPTS.connectionTest }); notify(`Kết nối thành công: ${result}`, 'success'); } catch (error) { notify((error as Error).message, 'error'); } finally { setBusy(''); } }} removeKey={async (provider) => { await window.studio.removeApiKey(provider); setHasKeys({ ...hasKeys, [provider]: false }); notify('Đã xóa API key.'); }} chooseCompiler={async () => { const file = await window.studio.chooseCompiler(); if (file && settings) { const next = { ...settings, compilerPath: file }; await updateSettings(next); const status = await window.studio.getStatus(); setCompilerAvailable(status.compilerAvailable); setCompilerName(status.compiler); } }} />;
  };

  const currentPage = pageInfo[page];
  const workflowIndex = workflowSteps.findIndex((step) => step.id === page);
  const stepDone = (step: typeof workflowSteps[number]) => active ? isStepDone(active, step) : false;
  const canAccessStep = (index: number) => Boolean(active && workflowSteps.slice(0, index).every((step) => isStepDone(active, step)));
  const canProceed = !active ? false
    : page === 'problem' ? isReadyStatement(active)
      : page === 'test-plan' ? isStepDone(active, workflowSteps[1])
      : page === 'generator' ? isReadyGenerator(active)
        : page === 'solution' ? isReadySolution(active)
          : page === 'runner' ? isStepDone(active, workflowSteps.find((step) => step.id === 'runner')!) && busy !== 'run-tests'
            : page === 'export' ? true : false;
  useEffect(() => {
    if (!active || !isWorkflowPage(page)) return;
    const index = workflowSteps.findIndex((step) => step.id === page);
    const firstIncomplete = workflowSteps.slice(0, index).find((step) => !isStepDone(active, step));
    if (firstIncomplete) setPage(firstIncomplete.id);
  }, [active, page, solutionCheckKey, exportedProjectId, setPage]);

  const moveWorkflow = async (direction: -1 | 1) => {
    if (!active || busy) return;
    if (direction < 0) {
      const previous = workflowSteps[workflowIndex - 1];
      if (previous && await persistActiveProject()) setPage(previous.id);
      return;
    }
    if (page === 'problem' && !isReadyStatement(active)) { notify('Hãy nhập hoặc tạo nội dung đề trước khi tiếp tục.', 'info'); return; }
    if (!canProceed) { notify('Hoàn thành nội dung của bước này trước khi tiếp tục.', 'info'); return; }
    if (!(await persistActiveProject())) return;

    if (page === 'generator') {
      if (!(await runGeneratorStep())) return;
      setPage('solution');
      return;
    }
    if (page === 'solution') {
      if (!(await verifySolutionStep())) return;
      setPage('runner');
      return;
    }
    if (page === 'runner') {
      const runnable = usableTests(active);
      if (!runnable.length || !runnable.every((test) => ['generated', 'verified'].includes(test.status) && !test.outputStale)) {
        notify('Bước kiểm tra chưa hoàn tất. Hãy xem lỗi hoặc chạy lại testcase hợp lệ.', 'info');
        return;
      }
      setPage('export');
      return;
    }
    if (page === 'export') {
      if (exportedProjectId !== active.id) { await exportAllFiles(); return; }
      setPage('projects');
      return;
    }
    const next = workflowSteps[workflowIndex + 1];
    if (next) setPage(next.id);
  };
  return <>
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} inert={busy ? true : undefined} aria-busy={Boolean(busy)}>
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" title="CP Test Studio"><img src={appIcon} alt="" /></div>
        <div className="brand-copy"><strong>CP Test Studio</strong><span>THI LẬP TRÌNH • VI</span></div>
        <button className="sidebar-toggle" type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} title={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu nhỏ thanh bên'} aria-label={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu nhỏ thanh bên'}>
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav className="side-nav">
        {nav.map((item) => <div key={item.id}>
          {item.section && <div className="nav-section">{item.section}</div>}
          <button className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)} title={sidebarCollapsed ? item.label : undefined}><item.icon size={18} strokeWidth={page === item.id ? 2.3 : 1.8} /><span>{item.label}</span></button>
        </div>)}
      </nav>
      {settings && <button className="sidebar-theme-toggle" type="button" onClick={() => void updateSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })} title={settings.theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'} aria-label={settings.theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}>
        {settings.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}<span>{settings.theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}</span>
      </button>}
      <div className="sidebar-version"><span>Phiên bản </span>{packageJson.version}</div>
    </aside>

    <main className="main-area">
      <section className="page-heading"><div>{page === 'problem' ? <nav className="page-breadcrumb" aria-label="Điều hướng"><button onClick={() => setPage('projects')}>Bài thi</button><span>/</span><span>Soạn đề</span>{active && <><span>/</span><b aria-current="page">{active.name}</b></>}</nav> : <><div className="eyebrow">{!active && 'KHÔNG GIAN SOẠN ĐỀ'}</div><h1>{currentPage.title}</h1><p>{currentPage.subtitle}</p></>}</div>{page !== 'settings' && page !== 'problem' && <div className="heading-actions"><button className="button button-primary" onClick={() => setProjectModal(true)}><Plus size={17} /> Bài thi mới</button></div>}</section>
      {compilerAvailable === false && page !== 'settings' && <button className="notice notice-warning" onClick={() => setPage('settings')}><TriangleAlert size={17} /><span><b>Chưa tìm thấy trình biên dịch C++.</b> Compiler C++ đi kèm chưa khởi động được. Hãy kiểm tra cài đặt hoặc chọn g++.exe khác.</span><ArrowRight size={15} /></button>}
      {page === 'problem' && active && <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => pickImage(event.target.files?.[0])} />}
      <div className={`page-body ${isWorkflowPage(page) && active ? 'workflow-page-body' : ''}`}>
        {isWorkflowPage(page) && active ? <div className="workflow-layout">
          <aside className="workflow-stepper" aria-label="Các bước soạn đề">
            <div className="stepper-heading"><span>TIẾN ĐỘ SOẠN ĐỀ</span><b>Bước {workflowIndex + 1} / {workflowSteps.length}</b></div>
            <div className="stepper-list">{workflowSteps.map((step, index) => {
              const StepIcon = step.icon;
              const current = step.id === page;
              const done = stepDone(step);
              return <button key={step.id} className={`workflow-step ${current ? 'current' : ''} ${done ? 'done' : ''}`} onClick={() => setPage(step.id)} disabled={!canAccessStep(index) || Boolean(busy)} aria-current={current ? 'step' : undefined}>
                <span className="workflow-step-marker">{done && !current ? <Check size={14} /> : <StepIcon size={14} />}</span>
                <span className="workflow-step-copy"><b>{step.label}</b><small>{step.description}</small></span>
                {index < workflowSteps.length - 1 && <span className="workflow-step-line" />}
              </button>;
            })}</div>
          </aside>
          <div className="workflow-main">
            {pageContent()}
            <div className="workflow-actions">
              <button className="button button-primary" onClick={() => void moveWorkflow(1)} disabled={!canProceed || Boolean(busy)}>{workflowIndex < workflowSteps.length - 1 ? <>Tiếp theo <ArrowRight size={15} /></> : exportedProjectId === active.id ? <>Hoàn tất <Check size={15} /></> : <>Xuất lại <ArrowDownToLine size={15} /></>}</button>
            </div>
          </div>
        </div> : pageContent()}
      </div>
    </main>

    {projectModal && <Modal title="Tạo bài thi mới" subtitle="Mỗi bài thi lưu đề bài, mã nguồn và testcase trong một thư mục riêng." close={() => setProjectModal(false)}><label className="field-label">Tên bài thi</label><input autoFocus className="text-input" value={projectName} onChange={(event) => setProjectName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void createProject()} placeholder="Ví dụ: Bài toán dãy con tăng" /><div className="modal-actions"><button className="button button-secondary" onClick={() => setProjectModal(false)}>Hủy</button><button className="button button-primary" onClick={() => void createProject()}><Plus size={16} /> Tạo bài thi</button></div></Modal>}
    {aiKeyModal && <Modal title="Cấu hình API key để tiếp tục" subtitle={`Tính năng này cần ${aiKeyModal === "openai" ? "OpenAI" : "Gemini"}. Key được mã hóa và lưu cục bộ.`} close={cancelAiKeySetup}><label className="field-label">API key {aiKeyModal === "openai" ? "OpenAI" : "Gemini"}</label><input autoFocus className="text-input" type="password" value={aiKey} onChange={(event) => setAiKey(event.target.value)} placeholder="Dán API key tại đây" /><div className="security-note"><Shield size={15} /><span>Key chỉ được gửi khi bạn mở bước cần AI hoặc chủ động yêu cầu AI.</span></div><div className="modal-actions"><button className="button button-plain" onClick={cancelAiKeySetup}>Hủy</button><button className="button button-primary" onClick={() => void saveAiKeyAndContinue()} disabled={busy === "key"}><Save size={15} /> Lưu và tiếp tục</button></div></Modal>}\n    {onboarding && settings && <Modal title="Chào mừng đến CP Test Studio" subtitle="Soạn đề và chạy bộ test ngay trên máy. API AI là tùy chọn, bạn có thể cấu hình sau." close={() => void finishOnboarding(true)} wide><div className="welcome-banner"><div className="welcome-icon"><Rocket size={23} /></div><div><b>Bắt đầu làm việc theo cách của bạn</b><p>Không cần tài khoản. Bài thi được lưu trên máy, các thao tác biên dịch và tạo testcase chạy ngoại tuyến.</p></div></div><div className="onboard-api"><div><label className="field-label">Nhà cung cấp AI (không bắt buộc)</label><select className="text-input" value={settings.provider} onChange={(event) => void updateSettings({ ...settings, provider: event.target.value as Provider })}><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option></select></div><div><label className="field-label">API key</label><div className="input-with-button"><input className="text-input" type="password" value={aiKey} onChange={(event) => setAiKey(event.target.value)} placeholder="Có thể bỏ qua và thêm sau" /><KeyRound size={16} /></div></div></div><div className="security-note"><Shield size={16} /><span>API key được mã hóa bởi Windows; AI tự chạy khi bạn mở bước 2–4 còn thiếu nội dung.</span></div><div className="modal-actions"><button className="button button-plain" onClick={() => void finishOnboarding(true)}>Bỏ qua, dùng không cần AI</button><button className="button button-primary" onClick={() => void finishOnboarding(false)} disabled={Boolean(aiKey && busy === 'key')}>Bắt đầu sử dụng <ArrowRight size={16} /></button></div></Modal>}
    {toast && <div className={`toast toast-${toast.kind}`}><span className="toast-mark">{toast.kind === 'success' ? <Check size={16} /> : toast.kind === 'error' ? <TriangleAlert size={16} /> : <CircleHelp size={16} />}</span>{toast.text}<button onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
    {busy && <LoadingOverlay busy={busy} generationProgress={generationProgress} runProgress={runProgress} />}
  </>;
}

function LoadingOverlay({ busy, generationProgress, runProgress }: { busy: string; generationProgress: TestGenerationProgress | null; runProgress: TestRunProgress | null }) {
  const label = busy.startsWith('Đang') ? busy
    : busy === 'run-tests' ? 'Đang chạy testcase…'
      : busy === 'generate' ? 'Đang sinh testcase…'
        : busy === 'export' ? 'Đang xuất tệp…'
          : busy === 'key' ? 'Đang lưu API key…'
            : busy.startsWith('compile') ? 'Đang biên dịch C++…'
              : busy === 'run' ? 'Đang chạy chương trình…' : 'Đang xử lý…';
  const generation = busy === 'generate' ? generationProgress : null;
  const running = busy === 'run-tests' ? runProgress : null;
  const progress = generation ?? running;
  const details = generation
    ? `${generation.generated} input hợp lệ · ${generation.duplicates} trùng · ${generation.invalid} không hợp lệ · ${generation.errors} lỗi`
    : running
      ? `${running.completed}/${running.total} testcase hoàn tất · ${running.errors} lỗi`
      : 'Vui lòng đợi trong khi ứng dụng hoàn tất thao tác.';
  return <div className="busy-overlay" role="presentation">
    <section className="busy-dialog" role="status" aria-live="polite" aria-label={label}>
      <div className="busy-spinner"><LoaderCircle size={27} className="spin" /></div>
      <h2>{label}</h2>
      <p>{details}</p>
      {progress && <progress max={progress.total || 1} value={progress.current} />}
      <small>Ứng dụng đang tạm khóa thao tác.</small>
    </section>
  </div>;
}

function ProjectRow({ project, index, open, remove }: { project: Project; index: number; open: () => void; remove?: () => void }) {
  return <tr className="project-table-row" onClick={open} onKeyDown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  }} tabIndex={0} aria-label={`Mở bài thi ${project.name}`}>
    <td><span className="project-table-name"><span className={`project-monogram color-${index % 4}`}>{project.name.trim().charAt(0).toUpperCase() || 'P'}</span><b>{project.name}</b></span></td>
    <td className="project-table-created">{new Date(project.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
    <td className="project-table-count">{project.tests.length}</td>
    <td className="project-table-actions">{remove && <button className="icon-button danger-icon" onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); remove(); }} title="Xóa bài thi" aria-label={`Xóa bài thi ${project.name}`}><Trash2 size={15} /></button>}</td>
  </tr>;
}

function Projects({ projects, openProject, create, remove }: { projects: Project[]; openProject: (p: Project) => void; create: () => void; remove: (p: Project) => void }) {
  return <div className="panel project-list-panel">{projects.length ? <div className="project-table-wrap"><table className="project-table"><thead><tr><th>Bài thi</th><th>Ngày tạo</th><th>Testcase</th><th aria-label="Thao tác" /></tr></thead><tbody>{projects.map((project, index) => <ProjectRow key={project.id} project={project} index={index} open={() => openProject(project)} remove={() => remove(project)} />)}</tbody></table></div> : <EmptyProject create={create} />}</div>;
}

function HelpPage() {
  return <article className="panel markdown-preview help-guide"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{userGuideMarkdown}</ReactMarkdown></article>;
}

function EmptyProject({ create }: { create: () => void }) { return <div className="empty-state"><div className="empty-icon large"><FolderOpen size={26} /></div><h3>Chưa mở bài thi</h3><p>Tạo một bài thi để bắt đầu nhập đề, viết mã và tạo testcase.</p><button className="button button-primary" onClick={create}><Plus size={16} /> Tạo bài thi</button></div>; }

function Problem({ project, update, settings, updateSettings, sourceMode, setSourceMode, ideaPrompt, setIdeaPrompt, ideaPromptRef, onDraftFromIdea, onPickImage, onExtract, photoName, aiBusy }: { project: Project; update: (p: Partial<Project>) => void; settings: Settings | null; updateSettings: (settings: Settings) => Promise<void>; sourceMode: 'text' | 'image'; setSourceMode: (mode: 'text' | 'image') => void; ideaPrompt: string; setIdeaPrompt: (value: string) => void; ideaPromptRef: React.RefObject<HTMLTextAreaElement | null>; onDraftFromIdea: () => void; onPickImage: () => void; onExtract: () => void; photoName?: string; aiBusy: boolean }) {
  return <div className="problem-compose">
    <section className="source-picker">
      <div className="source-picker-heading"><div><h3>Bạn muốn bắt đầu đề bài từ đâu?</h3><p>Chọn một cách soạn. Nội dung sau đó vẫn có thể chỉnh sửa trực tiếp.</p></div></div>
      <div className="source-options">
        <button className={`source-option ${sourceMode === 'text' ? 'selected' : ''}`} onClick={() => setSourceMode('text')}>
          <span className="source-option-icon"><FileText size={18} /></span><span className="source-option-copy"><b>Từ ý tưởng, nhập văn bản</b><small>Tự viết nội dung đề bằng tiếng Việt hoặc Markdown.</small></span><span className="source-radio" />
        </button>
        <button className={`source-option ${sourceMode === 'image' ? 'selected' : ''}`} onClick={() => setSourceMode('image')}>
          <span className="source-option-icon image"><FileImage size={18} /></span><span className="source-option-copy"><b>Lấy đề từ ảnh</b><small>Chọn ảnh đề bài; có thể nhờ AI đọc thành văn bản.</small></span><span className="source-radio" />
        </button>
      </div>
    </section>
    {sourceMode === 'text' && <section className="idea-prompt panel">
      <div className="idea-prompt-heading"><div className="source-option-icon"><Sparkles size={17} /></div><div><b>Ý tưởng bài toán</b><small>Mô tả ngắn để AI phát triển thành đề hoàn chỉnh.</small></div></div>
      <textarea ref={ideaPromptRef} value={ideaPrompt} onChange={(event) => setIdeaPrompt(event.target.value)} placeholder="Ví dụ: Cho một dãy số, hãy tìm tổng lớn nhất của đoạn con liên tiếp..." />
      <div className="idea-prompt-footer"><span>Kết quả sẽ điền vào ô nội dung đề bên dưới để bạn kiểm tra và chỉnh sửa.</span><button className="button button-primary button-small" onClick={onDraftFromIdea} disabled={aiBusy}><Sparkles size={14} /> Soạn đề bằng AI</button></div>
    </section>}
    {sourceMode === 'image' && <section className="image-source panel">
      <div className="image-source-copy"><span className="image-source-icon"><FileImage size={18} /></span><div><b>{photoName || 'Chưa chọn ảnh đề bài'}</b><small>{photoName ? 'Ảnh đã lưu trong bài thi. Bạn có thể đọc ảnh để đưa nội dung vào phần soạn thảo.' : 'Hỗ trợ PNG, JPG hoặc WebP, tối đa 10 MB.'}</small></div></div>
      <div className="image-source-actions"><button className="button button-secondary button-small" onClick={onPickImage}><FileImage size={14} /> {photoName ? 'Đổi ảnh' : 'Chọn ảnh'}</button>{photoName && <button className="button button-primary button-small" onClick={onExtract} disabled={aiBusy}><Sparkles size={14} /> Đọc ảnh bằng AI</button>}</div>
    </section>}
    <div className="editor-layout"><div className="panel editor-panel"><div className="panel-toolbar"><div className="toolbar-title"><FileText size={16} /><b>{sourceMode === 'image' ? 'Nội dung trích xuất / chỉnh sửa' : 'Nội dung đề'}</b><span className="format-pill">MARKDOWN</span></div></div><div className="document-title"><input value={project.name} onChange={(e) => update({ name: e.target.value })} aria-label="Tên bài thi" /><span>ĐỀ BÀI / MÔ TẢ</span></div><textarea className="code-textarea markdown-input" spellCheck={false} value={project.statement} onChange={(e) => update({ statement: e.target.value, tests: project.tests.map((test) => ({ ...test, inputStale: true, outputStale: Boolean(test.output) || test.outputStale })) })} placeholder={sourceMode === 'image' ? 'Nội dung đọc từ ảnh sẽ hiện tại đây. Bạn cũng có thể tự nhập hoặc chỉnh sửa.' : 'Nhập ý tưởng hoặc soạn đề bằng Markdown...'} /><div className="editor-footer"><span><span className="dot green" /> Tự lưu trên máy</span><span>Markdown · LaTeX <span className="footer-sep">·</span> {project.statement.length} ký tự</span></div></div><div className="panel preview-panel"><div className="panel-toolbar"><div className="toolbar-title"><BookOpen size={16} /><b>Xem trước</b></div><span className="preview-live"><span className="dot green" /> TRỰC TIẾP</span></div><div className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{project.statement || '*Nội dung xem trước sẽ hiện tại đây.*'}</ReactMarkdown></div></div></div>
    {settings && <section className="panel settings-card problem-themis-settings"><div className="settings-title"><div className="settings-icon orange"><Folder size={18} /></div><div><h3>Tên file Themis</h3><p>AI sẽ đề xuất tên khi tạo đề; bạn có thể chỉnh sửa trước khi xuất bộ Themis. Tiền tố testcase luôn là TEST.</p></div></div><div className="settings-form-grid themis-names"><label><span>Input</span><input className="text-input" value={settings.themisInputFile} onChange={(event) => void updateSettings({ ...settings, themisInputFile: event.target.value })} placeholder="BAI.INP" /></label><label><span>Output</span><input className="text-input" value={settings.themisOutputFile} onChange={(event) => void updateSettings({ ...settings, themisOutputFile: event.target.value })} placeholder="BAI.OUT" /></label></div></section>}
  </div>;
}

function parsePlanParams(value: string): Record<string, string> {
  return Object.fromEntries(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const separator = line.indexOf('=');
    if (separator < 1) return [];
    const key = line.slice(0, separator).trim();
    const item = line.slice(separator + 1).trim();
    return /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(key) && !['mode', 'testIndex'].includes(key) && item.length <= 256 ? [[key, item]] : [];
  }).slice(0, 24));
}

function CppEditor({ value, onChange, height = '340px' }: { value: string; onChange: (value: string) => void; height?: string }) {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'light');
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'light'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return <div className="monaco-editor-shell" style={{ height }}><Editor language="cpp" theme={theme} value={value} onChange={(next) => onChange(next ?? '')} loading={<span>Đang tải editor…</span>} options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: 14, fontFamily: 'Cascadia Code, Consolas, monospace', scrollBeyondLastLine: false, tabSize: 4, wordWrap: 'off', padding: { top: 10, bottom: 10 } }} /></div>;
}

function TestPlanEditor({ project, update, analyze, quickCreate, busy }: { project: Project; update: (p: Partial<Project>) => void; analyze: () => void; quickCreate: () => void; busy: string }) {
  const plan = project.testPlan;
  const total = plan.groups.reduce((sum, group) => sum + group.count, 0);
  const current = plan.problemSpec.statementVersion === statementVersion(project.statement);
  const updatePlan = (next: TestPlan) => update({
    testPlan: { ...next, updatedAt: new Date().toISOString() },
    tests: project.tests.map((test) => ({ ...test, inputStale: true, outputStale: Boolean(test.output) || test.outputStale })),
  });
  const updateGroup = (index: number, changes: Partial<TestGroup>) => {
    const groups = [...plan.groups];
    const others = groups.reduce((sum, group, groupIndex) => sum + (groupIndex === index ? 0 : group.count), 0);
    if (changes.count !== undefined) changes.count = Math.max(1, Math.min(changes.count, 500 - others));
    groups[index] = { ...groups[index], ...changes };
    updatePlan({ ...plan, groups });
  };
  const addGroup = () => {
    if (plan.groups.length >= 30 || total >= 500) return;
    updatePlan({ ...plan, groups: [...plan.groups, { id: globalThis.crypto.randomUUID(), name: `Nhóm ${plan.groups.length + 1}`, description: '', mode: 'boundary', count: 1, params: {} }] });
  };
  const removeGroup = (index: number) => {
    if (plan.groups.length <= 1) return;
    updatePlan({ ...plan, groups: plan.groups.filter((_, groupIndex) => groupIndex !== index) });
  };
  const updateSpec = (changes: Partial<TestPlan['problemSpec']>) => updatePlan({ ...plan, problemSpec: { ...plan.problemSpec, ...changes } });
  const synchronizeStatement = () => {
    updatePlan({ ...plan, problemSpec: { ...plan.problemSpec, statementVersion: statementVersion(project.statement) } });
  };
  return <div className="feature-stack test-plan-editor">
    <section className="panel test-plan-summary">
      <div><div className="eyebrow">TEST PLAN</div><h3>{total} testcase dự kiến</h3><p>Chia dữ liệu thành các nhóm. Bạn có thể tạo và sửa Test Plan ngoại tuyến.</p></div>
      <div className="test-plan-actions"><button className="button button-secondary button-small" onClick={analyze} disabled={Boolean(busy)}><Sparkles size={14} /> AI phân tích đề</button><button className="button button-primary button-small" onClick={quickCreate} disabled={Boolean(busy)}><Sparkles size={14} /> Quick: plan + generator</button></div>
    </section>
    {!current && <div className="notice notice-warning"><TriangleAlert size={16} /><span><b>Đề bài đã thay đổi.</b> Đồng bộ Test Plan hiện tại hoặc phân tích lại; testcase cũ sẽ được giữ nhưng đánh dấu cũ.</span><button className="button button-secondary button-small" onClick={synchronizeStatement}>Đồng bộ đề</button></div>}
    <section className="panel problem-spec-panel">
      <div className="panel-toolbar"><div className="toolbar-title"><FileText size={15} /><b>Đặc tả đầu vào</b><span className="format-pill">CHỈNH SỬA ĐƯỢC</span></div></div>
      <div className="problem-spec-grid"><label><span>Tóm tắt</span><textarea value={plan.problemSpec.summary} onChange={(event) => updateSpec({ summary: event.target.value })} placeholder="Mô tả ngắn bài toán" /></label><label><span>Input</span><textarea value={plan.problemSpec.inputFormat} onChange={(event) => updateSpec({ inputFormat: event.target.value })} placeholder="Định dạng dữ liệu vào" /></label><label><span>Output</span><textarea value={plan.problemSpec.outputFormat} onChange={(event) => updateSpec({ outputFormat: event.target.value })} placeholder="Định dạng dữ liệu ra" /></label><label><span>Ràng buộc</span><textarea value={plan.problemSpec.constraints.join('\n')} onChange={(event) => updateSpec({ constraints: event.target.value.split(/\r?\n/) })} placeholder="Mỗi ràng buộc một dòng" /></label></div>
    </section>
    <section className="test-group-list">
      {plan.groups.map((group, index) => <TestGroupEditor key={group.id} group={group} index={index} onChange={(changes) => updateGroup(index, changes)} onRemove={() => removeGroup(index)} canRemove={plan.groups.length > 1} />)}
      <button className="button button-secondary add-test-group" onClick={addGroup} disabled={plan.groups.length >= 30 || total >= 500}><Plus size={15} /> Thêm nhóm test</button>
    </section>
    {total > 500 && <div className="inline-error">Tổng testcase không được vượt quá 500.</div>}
  </div>;
}

function TestGroupEditor({ group, index, onChange, onRemove, canRemove }: { group: TestGroup; index: number; onChange: (changes: Partial<TestGroup>) => void; onRemove: () => void; canRemove: boolean }) {
  const [paramsText, setParamsText] = useState(Object.entries(group.params).map(([key, value]) => `${key}=${value}`).join('\n'));
  useEffect(() => setParamsText(Object.entries(group.params).map(([key, value]) => `${key}=${value}`).join('\n')), [group.id, group.params]);
  return <section className="panel test-group-card">
    <div className="test-group-heading"><div className="test-group-index">{String(index + 1).padStart(2, '0')}</div><input value={group.name} onChange={(event) => onChange({ name: event.target.value })} aria-label="Tên nhóm test" /><button className="icon-button danger-icon" onClick={onRemove} disabled={!canRemove} title="Xóa nhóm"><Trash2 size={15} /></button></div>
    <textarea className="test-group-description" value={group.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Mục tiêu nhóm này, ví dụ: giá trị sát giới hạn n" />
    <div className="test-group-fields"><label><span>Mode</span><select value={group.mode} onChange={(event) => onChange({ mode: event.target.value as GeneratorMode })}><option value="random">Random</option><option value="boundary">Boundary</option><option value="constructive">Constructive</option><option value="stress">Stress</option></select></label><label><span>Số lượng</span><input type="number" min={1} max={500} value={group.count} onChange={(event) => onChange({ count: Number(event.target.value) || 1 })} /></label><label className="group-params"><span>Tham số tùy chọn, mỗi dòng `key=value`</span><textarea value={paramsText} onChange={(event) => setParamsText(event.target.value)} onBlur={() => onChange({ params: parsePlanParams(paramsText) })} placeholder={'n_min=1\nn_max=100'} /></label></div>
  </section>;
}

function Generator({ project, update, progress, goToPlan, askAi, askValidator, compile, compileValidator, fix, fixValidator, diagnostics, validatorDiagnostics, busy }: { project: Project; update: (p: Partial<Project>) => void; progress: TestGenerationProgress | null; goToPlan: () => void; askAi: () => void; askValidator: () => void; compile: () => void; compileValidator: () => void; fix: () => void; fixValidator: () => void; diagnostics: string; validatorDiagnostics: string; busy: string }) {
  const planned = project.testPlan.groups.reduce((sum, group) => sum + group.count, 0);
  const updateGenerator = (generator: string) => update({ generator, tests: project.tests.map((test) => ({ ...test, inputStale: true, outputStale: Boolean(test.output) || test.outputStale })) });
  return <div className="feature-stack">
    <div className="panel feature-intro"><div className="feature-icon purple"><Braces size={20} /></div><div><h3>Generator C++17 / testlib.h</h3><p>Electron chạy một lần cho mỗi input, truyền seed, `--testIndex`, `--mode` và tham số nhóm. Mỗi lượt sinh đúng một input ra stdout.</p></div><div className="intro-actions"><button className="button button-secondary button-small" onClick={goToPlan}><ListChecks size={14} /> Sửa Test Plan ({planned})</button><button className="button button-secondary button-small" onClick={askAi} disabled={Boolean(busy)}><Sparkles size={14} /> Gợi ý bằng AI</button></div></div>
    <div className="panel code-panel"><div className="panel-toolbar"><div className="toolbar-title"><FileCode2 size={16} /><b>generator.cpp</b><span className="format-pill">C++17</span></div><div className="toolbar-actions"><button className="button button-plain button-small" onClick={() => updateGenerator(DEFAULT_GENERATOR_TEMPLATE)}>Dùng mẫu</button><button className="button button-secondary button-small" onClick={compile} disabled={Boolean(busy)}><Code2 size={14} /> Biên dịch</button>{diagnostics && <button className="button button-secondary button-small" onClick={fix} disabled={Boolean(busy)}><Sparkles size={14} /> AI sửa lỗi</button>}</div></div><CppEditor value={project.generator} onChange={updateGenerator} /></div>
    {diagnostics && <div className="panel compile-diagnostics"><b>Compiler diagnostics</b><pre>{diagnostics}</pre></div>}
    <details className="panel advanced-editor"><summary>Advanced: validator C++17</summary><p>Validator đọc một input qua stdin; thoát mã 0 nếu input hợp lệ, mã khác 0 nếu sai.</p><div className="advanced-editor-actions"><button className="button button-secondary button-small" onClick={() => update({ validator: DEFAULT_VALIDATOR_TEMPLATE })}>Dùng mẫu validator</button><button className="button button-secondary button-small" onClick={askValidator} disabled={Boolean(busy)}><Sparkles size={14} /> AI tạo validator</button><button className="button button-secondary button-small" onClick={compileValidator} disabled={!project.validator.trim() || Boolean(busy)}><Code2 size={14} /> Biên dịch validator</button>{validatorDiagnostics && <button className="button button-secondary button-small" onClick={fixValidator} disabled={Boolean(busy)}>AI sửa lỗi</button>}</div>{validatorDiagnostics && <pre className="compile-diagnostics-text">{validatorDiagnostics}</pre>}<CppEditor value={project.validator} height="260px" onChange={(validator) => update({ validator, tests: project.tests.map((test) => ({ ...test, inputStale: true, outputStale: Boolean(test.output) || test.outputStale })) })} /></details>
    <section className="panel generate-controls"><div><h3>Sinh testcase theo Test Plan</h3><p>Sinh, kiểm tra validator và loại input trùng trực tiếp trên máy.</p></div><div className="generate-fields"><label><span>Seed gốc</span><input type="number" value={project.seed} onChange={(event) => update({ seed: Number(event.target.value) })} /></label><div className="plan-total-chip"><b>{planned}</b><span>testcase dự kiến</span></div></div></section>
    {progress && <section className="panel progress-panel"><div><b>Đang sinh test {progress.current}/{progress.total}</b><span>{progress.generated} duy nhất · {progress.duplicates} trùng · {progress.invalid} không hợp lệ · {progress.errors} lỗi</span></div><progress max={progress.total || 1} value={progress.current} /></section>}
  </div>;
}

function Solution({ project, update, input, setInput, output, busy, compile, run, askAi, fix, diagnostics }: { project: Project; update: (p: Partial<Project>) => void; input: string; setInput: (s: string) => void; output: string; busy: string; compile: () => void; run: () => void; askAi: () => void; fix: () => void; diagnostics: string }) {
  return <div className="feature-stack solution-layout">
    <div className="panel code-panel"><div className="panel-toolbar"><div className="toolbar-title"><Code2 size={16} /><b>solution.cpp</b><span className="format-pill">C++17</span></div><div className="toolbar-actions"><button className="button button-secondary button-small" onClick={askAi} disabled={Boolean(busy)}><Sparkles size={14} /> Gợi ý bằng AI</button><button className="button button-secondary button-small" onClick={compile} disabled={Boolean(busy)}><Code2 size={14} /> Biên dịch</button>{diagnostics && <button className="button button-secondary button-small" onClick={fix} disabled={Boolean(busy)}><Sparkles size={14} /> AI sửa lỗi</button>}</div></div><CppEditor value={project.solution} height="380px" onChange={(solution) => update({ solution, tests: project.tests.map((test) => ({ ...test, outputStale: Boolean(test.output) || test.outputStale })) })} /></div>
    {diagnostics && <div className="panel compile-diagnostics"><b>Compiler diagnostics</b><pre>{diagnostics}</pre></div>}
    <details className="panel advanced-editor"><summary>Advanced: lời giải oracle để đối chiếu</summary><p>Nếu có lời giải độc lập, app so sánh output theo token và đánh dấu testcase `VERIFIED` khi khớp.</p><CppEditor value={project.oracleSolution ?? ''} height="260px" onChange={(oracleSolution) => update({ oracleSolution, tests: project.tests.map((test) => test.status === 'verified' ? { ...test, outputStale: true } : test) })} /></details>
    <div className="solution-bottom"><div className="panel trial-panel"><div className="panel-toolbar"><div className="toolbar-title"><Play size={16} /><b>Chạy thử</b></div><label className="limit-input">Giới hạn <input type="number" min={100} max={30000} value={project.timeLimitMs} onChange={(event) => update({ timeLimitMs: Number(event.target.value) })} /> ms</label></div><textarea className="trial-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Dán input mẫu tại đây..." /><div className="trial-actions"><span>Input được truyền qua stdin.</span><button className="button button-primary button-small" onClick={run} disabled={Boolean(busy)}><Play size={14} /> Biên dịch & chạy</button></div></div><div className="panel output-panel"><div className="panel-toolbar"><div className="toolbar-title"><Activity size={16} /><b>stdout / stderr</b></div><span className="output-label">KẾT QUẢ</span></div><pre>{output || 'Kết quả chạy chương trình sẽ hiện tại đây.'}</pre></div></div>
  </div>;
}

function Runner({ project, busy, progress, runAll, clear, regenerate, remove, runGroup }: { project: Project; busy: string; progress: TestRunProgress | null; runAll: () => void; clear: () => void; regenerate: (test: TestCase) => void; remove: (test: TestCase) => void; runGroup: (groupId: string) => void }) {
  const ready = project.tests.filter((test) => ['generated', 'verified'].includes(test.status) && !test.outputStale && !test.inputStale).length;
  const duplicates = project.tests.filter((test) => test.status === 'duplicate').length;
  const invalid = project.tests.filter((test) => test.status === 'invalid' || test.inputStale).length;
  return <div className="feature-stack">
    <div className="runner-summary panel"><div className="runner-count"><div className="feature-icon teal"><ListChecks size={19} /></div><div><b>{project.tests.length} bản ghi testcase</b><small>{ready} có output mới · {duplicates} trùng · {invalid} invalid/cũ</small></div></div><div className="runner-actions"><button className="button button-secondary" onClick={clear} disabled={!project.tests.length}><Trash2 size={15} /> Xóa danh sách</button><button className="button button-primary" onClick={runAll} disabled={!project.tests.some((test) => !test.inputStale && !['duplicate', 'invalid', 'error'].includes(test.status)) || Boolean(busy)}><Play size={15} /> Chạy lại tất cả input</button></div></div>
    {progress && <section className="panel progress-panel"><div><b>Đang chạy testcase {progress.current}/{progress.total}</b><span>{progress.completed} hoàn tất · {progress.errors} lỗi</span></div><progress max={progress.total || 1} value={progress.current} /></section>}
    {project.testPlan.groups.map((group) => {
      const groupTests = project.tests.filter((test) => test.groupId === group.id);
      const runnable = groupTests.filter((test) => !test.inputStale && !['duplicate', 'invalid', 'error'].includes(test.status));
      if (!groupTests.length) return null;
      return <section className="panel runner-group" key={group.id}><div className="section-heading"><div><h3>{group.name}</h3><p>{group.mode} · {groupTests.length} bản ghi · {runnable.filter((test) => ['generated', 'verified'].includes(test.status) && !test.outputStale).length} output mới</p></div><button className="button button-secondary button-small" onClick={() => runGroup(group.id)} disabled={!runnable.length || Boolean(busy)}><RefreshCw size={14} /> Chạy lại nhóm</button></div></section>;
    })}
    {project.tests.length ? <div className="panel test-table-panel"><div className="test-table-head"><span>TESTCASE</span><span>INPUT</span><span>OUTPUT</span><span>TRẠNG THÁI</span><span>THỜI GIAN</span></div>{project.tests.map((test, index) => <TestRow key={test.id} test={test} index={index} regenerate={() => regenerate(test)} remove={() => remove(test)} busy={Boolean(busy)} />)}</div> : <div className="panel empty-tests"><div className="empty-icon"><ListChecks size={21} /></div><h3>Chưa có testcase</h3><p>Sinh test trong bước Generator. Input sẽ được kiểm tra trùng và có thể chạy lại mà không cần sinh lại.</p><div className="test-flow"><span><b>1</b> Test Plan</span><ArrowRight size={14} /><span><b>2</b> Generator</span><ArrowRight size={14} /><span><b>3</b> Chạy lời giải</span></div></div>}
  </div>;
}

function TestRow({ test, index, regenerate, remove, busy }: { test: TestCase; index: number; regenerate?: () => void; remove?: () => void; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const label: Record<TestCase['status'], string> = { pending: 'Chờ chạy', running: 'Đang chạy', generated: 'Có output', verified: 'Đã xác minh', duplicate: 'Trùng', failed: 'Lỗi runtime', timeout: 'Quá thời gian', invalid: 'Input không hợp lệ', error: 'Lỗi', passed: 'Output cũ' };
  const status = test.inputStale ? 'Input cũ' : test.outputStale ? 'Output cũ' : label[test.status];
  return <div className="test-row-wrap"><div className="test-row"><button className="test-row-toggle" onClick={() => setOpen(!open)}><span className="test-name"><span className="test-index">{String(index + 1).padStart(2, '0')}</span><b>{test.name}</b></span><span className="test-contents">{test.input.slice(0, 56).replaceAll('\n', ' ↵ ') || <i>(rỗng)</i>}</span><span className="test-contents">{test.output.slice(0, 48).replaceAll('\n', ' ↵ ') || <i>Chưa có output</i>}</span><span className={`status-pill status-${test.status}`}><span className="dot" />{status}</span><span className="test-runtime">{test.runtimeMs ? `${test.runtimeMs} ms` : '—'} <ChevronDown size={14} /></span></button></div>{open && <div className="test-detail"><div><b>Input</b><pre>{test.input || '(rỗng)'}</pre></div><div><b>Output hiện tại</b><pre>{test.output || '(chưa có output)'}</pre></div><div className="test-metadata"><span>Nhóm: {test.groupName ?? '—'}</span><span>Mode: {test.mode ?? '—'}</span><span>Seed: {test.seed ?? '—'}</span><span>Index: {test.testIndex ?? '—'}</span><span>SHA-256: {test.sha256 ?? 'chưa có'}</span></div>{test.params && Object.keys(test.params).length > 0 && <div className="test-metadata"><span>Tham số: {Object.entries(test.params).map(([key, value]) => `${key}=${value}`).join(', ')}</span></div>}{test.stderr && <div className="stderr-detail"><b>Thông báo</b><pre>{test.stderr}</pre></div>}<div className="test-row-actions">{regenerate && <button className="button button-secondary button-small" onClick={regenerate} disabled={busy}><RefreshCw size={13} /> Sinh lại test</button>}{remove && <button className="button button-plain button-small" onClick={remove} disabled={busy}><Trash2 size={13} /> Xóa</button>}</div></div>}</div>;
}

function Export({ project, busy, directory, exported, exportAgain }: { project: Project; busy: string; directory: string; exported: boolean; exportAgain: () => void }) {
  const files = [`${project.name}.md`, `${project.name}.pdf`, `${project.name}.docx`, `${project.name}_solution.cpp`, `${project.name}.zip`];
  const reviewable = project.tests.filter((test) => ['generated', 'verified', 'passed'].includes(test.status) && !test.inputStale && !test.outputStale);
  const unverified = reviewable.filter((test) => test.status !== 'verified').length;
  const excluded = project.tests.length - reviewable.length;
  return <div className="feature-stack"><section className="panel export-main"><div className="export-title"><div className={`feature-icon ${exported ? 'teal' : 'orange'}`}>{exported ? <Check size={20} /> : <Download size={20} />}</div><div><h3>{exported ? 'Đã xuất bộ đề' : 'Duyệt output trước khi xuất'}</h3><p>{reviewable.length} testcase đủ input/output mới; {unverified} chưa được đối chiếu với oracle; {excluded} testcase lỗi, trùng hoặc đã cũ sẽ bị bỏ qua.</p></div></div><div className="export-all-list">{files.map((file, index) => <div key={file}><span className={`export-format-icon ${['markdown-icon', 'pdf-icon', 'docx-icon', 'cpp-icon', 'zip-icon'][index]}`}>{['MD', 'PDF', 'W', 'C++', 'ZIP'][index]}</span><span><b>{file}</b><small>{['Đề bài Markdown', 'Bản in đã định dạng', 'Tài liệu Word', 'Lời giải C++17', 'Bộ testcase Themis'][index]}</small></span>{exported && <Check size={16} />}</div>)}</div>{reviewable.length > 0 && <details className="export-review"><summary>Xem {reviewable.length} input/output có thể xuất</summary>{reviewable.map((test, index) => <div className="export-review-row" key={test.id}><b>{test.name || `TEST${index + 1}`} · {test.status === 'verified' ? 'VERIFIED' : 'chưa xác minh'}</b><div><pre>{test.input}</pre><pre>{test.output || '(output rỗng)'}</pre></div></div>)}</details>}{directory && <div className="export-directory"><FolderOpen size={16} /><span><small>ĐÃ LƯU TẠI</small><b>{directory}</b></span></div>}<div className="export-actions"><button className="button button-primary" onClick={exportAgain} disabled={busy === 'export' || !reviewable.length}><Download size={16} /> {exported ? 'Chọn thư mục khác / xuất lại' : 'Xác nhận và xuất bộ đề'}</button><span>{reviewable.length} testcase sẽ được xuất</span></div></section></div>;
}

function SettingsPage({ settings, hasKeys, aiKey, setAiKey, saveKey, update, busy, compilerAvailable, compilerName, test, removeKey, chooseCompiler }: { settings: Settings | null; hasKeys: Record<Provider, boolean>; aiKey: string; setAiKey: (key: string) => void; saveKey: (provider: Provider) => void; update: (settings: Settings) => void; busy: string; compilerAvailable: boolean; compilerName: string; test: () => Promise<void>; removeKey: (provider: Provider) => void; chooseCompiler: () => void }) {
  const [provider, setProvider] = useState<Provider>('openai');
  const [testingConnection, setTestingConnection] = useState(false);
  const runConnectionTest = async () => {
    if (testingConnection) return;
    setTestingConnection(true);
    try { await test(); }
    finally { setTestingConnection(false); }
  };
  if (!settings) return <div className="panel loading-settings"><LoaderCircle className="spin" /> Đang tải cài đặt…</div>;
  return <div className="settings-layout"><div className="settings-column"><section className="panel settings-card"><div className="settings-title"><div className="settings-icon purple"><Sparkles size={18} /></div><div><h3>Trợ lý AI</h3><p>Ở các bước 2–4, AI tự chạy khi nội dung còn thiếu; tác vụ khác chỉ chạy khi bạn chọn.</p></div><span className="optional-tag">TÙY CHỌN</span></div><div className="provider-tabs"><button className={provider === 'openai' ? 'selected' : ''} onClick={() => setProvider('openai')}>OpenAI</button><button className={provider === 'gemini' ? 'selected' : ''} onClick={() => setProvider('gemini')}>Google Gemini</button></div><div className="settings-form-grid"><label><span>Model mặc định</span><input className="text-input" value={settings.models[provider]} onChange={(e) => update({ ...settings, models: { ...settings.models, [provider]: e.target.value } })} placeholder={provider === 'openai' ? 'gpt-4.1-mini' : 'gemini-2.5-flash'} /></label><label><span>Provider mặc định</span><select className="text-input" value={settings.provider} onChange={(e) => update({ ...settings, provider: e.target.value as Provider })}><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option></select></label></div><label className="field-label api-label">API key {hasKeys[provider] && <span className="key-saved"><BadgeCheck size={13} /> Đã lưu an toàn</span>}</label><div className="api-key-row"><div className="input-with-button"><input className="text-input" type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder={hasKeys[provider] ? 'Nhập key mới để thay thế' : 'Dán API key tại đây'} /><KeyRound size={16} /></div><button className="button button-primary" onClick={() => saveKey(provider)} disabled={busy === 'key'}><Save size={15} /> Lưu key</button></div><div className="security-note"><Shield size={15} /><span>Key được mã hóa bằng cơ chế bảo vệ thông tin của Windows; không lưu trong file bài thi.</span></div><div className="settings-actions"><button className="button button-secondary button-small" onClick={() => void runConnectionTest()} disabled={!hasKeys[provider] || testingConnection || Boolean(busy)}>{testingConnection ? <><LoaderCircle size={14} className="spin" /> Đang kiểm tra...</> : <><Activity size={14} /> Kiểm tra kết nối</>}</button>{hasKeys[provider] && <button className="button button-danger button-small" onClick={() => removeKey(provider)}><Trash2 size={14} /> Xóa key</button>}</div></section><section className="panel settings-card"><div className="settings-title"><div className="settings-icon blue"><Code2 size={18} /></div><div><h3>Compiler C++</h3><p>Ứng dụng dùng MinGW-w64 đi kèm; bạn có thể chọn compiler khác nếu cần.</p></div></div><div className="environment-row"><span className="env-indicator"><span className={`dot ${compilerAvailable ? 'green' : 'warn'}`}/></span><div><b>{compilerAvailable ? 'Đã tìm thấy compiler' : 'Chưa tìm thấy g++'}</b><small>{compilerName || settings.compilerPath || 'Compiler C++ đi kèm ứng dụng'}</small></div><button className="button button-secondary button-small" onClick={chooseCompiler}>Chọn g++.exe</button></div><div className="setup-hint"><b>Compiler đã đi kèm ứng dụng</b><span>Không cần cài MinGW-w64 hoặc sửa PATH của Windows. Bạn có thể chọn g++.exe khác nếu muốn.</span></div></section><section className="panel settings-card"><div className="settings-title"><div className="settings-icon orange"><FileText size={18} /></div><div><h3>Xuất tài liệu</h3><p>Ứng dụng dùng Pandoc và Typst đã đóng gói sẵn để xuất DOCX, PDF và công thức toán; người dùng không cần cài riêng.</p></div></div></section></div></div>;
}

function Modal({ title, subtitle, close, children, wide = false }: { title: string; subtitle: string; close: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}><div className={`modal ${wide ? 'modal-wide' : ''}`}><button className="icon-button modal-close" onClick={close}><X size={17} /></button><div className="modal-heading"><div className="brand-mark small-mark"><Command size={16} /></div><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</div></div>; }

export default App;
