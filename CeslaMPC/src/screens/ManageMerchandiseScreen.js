// src/screens/ManageMerchandiseScreen.js
// CESLA MPC — Merchandise Ordering and Inventory System (Empty Placeholder)

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';
import { MaterialIcons } from '@expo/vector-icons';

export default function ManageMerchandiseScreen({ navigation, route }) {
  const admin = route?.params?.admin || {};
  const [fontsLoaded] = useFonts({ NotoSerif_700Bold, GoogleSans_400Regular, GoogleSans_700Bold });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
      <LinearGradient
        colors={['rgba(198,220,235,0.85)','rgba(152,186,213,0.40)','rgba(80,110,150,0.0)']}
        locations={[0,0.45,1]} start={{ x:0.5, y:0.1 }} end={{ x:0.5, y:1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS==='web' ? 16 : 54 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation && navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerH1} numberOfLines={2} adjustsFontSizeToFit>
            <Text style={{ color: '#c9a84c' }}>📦  </Text>
            Merchandise Ordering and Inventory System
          </Text>
        </View>
        <View style={{ width:40 }} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        <MaterialIcons name="construction" size={48} color="rgba(1,31,75,0.25)" />
        <Text style={styles.emptyTitle}>Under Development</Text>
        <Text style={styles.emptySub}>
          This management module is currently being developed.{'\n'}Features will be available in a future update.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#304674', marginHorizontal: 16, borderRadius: 14,
    paddingHorizontal: 16, paddingBottom: 12, marginBottom: 8,
    borderBottomWidth: 1, borderColor: 'rgba(201,168,76,0.25)',
  },
  backBtn: {
    width:40, height:40, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.15)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.30)',
    justifyContent:'center', alignItems:'center',
  },
  backIcon: { color:'#fff', fontSize:17, fontWeight:'600' },
  headerCenter: { flex:1, alignItems:'center', paddingHorizontal:10 },
  headerH1: {
    fontFamily:'NotoSerif_700Bold', fontSize:15,
    color:'#fff', textAlign:'center', lineHeight:22,
  },
  body: {
    flex:1, alignItems:'center', justifyContent:'center',
    paddingHorizontal:30, gap:14,
  },
  emptyTitle: {
    fontFamily:'NotoSerif_700Bold', fontSize:20,
    color:'rgba(1,31,75,0.45)',
  },
  emptySub: {
    fontFamily:'GoogleSans_400Regular', fontSize:13,
    color:'rgba(1,31,75,0.40)', textAlign:'center', lineHeight:20,
  },
});