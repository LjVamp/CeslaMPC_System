// src/screens/MerchandiseMemberScreen.js
// CESLA MPC — Merchandise Member Portal
// Same layout/design as MerchandiseScreen (visitor), but with Firebase member login.
// Members see a login gate first; once authenticated they reach the full ordering UI.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, StatusBar, Image,
  useWindowDimensions, Platform, TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';
import { useFocusEffect } from '@react-navigation/native';
import { useMerchandise } from '../context/MerchandiseContext';

// ── Firebase ──────────────────────────────────────────────────────────────────
import {
  collection, query, where, getDocs, doc,
  updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ── Password hash (same as CoopScreen / CanteenMemberScreen) ─────────────────
const hashPw = pw => {
  let h = 0;
  for (let i = 0; i < pw.length; i++) { h = (h << 5) - h + pw.charCodeAt(i); h |= 0; }
  return 'h_' + Math.abs(h).toString(36) + pw.length;
};

const loginByUserIdFS = async (userId, password) => {
  const snap = await getDocs(query(collection(db, 'members'), where('userId', '==', userId.trim())));
  if (snap.empty) throw new Error('User ID not found. Please check your ID.');
  const d = snap.docs[0];
  const m = { uid: d.id, ...d.data() };
  if (hashPw(password) !== m.passwordHash) throw new Error('Incorrect password. Please try again.');
  if (m.status === 'Pending')  throw new Error('Your account is pending admin approval.');
  if (m.status === 'Rejected') throw new Error('Your registration was rejected. Please contact admin.');
  if (m.status === 'Inactive') throw new Error('Your account is inactive. Please contact admin.');
  await updateDoc(doc(db, 'members', d.id), { lastLogin: serverTimestamp() });
  const { passwordHash, ...safe } = m;
  return safe;
};

// ─── SIZE DATA ────────────────────────────────────────────────────────────────
const ADULT_SIZES_REF = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const KIDS_SIZES_REF  = ['2T', '3T', '4T', '5T', '6', '8', '10', '12', '14'];
const needsSize = (item) => Array.isArray(item.sizes) && item.sizes.length > 0;

// ─── LOGIN GATE MODAL ─────────────────────────────────────────────────────────
const LoginGate = ({ onLogin, onBack }) => {
  const [userId,   setUserId]   = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPw,   setShowPw]   = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!userId.trim() || !password) { setError('Please enter your User ID and password.'); return; }
    setLoading(true); setError('');
    try {
      const member = await loginByUserIdFS(userId, password);
      onLogin(member);
    } catch (e) {
      setError(e.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, opacity: fadeAnim }}>
      <Animated.View style={[loginStyles.card, { transform: [{ translateY: slideAnim }] }]}>

        {/* Icon */}
        <View style={loginStyles.iconCircle}>
          <Text style={{ fontSize: 36 }}>👤</Text>
        </View>

        <Text style={loginStyles.title}>Member Login</Text>
        <Text style={loginStyles.sub}>Sign in with your CESLA member account{'\n'}to access merchandise ordering.</Text>

        {/* Error */}
        {!!error && (
          <View style={loginStyles.errorBox}>
            <Text style={loginStyles.errorText}>⚠️  {error}</Text>
          </View>
        )}

        {/* User ID */}
        <View style={loginStyles.fieldGroup}>
          <Text style={loginStyles.label}>User ID</Text>
          <TextInput
            style={loginStyles.input}
            placeholder="Enter your User ID"
            placeholderTextColor="rgba(1,31,75,0.35)"
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
            editable={!loading}
            {...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {})}
          />
        </View>

        {/* Password */}
        <View style={loginStyles.fieldGroup}>
          <Text style={loginStyles.label}>Password</Text>
          <View style={loginStyles.pwRow}>
            <TextInput
              style={[loginStyles.input, { flex: 1 }]}
              placeholder="Enter your password"
              placeholderTextColor="rgba(1,31,75,0.35)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              editable={!loading}
              onSubmitEditing={handleLogin}
              {...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {})}
            />
            <TouchableOpacity style={loginStyles.eyeBtn} onPress={() => setShowPw(p => !p)}>
              <Text style={{ fontSize: 16 }}>{showPw ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Login button */}
        <TouchableOpacity
          style={loginStyles.loginBtn}
          onPress={handleLogin}
          activeOpacity={0.85}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? ['#aaa', '#bbb'] : ['#1a3a6b', '#2c5282']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={loginStyles.loginBtnGrad}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={loginStyles.loginBtnText}>🔐  Sign In as Member</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        {/* Back */}
        <TouchableOpacity style={loginStyles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <Text style={loginStyles.backBtnText}>← Back to Portal</Text>
        </TouchableOpacity>

      </Animated.View>
    </Animated.View>
  );
};

const loginStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 20, padding: 28,
    width: '100%', maxWidth: 400,
    alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.90)',
    shadowColor: '#011f4b', shadowOpacity: 0.18,
    shadowRadius: 24, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(26,58,107,0.10)',
    borderWidth: 1.5, borderColor: 'rgba(26,58,107,0.18)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'NotoSerif_700Bold', fontSize: 20,
    color: '#011f4b', letterSpacing: 0.5,
  },
  sub: {
    fontFamily: 'GoogleSans_400Regular', fontSize: 13,
    color: 'rgba(1,31,75,0.65)', textAlign: 'center', lineHeight: 19,
  },
  errorBox: {
    width: '100%', backgroundColor: 'rgba(231,76,60,0.12)',
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: 'rgba(231,76,60,0.30)',
  },
  errorText: {
    fontFamily: 'GoogleSans_400Regular', fontSize: 12,
    color: '#c0392b', textAlign: 'center',
  },
  fieldGroup: { width: '100%', gap: 4 },
  label: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 11,
    color: 'rgba(1,31,75,0.60)', letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: 'GoogleSans_400Regular', fontSize: 14,
    color: '#011f4b', borderWidth: 1.5,
    borderColor: 'rgba(1,31,75,0.18)',
  },
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: 'rgba(1,31,75,0.07)',
    borderWidth: 1.5, borderColor: 'rgba(1,31,75,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  loginBtn: {
    width: '100%', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#1a3a6b', shadowOpacity: 0.30,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    marginTop: 4,
  },
  loginBtnGrad: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  loginBtnText: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 15,
    color: '#fff', letterSpacing: 0.5,
  },
  backBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 8, marginTop: 2,
  },
  backBtnText: {
    fontFamily: 'GoogleSans_400Regular', fontSize: 13,
    color: 'rgba(1,31,75,0.55)',
  },
});

