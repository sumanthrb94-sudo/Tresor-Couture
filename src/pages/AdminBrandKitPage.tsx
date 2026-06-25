import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileDown,
  FileText,
  Loader2,
  LogOut,
  Maximize2,
  Palette,
  Type,
  Quote,
  Code,
} from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import {
  COLOR_TOKENS,
  KIT_SECTIONS,
  KitAsset,
  TYPOGRAPHY,
  VOICE_NOTES,
} from '../admin/kitManifest';
import { downloadKitAsPdf } from '../admin/exportKitPdf';
import { downloadKitAssetsZip, type ZipProgress } from '../admin/downloadKitZip';

/* ---- copy hook ---- */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(label);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 1500);
    });
  };
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  return { copied, copy };
}

/* ---- nav sections ---- */
const NAV = [
  { id: 'palette', label: 'Palette', icon: Palette },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'voice', label: 'Voice & Tone', icon: Quote },
  ...KIT_SECTIONS.map(s => ({ id: s.id, label: s.title, icon: ImageIconForSection(s.id) })),
  { id: 'developer', label: 'Developer', icon: Code },
];

function ImageIconForSection(_id: string): React.ComponentType<{ className?: string }> {
  // Use a single neutral icon for asset sections.
  return FileText;
}

/* ---- aspect classes ---- */
function aspectClass(a: KitAsset['aspect']): string {
  switch (a) {
    case 'square':    return 'aspect-square';
    case 'story':     return 'aspect-[9/16]';
    case 'wide':      return 'aspect-[3/1]';
    case 'tall':      return 'aspect-[3/4]';
    case 'pin':       return 'aspect-[2/3]';
    case 'pinterest': return 'aspect-[2/3]';
    case 'card':      return 'aspect-[16/10]';
    case 'a4':        return 'aspect-[1/1.414]';
    default:          return 'aspect-square';
  }
}

