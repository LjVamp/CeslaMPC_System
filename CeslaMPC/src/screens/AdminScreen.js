// src/screens/AdminScreen.js
// CESLA MPC — Admin Dashboard
// Each card requires login with an account that has access to that specific system.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, StatusBar,
  useWindowDimensions, Platform, Modal,
  TextInput, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';
import { MaterialIcons } from '@expo/vector-icons';

// ─── ADMIN ACCOUNTS ───────────────────────────────────────────────────────────
const ADMIN_ACCOUNTS = [
  {
    id: 'CESLA-ADM-001',
    password: 'SuperAdmin@2026',
    name: 'System Administrator',
    role: 'Super Admin',
    avatar: 'SA',
    accent: '#c9a84c',
    access: 'all',
  },
  {
    id: 'CESLA-ADM-002',
    password: 'CoopBilling#2026',
    name: 'Cooperative & Billing Officer',
    role: 'Coop & Billing Admin',
    avatar: 'CB',
    accent: '#6fa3f7',
    access: ['ManageCoop', 'ManageBilling'],
  },
  {
    id: 'CESLA-ADM-003',
    password: 'CanteenMerch$003',
    name: 'Canteen & Merchandise Officer',
    role: 'Canteen & Merch Admin',
    avatar: 'CM',
    accent: '#f5a623',
    access: ['ManageCanteen', 'ManageMerchandise'],
  },
  {
    id: 'CESLA-ADM-004',
    password: 'CoopAdmin!Only4',
    name: 'Cooperative Administrator',
    role: 'Coop Admin',
    avatar: 'CA',
    accent: '#2ecc71',
    access: ['ManageCoop'],
  },
  {
    id: 'CESLA-ADM-005',
    password: 'Billing@Monitor5',
    name: 'Billing Administrator',
    role: 'Billing Admin',
    avatar: 'BA',
    accent: '#b47aff',
    access: ['ManageBilling'],
  },
];

// ─── SYSTEM MODULES ───────────────────────────────────────────────────────────
const SYSTEMS = [
  {
    key: 'ManageCoop',
    title: 'Manage CESLA\nMulti-Purpose Cooperative',
    description: 'Member accounts, shares, savings, loan management & financial records',
    icon: '🏛️',
    accent: '#6fa3f7',
    screen: 'ManageCoopScreen',
  },
  {
    key: 'ManageCanteen',
    title: 'Manage Canteen Ordering\nand Inventory System',
    description: 'Menu items, canteen orders, stock inventory & daily sales records',
    icon: '🍽️',
    accent: '#f5a623',
    screen: 'ManageCanteenScreen',
  },
  {
    key: 'ManageMerchandise',
    title: 'Merchandise Ordering\nand Inventory System',
    description: 'Product catalog, merchandise orders, stock tracking & order status',
    icon: '📦',
    accent: '#c9a84c',
    screen: 'ManageMerchandiseScreen',
  },
  {
    key: 'ManageBilling',
    title: 'Billing Monitoring\nSystem',
    description: 'Billing records, payment monitoring, statements & transaction history',
    icon: '📋',
    accent: '#2ecc71',
    screen: 'ManageBillingScreen',
  },
];

// ─── HELPER ───────────────────────────────────────────────────────────────────
const accountHasAccess = (account, sysKey) => {
  if (account.access === 'all') return true;
  return Array.isArray(account.access) && account.access.includes(sysKey);
};

