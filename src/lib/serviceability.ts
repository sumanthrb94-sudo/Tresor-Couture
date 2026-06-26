/**
 * 40-minute hyperlocal delivery — serviceability core.
 *
 * Two independent signals decide whether an address qualifies for 40-minute
 * delivery, and EITHER passing is enough:
 *
 *   1. PINCODE  — the entered/derived 6-digit PIN is on the serviceable list.
 *   2. RADIUS   — the customer's geolocation (lat/lng from the browser
 *                 "use my location" request) falls within DELIVERY_RADIUS_KM
 *                 of the store hub. No external geocoding API is used.
 *
 * Anything that doesn't qualify is NOT blocked — it simply falls back to
 * standard courier shipping (handled by the existing shipping calc). 40-minute
 * delivery is an extra perk shown only when eligible.
 *
 * The serviceable pincode list is admin-editable in Firestore
 * (`config/delivery`); this module ships a seed fallback so the feature works
 * before any admin edit and if the config read fails.
 */

/** Store hub — central Hyderabad. Adjust to the real dark-store coordinates. */
export const STORE_HUB = { lat: 17.4239, lng: 78.4738, label: 'Hyderabad Hub' };

/** Radius (km) within which geolocation alone qualifies for 40-min delivery. */
export const DELIVERY_RADIUS_KM = 12;

/** Promised delivery window, surfaced in the UI copy. */
export const DELIVERY_PROMISE_MINUTES = 40;

/**
 * Seed serviceable pincode list — a representative central-Hyderabad set.
 * This is a STARTER list; the real catchment is maintained by admins in
 * Firestore `config/delivery.pincodes`. Kept here as the offline fallback.
 */
export const SEED_SERVICEABLE_PINCODES: string[] = [
  '500001', '500002', '500003', '500004', '500006', '500008', '500009',
  '500016', '500018', '500026', '500028', '500029', '500033', '500034',
  '500035', '500036', '500038', '500044', '500045', '500048', '500057',
  '500059', '500061', '500063', '500070', '500072', '500073', '500081',
  '500082', '500084', '500089', '500096',
];

export interface ServiceabilityResult {
  serviceable: boolean;
  /** Which signal qualified it (for messaging + analytics). */
  via: 'pincode' | 'radius' | null;
  /** Straight-line distance from the hub in km, when geolocation was used. */
  distanceKm?: number;
  /** The pincode that was checked, if any. */
  pincode?: string;
  etaMinutes: number;
}

const PIN_RE = /^[1-9]\d{5}$/;

export function isValidPincode(pin: string): boolean {
  return PIN_RE.test(pin.trim());
}

/** Haversine great-circle distance in kilometres. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371; // Earth radius, km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Pincode check against a (possibly admin-overridden) serviceable set. */
export function isPincodeServiceable(pin: string, list: string[] = SEED_SERVICEABLE_PINCODES): boolean {
  if (!isValidPincode(pin)) return false;
  return list.includes(pin.trim());
}

/** Radius check from the browser's geolocation against the store hub. */
export function isWithinDeliveryRadius(coords: { lat: number; lng: number }): { ok: boolean; distanceKm: number } {
  const distanceKm = haversineKm(STORE_HUB, coords);
  return { ok: distanceKm <= DELIVERY_RADIUS_KM, distanceKm };
}

/**
 * Resolve serviceability from whatever signals we have. EITHER a serviceable
 * pincode OR a geolocation inside the radius qualifies.
 */
export function checkServiceability(input: {
  pincode?: string;
  coords?: { lat: number; lng: number };
  pincodeList?: string[];
}): ServiceabilityResult {
  const { pincode, coords, pincodeList } = input;

  if (coords) {
    const { ok, distanceKm } = isWithinDeliveryRadius(coords);
    if (ok) {
      return { serviceable: true, via: 'radius', distanceKm, pincode, etaMinutes: DELIVERY_PROMISE_MINUTES };
    }
    // Geolocation present but outside radius — still let pincode try below.
    if (pincode && isPincodeServiceable(pincode, pincodeList)) {
      return { serviceable: true, via: 'pincode', distanceKm, pincode, etaMinutes: DELIVERY_PROMISE_MINUTES };
    }
    return { serviceable: false, via: null, distanceKm, pincode, etaMinutes: DELIVERY_PROMISE_MINUTES };
  }

  if (pincode && isPincodeServiceable(pincode, pincodeList)) {
    return { serviceable: true, via: 'pincode', pincode, etaMinutes: DELIVERY_PROMISE_MINUTES };
  }

  return { serviceable: false, via: null, pincode, etaMinutes: DELIVERY_PROMISE_MINUTES };
}

/** Promise-based wrapper around the browser geolocation API. */
export function requestGeolocation(opts: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('geolocation_unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(new Error(err.code === err.PERMISSION_DENIED ? 'permission_denied' : 'position_unavailable')),
      opts,
    );
  });
}
