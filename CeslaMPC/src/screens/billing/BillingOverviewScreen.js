// src/screens/billing/BillingOverviewScreen.js
// CESLA MPC — Billing Overview: yearly summary of all categories

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList,
} from 'react-native';
import { useBilling, CATEGORIES, MONTHS, fmt } from '../../context/BillingContext';

const YEARS = Array.from({ length: 30 }, (_, i) => 2025 + i);

export default function BillingOverviewScreen({ year, onYearChange }) {
  const { getYearTotal } = useBilling();
  const [showYearPicker, setShowYearPicker] = useState(false);

  const totals = {};
  CATEGORIES.forEach(c => {
    totals[c.key] = getYearTotal(c.key, year);
  });
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}>
      {/* Year picker */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={ov.heading}>Summary of Year</Text>
        <TouchableOpacity style={ov.yearBtn} onPress={() => setShowYearPicker(true)}>
          <Text style={ov.yearBtnTxt}>{year}  ▼</Text>
        </TouchableOpacity>
      </View>

      {/* Category rows */}
      <View style={ov.card}>
        {CATEGORIES.map((cat, i) => (
          <View key={cat.key} style={[ov.row, i < CATEGORIES.length - 1 && ov.rowBorder]}>
            <Text style={ov.catIcon}>{cat.icon}</Text>
            <Text style={ov.catLabel}>{cat.label}</Text>
            <Text style={ov.catVal}>{fmt(totals[cat.key])}</Text>
          </View>
        ))}
        <View style={ov.grandRow}>
          <Text style={ov.grandLabel}>GRAND TOTAL — ALL BILLINGS</Text>
          <Text style={ov.grandVal}>{fmt(grand)}</Text>
        </View>
      </View>

      {/* Year Picker Modal */}
      <Modal visible={showYearPicker} transparent animationType="fade"
        onRequestClose={() => setShowYearPicker(false)}>
        <View style={ov.pickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject}
            onPress={() => setShowYearPicker(false)} activeOpacity={1} />
          <View style={ov.pickerCard}>
            <Text style={ov.pickerTitle}>Select Year</Text>
            <FlatList
              data={YEARS}
              keyExtractor={y => String(y)}
              style={{ maxHeight: 300 }}
              renderItem={({ item: y }) => (
                <TouchableOpacity style={[ov.pickerOpt, y === year && ov.pickerOptActive]}
                  onPress={() => { onYearChange(y); setShowYearPicker(false); }}>
                  <Text style={[ov.pickerOptTxt, y === year && ov.pickerOptTxtActive]}>{y}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const ov = StyleSheet.create({
  // Year picker row
  heading: {
    fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: '#1a3a6b',
    textShadowColor: 'rgba(255,255,255,0.60)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  yearBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(26,58,107,0.18)', borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(26,58,107,0.25)',
  },
  yearBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 16, color: '#1a3a6b' },

  // Category card — glassmorphism
  card: {
    backgroundColor: 'rgba(255,255,255,0.30)', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.70)',
    shadowColor: '#011f4b', shadowOpacity: 0.10, shadowRadius: 12, elevation: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 20, gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  catIcon: { fontSize: 20, width: 30 },
  catLabel: {
    flex: 1, fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#0d2540',
    textShadowColor: 'rgba(255,255,255,0.50)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  catVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 14, color: '#1a3a6b' },

  // Grand total row
  grandRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(26,58,107,0.88)', paddingVertical: 16, paddingHorizontal: 20,
  },
  grandLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.90)', letterSpacing: 0.5 },
  grandVal:   { fontFamily: 'NotoSerif_700Bold', fontSize: 18, color: '#c9a84c' },

  // Year picker modal
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(1,20,50,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  pickerCard: {
    backgroundColor: 'rgba(240,247,252,0.98)', borderRadius: 16, padding: 16,
    width: '100%', maxWidth: 280,
    borderWidth: 1, borderColor: 'rgba(26,58,107,0.15)',
    shadowColor: '#000', shadowOpacity: 0.20, shadowRadius: 16, elevation: 12,
  },
  pickerTitle: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#1a3a6b',
    textAlign: 'center', marginBottom: 10,
  },
  pickerOpt:         { paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  pickerOptActive:   { backgroundColor: 'rgba(26,58,107,0.10)', borderRadius: 8 },
  pickerOptTxt:      { fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: '#1a3a6b' },
  pickerOptTxtActive:{ fontFamily: 'GoogleSans_700Bold', color: '#1a3a6b' },
});