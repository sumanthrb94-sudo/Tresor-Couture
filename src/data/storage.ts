/**
 * Async repository pattern, localStorage-backed.
 *
 * Every call returns a Promise so swapping to a fetch-based backend
 * later is a one-file change. Mutations dispatch a `storage` event so
 * other tabs and React hooks re-render.
 *
 * Conventions:
 *  - Each store lives under a unique localStorage key.
 *  - Stores hold a JSON array of records with a string `id`.
 *  - `seed` is called lazily on first access and is idempotent.
 */

export interface BaseRecord {
  id: string;
}

const PREFIX = 'tresor:';

type Listener = () => void;

class Store<T extends BaseRecord> {
  private listeners = new Set<Listener>();

  constructor(
    private readonly key: string,
    private readonly seeder?: () => T[]
  ) {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', e => {
        if (e.key === this.fullKey) this.emit();
      });
    }
  }

  private get fullKey() {
    return PREFIX + this.key;
  }

  private read(): T[] {
    if (typeof window === 'undefined') return this.seeder?.() ?? [];
    try {
      const raw = window.localStorage.getItem(this.fullKey);
      if (raw === null) {
        const seeded = this.seeder?.() ?? [];
        window.localStorage.setItem(this.fullKey, JSON.stringify(seeded));
        return seeded;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private write(rows: T[]) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(this.fullKey, JSON.stringify(rows));
    this.emit();
  }

  private emit() {
    this.listeners.forEach(l => l());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async list(): Promise<T[]> {
    return this.read();
  }

  async get(id: string): Promise<T | undefined> {
    return this.read().find(r => r.id === id);
  }

  async create(record: T): Promise<T> {
    const rows = this.read();
    if (rows.some(r => r.id === record.id)) {
      throw new Error(`Duplicate id: ${record.id}`);
    }
    const next = [...rows, record];
    this.write(next);
    return record;
  }

  async upsert(record: T): Promise<T> {
    const rows = this.read();
    const idx = rows.findIndex(r => r.id === record.id);
    const next = idx === -1 ? [...rows, record] : rows.map((r, i) => (i === idx ? record : r));
    this.write(next);
    return record;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const rows = this.read();
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`Not found: ${id}`);
    const next = { ...rows[idx], ...patch, id: rows[idx].id };
    const updated = rows.map((r, i) => (i === idx ? next : r));
    this.write(updated);
    return next;
  }

  async remove(id: string): Promise<void> {
    const rows = this.read();
    this.write(rows.filter(r => r.id !== id));
  }

  async replaceAll(rows: T[]): Promise<void> {
    this.write(rows);
  }
}

import { Fabric, Order, User, Coupon, Review } from '../types';
import { FABRICS as SEED_FABRICS } from '../constants';

export const fabricsStore = new Store<Fabric>('fabrics:v1', () => SEED_FABRICS);
export const ordersStore = new Store<Order>('orders:v2');
export const usersStore = new Store<User>('users:v1');
export const couponsStore = new Store<Coupon & BaseRecord>('coupons:v1', () => seedCoupons());
export const reviewsStore = new Store<Review>('reviews:v1');

/* Coupon code IS the id — keep both in sync via this small adapter. */
function couponSeed(code: string, partial: Omit<Coupon, 'code' | 'active'>): Coupon & BaseRecord {
  return { id: code, code, active: true, ...partial };
}

function seedCoupons(): (Coupon & BaseRecord)[] {
  return [
    couponSeed('WEDDING50', {
      description: 'Flat 10% off bridal silks',
      kind: 'percent',
      value: 10,
      minSubtotal: 0,
      maxDiscount: 5000
    }),
    couponSeed('UPI10', {
      description: 'Extra 5% cashback on UPI payments',
      kind: 'percent',
      value: 5,
      minSubtotal: 0,
      maxDiscount: 2000
    }),
    couponSeed('FIRST500', {
      description: '₹500 off your first order over ₹2,999',
      kind: 'flat',
      value: 500,
      minSubtotal: 2999
    })
  ];
}

