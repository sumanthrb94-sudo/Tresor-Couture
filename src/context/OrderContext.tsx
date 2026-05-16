import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Order, PaymentMethod, ShippingAddress } from '../types';
import { ordersApi } from '../lib/firebase';
import { useAuth } from './AuthContext';

export interface PlaceOrderInput {
  items: { fabricId: string; meters: number; color?: string }[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  couponCode?: string;
}

interface OrderContextValue {
  orders: Order[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  placeOrder: (input: PlaceOrderInput) => Promise<Order>;
  getById: (id: string) => Order | undefined;
}

const OrderContext = createContext<OrderContextValue | null>(null);

// Firestore stores DocumentData; coerce to Order shape. The API guarantees
// the field set, so a cast is safe enough here.
const asOrder = (raw: unknown): Order => raw as Order;

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setOrders([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await ordersApi.mine();
      setOrders(rows.map(asOrder));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your orders.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const placeOrder = useCallback(async (input: PlaceOrderInput) => {
    const placed = asOrder(await ordersApi.place(input));
    // Optimistically prepend so the Account/Orders screen reflects the
    // new row immediately, even before the next refresh cycle.
    setOrders(prev => [placed, ...prev.filter(o => o.id !== placed.id)]);
    return placed;
  }, []);

  const getById = useCallback((id: string) => orders.find(o => o.id === id), [orders]);

  return (
    <OrderContext.Provider value={{ orders, loading, error, refresh, placeOrder, getById }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrders must be used inside OrderProvider');
  return ctx;
};
