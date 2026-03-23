// src/screens/billing/WaterBillingScreen.js
import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, useWindowDimensions, Platform,
  TextInput, Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { useBilling, MONTHS, fmt, fmtDate } from '../../context/BillingContext';
import EntryModal from '../../components/EntryModal';

const NAVY = '#304674';
const WHITE = '#ffffff';
const PAGE_BG = '#f4f6fb';
const TD_BG = '#d8e1e8';
const ROW_BDR = '#c8d4dc';
const TEXT_DARK = '#1a2a4a';
const GREEN = '#2e9e5b';
const GRAND_GN = '#8eb15c';

export default function WaterBillingScreen({ year, month }) {
  const { height: winHeight } = useWindowDimensions();
  const { entries, getUniqueDates, getEntriesByDate, toggleStatus, settings } = useBilling();
  const [detailDate,   setDetailDate]   = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editEntry,    setEditEntry]    = useState(null);
  const [printing,     setPrinting]     = useState(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [payDropdown,  setPayDropdown]  = useState(false);
  const [payFrom,      setPayFrom]      = useState('');
  const [payTo,        setPayTo]        = useState('');
  const payBtnRef = useRef(null);
  const [payBtnPos, setPayBtnPos] = useState({ top:0, left:0, width:0 });
  const [selectedDates, setSelectedDates] = useState([]);

  const dates = useMemo(
    () => getUniqueDates('waterbilling', year, month),
    [entries, year, month]
  );

  const rows = useMemo(() => dates.map((date, idx) => {
    const dayEntries = getEntriesByDate('waterbilling', year, month, date);
    const totalAmt   = dayEntries.reduce((s, e) => s + (e.amount || 0), 0);
    const totalGallons = dayEntries.reduce((s, e) => s + (parseFloat(e.gallons) || 0), 0);
    const priceGallon  = dayEntries[0]?.priceGallon || 0;
    const status     = dayEntries[0]?.status || 'pending';
    const mm         = String(month + 1).padStart(2, '0');
    const billingNo  = 'PD ' + year + '-' + mm + '-' + String(idx + 1).padStart(2, '0');
    return { date, totalAmt, totalGallons, priceGallon, status, billingNo, id: dayEntries[0]?.id };
  }), [dates, entries]);

  const grandTotal    = rows.reduce((s, r) => s + r.totalAmt, 0);
  const detailEntries = useMemo(
    () => detailDate ? getEntriesByDate('waterbilling', year, month, detailDate) : [],
    [detailDate, entries]
  );
  const detailTotal = detailEntries.reduce((s, e) => s + (e.amount || 0), 0);

  const openAdd  = () => { setEditEntry(null); setModalVisible(true); };
  const openEdit = (e) => { setEditEntry(e); setModalVisible(true); };

  const handleToggle = async (entry) => {
    try { await toggleStatus(entry.id, entry.status); }
    catch (e) { Alert.alert('Error', e.message); }
  };

  const buildHtml = async (row) => {
    const prepBy    = settings?.preparedBy    || '________________________';
    const prepTitle = settings?.preparedTitle || '';
    const chkBy     = settings?.checkedBy     || '________________________';
    const chkTitle  = settings?.checkedTitle  || '';

    let logoHtml = '';
    try {
      const asset = await Asset.fromModule(require('../../../assets/CESLA_logo.png')).downloadAsync();
      const lu = asset.localUri || asset.uri || '';
      if (lu) {
        const resp = await fetch(lu);
        const blob = await resp.blob();
        const b64 = await new Promise((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result);
          reader.readAsDataURL(blob);
        });
        logoHtml = '<img src="' + b64 + '" style="width:52px;height:52px;border-radius:50%;border:2px solid #1a2a4a;margin-right:14px;" />';
      }
    } catch (_) {}

    const dObj     = new Date(row.date + 'T00:00:00');
    const rowYear  = dObj.getFullYear();
    const rowMonth = dObj.getMonth();
    const mStr     = dObj.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
    const dStr     = String(dObj.getDate()).padStart(2, '0');
    const dateStr  = mStr + ' ' + dStr + ', ' + rowYear;
    const dateShort = dObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const period   = MONTHS[rowMonth] + ' ' + rowYear;
    const paid     = row.status === 'paid' ? ' paid by CEC to wit:' : ':';
    const cs       = 'border:1px solid #ccc;padding:7px 10px;color:#222;font-size:10pt;';

    let tRows = '';
    let gt = 0;
    getEntriesByDate('waterbilling', rowYear, rowMonth, row.date).forEach(function(e) {
      const a = e.amount || 0;
      gt += a;
      tRows = tRows
        + '<tr>'
        + '<td style="' + cs + '">' + dateShort + '</td>'
        + '<td style="' + cs + ';font-weight:bold;text-align:center;">' + (e.dept || '') + '</td>'
        + '<td style="' + cs + ';text-align:center;">' + (e.gallons || 0) + '</td>'
        + '<td style="' + cs + ';text-align:center;">' + Number(e.priceGallon || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }) + '</td>'
        + '<td style="' + cs + ';text-align:right;">' + Number(a).toLocaleString('en-PH', { minimumFractionDigits: 2 }) + '</td>'
        + '</tr>';
    });

    if (!tRows) tRows = '<tr><td colspan="5" style="text-align:center;color:#999;padding:10px;">No entries</td></tr>';
    const gtFmt = gt.toLocaleString('en-PH', { minimumFractionDigits: 2 });

    const hdr = ''
      + '<div style="display:flex;align-items:center;border-bottom:2.5px solid #1a2a4a;padding-bottom:10px;margin-bottom:18px;">'
      + logoHtml
      + '<div>'
      + '<div style="font-size:14pt;font-weight:bold;color:#1a2a4a;">CESLA Billing Monitoring System</div>'
      + '<div style="font-size:8pt;color:#555;margin-top:2px;">Comprehensive Expense &amp; Statement Ledger Application</div>'
      + '<div style="font-size:8.5pt;font-weight:bold;color:#1a2a4a;margin-top:2px;">Annual Billing Report \u2014 ' + rowYear + '</div>'
      + '</div></div>';

    const soa = ''
      + '<div style="text-align:center;margin-bottom:8px;">'
      + '<div style="font-size:14pt;font-weight:900;color:#1a2a4a;letter-spacing:0.5px;text-transform:uppercase;">STATEMENT OF ACCOUNT</div>'
      + '<div style="font-size:10pt;color:#333;margin-top:5px;">as of ' + period.toUpperCase() + '</div>'
      + '<div style="font-size:10pt;font-weight:700;color:#1a2a4a;margin-top:4px;">BILLING NO.: ' + row.billingNo + '</div>'
      + '</div>';

    const para = ''
      + '<div style="height:1.5px;background:#1a2a4a;margin:12px 0 16px;"></div>'
      + '<div style="font-size:11pt;color:#222;line-height:1.8;margin-bottom:18px;">'
      + 'This is to bill CLIMBS LIFE &amp; GENERAL INSURANCE COOPERATIVE for the Mineral Water Supply dated '
      + dateStr + paid
      + '</div>';

    const tbl = ''
      + '<table style="width:100%;border-collapse:collapse;font-size:10pt;border:1px solid #aab4c8;">'
      + '<thead><tr style="background:#dce3f0;-webkit-print-color-adjust:exact;print-color-adjust:exact;">'
      + '<th style="padding:8px 10px;text-align:left;border:1px solid #aab4c8;color:#1a2a4a;font-weight:bold;">DATE</th>'
      + '<th style="padding:8px 10px;text-align:left;border:1px solid #aab4c8;color:#1a2a4a;font-weight:bold;">Department</th>'
      + '<th style="padding:8px 10px;text-align:center;border:1px solid #aab4c8;color:#1a2a4a;font-weight:bold;">NO. OF Gallon</th>'
      + '<th style="padding:8px 10px;text-align:center;border:1px solid #aab4c8;color:#1a2a4a;font-weight:bold;">Price/Gallon</th>'
      + '<th style="padding:8px 10px;text-align:right;border:1px solid #aab4c8;color:#1a2a4a;font-weight:bold;">AMOUNT</th>'
      + '</tr></thead>'
      + '<tbody>' + tRows + '</tbody>'
      + '<tfoot><tr>'
      + '<td colspan="4" style="border:1px solid #aab4c8;border-top:2px solid #1a2a4a;padding:7px 10px;text-align:right;font-weight:bold;color:#1a2a4a;background:#dce3f0;-webkit-print-color-adjust:exact;print-color-adjust:exact">GRAND TOTAL:</td>'
      + '<td style="border:1px solid #aab4c8;border-top:2px solid #1a2a4a;padding:7px 10px;font-weight:bold;text-align:right;color:#1a2a4a;background:#dce3f0;-webkit-print-color-adjust:exact;print-color-adjust:exact">' + gtFmt + '</td>'
      + '</tr></tfoot></table>';

    const sig = ''
      + '<div style="display:flex;justify-content:space-between;margin-top:48px;font-size:9pt;">'
      + '<div style="width:44%;"><p style="font-size:8pt;color:#555;margin:0 0 60px 0;">Prepared By:</p>'
      + '<div style="font-weight:bold;color:#222;font-size:10pt;">' + prepBy + '</div>'
      + '<div style="color:#555;font-size:8.5pt;">' + prepTitle + '</div></div>'
      + '<div style="width:44%;"><p style="font-size:8pt;color:#555;margin:0 0 60px 0;">Checked By:</p>'
      + '<div style="font-weight:bold;color:#222;font-size:10pt;">' + chkBy + '</div>'
      + '<div style="color:#555;font-size:8.5pt;">' + chkTitle + '</div></div>'
      + '</div>';

    return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
      + '<style>@page{size:210mm 297mm;margin:15mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10pt;color:#222;}</style>'
      + '</head><body><div style="font-family:Arial,sans-serif;padding:28px 32px;color:#222;font-size:10pt;">'
      + hdr + soa + para + tbl + sig
      + '</div></body></html>';
  };

  const triggerPrint = async (row) => {
    setPrinting(row.billingNo);
    try {
      const html = await buildHtml(row);
      if (Platform.OS === 'web') {
        const blob    = new Blob([html], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        const iframe  = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;';
        document.body.appendChild(iframe);
        iframe.onload = () => {
          setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(blobUrl); }, 2000);
          }, 200);
        };
        iframe.src = blobUrl;
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'PDF', UTI: 'com.adobe.pdf' });
      }
    } catch (e) { Alert.alert('Print Error', e.message); }
    finally { setPrinting(null); }
  };

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(r =>
      fmtDate(r.date).toLowerCase().includes(q) ||
      r.billingNo.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  const openPayDropdown = () => {
    payBtnRef.current?.measureInWindow((x, y, w, h) => {
      setPayBtnPos({ top: y + h + 4, right: window?.innerWidth ? window.innerWidth - (x + w) : 16, width: 280 });
      setPayDropdown(true);
    });
  };

  const handlePayAll = async () => {
    const pending = rows.filter(r => r.status !== 'paid');
    if (!pending.length) { Alert.alert('Info', 'All entries are already paid.'); return; }
    try {
      for (const r of pending) await toggleStatus(r.id, 'pending');
      setPayDropdown(false);
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const handlePayRange = async () => {
    if (!payFrom) { Alert.alert('Input Required', 'Please enter a From date (YYYY-MM-DD).'); return; }
    const to = payTo || payFrom;
    const inRange = rows.filter(r => r.date >= payFrom && r.date <= to && r.status !== 'paid');
    if (!inRange.length) { Alert.alert('Info', 'No pending entries found in that date range.'); return; }
    try {
      for (const r of inRange) await toggleStatus(r.id, 'pending');
      setPayDropdown(false);
      setPayFrom(''); setPayTo('');
    } catch (e) { Alert.alert('Error', e.message); }
  };

  if (detailDate) {
    return (
      <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
        <View style={s.toolbar}>
          <TouchableOpacity style={s.backBtn} onPress={() => setDetailDate(null)}>
            <MaterialIcons name="arrow-back" size={16} color={NAVY} />
            <Text style={s.backBtnTxt}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={openAdd}>
            <MaterialIcons name="add" size={14} color={WHITE} />
            <Text style={s.addBtnTxt}>Add Entry</Text>
          </TouchableOpacity>
          <Text style={s.detailTitle} numberOfLines={1}>{fmtDate(detailDate)} \u2014 {MONTHS[month]} {year}</Text>
        </View>
        <View style={[s.deptSection, { maxHeight: winHeight * 0.55 }]}>
          <View style={s.detailThead}>
            <Text style={[s.th, { flex: 1.2, textAlign: 'left' }]}>DATE</Text>
            <Text style={[s.th, { flex: 1.2, textAlign: 'center' }]}>DEPT</Text>
            <Text style={[s.th, { flex: 1.3, textAlign: 'center' }]}>NAME</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>SACKS</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>PRICE/GAL</Text>
            <Text style={[s.th, { flex: 1.3, textAlign: 'center' }]}>AMOUNT</Text>
            <View style={{ flex: 1 }} />
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {detailEntries.length === 0
              ? <Text style={s.emptyTxt}>No entries yet.</Text>
              : detailEntries.map(item => (
                <View key={item.id} style={s.detailRow}>
                  <Text style={[s.td, { flex: 1.2, textAlign: 'left', color: TEXT_DARK }]}>{fmtDate(item.date)}</Text>
                  <Text style={[s.td, { flex: 1.2, textAlign: 'center', fontWeight: '700', color: TEXT_DARK }]}>{item.dept}</Text>
                  <Text style={[s.td, { flex: 1.3, textAlign: 'center' }]}>{item.gallons}</Text>
                  <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{fmt(item.priceGallon)}</Text>
                  <Text style={[s.td, { flex: 1.3, textAlign: 'center', fontWeight: '700', color: TEXT_DARK }]}>{fmt(item.amount)}</Text>
                  <View style={{ flex: 1, alignItems: 'center' }}>
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
        <EntryModal visible={modalVisible} category="waterbilling"
          editEntry={editEntry} presetDate={detailDate}
          year={year} month={month} onClose={() => setModalVisible(false)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      <View style={s.toolbar}>
        <TouchableOpacity style={s.addBtnMain} onPress={openAdd}>
          <MaterialIcons name="add" size={16} color={WHITE} />
          <Text style={s.addBtnMainTxt}>Add Entry</Text>
        </TouchableOpacity>
        <View style={s.searchBox}>
          <MaterialIcons name="search" size={16} color="#8a9bbf" />
          <TextInput
            style={s.searchInput}
            placeholder="Search date or billing no..."
            placeholderTextColor="#8a9bbf"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={15} color="#8a9bbf" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity ref={payBtnRef} style={s.payBtn} onPress={openPayDropdown}>
          <MaterialIcons name="payments" size={15} color={WHITE} />
          <Text style={s.payBtnTxt}>Pay</Text>
          <MaterialIcons name="keyboard-arrow-down" size={15} color={WHITE} />
        </TouchableOpacity>
      </View>

      <Modal visible={payDropdown} transparent animationType="none" statusBarTranslucent onRequestClose={() => { setPayDropdown(false); setSelectedDates([]); }}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => { setPayDropdown(false); setSelectedDates([]); }} />
        <View style={[s.payDrop, { position:'absolute', top: payBtnPos.top, right: payBtnPos.right, width: 280 }]}>
          <TouchableOpacity style={s.payDropItem} onPress={handlePayAll}>
            <MaterialIcons name="select-all" size={15} color={NAVY} />
            <Text style={s.payDropTxt}>Pay All Pending</Text>
          </TouchableOpacity>
          <View style={s.payDropDivider} />
          <View style={s.payDropSection}>
            <Text style={s.payDropLabel}>PAY BY DATE RANGE</Text>
            <TextInput
              style={s.payDateInput}
              placeholder="From (YYYY-MM-DD)"
              placeholderTextColor="#8a9bbf"
              value={payFrom}
              onChangeText={setPayFrom}
            />
            <TextInput
              style={s.payDateInput}
              placeholder="To (YYYY-MM-DD) optional"
              placeholderTextColor="#8a9bbf"
              value={payTo}
              onChangeText={setPayTo}
            />
            <TouchableOpacity style={s.payConfirmBtn} onPress={handlePayRange}>
              <Text style={s.payConfirmTxt}>Apply</Text>
            </TouchableOpacity>
          </View>
          <View style={s.payDropDivider} />
          <Text style={[s.payDropLabel, { paddingHorizontal:14, paddingTop:8 }]}>PAY SPECIFIC DATE</Text>
          <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={true}>
            {rows.filter(r => r.status !== 'paid').length === 0 ? (
              <Text style={s.payDropEmpty}>All entries are already paid</Text>
            ) : (
              rows.filter(r => r.status !== 'paid').map(r => {
                const checked = selectedDates.includes(r.date);
                return (
                  <TouchableOpacity
                    key={r.date}
                    style={s.payDropItem}
                    onPress={() => setSelectedDates(prev =>
                      prev.includes(r.date) ? prev.filter(d => d !== r.date) : [...prev, r.date]
                    )}
                  >
                    <View style={[s.checkbox, checked && s.checkboxChecked]}>
                      {checked && <MaterialIcons name="check" size={12} color={WHITE} />}
                    </View>
                    <Text style={s.payDropTxt}>{fmtDate(r.date)} — {r.billingNo}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          {selectedDates.length > 0 && (
            <View style={{ padding:10 }}>
              <TouchableOpacity
                style={s.payConfirmBtn}
                onPress={async () => {
                  try {
                    for (const date of selectedDates) {
                      const r = rows.find(x => x.date === date);
                      if (r) await toggleStatus(r.id, 'pending');
                    }
                    setSelectedDates([]);
                    setPayDropdown(false);
                  } catch (e) { Alert.alert('Error', e.message); }
                }}
              >
                <Text style={s.payConfirmTxt}>Pay Selected ({selectedDates.length})</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
      <View style={[s.deptSection, { maxHeight: winHeight * 0.55 }]}>
        <View style={s.thead}>
          <Text style={[s.th, { flex: 1, textAlign: 'left' }]}>DATE</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>BILLING NO.</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>TOTAL GALLONS</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>PRICE/GAL</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>AMOUNT</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>STATUS</Text>
          <View style={{ flex: 1.4 }} />
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {filteredRows.length === 0
            ? <Text style={s.emptyTxt}>{searchQuery ? 'No results found.' : `No entries yet for ${MONTHS[month]} ${year}.`}</Text>
            : filteredRows.map(d => (
              <View key={d.date} style={[s.row, searchQuery && s.rowHighlight]}>
                <TouchableOpacity
                  style={{ flex: 5, flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => setDetailDate(d.date)} activeOpacity={0.75}
                >
                  <Text style={[s.td, { flex: 1, textAlign: 'left', fontWeight: '700', color: TEXT_DARK }]}>{fmtDate(d.date)}</Text>
                  <Text style={[s.td, { flex: 1, textAlign: 'center', fontWeight: '700', color: TEXT_DARK }]}>{d.billingNo}</Text>
                  <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{d.totalGallons}</Text>
                  <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{fmt(d.priceGallon)}</Text>
                  <Text style={[s.td, { flex: 1, textAlign: 'center', fontWeight: '700', color: TEXT_DARK }]}>{fmt(d.totalAmt)}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[s.statusBtn, d.status === 'paid' ? s.statusPaid : s.statusPending]}
                    onPress={() => handleToggle({ id: d.id, status: d.status })}
                  >
                    <MaterialIcons name={d.status === 'paid' ? 'check-circle' : 'hourglass-empty'} size={11} color={d.status === 'paid' ? '#1a6e2e' : '#b36200'} />
                    <Text style={[s.statusTxt, { color: d.status === 'paid' ? '#1a6e2e' : '#b36200' }]}>
                      {d.status === 'paid' ? 'PAID' : 'PENDING'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <TouchableOpacity style={s.printBtn} onPress={() => triggerPrint(d)} disabled={printing === d.billingNo}>
                    <MaterialIcons name="print" size={11} color="#b07d00" />
                    <Text style={s.printBtnTxt}>{printing === d.billingNo ? '...' : 'PRINT'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.downloadBtn} onPress={() => triggerPrint(d)} disabled={printing === d.billingNo}>
                    <MaterialIcons name="download" size={11} color="#1a6e2e" />
                    <Text style={s.downloadBtnTxt}>DOWNLOAD</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          }
        </ScrollView>
        <View style={s.grandTotalBar}>
          <Text style={s.grandLbl}>GRAND TOTAL</Text>
          <Text style={s.grandVal}>{fmt(grandTotal)}</Text>
        </View>
      </View>
      <EntryModal visible={modalVisible} category="waterbilling"
        editEntry={editEntry} year={year} month={month}
        onClose={() => setModalVisible(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  toolbar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, gap: 10 },
  addBtnMain:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: GREEN, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  addBtnMainTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: WHITE },
  searchBox: {
    width: 220, flexDirection:'row', alignItems:'center', gap:8,
    backgroundColor:WHITE, borderRadius:8, borderWidth:1.5,
    borderColor:'#d0d9ec', paddingHorizontal:10, paddingVertical:6,
  },
  searchInput: {
    flex:1, fontFamily:'GoogleSans_400Regular', fontSize:13,
    color:TEXT_DARK, outlineStyle:'none',
  },
  payBtn: {
    flexDirection:'row', alignItems:'center', gap:5,
    backgroundColor:NAVY, borderRadius:8,
    paddingVertical:8, paddingHorizontal:14,
  },
  payBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:WHITE },
  payDrop: {
    backgroundColor:WHITE, borderRadius:12,
    borderWidth:1, borderColor:'#d0d9ec',
    shadowColor:'#000', shadowOpacity:0.18, shadowRadius:14,
    shadowOffset:{ width:0, height:4 }, elevation:16,
    overflow:'hidden', minWidth:260, maxHeight:460,
  },
  payDropItem: {
    flexDirection:'row', alignItems:'center', gap:10,
    paddingHorizontal:14, paddingVertical:12,
    borderBottomWidth:1, borderBottomColor:'#f0f2f8',
  },
  payDropTxt: { fontFamily:'GoogleSans_400Regular', fontSize:13, color:TEXT_DARK, flex:1 },
  payDropDivider: { height:1, backgroundColor:'#e8ecf5' },
  payDropSection: { padding:12, gap:8 },
  payDropLabel: {
    fontFamily:'GoogleSans_700Bold', fontSize:10,
    color:'#8a9bbf', letterSpacing:0.8, textTransform:'uppercase',
    paddingHorizontal:14, paddingBottom:4,
  },
  payDateInput: {
    borderWidth:1.5, borderColor:'#d0d9ec', borderRadius:8,
    paddingHorizontal:10, paddingVertical:7,
    fontFamily:'GoogleSans_400Regular', fontSize:13, color:TEXT_DARK,
    outlineStyle:'none',
  },
  payConfirmBtn: {
    backgroundColor:NAVY, borderRadius:8,
    paddingVertical:8, alignItems:'center',
  },
  payConfirmTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:WHITE },
  payDropEmpty: {
    fontFamily:'GoogleSans_400Regular', fontSize:12,
    color:'#8a9bbf', textAlign:'center', padding:12,
  },
  checkbox: {
    width:18, height:18, borderRadius:4, borderWidth:2,
    borderColor:NAVY, alignItems:'center', justifyContent:'center',
    marginRight:4,
  },
  checkboxChecked: { backgroundColor:NAVY, borderColor:NAVY },
  rowHighlight: { backgroundColor:'#e8f0ff' },
  deptSection:   { flex: 1, flexDirection: 'column', backgroundColor: WHITE, borderRadius: 14, marginHorizontal: 48, marginBottom: 10, shadowColor: '#1a2456', shadowOpacity: 0.13, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5, overflow: 'hidden' },
  detailThead:   { flexDirection: 'row', alignItems: 'center', backgroundColor: NAVY, paddingVertical: 9, paddingHorizontal: 12, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  detailRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: TD_BG, paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: ROW_BDR },
  thead:         { flexDirection: 'row', alignItems: 'center', backgroundColor: NAVY, paddingVertical: 14, paddingHorizontal: 12, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  th:            { fontFamily: 'GoogleSans_700Bold', fontSize: 13, fontWeight: '800', color: WHITE, letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' },
  row:           { flexDirection: 'row', alignItems: 'center', backgroundColor: TD_BG, paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: ROW_BDR },
  td:            { fontFamily: 'GoogleSans_400Regular', fontSize: 15, color: TEXT_DARK, textAlign: 'center' },
  grandTotalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: GRAND_GN, paddingVertical: 14, paddingHorizontal: 24, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  grandLbl:      { fontFamily: 'GoogleSans_700Bold', fontSize: 13, fontWeight: '800', color: WHITE, letterSpacing: 0.5 },
  grandVal:      { fontFamily: 'NotoSerif_700Bold', fontSize: 16, fontWeight: '800', color: WHITE },
  statusBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, minWidth: 72, justifyContent: 'center' },
  statusPaid:    { backgroundColor: '#d4f5e2', borderWidth: 1.5, borderColor: '#1a6e2e' },
  statusPending: { backgroundColor: '#fff4e0', borderWidth: 1.5, borderColor: '#e0a800' },
  statusTxt:     { fontFamily: 'GoogleSans_700Bold', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  printBtn:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff8e1', borderWidth: 1.5, borderColor: '#e0a800', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, minWidth: 70, justifyContent: 'center' },
  printBtnTxt:   { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#b07d00', letterSpacing: 0.5, textTransform: 'uppercase' },
  downloadBtn:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e8f7ef', borderWidth: 1.5, borderColor: '#2e9e5b', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, minWidth: 70, justifyContent: 'center' },
  downloadBtnTxt:{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#1a6e2e', letterSpacing: 0.5, textTransform: 'uppercase' },
  backBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(48,70,116,0.10)', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(48,70,116,0.20)' },
  backBtnTxt:    { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: NAVY },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: NAVY, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  addBtnTxt:     { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: WHITE },
  detailTitle:   { flex: 1, fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: NAVY },
  editBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e8f0ff', borderRadius: 5, paddingVertical: 5, paddingHorizontal: 12, borderWidth: 1.5, borderColor: '#304674' },
  editBtnTxt:    { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: NAVY, letterSpacing: 0.5 },
  emptyTxt:      { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(1,31,75,0.40)', textAlign: 'center', padding: 24 },
});