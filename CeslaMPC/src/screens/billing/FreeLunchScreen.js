// src/screens/billing/FreeLunchScreen.js
import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, FlatList, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useBilling, DEPARTMENTS, MONTHS, fmt, fmtDate } from '../../context/BillingContext';
import EntryModal from '../../components/EntryModal';

const NAVY      = '#304674';
const WHITE     = '#ffffff';
const PAGE_BG   = '#f4f6fb';
const TD_BG     = '#d8e1e8';
const ROW_BDR   = '#c8d4dc';
const TEXT_DARK = '#1a2a4a';
const GREEN     = '#2e9e5b';
const GRAND_GN  = '#8eb15c';

export default function FreeLunchScreen({ year, month }) {
  const { entries, getUniqueDates, getEntriesByDate, toggleStatus, settings } = useBilling();

  const [detailDate,   setDetailDate]   = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editEntry,    setEditEntry]    = useState(null);
  const [presetDept,   setPresetDept]   = useState(null);
  const [printing,     setPrinting]     = useState(null);

  const dates = useMemo(
    () => getUniqueDates('freelunch', year, month),
    [entries, year, month]
  );

  const rows = useMemo(() => dates.map((date, idx) => {
    const dayEntries = getEntriesByDate('freelunch', year, month, date);
    const totalPax   = dayEntries.reduce((s, e) => s + (parseFloat(e.pax) || 0), 0);
    const totalAmt   = dayEntries.reduce((s, e) => s + (e.amount || 0), 0);
    const amtPerPax  = dayEntries[0]?.amtPerPax || 0;
    const status     = dayEntries[0]?.status || 'pending';
    const mm         = String(month + 1).padStart(2, '0');
    const billingNo  = `FL ${year}-${mm}-${String(idx + 1).padStart(2, '0')}`;
    return { date, totalPax, totalAmt, amtPerPax, status, billingNo, id: dayEntries[0]?.id };
  }), [dates, entries]);

  const grandTotal = rows.reduce((s, r) => s + r.totalAmt, 0);

  const detailEntries = useMemo(() => {
    if (!detailDate) return [];
    return getEntriesByDate('freelunch', year, month, detailDate);
  }, [detailDate, entries]);

  const detailTotal = detailEntries.reduce((s, e) => s + (e.amount || 0), 0);

  const openAdd  = (dept = null) => { setEditEntry(null); setPresetDept(dept); setModalVisible(true); };
  const openEdit = (entry) => { setEditEntry(entry); setPresetDept(null); setModalVisible(true); };

  const handleToggle = async (entry) => {
    try { await toggleStatus(entry.id, entry.status); }
    catch (e) { Alert.alert('Error', e.message); }
  };

  const handlePrint = async (row) => {
    setPrinting(row.billingNo);
    try {
      const prepBy    = settings?.preparedBy    || '________________________';
      const prepTitle = settings?.preparedTitle || '';
      const chkBy     = settings?.checkedBy     || '________________________';
      const chkTitle  = settings?.checkedTitle  || '';
      const mn        = MONTHS[month];
      let tRows = '';
      DEPARTMENTS.forEach(dept => {
        const ents = getEntriesByDate('freelunch', year, month, row.date).filter(e => e.dept === dept);
        const pax  = ents.reduce((s,e)=>s+(parseFloat(e.pax)||0),0);
        const amt  = ents.reduce((s,e)=>s+(e.amount||0),0);
        const aPax = ents[0]?.amtPerPax || 0;
        tRows += `<tr><td>${mn} ${year}</td><td style="text-align:center;font-weight:bold">${dept}</td>
          <td style="text-align:center">${pax}</td>
          <td style="text-align:right">${Number(aPax).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
          <td style="text-align:right">${Number(amt).toLocaleString('en-PH',{minimumFractionDigits:2})}</td></tr>`;
      });
      await Print.printAsync({ html: `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>@page{size:210mm 297mm;margin:15mm}*{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;font-size:10pt;color:#111}
        table{width:100%;border-collapse:collapse;font-size:9pt}
        th{background:#dce3f0;border:1px solid #666;padding:6px 9px;text-align:left;font-weight:bold;color:#1a2a4a}
        td{border:1px solid #888;padding:6px 9px}
        tr.sub td{background:#dce3f0;font-weight:bold;border-top:2px solid #1a2a4a;color:#1a2a4a}
        </style></head><body>
        <h3>BILLING NO.: ${row.billingNo}</h3>
        <table><thead><tr><th>Months</th><th>Department</th><th>NO. OF Pax</th><th>/Pax</th><th>AMOUNT</th></tr></thead>
        <tbody>${tRows}</tbody>
        <tfoot><tr class="sub"><td colspan="3" style="border:none;background:none"></td>
        <td style="text-align:right">GRAND TOTAL:</td>
        <td style="text-align:right">${Number(row.totalAmt).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
        </tr></tfoot></table>
        <div style="display:flex;justify-content:space-between;margin-top:60px">
        <div><p>Prepared By:</p><div style="border-top:1px solid #000;margin-top:30px;padding-top:4px">${prepBy}<br><small>${prepTitle}</small></div></div>
        <div><p>Checked By:</p><div style="border-top:1px solid #000;margin-top:30px;padding-top:4px">${chkBy}<br><small>${chkTitle}</small></div></div>
        </div></body></html>` });
    } catch (e) { Alert.alert('Print Error', e.message); }
    finally { setPrinting(null); }
  };

  // ── ROW RENDERER ─────────────────────────────────────────────────────────────
  const renderRow = (d) => (
    <TouchableOpacity key={d.date} style={s.row} onPress={() => setDetailDate(d.date)} activeOpacity={0.75}>
      <Text style={[s.td, { flex:1.4, textAlign:'left', fontWeight:'700', color:TEXT_DARK }]}>{fmtDate(d.date)}</Text>
      <Text style={[s.td, { flex:1.6, fontWeight:'700', color:TEXT_DARK }]}>{d.billingNo}</Text>
      <Text style={[s.td, { flex:1 }]}>{d.totalPax}</Text>
      <Text style={[s.td, { flex:1.2 }]}>{fmt(d.amtPerPax)}</Text>
      <Text style={[s.td, { flex:1.3, textAlign:'right', fontWeight:'700', color:TEXT_DARK }]}>{fmt(d.totalAmt)}</Text>
      <View style={{ flex:1.1, alignItems:'center' }}>
        <TouchableOpacity
          style={[s.statusBtn, d.status==='paid' ? s.statusPaid : s.statusPending]}
          onPress={() => handleToggle({ id:d.id, status:d.status })}
        >
          <MaterialIcons name={d.status==='paid' ? 'check-circle' : 'hourglass-empty'} size={11} color={d.status==='paid' ? '#1a6e2e' : '#b36200'} />
          <Text style={[s.statusTxt, { color:d.status==='paid' ? '#1a6e2e' : '#b36200' }]}>
            {d.status==='paid' ? 'PAID' : 'PENDING'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex:0.9, alignItems:'center' }}>
        <TouchableOpacity style={s.printBtn} onPress={() => handlePrint(d)} disabled={printing===d.billingNo}>
          <MaterialIcons name="print" size={11} color="#b07d00" />
          <Text style={s.printBtnTxt}>{printing===d.billingNo ? '...' : 'PRINT'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────────
  if (detailDate) {
    return (
      <View style={{ flex:1, backgroundColor:PAGE_BG }}>
        <View style={s.toolbar}>
          <TouchableOpacity style={s.backBtn} onPress={() => setDetailDate(null)}>
            <MaterialIcons name="arrow-back" size={16} color={NAVY} />
            <Text style={s.backBtnTxt}>Back</Text>
          </TouchableOpacity>
          <Text style={s.detailTitle} numberOfLines={1}>
            {fmtDate(detailDate)} — {MONTHS[month]} {year}
          </Text>
          <TouchableOpacity style={s.addBtn} onPress={() => openAdd()}>
            <MaterialIcons name="add" size={14} color={WHITE} />
            <Text style={s.addBtnTxt}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Detail table */}
        <View style={s.card}>
          <View style={s.thead}>
            <Text style={[s.th, { flex:2, textAlign:'left' }]}>DEPARTMENT</Text>
            <Text style={[s.th, { flex:1 }]}>PAX</Text>
            <Text style={[s.th, { flex:1.4 }]}>AMT/PAX</Text>
            <Text style={[s.th, { flex:1.4, textAlign:'right' }]}>AMOUNT</Text>
            <Text style={[s.th, { width:44 }]}></Text>
          </View>
          <ScrollView style={{ flex:1 }}>
            {detailEntries.length === 0
              ? <Text style={s.emptyTxt}>No entries yet.</Text>
              : detailEntries.map((item) => (
                <View key={item.id} style={s.row}>
                  <Text style={[s.td, { flex:2, textAlign:'left', fontWeight:'700', color:TEXT_DARK }]}>{item.dept}</Text>
                  <Text style={[s.td, { flex:1 }]}>{item.pax}</Text>
                  <Text style={[s.td, { flex:1.4 }]}>{fmt(item.amtPerPax)}</Text>
                  <Text style={[s.td, { flex:1.4, textAlign:'right', fontWeight:'700', color:TEXT_DARK }]}>{fmt(item.amount)}</Text>
                  <View style={{ width:44, alignItems:'center' }}>
                    <TouchableOpacity style={s.editBtn} onPress={() => openEdit(item)}>
                      <MaterialIcons name="edit" size={14} color={NAVY} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            }
          </ScrollView>
          <View style={s.grandBarWrap}>
            <Text style={s.grandLbl}>GRAND TOTAL</Text>
            <Text style={s.grandVal}>{fmt(detailTotal)}</Text>
          </View>
        </View>

        <EntryModal visible={modalVisible} category="freelunch"
          editEntry={editEntry} presetDept={presetDept}
          presetDate={detailDate} year={year} month={month}
          onClose={() => setModalVisible(false)} />
      </View>
    );
  }

  // ── MAIN VIEW ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex:1, backgroundColor:PAGE_BG }}>

      {/* Add Entry button */}
      <View style={s.toolbar}>
        <TouchableOpacity style={s.addBtnMain} onPress={() => openAdd()}>
          <MaterialIcons name="add" size={16} color={WHITE} />
          <Text style={s.addBtnMainTxt}>Add Entry</Text>
        </TouchableOpacity>
      </View>

      {/* Table container */}
      <View style={s.tableContainer}>

        {/* Navy header — never moves */}
        <View style={s.theadWrap}>
          <Text style={[s.th, { flex:1.4, textAlign:'left' }]}>DATE</Text>
          <Text style={[s.th, { flex:1.6 }]}>BILLING NO.</Text>
          <Text style={[s.th, { flex:1 }]}>TOTAL NO. OF PAX</Text>
          <Text style={[s.th, { flex:1.2 }]}>TOTAL AMOUNT/PAX</Text>
          <Text style={[s.th, { flex:1.3, textAlign:'right' }]}>AMOUNT</Text>
          <Text style={[s.th, { flex:1.1 }]}>STATUS</Text>
          <Text style={[s.th, { flex:0.9 }]}>PRINT</Text>
        </View>

        {/* Rows — flex:1 makes it fill space and scroll */}
        <FlatList
          data={rows}
          keyExtractor={item => item.date}
          style={{ flex:1 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={s.emptyTxt}>No entries yet for {MONTHS[month]} {year}.</Text>}
          renderItem={({ item: d }) => renderRow(d)}
        />

        {/* Grand total — always at bottom, never moves */}
        <View style={s.grandBarWrap}>
          <Text style={s.grandLbl}>GRAND TOTAL</Text>
          <Text style={s.grandVal}>{fmt(grandTotal)}</Text>
        </View>

      </View>

      <EntryModal visible={modalVisible} category="freelunch"
        editEntry={editEntry} presetDept={presetDept}
        year={year} month={month}
        onClose={() => setModalVisible(false)} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  toolbar: {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:15, paddingVertical:10, gap:10,
  },
  addBtnMain: {
    flexDirection:'row', alignItems:'center', gap:6,
    backgroundColor:GREEN, borderRadius:8,
    paddingVertical:8, paddingHorizontal:16,
  },
  addBtnMainTxt: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:WHITE },

  card: {},
  cardTop: {},
  cardBottom: {},
  flatList: {},
  flatContent: {},
  thead: {},

  // One container: flex:1, margin sides — holds header+rows+footer
  tableContainer: {
    flex: 1,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: WHITE,
    shadowColor: '#1a2456',
    shadowOpacity: 0.13,
    shadowRadius: 10,
    shadowOffset: { width:0, height:4 },
    elevation: 5,
  },

  // Navy header inside container
  theadWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  th: {
    fontFamily:'GoogleSans_700Bold', fontSize:11, fontWeight:'800',
    color:WHITE, letterSpacing:0.5, textTransform:'uppercase', textAlign:'center',
  },

  // Row
  row: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:TD_BG,
    paddingVertical:12, paddingHorizontal:8,
    borderBottomWidth:1, borderBottomColor:ROW_BDR,
  },
  td: {
    fontFamily:'GoogleSans_400Regular', fontSize:13,
    color:TEXT_DARK, textAlign:'center',
  },

  // Grand total bar — at bottom of card
  grandBar: {},
  grandBarWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: GRAND_GN,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  grandLbl: { fontFamily:'GoogleSans_700Bold', fontSize:13, fontWeight:'800', color:WHITE, letterSpacing:0.5 },
  grandVal: { fontFamily:'NotoSerif_700Bold', fontSize:16, fontWeight:'800', color:WHITE },

  // Status
  statusBtn: {
    flexDirection:'row', alignItems:'center', gap:3,
    borderRadius:20, paddingHorizontal:8, paddingVertical:4,
    minWidth:72, justifyContent:'center',
  },
  statusPaid:    { backgroundColor:'#d4f5e2', borderWidth:1.5, borderColor:'#1a6e2e' },
  statusPending: { backgroundColor:'#fff4e0', borderWidth:1.5, borderColor:'#e0a800' },
  statusTxt: { fontFamily:'GoogleSans_700Bold', fontSize:9, letterSpacing:0.3 },

  // Print button
  printBtn: {
    flexDirection:'row', alignItems:'center', gap:3,
    backgroundColor:'#fff8e1', borderWidth:1.5, borderColor:'#e0a800',
    borderRadius:20, paddingHorizontal:8, paddingVertical:4,
    minWidth:55, justifyContent:'center',
  },
  printBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'#b07d00', letterSpacing:0.3 },

  // Detail view
  backBtn: {
    flexDirection:'row', alignItems:'center', gap:6,
    backgroundColor:'rgba(48,70,116,0.10)', borderRadius:8,
    paddingVertical:7, paddingHorizontal:12,
    borderWidth:1, borderColor:'rgba(48,70,116,0.20)',
  },
  backBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:NAVY },
  addBtn: {
    flexDirection:'row', alignItems:'center', gap:5,
    backgroundColor:NAVY, borderRadius:8,
    paddingVertical:7, paddingHorizontal:12,
  },
  addBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:WHITE },
  detailTitle: { flex:1, fontFamily:'GoogleSans_700Bold', fontSize:13, color:NAVY },
  editBtn: {
    width:30, height:30, borderRadius:15,
    backgroundColor:'rgba(48,70,116,0.08)',
    justifyContent:'center', alignItems:'center',
    borderWidth:1, borderColor:'rgba(48,70,116,0.18)',
  },

  emptyTxt: {
    fontFamily:'GoogleSans_400Regular', fontSize:13,
    color:'rgba(1,31,75,0.40)', textAlign:'center', padding:24,
  },
});