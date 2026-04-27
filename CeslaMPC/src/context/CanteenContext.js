// src/context/CanteenContext.js
// Firestore real-time sync — replaces AsyncStorage

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot,
  setDoc, deleteDoc, updateDoc,
  addDoc, writeBatch, getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = ['All', 'Meals', 'Drinks', 'Snacks', 'Junk Foods', 'Others'];

const DEFAULT_ITEMS = [
  { id:'1',  name:'Fried Chicken',  cat:'Meals',      price:80,  stock:15, emoji:'🍗', image:null },
  { id:'2',  name:'Lugaw with Egg', cat:'Meals',      price:55,  stock:50, emoji:'🍚', image:null },
  { id:'3',  name:'Pancit Canton',  cat:'Meals',      price:65,  stock:25, emoji:'🍜', image:null },
  { id:'4',  name:'Pork Adobo',     cat:'Meals',      price:75,  stock:20, emoji:'🥩', image:null },
  { id:'5',  name:'Sinangag',       cat:'Meals',      price:30,  stock:30, emoji:'🍳', image:null },
  { id:'6',  name:'Bottled Water',  cat:'Drinks',     price:15,  stock:80, emoji:'💧', image:null },
  { id:'7',  name:'Juice',          cat:'Drinks',     price:20,  stock:60, emoji:'🧃', image:null },
  { id:'8',  name:'Softdrinks',     cat:'Drinks',     price:25,  stock:100,emoji:'🥤', image:null },
  { id:'9',  name:'Biscuit',        cat:'Snacks',     price:15,  stock:40, emoji:'🍪', image:null },
  { id:'10', name:'Chips',          cat:'Snacks',     price:20,  stock:50, emoji:'🍟', image:null },
  { id:'11', name:'Junk Food Pack', cat:'Junk Foods', price:18,  stock:45, emoji:'🍿', image:null },
  { id:'12', name:'Mixed Nuts',     cat:'Junk Foods', price:35,  stock:30, emoji:'🥜', image:null },
];

const DEFAULT_ADS = [
  { id:'ca1', image:null, imageUrl:'', title:"Today's Special", sub:'Fresh meals served daily!',   bg:['#1a3a6b','#2e5fa3'], emoji:'🍽️' },
  { id:'ca2', image:null, imageUrl:'', title:'Merienda Promo',  sub:'Snacks & drinks available!', bg:['#7b3f00','#c9a84c'], emoji:'☕'  },
];

// ─── SEED FIRESTORE (runs once if collections are empty) ──────────────────────
const seedIfEmpty = async () => {
  try {
    const itemsSnap = await getDocs(collection(db, 'canteen_items'));
    if (itemsSnap.empty) {
      const batch = writeBatch(db);
      DEFAULT_ITEMS.forEach(item => batch.set(doc(db, 'canteen_items', item.id), item));
      await batch.commit();
      console.log('Seeded canteen_items');
    }
    const adsSnap = await getDocs(collection(db, 'canteen_ads'));
    if (adsSnap.empty) {
      const batch = writeBatch(db);
      DEFAULT_ADS.forEach(ad => batch.set(doc(db, 'canteen_ads', ad.id), ad));
      await batch.commit();
      console.log('Seeded canteen_ads');
    }
  } catch (e) { console.warn('Canteen seed error:', e); }
};

// ─── CONTEXT ──────────────────────────────────────────────────────────────────
const CanteenContext = createContext(null);

export const useCanteen = () => {
  const ctx = useContext(CanteenContext);
  if (!ctx) throw new Error('useCanteen must be inside CanteenProvider');
  return ctx;
};

