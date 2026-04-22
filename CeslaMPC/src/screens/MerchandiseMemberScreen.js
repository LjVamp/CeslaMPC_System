// src/screens/MerchandiseMemberScreen.js
// CESLA MPC — Merchandise Member Portal
// Same layout/design as MerchandiseScreen (visitor), but with Firebase member login.
// Members see a login gate first; once authenticated they reach the full ordering UI.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, StatusBar, Image,
  useWindowDimensions, Platform, TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';
import { useFocusEffect } from '@react-navigation/native';
import { useMerchandise } from '../context/MerchandiseContext';

// ── Firebase ──────────────────────────────────────────────────────────────────
import {
  collection, query, where, getDocs, doc,
  updateDoc, serverTimestamp, onSnapshot,
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

// ─── LOGIN GATE ───────────────────────────────────────────────────────────────
const LoginGate = ({ onLogin, onBack }) => {
  const [userId,   setUserId]   = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPw,   setShowPw]   = useState(false);

  const bodyFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bodyFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const handleLogin = async () => {
    if (!userId.trim()) { setError('Please enter your User ID.'); return; }
    if (!password)      { setError('Please enter your password.'); return; }
    setLoading(true); setError('');
    try {
      const member = await loginByUserIdFS(userId.trim(), password);
      onLogin(member);
    } catch (e) {
      setError(e.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={{ width: '100%', maxWidth: 420, borderRadius: 22, backgroundColor: 'rgba(178,203,222,0.38)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', padding: 24, alignItems: 'center', opacity: bodyFade }}>

        {/* Logo */}
        <LinearGradient colors={['#1a2d4e', '#304674']} style={{ width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: '#c9a84c', marginBottom: 16 }}>
          <Text style={{ fontSize: 32 }}>📦</Text>
        </LinearGradient>
        <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 20, color: '#0f1e35', textAlign: 'center', marginBottom: 4 }}>Merchandise Member Portal</Text>
        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(15,30,53,0.60)', textAlign: 'center', marginBottom: 14, lineHeight: 18 }}>CESLA Cooperative — Member Login</Text>

        {/* Hint */}
        <View style={{ width: '100%', backgroundColor: 'rgba(201,168,76,0.14)', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(201,168,76,0.38)', padding: 10, marginBottom: 14 }}>
          <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.80)', lineHeight: 17 }}>
            🔑 Use your <Text style={{ fontFamily: 'GoogleSans_700Bold' }}>CESLA Member User ID</Text> and password to login.
          </Text>
        </View>

        {/* User ID */}
        <View style={{ width: '100%', marginBottom: 10 }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(1,31,75,0.55)', letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 4 }}>MEMBER USER ID</Text>
          <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(240,246,252,0.92)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1.5, borderColor: 'rgba(200,218,235,0.75)' }, !!error && { borderColor: '#e74c3c' }]}>
            <TextInput
              style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: '#0f1e35', flex: 1 }}
              value={userId}
              onChangeText={v => { setUserId(v); setError(''); }}
              placeholder="e.g. CESLA-2026-00001"
              placeholderTextColor="rgba(15,30,53,0.35)"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              {...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {})}
            />
          </View>
        </View>

        {/* Password */}
        <View style={{ width: '100%', marginBottom: 10 }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(1,31,75,0.55)', letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 4 }}>PASSWORD</Text>
          <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(240,246,252,0.92)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1.5, borderColor: 'rgba(200,218,235,0.75)' }, !!error && { borderColor: '#e74c3c' }]}>
            <TextInput
              style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: '#0f1e35', flex: 1 }}
              value={password}
              onChangeText={v => { setPassword(v); setError(''); }}
              placeholder="Enter your password"
              placeholderTextColor="rgba(15,30,53,0.35)"
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              onSubmitEditing={handleLogin}
              {...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {})}
            />
            <TouchableOpacity onPress={() => setShowPw(p => !p)} style={{ padding: 6 }}>
              <MaterialIcons name={showPw ? 'visibility-off' : 'visibility'} size={20} color="rgba(1,31,75,0.45)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error */}
        {!!error && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, width: '100%', backgroundColor: 'rgba(231,76,60,0.10)', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(231,76,60,0.28)', padding: 9, marginBottom: 6 }}>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: '#e74c3c', flex: 1, lineHeight: 17 }}>{error}</Text>
          </View>
        )}

        {/* Login button */}
        <TouchableOpacity
          style={{ width: '100%', borderRadius: 28, overflow: 'hidden', marginTop: 10, opacity: loading ? 0.65 : 1 }}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#c9a84c', '#e8c87a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}>
            {loading
              ? <ActivityIndicator color="#0f1e35" />
              : <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#0f1e35', letterSpacing: 1.5 }}>📦  ENTER MERCHANDISE</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.50)', textAlign: 'center', marginTop: 10, lineHeight: 17 }}>
          Don't have an account? Register via the{' '}
          <Text style={{ fontFamily: 'GoogleSans_700Bold', color: '#c9a84c' }}>CESLA Cooperative Portal</Text>.
        </Text>

      </Animated.View>
    </ScrollView>
  );
};

