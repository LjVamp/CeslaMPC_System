// src/screens/billing/BillingOverviewScreen.js
// CESLA MPC — Billing Overview — matches HTML .overview-table / .ov-grand

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, FlatList, Platform,
} from 'react-native';
import { useBilling, CATEGORIES } from '../../context/BillingContext';

const C = {
  navyDark:  '#304674',
  navyMid:   '#98bad5',
  textDark:  '#2c5f80',
  grayLight: '#f4f6fb',
  grayMid:   '#e2e6f0',
  grandGreen: '#8eb15c',
};

const YEARS = Array.from({ length: 30 }, (_, i) => 2025 + i);

export default function BillingOverviewScreen({ year, onYearChange }) {
  const { getYearTotal, fmt } = useBilling();
  const [showYearPicker, setShowYearPicker] = useState(false);

  const totals = {};
  CATEGORIES.forEach(c => { totals[c.key] = getYearTotal(c.key, year); });
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.grayLight }}
      contentContainerStyle={ov.container}
    >
      {/* ─── Summary of Year  (matches .overview-header h2 + .year-select) ─ */}
      <View style={ov.yearRow}>
        <Text style={ov.heading}>Summary of Year</Text>
        <TouchableOpacity style={ov.yearBtn} onPress={() => setShowYearPicker(true)}>
          {/* matches .year-select appearance:auto style */}
          <Text style={ov.yearBtnTxt}>{year} ▾</Text>
        </TouchableOpacity>
      </View>

      {/* ─── .overview-table card ─────────────────────────────────────────── */}
      <View style={ov.card}>
        {CATEGORIES.map((cat, i) => (
          <View
            key={cat.key}
            style={[ov.row, i < CATEGORIES.length - 1 && ov.rowBorder]}
          >
            <Text style={ov.catLabel}>{cat.label.toUpperCase()}</Text>
            <Text style={ov.catVal}>{fmt(totals[cat.key])}</Text>
          </View>
        ))}

        {/* .ov-grand  (background #8eb15c, white text) */}
        <View style={ov.grandRow}>
          <Text style={ov.grandLabel}>GRAND TOTAL – ALL BILLINGS</Text>
          <Text style={ov.grandVal}>{fmt(grand)}</Text>
        </View>
      </View>

      {/* ─── Year Picker Modal ────────────────────────────────────────────── */}
      <Modal
        visible={showYearPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <TouchableOpacity
          style={ov.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowYearPicker(false)}
        >
          <TouchableOpacity activeOpacity={1} style={ov.pickerCard}>
            <Text style={ov.pickerTitle}>Select Year</Text>
            <FlatList
              data={YEARS}
              keyExtractor={y => String(y)}
              style={{ maxHeight: 300 }}
              renderItem={({ item: y }) => (
                <TouchableOpacity
                  style={[ov.pickerOpt, y === year && ov.pickerOptActive]}
                  onPress={() => { onYearChange(y); setShowYearPicker(false); }}
                >
                  <Text style={[ov.pickerOptTxt, y === year && ov.pickerOptTxtActive]}>
                    {y}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const ov = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 20,
    alignItems: 'stretch',
  },

  // "Summary of Year 2026 ▾"  — matches .overview-header h2 + .year-select
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },

  heading: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: Platform.OS === 'web' ? 28 : 20,
    fontWeight: '800',
    color: C.navyDark,
  },

  yearBtn: {
    paddingHorizontal: 6,
  },

  yearBtnTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: Platform.OS === 'web' ? 28 : 20,
    fontWeight: '800',
    color: C.navyDark,
  },

  // .overview-table  (white card, shadow, border-radius 14px)
  card: {
    backgroundColor: C.navyMid === '#98bad5' ? '#ffffff' : '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#1a2456',
    shadowOpacity: 0.13,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },

  // .ov-row  (padding 16px 28px, border-bottom)
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },

  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.grayMid,
  },

  // .ov-label  (uppercase, font-weight 700)
  catLabel: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: C.textDark,
    textTransform: 'uppercase',
  },

  // .ov-val  (color --navy, font-weight 700)
  catVal: {
    fontFamily: 'NotoSerif_700Bold',
    fontSize: 15,
    color: C.navyMid,
    fontWeight: '700',
  },

  // .ov-grand  (background #8eb15c, white, border-radius bottom)
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.grandGreen,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },

  grandLabel: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#fff',
    textTransform: 'uppercase',
  },

  grandVal: {
    fontFamily: 'NotoSerif_700Bold',
    fontSize: 18,
    color: '#fff',
    fontWeight: '800',
  },

  // Year picker modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,16,50,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },

  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    maxWidth: 280,
    shadowColor: '#000',
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 12,
  },

  pickerTitle: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 15,
    color: C.navyDark,
    textAlign: 'center',
    marginBottom: 10,
  },

  pickerOpt: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },

  pickerOptActive: {
    backgroundColor: 'rgba(48,70,116,0.10)',
    borderRadius: 8,
  },

  pickerOptTxt: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 15,
    color: C.navyDark,
  },

  pickerOptTxtActive: {
    fontFamily: 'GoogleSans_700Bold',
    color: C.navyDark,
  },
});