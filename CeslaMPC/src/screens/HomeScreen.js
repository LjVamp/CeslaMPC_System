// src/screens/HomeScreen.js
// CESLA Multi-Purpose Cooperative - Home/Welcome Screen

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  Image,
  useWindowDimensions,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import emailjs from '@emailjs/react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import {
  NotoSerif_700Bold,
  NotoSerif_700Bold_Italic,
} from '@expo-google-fonts/noto-serif';
import {
  GoogleSans_400Regular,
  GoogleSans_500Medium,
  GoogleSans_700Bold,
} from '@expo-google-fonts/google-sans';

// ── ADMIN ACCOUNTS ───────────────────────────────────────────────────────────
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

// ── FEEDBACK TYPE → AUTO SUBJECT MAP ─────────────────────────────────────────
const FEEDBACK_SUBJECTS = {
  'General':    'General Feedback – CESLA MPC App',
  'Bug Report': 'Bug Report – Something is not working properly',
  'Suggestion': 'Suggestion – Feature or improvement idea',
  'Complaint':  'Complaint – Issue I would like to report',
  'Other':      'Other – Miscellaneous feedback',
};

// ── MASCOT IMAGE (safe require — won't crash if file missing) ─────────────────
let MORDI_IMAGE = null;
try { MORDI_IMAGE = require('../../assets/mordi.png'); } catch (_) {}

const MODULES = [
  {
    id: 'coop',
    title: 'CESLA Multi-Purpose\nCooperative',
    description: 'Member registration, shares, savings & loan management',
    icon: '🏛️',
    isNew: false,
    screen: 'CoopScreen',
    accent: '#6fa3f7',
  },
  {
    id: 'canteen',
    title: 'Canteen Ordering\nSystem',
    description: 'Employee food ordering, menu management & daily records',
    icon: '🍽️',
    isNew: false,
    screen: 'CanteenScreen',
    accent: '#f5a623',
  },
  {
    id: 'merch',
    title: 'Merchandise\nOrdering System',
    description: 'Place, track & manage merchandise orders with real-time status',
    icon: '📦',
    image: MORDI_IMAGE,
    isNew: false,
    screen: 'MerchandisePortalScreen',
    accent: '#c9a84c',
  },
  {
    id: 'grocery',
    title: 'Grocery\nOrdering System',
    description: 'Browse and order grocery items with real-time stock and pickup tracking',
    icon: '🛒',
    isNew: true,
    screen: 'GroceryPortalScreen',
    accent: '#2ecc71',
  },
];

