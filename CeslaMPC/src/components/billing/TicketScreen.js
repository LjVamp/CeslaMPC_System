// src/screens/billing/TicketScreen.js
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBilling, DEPARTMENTS, fmt, fmtDate } from '../../context/BillingContext';
import EntryModal from './EntryModal';

export default function TicketScreen({ year, month }) {
  const { entries } = useBilling();
  const [modalVisible, setModalVisible] = useState(false);
  const [editEntry, setEditEntry] = useState(null);

  const catEntries = useMemo(() =>
    entries.filter(e => e.category === 'ticket' && e.year === year && e.month === month),
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
      <View style={tk.toolbar}>
        <TouchableOpacity style={tk.addBtn}
          onPress={() => { setEditEntry(null); setModalVisible(true); }}>
          <MaterialIcons name="add" size={15} color="#fff" />
          <Text style={tk.addBtnTxt}>Add Entry</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 10, gap: 8, paddingBottom: 20 }}>
        {DEPARTMENTS.map(dept => {
          const deptEntries = grouped[dept] || [];
          const deptTotal   = deptEntries.reduce((s, e) => s + (e.amount || 0), 0);
          return (
            <View key={dept} style={tk.deptCard}>
              <View style={tk.deptHeader}>
                <Text style={tk.deptName}>{dept}</Text>
                <Text style={tk.deptTotal}>{fmt(deptTotal)}</Text>
              </View>
              {deptEntries.length === 0
                ? <Text style={tk.emptyTxt}>No entries</Text>
                : deptEntries.map((e, i) => (
                  <TouchableOpacity key={e.id}
                    style={[tk.entryRow, i % 2 === 0 && tk.entryRowAlt]}
                    onPress={() => { setEditEntry(e); setModalVisible(true); }}>
                    <View style={{ flex: 1 }}>
                      <Text style={tk.entryName}>{e.name}</Text>
                      <Text style={tk.entrySub}>
                        {fmtDate(e.date)} · {e.tickets} tickets × {fmt(e.amtTicket)}
                      </Text>
                    </View>
                    <Text style={tk.entryAmt}>{fmt(e.amount)}</Text>
                  </TouchableOpacity>
                ))
              }
            </View>
          );
        })}
        <View style={tk.totalBar}>
          <Text style={tk.totalLbl}>GRAND TOTAL</Text>
          <Text style={tk.totalVal}>{fmt(grandTotal)}</Text>
        </View>
      </ScrollView>

      <EntryModal visible={modalVisible} category="ticket"
        editEntry={editEntry} year={year} month={month}
        onClose={() => setModalVisible(false)} />
    </View>
  );
}

const tk = StyleSheet.create({
  toolbar: { flexDirection: 'row', padding: 10, paddingBottom: 6, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.10)' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#c0392b', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  addBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#fff' },
  deptCard: { backgroundColor: 'rgba(255,255,255,0.70)', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)' },
  deptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#c0392b', paddingVertical: 9, paddingHorizontal: 14 },
  deptName: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#fff', letterSpacing: 1 },
  deptTotal: { fontFamily: 'NotoSerif_700Bold', fontSize: 13, color: '#fff' },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.06)', gap: 8 },
  entryRowAlt: { backgroundColor: 'rgba(192,57,43,0.04)' },
  entryName: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#1a2d4e' },
  entrySub: { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(1,31,75,0.50)', marginTop: 1 },
  entryAmt: { fontFamily: 'NotoSerif_700Bold', fontSize: 13, color: '#c9a84c' },
  emptyTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.35)', textAlign: 'center', padding: 10 },
  totalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a6e2e', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, marginTop: 4 },
  totalLbl: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#fff', letterSpacing: 0.5 },
  totalVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: '#fff' },
});
