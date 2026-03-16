// src/screens/BillingDashboardScreen.js
// CESLA MPC — Billing Monitoring System — Main Dashboard
// Tabs: Overview | Free Lunch | Rice Allowances | Water Billing | Milk & Beans | Ticket

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Platform, useWindowDimensions, Animated,
  ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';
import { MaterialIcons } from '@expo/vector-icons';
import { useBilling, CATEGORIES, MONTHS_SHORT, MONTHS } from '../context/BillingContext';

import FreeLunchScreen     from './billing/FreeLunchScreen';
import RiceAllowancesScreen from './billing/RiceAllowancesScreen';
import WaterBillingScreen  from './billing/WaterBillingScreen';
import MilkBeansScreen     from './billing/MilkBeansScreen';
import TicketScreen        from './billing/TicketScreen';
import BillingOverviewScreen from './billing/BillingOverviewScreen';
import SettingsModal       from '../components/billing/SettingsModal';

const TABS = [
  { key: 'overview',       label: 'Overview',        icon: 'dashboard',      color: '#1a3a6b' },
  { key: 'freelunch',      label: 'Free Lunch',      icon: 'restaurant',     color: '#e67e22' },
  { key: 'riceallowances', label: 'Rice Allowances', icon: 'grass',          color: '#27ae60' },
  { key: 'waterbilling',   label: 'Water Billing',   icon: 'water-drop',     color: '#2980b9' },
  { key: 'milkbeans',      label: 'Milk & Beans',    icon: 'local-cafe',     color: '#8e44ad' },
  { key: 'ticket',         label: 'Ticket',          icon: 'confirmation-number', color: '#c0392b' },
];

