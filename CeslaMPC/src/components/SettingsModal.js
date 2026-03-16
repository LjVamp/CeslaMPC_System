// src/components/billing/SettingsModal.js
// CESLA MPC — Settings Modal for Billing System
// Prepared By / Checked By configuration

import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useBilling } from '../../context/BillingContext';

export default function SettingsModal({ visible, onClose }) {
  const { settings, saveSettings } = useBilling();

  const [form, setForm] = useState({
    preparedBy:    '',
    preparedTitle: '',
    checkedBy:     '',
    checkedTitle:  '',
  });
  const [saving, setSaving] = useState(false);

  // Sync form when modal opens or settings change
  useEffect(() => {
    if (visible) {
      setForm({
        preparedBy:    settings.preparedBy    || '',
        preparedTitle: settings.preparedTitle || '',
        checkedBy:     settings.checkedBy     || '',
        checkedTitle:  settings.checkedTitle  || '',
      });
    }
  }, [visible, settings]);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(form);
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const FIELDS = [
    {
      key:         'preparedBy',
      label:       'PREPARED BY — NAME',
      placeholder: 'e.g. Leonard E. Berja',
      icon:        'person',
    },
    {
      key:         'preparedTitle',
      label:       'PREPARED BY — TITLE / POSITION',
      placeholder: 'e.g. Admin, CEC',
      icon:        'badge',
    },
    {
      key:         'checkedBy',
      label:       'CHECKED BY — NAME',
      placeholder: 'e.g. Lorilyn Salinas',
      icon:        'verified-user',
    },
    {
      key:         'checkedTitle',
      label:       'CHECKED BY — TITLE / POSITION',
      placeholder: 'e.g. Manager, CEC',
      icon:        'badge',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          activeOpacity={1}
        />

        <View style={s.card}>
          {/* Title */}
          <View style={s.titleRow}>
            <MaterialIcons name="settings" size={20} color="#1a3a6b" />
            <Text style={s.title}>Settings</Text>
          </View>

          <Text style={s.subtitle}>
            I-set ang imong Prepared By ug Checked By nga gamiton sa pag-print sa reports.
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 14 }}
          >
            {/* Prepared By Section */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>📝  PREPARED BY</Text>
              <View style={{ gap: 10 }}>
                {FIELDS.slice(0, 2).map(field => (
                  <View key={field.key} style={s.fieldRow}>
                    <Text style={s.label}>{field.label}</Text>
                    <View style={s.inputWrapper}>
                      <MaterialIcons
                        name={field.icon}
                        size={15}
                        color="rgba(1,31,75,0.35)"
                        style={s.inputIcon}
                      />
                      <TextInput
                        style={s.input}
                        value={form[field.key]}
                        onChangeText={v => update(field.key, v)}
                        placeholder={field.placeholder}
                        placeholderTextColor="rgba(1,31,75,0.30)"
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Checked By Section */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>✅  CHECKED BY</Text>
              <View style={{ gap: 10 }}>
                {FIELDS.slice(2, 4).map(field => (
                  <View key={field.key} style={s.fieldRow}>
                    <Text style={s.label}>{field.label}</Text>
                    <View style={s.inputWrapper}>
                      <MaterialIcons
                        name={field.icon}
                        size={15}
                        color="rgba(1,31,75,0.35)"
                        style={s.inputIcon}
                      />
                      <TextInput
                        style={s.input}
                        value={form[field.key]}
                        onChangeText={v => update(field.key, v)}
                        placeholder={field.placeholder}
                        placeholderTextColor="rgba(1,31,75,0.30)"
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Preview */}
            {(form.preparedBy || form.checkedBy) ? (
              <View style={s.preview}>
                <Text style={s.previewTitle}>PREVIEW</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  {form.preparedBy ? (
                    <View style={{ flex: 1 }}>
                      <Text style={s.previewLabel}>Prepared By:</Text>
                      <Text style={s.previewName}>{form.preparedBy}</Text>
                      {form.preparedTitle ? (
                        <Text style={s.previewRole}>{form.preparedTitle}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  {form.checkedBy ? (
                    <View style={{ flex: 1 }}>
                      <Text style={s.previewLabel}>Checked By:</Text>
                      <Text style={s.previewName}>{form.checkedBy}</Text>
                      {form.checkedTitle ? (
                        <Text style={s.previewRole}>{form.checkedTitle}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

          </ScrollView>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 2, borderRadius: 10, overflow: 'hidden' }}
              onPress={handleSave}
              disabled={saving}
            >
              <LinearGradient
                colors={['#1a3a6b', '#2e5fa3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.saveGrad}
              >
                <MaterialIcons name="save" size={14} color="#fff" />
                <Text style={s.saveTxt}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(1,20,50,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#f0f5f9',
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    gap: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 17,
    color: '#011f4b',
  },
  subtitle: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 11,
    color: 'rgba(1,31,75,0.55)',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: -6,
  },

  // Section
  section: {
    backgroundColor: 'rgba(26,58,107,0.06)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,58,107,0.12)',
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 10,
    color: '#1a3a6b',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // Field
  fieldRow: { gap: 4 },
  label: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 9,
    color: 'rgba(1,31,75,0.50)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(1,31,75,0.12)',
    paddingHorizontal: 10,
  },
  inputIcon: { marginRight: 6 },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 13,
    color: '#011f4b',
  },

  // Preview
  preview: {
    backgroundColor: 'rgba(255,255,255,0.70)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,58,107,0.15)',
    borderStyle: 'dashed',
  },
  previewTitle: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 9,
    color: 'rgba(1,31,75,0.45)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  previewLabel: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 9,
    color: 'rgba(1,31,75,0.45)',
    marginBottom: 2,
  },
  previewName: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 12,
    color: '#1a3a6b',
  },
  previewRole: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 10,
    color: 'rgba(1,31,75,0.55)',
    marginTop: 1,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(1,31,75,0.07)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 13,
    color: 'rgba(1,31,75,0.50)',
  },
  saveGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  saveTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 13,
    color: '#fff',
  },
});
