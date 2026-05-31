import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, Calendar, Phone, Send,
  Sparkles, Ruler, Scissors, MessageSquare, Quote, Star
} from 'lucide-react';
import { FABRICS, formatINR } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import type { Fabric, MasterCategory } from '../types';

/* ---------- Atelier model ---------------------------------------------- */

interface Silhouette {
  id: string;
  name: string;
  blurb: string;          // editorial one-liner — the "designer note"
  basePrice: number;
  /** Display chip on the card. Free-form because couture silhouettes don't always map to shop master categories. */
  family: string;
  /** Master category used to filter eligible fabrics in the customisation flow. Falls back to 'Fabrics'. */
  fabricCategory?: MasterCategory;
  fabricHint: string[];   // fabric ids the studio recommends with this silhouette
  photoFabricId?: string; // pull the lookbook image from this fabric's photo
}

interface Capsule {
  id: string;
  name: string;
  tagline: string;        // 4-6 words, all-caps editorial
  story: string;          // 1-2 sentence collection narrative
  palette: string[];      // 3-4 hexes for the moodboard swatch row
  signaturePieces: Silhouette[];
  designerNote: string;
  fabricPhotoId: string;  // hero imagery source
}

const findFabric = (id: string): Fabric | undefined => FABRICS.find(f => f.id === id);

