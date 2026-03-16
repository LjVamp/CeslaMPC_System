// src/context/MerchandiseContext.js
// Firestore real-time sync — replaces AsyncStorage

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot,
  setDoc, deleteDoc, updateDoc,
  addDoc, writeBatch, getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const DEFAULT_ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const DEFAULT_KIDS_SIZES  = ['2T', '3T', '4T', '5T', '6', '8', '10', '12', '14'];
const DEFAULT_ALL_SIZES   = [...DEFAULT_ADULT_SIZES, ...DEFAULT_KIDS_SIZES];
const APPAREL_CATS        = ['Shirts', 'Caps'];

export const defaultSizesForCat = (cat) =>
  APPAREL_CATS.includes(cat) ? [...DEFAULT_ALL_SIZES] : [];

const DEFAULT_CATEGORIES = [
  'All', 'Shirts', 'Mugs', 'Tumbler', 'Bags',
  'Pens', 'Caps', 'Umbrellas', 'Stufftoys', 'Others',
];

const DEFAULT_ITEMS = [
  { id:'m1',  name:'CESLA Polo Shirt',    cat:'Shirts',    price:350, stock:20, emoji:'👕', image:null, sizes:DEFAULT_ALL_SIZES },
  { id:'m2',  name:'CESLA T-Shirt',       cat:'Shirts',    price:250, stock:30, emoji:'👕', image:null, sizes:DEFAULT_ALL_SIZES },
  { id:'m3',  name:'CESLA Polo (White)',   cat:'Shirts',    price:350, stock:15, emoji:'👔', image:null, sizes:DEFAULT_ALL_SIZES },
  { id:'m4',  name:'CESLA Ceramic Mug',   cat:'Mugs',      price:180, stock:25, emoji:'☕', image:null, sizes:[] },
  { id:'m5',  name:'CESLA Tumbler 500ml', cat:'Tumbler',   price:280, stock:22, emoji:'🥤', image:null, sizes:[] },
  { id:'m6',  name:'CESLA Tote Bag',      cat:'Bags',      price:150, stock:40, emoji:'👜', image:null, sizes:[] },
  { id:'m7',  name:'CESLA Backpack',      cat:'Bags',      price:650, stock:10, emoji:'🎒', image:null, sizes:[] },
  { id:'m8',  name:'CESLA Ballpen',       cat:'Pens',      price:30,  stock:100,emoji:'🖊️', image:null, sizes:[] },
  { id:'m9',  name:'CESLA Gel Pen Set',   cat:'Pens',      price:85,  stock:60, emoji:'✒️', image:null, sizes:[] },
  { id:'m10', name:'CESLA Snapback Cap',  cat:'Caps',      price:280, stock:20, emoji:'🧢', image:null, sizes:DEFAULT_ALL_SIZES },
  { id:'m11', name:'CESLA Umbrella',      cat:'Umbrellas', price:320, stock:14, emoji:'☂️', image:null, sizes:[] },
  { id:'m12', name:'CESLA Bear Stufftoy', cat:'Stufftoys', price:180, stock:10, emoji:'🧸', image:null, sizes:[] },
  { id:'m13', name:'CESLA Keychain',      cat:'Others',    price:60,  stock:50, emoji:'🔑', image:null, sizes:[] },
  { id:'m14', name:'CESLA Sticker Pack',  cat:'Others',    price:40,  stock:80, emoji:'🏷️', image:null, sizes:[] },
];

const DEFAULT_ADS = [
  { id:'a1', image:null, imageUrl:'', title:"Today's Picks", sub:'Quality CESLA merchandise!', bg:['#1a3a6b','#2e5fa3'], emoji:'📦' },
  { id:'a2', image:null, imageUrl:'', title:'Special Offer',  sub:'Check our latest items!',   bg:['#7b3f00','#c9a84c'], emoji:'🎁' },
];

