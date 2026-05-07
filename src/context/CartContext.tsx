import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CartItem, Fabric } from '../types';
import { FABRICS, FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT_RATE, TAX_RATE } from '../constants';

const STORAGE_KEY = 'tresor-cart-v1';

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateMeters: (fabricId: string, color: string | undefined, meters: number) => void;
  removeItem: (fabricId: string, color: string | undefined) => void;
  clear: () => void;
  itemCount: number;
  meterCount: number;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  resolved: { item: CartItem; fabric: Fabric }[];
}

const CartContext = createContext<CartContextValue | null>(null);

const loadCart = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
};

const sameLine = (a: CartItem, b: CartItem) =>
  a.fabricId === b.fabricId && (a.color ?? '') === (b.color ?? '');

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota errors */
    }
  }, [items]);

  const addItem = (incoming: CartItem) => {
    setItems(prev => {
      const idx = prev.findIndex(i => sameLine(i, incoming));
      if (idx === -1) return [...prev, incoming];
      const next = [...prev];
      next[idx] = { ...next[idx], meters: next[idx].meters + incoming.meters };
      return next;
    });
  };

  const updateMeters = (fabricId: string, color: string | undefined, meters: number) => {
    setItems(prev =>
      prev
        .map(i => (sameLine(i, { fabricId, color, meters }) ? { ...i, meters } : i))
        .filter(i => i.meters > 0)
    );
  };

  const removeItem = (fabricId: string, color: string | undefined) => {
    setItems(prev => prev.filter(i => !sameLine(i, { fabricId, color, meters: 0 })));
  };

  const clear = () => setItems([]);

  const value = useMemo<CartContextValue>(() => {
    const resolved = items
      .map(item => {
        const fabric = FABRICS.find(f => f.id === item.fabricId);
        return fabric ? { item, fabric } : null;
      })
      .filter((x): x is { item: CartItem; fabric: Fabric } => x !== null);

    const subtotal = resolved.reduce((sum, { item, fabric }) => sum + item.meters * fabric.pricePerMeter, 0);
    const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
    const tax = Math.round(subtotal * TAX_RATE);
    const total = subtotal + shipping + tax;
    const itemCount = resolved.length;
    const meterCount = resolved.reduce((sum, { item }) => sum + item.meters, 0);

    return {
      items,
      addItem,
      updateMeters,
      removeItem,
      clear,
      itemCount,
      meterCount,
      subtotal,
      shipping,
      tax,
      total,
      resolved
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};
