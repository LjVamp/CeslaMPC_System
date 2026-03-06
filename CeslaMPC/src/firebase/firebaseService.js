// src/firebase/firebaseService.js
// ─────────────────────────────────────────────────────────────────────────────
// CESLA MPC — Firebase Service Layer
// All Firestore + Auth operations in one place.
// Import these functions in your screens instead of direct Firebase calls.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  addDoc, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, Timestamp, increment, runTransaction,
  writeBatch,
} from 'firebase/firestore';

import { auth, db } from './firebaseConfig';

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTION REFERENCES
// ─────────────────────────────────────────────────────────────────────────────
const COL = {
  members:       'members',        // all cooperative members
  menuItems:     'menuItems',      // canteen menu
  orders:        'orders',         // canteen orders
  loanApps:      'loanApplications',
  notifications: 'notifications',
  settings:      'settings',
};

// ─────────────────────────────────────────────────────────────────────────────
// ── AUTH SERVICES ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a new member.
 * Creates Firebase Auth user + Firestore member document.
 */
export const registerMember = async ({ email, password, name, userId }) => {
  // 1. Create auth user
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid  = cred.user.uid;

  // 2. Create member doc with the Firebase UID as document ID
  const memberData = {
    uid,
    userId,           // cooperative-assigned ID e.g. CESLA-2026-00001
    name,
    email,
    role:          'member',
    status:        'Pending',
    shares:        0,
    savings:       0,
    loan:          0,
    loanBalance:   0,
    creditBalance: 0,
    contact:       '',
    address:       '',
    memberSince:   serverTimestamp(),
    appForm:       {},
    createdAt:     serverTimestamp(),
    updatedAt:     serverTimestamp(),
  };

  await setDoc(doc(db, COL.members, uid), memberData);
  return { uid, ...memberData };
};

/**
 * Login with email + password.
 * Returns the Firestore member document.
 */
export const loginMember = async (email, password) => {
  const cred   = await signInWithEmailAndPassword(auth, email, password);
  const uid    = cred.user.uid;
  const snap   = await getDoc(doc(db, COL.members, uid));
  if (!snap.exists()) throw new Error('Member record not found.');
  return { uid, ...snap.data() };
};

/**
 * Login by cooperative userId (e.g. CESLA-2026-00001).
 * Looks up email from Firestore then signs in.
 */
