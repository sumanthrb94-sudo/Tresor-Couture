import React, { useMemo, useState } from 'react';
import { Scissors, Ruler, Sparkles, MessageSquare, Send, Check, ChevronRight, Phone, Calendar } from 'lucide-react';
import { FABRICS, MASTER_CATEGORIES, formatINR } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import type { MasterCategory } from '../types';

type Step = 'silhouette' | 'fabric' | 'measurements' | 'finishing' | 'review';

const SILHOUETTES: { id: string; label: string; description: string; basePrice: number; category: MasterCategory }[] = [
  { id: 'lehenga-bridal',     label: 'Bridal Lehenga Choli',  description: 'Heirloom-weight skirt, embroidered choli, dupatta — three-piece bridal set.', basePrice: 185000, category: 'Lehenga Cholis' },
  { id: 'lehenga-festive',    label: 'Festive Lehenga',       description: 'Lighter, dance-friendly silhouette for sangeets, mehndis and receptions.',    basePrice: 95000,  category: 'Lehenga Cholis' },
  { id: 'saree-bespoke',      label: 'Bespoke Saree',         description: 'Custom border, palla and pleating with your chosen weave.',                   basePrice: 45000,  category: 'Sarees' },
  { id: 'anarkali-floor',     label: 'Floor-length Anarkali', description: 'Mughal-inspired flared kurta with churidar and dupatta.',                     basePrice: 38000,  category: 'Anarkalis' },
  { id: 'anarkali-cocktail',  label: 'Cocktail Anarkali',     description: 'Knee-length, sharper silhouette for evening events.',                          basePrice: 22000,  category: 'Anarkalis' },
  { id: 'gown-couture',       label: 'Couture Gown',          description: 'Made-to-measure floor-length gown in your chosen heritage weave.',            basePrice: 220000, category: 'Designer Wear' },
  { id: 'western-dress',      label: 'East-West Dress',       description: 'Heritage fabric, contemporary cut. Cocktail or day silhouettes.',             basePrice: 28000,  category: 'Western Wear' },
  { id: 'sherwani',           label: 'Bespoke Sherwani',      description: 'Hand-tailored menswear with brocade panels and a churidar.',                  basePrice: 165000, category: 'Designer Wear' },
];

const FINISHING_OPTIONS = [
  { id: 'zardozi',   label: 'Zardozi metal-thread embroidery', surcharge: 35000 },
  { id: 'gota-patti',label: 'Gota patti appliqué',             surcharge: 18000 },
  { id: 'sequins',   label: 'Hand-stitched sequins',           surcharge: 12000 },
  { id: 'mirror',    label: 'Shisha mirror work',              surcharge: 9000  },
  { id: 'pearl',     label: 'River-pearl drops',               surcharge: 14000 },
  { id: 'pleating',  label: 'Custom pleating + canopy work',   surcharge: 6000  },
];

const MEASUREMENT_FIELDS = [
  { id: 'bust',     label: 'Bust',           hint: 'inches' },
  { id: 'waist',    label: 'Waist',          hint: 'inches' },
  { id: 'hip',      label: 'Hip',            hint: 'inches' },
  { id: 'shoulder', label: 'Shoulder',       hint: 'inches' },
  { id: 'sleeve',   label: 'Sleeve length',  hint: 'inches' },
  { id: 'height',   label: 'Total height',   hint: 'inches' },
] as const;

const STEPS: { id: Step; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'silhouette',   label: 'Silhouette',   Icon: Scissors },
  { id: 'fabric',       label: 'Heritage Fabric', Icon: Sparkles },
  { id: 'measurements', label: 'Measurements', Icon: Ruler },
  { id: 'finishing',    label: 'Finishing',    Icon: Sparkles },
  { id: 'review',       label: 'Review',       Icon: MessageSquare },
];