// ── MODULE CARD ───────────────────────────────────────────────────────────────
const ModuleCard = ({ mod, onPress, delay, isWide, layout }) => {
  const fadeY     = useRef(new Animated.Value(0)).current;
  const transY    = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const spin      = useRef(new Animated.Value(0)).current;
  const lineScale = useRef(new Animated.Value(0)).current;

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
      Animated.timing(lineScale, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const pressOut = () => {
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.timing(lineScale, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const isMobileHalf = layout === 'mobile-half';
  const ICON_SIZE = isWide ? 72 : isMobileHalf ? 44 : 52;
  const RING_SIZE = ICON_SIZE + 14;

  const iconNode = mod.image ? (
    // ── Custom mascot image — clipped inside circle same as emoji icons ──
    <View style={[styles.iconCircle, {
      width: ICON_SIZE,
      height: ICON_SIZE,
      borderRadius: ICON_SIZE / 2,
      flexShrink: 0,
      overflow: 'hidden',
    }]}>
      <Image
        source={mod.image}
        style={{
          width: ICON_SIZE * 1.1,
          height: ICON_SIZE * 1.1,
          resizeMode: 'cover',
        }}
      />
      <Animated.View style={{
        position: 'absolute',
        width: RING_SIZE,
        height: RING_SIZE,
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
  ) : (
    <View style={[styles.iconCircle, {
      width: ICON_SIZE,
      height: ICON_SIZE,
      borderRadius: ICON_SIZE / 2,
      flexShrink: 0,
    }]}>
      <Animated.Text style={{
        fontSize: isWide ? 30 : isMobileHalf ? 20 : 22,
        transform: [{ scale: iconScale }],
      }}>
        {mod.icon}
      </Animated.Text>
      <Animated.View style={{
        position: 'absolute',
        width: RING_SIZE,
        height: RING_SIZE,
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
  );

  // ── MOBILE FULL (Coop, Grocery): horizontal layout ──
  const mobileFull = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
      {iconNode}
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { fontSize: 14 }]} numberOfLines={2}>
          {mod.title.replace('\n', ' ')}
        </Text>
        {mod.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
        <Text style={[styles.cardDesc, { fontSize: 12 }]} numberOfLines={2}>
          {mod.description}
        </Text>
      </View>
      <Animated.View style={[styles.accentLine, {
        backgroundColor: mod.accent,
        transform: [{ scaleX: lineScale }],
      }]} />
    </View>
  );

  // ── MOBILE HALF (Canteen, Merch): vertical/compact layout ──
  const mobileHalf = (
    <>
      {iconNode}
      <Text
        style={[styles.cardTitle, { fontSize: 11, textAlign: 'center', marginTop: 6 }]}
        numberOfLines={3}
      >
        {mod.title}
      </Text>
      <Text
        style={[styles.cardDesc, { fontSize: 10, textAlign: 'center' }]}
        numberOfLines={3}
      >
        {mod.description}
      </Text>
      <Animated.View style={[styles.accentLine, {
        backgroundColor: mod.accent,
        transform: [{ scaleX: lineScale }],
      }]} />
    </>
  );

  // ── WIDE (tablet/web): vertical card layout ──
  const wideInner = (
    <>
      {iconNode}
      {mod.isNew && (
        <View style={[styles.newBadge, { alignSelf: 'center' }]}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      )}
      <View style={[styles.textBlock, { alignItems: 'center' }]}>
        <Text style={[styles.cardTitle, { fontSize: 15, textAlign: 'center' }]}>{mod.title}</Text>
        <Text style={[styles.cardDesc, { fontSize: 12, textAlign: 'center' }]}>{mod.description}</Text>
      </View>
      <Animated.View style={[styles.accentLine, {
        backgroundColor: mod.accent,
        transform: [{ scaleX: lineScale }],
      }]} />
    </>
  );

  const inner = isWide ? wideInner : isMobileHalf ? mobileHalf : mobileFull;

  const cardStyle = isWide
    ? { paddingHorizontal: 22, paddingVertical: 28, alignItems: 'center', flex: 1 }
    : isMobileHalf
      ? { paddingHorizontal: 12, paddingVertical: 16, alignItems: 'center', flex: 1 }
      : { paddingHorizontal: 18, paddingVertical: 16, alignItems: 'stretch', flex: 1 };

  return (
    <Animated.View style={[
      { flex: 1, opacity: fadeY, transform: [{ translateY: transY }, { scale: cardScale }] },
    ]}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => onPress(mod.screen)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{ borderRadius: 20, flex: 1 }}
      >
        {Platform.OS === 'web' ? (
          <LinearGradient
            colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.card, cardStyle]}
          >
            {inner}
          </LinearGradient>
        ) : (
          <View style={[styles.card, styles.cardMobile, cardStyle]}>
            {inner}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold,
    NotoSerif_700Bold_Italic,
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_700Bold,
  });

  const { width } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const PAD = isWide ? 40 : 16;
  const GAP = isWide ? 20 : 10;

  const logoSize  = isSmall ? 48 : isWide ? 86 : 64;
  const titleSize = isSmall ? 13 : isWide ? 26 : 18;

  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [adminWarnOpen,  setAdminWarnOpen]  = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [adminId,        setAdminId]        = useState('');
  const [adminPw,        setAdminPw]        = useState('');
  const [adminShowPw,    setAdminShowPw]    = useState(false);
  const [adminError,     setAdminError]     = useState('');
  const [adminLoading,   setAdminLoading]   = useState(false);
  const [adminAttempts,  setAdminAttempts]  = useState(0);
  const [adminLocked,    setAdminLocked]    = useState(false);
  const [feedbackOpen,    setFeedbackOpen]    = useState(false);
  const [feedbackName,    setFeedbackName]    = useState('');
  const [feedbackEmail,   setFeedbackEmail]   = useState('');
  const [feedbackSubject, setFeedbackSubject] = useState(FEEDBACK_SUBJECTS['General']);
  const [feedbackText,    setFeedbackText]    = useState('');
  const [feedbackType,    setFeedbackType]    = useState('General');
  const [feedbackFiles,   setFeedbackFiles]   = useState([]);
  const [feedbackSent,    setFeedbackSent]    = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackError,   setFeedbackError]   = useState('');

  const hFade  = useRef(new Animated.Value(0)).current;
  const hTrans = useRef(new Animated.Value(-20)).current;
  const sFade  = useRef(new Animated.Value(0)).current;
  const sTrans = useRef(new Animated.Value(30)).current;
  const fFade  = useRef(new Animated.Value(0)).current;
  const fTrans = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hFade,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(hTrans, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(sFade,  { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }),
      Animated.timing(sTrans, { toValue: 0, duration: 600, delay: 300, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(fFade,  { toValue: 1, duration: 600, delay: 600, useNativeDriver: true }),
      Animated.timing(fTrans, { toValue: 0, duration: 600, delay: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePress = (screen) => { if (navigation) navigation.navigate(screen); };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Background layers */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
      <LinearGradient
        colors={['rgba(198,220,235,0.85)', 'rgba(152,186,213,0.40)', 'rgba(80,110,150,0.0)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0.1 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(50,80,120,0.45)', 'rgba(50,80,120,0.0)', 'rgba(50,80,120,0.45)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(50,80,120,0.0)', 'rgba(60,90,130,0.35)']}
        locations={[0.4, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER ── */}
      <Animated.View style={[
        styles.header,
        {
          paddingTop: Platform.OS === 'web' ? 22 : 50,
          paddingHorizontal: isWide ? PAD : 12,
          justifyContent: isWide ? 'center' : 'space-between',
          gap: isWide ? 16 : 0,
          opacity: hFade,
          transform: [{ translateY: hTrans }],
        },
      ]}>
        <Image
          source={require('../../assets/CESLA_logo.png')}
          style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 2, flexShrink: 0 }}
          resizeMode="contain"
        />
        <View style={styles.titleBlock}>
          <Text style={[styles.titleH1, { fontSize: titleSize, lineHeight: titleSize * 1.35 }]}>
            {'CESLA '}
            <Text style={styles.titleBold}>Multi-Purpose</Text>
            {' Cooperative'}
          </Text>
          <Text style={[styles.titleSub, { fontSize: isSmall ? 7 : isWide ? 10 : 8 }]}>
            COMPREHENSIVE SYSTEM PORTAL  •  SINCE 1992
          </Text>
        </View>
        <Image
          source={require('../../assets/CLIMBS_Logo.png')}
          style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 2, flexShrink: 0 }}
          resizeMode="contain"
        />
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* ── SECTION LABEL ── */}
        <Animated.View style={[
          styles.sectionLabel,
          { opacity: sFade, transform: [{ translateY: sTrans }] },
        ]}>
          <Text style={[styles.sectionTitle, { fontSize: isWide ? 15 : 13 }]}>SYSTEM MODULES</Text>
          <Text style={[styles.sectionSub, { fontSize: isWide ? 14 : 13 }]}>
            Select a service to access its features and tools
          </Text>
        </Animated.View>

        {/* ── CARDS GRID ── */}
        {isWide ? (
          // ── WIDE/TABLET: 2×2 grid ──
          <View style={[styles.grid, {
            paddingHorizontal: PAD,
            flexDirection: 'column',
            gap: GAP,
          }]}>
            {/* Row 1 — Coop + Canteen */}
            <View style={{ flexDirection: 'row', gap: GAP }}>
              {MODULES.slice(0, 2).map((mod, i) => (
                <ModuleCard
                  key={mod.id}
                  mod={mod}
                  onPress={handlePress}
                  delay={[150, 280][i]}
                  isWide={true}
                  layout="wide-col"
                />
              ))}
            </View>
            {/* Row 2 — Merch + Grocery */}
            <View style={{ flexDirection: 'row', gap: GAP }}>
              {MODULES.slice(2, 4).map((mod, i) => (
                <ModuleCard
                  key={mod.id}
                  mod={mod}
                  onPress={handlePress}
                  delay={[410, 540][i]}
                  isWide={true}
                  layout="wide-col"
                />
              ))}
            </View>
          </View>
        ) : (
          // ── MOBILE: 2 cards per row ──
          <View style={[styles.grid, {
            paddingHorizontal: PAD,
            flexDirection: 'column',
            gap: GAP,
          }]}>
            {/* Row 1 — Coop + Canteen */}
            <View style={{ flexDirection: 'row', gap: GAP }}>
              <ModuleCard
                mod={MODULES[0]}
                onPress={handlePress}
                delay={150}
                isWide={false}
                layout="mobile-half"
              />
              <ModuleCard
                mod={MODULES[1]}
                onPress={handlePress}
                delay={280}
                isWide={false}
                layout="mobile-half"
              />
            </View>
            {/* Row 2 — Merchandise + Grocery */}
            <View style={{ flexDirection: 'row', gap: GAP }}>
              <ModuleCard
                mod={MODULES[2]}
                onPress={handlePress}
                delay={410}
                isWide={false}
                layout="mobile-half"
              />
              <ModuleCard
                mod={MODULES[3]}
                onPress={handlePress}
                delay={540}
                isWide={false}
                layout="mobile-half"
              />
            </View>
          </View>
        )}

        {/* ── FOOTER ── */}
        <Animated.View style={[
          styles.footer,
          { opacity: fFade, transform: [{ translateY: fTrans }] },
        ]}>
          <Text style={styles.footerLine}>────────── ୨ৎ ──────────</Text>
          <Text style={styles.footerText}>
            Choose the service you would like to access  •  CESLA MPC © 2026
          </Text>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setSettingsOpen(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
            <Text style={styles.settingsBtnText}>Settings</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* ══ SETTINGS MODAL ══ */}
      <Modal transparent visible={settingsOpen} animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setSettingsOpen(false)} />
          <View style={styles.settingsCard}>
            <View style={styles.settingsCardHeader}>
              <Text style={styles.settingsCardTitle}>⚙️  Settings</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSettingsOpen(false)}>
                <Text style={styles.modalCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.settingsDivider} />
            <TouchableOpacity style={styles.settingsOption} activeOpacity={0.80} onPress={() => { setSettingsOpen(false); setTimeout(() => setAdminWarnOpen(true), 200); }}>
              <View style={[styles.settingsOptionIcon, { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: 'rgba(201,168,76,0.40)' }]}>
                <Text style={{ fontSize: 18 }}>🔒</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsOptionLabel}>Login as Administrator</Text>
                <Text style={styles.settingsOptionSub}>Access admin dashboard &amp; controls</Text>
              </View>
              <Text style={styles.settingsOptionArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsOption} activeOpacity={0.80} onPress={() => { setSettingsOpen(false); setTimeout(() => setFeedbackOpen(true), 200); }}>
              <View style={[styles.settingsOptionIcon, { backgroundColor: 'rgba(111,163,247,0.15)', borderColor: 'rgba(111,163,247,0.40)' }]}>
                <Text style={{ fontSize: 18 }}>💬</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsOptionLabel}>Send Feedback</Text>
                <Text style={styles.settingsOptionSub}>Report issues or share suggestions</Text>
              </View>
              <Text style={styles.settingsOptionArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.settingsDivider} />
            <Text style={styles.settingsVersion}>CESLA MPC System  •  v1.0.0</Text>
          </View>
        </View>
      </Modal>

      {/* ══ ADMIN WARNING MODAL ══ */}
      <Modal transparent visible={adminWarnOpen} animationType="fade" onRequestClose={() => setAdminWarnOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setAdminWarnOpen(false)} />
          <View style={styles.warnCard}>
            <View style={styles.warnIconWrap}><Text style={{ fontSize: 36 }}>⚠️</Text></View>
            <Text style={styles.warnTitle}>Restricted Access</Text>
            <Text style={styles.warnBody}>
              {'The '}<Text style={styles.warnBold}>Administrator Portal</Text>{' is strictly reserved for authorized CESLA cooperative administrators only.\n\nUnauthorized access attempts are logged and may result in disciplinary action.'}
            </Text>
            <View style={styles.warnBadge}><Text style={styles.warnBadgeTxt}>🔐  FOR AUTHORIZED ADMINS ONLY</Text></View>
            <View style={styles.warnBtnRow}>
              <TouchableOpacity style={styles.warnBtnCancel} onPress={() => setAdminWarnOpen(false)}>
                <Text style={styles.warnBtnCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.warnBtnProceed} onPress={() => { setAdminWarnOpen(false); setTimeout(() => setAdminLoginOpen(true), 200); }}>
                <LinearGradient colors={['#c9a84c', '#e8c87a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.warnBtnProceedGrad}>
                  <Text style={styles.warnBtnProceedTxt}>I am an Admin →</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ ADMIN LOGIN MODAL ══ */}
      <Modal transparent visible={adminLoginOpen} animationType="fade" onRequestClose={() => { if (!adminLoading) { setAdminLoginOpen(false); setAdminId(''); setAdminPw(''); setAdminError(''); setAdminShowPw(false); } }}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => { if (!adminLoading) { setAdminLoginOpen(false); setAdminId(''); setAdminPw(''); setAdminError(''); setAdminShowPw(false); } }} />
          <View style={styles.adminLoginCard}>
            <View style={styles.settingsCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="admin-panel-settings" size={20} color="#c9a84c" />
                <Text style={styles.settingsCardTitle}>Admin Login</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { if (!adminLoading) { setAdminLoginOpen(false); setAdminId(''); setAdminPw(''); setAdminError(''); setAdminShowPw(false); } }}>
                <Text style={styles.modalCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.settingsDivider} />
            <View style={{ padding: 18, gap: 14 }}>
              <View style={styles.adminWarnBadge}>
                <MaterialIcons name="lock" size={11} color="#7a5c10" />
                <Text style={styles.adminWarnBadgeTxt}>AUTHORIZED PERSONNEL ONLY</Text>
              </View>
              <View>
                <Text style={styles.adminFieldLabel}>ADMIN ID</Text>
                <View style={[styles.adminFieldRow, adminError && styles.adminFieldRowError]}>
                  <MaterialIcons name="badge" size={17} color="rgba(1,31,75,0.38)" style={{ marginRight: 8 }} />
                  <TextInput style={styles.adminFieldInput} value={adminId} onChangeText={v => { setAdminId(v); setAdminError(''); }} placeholder="e.g. CESLA-ADM-001" placeholderTextColor="rgba(1,31,75,0.32)" autoCapitalize="none" autoCorrect={false} editable={!adminLocked && !adminLoading} />
                </View>
              </View>
              <View>
                <Text style={styles.adminFieldLabel}>PASSWORD</Text>
                <View style={[styles.adminFieldRow, adminError && styles.adminFieldRowError]}>
                  <MaterialIcons name="lock-outline" size={17} color="rgba(1,31,75,0.38)" style={{ marginRight: 8 }} />
                  <TextInput style={styles.adminFieldInput} value={adminPw} onChangeText={v => { setAdminPw(v); setAdminError(''); }} placeholder="Enter your password" placeholderTextColor="rgba(1,31,75,0.32)" secureTextEntry={!adminShowPw} autoCapitalize="none" autoCorrect={false} editable={!adminLocked && !adminLoading} />
                  <TouchableOpacity onPress={() => setAdminShowPw(p => !p)} style={{ padding: 4 }}>
                    <MaterialIcons name={adminShowPw ? 'visibility-off' : 'visibility'} size={17} color="rgba(1,31,75,0.38)" />
                  </TouchableOpacity>
                </View>
              </View>
              {adminError ? (
                <View style={styles.adminErrorBox}>
                  <MaterialIcons name={adminLocked ? 'block' : 'error-outline'} size={14} color={adminLocked ? '#c0392b' : '#e74c3c'} />
                  <Text style={[styles.adminErrorTxt, adminLocked && { color: '#c0392b' }]}>{adminError}</Text>
                </View>
              ) : null}
              {adminAttempts > 0 && !adminLocked && (
                <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
                  {[1,2,3,4,5].map(i => (
                    <View key={i} style={[styles.adminAttemptDot, { backgroundColor: i <= adminAttempts ? '#e74c3c' : 'rgba(1,31,75,0.12)' }]} />
                  ))}
                </View>
              )}
              <TouchableOpacity
                style={[styles.adminLoginBtn, (adminLocked || adminLoading) && { opacity: 0.55 }]}
                disabled={adminLocked || adminLoading}
                activeOpacity={0.85}
                onPress={() => {
                  if (adminLocked || adminLoading) return;
                  if (!adminId.trim()) { setAdminError('Please enter your Admin ID.'); return; }
                  if (!adminPw.trim()) { setAdminError('Please enter your password.'); return; }
                  setAdminLoading(true); setAdminError('');
                  setTimeout(() => {
                    const found = ADMIN_ACCOUNTS.find(a => a.id === adminId.trim() && a.password === adminPw);
                    if (found) {
                      setAdminLoading(false); setAdminAttempts(0); setAdminLoginOpen(false);
                      setAdminId(''); setAdminPw(''); setAdminError(''); setAdminShowPw(false);
                      setTimeout(() => { if (navigation) navigation.navigate('AdminScreen', { admin: found }); }, 150);
                    } else {
                      const newAttempts = adminAttempts + 1; setAdminAttempts(newAttempts);
                      if (newAttempts >= 5) {
                        setAdminLocked(true);
                        setAdminError('Too many failed attempts. Access locked for 30 seconds.');
                        setTimeout(() => { setAdminLocked(false); setAdminAttempts(0); setAdminError(''); }, 30000);
                      } else {
                        const rem = 5 - newAttempts;
                        setAdminError(`Invalid Admin ID or Password. ${rem} attempt${rem === 1 ? '' : 's'} remaining.`);
                      }
                      setAdminLoading(false);
                    }
                  }, 700);
                }}
              >
                <LinearGradient colors={['#c9a84c', '#e8c87a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.adminLoginBtnGrad}>
                  {adminLoading
                    ? <ActivityIndicator color="#0d1b3e" />
                    : <><MaterialIcons name="login" size={16} color="#0d1b3e" /><Text style={styles.adminLoginBtnTxt}>Sign In as Admin</Text></>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ FEEDBACK MODAL ══ */}
      <Modal transparent visible={feedbackOpen} animationType="slide" onRequestClose={() => { if (!feedbackSending) { setFeedbackOpen(false); setFeedbackSent(false); setFeedbackName(''); setFeedbackEmail(''); setFeedbackSubject(FEEDBACK_SUBJECTS['General']); setFeedbackText(''); setFeedbackFiles([]); setFeedbackError(''); setFeedbackType('General'); } }}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => { if (!feedbackSending) { setFeedbackOpen(false); setFeedbackSent(false); setFeedbackName(''); setFeedbackEmail(''); setFeedbackSubject(FEEDBACK_SUBJECTS['General']); setFeedbackText(''); setFeedbackFiles([]); setFeedbackError(''); setFeedbackType('General'); } }} />
          <View style={styles.feedbackCard}>
            <View style={styles.settingsCardHeader}>
              <Text style={styles.settingsCardTitle}>💬  Send Feedback</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { if (!feedbackSending) { setFeedbackOpen(false); setFeedbackSent(false); setFeedbackName(''); setFeedbackEmail(''); setFeedbackSubject(''); setFeedbackText(''); setFeedbackFiles([]); setFeedbackError(''); setFeedbackType('General'); } }}>
                <Text style={styles.modalCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.settingsDivider} />
            {feedbackSent ? (
              <View style={styles.feedbackSentWrap}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
                <Text style={styles.feedbackSentTitle}>Feedback Sent!</Text>
                <Text style={styles.feedbackSentSub}>{'Your message has been sent to\nbandiola.ledyjoy@gmail.com'}</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 18, paddingTop: 10, gap: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View>
                  <Text style={styles.feedbackLabel}>FEEDBACK TYPE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {['General', 'Bug Report', 'Suggestion', 'Complaint', 'Other'].map(type => (
                      <TouchableOpacity key={type} style={[styles.feedbackTypePill, feedbackType === type && styles.feedbackTypePillActive]} onPress={() => { setFeedbackType(type); setFeedbackSubject(FEEDBACK_SUBJECTS[type] || ''); }}>
                        <Text style={[styles.feedbackTypePillTxt, feedbackType === type && styles.feedbackTypePillTxtActive]}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View>
                  <Text style={styles.feedbackLabel}>YOUR NAME</Text>
                  <TextInput style={styles.feedbackField} value={feedbackName} onChangeText={setFeedbackName} placeholder="Enter your name" placeholderTextColor="rgba(1,31,75,0.35)" />
                </View>
                <View>
                  <Text style={styles.feedbackLabel}>YOUR EMAIL (optional)</Text>
                  <TextInput style={styles.feedbackField} value={feedbackEmail} onChangeText={setFeedbackEmail} placeholder="your@email.com" placeholderTextColor="rgba(1,31,75,0.35)" keyboardType="email-address" autoCapitalize="none" />
                </View>
                <View>
                  <Text style={styles.feedbackLabel}>SUBJECT <Text style={{ color: '#e74c3c' }}>*</Text></Text>
                  <TextInput style={styles.feedbackField} value={feedbackSubject} onChangeText={setFeedbackSubject} placeholder="Auto-filled based on feedback type" placeholderTextColor="rgba(1,31,75,0.35)" />
                </View>
                <View>
                  <Text style={styles.feedbackLabel}>MESSAGE <Text style={{ color: '#e74c3c' }}>*</Text></Text>
                  <TextInput style={styles.feedbackInput} value={feedbackText} onChangeText={setFeedbackText} placeholder="Describe your issue, suggestion, or feedback in detail..." placeholderTextColor="rgba(1,31,75,0.35)" multiline numberOfLines={4} textAlignVertical="top" />
                </View>
                {feedbackError ? <Text style={styles.feedbackErrorTxt}>{feedbackError}</Text> : null}
                <TouchableOpacity
                  style={[styles.feedbackSendBtn, (!feedbackSubject.trim() || !feedbackText.trim()) && { opacity: 0.45 }]}
                  disabled={!feedbackSubject.trim() || !feedbackText.trim() || feedbackSending}
                  onPress={async () => {
                    if (!feedbackSubject.trim() || !feedbackText.trim()) return;
                    setFeedbackSending(true); setFeedbackError('');
                    try {
                      const EMAILJS_SERVICE_ID  = 'service_ceslampc';
                      const EMAILJS_TEMPLATE_ID = 'template_feedback';
                      const EMAILJS_PUBLIC_KEY  = 'yNW-knzcWspVbuQrr';
                      const payload = {
                        service_id: EMAILJS_SERVICE_ID, template_id: EMAILJS_TEMPLATE_ID, user_id: EMAILJS_PUBLIC_KEY,
                        template_params: { feedback_type: feedbackType, from_name: feedbackName.trim() || 'Anonymous User', from_email: feedbackEmail.trim() || 'no-reply@ceslampc.app', subject: `[CESLA MPC Feedback – ${feedbackType}] ${feedbackSubject.trim()}`, message: feedbackText.trim(), attachments_note: 'None', app_version: 'CESLA MPC v1.0.0', sent_at: new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) },
                      };
                      if (Platform.OS === 'web') {
                        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        if (res.status !== 200) { setFeedbackError(`Send failed (status ${res.status}).`); return; }
                      } else {
                        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, payload.template_params, { publicKey: EMAILJS_PUBLIC_KEY });
                      }
                      setFeedbackSent(true); setFeedbackName(''); setFeedbackEmail(''); setFeedbackText(''); setFeedbackFiles([]); setFeedbackType('General'); setFeedbackSubject(FEEDBACK_SUBJECTS['General']);
                      setTimeout(() => { setFeedbackOpen(false); setFeedbackSent(false); }, 3000);
                    } catch (e) {
                      setFeedbackError('Something went wrong. Please try again. (' + (e?.message || 'unknown error') + ')');
                    } finally { setFeedbackSending(false); }
                  }}
                >
                  <LinearGradient colors={['#6fa3f7', '#4a85e8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.feedbackSendGrad}>
                    {feedbackSending ? <ActivityIndicator color="#fff" /> : <Text style={styles.feedbackSendTxt}>Send Feedback  →</Text>}
                  </LinearGradient>
                </TouchableOpacity>
                <Text style={styles.feedbackFooterNote}>CESLA MPC System Developers</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 60 },

  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, zIndex: 100, backgroundColor: 'transparent' },
  titleBlock: { alignItems: 'center', paddingHorizontal: 10, flexShrink: 1 },
  titleH1: { fontFamily: 'NotoSerif_700Bold', fontWeight: '700', color: '#011f4b', letterSpacing: 0.5, textAlign: 'center' },
  titleBold: { fontFamily: 'NotoSerif_700Bold_Italic', color: '#fff', fontWeight: '700', fontStyle: 'italic' },
  titleSub: { fontFamily: 'GoogleSans_400Regular', color: 'rgba(3,57,108,0.65)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4, textAlign: 'center' },

  sectionLabel: { alignItems: 'center', marginTop: 24, marginBottom: 16, paddingHorizontal: 20 },
  sectionTitle: { fontFamily: 'GoogleSans_700Bold', fontWeight: '700', letterSpacing: 6, textTransform: 'uppercase', color: '#011f4b', marginBottom: 8 },
  sectionSub: { fontFamily: 'GoogleSans_400Regular', color: 'rgba(255,255,255,0.88)', letterSpacing: 0.5, textAlign: 'center' },

  grid: { alignSelf: 'center', width: '100%', maxWidth: 1020 },

  card: { borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', overflow: 'hidden', shadowColor: '#001f4b', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  cardMobile: { backgroundColor: 'rgba(178,203,222,0.50)', borderColor: 'rgba(255,255,255,0.55)', shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },

  iconCircle: { backgroundColor: 'rgba(255,255,255,0.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.60)', justifyContent: 'center', alignItems: 'center', position: 'relative' },

  newBadge: {
    backgroundColor: 'rgba(46,204,113,0.20)', borderRadius: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.50)',
    alignSelf: 'flex-start', marginBottom: 2,
  },
  newBadgeText: { fontFamily: 'GoogleSans_700Bold', fontSize: 8, color: '#1a7a4a', letterSpacing: 1.2 },

  textBlock: { gap: 6, flex: 1, justifyContent: 'flex-start' },
  cardTitle: { fontFamily: 'GoogleSans_700Bold', fontWeight: '700', color: '#011f4b', letterSpacing: 0.4, lineHeight: 18, fontSize: 13 },
  cardDesc:  { fontFamily: 'GoogleSans_400Regular', color: 'rgba(3,57,108,0.70)', lineHeight: 15, fontSize: 11 },

  accentLine: { position: 'absolute', bottom: 0, width: '60%', height: 2, borderRadius: 2, left: '20%' },

  footer: { alignItems: 'center', marginTop: 44, paddingHorizontal: 20, paddingBottom: 20, gap: 6 },
  footerLine: { color: 'rgba(235,239,242,0.5)', fontSize: 11, letterSpacing: 1 },
  footerText: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(235,239,242,0.5)', letterSpacing: 0.5, textAlign: 'center' },

  settingsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' },
  settingsIcon: { fontSize: 14 },
  settingsBtnText: { fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: 'rgba(235,239,242,0.75)', letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(1,20,50,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },

  settingsCard: { width: '100%', maxWidth: 380, backgroundColor: 'rgba(220,232,242,0.97)', borderRadius: 22, paddingBottom: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)', shadowColor: '#011f4b', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 6 }, elevation: 12, overflow: 'hidden' },
  settingsCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  settingsCardTitle: { fontFamily: 'NotoSerif_700Bold', fontSize: 17, color: '#011f4b' },
  modalCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(1,31,75,0.09)', justifyContent: 'center', alignItems: 'center' },
  modalCloseTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: 'rgba(1,31,75,0.55)' },
  settingsDivider: { height: 1, backgroundColor: 'rgba(1,31,75,0.08)', marginHorizontal: 0, marginBottom: 8 },
  settingsOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  settingsOptionIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  settingsOptionLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#011f4b', marginBottom: 2 },
  settingsOptionSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.55)' },
  settingsOptionArrow: { fontSize: 22, color: 'rgba(1,31,75,0.30)', fontWeight: '300' },
  settingsVersion: { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(1,31,75,0.35)', textAlign: 'center', letterSpacing: 0.5, marginTop: 6 },

  warnCard: { width: '100%', maxWidth: 380, backgroundColor: 'rgba(220,232,242,0.97)', borderRadius: 22, padding: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)', shadowColor: '#011f4b', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 6 }, elevation: 12, alignItems: 'center' },
  warnIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(231,76,60,0.12)', borderWidth: 2, borderColor: 'rgba(231,76,60,0.30)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  warnTitle: { fontFamily: 'NotoSerif_700Bold', fontSize: 20, color: '#c0392b', marginBottom: 12, textAlign: 'center' },
  warnBody: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(1,31,75,0.70)', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  warnBold: { fontFamily: 'GoogleSans_700Bold', color: '#011f4b' },
  warnBadge: { backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201,168,76,0.40)', paddingHorizontal: 14, paddingVertical: 9, marginBottom: 20, width: '100%', alignItems: 'center' },
  warnBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#7a5c10', letterSpacing: 1.5 },
  warnBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  warnBtnCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: 'rgba(1,31,75,0.08)', borderWidth: 1, borderColor: 'rgba(1,31,75,0.15)', alignItems: 'center', justifyContent: 'center' },
  warnBtnCancelTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: 'rgba(1,31,75,0.55)' },
  warnBtnProceed: { flex: 2, borderRadius: 12, overflow: 'hidden', shadowColor: '#c9a84c', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  warnBtnProceedGrad: { paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  warnBtnProceedTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#0d1b3e' },

  feedbackCard: { width: '100%', maxWidth: 420, backgroundColor: 'rgba(220,232,242,0.97)', borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)', shadowColor: '#011f4b', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 6 }, elevation: 12, overflow: 'hidden' },
  feedbackLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(1,31,75,0.55)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  feedbackField: { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: '#011f4b', borderWidth: 1.5, borderColor: 'rgba(200,215,230,0.80)' },
  feedbackInput: { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 10, padding: 14, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: '#011f4b', minHeight: 95, borderWidth: 1.5, borderColor: 'rgba(200,215,230,0.80)' },
  feedbackTypePill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.70)' },
  feedbackTypePillActive: { backgroundColor: '#304674', borderColor: '#c9a84c' },
  feedbackTypePillTxt: { fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: 'rgba(1,31,75,0.65)' },
  feedbackTypePillTxtActive: { fontFamily: 'GoogleSans_700Bold', color: '#fff' },
  feedbackErrorTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: '#c0392b', textAlign: 'center', backgroundColor: 'rgba(231,76,60,0.10)', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: 'rgba(231,76,60,0.25)' },
  feedbackSendBtn: { borderRadius: 12, overflow: 'hidden', shadowColor: '#6fa3f7', shadowOpacity: 0.30, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  feedbackSendGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  feedbackSendTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#fff' },
  feedbackFooterNote: { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(1,31,75,0.40)', textAlign: 'center' },
  feedbackSentWrap: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  feedbackSentTitle: { fontFamily: 'NotoSerif_700Bold', fontSize: 22, color: '#1a7a4a', marginBottom: 8 },
  feedbackSentSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(1,31,75,0.60)', textAlign: 'center', lineHeight: 20 },

  adminLoginCard: { width: '100%', maxWidth: 390, backgroundColor: 'rgba(220,232,242,0.97)', borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)', shadowColor: '#011f4b', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 6 }, elevation: 12, overflow: 'hidden' },
  adminWarnBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201,168,76,0.40)', paddingHorizontal: 14, paddingVertical: 8 },
  adminWarnBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#7a5c10', letterSpacing: 1.5 },
  adminFieldLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(1,31,75,0.55)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  adminFieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1.5, borderColor: 'rgba(200,215,230,0.80)' },
  adminFieldRowError: { borderColor: '#e74c3c' },
  adminFieldInput: { flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: '#011f4b' },
  adminErrorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: 'rgba(231,76,60,0.10)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(231,76,60,0.28)', padding: 11 },
  adminErrorTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: '#e74c3c', flex: 1, lineHeight: 17 },
  adminAttemptDot: { width: 10, height: 10, borderRadius: 5 },
  adminLoginBtn: { borderRadius: 12, overflow: 'hidden', shadowColor: '#c9a84c', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  adminLoginBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, minHeight: 48 },
  adminLoginBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#0d1b3e', letterSpacing: 0.3 },
});