// ─── SIZE PICKER MODAL ────────────────────────────────────────────────────────
const SizePickerModal = ({ visible, item, onConfirm, onClose }) => {
  const [sel, setSel] = React.useState(null);
  React.useEffect(() => { if (visible) setSel(null); }, [visible]);
  if (!item) return null;

  const availableSizes = Array.isArray(item.sizes) ? item.sizes : [];
  const adultSizes = availableSizes.filter(s => ADULT_SIZES_REF.includes(s));
  const kidsSizes  = availableSizes.filter(s => KIDS_SIZES_REF.includes(s));
  const otherSizes = availableSizes.filter(s => !ADULT_SIZES_REF.includes(s) && !KIDS_SIZES_REF.includes(s));

  const SizeChip = ({ size, isKids }) => (
    <TouchableOpacity
      onPress={() => setSel(size)}
      style={{
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
        backgroundColor: sel === size ? (isKids ? '#1a6b45' : '#1a3a6b') : 'rgba(1,31,75,0.07)',
        borderWidth: 1.5,
        borderColor: sel === size ? (isKids ? '#1a6b45' : '#1a3a6b') : 'rgba(1,31,75,0.15)',
        minWidth: 50, alignItems: 'center',
      }}
    >
      <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: sel === size ? '#fff' : 'rgba(1,31,75,0.65)' }}>{size}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(1,20,50,0.60)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 22, width: 320, gap: 14 }}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: '#1a3a6b' }}>{item.emoji}  Select Size</Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(1,31,75,0.55)', textAlign: 'center' }} numberOfLines={2}>{item.name}</Text>
          </View>
          {availableSizes.length === 0 ? (
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(1,31,75,0.45)', textAlign: 'center', paddingVertical: 8 }}>No sizes set for this item.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {adultSizes.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(26,58,107,0.50)', letterSpacing: 1.2, textTransform: 'uppercase' }}>ADULT</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {adultSizes.map(sz => <SizeChip key={sz} size={sz} isKids={false} />)}
                  </View>
                </View>
              )}
              {kidsSizes.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(26,107,69,0.60)', letterSpacing: 1.2, textTransform: 'uppercase' }}>KIDS</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {kidsSizes.map(sz => <SizeChip key={sz} size={sz} isKids={true} />)}
                  </View>
                </View>
              )}
              {otherSizes.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(1,31,75,0.45)', letterSpacing: 1.2, textTransform: 'uppercase' }}>OTHER</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {otherSizes.map(sz => <SizeChip key={sz} size={sz} isKids={false} />)}
                  </View>
                </View>
              )}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: 'rgba(1,31,75,0.07)', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: 'rgba(1,31,75,0.50)' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => sel && onConfirm(sel)}
              style={{ flex: 2, paddingVertical: 11, borderRadius: 10, backgroundColor: sel ? '#1a3a6b' : 'rgba(1,31,75,0.20)', alignItems: 'center' }}
            >
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff' }}>
                {sel ? ('Confirm — ' + sel) : 'Pick a size'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── IMAGE ZOOM MODAL ─────────────────────────────────────────────────────────
const ImageZoomModal = ({ visible, item, onClose }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 70, friction: 11, useNativeDriver: true }),
      ]).start();
    } else { fadeAnim.setValue(0); scaleAnim.setValue(0.85); }
  }, [visible]);
  if (!item) return null;
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(1,15,40,0.80)', justifyContent: 'center', alignItems: 'center', opacity: fadeAnim }}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <Animated.View style={{ alignItems: 'center', gap: 16, transform: [{ scale: scaleAnim }] }}>
          <View style={{ width: 220, height: 220, borderRadius: 110, overflow: 'hidden', backgroundColor: 'rgba(240,246,252,0.95)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.90)', justifyContent: 'center', alignItems: 'center' }}>
            {item.image ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ fontSize: 90 }}>{item.emoji}</Text>}
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 18, color: '#fff', textAlign: 'center', paddingHorizontal: 20 }}>{item.name}</Text>
            <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 22, color: '#c9a84c' }}>₱{item.price}.00</Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.60)' }}>Stock: {item.stock}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ paddingHorizontal: 28, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff' }}>✕  Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── ITEM CARD ────────────────────────────────────────────────────────────────