/* Curated capsules. Each is an ultra-exclusive customisable line. */
const CAPSULES: Capsule[] = [
  {
    id: 'mughal-garden',
    name: 'The Mughal Garden',
    tagline: 'EMERALD · ZARI · INDIGO',
    story:
      'Inspired by the chahar-bagh of the Red Fort — moonlit jasmine, cypress and pomegranate motifs hand-drawn onto Banarasi silk and Mashru satin.',
    designerNote:
      'I keep returning to my grandmother\'s emerald lehenga — that shade of jewel-green and the way zari catches lamp-light. This capsule lives there.',
    palette: ['#1F5D4F', '#9B1B30', '#C5A059', '#2A3F66'],
    fabricPhotoId: '2',
    signaturePieces: [
      {
        id: 'mg-lehenga',
        name: 'Chahar-Bagh Bridal Lehenga',
        blurb: 'A hand-woven Banarasi kalidar with twelve floor-skimming panels and a fully embroidered choli.',
        basePrice: 285000,
        family: 'Bridal Lehenga',
        fabricCategory: 'Lehenga Cholis',
        fabricHint: ['2', '7'],
        photoFabricId: '2'
      },
      {
        id: 'mg-saree',
        name: 'Anar-Bel Saree',
        blurb: 'Pomegranate-vine zari border on emerald georgette, pleated by the studio\'s senior tailor.',
        basePrice: 78000,
        family: 'Bespoke Saree',
        fabricCategory: 'Sarees',
        fabricHint: ['2', '5'],
        photoFabricId: '5'
      },
      {
        id: 'mg-gown',
        name: 'Jasmine-Trellis Couture Gown',
        blurb: 'A sweep-train gown in midnight Mashru with hand-stitched silver jasmine across the bodice.',
        basePrice: 365000,
        family: 'Couture Gown',
        fabricHint: ['1', '2'],
        photoFabricId: '1'
      }
    ]
  },
  {
    id: 'banaras-after-dark',
    name: 'Banaras After Dark',
    tagline: 'OBSIDIAN · GOLD · SMOKE',
    story:
      'The Ganges at the hour the aarti ends. Onyx Banarasi laced with real-zari thread, designed for the after-party of a bride who already wore red.',
    designerNote:
      'I drew this capsule on the ghats at midnight — only the temple bells and the silk-loom shuttles still working. Black-and-gold needed to feel reverent.',
    palette: ['#101010', '#C5A059', '#7A1F2C', '#3A3A3A'],
    fabricPhotoId: '2',
    signaturePieces: [
      {
        id: 'bad-anarkali',
        name: 'Aarti Floor-length Anarkali',
        blurb: 'Black Banarasi flare with a constellation of hand-set sequin embroidery.',
        basePrice: 95000,
        family: 'Anarkali',
        fabricCategory: 'Anarkalis',
        fabricHint: ['2', '6'],
        photoFabricId: '6'
      },
      {
        id: 'bad-cape',
        name: 'Ghat-Lamp Cape Gown',
        blurb: 'Floor-length gown with a detachable Banarasi cape — the cape is convertible into a dupatta.',
        basePrice: 245000,
        family: 'Couture Gown',
        fabricHint: ['2', '3'],
        photoFabricId: '3'
      },
      {
        id: 'bad-saree',
        name: 'Obsidian Half-Saree',
        blurb: 'Six-yard half-saree drape with a separate embroidered blouse and skirt — black silk, gold zari border.',
        basePrice: 86000,
        family: 'Bespoke Saree',
        fabricCategory: 'Sarees',
        fabricHint: ['2', '5'],
        photoFabricId: '2'
      }
    ]
  },
  {
    id: 'indigo-atelier',
    name: 'Indigo Atelier',
    tagline: 'BLOCK · DYE · LINE',
    story:
      'Hand-blocked indigo from Bagru, paired with raw silk and dyeable cotton mulmul. A modern capsule for the woman who wears couture to a museum opening.',
    designerNote:
      'Indigo is a slow colour — it asks the wearer to slow down too. I sketched these as everyday couture: silhouettes you can throw on with kolhapuris.',
    palette: ['#1E3A8A', '#EDE7DA', '#9B7A4D', '#B5B8B1'],
    fabricPhotoId: '4',
    signaturePieces: [
      {
        id: 'ia-dress',
        name: 'Atelier Slip Dress',
        blurb: 'A bias-cut slip dress in dyeable mulberry silk, finished with a hand-stitched indigo border.',
        basePrice: 42000,
        family: 'East-West',
        fabricCategory: 'Western Wear',
        fabricHint: ['4', '5'],
        photoFabricId: '4'
      },
      {
        id: 'ia-anarkali',
        name: 'Studio Anarkali',
        blurb: 'A knee-length anarkali in raw silk with a single block-printed indigo medallion at the hem.',
        basePrice: 38000,
        family: 'Anarkali',
        fabricCategory: 'Anarkalis',
        fabricHint: ['1', '4'],
        photoFabricId: '1'
      },
      {
        id: 'ia-coords',
        name: 'Bagru Co-ord Set',
        blurb: 'Wide-leg trousers and a tucked shirt in hand-blocked indigo cotton.',
        basePrice: 28000,
        family: 'East-West',
        fabricCategory: 'Western Wear',
        fabricHint: ['4'],
        photoFabricId: '4'
      }
    ]
  },
  {
    id: 'patola-reverie',
    name: 'Patola Reverie',
    tagline: 'IKAT · KING · CRIMSON',
    story:
      'A four-piece capsule built around the rarest weave in India — Patan Patola double-ikat. Each piece is numbered; only twelve commissions will be accepted per year.',
    designerNote:
      'Patola weaves itself. The pattern is dyed into the warp and the weft before a single shuttle moves. I let the cloth lead the design — the cuts are clean so the ikat sings.',
    palette: ['#9B1B30', '#1E3A8A', '#C5A059', '#F2EBDD'],
    fabricPhotoId: '3',
    signaturePieces: [
      {
        id: 'pr-saree',
        name: 'Numbered Patola Saree',
        blurb: 'A six-yard Patan Patola with a hand-cut hidden zip and a custom matching blouse — each numbered I-XII.',
        basePrice: 1450000,
        family: 'Bespoke Saree',
        fabricCategory: 'Sarees',
        fabricHint: ['3'],
        photoFabricId: '3'
      },
      {
        id: 'pr-gown',
        name: 'Reverie Cape Gown',
        blurb: 'A column gown in plain ivory silk topped with a floor-length Patola cape, fastened with three antique zari clasps.',
        basePrice: 1850000,
        family: 'Couture Gown',
        fabricHint: ['3', '1'],
        photoFabricId: '3'
      },
      {
        id: 'pr-lehenga',
        name: 'Crimson Patola Lehenga',
        blurb: 'A two-piece lehenga where the panels are real Patola — the choli is silk with hand-stitched ikat tracing.',
        basePrice: 1650000,
        family: 'Bridal Lehenga',
        fabricCategory: 'Lehenga Cholis',
        fabricHint: ['3', '2'],
        photoFabricId: '3'
      }
    ]
  }
];

/* ---------- Customisation flow data ------------------------------------ */

const FINISHING_OPTIONS = [
  { id: 'zardozi',    label: 'Zardozi metal-thread embroidery',       surcharge: 65000 },
  { id: 'gota-patti', label: 'Gota patti applique',                   surcharge: 38000 },
  { id: 'sequins',    label: 'Hand-stitched sequins (per panel)',     surcharge: 22000 },
  { id: 'mirror',     label: 'Shisha mirror work',                    surcharge: 18000 },
  { id: 'pearl',      label: 'River-pearl drops',                     surcharge: 28000 },
  { id: 'crystal',    label: 'Swarovski crystal scatter',             surcharge: 45000 },
  { id: 'pleating',   label: 'Custom pleating + canopy work',         surcharge: 12000 },
  { id: 'monogram',   label: 'Hand-stitched monogram (initials)',     surcharge: 8000  },
];

const MEASUREMENT_FIELDS = [
  { id: 'bust',     label: 'Bust' },
  { id: 'waist',    label: 'Waist' },
  { id: 'hip',      label: 'Hip' },
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'sleeve',   label: 'Sleeve length' },
  { id: 'height',   label: 'Total height' },
] as const;

