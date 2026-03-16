// src/screens/ManageMerchandiseScreen.js
// CESLA MPC — Manage Merchandise (Admin)
// Same design & features as ManageCanteenScreen but for merchandise:
//   Cashier | Manage Items | Inventory | History | Credits | Report
// Left panel: Order Monitoring (Pending / Preparing / Done)
// Uses MerchandiseContext (or falls back to local state if not provided)

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform,
  ScrollView, TextInput, Modal, Alert, Animated, Image,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useMerchandise } from '../context/MerchandiseContext';

// ─── WEB SCROLLBAR STYLING ────────────────────────────────────────────────────
if (Platform.OS === 'web') {
  const s = document.createElement('style');
  s.textContent = [
    '.merch-scroll { overflow-y: auto !important; }',
    '.merch-body > div { display: flex !important; flex-direction: column !important; }'
  ].join('\n');
  document.head.appendChild(s);
}

// ─── WebScrollView ────────────────────────────────────────────────────────────
const WebScrollView = ({ children, style, contentContainerStyle, horizontal, ...rest }) => {
  if (Platform.OS !== 'web') {
    return (
      <ScrollView style={style} contentContainerStyle={contentContainerStyle}
        horizontal={horizontal} showsVerticalScrollIndicator {...rest}>
        {children}
      </ScrollView>
    );
  }
  const flatContent = StyleSheet.flatten(contentContainerStyle) || {};
  const flatStyle   = StyleSheet.flatten(style) || {};
  return (
    <View style={[{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }, flatStyle]}>
      <div className="merch-scroll" style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        overflowY: horizontal ? 'hidden' : 'auto',
        overflowX: horizontal ? 'auto' : 'hidden',
        display: 'flex', flexDirection: horizontal ? 'row' : 'column',
      }}>
        <div style={{
          display: 'flex', flexDirection: horizontal ? 'row' : 'column',
          flexShrink: 0, width: '100%',
          gap: flatContent.gap ? (flatContent.gap + 'px') : undefined,
          paddingTop: flatContent.paddingTop !== undefined ? (flatContent.paddingTop + 'px') : (flatContent.padding !== undefined ? (flatContent.padding + 'px') : undefined),
          paddingBottom: flatContent.paddingBottom !== undefined ? (flatContent.paddingBottom + 'px') : (flatContent.padding !== undefined ? (flatContent.padding + 'px') : '12px'),
          paddingLeft: flatContent.paddingHorizontal !== undefined ? (flatContent.paddingHorizontal + 'px') : (flatContent.paddingLeft !== undefined ? (flatContent.paddingLeft + 'px') : (flatContent.padding !== undefined ? (flatContent.padding + 'px') : undefined)),
          paddingRight: flatContent.paddingHorizontal !== undefined ? (flatContent.paddingHorizontal + 'px') : (flatContent.paddingRight !== undefined ? (flatContent.paddingRight + 'px') : (flatContent.padding !== undefined ? (flatContent.padding + 'px') : undefined)),
          minWidth: horizontal ? 'max-content' : undefined,
          boxSizing: 'border-box',
        }}>
          {children}
        </div>
      </div>
    </View>
  );
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  items:  'merch_items',
  ads:    'merch_ads',
  orders: 'merch_orders',
};

const DEFAULT_CATEGORIES = ['All', 'Shirts', 'Mugs', 'Tumbler', 'Bags', 'Pens', 'Caps', 'Umbrellas', 'Stufftoys', 'Others'];

const DEFAULT_ITEMS = [
  { id:'m1',  name:'CESLA Polo Shirt',        cat:'Shirts',    price:350, stock:20, emoji:'👕', image:null, sizes:['XS','S','M','L','XL','XXL','XXXL','2T','3T','4T','5T','6','8','10','12','14'] },
  { id:'m2',  name:'CESLA T-Shirt',           cat:'Shirts',    price:250, stock:30, emoji:'👕', image:null, sizes:['XS','S','M','L','XL','XXL','XXXL','2T','3T','4T','5T','6','8','10','12','14'] },
  { id:'m3',  name:'CESLA Polo (White)',       cat:'Shirts',    price:350, stock:15, emoji:'👔', image:null, sizes:['XS','S','M','L','XL','XXL','XXXL','2T','3T','4T','5T','6','8','10','12','14'] },
  { id:'m4',  name:'CESLA Ceramic Mug',       cat:'Mugs',      price:180, stock:25, emoji:'☕', image:null, sizes:[] },
  { id:'m5',  name:'CESLA Tumbler 500ml',     cat:'Tumbler',   price:280, stock:22, emoji:'🥤', image:null, sizes:[] },
  { id:'m6',  name:'CESLA Tote Bag',          cat:'Bags',      price:150, stock:40, emoji:'👜', image:null, sizes:[] },
  { id:'m7',  name:'CESLA Backpack',          cat:'Bags',      price:650, stock:10, emoji:'🎒', image:null, sizes:[] },
  { id:'m8',  name:'CESLA Ballpen',           cat:'Pens',      price:30,  stock:100,emoji:'🖊️', image:null, sizes:[] },
  { id:'m9',  name:'CESLA Gel Pen Set',       cat:'Pens',      price:85,  stock:60, emoji:'✒️', image:null, sizes:[] },
  { id:'m10', name:'CESLA Snapback Cap',      cat:'Caps',      price:280, stock:20, emoji:'🧢', image:null, sizes:['XS','S','M','L','XL','XXL','XXXL','2T','3T','4T','5T','6','8','10','12','14'] },
  { id:'m11', name:'CESLA Umbrella',          cat:'Umbrellas', price:320, stock:14, emoji:'☂️', image:null, sizes:[] },
  { id:'m12', name:'CESLA Bear Stufftoy',     cat:'Stufftoys', price:180, stock:10, emoji:'🧸', image:null, sizes:[] },
  { id:'m13', name:'CESLA Keychain',          cat:'Others',    price:60,  stock:50, emoji:'🔑', image:null, sizes:[] },
  { id:'m14', name:'CESLA Sticker Pack',      cat:'Others',    price:40,  stock:80, emoji:'🏷️', image:null, sizes:[] },
];

const DEFAULT_ADS = [
  { id:'a1', image:null, imageUrl:'', title:"Today's Picks", sub:'Quality CESLA merchandise!', bg:['#1a3a6b','#2e5fa3'], emoji:'📦' },
  { id:'a2', image:null, imageUrl:'', title:'Special Offer',  sub:'Check our latest items!',   bg:['#7b3f00','#c9a84c'], emoji:'🎁' },
];

// ─── APPAREL SIZE CONFIG ──────────────────────────────────────────────────────
// Source of truth: these match exactly what MerchandiseContext exports
// so admin and visitor always see the same sizes.
const APPAREL_CATEGORIES = ['Shirts', 'Caps'];

const ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const KIDS_SIZES  = ['2T', '3T', '4T', '5T', '6', '8', '10', '12', '14'];
const ALL_SIZES   = [...ADULT_SIZES, ...KIDS_SIZES];

// Returns the full default size list for a category (empty array for non-apparel)
const defaultSizesForCat = (cat) => APPAREL_CATEGORIES.includes(cat) ? [...ALL_SIZES] : [];

const isApparelCategory = (cat) => APPAREL_CATEGORIES.includes(cat);

// ─── COLOR CONFIG ────────────────────────────────────────────────────────────
// Categories that have color choices (NOT sizes)
const COLOR_CATEGORIES = ['Mugs'];
// Categories that have BOTH sizes AND colors
const SIZE_AND_COLOR_CATEGORIES = ['Shirts', 'Caps'];

const COLOR_OPTIONS = {
  Mugs:   [
    { label: 'Gray',  hex: '#9e9e9e' },
    { label: 'Pink',  hex: '#f48fb1' },
  ],
  Shirts: [
    { label: 'White',      hex: '#f5f5f5' },
    { label: 'Navy Blue',  hex: '#1a3a6b' },
    { label: 'Royal Blue', hex: '#2979ff' },
    { label: 'Khaki',      hex: '#c8b560' },
  ],
  Caps: [
    { label: 'White',      hex: '#f5f5f5' },
    { label: 'Navy Blue',  hex: '#1a3a6b' },
    { label: 'Royal Blue', hex: '#2979ff' },
    { label: 'Khaki',      hex: '#c8b560' },
  ],
};

const hasColors = (cat) => !!(COLOR_OPTIONS[cat] && COLOR_OPTIONS[cat].length > 0);

const TABS = [
  { key:'cashier',   label:'Cashier',        icon:'point-of-sale'   },
  { key:'menu',      label:'Manage Items',   icon:'inventory-2'     },
  { key:'inventory', label:'Inventory',      icon:'inventory'       },
  { key:'history',   label:'History',        icon:'history'         },
  { key:'credits',   label:'Credits',        icon:'account-balance' },
  { key:'report',    label:'Report',         icon:'bar-chart'       },
];

const ORDER_STATUSES = {
  pending:   { label:'⏳ Pending',         color:'#e67e22', bg:'rgba(230,126,34,0.12)', next:'preparing', nextLabel:'🔥 Start Preparing', nextColor:'#e67e22' },
  preparing: { label:'🔥 Preparing',       color:'#2980b9', bg:'rgba(41,128,185,0.12)', next:'ready',    nextLabel:'✅ Mark as Ready',    nextColor:'#27ae60' },
  ready:     { label:'✅ Ready to Pick Up',color:'#27ae60', bg:'rgba(39,174,96,0.12)',  next:'done',     nextLabel:'✓ Mark as Done',      nextColor:'#1a3a6b' },
  done:      { label:'✓ Done',             color:'rgba(1,31,75,0.35)', bg:'rgba(1,31,75,0.06)', next:null, nextLabel:null, nextColor:null },
};

const emptyItem = () => ({
  id: Date.now().toString(), name: '', cat: 'Shirts',
  price: '', stock: '', emoji: '📦', image: null,
  sizes: defaultSizesForCat('Shirts'), // Shirts is default → auto-fill all sizes
  colors: [], // color choices (Shirts/Mugs etc.)
});

// ─── AUTO EMOJI ───────────────────────────────────────────────────────────────
const autoEmoji = (name) => {
  const n = name.toLowerCase();
  if (/polo|shirt|t-shirt|tshirt/.test(n))       return '👕';
  if (/dress shirt|long sleeve|barong/.test(n))  return '👔';
  if (/jacket|hoodie|coat|blazer/.test(n))        return '🧥';
  if (/mug|cup|coffee cup/.test(n))              return '☕';
  if (/tumbler|bottle|flask/.test(n))            return '🥤';
  if (/tote|bag|backpack|sling/.test(n)) {
    if (/backpack/.test(n)) return '🎒';
    return '👜';
  }
  if (/pen|ballpen|marker/.test(n))              return '🖊️';
  if (/cap|hat|snapback|beanie/.test(n))         return '🧢';
  if (/umbrella|payong/.test(n))                 return '☂️';
  if (/stufftoy|bear|plush|doll/.test(n))        return '🧸';
  if (/keychain|key chain/.test(n))              return '🔑';
  if (/sticker|decal/.test(n))                   return '🏷️';
  if (/notebook|journal|planner/.test(n))        return '📓';
  if (/lanyard|id/.test(n))                      return '🪪';
  if (/phone|case/.test(n))                      return '📱';
  if (/clock|watch/.test(n))                     return '⌚';
  if (/fan|electric/.test(n))                    return '🌀';
  if (/pillow|cushion/.test(n))                  return '🛏️';
  return '📦';
};