const CustomisePage: React.FC<{ productId?: string }> = ({ productId }) => {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const seedFabric = useMemo(() => FABRICS.find(f => f.id === productId), [productId]);

  const [step, setStep] = useState<Step>('silhouette');
  const [silhouetteId, setSilhouetteId] = useState<string | undefined>();
  const [fabricId, setFabricId] = useState<string | undefined>(seedFabric?.id);
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [finishing, setFinishing] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [callBack, setCallBack] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const silhouette = SILHOUETTES.find(s => s.id === silhouetteId);
  const fabric = FABRICS.find(f => f.id === fabricId);
  const finishingTotal = Array.from(finishing)
    .map(id => FINISHING_OPTIONS.find(o => o.id === id)?.surcharge ?? 0)
    .reduce((a, b) => a + b, 0);
  const fabricSurcharge = fabric ? Math.round(fabric.pricePerMeter * 1.2) : 0;
  const estimate = (silhouette?.basePrice ?? 0) + fabricSurcharge + finishingTotal;

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const canAdvance =
    (step === 'silhouette' && !!silhouetteId) ||
    (step === 'fabric' && !!fabricId) ||
    (step === 'measurements') ||
    (step === 'finishing') ||
    (step === 'review');

  const advance = () => {
    if (!canAdvance) return;
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  };
  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  };
  const submit = () => setSubmitted(true);

  const eligibleFabrics = useMemo(() => {
    if (!silhouette) return FABRICS.slice(0, 12);
    return FABRICS.filter(f => f.masterCategory === silhouette.category || f.masterCategory === 'Fabrics').slice(0, 12);
  }, [silhouette]);

  if (submitted) {
    return (
      <div className="pt-[120px] min-h-screen bg-[color:var(--color-myntra-bg-soft)]">
        <div className="max-w-[720px] mx-auto px-4 md:px-8 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[color:var(--color-myntra-pink)] flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-serif text-[32px] text-[color:var(--color-myntra-navy)] mb-3">
            Your atelier brief is with us.
          </h1>
          <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] mb-8 leading-relaxed">
            A senior couturier will read your brief within one business day and reach out
            {callBack ? ' by phone' : ' over email'} to schedule a fitting. Bridal commissions take 12–14 weeks; everything else 6–8.
          </p>
          <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-5 mb-6 text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-pink)] mb-2">Reference</p>
            <p className="text-[14px] font-bold text-[color:var(--color-myntra-navy)]">{silhouette?.label}</p>
            {fabric && <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">In {fabric.name}</p>}
            <p className="text-[14px] font-bold mt-3">Estimated couture price: <span className="text-[color:var(--color-myntra-pink)]">{formatINR(estimate)}</span></p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate({ name: 'home' })} className="px-6 py-3 bg-[color:var(--color-myntra-navy)] text-white text-[13px] font-bold uppercase tracking-[0.1em] rounded">
              Back to storefront
            </button>
            <button onClick={() => { setSubmitted(false); setStep('silhouette'); setSilhouetteId(undefined); setFabricId(undefined); setMeasurements({}); setFinishing(new Set()); setNotes(''); }} className="px-6 py-3 border border-[color:var(--color-myntra-navy)] text-[13px] font-bold uppercase tracking-[0.1em] rounded">
              Start another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[120px] min-h-screen bg-[color:var(--color-myntra-bg-soft)]">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 lg:px-10 py-6 md:py-10">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#2A1F12] to-[#46382A] text-white rounded-md p-6 md:p-10 mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--color-myntra-pink)] mb-3">
            The Couture Studio
          </p>
          <h1 className="font-serif text-[28px] md:text-[40px] leading-tight mb-3">
            Tell us what you'd like the atelier to weave.
          </h1>
          <p className="text-[14px] md:text-[15px] text-white/75 max-w-[640px] leading-relaxed">
            Choose a silhouette, pair it with a heritage fabric, share your measurements and finishing
            preferences. A senior couturier will price your commission and schedule a fitting.
          </p>
        </div>

        {/* Stepper */}
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-2 mb-6 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {STEPS.map(({ id, label, Icon }, i) => {
              const isActive = step === id;
              const isDone = STEPS.findIndex(s => s.id === step) > i;
              return (
                <React.Fragment key={id}>
                  <button
                    onClick={() => (isDone || isActive) && setStep(id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-[12px] font-bold uppercase tracking-[0.06em] transition-colors ${
                      isActive
                        ? 'bg-[color:var(--color-myntra-pink)] text-white'
                        : isDone
                          ? 'text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)]'
                          : 'text-[color:var(--color-myntra-ink-mute)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                  {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-[color:var(--color-myntra-ink-mute)]" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <main className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-5 md:p-8">
            {step === 'silhouette' && (
              <>
                <h2 className="font-serif text-[22px] md:text-[26px] text-[color:var(--color-myntra-navy)] mb-1">Pick a silhouette</h2>
                <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-6">Each is a starting point — we'll refine the cut during your fitting.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SILHOUETTES.map(s => {
                    const active = silhouetteId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSilhouetteId(s.id)}
                        className={`text-left p-4 rounded-md border-2 transition-all ${
                          active
                            ? 'border-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-soft)]'
                            : 'border-[color:var(--color-myntra-border-soft)] hover:border-[color:var(--color-myntra-pink)]'
                        }`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-pink)] mb-1">{s.category}</p>
                        <p className="font-serif text-[16px] font-semibold text-[color:var(--color-myntra-navy)] mb-1.5">{s.label}</p>
                        <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mb-2 leading-relaxed">{s.description}</p>
                        <p className="text-[12px] font-bold text-[color:var(--color-myntra-navy)]">From {formatINR(s.basePrice)}</p>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 'fabric' && (
              <>
                <h2 className="font-serif text-[22px] md:text-[26px] text-[color:var(--color-myntra-navy)] mb-1">Choose a heritage fabric</h2>
                <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-6">
                  We've filtered to weaves that suit your {silhouette?.label.toLowerCase() ?? 'piece'}. The atelier will source the agreed yardage from the source weaver.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {eligibleFabrics.map(f => {
                    const active = fabricId === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFabricId(f.id)}
                        className={`text-left rounded-md overflow-hidden border-2 transition-all ${
                          active
                            ? 'border-[color:var(--color-myntra-pink)]'
                            : 'border-transparent hover:border-[color:var(--color-myntra-pink)]'
                        }`}
                      >
                        <div className="aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)]">
                          <img src={f.photo} alt={f.name} onError={(e) => { (e.currentTarget as HTMLImageElement).src = f.image; }} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2.5">
                          <p className="text-[11px] font-bold text-[color:var(--color-myntra-navy)] truncate">{f.name}</p>
                          <p className="text-[10px] text-[color:var(--color-myntra-ink-soft)]">{formatINR(f.pricePerMeter)}/m</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 'measurements' && (
              <>
                <h2 className="font-serif text-[22px] md:text-[26px] text-[color:var(--color-myntra-navy)] mb-1">Share measurements</h2>
                <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-6">
                  Optional — our tailor can also take them at your fitting. Inches preferred.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {MEASUREMENT_FIELDS.map(m => (
                    <label key={m.id} className="block">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-myntra-ink-soft)]">{m.label}</span>
                      <input
                        value={measurements[m.id] ?? ''}
                        onChange={e => setMeasurements(prev => ({ ...prev, [m.id]: e.target.value }))}
                        type="number"
                        step="0.5"
                        placeholder={m.hint}
                        className="mt-1 w-full px-3 py-2 border border-[color:var(--color-myntra-border-soft)] rounded text-[14px] focus:outline-none focus:border-[color:var(--color-myntra-pink)]"
                      />
                    </label>
                  ))}
                </div>
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-myntra-ink-soft)]">Special notes</span>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    placeholder="e.g. left-sleeve cape, mother's vintage zari border, ankle slit…"
                    className="mt-1 w-full px-3 py-2 border border-[color:var(--color-myntra-border-soft)] rounded text-[14px] focus:outline-none focus:border-[color:var(--color-myntra-pink)] resize-none"
                  />
                </label>
              </>
            )}

            {step === 'finishing' && (
              <>
                <h2 className="font-serif text-[22px] md:text-[26px] text-[color:var(--color-myntra-navy)] mb-1">Finishing touches</h2>
                <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-6">Embellishments and craftwork that elevate the piece. Pick any combination.</p>
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
                        className={`w-full flex items-center justify-between p-4 rounded-md border-2 transition-all text-left ${
                          active
                            ? 'border-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-soft)]'
                            : 'border-[color:var(--color-myntra-border-soft)] hover:border-[color:var(--color-myntra-pink)]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${active ? 'bg-[color:var(--color-myntra-pink)] border-[color:var(--color-myntra-pink)]' : 'border-[color:var(--color-myntra-border-soft)]'}`}>
                            {active && <Check className="w-3.5 h-3.5 text-white" />}
                          </span>
                          <span className="text-[14px] font-semibold text-[color:var(--color-myntra-navy)]">{o.label}</span>
                        </div>
                        <span className="text-[13px] font-bold text-[color:var(--color-myntra-navy)]">+ {formatINR(o.surcharge)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 'review' && (
              <>
                <h2 className="font-serif text-[22px] md:text-[26px] text-[color:var(--color-myntra-navy)] mb-1">Final brief</h2>
                <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-6">Confirm and we'll have a couturier ring you within one business day.</p>
                <div className="space-y-4">
                  <div className="p-4 bg-[color:var(--color-myntra-bg-soft)] rounded">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-pink)] mb-1">Silhouette</p>
                    <p className="text-[14px] font-bold text-[color:var(--color-myntra-navy)]">{silhouette?.label}</p>
                    <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">{silhouette?.description}</p>
                  </div>
                  {fabric && (
                    <div className="p-4 bg-[color:var(--color-myntra-bg-soft)] rounded">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-pink)] mb-1">Fabric</p>
                      <p className="text-[14px] font-bold text-[color:var(--color-myntra-navy)]">{fabric.name}</p>
                      <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">{formatINR(fabric.pricePerMeter)} / m · {fabric.origin}</p>
                    </div>
                  )}
                  <div className="p-4 bg-[color:var(--color-myntra-bg-soft)] rounded">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-pink)] mb-1">Finishing</p>
                    {finishing.size === 0
                      ? <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)]">No add-ons (we'll discuss at fitting)</p>
                      : <ul className="text-[13px] text-[color:var(--color-myntra-navy)] space-y-0.5">
                          {Array.from(finishing).map(id => {
                            const opt = FINISHING_OPTIONS.find(o => o.id === id);
                            return opt ? <li key={id}>· {opt.label}</li> : null;
                          })}
                        </ul>}
                  </div>
                  <label className="flex items-center gap-3 p-4 border border-[color:var(--color-myntra-border-soft)] rounded cursor-pointer">
                    <input type="checkbox" checked={callBack} onChange={e => setCallBack(e.target.checked)} className="w-4 h-4 accent-[color:var(--color-myntra-pink)]" />
                    <Phone className="w-4 h-4 text-[color:var(--color-myntra-pink)]" />
                    <span className="text-[13px] text-[color:var(--color-myntra-navy)]">Prefer a phone consultation (we'll otherwise email)</span>
                  </label>
                </div>
              </>
            )}

            <div className="mt-8 pt-6 border-t border-[color:var(--color-myntra-border-soft)] flex items-center justify-between gap-3">
              <button
                onClick={goBack}
                disabled={stepIndex === 0}
                className="px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-[color:var(--color-myntra-ink-soft)] disabled:opacity-30"
              >
                Back
              </button>
              {step === 'review' ? (
                <button
                  onClick={submit}
                  disabled={!silhouetteId}
                  className="px-6 py-3 bg-[color:var(--color-myntra-pink)] text-white text-[13px] font-bold uppercase tracking-[0.1em] rounded flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" /> Submit to atelier
                </button>
              ) : (
                <button
                  onClick={advance}
                  disabled={!canAdvance}
                  className="px-6 py-3 bg-[color:var(--color-myntra-navy)] text-white text-[13px] font-bold uppercase tracking-[0.1em] rounded disabled:opacity-50"
                >
                  Continue
                </button>
              )}
            </div>
          </main>

          {/* Summary rail */}
          <aside className="bg-white border border-[color:var(--color-myntra-border-soft)] rounded-md p-5 h-fit lg:sticky lg:top-[110px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-myntra-pink)] mb-3">Your commission</p>
            <ul className="text-[13px] space-y-2.5 mb-5">
              <li className="flex justify-between text-[color:var(--color-myntra-ink-soft)]">
                <span>Silhouette base</span>
                <span className="text-[color:var(--color-myntra-navy)] font-semibold">{silhouette ? formatINR(silhouette.basePrice) : '—'}</span>
              </li>
              <li className="flex justify-between text-[color:var(--color-myntra-ink-soft)]">
                <span>Fabric ({fabric ? '~6m' : 'tbd'})</span>
                <span className="text-[color:var(--color-myntra-navy)] font-semibold">{fabric ? formatINR(fabricSurcharge) : '—'}</span>
              </li>
              <li className="flex justify-between text-[color:var(--color-myntra-ink-soft)]">
                <span>Finishing</span>
                <span className="text-[color:var(--color-myntra-navy)] font-semibold">{finishing.size ? formatINR(finishingTotal) : '—'}</span>
              </li>
              <li className="border-t border-[color:var(--color-myntra-border-soft)] pt-2.5 flex justify-between font-bold">
                <span className="text-[color:var(--color-myntra-navy)]">Estimate</span>
                <span className="text-[color:var(--color-myntra-pink)]">{estimate ? formatINR(estimate) : '—'}</span>
              </li>
            </ul>
            <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] leading-relaxed mb-4">
              Final price is set after your fitting. 50% advance secures the commission; balance due at delivery.
            </p>
            <div className="flex items-center gap-2 p-3 bg-[color:var(--color-myntra-bg-soft)] rounded text-[12px]">
              <Calendar className="w-4 h-4 text-[color:var(--color-myntra-pink)] shrink-0" />
              <span className="text-[color:var(--color-myntra-navy)]">Bridal: 12–14 wks · Other: 6–8 wks</span>
            </div>
            {!user && (
              <button
                onClick={() => navigate({ name: 'login' })}
                className="mt-4 w-full px-3 py-2 text-[12px] font-bold text-[color:var(--color-myntra-pink)] border border-[color:var(--color-myntra-pink)] rounded"
              >
                Sign in to save this brief
              </button>
            )}
            <p className="hidden lg:block text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-myntra-ink-mute)] mt-5 text-center">
              All categories — {MASTER_CATEGORIES.length} sections
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CustomisePage;
