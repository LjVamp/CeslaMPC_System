// src/context/CanteenContext.js
// Shared state between ManageCanteenScreen (admin) and CanteenVisitor (users)
// Uses AsyncStorage to persist changes across sessions

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  { id:'1', image:null, imageUrl:'', title:"Today's Special", sub:'Fresh meals served daily!',   bg:['#1a3a6b','#2e5fa3'], emoji:'🍽️' },
  { id:'2', image:null, imageUrl:'', title:'Merienda Promo',  sub:'Snacks & drinks available!', bg:['#7b3f00','#c9a84c'], emoji:'☕'  },
];

// ─── CONTEXT ──────────────────────────────────────────────────────────────────
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

  // ── reloadFromStorage — callable by any screen via useFocusEffect ─────────
  // This is the KEY fix for Expo Go mobile: screens call this every time they
  // come into focus so they always show the latest AsyncStorage data.
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

  // Load on mount
  useEffect(() => {
    reloadFromStorage().then(() => setLoaded(true));
  }, []);

  // ── Persist to AsyncStorage whenever state changes (after load) ───────────
  // useEffect-based persist avoids stale-closure bugs entirely.
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem('canteen_items', JSON.stringify(items)).catch(() => {});
  }, [items, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem('canteen_ads', JSON.stringify(ads)).catch(() => {});
  }, [ads, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem('canteen_categories', JSON.stringify(categories)).catch(() => {});
  }, [categories, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem('canteen_orders', JSON.stringify(orders)).catch(() => {});
  }, [orders, loaded]);

  // ── State setters — always use functional updater for latest state ─────────
  const setItems      = (val) => setItemsState(prev => typeof val === 'function' ? val(prev) : val);
  const setAds        = (val) => setAdsState(prev   => typeof val === 'function' ? val(prev) : val);
  const setCategories = (val) => setCatsState(prev  => typeof val === 'function' ? val(prev) : val);
  const setOrders     = (val) => setOrdersState(prev=> typeof val === 'function' ? val(prev) : val);

  // ── Item actions ──────────────────────────────────────────────────────────
  const saveItem = (updated) => {
    setItems(prev => {
      const exists = prev.find(i => i.id === updated.id);
      return exists ? prev.map(i => i.id === updated.id ? updated : i) : [...prev, updated];
    });
  };
  const deleteItem = (id) => setItems(prev => prev.filter(i => i.id !== id));

  // ── Ad actions ────────────────────────────────────────────────────────────
  const saveAd = (updated) => setAds(prev => prev.map(a => a.id === updated.id ? updated : a));

  // ── Order actions ─────────────────────────────────────────────────────────
  const addOrder = (order) => setOrders(prev => [order, ...prev]);
  const updateOrderStatus = (orderId, status) =>
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));

  // ── Stock deduct when order placed ───────────────────────────────────────
  const deductStock = (orderItems) => {
    setItems(prev => prev.map(item => {
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