const seedIfEmpty = async () => {
  try {
    const itemsSnap = await getDocs(collection(db, 'merchandise_items'));
    if (itemsSnap.empty) {
      const batch = writeBatch(db);
      DEFAULT_ITEMS.forEach(item => batch.set(doc(db, 'merchandise_items', item.id), item));
      await batch.commit();
      console.log('Seeded merchandise_items');
    }
    const adsSnap = await getDocs(collection(db, 'merchandise_ads'));
    if (adsSnap.empty) {
      const batch = writeBatch(db);
      DEFAULT_ADS.forEach(ad => batch.set(doc(db, 'merchandise_ads', ad.id), ad));
      await batch.commit();
      console.log('Seeded merchandise_ads');
    }
  } catch (e) { console.warn('Seed error:', e); }
};

const MerchandiseContext = createContext(null);

export const useMerchandise = () => {
  const ctx = useContext(MerchandiseContext);
  if (!ctx) throw new Error('useMerchandise must be inside MerchandiseProvider');
  return ctx;
};

export const MerchandiseProvider = ({ children }) => {
  const [items,  setItems]  = useState([]);
  const [ads,    setAds]    = useState([]);
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const categories = DEFAULT_CATEGORIES;

  useEffect(() => {
    let unsubItems, unsubAds, unsubOrders;
    seedIfEmpty().then(() => {
      unsubItems = onSnapshot(
        collection(db, 'merchandise_items'),
        snap => {
          const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
          data.sort((a, b) => (parseInt(a.id.replace('m',''))||999) - (parseInt(b.id.replace('m',''))||999));
          setItems(data);
          setLoaded(true);
        },
        err => console.warn('items error:', err)
      );
      unsubAds = onSnapshot(
        collection(db, 'merchandise_ads'),
        snap => setAds(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
        err => console.warn('ads error:', err)
      );
      unsubOrders = onSnapshot(
        collection(db, 'merchandise_orders'),
        snap => {
          const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
          data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setOrders(data);
        },
        err => console.warn('orders error:', err)
      );
    });
    return () => { unsubItems?.(); unsubAds?.(); unsubOrders?.(); };
  }, []);

  const saveItem = async (item) => {
    try { await setDoc(doc(db, 'merchandise_items', item.id), item); }
    catch (e) { console.warn('saveItem error:', e); }
  };

  const deleteItem = async (id) => {
    try { await deleteDoc(doc(db, 'merchandise_items', id)); }
    catch (e) { console.warn('deleteItem error:', e); }
  };

  const saveAd = async (ad) => {
    try { await setDoc(doc(db, 'merchandise_ads', ad.id), ad); }
    catch (e) { console.warn('saveAd error:', e); }
  };

  const addOrder = async (order) => {
    try {
      const docRef = await addDoc(collection(db, 'merchandise_orders'), {
        ...order, createdAt: Date.now(),
      });
      return docRef.id;
    } catch (e) { console.warn('addOrder error:', e); return null; }
  };

  const updateOrderStatus = async (orderId, status) => {
    try { await updateDoc(doc(db, 'merchandise_orders', orderId), { status }); }
    catch (e) { console.warn('updateOrderStatus error:', e); }
  };

  const deductStock = async (orderItems) => {
    try {
      const batch = writeBatch(db);
      orderItems.forEach(({ item, qty }) => {
        batch.update(doc(db, 'merchandise_items', item.id), {
          stock: Math.max(0, (item.stock || 0) - qty),
        });
      });
      await batch.commit();
    } catch (e) { console.warn('deductStock error:', e); }
  };

  const reloadFromStorage = useCallback(() => {}, []);

  return (
    <MerchandiseContext.Provider value={{
      items, ads, categories, orders, loaded,
      setAds,
      saveItem, deleteItem, saveAd,
      addOrder, updateOrderStatus, deductStock,
      reloadFromStorage,
      defaultSizesForCat,
      APPAREL_CATS,
      DEFAULT_ADULT_SIZES,
      DEFAULT_KIDS_SIZES,
      DEFAULT_ALL_SIZES,
    }}>
      {children}
    </MerchandiseContext.Provider>
  );
};