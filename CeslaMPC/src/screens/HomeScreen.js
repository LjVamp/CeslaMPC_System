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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    title: 'Canteen Management\nSystem',
    description: 'Employee food ordering, menu management & daily records',
    icon: '🍽️',
    isNew: false,
    screen: 'CanteenScreen',
    accent: '#f5a623',
  },
  {
    id: 'merch',
    title: 'Merchandise Ordering\nSystem',
    description: 'Place, track & manage merchandise orders with real-time status',
    icon: '📦',
    isNew: true,
    screen: 'MerchandiseScreen',
    accent: '#c9a84c',
  },
];

// ── MODULE CARD ───────────────────────────────────────────────────────────────
const ModuleCard = ({ mod, onPress, delay, cardWidth, isWide }) => {
  const fadeY     = useRef(new Animated.Value(0)).current;
  const transY    = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const spin      = useRef(new Animated.Value(0)).current;
  const [arrowPressed, setArrowPressed] = useState(false);
  const arrowX    = useRef(new Animated.Value(0)).current;
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
    // Native driver animations (transform/opacity)
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 0.97, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1.1,  useNativeDriver: true }),
      Animated.timing(arrowX,    { toValue: 4, duration: 200, useNativeDriver: true }),
      Animated.timing(lineScale, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    // JS driver animation (backgroundColor — cannot use native driver)
    setArrowPressed(true);
  };

  const pressOut = () => {
    // Native driver animations
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.timing(arrowX,    { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(lineScale, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    // JS driver animation
    setArrowPressed(false);
  };

  const ICON_SIZE = isWide ? 88 : 78;
  const RING_SIZE = ICON_SIZE + 14;

  // Shared inner content for both platforms
  const inner = (
    <>
      {mod.isNew && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>NEW</Text>
        </View>
      )}

      <View style={[styles.iconCircle, {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: ICON_SIZE / 2,
      }]}>
        <Animated.Text style={{ fontSize: isWide ? 36 : 30, transform: [{ scale: iconScale }] }}>
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

      <View style={styles.textBlock}>
        <Text style={[styles.cardTitle, { fontSize: isWide ? 15 : 14 }]}>{mod.title}</Text>
        <Text style={[styles.cardDesc, { fontSize: 12 }]}>{mod.description}</Text>
      </View>

      <Animated.View style={[
        styles.arrowBtn,
        { transform: [{ translateX: arrowX }] },
        arrowPressed && { backgroundColor: mod.accent },
      ]}>
        <Text style={styles.arrowText}>→</Text>
      </Animated.View>

      <Animated.View style={[styles.accentLine, {
        backgroundColor: mod.accent,
        transform: [{ scaleX: lineScale }],
      }]} />
    </>
  );

  return (
    <Animated.View style={{
      width: cardWidth,
      opacity: fadeY,
      transform: [{ translateY: transY }, { scale: cardScale }],
    }}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => onPress(mod.screen)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{ borderRadius: 20 }}
      >
        {/* 
          Web   → LinearGradient (glass effect)
          Mobile → plain View with static rgba color (no double-box bug)
        */}
        {Platform.OS === 'web' ? (
          <LinearGradient
            colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.card, { paddingHorizontal: isWide ? 22 : 20 }]}
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

  const PAD = isWide ? 40 : 20;
  const GAP = 20;
  const cardWidth = isWide
    ? (Math.min(width, 1020) - PAD * 2 - GAP * 2) / 3
    : Math.min(width - PAD * 2, 440);

  const logoSize  = isSmall ? 48 : isWide ? 86 : 64;
  const titleSize = isSmall ? 13 : isWide ? 26 : 18;

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

      {/* Background — simulated radial gradient matching original CSS --navy: #98bad5 */}
      {/* Layer 1: base navy color */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
      {/* Layer 2: lighter center radial via top-center gradient */}
      <LinearGradient
        colors={['rgba(198,220,235,0.85)', 'rgba(152,186,213,0.40)', 'rgba(80,110,150,0.0)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0.1 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Layer 3: dark vignette on edges (top-left to bottom-right) */}
      <LinearGradient
        colors={['rgba(50,80,120,0.45)', 'rgba(50,80,120,0.0)', 'rgba(50,80,120,0.45)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Layer 4: dark vignette bottom */}
      <LinearGradient
        colors={['rgba(50,80,120,0.0)', 'rgba(60,90,130,0.35)']}
        locations={[0.4, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
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
          {/* Left Logo */}
          <Image
            source={require('../../assets/CESLA_logo.png')}
            style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 2, flexShrink: 0 }}
            resizeMode="contain"
          />

          {/* Center Title */}
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

          {/* Right Logo */}
          <Image
            source={require('../../assets/CLIMBS_Logo.png')}
            style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 2, flexShrink: 0 }}
            resizeMode="contain"
          />
        </Animated.View>

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

        {/* ── CARDS ── */}
        <View style={[styles.grid, {
          paddingHorizontal: PAD,
          flexDirection: isWide ? 'row' : 'column',
          alignItems: isWide ? 'stretch' : 'center',
          gap: GAP,
        }]}>
          {MODULES.map((mod, i) => (
            <ModuleCard
              key={mod.id}
              mod={mod}
              onPress={handlePress}
              delay={[150, 280, 410][i]}
              cardWidth={cardWidth}
              isWide={isWide}
            />
          ))}
        </View>

        {/* ── FOOTER ── */}
        <Animated.View style={[
          styles.footer,
          { opacity: fFade, transform: [{ translateY: fTrans }] },
        ]}>
          <Text style={styles.footerLine}>────────── ୨ৎ ──────────</Text>
          <Text style={styles.footerText}>
            Choose the service you would like to access  •  CESLA MPC © 2025
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 60 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
  },
  hdrCenter: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  titleBlock: { alignItems: 'center', paddingHorizontal: 10, flexShrink: 1 },
  hdrMobile: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  hdrMobileLogos: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  titleH1: { fontFamily: 'NotoSerif_700Bold', fontWeight: '700', color: '#011f4b', letterSpacing: 0.5, textAlign: 'center' },
  titleBold: { fontFamily: 'NotoSerif_700Bold_Italic', color: '#fff', fontWeight: '700', fontStyle: 'italic' },
  titleSub: { fontFamily: 'GoogleSans_400Regular',
    color: 'rgba(3,57,108,0.65)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },

  sectionLabel: { alignItems: 'center', marginTop: 36, marginBottom: 24, paddingHorizontal: 20 },
  sectionTitle: { fontFamily: 'GoogleSans_700Bold', fontWeight: '700', letterSpacing: 6, textTransform: 'uppercase', color: '#011f4b', marginBottom: 8 },
  sectionSub: { fontFamily: 'GoogleSans_400Regular', color: 'rgba(255,255,255,0.88)', letterSpacing: 0.5, textAlign: 'center' },

  grid: { alignSelf: 'center', width: '100%', maxWidth: 1020 },

  // Base card style (shared)
  card: {
    borderRadius: 20,
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    shadowColor: '#001f4b',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // Mobile-only: static rgba color instead of gradient — eliminates double-box bug
  cardMobile: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  iconCircle: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  textBlock: { alignItems: 'center', gap: 6 },
  cardTitle: { fontFamily: 'GoogleSans_700Bold', fontWeight: '700', color: '#011f4b', letterSpacing: 0.4, lineHeight: 22, textAlign: 'center' },
  cardDesc:  { fontFamily: 'GoogleSans_400Regular', color: 'rgba(3,57,108,0.70)', lineHeight: 17, textAlign: 'center' },

  arrowBtn: {
    marginTop: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(1,31,75,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: { color: 'rgba(1,31,75,0.6)', fontSize: 15, fontWeight: '600' },

  accentLine: { position: 'absolute', bottom: 0, width: '60%', height: 2, borderRadius: 2 },

  badge: {
    position: 'absolute',
    top: 14, right: 14,
    backgroundColor: '#50c896',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },

  footer: { alignItems: 'center', marginTop: 44, paddingHorizontal: 20, paddingBottom: 20, gap: 6 },
  footerLine: { color: 'rgba(235,239,242,0.5)', fontSize: 11, letterSpacing: 1 },
  footerText: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(235,239,242,0.5)', letterSpacing: 0.5, textAlign: 'center' },
});