import React, { createContext, useContext, useEffect, useState } from 'react';
import { Order } from '../types';

const STORAGE_KEY = 'tresor-orders-v1';

interface OrderContextValue {
  orders: Order[];
  addOrder: (order: Order) => void;
  getOrder: (id: string) => Order | undefined;
}

const OrderContext = createContext<OrderContextValue | null>(null);

const loadOrders = (): Order[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
};

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>(() => loadOrders());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      /* ignore quota errors */
    }
  }, [orders]);

  const addOrder = (order: Order) => setOrders(prev => [order, ...prev]);
  const getOrder = (id: string) => orders.find(o => o.id === id);

  return (
    <OrderContext.Provider value={{ orders, addOrder, getOrder }}>{children}</OrderContext.Provider>
  );
};

export const useOrders = () => {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrders must be used inside OrderProvider');
  return ctx;
};
