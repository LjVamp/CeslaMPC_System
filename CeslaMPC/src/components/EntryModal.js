// src/components/EntryModal.js
// CESLA MPC — Add/Edit Entry Modal
// Department = floating dropdown, Date = custom calendar with month/year picker

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useBilling, DEPARTMENTS, DEPARTMENTS_EXTENDED, todayVal, fmt } from '../context/BillingContext';

// ── Constants ─────────────────────────────────────────────────────────────────
const NAVY    = '#304674';
const WHITE   = '#ffffff';
const GRAY_BG = '#f4f6fb';
const GRAY_MD = '#e2e6f0';
const TEXT_D  = '#2c5f80';
const TEXT_M  = '#4a7a9b';

const MONTHS_FULL  = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
const DAY_LABELS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const CUR_YEAR     = new Date().getFullYear();
// YEAR_LIST now dynamic — see useYearList hook inside component

const CATEGORY_LABELS = {
  freelunch: 'Free Lunch', riceallowances: 'Rice Allowances',
  waterbilling: 'Water Billing', milkbeans: 'Milk & Beans', ticket: 'Ticket',
};

// ── Form helpers ──────────────────────────────────────────────────────────────
const emptyForm = (category, presetDept, presetDate) => {
  const base = { dept: presetDept || DEPARTMENTS[0], date: presetDate || todayVal(), amount: 0 };
  switch (category) {
    case 'freelunch':      return { ...base, pax: '', amtPerPax: '' };
    case 'riceallowances': return { ...base, name: '', sacks: '', priceSac: '' };
    case 'waterbilling':   return { ...base, gallons: '', priceGallon: '' };
    case 'milkbeans':      return { ...base, milkType:'Milk', milkQty:'', milkPrice:'', beansType:'None', beansQty:'', beansPrice:'' };
    case 'ticket':         return { ...base, name: '', tickets: '', amtTicket: '' };
    default:               return base;
  }
};

const calcAmount = (category, form) => {
  switch (category) {
    case 'freelunch':      return (parseFloat(form.pax)||0) * (parseFloat(form.amtPerPax)||0);
    case 'riceallowances': return (parseFloat(form.sacks)||0) * (parseFloat(form.priceSac)||0);
    case 'waterbilling':   return (parseFloat(form.gallons)||0) * (parseFloat(form.priceGallon)||0);
    case 'milkbeans': {
      const milk  = form.milkType  !== 'None' ? (parseFloat(form.milkQty)||0)  * (parseFloat(form.milkPrice)||0)  : 0;
      const beans = form.beansType !== 'None' ? (parseFloat(form.beansQty)||0) * (parseFloat(form.beansPrice)||0) : 0;
      return milk + beans;
    }
    case 'ticket': return (parseFloat(form.tickets)||0) * (parseFloat(form.amtTicket)||0);
    default: return 0;
  }
};

