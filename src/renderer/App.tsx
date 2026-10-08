import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Activity, ArrowDownToLine, ArrowRight, BadgeCheck, BookOpen, Braces, Check,
  ChevronDown, CircleHelp, Code2, Command, Download, FileCode2, FileImage, FileText, Folder,
  FolderOpen, Gauge, Github, HardDrive, KeyRound, LayoutDashboard, ListChecks, LoaderCircle,
  Moon, MoreHorizontal, Play, Plus, Rocket, Save, Settings as SettingsIcon, Shield, Sparkles,
  Sun, Trash2, TriangleAlert, X,
} from 'lucide-react';
import type { AiRequest, Project, ProgramKind, Provider, Settings, TestCase } from '../shared/types';
import { useApp, type Page } from './stores/app';

const nav: { id: Page; label: string; icon: typeof LayoutDashboard; section?: string }[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'projects', label: 'Dự án', icon: FolderOpen },
  { id: 'problem', label: 'Biên soạn đề', icon: BookOpen, section: 'SOẠN THẢO' },
  { id: 'generator', label: 'Sinh testcase', icon: Braces },
  { id: 'solution', label: 'Lời giải', icon: Code2 },
  { id: 'runner', label: 'Chạy & kiểm tra', icon: ListChecks },
  { id: 'export', label: 'Xuất bộ đề', icon: ArrowDownToLine, section: 'HOÀN TẤT' },
  { id: 'settings', label: 'Cài đặt', icon: SettingsIcon, section: 'ỨNG DỤNG' },
];

const pageInfo: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'Tổng quan', subtitle: 'Không gian làm việc soạn đề và chuẩn bị bộ test.' },
  projects: { title: 'Dự án của bạn', subtitle: 'Tất cả đề bài và bộ test được lưu ngay trên máy.' },
  problem: { title: 'Biên soạn đề', subtitle: 'Viết đề bằng Markdown, xem trước định dạng và công thức.' },
  generator: { title: 'Sinh testcase', subtitle: 'Tự viết generator C++17, biên dịch và tạo dữ liệu đầu vào.' },
  solution: { title: 'Lời giải chuẩn', subtitle: 'Biên dịch, chạy thử và tạo output bằng chương trình C++.' },
  runner: { title: 'Chạy & kiểm tra', subtitle: 'Chạy lời giải trên bộ test và xem trạng thái từng trường hợp.' },
  export: { title: 'Xuất bộ đề', subtitle: 'Tạo ZIP theo cấu trúc thư mục Themis hoặc xuất bản đề.' },
  settings: { title: 'Cài đặt', subtitle: 'Thiết lập AI, compiler và giao diện theo cách bạn làm việc.' },
};

