import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Phone, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { chatApi } from '../lib/support';
import type { ChatConversation, ChatMessage } from '../types';

// Single source of truth for the atelier's contact channels (mirrors the footer).
const SUPPORT_PHONE_DISPLAY = '+91 63042 11922';
const SUPPORT_PHONE_TEL = '+916304211922';
const SUPPORT_WA = '916304211922';

type Tab = 'chat' | 'call';

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5s-.7-1.6-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 5 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.6-.4M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2" />
  </svg>
);

const SupportWidget: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('chat');

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with us"
          className="fixed z-[115] bottom-[72px] right-4 lg:bottom-6 lg:right-6 w-14 h-14 rounded-full bg-[color:var(--color-myntra-pink)] text-white shadow-lg flex items-center justify-center hover:bg-[color:var(--color-myntra-pink-dark)] transition-colors"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed z-[145] bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[380px] h-[70vh] sm:h-[560px] max-h-screen bg-white sm:rounded-lg shadow-2xl border border-[color:var(--color-myntra-border-soft)] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[color:var(--color-myntra-navy)] text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <p className="text-[13px] font-extrabold leading-tight">Tresor Couture concierge</p>
              <p className="text-[11px] text-white/70">We usually reply within a few hours</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-[color:var(--color-myntra-border-soft)] shrink-0">
            {(['chat', 'call'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-2.5 text-[12px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 ${
                  tab === t ? 'text-[color:var(--color-myntra-pink)] border-b-2 border-[color:var(--color-myntra-pink)]' : 'text-[color:var(--color-myntra-ink-soft)]'
                }`}
              >
                {t === 'chat' ? <MessageCircle className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                {t === 'chat' ? 'Chat' : 'Call'}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            {tab === 'chat'
              ? (user ? <ChatPanel /> : <SignInPrompt onSignIn={() => { setOpen(false); navigate({ name: 'login' }); }} />)
              : <CallPanel />}
          </div>
        </div>
      )}
    </>
  );
};

/* ─────────── Chat (signed-in) ─────────── */

const ChatPanel: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const chatIdRef = useRef<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const id = await chatApi.ensureMine();
        if (cancelled) return;
        chatIdRef.current = id;
        await chatApi.markRead(id, 'customer');
        unsub = chatApi.subscribeMessages(id, msgs => {
          setMessages(msgs);
          setReady(true);
          // Anything the admin sent is now seen.
          void chatApi.markRead(id, 'customer');
        });
      } catch {
        setReady(true);
      }
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
  }, [user?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async () => {
    const clean = text.trim();
    if (!clean || !chatIdRef.current) return;
    setText('');
    setSending(true);
    try {
      await chatApi.send(chatIdRef.current, clean, 'customer');
    } catch {
      setText(clean); // restore on failure
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 bg-[color:var(--color-myntra-bg-soft)]">
        {!ready ? (
          <div className="h-full flex items-center justify-center">
            <span className="w-6 h-6 border-2 border-[color:var(--color-myntra-pink)] border-t-transparent rounded-full animate-spin" aria-label="Loading" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center pt-8 px-4">
            <MessageCircle className="w-9 h-9 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-3" />
            <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
              Ask us anything — order help, sizing, fabric advice, or a return. We're here.
            </p>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.senderRole === 'customer' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg text-[13px] leading-snug whitespace-pre-wrap break-words ${
                  m.senderRole === 'customer'
                    ? 'bg-[color:var(--color-myntra-pink)] text-white rounded-br-none'
                    : 'bg-white border border-[color:var(--color-myntra-border-soft)] text-[color:var(--color-myntra-ink)] rounded-bl-none'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={e => { e.preventDefault(); void send(); }}
        className="shrink-0 border-t border-[color:var(--color-myntra-border-soft)] p-2.5 flex items-center gap-2"
      >
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message…"
          className="input-box flex-1 !py-2"
          aria-label="Message"
        />
        <button type="submit" disabled={sending || !text.trim()} className="w-10 h-10 shrink-0 rounded-full bg-[color:var(--color-myntra-pink)] text-white flex items-center justify-center disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </>
  );
};

const SignInPrompt: React.FC<{ onSignIn: () => void }> = ({ onSignIn }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
    <MessageCircle className="w-10 h-10 text-[color:var(--color-myntra-ink-mute)]" />
    <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
      Sign in to chat with the atelier and keep your conversation in one place.
    </p>
    <button onClick={onSignIn} className="btn-primary">Sign in</button>
    <div className="flex items-center gap-3 pt-2">
      <a href={`https://wa.me/${SUPPORT_WA}`} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-[color:var(--color-myntra-green)] inline-flex items-center gap-1.5">
        <WhatsAppIcon className="w-4 h-4" /> WhatsApp
      </a>
      <a href={`tel:${SUPPORT_PHONE_TEL}`} className="text-[12px] font-bold text-[color:var(--color-myntra-pink)] inline-flex items-center gap-1.5">
        <Phone className="w-4 h-4" /> Call
      </a>
    </div>
  </div>
);

/* ─────────── Call ─────────── */

// Just the direct channels: tapping "Call" opens the phone's native dialer with
// our number (a real cellular call, logged in the phone's own call history — no
// app or extra software). WhatsApp is offered as a secondary channel.
const CallPanel: React.FC = () => (
  <div className="flex-1 overflow-y-auto p-4 space-y-3">
    <a
      href={`tel:${SUPPORT_PHONE_TEL}`}
      className="flex items-center gap-3 border border-[color:var(--color-myntra-border-soft)] rounded p-4 hover:border-[color:var(--color-myntra-pink)]"
    >
      <span className="w-11 h-11 rounded-full bg-[color:var(--color-myntra-bg-sale)] text-[color:var(--color-myntra-pink)] flex items-center justify-center shrink-0"><Phone className="w-5 h-5" /></span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold text-[color:var(--color-myntra-navy)]">Call the atelier</span>
        <span className="block text-[13px] text-[color:var(--color-myntra-ink-soft)]">{SUPPORT_PHONE_DISPLAY}</span>
      </span>
    </a>
    <a
      href={`https://wa.me/${SUPPORT_WA}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 border border-[color:var(--color-myntra-border-soft)] rounded p-4 hover:border-[color:var(--color-myntra-green)]"
    >
      <span className="w-11 h-11 rounded-full bg-[#E7F7EC] text-[color:var(--color-myntra-green)] flex items-center justify-center shrink-0"><WhatsAppIcon className="w-5 h-5" /></span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold text-[color:var(--color-myntra-navy)]">WhatsApp us</span>
        <span className="block text-[13px] text-[color:var(--color-myntra-ink-soft)]">Quick replies, share photos</span>
      </span>
    </a>
    <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] text-center pt-1">
      Tapping call opens your phone dialer with our number.
    </p>
  </div>
);

export default SupportWidget;
