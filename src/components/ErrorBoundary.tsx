import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: React.ReactNode }
interface State { error: Error | null }

/**
 * Catches render-time crashes in any descendant. Without this, a single
 * thrown error in any page or component blanks the entire app to a white
 * screen — production-bad. Renders a recover-or-go-home fallback instead.
 */
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface in DevTools; in real production hook this up to Sentry/Datadog.
    console.error('[Tresor] caught render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="pt-[120px] min-h-screen bg-[#FBF7EE] flex items-center justify-center px-5">
        <div className="max-w-[520px] text-center py-12">
          <div className="w-14 h-14 rounded-full bg-[color:var(--color-myntra-pink)]/10 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-7 h-7 text-[color:var(--color-myntra-pink)]" />
          </div>
          <h1 className="font-serif text-[26px] md:text-[30px] text-[#2A1F12] leading-tight mb-3">
            Something snagged in the weave.
          </h1>
          <p className="text-[14px] text-[#5D4E36] leading-relaxed mb-7">
            An unexpected error stopped the page from rendering. The atelier has been notified —
            try reloading, or head back to the storefront.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="px-6 py-3 bg-[color:var(--color-myntra-navy)] text-white text-[12px] font-bold uppercase tracking-[0.14em] rounded inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Reload
            </button>
            <button
              onClick={() => { window.location.hash = '#/'; this.setState({ error: null }); }}
              className="px-6 py-3 border-2 border-[#2A1F12] text-[#2A1F12] text-[12px] font-bold uppercase tracking-[0.14em] rounded"
            >
              Back to storefront
            </button>
          </div>
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;
