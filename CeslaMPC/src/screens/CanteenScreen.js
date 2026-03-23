// src/screens/CanteenScreen.js
// CLIMBS Canteen Ordering System — pixel-perfect from HTML source

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
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

// ─── ROLE DATA (exact from HTML) ──────────────────────────────────────────────
const ROLES = [
  {
    id: 'member',
    label: 'Member',
    description: 'Order food with your\nCESLA member account',
    icon: '👤',
    badge: null,
    accent: '#6fa3f7',
    screen: 'CanteenMemberScreen',
  },
  {
    id: 'visitor',
    label: 'Visitor',
    description: 'Order as a walk-in\nguest — no login needed',
    icon: '🚶',
    badge: 'Walk-in',
    badgeType: 'new',
    accent: '#b47aff',
    screen: 'CanteenVisitorScreen',
  },
];

// ─── ROLE CARD ────────────────────────────────────────────────────────────────
const RoleCard = ({ role, onPress, delay, cardWidth, isWide }) => {
  const fadeY     = useRef(new Animated.Value(0)).current;
  const transY    = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const spinAnim  = useRef(new Animated.Value(0)).current;
  const [arrowPressed, setArrowPressed] = useState(false);
  const arrowX    = useRef(new Animated.Value(0)).current;
  const lineScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeY,  { toValue: 1, duration: 650, delay, useNativeDriver: true }),
      Animated.timing(transY, { toValue: 0, duration: 650, delay, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 14000, useNativeDriver: true })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0,1], outputRange: ['0deg','360deg'] });

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 0.97, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1.1,  useNativeDriver: true }),
      Animated.timing(arrowX,    { toValue: 5, duration: 200, useNativeDriver: true }),
      Animated.timing(lineScale, { toValue: 1, duration: 400, useNativeDriver: true }),
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

  const ICON_SIZE = isWide ? 90 : 60;
  const RING_SIZE = ICON_SIZE + 12;

  const inner = (
    <>
      {/* Badge */}
      {role.badge && (
        <View style={[
          styles.badge,
          role.badgeType === 'admin' ? styles.badgeAdmin : styles.badgeNew,
        ]}>
          <Text style={[
            styles.badgeText,
            role.badgeType === 'admin' ? styles.badgeAdminText : styles.badgeNewText,
          ]}>
            {role.badge}
          </Text>
        </View>
      )}

      {/* Icon + ring */}
      <View style={[styles.iconCircle, {
        width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2,
      }]}>
        <Animated.Text style={{
          fontSize: isWide ? 38 : 26,
          transform: [{ scale: iconScale }],
        }}>
          {role.icon}
        </Animated.Text>
        {/* Dashed ring — exact from CSS: border: 1.5px dashed rgba(201,168,76,0.22) */}
        <Animated.View style={{
          position: 'absolute',
          width: RING_SIZE, height: RING_SIZE,
          borderRadius: RING_SIZE / 2,
          top: -(RING_SIZE - ICON_SIZE) / 2,
          left: -(RING_SIZE - ICON_SIZE) / 2,
          borderWidth: 1.5,
          borderColor: 'rgba(201,168,76,0.22)',
          borderStyle: 'dashed',
          backgroundColor: 'transparent',
          transform: [{ rotate: spin }],
        }} />
      </View>

      {/* card-name: Playfair Display 800, uppercase */}
      <Text style={[styles.cardName, { fontSize: isWide ? 19 : 17 }]}>
        {role.label.toUpperCase()}
      </Text>

      {/* card-desc: DM Sans 400 */}
      <Text style={[styles.cardDesc, { fontSize: isWide ? 12 : 11 }]}>
        {role.description}
      </Text>

      {/* Arrow */}
      <Animated.View style={[
        styles.arrowBtn,
        { transform: [{ translateX: arrowX }] },
        arrowPressed && { backgroundColor: role.accent },
      ]}>
        <Text style={styles.arrowText}>→</Text>
      </Animated.View>

      {/* Bottom accent line — CSS: var(--card-accent) */}
      <Animated.View style={[styles.accentLine, {
        backgroundColor: role.accent,
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
        onPress={() => onPress(role.screen)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{ borderRadius: 22 }}
      >
        {/* 
          CSS: background: rgba(178,203,222,0.45)
               backdrop-filter: blur(14px)
               border: 1.5px solid rgba(255,255,255,0.55)
        */}
        {Platform.OS === 'web' ? (
          <LinearGradient
            colors={['rgba(178,203,222,0.55)', 'rgba(178,203,222,0.35)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.card, { paddingHorizontal: isWide ? 28 : 20 }]}
          >
            {inner}
          </LinearGradient>
        ) : (
          <View style={[styles.card, styles.cardMobile, {
            paddingHorizontal: isWide ? 28 : 20,
          }]}>
            {inner}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── CANTEEN SCREEN ───────────────────────────────────────────────────────────
export default function CanteenScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold,
    NotoSerif_700Bold_Italic,
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_700Bold,
  });

  // CSS: max-width 860px, gap 24px, padding 40px
  const PAD = isWide ? 40 : isSmall ? 12 : 16;
  const GAP = isWide ? 24 : 12;
  const MAX_GRID = 860;
  const cardWidth = isWide
    ? (Math.min(width, MAX_GRID + PAD * 2) - PAD * 2 - GAP) / 2
    : (width - PAD * 2 - GAP) / 2;

  const hdrFade  = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-16)).current;
  const secFade  = useRef(new Animated.Value(0)).current;
  const secTrans = useRef(new Animated.Value(30)).current;
  const ftFade   = useRef(new Animated.Value(0)).current;
  const ftTrans  = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // CSS: slideDown 0.6s
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(hdrTrans, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    // CSS: fadeUp 0.5s 0.2s
    Animated.parallel([
      Animated.timing(secFade,  { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
      Animated.timing(secTrans, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();
    // CSS: fadeUp 0.6s 0.5s
    Animated.parallel([
      Animated.timing(ftFade,  { toValue: 1, duration: 600, delay: 500, useNativeDriver: true }),
      Animated.timing(ftTrans, { toValue: 0, duration: 600, delay: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePress = (screen) => {
    if (navigation) navigation.navigate(screen);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── BACKGROUND — same radial simulation as HomeScreen ── */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
      <LinearGradient
        colors={['rgba(198,220,235,0.85)', 'rgba(152,186,213,0.40)', 'rgba(80,110,150,0.0)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(50,80,120,0.45)', 'rgba(50,80,120,0.0)', 'rgba(50,80,120,0.45)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(50,80,120,0.0)', 'rgba(60,90,130,0.35)']}
        locations={[0.4, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER — fixed, does not scroll ── */}
      <Animated.View style={{
        opacity: hdrFade,
        transform: [{ translateY: hdrTrans }],
        marginTop: Platform.OS === 'web' ? 16 : 50,
        marginHorizontal: isWide ? 20 : isSmall ? 12 : 20,
        zIndex: 100,
      }}>
        <View style={[styles.header, {
          paddingHorizontal: isWide ? 40 : 16,
          paddingVertical: isWide ? 18 : 10,
        }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation && navigation.goBack()}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1, { fontSize: isWide ? 22 : isSmall ? 15 : 17 }]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>CLIMBS </Text>
              Canteen Ordering System
            </Text>
            <Text style={[styles.headerSub, { fontSize: isWide ? 11 : 9 }]} numberOfLines={1} adjustsFontSizeToFit>
              Select your account type to continue
            </Text>
          </View>

          <View style={{ width: 40, flexShrink: 0 }} />
        </View>
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* ── MAIN ── */}
        <View style={[styles.main, { paddingHorizontal: PAD }]}>

          {/* section-label: h2 Playfair Display 800 */}
          <Animated.View style={[
            styles.sectionLabel,
            { opacity: secFade, transform: [{ translateY: secTrans }] },
          ]}>
            <Text style={[styles.sectionH2, { fontSize: isWide ? 17 : 14 }]}>
              Who are you?
            </Text>
            <Text style={[styles.sectionP, { fontSize: isWide ? 15 : 14 }]}>
              Choose your role to continue
            </Text>
          </Animated.View>

          {/* cards-grid */}
          <View style={[styles.grid, {
            flexDirection: 'row',
            alignItems: 'stretch',
            gap: GAP,
          }]}>
            {ROLES.map((role, i) => (
              <RoleCard
                key={role.id}
                role={role}
                onPress={handlePress}
                delay={[120, 240, 360][i]}
                cardWidth={cardWidth}
                isWide={isWide}
              />
            ))}
          </View>

          {/* tagline */}
          <Animated.View style={[
            styles.tagline,
            { opacity: ftFade, transform: [{ translateY: ftTrans }] },
          ]}>
            <Text style={[styles.taglineP, { fontSize: isWide ? 14 : 13 }]}>
              {'Welcome to '}
              <Text style={styles.taglineWhite}>CLIMBS Canteen!</Text>
              {'  •  Order smart, dine happily.'}
            </Text>
            <Text style={[styles.taglineP, { fontSize: isWide ? 14 : 13 }]}>
              {'Always follow '}
              <Text style={styles.taglineHighlight}>CLAYGO</Text>
              {' — '}
              <Text style={styles.taglineGoldLight}>Clean As You Go.</Text>
            </Text>
          </Animated.View>
        </View>

        {/* footer */}
        <Animated.View style={[styles.footer, { opacity: ftFade }]}>
          <View style={styles.footerBorder} />
          <Text style={[styles.footerP, { fontSize: isWide ? 11 : 11 }]}>
            CESLA Multi-Purpose Cooperative  •  Canteen Ordering System  •  2026
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 22 },

  // ── HEADER: #304674, border-radius 14, margin 16px 20px
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#304674',
    borderRadius: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    shadowColor: '#011f4b',
    shadowOpacity: 0.20,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  backIcon: { color: '#fff', fontSize: 17, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  headerH1: {
    fontFamily: 'NotoSerif_700Bold',
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 22,
  },
  headerGold: {
    fontFamily: 'NotoSerif_700Bold',
    color: '#c9a84c',
  },
  headerSub: {
    fontFamily: 'GoogleSans_400Regular',
    color: 'rgba(232,200,122,0.75)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 2,
    textAlign: 'center',
  },

  // ── MAIN
  main: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    gap: 28,
  },

  // ── SECTION LABEL
  sectionLabel: { alignItems: 'center' },
  sectionH2: {
    fontFamily: 'NotoSerif_700Bold',
    fontWeight: '800',
    letterSpacing: 5,
    textTransform: 'uppercase',
    color: '#ffffff',
    marginBottom: 10,
    textShadowColor: 'rgba(1,31,75,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  sectionP: {
    fontFamily: 'GoogleSans_400Regular',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(1,31,75,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ── GRID
  grid: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 860,
  },

  // ── CARD: rgba(178,203,222,0.45), border 1.5px rgba(255,255,255,0.55)
  card: {
    borderRadius: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    shadowColor: '#011f4b',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cardMobile: {
    backgroundColor: 'rgba(178,203,222,0.50)',
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },

  // Badges
  badge: {
    position: 'absolute', top: 18, right: 18,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  badgeAdmin: {
    backgroundColor: '#c0392b',
    borderWidth: 0,
  },
  badgeNew: {
    backgroundColor: '#27ae60',
    borderWidth: 0,
  },
  badgeText: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  badgeAdminText: { color: '#fff' },
  badgeNewText:   { color: '#fff' },

  // Icon circle
  iconCircle: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  // card-name: Playfair Display 800
  cardName: {
    fontFamily: 'NotoSerif_700Bold',
    fontWeight: '800',
    color: '#011f4b',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  // card-desc: DM Sans 400
  cardDesc: {
    fontFamily: 'GoogleSans_400Regular',
    color: 'rgba(3,57,108,0.70)',
    lineHeight: 18,
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // Arrow
  arrowBtn: {
    marginTop: 4, width: 34, height: 34, borderRadius: 17,
    borderWidth: 1, borderColor: 'rgba(1,31,75,0.20)',
    justifyContent: 'center', alignItems: 'center',
  },
  arrowText: { color: 'rgba(1,31,75,0.6)', fontSize: 15, fontWeight: '600' },

  accentLine: {
    position: 'absolute', bottom: 0,
    width: '64%', height: 2, borderRadius: 2,
  },

  // tagline
  tagline: { alignItems: 'center', gap: 4 },
  taglineP: {
    fontFamily: 'GoogleSans_400Regular',
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    lineHeight: 26,
    textShadowColor: 'rgba(1,31,75,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  taglineWhite: {
    fontFamily: 'GoogleSans_700Bold',
    color: '#ffffff',
    fontWeight: '600',
  },
  taglineHighlight: {
    fontFamily: 'GoogleSans_700Bold',
    color: '#c9a84c',
    fontWeight: '600',
  },
  taglineGoldLight: {
    fontFamily: 'GoogleSans_400Regular',
    color: 'rgba(232,200,122,0.90)',
  },

  // footer
  footer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 22,
    paddingTop: 14,
  },
  footerBorder: {
    width: '100%', height: 1,
    backgroundColor: 'rgba(1,31,75,0.12)',
    marginBottom: 10,
  },
  footerP: {
    fontFamily: 'GoogleSans_400Regular',
    color: 'rgba(3,57,108,0.55)',
    textAlign: 'center',
  },
});