// ─── SYSTEM LOGIN MODAL ───────────────────────────────────────────────────────
const SystemLoginModal = ({ visible, system, onClose, onSuccess }) => {
  const [adminId,  setAdminId]  = useState('');
  const [adminPw,  setAdminPw]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked,   setLocked]   = useState(false);
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setAdminId(''); setAdminPw(''); setError('');
      setShowPw(false); setAttempts(0); setLocked(false);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
      ]).start();
    } else {
      slideAnim.setValue(40);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const handleClose = () => { if (!loading) onClose(); };

  const handleLogin = () => {
    if (locked || loading) return;
    if (!adminId.trim()) { setError('Please enter your Admin ID.'); return; }
    if (!adminPw.trim()) { setError('Please enter your password.'); return; }
    setLoading(true); setError('');

    setTimeout(() => {
      const found = ADMIN_ACCOUNTS.find(
        a => a.id === adminId.trim() && a.password === adminPw
      );

      if (found) {
        if (!accountHasAccess(found, system.key)) {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          setError(`"${found.id}" does not have access to this system.`);
          setLoading(false);
          return;
        }
        setLoading(false);
        setAttempts(0);
        onSuccess(found, system.screen);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 5) {
          setLocked(true);
          setError('Too many failed attempts. Access locked for 30 seconds.');
          setTimeout(() => { setLocked(false); setAttempts(0); setError(''); }, 30000);
        } else {
          const rem = 5 - newAttempts;
          setError(`Invalid Admin ID or Password. ${rem} attempt${rem === 1 ? '' : 's'} remaining.`);
        }
        setLoading(false);
      }
    }, 700);
  };

  if (!system) return null;

  // List of account IDs that can access this system
  const authorizedIds = ADMIN_ACCOUNTS
    .filter(a => accountHasAccess(a, system.key))
    .map(a => a.id);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={handleClose} />
        <Animated.View style={[styles.loginCard, { transform: [{ translateY: slideAnim }] }]}>

          {/* Colored top accent bar */}
          <View style={[styles.accentBar, { backgroundColor: system.accent }]} />

          {/* Header row */}
          <View style={styles.lcHeader}>
            <View style={[styles.lcIconWrap, { backgroundColor: system.accent + '22', borderColor: system.accent + '55' }]}>
              <Text style={{ fontSize: 22 }}>{system.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lcTitle} numberOfLines={2}>{system.title.replace('\n', ' ')}</Text>
              <Text style={styles.lcSub}>Admin Access Required</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} disabled={loading}>
              <Text style={styles.closeBtnTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.lcDivider} />

          {/* Authorized accounts hint */}
          <View style={[styles.hintBox, { borderColor: system.accent + '40', backgroundColor: system.accent + '14' }]}>
            <MaterialIcons name="info-outline" size={13} color={system.accent} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.hintTitle, { color: system.accent }]}>Authorized accounts:</Text>
              <Text style={styles.hintIds}>{authorizedIds.join('  •  ')}</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.lcForm}>
            {/* Admin ID */}
            <View>
              <Text style={styles.fieldLabel}>ADMIN ID</Text>
              <View style={[styles.fieldRow, error && !loading && styles.fieldRowError]}>
                <MaterialIcons name="badge" size={16} color="rgba(1,31,75,0.38)" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.fieldInput}
                  value={adminId}
                  onChangeText={v => { setAdminId(v); setError(''); }}
                  placeholder="e.g. CESLA-ADM-001"
                  placeholderTextColor="rgba(1,31,75,0.32)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!locked && !loading}
                />
              </View>
            </View>

            {/* Password */}
            <View>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View style={[styles.fieldRow, error && !loading && styles.fieldRowError]}>
                <MaterialIcons name="lock-outline" size={16} color="rgba(1,31,75,0.38)" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.fieldInput}
                  value={adminPw}
                  onChangeText={v => { setAdminPw(v); setError(''); }}
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(1,31,75,0.32)"
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!locked && !loading}
                  onSubmitEditing={handleLogin}
                  returnKeyType="go"
                />
                <TouchableOpacity onPress={() => setShowPw(p => !p)} style={{ padding: 4 }}>
                  <MaterialIcons
                    name={showPw ? 'visibility-off' : 'visibility'}
                    size={16} color="rgba(1,31,75,0.38)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons name={locked ? 'block' : 'error-outline'} size={13} color={locked ? '#c0392b' : '#e74c3c'} />
                <Text style={[styles.errorTxt, locked && { color: '#c0392b' }]}>{error}</Text>
              </View>
            ) : null}

            {/* Attempt dots */}
            {attempts > 0 && !locked && (
              <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
                {[1,2,3,4,5].map(i => (
                  <View key={i} style={[styles.attemptDot, { backgroundColor: i <= attempts ? '#e74c3c' : 'rgba(1,31,75,0.12)' }]} />
                ))}
              </View>
            )}

            {/* Login button */}
            <TouchableOpacity
              style={[styles.loginBtn, (locked || loading) && { opacity: 0.55 }]}
              disabled={locked || loading}
              activeOpacity={0.85}
              onPress={handleLogin}
            >
              <LinearGradient
                colors={[system.accent, system.accent + 'bb']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.loginBtnGrad}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <MaterialIcons name="login" size={16} color="#fff" />
                      <Text style={styles.loginBtnTxt}>Enter System</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ height: 18 }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── SYSTEM CARD ─────────────────────────────────────────────────────────────
