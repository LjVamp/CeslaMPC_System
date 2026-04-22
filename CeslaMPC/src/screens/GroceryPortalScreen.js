// src/screens/GroceryPortalScreen.js
// CESLA MPC — Grocery Portal Screen
// Entry point: choose Member (login) or Visitor (walk-in)

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, useWindowDimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

export default function GroceryPortalScreen({ navigation }) {
  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, NotoSerif_700Bold_Italic,
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const { width } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const hdrFade  = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-18)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardTrans = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue:1, duration:600, useNativeDriver:true }),
      Animated.timing(hdrTrans, { toValue:0, duration:600, useNativeDriver:true }),
    ]).start();
    Animated.parallel([
      Animated.timing(cardFade,  { toValue:1, duration:600, delay:200, useNativeDriver:true }),
      Animated.timing(cardTrans, { toValue:0, duration:600, delay:200, useNativeDriver:true }),
    ]).start();
  }, []);

  // ── Portal card component ─────────────────────────────────────────────────
  const PortalCard = ({ icon, title, subtitle, description, onPress, accentColors, delay }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const cardEntryFade  = useRef(new Animated.Value(0)).current;
    const cardEntryTrans = useRef(new Animated.Value(40)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(cardEntryFade,  { toValue:1, duration:650, delay, useNativeDriver:true }),
        Animated.spring(cardEntryTrans, { toValue:0, tension:60, friction:10, delay, useNativeDriver:true }),
      ]).start();
    }, []);

    return (
      <Animated.View style={[
        { flex:1, opacity: cardEntryFade, transform:[{translateY: cardEntryTrans},{scale: scaleAnim}] },
      ]}>
        <TouchableOpacity
          style={{ flex:1, borderRadius:22, overflow:'hidden' }}
          onPress={onPress}
          activeOpacity={0.90}
          onPressIn={() => Animated.spring(scaleAnim, { toValue:0.97, useNativeDriver:true }).start()}
          onPressOut={() => Animated.spring(scaleAnim, { toValue:1, friction:4, useNativeDriver:true }).start()}
        >
          <LinearGradient
            colors={accentColors}
            start={{x:0,y:0}} end={{x:1,y:1}}
            style={[portalStyles.card, isWide && portalStyles.cardWide]}
          >
            {/* Icon circle */}
            <View style={[portalStyles.iconCircle, isWide && {width:90, height:90, borderRadius:45}]}>
              <Text style={[portalStyles.iconText, isWide && {fontSize:38}]}>{icon}</Text>
            </View>

            {/* Text */}
            <View style={{ alignItems:'center', gap:5, flex:1 }}>
              <Text style={[portalStyles.cardTitle, isWide && {fontSize:20}]}>{title}</Text>
              <View style={portalStyles.subtitleBadge}>
                <Text style={portalStyles.subtitleText}>{subtitle}</Text>
              </View>
              <Text style={[portalStyles.cardDesc, isWide && {fontSize:13}]}>{description}</Text>
            </View>

            {/* Arrow */}
            <View style={portalStyles.arrowCircle}>
              <Text style={portalStyles.arrowText}>→</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Background ── */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor:'#98bad5' }]} />
      <LinearGradient colors={['rgba(198,220,235,0.85)','rgba(152,186,213,0.40)','rgba(80,110,150,0.0)']}
        locations={[0,0.45,1]} start={{x:0.5,y:0.1}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(50,80,120,0.45)','rgba(50,80,120,0.0)','rgba(50,80,120,0.45)']}
        locations={[0,0.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(50,80,120,0.0)','rgba(60,90,130,0.35)']}
        locations={[0.4,1]} start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject} />

      {/* ── Header ── */}
      <Animated.View style={[styles.header, {
        marginTop: Platform.OS==='web' ? 16 : 36,
        marginHorizontal: isSmall ? 8 : 10,
        opacity: hdrFade, transform:[{translateY: hdrTrans}],
      }]}>
        <View style={[styles.headerInner, { paddingHorizontal: isWide ? 40 : 12, paddingVertical: isWide ? 16 : 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1, { fontSize: isWide ? 22 : isSmall ? 14 : 16 }]} numberOfLines={1}>
              <Text style={styles.headerGold}>CESLA </Text>
              Grocery Ordering System
            </Text>
            <View style={styles.visitorTag}>
              <Text style={styles.visitorTagText}>GROCERY PORTAL</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </Animated.View>

      {/* ── Body ── */}
      <Animated.View style={[styles.body, {
        opacity: cardFade, transform:[{translateY: cardTrans}],
        paddingHorizontal: isWide ? 60 : 20,
      }]}>

        {/* Welcome block */}
        <View style={styles.welcomeBlock}>
          <Text style={[styles.welcomeTitle, { fontSize: isWide ? 28 : 22 }]}>🛒 Welcome!</Text>
          <Text style={[styles.welcomeSub, { fontSize: isWide ? 15 : 13 }]}>
            How would you like to place your grocery order?
          </Text>
        </View>

        {/* Cards */}
        <View style={[styles.cardsRow, isWide ? { flexDirection:'row', gap:20 } : { flexDirection:'column', gap:14 }]}>
          <PortalCard
            icon="🚶"
            title="Walk-in / Visitor"
            subtitle="NO LOGIN REQUIRED"
            description="Browse and order grocery items as a walk-in customer. Quick and easy — no account needed."
            accentColors={['rgba(26,58,107,0.90)', 'rgba(44,82,130,0.85)']}
            delay={300}
            onPress={() => navigation?.navigate('GroceryVisitorScreen')}
          />
          <PortalCard
            icon="👤"
            title="CESLA Member"
            subtitle="MEMBER LOGIN"
            description="Login with your CESLA member credentials to access credit orders, order history, and exclusive benefits."
            accentColors={['rgba(201,168,76,0.90)', 'rgba(220,185,90,0.85)']}
            delay={450}
            onPress={() => navigation?.navigate('GroceryMemberScreen')}
          />
        </View>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          CESLA Multi-Purpose Cooperative  •  Grocery Ordering System
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Portal Card Styles ────────────────────────────────────────────────────────
const portalStyles = StyleSheet.create({
  card: {
    flex:1, alignItems:'center', justifyContent:'center',
    gap:14, padding:28, borderRadius:22,
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.40)',
    minHeight:200,
    shadowColor:'#001f4b', shadowOpacity:0.22,
    shadowRadius:20, shadowOffset:{width:0,height:6}, elevation:8,
  },
  cardWide: { minHeight:260, padding:36, gap:18 },
  iconCircle: {
    width:70, height:70, borderRadius:35,
    backgroundColor:'rgba(255,255,255,0.22)',
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.50)',
    justifyContent:'center', alignItems:'center',
  },
  iconText: { fontSize:30 },
  cardTitle: {
    fontFamily:'NotoSerif_700Bold', fontSize:17,
    color:'#fff', textAlign:'center', letterSpacing:0.3,
  },
  subtitleBadge: {
    paddingHorizontal:12, paddingVertical:4,
    borderRadius:20, backgroundColor:'rgba(255,255,255,0.20)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.40)',
  },
  subtitleText: {
    fontFamily:'GoogleSans_700Bold', fontSize:9,
    color:'rgba(255,255,255,0.90)', letterSpacing:1.8, textTransform:'uppercase',
  },
  cardDesc: {
    fontFamily:'GoogleSans_400Regular', fontSize:12,
    color:'rgba(255,255,255,0.80)', textAlign:'center', lineHeight:18,
    paddingHorizontal:8,
  },
  arrowCircle: {
    width:36, height:36, borderRadius:18,
    backgroundColor:'rgba(255,255,255,0.20)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.40)',
    justifyContent:'center', alignItems:'center',
  },
  arrowText: {
    fontFamily:'GoogleSans_700Bold', fontSize:16, color:'#fff',
  },
});

// ── Main Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex:1 },

  header: { zIndex:10 },
  headerInner: {
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    backgroundColor:'#304674', borderRadius:14,
    borderBottomWidth:1, borderColor:'rgba(201,168,76,0.25)',
    shadowColor:'#011f4b', shadowOpacity:0.20, shadowRadius:20,
    shadowOffset:{width:0,height:4}, elevation:8,
  },
  backBtn: {
    width:40, height:40, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.15)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.30)',
    justifyContent:'center', alignItems:'center',
  },
  backIcon: { color:'#fff', fontSize:16, fontWeight:'600', lineHeight:20 },
  headerCenter: { flex:1, alignItems:'center', paddingHorizontal:10 },
  headerH1: {
    fontFamily:'NotoSerif_700Bold', color:'#ffffff',
    textAlign:'center', letterSpacing:0.3,
  },
  headerGold: { fontFamily:'NotoSerif_700Bold_Italic', color:'#c9a84c', fontStyle:'italic' },
  visitorTag: {
    marginTop:2, paddingHorizontal:10, paddingVertical:3,
    borderRadius:20, backgroundColor:'rgba(255,255,255,0.18)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.50)',
    alignSelf:'center',
  },
  visitorTagText: {
    fontFamily:'GoogleSans_700Bold', fontSize:9,
    color:'#ffffff', letterSpacing:1.5, textTransform:'uppercase',
    lineHeight:13, includeFontPadding:false,
  },

  body: {
    flex:1, justifyContent:'center', paddingVertical:20,
    gap:0,
  },
  welcomeBlock: { alignItems:'center', marginBottom:24, gap:8 },
  welcomeTitle: {
    fontFamily:'NotoSerif_700Bold', color:'#011f4b',
    textAlign:'center',
  },
  welcomeSub: {
    fontFamily:'GoogleSans_400Regular', color:'rgba(255,255,255,0.88)',
    textAlign:'center', lineHeight:20,
  },

  cardsRow: { flex:1, maxHeight: Platform.OS==='web' ? 360 : undefined },

  footerNote: {
    fontFamily:'GoogleSans_400Regular', fontSize:11,
    color:'rgba(235,239,242,0.50)', textAlign:'center',
    marginTop:20, letterSpacing:0.5,
  },
});
