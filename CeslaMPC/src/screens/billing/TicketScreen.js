// src/screens/billing/TicketScreen.js
import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBilling, MONTHS, fmt, fmtDate } from '../../context/BillingContext';
import EntryModal from '../../components/EntryModal';

const NAVY     = '#304674';
const WHITE    = '#ffffff';
const PAGE_BG  = '#f4f6fb';
const TD_BG    = '#d8e1e8';
const ROW_BDR  = '#c8d4dc';
const TEXT_DARK= '#1a2a4a';
const GREEN    = '#2e9e5b';
const GRAND_GN = '#8eb15c';

export default function TicketScreen({ year, month }) {
  const { height: wh } = useWindowDimensions();
  const { entries, getUniqueDates, getEntriesByDate, toggleStatus } = useBilling();

  const [detailDate,   setDetailDate]   = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editEntry,    setEditEntry]    = useState(null);

  const dates = useMemo(() => getUniqueDates('ticket', year, month), [entries, year, month]);

  const rows = useMemo(() => dates.map((date, idx) => {
    const dayEntries  = getEntriesByDate('ticket', year, month, date);
    const totalAmt    = dayEntries.reduce((s, e) => s + (e.amount || 0), 0);
    const totalTickets= dayEntries.reduce((s, e) => s + (parseFloat(e.tickets) || 0), 0);
    const amtTicket   = dayEntries[0]?.amtTicket || 0;
    const status      = dayEntries[0]?.status || 'pending';
    const mm          = String(month + 1).padStart(2, '0');
    const billingNo   = `TK ${year}-${mm}-${String(idx + 1).padStart(2, '0')}`;
    return { date, totalAmt, totalTickets, amtTicket, status, billingNo, id: dayEntries[0]?.id };
  }), [dates, entries]);

  const grandTotal    = rows.reduce((s, r) => s + r.totalAmt, 0);
  const detailEntries = useMemo(() =>
    detailDate ? getEntriesByDate('ticket', year, month, detailDate) : [],
    [detailDate, entries]
  );
  const detailTotal = detailEntries.reduce((s, e) => s + (e.amount || 0), 0);

  const openAdd  = () => { setEditEntry(null); setModalVisible(true); };
  const openEdit = (e) => { setEditEntry(e); setModalVisible(true); };
  const handleToggle = async (entry) => {
    try { await toggleStatus(entry.id, entry.status); }
    catch (e) { Alert.alert('Error', e.message); }
  };

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (detailDate) {
    return (
      <View style={{ flex:1, backgroundColor:PAGE_BG }}>
        <View style={s.toolbar}>
          <TouchableOpacity style={s.backBtn} onPress={() => setDetailDate(null)}>
            <MaterialIcons name="arrow-back" size={16} color={NAVY} />
            <Text style={s.backBtnTxt}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={openAdd}>
            <MaterialIcons name="add" size={14} color={WHITE} />
            <Text style={s.addBtnTxt}>Add Entry</Text>
          </TouchableOpacity>
          <Text style={s.detailTitle} numberOfLines={1}>
            {fmtDate(detailDate)} — {MONTHS[month]} {year}
          </Text>
        </View>
        <View style={[s.deptSection, { maxHeight: wh * 0.55 }]}>
          <View style={s.thead}>
            <Text style={[s.th, { flex:2, textAlign:'left' }]}>NAME</Text>
            <Text style={[s.th, { flex:1 }]}>TICKETS</Text>
            <Text style={[s.th, { flex:1.4 }]}>AMT/TICKET</Text>
            <Text style={[s.th, { flex:1.4, textAlign:'right' }]}>AMOUNT</Text>
            <Text style={[s.th, { width:80 }]}></Text>
          </View>
          <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {detailEntries.length === 0
              ? <Text style={s.emptyTxt}>No entries yet.</Text>
              : detailEntries.map(item => (
                <View key={item.id} style={s.row}>
                  <Text style={[s.td, { flex:2, textAlign:'left', fontWeight:'700', color:TEXT_DARK }]}>{item.name || item.dept}</Text>
                  <Text style={[s.td, { flex:1, textAlign:'center' }]}>{item.tickets}</Text>
                  <Text style={[s.td, { flex:1.4, textAlign:'center' }]}>{fmt(item.amtTicket)}</Text>
                  <Text style={[s.td, { flex:1.4, textAlign:'right', fontWeight:'700', color:TEXT_DARK }]}>{fmt(item.amount)}</Text>
                  <View style={{ width:80, alignItems:'center' }}>
                    <TouchableOpacity style={s.editBtn} onPress={() => openEdit(item)}>
                      <MaterialIcons name="edit" size={13} color={NAVY} />
                      <Text style={s.editBtnTxt}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            }
          </ScrollView>
          <View style={s.grandTotalBar}>
            <Text style={s.grandLbl}>GRAND TOTAL</Text>
            <Text style={s.grandVal}>{fmt(detailTotal)}</Text>
          </View>
        </View>
        <EntryModal visible={modalVisible} category="ticket"
          editEntry={editEntry} presetDate={detailDate} year={year} month={month}
          onClose={() => setModalVisible(false)} />
      </View>
    );
  }

  // ── MAIN VIEW ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex:1, backgroundColor:PAGE_BG }}>
      <View style={s.toolbar}>
        <TouchableOpacity style={s.addBtnMain} onPress={openAdd}>
          <MaterialIcons name="add" size={16} color={WHITE} />
          <Text style={s.addBtnMainTxt}>Add Entry</Text>
        </TouchableOpacity>
      </View>
      <View style={[s.deptSection, { maxHeight: wh * 0.55 }]}>
        <View style={s.thead}>
          <Text style={[s.th, { flex:1.4, textAlign:'left' }]}>DATE</Text>
          <Text style={[s.th, { flex:1.6, textAlign:'center' }]}>BILLING NO.</Text>
          <Text style={[s.th, { flex:1, textAlign:'center' }]}>TOTAL TICKETS</Text>
          <Text style={[s.th, { flex:1.2, textAlign:'center' }]}>AMT/TICKET</Text>
          <Text style={[s.th, { flex:1.3, textAlign:'right' }]}>AMOUNT</Text>
          <Text style={[s.th, { flex:1.1, textAlign:'center' }]}>STATUS</Text>
        </View>
        <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {rows.length === 0
            ? <Text style={s.emptyTxt}>No entries yet for {MONTHS[month]} {year}.</Text>
            : rows.map(d => (
              <TouchableOpacity key={d.date} style={s.row} onPress={() => setDetailDate(d.date)} activeOpacity={0.75}>
                <Text style={[s.td, { flex:1.4, textAlign:'left', fontWeight:'700', color:TEXT_DARK }]}>{fmtDate(d.date)}</Text>
                <Text style={[s.td, { flex:1.6, textAlign:'center', fontWeight:'700', color:TEXT_DARK }]}>{d.billingNo}</Text>
                <Text style={[s.td, { flex:1, textAlign:'center' }]}>{d.totalTickets}</Text>
                <Text style={[s.td, { flex:1.2, textAlign:'center' }]}>{fmt(d.amtTicket)}</Text>
                <Text style={[s.td, { flex:1.3, textAlign:'right', fontWeight:'700', color:TEXT_DARK }]}>{fmt(d.totalAmt)}</Text>
                <View style={{ flex:1.1, alignItems:'center' }}>
                  <TouchableOpacity
                    style={[s.statusBtn, d.status==='paid' ? s.statusPaid : s.statusPending]}
                    onPress={() => handleToggle({ id:d.id, status:d.status })}>
                    <MaterialIcons name={d.status==='paid' ? 'check-circle' : 'hourglass-empty'} size={11} color={d.status==='paid' ? '#1a6e2e' : '#b36200'} />
                    <Text style={[s.statusTxt, { color:d.status==='paid' ? '#1a6e2e' : '#b36200' }]}>
                      {d.status==='paid' ? 'PAID' : 'PENDING'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          }
        </ScrollView>
        <View style={s.grandTotalBar}>
          <Text style={s.grandLbl}>GRAND TOTAL</Text>
          <Text style={s.grandVal}>{fmt(grandTotal)}</Text>
        </View>
      </View>
      <EntryModal visible={modalVisible} category="ticket"
        editEntry={editEntry} year={year} month={month}
        onClose={() => setModalVisible(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  toolbar: { flexDirection:'row', alignItems:'center', paddingHorizontal:15, paddingVertical:10, gap:10 },
  addBtnMain: { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:GREEN, borderRadius:8, paddingVertical:8, paddingHorizontal:16 },
  addBtnMainTxt: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:WHITE },
  deptSection: { flex:1, flexDirection:'column', backgroundColor:WHITE, borderRadius:14, marginHorizontal:48, marginBottom:10, shadowColor:'#1a2456', shadowOpacity:0.13, shadowRadius:10, shadowOffset:{width:0,height:4}, elevation:5, overflow:'hidden' },
  thead: { flexDirection:'row', alignItems:'center', backgroundColor:NAVY, paddingVertical:11, paddingHorizontal:8, borderTopLeftRadius:14, borderTopRightRadius:14 },
  th: { fontFamily:'GoogleSans_700Bold', fontSize:11, fontWeight:'800', color:WHITE, letterSpacing:0.5, textTransform:'uppercase', textAlign:'center' },
  row: { flexDirection:'row', alignItems:'center', backgroundColor:TD_BG, paddingVertical:12, paddingHorizontal:8, borderBottomWidth:1, borderBottomColor:ROW_BDR },
  td: { fontFamily:'GoogleSans_400Regular', fontSize:13, color:TEXT_DARK, textAlign:'center' },
  grandTotalBar: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:GRAND_GN, paddingVertical:14, paddingHorizontal:24, borderBottomLeftRadius:14, borderBottomRightRadius:14 },
  grandLbl: { fontFamily:'GoogleSans_700Bold', fontSize:13, fontWeight:'800', color:WHITE, letterSpacing:0.5 },
  grandVal: { fontFamily:'NotoSerif_700Bold', fontSize:16, fontWeight:'800', color:WHITE },
  statusBtn: { flexDirection:'row', alignItems:'center', gap:3, borderRadius:20, paddingHorizontal:8, paddingVertical:4, minWidth:72, justifyContent:'center' },
  statusPaid:    { backgroundColor:'#d4f5e2', borderWidth:1.5, borderColor:'#1a6e2e' },
  statusPending: { backgroundColor:'#fff4e0', borderWidth:1.5, borderColor:'#e0a800' },
  statusTxt: { fontFamily:'GoogleSans_700Bold', fontSize:9, letterSpacing:0.3 },
  backBtn: { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(48,70,116,0.10)', borderRadius:8, paddingVertical:7, paddingHorizontal:12, borderWidth:1, borderColor:'rgba(48,70,116,0.20)' },
  backBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:NAVY },
  addBtn: { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:NAVY, borderRadius:8, paddingVertical:7, paddingHorizontal:12 },
  addBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:WHITE },
  detailTitle: { flex:1, fontFamily:'GoogleSans_700Bold', fontSize:13, color:NAVY },
  editBtn: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(48,70,116,0.08)', borderRadius:8, paddingVertical:5, paddingHorizontal:8, borderWidth:1, borderColor:'rgba(48,70,116,0.18)' },
  editBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:NAVY },
  emptyTxt: { fontFamily:'GoogleSans_400Regular', fontSize:13, color:'rgba(1,31,75,0.40)', textAlign:'center', padding:24 },
});