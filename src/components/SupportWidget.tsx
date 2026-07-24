import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Phone, Send, PhoneCall, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { chatApi, callRequestsApi } from '../lib/support';
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
              : <CallPanel signedIn={!!user} onSignIn={() => { setOpen(false); navigate({ name: 'login' }); }} />}
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

/* ─────────── Call / callback ─────────── */

const CallPanel: React.FC<{ signedIn: boolean; onSignIn: () => void }> = ({ signedIn, onSignIn }) => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [topic, setTopic] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError('Please enter your name.'); return; }
    if (phone.trim().length < 6) { setError('Please enter a valid phone number.'); return; }
    setState('busy');
    try {
      await callRequestsApi.create({ name: name.trim(), phone: phone.trim(), topic: topic.trim() || undefined, preferredTime: preferredTime.trim() || undefined });
      setState('done');
    } catch {
      setState('error');
      setError('Could not submit. Please try again or call us directly.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Direct channels — always available */}
      <div className="space-y-2">
        <a href={`tel:${SUPPORT_PHONE_TEL}`} className="flex items-center gap-3 border border-[color:var(--color-myntra-border-soft)] rounded p-3 hover:border-[color:var(--color-myntra-pink)]">
          <span className="w-9 h-9 rounded-full bg-[color:var(--color-myntra-bg-sale)] text-[color:var(--color-myntra-pink)] flex items-center justify-center shrink-0"><Phone className="w-4 h-4" /></span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-[color:var(--color-myntra-navy)]">Call the atelier</span>
            <span className="block text-[12px] text-[color:var(--color-myntra-ink-soft)]">{SUPPORT_PHONE_DISPLAY}</span>
          </span>
        </a>
        <a href={`https://wa.me/${SUPPORT_WA}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 border border-[color:var(--color-myntra-border-soft)] rounded p-3 hover:border-[color:var(--color-myntra-green)]">
          <span className="w-9 h-9 rounded-full bg-[#E7F7EC] text-[color:var(--color-myntra-green)] flex items-center justify-center shrink-0"><WhatsAppIcon className="w-4 h-4" /></span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-[color:var(--color-myntra-navy)]">WhatsApp us</span>
            <span className="block text-[12px] text-[color:var(--color-myntra-ink-soft)]">Quick replies, share photos</span>
          </span>
        </a>
      </div>

      <div className="relative text-center">
        <span className="relative bg-white px-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-mute)]">or request a callback</span>
        <div className="absolute inset-x-0 top-1/2 border-t border-[color:var(--color-myntra-border-soft)] -z-0" />
      </div>

      {!signedIn ? (
        <div className="text-center px-2">
          <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-3">Sign in to request a callback and we'll ring you back.</p>
          <button onClick={onSignIn} className="btn-outline">Sign in</button>
        </div>
      ) : state === 'done' ? (
        <div className="text-center py-4">
          <span className="w-11 h-11 mx-auto mb-3 rounded-full bg-[#E7F7EC] text-[color:var(--color-myntra-green)] flex items-center justify-center"><Check className="w-6 h-6" strokeWidth={3} /></span>
          <p className="text-[14px] font-bold text-[color:var(--color-myntra-navy)]">Callback requested</p>
          <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-1">Our team will call you back shortly.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-2.5" noValidate>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="input-box !py-2" aria-label="Your name" />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="input-box !py-2" aria-label="Phone number" type="tel" />
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="What's it about? (optional)" className="input-box !py-2" aria-label="Topic" />
          <input value={preferredTime} onChange={e => setPreferredTime(e.target.value)} placeholder="Preferred time, e.g. today evening (optional)" className="input-box !py-2" aria-label="Preferred time" />
          {error && <p role="alert" className="text-[12px] font-semibold text-[color:var(--color-myntra-pink)]">{error}</p>}
          <button type="submit" disabled={state === 'busy'} className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-60">
            <PhoneCall className="w-4 h-4" /> {state === 'busy' ? 'Requesting…' : 'Request callback'}
          </button>
        </form>
      )}
    </div>
  );
};

export default SupportWidget;
