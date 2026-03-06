// src/screens/CanteenMemberScreen.js
// CESLA MPC — Canteen Member Portal (Firebase-connected)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, useWindowDimensions, Platform,
  TextInput, KeyboardAvoidingView, Modal, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

import {
  loginByUserId, logoutUser,
  listenMenuItems, listenMemberOrders,
  placeCanteenOrder, saveCart, loadCart, clearSavedCart,
  listenMember,
} from '../firebase/firebaseService';
import { auth } from '../firebase/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  navy: '#1a2d4e', navyDark: '#0f1e35', navyMid: '#243554', navyDeep: '#304674',
  gold: '#c9a84c', goldLight: '#e8c87a',
  blue: '#6fa3f7', green: '#2ecc71', red: '#e74c3c', orange: '#f5a623',
  textMain: '#0f1e35', textMuted: 'rgba(15,30,53,0.55)',
};

const fmtCur = (v) => '₱' + Number(v || 0).toFixed(2);

const V   = { SPLASH: 'splash', LOGIN: 'login', CANTEEN: 'canteen' };
const TAB = { MENU: 'menu', ORDER: 'order', HISTORY: 'history' };
const CATEGORIES = ['All', 'Meals', 'Drinks', 'Snacks', 'Junk Foods', 'Others'];

// ─── BACKGROUND ──────────────────────────────────────────────────────────────
const AppBg = () => (
  <>
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
    <LinearGradient
      colors={['rgba(198,220,235,0.85)', 'rgba(152,186,213,0.40)', 'rgba(80,110,150,0.0)']}
      locations={[0, 0.45, 1]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  </>
);

// ─── FIELD ───────────────────────────────────────────────────────────────────
const Field = ({ label, value, onChangeText, placeholder, secureEntry, showToggle, onToggle, error, keyboardType }) => (
  <View style={s.fieldWrap}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.fieldRow, error && s.fieldRowError]}>
      <TextInput
        style={s.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(15,30,53,0.35)"
        secureTextEntry={secureEntry}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {showToggle && (
        <TouchableOpacity onPress={onToggle} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18 }}>{secureEntry ? '👁' : '🙈'}</Text>
        </TouchableOpacity>
      )}
    </View>
    {error ? <Text style={s.fieldErr}>{error}</Text> : null}
  </View>
);