export const loginByUserId = async (userId, password) => {
  const q    = query(collection(db, COL.members), where('userId', '==', userId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('User ID not found.');
  const memberDoc = snap.docs[0].data();
  if (!memberDoc.email) throw new Error('No email linked to this account.');
  return await loginMember(memberDoc.email, password);
};

/**
 * Logout current user.
 */
export const logoutUser = async () => {
  await signOut(auth);
};

/**
 * Change password (requires recent login).
 */
export const changePassword = async (currentPassword, newPassword) => {
  const user       = auth.currentUser;
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
};

// ─────────────────────────────────────────────────────────────────────────────
// ── MEMBER SERVICES ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get single member by UID.
 */
export const getMember = async (uid) => {
  const snap = await getDoc(doc(db, COL.members, uid));
  if (!snap.exists()) throw new Error('Member not found.');
  return { uid: snap.id, ...snap.data() };
};

/**
 * Get all members (admin only).
 */
export const getAllMembers = async () => {
  const snap = await getDocs(collection(db, COL.members));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
};

/**
 * Real-time listener: all members (admin dashboard).
 * Returns unsubscribe function.
 */
export const listenAllMembers = (callback) => {
  const q = query(collection(db, COL.members), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  });
};

/**
 * Real-time listener: single member.
 * Returns unsubscribe function.
 */
export const listenMember = (uid, callback) => {
  return onSnapshot(doc(db, COL.members, uid), snap => {
    if (snap.exists()) callback({ uid: snap.id, ...snap.data() });
  });
};

/**
 * Update member profile fields.
 */
export const updateMemberProfile = async (uid, fields) => {
  await updateDoc(doc(db, COL.members, uid), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Update member financial data (admin).
 */
export const updateMemberFinancials = async (uid, { shares, savings, loan, loanBalance }) => {
  const updates = { updatedAt: serverTimestamp() };
  if (shares      !== undefined) updates.shares      = shares;
  if (savings     !== undefined) updates.savings     = savings;
  if (loan        !== undefined) updates.loan        = loan;
  if (loanBalance !== undefined) updates.loanBalance = loanBalance;
  await updateDoc(doc(db, COL.members, uid), updates);
};

/**
 * Approve or reject a member (admin).
 */
export const setMemberStatus = async (uid, status) => {
  await updateDoc(doc(db, COL.members, uid), {
    status,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Save application form data.
 */
export const saveAppForm = async (uid, appForm) => {
  await updateDoc(doc(db, COL.members, uid), {
    appForm,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Generate the next cooperative User ID.
 * Uses a transaction to safely increment a counter.
 */
export const generateNextUserId = async () => {
  const counterRef = doc(db, COL.settings, 'memberCounter');
  const year = new Date().getFullYear();
  let nextNum;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists()) {
      nextNum = 1;
      tx.set(counterRef, { count: 1, year });
    } else {
      const data  = snap.data();
      // Reset counter if new year
      nextNum = data.year === year ? (data.count + 1) : 1;
      tx.update(counterRef, { count: nextNum, year });
    }
  });

  return `CESLA-${year}-${String(nextNum).padStart(5, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── CANTEEN MENU SERVICES ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all menu items (one-time fetch).
 */
export const getMenuItems = async () => {
  const snap = await getDocs(collection(db, COL.menuItems));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Real-time listener: menu items.
 * Returns unsubscribe function.
 */
export const listenMenuItems = (callback) => {
  const q = query(collection(db, COL.menuItems), orderBy('category'), orderBy('name'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

/**
 * Add a new menu item (admin).
 */
export const addMenuItem = async (item) => {
  const ref = await addDoc(collection(db, COL.menuItems), {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Update menu item (admin).
 */
export const updateMenuItem = async (itemId, fields) => {
  await updateDoc(doc(db, COL.menuItems, itemId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Delete menu item (admin).
 */
export const deleteMenuItem = async (itemId) => {
  await deleteDoc(doc(db, COL.menuItems, itemId));
};

/**
 * Seed default menu items (run once for setup).
 */
export const seedMenuItems = async () => {
  const DEFAULT_ITEMS = [
    { name: 'Lugaw with Egg',  category: 'Meals',     price: 55,  stock: 50,  emoji: '🍚', available: true },
    { name: 'Sinangag',        category: 'Meals',     price: 30,  stock: 30,  emoji: '🍳', available: true },
    { name: 'Pork Adobo',      category: 'Meals',     price: 75,  stock: 20,  emoji: '🍖', available: true },
    { name: 'Fried Chicken',   category: 'Meals',     price: 80,  stock: 15,  emoji: '🍗', available: true },
    { name: 'Pancit Canton',   category: 'Meals',     price: 65,  stock: 25,  emoji: '🍜', available: true },
    { name: 'Rice + Ulam',     category: 'Meals',     price: 45,  stock: 40,  emoji: '🍱', available: true },
    { name: 'Softdrinks',      category: 'Drinks',    price: 25,  stock: 100, emoji: '🥤', available: true },
    { name: 'Bottled Water',   category: 'Drinks',    price: 15,  stock: 80,  emoji: '💧', available: true },
    { name: 'Juice',           category: 'Drinks',    price: 20,  stock: 60,  emoji: '🧃', available: true },
    { name: 'Milk Tea',        category: 'Drinks',    price: 55,  stock: 20,  emoji: '🧋', available: true },
    { name: 'Chips',           category: 'Snacks',    price: 20,  stock: 50,  emoji: '🍟', available: true },
    { name: 'Biscuit',         category: 'Snacks',    price: 15,  stock: 40,  emoji: '🍪', available: true },
    { name: 'Bread',           category: 'Snacks',    price: 10,  stock: 35,  emoji: '🍞', available: true },
    { name: 'Banana Cue',      category: 'Snacks',    price: 15,  stock: 25,  emoji: '🍌', available: true },
    { name: 'Junk Food Pack',  category: 'Junk Foods',price: 18,  stock: 45,  emoji: '🍿', available: true },
    { name: 'Mixed Nuts',      category: 'Junk Foods',price: 35,  stock: 30,  emoji: '🥜', available: true },
    { name: 'Chicharon',       category: 'Junk Foods',price: 20,  stock: 22,  emoji: '🧂', available: true },
    { name: 'Kwek-Kwek',       category: 'Others',    price: 15,  stock: 30,  emoji: '🟠', available: true },
    { name: 'Fishball',        category: 'Others',    price: 10,  stock: 50,  emoji: '⚪', available: true },
    { name: 'Ice Candy',       category: 'Others',    price: 5,   stock: 60,  emoji: '🍧', available: true },
  ];

  const batch = writeBatch(db);
  DEFAULT_ITEMS.forEach(item => {
    const ref = doc(collection(db, COL.menuItems));
    batch.set(ref, { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  await batch.commit();
};

// ─────────────────────────────────────────────────────────────────────────────
// ── CANTEEN ORDER SERVICES ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Place a canteen order.
 * Uses a transaction to atomically deduct stock and create the order.
 */
export const placeCanteenOrder = async ({ memberId, memberName, items, total, paymentMethod, amountPaid, change }) => {
  const orderId  = 'ORD-' + Date.now().toString().slice(-8);
  const orderRef = doc(collection(db, COL.orders));

  await runTransaction(db, async (tx) => {
    // 1. Verify + deduct stock for each item
    for (const item of items) {
      const menuRef  = doc(db, COL.menuItems, item.id);
      const menuSnap = await tx.get(menuRef);
      if (!menuSnap.exists()) throw new Error(`Item "${item.name}" no longer exists.`);
      const currentStock = menuSnap.data().stock;
      if (currentStock < item.qty) throw new Error(`Not enough stock for "${item.name}". Only ${currentStock} left.`);
      tx.update(menuRef, { stock: increment(-item.qty), updatedAt: serverTimestamp() });
    }

    // 2. Create order document
    tx.set(orderRef, {
      orderId,
      memberId,
      memberName,
      items,
      total,
      paymentMethod,
      amountPaid: amountPaid || total,
      change:     change     || 0,
      status:     'Completed',
      createdAt:  serverTimestamp(),
    });

    // 3. If credit, add to member's creditBalance
    if (paymentMethod === 'Credit') {
      const memberRef = doc(db, COL.members, memberId);
      tx.update(memberRef, {
        creditBalance: increment(total),
        updatedAt: serverTimestamp(),
      });
    }
  });

  return { orderId, docId: orderRef.id };
};

/**
 * Real-time listener: orders for a specific member.
 * Returns unsubscribe function.
 */
export const listenMemberOrders = (memberId, callback) => {
  const q = query(
    collection(db, COL.orders),
    where('memberId', '==', memberId),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      docId: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toLocaleString('en-PH') || 'Just now',
    })));
  });
};

/**
 * Real-time listener: ALL canteen orders (admin view).
 * Returns unsubscribe function.
 */
export const listenAllOrders = (callback) => {
  const q = query(collection(db, COL.orders), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      docId: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toLocaleString('en-PH') || '—',
    })));
  });
};

/**
 * Get today's sales summary (admin).
 */
export const getTodaySales = async () => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);

  const q    = query(
    collection(db, COL.orders),
    where('createdAt', '>=', Timestamp.fromDate(start)),
    where('createdAt', '<=', Timestamp.fromDate(end)),
  );
  const snap = await getDocs(q);
  const orders = snap.docs.map(d => d.data());

  return {
    totalOrders: orders.length,
    totalSales:  orders.reduce((s, o) => s + (o.total || 0), 0),
    cashSales:   orders.filter(o => o.paymentMethod === 'Cash').reduce((s, o) => s + (o.total || 0), 0),
    gcashSales:  orders.filter(o => o.paymentMethod === 'GCash').reduce((s, o) => s + (o.total || 0), 0),
    creditSales: orders.filter(o => o.paymentMethod === 'Credit').reduce((s, o) => s + (o.total || 0), 0),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ── LOAN APPLICATION SERVICES ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit a loan application.
 */
export const submitLoanApplication = async ({ memberId, memberName, amount, purpose, term }) => {
  const ref = await addDoc(collection(db, COL.loanApps), {
    memberId, memberName, amount, purpose, term,
    status:    'Pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Real-time listener: loan applications for a member.
 */
export const listenMemberLoanApps = (memberId, callback) => {
  const q = query(
    collection(db, COL.loanApps),
    where('memberId', '==', memberId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

/**
 * Real-time listener: all loan applications (admin).
 */
export const listenAllLoanApps = (callback) => {
  const q = query(collection(db, COL.loanApps), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

/**
 * Approve or reject a loan application (admin).
 * If approved, updates member's loan balance too.
 */
export const resolveLoanApp = async (appId, status, memberId, amount) => {
  await updateDoc(doc(db, COL.loanApps, appId), {
    status,
    resolvedAt: serverTimestamp(),
    updatedAt:  serverTimestamp(),
  });

  if (status === 'Approved') {
    await updateDoc(doc(db, COL.members, memberId), {
      loan:        increment(amount),
      loanBalance: increment(amount),
      updatedAt:   serverTimestamp(),
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── CART PERSISTENCE (Firestore-backed) ──────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save cart to Firestore (sub-document under member).
 */
export const saveCart = async (memberId, cart) => {
  await setDoc(doc(db, COL.members, memberId, 'private', 'cart'), {
    items:     cart,
    savedAt:   serverTimestamp(),
  });
};

/**
 * Load saved cart from Firestore.
 */
export const loadCart = async (memberId) => {
  const snap = await getDoc(doc(db, COL.members, memberId, 'private', 'cart'));
  return snap.exists() ? snap.data().items : [];
};

/**
 * Clear saved cart from Firestore.
 */
export const clearSavedCart = async (memberId) => {
  await setDoc(doc(db, COL.members, memberId, 'private', 'cart'), {
    items: [], savedAt: serverTimestamp(),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a notification to a member (admin).
 */
export const sendNotification = async (memberId, { title, message, type = 'info' }) => {
  await addDoc(collection(db, COL.members, memberId, 'notifications'), {
    title, message, type,
    read:      false,
    createdAt: serverTimestamp(),
  });
};

/**
 * Real-time listener: member notifications.
 */
export const listenNotifications = (memberId, callback) => {
  const q = query(
    collection(db, COL.members, memberId, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(20),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

/**
 * Mark notification as read.
 */
export const markNotificationRead = async (memberId, notifId) => {
  await updateDoc(doc(db, COL.members, memberId, 'notifications', notifId), { read: true });
};