function App() {
  const { projects, active, settings, page, dirty, setProjects, setActive, setSettings, setPage, setDirty, updateActive } = useApp();
  const [onboarding, setOnboarding] = useState(false);
  const [aiKey, setAiKey] = useState('');
  const [hasKeys, setHasKeys] = useState<Record<Provider, boolean>>({ openai: false, gemini: false });
  const [compilerAvailable, setCompilerAvailable] = useState(false);
  const [compilerName, setCompilerName] = useState('');
  const [toast, setToast] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectModal, setProjectModal] = useState(false);
  const [runInput, setRunInput] = useState('');
  const [runOutput, setRunOutput] = useState('');
  const [generatorCount, setGeneratorCount] = useState(10);
  const [photo, setPhoto] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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
        setActive(saved); setDirty(false);
      }).catch((error: Error) => notify(`Không lưu được: ${error.message}`, 'error'));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [active, dirty, notify, setActive, setDirty]);

  useEffect(() => { document.documentElement.dataset.theme = settings?.theme ?? 'light'; }, [settings?.theme]);

  const saveProject = async () => {
    if (!active) return;
    try { const saved = await window.studio.saveProject(active); setActive(saved); setDirty(false); notify('Đã lưu dự án.'); }
    catch (error) { notify((error as Error).message, 'error'); }
  };

  const createProject = async () => {
    const value = projectName.trim();
    if (!value) return;
    try {
      const project = await window.studio.createProject(value);
      setActive(project); setProjects([project, ...projects]); setPage('problem'); setProjectModal(false); setProjectName('');
      notify('Đã tạo dự án mới.');
    } catch (error) { notify((error as Error).message, 'error'); }
  };

  const openProject = (project: Project) => { setActive(project); setPage('problem'); setAiResult(''); };

  const removeProject = async (project: Project) => {
    if (!window.confirm(`Xóa dự án “${project.name}” và các tệp liên quan?`)) return;
    try {
      await window.studio.deleteProject(project.id); const all = projects.filter((item) => item.id !== project.id);
      setProjects(all); if (active?.id === project.id) setActive(null); notify('Đã xóa dự án.');
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

  const runAi = async (request: AiRequest, label = 'Đang hỏi AI…') => {
    if (!settings) return '';
    const provider = request.provider ?? settings.provider;
    if (!hasKeys[provider]) { notify(`Hãy thêm API key ${provider === 'openai' ? 'OpenAI' : 'Gemini'} trong Cài đặt trước.`, 'info'); setPage('settings'); return ''; }
    setBusy(label); setAiResult('');
    try { const answer = await window.studio.askAi(request); setAiResult(answer); return answer; }
    catch (error) { notify((error as Error).message, 'error'); return ''; }
    finally { setBusy(''); }
  };

  const compileSource = async (kind: ProgramKind, source: string) => {
    if (!active) { notify('Hãy mở hoặc tạo dự án trước.', 'info'); return false; }
    setBusy(`compile-${kind}`);
    try {
      const result = await window.studio.compile(active.id, kind, source);
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
      const result = await window.studio.run(active.id, 'solution', runInput, [], active.timeLimitMs);
      setRunOutput(`${result.timedOut ? 'Quá thời gian.\n' : ''}${result.stdout}${result.stderr ? `\n[stderr]\n${result.stderr}` : ''}${result.exitCode !== 0 && !result.timedOut ? `\nMã thoát: ${result.exitCode}` : ''}`);
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(''); }
  };

  const generate = async () => {
    if (!active) { notify('Hãy tạo dự án trước.', 'info'); return; }
    setBusy('generate');
    try {
      const tests = await window.studio.generateTests(active.id, generatorCount, active.seed, active.generatorMode, active.generator);
      updateActive({ tests: [...active.tests, ...tests] }); setPage('runner'); notify(`Đã sinh ${tests.length} testcase.`);
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(''); }
  };

  const runAllTests = async () => {
    if (!active || !active.tests.length) { notify('Chưa có testcase để chạy.', 'info'); return; }
    setBusy('run-tests');
    try {
      const result = await window.studio.runTests(active.id, active.solution, active.tests, active.timeLimitMs);
      updateActive({ tests: result });
      const passed = result.filter((test) => test.status === 'passed').length;
      notify(`Hoàn tất: ${passed}/${result.length} testcase chạy thành công.`, passed === result.length ? 'success' : 'error');
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(''); }
  };

  const exportAction = async (kind: 'themis' | 'markdown' | 'pdf' | 'docx') => {
    if (!active) { notify('Hãy mở dự án trước.', 'info'); return; }
    setBusy('export');
    try {
      const fn = { themis: window.studio.exportThemis, markdown: window.studio.exportMarkdown, pdf: window.studio.exportPdf, docx: window.studio.exportDocx }[kind];
      const path = await fn(active);
      if (path) notify(`Đã lưu tệp tại ${path}`);
    } catch (error) { notify((error as Error).message, 'error'); }
    finally { setBusy(''); }
  };

  const pickImage = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { notify('Chọn ảnh PNG, JPG hoặc WebP.', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { notify('Ảnh tối đa 10 MB để lưu dự án và gửi AI ổn định.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const [, data = ''] = String(reader.result).split(',');
      setPhoto({ data, mimeType: file.type, name: file.name });
      if (!active) { notify('Hãy mở dự án trước khi thêm ảnh.', 'error'); return; }
      void window.studio.saveProjectImage(active.id, file.name, file.type, data).then((image) => {
        updateActive({ images: [...active.images, image] });
        notify(`Đã lưu ảnh ${file.name} trong dự án. Bấm “Đọc ảnh bằng AI” để trích nội dung.`, 'info');
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
    if (!image) { notify('Chưa có ảnh đề trong dự án.', 'info'); return; }
    const answer = await runAi({ prompt: 'Đọc nội dung đề lập trình trong ảnh. Chuyển sang Markdown có thể chỉnh sửa, giữ nguyên công thức dưới dạng LaTeX. Không tự suy đoán phần không rõ; ghi [không rõ] nếu cần.', image: { data: image.data, mimeType: image.mimeType }, maxOutputTokens: 4000 }, 'Đang đọc ảnh…');
    if (answer) { updateActive({ statement: `${active.statement.trim()}\n\n${answer}`, tests: active.tests.map((test) => test.status === 'passed' ? { ...test, status: 'pending' } : test) }); notify('Đã chèn phần trích xuất vào cuối đề bài.'); }
  };

  const runAnalysis = async () => {
    if (!active) return;
    const answer = await runAi({ prompt: `Phân tích đề lập trình sau bằng tiếng Việt. Trả về các mục: mô tả input/output, ràng buộc, subtasks (nếu có), nhóm testcase nên có, và các trường hợp biên. Không khẳng định giả định chưa nêu.\n\n${active.statement}`, maxOutputTokens: 2500 }, 'Đang phân tích đề…');
    if (answer) setPage('problem');
  };

  const generateCodeWithAi = async (kind: 'generator' | 'solution') => {
    if (!active) return;
    const task = kind === 'generator' ? 'Viết generator C++17 độc lập (không dùng thư viện ngoài) cho đề sau. Đọc seed ở argv[1], số thứ tự test ở argv[2], chế độ ở argv[3]. Chỉ trả về mã C++ trong một code block.' : 'Viết lời giải tham khảo C++17 cho đề sau. Giải thích độ phức tạp trong comment ngắn, chỉ trả mã C++ trong một code block.';
    const answer = await runAi({ prompt: `${task}\n\n${active.statement}`, maxOutputTokens: 3500 }, `Đang tạo ${kind === 'generator' ? 'generator' : 'lời giải'}…`);
    const code = answer.match(/```(?:cpp|c\+\+)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? answer;
    if (code && kind === 'generator') updateActive({ generator: code });
    if (code && kind === 'solution') updateActive({ solution: code });
  };

  const analyzeFileImage = () => fileInput.current?.click();
  const pageContent = () => {
    if (page === 'dashboard') return <Dashboard projects={projects} compilerAvailable={compilerAvailable} compilerName={compilerName} openProject={openProject} newProject={() => setProjectModal(true)} setPage={setPage} />;
    if (page === 'projects') return <Projects projects={projects} openProject={openProject} create={() => setProjectModal(true)} remove={removeProject} />;
    if (page === 'problem') return active ? <Problem project={active} update={updateActive} onAnalyze={runAnalysis} onPickImage={analyzeFileImage} onExtract={extractImage} photoName={photo?.name ?? active.images.at(-1)?.name} aiBusy={Boolean(busy && busy.startsWith('Đang'))} /> : <EmptyProject create={() => setProjectModal(true)} />;
    if (page === 'generator') return active ? <Generator project={active} update={updateActive} count={generatorCount} setCount={setGeneratorCount} busy={busy} compile={() => compileSource('generator', active.generator)} generate={generate} askAi={() => generateCodeWithAi('generator')} /> : <EmptyProject create={() => setProjectModal(true)} />;
    if (page === 'solution') return active ? <Solution project={active} update={updateActive} input={runInput} setInput={setRunInput} output={runOutput} busy={busy} compile={() => compileSource('solution', active.solution)} run={runSolution} askAi={() => generateCodeWithAi('solution')} /> : <EmptyProject create={() => setProjectModal(true)} />;
    if (page === 'runner') return active ? <Runner project={active} busy={busy} runAll={runAllTests} clear={() => updateActive({ tests: [] })} /> : <EmptyProject create={() => setProjectModal(true)} />;
    if (page === 'export') return active ? <Export project={active} busy={busy} action={exportAction} /> : <EmptyProject create={() => setProjectModal(true)} />;
    return <SettingsPage settings={settings} hasKeys={hasKeys} aiKey={aiKey} setAiKey={setAiKey} saveKey={saveKey} update={updateSettings} busy={busy} compilerAvailable={compilerAvailable} compilerName={compilerName} test={() => void window.studio.testAiConnection({ provider: settings?.provider, prompt: 'ping' }).then((result) => notify(`Kết nối thành công: ${result}`, 'success')).catch((error: Error) => notify(error.message, 'error'))} removeKey={async (provider) => { await window.studio.removeApiKey(provider); setHasKeys({ ...hasKeys, [provider]: false }); notify('Đã xóa API key.'); }} chooseCompiler={async () => { const file = await window.studio.chooseCompiler(); if (file && settings) { const next = { ...settings, compilerPath: file }; await updateSettings(next); const status = await window.studio.getStatus(); setCompilerAvailable(status.compilerAvailable); setCompilerName(status.compiler); } }} choosePandoc={async () => { const file = await window.studio.choosePandoc(); if (file && settings) await updateSettings({ ...settings, pandocPath: file }); }} />;
  };

  const currentPage = pageInfo[page];
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Command size={20} /></div><div><strong>CP Test Studio</strong><span>THI LẬP TRÌNH • VI</span></div></div>
      <button className="project-switcher" onClick={() => active ? setPage('problem') : setProjectModal(true)}>
        <span className="switcher-icon"><Folder size={17} /></span><span className="switcher-text"><small>ĐANG LÀM VIỆC</small><b>{active?.name ?? 'Chọn dự án'}</b></span><ChevronDown size={15} className="muted" />
      </button>
      <nav className="side-nav">
        {nav.map((item) => <div key={item.id}>
          {item.section && <div className="nav-section">{item.section}</div>}
          <button className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}><item.icon size={18} strokeWidth={page === item.id ? 2.3 : 1.8} /><span>{item.label}</span>{item.id === 'runner' && active?.tests.length ? <span className="nav-count">{active.tests.length}</span> : null}</button>
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className={`compiler-chip ${compilerAvailable ? 'okay' : 'warn'}`}><span className="dot" /><span>{compilerAvailable ? 'Compiler sẵn sàng' : 'Chưa có compiler'}</span><button title="Mở cài đặt" onClick={() => setPage('settings')}><SettingsIcon size={14} /></button></div>
        <button className="user-row" onClick={() => setPage('settings')}><div className="avatar">CP</div><div><b>Cài đặt ứng dụng</b><small>Lưu cục bộ trên máy</small></div><MoreHorizontal size={18} /></button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>CP Test Studio</span><ArrowRight size={13} /><b>{currentPage.title}</b>{active && <><ArrowRight size={13} /><span className="crumb-project">{active.name}</span></>}</div><div className="top-actions"><span className="local-badge"><Shield size={13} /> Dữ liệu trên máy</span>{active && <><span className={`save-indicator ${dirty ? 'pending' : ''}`}><span className="dot" />{dirty ? 'Đang lưu…' : 'Đã lưu'}</span><button className="button button-small button-secondary" onClick={() => void saveProject()}><Save size={14} /> Lưu</button></>}<button className="icon-button" title="Đổi giao diện" onClick={() => settings && void updateSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}>{settings?.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button></div></header>
      <section className="page-heading"><div><div className="eyebrow">{active ? <><span className="dot green" /> DỰ ÁN ĐANG MỞ</> : 'KHÔNG GIAN SOẠN ĐỀ'}</div><h1>{currentPage.title}</h1><p>{currentPage.subtitle}</p></div>{page !== 'settings' && <div className="heading-actions">{active && <button className="button button-secondary" onClick={() => void window.studio.chooseProjectFolder(active.id)}><FolderOpen size={16} /> Mở thư mục</button>}<button className="button button-primary" onClick={() => setProjectModal(true)}><Plus size={17} /> Dự án mới</button></div>}</section>
      {compilerAvailable === false && page !== 'settings' && <button className="notice notice-warning" onClick={() => setPage('settings')}><TriangleAlert size={17} /><span><b>Chưa tìm thấy trình biên dịch C++.</b> Compiler C++ đi kèm chưa khởi động được. Hãy kiểm tra cài đặt hoặc chọn g++.exe khác.</span><ArrowRight size={15} /></button>}
      {page === 'problem' && active && <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => pickImage(event.target.files?.[0])} />}
      <div className="page-body">{pageContent()}</div>
      <footer className="app-footer"><span>CP Test Studio <span className="footer-sep">•</span> MVP 0.1</span><span><HardDrive size={13} /> Lưu ngoại tuyến <span className="footer-sep">•</span> {active ? active.tests.length : 0} testcase</span></footer>
    </main>

    {projectModal && <Modal title="Tạo dự án mới" subtitle="Mỗi dự án lưu đề bài, mã nguồn và testcase trong một thư mục riêng." close={() => setProjectModal(false)}><label className="field-label">Tên dự án</label><input autoFocus className="text-input" value={projectName} onChange={(event) => setProjectName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void createProject()} placeholder="Ví dụ: Bài toán dãy con tăng" /><div className="modal-actions"><button className="button button-secondary" onClick={() => setProjectModal(false)}>Hủy</button><button className="button button-primary" onClick={() => void createProject()}><Plus size={16} /> Tạo dự án</button></div></Modal>}
    {onboarding && settings && <Modal title="Chào mừng đến CP Test Studio" subtitle="Soạn đề và chạy bộ test ngay trên máy. API AI là tùy chọn, bạn có thể cấu hình sau." close={() => void finishOnboarding(true)} wide><div className="welcome-banner"><div className="welcome-icon"><Rocket size={23} /></div><div><b>Bắt đầu làm việc theo cách của bạn</b><p>Không cần tài khoản. Dự án được lưu trên máy, các thao tác biên dịch và tạo testcase chạy ngoại tuyến.</p></div></div><div className="onboard-api"><div><label className="field-label">Nhà cung cấp AI (không bắt buộc)</label><select className="text-input" value={settings.provider} onChange={(event) => void updateSettings({ ...settings, provider: event.target.value as Provider })}><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option></select></div><div><label className="field-label">API key</label><div className="input-with-button"><input className="text-input" type="password" value={aiKey} onChange={(event) => setAiKey(event.target.value)} placeholder="Có thể bỏ qua và thêm sau" /><KeyRound size={16} /></div></div></div><div className="security-note"><Shield size={16} /><span>API key được mã hóa bởi Windows và chỉ gửi khi bạn chủ động dùng tính năng AI.</span></div><div className="modal-actions"><button className="button button-plain" onClick={() => void finishOnboarding(true)}>Bỏ qua, dùng không cần AI</button><button className="button button-primary" onClick={() => void finishOnboarding(false)} disabled={Boolean(aiKey && busy === 'key')}>Bắt đầu sử dụng <ArrowRight size={16} /></button></div></Modal>}
    {aiResult && <div className="result-drawer"><div className="result-head"><div><Sparkles size={16} /><b>Kết quả từ AI</b></div><button className="icon-button" onClick={() => setAiResult('')}><X size={16} /></button></div><div className="result-content"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{aiResult}</ReactMarkdown></div></div>}
    {toast && <div className={`toast toast-${toast.kind}`}><span className="toast-mark">{toast.kind === 'success' ? <Check size={16} /> : toast.kind === 'error' ? <TriangleAlert size={16} /> : <CircleHelp size={16} />}</span>{toast.text}<button onClick={() => setToast(null)}><X size={15} /></button></div>}
    {busy && <div className="busy-pill"><LoaderCircle size={15} className="spin" />{busy.startsWith('Đang') ? busy : busy === 'run-tests' ? 'Đang chạy testcase…' : busy === 'generate' ? 'Đang sinh testcase…' : busy === 'export' ? 'Đang xuất tệp…' : busy === 'key' ? 'Đang lưu API key…' : busy.startsWith('compile') ? 'Đang biên dịch…' : busy === 'run' ? 'Đang chạy chương trình…' : busy}</div>}
  </div>;
}

function Dashboard({ projects, compilerAvailable, compilerName, openProject, newProject, setPage }: { projects: Project[]; compilerAvailable: boolean; compilerName: string; openProject: (p: Project) => void; newProject: () => void; setPage: (p: Page) => void }) {
  const recent = projects.slice(0, 4);
  return <div className="dashboard-grid">
    <section className="welcome-card"><div className="welcome-copy"><div className="eyebrow light-eyebrow"><Sparkles size={13} /> WORKSPACE OFFLINE</div><h2>Mỗi bộ test tốt<br />bắt đầu từ <em>ý tưởng rõ ràng.</em></h2><p>Viết đề, tạo generator C++ và đóng gói testcase Themis trong một không gian riêng tư trên máy của bạn.</p><button className="button button-white" onClick={newProject}><Plus size={17} /> Tạo dự án đầu tiên</button></div><div className="welcome-art"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-card"><div className="art-card-head"><span /><span /><span /></div><div className="art-line l1" /><div className="art-line l2" /><div className="art-code"><i>01</i> <b>int</b> main() {'{'}</div><div className="art-code"><i>02</i> &nbsp;cout &lt;&lt; <strong>test</strong>;</div><div className="art-code"><i>03</i> {'}'}</div><div className="art-check"><BadgeCheck size={18} /> TESTS READY</div></div><div className="art-spark">✳</div></div></section>
    <div className="stats-row"><Stat icon={Folder} label="Dự án" value={String(projects.length).padStart(2, '0')} detail="Lưu trên máy" /><Stat icon={ListChecks} label="Testcase" value={String(projects.reduce((sum, project) => sum + project.tests.length, 0)).padStart(2, '0')} detail="Trong các dự án" /><Stat icon={Gauge} label="Compiler C++" value={compilerAvailable ? 'Sẵn sàng' : 'Chưa cài'} detail={compilerAvailable ? compilerName.split(/[\\/]/).pop() ?? 'g++' : 'Cần kiểm tra compiler'} status={compilerAvailable} /></div>
    <section className="panel recent-panel"><div className="section-heading"><div><h3>Dự án gần đây</h3><p>Tiếp tục nơi bạn vừa làm việc.</p></div><button className="link-button" onClick={() => setPage('projects')}>Xem tất cả <ArrowRight size={14} /></button></div>{recent.length ? <div className="recent-list">{recent.map((project, index) => <ProjectRow key={project.id} project={project} index={index} open={() => openProject(project)} compact />)}</div> : <div className="empty-inline"><div className="empty-icon"><FileCode2 size={20} /></div><div><b>Chưa có dự án nào</b><span>Tạo dự án đầu tiên để bắt đầu soạn đề.</span></div><button className="button button-primary button-small" onClick={newProject}><Plus size={15} /> Tạo mới</button></div>}</section>
    <aside className="quick-panel panel"><div className="quick-head"><div className="quick-icon"><Activity size={17} /></div><div><h3>Bắt đầu nhanh</h3><p>Quy trình cơ bản</p></div></div><div className="quick-step"><span>01</span><div><b>Soạn đề bài</b><small>Markdown và công thức LaTeX</small></div><ArrowRight size={15} onClick={() => setPage('problem')} /></div><div className="quick-step"><span>02</span><div><b>Viết generator</b><small>Tạo input với C++17</small></div><ArrowRight size={15} onClick={() => setPage('generator')} /></div><div className="quick-step"><span>03</span><div><b>Kiểm tra & xuất</b><small>Chạy lời giải, đóng gói Themis</small></div><ArrowRight size={15} onClick={() => setPage('runner')} /></div><button className="quick-help" onClick={() => setPage('settings')}><CircleHelp size={14} /> Hướng dẫn cấu hình môi trường <ArrowRight size={13} /></button></aside>
  </div>;
}

function Stat({ icon: Icon, label, value, detail, status }: { icon: typeof Folder; label: string; value: string; detail: string; status?: boolean }) { return <div className="stat-card"><div className={`stat-icon ${status === false ? 'stat-warn' : ''}`}><Icon size={17} /></div><div className="stat-label">{label}</div><strong className={status === false ? 'text-warn' : ''}>{value}</strong><small>{detail}</small></div>; }

function ProjectRow({ project, index, open, compact = false, remove }: { project: Project; index: number; open: () => void; compact?: boolean; remove?: () => void }) {
  return <div className={`project-row ${compact ? 'compact' : ''}`}><button className={`project-monogram color-${index % 4}`} onClick={open}>{project.name.trim().charAt(0).toUpperCase() || 'P'}</button><button className="project-main" onClick={open}><b>{project.name}</b><small>Cập nhật {new Date(project.updatedAt).toLocaleDateString('vi-VN')} · {project.tests.length} testcase</small></button><span className="project-tag"><FileText size={12} /> {project.tests.length ? 'Đang làm' : 'Bản nháp'}</span><button className="icon-button row-arrow" onClick={open} title="Mở dự án"><ArrowRight size={16} /></button>{remove && <button className="icon-button danger-icon" onClick={remove} title="Xóa dự án"><Trash2 size={15} /></button>}</div>;
}

function Projects({ projects, openProject, create, remove }: { projects: Project[]; openProject: (p: Project) => void; create: () => void; remove: (p: Project) => void }) {
  return <div className="panel project-list-panel"><div className="section-heading"><div><h3>Danh sách dự án</h3><p>{projects.length} dự án được lưu trong ứng dụng.</p></div><button className="button button-primary" onClick={create}><Plus size={16} /> Dự án mới</button></div>{projects.length ? <div className="project-list">{projects.map((project, index) => <ProjectRow key={project.id} project={project} index={index} open={() => openProject(project)} remove={() => remove(project)} />)}</div> : <EmptyProject create={create} />}</div>;
}

function EmptyProject({ create }: { create: () => void }) { return <div className="empty-state"><div className="empty-icon large"><FolderOpen size={26} /></div><h3>Chưa mở dự án</h3><p>Tạo một dự án để bắt đầu nhập đề, viết mã và tạo testcase.</p><button className="button button-primary" onClick={create}><Plus size={16} /> Tạo dự án</button></div>; }

function Problem({ project, update, onAnalyze, onPickImage, onExtract, photoName, aiBusy }: { project: Project; update: (p: Partial<Project>) => void; onAnalyze: () => void; onPickImage: () => void; onExtract: () => void; photoName?: string; aiBusy: boolean }) {
  return <div className="editor-layout"><div className="panel editor-panel"><div className="panel-toolbar"><div className="toolbar-title"><FileText size={16} /><b>Nội dung đề</b><span className="format-pill">MARKDOWN</span></div><div className="toolbar-actions"><button className="button button-secondary button-small" onClick={onPickImage}><FileImage size={14} /> Thêm ảnh đề</button><button className="button button-primary button-small" onClick={onAnalyze} disabled={aiBusy}><Sparkles size={14} /> Phân tích bằng AI</button></div></div><div className="document-title"><input value={project.name} onChange={(e) => update({ name: e.target.value })} aria-label="Tên dự án" /><span>ĐỀ BÀI / MÔ TẢ</span></div><textarea className="code-textarea markdown-input" spellCheck={false} value={project.statement} onChange={(e) => update({ statement: e.target.value, tests: project.tests.map((test) => test.status === 'passed' ? { ...test, status: 'pending' } : test) })} placeholder="Nhập đề bài bằng Markdown..." /><div className="editor-footer"><span><span className="dot green" /> Tự lưu trên máy</span><span>Markdown · LaTeX <span className="footer-sep">·</span> {project.statement.length} ký tự</span></div>{photoName && <div className="photo-strip"><FileImage size={14} /> {photoName}<button onClick={onExtract}><Sparkles size={14} /> Đọc ảnh bằng AI</button></div>}</div><div className="panel preview-panel"><div className="panel-toolbar"><div className="toolbar-title"><BookOpen size={16} /><b>Xem trước</b></div><span className="preview-live"><span className="dot green" /> TRỰC TIẾP</span></div><div className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{project.statement || '*Nội dung xem trước sẽ hiện tại đây.*'}</ReactMarkdown></div></div></div>;
}

function Generator({ project, update, count, setCount, busy, compile, generate, askAi }: { project: Project; update: (p: Partial<Project>) => void; count: number; setCount: (n: number) => void; busy: string; compile: () => void; generate: () => void; askAi: () => void }) {
  return <div className="feature-stack"><div className="panel feature-intro"><div className="feature-icon purple"><Braces size={20} /></div><div><h3>Generator C++17</h3><p>Chương trình nhận <code>seed</code>, <code>testIndex</code>, <code>mode</code> lần lượt qua argv[1..3]. Mỗi lần chạy cần in đúng một input ra stdout.</p></div><div className="intro-actions"><button className="button button-secondary button-small" onClick={askAi}><Sparkles size={14} /> Gợi ý bằng AI</button><button className="button button-secondary button-small" onClick={compile} disabled={busy === 'compile-generator'}><Code2 size={14} /> Biên dịch</button></div></div><div className="panel code-panel"><div className="panel-toolbar"><div className="toolbar-title"><FileCode2 size={16} /><b>generator.cpp</b><span className="format-pill">C++17</span></div><span className="code-hint">Mã chạy cục bộ</span></div><textarea className="code-textarea cpp-input" spellCheck={false} value={project.generator} onChange={(e) => update({ generator: e.target.value })} /></div><div className="panel generate-controls"><div><h3>Tham số sinh test</h3><p>Generator được chạy từng test một lần; không gọi API theo testcase.</p></div><div className="generate-fields"><label><span>Số lượng test</span><input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value))))} /></label><label><span>Seed bắt đầu</span><input type="number" value={project.seed} onChange={(e) => update({ seed: Number(e.target.value) })} /></label><label><span>Nhóm dữ liệu</span><select value={project.generatorMode} onChange={(e) => update({ generatorMode: e.target.value as Project['generatorMode'] })}><option value="random">Ngẫu nhiên</option><option value="boundary">Biên</option><option value="constructive">Có cấu trúc</option><option value="stress">Stress</option></select></label><button className="button button-primary" onClick={generate} disabled={busy === 'generate'}><Play size={15} /> Sinh {count} testcase</button></div></div></div>;
}

function Solution({ project, update, input, setInput, output, busy, compile, run, askAi }: { project: Project; update: (p: Partial<Project>) => void; input: string; setInput: (s: string) => void; output: string; busy: string; compile: () => void; run: () => void; askAi: () => void }) {
  return <div className="feature-stack solution-layout"><div className="panel code-panel"><div className="panel-toolbar"><div className="toolbar-title"><Code2 size={16} /><b>solution.cpp</b><span className="format-pill">C++17</span></div><div className="toolbar-actions"><button className="button button-secondary button-small" onClick={askAi}><Sparkles size={14} /> Gợi ý bằng AI</button><button className="button button-secondary button-small" onClick={compile} disabled={busy === 'compile-solution'}><Code2 size={14} /> Biên dịch</button></div></div><textarea className="code-textarea cpp-input solution-code" spellCheck={false} value={project.solution} onChange={(e) => update({ solution: e.target.value, tests: project.tests.map((test) => test.status === 'passed' ? { ...test, status: 'pending' } : test) })} /></div><div className="solution-bottom"><div className="panel trial-panel"><div className="panel-toolbar"><div className="toolbar-title"><Play size={16} /><b>Chạy thử</b></div><label className="limit-input">Giới hạn <input type="number" min={100} max={30000} value={project.timeLimitMs} onChange={(e) => update({ timeLimitMs: Number(e.target.value) })} /> ms</label></div><textarea className="trial-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Dán input mẫu tại đây..." /><div className="trial-actions"><span>Input được truyền qua stdin.</span><button className="button button-primary button-small" onClick={run} disabled={busy === 'run'}><Play size={14} /> Biên dịch & chạy</button></div></div><div className="panel output-panel"><div className="panel-toolbar"><div className="toolbar-title"><Activity size={16} /><b>stdout / stderr</b></div><span className="output-label">KẾT QUẢ</span></div><pre>{output || 'Kết quả chạy chương trình sẽ hiện tại đây.'}</pre></div></div></div>;
}

function Runner({ project, busy, runAll, clear }: { project: Project; busy: string; runAll: () => void; clear: () => void }) {
  const passed = project.tests.filter((test) => test.status === 'passed').length;
  return <div className="feature-stack"><div className="runner-summary panel"><div className="runner-count"><div className="feature-icon teal"><ListChecks size={19} /></div><div><b>{project.tests.length} testcase</b><small>{passed} chạy thành công · {project.tests.length - passed} cần kiểm tra</small></div></div><div className="runner-actions"><button className="button button-secondary" onClick={clear} disabled={!project.tests.length}><Trash2 size={15} /> Xóa danh sách</button><button className="button button-primary" onClick={runAll} disabled={!project.tests.length || busy === 'run-tests'}><Play size={15} /> Chạy lời giải trên tất cả</button></div></div>{project.tests.length ? <div className="panel test-table-panel"><div className="test-table-head"><span>TESTCASE</span><span>INPUT</span><span>OUTPUT</span><span>TRẠNG THÁI</span><span>THỜI GIAN</span></div>{project.tests.map((test, index) => <TestRow key={test.id} test={test} index={index} />)}</div> : <div className="panel empty-tests"><div className="empty-icon"><ListChecks size={21} /></div><h3>Chưa có testcase</h3><p>Viết generator ở mục “Sinh testcase”, sau đó bấm Sinh testcase để tạo input.</p><div className="test-flow"><span><b>1</b> Generator C++</span><ArrowRight size={14} /><span><b>2</b> Sinh input</span><ArrowRight size={14} /><span><b>3</b> Chạy lời giải</span></div></div>}</div>;
}

function TestRow({ test, index }: { test: TestCase; index: number }) {
  const [open, setOpen] = useState(false);
  const label: Record<TestCase['status'], string> = { pending: 'Chờ chạy', passed: 'Đã chạy', failed: 'Lỗi runtime', timeout: 'Quá thời gian', invalid: 'Input lỗi' };
  return <div className="test-row-wrap"><button className="test-row" onClick={() => setOpen(!open)}><span className="test-name"><span className="test-index">{String(index + 1).padStart(2, '0')}</span><b>{test.name}</b></span><span className="test-contents">{test.input.slice(0, 56).replaceAll('\n', ' ↵ ') || <i>(rỗng)</i>}</span><span className="test-contents">{test.output.slice(0, 48).replaceAll('\n', ' ↵ ') || <i>Chưa có output</i>}</span><span className={`status-pill status-${test.status}`}><span className="dot" />{label[test.status]}</span><span className="test-runtime">{test.runtimeMs ? `${test.runtimeMs} ms` : '—'} <ChevronDown size={14} /></span></button>{open && <div className="test-detail"><div><b>Input</b><pre>{test.input || '(rỗng)'}</pre></div><div><b>Output</b><pre>{test.output || '(chưa có output)'}</pre></div>{test.stderr && <div className="stderr-detail"><b>Thông báo</b><pre>{test.stderr}</pre></div>}</div>}</div>;
}

function Export({ project, busy, action }: { project: Project; busy: string; action: (kind: 'themis' | 'markdown' | 'pdf' | 'docx') => void }) {
  const ready = project.tests.filter((test) => test.status === 'passed').length;
  return <div className="export-layout"><section className="panel export-main"><div className="export-title"><div className="feature-icon orange"><Download size={20} /></div><div><h3>Xuất bộ testcase Themis</h3><p>Mỗi test được đóng gói vào một thư mục riêng, gồm <code>BAI.INP</code> và <code>BAI.OUT</code>.</p></div></div><div className="zip-preview"><div className="zip-tree-head"><Folder size={15} /> CẤU TRÚC BÊN TRONG ZIP <span>{ready} test sẵn sàng</span></div><div className="tree-line"><span className="tree-guide">├─</span><Folder size={15} /> BAI/</div>{project.tests.slice(0, 4).map((test, i) => <div className="tree-children" key={test.id}><div><span className="tree-guide">{i === Math.min(project.tests.length, 4) - 1 ? '└─' : '├─'}</span><Folder size={14} /> {`TEST${String(i + 1).padStart(2, '0')}/`}</div><div className="tree-file"><span>│&nbsp;&nbsp;├─</span><FileText size={13} /> BAI.INP</div><div className="tree-file"><span>│&nbsp;&nbsp;└─</span><FileText size={13} /> BAI.OUT</div></div>)}{project.tests.length > 4 && <div className="tree-more">└─ … {project.tests.length - 4} thư mục test khác</div>}{!project.tests.length && <div className="tree-empty">Sinh testcase để xem cấu trúc gói.</div>}</div><div className="export-actions"><button className="button button-primary" onClick={() => action('themis')} disabled={busy === 'export' || !project.tests.length}><Download size={16} /> Xuất Themis ZIP</button><span>{ready}/{project.tests.length} test có output đã xác nhận</span></div></section><section className="panel document-export"><div className="section-heading"><div><h3>Xuất đề bài</h3><p>Tạo bản chia sẻ hoặc in ấn.</p></div></div><button className="export-format-row" onClick={() => action('markdown')}><div className="export-format-icon markdown-icon">M↓</div><div><b>Markdown</b><small>Xuất nội dung .md nguyên bản</small></div><ArrowRight size={16} /></button><button className="export-format-row" onClick={() => action('pdf')}><div className="export-format-icon pdf-icon">PDF</div><div><b>Tài liệu PDF</b><small>In ra PDF, hỗ trợ tiếng Việt</small></div><ArrowRight size={16} /></button><button className="export-format-row" onClick={() => action('docx')}><div className="export-format-icon docx-icon">W</div><div><b>Tài liệu DOCX</b><small>Cần cài Pandoc trên máy</small></div><ArrowRight size={16} /></button><div className="export-hint"><CircleHelp size={15} /><span>Chỉ testcase đã chạy thành công mới được đưa vào gói xuất mặc định.</span></div></section></div>;
}

function SettingsPage({ settings, hasKeys, aiKey, setAiKey, saveKey, update, busy, compilerAvailable, compilerName, test, removeKey, chooseCompiler, choosePandoc }: { settings: Settings | null; hasKeys: Record<Provider, boolean>; aiKey: string; setAiKey: (key: string) => void; saveKey: (provider: Provider) => void; update: (settings: Settings) => void; busy: string; compilerAvailable: boolean; compilerName: string; test: () => void; removeKey: (provider: Provider) => void; chooseCompiler: () => void; choosePandoc: () => void }) {
  const [provider, setProvider] = useState<Provider>('openai');
  if (!settings) return <div className="panel loading-settings"><LoaderCircle className="spin" /> Đang tải cài đặt…</div>;
  return <div className="settings-layout"><div className="settings-column"><section className="panel settings-card"><div className="settings-title"><div className="settings-icon purple"><Sparkles size={18} /></div><div><h3>Trợ lý AI</h3><p>Chỉ gửi nội dung khi bạn bấm một chức năng AI.</p></div><span className="optional-tag">TÙY CHỌN</span></div><div className="provider-tabs"><button className={provider === 'openai' ? 'selected' : ''} onClick={() => setProvider('openai')}>OpenAI</button><button className={provider === 'gemini' ? 'selected' : ''} onClick={() => setProvider('gemini')}>Google Gemini</button></div><div className="settings-form-grid"><label><span>Model mặc định</span><input className="text-input" value={settings.models[provider]} onChange={(e) => update({ ...settings, models: { ...settings.models, [provider]: e.target.value } })} placeholder={provider === 'openai' ? 'gpt-4.1-mini' : 'gemini-2.5-flash'} /></label><label><span>Provider mặc định</span><select className="text-input" value={settings.provider} onChange={(e) => update({ ...settings, provider: e.target.value as Provider })}><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option></select></label></div><label className="field-label api-label">API key {hasKeys[provider] && <span className="key-saved"><BadgeCheck size={13} /> Đã lưu an toàn</span>}</label><div className="api-key-row"><div className="input-with-button"><input className="text-input" type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder={hasKeys[provider] ? 'Nhập key mới để thay thế' : 'Dán API key tại đây'} /><KeyRound size={16} /></div><button className="button button-primary" onClick={() => saveKey(provider)} disabled={busy === 'key'}><Save size={15} /> Lưu key</button></div><div className="security-note"><Shield size={15} /><span>Key được mã hóa bằng cơ chế bảo vệ thông tin của Windows; không lưu trong file dự án.</span></div><div className="settings-actions"><button className="button button-secondary button-small" onClick={test} disabled={!hasKeys[provider]}><Activity size={14} /> Kiểm tra kết nối</button>{hasKeys[provider] && <button className="button button-danger button-small" onClick={() => removeKey(provider)}><Trash2 size={14} /> Xóa key</button>}</div></section><section className="panel settings-card"><div className="settings-title"><div className="settings-icon blue"><Code2 size={18} /></div><div><h3>Compiler C++</h3><p>Ứng dụng dùng MinGW-w64 đi kèm; bạn có thể chọn compiler khác nếu cần.</p></div></div><div className="environment-row"><span className="env-indicator"><span className={`dot ${compilerAvailable ? 'green' : 'warn'}`}/></span><div><b>{compilerAvailable ? 'Đã tìm thấy compiler' : 'Chưa tìm thấy g++'}</b><small>{compilerName || settings.compilerPath || 'Compiler C++ đi kèm ứng dụng'}</small></div><button className="button button-secondary button-small" onClick={chooseCompiler}>Chọn g++.exe</button></div><div className="setup-hint"><b>Compiler đã đi kèm ứng dụng</b><span>Không cần cài MinGW-w64 hoặc sửa PATH của Windows. Bạn có thể chọn g++.exe khác nếu muốn.</span></div></section><section className="panel settings-card"><div className="settings-title"><div className="settings-icon orange"><FileText size={18} /></div><div><h3>Pandoc</h3><p>Chỉ cần nếu bạn muốn xuất đề bài sang DOCX.</p></div><button className="button button-secondary button-small" onClick={choosePandoc}>Chọn pandoc.exe</button></div><div className="path-display">{settings.pandocPath || 'Tự tìm pandoc trong PATH'}</div></section></div><aside className="settings-aside"><div className="panel privacy-card"><div className="privacy-lock"><Shield size={22} /></div><h3>Riêng tư theo mặc định</h3><p>Đề bài, source code, testcase và output được lưu cục bộ trong hồ sơ người dùng Windows.</p><div className="privacy-rule"><Check size={15} /> Không cần đăng nhập</div><div className="privacy-rule"><Check size={15} /> Không có backend cloud</div><div className="privacy-rule"><Check size={15} /> AI chỉ chạy theo yêu cầu</div></div><div className="panel theme-card"><div className="settings-title"><div className="settings-icon gray"><Sun size={17} /></div><div><h3>Giao diện</h3><p>Sáng hoặc tối.</p></div></div><div className="theme-options"><button className={settings.theme === 'light' ? 'selected' : ''} onClick={() => update({ ...settings, theme: 'light' })}><Sun size={16} /> Sáng</button><button className={settings.theme === 'dark' ? 'selected' : ''} onClick={() => update({ ...settings, theme: 'dark' })}><Moon size={16} /> Tối</button></div></div><div className="version-card"><Github size={15} /><span>CP Test Studio</span><b>0.1.0 MVP</b></div></aside></div>;
}

function Modal({ title, subtitle, close, children, wide = false }: { title: string; subtitle: string; close: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}><div className={`modal ${wide ? 'modal-wide' : ''}`}><button className="icon-button modal-close" onClick={close}><X size={17} /></button><div className="modal-heading"><div className="brand-mark small-mark"><Command size={16} /></div><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</div></div>; }

export default App;