// ══════════════════════════════════════════════════════════════════════════════
// ─── LOGIN ────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const LoginScreen = ({ onLogin }) => {
  const [userId, setUserId] = useState('');
  const [pw,     setPw]     = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error,  setError]  = useState('');
  const [loading,setLoading]= useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!userId.trim()) { setError('Please enter your User ID.'); return; }
    if (!pw.trim())     { setError('Please enter your password.'); return; }
    setLoading(true); setError('');
    try {
      const member = await loginByUserId(userId.trim(), pw);
      onLogin(member);
    } catch (e) {
      setError(e.message || 'Invalid User ID or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.loginOuter} keyboardShouldPersistTaps="handled">
        <Animated.View style={[s.loginCard, { opacity: fadeIn, transform: [{ translateY: slideY }] }]}>
          <View style={s.loginLogoWrap}>
            <LinearGradient colors={[C.navy, C.navyDeep]} style={s.loginLogo}>
              <Text style={{ fontSize: 32 }}>🍽️</Text>
            </LinearGradient>
          </View>
          <Text style={s.loginTitle}>Canteen Portal</Text>
          <Text style={s.loginSub}>CLIMBS Cooperative — Member Access</Text>
          <View style={s.hintBox}>
            <Text style={s.hintTxt}>🔑 Use your <Text style={s.hintBold}>CESLA Member ID</Text> and password to access the canteen.</Text>
          </View>
          <Field label="MEMBER USER ID" value={userId} onChangeText={v => { setUserId(v); setError(''); }} placeholder="e.g. CESLA-2026-00001" />
          <Field label="PASSWORD" value={pw} onChangeText={v => { setPw(v); setError(''); }} placeholder="Enter your password"
            secureEntry={!showPw} showToggle onToggle={() => setShowPw(p => !p)} error={error} />
          <TouchableOpacity style={s.loginBtn} onPress={handleLogin} activeOpacity={0.85} disabled={loading}>
            <LinearGradient colors={[C.gold, C.goldLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.loginBtnGrad}>
              {loading ? <ActivityIndicator color={C.navy} /> : <Text style={s.loginBtnTxt}>🍴  ENTER CANTEEN</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── MENU CARD ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const MenuCard = ({ item, onAdd, cartQty, isWide }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleAdd = () => {
    if (item.stock <= 0 || !item.available) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
    onAdd(item);
  };

  const outOfStock = item.stock <= 0 || !item.available;
  const cardW = isWide ? 160 : '47%';

  return (
    <Animated.View style={[s.menuCard, { width: cardW, transform: [{ scale: scaleAnim }], opacity: outOfStock ? 0.55 : 1 }]}>
      {cartQty > 0 && (
        <View style={s.cartBadge}><Text style={s.cartBadgeTxt}>{cartQty}</Text></View>
      )}
      <View style={s.menuEmoji}>
        <Text style={{ fontSize: isWide ? 36 : 30 }}>{item.emoji}</Text>
      </View>
      <Text style={s.menuItemName} numberOfLines={2}>{item.name}</Text>
      <Text style={s.menuStock}>{outOfStock ? 'Out of Stock' : `Stock: ${item.stock}`}</Text>
      <Text style={s.menuPrice}>{fmtCur(item.price)}</Text>
      <TouchableOpacity style={[s.addBtn, outOfStock && s.addBtnDisabled]} onPress={handleAdd} activeOpacity={0.8} disabled={outOfStock}>
        <Text style={s.addBtnTxt}>{outOfStock ? 'Unavailable' : 'Add To Cart'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── RECEIPT MODAL ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const ReceiptModal = ({ visible, order, member, onClose }) => {
  if (!order) return null;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.receiptCard}>
          <LinearGradient colors={[C.navy, C.navyDeep]} style={s.receiptHeader}>
            <Text style={{ fontSize: 28 }}>🧾</Text>
            <Text style={s.receiptTitle}>Order Receipt</Text>
            <Text style={s.receiptSub}>CLIMBS Canteen</Text>
          </LinearGradient>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ padding: 20 }}>
            {[['Order ID', order.orderId], ['Member', member?.name || '—'], ['Date & Time', order.createdAt],
              ['Payment', order.paymentMethod]].map(([l, v]) => (
              <View key={l} style={s.receiptInfoRow}>
                <Text style={s.receiptInfoLabel}>{l}</Text>
                <Text style={[s.receiptInfoVal, l === 'Payment' && { color: order.paymentMethod === 'Credit' ? C.orange : C.green }]}>{v}</Text>
              </View>
            ))}
            <View style={s.receiptDivider} />
            <Text style={s.receiptItemsTitle}>ITEMS ORDERED</Text>
            {order.items?.map((item, i) => (
              <View key={i} style={s.receiptItemRow}>
                <Text style={s.receiptItemEmoji}>{item.emoji}</Text>
                <Text style={s.receiptItemName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.receiptItemQty}>x{item.qty}</Text>
                <Text style={s.receiptItemTotal}>{fmtCur(item.price * item.qty)}</Text>
              </View>
            ))}
            <View style={s.receiptDivider} />
            {order.paymentMethod === 'Cash' && (
              <>
                <View style={s.receiptTotalRow}>
                  <Text style={s.receiptTotalLabel}>Amount Paid</Text>
                  <Text style={s.receiptTotalVal}>{fmtCur(order.amountPaid)}</Text>
                </View>
                <View style={s.receiptTotalRow}>
                  <Text style={s.receiptTotalLabel}>Change</Text>
                  <Text style={[s.receiptTotalVal, { color: C.green }]}>{fmtCur(order.change)}</Text>
                </View>
              </>
            )}
            <View style={[s.receiptTotalRow, { marginTop: 6 }]}>
              <Text style={[s.receiptTotalLabel, { fontFamily: 'GoogleSans_700Bold', color: C.navy, fontSize: 15 }]}>TOTAL</Text>
              <Text style={[s.receiptTotalVal, { color: C.gold, fontSize: 18 }]}>{fmtCur(order.total)}</Text>
            </View>
            {order.paymentMethod === 'Credit' && (
              <View style={s.creditNote}>
                <Text style={s.creditNoteTxt}>⚠️ This order is charged to your credit. Please settle at the canteen counter.</Text>
              </View>
            )}
          </ScrollView>
          <TouchableOpacity style={s.receiptCloseBtn} onPress={onClose}>
            <Text style={s.receiptCloseTxt}>✓  Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── CART PANEL (wide sidebar) ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const CartPanel = ({ cart, cartTotal, onRemove, onUpdateQty, onClear, payMethod, setPayMethod, amountPaid, setAmountPaid, change, onPlaceOrder, loading }) => (
  <View style={s.cartPanel}>
    <Text style={s.cartPanelTitle}>CART</Text>
    <View style={s.cartPanelDivider} />
    {cart.length === 0
      ? <View style={s.cartEmpty}><Text style={s.cartEmptyTxt}>Cart is empty.</Text></View>
      : <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {cart.map(item => (
            <View key={item.id} style={s.cartPanelItem}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.cartPanelItemName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.cartPanelItemPrice}>{fmtCur(item.price)}</Text>
              </View>
              <View style={s.qtyRow}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => onUpdateQty(item.id, -1)}><Text style={s.qtyBtnTxt}>−</Text></TouchableOpacity>
                <Text style={s.qtyNum}>{item.qty}</Text>
                <TouchableOpacity style={s.qtyBtn} onPress={() => onUpdateQty(item.id, 1)}><Text style={s.qtyBtnTxt}>+</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>}
    <View style={s.cartTotalRow}>
      <Text style={s.cartTotalLabel}>Total :</Text>
      <Text style={s.cartTotalVal}>{fmtCur(cartTotal)}</Text>
    </View>
    {['Cash', 'GCash', 'Credit'].map(pm => (
      <TouchableOpacity key={pm} style={s.payRadioRow} onPress={() => setPayMethod(pm)}>
        <View style={[s.payRadio, payMethod === pm && s.payRadioActive]}>
          {payMethod === pm && <View style={s.payRadioDot} />}
        </View>
        <Text style={s.payRadioLabel}>{pm === 'Cash' ? '💵 Cash' : pm === 'GCash' ? '📱 GCash' : '📋 Credit (Pay Later)'}</Text>
      </TouchableOpacity>
    ))}
    {payMethod === 'Cash' && (
      <>
        <Text style={[s.fieldLabel, { marginTop: 8 }]}>AMOUNT PAID (₱)</Text>
        <View style={[s.fieldRow, { marginBottom: 4 }]}>
          <TextInput style={s.fieldInput} value={amountPaid} onChangeText={setAmountPaid} placeholder="0.00"
            placeholderTextColor={C.textMuted} keyboardType="numeric" />
        </View>
        <View style={s.changeRow}>
          <Text style={s.changeLabel}>Change</Text>
          <Text style={s.changeVal}>{fmtCur(change)}</Text>
        </View>
      </>
    )}
    <TouchableOpacity
      style={[s.placeOrderBtn, (cart.length === 0 || (payMethod === 'Cash' && parseFloat(amountPaid || 0) < cartTotal) || loading) && s.placeOrderBtnDisabled]}
      onPress={onPlaceOrder}
      disabled={cart.length === 0 || (payMethod === 'Cash' && parseFloat(amountPaid || 0) < cartTotal) || loading}
      activeOpacity={0.85}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.placeOrderBtnTxt}>Place Order</Text>}
    </TouchableOpacity>
    <TouchableOpacity style={s.clearCartBtn} onPress={onClear}>
      <Text style={s.clearCartTxt}>Clear cart</Text>
    </TouchableOpacity>
  </View>
);

// ══════════════════════════════════════════════════════════════════════════════
// ─── CANTEEN SCREEN ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const CanteenScreen = ({ member, onLogout, isWide, isSmall }) => {
  const [activeTab,      setActiveTab]      = useState(TAB.MENU);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search,         setSearch]         = useState('');
  const [menuItems,      setMenuItems]      = useState([]);
  const [cart,           setCart]           = useState([]);
  const [orderHistory,   setOrderHistory]   = useState([]);
  const [payMethod,      setPayMethod]      = useState('Cash');
  const [amountPaid,     setAmountPaid]     = useState('');
  const [showReceipt,    setShowReceipt]    = useState(false);
  const [lastOrder,      setLastOrder]      = useState(null);
  const [placing,        setPlacing]        = useState(false);
  const [orderError,     setOrderError]     = useState('');
  const [menuLoading,    setMenuLoading]    = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Real-time listeners ───────────────────────────────────────────────────
  useEffect(() => {
    // Menu items — live from Firestore
    const unsubMenu = listenMenuItems((items) => {
      setMenuItems(items);
      setMenuLoading(false);
    });
    // Order history — live from Firestore
    const unsubOrders = listenMemberOrders(member.uid, setOrderHistory);
    return () => { unsubMenu(); unsubOrders(); };
  }, [member.uid]);

  // ── Load persisted cart ───────────────────────────────────────────────────
  useEffect(() => {
    loadCart(member.uid).then(savedCart => {
      if (savedCart.length > 0) setCart(savedCart);
    }).catch(() => {});
  }, [member.uid]);

  // ── Save cart whenever it changes ─────────────────────────────────────────
  useEffect(() => {
    saveCart(member.uid, cart).catch(() => {});
  }, [cart, member.uid]);

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const addToCart = useCallback((item) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      return existing
        ? prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
        : [...prev, { id: item.id, name: item.name, price: item.price, emoji: item.emoji, qty: 1 }];
    });
  }, []);

  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.id !== id));
  const updateQty = (id, delta) => setCart(prev => prev.map(c => c.id === id ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0));
  const clearCart = () => { setCart([]); clearSavedCart(member.uid).catch(() => {}); };

  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const change    = Math.max(0, parseFloat(amountPaid || 0) - cartTotal);
  const getCartQty = (id) => cart.find(c => c.id === id)?.qty || 0;

  // ── Place order ───────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (payMethod === 'Cash' && parseFloat(amountPaid || 0) < cartTotal) return;
    setPlacing(true); setOrderError('');
    try {
      const { orderId } = await placeCanteenOrder({
        memberId:      member.uid,
        memberName:    member.name,
        items:         cart,
        total:         cartTotal,
        paymentMethod: payMethod,
        amountPaid:    payMethod === 'Cash' ? parseFloat(amountPaid) : cartTotal,
        change:        payMethod === 'Cash' ? change : 0,
      });
      // The receipt shows from orderHistory (real-time), find the latest
      setLastOrder({
        orderId,
        items:         cart,
        total:         cartTotal,
        paymentMethod: payMethod,
        amountPaid:    payMethod === 'Cash' ? parseFloat(amountPaid) : cartTotal,
        change:        payMethod === 'Cash' ? change : 0,
        createdAt:     new Date().toLocaleString('en-PH'),
      });
      clearCart();
      setAmountPaid('');
      setShowReceipt(true);
      switchTab(TAB.MENU);
    } catch (e) {
      setOrderError(e.message || 'Order failed. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  // ── Tab switch ────────────────────────────────────────────────────────────
  const switchTab = (tab) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setActiveTab(tab);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const filteredItems = menuItems.filter(item => {
    const matchCat    = activeCategory === 'All' || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ─── MENU TAB ─────────────────────────────────────────────────────────────
  const renderMenuTab = () => (
    <View style={{ flex: 1, flexDirection: isWide ? 'row' : 'column' }}>
      <View style={{ flex: 1 }}>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput style={s.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search items..." placeholderTextColor={C.textMuted} />
          {search ? <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 8 }}>
            <Text style={{ color: C.textMuted, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity> : null}
        </View>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={s.catSidebar}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} style={[s.catBtn, activeCategory === cat && s.catBtnActive]}
                  onPress={() => setActiveCategory(cat)} activeOpacity={0.8}>
                  <Text style={[s.catBtnTxt, activeCategory === cat && s.catBtnTxtActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.itemsGrid} showsVerticalScrollIndicator={false}>
            <Text style={s.categoryLabel}>{activeCategory.toUpperCase()}</Text>
            {menuLoading ? (
              <View style={{ padding: 40, alignItems: 'center', width: '100%' }}>
                <ActivityIndicator size="large" color={C.gold} />
                <Text style={[s.emptyTxt, { marginTop: 12 }]}>Loading menu...</Text>
              </View>
            ) : (
              <View style={s.gridRow}>
                {filteredItems.length === 0
                  ? <View style={s.emptySearch}><Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text><Text style={s.emptyTxt}>No items found.</Text></View>
                  : filteredItems.map(item => (
                      <MenuCard key={item.id} item={item} onAdd={addToCart} cartQty={getCartQty(item.id)} isWide={isWide} />
                    ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
      {isWide && (
        <CartPanel
          cart={cart} cartTotal={cartTotal} onRemove={removeFromCart}
          onUpdateQty={updateQty} onClear={clearCart}
          payMethod={payMethod} setPayMethod={setPayMethod}
          amountPaid={amountPaid} setAmountPaid={setAmountPaid}
          change={change} onPlaceOrder={handlePlaceOrder} loading={placing}
        />
      )}
    </View>
  );

  // ─── ORDER TAB ────────────────────────────────────────────────────────────
  const renderOrderTab = () => (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Current Order</Text>
      {cart.length === 0
        ? <View style={s.emptyCard}><Text style={{ fontSize: 40, marginBottom: 12 }}>🛒</Text><Text style={s.emptyTxt}>Your cart is empty.{'\n'}Go to Menu to add items.</Text></View>
        : <>
            {cart.map(item => (
              <View key={item.id} style={s.cartItemRow}>
                <Text style={{ fontSize: 26, marginRight: 10 }}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.cartItemName}>{item.name}</Text>
                  <Text style={s.cartItemPrice}>{fmtCur(item.price)} each</Text>
                </View>
                <View style={s.qtyRow}>
                  <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.id, -1)}><Text style={s.qtyBtnTxt}>−</Text></TouchableOpacity>
                  <Text style={s.qtyNum}>{item.qty}</Text>
                  <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.id, 1)}><Text style={s.qtyBtnTxt}>+</Text></TouchableOpacity>
                </View>
                <Text style={s.cartItemSubtotal}>{fmtCur(item.price * item.qty)}</Text>
                <TouchableOpacity onPress={() => removeFromCart(item.id)} style={s.removeBtn}><Text style={s.removeBtnTxt}>✕</Text></TouchableOpacity>
              </View>
            ))}

            {/* Payment */}
            <View style={s.paymentSection}>
              <Text style={s.paymentTitle}>PAYMENT METHOD</Text>
              {['Cash', 'GCash', 'Credit'].map(pm => (
                <TouchableOpacity key={pm} style={s.payRadioRow} onPress={() => setPayMethod(pm)}>
                  <View style={[s.payRadio, payMethod === pm && s.payRadioActive]}>
                    {payMethod === pm && <View style={s.payRadioDot} />}
                  </View>
                  <Text style={s.payRadioLabel}>{pm === 'Cash' ? '💵 Cash' : pm === 'GCash' ? '📱 GCash' : '📋 Credit (Pay Later)'}</Text>
                </TouchableOpacity>
              ))}
              {payMethod === 'Cash' && (
                <View style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>AMOUNT PAID (₱)</Text>
                  <View style={s.fieldRow}>
                    <TextInput style={s.fieldInput} value={amountPaid} onChangeText={setAmountPaid}
                      placeholder="0.00" placeholderTextColor={C.textMuted} keyboardType="numeric" />
                  </View>
                  <Text style={[s.fieldLabel, { marginTop: 6, color: C.green }]}>Change: {fmtCur(change)}</Text>
                </View>
              )}
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>TOTAL</Text>
                <Text style={s.totalVal}>{fmtCur(cartTotal)}</Text>
              </View>
              {orderError ? <Text style={[s.fieldErr, { textAlign: 'center', marginBottom: 8 }]}>{orderError}</Text> : null}
              <TouchableOpacity
                style={[s.placeOrderBtn, (cart.length === 0 || (payMethod === 'Cash' && parseFloat(amountPaid || 0) < cartTotal) || placing) && s.placeOrderBtnDisabled]}
                onPress={handlePlaceOrder}
                disabled={cart.length === 0 || (payMethod === 'Cash' && parseFloat(amountPaid || 0) < cartTotal) || placing}
                activeOpacity={0.85}
              >
                {placing ? <ActivityIndicator color="#fff" /> : <Text style={s.placeOrderBtnTxt}>🧾  Place Order</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.clearCartBtn} onPress={clearCart}>
                <Text style={s.clearCartTxt}>Clear Cart</Text>
              </TouchableOpacity>
            </View>
          </>}
    </ScrollView>
  );

  // ─── HISTORY TAB ──────────────────────────────────────────────────────────
  const renderHistoryTab = () => (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Order History</Text>
      {orderHistory.length === 0
        ? <View style={s.emptyCard}><Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text><Text style={s.emptyTxt}>No orders yet.</Text></View>
        : orderHistory.map((order) => (
            <View key={order.docId || order.orderId} style={s.historyCard}>
              <View style={s.historyCardTop}>
                <View>
                  <Text style={s.historyOrderId}>{order.orderId}</Text>
                  <Text style={s.historyTimestamp}>{order.createdAt}</Text>
                </View>
                <View style={[s.historyBadge, order.paymentMethod === 'Credit' ? s.badgeCredit : order.paymentMethod === 'GCash' ? s.badgeGcash : s.badgeCash]}>
                  <Text style={s.historyBadgeTxt}>{order.paymentMethod}</Text>
                </View>
              </View>
              <View style={s.historyItems}>
                {order.items?.map((item, j) => (
                  <Text key={j} style={s.historyItemTxt}>{item.emoji} {item.name} x{item.qty} — {fmtCur(item.price * item.qty)}</Text>
                ))}
              </View>
              <View style={s.historyFooter}>
                <Text style={s.historyTotal}>Total: {fmtCur(order.total)}</Text>
                {order.paymentMethod === 'Cash' && <Text style={s.historyChange}>Change: {fmtCur(order.change)}</Text>}
              </View>
            </View>
          ))}
    </ScrollView>
  );

  // ─── MAIN RENDER ──────────────────────────────────────────────────────────
  return (
    <View style={s.canteenRoot}>
      {/* Topbar */}
      <View style={[s.topbar, { paddingTop: Platform.OS === 'web' ? 0 : 44 }]}>
        <View style={s.topLeft}>
          <View style={s.topLogo}><Text style={{ fontSize: 16 }}>🍽️</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[s.topTitle, { fontSize: isSmall ? 12 : 14 }]} numberOfLines={1}>
              <Text style={{ color: C.gold }}>CLIMBS </Text>Canteen
            </Text>
            {!isSmall && <Text style={s.topSub}>Ordering System</Text>}
          </View>
        </View>
        <View style={s.topRight}>
          {!isWide && (
            <TouchableOpacity style={s.cartFab} onPress={() => switchTab(TAB.ORDER)}>
              <Text style={{ fontSize: 18 }}>🛒</Text>
              {cartCount > 0 && <View style={s.cartFabBadge}><Text style={s.cartFabBadgeTxt}>{cartCount}</Text></View>}
            </TouchableOpacity>
          )}
          <View style={s.memberChip}>
            <View style={s.memberAvatar}>
              <Text style={s.memberAvatarTxt}>{member.name?.split(' ').map(w => w[0]).slice(0, 2).join('') || 'ME'}</Text>
            </View>
            {!isSmall && <Text style={s.memberName} numberOfLines={1}>{member.name?.split(' ')[0]}</Text>}
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={onLogout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.logoutTxt}>{isSmall ? '↩' : 'Logout'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {[{ key: TAB.MENU, label: 'Menu', icon: '🍴' }, { key: TAB.ORDER, label: 'Order', icon: '🛒', badge: cartCount }, { key: TAB.HISTORY, label: 'History', icon: '📋' }].map(tab => (
          <TouchableOpacity key={tab.key} style={[s.tabBtn, activeTab === tab.key && s.tabBtnActive]} onPress={() => switchTab(tab.key)} activeOpacity={0.8}>
            <Text style={{ fontSize: 15 }}>{tab.icon}</Text>
            <Text style={[s.tabBtnTxt, activeTab === tab.key && s.tabBtnTxtActive]}>{tab.label}</Text>
            {tab.badge > 0 && <View style={s.tabBadge}><Text style={s.tabBadgeTxt}>{tab.badge}</Text></View>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <Animated.View style={[{ flex: 1, overflow: 'hidden' }, { opacity: fadeAnim }]}>
        {activeTab === TAB.MENU    && renderMenuTab()}
        {activeTab === TAB.ORDER   && renderOrderTab()}
        {activeTab === TAB.HISTORY && renderHistoryTab()}
      </Animated.View>

      <ReceiptModal visible={showReceipt} order={lastOrder} member={member} onClose={() => setShowReceipt(false)} />
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export default function CanteenMemberScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({ NotoSerif_700Bold, GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold });

  const [view,   setView]   = useState(V.SPLASH);
  const [member, setMember] = useState(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const unsubMember = listenMember(user.uid, (data) => setMember(data));
          transitionTo(V.CANTEEN);
          return () => unsubMember();
        } catch {
          transitionTo(V.LOGIN);
        }
      } else {
        transitionTo(V.LOGIN);
      }
    });
    return () => unsub();
  }, []);

  const transitionTo = (nextView, m) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      if (m !== undefined) setMember(m);
      setView(nextView);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  const handleLogin = (m) => {
    listenMember(m.uid, (data) => setMember(data));
    transitionTo(V.CANTEEN);
  };

  const handleLogout = async () => {
    await logoutUser();
    setMember(null);
    transitionTo(V.LOGIN);
  };

  if (!fontsLoaded || view === V.SPLASH) {
    return (
      <View style={{ flex: 1 }}>
        <AppBg />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AppBg />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {view !== V.CANTEEN && (
        <View style={[s.loginHeader, { paddingTop: Platform.OS === 'web' ? 14 : 54, paddingHorizontal: isWide ? 40 : 16, paddingBottom: 14 }]}>
          {navigation && (
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.backIcon}>←</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.loginHeaderTitle, { fontSize: isWide ? 20 : isSmall ? 14 : 17 }]}>Canteen Member Login</Text>
            <Text style={[s.loginHeaderSub, { fontSize: isWide ? 10 : 8 }]}>CLIMBS MULTI-PURPOSE COOPERATIVE</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      )}

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {view === V.LOGIN   && <LoginScreen onLogin={handleLogin} />}
        {view === V.CANTEEN && member && <CanteenScreen member={member} onLogout={handleLogout} isWide={isWide} isSmall={isSmall} />}
      </Animated.View>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  loginHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.navy, borderBottomWidth: 2, borderColor: C.gold },
  loginHeaderTitle: { fontFamily: 'NotoSerif_700Bold', color: '#fff', textAlign: 'center' },
  loginHeaderSub: { fontFamily: 'GoogleSans_400Regular', color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  backIcon: { color: '#fff', fontSize: 18, fontWeight: '600' },
  loginOuter: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16 },
  loginCard: { width: '100%', maxWidth: 420, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', padding: 26, shadowColor: '#011f4b', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 6 } },
  loginLogoWrap: { alignItems: 'center', marginBottom: 16 },
  loginLogo: { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: C.gold },
  loginTitle: { fontFamily: 'NotoSerif_700Bold', fontSize: 22, color: C.navy, textAlign: 'center', marginBottom: 4 },
  loginSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', marginBottom: 18, lineHeight: 19 },
  hintBox: { backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', padding: 14, marginBottom: 18 },
  hintTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMain, lineHeight: 20 },
  hintBold: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy },
  loginBtn: { borderRadius: 28, overflow: 'hidden', marginTop: 16, marginBottom: 10, shadowColor: C.gold, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  loginBtnGrad: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  loginBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: C.navy, letterSpacing: 1.5 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(240,245,250,0.90)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: 'rgba(200,215,230,0.80)' },
  fieldRowError: { borderColor: C.red },
  fieldInput: { flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: C.navy },
  fieldErr: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.red, marginTop: 4 },
  canteenRoot: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(15,30,53,0.96)', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 2, borderColor: C.gold, gap: 10 },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  topLogo: { width: 34, height: 34, borderRadius: 8, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  topTitle: { fontFamily: 'GoogleSans_700Bold', color: '#fff' },
  topSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.gold },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(201,168,76,0.30)', borderWidth: 1.5, borderColor: C.gold, justifyContent: 'center', alignItems: 'center' },
  memberAvatarTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.gold },
  memberName: { fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(201,168,76,0.15)', borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.50)' },
  logoutTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.gold },
  cartFab: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  cartFabBadge: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: C.red, justifyContent: 'center', alignItems: 'center' },
  cartFabBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#fff' },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(15,30,53,0.88)', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2.5, borderColor: 'transparent' },
  tabBtnActive: { borderColor: C.gold },
  tabBtnTxt: { fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  tabBtnTxtActive: { fontFamily: 'GoogleSans_700Bold', color: C.gold },
  tabBadge: { backgroundColor: C.red, borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#fff' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.70)', borderRadius: 20, margin: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)' },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy },
  catSidebar: { width: 88, backgroundColor: 'rgba(255,255,255,0.18)', borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingTop: 8 },
  catBtn: { marginHorizontal: 6, marginBottom: 6, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  catBtnActive: { backgroundColor: C.gold },
  catBtnTxt: { fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: 'rgba(15,30,53,0.65)', textAlign: 'center' },
  catBtnTxtActive: { fontFamily: 'GoogleSans_700Bold', color: C.navyDark },
  itemsGrid: { padding: 10, paddingBottom: 40 },
  categoryLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1.5, borderColor: C.gold },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  menuCard: { backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 16, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)', shadowColor: '#011f4b', shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, position: 'relative' },
  cartBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  cartBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.navyDark },
  menuEmoji: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f0f4f8', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  menuItemName: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.navy, textAlign: 'center', marginBottom: 3, lineHeight: 17 },
  menuStock: { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginBottom: 4 },
  menuPrice: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.gold, marginBottom: 10 },
  addBtn: { width: '100%', backgroundColor: C.navy, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addBtnDisabled: { backgroundColor: '#ccc' },
  addBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#fff', letterSpacing: 0.5 },
  cartPanel: { width: 220, backgroundColor: 'rgba(255,255,255,0.88)', borderLeftWidth: 1.5, borderColor: 'rgba(255,255,255,0.70)', padding: 14, paddingTop: 16 },
  cartPanelTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.navy, letterSpacing: 2.5, marginBottom: 8 },
  cartPanelDivider: { height: 2, backgroundColor: C.gold, borderRadius: 1, marginBottom: 10 },
  cartEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 30 },
  cartEmptyTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted, textAlign: 'center' },
  cartPanelItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.07)' },
  cartPanelItemName: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.navy, marginBottom: 2 },
  cartPanelItemPrice: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1.5, borderColor: 'rgba(1,31,75,0.10)', marginTop: 4, marginBottom: 4 },
  cartTotalLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy },
  cartTotalVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 18, color: C.gold },
  changeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  changeLabel: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textMuted },
  changeVal: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.gold },
  payRadioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, minHeight: 36 },
  payRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.textMuted, justifyContent: 'center', alignItems: 'center' },
  payRadioActive: { borderColor: C.gold },
  payRadioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.gold },
  payRadioLabel: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textMain, flex: 1 },
  placeOrderBtn: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10, shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  placeOrderBtnDisabled: { backgroundColor: '#ccc', shadowOpacity: 0 },
  placeOrderBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#fff', letterSpacing: 1 },
  clearCartBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 6, borderRadius: 10, backgroundColor: 'rgba(231,76,60,0.10)', borderWidth: 1.5, borderColor: 'rgba(231,76,60,0.30)' },
  clearCartTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.red },
  pageOuter: { padding: 16, paddingBottom: 48 },
  pageTitle: { fontFamily: 'NotoSerif_700Bold', fontSize: 19, color: C.navy, marginBottom: 14 },
  cartItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.08)', backgroundColor: 'rgba(255,255,255,0.30)', borderRadius: 12, paddingHorizontal: 12, marginBottom: 8 },
  cartItemName: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy },
  cartItemPrice: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, marginTop: 2 },
  cartItemSubtotal: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.gold, marginHorizontal: 8 },
  removeBtn: { padding: 6 },
  removeBtnTxt: { fontSize: 14, color: C.red, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(26,45,78,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(26,45,78,0.20)' },
  qtyBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 16, color: C.navy },
  qtyNum: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.navy, width: 28, textAlign: 'center' },
  paymentSection: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.30)', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' },
  paymentTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.08)' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1.5, borderColor: 'rgba(1,31,75,0.10)', marginTop: 8 },
  totalLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.navy },
  totalVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 22, color: C.gold },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 16, padding: 44, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)' },
  emptyTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
  emptySearch: { width: '100%', paddingVertical: 40, alignItems: 'center' },
  historyCard: { backgroundColor: 'rgba(255,255,255,0.30)', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', marginBottom: 12 },
  historyCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  historyOrderId: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.navy },
  historyTimestamp: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, marginTop: 2 },
  historyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeCash: { backgroundColor: 'rgba(46,204,113,0.20)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.55)' },
  badgeGcash: { backgroundColor: 'rgba(111,163,247,0.20)', borderWidth: 1, borderColor: 'rgba(111,163,247,0.55)' },
  badgeCredit: { backgroundColor: 'rgba(245,166,35,0.20)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.55)' },
  historyBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.navy, letterSpacing: 1 },
  historyItems: { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.07)' },
  historyItemTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textMain, marginBottom: 4, lineHeight: 18 },
  historyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyTotal: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.gold },
  historyChange: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.green },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  receiptCard: { width: '100%', maxWidth: 380, borderRadius: 20, backgroundColor: '#f8fafc', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 28, shadowOffset: { width: 0, height: 10 } },
  receiptHeader: { padding: 22, alignItems: 'center', gap: 6 },
  receiptTitle: { fontFamily: 'NotoSerif_700Bold', fontSize: 20, color: '#fff' },
  receiptSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  receiptInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.06)' },
  receiptInfoLabel: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textMuted },
  receiptInfoVal: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.navy, maxWidth: '60%', textAlign: 'right' },
  receiptDivider: { height: 1.5, backgroundColor: 'rgba(1,31,75,0.10)', marginVertical: 12 },
  receiptItemsTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  receiptItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 6 },
  receiptItemEmoji: { fontSize: 16, width: 24, textAlign: 'center' },
  receiptItemName: { flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textMain },
  receiptItemQty: { fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: C.textMuted, width: 28, textAlign: 'center' },
  receiptItemTotal: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.navy, width: 60, textAlign: 'right' },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  receiptTotalLabel: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted },
  receiptTotalVal: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy },
  creditNote: { backgroundColor: 'rgba(245,166,35,0.12)', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: 'rgba(245,166,35,0.35)' },
  creditNoteTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMain, lineHeight: 17 },
  receiptCloseBtn: { backgroundColor: C.navy, padding: 16, alignItems: 'center' },
  receiptCloseTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: '#fff', letterSpacing: 1 },
});
