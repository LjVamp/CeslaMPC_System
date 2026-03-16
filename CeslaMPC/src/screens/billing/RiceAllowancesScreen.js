// src/screens/billing/RiceAllowancesScreen.js
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBilling, DEPARTMENTS, fmt, fmtDate } from '../../context/BillingContext';
import EntryModal from '../../components/EntryModal';

export default function RiceAllowancesScreen({ year, month }) {
  const { entries } = useBilling();
  const [modalVisible, setModalVisible] = useState(false);
  const [editEntry, setEditEntry] = useState(null);

  const catEntries = useMemo(() =>
    entries.filter(e => e.category === 'riceallowances' && e.year === year && e.month === month),
    [entries, year, month]
  );

  const grandTotal = catEntries.reduce((s, e) => s + (e.amount || 0), 0);

  const grouped = useMemo(() => {
    const map = {};
    DEPARTMENTS.forEach(d => { map[d] = []; });
    catEntries.forEach(e => { if (map[e.dept]) map[e.dept].push(e); });
    return map;
  }, [catEntries]);

  return (
    <View style={{ flex: 1 }}>
      <View style={rs.toolbar}>
        <TouchableOpacity style={rs.addBtn} onPress={() => { setEditEntry(null); setModalVisible(true); }}>
          <MaterialIcons name="add" size={15} color="#fff" />
          <Text style={rs.addBtnTxt}>Add Entry</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 10, gap: 8, paddingBottom: 20 }}>
        {DEPARTMENTS.map(dept => {
          const deptEntries = grouped[dept] || [];
          const deptTotal = deptEntries.reduce((s, e) => s + (e.amount || 0), 0);
          return (
            <View key={dept} style={rs.deptCard}>
              <View style={rs.deptHeader}>
                <Text style={rs.deptName}>{dept}</Text>
                <Text style={rs.deptTotal}>{fmt(deptTotal)}</Text>
              </View>
              {deptEntries.length === 0 ? (
                <Text style={rs.emptyTxt}>No entries</Text>
              ) : (
                deptEntries.map((e, i) => (
                  <TouchableOpacity key={e.id}
                    style={[rs.entryRow, i % 2 === 0 && rs.entryRowAlt]}
                    onPress={() => { setEditEntry(e); setModalVisible(true); }}>
                    <View style={{ flex: 1 }}>
                      <Text style={rs.entryName}>{e.name}</Text>
                      <Text style={rs.entrySub}>{fmtDate(e.date)} · {e.sacks} sac × {fmt(e.priceSac)}</Text>
                    </View>
                    <Text style={rs.entryAmt}>{fmt(e.amount)}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          );
        })}
        <View style={rs.totalBar}>
          <Text style={rs.totalLbl}>GRAND TOTAL</Text>
          <Text style={rs.totalVal}>{fmt(grandTotal)}</Text>
        </View>
      </ScrollView>
      <EntryModal visible={modalVisible} category="riceallowances"
        editEntry={editEntry} year={year} month={month}
        onClose={() => setModalVisible(false)} />
    </View>
  );
}

const rs = StyleSheet.create({
  toolbar: { flexDirection: 'row', padding: 10, paddingBottom: 6, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.10)' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#27ae60', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  addBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#fff' },
  deptCard: { backgroundColor: 'rgba(255,255,255,0.70)', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)' },
  deptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#304674', paddingVertical: 9, paddingHorizontal: 14 },
  deptName: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#fff', letterSpacing: 1 },
  deptTotal: { fontFamily: 'NotoSerif_700Bold', fontSize: 13, color: '#c9a84c' },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.06)', gap: 8 },
  entryRowAlt: { backgroundColor: 'rgba(26,58,107,0.04)' },
  entryName: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#1a2d4e' },
  entrySub: { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(1,31,75,0.50)', marginTop: 1 },
  entryAmt: { fontFamily: 'NotoSerif_700Bold', fontSize: 13, color: '#c9a84c' },
  emptyTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.35)', textAlign: 'center', padding: 10 },
  totalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a6e2e', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, marginTop: 4 },
  totalLbl: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#fff', letterSpacing: 0.5 },
  totalVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: '#fff' },
});