type FlowStep = 'fabric' | 'measurements' | 'finishing' | 'review';

const FLOW: { id: FlowStep; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'fabric',       label: 'Fabric',       Icon: Sparkles },
  { id: 'measurements', label: 'Measurements', Icon: Ruler },
  { id: 'finishing',    label: 'Finishing',    Icon: Scissors },
  { id: 'review',       label: 'Send to atelier', Icon: MessageSquare },
];

/* ---------- Page -------------------------------------------------------- */

type View = 'atelier' | 'capsule' | 'flow' | 'submitted';

const CustomisePage: React.FC<{ productId?: string }> = ({ productId }) => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const [view, setView] = useState<View>('atelier');
  const [selectedCapsule, setSelectedCapsule] = useState<Capsule | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<Silhouette | null>(null);

  // Flow state
  const [step, setStep] = useState<FlowStep>('fabric');
  const [fabricId, setFabricId] = useState<string | undefined>(productId);
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [finishing, setFinishing] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [callBack, setCallBack] = useState(true);

  // Deep-link: /customise/:id (or ?product=id) jumps into a flow seeded with
  // that fabric. Pick the silhouette that actually relates to the fabric —
  // never a hardcoded capsule, which made the header/price/eligible-fabrics
  // all reflect the wrong (Mughal Garden lehenga) piece regardless of the link.
  useEffect(() => {
    if (!productId) return;
    const f = findFabric(productId);
    if (!f) { setView('atelier'); return; } // unknown id — don't strand on a bogus piece
    const all = CAPSULES.flatMap(c => c.signaturePieces.map(p => ({ c, p })));
    const match =
      all.find(({ p }) => p.photoFabricId === productId || p.fabricHint.includes(productId)) ??
      all.find(({ p }) => p.fabricCategory && p.fabricCategory === f.masterCategory) ??
      { c: CAPSULES[0], p: CAPSULES[0].signaturePieces[0] };
    setSelectedCapsule(match.c);
    setSelectedPiece(match.p);
    setFabricId(productId); // keep the deep-linked fabric as the active selection
    setStep('fabric');
    setView('flow');
  }, [productId]);

  const fabric = fabricId ? findFabric(fabricId) : undefined;
  const finishingTotal = Array.from(finishing)
    .map(id => FINISHING_OPTIONS.find(o => o.id === id)?.surcharge ?? 0)
    .reduce((a, b) => a + b, 0);
  const fabricSurcharge = fabric ? Math.round(fabric.pricePerMeter * 1.2) : 0;
  const estimate = (selectedPiece?.basePrice ?? 0) + fabricSurcharge + finishingTotal;

  const eligibleFabrics = useMemo(() => {
    if (!selectedPiece) return FABRICS.slice(0, 12);
    const hinted = selectedPiece.fabricHint
      .map(id => findFabric(id))
      .filter((f): f is Fabric => !!f);
    const sameMaster = FABRICS.filter(f =>
      (selectedPiece.fabricCategory ? f.masterCategory === selectedPiece.fabricCategory : false) ||
      f.masterCategory === 'Fabrics'
    );
    const merged = [...hinted, ...sameMaster.filter(f => !hinted.includes(f))];
    return merged.slice(0, 12);
  }, [selectedPiece]);

  const enterCapsule = (c: Capsule) => {
    setSelectedCapsule(c);
    setView('capsule');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const beginCustomise = (piece: Silhouette) => {
    setSelectedPiece(piece);
    setFabricId(piece.photoFabricId);
    setStep('fabric');
    setView('flow');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToAtelier = () => {
    setSelectedCapsule(null);
    setSelectedPiece(null);
    setView('atelier');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToCapsule = () => {
    setSelectedPiece(null);
    setView('capsule');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const advance = () => {
    const idx = FLOW.findIndex(f => f.id === step);
    const next = FLOW[idx + 1];
    if (next) setStep(next.id);
  };
  const goBackStep = () => {
    const idx = FLOW.findIndex(f => f.id === step);
    const prev = FLOW[idx - 1];
    if (prev) setStep(prev.id);
  };
  const submit = () => setView('submitted');

  /* ===================== SUBMITTED ===================== */
  if (view === 'submitted') {
    return (
      <div className="pt-[110px] min-h-screen bg-[#FBF7EE]">
        <div className="max-w-[640px] mx-auto px-5 md:px-8 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-[color:var(--color-myntra-pink)] flex items-center justify-center mx-auto mb-7">
            <Check className="w-7 h-7 text-white" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[color:var(--color-myntra-pink)] mb-3">
            Brief received · the atelier
          </p>
          <h1 className="font-serif text-[34px] md:text-[40px] leading-[1.1] text-[color:var(--color-myntra-navy)] mb-5">
            Your couture brief is with us.
          </h1>
          <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] mb-10 leading-relaxed">
            Aanya, our atelier director, reads every commission personally and reaches out within
            one business day {callBack ? 'by phone' : 'over email'} to schedule a consultation.
            <br />Bridal: 12–14 weeks · Everything else: 6–8 weeks.
          </p>
          <div className="bg-white border border-[#E8DCC4] rounded-md p-6 mb-8 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--color-myntra-pink)] mb-2">
              Reference
            </p>
            <p className="font-serif text-[20px] text-[color:var(--color-myntra-navy)] leading-snug">{selectedPiece?.name}</p>
            <p className="text-[12px] uppercase tracking-[0.14em] text-[color:var(--color-myntra-ink-soft)] mt-1">{selectedCapsule?.name}</p>
            {fabric && <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-3">Fabric · {fabric.name}</p>}
            <div className="mt-4 pt-4 border-t border-[#E8DCC4] flex justify-between">
              <span className="text-[12px] uppercase tracking-[0.12em] text-[color:var(--color-myntra-ink-soft)]">Couture estimate</span>
              <span className="text-[16px] font-bold text-[color:var(--color-myntra-pink)]">{formatINR(estimate)}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate({ name: 'home' })} className="px-6 py-3 bg-[color:var(--color-myntra-navy)] text-white text-[12px] font-bold uppercase tracking-[0.14em] rounded">
              Back to storefront
            </button>
            <button onClick={backToAtelier} className="px-6 py-3 border border-[color:var(--color-myntra-navy)] text-[color:var(--color-myntra-navy)] text-[12px] font-bold uppercase tracking-[0.14em] rounded">
              Commission another piece
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[110px] min-h-screen bg-[#FBF7EE]">
      {/* ============== HERO (always-on atelier intro) ============== */}
      <section className="border-b border-[#E8DCC4]">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14 py-10 md:py-16 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[color:var(--color-myntra-pink)] mb-4">
              The Couture Customisations Atelier
            </p>
            <h1 className="font-serif text-[36px] md:text-[56px] lg:text-[64px] leading-[0.98] tracking-tight text-[#2A1F12] mb-5">
              Ultra-exclusive collections,
              <br />
              <em className="not-italic font-normal text-[color:var(--color-myntra-pink)]">customised</em> for one.
            </h1>
            <p className="text-[15px] md:text-[16px] text-[#5D4E36] leading-[1.65] max-w-[560px] mb-6">
              Four capsules, hand-curated each season by our atelier. Choose a signature piece,
              specify your fabric, embellishments and measurements — and we hand-finish it in
              twelve to fourteen weeks. No two commissions are identical.
            </p>
            <div className="flex flex-wrap gap-4 items-center text-[12px] uppercase tracking-[0.18em] text-[#8A7656]">
              <span className="flex items-center gap-2"><Star className="w-3.5 h-3.5 text-[color:var(--color-myntra-pink)]" /> 12 commissions / year</span>
              <span className="hidden sm:inline">·</span>
              <span>Hand-finished in Mumbai</span>
              <span className="hidden sm:inline">·</span>
              <span>Numbered &amp; signed</span>
            </div>
          </div>
          {/* Designer card */}
          <div className="relative bg-white border border-[#E8DCC4] p-7 md:p-8 rounded-md">
            <div className="absolute -top-3 left-7 px-3 py-1 bg-[color:var(--color-myntra-pink)] text-white text-[10px] font-bold uppercase tracking-[0.22em] rounded-sm">
              Atelier Director
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#C5A059] to-[#7A1F2C] flex items-center justify-center font-serif text-white text-[22px]">A</div>
              <div>
                <p className="font-serif text-[20px] text-[#2A1F12] leading-tight">Aanya Mehta</p>
                <p className="text-[12px] text-[#8A7656] uppercase tracking-[0.16em]">Couturier · Tresor</p>
              </div>
            </div>
            <Quote className="w-5 h-5 text-[color:var(--color-myntra-pink)] mb-2" />
            <p className="font-serif italic text-[16px] leading-relaxed text-[#46382A] mb-4">
              "Couture is a conversation. You bring the occasion and the body; I bring the loom
              and the needle. The garment is what we make together."
            </p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A7656]">— Aanya, signing every brief</p>
          </div>
        </div>
      </section>

      {/* ============== BREADCRUMB BAR ============== */}
      <div className="border-b border-[#E8DCC4] bg-white">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14 py-3 flex items-center gap-2 text-[12px]">
          <button onClick={backToAtelier} className={`uppercase tracking-[0.14em] ${view === 'atelier' ? 'font-bold text-[color:var(--color-myntra-pink)]' : 'text-[#8A7656] hover:text-[color:var(--color-myntra-pink)]'}`}>
            The Atelier
          </button>
          {selectedCapsule && (
            <>
              <ChevronRight className="w-3 h-3 text-[#C9B68C]" />
              <button onClick={backToCapsule} className={`uppercase tracking-[0.14em] ${view === 'capsule' ? 'font-bold text-[color:var(--color-myntra-pink)]' : 'text-[#8A7656] hover:text-[color:var(--color-myntra-pink)]'}`}>
                {selectedCapsule.name}
              </button>
            </>
          )}
          {selectedPiece && view === 'flow' && (
            <>
              <ChevronRight className="w-3 h-3 text-[#C9B68C]" />
              <span className="uppercase tracking-[0.14em] font-bold text-[color:var(--color-myntra-pink)]">{selectedPiece.name}</span>
            </>
          )}
        </div>
      </div>

      {/* ============== ATELIER (capsule gallery) ============== */}
      {view === 'atelier' && (
        <section className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14 py-12 md:py-16">
          <div className="flex items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[color:var(--color-myntra-pink)] mb-2">The Capsules · Spring</p>
              <h2 className="font-serif text-[28px] md:text-[36px] leading-tight text-[#2A1F12]">Four collections, in residence.</h2>
            </div>
            <p className="hidden md:block text-[12px] uppercase tracking-[0.18em] text-[#8A7656]">Hover a capsule</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {CAPSULES.map(capsule => {
              const cover = findFabric(capsule.fabricPhotoId);
              return (
                <button
                  key={capsule.id}
                  onClick={() => enterCapsule(capsule)}
                  className="group relative text-left bg-white border border-[#E8DCC4] rounded-md overflow-hidden hover:shadow-xl transition-shadow duration-500"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    {cover && (
                      <img
                        src={cover.photo}
                        alt={capsule.name}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = cover.image; }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2A1F12]/85 via-[#2A1F12]/20 to-transparent" />
                    {/* Palette swatches */}
                    <div className="absolute top-5 right-5 flex gap-1.5">
                      {capsule.palette.map(c => (
                        <span key={c} className="w-4 h-4 rounded-full border border-white/40" style={{ background: c }} />
                      ))}
                    </div>
                    {/* Capsule label */}
                    <div className="absolute bottom-0 left-0 right-0 p-7 text-white">
                      <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#E0BFA0] mb-2.5">{capsule.tagline}</p>
                      <h3 className="font-serif text-[28px] md:text-[32px] leading-[1.05] mb-3">{capsule.name}</h3>
                      <p className="text-[13px] text-white/85 leading-relaxed line-clamp-2 max-w-[480px]">{capsule.story}</p>
                    </div>
                  </div>
                  <div className="px-7 py-4 flex items-center justify-between bg-white">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-[#8A7656]">{capsule.signaturePieces.length} signature pieces</span>
                    <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-bold text-[color:var(--color-myntra-pink)] group-hover:translate-x-1 transition-transform">
                      Enter capsule <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Closing note */}
          <div className="mt-16 pt-10 border-t border-[#E8DCC4] flex flex-col md:flex-row gap-6 md:items-center justify-between">
            <div>
              <p className="font-serif text-[22px] text-[#2A1F12] mb-1">Not finding your occasion?</p>
              <p className="text-[13px] text-[#8A7656]">Book a one-to-one consultation. We design off-capsule for weddings, anniversaries and museum galas.</p>
            </div>
            <button onClick={() => setCallBack(true)} className="px-6 py-3 border-2 border-[#2A1F12] text-[#2A1F12] text-[12px] font-bold uppercase tracking-[0.16em] rounded hover:bg-[#2A1F12] hover:text-white transition-colors flex items-center gap-2">
              <Phone className="w-4 h-4" /> Speak with the studio
            </button>
          </div>
        </section>
      )}

      {/* ============== CAPSULE DETAIL ============== */}
      {view === 'capsule' && selectedCapsule && (
        <section className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14 py-12 md:py-16">
          {/* Capsule editorial header */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 mb-14">
            <div>
              <button onClick={backToAtelier} className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[#8A7656] hover:text-[color:var(--color-myntra-pink)] mb-6">
                <ArrowLeft className="w-3.5 h-3.5" /> All capsules
              </button>
              <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[color:var(--color-myntra-pink)] mb-3">{selectedCapsule.tagline}</p>
              <h2 className="font-serif text-[40px] md:text-[56px] leading-[0.98] text-[#2A1F12] mb-6">{selectedCapsule.name}</h2>
              <p className="text-[15px] md:text-[16px] text-[#46382A] leading-[1.7] mb-8 max-w-[540px]">{selectedCapsule.story}</p>
              <div className="border-l-2 border-[color:var(--color-myntra-pink)] pl-5 py-2">
                <p className="font-serif italic text-[15px] text-[#5D4E36] leading-relaxed mb-2">"{selectedCapsule.designerNote}"</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A7656]">— Aanya Mehta, Atelier Director</p>
              </div>
              {/* Palette */}
              <div className="mt-8 flex items-center gap-4">
                <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-[#8A7656]">Palette</p>
                <div className="flex gap-2">
                  {selectedCapsule.palette.map(c => (
                    <span key={c} className="w-7 h-7 rounded-full border border-[#E8DCC4]" style={{ background: c }} title={c} />
                  ))}
                </div>
              </div>
            </div>
            {/* Cover image */}
            <div className="relative aspect-[3/4] rounded-md overflow-hidden">
              {(() => {
                const cover = findFabric(selectedCapsule.fabricPhotoId);
                return cover && (
                  <img
                    src={cover.photo}
                    alt={selectedCapsule.name}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = cover.image; }}
                    className="w-full h-full object-cover"
                  />
                );
              })()}
              <div className="absolute inset-0 bg-gradient-to-t from-[#2A1F12]/30 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end text-white">
                <span className="text-[10px] uppercase tracking-[0.22em]">Lookbook</span>
                <span className="font-serif italic text-[18px]">No. {CAPSULES.findIndex(c => c.id === selectedCapsule.id) + 1}</span>
              </div>
            </div>
          </div>

          {/* Signature pieces */}
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[color:var(--color-myntra-pink)] mb-2">Signature pieces</p>
          <h3 className="font-serif text-[26px] md:text-[32px] text-[#2A1F12] mb-8">Each is customisable. None is repeated.</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {selectedCapsule.signaturePieces.map(piece => {
              const photo = findFabric(piece.photoFabricId ?? piece.fabricHint[0]);
              return (
                <div key={piece.id} className="bg-white border border-[#E8DCC4] rounded-md overflow-hidden flex flex-col">
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#F4ECD8]">
                    {photo && (
                      <img
                        src={photo.photo}
                        alt={piece.name}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = photo.image; }}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/95 text-[9px] font-bold uppercase tracking-[0.18em] text-[#2A1F12] rounded-sm">
                      {piece.family}
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h4 className="font-serif text-[20px] text-[#2A1F12] leading-tight mb-2">{piece.name}</h4>
                    <p className="text-[13px] text-[#5D4E36] leading-relaxed mb-5 flex-1">{piece.blurb}</p>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] uppercase tracking-[0.14em] text-[#8A7656]">Commission from</span>
                      <span className="font-bold text-[#2A1F12]">{formatINR(piece.basePrice)}</span>
                    </div>
                    <button
                      onClick={() => beginCustomise(piece)}
                      className="w-full py-3 bg-[color:var(--color-myntra-navy)] text-white text-[12px] font-bold uppercase tracking-[0.16em] rounded hover:bg-[color:var(--color-myntra-pink)] transition-colors flex items-center justify-center gap-2"
                    >
                      Customise this piece <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ============== CUSTOMISATION FLOW ============== */}
      {view === 'flow' && selectedPiece && selectedCapsule && (
        <section className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-14 py-10 md:py-12">
          <button onClick={backToCapsule} className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[#8A7656] hover:text-[color:var(--color-myntra-pink)] mb-6">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to {selectedCapsule.name}
          </button>

          {/* Piece header */}
          <div className="bg-white border border-[#E8DCC4] rounded-md p-6 md:p-8 mb-6 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 items-center">
            {(() => {
              const ph = findFabric(selectedPiece.photoFabricId ?? selectedPiece.fabricHint[0]);
              return ph && (
                <div className="aspect-[3/4] rounded overflow-hidden bg-[#F4ECD8] max-w-[180px]">
                  <img src={ph.photo} alt={selectedPiece.name} onError={(e) => { (e.currentTarget as HTMLImageElement).src = ph.image; }} className="w-full h-full object-cover" />
                </div>
              );
            })()}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--color-myntra-pink)] mb-1.5">{selectedCapsule.name}</p>
              <h2 className="font-serif text-[28px] md:text-[34px] text-[#2A1F12] leading-tight mb-2">{selectedPiece.name}</h2>
              <p className="text-[13px] text-[#5D4E36] leading-relaxed mb-3">{selectedPiece.blurb}</p>
              <p className="text-[12px] uppercase tracking-[0.14em] text-[#8A7656]">Commission base · <span className="font-bold text-[#2A1F12]">{formatINR(selectedPiece.basePrice)}</span></p>
            </div>
          </div>

          {/* Stepper */}
          <div className="bg-white border border-[#E8DCC4] rounded-md p-2 mb-6 overflow-x-auto">
            <div className="flex items-center gap-1 min-w-max">
              {FLOW.map(({ id, label, Icon }, i) => {
                const isActive = step === id;
                const isDone = FLOW.findIndex(f => f.id === step) > i;
                return (
                  <React.Fragment key={id}>
                    <button
                      onClick={() => (isDone || isActive) && setStep(id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                        isActive
                          ? 'bg-[color:var(--color-myntra-pink)] text-white'
                          : isDone
                            ? 'text-[#2A1F12] hover:bg-[#FBF7EE]'
                            : 'text-[#C9B68C]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                    {i < FLOW.length - 1 && <ChevronRight className="w-3 h-3 text-[#C9B68C]" />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <main className="bg-white border border-[#E8DCC4] rounded-md p-6 md:p-8">
              {step === 'fabric' && (
                <>
                  <h3 className="font-serif text-[22px] md:text-[26px] text-[#2A1F12] mb-1.5">Choose the heritage fabric</h3>
                  <p className="text-[13px] text-[#5D4E36] mb-6">The studio has recommended these weaves for your piece. The atelier will source the agreed yardage directly from the master weaver.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {eligibleFabrics.map(f => {
                      const active = fabricId === f.id;
                      const isHinted = selectedPiece.fabricHint.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          onClick={() => setFabricId(f.id)}
                          className={`relative text-left rounded-md overflow-hidden border-2 transition-all ${active ? 'border-[color:var(--color-myntra-pink)]' : 'border-transparent hover:border-[#E0BFA0]'}`}
                        >
                          {isHinted && (
                            <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-[color:var(--color-myntra-pink)] text-white text-[9px] font-bold uppercase tracking-[0.16em] rounded-sm">
                              Atelier's pick
                            </span>
                          )}
                          <div className="aspect-[3/4] bg-[#F4ECD8]">
                            <img src={f.photo} alt={f.name} onError={(e) => { (e.currentTarget as HTMLImageElement).src = f.image; }} className="w-full h-full object-cover" />
                          </div>
                          <div className="p-2.5">
                            <p className="text-[11px] font-bold text-[#2A1F12] truncate">{f.name.replace(' Fabric', '').replace(' (per meter)', '')}</p>
                            <p className="text-[10px] text-[#8A7656]">{formatINR(f.pricePerMeter)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {step === 'measurements' && (
                <>
                  <h3 className="font-serif text-[22px] md:text-[26px] text-[#2A1F12] mb-1.5">Your measurements</h3>
                  <p className="text-[13px] text-[#5D4E36] mb-6">Optional — our tailor can take these at your fitting. Inches preferred.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {MEASUREMENT_FIELDS.map(m => (
                      <label key={m.id} className="block">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A7656]">{m.label}</span>
                        <input
                          value={measurements[m.id] ?? ''}
                          onChange={e => setMeasurements(prev => ({ ...prev, [m.id]: e.target.value }))}
                          type="number"
                          step="0.5"
                          placeholder="in"
                          className="mt-1 w-full px-3 py-2.5 border border-[#E8DCC4] rounded text-[14px] focus:outline-none focus:border-[color:var(--color-myntra-pink)]"
                        />
                      </label>
                    ))}
                  </div>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A7656]">Special notes to the atelier</span>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      placeholder="e.g. left-sleeve cape, mother's vintage zari border, ankle slit, wear with my heirloom jewellery…"
                      className="mt-1 w-full px-3 py-2.5 border border-[#E8DCC4] rounded text-[14px] focus:outline-none focus:border-[color:var(--color-myntra-pink)] resize-none"
                    />
                  </label>
                </>
              )}

              {step === 'finishing' && (
                <>
                  <h3 className="font-serif text-[22px] md:text-[26px] text-[#2A1F12] mb-1.5">Finishing touches</h3>
                  <p className="text-[13px] text-[#5D4E36] mb-6">Hand-craft embellishments. Pick any combination — the atelier will execute on the loom.</p>
                  <div className="space-y-2">
                    {FINISHING_OPTIONS.map(o => {
                      const active = finishing.has(o.id);
                      return (
                        <button
                          key={o.id}
                          onClick={() => setFinishing(prev => {
                            const next = new Set(prev);
                            if (next.has(o.id)) next.delete(o.id); else next.add(o.id);
                            return next;
                          })}
                          className={`w-full flex items-center justify-between p-4 rounded-md border-2 transition-all text-left ${active ? 'border-[color:var(--color-myntra-pink)] bg-[#FBF7EE]' : 'border-[#E8DCC4] hover:border-[#E0BFA0]'}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${active ? 'bg-[color:var(--color-myntra-pink)] border-[color:var(--color-myntra-pink)]' : 'border-[#C9B68C]'}`}>
                              {active && <Check className="w-3.5 h-3.5 text-white" />}
                            </span>
                            <span className="text-[14px] font-semibold text-[#2A1F12]">{o.label}</span>
                          </div>
                          <span className="text-[12px] font-bold text-[#2A1F12]">+ {formatINR(o.surcharge)}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {step === 'review' && (
                <>
                  <h3 className="font-serif text-[22px] md:text-[26px] text-[#2A1F12] mb-1.5">Send the brief to the atelier</h3>
                  <p className="text-[13px] text-[#5D4E36] mb-6">Aanya reads every commission personally and writes back within one business day.</p>
                  <div className="space-y-3">
                    <div className="p-4 bg-[#FBF7EE] rounded">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-pink)] mb-1">Piece</p>
                      <p className="font-serif text-[16px] font-semibold text-[#2A1F12]">{selectedPiece.name}</p>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[#8A7656]">{selectedCapsule.name}</p>
                    </div>
                    {fabric && (
                      <div className="p-4 bg-[#FBF7EE] rounded">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-pink)] mb-1">Fabric</p>
                        <p className="text-[14px] font-bold text-[#2A1F12]">{fabric.name}</p>
                        <p className="text-[12px] text-[#8A7656]">{formatINR(fabric.pricePerMeter)} · {fabric.origin}</p>
                      </div>
                    )}
                    <div className="p-4 bg-[#FBF7EE] rounded">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-pink)] mb-1">Finishing</p>
                      {finishing.size === 0
                        ? <p className="text-[13px] text-[#8A7656]">No add-ons — we'll discuss at fitting</p>
                        : <ul className="text-[13px] text-[#2A1F12] space-y-0.5">
                            {Array.from(finishing).map(id => {
                              const opt = FINISHING_OPTIONS.find(o => o.id === id);
                              return opt ? <li key={id}>· {opt.label}</li> : null;
                            })}
                          </ul>}
                    </div>
                    <label className="flex items-center gap-3 p-4 border border-[#E8DCC4] rounded cursor-pointer">
                      <input type="checkbox" checked={callBack} onChange={e => setCallBack(e.target.checked)} className="w-4 h-4 accent-[color:var(--color-myntra-pink)]" />
                      <Phone className="w-4 h-4 text-[color:var(--color-myntra-pink)]" />
                      <span className="text-[13px] text-[#2A1F12]">Prefer a phone consultation (otherwise we'll email)</span>
                    </label>
                  </div>
                </>
              )}

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-[#E8DCC4] flex items-center justify-between gap-3">
                <button onClick={goBackStep} disabled={step === 'fabric'} className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A7656] disabled:opacity-30">
                  Back
                </button>
                {step === 'review' ? (
                  <button onClick={submit} className="px-6 py-3 bg-[color:var(--color-myntra-pink)] text-white text-[11px] font-bold uppercase tracking-[0.16em] rounded flex items-center gap-2">
                    <Send className="w-4 h-4" /> Send brief to Aanya
                  </button>
                ) : (
                  <button onClick={advance} className="px-6 py-3 bg-[color:var(--color-myntra-navy)] text-white text-[11px] font-bold uppercase tracking-[0.16em] rounded">
                    Continue
                  </button>
                )}
              </div>
            </main>

            {/* Estimate rail */}
            <aside className="bg-white border border-[#E8DCC4] rounded-md p-6 h-fit lg:sticky lg:top-[120px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--color-myntra-pink)] mb-1">Your commission</p>
              <p className="font-serif text-[18px] text-[#2A1F12] mb-5 leading-tight">{selectedPiece.name}</p>
              <ul className="text-[13px] space-y-3 mb-5">
                <li className="flex justify-between text-[#5D4E36]">
                  <span>Silhouette base</span>
                  <span className="text-[#2A1F12] font-semibold">{formatINR(selectedPiece.basePrice)}</span>
                </li>
                <li className="flex justify-between text-[#5D4E36]">
                  <span>Fabric ({fabric ? '~6m' : 'tbd'})</span>
                  <span className="text-[#2A1F12] font-semibold">{fabric ? formatINR(fabricSurcharge) : '—'}</span>
                </li>
                <li className="flex justify-between text-[#5D4E36]">
                  <span>Finishing</span>
                  <span className="text-[#2A1F12] font-semibold">{finishing.size ? formatINR(finishingTotal) : '—'}</span>
                </li>
                <li className="border-t border-[#E8DCC4] pt-3 flex justify-between font-bold">
                  <span className="text-[#2A1F12]">Estimate</span>
                  <span className="text-[color:var(--color-myntra-pink)]">{formatINR(estimate)}</span>
                </li>
              </ul>
              <p className="text-[11px] text-[#8A7656] leading-relaxed mb-4">
                Final price is set after your fitting. 50% advance secures the commission; balance due at delivery.
              </p>
              <div className="flex items-center gap-2 p-3 bg-[#FBF7EE] rounded text-[12px]">
                <Calendar className="w-4 h-4 text-[color:var(--color-myntra-pink)] shrink-0" />
                <span className="text-[#2A1F12]">Bridal: 12–14 wks · Other: 6–8 wks</span>
              </div>
              {!user && (
                <button onClick={() => navigate({ name: 'login' })} className="mt-4 w-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-myntra-pink)] border border-[color:var(--color-myntra-pink)] rounded">
                  Sign in to save this brief
                </button>
              )}
            </aside>
          </div>
        </section>
      )}
    </div>
  );
};

export default CustomisePage;
