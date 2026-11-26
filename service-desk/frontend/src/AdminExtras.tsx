import React, { useEffect, useState } from 'react';
import { api } from './api';
import { Database, Upload, Download, ShieldCheck, HardDrive, BarChart2 } from 'lucide-react';

interface Props {
  analytics: any;
  isAdmin: boolean;
  notify: (text: string, ok?: boolean) => void;
  onRefreshAll: () => void;
}

export const AdminExtras: React.FC<Props> = ({ analytics, isAdmin, notify, onRefreshAll }) => {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);

  const loadSecurityAndBackups = async () => {
    if (!isAdmin) return;
    try {
      const [logsRes, bkpRes] = await Promise.all([
        api.get('/api/admin/audit-logs'),
        api.get('/api/admin/backups'),
      ]);
      setAuditLogs(logsRes.data);
      setBackups(bkpRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSecurityAndBackups();
  }, [isAdmin]);

  const downloadFile = async (url: string, filename: string) => {
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const href = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = href;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(href);
      notify(`Файл ${filename} выгружен`);
      loadSecurityAndBackups();
    } catch {
      notify('Ошибка при экспорте файла', false);
    }
  };

  const handleImportFile = async (url: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post(url, form);
      const extra = res.data?.imported_count !== undefined ? ` (добавлено записей: ${res.data.imported_count})` : '';
      notify(`Импорт успешно выполнен${extra}`);
      onRefreshAll();
      loadSecurityAndBackups();
    } catch (err: any) {
      notify(err?.response?.data?.detail || 'Ошибка при импорте файла', false);
    } finally {
      e.target.value = '';
    }
  };

  const handleCreateBackup = async () => {
    try {
      const res = await api.post('/api/admin/backups/create');
      notify(`Резервная копия создана: ${res.data.filename}`);
      loadSecurityAndBackups();
    } catch {
      notify('Ошибка создания резервной копии', false);
    }
  };

  const maxStatus = Math.max(1, ...(analytics?.by_status?.map((s: any) => s.count) || [1]));
  const maxCat = Math.max(1, ...(analytics?.by_category?.map((c: any) => c.count) || [1]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ВИЗУАЛЬНЫЕ ДИАГРАММЫ АНАЛИТИКИ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart2 size={17} color="var(--primary)" /> Диаграмма заявок по статусам
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analytics?.by_status?.map((item: any) => (
              <div key={item.status}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{item.status}</span>
                  <strong>{item.count}</strong>
                </div>
                <div style={{ height: 10, background: 'var(--surface-alt)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.round((item.count / maxStatus) * 100)}%`,
                    height: '100%',
                    background: 'var(--primary)',
                    borderRadius: 6
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart2 size={17} color="var(--success)" /> Диаграмма обращений по категориям ИС
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analytics?.by_category?.map((item: any) => (
              <div key={item.category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{item.category}</span>
                  <strong>{item.count}</strong>
                </div>
                <div style={{ height: 10, background: 'var(--surface-alt)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.round((item.count / maxCat) * 100)}%`,
                    height: '100%',
                    background: 'var(--success)',
                    borderRadius: 6
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI СПЕЦИАЛИСТОВ ИЗ SQL VIEW */}
      {analytics?.specialist_kpi?.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Показатели эффективности специалистов ТП (SQL View: v_specialist_kpi)</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Специалист ТП</th>
                <th>Назначено заявок</th>
                <th>Решено / Закрыто</th>
                <th>Средняя оценка</th>
              </tr>
            </thead>
            <tbody>
              {analytics.specialist_kpi.map((sp: any) => (
                <tr key={sp.name}>
                  <td><strong>{sp.name}</strong></td>
                  <td>{sp.assigned}</td>
                  <td>{sp.resolved}</td>
                  <td>{sp.rating > 0 ? `${sp.rating} / 5 ★` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ЭКСПОРТ / ИМПОРТ SQL И CSV + РЕЗЕРВНОЕ КОПИРОВАНИЕ + ЖУРНАЛ АУДИТА (ДЛЯ АДМИНА) */}
      {isAdmin && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Database size={17} color="var(--primary)" /> Экспорт и импорт данных (SQL и CSV)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn-outline" onClick={() => downloadFile('/api/admin/export-sql', 'fastsup_dump.sql')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Download size={14} /> Экспорт БД (.SQL)
                  </button>
                  <label className="btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Upload size={14} /> Импорт БД (.SQL)
                    <input type="file" accept=".sql" hidden onChange={(e) => handleImportFile('/api/admin/import-sql', e)} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn-outline" onClick={() => downloadFile('/api/admin/export-kb-csv', 'fastsup_kb.csv')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Download size={14} /> Экспорт Базы Знаний (.CSV)
                  </button>
                  <label className="btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Upload size={14} /> Импорт Базы Знаний (.CSV)
                    <input type="file" accept=".csv" hidden onChange={(e) => handleImportFile('/api/admin/import-kb-csv', e)} />
                  </label>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HardDrive size={17} color="var(--primary)" /> Резервное копирование БД
                </h3>
                <button className="btn-primary" onClick={handleCreateBackup} style={{ fontSize: 13 }}>
                  Создать бэкап сейчас
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                Фоновый сервис <code>backup_logger_worker.py</code> автоматически сохраняет копии в каталог <code>backups/</code>.
              </div>
              <div style={{ maxHeight: 110, overflowY: 'auto', fontSize: 13 }}>
                {backups.length === 0 && <span style={{ color: 'var(--muted)' }}>Резервных копий пока нет</span>}
                {backups.map((b) => (
                  <div key={b.filename} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{b.filename}</span>
                    <span style={{ color: 'var(--muted)' }}>{b.size_kb} КБ</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={17} color="var(--success)" /> Журнал аудита безопасности (audit_logs)
            </h3>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Пользователь</th>
                    <th>Событие</th>
                    <th>Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((l) => (
                    <tr key={l.log_id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{l.created_at.slice(0, 19).replace('T', ' ')}</td>
                      <td>{l.user_email}</td>
                      <td><span className="badge" style={{ background: 'var(--nav-active-bg)', color: 'var(--primary)' }}>{l.action}</span></td>
                      <td>{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