export default function BillingDashboardScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isSmall = width < 400;

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

  const hdrFade  = useRef(new Animated.Value(0)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(bodyFade, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  // Summary totals for current month/year
  const flTotal  = getCategoryTotal('freelunch',      activeYear, activeMonth);
  const raTotal  = getCategoryTotal('riceallowances', activeYear, activeMonth);
  const wbTotal  = getCategoryTotal('waterbilling',   activeYear, activeMonth);
  const mbTotal  = getCategoryTotal('milkbeans',      activeYear, activeMonth);
  const tkTotal  = getCategoryTotal('ticket',         activeYear, activeMonth);
  const grandTotal = flTotal + raTotal + wbTotal + mbTotal + tkTotal;

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

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background */}
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

      {/* Header */}
      <Animated.View style={{
        opacity: hdrFade,
        marginTop: Platform.OS === 'web' ? 16 : 36,
        marginHorizontal: isSmall ? 8 : 10,
        zIndex: 30, flexShrink: 0,
      }}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation && navigation.goBack()}>
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={[s.headerH1, { fontSize: isSmall ? 13 : 17 }]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={s.headerGold}>CESLA </Text>Billing Monitoring System
            </Text>
            <View style={s.headerTag}>
              <Text style={s.headerTagTxt}>📊  COMPREHENSIVE EXPENSE LEDGER</Text>
            </View>
          </View>
          <TouchableOpacity style={s.iconBtn} onPress={() => setShowSettings(true)}>
            <MaterialIcons name="settings" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View style={[s.body, { opacity: bodyFade }]}>

        {/* Month Selector */}
        <View style={s.monthBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
            {MONTHS_SHORT.map((m, i) => (
              <TouchableOpacity key={m}
                style={[s.monthBtn, activeMonth === i && s.monthBtnActive]}
                onPress={() => setActiveMonth(i)}>
                <Text style={[s.monthBtnTxt, activeMonth === i && s.monthBtnTxtActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Summary Cards */}
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <ActivityIndicator color="#1a3a6b" />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginHorizontal: 8, marginBottom: 8 }}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 4, paddingVertical: 2 }}>
            {/* Grand Total */}
            <View style={[s.summCard, { backgroundColor: '#1a3a6b', minWidth: 130 }]}>
              <Text style={[s.summLabel, { color: '#c9a84c' }]}>GRAND TOTAL</Text>
              <Text style={[s.summVal, { color: '#fff', fontSize: 16 }]}>{fmt(grandTotal)}</Text>
              <Text style={[s.summSub, { color: 'rgba(255,255,255,0.60)' }]}>{MONTHS[activeMonth]} {activeYear}</Text>
            </View>
            {[
              { label: 'Free Lunch',      val: flTotal,  color: '#e67e22' },
              { label: 'Rice Allow.',     val: raTotal,  color: '#27ae60' },
              { label: 'Water Billing',   val: wbTotal,  color: '#2980b9' },
              { label: 'Milk & Beans',    val: mbTotal,  color: '#8e44ad' },
              { label: 'Ticket',          val: tkTotal,  color: '#c0392b' },
            ].map(c => (
              <View key={c.label} style={[s.summCard, { borderLeftWidth: 3, borderLeftColor: c.color }]}>
                <Text style={s.summLabel}>{c.label}</Text>
                <Text style={[s.summVal, { color: c.color }]}>{fmt(c.val)}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Tab Bar */}
        <View style={s.tabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 2, paddingHorizontal: 4 }}
            style={{ flexGrow: 0 }}>
            {TABS.map(tab => (
              <TouchableOpacity key={tab.key}
                style={[s.tabBtn, activeTab === tab.key && s.tabBtnActive]}
                onPress={() => setActiveTab(tab.key)} activeOpacity={0.80}>
                <MaterialIcons
                  name={tab.icon}
                  size={13}
                  color={activeTab === tab.key ? tab.color : 'rgba(255,255,255,0.80)'}
                />
                <Text style={[s.tabBtnTxt, activeTab === tab.key && { color: tab.color }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content Area */}
        <View style={s.contentArea}>
          {renderContent()}
        </View>

      </Animated.View>

      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'column' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(26,58,107,0.92)',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#011f4b', shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  backIcon: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerH1: { fontFamily: 'NotoSerif_700Bold', color: '#fff', textAlign: 'center' },
  headerGold: { color: '#c9a84c' },
  headerTag: {
    marginTop: 2, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)',
  },
  headerTagTxt: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 7, color: '#fff',
    letterSpacing: 1.2, textTransform: 'uppercase', lineHeight: 13,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  body: {
    flex: 1, marginTop: Platform.OS === 'web' ? 10 : 6,
    marginBottom: 0, minHeight: 0, overflow: 'hidden',
  },

  // Month bar
  monthBar: {
    flexShrink: 0, backgroundColor: 'rgba(26,58,107,0.30)',
    marginHorizontal: 10, borderRadius: 12, marginBottom: 6,
  },
  monthBtn: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  monthBtnActive: { backgroundColor: '#fff' },
  monthBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  monthBtnTxtActive: { color: '#1a3a6b' },

  // Summary cards
  summCard: {
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    gap: 2, minWidth: 110,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  summLabel: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 8,
    color: 'rgba(1,31,75,0.55)', letterSpacing: 0.8, textTransform: 'uppercase',
  },
  summVal: {
    fontFamily: 'NotoSerif_700Bold', fontSize: 14, color: '#1a3a6b',
  },
  summSub: {
    fontFamily: 'GoogleSans_400Regular', fontSize: 8, color: 'rgba(1,31,75,0.45)',
  },

  // Tab bar
  tabBar: {
    flexShrink: 0, backgroundColor: 'rgba(26,58,107,0.50)',
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    paddingTop: 5, marginHorizontal: 10,
  },
  tabBtn: {
    paddingVertical: 8, paddingHorizontal: 12,
    borderTopLeftRadius: 10, borderTopRightRadius: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.10)', marginHorizontal: 2,
  },
  tabBtnActive: { backgroundColor: '#eef2f8' },
  tabBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.80)' },

  // Content
  contentArea: {
    flex: 1, minHeight: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    borderTopRightRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.40)',
    marginHorizontal: 10, marginBottom: 10,
    overflow: 'hidden',
  },
});
