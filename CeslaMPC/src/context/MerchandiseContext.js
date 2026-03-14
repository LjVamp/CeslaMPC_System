// src/context/MerchandiseContext.js
// KEY FIX: Direct AsyncStorage write inside each action (not via useEffect)

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const DEFAULT_CATEGORIES = ['All', 'Shirts', 'Mugs', 'Tumbler', 'Bags', 'Pens', 'Caps', 'Umbrellas', 'Stufftoys', 'Others'];
const DEFAULT_ITEMS = [
  { id:'m1',  name:'CESLA Polo Shirt',    cat:'Shirts',    price:350, stock:20, emoji:'👕', image:null, sizes:['XS','S','M','L','XL','XXL'] },
  { id:'m2',  name:'CESLA T-Shirt',       cat:'Shirts',    price:250, stock:30, emoji:'👕', image:null, sizes:['XS','S','M','L','XL','XXL'] },
  { id:'m3',  name:'CESLA Polo (White)',   cat:'Shirts',    price:350, stock:15, emoji:'👔', image:null, sizes:['XS','S','M','L','XL','XXL'] },
  { id:'m4',  name:'CESLA Ceramic Mug',   cat:'Mugs',      price:180, stock:25, emoji:'☕', image:null },
  { id:'m5',  name:'CESLA Tumbler 500ml', cat:'Tumbler',   price:280, stock:22, emoji:'🥤', image:null },
  { id:'m6',  name:'CESLA Tote Bag',      cat:'Bags',      price:150, stock:40, emoji:'👜', image:null },
  { id:'m7',  name:'CESLA Backpack',      cat:'Bags',      price:650, stock:10, emoji:'🎒', image:null },
  { id:'m8',  name:'CESLA Ballpen',       cat:'Pens',      price:30,  stock:100,emoji:'🖊️', image:null },
  { id:'m9',  name:'CESLA Gel Pen Set',   cat:'Pens',      price:85,  stock:60, emoji:'✒️', image:null },
  { id:'m10', name:'CESLA Snapback Cap',  cat:'Caps',      price:280, stock:20, emoji:'🧢', image:null },
  { id:'m11', name:'CESLA Umbrella',      cat:'Umbrellas', price:320, stock:14, emoji:'☂️', image:null },
  { id:'m12', name:'CESLA Bear Stufftoy', cat:'Stufftoys', price:180, stock:10, emoji:'🧸', image:null },
  { id:'m13', name:'CESLA Keychain',      cat:'Others',    price:60,  stock:50, emoji:'🔑', image:null },
  { id:'m14', name:'CESLA Sticker Pack',  cat:'Others',    price:40,  stock:80, emoji:'🏷️', image:null },
];
const DEFAULT_ADS = [
  { id:'a1', image:null, imageUrl:'', title:"Today's Picks", sub:'Quality CESLA merchandise!', bg:['#1a3a6b','#2e5fa3'], emoji:'📦' },
  { id:'a2', image:null, imageUrl:'', title:'Special Offer',  sub:'Check our latest items!',   bg:['#7b3f00','#c9a84c'], emoji:'🎁' },
];
const KEYS = { items:'merch_items', ads:'merch_ads', orders:'merch_orders' };

const MerchandiseContext = createContext(null);

export const useMerchandise = () => {
  const ctx = useContext(MerchandiseContext);
  if (!ctx) throw new Error('useMerchandise must be inside MerchandiseProvider');
  return ctx;
};

export const MerchandiseProvider = ({ children }) => {
  const [items,  setItemsState]  = useState(DEFAULT_ITEMS);
  const [ads,    setAdsState]    = useState(DEFAULT_ADS);
  const [orders, setOrdersState] = useState([]);
  const [loaded, setLoaded]      = useState(false);

  const categories = DEFAULT_CATEGORIES;

  const itemsRef  = useRef(DEFAULT_ITEMS);
  const adsRef    = useRef(DEFAULT_ADS);
  const ordersRef = useRef([]);
  useEffect(() => { itemsRef.current  = items;  }, [items]);
  useEffect(() => { adsRef.current    = ads;    }, [ads]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  const reloadFromStorage = useCallback(async () => {
    try {
      const [rawItems, rawAds, rawOrders] = await Promise.all([
        AsyncStorage.getItem(KEYS.items),
        AsyncStorage.getItem(KEYS.ads),
        AsyncStorage.getItem(KEYS.orders),
      ]);
      if (rawItems)  setItemsState(JSON.parse(rawItems));
      if (rawAds)    setAdsState(JSON.parse(rawAds));
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

  // ── DIRECT WRITE ──────────────────────────────────────────────────────────
  const writeItems = (newItems) => {
    setItemsState(newItems);
    itemsRef.current = newItems;
    AsyncStorage.setItem(KEYS.items, JSON.stringify(newItems)).catch(() => {});
  };
  const writeAds = (newAds) => {
    setAdsState(newAds);
    adsRef.current = newAds;
    AsyncStorage.setItem(KEYS.ads, JSON.stringify(newAds)).catch(() => {});
  };
  const writeOrders = (newOrders) => {
    setOrdersState(newOrders);
    ordersRef.current = newOrders;
    AsyncStorage.setItem(KEYS.orders, JSON.stringify(newOrders)).catch(() => {});
  };

  const setItems = (val) => writeItems(typeof val === 'function' ? val(itemsRef.current) : val);
  const setAds   = (val) => writeAds(typeof val === 'function' ? val(adsRef.current) : val);
  const setOrders= (val) => writeOrders(typeof val === 'function' ? val(ordersRef.current) : val);

  const saveItem = (updated) => {
    const prev = itemsRef.current;
    const exists = prev.find(i => i.id === updated.id);
    writeItems(exists ? prev.map(i => i.id === updated.id ? updated : i) : [...prev, updated]);
  };
  const deleteItem = (id) => writeItems(itemsRef.current.filter(i => i.id !== id));
  const saveAd = (updated) => writeAds(adsRef.current.map(a => a.id === updated.id ? updated : a));
  const addOrder = (order) => writeOrders([order, ...ordersRef.current]);
  const updateOrderStatus = (orderId, status) =>
    writeOrders(ordersRef.current.map(o => o.id === orderId ? { ...o, status } : o));
  const deductStock = (orderItems) => {
    writeItems(itemsRef.current.map(item => {
      const ordered = orderItems.find(oi => oi.item.id === item.id);
      if (!ordered) return item;
      return { ...item, stock: Math.max(0, item.stock - ordered.qty) };
    }));
  };

  return (
    <MerchandiseContext.Provider value={{
      items, ads, categories, orders, loaded,
      setItems, setAds, setOrders,
      saveItem, deleteItem, saveAd,
      addOrder, updateOrderStatus, deductStock,
      reloadFromStorage,
    }}>
      {children}
    </MerchandiseContext.Provider>
  );
};