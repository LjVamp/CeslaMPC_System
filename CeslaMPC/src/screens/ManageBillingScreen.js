// src/screens/ManageBillingScreen.js
// CESLA MPC — Billing Monitoring System — Main Dashboard

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Platform, Animated, ActivityIndicator,
  Image, Alert, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';
import { MaterialIcons } from '@expo/vector-icons';
import { useBilling, CATEGORIES, MONTHS_SHORT, MONTHS } from '../context/BillingContext';

import FreeLunchScreen       from './billing/FreeLunchScreen';
import RiceAllowancesScreen  from './billing/RiceAllowancesScreen';
import WaterBillingScreen    from './billing/WaterBillingScreen';
import MilkBeansScreen       from './billing/MilkBeansScreen';
import TicketScreen          from './billing/TicketScreen';
import BillingOverviewScreen from './billing/BillingOverviewScreen';
import SettingsModal         from '../components/SettingsModal';
import PrintReportModal      from '../components/PrintReportModal';

// ── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',       label: 'Overview' },
  { key: 'freelunch',      label: 'Free Lunch' },
  { key: 'riceallowances', label: 'Rice Allowances' },
  { key: 'waterbilling',   label: 'Water Billing' },
  { key: 'milkbeans',      label: 'Milk & Beans' },
  { key: 'ticket',         label: 'Ticket' },
];

// ── Color palette ────────────────────────────────────────────────────────────
const C = {
  navyDark:   '#304674',
  navyMid:    '#98bad5',
  navyLight:  '#a8c9de',
  white:      '#ffffff',
  grayLight:  '#f4f6fb',
  grayMid:    '#e2e6f0',
  textDark:   '#2c5f80',
  textMid:    '#4a7a9b',
  grandGreen: '#8eb15c',
};

