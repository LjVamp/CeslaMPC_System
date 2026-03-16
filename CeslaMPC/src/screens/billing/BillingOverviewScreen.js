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
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}>
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
  heading: { fontFamily: 'GoogleSans_700Bold', fontSize: 16, color: '#1a3a6b' },
  yearBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(26,58,107,0.10)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(26,58,107,0.20)',
  },
  yearBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 16, color: '#1a3a6b' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 20, gap: 10,
  },
  rowBorder: { borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.07)' },
  catIcon: { fontSize: 18, width: 28 },
  catLabel: { flex: 1, fontFamily: 'GoogleSans_500Medium', fontSize: 14, color: '#1a2d4e' },
  catVal:   { fontFamily: 'NotoSerif_700Bold', fontSize: 14, color: '#2980b9' },
  grandRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1a6e2e', paddingVertical: 16, paddingHorizontal: 20,
  },
  grandLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#fff', letterSpacing: 0.3 },
  grandVal:   { fontFamily: 'NotoSerif_700Bold', fontSize: 17, color: '#fff' },
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(1,20,50,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  pickerCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, width: '100%', maxWidth: 280,
  },
  pickerTitle: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#1a3a6b',
    textAlign: 'center', marginBottom: 10,
  },
  pickerOpt:        { paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  pickerOptActive:  { backgroundColor: 'rgba(26,58,107,0.08)' },
  pickerOptTxt:     { fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: '#1a3a6b' },
  pickerOptTxtActive:{ fontFamily: 'GoogleSans_700Bold', color: '#1a3a6b' },
});