/* ---- asset card ---- */
const AssetCard: React.FC<{ asset: KitAsset; onPreview: (a: KitAsset) => void }> = ({ asset, onPreview }) => {
  const isImage = asset.kind === 'png' || asset.kind === 'jpg';
  const filename = asset.downloadAs ?? asset.url.split('/').pop() ?? 'asset';
  const { copy, copied } = useCopy();
  const absoluteUrl = typeof window !== 'undefined' ? new URL(asset.url, window.location.origin).toString() : asset.url;

  return (
    <div className="bg-[#FBF5EA] border border-[#B8893A]/25 hover:border-[#B8893A]/60 transition-colors group flex flex-col">
      <button
        onClick={() => onPreview(asset)}
        className={`relative ${aspectClass(asset.aspect)} bg-[#F5ECDC] overflow-hidden border-b border-[#B8893A]/15`}
        aria-label={`Preview ${asset.name}`}
      >
        {isImage ? (
          <img
            src={asset.url}
            alt={asset.name}
            loading="lazy"
            className={`w-full h-full ${asset.framing === 'cover' ? 'object-cover' : 'object-contain'} bg-[#F5ECDC]`}
          />
        ) : asset.kind === 'svg' ? (
          <object
            data={asset.url}
            type="image/svg+xml"
            aria-label={asset.name}
            className="w-full h-full pointer-events-none"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#8E6520]">
            <FileText className="w-10 h-10 mb-2" />
            <span className="text-[11px] uppercase tracking-[0.18em]">{asset.kind.toUpperCase()} file</span>
          </div>
        )}
        <span className="absolute top-2 right-2 bg-[#2A1F12]/85 text-[#F5ECDC] rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 className="w-3.5 h-3.5" />
        </span>
      </button>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-[14px] font-semibold text-[#2A1F12] leading-snug">{asset.name}</h3>
          <span className="shrink-0 text-[10px] tracking-[0.15em] uppercase text-[#8E6520] font-semibold mt-0.5">{asset.size}</span>
        </div>
        <p className="text-[12px] text-[#46382A] mb-4 flex-1">{asset.description}</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={asset.url}
            download={filename}
            className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.15em] uppercase font-semibold text-[#F5ECDC] bg-[#2A1F12] hover:bg-[#3a2a18] px-3 py-1.5 rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </a>
          <button
            onClick={() => copy('url-' + asset.id, absoluteUrl)}
            className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.15em] uppercase font-semibold text-[#8E6520] hover:text-[#2A1F12] border border-[#B8893A]/40 hover:border-[#B8893A] px-3 py-1.5 rounded"
            title="Copy public URL"
          >
            {copied === 'url-' + asset.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied === 'url-' + asset.id ? 'Copied' : 'URL'}
          </button>
          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.15em] uppercase font-semibold text-[#8E6520] hover:text-[#2A1F12] border border-[#B8893A]/40 hover:border-[#B8893A] px-3 py-1.5 rounded"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </a>
        </div>
      </div>
    </div>
  );
};

/* ---- preview lightbox ---- */
const PreviewModal: React.FC<{ asset: KitAsset | null; onClose: () => void }> = ({ asset, onClose }) => {
  useEffect(() => {
    if (!asset) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [asset, onClose]);

  if (!asset) return null;
  const isImage = asset.kind === 'png' || asset.kind === 'jpg';
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-10"
    >
      <div
        className="relative bg-[#F5ECDC] max-w-[1100px] max-h-[92vh] w-full overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-[#FBF5EA] border-b border-[#B8893A]/30 px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[14px] text-[#2A1F12]">{asset.name}</h3>
            <p className="text-[11px] text-[#8E6520]">{asset.size}</p>
          </div>
          <div className="flex gap-2">
            <a
              href={asset.url}
              download={asset.downloadAs ?? asset.url.split('/').pop()}
              className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.15em] uppercase font-semibold text-[#F5ECDC] bg-[#2A1F12] hover:bg-[#3a2a18] px-3 py-1.5 rounded"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>
            <button
              onClick={onClose}
              className="text-[11px] tracking-[0.15em] uppercase font-semibold text-[#8E6520] hover:text-[#2A1F12] border border-[#B8893A]/40 px-3 py-1.5 rounded"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-6 md:p-10 flex items-center justify-center min-h-[60vh] bg-[#F5ECDC]">
          {isImage ? (
            <img
              src={asset.url}
              alt={asset.name}
              className="max-w-full max-h-[78vh] object-contain"
            />
          ) : asset.kind === 'svg' ? (
            <object
              data={asset.url}
              type="image/svg+xml"
              aria-label={asset.name}
              className="w-full max-w-[900px] max-h-[78vh]"
            />
          ) : (
            <div className="text-[#2A1F12] text-center">
              <FileText className="w-12 h-12 mx-auto text-[#8E6520] mb-3" />
              <p className="font-mono text-[13px]">{asset.url}</p>
              <p className="text-[12px] text-[#46382A] mt-2">{asset.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---- main page ---- */
const AdminBrandKitPage: React.FC<{ section?: string }> = ({ section }) => {
  const { navigate } = useRouter();
  const [active, setActive] = useState<string>(section ?? 'palette');
  const [preview, setPreview] = useState<KitAsset | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [zip, setZip] = useState<ZipProgress | null>(null);
  const { copy, copied } = useCopy();

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    try {
      await downloadKitAsPdf();
    } catch {
      window.alert('Could not open the PDF export. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDownloadZip = async () => {
    if (zip && zip.done < zip.total) return; // already running
    setZip({ done: 0, total: 0, failed: 0 });
    try {
      const result = await downloadKitAssetsZip(setZip);
      if (result.failed > 0) {
        window.alert(`Downloaded ${result.total - result.failed}/${result.total} assets — ${result.failed} could not be fetched.`);
      }
    } catch {
      window.alert('Could not build the ZIP. Please try again.');
    } finally {
      setZip(null);
    }
  };

  const zipBusy = zip !== null;

  // observe sections to update the sidebar
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0.15, 0.5, 0.8] }
    );
    (Object.values(sectionRefs.current) as (HTMLDivElement | null)[]).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    setActive(id);
    const el = sectionRefs.current[id];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    navigate({ name: 'admin-brand-kit', section: id });
  };

  const initialJump = useRef(false);
  useEffect(() => {
    if (initialJump.current) return;
    if (section) {
      initialJump.current = true;
      window.setTimeout(() => scrollTo(section), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const setRef = (id: string) => (el: HTMLDivElement | null) => {
    sectionRefs.current[id] = el;
  };

  const totalAssets = useMemo(() => KIT_SECTIONS.reduce((s, x) => s + x.assets.length, 0), []);

  return (
    <main className="min-h-screen bg-[#F5ECDC]">
      {/* Header bar */}
      <div className="bg-[#2A1F12] text-[#F5ECDC]">
        <div className="max-w-[1320px] mx-auto px-5 md:px-10 py-5 md:py-7 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate({ name: 'admin' })}
              className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.18em] uppercase font-semibold text-[#D8B97A] hover:text-[#F5ECDC]"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Admin
            </button>
            <div className="h-5 w-px bg-[#D8B97A]/40" />
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#D8B97A] mb-0.5">The Atelier · Admin</p>
              <h1 className="font-[Cormorant_Garamond,serif] text-[26px] md:text-[32px] leading-none">Brand Identity Kit</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-[11px] text-[#D8B97A]">
              {totalAssets} assets · regen via <code className="font-mono">python3 branding/generate.py</code>
            </span>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
              title="Build a brand-book PDF — choose “Save as PDF” in the print dialog"
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-[#2A1F12] bg-[#D8B97A] hover:bg-[#e6cb95] disabled:opacity-60 px-3 py-1.5 rounded transition-colors"
            >
              {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              {pdfBusy ? 'Preparing…' : 'Download PDF'}
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={zipBusy}
              title="Download every brand asset as a single ZIP"
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-[#2A1F12] bg-[#D8B97A] hover:bg-[#e6cb95] disabled:opacity-60 px-3 py-1.5 rounded transition-colors"
            >
              {zipBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileArchive className="w-3.5 h-3.5" />}
              {zipBusy ? (zip && zip.total ? `Zipping ${zip.done}/${zip.total}…` : 'Zipping…') : 'Download all (ZIP)'}
            </button>
            <button
              onClick={() => navigate({ name: 'home' })}
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-[#D8B97A] hover:text-[#F5ECDC] border border-[#D8B97A]/40 hover:border-[#D8B97A] px-3 py-1.5 rounded"
            >
              <LogOut className="w-3.5 h-3.5" /> Exit to store
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-5 md:px-10 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 md:gap-12 py-8 md:py-12">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[120px]">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#8E6520] font-semibold mb-3">Contents</p>
            <nav className="space-y-1">
              {NAV.map(n => {
                const Icon = n.icon;
                const isActive = active === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => scrollTo(n.id)}
                    className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded text-[13px] transition-colors ${
                      isActive
                        ? 'bg-[#2A1F12] text-[#F5ECDC]'
                        : 'text-[#46382A] hover:bg-[#FBF5EA] hover:text-[#2A1F12]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    {n.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile chip nav */}
        <div className="lg:hidden -mx-5 px-5 overflow-x-auto scrollbar-none">
          <div className="flex gap-2 pb-4">
            {NAV.map(n => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className={`shrink-0 px-3 py-1.5 text-[12px] font-semibold rounded-full whitespace-nowrap ${
                  active === n.id
                    ? 'bg-[#2A1F12] text-[#F5ECDC]'
                    : 'bg-[#FBF5EA] text-[#46382A] border border-[#B8893A]/30'
                }`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0">
          {/* Intro */}
          <section className="mb-12 md:mb-16">
            <p className="text-[11px] tracking-[0.25em] uppercase text-[#8E6520] font-semibold mb-3">The single source of truth</p>
            <h2 className="font-[Cormorant_Garamond,serif] text-[40px] md:text-[56px] text-[#2A1F12] leading-[1.05] mb-4">
              Everything the brand <em>looks</em> like.
            </h2>
            <p className="text-[15px] text-[#46382A] max-w-[640px] leading-relaxed">
              Every logo variant, favicon size, social-media tile, print template and tone-of-voice
              note for Tresor Couture lives here. Click any asset to preview, download, or copy its
              public URL. Edits to <code className="font-mono text-[13px]">branding/generate.py</code>{' '}
              regenerate every raster in one command.
            </p>
          </section>

          {/* Palette */}
          <section ref={setRef('palette')} id="palette" className="mb-14 scroll-mt-32">
            <SectionHeading eyebrow="01" title="Palette" subtitle="Tap a swatch to copy its hex." />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {COLOR_TOKENS.map(t => (
                <div key={t.name} className="bg-[#FBF5EA] border border-[#B8893A]/25 overflow-hidden">
                  <button
                    onClick={() => copy('hex-' + t.name, t.hex)}
                    className="w-full block aspect-[4/3] relative group"
                    style={{ backgroundColor: t.hex }}
                    title={`Copy ${t.hex}`}
                  >
                    <span className="absolute bottom-2 right-2 bg-[#2A1F12]/85 text-[#F5ECDC] text-[10px] tracking-[0.15em] uppercase px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
                      {copied === 'hex-' + t.name ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === 'hex-' + t.name ? 'Copied' : t.hex}
                    </span>
                  </button>
                  <div className="p-3.5">
                    <p className="font-mono text-[12px] text-[#2A1F12] font-semibold">{t.name}</p>
                    <p className="font-mono text-[11px] text-[#8E6520] mt-0.5">{t.hex}</p>
                    <p className="text-[11.5px] text-[#46382A] mt-1.5 leading-snug">{t.role}</p>
                    <code className="text-[10px] text-[#8E6520] mt-2 inline-block">{t.css}</code>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Typography */}
          <section ref={setRef('typography')} id="typography" className="mb-14 scroll-mt-32">
            <SectionHeading eyebrow="02" title="Typography" subtitle="Serif headlines, sans for everything else." />
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-[#FBF5EA] border border-[#B8893A]/25 p-6 md:p-8">
                <p className="text-[10px] tracking-[0.25em] uppercase text-[#8E6520] mb-2 font-semibold">Serif · Cormorant Garamond</p>
                <p className="font-[Cormorant_Garamond,serif] text-[#2A1F12] text-[64px] leading-none mb-1">Aa</p>
                <p className="font-[Cormorant_Garamond,serif] italic text-[#2A1F12] text-[28px] leading-tight mb-3">The weaves return home.</p>
                <p className="text-[12px] text-[#46382A] leading-relaxed">{TYPOGRAPHY.serif.use}</p>
                <p className="text-[11px] font-mono text-[#8E6520] mt-3">Weights: {TYPOGRAPHY.serif.weights}</p>
                <button
                  onClick={() => copy('font-serif', TYPOGRAPHY.serif.family)}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] font-semibold text-[#8E6520] hover:text-[#2A1F12] border border-[#B8893A]/40 px-3 py-1.5 rounded"
                >
                  {copied === 'font-serif' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === 'font-serif' ? 'Copied' : 'font-family'}
                </button>
              </div>
              <div className="bg-[#FBF5EA] border border-[#B8893A]/25 p-6 md:p-8">
                <p className="text-[10px] tracking-[0.25em] uppercase text-[#8E6520] mb-2 font-semibold">Sans · Inter</p>
                <p className="font-sans text-[#2A1F12] text-[64px] leading-none mb-1 font-bold">Aa</p>
                <p className="font-sans text-[#2A1F12] text-[16px] uppercase tracking-[0.2em] mb-3">THE ATELIER NOTE</p>
                <p className="text-[12px] text-[#46382A] leading-relaxed">{TYPOGRAPHY.sans.use}</p>
                <p className="text-[11px] font-mono text-[#8E6520] mt-3">Weights: {TYPOGRAPHY.sans.weights}</p>
                <button
                  onClick={() => copy('font-sans', TYPOGRAPHY.sans.family)}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] font-semibold text-[#8E6520] hover:text-[#2A1F12] border border-[#B8893A]/40 px-3 py-1.5 rounded"
                >
                  {copied === 'font-sans' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === 'font-sans' ? 'Copied' : 'font-family'}
                </button>
              </div>
            </div>
          </section>

          {/* Voice */}
          <section ref={setRef('voice')} id="voice" className="mb-14 scroll-mt-32">
            <SectionHeading eyebrow="03" title="Voice & Tone" subtitle="How the brand speaks. Five rules — break sparingly." />
            <ol className="space-y-3">
              {VOICE_NOTES.map((note, i) => (
                <li key={i} className="bg-[#FBF5EA] border border-[#B8893A]/25 px-5 py-4 flex gap-4">
                  <span className="font-[Cormorant_Garamond,serif] text-[#B8893A] text-[28px] leading-none w-10 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <p className="text-[14px] text-[#2A1F12] leading-relaxed">{note}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Asset sections */}
          {KIT_SECTIONS.map((s, idx) => (
            <section
              key={s.id}
              ref={setRef(s.id)}
              id={s.id}
              className="mb-14 scroll-mt-32"
            >
              <SectionHeading
                eyebrow={String(idx + 4).padStart(2, '0')}
                title={s.title}
                subtitle={s.blurb}
              />
              <div className={`grid gap-5 ${
                s.id === 'favicons'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                  : s.assets.some(a => a.aspect === 'story' || a.aspect === 'pin')
                    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
              }`}>
                {s.assets.map(a => (
                  <AssetCard key={a.id} asset={a} onPreview={setPreview} />
                ))}
              </div>
            </section>
          ))}

          {/* Developer */}
          <section ref={setRef('developer')} id="developer" className="mb-12 scroll-mt-32">
            <SectionHeading eyebrow={String(4 + KIT_SECTIONS.length).padStart(2, '0')} title="Developer notes" subtitle="How to regenerate, where things live, who to ping." />
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-[#FBF5EA] border border-[#B8893A]/25 p-6">
                <h4 className="font-[Cormorant_Garamond,serif] text-[24px] text-[#2A1F12] mb-2">Regenerate the kit</h4>
                <p className="text-[13px] text-[#46382A] mb-3">
                  Edit colour or copy in <code className="font-mono text-[12px]">branding/generate.py</code> and run:
                </p>
                <pre className="bg-[#2A1F12] text-[#D8B97A] text-[12.5px] font-mono px-4 py-3 overflow-x-auto rounded">python3 branding/generate.py</pre>
                <p className="text-[12px] text-[#46382A] mt-3">
                  Outputs land in <code className="font-mono">branding/favicons/</code> + <code className="font-mono">branding/social/</code> and are mirrored into <code className="font-mono">public/branding/</code> so the site picks them up immediately.
                </p>
              </div>
              <div className="bg-[#FBF5EA] border border-[#B8893A]/25 p-6">
                <h4 className="font-[Cormorant_Garamond,serif] text-[24px] text-[#2A1F12] mb-2">Reference</h4>
                <ul className="text-[13px] text-[#46382A] space-y-1.5">
                  <li>· <code className="font-mono">branding/BRAND.md</code> — narrative guidelines</li>
                  <li>· <code className="font-mono">branding/KIT-INDEX.md</code> — file catalog</li>
                  <li>· <code className="font-mono">branding/palette.json</code> — colour tokens</li>
                  <li>· <code className="font-mono">branding/_fonts/</code> — Cormorant + Inter TTFs</li>
                </ul>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => copy('cmd', 'python3 branding/generate.py')}
                    className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] font-semibold text-[#8E6520] hover:text-[#2A1F12] border border-[#B8893A]/40 px-3 py-1.5 rounded"
                  >
                    {copied === 'cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === 'cmd' ? 'Copied' : 'Copy command'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <PreviewModal asset={preview} onClose={() => setPreview(null)} />
    </main>
  );
};

const SectionHeading: React.FC<{ eyebrow: string; title: string; subtitle?: string }> = ({ eyebrow, title, subtitle }) => (
  <div className="mb-6">
    <p className="font-mono text-[11px] tracking-[0.3em] text-[#8E6520] mb-2">{eyebrow}</p>
    <h3 className="font-[Cormorant_Garamond,serif] text-[32px] md:text-[40px] text-[#2A1F12] leading-tight">{title}</h3>
    {subtitle && <p className="text-[14px] text-[#46382A] mt-2 max-w-[640px] leading-relaxed">{subtitle}</p>}
  </div>
);

export default AdminBrandKitPage;
