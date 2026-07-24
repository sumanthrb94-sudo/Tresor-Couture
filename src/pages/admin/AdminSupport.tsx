import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, Search, ArrowLeft, Mail } from 'lucide-react';
import { chatApi } from '../../lib/support';
import type { ChatConversation, ChatMessage } from '../../types';

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const AdminSupport: React.FC = () => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);

  useEffect(() => {
    const unsub = chatApi.subscribeConversations(setConversations);
    return unsub;
  }, []);

  const unreadTotal = conversations.reduce((s, c) => s + (c.unreadForAdmin ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-4 flex items-center justify-between gap-3">
        <h1 className="text-[20px] font-extrabold text-[color:var(--color-myntra-navy)] inline-flex items-center gap-2"><MessageCircle className="w-5 h-5" /> Support</h1>
        {unreadTotal > 0 && (
          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[color:var(--color-myntra-pink)] text-white text-[11px] font-bold inline-flex items-center justify-center">
            {unreadTotal} unread
          </span>
        )}
      </div>

      <ChatInbox conversations={conversations} />
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

export default AdminSupport;
