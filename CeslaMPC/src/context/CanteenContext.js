// src/context/CanteenContext.js
// KEY FIX: Direct AsyncStorage write inside each action (not via useEffect)
// This ensures data is written BEFORE any screen polls and reads it.
// All screens share the same Context instance — React state updates propagate instantly.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

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
  { id:'1', image:null, imageUrl:'', title:"Today's Special", sub:'Fresh meals served daily!',   bg:['#1a3a6b','#2e5fa3'], emoji:'🍽️' },
  { id:'2', image:null, imageUrl:'', title:'Merienda Promo',  sub:'Snacks & drinks available!', bg:['#7b3f00','#c9a84c'], emoji:'☕'  },
];

const CanteenContext = createContext(null);

export const useCanteen = () => {
  const ctx = useContext(CanteenContext);
  if (!ctx) throw new Error('useCanteen must be inside CanteenProvider');
  return ctx;
};

export const CanteenProvider = ({ children }) => {
  const [items,      setItemsState]  = useState(DEFAULT_ITEMS);
  const [ads,        setAdsState]    = useState(DEFAULT_ADS);
  const [categories, setCatsState]   = useState(DEFAULT_CATEGORIES);
  const [orders,     setOrdersState] = useState([]);
  const [loaded,     setLoaded]      = useState(false);

  // Refs to always have latest values without stale closure
  const itemsRef  = useRef(DEFAULT_ITEMS);
  const adsRef    = useRef(DEFAULT_ADS);
  const ordersRef = useRef([]);
  useEffect(() => { itemsRef.current  = items;  }, [items]);
  useEffect(() => { adsRef.current    = ads;    }, [ads]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  // ── Reload from AsyncStorage ──────────────────────────────────────────────
  const reloadFromStorage = useCallback(async () => {
    try {
      const [rawItems, rawAds, rawCats, rawOrders] = await Promise.all([
        AsyncStorage.getItem('canteen_items'),
        AsyncStorage.getItem('canteen_ads'),
        AsyncStorage.getItem('canteen_categories'),
        AsyncStorage.getItem('canteen_orders'),
      ]);
      if (rawItems)  setItemsState(JSON.parse(rawItems));
      if (rawAds)    setAdsState(JSON.parse(rawAds));
      if (rawCats)   setCatsState(JSON.parse(rawCats));
      if (rawOrders) setOrdersState(JSON.parse(rawOrders));
    } catch (e) {}
  }, []);

  useEffect(() => {
    reloadFromStorage().then(() => setLoaded(true));
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') reloadFromStorage();
    });
    return () => sub.remove();
  }, []);

  // ── DIRECT WRITE: update state AND AsyncStorage atomically ────────────────
  // No useEffect delay — storage is written immediately so any screen polling
  // will see the new data on the very next read.
  const writeItems = (newItems) => {
    setItemsState(newItems);
    itemsRef.current = newItems;
    AsyncStorage.setItem('canteen_items', JSON.stringify(newItems)).catch(() => {});
  };
  const writeAds = (newAds) => {
    setAdsState(newAds);
    adsRef.current = newAds;
    AsyncStorage.setItem('canteen_ads', JSON.stringify(newAds)).catch(() => {});
  };
  const writeOrders = (newOrders) => {
    setOrdersState(newOrders);
    ordersRef.current = newOrders;
    AsyncStorage.setItem('canteen_orders', JSON.stringify(newOrders)).catch(() => {});
  };

  // ── Setters (for components that use setItems/setAds directly) ────────────
  const setItems = (val) => {
    const next = typeof val === 'function' ? val(itemsRef.current) : val;
    writeItems(next);
  };
  const setAds = (val) => {
    const next = typeof val === 'function' ? val(adsRef.current) : val;
    writeAds(next);
  };
  const setCategories = (val) => setCatsState(prev => typeof val === 'function' ? val(prev) : val);
  const setOrders = (val) => {
    const next = typeof val === 'function' ? val(ordersRef.current) : val;
    writeOrders(next);
  };

  // ── Item actions ──────────────────────────────────────────────────────────
  const saveItem = (updated) => {
    const prev = itemsRef.current;
    const exists = prev.find(i => i.id === updated.id);
    writeItems(exists ? prev.map(i => i.id === updated.id ? updated : i) : [...prev, updated]);
  };
  const deleteItem = (id) => writeItems(itemsRef.current.filter(i => i.id !== id));

  // ── Ad actions ────────────────────────────────────────────────────────────
  const saveAd = (updated) => writeAds(adsRef.current.map(a => a.id === updated.id ? updated : a));

  // ── Order actions ─────────────────────────────────────────────────────────
  const addOrder = (order) => writeOrders([order, ...ordersRef.current]);
  const updateOrderStatus = (orderId, status) =>
    writeOrders(ordersRef.current.map(o => o.id === orderId ? { ...o, status } : o));

  // ── Stock deduct ──────────────────────────────────────────────────────────
  const deductStock = (orderItems) => {
    writeItems(itemsRef.current.map(item => {
      const ordered = orderItems.find(oi => oi.item.id === item.id);
      if (!ordered) return item;
      return { ...item, stock: Math.max(0, item.stock - ordered.qty) };
    }));
  };

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