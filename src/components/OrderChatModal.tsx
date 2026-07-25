import React, { useEffect, useRef, useState } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { chatApi } from '../lib/support';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import type { ChatMessage } from '../types';

interface Props {
  orderId: string;
  /** Short human label for the order, e.g. TC-1A2B3C4D. */
  orderLabel: string;
  onClose: () => void;
}

/**
 * Per-order support chat. Opened from an order in the customer's account, so the
 * atelier always sees which order the conversation is about. Real-time via the
 * chat conversation keyed by orderId.
 */
const OrderChatModal: React.FC<Props> = ({ orderId, orderLabel, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useBodyScrollLock();

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        await chatApi.ensureForOrder(orderId);
        if (cancelled) return;
        await chatApi.markRead(orderId, 'customer');
        unsub = chatApi.subscribeMessages(orderId, msgs => {
          setMessages(msgs);
          setReady(true);
          void chatApi.markRead(orderId, 'customer');
        });
      } catch {
        setReady(true);
      }
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
  }, [orderId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const send = async () => {
    const clean = text.trim();
    if (!clean) return;
    setText('');
    setSending(true);
    try {
      // Idempotent — guarantees the conversation doc exists before the first
      // message, even if the user sends before the initial ensure resolves.
      await chatApi.ensureForOrder(orderId);
      await chatApi.send(orderId, clean, 'customer');
    } catch {
      setText(clean); // restore on failure / throttle
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center sm:px-4"
      style={{ backgroundColor: 'rgba(20,16,24,0.6)' }}
      onClick={() => !sending && onClose()}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md h-[80vh] sm:h-[560px] sm:rounded-lg shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[color:var(--color-myntra-navy)] text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[13px] font-extrabold leading-tight">Chat about your order</p>
            <p className="text-[11px] text-white/70">{orderLabel}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 bg-[color:var(--color-myntra-bg-soft)]">
          {!ready ? (
            <div className="h-full flex items-center justify-center">
              <span className="w-6 h-6 border-2 border-[color:var(--color-myntra-pink)] border-t-transparent rounded-full animate-spin" aria-label="Loading" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center pt-8 px-4">
              <MessageCircle className="w-9 h-9 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-3" />
              <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">
                Ask us anything about this order — delivery, changes, returns. We'll reply here.
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

        {/* Composer */}
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
          <button
            type="submit"
            disabled={sending || !text.trim()}
            aria-label={sending ? 'Sending…' : 'Send message'}
            aria-busy={sending}
            className="w-10 h-10 shrink-0 rounded-full bg-[color:var(--color-myntra-pink)] text-white flex items-center justify-center disabled:opacity-50"
          >
            {/* Spinner while in flight — the send path is throttled, so without
                this the button just looks unresponsive for a moment. */}
            {sending
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OrderChatModal;
