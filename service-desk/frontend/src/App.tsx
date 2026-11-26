import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type {
  RoleName, Ticket, Category, Priority, Status, User, KBArticle, SLAPolicy, Role
} from './types';
import { TicketModal } from './TicketModal';
import { AdminExtras } from './AdminExtras';
import {
  Zap, Plus, Search, BookOpen, BarChart3, Users, Sliders,
  LogOut, Trash2, Edit2, User as UserIcon, X, Lock, Unlock, Download, ClipboardList,
  Sun, Moon, ArrowUpDown, KeyRound
} from 'lucide-react';

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (localStorage.getItem('fastsup_theme') as 'light' | 'dark') || 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fastsup_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const [token, setToken] = useState<string | null>(localStorage.getItem('sd_token'));
  const [role, setRole] = useState<RoleName | null>(localStorage.getItem('sd_role') as RoleName | null);
  const [fullName, setFullName] = useState<string>(localStorage.getItem('sd_name') || '');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Авторизация
  const [email, setEmail] = useState('client@sd.local');
  const [password, setPassword] = useState('123456');
  const [authError, setAuthError] = useState('');
  const [recoveryMode, setRecoveryMode] = useState<boolean>(false);
  const [recStep, setRecStep] = useState<1 | 2>(1);
  const [recCode, setRecCode] = useState('');
  const [recNewPass, setRecNewPass] = useState('');
  const [recInfo, setRecInfo] = useState('');
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const notify = (text: string, ok = true) => { setToast({ text, ok }); setTimeout(() => setToast(null), 4000); };

  // Вкладки
  const [tab, setTab] = useState<'tickets' | 'kb' | 'admin'>('tickets');

  // Данные
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [specialists, setSpecialists] = useState<User[]>([]);
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);

  // Фильтры заявок
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  // Поиск, фильтр и сортировка Базы Знаний
  const [kbSearch, setKbSearch] = useState('');
  const [kbFilterCat, setKbFilterCat] = useState('');
  const [kbSort, setKbSort] = useState<'newest' | 'oldest' | 'title_asc' | 'title_desc'>('newest');

  // Модалка новой заявки
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCatId, setNewCatId] = useState<number>(1);
  const [newPrioId, setNewPrioId] = useState<number>(2);

  // Модалка профиля и смены пароля
  const [showProfile, setShowProfile] = useState(false);
  const [profName, setProfName] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [profMsg, setProfMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // База знаний (создание/редактирование)
  const [editingKbId, setEditingKbId] = useState<number | null>(null);
  const [kbTitle, setKbTitle] = useState('');
  const [kbText, setKbText] = useState('');
  const [kbCatId, setKbCatId] = useState<number>(1);

  // Админка
  const [analytics, setAnalytics] = useState<any>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [slaList, setSlaList] = useState<SLAPolicy[]>([]);
  const [uEmail, setUEmail] = useState('');
  const [uName, setUName] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uPass, setUPass] = useState('123456');
  const [uRoleId, setURoleId] = useState<number>(1);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const filteredKbArticles = useMemo(() => {
    const q = kbSearch.trim().toLowerCase();
    return kbArticles
      .filter((art) => {
        const matchesCat = !kbFilterCat || String(art.category_id) === kbFilterCat;
        const matchesQuery =
          !q ||
          art.title.toLowerCase().includes(q) ||
          art.solution_text.toLowerCase().includes(q) ||
          (art.category?.category_name || '').toLowerCase().includes(q);
        return matchesCat && matchesQuery;
      })
      .sort((a, b) => {
        if (kbSort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (kbSort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (kbSort === 'title_asc') return a.title.localeCompare(b.title, 'ru');
        return b.title.localeCompare(a.title, 'ru');
      });
  }, [kbArticles, kbSearch, kbFilterCat, kbSort]);

  const handleLogin = async (e?: React.FormEvent, quickEmail?: string) => {
    if (e) e.preventDefault();
    setAuthError('');
    const targetEmail = quickEmail || email;
    const targetPass = quickEmail ? '123456' : password;
    if (quickEmail) {
      setEmail(quickEmail);
      setPassword('123456');
    }
    try {
      const form = new URLSearchParams();
      form.append('username', targetEmail);
      form.append('password', targetPass);
      const res = await api.post('http://127.0.0.1:8000/api/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      localStorage.setItem('sd_token', res.data.access_token);
      localStorage.setItem('sd_role', res.data.role);
      localStorage.setItem('sd_name', res.data.full_name);
      setToken(res.data.access_token);
      setRole(res.data.role);
      setFullName(res.data.full_name);
      setTab('tickets');
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Ошибка входа';
      setAuthError(`Ошибка входа (${err?.response?.status || 'Сеть'}): ${detail}`);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setRecInfo('');
    try {
      const res = await api.post('http://127.0.0.1:8000/api/auth/forgot-password', { email });
      setRecInfo(res.data.message);
      if (res.data.demo_code) setRecCode(res.data.demo_code);
      setRecStep(2);
    } catch (err: any) {
      setAuthError(err?.response?.data?.detail || 'Ошибка запроса кода');
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      await api.post('http://127.0.0.1:8000/api/auth/reset-password', {
        email,
        code: recCode,
        new_password: recNewPass,
      });
      setPassword(recNewPass);
      setRecoveryMode(false);
      setRecStep(1);
      setRecCode('');
      setRecNewPass('');
      setRecInfo('Пароль успешно изменен! Теперь вы можете войти.');
    } catch (err: any) {
      setAuthError(err?.response?.data?.detail || 'Ошибка сброса пароля');
    }
  };

  const handleAdminResetPassword = async (userId: number, userName: string) => {
    try {
      await api.post(`/api/admin/users/${userId}/reset-password`);
      notify(`Пароль пользователя ${userName} сброшен на 123456`);
    } catch {
      notify('Не удалось сбросить пароль', false);
    }
  };

  const logout = () => {
    localStorage.removeItem('sd_token');
    localStorage.removeItem('sd_role');
    localStorage.removeItem('sd_name');
    setToken(null);
    setRole(null);
    setCurrentUser(null);
  };

  const loadBaseData = async () => {
    if (!token) return;
    try {
      const meRes = await api.get('/api/auth/me');
      setCurrentUser(meRes.data);
      setProfName(meRes.data.full_name);
      setProfPhone(meRes.data.phone || '');
    } catch (e) { console.error(e); }

    try {
      const dictRes = await api.get('/api/tickets/dictionaries/all');
      setCategories(dictRes.data.categories);
      setPriorities(dictRes.data.priorities);
      setStatuses(dictRes.data.statuses);
      if (dictRes.data.categories.length) {
        setNewCatId(dictRes.data.categories[0].category_id);
        setKbCatId(dictRes.data.categories[0].category_id);
      }
      if (dictRes.data.priorities.length) {
        setNewPrioId(dictRes.data.priorities[0].priority_id);
      }
    } catch (e) { console.error(e); }

    try {
      const specRes = await api.get('/api/admin/specialists');
      setSpecialists(specRes.data);
    } catch (e) { console.error(e); }

    try {
      const kbRes = await api.get('/api/kb/');
      setKbArticles(kbRes.data);
    } catch (e) { console.error(e); }
  };

  const loadTickets = async () => {
    if (!token) return;
    const params: any = {};
    if (search) params.search = search;
    if (filterStatus) params.status_id = filterStatus;
    const res = await api.get('/api/tickets/', { params });
    setTickets(res.data);
  };

  const loadAdminData = async () => {
    if (role !== 'admin' && role !== 'dispatcher') return;
    const anRes = await api.get('/api/admin/analytics');
    setAnalytics(anRes.data);
    if (role === 'admin') {
      const [uRes, rRes, sRes] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/roles'),
        api.get('/api/admin/sla'),
      ]);
      setUsersList(uRes.data);
      setRolesList(rRes.data);
      if (rRes.data.length) setURoleId(rRes.data[0].role_id);
      setSlaList(sRes.data);
    }
  };

  useEffect(() => {
    if (token) {
      loadBaseData();
      loadTickets();
      loadAdminData();
    }
  }, [token, role]);

  useEffect(() => {
    if (token) loadTickets();
  }, [search, filterStatus]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfMsg(null);
    try {
      const res = await api.patch('/api/auth/me', null, {
        params: { full_name: profName, phone: profPhone || null }
      });
      setCurrentUser(res.data);
      setFullName(res.data.full_name);
      localStorage.setItem('sd_name', res.data.full_name);
      setProfMsg({ text: 'Контактные данные обновлены', ok: true });
    } catch {
      setProfMsg({ text: 'Не удалось обновить профиль', ok: false });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfMsg(null);
    try {
      await api.post('/api/auth/change-password', { old_password: oldPass, new_password: newPass });
      setOldPass('');
      setNewPass('');
      setProfMsg({ text: 'Пароль успешно изменен', ok: true });
    } catch (err: any) {
      setProfMsg({ text: err?.response?.data?.detail || 'Ошибка смены пароля', ok: false });
    }
  };

  const handleExportReport = async () => {
    try {
      const res = await api.get('/api/admin/export-report', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'fastsup_sla_report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      notify('Отчет успешно выгружен');
    } catch {
      notify('Ошибка при выгрузке отчета', false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/tickets/', {
        category_id: Number(newCatId),
        priority_id: Number(newPrioId),
        title: newTitle,
        description: newDesc,
      });
      setNewTitle('');
      setNewDesc('');
      setShowNewTicket(false);
      notify('Заявка успешно создана');
      await loadTickets();
      await loadAdminData();
    } catch (err: any) {
      notify(err?.response?.data?.detail || err?.message || 'Ошибка создания заявки', false);
    }
  };

  const handleSaveKB = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingKbId) {
        await api.put(`/api/kb/${editingKbId}`, { category_id: Number(kbCatId), title: kbTitle, solution_text: kbText });
        notify('Статья обновлена');
      } else {
        await api.post('/api/kb/', { category_id: Number(kbCatId), title: kbTitle, solution_text: kbText });
        notify('Статья добавлена в Базу Знаний');
      }
      setEditingKbId(null);
      setKbTitle('');
      setKbText('');
      const res = await api.get('/api/kb/');
      setKbArticles(res.data);
    } catch (err: any) {
      notify(err?.response?.data?.detail || err?.message || 'Ошибка сохранения статьи', false);
    }
  };

  const startEditKB = (art: KBArticle) => {
    setEditingKbId(art.kb_id);
    setKbCatId(art.category_id);
    setKbTitle(art.title);
    setKbText(art.solution_text);
  };

  const cancelEditKB = () => {
    setEditingKbId(null);
    setKbTitle('');
    setKbText('');
  };

  const handleDeleteKB = async (id: number) => {
    await api.delete(`/api/kb/${id}`);
    if (editingKbId === id) cancelEditKB();
    const res = await api.get('/api/kb/');
    setKbArticles(res.data);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/users', {
        email: uEmail,
        full_name: uName,
        phone: uPhone || null,
        password: uPass,
        role_id: Number(uRoleId)
      });
      setUEmail('');
      setUName('');
      setUPhone('');
      notify('Пользователь успешно добавлен');
      await loadAdminData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      notify(typeof detail === 'string' ? detail : JSON.stringify(detail || err?.message), false);
    }
  };

  const handleUpdateUser = async (userId: number, patchData: Partial<User>) => {
    await api.patch(`/api/admin/users/${userId}`, patchData);
    setEditingUser(null);
    loadAdminData();
    loadBaseData();
  };

  const handleUpdateSLA = async (sla: SLAPolicy, respMin: number, resHours: number) => {
    await api.put(`/api/admin/sla/${sla.sla_id}`, {
      response_time_minutes: respMin,
      resolve_time_hours: resHours,
    });
    loadAdminData();
  };

  if (!token || !role) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20, position: 'relative' }}>
        <button
          className="btn-outline"
          onClick={toggleTheme}
          style={{ position: 'absolute', top: 20, right: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          {theme === 'light' ? 'Темная тема' : 'Светлая тема'}
        </button>

        <div className="card" style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ background: 'var(--primary)', color: '#fff', padding: 9, borderRadius: 10, display: 'flex' }}>
              <Zap size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: 22 }}>FastSup</h1>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Быстрая поддержка и ремонт ИС</span>
            </div>
          </div>

          {!recoveryMode ? (
            <form onSubmit={(e) => handleLogin(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13 }}>Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 13 }}>Пароль</label>
                  <button
                    type="button"
                    onClick={() => { setRecoveryMode(true); setRecStep(1); setAuthError(''); setRecInfo(''); }}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontSize: 12 }}
                  >
                    Забыли пароль?
                  </button>
                </div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {recInfo && <div style={{ color: 'var(--success)', fontSize: 13 }}>{recInfo}</div>}
              {authError && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{authError}</div>}
              <button type="submit" className="btn-primary">Войти в систему</button>
            </form>
          ) : (
            <form onSubmit={recStep === 1 ? handleRequestResetCode : handleConfirmReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Восстановление доступа</div>
              <div>
                <label style={{ fontSize: 13 }}>Учетный Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} required disabled={recStep === 2} />
              </div>
              {recStep === 2 && (
                <>
                  <div>
                    <label style={{ fontSize: 13 }}>Код подтверждения (6 цифр)</label>
                    <input value={recCode} onChange={(e) => setRecCode(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ fontSize: 13 }}>Новый пароль</label>
                    <input type="password" placeholder="Минимум 4 символа" value={recNewPass} onChange={(e) => setRecNewPass(e.target.value)} required />
                  </div>
                </>
              )}
              {recInfo && <div style={{ color: 'var(--success)', fontSize: 13 }}>{recInfo}</div>}
              {authError && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{authError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  {recStep === 1 ? 'Получить код' : 'Сохранить новый пароль'}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => { setRecoveryMode(false); setAuthError(''); setRecInfo(''); }}
                >
                  Назад
                </button>
              </div>
            </form>
          )}

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Быстрый вход (демо-роли, пароль 123456):</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button className="btn-outline" onClick={() => handleLogin(undefined, 'client@sd.local')}>Клиент</button>
              <button className="btn-outline" onClick={() => handleLogin(undefined, 'disp@sd.local')}>Диспетчер</button>
              <button className="btn-outline" onClick={() => handleLogin(undefined, 'spec@sd.local')}>Специалист ТП</button>
              <button className="btn-outline" onClick={() => handleLogin(undefined, 'admin@sd.local')}>Администратор</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const roleLabels: Record<RoleName, string> = {
    client: 'Клиент',
    dispatcher: 'Диспетчер',
    specialist: 'Специалист ТП',
    admin: 'Администратор',
  };

  const navBtnStyle = (active: boolean): React.CSSProperties => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 8,
    fontWeight: active ? 600 : 500,
    fontSize: 14,
    textAlign: 'left',
    background: active ? 'var(--nav-active-bg)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text)',
    border: active ? '1px solid var(--nav-active-border)' : '1px solid transparent',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* ЛЕВАЯ БОКОВАЯ ПАНЕЛЬ (SIDEBAR) */}
      <aside style={{
        width: 265,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 14px',
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}>
        <div>
          {/* Логотип FastSup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ background: 'var(--primary)', color: '#fff', padding: 7, borderRadius: 9, display: 'flex' }}>
              <Zap size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px', lineHeight: 1.1 }}>FastSup</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Поддержка и ремонт ИС</div>
            </div>
          </div>

          {/* Навигация */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 18 }}>
            <button style={navBtnStyle(tab === 'tickets')} onClick={() => setTab('tickets')}>
              <ClipboardList size={18} />
              <span>Заявки</span>
            </button>

            <button style={navBtnStyle(tab === 'kb')} onClick={() => setTab('kb')}>
              <BookOpen size={18} />
              <span>База Знаний</span>
            </button>

            {(role === 'admin' || role === 'dispatcher') && (
              <button style={navBtnStyle(tab === 'admin')} onClick={() => { setTab('admin'); loadAdminData(); }}>
                <BarChart3 size={18} />
                <span>{role === 'admin' ? 'Отчетность и Админ' : 'Отчетность и SLA'}</span>
              </button>
            )}
          </nav>
        </div>

        {/* Нижний блок: Переключатель темы, Профиль и Выход */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="btn-outline"
            onClick={toggleTheme}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'light' ? 'Темная тема' : 'Светлая тема'}</span>
          </button>

          <button
            className="btn-outline"
            onClick={() => { setProfMsg(null); setShowProfile(true); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '10px 12px' }}
            title="Открыть профиль и настройки пароля"
          >
            <UserIcon size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {fullName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--primary)' }}>{roleLabels[role]}</div>
            </div>
          </button>

          <button
            className="btn-outline"
            onClick={logout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--danger)' }}
          >
            <LogOut size={16} /> Выйти из системы
          </button>
        </div>
      </aside>

      {/* ПРАВАЯ ОСНОВНАЯ РАБОЧАЯ ОБЛАСТЬ */}
      <main style={{ flex: 1, minWidth: 0, padding: '24px 32px' }}>
        {toast && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontWeight: 500,
            background: toast.ok ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)',
            color: toast.ok ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${toast.ok ? 'var(--success)' : 'var(--danger)'}`
          }}>
            {toast.text}
          </div>
        )}

        {/* ВКЛАДКА 1: ЗАЯВКИ */}
        {tab === 'tickets' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                <div style={{ position: 'relative', maxWidth: 320, width: '100%' }}>
                  <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
                  <input
                    style={{ paddingLeft: 34 }}
                    placeholder="Поиск по теме заявки..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select style={{ width: 210 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">Все статусы</option>
                  {statuses.map((s) => (
                    <option key={s.status_id} value={s.status_id}>{s.status_name}</option>
                  ))}
                </select>
              </div>

              {role === 'client' && (
                <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowNewTicket(true)}>
                  <Plus size={16} /> Новая заявка
                </button>
              )}
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Тема обращения</th>
                  <th>Категория</th>
                  <th>Приоритет</th>
                  <th>Статус</th>
                  <th>Исполнитель</th>
                  <th>Дедлайн SLA</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Заявок пока нет</td>
                  </tr>
                )}
                {tickets.map((t) => {
                  const overdue = t.sla_deadline && !t.closed_at && new Date(t.sla_deadline) < new Date();
                  return (
                    <tr key={t.ticket_id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTicketId(t.ticket_id)}>
                      <td>#{t.ticket_id}</td>
                      <td><strong>{t.title}</strong></td>
                      <td>{t.category.category_name}</td>
                      <td>
                        <span className="badge" style={{
                          background: t.priority.weight >= 3 ? 'rgba(220, 38, 38, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: t.priority.weight >= 3 ? 'var(--danger)' : 'var(--primary)'
                        }}>
                          {t.priority.priority_name}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'var(--surface-alt)', color: 'var(--text)' }}>
                          {t.status.status_name}
                        </span>
                      </td>
                      <td>{t.specialist?.full_name || '—'}</td>
                      <td style={{ color: overdue ? 'var(--danger)' : 'inherit', fontWeight: overdue ? 600 : 400 }}>
                        {t.sla_deadline ? new Date(t.sla_deadline).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ВКЛАДКА 2: БАЗА ЗНАНИЙ */}
        {tab === 'kb' && (
          <div style={{ display: 'grid', gridTemplateColumns: (role === 'specialist' || role === 'admin') ? '2fr 1fr' : '1fr', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Панель поиска, фильтрации и сортировки БЗ */}
              <div className="card" style={{ padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                  <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
                  <input
                    style={{ paddingLeft: 34 }}
                    placeholder="Поиск по заголовку или тексту решения..."
                    value={kbSearch}
                    onChange={(e) => setKbSearch(e.target.value)}
                  />
                </div>

                <select style={{ width: 210 }} value={kbFilterCat} onChange={(e) => setKbFilterCat(e.target.value)}>
                  <option value="">Все категории</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                  ))}
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowUpDown size={15} color="var(--muted)" />
                  <select style={{ width: 195 }} value={kbSort} onChange={(e) => setKbSort(e.target.value as any)}>
                    <option value="newest">Сначала новые</option>
                    <option value="oldest">Сначала старые</option>
                    <option value="title_asc">По названию (А → Я)</option>
                    <option value="title_desc">По названию (Я → А)</option>
                  </select>
                </div>
              </div>

              {filteredKbArticles.length === 0 && (
                <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                  По вашему запросу статей в Базе Знаний не найдено
                </div>
              )}

              {filteredKbArticles.map((art) => (
                <div key={art.kb_id} className="card" style={{ borderColor: editingKbId === art.kb_id ? 'var(--primary)' : 'var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                    <div>
                      <span className="badge" style={{ background: 'var(--nav-active-bg)', color: 'var(--primary)', marginBottom: 6 }}>
                        {art.category?.category_name}
                      </span>
                      <h3 style={{ fontSize: 16 }}>{art.title}</h3>
                    </div>
                    {(role === 'specialist' || role === 'admin') && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn-outline" onClick={() => startEditKB(art)} title="Редактировать статью">
                          <Edit2 size={15} color="var(--primary)" />
                        </button>
                        <button className="btn-outline" onClick={() => handleDeleteKB(art.kb_id)} title="Удалить статью">
                          <Trash2 size={15} color="var(--danger)" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p style={{ marginTop: 10, fontSize: 14, whiteSpace: 'pre-wrap' }}>{art.solution_text}</p>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
                    Автор: {art.author?.full_name} • {new Date(art.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>

            {(role === 'specialist' || role === 'admin') && (
              <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 24 }}>
                <h3 style={{ fontSize: 16, marginBottom: 12 }}>
                  {editingKbId ? `Редактирование статьи #${editingKbId}` : 'Добавить статью в БЗ'}
                </h3>
                <form onSubmit={handleSaveKB} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select value={kbCatId} onChange={(e) => setKbCatId(Number(e.target.value))}>
                    {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                  </select>
                  <input placeholder="Заголовок проблемы" value={kbTitle} onChange={(e) => setKbTitle(e.target.value)} required />
                  <textarea rows={6} placeholder="Пошаговое решение..." value={kbText} onChange={(e) => setKbText(e.target.value)} required />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                      {editingKbId ? 'Сохранить изменения' : 'Опубликовать решение'}
                    </button>
                    {editingKbId && (
                      <button type="button" className="btn-outline" onClick={cancelEditKB}>Отмена</button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА 3: ОТЧЕТНОСТЬ И АДМИНИСТРИРОВАНИЕ */}
        {tab === 'admin' && analytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18 }}>Сводная отчетность и контроль SLA</h2>
              <button className="btn-primary" onClick={handleExportReport} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Download size={16} /> Выгрузить отчет в Excel (CSV)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <div className="card">
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Всего заявок</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{analytics.total_tickets}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Нарушения / Соблюдение SLA</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: 'var(--danger)' }}>{analytics.overdue_sla_count} <span style={{ fontSize: 15, color: 'var(--success)' }}>({analytics.sla_compliance_percent ?? 100}%)</span></div>
              </div>
              <div className="card">
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Средняя оценка качества</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: 'var(--success)' }}>{analytics.average_rating} / 5</div>
              </div>
              <div className="card">
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>По статусам</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {analytics.by_status.map((s: any) => (
                    <div key={s.status}>{s.status}: <strong>{s.count}</strong></div>
                  ))}
                </div>
              </div>
            </div>

            <AdminExtras
              analytics={analytics}
              isAdmin={role === 'admin'}
              notify={notify}
              onRefreshAll={() => { loadTickets(); loadBaseData(); loadAdminData(); }}
            />

            {role === 'admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="card">
                  <h3 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={18} /> Управление пользователями и ролями
                  </h3>
                  <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 16 }}>
                    <input placeholder="ФИО" value={uName} onChange={(e) => setUName(e.target.value)} required />
                    <input placeholder="Email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} required />
                    <input placeholder="Телефон" value={uPhone} onChange={(e) => setUPhone(e.target.value)} />
                    <input placeholder="Пароль" value={uPass} onChange={(e) => setUPass(e.target.value)} required />
                    <select value={uRoleId} onChange={(e) => setURoleId(Number(e.target.value))}>
                      {rolesList.map((r) => <option key={r.role_id} value={r.role_id}>{r.description}</option>)}
                    </select>
                    <button type="submit" className="btn-primary">Добавить</button>
                  </form>

                  <table className="table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>ФИО</th>
                        <th>Email</th>
                        <th>Телефон</th>
                        <th>Роль</th>
                        <th>Статус</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map((u) => (
                        <tr key={u.user_id} style={{ opacity: u.is_active ? 1 : 0.6 }}>
                          <td>{u.user_id}</td>
                          <td>
                            {editingUser?.user_id === u.user_id ? (
                              <input
                                value={editingUser.full_name}
                                onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                              />
                            ) : u.full_name}
                          </td>
                          <td>{u.email}</td>
                          <td>
                            {editingUser?.user_id === u.user_id ? (
                              <input
                                value={editingUser.phone || ''}
                                onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                              />
                            ) : (u.phone || '—')}
                          </td>
                          <td>
                            <select
                              value={u.role_id}
                              onChange={(e) => handleUpdateUser(u.user_id, { role_id: Number(e.target.value) })}
                            >
                              {rolesList.map((r) => (
                                <option key={r.role_id} value={r.role_id}>{r.description}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span className="badge" style={{
                              background: u.is_active ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)',
                              color: u.is_active ? 'var(--success)' : 'var(--danger)'
                            }}>
                              {u.is_active ? 'Активен' : 'Заблокирован'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {editingUser?.user_id === u.user_id ? (
                                <>
                                  <button
                                    className="btn-primary"
                                    onClick={() => handleUpdateUser(u.user_id, { full_name: editingUser.full_name, phone: editingUser.phone })}
                                  >
                                    Ок
                                  </button>
                                  <button className="btn-outline" onClick={() => setEditingUser(null)}>Отмена</button>
                                </>
                              ) : (
                                <button className="btn-outline" onClick={() => setEditingUser(u)} title="Редактировать ФИО/телефон">
                                  <Edit2 size={14} />
                                </button>
                              )}
                              {u.user_id !== currentUser?.user_id && (
                                <button
                                  className="btn-outline"
                                  onClick={() => handleUpdateUser(u.user_id, { is_active: !u.is_active })}
                                  title={u.is_active ? 'Заблокировать пользователя' : 'Разблокировать пользователя'}
                                >
                                  {u.is_active ? <Lock size={14} color="var(--danger)" /> : <Unlock size={14} color="var(--success)" />}
                                </button>
                              )}
                              <button
                                className="btn-outline"
                                onClick={() => handleAdminResetPassword(u.user_id, u.full_name)}
                                title="Сбросить пароль на 123456"
                              >
                                <KeyRound size={14} color="var(--primary)" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card" style={{ maxWidth: 600 }}>
                  <h3 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sliders size={18} /> Регламенты SLA (нормативы времени)
                  </h3>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Приоритет</th>
                        <th>Реакция (мин)</th>
                        <th>Решение (час)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slaList.map((s) => (
                        <tr key={s.sla_id}>
                          <td>{s.priority?.priority_name}</td>
                          <td>
                            <input
                              type="number"
                              style={{ width: 90 }}
                              defaultValue={s.response_time_minutes}
                              onBlur={(e) => handleUpdateSLA(s, Number(e.target.value), s.resolve_time_hours)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              style={{ width: 90 }}
                              defaultValue={s.resolve_time_hours}
                              onBlur={(e) => handleUpdateSLA(s, s.response_time_minutes, Number(e.target.value))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Модальное окно профиля */}
      {showProfile && currentUser && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50, padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 18 }}>Профиль пользователя</h3>
              <button className="btn-outline" onClick={() => setShowProfile(false)}><X size={16} /></button>
            </div>

            <div style={{ background: 'var(--surface-alt)', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              <div><strong>Email:</strong> {currentUser.email}</div>
              <div><strong>Роль:</strong> {roleLabels[role]}</div>
            </div>

            {profMsg && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13,
                background: profMsg.ok ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)',
                color: profMsg.ok ? 'var(--success)' : 'var(--danger)'
              }}>
                {profMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <strong style={{ fontSize: 14 }}>Редактирование контактных данных</strong>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>ФИО</label>
                <input value={profName} onChange={(e) => setProfName(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>Телефон</label>
                <input value={profPhone} onChange={(e) => setProfPhone(e.target.value)} placeholder="+7 (900) 000-00-00" />
              </div>
              <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>Сохранить контакты</button>
            </form>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong style={{ fontSize: 14 }}>Смена пароля</strong>
              <input type="password" placeholder="Текущий пароль" value={oldPass} onChange={(e) => setOldPass(e.target.value)} required />
              <input type="password" placeholder="Новый пароль" value={newPass} onChange={(e) => setNewPass(e.target.value)} required />
              <button type="submit" className="btn-outline" style={{ alignSelf: 'flex-start' }}>Обновить пароль</button>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно создания новой заявки */}
      {showNewTicket && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 500 }}>
            <h3 style={{ marginBottom: 14 }}>Регистрация новой заявки</h3>
            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13 }}>Категория ИС / оборудования</label>
                <select value={newCatId} onChange={(e) => setNewCatId(Number(e.target.value))}>
                  {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13 }}>Приоритет</label>
                <select value={newPrioId} onChange={(e) => setNewPrioId(Number(e.target.value))}>
                  {priorities.map((p) => <option key={p.priority_id} value={p.priority_id}>{p.priority_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13 }}>Тема обращения</label>
                <input placeholder="Например: Не запускается 1С:Бухгалтерия" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: 13 }}>Подробное описание неисправности</label>
                <textarea rows={4} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn-outline" onClick={() => setShowNewTicket(false)}>Отмена</button>
                <button type="submit" className="btn-primary">Зарегистрировать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно карточки заявки */}
      {selectedTicketId && (
        <TicketModal
          ticketId={selectedTicketId}
          role={role}
          statuses={statuses}
          priorities={priorities}
          specialists={specialists}
          kbArticles={kbArticles}
          onClose={() => setSelectedTicketId(null)}
          onUpdated={() => { loadTickets(); loadAdminData(); }}
        />
      )}
    </div>
  );
}

export default App;
