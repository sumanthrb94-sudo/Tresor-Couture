import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Phone, Send, Search, ArrowLeft, Circle, Check, PhoneCall, Mail } from 'lucide-react';
import { chatApi, callRequestsApi } from '../../lib/support';
import type { CallRequest, CallStatus, ChatConversation, ChatMessage } from '../../types';

type Tab = 'chat' | 'calls';

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const AdminSupport: React.FC = () => {
  const [tab, setTab] = useState<Tab>('chat');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);

  // Keep the inbox live so unread badges update even while the Calls tab is open.
  useEffect(() => {
    const unsub = chatApi.subscribeConversations(setConversations);
    return unsub;
  }, []);

  const unreadTotal = conversations.reduce((s, c) => s + (c.unreadForAdmin ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 flex items-center justify-between gap-3">
        <h1 className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)] inline-flex items-center gap-2"><MessageCircle className="w-5 h-5" /> Support</h1>
        <div className="flex gap-1 bg-[color:var(--color-myntra-bg-soft)] rounded-md p-1">
          {(['chat', 'calls'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-[12px] font-bold inline-flex items-center gap-1.5 ${tab === t ? 'bg-white text-[color:var(--color-myntra-pink)] shadow-sm' : 'text-[color:var(--color-myntra-ink-soft)]'}`}
            >
              {t === 'chat' ? <MessageCircle className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              {t === 'chat' ? 'Chat' : 'Callbacks'}
              {t === 'chat' && unreadTotal > 0 && (
                <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--color-myntra-pink)] text-white text-[10px] font-bold inline-flex items-center justify-center">{unreadTotal}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'chat' ? <ChatInbox conversations={conversations} /> : <CallQueue />}
    </div>
  );
};

/* ─────────── Chat inbox ─────────── */

const ChatInbox: React.FC<{ conversations: ChatConversation[] }> = ({ conversations }) => {
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(c => (c.customerName ?? '').toLowerCase().includes(q) || (c.customerEmail ?? '').toLowerCase().includes(q));
  }, [conversations, query]);

  const active = conversations.find(c => c.id === activeUid) ?? null;

  return (
    <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden grid grid-cols-1 md:grid-cols-[300px_1fr] h-[600px]">
      {/* List */}
      <div className={`border-r border-[color:var(--color-myntra-border-soft)] flex flex-col ${active ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-2.5 border-b border-[color:var(--color-myntra-border-soft)]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-myntra-ink-mute)]" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search conversations…" className="input-box pl-9 !py-2 text-[13px]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-[13px] text-[color:var(--color-myntra-ink-soft)]">No conversations yet.</p>
          ) : (
            filtered.map(c => {
              const unread = c.unreadForAdmin ?? 0;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveUid(c.id)}
                  className={`w-full text-left px-3 py-3 border-b border-[color:var(--color-myntra-border-soft)] hover:bg-[color:var(--color-myntra-bg-soft)] ${activeUid === c.id ? 'bg-[color:var(--color-myntra-bg-sale)]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-[color:var(--color-myntra-navy)] truncate">{c.customerName ?? 'Customer'}</span>
                    {unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--color-myntra-pink)] text-white text-[10px] font-bold inline-flex items-center justify-center shrink-0">{unread}</span>}
                  </div>
                  <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] truncate">{c.lastMessage ?? 'No messages yet'}</p>
                  <p className="text-[10px] text-[color:var(--color-myntra-ink-mute)] mt-0.5">{fmtTime(c.updatedAt)}{c.status === 'closed' ? ' · closed' : ''}</p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Thread */}
      <div className={`${active ? 'flex' : 'hidden md:flex'} flex-col min-h-0`}>
        {active ? (
          <ChatThread conversation={active} onBack={() => setActiveUid(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[color:var(--color-myntra-ink-soft)]">
            Select a conversation to reply.
          </div>
        )}
      </div>
    </div>
  );
};

const ChatThread: React.FC<{ conversation: ChatConversation; onBack: () => void }> = ({ conversation, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const uid = conversation.id;

  useEffect(() => {
    void chatApi.markRead(uid, 'admin');
    const unsub = chatApi.subscribeMessages(uid, msgs => {
      setMessages(msgs);
      void chatApi.markRead(uid, 'admin');
    });
    return unsub;
  }, [uid]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const send = async () => {
    const clean = text.trim();
    if (!clean) return;
    setText('');
    setSending(true);
    try {
      await chatApi.send(uid, clean, 'admin');
    } catch {
      setText(clean);
    } finally {
      setSending(false);
    }
  };

  const toggleClosed = () => void chatApi.setStatus(uid, conversation.status === 'closed' ? 'open' : 'closed');

  return (
    <>
      <div className="px-4 py-3 border-b border-[color:var(--color-myntra-border-soft)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="md:hidden p-1 -ml-1" aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[color:var(--color-myntra-navy)] truncate">{conversation.customerName ?? 'Customer'}</p>
            {conversation.customerEmail && <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] truncate inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {conversation.customerEmail}</p>}
          </div>
        </div>
        <button onClick={toggleClosed} className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-pink)] shrink-0">
          {conversation.status === 'closed' ? 'Reopen' : 'Close'}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 bg-[color:var(--color-myntra-bg-soft)]">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[78%] px-3 py-2 rounded-lg text-[13px] leading-snug whitespace-pre-wrap break-words ${
              m.senderRole === 'admin'
                ? 'bg-[color:var(--color-myntra-navy)] text-white rounded-br-none'
                : 'bg-white border border-[color:var(--color-myntra-border-soft)] text-[color:var(--color-myntra-ink)] rounded-bl-none'
            }`}>
              {m.text}
              <span className={`block text-[9px] mt-1 ${m.senderRole === 'admin' ? 'text-white/60' : 'text-[color:var(--color-myntra-ink-mute)]'}`}>{fmtTime(m.createdAt)}</span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={e => { e.preventDefault(); void send(); }} className="shrink-0 border-t border-[color:var(--color-myntra-border-soft)] p-2.5 flex items-center gap-2">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Type your reply…" className="input-box flex-1 !py-2" aria-label="Reply" />
        <button type="submit" disabled={sending || !text.trim()} className="w-10 h-10 shrink-0 rounded-full bg-[color:var(--color-myntra-navy)] text-white flex items-center justify-center disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </>
  );
};

/* ─────────── Callback queue ─────────── */

const CALL_META: Record<CallStatus, { label: string; bg: string; text: string }> = {
  new:       { label: 'New',       bg: '#E8F0FB', text: '#1E4FAE' },
  contacted: { label: 'Contacted', bg: '#E5EFDB', text: '#3F5A26' },
  closed:    { label: 'Closed',    bg: '#ECECEC', text: '#52525B' },
};

const CallQueue: React.FC = () => {
  const [rows, setRows] = useState<CallRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | CallStatus>('all');
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await callRequestsApi.all();
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter);

  const setStatus = async (r: CallRequest, status: CallStatus) => {
    setBusy(r.id);
    try {
      await callRequestsApi.setStatus(r.id, status);
      setReloadKey(k => k + 1);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md overflow-hidden">
      <div className="p-3 border-b border-[color:var(--color-myntra-border-soft)] flex gap-1">
        {(['all', 'new', 'contacted', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-[12px] font-bold capitalize ${filter === f ? 'bg-[color:var(--color-myntra-pink)] text-white' : 'text-[color:var(--color-myntra-ink-soft)] hover:bg-[color:var(--color-myntra-bg-soft)]'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-[14px] text-[color:var(--color-myntra-ink-soft)]">Loading callbacks…</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-[14px] text-[color:var(--color-myntra-ink-soft)]">No callback requests.</div>
      ) : (
        <ul className="divide-y divide-[color:var(--color-myntra-border-soft)]">
          {filtered.map(r => {
            const m = CALL_META[r.status];
            return (
              <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-[color:var(--color-myntra-navy)]">{r.name}</span>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: m.bg, color: m.text }}>{m.label}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1 text-[12px] text-[color:var(--color-myntra-ink-soft)]">
                    <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 font-semibold text-[color:var(--color-myntra-pink)]"><PhoneCall className="w-3.5 h-3.5" /> {r.phone}</a>
                    {r.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {r.email}</span>}
                    <span>{fmtTime(r.createdAt)}</span>
                  </div>
                  {(r.topic || r.preferredTime) && (
                    <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-1">
                      {r.topic && <span><span className="font-semibold text-[color:var(--color-myntra-ink)]">About:</span> {r.topic}</span>}
                      {r.topic && r.preferredTime && ' · '}
                      {r.preferredTime && <span><span className="font-semibold text-[color:var(--color-myntra-ink)]">When:</span> {r.preferredTime}</span>}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.status !== 'contacted' && (
                    <button onClick={() => void setStatus(r, 'contacted')} disabled={busy === r.id} className="btn-outline !py-1.5 !px-3 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-60"><Check className="w-3.5 h-3.5" /> Contacted</button>
                  )}
                  {r.status !== 'closed' && (
                    <button onClick={() => void setStatus(r, 'closed')} disabled={busy === r.id} className="text-[12px] font-bold text-[color:var(--color-myntra-ink-soft)] hover:text-[color:var(--color-myntra-pink)] disabled:opacity-60 inline-flex items-center gap-1"><Circle className="w-3.5 h-3.5" /> Close</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AdminSupport;