const SystemCard = ({ sys, onPress, delay, cardWidth, isWide }) => {
  const fadeY     = useRef(new Animated.Value(0)).current;
  const transY    = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const spin      = useRef(new Animated.Value(0)).current;
  const arrowX    = useRef(new Animated.Value(0)).current;
  const lineScale = useRef(new Animated.Value(0)).current;
  const [arrowPressed, setArrowPressed] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeY,  { toValue: 1, duration: 650, delay, useNativeDriver: true }),
      Animated.timing(transY, { toValue: 0, duration: 650, delay, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 12000, useNativeDriver: true })
    ).start();
  }, []);

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 0.97, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1.1,  useNativeDriver: true }),
      Animated.timing(arrowX,    { toValue: 4, duration: 200, useNativeDriver: true }),
      Animated.timing(lineScale, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    setArrowPressed(true);
  };

  const pressOut = () => {
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.timing(arrowX,    { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(lineScale, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    setArrowPressed(false);
  };

  const ICON_SIZE = isWide ? 72 : 78;
  const RING_SIZE = ICON_SIZE + 14;

  const inner = (
    <>
      <View style={[styles.iconCircle, { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2 }]}>
        <Animated.Text style={{ fontSize: 30, transform: [{ scale: iconScale }] }}>
          {sys.icon}
        </Animated.Text>
        <Animated.View style={{
          position: 'absolute',
          width: RING_SIZE, height: RING_SIZE,
          borderRadius: RING_SIZE / 2,
          top: -(RING_SIZE - ICON_SIZE) / 2,
          left: -(RING_SIZE - ICON_SIZE) / 2,
          borderWidth: 1.5,
          borderColor: 'rgba(201,168,76,0.40)',
          borderStyle: 'dashed',
          backgroundColor: 'transparent',
          transform: [{ rotate: rotation }],
        }} />
      </View>

      <View style={styles.textBlock}>
        <Text style={[styles.cardTitle, { fontSize: isWide ? 13 : 14 }]}>{sys.title}</Text>
        <Text style={[styles.cardDesc, { fontSize: isWide ? 11 : 12 }]}>{sys.description}</Text>
      </View>

      <Animated.View style={[
        styles.arrowBtn,
        { transform: [{ translateX: arrowX }] },
        arrowPressed && { backgroundColor: sys.accent },
      ]}>
        <Text style={styles.arrowText}>→</Text>
      </Animated.View>

      <Animated.View style={[styles.accentLine, {
        backgroundColor: sys.accent,
        transform: [{ scaleX: lineScale }],
      }]} />
    </>
  );

  return (
    <Animated.View style={{ width: cardWidth, opacity: fadeY, transform: [{ translateY: transY }, { scale: cardScale }] }}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => onPress(sys)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{ borderRadius: 20 }}
      >
        {Platform.OS === 'web' ? (
          <LinearGradient
            colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.08)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={[styles.card, { paddingHorizontal: isWide ? 14 : 20 }]}
          >
            {inner}
          </LinearGradient>
        ) : (
          <View style={[styles.card, styles.cardMobile, { paddingHorizontal: 20 }]}>
            {inner}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function AdminScreen({ navigation, route }) {
  const admin = route?.params?.admin || {
    name: 'Administrator', role: 'Admin',
    avatar: 'AD', accent: '#c9a84c', access: 'all', id: '—',
  };

  const { width } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, NotoSerif_700Bold_Italic,
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const PAD = isWide ? 32 : 20;
  const GAP = 16;
  const cardWidth = isWide
    ? (Math.min(width, 1280) - PAD * 2 - GAP * 3) / 4
    : Math.min(width - PAD * 2, 440);

  const hdrFade  = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-16)).current;
  const secFade  = useRef(new Animated.Value(0)).current;
  const secTrans = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(hdrTrans, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(secFade,  { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
      Animated.timing(secTrans, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleCardPress = (sys) => {
    // Super Admin (access: 'all') — skip login modal, navigate directly
    if (admin.access === 'all') {
      if (navigation) navigation.navigate(sys.screen, { admin });
      return;
    }
    // Other admins — check if they have access to this system
    if (Array.isArray(admin.access) && admin.access.includes(sys.key)) {
      if (navigation) navigation.navigate(sys.screen, { admin });
      return;
    }
    // No access — show login modal so they can use a different account
    setSelectedSystem(sys);
    setLoginModalOpen(true);
  };

  const handleLoginSuccess = (loggedInAdmin, screen) => {
    setLoginModalOpen(false);
    setSelectedSystem(null);
    setTimeout(() => {
      if (navigation) navigation.navigate(screen, { admin: loggedInAdmin });
    }, 200);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── BACKGROUND ── */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
      <LinearGradient
        colors={['rgba(198,220,235,0.85)', 'rgba(152,186,213,0.40)', 'rgba(80,110,150,0.0)']}
        locations={[0, 0.45, 1]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(50,80,120,0.45)', 'rgba(50,80,120,0.0)', 'rgba(50,80,120,0.45)']}
        locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(50,80,120,0.0)', 'rgba(60,90,130,0.35)']}
        locations={[0.4, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER ── */}
      <Animated.View style={{
        opacity: hdrFade, transform: [{ translateY: hdrTrans }],
        marginTop: Platform.OS === 'web' ? 16 : 50,
        marginHorizontal: isWide ? 20 : isSmall ? 12 : 20,
        zIndex: 100,
      }}>
        <View style={[styles.header, { paddingHorizontal: isWide ? 40 : 16, paddingVertical: isWide ? 16 : 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation && navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1, { fontSize: isWide ? 20 : isSmall ? 14 : 16 }]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>Admin </Text>Dashboard
            </Text>
            <Text style={[styles.headerSub, { fontSize: isWide ? 10 : 9 }]} numberOfLines={1} adjustsFontSizeToFit>
              {admin.role}  •  {admin.id}
            </Text>
          </View>

          <View style={{ position:'relative', flexShrink:0 }}>
            <TouchableOpacity
              style={[styles.adminChip, { backgroundColor: admin.accent + '30', borderColor: admin.accent + '60' }]}
              onPress={() => setProfileOpen(p => !p)}
              activeOpacity={0.80}
            >
              <View style={[styles.adminChipAvatar, { backgroundColor: admin.accent, width: isWide ? 26 : 36, height: isWide ? 26 : 36, borderRadius: isWide ? 13 : 18 }]}>
                <Text style={[styles.adminChipAvatarTxt, { fontSize: isWide ? 10 : 14 }]}>{admin.avatar}</Text>
              </View>
              {isWide && (
                <Text style={[styles.adminChipName, { color: '#fff' }]} numberOfLines={1}>
                  {admin.name.split(' ')[0]}
                </Text>
              )}
            </TouchableOpacity>
            {profileOpen && (
              <>
                <TouchableOpacity style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:998 }} activeOpacity={0} onPress={() => setProfileOpen(false)}/>
                <View style={styles.profileDropdown}>
                  <View style={styles.profileDropdownHeader}>
                    <View style={[styles.profileDropdownAvatar, { backgroundColor: admin.accent }]}>
                      <Text style={styles.profileDropdownAvatarTxt}>{admin.avatar}</Text>
                    </View>
                    <View style={{ flex:1, minWidth:0 }}>
                      <Text style={styles.profileDropdownName} numberOfLines={1}>{admin.name}</Text>
                      <Text style={styles.profileDropdownRole} numberOfLines={1}>{admin.role}</Text>
                      <Text style={styles.profileDropdownId} numberOfLines={1}>{admin.id}</Text>
                    </View>
                  </View>
                  <View style={styles.profileDropdownDivider}/>
                  <TouchableOpacity
                    style={styles.profileLogoutBtn}
                    activeOpacity={0.80}
                    onPress={() => {
                      setProfileOpen(false);
                      setTimeout(() => navigation && navigation.navigate('Home'), 150);
                    }}
                  >
                    <MaterialIcons name="logout" size={15} color="#e74c3c"/>
                    <Text style={styles.profileLogoutTxt}>Log Out</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Animated.View>

      {/* ── BODY ── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces>
        <Animated.View style={[styles.sectionLabel, { opacity: secFade, transform: [{ translateY: secTrans }] }]}>
          <Text style={[styles.sectionTitle, { fontSize: isWide ? 15 : 13 }]}>SYSTEM MANAGEMENT</Text>
          <Text style={[styles.sectionSub, { fontSize: isWide ? 14 : 13 }]}>Select a system to manage its data and settings</Text>
        </Animated.View>

        {/* 4 cards — one row on web */}
        <View style={[styles.grid, {
          paddingHorizontal: PAD,
          flexDirection: isWide ? 'row' : 'column',
          alignItems: isWide ? 'stretch' : 'center',
          gap: GAP,
          flexWrap: 'nowrap',
        }]}>
          {SYSTEMS.map((sys, i) => (
            <SystemCard
              key={sys.key}
              sys={sys}
              onPress={handleCardPress}
              delay={[150, 250, 350, 450][i]}
              cardWidth={cardWidth}
              isWide={isWide}
            />
          ))}
        </View>

        <Animated.View style={[styles.footer, { opacity: secFade }]}>
          <Text style={styles.footerLine}>────────── ୨ৎ ──────────</Text>
          <Text style={styles.footerText}>CESLA MPC Admin Portal  •  © 2026</Text>
        </Animated.View>
      </ScrollView>

      {/* ── SYSTEM LOGIN MODAL ── */}
      <SystemLoginModal
        visible={loginModalOpen}
        system={selectedSystem}
        onClose={() => { setLoginModalOpen(false); setSelectedSystem(null); }}
        onSuccess={handleLoginSuccess}
      />
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 60 },

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
  backIcon: { color: '#fff', fontSize: 17, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8, minWidth: 0 },
  headerH1: { fontFamily: 'NotoSerif_700Bold', fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: 0.5 },
  headerGold: { fontFamily: 'NotoSerif_700Bold_Italic', color: '#c9a84c', fontStyle: 'italic' },
  headerSub: { fontFamily: 'GoogleSans_400Regular', color: 'rgba(232,200,122,0.75)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },
  adminChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 24, borderWidth: 1, flexShrink: 0 },
  adminChipAvatar: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  adminChipAvatarTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#0d1b3e' },
  adminChipName: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, maxWidth: 70 },

  sectionLabel: { alignItems: 'center', marginTop: 32, marginBottom: 22, paddingHorizontal: 20 },
  sectionTitle: { fontFamily: 'GoogleSans_700Bold', letterSpacing: 5, textTransform: 'uppercase', color: '#011f4b', marginBottom: 8 },
  sectionSub: { fontFamily: 'GoogleSans_400Regular', color: 'rgba(255,255,255,0.88)', letterSpacing: 0.5, textAlign: 'center' },

  grid: { alignSelf: 'center', width: '100%', maxWidth: 1280 },

  card: {
    borderRadius: 20, paddingTop: 36, paddingBottom: 28,
    alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    shadowColor: '#001f4b', shadowOpacity: 0.12, shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  cardMobile: {
    backgroundColor: 'rgba(178,203,222,0.50)',
    shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 }, elevation: 0,
  },
  iconCircle: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.60)',
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  textBlock: { alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  cardTitle: { fontFamily: 'GoogleSans_700Bold', color: '#011f4b', letterSpacing: 0.4, lineHeight: 20, textAlign: 'center' },
  cardDesc: { fontFamily: 'GoogleSans_400Regular', color: 'rgba(3,57,108,0.70)', lineHeight: 16, textAlign: 'center' },
  arrowBtn: { marginTop: 4, width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(1,31,75,0.20)', justifyContent: 'center', alignItems: 'center' },
  arrowText: { color: 'rgba(1,31,75,0.6)', fontSize: 15, fontWeight: '600' },
  accentLine: { position: 'absolute', bottom: 0, width: '60%', height: 2, borderRadius: 2 },

  footer: { alignItems: 'center', marginTop: 36, paddingHorizontal: 20, paddingBottom: 20, gap: 6 },
  footerLine: { color: 'rgba(235,239,242,0.5)', fontSize: 11, letterSpacing: 1 },
  footerText: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(235,239,242,0.5)', letterSpacing: 0.5, textAlign: 'center' },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(5,15,40,0.62)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  loginCard: {
    width: '100%', maxWidth: 420, borderRadius: 20,
    backgroundColor: '#f0f5fa', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.30, shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 }, elevation: 20,
  },
  accentBar: { height: 4, width: '100%' },
  lcHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, paddingBottom: 14 },
  lcIconWrap: { width: 46, height: 46, borderRadius: 13, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  lcTitle: { fontFamily: 'NotoSerif_700Bold', fontSize: 14, color: '#011f4b', lineHeight: 20 },
  lcSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.50)', marginTop: 2 },
  lcDivider: { height: 1, backgroundColor: 'rgba(1,31,75,0.08)', marginHorizontal: 18, marginBottom: 14 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(1,31,75,0.08)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  closeBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: 'rgba(1,31,75,0.55)' },

  hintBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 20, marginBottom: 14, borderRadius: 10, borderWidth: 1, padding: 11 },
  hintTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, letterSpacing: 0.5, marginBottom: 4 },
  hintIds: { fontFamily: 'GoogleSans_500Medium', fontSize: 11, color: 'rgba(1,31,75,0.65)', lineHeight: 17 },

  lcForm: { paddingHorizontal: 20, gap: 12 },
  fieldLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(1,31,75,0.50)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: 'rgba(180,200,220,0.80)' },
  fieldRowError: { borderColor: '#e74c3c' },
  fieldInput: { flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: '#011f4b' },

  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: 'rgba(231,76,60,0.08)', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: 'rgba(231,76,60,0.25)' },
  errorTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: '#e74c3c', flex: 1, lineHeight: 17 },
  attemptDot: { width: 8, height: 8, borderRadius: 4 },

  loginBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  loginBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  loginBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#fff', letterSpacing: 0.8 },

  // ── Profile dropdown ──
  profileDropdown: {
    position: 'absolute', top: 46, right: 0, zIndex: 999,
    backgroundColor: '#f0f5fa', borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)',
    shadowColor: '#011f4b', shadowOpacity: 0.22, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 14,
    minWidth: 220, overflow: 'hidden',
  },
  profileDropdownHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, paddingBottom: 12,
  },
  profileDropdownAvatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  profileDropdownAvatarTxt: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#0d1b3e',
  },
  profileDropdownName: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#011f4b',
  },
  profileDropdownRole: {
    fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(1,31,75,0.55)', marginTop: 1,
  },
  profileDropdownId: {
    fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(1,31,75,0.40)', marginTop: 1,
  },
  profileDropdownDivider: {
    height: 1, backgroundColor: 'rgba(1,31,75,0.08)',
  },
  profileLogoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 13, paddingHorizontal: 16,
  },
  profileLogoutTxt: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#e74c3c',
  },
});