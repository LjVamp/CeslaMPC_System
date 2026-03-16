// src/screens/billing/WaterBillingScreen.js
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBilling, DEPARTMENTS, MONTHS, fmt, fmtDate } from '../../context/BillingContext';
import EntryModal from '../../components/EntryModal';

export default function WaterBillingScreen({ year, month }) {
  const { entries, getUniqueDates, getEntriesByDate, toggleStatus } = useBilling();
  const [detailDate, setDetailDate] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editEntry, setEditEntry] = useState(null);

  const dates = useMemo(() => getUniqueDates('waterbilling', year, month), [entries, year, month]);

  const dateSummaries = useMemo(() => dates.map((date, idx) => {
    const dayEntries   = getEntriesByDate('waterbilling', year, month, date);
    const totalGallons = dayEntries.reduce((s, e) => s + (parseFloat(e.gallons) || 0), 0);
    const totalAmt     = dayEntries.reduce((s, e) => s + (e.amount || 0), 0);
    const priceGallon  = dayEntries.length > 0 ? (dayEntries[0].priceGallon || 0) : 0;
    const status       = dayEntries.length > 0 ? (dayEntries[0].status || 'pending') : 'pending';
    const mm           = String(month + 1).padStart(2, '0');
    const billingNo    = `WB ${year}-${mm}-${String(idx + 1).padStart(2, '0')}`;
    return { date, totalGallons, totalAmt, priceGallon, status, billingNo, id: dayEntries[0]?.id };
  }), [dates, entries]);

  const grandTotal    = dateSummaries.reduce((s, d) => s + d.totalAmt, 0);
  const detailEntries = useMemo(() =>
    detailDate ? getEntriesByDate('waterbilling', year, month, detailDate) : [],
    [detailDate, entries, year, month]
  );
  const detailTotal = detailEntries.reduce((s, e) => s + (e.amount || 0), 0);

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (detailDate) return (
    <View style={{ flex: 1 }}>
      <View style={ws.detailHeader}>
        <TouchableOpacity style={ws.backBtn} onPress={() => setDetailDate(null)}>
          <MaterialIcons name="arrow-back" size={16} color="#1a3a6b" />
          <Text style={ws.backBtnTxt}>Back</Text>
        </TouchableOpacity>
        <Text style={ws.detailTitle} numberOfLines={1}>
          {fmtDate(detailDate)} — {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity style={ws.addBtnSm}
          onPress={() => { setEditEntry(null); setModalVisible(true); }}>
          <MaterialIcons name="add" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={detailEntries}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 10, gap: 6, paddingBottom: 20 }}
        ListEmptyComponent={<Text style={ws.emptyTxt}>No entries yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={ws.detailCard}
            onPress={() => { setEditEntry(item); setModalVisible(true); }}>
            <View style={{ flex: 1 }}>
              <Text style={ws.detailDept}>{item.dept}</Text>
              <Text style={ws.detailSub}>{item.gallons} gal × {fmt(item.priceGallon)}</Text>
            </View>
            <Text style={ws.detailAmt}>{fmt(item.amount)}</Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <View style={ws.totalBar}>
            <Text style={ws.totalLbl}>GRAND TOTAL</Text>
            <Text style={ws.totalVal}>{fmt(detailTotal)}</Text>
          </View>
        }
      />
      <EntryModal visible={modalVisible} category="waterbilling"
        editEntry={editEntry} presetDate={detailDate}
        year={year} month={month} onClose={() => setModalVisible(false)} />
    </View>
  );

  // ── MAIN VIEW ──────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <View style={ws.toolbar}>
        <TouchableOpacity style={ws.addBtn}
          onPress={() => { setEditEntry(null); setModalVisible(true); }}>
          <MaterialIcons name="add" size={15} color="#fff" />
          <Text style={ws.addBtnTxt}>Add Entry</Text>
        </TouchableOpacity>
      </View>

      <View style={ws.thead}>
        <Text style={[ws.th, { flex: 1.2 }]}>DATE</Text>
        <Text style={[ws.th, { flex: 1.5 }]}>BILLING NO.</Text>
        <Text style={[ws.th, { flex: 0.9, textAlign: 'center' }]}>GALLONS</Text>
        <Text style={[ws.th, { flex: 1, textAlign: 'center' }]}>PRICE/GAL</Text>
        <Text style={[ws.th, { flex: 1, textAlign: 'right' }]}>AMOUNT</Text>
        <Text style={[ws.th, { flex: 0.9, textAlign: 'center' }]}>STATUS</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {dateSummaries.length === 0
          ? <Text style={ws.emptyTxt}>No entries yet for {MONTHS[month]} {year}.</Text>
          : dateSummaries.map((d, i) => (
            <TouchableOpacity key={d.date}
              style={[ws.trow, i % 2 === 0 && ws.trowAlt]}
              onPress={() => setDetailDate(d.date)}
              activeOpacity={0.75}>
              <Text style={[ws.td, { flex: 1.2 }]}>{fmtDate(d.date)}</Text>
              <Text style={[ws.td, { flex: 1.5, fontFamily: 'GoogleSans_700Bold', color: '#1a3a6b', fontSize: 10 }]}>
                {d.billingNo}
              </Text>
              <Text style={[ws.td, { flex: 0.9, textAlign: 'center' }]}>{d.totalGallons}</Text>
              <Text style={[ws.td, { flex: 1, textAlign: 'center' }]}>{fmt(d.priceGallon)}</Text>
              <Text style={[ws.td, { flex: 1, textAlign: 'right', fontFamily: 'GoogleSans_700Bold', color: '#1a3a6b' }]}>
                {fmt(d.totalAmt)}
              </Text>
              <View style={{ flex: 0.9, alignItems: 'center' }}>
                <TouchableOpacity
                  style={[ws.statusBadge, d.status === 'paid' ? ws.statusPaid : ws.statusPending]}
                  onPress={() => toggleStatus(d.id, d.status)}>
                  <Text style={[ws.statusTxt, { color: d.status === 'paid' ? '#1a6e2e' : '#b36200' }]}>
                    {d.status === 'paid' ? '✔ Paid' : '⏳ Pend'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        }
        <View style={ws.totalBar}>
          <Text style={ws.totalLbl}>GRAND TOTAL</Text>
          <Text style={ws.totalVal}>{fmt(grandTotal)}</Text>
        </View>
      </ScrollView>

      <EntryModal visible={modalVisible} category="waterbilling"
        editEntry={editEntry} year={year} month={month}
        onClose={() => setModalVisible(false)} />
    </View>
  );
}

const ws = StyleSheet.create({
  toolbar: { flexDirection: 'row', padding: 10, paddingBottom: 6, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.10)' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2980b9', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  addBtnSm: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1a3a6b', justifyContent: 'center', alignItems: 'center' },
  addBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#fff' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(26,58,107,0.10)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(26,58,107,0.20)' },
  backBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#1a3a6b' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.10)' },
  detailTitle: { flex: 1, fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#1a3a6b' },
  thead: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(26,58,107,0.14)', paddingVertical: 8, paddingHorizontal: 10 },
  th: { fontFamily: 'GoogleSans_700Bold', fontSize: 8, color: 'rgba(26,58,107,0.60)', letterSpacing: 0.8, textTransform: 'uppercase' },
  trow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderColor: 'rgba(26,58,107,0.07)' },
  trowAlt: { backgroundColor: 'rgba(255,255,255,0.35)' },
  td: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: '#1a2d4e' },
  statusBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3, alignItems: 'center', minWidth: 55 },
  statusPaid: { backgroundColor: '#d4f5e2', borderWidth: 1.5, borderColor: '#1a6e2e' },
  statusPending: { backgroundColor: '#fff4e0', borderWidth: 1.5, borderColor: '#e0a800' },
  statusTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 8, letterSpacing: 0.3 },
  detailCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)', gap: 8 },
  detailDept: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#1a3a6b' },
  detailSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.55)', marginTop: 2 },
  detailAmt: { fontFamily: 'NotoSerif_700Bold', fontSize: 14, color: '#c9a84c' },
  totalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a6e2e', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, margin: 10 },
  totalLbl: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#fff', letterSpacing: 0.5 },
  totalVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: '#fff' },
  emptyTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(1,31,75,0.40)', textAlign: 'center', padding: 20 },
});