const ItemCard = ({ item, onAdd }) => {
  const [zoomed, setZoomed] = useState(false);
  const hasSizes = Array.isArray(item.sizes) && item.sizes.length > 0;
  return (
    <View style={styles.foodCard}>
      {Platform.OS === 'web' ? (
        <LinearGradient colors={['rgba(220,232,242,0.80)', 'rgba(200,218,235,0.60)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.foodCardInner}>
          <TouchableOpacity style={styles.emojiCircle} onPress={() => setZoomed(true)} activeOpacity={0.80}>
            {item.image ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%', borderRadius: 99 }} resizeMode="cover" /> : <Text style={styles.emojiText}>{item.emoji}</Text>}
          </TouchableOpacity>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.itemPrice}>₱{item.price}.00</Text>
          <Text style={styles.itemStock}>Stock: {item.stock}</Text>
          {hasSizes && (
            <View style={{ backgroundColor: 'rgba(26,58,107,0.10)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 2 }}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: Platform.OS === 'web' ? 7 : 6, color: '#1a3a6b', textAlign: 'center' }}>👕 Tap to pick size</Text>
            </View>
          )}
          <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
            <Text style={styles.addBtnText}>{hasSizes ? 'Select Size & Add' : 'Add To Cart'}</Text>
          </TouchableOpacity>
        </LinearGradient>
      ) : (
        <View style={[styles.foodCardInner, { backgroundColor: 'rgba(225,238,248,0.85)' }]}>
          <TouchableOpacity style={styles.emojiCircle} onPress={() => setZoomed(true)} activeOpacity={0.80}>
            {item.image ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%', borderRadius: 99 }} resizeMode="cover" /> : <Text style={styles.emojiText}>{item.emoji}</Text>}
          </TouchableOpacity>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.itemPrice}>₱{item.price}.00</Text>
          <Text style={styles.itemStock}>Stock: {item.stock}</Text>
          {hasSizes && (
            <View style={{ backgroundColor: 'rgba(26,58,107,0.10)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 2 }}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 6, color: '#1a3a6b', textAlign: 'center' }}>👕 Tap to pick size</Text>
            </View>
          )}
          <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
            <Text style={styles.addBtnText}>{hasSizes ? 'Select Size & Add' : 'Add To Cart'}</Text>
          </TouchableOpacity>
        </View>
      )}
      <ImageZoomModal visible={zoomed} item={item} onClose={() => setZoomed(false)} />
    </View>
  );
};

// ─── RECEIPT MODAL ────────────────────────────────────────────────────────────
const ReceiptModal = ({ visible, orderData, onClose, onPrint, receiptViewRef }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
      ]).start();
    } else { fadeAnim.setValue(0); slideAnim.setValue(60); }
  }, [visible]);

  if (!orderData) return null;
  const { items, total, orderNo, time, paymentMode, member } = orderData;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.receiptOverlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <Animated.View ref={receiptViewRef} style={[styles.receiptCard, { transform: [{ translateY: slideAnim }] }]} {...(Platform.OS === 'web' ? { 'data-receipt-card': 'true' } : {})}>
          <View style={styles.receiptJaggedTop}>{Array.from({ length: 18 }).map((_, i) => <View key={i} style={styles.receiptJaggedTriangle} />)}</View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptShopName}>🏪  CESLA MERCHANDISE</Text>
              <Text style={styles.receiptShopSub}>Merchandise Ordering System</Text>
              <View style={styles.receiptDividerDashed} />
              <Text style={styles.receiptMeta}>Order No.: #{orderNo}</Text>
              <Text style={styles.receiptMeta}>{time}</Text>
              <Text style={styles.receiptMeta}>Member: {member?.fullName || member?.name || 'Member'}</Text>
              <Text style={styles.receiptMeta}>ID: {member?.userId || '—'}</Text>
              <View style={styles.receiptDividerDashed} />
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              <View style={styles.receiptItemHeader}>
                <Text style={[styles.receiptItemHCol, { flex: 1 }]}>ITEM</Text>
                <Text style={[styles.receiptItemHCol, { width: 32, textAlign: 'center' }]}>QTY</Text>
                <Text style={[styles.receiptItemHCol, { width: 64, textAlign: 'right' }]}>AMOUNT</Text>
              </View>
              <View style={styles.receiptDividerSolid} />
              {items.map(({ item, qty, size }) => (
                <View key={size ? (item.id + '-' + size) : item.id} style={styles.receiptItemRow}>
                  <Text style={[styles.receiptItemText, { flex: 1 }]} numberOfLines={1}>{item.emoji} {item.name}{size ? (' [' + size + ']') : ''}</Text>
                  <Text style={[styles.receiptItemText, { width: 32, textAlign: 'center' }]}>{qty}</Text>
                  <Text style={[styles.receiptItemText, { width: 64, textAlign: 'right' }]}>₱{(item.price * qty).toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.receiptDividerSolid} />
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptTotalLabel}>TOTAL</Text>
                <Text style={styles.receiptTotalValue}>₱ {total.toFixed(2)}</Text>
              </View>
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptSubTotalLabel}>Payment</Text>
                <Text style={styles.receiptSubTotalValue}>{paymentMode === 'credits' ? '🪙 Member Credits' : paymentMode === 'gcash' ? '📱 GCash' : '💵 Cash'}</Text>
              </View>
              <View style={styles.receiptDividerDashed} />
              <Text style={styles.receiptThankYou}>Thank you for your order! 🙏</Text>
              <Text style={styles.receiptFooter}>— CESLA MPC Merchandise © 2025 —</Text>
            </View>
          </ScrollView>
          <View style={styles.receiptJaggedBottom}>{Array.from({ length: 18 }).map((_, i) => <View key={i} style={styles.receiptJaggedTriangleBottom} />)}</View>
          <View style={styles.receiptActions}>
            <TouchableOpacity style={styles.receiptCloseBtn} onPress={onClose}>
              <Text style={styles.receiptCloseBtnText}>✕  Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.receiptPrintBtn} onPress={onPrint}>
              <LinearGradient colors={['#1a3a6b', '#2c5282']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.receiptPrintBtnGrad}>
                <Text style={styles.receiptPrintBtnText}>⬇️  Download as Image</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── CART PANEL ───────────────────────────────────────────────────────────────
const CartPanel = ({ cart, onAdd, onRemove, onClear, isWide, hideTitle, lastOrder, onShowReceipt, onPlaceOrder, member }) => {
  const [checked, setChecked]       = useState({});
  const [paymentMode, setPaymentMode] = useState('cash');

  const cartItems = Object.values(cart).filter(i => i.qty > 0);

  useEffect(() => {
    setChecked(prev => {
      const updated = { ...prev };
      cartItems.forEach(({ item, size }) => {
        const k = size ? (item.id + '-' + size) : item.id;
        if (updated[k] === undefined) updated[k] = true;
      });
      return updated;
    });
  }, [JSON.stringify(cartItems.map(i => i.item.id + (i.size || '')))]);

  const toggleCheck = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const checkedItems = cartItems.filter(({ item, size }) => {
    const k = size ? (item.id + '-' + size) : item.id;
    return checked[k];
  });
  const total = checkedItems.reduce((s, { item, qty }) => s + item.price * qty, 0);

  const handlePlaceOrder = () => {
    if (checkedItems.length === 0) return;
    const orderNo = Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const time = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
      + '  ' + now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    onPlaceOrder({ items: checkedItems, total, amountPaid: total, change: 0, orderNo, time, paymentMode, member });
  };

  return (
    <View style={[styles.cartPanel, !isWide && styles.cartPanelMobile]}>
      {!hideTitle && (
        <>
          <Text style={styles.cartPanelTitle}>CART</Text>
          {/* Member chip */}
          {member && (
            <View style={styles.memberChip}>
              <Text style={styles.memberChipText}>👤 {member.fullName || member.name || member.userId}</Text>
            </View>
          )}
        </>
      )}

      <View style={styles.cartItemsBox}>
        {cartItems.length === 0 ? (
          <Text style={styles.cartEmpty}>Cart is empty.</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
            {cartItems.map(({ item, qty, size }) => {
              const cartKey = size ? (item.id + '-' + size) : item.id;
              return (
                <View key={cartKey} style={styles.cartRow}>
                  <TouchableOpacity style={[styles.checkbox, checked[cartKey] && styles.checkboxChecked]} onPress={() => toggleCheck(cartKey)}>
                    {checked[cartKey] && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                  <Text style={styles.cartRowEmoji}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartRowName} numberOfLines={1}>{item.name}{size ? (' [' + size + ']') : ''}</Text>
                    <Text style={styles.cartRowSub}>x{qty}  ₱{item.price * qty}</Text>
                  </View>
                  <View style={styles.cartRowQty}>
                    <TouchableOpacity style={styles.cartQBtn} onPress={() => onRemove(item, size)}><Text style={styles.cartQBtnText}>−</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.cartQBtn, styles.cartQBtnAdd]} onPress={() => onAdd(item, size)}><Text style={[styles.cartQBtnText, { color: '#fff' }]}>+</Text></TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total :</Text>
        <Text style={styles.totalValue}>₱ {total.toFixed(2)}</Text>
      </View>

      {/* Payment mode */}
      <View style={styles.paymentModeBox}>
        <Text style={styles.paymentModeLabel}>Mode of Payment</Text>
        <View style={styles.paymentModeRow}>
          {[
            { key: 'cash',    label: '💵 Cash'    },
            { key: 'gcash',   label: '📱 GCash'   },
            { key: 'credits', label: '🪙 Credits'  },
          ].map(p => (
            <TouchableOpacity key={p.key} style={styles.paymentModeOption} onPress={() => setPaymentMode(p.key)} activeOpacity={0.8}>
              <View style={[styles.radioOuter, paymentMode === p.key && styles.radioOuterActive]}>
                {paymentMode === p.key && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.paymentModeText, paymentMode === p.key && styles.paymentModeTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.placeOrderBtn, checkedItems.length === 0 && styles.placeOrderBtnDisabled]}
        onPress={handlePlaceOrder}
        activeOpacity={checkedItems.length === 0 ? 1 : 0.80}
      >
        <LinearGradient
          colors={checkedItems.length > 0 ? ['#27ae60', '#2ecc71'] : ['#aaa', '#bbb']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.placeOrderGrad}
        >
          <Text style={styles.placeOrderIcon}>✅</Text>
          <Text style={styles.placeOrderText}>Place Order ({checkedItems.length})</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.clearBtn} onPress={onClear} activeOpacity={0.80}>
        <Text style={styles.clearBtnIcon}>🗑️</Text>
        <Text style={styles.clearBtnText}>Clear Cart</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.printBtn, !lastOrder && { opacity: 0.45 }]}
        onPress={lastOrder ? onShowReceipt : null}
        activeOpacity={0.80}
      >
        <Text style={styles.printBtnIcon}>⬇️</Text>
        <Text style={styles.printBtnText}>Download Receipt</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── MOBILE CART BOTTOM SHEET ─────────────────────────────────────────────────
const CartBottomSheet = ({ cart, onAdd, onRemove, onClear, onClose, onPlaceOrder, lastOrder, onShowReceipt, member }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }).start();
  }, []);
  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  return (
    <View style={styles.sheetOverlay}>
      <TouchableOpacity style={styles.sheetBackdrop} onPress={onClose} activeOpacity={1} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.cartPanelTitle}>CART</Text>
            {member && <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.55)', marginTop: 2 }}>👤 {member.fullName || member.userId}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
            <Text style={{ color: 'rgba(1,31,75,0.6)', fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <CartPanel
            cart={cart} onAdd={onAdd} onRemove={onRemove} onClear={onClear}
            isWide={false} hideTitle={true}
            onPlaceOrder={onPlaceOrder} lastOrder={lastOrder} onShowReceipt={onShowReceipt}
            member={member}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

// ─── AD BANNER ────────────────────────────────────────────────────────────────
const AdBanner = ({ isWide, adAnim }) => {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef(null);
  const { width } = useWindowDimensions();

  const ADS = [
    { id: 1, bg: ['#1a3a6b', '#2e5fa3'], emoji: '📦', title: 'CESLA Merchandise', sub: 'Quality products available now!' },
    { id: 2, bg: ['#7b3f00', '#c9a84c'], emoji: '🎁', title: 'Member Exclusive',   sub: 'Order with your member account!' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(prev => {
        const next = (prev + 1) % ADS.length;
        scrollRef.current?.scrollTo({ x: next * bannerW, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const bannerW = isWide ? Math.min(width * 0.55, 700) : width - 48;

  return (
    <Animated.View style={[{ alignSelf: 'stretch' }]}>
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setCurrent(Math.round(e.nativeEvent.contentOffset.x / bannerW))}
        style={{ width: bannerW, alignSelf: 'center' }}
        contentContainerStyle={{ width: bannerW * ADS.length }}
      >
        {ADS.map(ad => (
          <LinearGradient key={ad.id} colors={ad.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[adStyles.slide, { width: bannerW }]}>
            <Text style={adStyles.adEmoji}>{ad.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={adStyles.adTitle}>{ad.title}</Text>
              <Text style={adStyles.adSub}>{ad.sub}</Text>
            </View>
            <View style={adStyles.adBadge}><Text style={adStyles.adBadgeTxt}>AD</Text></View>
            <View style={adStyles.dotsInner}>
              {ADS.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => { scrollRef.current?.scrollTo({ x: i * bannerW, animated: true }); setCurrent(i); }}>
                  <View style={[adStyles.dot, current === i && adStyles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

const adStyles = StyleSheet.create({
  slide: { height: 120, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, gap: 16, overflow: 'hidden' },
  adEmoji: { fontSize: 52 },
  adTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 18, color: '#fff' },
  adSub:   { fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  adBadge: { position: 'absolute', top: 10, right: 12, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  adBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#fff', letterSpacing: 1 },
  dotsInner: { position: 'absolute', bottom: 7, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.40)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function MerchandiseMemberScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, NotoSerif_700Bold_Italic,
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const { items: MERCH_ITEMS, categories: CATEGORIES, reloadFromStorage, addOrder, deductStock } = useMerchandise();

  useFocusEffect(useCallback(() => { reloadFromStorage(); }, [reloadFromStorage]));

  // ── Auth state ──
  const [member,    setMember]    = useState(null); // null = not logged in
  const [loggedIn,  setLoggedIn]  = useState(false);

  const [activeCategory, setActiveCategory] = useState('All');
  const [search,         setSearch]         = useState('');
  const [cart,           setCart]           = useState({});
  const [cartOpen,       setCartOpen]       = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [lastOrder,      setLastOrder]      = useState(null);
  const [sizePickerItem, setSizePickerItem] = useState(null);

  const hdrFade  = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-16)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;
  const adAnim   = useRef(new Animated.Value(1)).current;
  const lastScrollY  = useRef(0);
  const receiptViewRef = useRef(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(hdrTrans, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    Animated.timing(bodyFade, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }).start();
  }, []);

  const handleBack = () => {
    if (!navigation) return;
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  const handleLogin = (memberData) => {
    setMember(memberData);
    setLoggedIn(true);
  };

  const handleLogout = () => {
    setMember(null);
    setLoggedIn(false);
    setCart({});
    setLastOrder(null);
  };

  const addToCart = (item, size) => {
    if (needsSize(item) && !size) { setSizePickerItem(item); return; }
    const key = needsSize(item) ? (item.id + '-' + size) : item.id;
    setCart(prev => ({ ...prev, [key]: { item, qty: (prev[key] ? prev[key].qty : 0) + 1, size: size || null } }));
  };

  const removeFromCart = (item, size) => {
    const key = needsSize(item) ? (item.id + '-' + size) : item.id;
    setCart(prev => {
      const qty = (prev[key] ? prev[key].qty : 0) - 1;
      if (qty <= 0) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: { item, qty, size: size || null } };
    });
  };

  const clearCart = () => setCart({});

  const handlePlaceOrder = async (orderData) => {
    try {
      await addOrder({ ...orderData, status: 'done', source: 'member', memberId: member?.uid, memberName: member?.fullName || member?.name });
      await deductStock(orderData.items);
    } catch (e) { console.warn('handlePlaceOrder error:', e); }
    setLastOrder(orderData);
    setCartOpen(false);
    clearCart();
    setTimeout(() => setReceiptVisible(true), 300);
  };

  const handlePrint = async () => {
    if (!lastOrder) return;
    const { orderNo } = lastOrder;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (!window.html2canvas) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = resolve; script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        const el = document.querySelector('[data-receipt-card="true"]');
        if (!el) { alert('Receipt not ready yet.'); return; }
        const canvas = await window.html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#fffef8', logging: false });
        const link = document.createElement('a');
        link.download = 'CESLA_Receipt_' + orderNo + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (e) { alert('Could not capture receipt: ' + e.message); }
    } else {
      Alert.alert('Download', 'Receipt download is available on web. On mobile, screenshot this receipt.');
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (text.trim() === '') return;
    const matches = MERCH_ITEMS.filter(i => i.name.toLowerCase().includes(text.toLowerCase()));
    if (matches.length === 0) return;
    const cats = [...new Set(matches.map(i => i.cat))];
    setActiveCategory(cats.length === 1 ? cats[0] : 'All');
  };

  const filtered = MERCH_ITEMS.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    if (search.trim() !== '') return matchesSearch;
    return activeCategory === 'All' || i.cat === activeCategory;
  });

  const totalItems = Object.values(cart).reduce((s, { qty }) => s + qty, 0);

  const CART_W = isWide ? 230 : 0;
  const CAT_W  = isWide ? 170 : 0;
  const MARGIN = isWide ? 80 : 20;
  const GAP_C  = Platform.OS === 'web' ? 10 : 5;
  const COLS   = Platform.OS === 'web' ? 5 : 3;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* BACKGROUND */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
      <LinearGradient colors={['rgba(198,220,235,0.85)', 'rgba(152,186,213,0.40)', 'rgba(80,110,150,0.0)']} locations={[0, 0.45, 1]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(50,80,120,0.45)', 'rgba(50,80,120,0.0)', 'rgba(50,80,120,0.45)']} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(50,80,120,0.0)', 'rgba(60,90,130,0.35)']} locations={[0.4, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />

      {/* HEADER */}
      <Animated.View style={{ opacity: hdrFade, transform: [{ translateY: hdrTrans }], marginTop: Platform.OS === 'web' ? 16 : 36, marginHorizontal: isSmall ? 8 : 10, zIndex: 10 }}>
        <View style={[styles.header, { paddingHorizontal: isWide ? 40 : 12, paddingVertical: isWide ? 16 : 7 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1, { fontSize: isWide ? 22 : isSmall ? 14 : 16 }]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>CESLA </Text>Merchandise — Member
            </Text>
            {loggedIn && member ? (
              <View style={styles.visitorTag}>
                <Text style={styles.visitorTagText}>👤  {member.fullName || member.name || member.userId}</Text>
              </View>
            ) : (
              <View style={styles.visitorTag}>
                <Text style={styles.visitorTagText}>📦  MEMBER MERCHANDISE</Text>
              </View>
            )}
          </View>
          {/* Logout button (when logged in) */}
          <TouchableOpacity style={styles.backBtn} onPress={loggedIn ? handleLogout : undefined} activeOpacity={loggedIn ? 0.75 : 1}>
            <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', lineHeight: 16, includeFontPadding: false }}>
              {loggedIn ? '🚪' : '≡'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* BODY */}
      <Animated.View style={[styles.body, { opacity: bodyFade }]}>
        {!loggedIn ? (
          /* ─── LOGIN GATE ─── */
          <LoginGate onLogin={handleLogin} onBack={handleBack} />
        ) : (
          /* ─── ORDERING UI (same as MerchandiseScreen) ─── */
          <>
            {/* LEFT — Categories */}
            {isWide && (
              <View style={styles.catPanel}>
                <Text style={styles.catPanelTitle}>CATEGORIES</Text>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat} style={[styles.catBtn, activeCategory === cat && styles.catBtnActive]} onPress={() => setActiveCategory(cat)}>
                    <Text style={[styles.catBtnText, activeCategory === cat && styles.catBtnTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* CENTER */}
            <View style={styles.centerPanel}>
              {!isWide && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 8 }} contentContainerStyle={{ paddingHorizontal: 4, gap: 5, paddingVertical: 2 }}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity key={cat} style={[styles.catTab, activeCategory === cat && styles.catTabActive]} onPress={() => setActiveCategory(cat)}>
                      <Text style={[styles.catTabText, activeCategory === cat && styles.catTabTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={{ marginBottom: 12, flexShrink: 0 }}>
                <AdBanner isWide={isWide} adAnim={adAnim} />
              </View>

              <View style={styles.itemsPanel}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#011f4b', letterSpacing: 2, flexShrink: 0 }}>
                    {search.trim() !== '' ? ('RESULTS FOR "' + search.toUpperCase() + '"') : activeCategory === 'All' ? 'ALL ITEMS' : activeCategory.toUpperCase()}
                  </Text>
                  <View style={styles.searchBoxInline}>
                    <Text style={{ fontSize: 11, marginRight: 4 }}>🔍</Text>
                    <TextInput
                      style={styles.searchInputInline}
                      placeholder="Search..."
                      placeholderTextColor="rgba(1,31,75,0.35)"
                      value={search}
                      onChangeText={handleSearch}
                    />
                    {search.length > 0 && (
                      <TouchableOpacity onPress={() => { setSearch(''); setActiveCategory('All'); }}>
                        <Text style={{ color: 'rgba(1,31,75,0.45)', fontSize: 12, fontWeight: '700' }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: 'rgba(1,31,75,0.10)', marginBottom: 8 }} />
                <ScrollView
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  style={Platform.OS === 'web' ? { height: height - 310 } : { flex: 1 }}
                  contentContainerStyle={[styles.menuGrid, { gap: Platform.OS === 'web' ? 10 : 5, paddingBottom: 20 }]}
                >
                  {filtered.length === 0 ? (
                    <Text style={styles.emptyText}>No items found.</Text>
                  ) : (
                    Array.from({ length: Math.ceil(filtered.length / COLS) }, (_, rowIdx) => (
                      <View key={rowIdx} style={{ flexDirection: 'row', gap: Platform.OS === 'web' ? 10 : 5, marginBottom: Platform.OS === 'web' ? 0 : 5 }}>
                        {filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS).map(item => (
                          <View key={item.id} style={{ flex: 1 }}>
                            <ItemCard item={item} onAdd={() => addToCart(item)} />
                          </View>
                        ))}
                        {Array.from({ length: COLS - filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS).length }).map((_, i) => (
                          <View key={'empty-' + i} style={{ flex: 1 }} />
                        ))}
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>

            {/* RIGHT — Cart */}
            {isWide && (
              <CartPanel
                cart={cart} onAdd={addToCart} onRemove={removeFromCart}
                onClear={clearCart} isWide={isWide} hideTitle={false}
                onPlaceOrder={handlePlaceOrder} lastOrder={lastOrder}
                onShowReceipt={() => setReceiptVisible(true)} member={member}
              />
            )}

            {/* Mobile floating cart button */}
            {!isWide && (
              <TouchableOpacity style={styles.floatCart} onPress={() => setCartOpen(true)} activeOpacity={0.85}>
                <LinearGradient colors={['#c9a84c', '#e8c87a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.floatCartGradient}>
                  <Text style={styles.floatCartText}>
                    🛒  View Cart  {totalItems > 0 ? ('(' + totalItems + ')') : ''}  •  ₱{Object.values(cart).reduce((s, { item, qty }) => s + item.price * qty, 0).toFixed(2)}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}
      </Animated.View>

      {/* Mobile cart bottom sheet */}
      {loggedIn && !isWide && cartOpen && (
        <CartBottomSheet
          cart={cart} onAdd={addToCart} onRemove={removeFromCart}
          onClear={clearCart} onClose={() => setCartOpen(false)}
          onPlaceOrder={handlePlaceOrder} lastOrder={lastOrder}
          onShowReceipt={() => setReceiptVisible(true)} member={member}
        />
      )}

      <SizePickerModal
        visible={!!sizePickerItem} item={sizePickerItem}
        onConfirm={(size) => { addToCart(sizePickerItem, size); setSizePickerItem(null); }}
        onClose={() => setSizePickerItem(null)}
      />

      <ReceiptModal
        visible={receiptVisible} orderData={lastOrder}
        onClose={() => setReceiptVisible(false)} onPrint={handlePrint}
        receiptViewRef={receiptViewRef}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, ...(Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}) },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#304674', borderRadius: 14,
    borderBottomWidth: 1, borderColor: 'rgba(201,168,76,0.25)',
    shadowColor: '#011f4b', shadowOpacity: 0.20, shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  backIcon: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  headerH1: { fontFamily: 'NotoSerif_700Bold', fontWeight: '700', color: '#ffffff', textAlign: 'center', letterSpacing: 0.3 },
  headerGold: { fontFamily: 'NotoSerif_700Bold_Italic', color: '#c9a84c', fontStyle: 'italic' },
  visitorTag: {
    marginTop: 0, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.60)',
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center',
  },
  visitorTagText: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 9,
    color: '#ffffff', letterSpacing: 1.5, textTransform: 'uppercase',
    textAlign: 'center', lineHeight: 13, includeFontPadding: false,
  },
  memberChip: {
    backgroundColor: 'rgba(26,58,107,0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, marginBottom: 4,
    borderWidth: 1, borderColor: 'rgba(26,58,107,0.20)',
  },
  memberChipText: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#1a3a6b' },

  body: {
    flex: 1, flexDirection: 'row', alignItems: 'stretch',
    marginTop: Platform.OS === 'web' ? 12 : 6,
    minHeight: 0,
    overflow: Platform.OS === 'web' ? 'hidden' : 'visible',
  },

  catPanel: {
    width: 170, backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 16, marginLeft: 20, marginBottom: 16,
    padding: 12, gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)',
    overflow: 'hidden', minHeight: 0,
  },
  catPanelTitle: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 12,
    color: 'rgba(1,31,75,0.65)', letterSpacing: 3,
    textTransform: 'uppercase', marginBottom: 6,
    paddingBottom: 6, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.12)',
  },
  catBtn: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.70)',
  },
  catBtnActive: { backgroundColor: '#c9a84c', borderColor: '#c9a84c' },
  catBtnText: { fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: 'rgba(1,31,75,0.75)', textAlign: 'center' },
  catBtnTextActive: { fontFamily: 'GoogleSans_700Bold', color: '#0d1b3e' },

  centerPanel: { flex: 1, flexDirection: 'column', paddingHorizontal: Platform.OS === 'web' ? 12 : 10, paddingBottom: Platform.OS === 'web' ? 16 : 0, minHeight: 0, overflow: Platform.OS === 'web' ? 'hidden' : 'visible' },
  itemsPanel: {
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)',
    padding: Platform.OS === 'web' ? 10 : 6,
    overflow: 'hidden', flex: 1, marginBottom: Platform.OS === 'web' ? 16 : 8,
  },

  searchBoxInline: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)', flex: 1,
  },
  searchInputInline: {
    flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: '#011f4b', paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },

  catTab: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  catTabActive: { backgroundColor: '#304674', borderColor: '#c9a84c' },
  catTabText: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 16, includeFontPadding: false },
  catTabTextActive: { fontFamily: 'GoogleSans_700Bold', color: '#fff' },

  menuGrid: { paddingTop: 2 },
  emptyText: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(1,31,75,0.55)', padding: 20 },

  foodCard: {
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#011f4b', shadowOpacity: 0.10, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 3, flex: 1,
  },
  foodCardInner: {
    borderRadius: 14, padding: Platform.OS === 'web' ? 14 : 8,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center', gap: Platform.OS === 'web' ? 4 : 3,
    flex: 1, justifyContent: 'space-between',
  },
  emojiCircle: {
    width: Platform.OS === 'web' ? 72 : 52, height: Platform.OS === 'web' ? 72 : 52,
    borderRadius: Platform.OS === 'web' ? 36 : 26,
    backgroundColor: 'rgba(240,246,252,0.90)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Platform.OS === 'web' ? 6 : 3,
  },
  emojiText: { fontSize: Platform.OS === 'web' ? 34 : 24 },
  itemName: {
    fontFamily: 'GoogleSans_700Bold', fontSize: Platform.OS === 'web' ? 11 : 9,
    color: '#1a2d4e', textAlign: 'center', lineHeight: Platform.OS === 'web' ? 15 : 12,
    minHeight: Platform.OS === 'web' ? 15 : 24,
  },
  itemStock: { fontFamily: 'GoogleSans_400Regular', fontSize: Platform.OS === 'web' ? 10 : 9, color: 'rgba(1,31,75,0.45)', letterSpacing: 0.2 },
  itemPrice: { fontFamily: 'NotoSerif_700Bold', fontSize: Platform.OS === 'web' ? 14 : 12, color: '#c9a84c', fontWeight: '700', letterSpacing: 0.3 },
  addBtn: {
    backgroundColor: '#1a3a6b', borderRadius: 7,
    paddingVertical: Platform.OS === 'web' ? 8 : 6, paddingHorizontal: 4,
    marginTop: 2, alignItems: 'center', width: '100%',
  },
  addBtnText: { fontFamily: 'GoogleSans_700Bold', fontSize: Platform.OS === 'web' ? 10 : 9, color: '#ffffff', letterSpacing: 0.3 },

  cartPanel: {
    width: 230, backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 16, marginRight: 20, marginBottom: 16,
    padding: 14, gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)',
    overflow: 'hidden', minHeight: 0,
  },
  cartPanelMobile: { width: '100%', marginRight: 0, marginBottom: 0, borderRadius: 0, backgroundColor: 'transparent', borderWidth: 0, padding: 14 },
  cartPanelTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: 'rgba(1,31,75,0.70)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4, paddingBottom: 6, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.12)' },
  cartItemsBox: { backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 10, padding: 10, minHeight: 60, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' },
  cartEmpty: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(1,31,75,0.45)', textAlign: 'center', paddingVertical: 8 },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.07)' },
  cartRowEmoji: { fontSize: 18 },
  cartRowName: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#011f4b' },
  cartRowSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(1,31,75,0.55)' },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: 'rgba(1,31,75,0.30)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.80)', flexShrink: 0, marginRight: 6 },
  checkboxChecked: { backgroundColor: '#27ae60', borderColor: '#27ae60' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  cartRowQty: { flexDirection: 'row', gap: 4 },
  cartQBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(1,31,75,0.20)', justifyContent: 'center', alignItems: 'center' },
  cartQBtnAdd: { backgroundColor: '#1a3a6b', borderColor: '#1a3a6b' },
  cartQBtnText: { fontSize: 13, color: '#011f4b', fontWeight: '700', lineHeight: 17 },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  totalLabel: { fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: 'rgba(1,31,75,0.75)' },
  totalValue: { fontFamily: 'NotoSerif_700Bold', fontSize: 15, color: '#0d1b3e' },

  paymentModeBox: { backgroundColor: 'rgba(255,255,255,0.30)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.60)', marginVertical: 4 },
  paymentModeLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(1,31,75,0.60)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  paymentModeRow: { flexDirection: 'column', gap: 8 },
  paymentModeOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(1,31,75,0.30)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.70)' },
  radioOuterActive: { borderColor: '#1a3a6b' },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#1a3a6b' },
  paymentModeText: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(1,31,75,0.55)' },
  paymentModeTextActive: { fontFamily: 'GoogleSans_700Bold', color: '#1a3a6b' },

  placeOrderBtn: { borderRadius: 12, overflow: 'hidden', shadowColor: '#27ae60', shadowOpacity: 0.40, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  placeOrderBtnDisabled: { shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  placeOrderGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  placeOrderIcon: { fontSize: 16 },
  placeOrderText: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#ffffff', letterSpacing: 0.5 },

  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#e74c3c', borderRadius: 12, paddingVertical: 12 },
  clearBtnIcon: { fontSize: 14 },
  clearBtnText: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff', letterSpacing: 0.3 },

  printBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#1a3a6b', borderRadius: 12, paddingVertical: 12 },
  printBtnIcon: { fontSize: 14 },
  printBtnText: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff', letterSpacing: 0.3 },

  receiptOverlay: { flex: 1, backgroundColor: 'rgba(5,15,40,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  receiptCard: { width: '100%', maxWidth: 380, backgroundColor: '#fffef8', borderRadius: 4, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 20, overflow: 'hidden', maxHeight: '90%' },
  receiptJaggedTop: { flexDirection: 'row', backgroundColor: '#98bad5', height: 16, overflow: 'hidden' },
  receiptJaggedTriangle: { flex: 1, height: 16, backgroundColor: '#fffef8', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  receiptJaggedBottom: { flexDirection: 'row', backgroundColor: '#fffef8', height: 16, overflow: 'hidden' },
  receiptJaggedTriangleBottom: { flex: 1, height: 16, backgroundColor: '#98bad5', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  receiptHeader: { alignItems: 'center', paddingTop: 16, paddingHorizontal: 20, paddingBottom: 4 },
  receiptShopName: { fontFamily: 'NotoSerif_700Bold', fontSize: 17, color: '#1a2d4e', letterSpacing: 1, textAlign: 'center' },
  receiptShopSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.55)', marginTop: 3, textAlign: 'center' },
  receiptDividerDashed: { width: '100%', borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.18)', borderStyle: 'dashed', marginVertical: 10 },
  receiptDividerSolid: { height: 1, backgroundColor: 'rgba(1,31,75,0.15)', marginVertical: 6 },
  receiptMeta: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.60)', textAlign: 'center', lineHeight: 17 },
  receiptItemHeader: { flexDirection: 'row', marginBottom: 2 },
  receiptItemHCol: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(1,31,75,0.50)', letterSpacing: 1, textTransform: 'uppercase' },
  receiptItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.06)' },
  receiptItemText: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: '#1a2d4e' },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  receiptTotalLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#1a2d4e', letterSpacing: 0.5 },
  receiptTotalValue: { fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: '#c9a84c' },
  receiptSubTotalLabel: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(1,31,75,0.60)' },
  receiptSubTotalValue: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: 'rgba(1,31,75,0.75)' },
  receiptThankYou: { fontFamily: 'NotoSerif_700Bold', fontSize: 13, color: '#1a2d4e', textAlign: 'center', marginTop: 12, marginBottom: 4 },
  receiptFooter: { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(1,31,75,0.40)', textAlign: 'center', marginBottom: 10 },
  receiptActions: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderColor: 'rgba(1,31,75,0.10)', backgroundColor: '#fffef8' },
  receiptCloseBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: 'rgba(1,31,75,0.08)', borderWidth: 1, borderColor: 'rgba(1,31,75,0.15)', alignItems: 'center', justifyContent: 'center' },
  receiptCloseBtnText: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: 'rgba(1,31,75,0.65)' },
  receiptPrintBtn: { flex: 2, borderRadius: 10, overflow: 'hidden' },
  receiptPrintBtnGrad: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  receiptPrintBtnText: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff', letterSpacing: 0.5 },

  sheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 100 },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(1,20,50,0.45)' },
  sheet: { backgroundColor: '#f0f5f9', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34, maxHeight: '92%', overflow: 'scroll' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(1,31,75,0.20)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.10)' },
  sheetClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(1,31,75,0.08)', justifyContent: 'center', alignItems: 'center' },

  floatCart: { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center' },
  floatCartGradient: { borderRadius: 30, paddingVertical: 10, paddingHorizontal: 32, alignItems: 'center' },
  floatCartText: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#0d1b3e', fontWeight: '700' },
});
