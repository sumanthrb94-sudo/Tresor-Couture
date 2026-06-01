import React, { useEffect, useState } from 'react';
import { MapPin, Zap, Truck, LocateFixed, Loader2 } from 'lucide-react';
import {
  checkServiceability,
  requestGeolocation,
  isValidPincode,
  SEED_SERVICEABLE_PINCODES,
  DELIVERY_PROMISE_MINUTES,
  type ServiceabilityResult,
} from '../lib/serviceability';
import { deliveryConfigApi } from '../lib/firebase';

/**
 * 40-minute delivery eligibility checker. Two ways to qualify:
 *   - "Use my location" → browser geolocation → radius check (no external API)
 *   - Type a 6-digit Hyderabad pincode → checked against the admin-editable list
 *
 * Out-of-zone is NOT blocked — it shows a friendly standard-shipping fallback.
 * The serviceable pincode list is loaded from Firestore (config/delivery) with
 * the seed list as the offline fallback.
 */

interface Props {
  /** Compact = single line for the product page; full = card for the cart. */
  variant?: 'compact' | 'card';
  /** Prefill (e.g. from a saved address postalCode). */
  initialPincode?: string;
  /** Notifies parent when serviceability is determined (for shipping/UI). */
  onResult?: (result: ServiceabilityResult) => void;
  className?: string;
}

const DeliveryChecker: React.FC<Props> = ({ variant = 'card', initialPincode = '', onResult, className = '' }) => {
  const [pin, setPin] = useState(initialPincode);
  const [pincodeList, setPincodeList] = useState<string[]>(SEED_SERVICEABLE_PINCODES);
  const [result, setResult] = useState<ServiceabilityResult | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  // Load the admin-maintained serviceable list; keep the seed as fallback.
  useEffect(() => {
    let cancelled = false;
    deliveryConfigApi.get().then(cfg => {
      if (!cancelled && cfg && cfg.pincodes.length) setPincodeList(cfg.pincodes);
    });
    return () => { cancelled = true; };
  }, []);

  const emit = (r: ServiceabilityResult) => { setResult(r); onResult?.(r); };

  const checkPin = () => {
    if (!isValidPincode(pin)) {
      setResult(null);
      setLocError(null);
      return;
    }
    emit(checkServiceability({ pincode: pin.trim(), pincodeList }));
  };

  const useMyLocation = async () => {
    setLocating(true);
    setLocError(null);
    try {
      const coords = await requestGeolocation();
      emit(checkServiceability({ coords, pincode: isValidPincode(pin) ? pin.trim() : undefined, pincodeList }));
    } catch (err) {
      const code = err instanceof Error ? err.message : 'position_unavailable';
      setLocError(
        code === 'permission_denied'
          ? 'Location permission denied — enter your pincode instead.'
          : code === 'geolocation_unsupported'
          ? 'Location not supported on this device — enter your pincode.'
          : 'Could not get your location — enter your pincode.',
      );
    } finally {
      setLocating(false);
    }
  };

  const serviceable = result?.serviceable ?? null;

  return (
    <div className={`${variant === 'card' ? 'border border-[color:var(--color-myntra-border-soft)] rounded-lg p-4 bg-white' : ''} ${className}`}>
      <p className="text-[12px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-2 inline-flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-[color:var(--color-myntra-pink)]" />
        {DELIVERY_PROMISE_MINUTES}-minute delivery · Hyderabad
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setResult(null); }}
          onKeyDown={e => { if (e.key === 'Enter') checkPin(); }}
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter 6-digit pincode"
          aria-label="Delivery pincode"
          className="input-box flex-1"
        />
        <button type="button" onClick={checkPin} disabled={!isValidPincode(pin)} className="btn-outline whitespace-nowrap disabled:opacity-50">
          Check
        </button>
        <button type="button" onClick={useMyLocation} disabled={locating} className="btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50">
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
          Use my location
        </button>
      </div>

      {locError && <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-2">{locError}</p>}

      {serviceable === true && (
        <p className="mt-2.5 inline-flex items-start gap-1.5 text-[13px] font-semibold text-[color:var(--color-myntra-green)]">
          <Zap className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Yes — {DELIVERY_PROMISE_MINUTES}-minute delivery available here
            {result?.via === 'radius' && typeof result.distanceKm === 'number'
              ? ` (≈${result.distanceKm.toFixed(1)} km from our hub)`
              : ''}.
          </span>
        </p>
      )}

      {serviceable === false && (
        <p className="mt-2.5 inline-flex items-start gap-1.5 text-[13px] text-[color:var(--color-myntra-ink-soft)]">
          <Truck className="w-4 h-4 mt-0.5 shrink-0 text-[color:var(--color-myntra-navy)]" />
          <span>
            Not in our 40-minute zone yet — standard delivery applies
            <span className="hidden sm:inline"> (free over ₹1,999, else ₹99)</span>.
          </span>
        </p>
      )}

      {serviceable === null && variant === 'card' && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[color:var(--color-myntra-ink-mute)]">
          <MapPin className="w-3.5 h-3.5" /> Check if express delivery reaches you.
        </p>
      )}
    </div>
  );
};

export default DeliveryChecker;
