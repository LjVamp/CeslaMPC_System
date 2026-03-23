// src/components/PrintReportModal.js
// CESLA MPC — Print Annual Report Modal

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, FlatList, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { useBilling, MONTHS, DEPARTMENTS, fmtDate } from '../context/BillingContext';

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  navyDark:  '#304674',
  navyMid:   '#98bad5',
  textDark:  '#2c5f80',
  textMid:   '#4a7a9b',
  grayLight: '#f4f6fb',
  grayMid:   '#e2e6f0',
  white:     '#ffffff',
  blue:      '#6497b1',
};

const MONTH_OPTIONS = [
  { label: '— Do Not Print —', value: 'skip' },
  { label: 'All Months',       value: 'all'  },
  ...MONTHS.map((m, i) => ({ label: m, value: String(i) })),
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => CURRENT_YEAR - 5 + i);
const YEAR_OPTIONS = YEARS.map(y => ({ label: String(y), value: String(y) }));

const CAT_DEFS = [
  { key: 'freelunch',      label: 'FREE LUNCH'      },
  { key: 'riceallowances', label: 'RICE ALLOWANCES' },
  { key: 'waterbilling',   label: 'WATER BILLING'   },
  { key: 'milkbeans',      label: 'MILK & BEANS'    },
  { key: 'ticket',         label: 'TICKET'          },
];

