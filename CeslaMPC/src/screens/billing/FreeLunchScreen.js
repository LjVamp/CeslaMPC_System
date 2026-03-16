// src/screens/billing/FreeLunchScreen.js
// CESLA MPC — Free Lunch billing screen
// Shows per-date summary → drill-down per department

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  FlatList, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBilling, DEPARTMENTS, MONTHS, fmt, fmtDate } from '../../context/BillingContext';
import EntryModal from '../../components/EntryModal';

export default function FreeLunchScreen({ year, month }) {
  const { entries, getUniqueDates, getEntriesByDate, toggleStatus, deleteEntry, fmt: fmtCtx } = useBilling();

  const [detailDate,   setDetailDate]   = useState(null); // null = main, string = detail
  const [modalVisible, setModalVisible] = useState(false);
  const [editEntry,    setEditEntry]    = useState(null);
  const [presetDept,   setPresetDept]   = useState(null);

  // All unique dates for this month
  const dates = useMemo(() => getUniqueDates('freelunch', year, month), [entries, year, month]);

  // Summarize per date (sum all depts)
  const dateSummaries = useMemo(() => dates.map((date, idx) => {
    const dayEntries = getEntriesByDate('freelunch', year, month, date);
    const totalPax   = dayEntries.reduce((s, e) => s + (parseFloat(e.pax) || 0), 0);
    const totalAmt   = dayEntries.reduce((s, e) => s + (e.amount || 0), 0);
    const amtPerPax  = dayEntries.length > 0 ? (dayEntries[0].amtPerPax || 0) : 0;
    const status     = dayEntries.length > 0 ? (dayEntries[0].status || 'pending') : 'pending';
    const mm         = String(month + 1).padStart(2, '0');
    const billingNo  = `FL ${year}-${mm}-${String(idx + 1).padStart(2, '0')}`;
    return { date, totalPax, totalAmt, amtPerPax, status, billingNo, id: dayEntries[0]?.id };
  }), [dates, entries]);

  const grandTotal = dateSummaries.reduce((s, d) => s + d.totalAmt, 0);

  // Detail view entries
  const detailEntries = useMemo(() => {
    if (!detailDate) return [];
    return getEntriesByDate('freelunch', year, month, detailDate);
  }, [detailDate, entries, year, month]);

  const detailTotal = detailEntries.reduce((s, e) => s + (e.amount || 0), 0);

  const openAdd = (dept = null) => {
    setEditEntry(null);
    setPresetDept(dept);
    setModalVisible(true);
  };

  const openEdit = (entry) => {
    setEditEntry(entry);
    setPresetDept(null);
    setModalVisible(true);
  };

  const handleToggleStatus = async (entry) => {
    try { await toggleStatus(entry.id, entry.status); }
    catch (e) { Alert.alert('Error', e.message); }
  };

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  if (detailDate) {
    return (
      <View style={{ flex: 1 }}>
        <View style={ss.detailHeader}>
          <TouchableOpacity style={ss.backBtn} onPress={() => setDetailDate(null)}>
            <MaterialIcons name="arrow-back" size={16} color="#1a3a6b" />
            <Text style={ss.backBtnTxt}>Back</Text>
          </TouchableOpacity>
          <Text style={ss.detailTitle} numberOfLines={1}>
            {fmtDate(detailDate)} — {MONTHS[month]} {year}
          </Text>
          <TouchableOpacity style={ss.addBtn} onPress={() => openAdd()}>
            <MaterialIcons name="add" size={14} color="#fff" />
            <Text style={ss.addBtnTxt}>Add</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={detailEntries}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 10, gap: 6, paddingBottom: 20 }}
          ListEmptyComponent={<Text style={ss.emptyTxt}>No entries yet.</Text>}
          renderItem={({ item }) => (
            <View style={ss.detailCard}>
              <View style={{ flex: 1 }}>
                <Text style={ss.detailDept}>{item.dept}</Text>
                <Text style={ss.detailSub}>
                  {item.pax} pax × {fmt(item.amtPerPax)}
                </Text>
              </View>
              <Text style={ss.detailAmt}>{fmt(item.amount)}</Text>
              <TouchableOpacity style={ss.editBtn} onPress={() => openEdit(item)}>
                <MaterialIcons name="edit" size={14} color="#1a3a6b" />
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={
            <View style={ss.totalBar}>
              <Text style={ss.totalLbl}>GRAND TOTAL</Text>
              <Text style={ss.totalVal}>{fmt(detailTotal)}</Text>
            </View>
          }
        />

        <EntryModal
          visible={modalVisible}
          category="freelunch"
          editEntry={editEntry}
          presetDept={presetDept}
          presetDate={detailDate}
          year={year} month={month}
          onClose={() => setModalVisible(false)}
        />
      </View>
    );
  }

  // ── MAIN VIEW (date summary) ───────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <View style={ss.toolbar}>
        <TouchableOpacity style={ss.addBtnMain} onPress={() => openAdd()}>
          <MaterialIcons name="add" size={15} color="#fff" />
          <Text style={ss.addBtnTxt}>Add Entry</Text>
        </TouchableOpacity>
      </View>

      {/* Table Header */}
      <View style={ss.thead}>
        <Text style={[ss.th, { flex: 1.2 }]}>DATE</Text>
        <Text style={[ss.th, { flex: 1.5 }]}>BILLING NO.</Text>
        <Text style={[ss.th, { flex: 0.8, textAlign: 'center' }]}>PAX</Text>
        <Text style={[ss.th, { flex: 1, textAlign: 'center' }]}>/PAX</Text>
        <Text style={[ss.th, { flex: 1, textAlign: 'right' }]}>AMOUNT</Text>
        <Text style={[ss.th, { flex: 0.9, textAlign: 'center' }]}>STATUS</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {dateSummaries.length === 0 ? (
          <Text style={ss.emptyTxt}>No entries yet for {MONTHS[month]} {year}.</Text>
        ) : (
          dateSummaries.map((d, i) => (
            <TouchableOpacity key={d.date}
              style={[ss.trow, i % 2 === 0 && ss.trowAlt]}
              onPress={() => setDetailDate(d.date)}
              activeOpacity={0.75}>
              <Text style={[ss.td, { flex: 1.2 }]}>{fmtDate(d.date)}</Text>
              <Text style={[ss.td, { flex: 1.5, fontFamily: 'GoogleSans_700Bold', color: '#1a3a6b', fontSize: 10 }]}>
                {d.billingNo}
              </Text>
              <Text style={[ss.td, { flex: 0.8, textAlign: 'center' }]}>{d.totalPax}</Text>
              <Text style={[ss.td, { flex: 1, textAlign: 'center' }]}>{fmt(d.amtPerPax)}</Text>
              <Text style={[ss.td, { flex: 1, textAlign: 'right', fontFamily: 'GoogleSans_700Bold', color: '#1a3a6b' }]}>
                {fmt(d.totalAmt)}
              </Text>
              <View style={{ flex: 0.9, alignItems: 'center' }}>
                <TouchableOpacity
                  style={[ss.statusBadge, d.status === 'paid' ? ss.statusPaid : ss.statusPending]}
                  onPress={() => handleToggleStatus({ id: d.id, status: d.status })}
                  onLongPress={() => setDetailDate(d.date)}>
                  <Text style={[ss.statusTxt, { color: d.status === 'paid' ? '#1a6e2e' : '#b36200' }]}>
                    {d.status === 'paid' ? '✔ Paid' : '⏳ Pend'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Grand Total */}
        <View style={ss.totalBar}>
          <Text style={ss.totalLbl}>GRAND TOTAL</Text>
          <Text style={ss.totalVal}>{fmt(grandTotal)}</Text>
        </View>
      </ScrollView>

      <EntryModal
        visible={modalVisible}
        category="freelunch"
        editEntry={editEntry}
        presetDept={presetDept}
        year={year} month={month}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const ss = StyleSheet.create({
  toolbar: {
    flexDirection: 'row', padding: 10, paddingBottom: 6,
    borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.10)',
  },
  addBtnMain: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#27ae60', borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 14,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1a3a6b', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  addBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#fff' },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(26,58,107,0.10)', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: 'rgba(26,58,107,0.20)',
  },
  backBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#1a3a6b' },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.10)',
  },
  detailTitle: {
    flex: 1, fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#1a3a6b',
  },

  // Table
  thead: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(26,58,107,0.14)',
    paddingVertical: 8, paddingHorizontal: 10,
  },
  th: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 8,
    color: 'rgba(26,58,107,0.60)', letterSpacing: 0.8, textTransform: 'uppercase',
  },
  trow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10,
    borderBottomWidth: 1, borderColor: 'rgba(26,58,107,0.07)',
  },
  trowAlt: { backgroundColor: 'rgba(255,255,255,0.35)' },
  td: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: '#1a2d4e' },

  // Status badges
  statusBadge: {
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3,
    alignItems: 'center', minWidth: 55,
  },
  statusPaid:    { backgroundColor: '#d4f5e2', borderWidth: 1.5, borderColor: '#1a6e2e' },
  statusPending: { backgroundColor: '#fff4e0', borderWidth: 1.5, borderColor: '#e0a800' },
  statusTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 8, letterSpacing: 0.3 },

  // Detail card
  detailCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)',
    gap: 8,
  },
  detailDept: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#1a3a6b' },
  detailSub:  { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.55)', marginTop: 2 },
  detailAmt:  { fontFamily: 'NotoSerif_700Bold', fontSize: 14, color: '#c9a84c' },
  editBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(26,58,107,0.10)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(26,58,107,0.20)',
  },

  totalBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1a6e2e', borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 16,
    margin: 10,
  },
  totalLbl: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#fff', letterSpacing: 0.5 },
  totalVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: '#fff' },
  emptyTxt: {
    fontFamily: 'GoogleSans_400Regular', fontSize: 12,
    color: 'rgba(1,31,75,0.40)', textAlign: 'center',
    padding: 20,
  },
});