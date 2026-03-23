// src/context/BillingContext.js
// CESLA MPC — Billing Monitoring System Context
// Firebase Firestore integration for all 5 billing categories

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export const DEPARTMENTS = [
  'ADMIN', 'ACCTING', 'NON-LIFE', 'MKTG', 'CLAIMS',
  'IT', 'CARES', 'UNDERWRITING', 'FINANCE', 'OOP',
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const CATEGORIES = [
  { key: 'freelunch',      label: 'Free Lunch',       icon: '🍱' },
  { key: 'riceallowances', label: 'Rice Allowances',  icon: '🌾' },
  { key: 'waterbilling',   label: 'Water Billing',    icon: '💧' },
  { key: 'milkbeans',      label: 'Milk & Beans',     icon: '🥛' },
  { key: 'ticket',         label: 'Ticket',           icon: '🎫' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
export const fmt = (n) =>
  '₱ ' + Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

export const fmtDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
};

export const todayVal = () => new Date().toISOString().split('T')[0];

// ─── CONTEXT ──────────────────────────────────────────────────────────────────
const BillingContext = createContext(null);

export function BillingProvider({ children }) {
  const [entries, setEntries]       = useState([]);   // all Firestore entries
  const [loading, setLoading]       = useState(true);
  const [settings, setSettingsState] = useState({
    preparedBy: '', preparedTitle: '', checkedBy: '', checkedTitle: '',
  });

  // ── Real-time listener ───────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'billingEntries'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEntries(docs);
      setLoading(false);
    }, (err) => {
      console.warn('Billing listener error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Settings listener ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'billingSettings', 'main'), (snap) => {
      if (snap.exists()) setSettingsState(snap.data());
    });
    return () => unsub();
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const addEntry = useCallback(async (entryData) => {
    try {
      const d = new Date((entryData.date || todayVal()) + 'T00:00:00');
      const entryMonth = d.getMonth();
      const entryYear  = d.getFullYear();
      await addDoc(collection(db, 'billingEntries'), {
        ...entryData,
        month: entryMonth,
        year:  entryYear,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('addEntry error:', e);
      throw e;
    }
  }, []);

  const updateEntry = useCallback(async (id, updates) => {
    try {
      // Recalculate month/year if date changed
      if (updates.date) {
        const d = new Date(updates.date + 'T00:00:00');
        updates.month = d.getMonth();
        updates.year  = d.getFullYear();
      }
      await updateDoc(doc(db, 'billingEntries', id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('updateEntry error:', e);
      throw e;
    }
  }, []);

  const deleteEntry = useCallback(async (id) => {
    if (!id) throw new Error('No entry ID provided.');
    await deleteDoc(doc(db, 'billingEntries', id));
  }, []);

  const toggleStatus = useCallback(async (id, currentStatus) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    await updateDoc(doc(db, 'billingEntries', id), { status: newStatus });
  }, []);

  const saveSettings = useCallback(async (newSettings) => {
    try {
      await updateDoc(doc(db, 'billingSettings', 'main'), newSettings);
      setSettingsState(newSettings);
    } catch {
      // doc may not exist yet
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'billingSettings', 'main'), newSettings);
      setSettingsState(newSettings);
    }
  }, []);

  // ── Filtered getters ──────────────────────────────────────────────────────

  const getEntries = useCallback((cat, year, month, dept) => {
    return entries.filter(e =>
      e.category === cat &&
      e.year     === year &&
      e.month    === month &&
      e.dept     === dept
    );
  }, [entries]);

  const getEntriesByDate = useCallback((cat, year, month, date) => {
    return entries.filter(e =>
      e.category === cat &&
      e.year     === year &&
      e.month    === month &&
      e.date     === date
    );
  }, [entries]);

  const getCategoryTotal = useCallback((cat, year, month) => {
    return entries
      .filter(e => e.category === cat && e.year === year && e.month === month)
      .reduce((s, e) => s + (e.amount || 0), 0);
  }, [entries]);

  const getYearTotal = useCallback((cat, year) => {
    return entries
      .filter(e => e.category === cat && e.year === year)
      .reduce((s, e) => s + (e.amount || 0), 0);
  }, [entries]);

  // ── Unique dates per category/month ──────────────────────────────────────
  const getUniqueDates = useCallback((cat, year, month) => {
    const set = new Set();
    entries
      .filter(e => e.category === cat && e.year === year && e.month === month && e.date)
      .forEach(e => set.add(e.date));
    return [...set].sort();
  }, [entries]);

  return (
    <BillingContext.Provider value={{
      entries, loading, settings,
      addEntry, updateEntry, deleteEntry, toggleStatus, saveSettings,
      getEntries, getEntriesByDate, getCategoryTotal, getYearTotal, getUniqueDates,
      fmt, fmtDate, todayVal,
    }}>
      {children}
    </BillingContext.Provider>
  );
}

export const useBilling = () => {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error('useBilling must be used within BillingProvider');
  return ctx;
};