// ─────────────────────────────────────────────────────────────────────────────
// DropdownField — uses its own transparent Modal so the list renders at
// the ROOT level, escaping every ScrollView / overflow:hidden clip.
// This is the only reliable way in React Native.
// The dropdown Modal is INSIDE the parent Modal — React Native handles
// nested Modals fine on both iOS and Android as long as we don't put any
// OTHER content (buttons, inputs) inside the inner modal.
// ─────────────────────────────────────────────────────────────────────────────
function DropdownField({ value, onChange, options }) {
  const [open,    setOpen]    = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef(null);
  const selected = options.find(o => o.value === value) || options[0];

  const handleOpen = () => {
    btnRef.current?.measureInWindow((x, y, w, h) => {
      setDropPos({ top: y + h + 2, left: x, width: w });
      setOpen(true);
    });
  };

  return (
    <View>
      {/* Trigger */}
      <TouchableOpacity
        ref={btnRef}
        style={dd.btn}
        onPress={handleOpen}
        activeOpacity={0.8}
      >
        <Text style={dd.btnTxt} numberOfLines={1}>{selected.label}</Text>
        <MaterialIcons
          name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={20}
          color={C.textMid}
        />
      </TouchableOpacity>

      {/* Floating list — rendered at window root via Modal */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        {/* Tap outside = close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        />

        {/* List card — absolutely positioned under the button */}
        <View style={[dd.list, {
          position: 'absolute',
          top:   dropPos.top,
          left:  dropPos.left,
          width: dropPos.width,
        }]}>
          <FlatList
            data={options}
            keyExtractor={o => o.value}
            bounces={false}
            style={{ maxHeight: 260 }}
            showsVerticalScrollIndicator
            renderItem={({ item: opt }) => (
              <TouchableOpacity
                style={[dd.item, opt.value === value && dd.itemActive]}
                onPress={() => { onChange(opt.value); setOpen(false); }}
              >
                <Text style={[dd.itemTxt, opt.value === value && dd.itemTxtActive]}>
                  {opt.label}
                </Text>
                {opt.value === value && (
                  <MaterialIcons name="check" size={14} color={C.navyDark} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const dd = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: C.grayMid,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.white,
  },
  btnTxt: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 13,
    color: C.textDark,
    flex: 1,
  },
  list: {
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.grayMid,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 16,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f8',
  },
  itemActive: { backgroundColor: 'rgba(48,70,116,0.07)' },
  itemTxt: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 13,
    color: C.textDark,
  },
  itemTxtActive: {
    fontFamily: 'GoogleSans_700Bold',
    color: C.navyDark,
  },
});

// ── Main Component ────────────────────────────────────────────────────────────
export default function PrintReportModal({ visible, onClose }) {
  const { settings, entries } = useBilling();

  const [printYear, setPrintYear] = useState(String(CURRENT_YEAR));
  const [printing,  setPrinting]  = useState(false);
  const [catMonths, setCatMonths] = useState({
    freelunch: 'skip', riceallowances: 'skip',
    waterbilling: 'skip', milkbeans: 'skip', ticket: 'skip',
  });

  useEffect(() => {
    if (visible) {
      setPrintYear(String(CURRENT_YEAR));
      setCatMonths({
        freelunch: 'skip', riceallowances: 'skip',
        waterbilling: 'skip', milkbeans: 'skip', ticket: 'skip',
      });
      setPrinting(false);
    }
  }, [visible]);

  const setCat = (key, val) => setCatMonths(p => ({ ...p, [key]: val }));

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getEnt = (cat, year, month, dept) =>
    entries.filter(e =>
      e.category === cat && e.year === year &&
      e.month === month && e.dept === dept
    );

  const monthIndices = (val) => {
    if (val === 'skip') return null;
    if (val === 'all')  return [...Array(12).keys()];
    return [parseInt(val)];
  };

  const peso = (n) =>
    Number(n || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });

  // ── Build HTML ────────────────────────────────────────────────────────────
  // ── Build HTML ────────────────────────────────────────────────────────────
  const buildHTML = async () => {
    const yr        = parseInt(printYear);
    const prepBy    = settings?.preparedBy    || '________________________';
    const prepTitle = settings?.preparedTitle || '';
    const chkBy     = settings?.checkedBy     || '________________________';
    const chkTitle  = settings?.checkedTitle  || '';

    // Load logo as base64
    let logoImg = '';
    try {
      const asset = await Asset.fromModule(require('../../assets/CESLA_logo.png')).downloadAsync();
      const lu = asset.localUri || asset.uri || '';
      if (lu) {
        const resp = await fetch(lu);
        const blob = await resp.blob();
        const b64  = await new Promise(res => { const r = new FileReader(); r.onloadend = () => res(r.result); r.readAsDataURL(blob); });
        logoImg = '<img src="' + b64 + '" class="run-logo" alt="logo" />';
      }
    } catch (_) {}

    const runHdr = '<div class="run-hdr">' + logoImg + '<div>'
      + '<div class="run-title">CESLA Billing Monitoring System</div>'
      + '<div class="run-sub">Comprehensive Expense &amp; Statement Ledger Application</div>'
      + '<div class="run-yr">Annual Billing Report \u2014 ' + yr + '</div>'
      + '</div></div>';

    const sigBlock = '<div class="sigs">'
      + '<div class="sig-col"><p class="sig-lbl">Prepared By:</p>'
      + '<div class="sig-space"></div>'
      + '<div class="sig-name">' + prepBy + '</div>'
      + '<div class="sig-role">' + prepTitle + '</div></div>'
      + '<div class="sig-col"><p class="sig-lbl">Checked By:</p>'
      + '<div class="sig-space"></div>'
      + '<div class="sig-name">' + chkBy + '</div>'
      + '<div class="sig-role">' + chkTitle + '</div></div>'
      + '</div>';

    const soaHead = (period, billingNo, desc) =>
      '<div class="soa-center">'
      + '<div class="soa-main">STATEMENT OF ACCOUNT</div>'
      + '<div class="soa-period">as of ' + period.toUpperCase() + '</div>'
      + '<div class="soa-billing">BILLING NO.: ' + billingNo + '</div>'
      + '</div>'
      + '<div class="divider"></div>'
      + '<p class="soa-body">' + desc + '</p>';

    const dateRange = (allDates, yr) => {
      if (!allDates.length) return '';
      const f = new Date(allDates[0] + 'T00:00:00');
      const l = new Date(allDates[allDates.length - 1] + 'T00:00:00');
      const mStr = f.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
      const fd = String(f.getDate()).padStart(2, '0');
      const ld = String(l.getDate()).padStart(2, '0');
      return fd === ld ? mStr + ' ' + fd + ', ' + yr : mStr + ' ' + fd + '-' + ld + ', ' + yr;
    };

    const getUniqDates = (cat, yr, mIdx) => {
      const set = new Set();
      DEPARTMENTS.forEach(dept => {
        getEnt(cat, yr, mIdx, dept).forEach(e => { if (e.date) set.add(e.date); });
      });
      return [...set].sort();
    };

    const css = '@page{size:210mm 297mm;margin:15mm}'
      + '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{font-family:Arial,sans-serif;font-size:10pt;color:#111;background:#fff}'
      + '.page{page-break-after:always;padding-bottom:24px}'
      + '.page:last-child{page-break-after:avoid}'
      + '.run-hdr{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1a2a4a;padding-bottom:10px;margin-bottom:20px}'
      + '.run-logo{width:55px;height:55px;border-radius:50%;border:2px solid #1a2a4a}'
      + '.run-title{font-size:15pt;font-weight:900;color:#1a2a4a}'
      + '.run-sub{font-size:9pt;color:#444;margin-top:2px}'
      + '.run-yr{font-size:10pt;font-weight:bold;color:#1a2a4a;margin-top:3px}'
      + '.soa-center{text-align:center;margin-bottom:10px}'
      + '.soa-main{font-size:14pt;font-weight:900;color:#1a2a4a;text-transform:uppercase;letter-spacing:.5px}'
      + '.soa-period{font-size:10pt;color:#333;margin-top:5px}'
      + '.soa-billing{font-size:10pt;font-weight:700;color:#1a2a4a;margin-top:4px}'
      + '.divider{height:1.5px;background:#1a2a4a;margin:12px 0 14px}'
      + '.soa-body{font-size:11pt;color:#222;line-height:1.8;margin-bottom:16px}'
      + '.cat-title{font-size:14pt;font-weight:900;color:#1a2a4a;border-bottom:3px solid #1a2a4a;padding-bottom:5px;margin:14px 0 10px;text-transform:uppercase;letter-spacing:.5px}'
      + '.dept-title{font-size:10pt;font-weight:bold;background:#1a2a4a;color:#fff;padding:6px 10px;margin-top:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + 'table{width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:8px}'
      + 'th{background:#dce3f0;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:1px solid #666;padding:6px 9px;text-align:left;font-weight:bold;color:#1a2a4a}'
      + 'td{border:1px solid #888;padding:6px 9px}'
      + 'tr.sub td{background:#dce3f0;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-weight:bold;border-top:2px solid #1a2a4a;color:#1a2a4a}'
      + '.cat-total{text-align:right;font-weight:bold;font-size:11pt;padding:6px 0;color:#1a2a4a;border-top:2px solid #1a2a4a;margin-top:4px}'
      + '.sum-tbl th{background:#dce3f0;-webkit-print-color-adjust:exact;print-color-adjust:exact;color:#1a2a4a;padding:9px 14px;font-size:11pt;font-weight:bold;border:1px solid #666}'
      + '.sum-tbl td{border:1px solid #888;padding:8px 14px;font-size:11pt}'
            + '.grand-bar{background:#1a6e2e;-webkit-print-color-adjust:exact;print-color-adjust:exact;color:#fff;display:flex;justify-content:space-between;padding:12px 16px;font-weight:bold;font-size:12pt;margin-top:20px}'
      + '.sigs{display:flex;justify-content:space-between;margin-top:60px;font-size:10pt}'
      + '.sig-col{width:45%}'
      + '.sig-lbl{font-size:9pt;color:#444;margin-bottom:0}'
      + '.sig-space{height:55px}'
      
      + '.sig-name{font-weight:bold;font-size:10pt;color:#1a2a4a}'
      + '.sig-role{color:#444;font-size:9pt;margin-top:2px}';

    let pages = '';
    const totals = { freelunch: 0, riceallowances: 0, waterbilling: 0, milkbeans: 0, ticket: 0 };

    // FREE LUNCH
    const flIdx = monthIndices(catMonths.freelunch);
    if (flIdx) {
      flIdx.forEach(mIdx => {
        const mn = MONTHS[mIdx], mm = String(mIdx + 1).padStart(2, '0');
        const period = mn + ' ' + yr;
        const allDates = getUniqDates('freelunch', yr, mIdx);
        if (!allDates.length) return;
        const dRange = dateRange(allDates, yr) || period.toUpperCase();
        const allPaid = allDates.every(d =>
          entries.filter(e => e.category === 'freelunch' && e.year === yr && e.month === mIdx && e.date === d)
            .every(e => e.status === 'paid')
        );
        const paidClause = allPaid ? ' paid by CEC to wit:' : ':';
        let rows = '', mTotal = 0;
        DEPARTMENTS.forEach(dept => {
          const ents = getEnt('freelunch', yr, mIdx, dept);
          const pax  = ents.reduce((s, e) => s + (parseFloat(e.pax) || 0), 0);
          const amt  = ents.reduce((s, e) => s + (e.amount || 0), 0);
          const aPax = ents.length ? (ents[0].amtPerPax || 0) : 0;
          mTotal += amt;
          rows += '<tr><td>' + period + '</td><td style="text-align:center;font-weight:bold">' + dept + '</td>'
            + '<td style="text-align:center">' + pax + '</td>'
            + '<td style="text-align:right">' + peso(aPax) + '</td>'
            + '<td style="text-align:right">' + peso(amt) + '</td></tr>';
        });
        totals.freelunch += mTotal;
        pages += '<div class="page">' + runHdr
          + soaHead(period, 'FL ' + yr + '-' + mm,
              'This is to bill CLIMBS LIFE &amp; GENERAL INSURANCE COOPERATIVE for the Friday Free Lunch dated ' + dRange + paidClause)
          + '<table><thead><tr><th>Months</th><th>Department</th><th>NO. OF Pax</th><th>/Pax</th><th>AMOUNT</th></tr></thead>'
          + '<tbody>' + rows + '</tbody>'
          + '<tfoot><tr class="sub"><td colspan="3" style="border:none;background:none"></td>'
          + '<td style="text-align:right">GRAND TOTAL:</td><td style="text-align:right">' + peso(mTotal) + '</td></tr></tfoot></table>'
          + sigBlock + '</div>';
      });
    }

    // RICE ALLOWANCES
    const raIdx = monthIndices(catMonths.riceallowances);
    if (raIdx) {
      raIdx.forEach(mIdx => {
        const mn = MONTHS[mIdx], mm = String(mIdx + 1).padStart(2, '0');
        const period = mn + ' ' + yr;
        // Get ALL entries for this category/month regardless of dept
        const allEnts = entries.filter(e =>
          e.category === 'riceallowances' && e.year === yr && e.month === mIdx
        );
        if (!allEnts.length) return;
        // Get unique dates
        const allDates = [...new Set(allEnts.map(e => e.date).filter(Boolean))].sort();
        const dRange = dateRange(allDates, yr) || period.toUpperCase();
        // Paid only if ALL entries are paid
        const allPaid = allEnts.length > 0 && allEnts.every(e => e.status === 'paid');
        const paidClause = allPaid ? ' paid by CEC to wit:' : ':';
        let rows = '', mTotal = 0;
        allEnts.forEach(e => {
          const amt = e.amount || 0;
          mTotal += amt;
          rows += '<tr>'
            + '<td>' + period + '</td>'
            + '<td>' + (e.name || '') + '</td>'
            + '<td style="text-align:center;font-weight:bold">' + (e.dept || '') + '</td>'
            + '<td style="text-align:center">' + (e.sacks || 0) + '</td>'
            + '<td style="text-align:right">' + peso(e.priceSac) + '</td>'
            + '<td style="text-align:right">' + peso(amt) + '</td>'
            + '</tr>';
        });
        totals.riceallowances += mTotal;
        pages += '<div class="page">' + runHdr
          + soaHead(period, 'RA ' + yr + '-' + mm,
              'This is to bill CLIMBS LIFE &amp; GENERAL INSURANCE COOPERATIVE for the Rice Allowance dated ' + dRange + paidClause)
          + '<table><thead><tr><th>Months</th><th>Name</th><th>Department</th><th>No. of Sac</th><th>Price/Sac</th><th>AMOUNT</th></tr></thead>'
          + '<tbody>' + rows + '</tbody>'
          + '<tfoot><tr class="sub"><td colspan="4" style="border:none;background:none"></td>'
          + '<td style="text-align:right">GRAND TOTAL:</td>'
          + '<td style="text-align:right">' + peso(mTotal) + '</td></tr></tfoot></table>'
          + sigBlock + '</div>';
      });
    }

    // WATER BILLING
    const wbIdx = monthIndices(catMonths.waterbilling);
    if (wbIdx) {
      wbIdx.forEach(mIdx => {
        const mn = MONTHS[mIdx], mm = String(mIdx + 1).padStart(2, '0');
        const period = mn + ' ' + yr;
        const allDates = getUniqDates('waterbilling', yr, mIdx);
        if (!allDates.length) return;
        const dRange = dateRange(allDates, yr) || period.toUpperCase();
        const allPaid = allDates.every(d =>
          DEPARTMENTS.flatMap(dept => getEnt('waterbilling', yr, mIdx, dept))
            .filter(e => e.date === d).every(e => e.status === 'paid')
        );
        const paidClause = allPaid ? ' paid by CEC to wit:' : ':';
        let rows = '', mTotal = 0;
        DEPARTMENTS.forEach(dept => {
          const ents = getEnt('waterbilling', yr, mIdx, dept);
          const gal  = ents.reduce((s, e) => s + (parseFloat(e.gallons) || 0), 0);
          const amt  = ents.reduce((s, e) => s + (e.amount || 0), 0);
          const cpg  = ents.length ? (ents[0].priceGallon || 0) : 0;
          mTotal += amt;
          rows += '<tr><td>' + period + '</td><td style="text-align:center;font-weight:bold">' + dept + '</td>'
            + '<td style="text-align:center">' + gal + '</td>'
            + '<td style="text-align:right">' + peso(cpg) + '</td>'
            + '<td style="text-align:right">' + peso(amt) + '</td></tr>';
        });
        totals.waterbilling += mTotal;
        pages += '<div class="page">' + runHdr
          + soaHead(period, 'PD ' + yr + '-' + mm,
              'This is to bill CLIMBS LIFE &amp; GENERAL INSURANCE COOPERATIVE for the Mineral Water Supply dated ' + dRange + paidClause)
          + '<table><thead><tr><th>Months</th><th>Department</th><th>NO. OF Gallon</th><th>Price/Gallon</th><th>AMOUNT</th></tr></thead>'
          + '<tbody>' + rows + '</tbody>'
          + '<tfoot><tr class="sub"><td colspan="3" style="border:none;background:none"></td>'
          + '<td style="text-align:right">GRAND TOTAL:</td><td style="text-align:right">' + peso(mTotal) + '</td></tr></tfoot></table>'
          + sigBlock + '</div>';
      });
    }

    // MILK & BEANS
    const mbIdx = monthIndices(catMonths.milkbeans);
    if (mbIdx) {
      mbIdx.forEach(mIdx => {
        const mn = MONTHS[mIdx], mm = String(mIdx + 1).padStart(2, '0');
        const period = mn + ' ' + yr;
        const allDates = getUniqDates('milkbeans', yr, mIdx);
        if (!allDates.length) return;
        const dRange = dateRange(allDates, yr) || period.toUpperCase();
        const allPaid = allDates.every(d =>
          DEPARTMENTS.flatMap(dept => getEnt('milkbeans', yr, mIdx, dept))
            .filter(e => e.date === d).every(e => e.status === 'paid')
        );
        const paidClause = allPaid ? ' paid by CEC to wit:' : ':';
        let rows = '', mTotal = 0;
        DEPARTMENTS.forEach(dept => {
          getEnt('milkbeans', yr, mIdx, dept).forEach(e => {
            mTotal += e.amount || 0;
            const mQ = e.milkType  !== 'None' ? e.milkQty  : '\u2014';
            const mP = e.milkType  !== 'None' ? peso(e.milkPrice)  : '\u2014';
            const bQ = e.beansType !== 'None' ? e.beansQty : '\u2014';
            const bP = e.beansType !== 'None' ? peso(e.beansPrice) : '\u2014';
            rows += '<tr><td>' + period + '</td><td style="text-align:center;font-weight:bold">' + dept + '</td>'
              + '<td style="text-align:center">' + mQ + '</td><td style="text-align:right">' + mP + '</td>'
              + '<td style="text-align:center">' + bQ + '</td><td style="text-align:right">' + bP + '</td>'
              + '<td style="text-align:right">' + peso(e.amount) + '</td></tr>';
          });
        });
        totals.milkbeans += mTotal;
        pages += '<div class="page">' + runHdr
          + soaHead(period, 'MB ' + yr + '-' + mm,
              'This is to bill CLIMBS LIFE &amp; GENERAL INSURANCE COOPERATIVE for the Milk &amp; Beans Supply dated ' + dRange + paidClause)
          + '<table><thead><tr><th>Months</th><th>Department</th><th>Milk QTY</th><th>Milk Price</th><th>Beans QTY</th><th>Beans Price</th><th>AMOUNT</th></tr></thead>'
          + '<tbody>' + (rows || '<tr><td colspan="7" style="text-align:center;font-style:italic;color:#888">No entries.</td></tr>') + '</tbody>'
          + '<tfoot><tr class="sub"><td colspan="5" style="border:none;background:none"></td>'
          + '<td style="text-align:right">GRAND TOTAL:</td><td style="text-align:right">' + peso(mTotal) + '</td></tr></tfoot></table>'
          + sigBlock + '</div>';
      });
    }

    // TICKET
    const tkIdx = monthIndices(catMonths.ticket);
    if (tkIdx) {
      tkIdx.forEach(mIdx => {
        const mn = MONTHS[mIdx], mm = String(mIdx + 1).padStart(2, '0');
        const period = mn + ' ' + yr;
        // Get ALL entries for this category/month regardless of dept
        const allEnts = entries.filter(e =>
          e.category === 'ticket' && e.year === yr && e.month === mIdx
        );
        if (!allEnts.length) return;
        const allDates = [...new Set(allEnts.map(e => e.date).filter(Boolean))].sort();
        const dRange = dateRange(allDates, yr) || period.toUpperCase();
        // Paid only if ALL entries are paid
        const allPaid = allEnts.length > 0 && allEnts.every(e => e.status === 'paid');
        const paidClause = allPaid ? ' paid by CEC to wit:' : ':';
        let rows = '', mTotal = 0;
        allEnts.forEach(e => {
          const amt = e.amount || 0;
          mTotal += amt;
          rows += '<tr>'
            + '<td>' + period + '</td>'
            + '<td>' + (e.name || '') + '</td>'
            + '<td style="text-align:center;font-weight:bold">' + (e.dept || '') + '</td>'
            + '<td style="text-align:center">' + (e.tickets || 0) + '</td>'
            + '<td style="text-align:right">' + peso(e.amtTicket) + '</td>'
            + '<td style="text-align:right">' + peso(amt) + '</td>'
            + '</tr>';
        });
        totals.ticket += mTotal;
        pages += '<div class="page">' + runHdr
          + soaHead(period, 'TK ' + yr + '-' + mm,
              'This is to bill CLIMBS LIFE &amp; GENERAL INSURANCE COOPERATIVE for the Ticket dated ' + dRange + paidClause)
          + '<table><thead><tr><th>Months</th><th>Name</th><th>Department</th><th>No. of Ticket</th><th>Price/Ticket</th><th>AMOUNT</th></tr></thead>'
          + '<tbody>' + rows + '</tbody>'
          + '<tfoot><tr class="sub"><td colspan="4" style="border:none;background:none"></td>'
          + '<td style="text-align:right">GRAND TOTAL:</td>'
          + '<td style="text-align:right">' + peso(mTotal) + '</td></tr></tfoot></table>'
          + sigBlock + '</div>';
      });
    }

    // GRAND TOTAL SUMMARY
    const grand = Object.values(totals).reduce((a, b) => a + b, 0);
    pages += '<div class="page">' + runHdr
      + '<div class="cat-title">Grand Total Billings \u2014 ' + yr + '</div>'
      + '<table class="sum-tbl"><thead><tr><th>Category</th><th style="text-align:right">Total Amount</th></tr></thead><tbody>'
      + '<tr><td>Free Lunch</td><td style="text-align:right">' + peso(totals.freelunch) + '</td></tr>'
      + '<tr><td>Rice Allowances</td><td style="text-align:right">' + peso(totals.riceallowances) + '</td></tr>'
      + '<tr><td>Water Billing</td><td style="text-align:right">' + peso(totals.waterbilling) + '</td></tr>'
      + '<tr><td>Milk &amp; Beans</td><td style="text-align:right">' + peso(totals.milkbeans) + '</td></tr>'
      + '<tr><td>Ticket</td><td style="text-align:right">' + peso(totals.ticket) + '</td></tr>'
      + '</tbody></table>'
      + '<div class="grand-bar"><span>GRAND TOTAL \u2014 ALL BILLINGS (' + yr + ')</span><span>' + peso(grand) + '</span></div>'
      + sigBlock + '</div>';

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
      + '<style>' + css + '</style></head><body>' + pages + '</body></html>';
  };



  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (Object.values(catMonths).every(v => v === 'skip')) {
      Alert.alert('Nothing Selected', 'Please select at least one category and month to print.');
      return;
    }
    setPrinting(true);
    try {
      const html = await buildHTML();
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
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Print Annual Report', UTI: 'com.adobe.pdf' });
      }
    } catch (e) {
      Alert.alert('Print Error', e.message || 'Could not open print dialog.');
    } finally {
      setPrinting(false);
    }
  };

  const prepBy    = settings?.preparedBy    || '________________________';
  const prepTitle = settings?.preparedTitle || '';
  const chkBy     = settings?.checkedBy     || '________________________';
  const chkTitle  = settings?.checkedTitle  || '';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>

        {/* Backdrop */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Card */}
        <View style={s.card}>

          {/* Header */}
          <View style={s.titleRow}>
            <MaterialIcons name="print" size={20} color={C.navyDark} />
            <Text style={s.title}>Print Annual Report</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <MaterialIcons name="close" size={20} color={C.textMid} />
            </TouchableOpacity>
          </View>

          {/* Scrollable body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Year */}
            <Text style={s.label}>SELECT YEAR TO PRINT</Text>
            <DropdownField
              value={printYear}
              onChange={setPrintYear}
              options={YEAR_OPTIONS}
            />

            {/* Per-category months */}
            <View style={s.sectionHead}>
              <Text style={s.sectionHeadTxt}>SELECT MONTH PER CATEGORY</Text>
            </View>

            {CAT_DEFS.map(cat => (
              <View key={cat.key} style={s.catRow}>
                <Text style={s.catLabel}>{cat.label}</Text>
                <DropdownField
                  value={catMonths[cat.key]}
                  onChange={val => setCat(cat.key, val)}
                  options={MONTH_OPTIONS}
                />
              </View>
            ))}

            {/* Info */}
            <View style={s.infoBox}>
              <MaterialIcons name="info-outline" size={13} color={C.textMid} />
              <Text style={s.infoTxt}>
                <Text style={s.infoBold}>Prepared By</Text> and{' '}
                <Text style={s.infoBold}>Checked By</Text> are set in Settings (⚙️).
              </Text>
            </View>

            {/* Prepared By */}
            <Text style={s.label}>PREPARED BY (PREVIEW)</Text>
            <View style={s.roField}>
              <Text style={s.roName}>{prepBy}</Text>
            </View>
            {prepTitle ? (
              <View style={[s.roField, { marginTop: 5 }]}>
                <Text style={s.roRole}>{prepTitle}</Text>
              </View>
            ) : null}

            {/* Checked By */}
            <Text style={[s.label, { marginTop: 14 }]}>CHECKED BY (PREVIEW)</Text>
            <View style={s.roField}>
              <Text style={s.roName}>{chkBy}</Text>
            </View>
            {chkTitle ? (
              <View style={[s.roField, { marginTop: 5 }]}>
                <Text style={s.roRole}>{chkTitle}</Text>
              </View>
            ) : null}

          </ScrollView>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.printBtn, printing && { opacity: 0.65 }]}
              onPress={handlePrint}
              disabled={printing}
            >
              {printing
                ? <ActivityIndicator color={C.white} size="small" />
                : <MaterialIcons name="print" size={17} color={C.white} />
              }
              <Text style={s.printBtnTxt}>
                {printing ? 'Preparing...' : 'Print'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,16,50,0.60)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.30,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: C.grayMid,
    paddingBottom: 14,
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 17,
    fontWeight: '800',
    color: C.navyDark,
  },
  closeBtn: { padding: 4 },
  scrollContent: {
    gap: 10,
    paddingTop: 12,
    paddingBottom: 20,
  },
  label: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: C.textMid,
    marginBottom: 4,
  },
  sectionHead: {
    backgroundColor: '#eef1f8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  sectionHeadTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 10,
    fontWeight: '700',
    color: C.textDark,
    letterSpacing: 0.6,
  },
  catRow: { gap: 4 },
  catLabel: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 11,
    fontWeight: '700',
    color: C.blue,
    letterSpacing: 0.3,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f0f5fb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'flex-start',
    marginTop: 4,
  },
  infoTxt: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 11,
    color: C.textMid,
    flex: 1,
    lineHeight: 17,
  },
  infoBold: {
    fontFamily: 'GoogleSans_700Bold',
    fontWeight: '800',
  },
  roField: {
    backgroundColor: C.grayLight,
    borderWidth: 2,
    borderColor: C.grayMid,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roName: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 13,
    color: C.navyMid,
  },
  roRole: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 12,
    color: C.textMid,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: C.grayMid,
    paddingTop: 14,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.grayMid,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },
  cancelTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 14,
    color: C.textMid,
  },
  printBtn: {
    flex: 2,
    backgroundColor: C.navyDark,
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  printBtnTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 14,
    fontWeight: '800',
    color: C.white,
  },
});