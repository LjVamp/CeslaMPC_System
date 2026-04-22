// src/context/GroceryContext.js
// CESLA MPC — Grocery Context
// Provides grocery items, categories, ads, live orders and CRUD for grocery screens

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc,
  doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const GroceryContext = createContext(null);

export function GroceryProvider({ children }) {
  const [items,      setItems]      = useState([]);
  const [ads,        setAds]        = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [orders,     setOrders]     = useState([]);

  // ── Live grocery items ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'grocery_items'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(docs);
      // Derive ordered categories from items
      const seen = new Set();
      const cats = ['All'];
      docs.forEach(i => {
        if (i.cat && !seen.has(i.cat)) { seen.add(i.cat); cats.push(i.cat); }
      });
      setCategories(cats);
    }, err => console.warn('grocery_items snapshot error:', err.message));
    return () => unsub();
  }, []);

  // ── Live grocery ads ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'grocery_ads'), snap => {
      setAds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('grocery_ads snapshot error:', err.message));
    return () => unsub();
  }, []);

  // ── Live grocery orders (for queue status tracking) ───────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'grocery_orders'), snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, docId: d.id, ...d.data() })));
    }, err => console.warn('grocery_orders snapshot error:', err.message));
    return () => unsub();
  }, []);

  // ── Add order to Firestore → returns doc ID ────────────────────────────────
  const addOrder = async (order) => {
    try {
      const ref = await addDoc(collection(db, 'grocery_orders'), {
        ...order,
        createdAt: serverTimestamp(),
        status: order.status || 'pending',
      });
      return ref.id;
    } catch (e) {
      console.warn('addOrder (grocery) error:', e.message);
      return null;
    }
  };

  // ── Deduct stock from grocery_items ────────────────────────────────────────
  const deductStock = async (orderItems) => {
    try {
      for (const { item, qty } of orderItems) {
        if (!item?.id) continue;
        const newStock = Math.max(0, (item.stock ?? 0) - qty);
        await updateDoc(doc(db, 'grocery_items', item.id), { stock: newStock });
      }
    } catch (e) {
      console.warn('deductStock (grocery) error:', e.message);
    }
  };

  // ── No-op reload — data is live via onSnapshot ─────────────────────────────
  const reloadFromStorage = () => {};

  return (
    <GroceryContext.Provider
      value={{ items, ads, categories, orders, addOrder, deductStock, reloadFromStorage }}
    >
      {children}
    </GroceryContext.Provider>
  );
}

export function useGrocery() {
  const ctx = useContext(GroceryContext);
  if (!ctx) throw new Error('useGrocery must be used within a GroceryProvider');
  return ctx;
}
