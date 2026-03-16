// src/components/billing/EntryModal.js
// CESLA MPC — Reusable Add/Edit Modal for all billing categories

import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useBilling, DEPARTMENTS, todayVal, fmt } from '../context/BillingContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
const emptyForm = (category, presetDept, presetDate) => {
  const base = {
    dept:  presetDept || DEPARTMENTS[0],
    date:  presetDate || todayVal(),
    amount: 0,
  };
  switch (category) {
    case 'freelunch':
      return { ...base, pax: '', amtPerPax: '' };
    case 'riceallowances':
      return { ...base, name: '', sacks: '', priceSac: '' };
    case 'waterbilling':
      return { ...base, gallons: '', priceGallon: '' };
    case 'milkbeans':
      return { ...base, milkType: 'Milk', milkQty: '', milkPrice: '', beansType: 'None', beansQty: '', beansPrice: '' };
    case 'ticket':
      return { ...base, name: '', tickets: '', amtTicket: '' };
    default:
      return base;
  }
};

const calcAmount = (category, form) => {
  switch (category) {
    case 'freelunch':
      return (parseFloat(form.pax) || 0) * (parseFloat(form.amtPerPax) || 0);
    case 'riceallowances':
      return (parseFloat(form.sacks) || 0) * (parseFloat(form.priceSac) || 0);
    case 'waterbilling':
      return (parseFloat(form.gallons) || 0) * (parseFloat(form.priceGallon) || 0);
    case 'milkbeans': {
      const milk  = form.milkType  !== 'None' ? (parseFloat(form.milkQty)  || 0) * (parseFloat(form.milkPrice)  || 0) : 0;
      const beans = form.beansType !== 'None' ? (parseFloat(form.beansQty) || 0) * (parseFloat(form.beansPrice) || 0) : 0;
      return milk + beans;
    }
    case 'ticket':
      return (parseFloat(form.tickets) || 0) * (parseFloat(form.amtTicket) || 0);
    default:
      return 0;
  }
};

