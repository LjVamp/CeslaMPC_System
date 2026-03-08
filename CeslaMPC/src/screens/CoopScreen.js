// src/screens/CoopScreen.js
// CESLA Multi-Purpose Cooperative — Coop Screen
// Header: exact same as CanteenScreen (back btn left, title center, spacer right)

import React, { useEffect, useRef } from 'react';
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

export default function CoopScreen({ navigation }) {
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

  const hdrFade  = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-16)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;
  const bodyTrans= useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(hdrTrans, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(bodyFade,  { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
      Animated.timing(bodyTrans, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── BACKGROUND — same as all screens ── */}
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

          {/* Back button — left */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation && navigation.goBack()}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          {/* Title — center */}
          <View style={styles.headerCenter}>
            <Text
              style={[styles.headerH1, { fontSize: isWide ? 22 : isSmall ? 15 : 17 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              <Text style={styles.headerGold}>CESLA </Text>
              Multi-Purpose Cooperative
            </Text>
            <Text
              style={[styles.headerSub, { fontSize: isWide ? 11 : 9 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Member Services &amp; Loan Management
            </Text>
          </View>

          {/* Spacer — right (same width as back btn to keep title centered) */}
          <View style={{ width: 40, flexShrink: 0 }} />
        </View>
      </Animated.View>

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <Animated.View style={{
          opacity: bodyFade,
          transform: [{ translateY: bodyTrans }],
          alignItems: 'center',
          paddingTop: 60,
          paddingHorizontal: isWide ? 40 : 20,
        }}>
          <Text style={styles.comingSoon}>🏛️</Text>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
          <Text style={styles.comingSoonSub}>
            The CESLA Multi-Purpose Cooperative module is currently under development.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },

  // ── HEADER: exact same as CanteenScreen ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#304674',
    borderRadius: 14,
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

  // ── PLACEHOLDER CONTENT ──
  comingSoon: {
    fontSize: 64,
    marginBottom: 16,
  },
  comingSoonText: {
    fontFamily: 'NotoSerif_700Bold',
    fontSize: 24,
    color: '#011f4b',
    letterSpacing: 2,
    marginBottom: 12,
  },
  comingSoonSub: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 14,
    color: 'rgba(1,31,75,0.65)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
});