// ── Animated Tab Button ───────────────────────────────────────────────────────
// Each tab has its own scale + underline width animation
function AnimatedTabBtn({ tab, isActive, onPress }) {
  const scale      = useRef(new Animated.Value(1)).current;
  const underline  = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  // Animate underline whenever active state changes
  React.useEffect(() => {
    Animated.timing(underline, {
      toValue: isActive ? 1 : 0,
      duration: 220,
      useNativeDriver: false,   // width can't use native driver
    }).start();
  }, [isActive]);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
    onPress();
  };

  // Interpolate underline width: 0% → 100%
  const underlineWidth = underline.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={s.catTabWrap}
    >
      <Animated.View style={[s.catTab, { transform: [{ scale }] }]}>
        <Text style={[s.catTabTxt, isActive && s.catTabTxtActive]}>
          {tab.label.toUpperCase()}
        </Text>
        {/* Animated underline sliding in from left */}
        <View style={s.catTabUnderlineBg}>
          <Animated.View style={[s.catTabUnderline, { width: underlineWidth }]} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function BillingDashboardScreen({ navigation }) {
  const { width } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold,
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_700Bold,
  });

  const { loading, getCategoryTotal, fmt } = useBilling();

  const now = new Date();
  const [activeTab,    setActiveTab]    = useState('overview');
  const [activeMonth,  setActiveMonth]  = useState(now.getMonth());
  const [activeYear,   setActiveYear]   = useState(now.getFullYear());
  const [showSettings, setShowSettings] = useState(false);
  const [showPrint,    setShowPrint]    = useState(false);

  // ── Entrance animations ───────────────────────────────────────────────────
  const hdrFade  = useRef(new Animated.Value(0)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(bodyFade, { toValue: 1, duration: 450, delay: 120, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Summary totals ────────────────────────────────────────────────────────
  const flTotal    = getCategoryTotal('freelunch',      activeYear, activeMonth);
  const raTotal    = getCategoryTotal('riceallowances', activeYear, activeMonth);
  const wbTotal    = getCategoryTotal('waterbilling',   activeYear, activeMonth);
  const mbTotal    = getCategoryTotal('milkbeans',      activeYear, activeMonth);
  const tkTotal    = getCategoryTotal('ticket',         activeYear, activeMonth);
  const grandTotal = flTotal + raTotal + wbTotal + mbTotal + tkTotal;

  const SUMMARY_CARDS = [
    { id: 'fl', label: 'FREE LUNCH',       val: flTotal  },
    { id: 'ra', label: 'RICE ALLOWANCES',  val: raTotal  },
    { id: 'wb', label: 'WATER BILLING',    val: wbTotal  },
    { id: 'mb', label: 'MILK & BEANS',     val: mbTotal  },
    { id: 'tk', label: 'TICKET',           val: tkTotal  },
  ];

  // ── Tab content ───────────────────────────────────────────────────────────
  const renderContent = () => {
    const props = { year: activeYear, month: activeMonth };
    switch (activeTab) {
      case 'overview':       return <BillingOverviewScreen year={activeYear} onYearChange={setActiveYear} />;
      case 'freelunch':      return <FreeLunchScreen      {...props} />;
      case 'riceallowances': return <RiceAllowancesScreen {...props} />;
      case 'waterbilling':   return <WaterBillingScreen   {...props} />;
      case 'milkbeans':      return <MilkBeansScreen      {...props} />;
      case 'ticket':         return <TicketScreen         {...props} />;
      default:               return null;
    }
  };

  if (!fontsLoaded) return null;

  const SB_HEIGHT = Platform.OS === 'ios' ? 44 : Platform.OS === 'android' ? 28 : 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ══════════════ HEADER ══════════════════════════════════════════════ */}
      <Animated.View style={{ opacity: hdrFade, flexShrink: 0 }}>
        <LinearGradient
          colors={[C.navyDark, C.navyMid, C.navyLight]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          locations={[0, 0.60, 1]}
          style={[s.header, { paddingTop: SB_HEIGHT + 18 }]}
        >
          {/* header-top row */}
          <View style={s.headerTop}>
            {navigation && (
              <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <MaterialIcons name="arrow-back" size={20} color={C.white} />
              </TouchableOpacity>
            )}

            {/* Logo + title centered */}
            <View style={s.headerCenter}>
              <Image
                source={require('../../assets/CESLA_logo.png')}
                style={s.headerLogo}
                resizeMode="cover"
              />
              <View style={s.headerTitleBlock}>
                <Text style={s.headerH1} numberOfLines={1} adjustsFontSizeToFit>
                  CESLA Billing Monitoring System
                </Text>
                <Text style={s.headerSub}>
                  Comprehensive Expense &amp; Statement Ledger Application
                </Text>
              </View>
            </View>

            {/* Settings + Print buttons */}
            <View style={s.headerButtons}>
              <TouchableOpacity style={s.printBtn} onPress={() => setShowSettings(true)} activeOpacity={0.80}>
                <MaterialIcons name="settings" size={15} color={C.white} />
                <Text style={s.printBtnTxt}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.printBtn}
                onPress={() => setShowPrint(true)}
                activeOpacity={0.80}
              >
                <MaterialIcons name="print" size={15} color={C.white} />
                <Text style={s.printBtnTxt}>Print Report</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Month pill tabs — centered */}
          <View style={s.monthNavWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.monthNav}>
              {MONTHS_SHORT.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={[s.monthBtn, activeMonth === i && s.monthBtnActive]}
                  onPress={() => setActiveMonth(i)}
                  activeOpacity={0.80}
                >
                  <Text style={[s.monthBtnTxt, activeMonth === i && s.monthBtnTxtActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ══════════════ BODY ════════════════════════════════════════════════ */}
      <Animated.View style={[s.body, { opacity: bodyFade }]}>

        {/* Summary cards — equal width, centered content */}
        {loading ? (
          <View style={s.loadingRow}>
            <ActivityIndicator color={C.navyDark} />
          </View>
        ) : (
          <View style={s.summaryBar}>
            <View style={[s.summCard, s.summCardGrand]}>
              <Text style={[s.summLabel, s.summLabelGrand]}>GRAND TOTAL</Text>
              <Text style={[s.summAmount, s.summAmountGrand]} numberOfLines={1} adjustsFontSizeToFit>
                {fmt(grandTotal)}
              </Text>
            </View>
            {SUMMARY_CARDS.map(c => (
              <View key={c.id} style={s.summCard}>
                <Text style={s.summLabel}>{c.label}</Text>
                <Text style={s.summAmount} numberOfLines={1} adjustsFontSizeToFit>
                  {fmt(c.val)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Category tabs with press + underline animations ───────────── */}
        <View style={s.catTabsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catTabsInner}>
            {TABS.map(tab => (
              <AnimatedTabBtn
                key={tab.key}
                tab={tab}
                isActive={activeTab === tab.key}
                onPress={() => setActiveTab(tab.key)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Tab content */}
        <View style={s.contentArea}>
          {renderContent()}
        </View>

      </Animated.View>

      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      <PrintReportModal visible={showPrint} onClose={() => setShowPrint(false)} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({

  root: { flex: 1, backgroundColor: C.grayLight },

  // ── HEADER ────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 28,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 16,
  },

  backBtn: {
    position: 'absolute', left: 0, zIndex: 2,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },

  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    maxWidth: '70%',
  },

  headerLogo: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2.5, borderColor: C.navyDark,
    backgroundColor: C.white, flexShrink: 0,
  },

  headerTitleBlock: {
    alignItems: 'center',
    flexShrink: 1,
  },

  headerH1: {
    fontFamily: 'NotoSerif_700Bold',
    fontSize: Platform.OS === 'web' ? 26 : 17,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.4,
    textAlign: 'center',
    lineHeight: Platform.OS === 'web' ? 32 : 22,
  },

  headerSub: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: Platform.OS === 'web' ? 13 : 11,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 3,
  },

  headerButtons: {
    position: 'absolute', right: 0, zIndex: 2,
    flexDirection: 'row', gap: 6, alignItems: 'center',
  },

  printBtn: {
    backgroundColor: C.navyDark,
    borderRadius: 7,
    paddingHorizontal: Platform.OS === 'web' ? 16 : 10,
    paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0,
  },

  printBtnTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: Platform.OS === 'web' ? 13 : 11,
    color: C.white, fontWeight: '800', letterSpacing: 0.4,
  },

  // ── Month nav ─────────────────────────────────────────────────────────────
  monthNavWrap: { alignItems: 'center' },

  monthNav: {
    flexDirection: 'row', gap: 5,
    paddingHorizontal: 4, paddingTop: 2,
    justifyContent: 'center',
  },

  monthBtn: {
    backgroundColor: C.navyDark,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    paddingVertical: 7, paddingHorizontal: 14, flexShrink: 0,
  },

  monthBtnActive: { backgroundColor: C.white },

  monthBtnTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 12, fontWeight: '700', color: C.white, letterSpacing: 0.4,
  },

  monthBtnTxtActive: { color: C.navyMid },

  // ── BODY ──────────────────────────────────────────────────────────────────
  body: { flex: 1, minHeight: 0 },

  loadingRow: {
    alignItems: 'center', paddingVertical: 16,
    backgroundColor: C.white,
    borderBottomWidth: 2, borderBottomColor: C.grayMid,
  },

  // ── Summary bar ───────────────────────────────────────────────────────────
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderBottomWidth: 2, borderBottomColor: C.grayMid,
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
    shadowColor: '#1a2456', shadowOpacity: 0.07,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },

  summCard: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 12,
    borderWidth: 2, borderColor: C.grayMid,
    justifyContent: 'center', alignItems: 'center',
    minWidth: 0,
  },

  summCardGrand: {
    backgroundColor: C.navyMid,
    borderColor: C.navyMid,
  },

  summLabel: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 11, fontWeight: '800',
    letterSpacing: 0.8, textTransform: 'uppercase',
    color: C.textDark, marginBottom: 6, textAlign: 'center',
  },

  summLabelGrand: { color: C.navyDark },

  summAmount: {
    fontFamily: 'NotoSerif_700Bold',
    fontSize: 22, fontWeight: '800',
    color: C.textDark, textAlign: 'center',
  },

  summAmountGrand: { color: C.navyDark, fontSize: 26 },

  // ── Category tabs with animation ──────────────────────────────────────────
  catTabsRow: {
    backgroundColor: C.white,
    borderBottomWidth: 2.5, borderBottomColor: C.grayMid,
  },

  catTabsInner: {
    flexDirection: 'row', paddingHorizontal: 6,
  },

  // Wrapper keeps the touch area clean
  catTabWrap: {
    justifyContent: 'center',
  },

  // The animated tab itself
  catTab: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: 'center',
  },

  catTabTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 11, fontWeight: '700',
    letterSpacing: 1, color: C.textMid,
    marginBottom: 6,
  },

  catTabTxtActive: { color: C.textDark },

  // Thin gray track underneath
  catTabUnderlineBg: {
    width: '100%', height: 3,
    backgroundColor: 'transparent',
    borderRadius: 2, overflow: 'hidden',
  },

  // Animated fill — slides in from 0% to 100% width
  catTabUnderline: {
    height: 3,
    backgroundColor: C.navyMid,   // #98bad5
    borderRadius: 2,
  },

  // ── Content area ──────────────────────────────────────────────────────────
  contentArea: {
    flex: 1, minHeight: 0,
    backgroundColor: C.grayLight,
  },
});