const ItemEditModal = ({ visible, item, categories, onSave, onClose }) => {
  const [form, setForm] = useState(item || emptyItem());
  useEffect(() => {
    if (item) {
      const base = { ...item, price: String(item.price), stock: String(item.stock) };
      // Backfill sizes for apparel items saved before sizes feature
      if (isApparelCategory(base.cat) && (!Array.isArray(base.sizes) || base.sizes.length === 0)) {
        base.sizes = defaultSizesForCat(base.cat);
      } else if (!Array.isArray(base.sizes)) {
        base.sizes = [];
      }
      // Backfill colors array
      if (!Array.isArray(base.colors)) {
        base.colors = [];
      }
      setForm(base);
    }
  }, [item]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!res.canceled) setForm(f => ({ ...f, image: res.assets[0].uri }));
  };

  const handleNameChange = (v) => {
    setForm(f => ({ ...f, name: v, emoji: f.image ? f.emoji : autoEmoji(v) }));
  };

  // ── Color helpers ─────────────────────────────────────────────────────────
  const showColors  = hasColors(form.cat);
  const showSizes   = isApparelCategory(form.cat);
  const selectedColors = Array.isArray(form.colors) ? form.colors : [];

  const toggleColor = (colorLabel) => {
    setForm(f => {
      const prev = Array.isArray(f.colors) ? f.colors : [];
      const next = prev.includes(colorLabel) ? prev.filter(c => c !== colorLabel) : [...prev, colorLabel];
      return { ...f, colors: next };
    });
  };

  const selectAllColors = () => {
    const opts = COLOR_OPTIONS[form.cat] || [];
    setForm(f => ({ ...f, colors: opts.map(c => c.label) }));
  };

  const clearColors = () => setForm(f => ({ ...f, colors: [] }));

  // ── Size helpers ──────────────────────────────────────────────────────────
  const selectedSizes = Array.isArray(form.sizes) ? form.sizes : [];

  const toggleSize = (size) => {
    setForm(f => {
      const prev = Array.isArray(f.sizes) ? f.sizes : [];
      const next = prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size];
      return { ...f, sizes: next };
    });
  };

  // When category changes: auto-fill sizes/colors based on new category
  const handleCatChange = (cat) => {
    setForm(f => {
      const currentSizes = Array.isArray(f.sizes) ? f.sizes : [];
      const newColors    = hasColors(cat) ? (Array.isArray(f.colors) ? f.colors : []) : [];
      // Switching TO apparel and no sizes yet → auto-fill defaults
      if (isApparelCategory(cat) && currentSizes.length === 0) {
        return { ...f, cat, sizes: defaultSizesForCat(cat), colors: newColors };
      }
      // Switching AWAY from apparel → clear sizes
      if (!isApparelCategory(cat)) {
        return { ...f, cat, sizes: [], colors: newColors };
      }
      // Already apparel → keep existing, update colors
      return { ...f, cat, colors: newColors };
    });
  };

  // Select all / clear helpers
  const selectAllAdult = () => {
    setForm(f => {
      const prev = Array.isArray(f.sizes) ? f.sizes : [];
      const kids  = prev.filter(s => KIDS_SIZES.includes(s));
      return { ...f, sizes: [...kids, ...ADULT_SIZES] };
    });
  };
  const selectAllKids = () => {
    setForm(f => {
      const prev = Array.isArray(f.sizes) ? f.sizes : [];
      const adults = prev.filter(s => ADULT_SIZES.includes(s));
      return { ...f, sizes: [...adults, ...KIDS_SIZES] };
    });
  };
  const clearSizes = () => setForm(f => ({ ...f, sizes: [] }));

  const save = () => {
    if (!form.name.trim()) { Alert.alert('Error', 'Item name is required.'); return; }
    if (!form.price)       { Alert.alert('Error', 'Price is required.'); return; }
    if (form.stock === '')  { Alert.alert('Error', 'Stock is required.'); return; }
    onSave({ ...form, price: parseFloat(form.price) || 0, stock: parseInt(form.stock) || 0 });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={ms.modalWrapper}>
          <View style={[ms.modalCard, showSizes && { maxHeight: '90%' }]}>
            <Text style={ms.modalTitle}>{(item&&item.name) ? 'Edit Item' : 'Add New Item'}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <TouchableOpacity style={ms.imgPicker} onPress={pickImage}>
                    {form.image
                      ? <Image source={{ uri: form.image }} style={ms.imgPreview} />
                      : <View style={{ alignItems: 'center', gap: 2 }}><Text style={{ fontSize: 32 }}>{form.emoji}</Text><Text style={ms.imgHint}>Upload</Text></View>
                    }
                    <View style={ms.imgBadge}><MaterialIcons name="photo-camera" size={12} color="#fff" /></View>
                  </TouchableOpacity>
                  {form.image && <TouchableOpacity onPress={() => setForm(f => ({ ...f, image: null }))}><Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: '#e74c3c' }}>✕ Remove</Text></TouchableOpacity>}
                  {!form.image && (
                    <View style={{ alignItems: 'center', gap: 2 }}>
                      <Text style={[ms.fieldLabel, { textAlign: 'center' }]}>Emoji</Text>
                      <TextInput style={[ms.input, { textAlign: 'center', fontSize: 20, width: 56, paddingVertical: 6 }]} value={form.emoji} onChangeText={v => setForm(f => ({ ...f, emoji: v }))} placeholder="📦" />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={ms.fieldRow}>
                    <Text style={ms.fieldLabel}>Item Name *</Text>
                    <TextInput style={ms.input} value={form.name} onChangeText={handleNameChange} placeholder="e.g. CESLA T-Shirt" />
                  </View>
                  <View style={ms.fieldRow}>
                    <Text style={ms.fieldLabel}>Category</Text>
                    {Platform.OS === 'web' ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                        {categories.filter(c => c !== 'All').map(cat => (
                          <TouchableOpacity key={cat} style={[ms.chip, form.cat === cat && ms.chipActive]} onPress={() => handleCatChange(cat)}>
                            <Text style={[ms.chipTxt, form.cat === cat && ms.chipTxtActive]}>{cat}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                          {categories.filter(c => c !== 'All').map(cat => (
                            <TouchableOpacity key={cat} style={[ms.chip, form.cat === cat && ms.chipActive]} onPress={() => handleCatChange(cat)}>
                              <Text style={[ms.chipTxt, form.cat === cat && ms.chipTxtActive]}>{cat}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={[ms.fieldRow, { flex: 1 }]}><Text style={ms.fieldLabel}>Price (₱) *</Text><TextInput style={ms.input} value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} keyboardType="numeric" placeholder="0.00" /></View>
                    <View style={[ms.fieldRow, { flex: 1 }]}><Text style={ms.fieldLabel}>Stock *</Text><TextInput style={ms.input} value={form.stock} onChangeText={v => setForm(f => ({ ...f, stock: v }))} keyboardType="numeric" placeholder="0" /></View>
                  </View>
                </View>
              </View>

              {/* ── COLOR SELECTION ── */}
              {showColors && (
                <View style={ms.sizeSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={ms.sizeSectionTitle}>🎨  AVAILABLE COLORS</Text>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      <TouchableOpacity style={ms.sizeQuickBtn} onPress={selectAllColors}>
                        <Text style={ms.sizeQuickBtnTxt}>All</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={ms.sizeQuickBtn} onPress={clearColors}>
                        <Text style={ms.sizeQuickBtnTxt}>✕ Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {(COLOR_OPTIONS[form.cat] || []).map(color => {
                      const active = selectedColors.includes(color.label);
                      const isDark = ['#1a3a6b','#2979ff'].includes(color.hex);
                      return (
                        <TouchableOpacity
                          key={color.label}
                          onPress={() => toggleColor(color.label)}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 7,
                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                            backgroundColor: active ? color.hex : 'rgba(1,31,75,0.06)',
                            borderWidth: active ? 2 : 1.5,
                            borderColor: active ? color.hex : 'rgba(1,31,75,0.15)',
                          }}
                        >
                          <View style={{
                            width: 16, height: 16, borderRadius: 8,
                            backgroundColor: color.hex,
                            borderWidth: 1.5,
                            borderColor: color.label === 'White' ? 'rgba(0,0,0,0.15)' : color.hex,
                          }} />
                          <Text style={{
                            fontFamily: 'GoogleSans_700Bold', fontSize: 12,
                            color: active ? (isDark || color.label === 'White' ? (isDark ? '#fff' : '#333') : '#fff') : 'rgba(1,31,75,0.65)',
                          }}>{color.label}</Text>
                          {active && <Text style={{ fontSize: 10, color: isDark ? '#fff' : '#333' }}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {selectedColors.length > 0 && (
                    <View style={ms.sizeSummary}>
                      <Text style={ms.sizeSummaryTxt}>
                        ✓  {selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''} selected:  {selectedColors.join('  ·  ')}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── SIZE SELECTION (Apparel only) ── */}
              {showSizes && (
                <View style={ms.sizeSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={ms.sizeSectionTitle}>👕  AVAILABLE SIZES</Text>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      <TouchableOpacity style={ms.sizeQuickBtn} onPress={clearSizes}>
                        <Text style={ms.sizeQuickBtnTxt}>✕ Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Adult Sizes */}
                  <View style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <Text style={ms.sizeGroupLabel}>ADULT</Text>
                      <TouchableOpacity style={ms.sizeQuickBtn} onPress={selectAllAdult}>
                        <Text style={ms.sizeQuickBtnTxt}>All Adult</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {ADULT_SIZES.map(size => {
                        const active = selectedSizes.includes(size);
                        return (
                          <TouchableOpacity key={size} style={[ms.sizeChip, active && ms.sizeChipActive]} onPress={() => toggleSize(size)}>
                            <Text style={[ms.sizeChipTxt, active && ms.sizeChipTxtActive]}>{size}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Kids Sizes */}
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <Text style={ms.sizeGroupLabel}>KIDS</Text>
                      <TouchableOpacity style={ms.sizeQuickBtn} onPress={selectAllKids}>
                        <Text style={ms.sizeQuickBtnTxt}>All Kids</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {KIDS_SIZES.map(size => {
                        const active = selectedSizes.includes(size);
                        return (
                          <TouchableOpacity key={size} style={[ms.sizeChip, active && ms.sizeChipKidsActive]} onPress={() => toggleSize(size)}>
                            <Text style={[ms.sizeChipTxt, active && ms.sizeChipKidsTxtActive]}>{size}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {selectedSizes.length > 0 && (
                    <View style={ms.sizeSummary}>
                      <Text style={ms.sizeSummaryTxt}>
                        ✓  {selectedSizes.length} size{selectedSizes.length !== 1 ? 's' : ''} selected:  {selectedSizes.join('  ·  ')}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={[ms.modalActions, { marginTop: 8 }]}>
              <TouchableOpacity style={ms.cancelBtn} onPress={onClose}><Text style={ms.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={{ flex: 2, borderRadius: 10, overflow: 'hidden' }} onPress={save}>
                <LinearGradient colors={['#1a3a6b', '#2e5fa3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 11, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff' }}>Save Item</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── AD EDIT MODAL ────────────────────────────────────────────────────────────
const AdEditModal = ({ visible, ad, onSave, onClose, onDelete }) => {
  const [form, setForm] = useState(ad || {});
  useEffect(() => { if (ad) setForm(ad); }, [ad]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 5], quality: 0.85,
    });
    if (!res.canceled) setForm(f => ({ ...f, image: res.assets[0].uri, imageUrl: '' }));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={[ms.modalCard, { maxWidth: 420, alignSelf: 'center', width: '90%' }]}>
          <Text style={ms.modalTitle}>{(ad&&ad.isNew) ? 'Add New Ad' : 'Edit Ad Banner'}</Text>
          <TouchableOpacity style={[ms.imgPicker, { width: '100%', height: 80, borderRadius: 12 }]} onPress={pickImage}>
            {form.image
              ? <Image source={{ uri: form.image }} style={{ width: '100%', height: 80, borderRadius: 12 }} resizeMode="cover" />
              : <View style={{ alignItems: 'center', gap: 3 }}><Text style={{ fontSize: 28 }}>{form.emoji || '📢'}</Text><Text style={ms.imgHint}>Tap to upload banner image</Text></View>
            }
          </TouchableOpacity>
          <View style={ms.fieldRow}><Text style={ms.fieldLabel}>Or paste image URL</Text><TextInput style={ms.input} value={form.imageUrl || ''} onChangeText={v => setForm(f => ({ ...f, imageUrl: v, image: null }))} placeholder="https://..." autoCapitalize="none" /></View>
          <View style={ms.fieldRow}><Text style={ms.fieldLabel}>Title</Text><TextInput style={ms.input} value={form.title || ''} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholder="Ad title" /></View>
          <View style={ms.fieldRow}><Text style={ms.fieldLabel}>Subtitle</Text><TextInput style={ms.input} value={form.sub || ''} onChangeText={v => setForm(f => ({ ...f, sub: v }))} placeholder="Ad subtitle" /></View>
          <View style={ms.modalActions}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose}><Text style={ms.cancelTxt}>Cancel</Text></TouchableOpacity>
            {!(ad&&ad.isNew) && onDelete && (
              <TouchableOpacity style={[ms.cancelBtn, { backgroundColor: 'rgba(231,76,60,0.10)', borderWidth: 1, borderColor: 'rgba(231,76,60,0.25)' }]} onPress={() => { onClose(); onDelete(ad.id); }}>
                <Text style={[ms.cancelTxt, { color: '#e74c3c' }]}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{ flex: 2, borderRadius: 10, overflow: 'hidden' }} onPress={() => onSave(form)}>
              <LinearGradient colors={['#1a3a6b', '#2e5fa3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff' }}>Save Ad</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(1,20,50,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalWrapper: { width: '100%', maxWidth: 540 },
  modalCard: { backgroundColor: '#f0f5f9', borderRadius: 20, padding: 18, gap: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, elevation: 12 },
  modalTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 16, color: '#011f4b', textAlign: 'center', marginBottom: 4 },
  imgPicker: { alignSelf: 'center', width: 86, height: 86, borderRadius: 43, backgroundColor: 'rgba(1,31,75,0.07)', borderWidth: 2, borderColor: 'rgba(1,31,75,0.15)', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  imgPreview: { width: 86, height: 86, borderRadius: 43 },
  imgHint: { fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: 'rgba(1,31,75,0.40)', textAlign: 'center' },
  imgBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: '#1a3a6b', borderRadius: 10, padding: 4 },
  fieldRow: { gap: 4 },
  fieldLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(1,31,75,0.50)', letterSpacing: 1, textTransform: 'uppercase' },
  input: { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: '#011f4b', borderWidth: 1, borderColor: 'rgba(1,31,75,0.12)' },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(1,31,75,0.07)' },
  chipActive: { backgroundColor: '#1a3a6b' },
  chipTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.60)' },
  chipTxtActive: { fontFamily: 'GoogleSans_700Bold', color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  cancelBtn: { flex: 1, borderRadius: 10, backgroundColor: 'rgba(1,31,75,0.07)', paddingVertical: 11, alignItems: 'center' },
  cancelTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: 'rgba(1,31,75,0.50)' },

  // ── Size section ──────────────────────────────────────────────────────────
  sizeSection: { backgroundColor: 'rgba(26,58,107,0.06)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(26,58,107,0.12)' },
  sizeSectionTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#1a3a6b', letterSpacing: 1.2, textTransform: 'uppercase' },
  sizeGroupLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(1,31,75,0.55)', letterSpacing: 1.2, textTransform: 'uppercase' },
  sizeQuickBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(26,58,107,0.10)', borderWidth: 1, borderColor: 'rgba(26,58,107,0.18)' },
  sizeQuickBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#1a3a6b' },
  // Adult size chips — navy theme
  sizeChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.70)', borderWidth: 1.5, borderColor: 'rgba(26,58,107,0.20)', minWidth: 38, alignItems: 'center' },
  sizeChipActive: { backgroundColor: '#1a3a6b', borderColor: '#1a3a6b' },
  sizeChipTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: 'rgba(26,58,107,0.70)' },
  sizeChipTxtActive: { color: '#fff' },
  // Kids size chips — teal/green theme
  sizeChipKidsActive: { backgroundColor: '#1a6b45', borderColor: '#1a6b45' },
  sizeChipKidsTxtActive: { color: '#fff' },
  // Summary bar
  sizeSummary: { marginTop: 8, backgroundColor: 'rgba(26,58,107,0.10)', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  sizeSummaryTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#1a3a6b', lineHeight: 15 },
});

// ─── CASHIER SIZE PICKER MODAL ────────────────────────────────────────────────
const CashierSizePickerModal = ({ visible, item, onConfirm, onClose }) => {
  const [sel, setSel] = useState(null);
  useEffect(() => { if (visible) setSel(null); }, [visible]);
  if (!item) return null;

  const availSizes = Array.isArray(item.sizes) ? item.sizes : [];
  const adultSizes = availSizes.filter(s => ADULT_SIZES.includes(s));
  const kidsSizes  = availSizes.filter(s => KIDS_SIZES.includes(s));
  const otherSizes = availSizes.filter(s => !ADULT_SIZES.includes(s) && !KIDS_SIZES.includes(s));

  const Chip = ({ size, isKids }) => (
    <TouchableOpacity
      onPress={() => setSel(size)}
      style={{
        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9,
        backgroundColor: sel === size ? (isKids ? '#1a6b45' : '#1a3a6b') : 'rgba(1,31,75,0.07)',
        borderWidth: 1.5,
        borderColor: sel === size ? (isKids ? '#1a6b45' : '#1a3a6b') : 'rgba(1,31,75,0.15)',
        minWidth: 46, alignItems: 'center',
      }}
    >
      <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: sel === size ? '#fff' : 'rgba(1,31,75,0.65)' }}>
        {size}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(1,20,50,0.60)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 22, width: 340, gap: 14 }}>
          {/* Header */}
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: '#1a3a6b' }}>
              {item.emoji}  Select Size
            </Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(1,31,75,0.55)', textAlign: 'center' }} numberOfLines={2}>
              {item.name}
            </Text>
          </View>

          {availSizes.length === 0 ? (
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(1,31,75,0.45)', textAlign: 'center', paddingVertical: 8 }}>
              No sizes configured for this item.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {adultSizes.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(26,58,107,0.50)', letterSpacing: 1.2, textTransform: 'uppercase' }}>ADULT</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {adultSizes.map(sz => <Chip key={sz} size={sz} isKids={false} />)}
                  </View>
                </View>
              )}
              {kidsSizes.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(26,107,69,0.60)', letterSpacing: 1.2, textTransform: 'uppercase' }}>KIDS</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {kidsSizes.map(sz => <Chip key={sz} size={sz} isKids={true} />)}
                  </View>
                </View>
              )}
              {otherSizes.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(1,31,75,0.45)', letterSpacing: 1.2, textTransform: 'uppercase' }}>OTHER</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {otherSizes.map(sz => <Chip key={sz} size={sz} isKids={false} />)}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
            <TouchableOpacity onPress={onClose}
              style={{ flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: 'rgba(1,31,75,0.07)', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: 'rgba(1,31,75,0.50)' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (sel) onConfirm(sel); }}
              style={{ flex: 2, paddingVertical: 11, borderRadius: 10, backgroundColor: sel ? '#1a3a6b' : 'rgba(1,31,75,0.20)', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff' }}>
                {sel ? `Add to Cart — ${sel}` : 'Pick a size first'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── CASHIER SCREEN ───────────────────────────────────────────────────────────
const CashierScreen = ({ items, categories, addOrder, deductStock }) => {
  const [activeCat, setActiveCat]  = useState('All');
  const [search, setSearch]        = useState('');
  const [cart, setCart]            = useState({});
  const [amountPaid, setAmountPaid]= useState('');
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [lastOrder, setLastOrder]  = useState(null);
  const [paymentMode, setPaymentMode] = useState('cash');
  // Size picker state
  const [sizePickerItem, setSizePickerItem] = useState(null);

  const needsSize = (item) => Array.isArray(item.sizes) && item.sizes.length > 0;

  const filtered = items.filter(i => {
    if (search.trim()) return i.name.toLowerCase().includes(search.toLowerCase());
    return activeCat === 'All' || i.cat === activeCat;
  });

  const cartItems = Object.values(cart).filter(c => c.qty > 0);
  const total     = cartItems.reduce((s, { item, qty }) => s + item.price * qty, 0);
  const paid      = parseFloat(amountPaid) || 0;
  const change    = paid - total;

  // Size-aware cart key: "itemId-SIZE" for sized items, "itemId" for others
  const cartKey = (item, size) => (size ? `${item.id}-${size}` : item.id);

  const addToCart = (item, size) => {
    if (needsSize(item) && !size) { setSizePickerItem(item); return; }
    const key = cartKey(item, size);
    setCart(prev => ({ ...prev, [key]: { item, qty: (prev[key] ? prev[key].qty : 0) + 1, size: size || null } }));
  };

  const removeFromCart = (item, size) => {
    const key = cartKey(item, size);
    setCart(prev => {
      const qty = (prev[key] ? prev[key].qty : 0) - 1;
      if (qty <= 0) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: { item, qty, size: size || null } };
    });
  };

  const clearCart = () => { setCart({}); setAmountPaid(''); };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;
    if (paymentMode === 'cash' && paid < total) { Alert.alert('Insufficient Amount', 'Please enter the correct amount paid.'); return; }
    const orderNo = Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const time = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) + '  ' + now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    const order = { id: Date.now().toString(), orderNo, time, items: cartItems, total, amountPaid: paymentMode === 'cash' ? paid : total, change: paymentMode === 'cash' ? change : 0, payment: paymentMode, status: 'pending', source: 'cashier' };
    await addOrder(order);
    await deductStock(cartItems);
    setLastOrder(order);
    clearCart();
    setTimeout(() => setReceiptVisible(true), 200);
  };

  // FIX: 6 items per row
  const COLS = 6;

  return (
    <View style={{ flex: 1, flexDirection: 'row', minHeight: 0, overflow: 'hidden' }}>
      {/* Items side */}
      <View style={{ flex: 1, minHeight: 0, minWidth: 0, flexDirection: 'column', overflow: 'hidden' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginBottom: 6 }}
          contentContainerStyle={{ paddingHorizontal: 10, gap: 5, paddingVertical: 4 }}>
          {categories.map(cat => (
            <TouchableOpacity key={cat} style={[cs.catTab, activeCat === cat && cs.catTabActive]} onPress={() => setActiveCat(cat)}>
              <Text style={[cs.catTabTxt, activeCat === cat && cs.catTabTxtActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={cs.searchRow}>
          <MaterialIcons name="search" size={15} color="rgba(1,31,75,0.40)" />
          <TextInput style={cs.searchInput} placeholder="Search items..." placeholderTextColor="rgba(1,31,75,0.35)"
            value={search} onChangeText={setSearch} />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color: 'rgba(1,31,75,0.40)', fontWeight: '700' }}>✕</Text></TouchableOpacity>}
        </View>

        {/* FIX: padding 10/12, gap 8 */}
        <WebScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 12, paddingBottom: 20, gap: 8 }}>
          {Array.from({ length: Math.ceil(filtered.length / COLS) }, (_, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch' }}>
              {filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS).map(item => (
                <View key={item.id} style={{ flex: 1, alignSelf: 'stretch' }}>
                <TouchableOpacity style={[cs.itemCard, item.stock === 0 && { opacity: 0.45 }, { flex: 1 }]}
                  onPress={() => item.stock > 0 && addToCart(item, null)} activeOpacity={item.stock > 0 ? 0.75 : 1}>
                  <View style={cs.itemImgCircle}>
                    {item.image ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%', borderRadius: 99 }} resizeMode="cover" /> : <Text style={cs.itemEmoji}>{item.emoji}</Text>}
                  </View>
                  <Text style={cs.itemCardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={cs.itemCardPrice}>₱{item.price}</Text>
                  <Text style={cs.itemCardStock}>{item.stock === 0 ? 'Out of stock' : ('Stock: ' + item.stock)}</Text>
                  {Array.isArray(item.sizes) && item.sizes.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, justifyContent: 'center', marginTop: 1 }}>
                      {item.sizes.slice(0, 5).map(sz => {
                        const isKids = KIDS_SIZES.includes(sz);
                        return (
                          <View key={sz} style={{ backgroundColor: isKids ? 'rgba(26,107,69,0.12)' : 'rgba(26,58,107,0.10)', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, borderWidth: 1, borderColor: isKids ? 'rgba(26,107,69,0.22)' : 'rgba(26,58,107,0.15)' }}>
                            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 6, color: isKids ? '#1a6b45' : '#1a3a6b' }}>{sz}</Text>
                          </View>
                        );
                      })}
                      {item.sizes.length > 5 && <View style={{ backgroundColor: 'rgba(26,58,107,0.10)', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 }}><Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 6, color: '#1a3a6b' }}>+{item.sizes.length - 5}</Text></View>}
                    </View>
                  )}
                  {(() => {
                    const totalInCart = Object.entries(cart).filter(([k]) => k === item.id || k.startsWith(item.id + '-')).reduce((s, [, v]) => s + v.qty, 0);
                    return totalInCart > 0 ? <View style={cs.cartBadge}><Text style={cs.cartBadgeTxt}>{totalInCart}</Text></View> : null;
                  })()}
                </TouchableOpacity>
                </View>
              ))}
              {Array.from({ length: COLS - filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS).length }).map((_, i) => (<View key={'e-' + i} style={{ flex: 1 }} />))}
            </View>
          ))}
        </WebScrollView>
      </View>

      {/* Cart side */}
      <View style={cs.cartPanel}>
        <Text style={cs.cartTitle}>🛒 CART</Text>
        <View style={cs.cartItemsBox}>
          {cartItems.length === 0
            ? <Text style={cs.cartEmpty}>No items added yet</Text>
            : <WebScrollView style={{ flex: 1 }}>
                {cartItems.map(({ item, qty, size }) => (
                  <View key={size ? item.id + '-' + size : item.id} style={cs.cartRow}>
                    <Text style={cs.cartEmoji}>{item.emoji}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={cs.cartName} numberOfLines={1}>{item.name}{size ? ' [' + size + ']' : ''}</Text>
                      <Text style={cs.cartSub}>₱{item.price} × {qty} = ₱{item.price * qty}</Text>
                    </View>
                    <View style={cs.qtyRow}>
                      <TouchableOpacity style={cs.qBtn} onPress={() => removeFromCart(item, size)}><Text style={cs.qBtnTxt}>−</Text></TouchableOpacity>
                      <Text style={cs.qVal}>{qty}</Text>
                      <TouchableOpacity style={[cs.qBtn, { backgroundColor: '#1a3a6b' }]} onPress={() => addToCart(item, size)}><Text style={[cs.qBtnTxt, { color: '#fff' }]}>+</Text></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </WebScrollView>
          }
        </View>

        <View style={cs.totalRow}><Text style={cs.totalLbl}>TOTAL</Text><Text style={cs.totalVal}>₱ {total.toFixed(2)}</Text></View>

        {/* Payment Mode */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(1,31,75,0.50)', letterSpacing: 1, textTransform: 'uppercase' }}>Payment Mode</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[{ k: 'cash', l: '💵 Cash' }, { k: 'gcash', l: '📱 GCash' }, { k: 'credit', l: '💳 Credit' }].map(p => (
              <TouchableOpacity key={p.k} onPress={() => setPaymentMode(p.k)}
                style={[cs.payChip, paymentMode === p.k && cs.payChipActive]}>
                <Text style={[cs.payChipTxt, paymentMode === p.k && cs.payChipTxtActive]}>{p.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {paymentMode === 'cash' && (
          <View style={{ gap: 3 }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(1,31,75,0.50)', letterSpacing: 1, textTransform: 'uppercase' }}>Amount Paid (Cash)</Text>
            <TextInput style={cs.amtInput} value={amountPaid} onChangeText={setAmountPaid} keyboardType="numeric" placeholder="₱ 0.00" placeholderTextColor="rgba(1,31,75,0.30)" />
          </View>
        )}

        {paymentMode === 'cash' && amountPaid !== '' && (
          <View style={[cs.changeRow, { backgroundColor: change < 0 ? 'rgba(231,76,60,0.10)' : 'rgba(39,174,96,0.10)', borderRadius: 8, padding: 8 }]}>
            <Text style={cs.changeLbl}>Change</Text>
            <Text style={[cs.changeVal, { color: change < 0 ? '#e74c3c' : '#27ae60' }]}>₱ {change.toFixed(2)}</Text>
          </View>
        )}

        <TouchableOpacity style={[cs.orderBtn, cartItems.length === 0 && { opacity: 0.45 }]} onPress={handlePlaceOrder} activeOpacity={0.80}>
          <LinearGradient colors={cartItems.length > 0 ? ['#27ae60', '#2ecc71'] : ['#aaa', '#bbb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cs.orderBtnGrad}>
            <MaterialIcons name="check-circle" size={16} color="#fff" />
            <Text style={cs.orderBtnTxt}>Place Order</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={cs.clearBtn} onPress={clearCart}>
          <MaterialIcons name="delete-sweep" size={14} color="#e74c3c" />
          <Text style={cs.clearBtnTxt}>Clear Cart</Text>
        </TouchableOpacity>
        {lastOrder && (
          <TouchableOpacity style={cs.receiptBtn} onPress={() => setReceiptVisible(true)}>
            <MaterialIcons name="receipt" size={14} color="#1a3a6b" />
            <Text style={cs.receiptBtnTxt}>Last Receipt</Text>
          </TouchableOpacity>
        )}
      </View>

      {receiptVisible && lastOrder && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setReceiptVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(1,20,50,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setReceiptVisible(false)} activeOpacity={1} />
            <View style={cs.receipt}>
              <Text style={cs.receiptTitle}>🧾 RECEIPT</Text>
              <Text style={cs.receiptSub}>CESLA Merchandise</Text>
              <View style={{ height: 1, borderStyle: 'dashed', borderTopWidth: 1, borderColor: 'rgba(1,31,75,0.20)', marginVertical: 10 }} />
              <Text style={cs.receiptMeta}>Order #{lastOrder.orderNo}</Text>
              <Text style={cs.receiptMeta}>{lastOrder.time}</Text>
              <View style={{ height: 1, borderStyle: 'dashed', borderTopWidth: 1, borderColor: 'rgba(1,31,75,0.20)', marginVertical: 10 }} />
              <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                {(lastOrder.items || []).map(({ item, qty, size }) => (
                  <View key={size ? item.id + '-' + size : item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={cs.receiptItem} numberOfLines={1}>{item.emoji} {item.name}{size ? ' [' + size + ']' : ''} ×{qty}</Text>
                    <Text style={cs.receiptAmt}>₱{(item.price * qty).toFixed(2)}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={{ height: 1, backgroundColor: 'rgba(1,31,75,0.15)', marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={cs.receiptTotalLbl}>TOTAL</Text><Text style={cs.receiptTotalVal}>₱{lastOrder.total.toFixed(2)}</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}><Text style={cs.receiptSubLbl}>Payment</Text><Text style={cs.receiptSubVal}>{lastOrder.payment === 'gcash' ? '📱 GCash' : lastOrder.payment === 'credit' ? '💳 Credit' : '💵 Cash'}</Text></View>
              {lastOrder.payment === 'cash' && <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}><Text style={cs.receiptSubLbl}>Cash</Text><Text style={cs.receiptSubVal}>₱{lastOrder.amountPaid.toFixed(2)}</Text></View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}><Text style={cs.receiptSubLbl}>Change</Text><Text style={[cs.receiptSubVal, { color: '#27ae60' }]}>₱{lastOrder.change.toFixed(2)}</Text></View>
              </>}
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#1a3a6b', textAlign: 'center', marginTop: 12 }}>Thank you! 🙏</Text>
              <TouchableOpacity onPress={() => setReceiptVisible(false)} style={{ marginTop: 12, paddingVertical: 10, backgroundColor: 'rgba(26,58,107,0.10)', borderRadius: 10, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#1a3a6b' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Size picker for apparel items */}
      <CashierSizePickerModal
        visible={!!sizePickerItem}
        item={sizePickerItem}
        onConfirm={(size) => { addToCart(sizePickerItem, size); setSizePickerItem(null); }}
        onClose={() => setSizePickerItem(null)}
      />
    </View>
  );
};

const cs = StyleSheet.create({
  catTab: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  catTabActive: { backgroundColor: '#304674', borderColor: '#c9a84c' },
  catTabTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: 'rgba(1,31,75,0.70)' },
  catTabTxtActive: { color: '#fff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.70)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginHorizontal: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)', gap: 6 },
  searchInput: { flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: '#011f4b', paddingVertical: 0 },
  // FIX: uniform card size with minHeight, smaller image for 6-col layout
  itemCard: { flex: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.70)', borderRadius: 12, padding: 8, alignItems: 'center', justifyContent: 'space-between', gap: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)', position: 'relative', minHeight: 130 },
  itemImgCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(240,246,252,0.90)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)', flexShrink: 0 },
  itemEmoji: { fontSize: 20 },
  itemCardName: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#1a2d4e', textAlign: 'center', lineHeight: 12, minHeight: 24, width: '100%' },
  itemCardPrice: { fontFamily: 'NotoSerif_700Bold', fontSize: 12, color: '#c9a84c' },
  itemCardStock: { fontFamily: 'GoogleSans_400Regular', fontSize: 8, color: 'rgba(1,31,75,0.45)' },
  cartBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#e74c3c', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  cartBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#fff' },
  cartPanel: { width: 240, flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.22)', borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.40)', padding: 10, gap: 6, minHeight: 0, overflow: 'hidden' },
  cartTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: 'rgba(1,31,75,0.65)', letterSpacing: 2, paddingBottom: 6, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.10)' },
  cartItemsBox: { flex: 1, minHeight: 50, backgroundColor: 'rgba(255,255,255,0.40)', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' },
  cartEmpty: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.40)', textAlign: 'center', paddingTop: 12 },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.06)' },
  cartEmoji: { fontSize: 15 },
  cartName: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#011f4b' },
  cartSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: 'rgba(1,31,75,0.50)' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  qBtn: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(1,31,75,0.10)', justifyContent: 'center', alignItems: 'center' },
  qBtnTxt: { fontSize: 11, color: '#011f4b', fontWeight: '700', lineHeight: 14 },
  qVal: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#011f4b', minWidth: 12, textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  totalLbl: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(1,31,75,0.55)', letterSpacing: 1 },
  totalVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 13, color: '#c9a84c' },
  payChip: { flex: 1, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.50)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)', alignItems: 'center' },
  payChipActive: { backgroundColor: '#1a3a6b', borderColor: '#c9a84c' },
  payChipTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: 'rgba(1,31,75,0.60)' },
  payChipTxtActive: { fontFamily: 'GoogleSans_700Bold', color: '#fff' },
  amtInput: { backgroundColor: 'rgba(255,255,255,0.70)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: '#011f4b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)' },
  changeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  changeLbl: { fontFamily: 'GoogleSans_500Medium', fontSize: 10, color: 'rgba(1,31,75,0.60)' },
  changeVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 13 },
  orderBtn: { borderRadius: 10, overflow: 'hidden' },
  orderBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  orderBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#fff' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, backgroundColor: 'rgba(231,76,60,0.10)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(231,76,60,0.20)' },
  clearBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#e74c3c' },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, backgroundColor: 'rgba(26,58,107,0.10)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(26,58,107,0.20)' },
  receiptBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#1a3a6b' },
  receipt: { backgroundColor: '#fffef8', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, elevation: 14 },
  receiptTitle: { fontFamily: 'NotoSerif_700Bold', fontSize: 18, color: '#1a2d4e', textAlign: 'center' },
  receiptSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.50)', textAlign: 'center', marginTop: 2 },
  receiptMeta: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.55)', textAlign: 'center', lineHeight: 17 },
  receiptItem: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: '#1a2d4e', flex: 1, marginRight: 8 },
  receiptAmt: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#1a2d4e' },
  receiptTotalLbl: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#1a2d4e' },
  receiptTotalVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: '#c9a84c' },
  receiptSubLbl: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(1,31,75,0.55)' },
  receiptSubVal: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: 'rgba(1,31,75,0.70)' },
});

// ─── MANAGE ITEMS SCREEN ──────────────────────────────────────────────────────
const ManageItemsScreen = ({ items, categories, filtered, search, activeCategory, onSearch, onCategoryChange, onAddItem, onEditItem, onDeleteItem }) => {
  // FIX: 6 columns
  const COLS = 6;
  return (
    <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', overflow: 'hidden' }}>
      <View style={mm.catPanel}>
        <Text style={mm.catTitle}>CATEGORIES</Text>
        <WebScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }}>
          {categories.map(cat => (
            <TouchableOpacity key={cat} style={[mm.catBtn, activeCategory === cat && mm.catBtnActive]} onPress={() => onCategoryChange(cat)}>
              <Text style={[mm.catBtnTxt, activeCategory === cat && mm.catBtnTxtActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </WebScrollView>
      </View>

      <View style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        <View style={mm.headerRow}>
          <Text style={mm.headerLbl} numberOfLines={1}>
            {search.trim() ? 'RESULTS FOR "' + search.toUpperCase() + '"' : activeCategory === 'All' ? 'ALL ITEMS' : activeCategory.toUpperCase()}
          </Text>
          <View style={mm.searchBox}>
            <MaterialIcons name="search" size={13} color="rgba(1,31,75,0.40)" />
            <TextInput style={mm.searchInput} placeholder="Search..." placeholderTextColor="rgba(1,31,75,0.35)"
              value={search} onChangeText={onSearch} />
            {search.length > 0 && <TouchableOpacity onPress={() => onSearch('')}><Text style={{ color: 'rgba(1,31,75,0.45)', fontWeight: '700', fontSize: 12 }}>✕</Text></TouchableOpacity>}
          </View>
          <TouchableOpacity style={mm.addBtn} onPress={onAddItem}>
            <MaterialIcons name="add" size={15} color="#fff" />
            <Text style={mm.addBtnTxt}>Add Item</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(1,31,75,0.10)', marginBottom: 8, marginHorizontal: 8 }} />
        {/* FIX: padding 10/12, gap 8 */}
        <WebScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, paddingHorizontal: 12, gap: 8, paddingBottom: 20 }}>
          {filtered.length === 0
            ? <Text style={mm.emptyTxt}>No items found.</Text>
            : Array.from({ length: Math.ceil(filtered.length / COLS) }, (_, rowIdx) => (
              // FIX: gap 8, alignItems stretch
              <View key={rowIdx} style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch' }}>
                {filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS).map(item => (
                  // FIX: alignSelf stretch so all cards same height
                  <View key={item.id} style={{ flex: 1, minWidth: 0, alignSelf: 'stretch' }}>
                    <View style={mm.foodCard}>
                      <View style={[mm.foodCardInner, { backgroundColor: 'rgba(225,238,248,0.85)' }]}>
                        <View style={mm.adminBtns}>
                          <TouchableOpacity style={mm.editBtn} onPress={() => onEditItem(item)}><MaterialIcons name="edit" size={11} color="#1a3a6b" /></TouchableOpacity>
                          <TouchableOpacity style={mm.delBtn} onPress={() => onDeleteItem(item.id)}><MaterialIcons name="delete" size={11} color="#e74c3c" /></TouchableOpacity>
                        </View>
                        <View style={mm.emojiCircle}>
                          {item.image ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%', borderRadius: 99 }} resizeMode="cover" /> : <Text style={mm.emojiTxt}>{item.emoji}</Text>}
                        </View>
                        <Text style={mm.itemName} numberOfLines={2}>{item.name}</Text>
                        <Text style={mm.itemStock}>Stock: {item.stock}</Text>
                        <Text style={mm.itemPrice}>₱{item.price}.00</Text>
                        {Array.isArray(item.sizes) && item.sizes.length > 0 && (
                          <View style={mm.sizesBadgeRow}>
                            {item.sizes.slice(0, 5).map(sz => (
                              <View key={sz} style={mm.sizeBadge}><Text style={mm.sizeBadgeTxt}>{sz}</Text></View>
                            ))}
                            {item.sizes.length > 5 && <View style={mm.sizeBadge}><Text style={mm.sizeBadgeTxt}>+{item.sizes.length - 5}</Text></View>}
                          </View>
                        )}
                        {Array.isArray(item.colors) && item.colors.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center', marginTop: 2 }}>
                            {(COLOR_OPTIONS[item.cat] || []).filter(c => item.colors.includes(c.label)).map(c => (
                              <View key={c.label} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.hex, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' }} />
                            ))}
                          </View>
                        )}
                        <TouchableOpacity style={mm.editItemBtn} onPress={() => onEditItem(item)}>
                          <Text style={mm.editItemBtnTxt}>Edit Item</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
                {Array.from({ length: COLS - filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS).length }).map((_, i) => (<View key={'e-' + i} style={{ flex: 1 }} />))}
              </View>
            ))
          }
        </WebScrollView>
      </View>
    </View>
  );
};

const mm = StyleSheet.create({
  catPanel: { width: 130, flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.20)', borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.40)', padding: 10, minHeight: 0 },
  catTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(1,31,75,0.50)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.10)' },
  catBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
  catBtnActive: { backgroundColor: 'rgba(26,58,107,0.18)' },
  catBtnTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(1,31,75,0.60)' },
  catBtnTxtActive: { fontFamily: 'GoogleSans_700Bold', color: '#1a3a6b' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, paddingBottom: 0 },
  headerLbl: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#011f4b', letterSpacing: 2, flexShrink: 0 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)', gap: 4 },
  searchInput: { flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: '#011f4b', paddingVertical: 0 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1a3a6b', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  addBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#fff' },
  emptyTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(1,31,75,0.40)', textAlign: 'center', marginTop: 30 },
  // FIX: uniform card sizes for 6-col layout
  foodCard: { borderRadius: 12, overflow: 'hidden', flex: 1, alignSelf: 'stretch' },
  foodCardInner: { borderRadius: 12, padding: 9, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'space-between', position: 'relative', minHeight: 145 },
  adminBtns: { position: 'absolute', top: 4, right: 4, flexDirection: 'row', gap: 3, zIndex: 10 },
  editBtn: { backgroundColor: 'rgba(26,58,107,0.12)', borderRadius: 6, padding: 4, borderWidth: 1, borderColor: 'rgba(26,58,107,0.20)' },
  delBtn: { backgroundColor: 'rgba(231,76,60,0.10)', borderRadius: 6, padding: 4, borderWidth: 1, borderColor: 'rgba(231,76,60,0.20)' },
  emojiCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(240,246,252,0.90)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 },
  emojiTxt: { fontSize: 22 },
  itemName: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#1a2d4e', textAlign: 'center', lineHeight: 12, minHeight: 24, alignSelf: 'stretch' },
  itemStock: { fontFamily: 'GoogleSans_400Regular', fontSize: 8, color: 'rgba(1,31,75,0.45)' },
  itemPrice: { fontFamily: 'NotoSerif_700Bold', fontSize: 12, color: '#c9a84c' },
  editItemBtn: { backgroundColor: '#1a3a6b', borderRadius: 6, paddingVertical: 5, paddingHorizontal: 4, alignItems: 'center', width: '100%' },
  editItemBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 8, color: '#fff' },
  sizesBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, justifyContent: 'center', marginTop: 1 },
  sizeBadge: { backgroundColor: 'rgba(26,58,107,0.12)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: 'rgba(26,58,107,0.18)' },
  sizeBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 7, color: '#1a3a6b' },
});

// ─── INVENTORY SCREEN ─────────────────────────────────────────────────────────
const InventoryScreen = ({ items, maxQtyMap, onAddItem, onEditItem }) => {
  const today = new Date();

  // ── Date label formatting ─────────────────────────────────────────────────
  const formatDateLabel = (d) => {
    const now = new Date();
    const todayKey = now.toDateString();
    const yestKey  = new Date(now - 86400000).toDateString();
    const opts = { month: 'long', day: 'numeric', year: 'numeric' };
    if (d.toDateString() === todayKey) return "Today's Stocks, " + d.toLocaleDateString('en-PH', opts);
    if (d.toDateString() === yestKey)  return "Yesterday's Stocks, " + d.toLocaleDateString('en-PH', opts);
    return "Stocks — " + d.toLocaleDateString('en-PH', opts);
  };

  // ── Calendar date picker state ─────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Build calendar grid for selected month
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear,  setCalYear]  = useState(today.getFullYear());

  const calDays = (() => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const days  = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    return cells;
  })();

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  // ── Unit of Measure per item (editable) ───────────────────────────────────
  const [units, setUnits] = useState({});
  const getUnit = (id) => units[id] || 'pcs';
  const UNIT_OPTIONS = ['pcs','kilo','case','pack','box','dozen','liter','bag'];
  const [unitDropdown, setUnitDropdown] = useState(null);

  // ── Max QTY per item (editable) ────────────────────────────────────────────
  const getMax = (id) => (maxQtyMap && maxQtyMap[id] !== undefined) ? maxQtyMap[id] : ((items.find(i=>i.id===id)||{}).maxQty || 50);

  // ── Totals ────────────────────────────────────────────────────────────────
  const overallPrice = items.reduce((s, i) => s + i.price, 0);
  const overallQty   = items.reduce((s, i) => s + i.stock, 0);
  const grandTotal   = items.reduce((s, i) => s + i.price * i.stock, 0);

  return (
    <View style={{ flex:1, minHeight:0, overflow:'hidden', position:'relative' }}>

      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginHorizontal:14, marginTop:8, marginBottom:6 }}>
        <TouchableOpacity
          style={inv2.titleRow}
          onPress={() => setShowDatePicker(p => !p)}
          activeOpacity={0.80}
        >
          <Text style={inv2.titleText}>{formatDateLabel(selectedDate)}</Text>
          <Text style={inv2.titleCaret}>{showDatePicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={inv2.addItemBtn} onPress={() => onAddItem && onAddItem()} activeOpacity={0.80}>
          <Text style={inv2.addItemBtnTxt}>+ Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* ── Calendar dropdown ── */}
      {showDatePicker && (
        <View style={inv2.calCard}>
          {/* Month nav */}
          <View style={inv2.calNav}>
            <TouchableOpacity style={inv2.calNavBtn} onPress={() => {
              if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); }
              else setCalMonth(m => m-1);
            }}><Text style={inv2.calNavTxt}>‹</Text></TouchableOpacity>
            <Text style={inv2.calMonthLbl}>{MONTHS[calMonth]} {calYear}</Text>
            <TouchableOpacity style={inv2.calNavBtn} onPress={() => {
              if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); }
              else setCalMonth(m => m+1);
            }}><Text style={inv2.calNavTxt}>›</Text></TouchableOpacity>
          </View>
          {/* Day headers */}
          <View style={inv2.calDaysRow}>
            {DAYS.map(d => <Text key={d} style={inv2.calDayHdr}>{d}</Text>)}
          </View>
          {/* Date grid */}
          <View style={inv2.calGrid}>
            {calDays.map((day, idx) => {
              if (!day) return <View key={'e'+idx} style={inv2.calCell}/>;
              const thisDate   = new Date(calYear, calMonth, day);
              const isSelected = thisDate.toDateString() === selectedDate.toDateString();
              const isToday    = thisDate.toDateString() === today.toDateString();
              return (
                <TouchableOpacity key={idx} style={[inv2.calCell, isSelected && inv2.calCellSel, isToday && !isSelected && inv2.calCellToday]}
                  onPress={() => { setSelectedDate(new Date(calYear, calMonth, day)); setShowDatePicker(false); }}>
                  <Text style={[inv2.calCellTxt, isSelected && inv2.calCellTxtSel]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Table ── */}
      <View style={inv2.tableWrap}>
        {/* Header */}
        <View style={inv2.thead}>
          <Text style={[inv2.th, inv2.colName]}>ITEM NAME</Text>
          <Text style={[inv2.th, inv2.colCat]}>CATEGORY</Text>
          <Text style={[inv2.th, inv2.colQty]}>QTY</Text>
          <Text style={[inv2.th, inv2.colMaxQty]}>MAX QTY</Text>
          <Text style={[inv2.th, inv2.colPrice]}>PRICE</Text>
          <Text style={[inv2.th, inv2.colValue]}>VALUE</Text>
          <Text style={[inv2.th, inv2.colRestock]}>RE-STOCK</Text>
        </View>

        {/* Rows */}
        <WebScrollView style={{ flex:1 }} contentContainerStyle={{ gap:0 }}>
          {items.map((item, idx) => {
            const max     = getMax(item.id);
            const restock = Math.max(0, max - item.stock);
            return (
              <TouchableOpacity key={item.id} style={[inv2.trow, idx % 2 === 0 && inv2.trowAlt]} onPress={() => onEditItem && onEditItem(item)} activeOpacity={0.75}>
                {/* Item Name */}
                <View style={[inv2.td, inv2.colName]}>
                  <Text style={inv2.tdName} numberOfLines={1}>{item.emoji}  {item.name}</Text>
                </View>
                {/* Category */}
                <View style={[inv2.td, inv2.colCat]}>
                  <Text style={inv2.tdMuted} numberOfLines={1}>{item.cat}</Text>
                </View>
                {/* QTY */}
                <View style={[inv2.td, inv2.colQty]}>
                  <Text style={[inv2.tdNum,
                    item.stock === 0 && { color:'#e74c3c', fontFamily:'GoogleSans_700Bold' },
                    item.stock <= 5 && item.stock > 0 && { color:'#b85c00', fontFamily:'GoogleSans_700Bold' },
                  ]}>{item.stock}</Text>
                </View>
                {/* Max QTY */}
                <View style={[inv2.td, inv2.colMaxQty]}>
                  <Text style={[inv2.tdNum, { textAlign:'center' }]}>{getMax(item.id)}</Text>
                </View>
                {/* Price */}
                <View style={[inv2.td, inv2.colPrice]}>
                  <Text style={inv2.tdNum}>₱{item.price.toLocaleString()}</Text>
                </View>
                {/* Value */}
                <View style={[inv2.td, inv2.colValue]}>
                  <Text style={[inv2.tdNum, { color:'#1a3a6b', fontFamily:'GoogleSans_700Bold' }]}>
                    ₱{(item.price * item.stock).toLocaleString()}
                  </Text>
                </View>
                {/* Re-Stock */}
                <View style={[inv2.td, inv2.colRestock]}>
                  {restock > 0 ? (
                    <View style={inv2.restockBadge}>
                      <Text style={inv2.restockNeed}>Need {restock}</Text>
                      <Text style={inv2.restockSub}>({item.stock}/{max})</Text>
                    </View>
                  ) : (
                    <Text style={inv2.restockOk}>✓ OK</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

        </WebScrollView>
        {/* Static TOTALS footer */}
        <View style={inv2.tfooter}>
          <View style={[inv2.td, inv2.colName]}>
            <Text style={inv2.tfootLbl}>TOTALS</Text>
          </View>
          <View style={[inv2.td, inv2.colCat]}/>
          <View style={[inv2.td, inv2.colQty]}>
            <Text style={[inv2.tfootVal, { textAlign:'center' }]}>{overallQty}</Text>
          </View>
          <View style={[inv2.td, inv2.colMaxQty]}/>
          <View style={[inv2.td, inv2.colPrice]}>
            <Text style={[inv2.tfootVal, { textAlign:'center' }]}>₱{overallPrice.toLocaleString()}</Text>
          </View>
          <View style={[inv2.td, inv2.colValue]}>
            <Text style={[inv2.tfootVal, { color:'#8a6500', textAlign:'center' }]}>₱{grandTotal.toLocaleString()}</Text>
          </View>
          <View style={[inv2.td, inv2.colRestock]}/>
        </View>
      </View>
    </View>
  );
};

// ── Inventory styles ──────────────────────────────────────────────────────────
const inv2 = StyleSheet.create({
  // Title
  titleRow: {
    flexDirection:'row', alignItems:'center',
    gap:6, paddingVertical:6, paddingHorizontal:12,
    backgroundColor:'rgba(26,58,107,0.10)', borderRadius:8,
    marginHorizontal:0, marginTop:0, marginBottom:0,
    borderWidth:1, borderColor:'rgba(26,58,107,0.15)',
    alignSelf:'flex-start',
  },
  titleText: { fontFamily:'NotoSerif_700Bold', fontSize:12, color:'#1a3a6b' },
  titleCaret: { fontSize:10, color:'rgba(26,58,107,0.50)' },
  addItemBtn: { backgroundColor:'#1a3a6b', borderRadius:8, paddingVertical:7, paddingHorizontal:14, borderWidth:1, borderColor:'rgba(201,168,76,0.40)' },
  addItemBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#fff', letterSpacing:0.3 },

  // Calendar
  calCard: {
    position:'absolute', top:52, left:14, zIndex:999,
    backgroundColor:'rgba(255,255,255,0.98)', borderRadius:10,
    borderWidth:1, borderColor:'rgba(26,58,107,0.18)',
    padding:8, shadowColor:'#000', shadowOpacity:0.18, shadowRadius:12, elevation:20,
    minWidth:220, maxWidth:260,
  },
  calNav: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:4 },
  calNavBtn: { width:22, height:22, borderRadius:11, backgroundColor:'rgba(26,58,107,0.08)', justifyContent:'center', alignItems:'center' },
  calNavTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#1a3a6b' },
  calMonthLbl: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#1a3a6b' },
  calDaysRow: { flexDirection:'row', marginBottom:2 },
  calDayHdr: { flex:1, fontFamily:'GoogleSans_700Bold', fontSize:8, color:'rgba(26,58,107,0.45)', textAlign:'center', letterSpacing:0.3 },
  calGrid: { flexDirection:'row', flexWrap:'wrap' },
  calCell: { width:'14.28%', height:24, justifyContent:'center', alignItems:'center', borderRadius:4 },
  calCellSel: { backgroundColor:'#1a3a6b' },
  calCellToday: { backgroundColor:'rgba(201,168,76,0.20)', borderWidth:1, borderColor:'#c9a84c' },
  calCellTxt: { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'#1a3a6b' },
  calCellTxtSel: { fontFamily:'GoogleSans_700Bold', color:'#fff' },

  // Table layout
  tableWrap: { flex:1, minHeight:0, marginHorizontal:14, marginBottom:10 },
  thead: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(26,58,107,0.14)',
    borderRadius:8, paddingVertical:9, paddingHorizontal:8,
    marginBottom:2,
  },
  th: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'rgba(26,58,107,0.60)', letterSpacing:0.8, textTransform:'uppercase', textAlign:'center', borderRightWidth:1, borderColor:'rgba(26,58,107,0.10)', paddingHorizontal:4 },
  trow: { flexDirection:'row', alignItems:'center', paddingVertical:8, paddingHorizontal:8, minHeight:42, borderBottomWidth:1, borderColor:'rgba(26,58,107,0.07)' },
  trowAlt: { backgroundColor:'rgba(255,255,255,0.38)' },
  td: { justifyContent:'center', alignItems:'center', paddingHorizontal:4, borderRightWidth:1, borderColor:'rgba(26,58,107,0.10)' },

  // Column widths
  colName:    { flex:2.2, minWidth:0, alignItems:'flex-start' },
  colCat:     { flex:1.1, minWidth:0, alignItems:'center' },
  colQty:     { flex:0.6, minWidth:0, alignItems:'center' },
  colMaxQty:  { flex:0.8, minWidth:0, alignItems:'center' },
  colPrice:   { flex:0.9, minWidth:0, alignItems:'center' },
  colValue:   { flex:1.0, minWidth:0, alignItems:'center' },
  colRestock: { flex:1.0, minWidth:0, alignItems:'center' },

  // Cell text
  tdName:  { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#1a2d4e' },
  tdMuted: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(26,58,107,0.65)', textAlign:'center' },
  tdNum:   { fontFamily:'GoogleSans_500Medium', fontSize:11, color:'#1a2d4e', textAlign:'center' },

  // Unit picker
  unitChip: { flexDirection:'row', alignItems:'center', gap:2, backgroundColor:'rgba(26,58,107,0.08)', borderRadius:6, paddingHorizontal:7, paddingVertical:4, borderWidth:1, borderColor:'rgba(26,58,107,0.15)' },
  unitChipTxt: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#1a3a6b' },
  unitChipArr: { fontSize:8, color:'rgba(26,58,107,0.45)' },
  unitMenu: { position:'absolute', top:26, left:0, backgroundColor:'#fff', borderRadius:8, borderWidth:1, borderColor:'rgba(26,58,107,0.18)', shadowColor:'#000', shadowOpacity:0.14, shadowRadius:8, elevation:12, minWidth:64, zIndex:999 },
  unitOpt: { paddingVertical:7, paddingHorizontal:10 },
  unitOptActive: { backgroundColor:'rgba(26,58,107,0.08)' },
  unitOptTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#1a3a6b' },
  unitOptTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#1a3a6b' },

  // Max QTY input
  maxQtyInput: { width:44, textAlign:'center', fontFamily:'GoogleSans_500Medium', fontSize:11, color:'#1a3a6b', backgroundColor:'rgba(255,255,255,0.80)', borderRadius:6, borderWidth:1, borderColor:'rgba(26,58,107,0.20)', paddingVertical:3, paddingHorizontal:4 },

  // Re-stock badge
  restockBadge: { alignItems:'center' },
  restockNeed: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#b85c00' },
  restockSub:  { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(26,58,107,0.45)' },
  restockOk:   { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#1a7a45' },

  // Footer totals row
  tfooter: {
    flexDirection:'row', alignItems:'center',
    paddingVertical:10, paddingHorizontal:8,
    backgroundColor:'rgba(26,58,107,0.10)',
    borderRadius:6, marginTop:4,
    borderTopWidth:1.5, borderColor:'rgba(26,58,107,0.18)',
  },
  tfootLbl: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#1a3a6b', letterSpacing:0.5 },
  tfootVal: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#1a3a6b', textAlign:'center', letterSpacing:0.2 },
});

const OrderHistoryScreen = ({ orders }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const todayCal = new Date();
  const [calMonth, setCalMonth] = useState(todayCal.getMonth());
  const [calYear,  setCalYear]  = useState(todayCal.getFullYear());
  const HST_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const HST_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const calDays = (() => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const dim = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(d);
    return cells;
  })();

  const parseOrderDate = (timeStr) => {
    if (!timeStr) return null;
    try {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) return d;
      const d2 = new Date(timeStr.replace(/\s+/g,' ').trim());
      return isNaN(d2.getTime()) ? null : d2;
    } catch { return null; }
  };

  const dateKey = (d) => {
    if (!d) return 'unknown';
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  };

  const todayKey = dateKey(new Date());

  const formatLabel = (key) => {
    if (!key || key === 'unknown') return 'Unknown Date';
    const [y,m,day] = key.split('-');
    const d = new Date(Number(y),Number(m)-1,Number(day));
    if (key === todayKey) return 'Today, ' + d.toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'});
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    if (key === dateKey(yesterday)) return 'Yesterday, ' + d.toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'});
    return d.toLocaleDateString('en-PH',{weekday:'short',month:'long',day:'numeric',year:'numeric'});
  };

  const grouped = React.useMemo(() => {
    const map = {};
    [...orders].forEach(o => {
      const d = parseOrderDate(o.time);
      const k = dateKey(d);
      if (!map[k]) map[k] = { key:k, date:d, orders:[] };
      map[k].orders.push(o);
    });
    Object.values(map).forEach(g => g.orders.sort((a,b)=>{
      return ((parseOrderDate(b.time)||{getTime:()=>0}).getTime())-((parseOrderDate(a.time)||{getTime:()=>0}).getTime());
    }));
    return Object.values(map).sort((a,b)=>((b.date&&b.date.getTime()||0))-((a.date&&a.date.getTime()||0)));
  }, [orders]);

  // Always default to today (or first available)
  React.useEffect(() => {
    const todayGroup = grouped.find(g=>g.key===todayKey);
    setSelectedDate(todayGroup ? todayKey : ((grouped[0]&&grouped[0].key) || null));
  }, [grouped.length]);

  const selectedGroup = grouped.find(g=>g.key===selectedDate);
  const displayOrders = (selectedGroup&&selectedGroup.orders) || [];
  const dayTotal = displayOrders.reduce((s,o)=>s+Number(o.total),0);

  return (
    <View style={[sub.root, { position:'relative' }]}>

      {/* Header: calendar date picker */}
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:6 }}>
        <TouchableOpacity style={hst.calTrigger} onPress={() => setShowCalendar(p => !p)} activeOpacity={0.80}>
          <Text style={hst.calTriggerTxt}>{formatLabel(selectedDate)}</Text>
          <Text style={hst.calTriggerCaret}>{showCalendar ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        <Text style={hst.txHeaderSub}>
          {displayOrders.length} order{displayOrders.length!==1?'s':''}
          {'  ·  '}<Text style={{color:'#c9a84c',fontFamily:'GoogleSans_700Bold'}}>₱{dayTotal.toFixed(2)}</Text>
        </Text>
      </View>
      {showCalendar && (
        <View style={hst.calCard}>
          <View style={inv2.calNav}>
            <TouchableOpacity style={inv2.calNavBtn} onPress={() => {
              if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); }
              else setCalMonth(m => m-1);
            }}><Text style={inv2.calNavTxt}>{'<'}</Text></TouchableOpacity>
            <Text style={inv2.calMonthLbl}>{HST_MONTHS[calMonth]} {calYear}</Text>
            <TouchableOpacity style={inv2.calNavBtn} onPress={() => {
              if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); }
              else setCalMonth(m => m+1);
            }}><Text style={inv2.calNavTxt}>{'>'}</Text></TouchableOpacity>
          </View>
          <View style={inv2.calDaysRow}>
            {HST_DAYS.map(d => <Text key={d} style={inv2.calDayHdr}>{d}</Text>)}
          </View>
          <View style={inv2.calGrid}>
            {calDays.map((day, idx) => {
              if (!day) return <View key={'e'+idx} style={inv2.calCell}/>;
              const dk = calYear + '-' + String(calMonth+1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
              const isSel = dk === selectedDate;
              const isToday = dk === todayKey;
              const hasOrders = grouped.some(g => g.key === dk);
              return (
                <TouchableOpacity key={idx}
                  style={[inv2.calCell, isSel && inv2.calCellSel, isToday && !isSel && inv2.calCellToday, !hasOrders && { opacity:0.30 }]}
                  onPress={() => { if (hasOrders) { setSelectedDate(dk); setShowCalendar(false); } }}
                  activeOpacity={hasOrders ? 0.75 : 1}
                >
                  <Text style={[inv2.calCellTxt, isSel && inv2.calCellTxtSel]}>{day}</Text>
                  {hasOrders && !isSel && <View style={hst.calDot}/>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}      <View style={{height:1,backgroundColor:'rgba(1,31,75,0.10)',marginVertical:8}}/>

      {/* ── Transaction timeline ── */}
      {displayOrders.length === 0
        ? <View style={[sub.emptyBox,{flex:1}]}>
            <MaterialIcons name="receipt-long" size={48} color="rgba(1,31,75,0.15)"/>
            <Text style={sub.emptyTxt}>No transactions for this day.</Text>
          </View>
        : <WebScrollView contentContainerStyle={{gap:4, paddingBottom:20}}>
            {displayOrders.map((order, idx) => {
              const timeOnly = (() => {
                const d = parseOrderDate(order.time);
                return d ? d.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}) : (order.time||'');
              })();
              const itemsSummary = (order.items||[]).map(i=>(i.item&&i.item.name||i.name||'Item') + ' ×' + i.qty).join(' · ');
              const isLatest = idx===0 && selectedDate===todayKey;
              const st = ORDER_STATUSES[order.status] || ORDER_STATUSES.pending;
              return (
                <View key={order.id} style={hst.txRow}>
                  {/* Time */}
                  <View style={hst.txTimeCol}>
                    <Text style={hst.txTime}>{timeOnly}</Text>
                    {isLatest && <View style={hst.livePip}/>}
                  </View>
                  {/* Timeline dot + line */}
                  <View style={hst.txLine}>
                    <View style={[hst.txDot, isLatest&&{backgroundColor:'#e74c3c'}]}/>
                    {idx < displayOrders.length-1 && <View style={hst.txVLine}/>}
                  </View>
                  {/* Card */}
                  <View style={hst.txContent}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                      <Text style={hst.txOrderId}>#{order.orderNo||order.id}</Text>
                      <View style={[hst.txStatusBadge,{backgroundColor:st.bg}]}>
                        <Text style={[hst.txStatusTxt,{color:st.color}]}>{st.label}</Text>
                      </View>
                    </View>
                    <Text style={hst.txItems} numberOfLines={2}>{itemsSummary}</Text>
                    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                      <Text style={hst.txAmount}>₱{Number(order.total).toFixed(2)}</Text>
                      <Text style={hst.txPay}>💵 Cash</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </WebScrollView>
      }
    </View>
  );
};

// ─── EMPLOYEE CREDITS ─────────────────────────────────────────────────────────
const EmployeeCreditsScreen = () => (
  <View style={[sub.root,{justifyContent:'center',alignItems:'center',gap:14}]}>
    <MaterialIcons name="account-balance" size={64} color="rgba(1,31,75,0.15)"/>
    <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:20,color:'rgba(1,31,75,0.30)'}}>Coming Soon</Text>
    <Text style={sub.emptyTxt}>Employee credit tracking will be{'\n'}available in a future update.</Text>
  </View>
);

// ─── SALES REPORT ─────────────────────────────────────────────────────────────
const SalesReportScreen = ({ orders, items }) => {
  const currentYear = new Date().getFullYear();
  const [year,         setYear]         = useState(currentYear);
  const [yearDropdown, setYearDropdown] = useState(false);
  const [activeMonth,  setActiveMonth]  = useState(new Date().getMonth());
  const [expandedTxDate,  setExpandedTxDate]  = useState(null);
  const [expandedInvDate, setExpandedInvDate] = useState(null);
  const [showTx,      setShowTx]      = useState(true);
  const [showInv,     setShowInv]     = useState(true);
  const [showCredits, setShowCredits] = useState(true);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const years = Array.from({ length: 30 }, (_, i) => 2025 + i); // 2025 - 2054

  // Parse order date
  const parseDate = (timeStr) => {
    if (!timeStr) return null;
    try {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? null : d;
    } catch { return null; }
  };

  const fmtDateKey = (d) =>
    String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0') + '-' +
    d.getFullYear();

  // All done orders for selected year + month
  const monthOrders = orders.filter(o => {
    const d = parseDate(o.time);
    return d && d.getFullYear() === year && d.getMonth() === activeMonth;
  });

  // Group by day — Transaction History
  const txByDay = React.useMemo(() => {
    const map = {};
    monthOrders.forEach(o => {
      const d = parseDate(o.time);
      if (!d) return;
      const k = fmtDateKey(d);
      if (!map[k]) map[k] = { key: k, orders: [] };
      map[k].orders.push(o);
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [monthOrders.length, activeMonth, year]);

  // Inventory snapshot per day (use items for stock data)
  const invByDay = React.useMemo(() => {
    // Use same dates as transaction history (days that have activity)
    return txByDay.map(g => {
      const totalStock = (items || []).reduce((s, i) => s + (i.stock || 0), 0);
      const totalValue = (items || []).reduce((s, i) => s + (i.price || 0) * (i.stock || 0), 0);
      return { key: g.key, totalStock, totalValue };
    });
  }, [txByDay, items]);

  // Print transaction history for a specific day
  const printTxDay = (dayGroup) => {
    if (typeof window === 'undefined') return;
    const total = dayGroup.orders.reduce((s, o) => s + Number(o.total), 0);
    const rows = dayGroup.orders.map((o, i) => {
      const items = (o.items || []).map(it => ((it.item&&it.item.name) || it.name || 'Item') + ' x' + it.qty).join(', ');
      return '<tr><td>' + (i+1) + '</td><td>#' + (o.orderNo||o.id) + '</td><td>' + (o.time||'') + '</td><td>' + items + '</td><td>&#8369;' + Number(o.total).toFixed(2) + '</td></tr>';
    }).join('');
    const html = '<html><head><title>Transaction Report ' + dayGroup.key + '</title>'
      + '<style>body{font-family:Arial,sans-serif;padding:24px}h2{color:#1a3a6b}table{width:100%;border-collapse:collapse}th{background:#1a3a6b;color:#fff;padding:8px;text-align:left;font-size:12px}td{padding:7px 8px;border-bottom:1px solid #e0e8f0;font-size:12px}tfoot td{font-weight:bold;background:#f0f5f9}</style>'
      + '</head><body><h2>Transaction History Report</h2><p><b>Date:</b> ' + dayGroup.key + ' &nbsp;|&nbsp; <b>Total Orders:</b> ' + dayGroup.orders.length + ' &nbsp;|&nbsp; <b>Total Earnings:</b> &#8369;' + total.toFixed(2) + '</p>'
      + '<table><thead><tr><th>#</th><th>Order No</th><th>Time</th><th>Items</th><th>Amount</th></tr></thead><tbody>' + rows + '</tbody>'
      + '<tfoot><tr><td colspan="4">TOTAL</td><td>&#8369;' + total.toFixed(2) + '</td></tr></tfoot></table></body></html>';
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  // Print inventory for a specific day
  const printInvDay = (invDay) => {
    if (typeof window === 'undefined') return;
    const rows = (items || []).map(it =>
      '<tr><td>' + (it.emoji||'') + ' ' + (it.name||'') + '</td><td>' + (it.cat||'') + '</td><td>' + (it.stock||0) + '</td><td>&#8369;' + (it.price||0).toLocaleString() + '</td><td>&#8369;' + ((it.price||0)*(it.stock||0)).toLocaleString() + '</td></tr>'
    ).join('');
    const totalStock = (items||[]).reduce((s,i)=>s+(i.stock||0),0);
    const totalValue = (items||[]).reduce((s,i)=>s+(i.price||0)*(i.stock||0),0);
    const html = '<html><head><title>Inventory Report ' + invDay.key + '</title>'
      + '<style>body{font-family:Arial,sans-serif;padding:24px}h2{color:#1a3a6b}table{width:100%;border-collapse:collapse}th{background:#1a3a6b;color:#fff;padding:8px;text-align:left;font-size:12px}td{padding:7px 8px;border-bottom:1px solid #e0e8f0;font-size:12px}tfoot td{font-weight:bold;background:#f0f5f9}</style>'
      + '</head><body><h2>Inventory Report</h2><p><b>Date:</b> ' + invDay.key + ' &nbsp;|&nbsp; <b>Total Stock:</b> ' + invDay.totalStock + ' &nbsp;|&nbsp; <b>Total Value:</b> &#8369;' + invDay.totalValue.toLocaleString() + '</p>'
      + '<table><thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Price</th><th>Value</th></tr></thead><tbody>' + rows + '</tbody>'
      + '<tfoot><tr><td colspan="2">TOTAL</td><td>' + totalStock + '</td><td></td><td>&#8369;' + totalValue.toLocaleString() + '</td></tr></tfoot></table></body></html>';
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <View style={sub.root}>
      <WebScrollView contentContainerStyle={{ gap:0, paddingBottom:20 }}>

        {/* ── Year selector ── */}
        <View style={{ alignItems:'center', marginBottom:14, position:'relative', zIndex:100 }}>
          <TouchableOpacity
            style={rpt.yearBtn}
            onPress={() => setYearDropdown(p => !p)}
            activeOpacity={0.80}
          >
            <Text style={rpt.yearTxt}>YEAR  {year}</Text>
            <Text style={rpt.yearCaret}>{yearDropdown ? '\u25b2' : '\u25bc'}</Text>
          </TouchableOpacity>
          {yearDropdown && (
            <ScrollView style={rpt.yearMenu} showsVerticalScrollIndicator={false}>
              {years.map(y => (
                <TouchableOpacity key={y} style={[rpt.yearOpt, y === year && rpt.yearOptActive]}
                  onPress={() => { setYear(y); setYearDropdown(false); }}>
                  <Text style={[rpt.yearOptTxt, y === year && rpt.yearOptTxtActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Month tabs ── */}
        <View style={{ flexDirection:'row', flexWrap:'wrap', justifyContent:'center', gap:6, marginBottom:16 }}>
          {MONTHS.map((m, i) => (
            <TouchableOpacity key={m}
              style={[rpt.monthBtn, activeMonth === i && rpt.monthBtnActive]}
              onPress={() => { setActiveMonth(i); setExpandedTxDate(null); setExpandedInvDate(null); }}>
              <Text style={[rpt.monthTxt, activeMonth === i && rpt.monthTxtActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Transaction History Report ── */}
        <View style={rpt.section}>
          <TouchableOpacity style={rpt.sectionTitleRow} onPress={() => setShowTx(p=>!p)} activeOpacity={0.80}>
            <Text style={rpt.sectionTitle}>Transaction History Reports</Text>
            <Text style={rpt.sectionToggle}>{showTx ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showTx && <View>
          {/* Table header */}
          <View style={rpt.thead}>
            <Text style={[rpt.th, { flex:1.0, textAlign:'left', paddingLeft:12 }]}>DATE</Text>
            <Text style={[rpt.th, { flex:1.1 }]}>TOTAL ORDERS</Text>
            <Text style={[rpt.th, { flex:1.3 }]}>TOTAL EARNINGS</Text>
            <Text style={[rpt.th, { width:80 }]}>PRINT</Text>
          </View>
          {txByDay.length === 0 ? (
            <View style={rpt.emptyRow}>
              <Text style={rpt.emptyTxt}>No transactions for {MONTHS[activeMonth]} {year}</Text>
            </View>
          ) : (
            txByDay.map((g, idx) => {
              const total = g.orders.reduce((s, o) => s + Number(o.total), 0);
              const isOpen = expandedTxDate === g.key;
              return (
                <View key={g.key}>
                  <TouchableOpacity
                    style={[rpt.trow, idx % 2 === 0 && rpt.trowAlt]}
                    onPress={() => setExpandedTxDate(isOpen ? null : g.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[rpt.td, { flex:1.0, fontFamily:'GoogleSans_700Bold', color:'#1a3a6b', textAlign:'left', paddingLeft:12 }]}>{g.key}</Text>
                    <Text style={[rpt.td, { flex:1.1 }]}>{g.orders.length}</Text>
                    <Text style={[rpt.td, { flex:1.3, fontFamily:'GoogleSans_700Bold', color:'#1a7a45' }]}>
                      {'\u20b1'}{total.toFixed(2)}
                    </Text>
                    <View style={{ width:80, alignItems:'center', justifyContent:'center', alignSelf:'stretch', borderRightWidth:1, borderColor:'rgba(26,58,107,0.08)' }}><TouchableOpacity style={rpt.printBtn} onPress={() => printTxDay(g)}>
                      <Text style={rpt.printBtnTxt}>Print</Text>
                    </TouchableOpacity></View>
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={rpt.expandPanel}>
                      <View style={rpt.expandHead}>
                        <Text style={[rpt.expandTh, { flex:0.4 }]}>#</Text>
                        <Text style={[rpt.expandTh, { flex:0.8 }]}>ORDER NO</Text>
                        <Text style={[rpt.expandTh, { flex:1.8 }]}>ITEMS</Text>
                        <Text style={[rpt.expandTh, { flex:0.8, textAlign:'right' }]}>AMOUNT</Text>
                      </View>
                      {g.orders.map((o, i) => {
                        const itms = (o.items||[]).map(it => ((it.item&&it.item.name)||it.name||'Item') + ' x' + it.qty).join(', ');
                        return (
                          <View key={o.id} style={[rpt.expandRow, i%2===0 && { backgroundColor:'rgba(255,255,255,0.30)' }]}>
                            <Text style={[rpt.expandTd, { flex:0.4 }]}>{i+1}</Text>
                            <Text style={[rpt.expandTd, { flex:0.8, fontFamily:'GoogleSans_700Bold' }]}>#{o.orderNo||o.id}</Text>
                            <Text style={[rpt.expandTd, { flex:1.8 }]} numberOfLines={2}>{itms}</Text>
                            <Text style={[rpt.expandTd, { flex:0.8, textAlign:'right', color:'#c9a84c', fontFamily:'GoogleSans_700Bold' }]}>
                              {'\u20b1'}{Number(o.total).toFixed(2)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
          </View>}
        </View>

        {/* ── Inventory Report ── */}
        <View style={[rpt.section, { marginTop:16 }]}>
          <TouchableOpacity style={rpt.sectionTitleRow} onPress={() => setShowInv(p=>!p)} activeOpacity={0.80}>
            <Text style={rpt.sectionTitle}>Inventory Reports</Text>
            <Text style={rpt.sectionToggle}>{showInv ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showInv && <View>
          <View style={rpt.thead}>
            <Text style={[rpt.th, { flex:1.0, textAlign:'left', paddingLeft:12 }]}>DATE</Text>
            <Text style={[rpt.th, { flex:1.1 }]}>TOTAL STOCK</Text>
            <Text style={[rpt.th, { flex:1.3 }]}>TOTAL VALUE</Text>
            <Text style={[rpt.th, { width:80 }]}>PRINT</Text>
          </View>
          {invByDay.length === 0 ? (
            <View style={rpt.emptyRow}>
              <Text style={rpt.emptyTxt}>No inventory data for {MONTHS[activeMonth]} {year}</Text>
            </View>
          ) : (
            invByDay.map((g, idx) => {
              const isOpen = expandedInvDate === g.key;
              return (
                <View key={g.key}>
                  <TouchableOpacity
                    style={[rpt.trow, idx % 2 === 0 && rpt.trowAlt]}
                    onPress={() => setExpandedInvDate(isOpen ? null : g.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[rpt.td, { flex:1.0, fontFamily:'GoogleSans_700Bold', color:'#1a3a6b', textAlign:'left', paddingLeft:12 }]}>{g.key}</Text>
                    <Text style={[rpt.td, { flex:1.1 }]}>{g.totalStock}</Text>
                    <Text style={[rpt.td, { flex:1.3, fontFamily:'GoogleSans_700Bold', color:'#1a7a45' }]}>
                      {'\u20b1'}{g.totalValue.toLocaleString()}
                    </Text>
                    <View style={{ width:80, alignItems:'center', justifyContent:'center', alignSelf:'stretch', borderRightWidth:1, borderColor:'rgba(26,58,107,0.08)' }}><TouchableOpacity style={rpt.printBtn} onPress={() => printInvDay(g)}>
                      <Text style={rpt.printBtnTxt}>Print</Text>
                    </TouchableOpacity></View>
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={rpt.expandPanel}>
                      <View style={rpt.expandHead}>
                        <Text style={[rpt.expandTh, { flex:2 }]}>ITEM</Text>
                        <Text style={[rpt.expandTh, { flex:1 }]}>CATEGORY</Text>
                        <Text style={[rpt.expandTh, { flex:0.6, textAlign:'center' }]}>STOCK</Text>
                        <Text style={[rpt.expandTh, { flex:0.8, textAlign:'right' }]}>VALUE</Text>
                      </View>
                      {(items||[]).map((it, i) => (
                        <View key={it.id} style={[rpt.expandRow, i%2===0 && { backgroundColor:'rgba(255,255,255,0.30)' }]}>
                          <Text style={[rpt.expandTd, { flex:2, fontFamily:'GoogleSans_700Bold' }]} numberOfLines={1}>{it.emoji} {it.name}</Text>
                          <Text style={[rpt.expandTd, { flex:1 }]} numberOfLines={1}>{it.cat}</Text>
                          <Text style={[rpt.expandTd, { flex:0.6, textAlign:'center' }]}>{it.stock}</Text>
                          <Text style={[rpt.expandTd, { flex:0.8, textAlign:'right', color:'#c9a84c', fontFamily:'GoogleSans_700Bold' }]}>
                            {'\u20b1'}{((it.price||0)*(it.stock||0)).toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
          </View>}
        </View>

        {/* ── Credits Report ── */}
        <View style={[rpt.section, { marginTop:16 }]}>
          <TouchableOpacity style={rpt.sectionTitleRow} onPress={() => setShowCredits(p=>!p)} activeOpacity={0.80}>
            <Text style={rpt.sectionTitle}>Credits Reports</Text>
            <Text style={rpt.sectionToggle}>{showCredits ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showCredits && <View style={rpt.comingSoon}>
            <Text style={rpt.comingSoonEmoji}>🚧</Text>
            <Text style={rpt.comingSoonTxt}>Coming Soon</Text>
            <Text style={rpt.comingSoonSub}>Credits reporting will be available in a future update.</Text>
          </View>}
        </View>

      </WebScrollView>
    </View>
  );
};

const rpt = StyleSheet.create({
  yearBtn: {
    flexDirection:'row', alignItems:'center', gap:10,
    paddingVertical:10, paddingHorizontal:28,
    backgroundColor:'rgba(26,58,107,0.12)', borderRadius:12,
    borderWidth:1.5, borderColor:'rgba(26,58,107,0.20)',
  },
  yearTxt:  { fontFamily:'GoogleSans_700Bold', fontSize:20, color:'#1a3a6b', letterSpacing:1 },
  yearCaret:{ fontSize:12, color:'rgba(26,58,107,0.50)' },
  yearMenu: {
    position:'absolute', top:48, zIndex:9999,
    backgroundColor:'rgba(255,255,255,0.99)',
    borderRadius:10, borderWidth:1, borderColor:'rgba(26,58,107,0.18)',
    shadowColor:'#000', shadowOpacity:0.18, shadowRadius:12, elevation:20,
    minWidth:140, maxHeight:200,
  },
  yearOpt:       { paddingVertical:10, paddingHorizontal:20, alignItems:'center' },
  yearOptActive: { backgroundColor:'rgba(26,58,107,0.08)' },
  yearOptTxt:    { fontFamily:'GoogleSans_400Regular', fontSize:14, color:'#1a3a6b' },
  yearOptTxtActive:{ fontFamily:'GoogleSans_700Bold', color:'#1a3a6b' },


  monthBtn:       { paddingHorizontal:14, paddingVertical:7, borderRadius:20, backgroundColor:'#1a3a6b', borderWidth:1, borderColor:'rgba(26,58,107,0.60)' },
  monthBtnActive: { backgroundColor:'rgba(198,220,240,0.90)', borderColor:'#304674', borderWidth:1.5 },
  monthTxt:       { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'rgba(255,255,255,0.90)' },
  monthTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#1a3a6b' },

  section: { backgroundColor:'rgba(255,255,255,0.22)', borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.45)', overflow:'hidden' },
  sectionTitleRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:10, paddingHorizontal:12 },
  sectionToggle:   { fontSize:13, color:'rgba(26,58,107,0.45)', paddingLeft:8 },
  sectionTitle: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#1a3a6b', letterSpacing:0.5 },

  thead:   { flexDirection:'row', alignItems:'center', paddingVertical:8, paddingHorizontal:0, backgroundColor:'rgba(26,58,107,0.12)' },
  th:      { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'rgba(26,58,107,0.60)', letterSpacing:0.8, textTransform:'uppercase',
             textAlign:'center', paddingVertical:8, paddingHorizontal:6,
             borderRightWidth:1, borderColor:'rgba(26,58,107,0.10)' },

  trow:    { flexDirection:'row', alignItems:'center', paddingVertical:0, paddingHorizontal:0, borderBottomWidth:1, borderColor:'rgba(26,58,107,0.07)', minHeight:42 },
  trowAlt: { backgroundColor:'rgba(255,255,255,0.35)' },
  td:      { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#1a2d4e',
             textAlign:'center', paddingVertical:10, paddingHorizontal:6,
             borderRightWidth:1, borderColor:'rgba(26,58,107,0.08)',
             alignSelf:'stretch', justifyContent:'center' },

  printBtn:    { alignItems:'center', backgroundColor:'#1a3a6b', borderRadius:6, paddingVertical:5, paddingHorizontal:10 },
  printBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'#fff', letterSpacing:0.3 },

  expandPanel: { backgroundColor:'rgba(26,58,107,0.04)', borderBottomWidth:1, borderColor:'rgba(26,58,107,0.10)' },
  expandHead:  { flexDirection:'row', paddingVertical:6, paddingHorizontal:20, backgroundColor:'rgba(26,58,107,0.08)' },
  expandTh:    { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'rgba(26,58,107,0.50)', letterSpacing:0.5, textTransform:'uppercase', flex:1 },
  expandRow:   { flexDirection:'row', paddingVertical:7, paddingHorizontal:20, borderBottomWidth:1, borderColor:'rgba(26,58,107,0.04)' },
  expandTd:    { fontFamily:'GoogleSans_400Regular', fontSize:10, color:'#1a2d4e', flex:1 },

  emptyRow: { paddingVertical:20, alignItems:'center' },
  emptyTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.40)' },

  comingSoon:    { alignItems:'center', paddingVertical:32, gap:8 },
  comingSoonEmoji:{ fontSize:32 },
  comingSoonTxt: { fontFamily:'GoogleSans_700Bold', fontSize:16, color:'rgba(1,31,75,0.40)' },
  comingSoonSub: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.35)', textAlign:'center', paddingHorizontal:20 },
});


const sub = StyleSheet.create({
  root: { flex:1, padding:14, overflow:'hidden', minHeight:0 },
  emptyBox: { flex:1, alignItems:'center', justifyContent:'center', gap:10, paddingTop:60 },
  emptyTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.35)', textAlign:'center', lineHeight:18 },
  filterBtn: { paddingHorizontal:14, paddingVertical:7, borderRadius:20, backgroundColor:'rgba(255,255,255,0.40)', borderWidth:1, borderColor:'rgba(255,255,255,0.60)' },
  filterBtnActive: { backgroundColor:'#1a3a6b', borderColor:'#c9a84c' },
  filterTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.60)' },
  filterTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  statRow: { flexDirection:'row', gap:8 },
  statCard: { minWidth:80, backgroundColor:'rgba(255,255,255,0.60)', borderRadius:12, padding:10, alignItems:'center', gap:3 },
  statVal:  { fontFamily:'GoogleSans_700Bold', fontSize:16, color:'#1a3a6b' },
  statLbl:  { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.45)', textAlign:'center' },
  sectionTitle2:{ fontFamily:'GoogleSans_700Bold', fontSize:12, color:'rgba(1,31,75,0.55)', letterSpacing:1, textTransform:'uppercase', marginBottom:8, marginTop:4 },
  sortChip: { paddingHorizontal:12, paddingVertical:6, borderRadius:14, backgroundColor:'rgba(255,255,255,0.40)', borderWidth:1, borderColor:'rgba(255,255,255,0.60)' },
  sortChipActive: { backgroundColor:'#1a3a6b' },
  sortTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)' },
  sortTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  tableHead: { flexDirection:'row', paddingVertical:8, paddingHorizontal:10, backgroundColor:'rgba(26,58,107,0.12)', borderRadius:8, marginBottom:4 },
  thCell: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.55)', flex:1, letterSpacing:0.5 },
  tableRow:{ flexDirection:'row', paddingVertical:9, paddingHorizontal:10, borderRadius:6, marginBottom:2 },
  tdCell:  { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#1a2d4e', flex:1 },
  topItemRow: { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:7, borderBottomWidth:1, borderColor:'rgba(1,31,75,0.06)' },
  topItemRank:{ fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#c9a84c', width:24, flexShrink:0 },
  topItemName:{ fontFamily:'GoogleSans_400Regular', fontSize:12, color:'#1a2d4e' },
  topItemBar: { height:6, backgroundColor:'rgba(26,58,107,0.20)', borderRadius:3, maxWidth:80 },
  topItemQty: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#1a3a6b', width:55, textAlign:'right', flexShrink:0 },
  sectionHead: { borderLeftWidth:3, paddingLeft:10, marginBottom:8 },
  sectionTitle: { fontFamily:'GoogleSans_700Bold', fontSize:12, letterSpacing:0.5 },
  orderCard: { backgroundColor:'rgba(255,255,255,0.65)', borderRadius:12, padding:12, marginBottom:8, borderWidth:1, borderColor:'rgba(255,255,255,0.80)', gap:6 },
  orderHead: { flexDirection:'row', alignItems:'center', gap:8, overflow:'hidden' },
  orderId:   { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#1a3a6b', flexShrink:1 },
  orderTime: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.45)', flex:1 },
  badge:     { borderRadius:6, paddingHorizontal:7, paddingVertical:2, flexShrink:0 },
  badgeTxt:  { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#1a2d4e' },
  orderItems:{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)', lineHeight:16 },
  orderFoot: { flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' },
  orderTotal:{ fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#c9a84c', flexShrink:0 },
  orderPay:  { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.50)', flex:1 },
});

// ─── HISTORY STYLES ───────────────────────────────────────────────────────────
const hst = StyleSheet.create({
  calTrigger: { flexDirection:'row', alignItems:'center', gap:6, paddingVertical:6, paddingHorizontal:12, backgroundColor:'rgba(26,58,107,0.10)', borderRadius:8, borderWidth:1, borderColor:'rgba(26,58,107,0.15)', alignSelf:'flex-start' },
  calTriggerTxt: { fontFamily:'NotoSerif_700Bold', fontSize:12, color:'#1a3a6b' },
  calTriggerCaret: { fontSize:10, color:'rgba(26,58,107,0.50)' },
  calCard: { position:'absolute', top:38, left:0, zIndex:999, backgroundColor:'rgba(255,255,255,0.98)', borderRadius:10, borderWidth:1, borderColor:'rgba(26,58,107,0.18)', padding:8, shadowColor:'#000', shadowOpacity:0.18, shadowRadius:12, elevation:20, minWidth:220, maxWidth:260 },
  calDot: { width:4, height:4, borderRadius:2, backgroundColor:'#1a3a6b', position:'absolute', bottom:2, alignSelf:'center' },
  topBar: { flexDirection:'row', alignItems:'flex-start', gap:10, marginBottom:4 },
  txHeaderDate: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#1a3a6b' },
  txHeaderSub: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.50)', marginTop:2 },

  dropBtn: { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(255,255,255,0.70)', borderRadius:10, paddingVertical:7, paddingHorizontal:10, borderWidth:1, borderColor:'rgba(1,31,75,0.15)', flexShrink:0 },
  dropBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#1a3a6b' },

  dropdown: { backgroundColor:'rgba(255,255,255,0.95)', borderRadius:12, borderWidth:1, borderColor:'rgba(1,31,75,0.15)', marginBottom:4, overflow:'hidden', shadowColor:'#000', shadowOpacity:0.10, shadowRadius:8, elevation:6 },
  dropItem: { flexDirection:'row', alignItems:'center', paddingVertical:10, paddingHorizontal:14, borderBottomWidth:1, borderColor:'rgba(1,31,75,0.06)', gap:8 },
  dropItemLabel: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#1a3a6b' },
  dropItemSub: { fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(1,31,75,0.45)', marginTop:1 },
  dropItemTotal: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#c9a84c', flexShrink:0 },

  txRow: { flexDirection:'row', gap:0, minHeight:56 },
  txTimeCol: { width:52, flexShrink:0, alignItems:'flex-end', paddingRight:8, paddingTop:3, gap:4 },
  txTime: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.55)', textAlign:'right' },
  livePip: { width:6, height:6, borderRadius:3, backgroundColor:'#e74c3c' },
  txLine: { width:16, flexShrink:0, alignItems:'center' },
  txDot: { width:10, height:10, borderRadius:5, backgroundColor:'#1a3a6b', marginTop:4, flexShrink:0, zIndex:1 },
  txVLine: { flex:1, width:2, backgroundColor:'rgba(1,31,75,0.12)', marginTop:2 },
  txContent: { flex:1, backgroundColor:'rgba(255,255,255,0.65)', borderRadius:10, padding:10, marginLeft:8, marginBottom:4, borderWidth:1, borderColor:'rgba(255,255,255,0.85)', gap:4 },
  txOrderId: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#1a3a6b' },
  txStatusBadge: { borderRadius:5, paddingHorizontal:6, paddingVertical:2 },
  txStatusTxt: { fontFamily:'GoogleSans_700Bold', fontSize:9 },
  txItems: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)', lineHeight:15 },
  txAmount: { fontFamily:'NotoSerif_700Bold', fontSize:13, color:'#c9a84c' },
  txPay: { fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(1,31,75,0.45)' },
});

// ─── LEFT PANEL: ORDERING MONITORING ─────────────────────────────────────────
// ─── STATUS CONFIG for order cards ───────────────────────────────────────────
// ─── EMPLOYEE CREDITS ─────────────────────────────────────────────────────────


// ─── SALES REPORT ───────────────────────────────

const STATUS_CFG = {
  pending:   { label:'PENDING',   color:'#c0392b', btnLabel:'Start Preparing', btnColor:'#e67e22', next:'preparing' },
  preparing: { label:'PREPARING', color:'#b9660a', btnLabel:'Mark as Ready',   btnColor:'#2980b9', next:'ready'     },
  ready:     { label:'READY',     color:'#1a6b2a', btnLabel:'Mark as Done',    btnColor:'#27ae60', next:'done'      },
  done:      { label:'DONE',      color:'#1a3a6b', btnLabel:null,              btnColor:null,      next:null        },
};

// ─── ORDER MONITORING PANEL ──────────────────────
// ─── MERCHANDISE SALES PANEL ─────────────────────────────────────────────────
const MerchandiseSalesPanel = ({ orders, items }) => {
  const [activeFilter, setActiveFilter] = useState('today');

  // ── Stats ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const todayKey = now.toDateString();

  const todayOrders = orders.filter(o => {
    try { return new Date(o.time || o.createdAt).toDateString() === todayKey; }
    catch { return false; }
  });

  const totalRevenue  = todayOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const totalItems    = todayOrders.reduce((s, o) =>
    s + (o.items || []).reduce((ss, i) => ss + (i.qty || 0), 0), 0);
  const lowStock      = items.filter(i => i.stock <= 5 && i.stock > 0).length;
  const outOfStock    = items.filter(i => i.stock === 0).length;

  // ── Recent orders (last 8) ────────────────────────────────────────────────
  const recentOrders = [...orders]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 8);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue:0.3, duration:900, useNativeDriver:true }),
      Animated.timing(pulseAnim, { toValue:1,   duration:900, useNativeDriver:true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const STAT_CARDS = [
    { label:"Today's Sales", value:'₱' + totalRevenue.toLocaleString(), color:'#1a6b45', bg:'#27ae60' },
    { label:'Items Sold',    value:String(totalItems),                  color:'#1a3a6b', bg:'#2e5fa3' },
    { label:'Low Stock',     value:String(lowStock),                    color:'#7a4400', bg:'#e67e22' },
    { label:'Out of Stock',  value:String(outOfStock),                  color:'#7a0000', bg:'#e74c3c' },
  ];

  return (
    <View style={sp.root}>
      {/* Title */}
      <View style={sp.titleRow}>
        <Animated.View style={[sp.liveDot, { opacity: pulseAnim }]} />
        <Text style={sp.title}>SALES OVERVIEW</Text>
      </View>

      {/* 4 stat cards */}
      <View style={sp.statGrid}>
        {STAT_CARDS.map(c => (
          <View key={c.label} style={[sp.statCard, { backgroundColor: c.bg }]}>
            <Text style={sp.statVal}>{c.value}</Text>
            <Text style={sp.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Recent orders */}
      <Text style={sp.sectionLabel}>RECENT ORDERS</Text>
      <WebScrollView style={{ flex:1, minHeight:0 }} contentContainerStyle={{ gap:5, paddingBottom:12 }}>
        {recentOrders.length === 0
          ? <View style={sp.emptyBox}>
              <Text style={sp.emptyIco}>🛍️</Text>
              <Text style={sp.emptyTxt}>No orders yet today</Text>
            </View>
          : recentOrders.map(order => {
              const timeStr = (() => {
                try {
                  const d = new Date(order.time || order.createdAt);
                  return isNaN(d) ? '' : d.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
                } catch { return ''; }
              })();
              const itemsSummary = (order.items || [])
                .map(i => (i.item?.name || i.name || 'Item') + ' ×' + i.qty)
                .join(', ');
              const src = order.source === 'visitor' ? '🌐' : '🖥️';
              return (
                <View key={order.id} style={sp.orderCard}>
                  <View style={sp.orderTop}>
                    <Text style={sp.orderNo}>{src} #{order.orderNo || order.id?.slice(-4) || '--'}</Text>
                    <Text style={sp.orderTime}>{timeStr}</Text>
                    <Text style={sp.orderAmt}>₱{Number(order.total).toFixed(0)}</Text>
                  </View>
                  <Text style={sp.orderItems} numberOfLines={2}>{itemsSummary}</Text>
                  <View style={[sp.payBadge, order.payment === 'gcash' && { backgroundColor:'rgba(52,152,219,0.15)' }]}>
                    <Text style={sp.payBadgeTxt}>{order.payment === 'gcash' ? '📱 GCash' : order.payment === 'credit' ? '💳 Credit' : '💵 Cash'}</Text>
                  </View>
                </View>
              );
            })
        }
      </WebScrollView>
    </View>
  );
};

const sp = StyleSheet.create({
  root: { flex:1, padding:10, minHeight:0, overflow:'hidden' },
  titleRow: { flexDirection:'row', alignItems:'center', gap:5, marginBottom:8, justifyContent:'center' },
  liveDot: { width:8, height:8, borderRadius:4, backgroundColor:'#27ae60' },
  title: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#1a2d4e', letterSpacing:1.5, textDecorationLine:'underline', textAlign:'center' },

  statGrid: { flexDirection:'row', flexWrap:'wrap', gap:4, marginBottom:10 },
  statCard: { flex:1, minWidth:'45%', borderRadius:10, paddingVertical:8, paddingHorizontal:6, alignItems:'center', gap:1 },
  statVal: { fontFamily:'GoogleSans_700Bold', fontSize:16, color:'#fff', lineHeight:20 },
  statLbl: { fontFamily:'GoogleSans_700Bold', fontSize:6, color:'rgba(255,255,255,0.85)', letterSpacing:0.6, textAlign:'center' },

  sectionLabel: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'rgba(1,31,75,0.45)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:5 },

  emptyBox: { padding:20, alignItems:'center', gap:6 },
  emptyIco: { fontSize:28 },
  emptyTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.35)', textAlign:'center' },

  orderCard: {
    backgroundColor:'rgba(255,255,255,0.88)',
    borderRadius:10, padding:8, gap:4,
    borderWidth:1, borderColor:'rgba(255,255,255,0.95)',
    shadowColor:'#000', shadowOpacity:0.06, shadowRadius:3, elevation:1,
  },
  orderTop: { flexDirection:'row', alignItems:'center', gap:4 },
  orderNo:  { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#1a3a6b', flex:1 },
  orderTime:{ fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.40)' },
  orderAmt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#c9a84c' },
  orderItems:{ fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.60)', lineHeight:13 },
  payBadge: { alignSelf:'flex-start', backgroundColor:'rgba(1,31,75,0.07)', borderRadius:5, paddingHorizontal:6, paddingVertical:2 },
  payBadgeTxt:{ fontFamily:'GoogleSans_700Bold', fontSize:8, color:'rgba(1,31,75,0.55)' },
});


// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function ManageMerchandiseScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const isSmall = width < 400;
  const isWide  = width >= 768;

  // ── Use shared MerchandiseContext (same data as MerchandiseScreen visitor) ──
  const {
    items, ads, categories, orders,
    saveItem, deleteItem, saveAd, setAds,
    addOrder, updateOrderStatus, deductStock,
    reloadFromStorage,
  } = useMerchandise();

  // Firestore onSnapshot handles real-time sync — no polling needed
  useFocusEffect(useCallback(() => {
    reloadFromStorage();
  }, [reloadFromStorage]));

  // ── Fonts ─────────────────────────────────────────────────────────────────
  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState('cashier');
  const [activeCategory, setActiveCategory] = useState('All');
  const [search,         setSearch]         = useState('');
  const [editItem,       setEditItem]       = useState(null);
  const [editItemModal,  setEditItemModal]  = useState(false);
  const [editAd,         setEditAd]         = useState(null);
  const [editAdModal,    setEditAdModal]    = useState(false);
  const [adCurrent,      setAdCurrent]      = useState(0);
  const [invMaxQty,      setInvMaxQty]      = useState({});

  const hdrFade    = useRef(new Animated.Value(0)).current;
  const hdrTrans   = useRef(new Animated.Value(-16)).current;
  const bodyFade   = useRef(new Animated.Value(0)).current;
  const adScrollRef = useRef(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(hdrTrans, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    Animated.timing(bodyFade, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }).start();
  }, []);

  const bannerW = Math.min(width * 0.60, 700);

  useEffect(() => {
    if (!ads.length) return;
    const t = setInterval(() => {
      setAdCurrent(prev => {
        const next = (prev + 1) % ads.length;
        adScrollRef.current&&adScrollRef.current.scrollTo({ x: next * bannerW, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [ads.length, bannerW]);

  const handleSearch = (text) => {
    setSearch(text);
    if (!text.trim()) return;
    const cats = [...new Set(items.filter(i => i.name.toLowerCase().includes(text.toLowerCase())).map(i => i.cat))];
    setActiveCategory(cats.length === 1 ? cats[0] : 'All');
  };

  const filtered = items.filter(i => {
    if (search.trim()) return i.name.toLowerCase().includes(search.toLowerCase());
    return activeCategory === 'All' || i.cat === activeCategory;
  });

  const openAddItem   = () => { setEditItem(emptyItem()); setEditItemModal(true); };
  const openEditItem  = (item) => { setEditItem({ ...item, price: String(item.price), stock: String(item.stock) }); setEditItemModal(true); };
  const handleSaveItem = (updated) => {
    saveItem(updated);
    if (updated.maxQty !== undefined) setInvMaxQty(p => ({ ...p, [updated.id]: updated.maxQty }));
    setEditItemModal(false);
  };
  const handleDeleteItem = (id) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this item? This cannot be undone.')) deleteItem(id);
    } else {
      Alert.alert('Delete Item', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteItem(id) },
      ]);
    }
  };

  const handleSaveAd = (updated) => {
    if (updated.isNew) {
      const newAd = { ...updated, id: Date.now().toString(), isNew: undefined, bg: ['#1a3a6b', '#2e5fa3'], emoji: updated.emoji || '📢' };
      setAds(prev => [...prev, newAd]);
    } else {
      saveAd(updated);
    }
    setEditAdModal(false);
  };
  const handleDeleteAd = (id) => { setAds(prev => prev.filter(a => a.id !== id)); };

  const pendingCount = items.filter(i => i.stock <= 5).length; // low stock alert

  if (!fontsLoaded) return null;

  const renderContent = () => {
    if (activeTab === 'cashier')   return <CashierScreen items={items} categories={categories} addOrder={addOrder} deductStock={deductStock} />;
    if (activeTab === 'menu')      return <ManageItemsScreen items={items} categories={categories} filtered={filtered} search={search} activeCategory={activeCategory} onSearch={handleSearch} onCategoryChange={setActiveCategory} onAddItem={openAddItem} onEditItem={openEditItem} onDeleteItem={handleDeleteItem} />;
    if (activeTab === 'inventory') return <InventoryScreen items={items} maxQtyMap={invMaxQty} onAddItem={openAddItem} onEditItem={openEditItem}/>;
    if (activeTab === 'history')   return <OrderHistoryScreen orders={orders} />;
    if (activeTab === 'credits')   return <EmployeeCreditsScreen />;
    if (activeTab === 'report')    return <SalesReportScreen orders={orders} items={items}/>;
    return null;
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
      <LinearGradient colors={['rgba(198,220,235,0.85)', 'rgba(152,186,213,0.40)', 'rgba(80,110,150,0.0)']} locations={[0, 0.45, 1]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(50,80,120,0.45)', 'rgba(50,80,120,0.0)', 'rgba(50,80,120,0.45)']} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(50,80,120,0.0)', 'rgba(60,90,130,0.35)']} locations={[0.4, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />

      {/* HEADER */}
      <Animated.View style={{ opacity: hdrFade, transform: [{ translateY: hdrTrans }], marginTop: Platform.OS === 'web' ? 16 : 36, marginHorizontal: isSmall ? 8 : 10, zIndex: 30, flexShrink: 0 }}>
        <View style={[styles.header, { paddingHorizontal: 20, paddingVertical: 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation && navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1, { fontSize: isSmall ? 13 : 18 }]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>CESLA </Text>Merchandise Management
            </Text>
            <View style={styles.visitorTag}>
              <Text style={styles.visitorTagText}>📦  ADMIN PANEL</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.iconBtn, { position: 'relative' }]}>
            <MaterialIcons name="notifications" size={19} color="#fff" />
            {pendingCount > 0 && <View style={[styles.notifBadge, {backgroundColor:'#e67e22'}]}><Text style={styles.notifBadgeTxt}>{pendingCount}</Text></View>}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* BODY */}
      <Animated.View style={[styles.body, { opacity: bodyFade, flex:1 }]}>
        <View style={{ flex:1, flexDirection: isWide ? 'row' : 'column', minHeight:0, overflow:'hidden' }}>

        {/* LEFT PANEL — Order Monitoring */}
        <View style={isWide ? styles.leftPanel : styles.leftPanelMobile}>
          <MerchandiseSalesPanel orders={orders} items={items} />
        </View>

        {/* RIGHT PANEL */}
        <View style={isWide ? styles.rightPanel : styles.rightPanelMobile}>

          {/* Ad Banner */}
          <View style={styles.adWrapper}>
            <ScrollView ref={adScrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => setAdCurrent(Math.round(e.nativeEvent.contentOffset.x / bannerW))}
              style={{ width: '100%' }} contentContainerStyle={{ width: bannerW * (ads.length + 1) }}>
              {ads.map(ad => {
                const imgSrc = ad.image ? { uri: ad.image } : (ad.imageUrl ? { uri: ad.imageUrl } : null);
                return (
                  <LinearGradient key={ad.id} colors={ad.bg || ['#1a3a6b', '#2e5fa3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.adSlide, { width: bannerW }]}>
                    {imgSrc ? <Image source={imgSrc} style={styles.adBgImg} resizeMode="cover" /> : <Text style={styles.adEmoji}>{ad.emoji}</Text>}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.adTitle} numberOfLines={1}>{ad.title}</Text>
                      <Text style={styles.adSub} numberOfLines={1}>{ad.sub}</Text>
                    </View>
                    <View style={styles.adBadge}><Text style={styles.adBadgeTxt}>AD</Text></View>
                    <TouchableOpacity style={styles.adEditBtn} onPress={() => { setEditAd({ ...ad }); setEditAdModal(true); }}>
                      <MaterialIcons name="edit" size={12} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.adDotsInner}>
                      {ads.map((_, i) => (
                        <TouchableOpacity key={i} onPress={() => { adScrollRef.current&&adScrollRef.current.scrollTo({ x: i * bannerW, animated: true }); setAdCurrent(i); }}>
                          <View style={[styles.adDot, adCurrent === i && styles.adDotActive]} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </LinearGradient>
                );
              })}
              {/* Add new ad slide */}
              <TouchableOpacity
                style={[styles.adSlide, { width: bannerW, backgroundColor: 'rgba(26,58,107,0.18)', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.40)', borderStyle: 'dashed' }]}
                onPress={() => { setEditAd({ isNew: true, id: Date.now().toString(), title: '', sub: '', image: null, imageUrl: '', emoji: '📢', bg: ['#1a3a6b', '#2e5fa3'] }); setEditAdModal(true); }}>
                <MaterialIcons name="add-circle-outline" size={28} color="rgba(26,58,107,0.55)" />
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: 'rgba(26,58,107,0.55)' }}>Add New Ad</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 2 }} style={{ flexGrow: 0 }}>
              {TABS.map(tab => (
                <TouchableOpacity key={tab.key}
                  style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab.key)} activeOpacity={0.80}>
                  <MaterialIcons name={tab.icon} size={13} color={activeTab === tab.key ? '#1a3a6b' : 'rgba(255,255,255,0.80)'} />
                  <Text style={[styles.tabBtnTxt, activeTab === tab.key && styles.tabBtnTxtActive]}>{tab.label}</Text>
                  
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Content area */}
          <View style={styles.contentArea}>
            {renderContent()}
          </View>
        </View>
        </View>
      </Animated.View>

      <ItemEditModal visible={editItemModal} item={editItem} categories={categories} onSave={handleSaveItem} onClose={() => setEditItemModal(false)} />
      <AdEditModal visible={editAdModal} ad={editAd} onSave={handleSaveAd} onClose={() => setEditAdModal(false)} onDelete={handleDeleteAd} />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'column' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(26,58,107,0.92)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#011f4b', shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  backIcon: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8, minWidth: 0 },
  headerH1: { fontFamily: 'NotoSerif_700Bold', color: '#fff', textAlign: 'center' },
  headerGold: { color: '#c9a84c' },
  visitorTag: { marginTop: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)', alignSelf: 'center' },
  visitorTagText: { fontFamily: 'GoogleSans_700Bold', fontSize: 8, color: '#fff', letterSpacing: 1.2, textTransform: 'uppercase', lineHeight: 13 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#e74c3c', borderRadius: 6, minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  notifBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 8, color: '#fff' },
  body: {
    flex: 1,
    marginTop: Platform.OS === 'web' ? 10 : 6,
    marginBottom: 0, minHeight: 0, overflow: 'hidden',
  },
  leftPanelMobile: {
    height: 220, flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12, margin: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)',
    overflow: 'hidden',
  },
  rightPanelMobile: {
    flex: 1, minWidth: 0, minHeight: 0,
    marginHorizontal: 8, marginBottom: 8, flexDirection: 'column', overflow: 'hidden',
  },
  leftPanel: {
    flex: 1.4, flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 16, marginLeft: 10, marginRight: 0,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)',
    overflow: 'hidden', minHeight: 0,
  },
  rightPanel: {
    flex: 3, minWidth: 0, minHeight: 0,
    marginHorizontal: 10, flexDirection: 'column', overflow: 'hidden',
  },
  adWrapper: { height: 100, flexShrink: 0, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(26,58,107,0.15)' },
  adSlide: { height: 100, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 12, overflow: 'hidden' },
  adBgImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 },
  adEmoji: { fontSize: 40, flexShrink: 0 },
  adTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: '#fff' },
  adSub:   { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  adBadge: { position: 'absolute', top: 8, right: 38, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  adBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#fff', letterSpacing: 1 },
  adEditBtn: { position: 'absolute', top: 6, right: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 7, padding: 5 },
  adDotsInner: { position: 'absolute', bottom: 5, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  adDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.40)' },
  adDotActive: { backgroundColor: '#fff', width: 16 },
  tabBar: {
    flexShrink: 0, backgroundColor: 'rgba(26,58,107,0.50)',
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    paddingTop: 5, paddingHorizontal: 4, marginTop: 8, flexDirection: 'row',
  },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 13, borderTopLeftRadius: 10, borderTopRightRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.10)', marginHorizontal: 2 },
  tabBtnActive: { backgroundColor: '#eef2f8' },
  tabBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.80)' },
  tabBtnTxtActive: { color: '#1a3a6b' },
  tabBadge: { backgroundColor: '#e74c3c', borderRadius: 7, minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  tabBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 8, color: '#fff' },
  contentArea: {
    flex: 1, minHeight: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    borderTopRightRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.40)', overflow: 'hidden',
  },
});