export const CanteenProvider = ({ children }) => {
  const [items,      setItemsState]  = useState([]);
  const [ads,        setAdsState]    = useState([]);
  const [categories, setCatsState]   = useState(DEFAULT_CATEGORIES);
  const [orders,     setOrdersState] = useState([]);
  const [loaded,     setLoaded]      = useState(false);

  // ── Attach real-time Firestore listeners immediately, seed in parallel ──────
  useEffect(() => {
    // Seed runs in background — listeners start RIGHT AWAY so orders are never missed
    seedIfEmpty().catch(e => console.warn('seed error (non-fatal):', e));

    const toMs = (v) => {
      if (!v) return 0;
      if (typeof v?.toMillis === 'function') return v.toMillis();
      if (typeof v?.toDate  === 'function') return v.toDate().getTime();
      if (typeof v === 'number') return v;
      return new Date(v).getTime() || 0;
    };

    // Items — sorted by numeric id
    const unsubItems = onSnapshot(
      collection(db, 'canteen_items'),
      snap => {
        const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        data.sort((a, b) => (parseInt(a.id) || 999) - (parseInt(b.id) || 999));
        setItemsState(data);
        setLoaded(true);
      },
      err => console.warn('canteen items error:', err)
    );

    // Ads
    const unsubAds = onSnapshot(
      collection(db, 'canteen_ads'),
      snap => setAdsState(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
      err => console.warn('canteen ads error:', err)
    );

    // Orders — sorted newest first by createdAt, handles Firestore Timestamp + Date.now()
    const unsubOrders = onSnapshot(
      collection(db, 'canteen_orders'),
      snap => {
        const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        data.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
        setOrdersState(data);
      },
      err => console.warn('canteen orders error:', err)
    );

    return () => {
      unsubItems();
      unsubAds();
      unsubOrders();
    };
  }, []);

  // ── CRUD operations ───────────────────────────────────────────────────────
  const saveItem = async (item) => {
    try { await setDoc(doc(db, 'canteen_items', item.id), item); }
    catch (e) { console.warn('saveItem error:', e); }
  };

  const deleteItem = async (id) => {
    try { await deleteDoc(doc(db, 'canteen_items', id)); }
    catch (e) { console.warn('deleteItem error:', e); }
  };

  const saveAd = async (ad) => {
    try {
      // Strip undefined values before saving to Firestore
      const clean = Object.fromEntries(
        Object.entries(ad).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'canteen_ads', clean.id), clean);
      console.log('Ad saved to Firestore:', clean.id, clean.title);
    }
    catch (e) { console.warn('saveAd error:', e); }
  };

  const addOrder = async (order) => {
    try {
      const docRef = await addDoc(collection(db, 'canteen_orders'), {
        ...order,
        createdAt: Date.now(),
      });
      return docRef.id; // Return Firestore doc ID for order tracking
    } catch (e) { console.warn('addOrder error:', e); return null; }
  };

  const updateOrderStatus = async (orderId, status) => {
    try { await updateDoc(doc(db, 'canteen_orders', orderId), { status }); }
    catch (e) { console.warn('updateOrderStatus error:', e); }
  };

  const deductStock = async (orderItems) => {
    try {
      const batch = writeBatch(db);
      orderItems.forEach(({ item, qty }) => {
        batch.update(doc(db, 'canteen_items', item.id), {
          stock: Math.max(0, (item.stock || 0) - qty),
        });
      });
      await batch.commit();
    } catch (e) { console.warn('deductStock error:', e); }
  };

  // Setters used by ManageCanteenScreen for ads
  const setItems = async (val) => {
    const next = typeof val === 'function' ? val(items) : val;
    const batch = writeBatch(db);
    next.forEach(item => batch.set(doc(db, 'canteen_items', item.id), item));
    await batch.commit().catch(e => console.warn('setItems error:', e));
  };

  const setAds = (val) => {
    const next = typeof val === 'function' ? val(ads) : val;
    // Save each ad to Firestore
    next.forEach(ad =>
      setDoc(doc(db, 'canteen_ads', ad.id), ad).catch(e => console.warn('setAds error:', e))
    );
    // Also remove any ads that were deleted
    ads.forEach(ad => {
      if (!next.find(a => a.id === ad.id)) {
        deleteDoc(doc(db, 'canteen_ads', ad.id)).catch(() => {});
      }
    });
  };

  const setCategories = (val) => setCatsState(prev => typeof val === 'function' ? val(prev) : val);
  const setOrders = (val) => { /* no-op — Firestore handles order writes */ };

  // no-op — Firestore listeners are always live
  const reloadFromStorage = useCallback(() => {}, []);

  return (
    <CanteenContext.Provider value={{
      items, ads, categories, orders, loaded,
      setItems, setAds, setCategories, setOrders,
      saveItem, deleteItem, saveAd,
      addOrder, updateOrderStatus, deductStock,
      reloadFromStorage,
    }}>
      {children}
    </CanteenContext.Provider>
  );
};