const loginStyles = StyleSheet.create({
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
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

// ─── ITEM DETAIL MODAL ────────────────────────────────────────────────────────
// Full-screen animated popup: swipeable images (one at a time), item info,
// tap image → FullImageViewer (pinch-to-zoom + swipe), colors, sizes
const ItemDetailModal = ({ visible, item, onClose, onAdd }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [imgIdx, setImgIdx]         = useState(0);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [selColor, setSelColor]     = useState(null);
  const [selSize,  setSelSize]      = useState(null);
  const scrollRef = useRef(null);
  const { width: SW } = useWindowDimensions();

  // Modal card width — same formula used below in the Animated.View
  const MODAL_W = Math.min(320, SW * 0.90);

  useEffect(() => {
    if (visible) {
      setImgIdx(0);
      setFullViewOpen(false);
      setSelColor(null);
      setSelSize(null);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 68, friction: 11, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0); scaleAnim.setValue(0.88); slideAnim.setValue(40);
    }
  }, [visible]);

  if (!item) return null;

  const imgs = Array.isArray(item.images) && item.images.length > 0 ? item.images : (item.image ? [item.image] : []);
  const hasColors = Array.isArray(item.colors) && item.colors.length > 0;
  const hasSizes  = Array.isArray(item.sizes)  && item.sizes.length  > 0;

  // Validate selections before allowing add-to-cart
  const colorReady = !hasColors || selColor !== null;
  const sizeReady  = !hasSizes  || selSize  !== null;
  const canAdd     = item.stock > 0 && colorReady && sizeReady;

  const missingLabel = () => {
    if (item.stock === 0) return 'Out of Stock';
    const parts = [];
    if (hasColors && !selColor) parts.push('color');
    if (hasSizes  && !selSize)  parts.push('size');
    if (parts.length > 0) return 'Pick a ' + parts.join(' & ');
    return '🛒  Add To Cart';
  };

  return (
    <>
      <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(1,15,40,0.82)', justifyContent: 'center', alignItems: 'center', opacity: fadeAnim }}>
          {/* Tap outside to close */}
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

          <Animated.View style={{
            width: MODAL_W, borderRadius: 24,
            backgroundColor: '#f0f5f9',
            shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, elevation: 20,
            overflow: 'hidden',
            transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
          }}>
            {/* Image carousel — one image at a time, tap to fullscreen */}
            <View style={{ width: '100%', height: 220, backgroundColor: 'rgba(200,218,235,0.60)', position: 'relative' }}>
              {imgs.length > 0 ? (
                <>
                  <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={e => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / MODAL_W))}
                    style={{ width: MODAL_W, height: 220 }}
                    contentContainerStyle={{ width: MODAL_W * imgs.length, height: 220 }}>
                    {imgs.map((uri, i) => (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.90}
                        onPress={() => setFullViewOpen(true)}
                        style={{ width: MODAL_W, height: 220 }}>
                        <Image
                          source={{ uri }}
                          style={{ width: MODAL_W, height: 220 }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Tap-to-zoom hint */}
                  <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontFamily: 'GoogleSans_400Regular' }}>🔍 Tap to view</Text>
                  </View>

                  {imgs.length > 1 && (
                    <View style={{ position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                      {imgs.map((_, i) => (
                        <TouchableOpacity key={i} onPress={() => {
                          scrollRef.current?.scrollTo({ x: i * MODAL_W, animated: true });
                          setImgIdx(i);
                        }}>
                          <View style={{ width: imgIdx === i ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: imgIdx === i ? '#fff' : 'rgba(255,255,255,0.50)' }} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 80 }}>{item.emoji}</Text>
                </View>
              )}
              {/* Close button */}
              <TouchableOpacity onPress={onClose}
                style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(1,20,50,0.55)', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Item details */}
            <View style={{ padding: 20, gap: 8 }}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 18, color: '#011f4b', lineHeight: 24 }}>{item.name}</Text>
              <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 26, color: '#c9a84c', lineHeight: 30 }}>₱{item.price}.00</Text>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(1,31,75,0.55)' }}>Stock: {item.stock}</Text>

              {/* ── Selectable Color swatches ── */}
              {hasColors && (
                <View style={{ gap: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(1,31,75,0.45)', letterSpacing: 1, textTransform: 'uppercase' }}>COLORS:</Text>
                    {selColor
                      ? <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#1a3a6b' }}>{selColor}</Text>
                      : <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: '#e74c3c' }}>— pick one</Text>
                    }
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {item.colors.map(c => {
                      const isSelected = selColor === c;
                      return (
                        <TouchableOpacity
                          key={c}
                          onPress={() => setSelColor(c)}
                          style={{ alignItems: 'center', gap: 3 }}
                          activeOpacity={0.75}
                        >
                          <View style={{
                            width: 30, height: 30, borderRadius: 15,
                            backgroundColor: resolveColorHex(c),
                            borderWidth: isSelected ? 3 : 1.5,
                            borderColor: isSelected ? '#1a3a6b' : 'rgba(0,0,0,0.18)',
                          }} />
                          {isSelected && (
                            <View style={{ position: 'absolute', top: 7, left: 0, right: 0, alignItems: 'center' }}>
                              <Text style={{ fontSize: 14, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } }}>✓</Text>
                            </View>
                          )}
                          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: isSelected ? '#1a3a6b' : 'rgba(1,31,75,0.50)' }}>{c}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ── Selectable Sizes ── */}
              {hasSizes && (
                <View style={{ gap: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(1,31,75,0.45)', letterSpacing: 1, textTransform: 'uppercase' }}>SIZES:</Text>
                    {selSize
                      ? <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#1a3a6b' }}>{selSize}</Text>
                      : <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: '#e74c3c' }}>— pick one</Text>
                    }
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {item.sizes.map(sz => {
                      const isSelected = selSize === sz;
                      return (
                        <TouchableOpacity
                          key={sz}
                          onPress={() => setSelSize(sz)}
                          style={{
                            paddingHorizontal: 13, paddingVertical: 7, borderRadius: 8,
                            backgroundColor: isSelected ? '#1a3a6b' : 'rgba(26,58,107,0.08)',
                            borderWidth: isSelected ? 2 : 1,
                            borderColor: isSelected ? '#1a3a6b' : 'rgba(26,58,107,0.20)',
                          }}
                          activeOpacity={0.75}
                        >
                          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: isSelected ? '#fff' : '#1a3a6b' }}>{sz}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Add to cart */}
              <TouchableOpacity
                onPress={() => {
                  if (!canAdd) return;
                  onAdd(selColor, selSize);
                  onClose();
                }}
                disabled={!canAdd}
                style={{ marginTop: 4, borderRadius: 14, overflow: 'hidden', opacity: canAdd ? 1 : 0.50 }}>
                <LinearGradient
                  colors={canAdd ? ['#1a3a6b', '#2e5fa3'] : ['#9e9e9e', '#bdbdbd']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#fff' }}>
                    {missingLabel()}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Full-screen image viewer */}
      {visible && (
        <FullImageViewer
          visible={fullViewOpen}
          images={imgs}
          startIndex={imgIdx}
          onClose={() => setFullViewOpen(false)}
        />
      )}
    </>
  );
};

// Color reference for detail modal (mirrors ManageMerchandiseScreen COLOR_OPTIONS)
const COLOR_OPTIONS_REF = {
  Mugs:   [{ label: 'Gray', hex: '#9e9e9e' }, { label: 'Pink', hex: '#f48fb1' }],
  Shirts: [{ label: 'White', hex: '#f5f5f5' }, { label: 'Navy Blue', hex: '#1a3a6b' }, { label: 'Royal Blue', hex: '#2979ff' }, { label: 'Khaki', hex: '#c8b560' }],
  Caps:   [{ label: 'White', hex: '#f5f5f5' }, { label: 'Navy Blue', hex: '#1a3a6b' }, { label: 'Royal Blue', hex: '#2979ff' }, { label: 'Khaki', hex: '#c8b560' }],
};

// Helper: resolve color hex from label
const resolveColorHex = (label) => {
  for (const group of Object.values(COLOR_OPTIONS_REF)) {
    const found = group.find(x => x.label === label);
    if (found) return found.hex;
  }
  return '#999';
};

// ─── FULL-SCREEN IMAGE VIEWER ─────────────────────────────────────────────────
// Tap an image in the modal → full-screen viewer with swipe + pinch zoom
const FullImageViewer = ({ visible, images, startIndex, onClose }) => {
  const [curIdx, setCurIdx] = useState(startIndex || 0);
  const scrollRef = useRef(null);
  const { width: SW, height: SH } = useWindowDimensions();

  // Pinch-zoom state (web uses wheel; native uses gesture approximation via two-touch tracking)
  const [scale, setScale] = useState(1);
  const lastScale = useRef(1);
  const lastDist  = useRef(null);

  useEffect(() => {
    if (visible) {
      setCurIdx(startIndex || 0);
      setScale(1);
      lastScale.current = 1;
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: (startIndex || 0) * SW, animated: false });
      }, 50);
    }
  }, [visible, startIndex]);

  const handleScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (idx !== curIdx) { setCurIdx(idx); setScale(1); lastScale.current = 1; }
  };

  // Native two-finger pinch approximation
  const handleTouchMove = (e) => {
    if (e.nativeEvent.touches.length === 2) {
      const [t1, t2] = e.nativeEvent.touches;
      const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      if (lastDist.current !== null) {
        const delta = dist / lastDist.current;
        const next = Math.min(4, Math.max(1, lastScale.current * delta));
        setScale(next);
      }
      lastDist.current = dist;
    }
  };
  const handleTouchEnd = (e) => {
    if (e.nativeEvent.touches.length < 2) {
      lastScale.current = scale;
      lastDist.current = null;
      if (scale < 1.05) { setScale(1); lastScale.current = 1; }
    }
  };

  if (!visible || !images || images.length === 0) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' }}>
        {/* Close */}
        <TouchableOpacity
          onPress={onClose}
          style={{ position: 'absolute', top: Platform.OS === 'web' ? 16 : 48, right: 16, zIndex: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>✕</Text>
        </TouchableOpacity>

        {/* Image counter */}
        {images.length > 1 && (
          <View style={{ position: 'absolute', top: Platform.OS === 'web' ? 20 : 54, alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'GoogleSans_700Bold' }}>{curIdx + 1} / {images.length}</Text>
          </View>
        )}

        {/* Swipeable images */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={{ width: SW, height: SH }}
          contentContainerStyle={{ width: SW * images.length, height: SH }}
          scrollEnabled={scale <= 1}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}>
          {images.map((uri, i) => (
            <View key={i} style={{ width: SW, height: SH, justifyContent: 'center', alignItems: 'center' }}>
              <Image
                source={{ uri }}
                style={{ width: SW, height: SH * 0.85, transform: [{ scale }] }}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>

        {/* Dot indicators */}
        {images.length > 1 && (
          <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 7 }}>
            {images.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => { scrollRef.current?.scrollTo({ x: i * SW, animated: true }); setCurIdx(i); }}>
                <View style={{ width: curIdx === i ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: curIdx === i ? '#fff' : 'rgba(255,255,255,0.45)' }} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Zoom hint */}
        {scale <= 1 && images.length > 0 && (
          <View style={{ position: 'absolute', bottom: Platform.OS === 'web' ? 16 : 16, alignSelf: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: 'GoogleSans_400Regular' }}>
              {Platform.OS === 'web' ? 'Use two fingers or scroll to zoom' : 'Pinch to zoom'}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ─── ITEM CARD ────────────────────────────────────────────────────────────────
const ItemCard = ({ item, onAdd }) => {
  const [detailVisible, setDetailVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const imgs = Array.isArray(item.images) && item.images.length > 0
    ? item.images
    : (item.image ? [item.image] : []);

  // Use a fixed, known image size so the carousel math is always correct
  const CARD_IMG_SIZE = Platform.OS === 'web' ? 86 : 62;

  const [imgIdx, setImgIdx] = useState(0);
  const imgScrollRef = useRef(null);

  const handlePressIn  = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start();

  const hasColors = Array.isArray(item.colors) && item.colors.length > 0;
  const hasSizes  = Array.isArray(item.sizes)  && item.sizes.length  > 0;

  return (
    <>
      <Animated.View style={[styles.foodCard, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setDetailVisible(true)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={{ flex: 1 }}>
          <LinearGradient
            colors={['rgba(220,232,242,0.90)', 'rgba(200,218,235,0.70)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={styles.foodCardInner}>

            {/* Image carousel — one image visible at a time */}
            {imgs.length > 0 ? (
              <View style={[styles.cardImgWrap, { width: CARD_IMG_SIZE, height: CARD_IMG_SIZE }]}>
                <ScrollView
                  ref={imgScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={e => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / CARD_IMG_SIZE))}
                  style={{ width: CARD_IMG_SIZE, height: CARD_IMG_SIZE }}
                  contentContainerStyle={{ width: CARD_IMG_SIZE * imgs.length, height: CARD_IMG_SIZE }}>
                  {imgs.map((uri, i) => (
                    <Image
                      key={i}
                      source={{ uri }}
                      style={{ width: CARD_IMG_SIZE, height: CARD_IMG_SIZE }}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
                {imgs.length > 1 && (
                  <View style={{ position: 'absolute', bottom: 3, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 3 }}>
                    {imgs.map((_, i) => (
                      <TouchableOpacity key={i} onPress={e => {
                        e.stopPropagation && e.stopPropagation();
                        imgScrollRef.current?.scrollTo({ x: i * CARD_IMG_SIZE, animated: true });
                        setImgIdx(i);
                      }}>
                        <View style={{ width: imgIdx === i ? 10 : 4, height: 4, borderRadius: 2, backgroundColor: imgIdx === i ? '#1a3a6b' : 'rgba(1,31,75,0.30)' }} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emojiCircle}>
                <Text style={styles.emojiText}>{item.emoji}</Text>
              </View>
            )}

            {/* Details */}
            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.itemPrice}>₱{item.price}.00</Text>
            <Text style={styles.itemStock}>Stock: {item.stock}</Text>

            {/* Color dots */}
            {hasColors && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 3, marginTop: 1 }}>
                {item.colors.slice(0, 5).map(c => (
                  <View key={c} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: resolveColorHex(c), borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)' }} />
                ))}
              </View>
            )}

            {/* Size chips (first 3 + count) */}
            {hasSizes && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 2, marginTop: 1 }}>
                {item.sizes.slice(0, 3).map(sz => (
                  <View key={sz} style={{ backgroundColor: 'rgba(26,58,107,0.12)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 7, color: '#1a3a6b' }}>{sz}</Text>
                  </View>
                ))}
                {item.sizes.length > 3 && (
                  <View style={{ borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, backgroundColor: 'rgba(26,58,107,0.07)' }}>
                    <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 7, color: 'rgba(26,58,107,0.55)' }}>+{item.sizes.length - 3}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Add to Cart button */}
            <TouchableOpacity
              style={[styles.addBtn, item.stock === 0 && { opacity: 0.45 }]}
              onPress={e => {
                e.stopPropagation && e.stopPropagation();
                // If item has colors or sizes, always open detail modal first
                if ((hasColors || hasSizes) && item.stock > 0) {
                  setDetailVisible(true);
                } else {
                  onAdd(null, null);
                }
              }}
              disabled={item.stock === 0}
              activeOpacity={0.80}>
              <Text style={styles.addBtnText}>{item.stock === 0 ? 'Out of Stock' : 'Add To Cart'}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <ItemDetailModal
        visible={detailVisible}
        item={item}
        onClose={() => setDetailVisible(false)}
        onAdd={(color, size) => onAdd(color, size)}
      />
    </>
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
              {items.map(({ item, qty, color, size }) => {
                const variantLabel = [color, size].filter(Boolean).join(' / ');
                const rowKey = item.id + (color ? '-' + color : '') + (size ? '-' + size : '');
                return (
                <View key={rowKey} style={styles.receiptItemRow}>
                  <Text style={[styles.receiptItemText, { flex: 1 }]} numberOfLines={1}>{item.emoji} {item.name}{variantLabel ? (' [' + variantLabel + ']') : ''}</Text>
                  <Text style={[styles.receiptItemText, { width: 32, textAlign: 'center' }]}>{qty}</Text>
                  <Text style={[styles.receiptItemText, { width: 64, textAlign: 'right' }]}>₱{(item.price * qty).toFixed(2)}</Text>
                </View>
                );
              })}
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
      cartItems.forEach(({ item, color, size }) => {
        const k = item.id + (color ? '-' + color : '') + (size ? '-' + size : '');
        if (updated[k] === undefined) updated[k] = true;
      });
      return updated;
    });
  }, [JSON.stringify(cartItems.map(i => i.item.id + (i.color || '') + (i.size || '')))]);

  const toggleCheck = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const checkedItems = cartItems.filter(({ item, color, size }) => {
    const k = item.id + (color ? '-' + color : '') + (size ? '-' + size : '');
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
            {cartItems.map(({ item, qty, color, size }) => {
              const cartKey = item.id + (color ? '-' + color : '') + (size ? '-' + size : '');
              const variantLabel = [color, size].filter(Boolean).join(' / ');
              return (
                <View key={cartKey} style={styles.cartRow}>
                  <TouchableOpacity style={[styles.checkbox, checked[cartKey] && styles.checkboxChecked]} onPress={() => toggleCheck(cartKey)}>
                    {checked[cartKey] && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                  <Text style={styles.cartRowEmoji}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartRowName} numberOfLines={1}>{item.name}</Text>
                    {variantLabel ? <Text style={styles.cartRowSub}>{variantLabel}  ·  x{qty}  ₱{item.price * qty}</Text>
                      : <Text style={styles.cartRowSub}>x{qty}  ₱{item.price * qty}</Text>}
                  </View>
                  <View style={styles.cartRowQty}>
                    <TouchableOpacity style={styles.cartQBtn} onPress={() => onRemove(item, color, size)}><Text style={styles.cartQBtnText}>−</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.cartQBtn, styles.cartQBtnAdd]} onPress={() => onAdd(item, color, size)}><Text style={[styles.cartQBtnText, { color: '#fff' }]}>+</Text></TouchableOpacity>
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

// ─── HISTORY TAB CONTENT (shared by Member + Visitor screens) ─────────────────
const HistoryTabContent = ({ orderHistory, isWide, showStatus = true, onShopNow }) => {
  const [sortBy,       setSortBy]       = useState(null);   // null | 'payment' | 'status'
  const [sortDropOpen, setSortDropOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearDropOpen, setYearDropOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState('daily'); // 'daily' | 'monthly' | 'yearly'
  const [selectedMonth,setSelectedMonth]= useState(new Date().getMonth()); // 0–11

  const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const toDate = (ts) => {
    try {
      if (!ts) return null;
      if (ts?.toDate) return ts.toDate();
      if (typeof ts === 'number') return new Date(ts);
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    } catch { return null; }
  };

  const fmtDate = (ts) => {
    const d = toDate(ts);
    if (!d) return '—';
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fmtTime = (ts) => {
    const d = toDate(ts);
    if (!d) return '';
    return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const pmInfo = (pm) => {
    const n = (pm === 'credits' ? 'credit' : (pm || 'cash')).toLowerCase();
    if (n === 'gcash')  return { label: 'GCash',  color: '#3498db' };
    if (n === 'credit') return { label: 'Credit', color: '#c9a84c' };
    return { label: 'Cash', color: '#27ae60' };
  };

  const stInfo = (status) => {
    switch (status) {
      case 'done':      return { label: 'Completed', color: '#27ae60' };
      case 'ready':     return { label: 'Ready',     color: '#2980b9' };
      case 'preparing': return { label: 'Preparing', color: '#e67e22' };
      default:          return { label: 'Pending',   color: '#95a5a6' };
    }
  };

  // Available years: always 2025–2070, with current year guaranteed
  const availableYears = React.useMemo(() => {
    const years = [];
    for (let y = 2070; y >= 2000; y--) years.push(y);
    return years;
  }, []);

  // Sorted orders
  const sortedOrders = React.useMemo(() => {
    const arr = [...orderHistory];
    if (sortBy === 'payment') {
      arr.sort((a, b) => {
        const pa = (a.payment || a.paymentMode || 'cash').toLowerCase();
        const pb = (b.payment || b.paymentMode || 'cash').toLowerCase();
        return pa.localeCompare(pb);
      });
    } else if (sortBy === 'status') {
      const ORD = { pending: 0, preparing: 1, ready: 2, done: 3 };
      arr.sort((a, b) => (ORD[a.status] ?? 99) - (ORD[b.status] ?? 99));
    } else {
      arr.sort((a, b) => {
        const ta = toDate(a.createdAt)?.getTime() || 0;
        const tb = toDate(b.createdAt)?.getTime() || 0;
        return tb - ta;
      });
    }
    return arr;
  }, [orderHistory, sortBy]);

  // Flat rows (one per item per order)
  const tableRows = React.useMemo(() => {
    const rows = [];
    sortedOrders.forEach(order => {
      const items = order.items || [];
      const pm = pmInfo(order.payment || order.paymentMode);
      const st = stInfo(order.status);
      if (items.length === 0) {
        rows.push({ order, item: null, itemIdx: 0, totalItems: 0, pm, st });
      } else {
        items.forEach((it, idx) => {
          rows.push({ order, item: it, itemIdx: idx, totalItems: items.length, pm, st });
        });
      }
    });
    return rows;
  }, [sortedOrders]);

  // Report data
  const reportData = React.useMemo(() => {
    if (reportPeriod === 'yearly') {
      const map = {};
      orderHistory.forEach(o => {
        const d = toDate(o.createdAt);
        if (!d) return;
        const yr = d.getFullYear();
        if (!map[yr]) map[yr] = { label: String(yr), count: 0, total: 0 };
        map[yr].count++;
        map[yr].total += Number(o.total || 0);
      });
      return Object.values(map).sort((a, b) => b.label - a.label);
    }
    const yearOrders = orderHistory.filter(o => {
      const d = toDate(o.createdAt);
      return d && d.getFullYear() === selectedYear;
    });
    if (reportPeriod === 'monthly') {
      const map = {};
      for (let m = 0; m < 12; m++) map[m] = { label: MONTHS[m], count: 0, total: 0 };
      yearOrders.forEach(o => {
        const d = toDate(o.createdAt);
        if (!d) return;
        const m = d.getMonth();
        map[m].count++;
        map[m].total += Number(o.total || 0);
      });
      return Object.values(map);
    }
    // Daily
    const map = {};
    yearOrders.filter(o => {
      const d = toDate(o.createdAt);
      return d && d.getMonth() === selectedMonth;
    }).forEach(o => {
      const d = toDate(o.createdAt);
      const day = d.getDate();
      if (!map[day]) map[day] = { label: String(day).padStart(2,'0'), count: 0, total: 0 };
      map[day].count++;
      map[day].total += Number(o.total || 0);
    });
    return Object.values(map).sort((a, b) => Number(a.label) - Number(b.label));
  }, [orderHistory, reportPeriod, selectedYear, selectedMonth]);

  const totalRevenue = reportData.reduce((s, r) => s + r.total, 0);
  const totalCount   = reportData.reduce((s, r) => s + r.count, 0);

  const closeDrop = () => { setSortDropOpen(false); setYearDropOpen(false); };

  return (
    <TouchableOpacity activeOpacity={1} onPress={closeDrop} style={{ flex: 1 }}>
      <View style={{
        flex: 1,
        flexDirection: isWide ? 'row' : 'column',
        gap: 10,
        paddingHorizontal: isWide ? 16 : 8,
        paddingTop: isWide ? 8 : 6,
        paddingBottom: isWide ? 16 : 8,
        minHeight: 0,
      }}>

        {/* ══════════════ LEFT — MY ORDER HISTORY ══════════════ */}
        <View style={[histStyles.panel, { flex: isWide ? 3 : 1 }]}>

          {/* Panel header row */}
          <View style={histStyles.panelHeaderRow}>
            <Text style={histStyles.panelTitle}>📋 MY ORDER HISTORY</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {/* Order count badge */}
              <View style={histStyles.countBadge}>
                <Text style={histStyles.countBadgeText}>
                  {orderHistory.length} ORDER{orderHistory.length !== 1 ? 'S' : ''}
                </Text>
              </View>

              {/* Sort By dropdown trigger */}
              <View style={{ position: 'relative', zIndex: 9999 }}>
                <TouchableOpacity
                  style={histStyles.sortBtn}
                  onPress={() => { setSortDropOpen(v => !v); setYearDropOpen(false); }}
                  activeOpacity={0.80}
                >
                  <MaterialIcons name="sort" size={12} color="rgba(1,31,75,0.65)" />
                  <Text style={histStyles.sortBtnText}>
                    Sort by{sortBy ? ': ' + (sortBy === 'payment' ? 'Payment' : 'Status') : ''}
                  </Text>
                  <MaterialIcons
                    name={sortDropOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={13}
                    color="rgba(1,31,75,0.55)"
                  />
                </TouchableOpacity>
                {sortDropOpen && (
                  <View style={histStyles.sortDropdown}>
                    {[
                      { key: 'payment', label: '💳  Payment' },
                      { key: 'status',  label: '📌  Status'  },
                      { key: null,      label: '🕐  Date (default)' },
                    ].map(opt => (
                      <TouchableOpacity
                        key={String(opt.key)}
                        style={[histStyles.sortDropItem, sortBy === opt.key && histStyles.sortDropItemActive]}
                        onPress={() => { setSortBy(opt.key); setSortDropOpen(false); }}
                        activeOpacity={0.75}
                      >
                        <Text style={[histStyles.sortDropItemText, sortBy === opt.key && { color: '#1a3a6b', fontFamily: 'GoogleSans_700Bold' }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Table or empty state */}
          {orderHistory.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>📋</Text>
              <Text style={histStyles.emptyTitle}>No orders yet</Text>
              <Text style={histStyles.emptySubtitle}>Your merchandise orders will appear here.</Text>
              {onShopNow && (
                <TouchableOpacity onPress={onShopNow} style={histStyles.shopNowBtn}>
                  <Text style={histStyles.shopNowText}>Shop Now →</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ flex: 1, minHeight: 0, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(200,218,235,0.80)', overflow: 'hidden' }}>
              {/* Outer scroll: vertical for rows */}
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                {...(Platform.OS === 'web' ? { style: { flex: 1, overflowY: 'auto', overflowX: 'hidden' } } : {})}
              >
                {/* Web: plain View fills panel width. Mobile: horizontal ScrollView for overflow. */}
                {(Platform.OS === 'web'
                  ? (c) => c
                  : (c) => (
                      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled={false}>
                        {c}
                      </ScrollView>
                    )
                )(
                  <View style={{ flexDirection: 'column', ...(Platform.OS === 'web' ? { flex: 1 } : { minWidth: showStatus ? 564 : 508 }) }}>
                    {/* Thead — sticky-ish: always rendered first */}
                    <View style={{ backgroundColor: 'rgba(220,232,242,0.97)', borderBottomWidth: 1.5, borderBottomColor: 'rgba(180,205,225,0.90)',
                      ...(Platform.OS === 'web' ? { position: 'sticky', top: 0, zIndex: 10 } : {}) }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <View style={[histStyles.thCell, { width: 80 }]}><Text style={histStyles.thTxt}>DATE</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, { width: 56 }]}><Text style={histStyles.thTxt}>ORDER #</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, Platform.OS === 'web' ? { flex: 1 } : { width: 120 }]}><Text style={histStyles.thTxt}>ITEM NAME</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, { width: 28 }]}><Text style={[histStyles.thTxt,{textAlign:'center'}]}>QTY</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, { width: 36 }]}><Text style={[histStyles.thTxt,{textAlign:'center'}]}>SIZE</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, { width: 50 }]}><Text style={[histStyles.thTxt,{textAlign:'center'}]}>COLOR</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, { width: 56 }]}><Text style={[histStyles.thTxt,{textAlign:'center'}]}>CHAR</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, { width: 50 }]}><Text style={[histStyles.thTxt,{textAlign:'center'}]}>PMT</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, { width: 66 }]}><Text style={[histStyles.thTxt,{textAlign:'center'}]}>TOTAL</Text></View>
                        {showStatus && (
                          <><View style={histStyles.thDiv}/><View style={[histStyles.thCell, { width: 66 }]}><Text style={[histStyles.thTxt,{textAlign:'center'}]}>STATUS</Text></View></>
                        )}
                      </View>
                    </View>

                    {/* Body rows */}
                    {tableRows.map((row, idx) => {
                      const { order, item, itemIdx, totalItems, pm, st } = row;
                      const isFirst = itemIdx === 0;
                      const isLastOfOrder = itemIdx === totalItems - 1 || totalItems === 0;
                      const isEvenOrder   = sortedOrders.indexOf(order) % 2 === 0;

                      const itemObj   = item?.item || item || null;
                      const itemName  = itemObj?.name  || item?.name  || '—';
                      const qty       = item?.qty       || item?.quantity    || (totalItems === 0 ? '—' : 1);
                      const size      = item?.size      || itemObj?.size      || null;
                      const color     = item?.color     || itemObj?.color     || null;
                      const character = item?.character || itemObj?.character || null;

                      return (
                        <View
                          key={`${order.docId || idx}-${itemIdx}`}
                          style={[
                            histStyles.tdRow,
                            isEvenOrder && histStyles.tdRowEven,
                            isLastOfOrder && { borderBottomWidth: 1.5, borderBottomColor: 'rgba(180,205,225,0.70)' },
                          ]}
                        >
                          {/* DATE */}
                          <View style={[histStyles.tdCell, { width: 80 }]}>
                            {isFirst && <Text style={histStyles.tdDate}>{fmtDate(order.createdAt)}</Text>}
                            {isFirst && <Text style={histStyles.tdTime}>{fmtTime(order.createdAt)}</Text>}
                          </View>
                          {/* ORDER # */}
                          <View style={[histStyles.tdCell, { width: 56 }]}>
                            {isFirst && <Text style={histStyles.tdOrderNo}>#{order.orderNo || '—'}</Text>}
                          </View>
                          {/* ITEM NAME */}
                          <View style={[histStyles.tdCell, Platform.OS === 'web' ? { flex: 1 } : { width: 120 }]}>
                            <Text style={histStyles.tdItem} numberOfLines={2}>{itemName}</Text>
                          </View>
                          {/* QTY */}
                          <View style={[histStyles.tdCell, { width: 28, alignItems: 'center' }]}>
                            <Text style={histStyles.tdQty}>{qty}</Text>
                          </View>
                          {/* SIZE */}
                          <View style={[histStyles.tdCell, { width: 36, alignItems: 'center' }]}>
                            <Text style={[histStyles.tdVariant, !size && histStyles.tdNone]}>{size || 'None'}</Text>
                          </View>
                          {/* COLOR */}
                          <View style={[histStyles.tdCell, { width: 50, alignItems: 'center' }]}>
                            <Text style={[histStyles.tdVariant, !color && histStyles.tdNone]}>{color || 'None'}</Text>
                          </View>
                          {/* CHARACTER */}
                          <View style={[histStyles.tdCell, { width: 56, alignItems: 'center' }]}>
                            <Text style={[histStyles.tdVariant, !character && histStyles.tdNone]}>{character || 'None'}</Text>
                          </View>
                          {/* PAYMENT */}
                          <View style={[histStyles.tdCell, { width: 50, alignItems: 'center' }]}>
                            {isFirst && <Text style={[histStyles.tdPm, { color: pm.color }]}>{pm.label}</Text>}
                          </View>
                          {/* TOTAL */}
                          <View style={[histStyles.tdCell, { width: 66, alignItems: 'center' }]}>
                            {isFirst && <Text style={histStyles.tdTotal}>₱{Number(order.total || 0).toFixed(2)}</Text>}
                          </View>
                          {/* STATUS */}
                          {showStatus && (
                            <View style={[histStyles.tdCell, { width: 66, alignItems: 'center' }]}>
                              {isFirst && <Text style={[histStyles.tdStatus, { color: st.color }]}>{st.label}</Text>}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* ══════════════ RIGHT — ANNUAL HISTORY REPORTS ══════════════ */}
        <View style={[histStyles.panel, { zIndex: 100, flex: 2 }]}>

          {/* Panel header */}
          <Text style={[histStyles.panelTitle, { marginBottom: 10 }]}>📊 ANNUAL HISTORY REPORTS</Text>

          {/* Year selector */}
          <View style={{ position: 'relative', zIndex: 9999, marginBottom: 10, alignSelf: 'flex-start' }}>
            <TouchableOpacity
              style={histStyles.yearBtn}
              onPress={() => { setYearDropOpen(v => !v); setSortDropOpen(false); }}
              activeOpacity={0.80}
            >
              <Text style={histStyles.yearBtnText}>YEAR {selectedYear}</Text>
              <MaterialIcons
                name={yearDropOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={16}
                color="#0f1e35"
              />
            </TouchableOpacity>
            {yearDropOpen && (
              <View style={histStyles.yearDropdown}>
                <ScrollView
                  style={{ maxHeight: 220 }}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {availableYears.map(yr => (
                    <TouchableOpacity
                      key={yr}
                      style={[histStyles.yearDropItem, yr === selectedYear && histStyles.yearDropItemActive]}
                      onPress={() => { setSelectedYear(yr); setYearDropOpen(false); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[histStyles.yearDropItemText, yr === selectedYear && { color: '#fff', fontFamily: 'GoogleSans_700Bold' }]}>
                        {yr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Period tabs: Daily | Monthly | Yearly */}
          <View style={histStyles.periodRow}>
            {['daily','monthly','yearly'].map(p => (
              <TouchableOpacity
                key={p}
                style={[histStyles.periodTab, reportPeriod === p && histStyles.periodTabActive]}
                onPress={() => setReportPeriod(p)}
                activeOpacity={0.80}
              >
                <Text style={[histStyles.periodTabTxt, reportPeriod === p && histStyles.periodTabTxtActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Month pills (Daily only) */}
          {reportPeriod === 'daily' && (
            <View style={{ height: 30, marginTop: 6, ...(Platform.OS === 'web' ? { overflowX: 'auto' } : {}) }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 5, paddingHorizontal: 2, alignItems: 'center' }}
                scrollEnabled={Platform.OS !== 'web'}
              >
                {MONTHS.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[histStyles.monthPill, selectedMonth === i && histStyles.monthPillActive]}
                    onPress={() => setSelectedMonth(i)}
                    activeOpacity={0.80}
                  >
                    <Text style={[histStyles.monthPillTxt, selectedMonth === i && histStyles.monthPillTxtActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Summary cards */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <View style={histStyles.sumCard}>
              <Text style={histStyles.sumCardLabel}>Total Orders</Text>
              <Text style={histStyles.sumCardValue}>{totalCount}</Text>
            </View>
            <View style={histStyles.sumCard}>
              <Text style={histStyles.sumCardLabel}>Total Revenue</Text>
              <Text style={[histStyles.sumCardValue, { fontSize: 14 }]}>₱{totalRevenue.toFixed(2)}</Text>
            </View>
          </View>

          {/* Report table */}
          <ScrollView showsVerticalScrollIndicator style={{ flex: 1, marginTop: 10 }} nestedScrollEnabled>
            {reportData.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ fontSize: 30, marginBottom: 8 }}>📊</Text>
                <Text style={histStyles.emptyTitle}>No data for this period</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.50)', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(200,218,235,0.70)' }}>
                {/* Report header */}
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(220,232,242,0.95)', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(180,205,225,0.70)' }}>
                  <Text style={[histStyles.thTxt, { flex: 1 }]}>
                    {reportPeriod === 'daily' ? `${MONTHS[selectedMonth].toUpperCase()} — DAY` : reportPeriod === 'monthly' ? 'MONTH' : 'YEAR'}
                  </Text>
                  <Text style={[histStyles.thTxt, { width: 58, textAlign: 'center' }]}>ORDERS</Text>
                  <Text style={[histStyles.thTxt, { width: 90, textAlign: 'right' }]}>REVENUE</Text>
                </View>
                {reportData.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <View key={idx} style={{ flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 12, backgroundColor: isEven ? 'rgba(255,255,255,0.30)' : 'rgba(210,228,242,0.30)', borderBottomWidth: 1, borderBottomColor: 'rgba(200,218,235,0.40)' }}>
                      <Text style={[histStyles.tdItem, { flex: 1 }]}>{row.label}</Text>
                      <Text style={[histStyles.tdQty, { width: 58, textAlign: 'center' }]}>{row.count}</Text>
                      <Text style={[histStyles.tdTotal, { width: 90, textAlign: 'right' }]}>₱{row.total.toFixed(2)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>

      </View>
    </TouchableOpacity>
  );
};

// ─── HISTORY STYLES ────────────────────────────────────────────────────────────
const histStyles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    padding: 12,
    overflow: 'hidden',
    minHeight: 0,
    minWidth: 0,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
    zIndex: 9999,
  },
  panelTitle: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 11,
    color: 'rgba(1,31,75,0.65)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  countBadge: {
    backgroundColor: 'rgba(1,31,75,0.09)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(1,31,75,0.12)',
  },
  countBadgeText: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 9,
    color: 'rgba(1,31,75,0.55)',
    letterSpacing: 0.8,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(200,218,235,0.90)',
  },
  sortBtnText: {
    fontFamily: 'GoogleSans_500Medium',
    fontSize: 10,
    color: 'rgba(1,31,75,0.65)',
  },
  sortDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,218,235,0.80)',
    shadowColor: '#011f4b',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 9999,
    zIndex: 9999,
    minWidth: 168,
    overflow: 'hidden',
  },
  sortDropItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200,218,235,0.50)',
  },
  sortDropItemActive: { backgroundColor: 'rgba(26,58,107,0.07)' },
  sortDropItemText: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 12,
    color: 'rgba(1,31,75,0.70)',
  },
  // Table
  thCell: { paddingHorizontal: 5 },
  thTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 7,
    color: 'rgba(1,31,75,0.55)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  thDiv: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(180,205,225,0.70)' },
  tdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200,218,235,0.40)',
    paddingVertical: 7,
  },
  tdRowEven: { backgroundColor: 'rgba(210,228,242,0.35)' },
  tdCell: { paddingHorizontal: 5 },
  tdDate: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#0f1e35' },
  tdTime: { fontFamily: 'GoogleSans_400Regular', fontSize: 8, color: 'rgba(1,31,75,0.45)', marginTop: 1 },
  tdOrderNo: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#1a3a6b' },
  tdItem: { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(1,31,75,0.72)', lineHeight: 14 },
  tdQty: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#0f1e35', textAlign: 'center' },
  tdVariant: { fontFamily: 'GoogleSans_500Medium', fontSize: 9, color: 'rgba(1,31,75,0.65)', textAlign: 'center' },
  tdNone: { color: 'rgba(1,31,75,0.28)', fontFamily: 'GoogleSans_400Regular', fontStyle: 'italic' },
  tdPm: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, textAlign: 'center' },
  tdTotal: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#27ae60', textAlign: 'center' },
  tdStatus: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, textAlign: 'center' },
  // Empty
  emptyTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: 'rgba(1,31,75,0.55)', textAlign: 'center' },
  emptySubtitle: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.40)', textAlign: 'center', marginTop: 4 },
  shopNowBtn: { marginTop: 16, backgroundColor: '#1a2d4e', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  shopNowText: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#c9a84c' },
  // Year
  yearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(26,58,107,0.12)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1.5, borderColor: 'rgba(26,58,107,0.25)',
  },
  yearBtnText: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#0f1e35', letterSpacing: 0.5 },
  yearDropdown: {
    position: 'absolute', top: '100%', left: 0, marginTop: 4,
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(200,218,235,0.80)',
    shadowColor: '#011f4b', shadowOpacity: 0.15, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 9999,
    zIndex: 9999, minWidth: 100,
  },
  yearDropItem: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(200,218,235,0.50)' },
  yearDropItemActive: { backgroundColor: '#1a3a6b' },
  yearDropItemText: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(1,31,75,0.70)', textAlign: 'center' },
  // Period
  periodRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 22, padding: 3, gap: 2 },
  periodTab: { flex: 1, paddingVertical: 7, borderRadius: 18, alignItems: 'center' },
  periodTabActive: { backgroundColor: '#1a2d4e', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  periodTabTxt: { fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: 'rgba(1,31,75,0.60)' },
  periodTabTxtActive: { fontFamily: 'GoogleSans_700Bold', color: '#fff' },
  // Month pills
  monthPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(26,58,107,0.10)', borderWidth: 1, borderColor: 'rgba(26,58,107,0.15)' },
  monthPillActive: { backgroundColor: '#1a2d4e', borderColor: '#1a2d4e' },
  monthPillTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(1,31,75,0.60)' },
  monthPillTxtActive: { color: '#fff' },
  // Summary cards
  sumCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.50)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(200,218,235,0.70)', alignItems: 'center' },
  sumCardLabel: { fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: 'rgba(1,31,75,0.50)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  sumCardValue: { fontFamily: 'NotoSerif_700Bold', fontSize: 20, color: '#0f1e35' },
});


const AdBanner = ({ isWide, adAnim, navigation }) => {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef(null);
  const { width } = useWindowDimensions();

  // Pull live ads from Firestore via context; filter out visitor-only ads
  // Uses `target` field: 'both' | 'member' | 'visitor'
  const { ads: contextAds } = useMerchandise();
  const ADS = (contextAds && contextAds.length > 0)
    ? contextAds.filter(ad => (ad.target || 'both') !== 'visitor')
    : [
        { id: 1, bg: ['#1a3a6b', '#2e5fa3'], emoji: '📦', title: 'CESLA Merchandise', sub: 'Quality products available now!' },
        { id: 2, bg: ['#7b3f00', '#c9a84c'], emoji: '🎁', title: 'Member Exclusive',   sub: 'Order with your member account!' },
      ];

  useEffect(() => {
    if (ADS.length === 0) return;
    const timer = setInterval(() => {
      setCurrent(prev => {
        const next = (prev + 1) % ADS.length;
        scrollRef.current?.scrollTo({ x: next * bannerW, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [ADS.length]);

  // Reset current index if it's out of range after filtering
  useEffect(() => {
    if (ADS.length > 0 && current >= ADS.length) {
      setCurrent(0);
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [ADS.length]);

  const bannerW = isWide ? Math.min(width * 0.55, 700) : width - 48;

  if (ADS.length === 0) return null;

  // Mobile: animate show/hide via adAnim (1=visible, 0=hidden)
  const mobileAnimStyle = (!isWide && adAnim) ? {
    overflow: 'hidden',
    height: adAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 128] }),
    opacity: adAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    marginBottom: adAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }),
  } : {};

  return (
    <Animated.View style={[{ alignSelf: 'stretch' }, mobileAnimStyle]}>
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setCurrent(Math.round(e.nativeEvent.contentOffset.x / bannerW))}
        style={{ width: bannerW, alignSelf: 'center' }}
        contentContainerStyle={{ width: bannerW * ADS.length }}
      >
        {ADS.map(ad => {
          const titleStyle = {
            fontFamily: ad.titleFmt?.font  || 'GoogleSans_700Bold',
            fontStyle:  ad.titleFmt?.italic    ? 'italic'    : 'normal',
            fontWeight: ad.titleFmt?.bold      ? '700'       : '400',
            textDecorationLine: ad.titleFmt?.underline ? 'underline' : 'none',
          };
          const subStyle = {
            fontFamily: ad.subFmt?.font  || 'GoogleSans_400Regular',
            fontStyle:  ad.subFmt?.italic    ? 'italic'    : 'normal',
            fontWeight: ad.subFmt?.bold      ? '700'       : '400',
            textDecorationLine: ad.subFmt?.underline ? 'underline' : 'none',
          };
          const handleAdPress = () => {
            if (!ad.url) return;
            if (ad.url === 'coop://home') {
              navigation && navigation.navigate('CoopScreen', { view: 'register' });
            } else if (Platform.OS === 'web') {
              window.open(ad.url, '_blank');
            } else {
              import('react-native').then(({ Linking }) => Linking.openURL(ad.url));
            }
          };
          const imgSrc = ad.image ? { uri: ad.image } : (ad.imageUrl ? { uri: ad.imageUrl } : null);
          return (
            <LinearGradient key={ad.id} colors={ad.bg || ['#1a3a6b', '#2e5fa3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[adStyles.slide, { width: bannerW }]}>
              {imgSrc ? (
                <Image source={imgSrc} style={{ position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:16 }} resizeMode="cover" />
              ) : null}
              {!imgSrc ? <Text style={adStyles.adEmoji}>{ad.emoji || '📦'}</Text> : null}
              <TouchableOpacity style={{ flex: 1 }} onPress={handleAdPress} activeOpacity={ad.url ? 0.80 : 1}>
                <Text style={[adStyles.adTitle, titleStyle]}>{ad.title}</Text>
                <Text style={[adStyles.adSub, subStyle]}>{ad.sub}</Text>
                {ad.url ? <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(255,255,255,0.70)', marginTop:2 }}>🔗 Tap to open</Text> : null}
              </TouchableOpacity>
              <View style={adStyles.adBadge}><Text style={adStyles.adBadgeTxt}>AD</Text></View>
              <View style={adStyles.dotsInner}>
                {ADS.map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => { scrollRef.current?.scrollTo({ x: i * bannerW, animated: true }); setCurrent(i); }}>
                    <View style={[adStyles.dot, current === i && adStyles.dotActive]} />
                  </TouchableOpacity>
                ))}
              </View>
            </LinearGradient>
          );
        })}
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
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [mainTab,        setMainTab]        = useState('order'); // 'order' | 'history' | 'credit'
  const [creditTab,      setCreditTab]      = useState('unpaid'); // 'unpaid' | 'paid'
  const [orderHistory,   setOrderHistory]   = useState([]);

  const hdrFade  = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-16)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;
  const adAnim   = useRef(new Animated.Value(1)).current;
  const lastScrollY  = useRef(0);
  const adAnimTarget = useRef(1);
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
    const doLogout = () => {
      setMember(null);
      setLoggedIn(false);
      setCart({});
      setLastOrder(null);
      setOrderHistory([]);
      setMainTab('order');
      setCreditTab('unpaid');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        doLogout();
      }
    } else {
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive', onPress: doLogout },
        ],
        { cancelable: true }
      );
    }
  };

  // Subscribe to member's merchandise orders from Firestore
  useEffect(() => {
    if (!loggedIn || !member?.uid) return;
    const q = query(
      collection(db, 'merchandise_orders'),
      where('memberId', '==', member.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const rows = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
      rows.sort((a, b) => {
        const ta = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const tb = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return tb - ta;
      });
      setOrderHistory(rows);
    }, err => console.warn('merchandise orderHistory snapshot error:', err.message));
    return () => unsub();
  }, [loggedIn, member?.uid]);

  const addToCart = (item, color, size) => {
    const key = item.id + (color ? '-' + color : '') + (size ? '-' + size : '');
    setCart(prev => ({ ...prev, [key]: { item, qty: (prev[key] ? prev[key].qty : 0) + 1, color: color || null, size: size || null } }));
  };

  const removeFromCart = (item, color, size) => {
    const key = item.id + (color ? '-' + color : '') + (size ? '-' + size : '');
    setCart(prev => {
      const qty = (prev[key] ? prev[key].qty : 0) - 1;
      if (qty <= 0) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: { item, qty, color: color || null, size: size || null } };
    });
  };

  const clearCart = () => setCart({});

  const handlePlaceOrder = async (orderData) => {
    const normalizedPayment = orderData.paymentMode === 'credits' ? 'credit' : orderData.paymentMode;
    const normalizedOrder = { ...orderData, paymentMode: normalizedPayment, payment: normalizedPayment };

    try {
      await addOrder({
        ...normalizedOrder,
        status: 'done',
        source: 'member',
        memberId:     member?.uid    || null,
        memberName:   member?.name   || (member?.firstName && member?.lastName ? `${member.lastName}, ${member.firstName}` : null) || member?.firstName || null,
        memberUserId: member?.userId || null,
      });
      await deductStock(orderData.items);
    } catch (e) { console.warn('handlePlaceOrder error:', e); }
    setLastOrder(normalizedOrder);
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
      <Animated.View style={{ opacity: hdrFade, transform: [{ translateY: hdrTrans }], marginTop: Platform.OS === 'web' ? 16 : 36, marginHorizontal: isSmall ? 8 : 10, zIndex: 100 }}>
        <View style={[styles.header, { paddingHorizontal: isWide ? 40 : 12, paddingVertical: isWide ? 16 : 7 }]}>
          {/* Left: back button only shown when NOT logged in */}
          {!loggedIn ? (
            <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.80}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}

          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1, { fontSize: isWide ? 22 : isSmall ? 14 : 16 }]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>CESLA </Text>Merchandise — Member
            </Text>
          </View>

          {/* Right: avatar + firstName + menu icon (logged in only), else spacer */}
          {loggedIn && member ? (
            <View style={styles.headerRight}>
              <>
                {member.photoURL ? (
                  <Image source={{ uri: member.photoURL }} style={styles.headerAvatar} />
                ) : (
                  <View style={styles.headerAvatarFallback}>
                    <Text style={styles.headerAvatarInitial}>
                      {(member.firstName || member.name || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.headerFirstName} numberOfLines={1}>
                  {member.firstName || member.name?.split(' ')[0] || member.userId}
                </Text>
              </>
              <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuOpen(prev => !prev)} activeOpacity={0.75}>
                <Text style={styles.menuIcon}>☰</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: 40 }} />
          )}

          {/* Dropdown (logged in only) */}
          {menuOpen && loggedIn && (
            <View style={styles.dropdown}>
              {[
                { icon: '🛒', label: 'Order Now',        tab: 'order'   },
                { icon: '📋', label: 'My Order History', tab: 'history' },
                { icon: '🪙', label: 'My Credit',        tab: 'credit'  },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.tab}
                  style={[styles.dropdownItem, { backgroundColor: mainTab === opt.tab ? 'rgba(201,168,76,0.15)' : 'transparent' }]}
                  onPress={() => { setMainTab(opt.tab); setMenuOpen(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dropdownItemText, {
                    fontFamily: mainTab === opt.tab ? 'GoogleSans_700Bold' : 'GoogleSans_500Medium',
                    fontSize: 13,
                    color: mainTab === opt.tab ? '#c9a84c' : 'rgba(255,255,255,0.85)',
                  }]}>
                    {opt.icon}{'  '}{opt.label}
                  </Text>
                  {mainTab === opt.tab && <View style={{ width:3, borderRadius:2, backgroundColor:'#c9a84c', position:'absolute', left:0, top:6, bottom:6 }} />}
                </TouchableOpacity>
              ))}
              <View style={{ height:1, backgroundColor:'rgba(255,255,255,0.10)', marginVertical:4 }} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setMenuOpen(false); handleLogout(); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.dropdownItemText, { fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.85)' }]}>
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>

      {/* BODY */}
      <Animated.View style={[styles.body, { opacity: bodyFade }, !loggedIn && { flexDirection: 'column' }]}>
        {!loggedIn ? (
          /* ─── LOGIN GATE ─── */
          <LoginGate onLogin={handleLogin} onBack={handleBack} />
        ) : (
          /* ─── LOGGED IN ─── */
          <>
          {/* ── HISTORY TAB ── */}
          {mainTab === 'history' && (
            <HistoryTabContent
              orderHistory={orderHistory}
              isWide={isWide}
              showStatus={true}
              onShopNow={() => setMainTab('order')}
            />
          )}

                    {/* ── CREDIT TAB ── */}
          {mainTab === 'credit' && (() => {
            const fmtDateTime = (ts) => {
              try {
                let d;
                if (!ts) return '—';
                if (ts?.toDate) d = ts.toDate();
                else if (typeof ts === 'number') d = new Date(ts);
                else d = new Date(ts);
                if (isNaN(d.getTime())) return '—';
                return d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })
                  + ' · ' + d.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', hour12:true });
              } catch { return '—'; }
            };

            const creditOrders  = orderHistory.filter(o => {
              const pm = (o.payment || o.paymentMode || '').toLowerCase();
              return pm === 'credit' || pm === 'credits';
            }
            );
            const unpaidOrders  = creditOrders.filter(o => o.settled !== true);
            const paidOrders    = creditOrders.filter(o => o.settled === true);
            const totalUnpaid   = unpaidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
            const totalPaid     = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
            const displayOrders = creditTab === 'unpaid' ? unpaidOrders : paidOrders;

            return (
              <View style={{ flex:1, minHeight:0, alignItems:'stretch', paddingBottom: isWide ? 16 : 8 }}>
              <View style={{ flex:1, width:'100%', maxWidth: isWide ? 1100 : '100%', alignSelf:'center', paddingHorizontal: isWide ? 24 : 10, paddingTop:4, minHeight:0 }}>

                {/* ── Page header ── */}
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:11, color:'rgba(1,31,75,0.55)', letterSpacing:2, textTransform:'uppercase' }}>🪙 My Credit</Text>
                  {unpaidOrders.length > 0 && (
                    <View style={{ backgroundColor:'rgba(201,168,76,0.18)', borderRadius:20, paddingHorizontal:9, paddingVertical:3, borderWidth:1, borderColor:'rgba(201,168,76,0.38)' }}>
                      <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#8a5c00' }}>
                        {unpaidOrders.length} unpaid
                      </Text>
                    </View>
                  )}
                </View>

                {/* ── Summary tab cards ── */}
                <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
                  <TouchableOpacity onPress={() => setCreditTab('unpaid')} activeOpacity={0.85} style={{ flex:1, borderRadius:10, overflow:'hidden' }}>
                    <View style={{ padding:10, borderRadius:10, borderWidth: creditTab === 'unpaid' ? 1.5 : 1, borderColor: creditTab === 'unpaid' ? '#c9a84c' : 'rgba(255,255,255,0.70)', backgroundColor: creditTab === 'unpaid' ? '#1a2d4e' : 'rgba(255,255,255,0.50)' }}>
                      <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:8, letterSpacing:1.2, textTransform:'uppercase', marginBottom:3, color: creditTab === 'unpaid' ? 'rgba(255,255,255,0.45)' : 'rgba(1,31,75,0.40)' }}>Unpaid</Text>
                      <Text style={{ fontFamily:'NotoSerif_700Bold', fontSize:17, lineHeight:20, color: creditTab === 'unpaid' ? '#c9a84c' : '#c87a1a' }}>₱ {totalUnpaid.toFixed(2)}</Text>
                      <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:9, marginTop:2, color: creditTab === 'unpaid' ? 'rgba(255,255,255,0.38)' : 'rgba(1,31,75,0.40)' }}>{unpaidOrders.length} order{unpaidOrders.length !== 1 ? 's' : ''}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setCreditTab('paid')} activeOpacity={0.85} style={{ flex:1, borderRadius:10, overflow:'hidden' }}>
                    <View style={{ padding:10, borderRadius:10, borderWidth: creditTab === 'paid' ? 1.5 : 1, borderColor: creditTab === 'paid' ? '#27ae60' : 'rgba(255,255,255,0.70)', backgroundColor: creditTab === 'paid' ? '#0f3320' : 'rgba(255,255,255,0.50)' }}>
                      <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:8, letterSpacing:1.2, textTransform:'uppercase', marginBottom:3, color: creditTab === 'paid' ? 'rgba(255,255,255,0.45)' : 'rgba(1,31,75,0.40)' }}>Paid</Text>
                      <Text style={{ fontFamily:'NotoSerif_700Bold', fontSize:17, lineHeight:20, color: creditTab === 'paid' ? '#3edb82' : '#27ae60' }}>₱ {totalPaid.toFixed(2)}</Text>
                      <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:9, marginTop:2, color: creditTab === 'paid' ? 'rgba(255,255,255,0.38)' : 'rgba(1,31,75,0.40)' }}>{paidOrders.length} order{paidOrders.length !== 1 ? 's' : ''}</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* ── Notice banner ── */}
                {creditTab === 'unpaid' && unpaidOrders.length > 0 && (
                  <View style={{ flexDirection:'row', alignItems:'flex-start', gap:8, padding:9, borderRadius:9, marginBottom:10, backgroundColor:'rgba(201,168,76,0.10)', borderWidth:1, borderColor:'rgba(201,168,76,0.28)' }}>
                    <Text style={{ fontSize:12 }}>⚠️</Text>
                    <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.68)', lineHeight:17, flex:1 }}>
                      Ang mga orders nga <Text style={{ fontFamily:'GoogleSans_700Bold', color:'rgba(1,31,75,0.82)' }}>Credit</Text> ang payment kay ilusot sa imong sweldo o dividend sa payday. Kontaka ang merchandise admin para ma-mark as paid.
                    </Text>
                  </View>
                )}
                {creditTab === 'unpaid' && unpaidOrders.length === 0 && creditOrders.length > 0 && (
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8, padding:9, borderRadius:9, marginBottom:10, backgroundColor:'rgba(39,174,96,0.10)', borderWidth:1, borderColor:'rgba(39,174,96,0.28)' }}>
                    <Text style={{ fontSize:14 }}>🎉</Text>
                    <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#165c2e', flex:1 }}>Wala nay unpaid credit! Bayad naka tanan.</Text>
                  </View>
                )}

                {/* ── Table ── */}
                {creditOrders.length === 0 ? (
                  <View style={{ alignItems:'center', paddingVertical:36, backgroundColor:'rgba(255,255,255,0.32)', borderRadius:12 }}>
                    <Text style={{ fontSize:28, marginBottom:8 }}>🪙</Text>
                    <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:13, color:'rgba(1,31,75,0.48)', textAlign:'center' }}>Wala pay credit orders</Text>
                    <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.38)', textAlign:'center', marginTop:4 }}>Mag-order gamit Credit para makita diri.</Text>
                  </View>
                ) : displayOrders.length === 0 ? (
                  <View style={{ alignItems:'center', paddingVertical:28, backgroundColor:'rgba(255,255,255,0.32)', borderRadius:12 }}>
                    <Text style={{ fontSize:24, marginBottom:6 }}>{creditTab === 'unpaid' ? '🎉' : '📋'}</Text>
                    <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.43)', textAlign:'center' }}>
                      {creditTab === 'unpaid' ? 'Wala nay unpaid orders!' : 'Wala pay paid orders.'}
                    </Text>
                  </View>
                ) : (
                  <View style={mTbl.tableWrap}>
                    {/* Table header */}
                    <View style={mTbl.thead}>
                      <Text style={[mTbl.hCell, { width:110 }]}>DATE / ORDER</Text>
                      <View style={mTbl.hDivider}/>
                      <Text style={[mTbl.hCell, { flex:1 }]}>ITEMS</Text>
                      <View style={mTbl.hDivider}/>
                      <Text style={[mTbl.hCell, { width:120, textAlign:'center' }]}>TOTAL AMOUNT</Text>
                      <View style={mTbl.hDivider}/>
                      <Text style={[mTbl.hCell, { width:110, textAlign:'center' }]}>STATUS</Text>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={true} style={{ flex:1 }}>
                      {displayOrders.map((order, idx) => {
                        const orderItems = order.items || [];
                        const total      = Number(order.total || 0);
                        const isSettled  = order.settled === true;
                        const isEven     = idx % 2 === 0;
                        return (
                          <View key={order.docId || idx} style={[mTbl.row, isEven && mTbl.rowEven, idx === displayOrders.length - 1 && { borderBottomWidth:0 }]}>
                            {/* Order # + date */}
                            <View style={[mTbl.cell, { width:110 }]}>
                              <Text style={mTbl.ordNo}>#{order.orderNo || '—'}</Text>
                              <Text style={mTbl.ordDate}>{fmtDateTime(order.createdAt)}</Text>
                            </View>
                            {/* Items */}
                            <View style={[mTbl.cell, { flex:1 }]}>
                              {orderItems.slice(0,2).map((it, j) => {
                                const item = it.item || it;
                                const qty  = it.qty || it.quantity || 1;
                                return (
                                  <Text key={j} style={mTbl.itemLine} numberOfLines={1}>
                                    {item.name} ×{qty}
                                  </Text>
                                );
                              })}
                              {orderItems.length > 2 && (
                                <Text style={[mTbl.itemLine, { color:'rgba(1,31,75,0.38)', fontSize:10 }]}>+{orderItems.length - 2} more</Text>
                              )}
                            </View>
                            {/* Amount */}
                            <View style={[mTbl.cell, { width:120, alignItems:'center' }]}>
                              <Text style={[mTbl.total, { color: isSettled ? '#27ae60' : '#c9a84c' }]}>₱{total.toFixed(2)}</Text>
                            </View>
                            {/* Status */}
                            <View style={[mTbl.cell, { width:110, alignItems:'center' }]}>
                              <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:11, color: isSettled ? '#27ae60' : '#c9a84c' }}>
                                {isSettled ? 'Paid' : 'Unpaid'}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
              </View>
            );
          })()}

          {/* ── ORDERING UI ── */}
          {mainTab === 'order' && (<>
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
                <AdBanner isWide={isWide} adAnim={adAnim} navigation={navigation} />
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
                  scrollEventThrottle={16}
                  onScroll={Platform.OS !== 'web' ? (e) => {
                    const y = e.nativeEvent.contentOffset.y;
                    const goingDown = y > lastScrollY.current;
                    lastScrollY.current = y;
                    const target = goingDown && y > 10 ? 0 : 1;
                    if (target !== adAnimTarget.current) {
                      adAnimTarget.current = target;
                      adAnim.stopAnimation();
                      Animated.timing(adAnim, {
                        toValue: target,
                        duration: 120,
                        useNativeDriver: false,
                      }).start();
                    }
                  } : undefined}
                  style={Platform.OS === 'web' ? { height: height - 310 } : { flex: 1 }}
                  contentContainerStyle={[styles.menuGrid, { gap: Platform.OS === 'web' ? 10 : 5, paddingBottom: Platform.OS !== 'web' ? 90 : 20 }]}
                >
                  {filtered.length === 0 ? (
                    <Text style={styles.emptyText}>No items found.</Text>
                  ) : (
                    Array.from({ length: Math.ceil(filtered.length / COLS) }, (_, rowIdx) => (
                      <View key={rowIdx} style={{ flexDirection: 'row', gap: Platform.OS === 'web' ? 10 : 5, marginBottom: Platform.OS === 'web' ? 0 : 5 }}>
                        {filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS).map(item => (
                          <View key={item.id} style={{ flex: 1 }}>
                            <ItemCard item={item} onAdd={(color, size) => addToCart(item, color, size)} />
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
          </>)}
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
        onConfirm={(size) => { addToCart(sizePickerItem, null, size); setSizePickerItem(null); }}
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
  headerRight: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0,
  },
  headerAvatar: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: '#c9a84c',
  },
  headerAvatarFallback: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(201,168,76,0.25)',
    borderWidth: 2, borderColor: '#c9a84c',
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarInitial: {
    fontFamily: 'NotoSerif_700Bold', fontSize: 13, color: '#c9a84c',
  },
  headerFirstName: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff',
    maxWidth: 72, letterSpacing: 0.3,
  },
  menuBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center', alignItems: 'center',
  },
  menuIcon: { color: '#fff', fontSize: 17, fontWeight: '700' },
  dropdown: {
    position: 'absolute', top: '100%', right: 0,
    marginTop: 6, minWidth: 150,
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 13, paddingHorizontal: 18,
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontFamily: 'GoogleSans_500Medium', fontSize: 14, color: '#fff', letterSpacing: 0.3,
  },
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
    shadowColor: '#011f4b', shadowOpacity: 0.12, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4, flex: 1,
  },
  foodCardInner: {
    borderRadius: 14, padding: Platform.OS === 'web' ? 10 : 8,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)',
    alignItems: 'center', gap: Platform.OS === 'web' ? 5 : 3,
    flex: 1, justifyContent: 'space-between',
  },
  // Image carousel wrapper inside card
  cardImgWrap: {
    width: Platform.OS === 'web' ? 86 : 62,
    height: Platform.OS === 'web' ? 86 : 62,
    borderRadius: 10, overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
    marginBottom: Platform.OS === 'web' ? 4 : 2,
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

const mTbl = StyleSheet.create({
  tableWrap: {
    backgroundColor:'rgba(255,255,255,0.55)',
    borderRadius:10, borderWidth:1,
    borderColor:'rgba(200,218,235,0.80)',
    overflow:'hidden', flex:1, minHeight:0,
    shadowColor:'#011f4b', shadowOpacity:0.06,
    shadowRadius:8, shadowOffset:{width:0,height:2}, elevation:2,
  },
  thead: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(220,232,242,0.95)',
    borderBottomWidth:1.5, borderColor:'rgba(180,205,225,0.90)',
    paddingVertical:10,
  },
  hCell: {
    fontFamily:'GoogleSans_700Bold', fontSize:9,
    color:'rgba(1,31,75,0.55)', letterSpacing:1.8,
    textTransform:'uppercase', paddingHorizontal:14,
  },
  hDivider: { width:1, alignSelf:'stretch', backgroundColor:'rgba(180,205,225,0.70)' },
  row: {
    flexDirection:'row', alignItems:'center',
    borderBottomWidth:1, borderColor:'rgba(200,218,235,0.55)',
    paddingVertical:11, backgroundColor:'rgba(255,255,255,0.30)',
  },
  rowEven: { backgroundColor:'rgba(210,228,242,0.35)' },
  cell: { paddingHorizontal:14 },
  ordNo:    { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#0f1e35' },
  ordDate:  { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.45)', marginTop:2, lineHeight:13 },
  itemLine: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.72)', lineHeight:15 },
  total:    { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#27ae60' },
});