// ── Floating Dropdown ─────────────────────────────────────────────────────────
function DropdownField({ value, onChange, options }) {
  const [open,   setOpen]   = useState(false);
  const [pos,    setPos]    = useState({ top:0, left:0, width:0 });
  const btnRef = useRef(null);

  const handleOpen = () => {
    btnRef.current?.measureInWindow((x, y, w, h) => {
      setPos({ top: y + h + 2, left: x, width: w });
      setOpen(true);
    });
  };

  return (
    <View>
      <TouchableOpacity ref={btnRef} style={s.dropBtn} onPress={handleOpen} activeOpacity={0.8}>
        <Text style={s.dropBtnTxt}>{value}</Text>
        <MaterialIcons name="keyboard-arrow-down" size={20} color={TEXT_M} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={[s.dropList, { position:'absolute', top:pos.top, left:pos.left, width:pos.width }]}>
          <FlatList
            data={options}
            keyExtractor={o => o}
            bounces={false}
            style={{ maxHeight: 260 }}
            showsVerticalScrollIndicator
            renderItem={({ item }) => (
              item === 'Others'
                ? <View style={s.dropSectionLabel}>
                    <Text style={s.dropSectionLabelTxt}>Others</Text>
                  </View>
                : <TouchableOpacity
                    style={[s.dropItem, item === value && s.dropItemActive]}
                    onPress={() => { onChange(item); setOpen(false); }}
                  >
                    <Text style={[s.dropItemTxt, item === value && s.dropItemTxtActive]}>{item}</Text>
                    {item === value && <MaterialIcons name="check" size={14} color={NAVY} />}
                  </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

// ── Custom Calendar Picker ────────────────────────────────────────────────────
function DateField({ value, onChange }) {
  const today   = new Date();
  const todayY  = today.getFullYear();
  const todayM  = today.getMonth();
  const todayD  = today.getDate();

  // Parse 'YYYY-MM-DD' → { y, m (0-based), d }
  const parse = (v) => {
    if (!v) return { y: todayY, m: todayM, d: todayD };
    const [y, mo, d] = v.split('-');
    return { y: +y, m: +mo - 1, d: +d };
  };
  const sel = parse(value);

  const [show,  setShow]  = useState(false);
  const [vy,    setVy]    = useState(sel.y);   // view year
  const [vm,    setVm]    = useState(sel.m);   // view month (0-based)
  const [mode,  setMode]  = useState('day');   // 'day' | 'month' | 'year'

  // Windowed year list — show 40 years around vy, load more on scroll
  const [yearCenter, setYearCenter] = React.useState(sel.y);
  const YEAR_WIN = 40;
  const yearList = React.useMemo(() => {
    const from = Math.max(2000, yearCenter - YEAR_WIN);
    const to   = Math.min(5000, yearCenter + YEAR_WIN);
    const arr = [];
    for (let y = from; y <= to; y++) arr.push(y);
    return arr;
  }, [yearCenter]);

  const openPicker = () => {
    const p = parse(value);
    setVy(p.y); setVm(p.m); setMode('day');
    setShow(true);
  };

  // Build day grid
  const firstDow   = new Date(vy, vm, 1).getDay();
  const daysInMo   = new Date(vy, vm + 1, 0).getDate();
  const cells      = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let i = 1; i <= daysInMo; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  const pickDay = (d) => {
    if (!d) return;
    const mo = String(vm + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    onChange(`${vy}-${mo}-${dd}`);
    setShow(false);
  };

  const prevMo = () => { if (vm === 0) { setVm(11); setVy(y => y - 1); } else setVm(m => m - 1); };
  const nextMo = () => { if (vm === 11){ setVm(0);  setVy(y => y + 1); } else setVm(m => m + 1); };

  const isSel   = (d) => d && sel.y === vy && sel.m === vm && sel.d === d;
  const isToday = (d) => d && todayY === vy && todayM === vm && todayD === d;

  const display = value
    ? (() => { const [y,mo,d] = value.split('-'); return `${mo}/${d}/${y}`; })()
    : `${String(todayM+1).padStart(2,'0')}/${String(todayD).padStart(2,'0')}/${todayY}`;

  return (
    <View>
      {/* Trigger button */}
      <TouchableOpacity style={s.dateBtn} onPress={openPicker} activeOpacity={0.8}>
        <MaterialIcons name="calendar-today" size={16} color={NAVY} />
        <Text style={s.dateBtnTxt}>{display}</Text>
        <MaterialIcons name="arrow-drop-down" size={20} color={TEXT_M} />
      </TouchableOpacity>

      {/* Calendar modal */}
      {show && (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShow(false)}>
          <View style={cal.overlay}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShow(false)} />

            <View style={cal.card}>

              {/* ── HEADER ── */}
              <View style={cal.header}>
                {mode === 'day' && (
                  <TouchableOpacity style={cal.navBtn} onPress={prevMo}>
                    <MaterialIcons name="chevron-left" size={22} color={WHITE} />
                  </TouchableOpacity>
                )}
                {mode !== 'day' && <TouchableOpacity style={cal.navBtnGhost} onPress={() => {}} />}

                {/* Tap header text to toggle month+year picker */}
                <TouchableOpacity
                  style={{ flexDirection:'row', alignItems:'center', gap:2 }}
                  onPress={() => setMode(mode === 'day' ? 'monthyear' : 'day')}
                >
                  <Text style={cal.chipTxt}>{MONTHS_FULL[vm]} {vy}</Text>
                  <MaterialIcons
                    name={mode === 'monthyear' ? 'arrow-drop-up' : 'arrow-drop-down'}
                    size={20} color={WHITE}
                  />
                </TouchableOpacity>

                {mode === 'day' && (
                  <TouchableOpacity style={cal.navBtn} onPress={nextMo}>
                    <MaterialIcons name="chevron-right" size={22} color={WHITE} />
                  </TouchableOpacity>
                )}
                {mode !== 'day' && <TouchableOpacity style={cal.navBtnGhost} onPress={() => {}} />}
              </View>

              {/* ── COMBINED MONTH + YEAR PICKER (same as HTML screenshot) ── */}
              {mode === 'monthyear' && (
                <View style={cal.myPicker}>
                  {/* Year list on left — scrollable */}
                  <ScrollView
                    style={cal.yearCol}
                    showsVerticalScrollIndicator={true}
                    ref={r => {
                      if (r) {
                        const idx = yearList.indexOf(vy);
                        if (idx >= 0) setTimeout(() => r.scrollTo({ y: Math.max(0, (idx - 2) * 44), animated: false }), 50);
                      }
                    }}
                    onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
                      if (contentOffset.y < 60 && yearList[0] > 2000)
                        setYearCenter(c => Math.max(2000 + YEAR_WIN, c - 20));
                      if (contentOffset.y + layoutMeasurement.height > contentSize.height - 60 && yearList[yearList.length-1] < 5000)
                        setYearCenter(c => Math.min(5000 - YEAR_WIN, c + 20));
                    }}
                    scrollEventThrottle={150}
                  >
                    {yearList.map(yr => (
                      <TouchableOpacity
                        key={yr}
                        style={[cal.yearItem, yr === vy && cal.yearItemActive]}
                        onPress={() => { setVy(yr); setYearCenter(yr); }}
                      >
                        <Text style={[cal.yearItemTxt, yr === vy && cal.yearItemTxtActive]}>{yr}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Month grid on right — 3 cols x 4 rows */}
                  <View style={cal.monthCol}>
                    {MONTHS_FULL.map((mn, i) => (
                      <TouchableOpacity
                        key={mn}
                        style={[cal.myMonthCell, i === vm && cal.selectedCell]}
                        onPress={() => { setVm(i); setMode('day'); }}
                      >
                        <Text style={[cal.myMonthCellTxt, i === vm && cal.selectedCellTxt]}>
                          {mn.slice(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* ── DAY GRID ── */}
              {mode === 'day' && (
                <View>
                  <View style={cal.dayNamesRow}>
                    {DAY_LABELS.map(n => (
                      <Text key={n} style={cal.dayName}>{n}</Text>
                    ))}
                  </View>
                  <View style={cal.grid}>
                    {cells.map((d, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          cal.cell,
                          isSel(d)   && cal.cellSel,
                          isToday(d) && !isSel(d) && cal.cellToday,
                        ]}
                        onPress={() => pickDay(d)}
                        disabled={!d}
                        activeOpacity={0.7}
                      >
                        {d ? (
                          <Text style={[
                            cal.cellTxt,
                            isSel(d)   && cal.cellTxtSel,
                            isToday(d) && !isSel(d) && cal.cellTxtToday,
                          ]}>
                            {d}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* ── FOOTER ── */}
              <View style={cal.footer}>
                <TouchableOpacity style={cal.cancelBtn} onPress={() => setShow(false)}>
                  <Text style={cal.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────
const FieldRow = ({ label, children }) => (
  <View style={s.fieldRow}>
    <Text style={s.label}>{label}</Text>
    {children}
  </View>
);

const InputRow = ({ label, value, onChangeText, keyboardType = 'default', placeholder }) => (
  <FieldRow label={label}>
    <TextInput
      style={s.input}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder}
      placeholderTextColor="rgba(1,31,75,0.35)"
    />
  </FieldRow>
);

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function EntryModal({ visible, category, editEntry, presetDept, presetDate, year, month, onClose }) {
  const { addEntry, updateEntry, deleteEntry } = useBilling();
  const [form,   setForm]   = useState(emptyForm(category, presetDept, presetDate));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editEntry) {
        setForm({
          dept:        editEntry.dept        || DEPARTMENTS[0],
          date:        editEntry.date        || todayVal(),
          pax:         String(editEntry.pax         || ''),
          amtPerPax:   String(editEntry.amtPerPax   || ''),
          name:        editEntry.name        || '',
          sacks:       String(editEntry.sacks       || ''),
          priceSac:    String(editEntry.priceSac    || ''),
          gallons:     String(editEntry.gallons     || ''),
          priceGallon: String(editEntry.priceGallon || ''),
          milkType:    editEntry.milkType    || 'Milk',
          milkQty:     String(editEntry.milkQty     || ''),
          milkPrice:   String(editEntry.milkPrice   || ''),
          beansType:   editEntry.beansType   || 'None',
          beansQty:    String(editEntry.beansQty    || ''),
          beansPrice:  String(editEntry.beansPrice  || ''),
          tickets:     String(editEntry.tickets     || ''),
          amtTicket:   String(editEntry.amtTicket   || ''),
          amount:      editEntry.amount || 0,
        });
      } else {
        setForm(emptyForm(category, presetDept, presetDate));
      }
    }
  }, [visible, editEntry, presetDept, presetDate, category]);

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const computedAmount = calcAmount(category, form);

  const handleSave = async () => {
    if (!form.date)           { Alert.alert('Error', 'Date is required.'); return; }
    if (computedAmount === 0) { Alert.alert('Error', 'Amount must be greater than 0.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, category, amount: computedAmount };
      ['pax','amtPerPax','sacks','priceSac','gallons','priceGallon',
       'milkQty','milkPrice','beansQty','beansPrice','tickets','amtTicket'].forEach(k => {
        if (payload[k] !== undefined) payload[k] = parseFloat(payload[k]) || 0;
      });
      editEntry ? await updateEntry(editEntry.id, payload) : await addEntry(payload);
      onClose();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = () => {
    if (!editEntry?.id) {
      Alert.alert('Error', 'Entry ID not found. Please close and reopen the entry.');
      return;
    }
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await deleteEntry(editEntry.id);
              onClose();
            } catch (e) {
              Alert.alert('Delete Failed', e.message || 'Could not delete. Check Firestore Security Rules.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const isEdit = !!editEntry;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

        <View style={s.card}>
          {/* Title */}
          <View style={s.titleRow}>
            <MaterialIcons name={isEdit ? 'edit' : 'add-circle'} size={18} color={NAVY} />
            <Text style={s.title}>{isEdit ? 'Edit' : 'Add'} {CATEGORY_LABELS[category] || ''} Entry</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">

            {/* Department dropdown */}
            <FieldRow label="AREA / DEPARTMENT">
              <DropdownField
                value={form.dept}
                onChange={v => update('dept', v)}
                options={
                  category === 'freelunch' || category === 'riceallowances' || category === 'ticket'
                    ? DEPARTMENTS_EXTENDED
                    : DEPARTMENTS
                }
              />
            </FieldRow>

            {/* Date calendar picker */}
            <FieldRow label="DATE">
              <DateField value={form.date} onChange={v => update('date', v)} />
            </FieldRow>

            {/* Category-specific fields */}
            {category === 'freelunch' && <>
              <InputRow label="NO. OF PAX" value={form.pax} onChangeText={v => update('pax', v)} keyboardType="numeric" placeholder="0" />
              <InputRow label="AMOUNT / PAX (₱)" value={form.amtPerPax} onChangeText={v => update('amtPerPax', v)} keyboardType="decimal-pad" placeholder="0.00" />
            </>}

            {category === 'riceallowances' && <>
              <InputRow label="NAME" value={form.name} onChangeText={v => update('name', v)} placeholder="Employee name" />
              <InputRow label="NO. OF SAC" value={form.sacks} onChangeText={v => update('sacks', v)} keyboardType="decimal-pad" placeholder="0" />
              <InputRow label="PRICE / SAC (₱)" value={form.priceSac} onChangeText={v => update('priceSac', v)} keyboardType="decimal-pad" placeholder="0.00" />
            </>}

            {category === 'waterbilling' && <>
              <InputRow label="NO. OF GALLON" value={form.gallons} onChangeText={v => update('gallons', v)} keyboardType="decimal-pad" placeholder="0" />
              <InputRow label="PRICE / GALLON (₱)" value={form.priceGallon} onChangeText={v => update('priceGallon', v)} keyboardType="decimal-pad" placeholder="0.00" />
            </>}

            {category === 'milkbeans' && <>
              <View style={s.section}>
                <Text style={s.sectionTitle}>🥛  MILK</Text>
                <View style={s.toggleRow}>
                  {['Milk','None'].map(t => (
                    <TouchableOpacity key={t} style={[s.toggleBtn, form.milkType===t && s.toggleBtnActive]} onPress={() => update('milkType', t)}>
                      <Text style={[s.toggleTxt, form.milkType===t && s.toggleTxtActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {form.milkType !== 'None' && <>
                  <InputRow label="NO. OF MILK" value={form.milkQty} onChangeText={v => update('milkQty', v)} keyboardType="decimal-pad" placeholder="0" />
                  <InputRow label="MILK PRICE (₱)" value={form.milkPrice} onChangeText={v => update('milkPrice', v)} keyboardType="decimal-pad" placeholder="0.00" />
                </>}
              </View>

              <View style={s.section}>
                <Text style={s.sectionTitle}>🫘  BEANS</Text>
                <View style={s.toggleRow}>
                  {['Beans','None'].map(t => (
                    <TouchableOpacity key={t} style={[s.toggleBtn, form.beansType===t && s.toggleBtnActive]} onPress={() => update('beansType', t)}>
                      <Text style={[s.toggleTxt, form.beansType===t && s.toggleTxtActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {form.beansType !== 'None' && <>
                  <InputRow label="NO. OF BEANS" value={form.beansQty} onChangeText={v => update('beansQty', v)} keyboardType="decimal-pad" placeholder="0" />
                  <InputRow label="BEANS PRICE (₱)" value={form.beansPrice} onChangeText={v => update('beansPrice', v)} keyboardType="decimal-pad" placeholder="0.00" />
                </>}
              </View>
            </>}

            {category === 'ticket' && <>
              <InputRow label="NAME" value={form.name} onChangeText={v => update('name', v)} placeholder="Employee name" />
              <InputRow label="NO. OF TICKET" value={form.tickets} onChangeText={v => update('tickets', v)} keyboardType="decimal-pad" placeholder="0" />
              <InputRow label="AMOUNT OF TICKET (₱)" value={form.amtTicket} onChangeText={v => update('amtTicket', v)} keyboardType="decimal-pad" placeholder="0.00" />
            </>}

            {/* Computed amount */}
            <View style={s.amountBox}>
              <Text style={s.amountLabel}>AMOUNT (AUTO-COMPUTED)</Text>
              <Text style={s.amountValue}>{fmt(computedAmount)}</Text>
            </View>

          </ScrollView>

          {/* Actions */}
          <View style={s.actions}>
            {isEdit && (
              <TouchableOpacity style={[s.deleteBtn, saving && { opacity: 0.5 }]} onPress={handleDelete} disabled={saving}>
                <MaterialIcons name="delete-outline" size={16} color="#e74c3c" />
                <Text style={s.deleteTxt}>{saving ? 'Deleting...' : 'Delete'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity:0.65 }]} onPress={handleSave} disabled={saving}>
              <LinearGradient colors={[NAVY,'#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.saveGrad}>
                <MaterialIcons name="save" size={15} color={WHITE} />
                <Text style={s.saveTxt}>{saving ? 'Saving...' : 'Save Entry'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay:   { flex:1, backgroundColor:'rgba(10,16,50,0.60)', justifyContent:'center', alignItems:'center', padding:16 },
  card:      { backgroundColor:WHITE, borderRadius:16, padding:20, width:'100%', maxWidth:480, maxHeight:'92%', shadowColor:'#000', shadowOpacity:0.28, shadowRadius:20, shadowOffset:{width:0,height:6}, elevation:14 },
  titleRow:  { flexDirection:'row', alignItems:'center', gap:8, borderBottomWidth:2, borderBottomColor:GRAY_MD, paddingBottom:12, marginBottom:4 },
  title:     { fontFamily:'GoogleSans_700Bold', fontSize:17, fontWeight:'800', color:NAVY },
  scrollContent: { gap:14, paddingTop:10, paddingBottom:6 },
  fieldRow:  { gap:6 },
  label:     { fontFamily:'GoogleSans_700Bold', fontSize:10, fontWeight:'700', color:TEXT_M, letterSpacing:0.8, textTransform:'uppercase' },
  input:     { backgroundColor:GRAY_BG, borderRadius:8, paddingHorizontal:12, paddingVertical:11, fontFamily:'GoogleSans_400Regular', fontSize:14, color:'#011f4b', borderWidth:1.5, borderColor:GRAY_MD },
  // Dropdown
  dropBtn:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:GRAY_BG, borderRadius:8, paddingHorizontal:12, paddingVertical:11, borderWidth:1.5, borderColor:GRAY_MD },
  dropBtnTxt:   { fontFamily:'GoogleSans_400Regular', fontSize:14, color:'#011f4b', flex:1 },
  dropList:     { backgroundColor:WHITE, borderRadius:10, borderWidth:1, borderColor:GRAY_MD, shadowColor:'#000', shadowOpacity:0.18, shadowRadius:12, shadowOffset:{width:0,height:4}, elevation:16, overflow:'hidden' },
  dropItem:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:13, borderBottomWidth:1, borderBottomColor:'#f0f2f8' },
  dropItemActive:   { backgroundColor:'rgba(48,70,116,0.07)' },
  dropItemTxt:      { fontFamily:'GoogleSans_400Regular', fontSize:14, color:'#011f4b' },
  dropItemTxtActive:{ fontFamily:'GoogleSans_700Bold', color:NAVY },
  dropSectionLabel: { paddingHorizontal:16, paddingVertical:7, backgroundColor:'#f0f2f8', borderBottomWidth:1, borderBottomColor:'#e2e6f0' },
  dropSectionLabelTxt: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#8a9bbf', letterSpacing:1, textTransform:'uppercase' },
  // Date button
  dateBtn:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:GRAY_BG, borderRadius:8, paddingHorizontal:12, paddingVertical:11, borderWidth:1.5, borderColor:GRAY_MD },
  dateBtnTxt: { fontFamily:'GoogleSans_400Regular', fontSize:14, color:'#011f4b', flex:1 },
  // Toggle
  toggleRow:       { flexDirection:'row', gap:8 },
  toggleBtn:       { paddingHorizontal:18, paddingVertical:8, borderRadius:20, borderWidth:1.5, borderColor:GRAY_MD, backgroundColor:GRAY_BG },
  toggleBtnActive: { backgroundColor:NAVY, borderColor:NAVY },
  toggleTxt:       { fontFamily:'GoogleSans_700Bold', fontSize:13, color:TEXT_M },
  toggleTxtActive: { color:WHITE },
  // Section
  section:      { backgroundColor:GRAY_BG, borderRadius:10, padding:12, borderWidth:1, borderColor:GRAY_MD, gap:10 },
  sectionTitle: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:NAVY, letterSpacing:1, textTransform:'uppercase' },
  // Amount
  amountBox:   { backgroundColor:'rgba(48,70,116,0.07)', borderRadius:10, padding:14, gap:4 },
  amountLabel: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:TEXT_M, letterSpacing:0.8, textTransform:'uppercase' },
  amountValue: { fontFamily:'NotoSerif_700Bold', fontSize:24, fontWeight:'800', color:NAVY },
  // Actions
  actions:   { flexDirection:'row', gap:8, marginTop:14, borderTopWidth:1, borderTopColor:GRAY_MD, paddingTop:14 },
  deleteBtn: { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(231,76,60,0.08)', borderRadius:10, paddingVertical:12, paddingHorizontal:12, borderWidth:1, borderColor:'rgba(231,76,60,0.25)' },
  deleteTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#e74c3c' },
  cancelBtn: { flex:1, borderRadius:10, backgroundColor:GRAY_BG, paddingVertical:12, alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor:GRAY_MD },
  cancelTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:TEXT_M },
  saveBtn:   { flex:2, borderRadius:10, overflow:'hidden' },
  saveGrad:  { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:7, paddingVertical:13 },
  saveTxt:   { fontFamily:'GoogleSans_700Bold', fontSize:14, fontWeight:'800', color:WHITE },
});

// ── Calendar styles ───────────────────────────────────────────────────────────
const cal = StyleSheet.create({
  overlay:  { flex:1, backgroundColor:'rgba(10,16,50,0.55)', justifyContent:'center', alignItems:'center', padding:20 },
  card:     { backgroundColor:WHITE, borderRadius:16, overflow:'hidden', width:320, shadowColor:'#000', shadowOpacity:0.28, shadowRadius:20, shadowOffset:{width:0,height:6}, elevation:16 },
  // Header
  header:   { backgroundColor:NAVY, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:14, paddingHorizontal:8 },
  chip:        {},
  chipTxt:     { fontFamily:'GoogleSans_700Bold', fontSize:16, fontWeight:'800', color:WHITE },
  navBtn:      { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.18)', justifyContent:'center', alignItems:'center' },
  navBtnGhost: { width:36, height:36 },
  // Combined month+year picker
  myPicker:  { flexDirection:'row', height:176, backgroundColor:WHITE },
  // Year column — scrollable list on left
  yearCol:       { width:72, borderRightWidth:1, borderRightColor:'#e2e6f0' },
  yearItem:      { paddingVertical:12, paddingHorizontal:10, alignItems:'center', borderBottomWidth:1, borderBottomColor:'#f0f2f8' },
  yearItemActive:    { backgroundColor:'rgba(48,70,116,0.07)' },
  yearItemTxt:       { fontFamily:'GoogleSans_400Regular', fontSize:14, color:TEXT_D },
  yearItemTxtActive: { fontFamily:'GoogleSans_700Bold', color:NAVY },
  // Month grid — 3 cols x 4 rows on right
  monthCol:       { flex:1, flexDirection:'row', flexWrap:'wrap', padding:4, alignContent:'flex-start' },
  myMonthCell:    { width:'33.33%', paddingVertical:14, alignItems:'center', borderRadius:8 },
  myMonthCellTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:TEXT_D },
  // (legacy, kept for safety)
  monthGrid:    { flexDirection:'row', flexWrap:'wrap', padding:8, backgroundColor:WHITE },
  monthCell:    { width:'25%', paddingVertical:14, alignItems:'center', borderRadius:10 },
  monthCellTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:TEXT_D },
  yearRow:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:13, borderBottomWidth:1, borderBottomColor:'#f0f2f8' },
  yearRowActive: { backgroundColor:'rgba(48,70,116,0.07)' },
  yearTxt:       { fontFamily:'GoogleSans_400Regular', fontSize:15, color:TEXT_D },
  yearTxtActive: { fontFamily:'GoogleSans_700Bold', color:NAVY },
  // Day name row
  dayNamesRow: { flexDirection:'row', backgroundColor:'#eef1f8', paddingVertical:7, paddingHorizontal:4 },
  dayName:     { flex:1, textAlign:'center', fontFamily:'GoogleSans_700Bold', fontSize:11, color:TEXT_M },
  // Day grid
  grid:     { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:6, paddingVertical:6, backgroundColor:WHITE },
  cell:     { width:'14.28%', aspectRatio:1, justifyContent:'center', alignItems:'center', borderRadius:100 },
  cellSel:  { backgroundColor:NAVY },
  cellToday:{ borderWidth:2, borderColor:NAVY },
  cellTxt:         { fontFamily:'GoogleSans_400Regular', fontSize:14, color:'#1a2a4a' },
  cellTxtSel:      { fontFamily:'GoogleSans_700Bold', color:WHITE },
  cellTxtToday:    { fontFamily:'GoogleSans_700Bold', color:NAVY },
  // Shared selected style for month/year
  selectedCell:    { backgroundColor:NAVY },
  selectedCellTxt: { color:WHITE },
  // Footer
  footer:    { flexDirection:'row', justifyContent:'flex-end', paddingHorizontal:12, paddingVertical:10, borderTopWidth:1, borderTopColor:'#eef1f8' },
  cancelBtn: { paddingHorizontal:18, paddingVertical:8, borderRadius:8, backgroundColor:GRAY_BG, borderWidth:1.5, borderColor:GRAY_MD },
  cancelTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:TEXT_M },
});