const CATEGORY_LABELS = {
  freelunch:      'Free Lunch',
  riceallowances: 'Rice Allowances',
  waterbilling:   'Water Billing',
  milkbeans:      'Milk & Beans',
  ticket:         'Ticket',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function EntryModal({
  visible, category, editEntry, presetDept, presetDate,
  year, month, onClose,
}) {
  const { addEntry, updateEntry, deleteEntry } = useBilling();

  const [form,   setForm]   = useState(emptyForm(category, presetDept, presetDate));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editEntry) {
        // Populate form with existing entry
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

  const computedAmount = calcAmount(category, form);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.date) { Alert.alert('Error', 'Date is required.'); return; }
    if (computedAmount === 0) { Alert.alert('Error', 'Amount must be greater than 0.'); return; }

    setSaving(true);
    try {
      const payload = { ...form, category, amount: computedAmount };
      // Convert numeric strings to numbers
      ['pax','amtPerPax','sacks','priceSac','gallons','priceGallon',
       'milkQty','milkPrice','beansQty','beansPrice','tickets','amtTicket'].forEach(k => {
        if (payload[k] !== undefined) payload[k] = parseFloat(payload[k]) || 0;
      });

      if (editEntry) {
        await updateEntry(editEntry.id, payload);
      } else {
        await addEntry(payload);
      }
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editEntry) return;
    Alert.alert('Delete Entry', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteEntry(editEntry.id); onClose(); }
          catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const isEdit = !!editEntry;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={m.card}>
          <Text style={m.title}>
            {isEdit ? 'Edit' : 'Add'} {CATEGORY_LABELS[category] || ''} Entry
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>

            {/* Department */}
            <View style={m.fieldRow}>
              <Text style={m.label}>AREA / DEPARTMENT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {DEPARTMENTS.map(d => (
                    <TouchableOpacity key={d}
                      style={[m.chip, form.dept === d && m.chipActive]}
                      onPress={() => update('dept', d)}>
                      <Text style={[m.chipTxt, form.dept === d && m.chipTxtActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Date */}
            <View style={m.fieldRow}>
              <Text style={m.label}>DATE</Text>
              <TextInput
                style={m.input}
                value={form.date}
                onChangeText={v => update('date', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="rgba(1,31,75,0.35)"
              />
            </View>

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
              {/* Milk section */}
              <View style={m.section}>
                <Text style={m.sectionTitle}>🥛  MILK</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                  {['Milk', 'None'].map(t => (
                    <TouchableOpacity key={t}
                      style={[m.chip, form.milkType === t && m.chipActive]}
                      onPress={() => update('milkType', t)}>
                      <Text style={[m.chipTxt, form.milkType === t && m.chipTxtActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {form.milkType !== 'None' && <>
                  <InputRow label="NO. OF MILK" value={form.milkQty} onChangeText={v => update('milkQty', v)} keyboardType="decimal-pad" placeholder="0" />
                  <InputRow label="MILK PRICE (₱)" value={form.milkPrice} onChangeText={v => update('milkPrice', v)} keyboardType="decimal-pad" placeholder="0.00" />
                </>}
              </View>

              {/* Beans section */}
              <View style={m.section}>
                <Text style={m.sectionTitle}>🫘  BEANS</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                  {['Beans', 'None'].map(t => (
                    <TouchableOpacity key={t}
                      style={[m.chip, form.beansType === t && m.chipActive]}
                      onPress={() => update('beansType', t)}>
                      <Text style={[m.chipTxt, form.beansType === t && m.chipTxtActive]}>{t}</Text>
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

            {/* Computed Amount */}
            <View style={[m.fieldRow, { backgroundColor: 'rgba(26,58,107,0.08)', borderRadius: 8, padding: 10 }]}>
              <Text style={m.label}>AMOUNT (AUTO-COMPUTED)</Text>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 20, color: '#c9a84c', marginTop: 4 }}>
                {fmt(computedAmount)}
              </Text>
            </View>

          </ScrollView>

          {/* Actions */}
          <View style={[m.actions, { marginTop: 12 }]}>
            {isEdit && (
              <TouchableOpacity style={m.deleteBtn} onPress={handleDelete}>
                <MaterialIcons name="delete" size={14} color="#e74c3c" />
                <Text style={m.deleteTxt}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
              <Text style={m.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, borderRadius: 10, overflow: 'hidden' }}
              onPress={handleSave} disabled={saving}>
              <LinearGradient colors={['#1a3a6b', '#2e5fa3']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff' }}>
                  {saving ? 'Saving...' : 'Save Entry'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Small helper component
const InputRow = ({ label, value, onChangeText, keyboardType = 'default', placeholder }) => (
  <View style={m.fieldRow}>
    <Text style={m.label}>{label}</Text>
    <TextInput
      style={m.input}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder}
      placeholderTextColor="rgba(1,31,75,0.35)"
    />
  </View>
);

const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(1,20,50,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  card: {
    backgroundColor: '#f0f5f9', borderRadius: 20, padding: 18,
    width: '100%', maxWidth: 480,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
    maxHeight: '90%',
  },
  title: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: '#011f4b',
    textAlign: 'center', marginBottom: 14,
  },
  fieldRow: { gap: 4 },
  label: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(1,31,75,0.50)',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: '#011f4b',
    borderWidth: 1, borderColor: 'rgba(1,31,75,0.12)',
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(1,31,75,0.07)',
  },
  chipActive: { backgroundColor: '#1a3a6b' },
  chipTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.60)' },
  chipTxtActive: { fontFamily: 'GoogleSans_700Bold', color: '#fff' },
  section: {
    backgroundColor: 'rgba(26,58,107,0.05)', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: 'rgba(26,58,107,0.10)',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#1a3a6b',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  cancelBtn: {
    flex: 1, borderRadius: 10, backgroundColor: 'rgba(1,31,75,0.07)',
    paddingVertical: 12, alignItems: 'center',
  },
  cancelTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: 'rgba(1,31,75,0.50)' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(231,76,60,0.10)', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(231,76,60,0.25)',
  },
  deleteTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#e74c3c' },
});