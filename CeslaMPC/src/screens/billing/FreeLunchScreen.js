// src/screens/billing/FreeLunchScreen.js
// CESLA MPC — Free Lunch — UI matches HTML exactly

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, FlatList, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useBilling, DEPARTMENTS, MONTHS, fmt, fmtDate } from '../../context/BillingContext';
import EntryModal from '../../components/EntryModal';

// ── HTML exact values ─────────────────────────────────────────────────────────
const NAVY        = '#304674';   // --navy-dark / --gold
const NAVY_MID    = '#98bad5';   // --navy
const TD_BG       = '#d8e1e8';   // .dept-table td background
const TD_BG_ALT   = '#eef1fb';   // .dept-total-row / hover
const ROW_BORDER  = '#c8d4dc';   // border-bottom on td
const TEXT_DARK   = '#1a2a4a';   // td color
const GREEN_GRAND = '#8eb15c';   // .grand-total-bar
const WHITE       = '#ffffff';
const PAGE_BG     = '#f4f6fb';   // --gray-light

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

  const detailEntries = useMemo(() => {
    if (!detailDate) return [];
    return getEntriesByDate('freelunch', year, month, detailDate);
  }, [detailDate, entries, year, month]);

  const detailTotal = detailEntries.reduce((s, e) => s + (e.amount || 0), 0);

  const openAdd  = (dept = null) => { setEditEntry(null); setPresetDept(dept); setModalVisible(true); };
  const openEdit = (entry) => { setEditEntry(entry); setPresetDept(null); setModalVisible(true); };
  const handleToggleStatus = async (entry) => {
    try { await toggleStatus(entry.id, entry.status); }
    catch (e) { Alert.alert('Error', e.message); }
  };

  // ── Print single row SOA ──────────────────────────────────────────────────
  const handlePrintRow = async (row) => {
    setPrinting(row.billingNo);
    try {
      const prepBy    = settings?.preparedBy    || '________________________';
      const prepTitle = settings?.preparedTitle || '';
      const chkBy     = settings?.checkedBy     || '________________________';
      const chkTitle  = settings?.checkedTitle  || '';
      const mn        = MONTHS[month];
      let rows = '';
      DEPARTMENTS.forEach(dept => {
        const dEnt  = getEntriesByDate('freelunch', year, month, row.date).filter(e => e.dept === dept);
        const pax   = dEnt.reduce((s,e) => s+(parseFloat(e.pax)||0), 0);
        const amt   = dEnt.reduce((s,e) => s+(e.amount||0), 0);
        const aPax  = dEnt.length ? (dEnt[0].amtPerPax||0) : 0;
        rows += `<tr><td>${mn} ${year}</td>
          <td style="text-align:center;font-weight:bold">${dept}</td>
          <td style="text-align:center">${pax}</td>
          <td style="text-align:right">${Number(aPax).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
          <td style="text-align:right">${Number(amt).toLocaleString('en-PH',{minimumFractionDigits:2})}</td></tr>`;
      });
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>
          @page{size:210mm 297mm;margin:15mm}*{margin:0;padding:0;box-sizing:border-box}
          body{font-family:Arial,sans-serif;font-size:10pt;color:#111;background:#fff}
          .hdr{border-bottom:3px solid #1a2a4a;padding-bottom:10px;margin-bottom:18px}
          .hdr-t{font-size:15pt;font-weight:900;color:#1a2a4a}.hdr-s{font-size:9pt;color:#444;margin-top:2px}
          .hdr-y{font-size:10pt;font-weight:bold;color:#1a2a4a;margin-top:3px}
          .sc{text-align:center;margin-bottom:8px}
          .sm{font-size:14pt;font-weight:900;color:#1a2a4a;text-transform:uppercase}
          .sp{font-size:10pt;color:#333;margin-top:4px}.sb{font-size:10pt;font-weight:700;color:#1a2a4a;margin-top:4px}
          .dv{height:1.5px;background:#1a2a4a;margin:10px 0 14px}
          .bd{font-size:11pt;color:#222;line-height:1.8;margin-bottom:16px}
          table{width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:8px}
          th{background:#dce3f0;border:1px solid #666;padding:6px 9px;text-align:left;font-weight:bold;color:#1a2a4a}
          td{border:1px solid #888;padding:6px 9px}
          tr.sub td{background:#dce3f0;font-weight:bold;border-top:2px solid #1a2a4a;color:#1a2a4a}
          .sigs{display:flex;justify-content:space-between;margin-top:60px;font-size:10pt}
          .sc2{width:45%}.sl{font-size:9pt;color:#444;margin-bottom:6px}
          .sln{border-top:1.5px solid #1a2a4a;margin:28px 0 5px}
          .sn{font-weight:bold;font-size:10pt;color:#1a2a4a}.sr{color:#444;font-size:9pt;margin-top:2px}
        </style></head><body>
        <div class="hdr"><div class="hdr-t">CESLA Billing Monitoring System</div>
          <div class="hdr-s">Comprehensive Expense &amp; Statement Ledger Application</div>
          <div class="hdr-y">Annual Billing Report &mdash; ${year}</div></div>
        <div class="sc"><div class="sm">STATEMENT OF ACCOUNT</div>
          <div class="sp">as of ${mn.toUpperCase()} ${year}</div>
          <div class="sb">BILLING NO.: ${row.billingNo}</div></div>
        <div class="dv"></div>
        <p class="bd">This is to bill CLIMBS LIFE &amp; GENERAL INSURANCE COOPERATIVE for the
          Friday Free Lunch dated ${fmtDate(row.date)}, ${year}${row.status==='paid'?' paid by CEC to wit:':':'}</p>
        <table><thead><tr><th>Months</th><th>Department</th><th>NO. OF Pax</th><th>/Pax</th><th>AMOUNT</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr class="sub"><td colspan="3" style="border:none;background:none"></td>
            <td style="text-align:right">GRAND TOTAL:</td>
            <td style="text-align:right">${Number(row.totalAmt).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
          </tr></tfoot></table>
        <div class="sigs">
          <div class="sc2"><p class="sl">Prepared By:</p><div class="sln"></div>
            <div class="sn">${prepBy}</div><div class="sr">${prepTitle}</div></div>
          <div class="sc2"><p class="sl">Checked By:</p><div class="sln"></div>
            <div class="sn">${chkBy}</div><div class="sr">${chkTitle}</div></div>
        </div></body></html>`;
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert('Print Error', e.message || 'Could not open print dialog.');
    } finally {
      setPrinting(null);
    }
  };

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (detailDate) {
    return (
      <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
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
            <Text style={s.addBtnTxt}>Add Entry</Text>
          </TouchableOpacity>
        </View>

        {/* Detail table */}
        <View style={s.section}>
          {/* dept-header */}
          <View style={s.deptHeader}>
            <Text style={s.deptHeaderTxt}>{fmtDate(detailDate)} — {MONTHS[month]} {year}</Text>
          </View>
          {/* th row */}
          <View style={s.thead}>
            <Text style={[s.th, { flex: 2, textAlign: 'left' }]}>DEPARTMENT</Text>
            <Text style={[s.th, { flex: 1 }]}>PAX</Text>
            <Text style={[s.th, { flex: 1.4 }]}>AMT / PAX</Text>
            <Text style={[s.th, { flex: 1.4, textAlign: 'right' }]}>AMOUNT</Text>
            <Text style={[s.th, { flex: 0.8 }]}></Text>
          </View>
          <FlatList
            data={detailEntries}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={s.emptyTxt}>No entries yet.</Text>}
            renderItem={({ item, index }) => (
              <View style={[s.td_row, index % 2 === 1 && s.td_rowAlt]}>
                <Text style={[s.td, { flex: 2, textAlign: 'left', fontWeight: '700', color: TEXT_DARK }]}>
                  {item.dept}
                </Text>
                <Text style={[s.td, { flex: 1 }]}>{item.pax}</Text>
                <Text style={[s.td, { flex: 1.4 }]}>{fmt(item.amtPerPax)}</Text>
                <Text style={[s.td, { flex: 1.4, textAlign: 'right', fontWeight: '700', color: TEXT_DARK }]}>
                  {fmt(item.amount)}
                </Text>
                <View style={{ flex: 0.8, alignItems: 'center' }}>
                  <TouchableOpacity style={s.editBtn} onPress={() => openEdit(item)}>
                    <MaterialIcons name="edit" size={13} color={NAVY} />
                    <Text style={s.editBtnTxt}>EDIT</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>

        {/* Grand total bar */}
        <View style={s.grandBar}>
          <Text style={s.grandLbl}>GRAND TOTAL</Text>
          <Text style={s.grandVal}>{fmt(detailTotal)}</Text>
        </View>

        <EntryModal visible={modalVisible} category="freelunch"
          editEntry={editEntry} presetDept={presetDept}
          presetDate={detailDate} year={year} month={month}
          onClose={() => setModalVisible(false)} />
      </View>
    );
  }

  // ── MAIN TABLE VIEW ──────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>

      {/* Toolbar — Add Entry button */}
      <View style={s.toolbar}>
        <TouchableOpacity style={s.addBtnMain} onPress={() => openAdd()}>
          <MaterialIcons name="add" size={16} color={WHITE} />
          <Text style={s.addBtnMainTxt}>Add Entry</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>

        {/* .dept-section — white card, shadow, margin 15px, overflow hidden */}
        <View style={s.section}>

          {/* .dept-table th row */}
          <View style={s.thead}>
            <Text style={[s.th, { flex: 1.4, textAlign: 'left' }]}>DATE</Text>
            <Text style={[s.th, { flex: 1.6 }]}>BILLING NO.</Text>
            <Text style={[s.th, { flex: 1 }]}>TOTAL NO. OF PAX</Text>
            <Text style={[s.th, { flex: 1.2 }]}>TOTAL AMOUNT/PAX</Text>
            <Text style={[s.th, { flex: 1.3, textAlign: 'right' }]}>AMOUNT</Text>
            <Text style={[s.th, { flex: 1.1 }]}>STATUS</Text>
            <Text style={[s.th, { flex: 0.9 }]}>PRINT</Text>
          </View>

          {/* Rows */}
          {dateSummaries.length === 0 ? (
            <Text style={s.emptyTxt}>No entries yet for {MONTHS[month]} {year}.</Text>
          ) : (
            dateSummaries.map((d, i) => (
              <TouchableOpacity
                key={d.date}
                style={[s.td_row, i % 2 === 1 && s.td_rowAlt]}
                onPress={() => setDetailDate(d.date)}
                activeOpacity={0.75}
              >
                {/* DATE */}
                <Text style={[s.td, { flex: 1.4, textAlign: 'left', fontWeight: '700', color: TEXT_DARK }]}>
                  {fmtDate(d.date)}
                </Text>

                {/* BILLING NO. */}
                <Text style={[s.td, { flex: 1.6, fontWeight: '700', color: TEXT_DARK }]}>
                  {d.billingNo}
                </Text>

                {/* TOTAL NO. OF PAX */}
                <Text style={[s.td, { flex: 1 }]}>
                  {d.totalPax}
                </Text>

                {/* TOTAL AMOUNT/PAX */}
                <Text style={[s.td, { flex: 1.2 }]}>
                  {fmt(d.amtPerPax)}
                </Text>

                {/* AMOUNT */}
                <Text style={[s.td, { flex: 1.3, textAlign: 'right', fontWeight: '700', color: TEXT_DARK }]}>
                  {fmt(d.totalAmt)}
                </Text>

                {/* STATUS — .btn-status */}
                <View style={{ flex: 1.1, alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[s.statusBtn, d.status === 'paid' ? s.statusPaid : s.statusPending]}
                    onPress={() => handleToggleStatus({ id: d.id, status: d.status })}
                  >
                    <MaterialIcons
                      name={d.status === 'paid' ? 'check-circle' : 'hourglass-empty'}
                      size={11}
                      color={d.status === 'paid' ? '#1a6e2e' : '#b36200'}
                    />
                    <Text style={[s.statusTxt, { color: d.status === 'paid' ? '#1a6e2e' : '#b36200' }]}>
                      {d.status === 'paid' ? 'PAID' : 'PENDING'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* PRINT — .action-btn-print */}
                <View style={{ flex: 0.9, alignItems: 'center' }}>
                  <TouchableOpacity
                    style={s.printBtn}
                    onPress={() => handlePrintRow(d)}
                    disabled={printing === d.billingNo}
                  >
                    <MaterialIcons name="print" size={11} color="#b07d00" />
                    <Text style={s.printBtnTxt}>
                      {printing === d.billingNo ? '...' : 'PRINT'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* .grand-total-bar — separate card with margin */}
        <View style={s.grandBar}>
          <Text style={s.grandLbl}>GRAND TOTAL</Text>
          <Text style={s.grandVal}>{fmt(grandTotal)}</Text>
        </View>

      </ScrollView>

      <EntryModal visible={modalVisible} category="freelunch"
        editEntry={editEntry} presetDept={presetDept}
        year={year} month={month}
        onClose={() => setModalVisible(false)} />
    </View>
  );
}

// ── Styles — exact HTML values ────────────────────────────────────────────────
const s = StyleSheet.create({

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
  },
  addBtnMain: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2e9e5b',   // .add-btn background
    borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  addBtnMainTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 14,          // 0.9rem ≈ 14pt
    fontWeight: '700',
    color: WHITE,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(48,70,116,0.10)',
    borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(48,70,116,0.20)',
  },
  backBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: NAVY },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: NAVY, borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 12,
  },
  addBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: WHITE },
  detailTitle: {
    flex: 1, fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: NAVY,
  },

  // ── .dept-section ─────────────────────────────────────────────────────────
  // background:white, border-radius:14px, box-shadow, margin:0 15px 12px, overflow:hidden
  section: {
    backgroundColor: WHITE,
    borderRadius: 14,
    marginHorizontal: 15,
    marginBottom: 0,
    overflow: 'hidden',
    shadowColor: '#1a2456',
    shadowOpacity: 0.13,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  // ── .dept-header ─────────────────────────────────────────────────────────
  deptHeader: {
    backgroundColor: NAVY,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  deptHeaderTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 15,          // 0.92rem
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // ── .dept-table th ────────────────────────────────────────────────────────
  // background:#304674, padding:11px 8px, font-size:0.82rem, font-weight:800
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  th: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 13,          // 0.82rem ≈ 13pt — DAGKO na
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  // ── .dept-table td ────────────────────────────────────────────────────────
  // padding:8px 8px, font-size:0.92rem, font-weight:500, color:#1a2a4a,
  // background:#d8e1e8, border-bottom:1px solid #c8d4dc
  td_row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TD_BG,          // #d8e1e8
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: ROW_BORDER,    // #c8d4dc
  },
  td_rowAlt: {
    backgroundColor: WHITE,           // alternating white
  },
  td: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 14,          // 0.92rem ≈ 14pt — DAGKO na
    fontWeight: '500',
    color: TEXT_DARK,      // #1a2a4a
    textAlign: 'center',
  },

  // ── .btn-status ───────────────────────────────────────────────────────────
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
    minWidth: 76,  justifyContent: 'center',
  },
  statusPaid: {
    backgroundColor: '#d4f5e2',
    borderWidth: 1.5, borderColor: '#1a6e2e',
  },
  statusPending: {
    backgroundColor: '#fff4e0',
    borderWidth: 1.5, borderColor: '#e0a800',
  },
  statusTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ── .action-btn-print ────────────────────────────────────────────────────
  // background:#fff8e1, border:1.5px solid #e0a800, border-radius:20px
  printBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fff8e1',
    borderWidth: 1.5, borderColor: '#e0a800',
    borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 4,
    minWidth: 65, justifyContent: 'center',
  },
  printBtnTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 11, fontWeight: '700',
    color: '#b07d00', letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ── .action-btn (edit) ────────────────────────────────────────────────────
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#e8f0ff',
    borderWidth: 1.5, borderColor: NAVY,
    borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  editBtnTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 11, fontWeight: '700',
    color: NAVY, letterSpacing: 0.5,
  },

  // ── .grand-total-bar ──────────────────────────────────────────────────────
  // background:#8eb15c, border-radius:8px, padding:14px 24px,
  // margin-top:8px, margin-left:15px, margin-right:15px
  grandBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: GREEN_GRAND,    // #8eb15c
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 8,
    marginHorizontal: 15,
    marginBottom: 4,
  },
  grandLbl: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 15, fontWeight: '800',
    color: WHITE, letterSpacing: 0.5,
  },
  grandVal: {
    fontFamily: 'NotoSerif_700Bold',
    fontSize: 18, fontWeight: '800',
    color: WHITE,
  },

  emptyTxt: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 13, color: 'rgba(1,31,75,0.40)',
    textAlign: 'center', padding: 24,
  },
});