import React, { useEffect, useState } from 'react';
import { api, API_URL } from './api';
import type { Ticket, RoleName, User, Priority, Status, KBArticle } from './types';
import { X, Paperclip, Send, Star, BookOpen, Clock, CheckCircle, Printer } from 'lucide-react';

interface Props {
  ticketId: number;
  role: RoleName;
  statuses: Status[];
  priorities: Priority[];
  specialists: User[];
  kbArticles: KBArticle[];
  onClose: () => void;
  onUpdated: () => void;
}

export const TicketModal: React.FC<Props> = ({
  ticketId, role, statuses, priorities, specialists, kbArticles, onClose, onUpdated
}) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [msgText, setMsgText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [score, setScore] = useState(5);
  const [rateComment, setRateComment] = useState('');
  const [rateError, setRateError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const res = await api.get(`/api/tickets/${ticketId}`);
    setTicket(res.data);
  };

  useEffect(() => {
    load();
  }, [ticketId]);

  if (!ticket) return null;

  const handleAssign = async (specId: number) => {
    await api.patch(`/api/tickets/${ticketId}/assign`, { specialist_id: specId });
    await load();
    onUpdated();
  };

  const handlePriority = async (prioId: number) => {
    await api.patch(`/api/tickets/${ticketId}/priority`, { priority_id: prioId });
    await load();
    onUpdated();
  };

  const handleStatus = async (statusId: number) => {
    await api.patch(`/api/tickets/${ticketId}/status`, { status_id: statusId });
    await load();
    onUpdated();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    setLoading(true);
    try {
      await api.post(`/api/tickets/${ticketId}/messages`, {
        message_text: msgText,
        is_internal: isInternal,
      });
      setMsgText('');
      await load();
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    await api.post(`/api/tickets/${ticketId}/attachments`, formData);
    await load();
  };

  const handleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateError('');
    try {
      await api.post(`/api/tickets/${ticketId}/rate`, {
        score: Number(score),
        comment: rateComment.trim() || null
      });
      await load();
      onUpdated();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setRateError(typeof detail === 'string' ? detail : JSON.stringify(detail || err?.message || 'Ошибка сохранения оценки'));
    }
  };

  const insertFromKB = (kbId: string) => {
    const art = kbArticles.find((a) => a.kb_id === Number(kbId));
    if (art) {
      setMsgText((prev) => (prev ? `${prev}\n\n${art.solution_text}` : art.solution_text));
    }
  };

  const handlePrintAct = () => {
    const publicNotes = (ticket.messages || [])
      .filter((m) => !m.is_internal)
      .map((m) => `<li><strong>${m.sender?.full_name || "Сотрудник"}</strong> (${new Date(m.created_at).toLocaleString()}): ${m.message_text}</li>`)
      .join("");

    const win = window.open("", "_blank", "width=850,height=900");
    if (!win) return;
    win.document.write(`
      <!doctype html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <title>Акт выполненных работ по заявке №${ticket.ticket_id}</title>
        <style>
          body { font-family: "Times New Roman", serif; color: #000; padding: 40px; line-height: 1.5; }
          h1 { font-size: 18px; text-align: center; text-transform: uppercase; margin-bottom: 6px; }
          .sub { text-align: center; font-size: 13px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
          th, td { border: 1px solid #000; padding: 8px 10px; text-align: left; vertical-align: top; }
          th { background: #f2f2f2; width: 35%; }
          .signs { display: flex; justify-content: space-between; margin-top: 48px; font-size: 14px; }
          .sign-box { width: 44%; }
          .line { border-bottom: 1px solid #000; height: 28px; margin-bottom: 4px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()" style="padding: 8px 14px; margin-bottom: 16px; cursor: pointer;">Печать / Сохранить в PDF</button>
        <h1>Акт выполненных работ по обслуживанию и ремонту ИС № ${ticket.ticket_id}</h1>
        <div class="sub">Дата формирования документа: ${new Date().toLocaleDateString()}</div>
        <table>
          <tr><th>Тема обращения</th><td>${ticket.title}</td></tr>
          <tr><th>Категория ИС / оборудования</th><td>${ticket.category.category_name}</td></tr>
          <tr><th>Уровень критичности (приоритет)</th><td>${ticket.priority.priority_name}</td></tr>
          <tr><th>Заказчик (Заявитель)</th><td>${ticket.client.full_name} (${ticket.client.email})</td></tr>
          <tr><th>Исполнитель (Инженер ТП)</th><td>${ticket.specialist?.full_name || "Не назначен"}</td></tr>
          <tr><th>Дата и время регистрации</th><td>${new Date(ticket.created_at).toLocaleString()}</td></tr>
          <tr><th>Нормативный срок SLA</th><td>${ticket.sla_deadline ? new Date(ticket.sla_deadline).toLocaleString() : "Не задан"}</td></tr>
          <tr><th>Дата закрытия / решения</th><td>${ticket.closed_at ? new Date(ticket.closed_at).toLocaleString() : new Date().toLocaleString()}</td></tr>
          <tr><th>Описание неисправности</th><td>${ticket.description || ""}</td></tr>
          <tr><th>Ход выполнения и комментарии</th><td>${publicNotes ? `<ul style="margin:0;padding-left:18px;">${publicNotes}</ul>` : "Работы выполнены в полном объеме согласно регламенту."}</td></tr>
          <tr><th>Оценка качества заказчиком</th><td>${ticket.rating ? `${ticket.rating.score} из 5 (${ticket.rating.comment || "без замечаний"})` : "Замечаний не заявлено"}</td></tr>
        </table>
        <p style="font-size: 14px; margin-top: 16px;">
          Вышеперечисленные работы по диагностике, обслуживанию и восстановлению работоспособности информационной системы выполнены полностью и в срок. Заказчик претензий по объему, качеству и срокам оказания услуг не имеет.
        </p>
        <div class="signs">
          <div class="sign-box">
            <strong>Исполнитель (Специалист ТП):</strong>
            <div class="line"></div>
            <div>/ ${ticket.specialist?.full_name || "_______________"} /</div>
          </div>
          <div class="sign-box">
            <strong>Заказчик (Заявитель):</strong>
            <div class="line"></div>
            <div>/ ${ticket.client.full_name} /</div>
          </div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  };

  const closedStatus = statuses.find((s) => s.status_name === 'Закрыта');
  const rejectedStatus = statuses.find((s) => s.status_name === 'Отклонена');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50, padding: 20
    }}>
      <div className="card" style={{
        width: '96%', maxWidth: 1220, maxHeight: '92vh', overflowY: 'auto', padding: 24
      }}>
        {/* Шапка модального окна */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
          <div>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Заявка #{ticket.ticket_id} • {ticket.category.category_name}
            </span>
            <h2 style={{ fontSize: 21, marginTop: 4 }}>{ticket.title}</h2>
          </div>
          <button className="btn-outline" onClick={onClose} style={{ flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Двухколоночная сетка */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 330px', gap: 22, alignItems: 'start' }}>
          {/* Левая колонка: описание, вложения, переписка */}
          <div style={{ minWidth: 0 }}>
            <div style={{ background: 'var(--surface-alt)', padding: 14, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Описание проблемы:</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{ticket.description}</div>
            </div>

            {/* Вложения */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>Прикрепленные файлы ({ticket.attachments?.length || 0})</strong>
                <label className="btn-outline" style={{ cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Paperclip size={14} /> Прикрепить файл
                  <input type="file" hidden onChange={handleFileUpload} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ticket.attachments?.map((att) => (
                  <a
                    key={att.attachment_id}
                    href={`${API_URL}/${att.file_path.replace(/^\/+/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="badge"
                    style={{ background: 'var(--nav-active-bg)', color: 'var(--primary)', border: '1px solid var(--nav-active-border)', textDecoration: 'none', padding: '5px 10px' }}
                  >
                    📎 {att.file_name}
                  </a>
                ))}
              </div>
            </div>

            {/* Чат / переписка */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
              <strong style={{ fontSize: 14 }}>Переписка по заявке</strong>
              <div style={{ maxHeight: 320, overflowY: 'auto', margin: '12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(!ticket.messages || ticket.messages.length === 0) && (
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>Сообщений пока нет</span>
                )}
                {ticket.messages?.map((m) => (
                  <div
                    key={m.message_id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: m.is_internal ? 'rgba(234, 179, 8, 0.16)' : 'var(--surface-alt)',
                      border: m.is_internal ? '1px solid rgba(234, 179, 8, 0.5)' : '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                      <strong>{m.sender?.full_name} {m.is_internal && '🔒 (Внутренняя заметка)'}</strong>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.message_text}</div>
                  </div>
                ))}
              </div>

              {!ticket.status.is_final && (
                <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <textarea
                    rows={3}
                    placeholder="Введите сообщение или описание выполненных работ..."
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      {(role === 'specialist' || role === 'dispatcher' || role === 'admin') && (
                        <>
                          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              style={{ width: 'auto' }}
                              checked={isInternal}
                              onChange={(e) => setIsInternal(e.target.checked)}
                            />
                            Внутренний комментарий
                          </label>
                          <select
                            style={{ flex: 1, minWidth: 160, maxWidth: 320, fontSize: 13 }}
                            value=""
                            onChange={(e) => insertFromKB(e.target.value)}
                          >
                            <option value="">+ Вставить из Базы Знаний</option>
                            {kbArticles.map((kb) => (
                              <option key={kb.kb_id} value={kb.kb_id}>{kb.title}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                    >
                      <Send size={14} /> Отправить
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Оценка качества */}
            {role === 'client' && (ticket.status.status_name === 'Решена' || ticket.status.status_name === 'Закрыта') && !ticket.rating && (
              <form onSubmit={handleRate} style={{ marginTop: 14, padding: 14, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <strong style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Star size={16} color="#16a34a" /> Оцените качество выполнения заявки
                </strong>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <select style={{ width: 120 }} value={score} onChange={(e) => setScore(Number(e.target.value))}>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                  </select>
                  <input placeholder="Комментарий к оценке (необязательно)" value={rateComment} onChange={(e) => setRateComment(e.target.value)} />
                  <button type="submit" className="btn-primary">Оценить</button>
                </div>
                {rateError && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{rateError}</div>}
              </form>
            )}

            {ticket.rating && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-alt)', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)' }}>
                <strong>Оценка клиента:</strong> {'★'.repeat(ticket.rating.score)} ({ticket.rating.score}/5) — {ticket.rating.comment || 'без комментария'}
              </div>
            )}
          </div>

          {/* Правая колонка: управление параметрами заявки и история */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Заявитель</span>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{ticket.client.full_name}</div>
              </div>

              <div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Дедлайн SLA</span>
                <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Clock size={14} /> {ticket.sla_deadline ? new Date(ticket.sla_deadline).toLocaleString() : 'Не задан'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Статус</span>
                {(role === 'specialist' || role === 'dispatcher' || role === 'admin') ? (
                  <select value={ticket.status.status_id} onChange={(e) => handleStatus(Number(e.target.value))}>
                    {statuses.map((s) => (
                      <option key={s.status_id} value={s.status_id}>{s.status_name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>{ticket.status.status_name}</div>
                )}

                {role === 'client' && ticket.status.status_name === 'Решена' && closedStatus && (
                  <button
                    className="btn-primary"
                    style={{ width: '100%', marginTop: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                    onClick={() => handleStatus(closedStatus.status_id)}
                  >
                    <CheckCircle size={15} /> Подтвердить и закрыть
                  </button>
                )}

                {role === 'dispatcher' && !ticket.status.is_final && rejectedStatus && (
                  <button
                    className="btn-danger"
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={() => handleStatus(rejectedStatus.status_id)}
                  >
                    Отклонить заявку
                  </button>
                )}

                {(ticket.status.status_name === 'Решена' || ticket.status.status_name === 'Закрыта') && (
                  <button
                    className="btn-outline"
                    style={{ width: '100%', marginTop: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                    onClick={handlePrintAct}
                  >
                    <Printer size={15} /> Акт выполненных работ
                  </button>
                )}
              </div>

              <div>
                <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Приоритет</span>
                {(role === 'dispatcher' || role === 'admin') ? (
                  <select value={ticket.priority.priority_id} onChange={(e) => handlePriority(Number(e.target.value))}>
                    {priorities.map((p) => (
                      <option key={p.priority_id} value={p.priority_id}>{p.priority_name}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{ticket.priority.priority_name}</div>
                )}
              </div>

              <div>
                <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Исполнитель</span>
                {(role === 'dispatcher' || role === 'admin') ? (
                  <select
                    value={ticket.specialist?.user_id || ''}
                    onChange={(e) => handleAssign(Number(e.target.value))}
                  >
                    <option value="" disabled>Не назначен</option>
                    {specialists.map((s) => (
                      <option key={s.user_id} value={s.user_id}>{s.full_name}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{ticket.specialist?.full_name || 'Ожидает назначения'}</div>
                )}
              </div>
            </div>

            {/* История статусов */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
              <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                <BookOpen size={14} /> История статусов
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                {ticket.history?.map((h) => (
                  <div key={h.history_id} style={{ borderLeft: '2px solid var(--primary)', paddingLeft: 8 }}>
                    <div style={{ fontWeight: 600 }}>
                      {h.old_status ? `${h.old_status.status_name} → ` : ''}{h.new_status.status_name}
                    </div>
                    <div style={{ color: 'var(--muted)' }}>{new Date(h.changed_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
