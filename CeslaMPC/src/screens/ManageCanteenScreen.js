// src/screens/ManageCanteenScreen.js
// CESLA MPC — Manage Canteen (Admin)
// Firebase Firestore connected — real-time sync

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
import { useCanteen } from '../context/CanteenContext';
import { useFocusEffect } from '@react-navigation/native';
import {
  collection, query, where, onSnapshot, orderBy,
  updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── ORDER NOTIFICATION SOUND ─────────────────────────────────────────────────
// Restaurant-style loud ding-dong chime via AudioContext (no extra package needed).
const playOrderSound = async () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.AudioContext) {
    try {
      const ctx = new window.AudioContext();
      const playTone = (freq, start, duration, gain = 0.8, type = 'sine') => {
        const osc  = ctx.createOscillator();
        const g    = ctx.createGain();
        // Add slight distortion for a richer bell tone
        const wave = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          curve[i] = (Math.PI + 300) * x / (Math.PI + 300 * Math.abs(x));
        }
        wave.curve = curve;
        osc.connect(wave); wave.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = type;
        g.gain.setValueAtTime(0, ctx.currentTime + start);
        g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration + 0.05);
      };
      // Restaurant DING-DONG: two loud bell strikes
      // First DING — high bell
      playTone(1046, 0.00, 1.2, 0.9); // C6
      playTone(1318, 0.00, 1.0, 0.5); // E6 harmonic
      // Second DONG — lower bell
      playTone(784,  0.45, 1.4, 0.9); // G5
      playTone(988,  0.45, 1.2, 0.5); // B5 harmonic
      // Repeat once more for extra attention
      playTone(1046, 1.10, 1.2, 0.7);
      playTone(784,  1.55, 1.4, 0.7);
    } catch (e) { /* silent fail */ }
  } else {
    try {
      const { Audio } = require('expo-av');
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
        { shouldPlay: true, volume: 1.0 }
      );
      sound.setOnPlaybackStatusUpdate(s => { if (s.didJustFinish) sound.unloadAsync(); });
    } catch (e) { /* silent fail */ }
  }
};

// ─── WEB SCROLL VIEW ──────────────────────────────────────────────────────────
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = `.cesla-sub-scroll::-webkit-scrollbar{width:7px;display:block!important}.cesla-sub-scroll::-webkit-scrollbar-thumb{background:rgba(1,31,75,0.40);border-radius:4px}.cesla-sub-scroll::-webkit-scrollbar-thumb:hover{background:rgba(1,31,75,0.65)}.cesla-sub-scroll::-webkit-scrollbar-track{background:rgba(255,255,255,0.20);border-radius:4px}.cesla-sub-scroll{scrollbar-width:thin;scrollbar-color:rgba(1,31,75,0.40) rgba(255,255,255,0.20)}`;
  document.head.appendChild(styleEl);
}
const WebScrollView = ({ children, style, contentContainerStyle, ...rest }) => {
  if (Platform.OS !== 'web') {
    return <ScrollView style={style} contentContainerStyle={contentContainerStyle} showsVerticalScrollIndicator {...rest}>{children}</ScrollView>;
  }
  const flat = StyleSheet.flatten(contentContainerStyle) || {};
  const pH = flat.paddingHorizontal !== undefined ? flat.paddingHorizontal : (flat.padding !== undefined ? flat.padding : undefined);
  return (
    <View style={[{ flex:1, minHeight:0, position:'relative', overflow:'hidden' }, style]}>
      <div className="cesla-sub-scroll" style={{
        position:'absolute', top:0, left:0, right:0, bottom:0,
        overflowY:'auto', overflowX:'hidden', display:'flex', flexDirection:'column',
      }}>
        <div style={{
          display:'flex', flexDirection:'column', flexShrink:0,
          width:'100%', boxSizing:'border-box',
          paddingTop:    flat.paddingTop    !== undefined ? `${flat.paddingTop}px`    : (flat.padding !== undefined ? `${flat.padding}px` : undefined),
          paddingBottom: flat.paddingBottom !== undefined ? `${flat.paddingBottom}px` : (flat.padding !== undefined ? `${flat.padding}px` : '12px'),
          paddingLeft:   pH !== undefined ? `${pH}px` : undefined,
          paddingRight:  pH !== undefined ? `${pH}px` : undefined,
          gap:           flat.gap !== undefined ? `${flat.gap}px` : undefined,
        }}>
          {children}
        </div>
      </div>
    </View>
  );
};

// ─── IMAGE RESIZE HELPER ──────────────────────────────────────────────────────
// Resizes any image to max 300×300 and compresses to JPEG 0.5 using canvas.
// Output is a base64 data-URL small enough to fit in a Firestore document (<50KB).
// Works on both web and React Native Web (Expo web build).
const resizeImageToBase64 = (uri) =>
  new Promise((resolve, reject) => {
    const MAX = 300;
    if (Platform.OS === 'web') {
      // Web / Expo Web: use HTML canvas
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.onerror = reject;
      img.src = uri;
    } else {
      // Native: expo-image-picker already returned a local file uri.
      // We can't use canvas here, so we read the file and let the
      // quality:0.2 setting in launchImageLibraryAsync keep the size small.
      resolve(uri); // will be stored as uri (not base64) on native
    }
  });

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const emptyItem = () => ({
  id: Date.now().toString(), name:'', cat:'Meals',
  price:'', stock:'', emoji:'🍽️', image:null,
});

const autoEmoji = (name) => {
  const n = name.toLowerCase();
  if (/rice|kanin|sinangag/.test(n))                return '🍚';
  if (/soup|sinigang|tinola|nilaga|broth/.test(n))  return '🍲';
  if (/chicken|manok|inasal/.test(n))               return '🍗';
  if (/pork|lechon|liempo|adobo|sisig/.test(n))     return '🥩';
  if (/fish|isda|bangus|tilapia|tuna/.test(n))      return '🐟';
  if (/egg|itlog/.test(n))                          return '🥚';
  if (/noodle|mami|pancit|pasta|spaghetti/.test(n)) return '🍜';
  if (/bread|pan|sandwich|burger/.test(n))          return '🍞';
  if (/cake|cupcake|pastry|donut/.test(n))          return '🎂';
  if (/cookie|biscuit|cracker/.test(n))             return '🍪';
  if (/candy|chocolate|choco|sweet/.test(n))        return '🍫';
  if (/chips|fries|nacho/.test(n))                  return '🍟';
  if (/juice|calamansi|lemon/.test(n))              return '🧃';
  if (/coffee|kape|latte|cappuccino/.test(n))       return '☕';
  if (/milk|gatas/.test(n))                         return '🥛';
  if (/tea|tsaa/.test(n))                           return '🍵';
  if (/water|tubig/.test(n))                        return '💧';
  if (/soda|softdrink|cola|sprite/.test(n))         return '🥤';
  if (/salad|vegetables|gulay/.test(n))             return '🥗';
  if (/fruit|prutas|banana|apple|mango/.test(n))    return '🍎';
  if (/snack|merienda/.test(n))                     return '🍿';
  if (/pizza/.test(n))                              return '🍕';
  if (/hotdog|sausage|longganisa/.test(n))          return '🌭';
  if (/ice cream|gelato|frozen/.test(n))            return '🍦';
  return '📦';
};

const TABS = [
  { key:'cashier',   label:'Cashier',     icon:'point-of-sale'  },
  { key:'menu',      label:'Manage Menu', icon:'restaurant-menu' },
  { key:'inventory', label:'Inventory',   icon:'inventory'       },
  { key:'history',   label:'History',     icon:'history'         },
  { key:'credits',   label:'Credits',     icon:'account-balance' },
  { key:'report',    label:'Report',      icon:'bar-chart'       },
];

const ORDER_STATUSES = {
  pending:   { label:'⏳ Pending',         color:'#e67e22', bg:'rgba(230,126,34,0.12)', next:'preparing', nextLabel:'🔥 Start Preparing', nextColor:'#e67e22' },
  preparing: { label:'🔥 Preparing',        color:'#2980b9', bg:'rgba(41,128,185,0.12)', next:'ready',    nextLabel:'✅ Mark as Ready',    nextColor:'#27ae60' },
  ready:     { label:'✅ Ready to Pick Up', color:'#27ae60', bg:'rgba(39,174,96,0.12)',  next:'done',     nextLabel:'✓ Mark as Done',      nextColor:'#1a3a6b' },
  done:      { label:'✓ Done',             color:'rgba(1,31,75,0.35)', bg:'rgba(1,31,75,0.06)', next:null, nextLabel:null, nextColor:null },
};

// ─── ITEM EDIT MODAL ──────────────────────────────────────────────────────────
const ItemEditModal = ({ visible, item, categories, onSave, onClose }) => {
  const [form, setForm] = useState(item || emptyItem());

  // FIX BUG 1: Only reset form when the modal opens with a NEW item (different id),
  // NOT on every re-render. Previously [item] caused the form to reset whenever the
  // parent re-rendered (e.g. after picking an image), wiping out unsaved changes.
  const prevIdRef = useRef(null);
  useEffect(() => {
    if (!visible) { prevIdRef.current = null; return; }
    const incomingId = item?.id ?? '__new__';
    if (incomingId !== prevIdRef.current) {
      prevIdRef.current = incomingId;
      if (item) {
        setForm({...item, price:String(item.price), stock:String(item.stock)});
      } else {
        setForm(emptyItem());
      }
    }
  }, [visible, item?.id]);

  const pickImage = async () => {
    // Request permission first (needed on mobile)
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library in Settings.');
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      // Do NOT request base64 here — we resize via canvas instead (much smaller output)
      base64: false,
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      try {
        // Resize to max 300×300 @ JPEG 0.5 → output is always under 50KB
        const resized = await resizeImageToBase64(asset.uri);
        setForm(f => ({ ...f, image: resized }));
      } catch (e) {
        Alert.alert('Error', 'Could not process image. Please try a different photo.');
      }
    }
  };

  const handleNameChange = (v) => {
    setForm(f => ({ ...f, name: v, emoji: f.image ? f.emoji : autoEmoji(v) }));
  };

  const save = () => {
    if (!form.name.trim()) { Alert.alert('Error','Item name is required.'); return; }
    if (!form.price)       { Alert.alert('Error','Price is required.'); return; }
    if (form.stock==='')   { Alert.alert('Error','Stock is required.'); return; }
    onSave({...form, price:parseFloat(form.price)||0, stock:parseInt(form.stock)||0});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1}/>
        <View style={ms.modalWrapper}>
          <View style={ms.modalCard}>
            <Text style={ms.modalTitle}>{item?.name ? 'Edit Item' : 'Add New Item'}</Text>
            <View style={{ flexDirection:'row', gap:12, alignItems:'flex-start' }}>
              <View style={{ alignItems:'center', gap:4 }}>
                <TouchableOpacity style={ms.imgPicker} onPress={pickImage}>
                  {form.image
                    ? <Image source={{uri:form.image}} style={ms.imgPreview}/>
                    : <View style={{alignItems:'center',gap:2}}><Text style={{fontSize:32}}>{form.emoji}</Text><Text style={ms.imgHint}>Upload</Text></View>
                  }
                  <View style={ms.imgBadge}><MaterialIcons name="photo-camera" size={12} color="#fff"/></View>
                </TouchableOpacity>
                {form.image && <TouchableOpacity onPress={()=>setForm(f=>({...f,image:null}))}><Text style={{fontFamily:'GoogleSans_400Regular',fontSize:10,color:'#e74c3c'}}>✕ Remove</Text></TouchableOpacity>}
                {!form.image && (
                  <View style={{alignItems:'center',gap:2}}>
                    <Text style={[ms.fieldLabel,{textAlign:'center'}]}>Emoji</Text>
                    <TextInput style={[ms.input,{textAlign:'center',fontSize:20,width:56,paddingVertical:6}]} value={form.emoji} onChangeText={v=>setForm(f=>({...f,emoji:v}))} placeholder="📦"/>
                  </View>
                )}
              </View>
              <View style={{flex:1, gap:8}}>
                <View style={ms.fieldRow}>
                  <Text style={ms.fieldLabel}>Item Name *</Text>
                  <TextInput style={ms.input} value={form.name} onChangeText={handleNameChange} placeholder="e.g. Fried Chicken"/>
                </View>
                <View style={ms.fieldRow}>
                  <Text style={ms.fieldLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:4}}>
                    <View style={{flexDirection:'row',gap:5}}>
                      {categories.filter(c=>c!=='All').map(cat=>(
                        <TouchableOpacity key={cat} style={[ms.chip,form.cat===cat&&ms.chipActive]} onPress={()=>setForm(f=>({...f,cat}))}>
                          <Text style={[ms.chipTxt,form.cat===cat&&ms.chipTxtActive]}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={{flexDirection:'row',gap:8}}>
                  <View style={[ms.fieldRow,{flex:1}]}><Text style={ms.fieldLabel}>Price (₱) *</Text><TextInput style={ms.input} value={form.price} onChangeText={v=>setForm(f=>({...f,price:v}))} keyboardType="numeric" placeholder="0.00"/></View>
                  <View style={[ms.fieldRow,{flex:1}]}><Text style={ms.fieldLabel}>Stock *</Text><TextInput style={ms.input} value={form.stock} onChangeText={v=>setForm(f=>({...f,stock:v}))} keyboardType="numeric" placeholder="0"/></View>
                </View>
              </View>
            </View>
            <View style={ms.modalActions}>
              <TouchableOpacity style={ms.cancelBtn} onPress={onClose}><Text style={ms.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={{flex:2,borderRadius:10,overflow:'hidden'}} onPress={save}>
                <LinearGradient colors={['#1a3a6b','#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:0}} style={{paddingVertical:11,alignItems:'center'}}>
                  <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#fff'}}>Save Item</Text>
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
// Crop helper: crops a loaded <img> to 16:9 via canvas and returns a base64 JPEG
const cropTo16x9Base64 = (imgEl) => {
  const srcW = imgEl.naturalWidth;
  const srcH = imgEl.naturalHeight;
  const targetAspect = 16 / 9;
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
  if (srcW / srcH > targetAspect) {
    sw = Math.round(srcH * targetAspect);
    sx = Math.round((srcW - sw) / 2);
  } else {
    sh = Math.round(srcW / targetAspect);
    sy = Math.round((srcH - sh) / 2);
  }
  const canvas = document.createElement('canvas');
  canvas.width  = Math.min(sw, 960);
  canvas.height = Math.round(canvas.width / targetAspect);
  canvas.getContext('2d').drawImage(imgEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.70);
};

const AD_FONT_OPTIONS = [
  { label: 'Google Sans', value: 'GoogleSans_700Bold' },
  { label: 'Noto Serif',  value: 'NotoSerif_700Bold'  },
  { label: 'Monospace',   value: 'monospace'           },
  { label: 'Sans-Serif',  value: 'sans-serif'          },
];

const AD_GRADIENT_PRESETS = [
  { label: 'Navy',    colors: ['#1a3a6b','#2e5fa3']  },
  { label: 'Gold',    colors: ['#7b3f00','#c9a84c']  },
  { label: 'Green',   colors: ['#1a5c2e','#27ae60']  },
  { label: 'Red',     colors: ['#7a0000','#c0392b']  },
  { label: 'Purple',  colors: ['#3d1a7a','#8e44ad']  },
  { label: 'Teal',    colors: ['#0a4d5c','#1abc9c']  },
  { label: 'Sunset',  colors: ['#c0392b','#f39c12']  },
  { label: 'Night',   colors: ['#0d0d0d','#2c3e50']  },
];

const AdEditModal = ({ visible, ad, onSave, onClose, onDelete }) => {
  const [form, setForm] = useState(ad || {});
  const [bgMode, setBgMode] = useState('gradient'); // 'image' | 'gradient'
  const [titleFmt, setTitleFmt] = useState({ bold: true, italic: false, underline: false, font: 'GoogleSans_700Bold' });
  const [subFmt,   setSubFmt]   = useState({ bold: false, italic: false, underline: false, font: 'GoogleSans_400Regular' });
  const [cropLoading, setCropLoading] = useState(false);
  const [customColor1, setCustomColor1] = useState('#1a3a6b');
  const [customColor2, setCustomColor2] = useState('#2e5fa3');
  const [showFontPickerTitle, setShowFontPickerTitle] = useState(false);
  const [showFontPickerSub,   setShowFontPickerSub]   = useState(false);

  // Sync when ad prop changes
  const prevAdIdRef = useRef(null);
  useEffect(() => {
    if (!visible) { prevAdIdRef.current = null; return; }
    const inId = ad?.id ?? '__new__';
    if (inId !== prevAdIdRef.current) {
      prevAdIdRef.current = inId;
      if (ad) {
        setForm({ ...ad });
        setBgMode((ad.image || ad.imageUrl) ? 'image' : 'gradient');
        setTitleFmt(ad.titleFmt || { bold: true, italic: false, underline: false, font: 'GoogleSans_700Bold' });
        setSubFmt(ad.subFmt   || { bold: false, italic: false, underline: false, font: 'GoogleSans_400Regular' });
        if (ad.bg && ad.bg.length >= 2) {
          setCustomColor1(ad.bg[0]);
          setCustomColor2(ad.bg[1]);
        }
      }
    }
  }, [visible, ad?.id]);

  // Pick + auto-crop image to 16:9
  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Required', 'Allow photo library access in Settings.'); return; }
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.70,
      base64: Platform.OS !== 'web',
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    setCropLoading(true);
    try {
      if (Platform.OS === 'web') {
        const imgEl = new window.Image();
        imgEl.crossOrigin = 'anonymous';
        imgEl.onload = () => {
          const cropped = cropTo16x9Base64(imgEl);
          setForm(f => ({ ...f, imageUrl: cropped, image: null }));
          setBgMode('image');
          setCropLoading(false);
        };
        imgEl.onerror = () => setCropLoading(false);
        imgEl.src = asset.uri;
      } else {
        const ext  = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const b64  = `data:${mime};base64,${asset.base64}`;
        setForm(f => ({ ...f, imageUrl: b64, image: null }));
        setBgMode('image');
        setCropLoading(false);
      }
    } catch { setCropLoading(false); }
  };

  const applyCustomGradient = () => {
    setForm(f => ({ ...f, bg: [customColor1, customColor2] }));
    setBgMode('gradient');
  };

  // Toggle text formatting helper
  const toggleFmt = (which, key) => {
    if (which === 'title') setTitleFmt(p => ({ ...p, [key]: !p[key] }));
    else                   setSubFmt(p   => ({ ...p, [key]: !p[key] }));
  };

  const TextFormatBar = ({ which, fmt }) => (
    <View style={adms.fmtBar}>
      {[['bold','B'],['italic','I'],['underline','U']].map(([k,lbl]) => (
        <TouchableOpacity key={k} style={[adms.fmtBtn, fmt[k] && adms.fmtBtnActive]}
          onPress={() => toggleFmt(which, k)}>
          <Text style={[adms.fmtBtnTxt,
            k==='italic'&&{fontStyle:'italic'},
            k==='bold'&&{fontWeight:'800'},
            k==='underline'&&{textDecorationLine:'underline'},
            fmt[k]&&{color:'#fff'}]}>{lbl}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={[adms.fmtBtn,{flex:1}]}
        onPress={() => which==='title' ? setShowFontPickerTitle(v=>!v) : setShowFontPickerSub(v=>!v)}>
        <Text style={adms.fmtFontTxt} numberOfLines={1}>
          {AD_FONT_OPTIONS.find(f=>f.value===fmt.font)?.label || 'Font'} ▾
        </Text>
      </TouchableOpacity>
    </View>
  );

  const FontDropdown = ({ which, fmt, visible: dropVisible, onClose: dropClose }) => {
    if (!dropVisible) return null;
    return (
      <View style={adms.fontDrop}>
        {AD_FONT_OPTIONS.map(opt => (
          <TouchableOpacity key={opt.value} style={[adms.fontDropItem, fmt.font===opt.value && adms.fontDropItemActive]}
            onPress={() => {
              if (which==='title') setTitleFmt(p=>({...p,font:opt.value}));
              else setSubFmt(p=>({...p,font:opt.value}));
              dropClose();
            }}>
            <Text style={[adms.fontDropTxt, fmt.font===opt.value&&{color:'#1a3a6b',fontWeight:'700'}]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const handleSave = () => {
    const finalForm = {
      ...form,
      titleFmt,
      subFmt,
      bg: bgMode === 'gradient' ? (form.bg || ['#1a3a6b','#2e5fa3']) : (form.bg || ['#1a3a6b','#2e5fa3']),
      imageUrl: bgMode === 'image' ? (form.imageUrl || '') : '',
      image:    bgMode === 'image' ? (form.image || null) : null,
      // target: 'member' | 'visitor' | 'both'
      target: form.target || 'both',
      url: form.url || '',
    };
    onSave(finalForm);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1}/>
        <View style={[ms.modalCard, { maxWidth: 480, alignSelf:'center', width:'92%', maxHeight:'92%', padding:0, overflow:'hidden' }]}>
          {/* Modal Header */}
          <LinearGradient colors={['#1a3a6b','#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:0}}
            style={{ paddingVertical:14, paddingHorizontal:18, borderTopLeftRadius:20, borderTopRightRadius:20 }}>
            <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:15, color:'#fff', textAlign:'center' }}>
              {ad?.isNew ? '✦ Add New Ad Banner' : '✦ Edit Ad Banner'}
            </Text>
          </LinearGradient>

          <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16, gap:14 }} showsVerticalScrollIndicator={false}>

            {/* ── BACKGROUND SECTION ── */}
            <View style={adms.section}>
              <Text style={adms.sectionTitle}>📸  BACKGROUND</Text>
              {/* Mode toggle */}
              <View style={adms.modeToggle}>
                <TouchableOpacity style={[adms.modeBtn, bgMode==='image' && adms.modeBtnActive]} onPress={()=>setBgMode('image')}>
                  <MaterialIcons name="image" size={14} color={bgMode==='image'?'#fff':'rgba(1,31,75,0.55)'} />
                  <Text style={[adms.modeBtnTxt, bgMode==='image' && adms.modeBtnTxtActive]}>Upload Image</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[adms.modeBtn, bgMode==='gradient' && adms.modeBtnActive]} onPress={()=>setBgMode('gradient')}>
                  <MaterialIcons name="gradient" size={14} color={bgMode==='gradient'?'#fff':'rgba(1,31,75,0.55)'} />
                  <Text style={[adms.modeBtnTxt, bgMode==='gradient' && adms.modeBtnTxtActive]}>Gradient / Color</Text>
                </TouchableOpacity>
              </View>

              {bgMode === 'image' ? (
                <View style={{ gap:8 }}>
                  {/* Image upload / preview */}
                  <TouchableOpacity style={adms.imgUploadBox} onPress={pickImage} activeOpacity={0.80}>
                    {cropLoading ? (
                      <View style={{alignItems:'center',gap:4}}><Text style={{fontSize:22}}>⏳</Text><Text style={adms.imgHintTxt}>Cropping to 16:9…</Text></View>
                    ) : (form.imageUrl || form.image) ? (
                      <View style={{width:'100%',height:'100%'}}>
                        <Image source={{uri: form.imageUrl || form.image}} style={{width:'100%',height:'100%',borderRadius:10}} resizeMode="cover"/>
                        <View style={adms.imgOverlayBtn}><MaterialIcons name="edit" size={14} color="#fff"/><Text style={adms.imgOverlayTxt}>Change</Text></View>
                      </View>
                    ) : (
                      <View style={{alignItems:'center',gap:6}}>
                        <MaterialIcons name="add-photo-alternate" size={32} color="rgba(1,31,75,0.35)"/>
                        <Text style={adms.imgHintTxt}>Tap to upload · Auto-crops to 16:9</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {(form.imageUrl||form.image) && (
                    <TouchableOpacity onPress={()=>setForm(f=>({...f,imageUrl:'',image:null}))} style={{alignSelf:'center'}}>
                      <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#e74c3c'}}>✕ Remove Image</Text>
                    </TouchableOpacity>
                  )}
                  {/* URL paste fallback */}
                  <View style={ms.fieldRow}>
                    <Text style={ms.fieldLabel}>Or paste image URL</Text>
                    <TextInput style={ms.input} value={form.imageUrl||''} onChangeText={v=>setForm(f=>({...f,imageUrl:v,image:null}))} placeholder="https://..." autoCapitalize="none"/>
                  </View>
                </View>
              ) : (
                <View style={{ gap:10 }}>
                  {/* Gradient presets */}
                  <Text style={adms.subLabel}>Gradient Presets</Text>
                  <View style={adms.gradientGrid}>
                    {AD_GRADIENT_PRESETS.map(preset => {
                      const isActive = form.bg && form.bg[0]===preset.colors[0] && form.bg[1]===preset.colors[1];
                      return (
                        <TouchableOpacity key={preset.label} style={[adms.gradientChip, isActive && adms.gradientChipActive]}
                          onPress={() => setForm(f=>({...f, bg: preset.colors}))}>
                          <LinearGradient colors={preset.colors} start={{x:0,y:0}} end={{x:1,y:1}} style={adms.gradientSwatch}/>
                          <Text style={adms.gradientChipTxt}>{preset.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {/* Custom color picker */}
                  <Text style={adms.subLabel}>Custom Colors</Text>
                  <View style={adms.colorPickerRow}>
                    <View style={{flex:1,gap:4}}>
                      <Text style={adms.colorPickerLabel}>Color 1 (Start)</Text>
                      <View style={adms.colorInputRow}>
                        <View style={[adms.colorSwatch, {backgroundColor:customColor1}]}/>
                        {Platform.OS === 'web' ? (
                          <input type="color" value={customColor1}
                            onChange={e=>setCustomColor1(e.target.value)}
                            style={{width:36,height:32,border:'none',borderRadius:6,cursor:'pointer',padding:0,background:'transparent'}}/>
                        ) : null}
                        <TextInput style={[ms.input,{flex:1,fontSize:11}]} value={customColor1} onChangeText={setCustomColor1} placeholder="#1a3a6b" autoCapitalize="none"/>
                      </View>
                    </View>
                    <View style={{flex:1,gap:4}}>
                      <Text style={adms.colorPickerLabel}>Color 2 (End)</Text>
                      <View style={adms.colorInputRow}>
                        <View style={[adms.colorSwatch,{backgroundColor:customColor2}]}/>
                        {Platform.OS === 'web' ? (
                          <input type="color" value={customColor2}
                            onChange={e=>setCustomColor2(e.target.value)}
                            style={{width:36,height:32,border:'none',borderRadius:6,cursor:'pointer',padding:0,background:'transparent'}}/>
                        ) : null}
                        <TextInput style={[ms.input,{flex:1,fontSize:11}]} value={customColor2} onChangeText={setCustomColor2} placeholder="#2e5fa3" autoCapitalize="none"/>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity style={adms.applyGradientBtn} onPress={applyCustomGradient}>
                    <LinearGradient colors={[customColor1||'#1a3a6b', customColor2||'#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:0}} style={adms.applyGradientInner}>
                      <Text style={adms.applyGradientTxt}>Apply Custom Gradient</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  {/* Live preview swatch */}
                  {form.bg && (
                    <View style={{gap:4}}>
                      <Text style={adms.subLabel}>Preview</Text>
                      <LinearGradient colors={form.bg} start={{x:0,y:0}} end={{x:1,y:1}} style={adms.previewSwatch}>
                        <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#fff',opacity:0.80}}>Ad Banner Preview</Text>
                      </LinearGradient>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ── TITLE ── */}
            <View style={adms.section}>
              <Text style={adms.sectionTitle}>✏️  TITLE</Text>
              <TextFormatBar which="title" fmt={titleFmt}/>
              <FontDropdown which="title" fmt={titleFmt} visible={showFontPickerTitle} onClose={()=>setShowFontPickerTitle(false)}/>
              <TextInput
                style={[ms.input, {
                  fontFamily: titleFmt.font,
                  fontStyle: titleFmt.italic ? 'italic' : 'normal',
                  fontWeight: titleFmt.bold ? '700' : '400',
                  textDecorationLine: titleFmt.underline ? 'underline' : 'none',
                  marginTop:6,
                }]}
                value={form.title||''} onChangeText={v=>setForm(f=>({...f,title:v}))} placeholder="Ad title"/>
            </View>

            {/* ── SUBTITLE ── */}
            <View style={adms.section}>
              <Text style={adms.sectionTitle}>📝  SUBTITLE</Text>
              <TextFormatBar which="sub" fmt={subFmt}/>
              <FontDropdown which="sub" fmt={subFmt} visible={showFontPickerSub} onClose={()=>setShowFontPickerSub(false)}/>
              <TextInput
                style={[ms.input, {
                  fontFamily: subFmt.font,
                  fontStyle: subFmt.italic ? 'italic' : 'normal',
                  fontWeight: subFmt.bold ? '700' : '400',
                  textDecorationLine: subFmt.underline ? 'underline' : 'none',
                  marginTop:6,
                }]}
                value={form.sub||''} onChangeText={v=>setForm(f=>({...f,sub:v}))} placeholder="Ad subtitle"/>
            </View>

            {/* ── URL ── */}
            <View style={adms.section}>
              <Text style={adms.sectionTitle}>🔗  LINK URL</Text>
              <Text style={adms.subLabel}>Clicking this ad will open the URL below</Text>
              <TextInput style={ms.input} value={form.url||''} onChangeText={v=>setForm(f=>({...f,url:v}))}
                placeholder="https://example.com" autoCapitalize="none" keyboardType="url"/>
            </View>

            {/* ── TARGET AUDIENCE ── */}
            <View style={adms.section}>
              <Text style={adms.sectionTitle}>👥  SHOW AD TO</Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                {[
                  {value:'both',   label:'👥 Members & Visitors', color:'#1a3a6b'},
                  {value:'member', label:'🎓 Members Only',        color:'#27ae60'},
                  {value:'visitor',label:'🌐 Visitors Only',       color:'#e67e22'},
                ].map(opt => {
                  const active = (form.target||'both') === opt.value;
                  return (
                    <TouchableOpacity key={opt.value} style={[adms.targetBtn, active && { backgroundColor: opt.color, borderColor: opt.color }]}
                      onPress={() => setForm(f=>({...f, target: opt.value}))}>
                      <Text style={[adms.targetBtnTxt, active && { color:'#fff' }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

          </ScrollView>

          {/* Action Buttons */}
          <View style={[ms.modalActions, { padding:16, paddingTop:0 }]}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose}><Text style={ms.cancelTxt}>Cancel</Text></TouchableOpacity>
            {!ad?.isNew && onDelete && (
              <TouchableOpacity style={[ms.cancelBtn,{backgroundColor:'rgba(231,76,60,0.10)',borderWidth:1,borderColor:'rgba(231,76,60,0.25)'}]}
                onPress={()=>{onClose();onDelete(ad.id);}}>
                <Text style={[ms.cancelTxt,{color:'#e74c3c'}]}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{flex:2,borderRadius:10,overflow:'hidden'}} onPress={handleSave}>
              <LinearGradient colors={['#1a3a6b','#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:0}} style={{paddingVertical:11,alignItems:'center'}}>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#fff'}}>Save Ad</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── AD MODAL STYLES ──────────────────────────────────────────────────────────
const adms = StyleSheet.create({
  section: { backgroundColor:'rgba(1,31,75,0.04)', borderRadius:12, padding:12, gap:8, borderWidth:1, borderColor:'rgba(1,31,75,0.08)' },
  sectionTitle: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.55)', letterSpacing:1.2, textTransform:'uppercase' },
  subLabel: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'rgba(1,31,75,0.40)', letterSpacing:0.8, textTransform:'uppercase' },
  modeToggle: { flexDirection:'row', gap:6 },
  modeBtn: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:5, paddingVertical:8, borderRadius:10, backgroundColor:'rgba(1,31,75,0.06)', borderWidth:1, borderColor:'rgba(1,31,75,0.12)' },
  modeBtnActive: { backgroundColor:'#1a3a6b', borderColor:'#1a3a6b' },
  modeBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'rgba(1,31,75,0.55)' },
  modeBtnTxtActive: { color:'#fff' },
  imgUploadBox: { width:'100%', height:120, borderRadius:10, borderWidth:2, borderStyle:'dashed', borderColor:'rgba(1,31,75,0.18)', backgroundColor:'rgba(1,31,75,0.04)', justifyContent:'center', alignItems:'center', overflow:'hidden' },
  imgOverlayBtn: { position:'absolute', bottom:6, right:6, flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(0,0,0,0.50)', borderRadius:7, paddingHorizontal:8, paddingVertical:4 },
  imgOverlayTxt: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#fff' },
  imgHintTxt: { fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(1,31,75,0.40)', textAlign:'center' },
  gradientGrid: { flexDirection:'row', flexWrap:'wrap', gap:6 },
  gradientChip: { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:8, paddingVertical:6, borderRadius:10, backgroundColor:'rgba(255,255,255,0.70)', borderWidth:1.5, borderColor:'rgba(1,31,75,0.10)' },
  gradientChipActive: { borderColor:'#1a3a6b', backgroundColor:'rgba(26,58,107,0.10)' },
  gradientSwatch: { width:24, height:16, borderRadius:4 },
  gradientChipTxt: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.70)' },
  colorPickerRow: { flexDirection:'row', gap:8 },
  colorPickerLabel: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'rgba(1,31,75,0.45)', letterSpacing:0.5, textTransform:'uppercase' },
  colorInputRow: { flexDirection:'row', alignItems:'center', gap:5 },
  colorSwatch: { width:26, height:26, borderRadius:5, borderWidth:1, borderColor:'rgba(1,31,75,0.15)' },
  applyGradientBtn: { borderRadius:10, overflow:'hidden' },
  applyGradientInner: { paddingVertical:9, alignItems:'center' },
  applyGradientTxt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#fff' },
  previewSwatch: { width:'100%', height:50, borderRadius:10, justifyContent:'center', alignItems:'center' },
  fmtBar: { flexDirection:'row', gap:5, alignItems:'center', flexWrap:'wrap' },
  fmtBtn: { paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor:'rgba(1,31,75,0.06)', borderWidth:1, borderColor:'rgba(1,31,75,0.12)', minWidth:32, alignItems:'center' },
  fmtBtnActive: { backgroundColor:'#1a3a6b', borderColor:'#1a3a6b' },
  fmtBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'rgba(1,31,75,0.65)' },
  fmtFontTxt: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.65)' },
  fontDrop: { backgroundColor:'#fff', borderRadius:10, borderWidth:1, borderColor:'rgba(1,31,75,0.15)', shadowColor:'#000', shadowOpacity:0.15, shadowRadius:8, elevation:8, overflow:'hidden' },
  fontDropItem: { paddingVertical:9, paddingHorizontal:14 },
  fontDropItemActive: { backgroundColor:'rgba(26,58,107,0.08)' },
  fontDropTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'#011f4b' },
  targetBtn: { flex:1, paddingVertical:8, paddingHorizontal:6, borderRadius:10, borderWidth:1.5, borderColor:'rgba(1,31,75,0.15)', alignItems:'center', backgroundColor:'rgba(1,31,75,0.04)' },
  targetBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.60)', textAlign:'center' },
});

const ms = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(1,20,50,0.55)', justifyContent:'center', alignItems:'center', padding:20 },
  modalWrapper: { width:'100%', maxWidth:540 },
  modalCard: { backgroundColor:'#f0f5f9', borderRadius:20, padding:18, gap:12, shadowColor:'#000', shadowOpacity:0.25, shadowRadius:20, elevation:12 },
  modalTitle: { fontFamily:'GoogleSans_700Bold', fontSize:16, color:'#011f4b', textAlign:'center', marginBottom:4 },
  imgPicker: { alignSelf:'center', width:86, height:86, borderRadius:43, backgroundColor:'rgba(1,31,75,0.07)', borderWidth:2, borderColor:'rgba(1,31,75,0.15)', borderStyle:'dashed', justifyContent:'center', alignItems:'center' },
  imgPreview: { width:86, height:86, borderRadius:43 },
  imgHint: { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.40)', textAlign:'center' },
  imgBadge: { position:'absolute', bottom:2, right:2, backgroundColor:'#1a3a6b', borderRadius:10, padding:4 },
  fieldRow: { gap:4 },
  fieldLabel: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.50)', letterSpacing:1, textTransform:'uppercase' },
  input: { backgroundColor:'rgba(255,255,255,0.88)', borderRadius:8, paddingHorizontal:10, paddingVertical:9, fontFamily:'GoogleSans_400Regular', fontSize:13, color:'#011f4b', borderWidth:1, borderColor:'rgba(1,31,75,0.12)' },
  chip: { paddingHorizontal:10, paddingVertical:5, borderRadius:12, backgroundColor:'rgba(1,31,75,0.07)' },
  chipActive: { backgroundColor:'#1a3a6b' },
  chipTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)' },
  chipTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  modalActions: { flexDirection:'row', gap:8, marginTop:4, flexWrap:'wrap' },
  cancelBtn: { flex:1, borderRadius:10, backgroundColor:'rgba(1,31,75,0.07)', paddingVertical:11, alignItems:'center' },
  cancelTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'rgba(1,31,75,0.50)' },
});

// ─── CASHIER SCREEN ───────────────────────────────────────────────────────────
const CashierScreen = ({ items, categories, addOrder, deductStock, isWide: csIsWide }) => {
  const [activeCat, setActiveCat]  = useState('All');
  const [search,    setSearch]     = useState('');
  const [cart,      setCart]       = useState({});
  const [amountPaid,setAmountPaid] = useState('');
  const [receiptVisible,setReceiptVisible] = useState(false);
  const [lastOrder, setLastOrder]  = useState(null);
  const [cartCollapsed, setCartCollapsed] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Animate bottom sheet when cart opens
  const openCart = () => {
    setCartCollapsed(false);
    Animated.spring(slideAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }).start();
  };
  const closeCart = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setCartCollapsed(true));
  };

  const filtered = items.filter(i => {
    if (search.trim()) return i.name.toLowerCase().includes(search.toLowerCase());
    return activeCat==='All' || i.cat===activeCat;
  });

  const cartItems = Object.values(cart).filter(c=>c.qty>0);
  const total = cartItems.reduce((s,{item,qty})=>s+item.price*qty, 0);
  const paid  = parseFloat(amountPaid)||0;
  const change = paid - total;

  const addToCart    = (item) => setCart(prev=>({...prev,[item.id]:{item,qty:(prev[item.id]?.qty||0)+1}}));
  const removeFromCart = (item) => setCart(prev=>{
    const qty=(prev[item.id]?.qty||0)-1;
    if(qty<=0){const n={...prev};delete n[item.id];return n;}
    return {...prev,[item.id]:{item,qty}};
  });
  const clearCart = () => { setCart({}); setAmountPaid(''); };

  // ── FIX: async — awaits Firestore writes ──────────────────────────────────
  const handlePlaceOrder = async () => {
    if(cartItems.length===0) return;
    if(paid<total){ Alert.alert('Insufficient Amount','Please enter the correct amount paid.'); return; }
    const orderNo=Math.floor(1000+Math.random()*9000);
    const now=new Date();
    const time=now.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})+'  '+now.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});
    const order={id:Date.now().toString(),orderNo,time,items:cartItems,total,amountPaid:paid,change,payment:'cash',status:'pending',source:'cashier'};
    await addOrder(order);
    await deductStock(cartItems);
    setLastOrder(order);
    clearCart();
    setTimeout(()=>setReceiptVisible(true),200);
  };

  const COLS = csIsWide ? 6 : 3;

  return (
    <View style={{flex:1,flexDirection: csIsWide ? 'row' : 'column',minHeight:0,overflow:'hidden'}}>
      {/* Items side */}
      <View style={{flex:1,minHeight:0,minWidth:0,flexDirection:'column',overflow:'hidden'}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:6}} contentContainerStyle={{paddingHorizontal:10,gap:5,paddingVertical:4}}>
          {categories.map(cat=>(
            <TouchableOpacity key={cat} style={[cs.catTab,activeCat===cat&&cs.catTabActive]} onPress={()=>setActiveCat(cat)}>
              <Text style={[cs.catTabTxt,activeCat===cat&&cs.catTabTxtActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={cs.searchRow}>
          <Text style={{fontSize:12,marginRight:5}}>🔍</Text>
          <TextInput style={cs.searchInput} placeholder="Search items..." placeholderTextColor="rgba(1,31,75,0.35)" value={search} onChangeText={setSearch}/>
          {search.length>0&&<TouchableOpacity onPress={()=>setSearch('')}><Text style={{color:'rgba(1,31,75,0.40)',fontWeight:'700'}}>✕</Text></TouchableOpacity>}
        </View>
        <WebScrollView style={{flex:1}} contentContainerStyle={{paddingTop:10,paddingHorizontal:12,paddingBottom:20,gap:8}}>
          {Array.from({length:Math.ceil(filtered.length/COLS)},(_,rowIdx)=>(
            <View key={rowIdx} style={{flexDirection:'row',gap:8,alignItems:'stretch'}}>
              {filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).map(item=>(
                <View key={item.id} style={{flex:1,alignSelf:'stretch'}}>
                <TouchableOpacity style={[cs.itemCard,item.stock===0&&{opacity:0.45},{flex:1}]} onPress={()=>item.stock>0&&addToCart(item)} activeOpacity={item.stock>0?0.75:1}>
                  <View style={cs.itemImgCircle}>
                    {item.image?<Image source={{uri:item.image}} style={{width:'100%',height:'100%',borderRadius:99}} resizeMode="cover"/>:<Text style={cs.itemEmoji}>{item.emoji}</Text>}
                  </View>
                  <Text style={cs.itemCardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={cs.itemCardPrice}>₱{item.price}</Text>
                  <Text style={cs.itemCardStock}>{item.stock===0?'Out of stock':`Stock: ${item.stock}`}</Text>
                  {cart[item.id]&&<View style={cs.cartBadge}><Text style={cs.cartBadgeTxt}>{cart[item.id].qty}</Text></View>}
                </TouchableOpacity>
                </View>
              ))}
              {Array.from({length:COLS-filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).length}).map((_,i)=>(<View key={`e-${i}`} style={{flex:1}}/>))}
            </View>
          ))}
        </WebScrollView>
      </View>

      {/* Wide: side panel cart */}
      {csIsWide && (
        <View style={cs.cartPanel}>
          <Text style={cs.cartTitle}>🛒 CART {cartItems.length > 0 ? `(${cartItems.length})` : ''}</Text>
        <View style={cs.cartItemsBox}>
          {cartItems.length===0
            ? <Text style={cs.cartEmpty}>No items added yet</Text>
            : <WebScrollView style={{flex:1}}>
                {cartItems.map(({item,qty})=>(
                  <View key={item.id} style={cs.cartRow}>
                    <Text style={cs.cartEmoji}>{item.emoji}</Text>
                    <View style={{flex:1,minWidth:0}}>
                      <Text style={cs.cartName} numberOfLines={1}>{item.name}</Text>
                      <Text style={cs.cartSub}>₱{item.price} × {qty} = ₱{item.price*qty}</Text>
                    </View>
                    <View style={cs.qtyRow}>
                      <TouchableOpacity style={cs.qBtn} onPress={()=>removeFromCart(item)}><Text style={cs.qBtnTxt}>−</Text></TouchableOpacity>
                      <Text style={cs.qVal}>{qty}</Text>
                      <TouchableOpacity style={[cs.qBtn,{backgroundColor:'#1a3a6b'}]} onPress={()=>addToCart(item)}><Text style={[cs.qBtnTxt,{color:'#fff'}]}>+</Text></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </WebScrollView>
          }
        </View>
        <View style={cs.totalRow}><Text style={cs.totalLbl}>TOTAL</Text><Text style={cs.totalVal}>₱ {total.toFixed(2)}</Text></View>
        <View style={{gap:3}}>
          <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:9,color:'rgba(1,31,75,0.50)',letterSpacing:1,textTransform:'uppercase'}}>Amount Paid (Cash)</Text>
          <TextInput style={cs.amtInput} value={amountPaid} onChangeText={setAmountPaid} keyboardType="numeric" placeholder="₱ 0.00" placeholderTextColor="rgba(1,31,75,0.30)"/>
        </View>
        {amountPaid!==''&&(
          <View style={[cs.changeRow,{backgroundColor:change<0?'rgba(231,76,60,0.10)':'rgba(39,174,96,0.10)',borderRadius:8,padding:8}]}>
            <Text style={cs.changeLbl}>Change</Text>
            <Text style={[cs.changeVal,{color:change<0?'#e74c3c':'#27ae60'}]}>₱ {change.toFixed(2)}</Text>
          </View>
        )}
        <TouchableOpacity style={[cs.orderBtn,cartItems.length===0&&{opacity:0.45}]} onPress={handlePlaceOrder} activeOpacity={0.80}>
          <LinearGradient colors={cartItems.length>0?['#27ae60','#2ecc71']:['#aaa','#bbb']} start={{x:0,y:0}} end={{x:1,y:0}} style={cs.orderBtnGrad}>
            <MaterialIcons name="check-circle" size={16} color="#fff"/>
            <Text style={cs.orderBtnTxt}>Place Order</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={cs.clearBtn} onPress={clearCart}>
          <MaterialIcons name="delete-sweep" size={14} color="#e74c3c"/>
          <Text style={cs.clearBtnTxt}>Clear Cart</Text>
        </TouchableOpacity>
        {lastOrder&&(
          <TouchableOpacity style={cs.receiptBtn} onPress={()=>setReceiptVisible(true)}>
            <MaterialIcons name="receipt" size={14} color="#1a3a6b"/>
            <Text style={cs.receiptBtnTxt}>Last Receipt</Text>
          </TouchableOpacity>
        )}
        </View>
      )}

      {/* Mobile: floating pill + animated bottom sheet (same as CanteenVisitor) */}
      {!csIsWide && (
        <>
          {/* Floating gold pill button */}
          <TouchableOpacity
            style={cs.floatCart}
            onPress={openCart}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#c9a84c','#e8c87a']}
              start={{x:0,y:0}} end={{x:1,y:0}}
              style={cs.floatCartGrad}
            >
              <Text style={cs.floatCartTxt}>
                🛒  View Cart  {cartItems.length > 0 ? `(${cartItems.length})` : ''}  •  ₱{total.toFixed(2)}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Bottom sheet with slide animation */}
          {!cartCollapsed && (
            <View style={cs.sheetOverlay}>
              <TouchableOpacity style={cs.sheetBackdrop} onPress={closeCart} activeOpacity={1} />
              <Animated.View style={[cs.sheet, { transform: [{ translateY: slideAnim.interpolate({ inputRange:[0,1], outputRange:[600,0] }) }] }]}>
                <View style={cs.sheetHandle} />
                <View style={cs.sheetHeader}>
                  <Text style={cs.cartTitle}>🛒 CART {cartItems.length > 0 ? `(${cartItems.length})` : ''}</Text>
                  <TouchableOpacity onPress={closeCart} style={cs.sheetClose}>
                    <Text style={{ color:'rgba(1,31,75,0.6)', fontSize:14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1}}>
                  <View style={{ padding: 12, gap: 8 }}>
        <View style={cs.cartItemsBox}>
          {cartItems.length===0
            ? <Text style={cs.cartEmpty}>No items added yet</Text>
            : <WebScrollView style={{flex:1}}>
                {cartItems.map(({item,qty})=>(
                  <View key={item.id} style={cs.cartRow}>
                    <Text style={cs.cartEmoji}>{item.emoji}</Text>
                    <View style={{flex:1,minWidth:0}}>
                      <Text style={cs.cartName} numberOfLines={1}>{item.name}</Text>
                      <Text style={cs.cartSub}>₱{item.price} × {qty} = ₱{item.price*qty}</Text>
                    </View>
                    <View style={cs.qtyRow}>
                      <TouchableOpacity style={cs.qBtn} onPress={()=>removeFromCart(item)}><Text style={cs.qBtnTxt}>−</Text></TouchableOpacity>
                      <Text style={cs.qVal}>{qty}</Text>
                      <TouchableOpacity style={[cs.qBtn,{backgroundColor:'#1a3a6b'}]} onPress={()=>addToCart(item)}><Text style={[cs.qBtnTxt,{color:'#fff'}]}>+</Text></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </WebScrollView>
          }
        </View>
        <View style={cs.totalRow}><Text style={cs.totalLbl}>TOTAL</Text><Text style={cs.totalVal}>₱ {total.toFixed(2)}</Text></View>
        <View style={{gap:3}}>
          <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:9,color:'rgba(1,31,75,0.50)',letterSpacing:1,textTransform:'uppercase'}}>Amount Paid (Cash)</Text>
          <TextInput style={cs.amtInput} value={amountPaid} onChangeText={setAmountPaid} keyboardType="numeric" placeholder="₱ 0.00" placeholderTextColor="rgba(1,31,75,0.30)"/>
        </View>
        {amountPaid!==''&&(
          <View style={[cs.changeRow,{backgroundColor:change<0?'rgba(231,76,60,0.10)':'rgba(39,174,96,0.10)',borderRadius:8,padding:8}]}>
            <Text style={cs.changeLbl}>Change</Text>
            <Text style={[cs.changeVal,{color:change<0?'#e74c3c':'#27ae60'}]}>₱ {change.toFixed(2)}</Text>
          </View>
        )}
        <TouchableOpacity style={[cs.orderBtn,cartItems.length===0&&{opacity:0.45}]} onPress={handlePlaceOrder} activeOpacity={0.80}>
          <LinearGradient colors={cartItems.length>0?['#27ae60','#2ecc71']:['#aaa','#bbb']} start={{x:0,y:0}} end={{x:1,y:0}} style={cs.orderBtnGrad}>
            <MaterialIcons name="check-circle" size={16} color="#fff"/>
            <Text style={cs.orderBtnTxt}>Place Order</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={cs.clearBtn} onPress={clearCart}>
          <MaterialIcons name="delete-sweep" size={14} color="#e74c3c"/>
          <Text style={cs.clearBtnTxt}>Clear Cart</Text>
        </TouchableOpacity>
        {lastOrder&&(
          <TouchableOpacity style={cs.receiptBtn} onPress={()=>setReceiptVisible(true)}>
            <MaterialIcons name="receipt" size={14} color="#1a3a6b"/>
            <Text style={cs.receiptBtnTxt}>Last Receipt</Text>
          </TouchableOpacity>
        )}
                  </View>
                </ScrollView>
              </Animated.View>
            </View>
          )}
        </>
      )}

      {receiptVisible&&lastOrder&&(
        <Modal transparent visible animationType="fade" onRequestClose={()=>setReceiptVisible(false)}>
          <View style={{flex:1,backgroundColor:'rgba(1,20,50,0.65)',justifyContent:'center',alignItems:'center',padding:20}}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={()=>setReceiptVisible(false)} activeOpacity={1}/>
            <View style={cs.receipt}>
              <Text style={cs.receiptTitle}>🧾 RECEIPT</Text>
              <Text style={cs.receiptSub}>CESLA Canteen</Text>
              <View style={{height:1,borderStyle:'dashed',borderTopWidth:1,borderColor:'rgba(1,31,75,0.20)',marginVertical:10}}/>
              <Text style={cs.receiptMeta}>Order #{lastOrder.orderNo}</Text>
              <Text style={cs.receiptMeta}>{lastOrder.time}</Text>
              <View style={{height:1,borderStyle:'dashed',borderTopWidth:1,borderColor:'rgba(1,31,75,0.20)',marginVertical:10}}/>
              <ScrollView style={{maxHeight:160}} showsVerticalScrollIndicator={false}>
                {(lastOrder.items||[]).map(({item,qty})=>(
                  <View key={item.id} style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                    <Text style={cs.receiptItem} numberOfLines={1}>{item.emoji} {item.name} ×{qty}</Text>
                    <Text style={cs.receiptAmt}>₱{(item.price*qty).toFixed(2)}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={{height:1,backgroundColor:'rgba(1,31,75,0.15)',marginVertical:8}}/>
              <View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={cs.receiptTotalLbl}>TOTAL</Text><Text style={cs.receiptTotalVal}>₱{lastOrder.total.toFixed(2)}</Text></View>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:3}}><Text style={cs.receiptSubLbl}>Cash</Text><Text style={cs.receiptSubVal}>₱{lastOrder.amountPaid.toFixed(2)}</Text></View>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:3}}><Text style={cs.receiptSubLbl}>Change</Text><Text style={[cs.receiptSubVal,{color:'#27ae60'}]}>₱{lastOrder.change.toFixed(2)}</Text></View>
              <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#1a3a6b',textAlign:'center',marginTop:12}}>Thank you! 🙏</Text>
              <TouchableOpacity onPress={()=>setReceiptVisible(false)} style={{marginTop:12,paddingVertical:10,backgroundColor:'rgba(26,58,107,0.10)',borderRadius:10,alignItems:'center'}}>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#1a3a6b'}}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const cs = StyleSheet.create({
  catTab: { paddingVertical:6,paddingHorizontal:14,borderRadius:16,backgroundColor:'rgba(255,255,255,0.35)',borderWidth:1,borderColor:'rgba(255,255,255,0.55)' },
  catTabActive: { backgroundColor:'#304674',borderColor:'#c9a84c' },
  catTabTxt: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'rgba(1,31,75,0.70)' },
  catTabTxtActive: { color:'#fff' },
  searchRow: { flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.70)',borderRadius:8,paddingHorizontal:10,paddingVertical:7,marginHorizontal:8,marginBottom:4,borderWidth:1,borderColor:'rgba(255,255,255,0.90)' },
  searchInput: { flex:1,fontFamily:'GoogleSans_400Regular',fontSize:12,color:'#011f4b',paddingVertical:0 },
  itemCard: { flex:1,alignSelf:'stretch',backgroundColor:'rgba(255,255,255,0.70)',borderRadius:12,padding:8,alignItems:'center',justifyContent:'space-between',gap:3,borderWidth:1,borderColor:'rgba(255,255,255,0.85)',position:'relative',minHeight:140 },
  itemImgCircle: { width:52,height:52,borderRadius:26,backgroundColor:'rgba(240,246,252,0.90)',justifyContent:'center',alignItems:'center',overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.80)',flexShrink:0 },
  itemEmoji: { fontSize:24 },
  itemCardName: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#1a2d4e',textAlign:'center',lineHeight:14,minHeight:28,width:'100%' },
  itemCardPrice: { fontFamily:'NotoSerif_700Bold',fontSize:14,color:'#c9a84c' },
  itemCardStock: { fontFamily:'GoogleSans_400Regular',fontSize:8,color:'rgba(1,31,75,0.45)' },
  cartBadge: { position:'absolute',top:4,right:4,backgroundColor:'#e74c3c',borderRadius:8,width:16,height:16,justifyContent:'center',alignItems:'center' },
  cartBadgeTxt: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'#fff' },
  cartPanel: { width:240,flexShrink:0,backgroundColor:'rgba(255,255,255,0.22)',borderLeftWidth:1,borderColor:'rgba(255,255,255,0.40)',padding:10,gap:6,minHeight:0,overflow:'hidden' },
  cartTitle: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'rgba(1,31,75,0.65)',letterSpacing:2,paddingBottom:6,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.10)' },
  cartItemsBox: { flex:1,minHeight:50,backgroundColor:'rgba(255,255,255,0.40)',borderRadius:10,padding:8,borderWidth:1,borderColor:'rgba(255,255,255,0.65)',overflow:'hidden' },
  cartEmpty: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.40)',textAlign:'center',paddingTop:12 },
  cartRow: { flexDirection:'row',alignItems:'center',gap:5,paddingVertical:5,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.06)' },
  cartEmoji: { fontSize:15 },
  cartName: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#011f4b' },
  cartSub: { fontFamily:'GoogleSans_400Regular',fontSize:9,color:'rgba(1,31,75,0.50)' },
  qtyRow: { flexDirection:'row',alignItems:'center',gap:3 },
  qBtn: { width:18,height:18,borderRadius:9,backgroundColor:'rgba(1,31,75,0.10)',justifyContent:'center',alignItems:'center' },
  qBtnTxt: { fontSize:11,color:'#011f4b',fontWeight:'700',lineHeight:14 },
  qVal: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#011f4b',minWidth:12,textAlign:'center' },
  totalRow: { flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:3 },
  totalLbl: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'rgba(1,31,75,0.55)',letterSpacing:1 },
  totalVal: { fontFamily:'NotoSerif_700Bold',fontSize:13,color:'#c9a84c' },
  amtInput: { backgroundColor:'rgba(255,255,255,0.70)',borderRadius:8,paddingHorizontal:10,paddingVertical:7,fontFamily:'GoogleSans_400Regular',fontSize:13,color:'#011f4b',borderWidth:1,borderColor:'rgba(255,255,255,0.85)' },
  changeRow: { flexDirection:'row',justifyContent:'space-between',alignItems:'center' },
  changeLbl: { fontFamily:'GoogleSans_500Medium',fontSize:10,color:'rgba(1,31,75,0.60)' },
  changeVal: { fontFamily:'NotoSerif_700Bold',fontSize:13 },
  orderBtn: { borderRadius:10,overflow:'hidden' },
  orderBtnGrad: { flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:10 },
  orderBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#fff' },
  clearBtn: { flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,paddingVertical:7,backgroundColor:'rgba(231,76,60,0.10)',borderRadius:8,borderWidth:1,borderColor:'rgba(231,76,60,0.20)' },
  clearBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#e74c3c' },
  receiptBtn: { flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,paddingVertical:7,backgroundColor:'rgba(26,58,107,0.10)',borderRadius:8,borderWidth:1,borderColor:'rgba(26,58,107,0.20)' },
  receiptBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#1a3a6b' },
  // Floating cart + bottom sheet (same as CanteenVisitor)
  floatCart: { position:'absolute', bottom:24, left:0, right:0, alignItems:'center', zIndex:50 },
  floatCartGrad: { borderRadius:30, paddingVertical:11, paddingHorizontal:32, alignItems:'center' },
  floatCartTxt: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#0d1b3e', fontWeight:'700' },
  sheetOverlay: { position:'absolute', top:0, left:0, right:0, bottom:0, justifyContent:'flex-end', zIndex:100 },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(1,20,50,0.45)' },
  sheet: { backgroundColor:'#f0f5f9', borderTopLeftRadius:24, borderTopRightRadius:24, paddingBottom:34, maxHeight:'92%', shadowColor:'#000', shadowOpacity:0.35, shadowRadius:20, shadowOffset:{width:0,height:-4}, elevation:20 },
  sheetHandle: { width:40, height:4, borderRadius:2, backgroundColor:'rgba(1,31,75,0.20)', alignSelf:'center', marginTop:10, marginBottom:6 },
  sheetHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:10, borderBottomWidth:1, borderColor:'rgba(1,31,75,0.10)' },
  sheetClose: { width:30, height:30, borderRadius:15, backgroundColor:'rgba(1,31,75,0.08)', justifyContent:'center', alignItems:'center' },
  receipt: { backgroundColor:'#fffef8',borderRadius:16,padding:20,width:'100%',maxWidth:360,shadowColor:'#000',shadowOpacity:0.25,shadowRadius:20,elevation:14 },
  receiptTitle: { fontFamily:'NotoSerif_700Bold',fontSize:18,color:'#1a2d4e',textAlign:'center' },
  receiptSub: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.50)',textAlign:'center',marginTop:2 },
  receiptMeta: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.55)',textAlign:'center',lineHeight:17 },
  receiptItem: { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'#1a2d4e',flex:1,marginRight:8 },
  receiptAmt: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#1a2d4e' },
  receiptTotalLbl: { fontFamily:'GoogleSans_700Bold',fontSize:14,color:'#1a2d4e' },
  receiptTotalVal: { fontFamily:'NotoSerif_700Bold',fontSize:16,color:'#c9a84c' },
  receiptSubLbl: { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(1,31,75,0.55)' },
  receiptSubVal: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'rgba(1,31,75,0.70)' },
});

// ─── MANAGE MENU SCREEN ───────────────────────────────────────────────────────
const ManageMenuScreen = ({ items, categories, filtered, search, activeCategory, onSearch, onCategoryChange, onAddItem, onEditItem, onDeleteItem, isWide: mmIsWide }) => {
  const COLS = mmIsWide ? 6 : 3;
  return (
    <View style={{flex:1,minHeight:0,flexDirection:'column',overflow:'hidden'}}>

      {/* ── Category tabs — horizontal scroll (same as Merchandise) ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.12)' }}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6, gap: 5 }}>
        {categories.map(cat => (
          <TouchableOpacity key={cat}
            style={[mm.catTabH, activeCategory === cat && mm.catTabHActive]}
            onPress={() => onCategoryChange(cat)}>
            <Text style={[mm.catTabHTxt, activeCategory === cat && mm.catTabHTxtActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{flex:1,minHeight:0,minWidth:0,overflow:'hidden'}}>
        <View style={mm.headerRow}>
          <Text style={mm.headerLbl} numberOfLines={1}>
            {search.trim()?`RESULTS FOR "${search.toUpperCase()}"`:activeCategory==='All'?'ALL ITEMS':activeCategory.toUpperCase()}
          </Text>
          <View style={mm.searchBox}>
            <Text style={{fontSize:11,marginRight:4}}>🔍</Text>
            <TextInput style={mm.searchInput} placeholder="Search..." placeholderTextColor="rgba(1,31,75,0.35)" value={search} onChangeText={onSearch}/>
            {search.length>0&&<TouchableOpacity onPress={()=>onSearch('')}><Text style={{color:'rgba(1,31,75,0.45)',fontWeight:'700',fontSize:12}}>✕</Text></TouchableOpacity>}
          </View>
          <TouchableOpacity style={mm.addBtn} onPress={onAddItem}>
            <MaterialIcons name="add" size={15} color="#fff"/>
            <Text style={mm.addBtnTxt}>Add Item</Text>
          </TouchableOpacity>
        </View>
        <View style={{height:1,backgroundColor:'rgba(1,31,75,0.10)',marginBottom:8,marginHorizontal:8}}/>
        <WebScrollView style={{flex:1}} contentContainerStyle={{paddingTop:10,paddingHorizontal:12,paddingBottom:20,gap:8}}>
          {filtered.length===0
            ? <Text style={mm.emptyTxt}>No items found.</Text>
            : Array.from({length:Math.ceil(filtered.length/COLS)},(_,rowIdx)=>(
              <View key={rowIdx} style={{flexDirection:'row',gap:8,alignItems:'stretch'}}>
                {filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).map(item=>(
                  <View key={item.id} style={{flex:1,minWidth:0,alignSelf:'stretch'}}>
                    <View style={mm.foodCard}>
                      <View style={[mm.foodCardInner,{backgroundColor:'rgba(225,238,248,0.85)'}]}>
                        <View style={mm.adminBtns}>
                          <TouchableOpacity style={mm.editBtn} onPress={()=>onEditItem(item)}><MaterialIcons name="edit" size={11} color="#1a3a6b"/></TouchableOpacity>
                          <TouchableOpacity style={mm.delBtn} onPress={()=>onDeleteItem(item.id)}><MaterialIcons name="delete" size={11} color="#e74c3c"/></TouchableOpacity>
                        </View>
                        <View style={mm.emojiCircle}>
                          {item.image?<Image source={{uri:item.image}} style={{width:'100%',height:'100%',borderRadius:99}} resizeMode="cover"/>:<Text style={mm.emojiTxt}>{item.emoji}</Text>}
                        </View>
                        <Text style={mm.itemName} numberOfLines={2}>{item.name}</Text>
                        <Text style={mm.itemStock}>Stock: {item.stock}</Text>
                        <Text style={mm.itemPrice}>₱{item.price}.00</Text>
                        <TouchableOpacity style={mm.editItemBtn} onPress={()=>onEditItem(item)}>
                          <Text style={mm.editItemBtnTxt}>Edit Item</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
                {Array.from({length:COLS-filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).length}).map((_,i)=>(<View key={`e-${i}`} style={{flex:1}}/>))}
              </View>
            ))
          }
        </WebScrollView>
      </View>
    </View>
  );
};

const mm = StyleSheet.create({
  catPanel: { width:130,flexShrink:0,backgroundColor:'rgba(255,255,255,0.20)',borderRightWidth:1,borderColor:'rgba(255,255,255,0.40)',padding:10 },
  catTitle: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'rgba(1,31,75,0.50)',letterSpacing:2,textTransform:'uppercase',marginBottom:6,paddingBottom:6,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.10)' },
  catBtn: { paddingVertical:8,paddingHorizontal:10,borderRadius:8,marginBottom:2 },
  catBtnActive: { backgroundColor:'rgba(26,58,107,0.18)' },
  catBtnTxt: { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(1,31,75,0.60)' },
  catBtnTxtActive: { fontFamily:'GoogleSans_700Bold',color:'#1a3a6b' },
  // Horizontal tab style (same as Merchandise)
  catTabH: { paddingVertical:7, paddingHorizontal:14, borderRadius:16, backgroundColor:'rgba(255,255,255,0.35)', borderWidth:1, borderColor:'rgba(255,255,255,0.55)', alignItems:'center', justifyContent:'center' },
  catTabHActive: { backgroundColor:'#304674', borderColor:'#c9a84c' },
  catTabHTxt: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'rgba(1,31,75,0.70)' },
  catTabHTxtActive: { color:'#fff' },
  headerRow: { flexDirection:'row',alignItems:'center',gap:8,padding:8,paddingBottom:0 },
  headerLbl: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#011f4b',letterSpacing:2,flexShrink:0 },
  searchBox: { flex:1,flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.75)',borderRadius:8,paddingHorizontal:8,paddingVertical:5,borderWidth:1,borderColor:'rgba(255,255,255,0.90)' },
  searchInput: { flex:1,fontFamily:'GoogleSans_400Regular',fontSize:11,color:'#011f4b',paddingVertical:0 },
  addBtn: { flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#1a3a6b',borderRadius:8,paddingVertical:6,paddingHorizontal:10 },
  addBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#fff' },
  emptyTxt: { fontFamily:'GoogleSans_400Regular',fontSize:13,color:'rgba(1,31,75,0.40)',textAlign:'center',marginTop:30 },
  foodCard: { borderRadius:12,overflow:'hidden',flex:1,alignSelf:'stretch' },
  foodCardInner: { borderRadius:12,padding:9,borderWidth:1.5,borderColor:'rgba(255,255,255,0.75)',alignItems:'center',gap:2,flex:1,justifyContent:'space-between',position:'relative',minHeight:145 },
  adminBtns: { position:'absolute',top:4,right:4,flexDirection:'row',gap:3,zIndex:10 },
  editBtn: { backgroundColor:'rgba(26,58,107,0.12)',borderRadius:6,padding:4,borderWidth:1,borderColor:'rgba(26,58,107,0.20)' },
  delBtn: { backgroundColor:'rgba(231,76,60,0.10)',borderRadius:6,padding:4,borderWidth:1,borderColor:'rgba(231,76,60,0.20)' },
  emojiCircle: { width:46,height:46,borderRadius:23,backgroundColor:'rgba(240,246,252,0.90)',borderWidth:1.5,borderColor:'rgba(255,255,255,0.85)',justifyContent:'center',alignItems:'center',overflow:'hidden',flexShrink:0 },
  emojiTxt: { fontSize:22 },
  itemName: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'#1a2d4e',textAlign:'center',lineHeight:12,minHeight:24,alignSelf:'stretch' },
  itemStock: { fontFamily:'GoogleSans_400Regular',fontSize:8,color:'rgba(1,31,75,0.45)' },
  itemPrice: { fontFamily:'NotoSerif_700Bold',fontSize:12,color:'#c9a84c' },
  editItemBtn: { backgroundColor:'#1a3a6b',borderRadius:6,paddingVertical:5,paddingHorizontal:4,alignItems:'center',width:'100%' },
  editItemBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'#fff' },
});

// ─── INVENTORY, HISTORY, CREDITS, REPORT — unchanged from original ────────────
// (These screens have no order-writing logic, only reads — no changes needed)

const InventoryScreen = ({ items, maxQtyMap, onAddItem, onEditItem }) => {
  const today = new Date();
  const formatDateLabel = (d) => {
    const now = new Date();
    const todayKey = now.toDateString();
    const yestKey  = new Date(now - 86400000).toDateString();
    const opts = { month: 'long', day: 'numeric', year: 'numeric' };
    if (d.toDateString() === todayKey) return "Today's Stocks, " + d.toLocaleDateString('en-PH', opts);
    if (d.toDateString() === yestKey)  return "Yesterday's Stocks, " + d.toLocaleDateString('en-PH', opts);
    return "Stocks — " + d.toLocaleDateString('en-PH', opts);
  };
  const [selectedDate, setSelectedDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
  const getMax = (id) => (maxQtyMap && maxQtyMap[id] !== undefined) ? maxQtyMap[id] : (items.find(i=>i.id===id)?.maxQty || 50);
  const overallPrice = items.reduce((s, i) => s + i.price, 0);
  const overallQty   = items.reduce((s, i) => s + i.stock, 0);
  const grandTotal   = items.reduce((s, i) => s + i.price * i.stock, 0);

  return (
    <View style={{ flex:1, minHeight:0, overflow:'hidden', position:'relative' }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginHorizontal:14, marginTop:8, marginBottom:6 }}>
        <TouchableOpacity style={inv2.titleRow} onPress={() => setShowDatePicker(p => !p)} activeOpacity={0.80}>
          <Text style={inv2.titleText}>{formatDateLabel(selectedDate)}</Text>
          <Text style={inv2.titleCaret}>{showDatePicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={inv2.addItemBtn} onPress={() => onAddItem && onAddItem()} activeOpacity={0.80}>
          <Text style={inv2.addItemBtnTxt}>+ Add Item</Text>
        </TouchableOpacity>
      </View>
      {showDatePicker && (
        <View style={inv2.calCard}>
          <View style={inv2.calNav}>
            <TouchableOpacity style={inv2.calNavBtn} onPress={() => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); }}><Text style={inv2.calNavTxt}>‹</Text></TouchableOpacity>
            <Text style={inv2.calMonthLbl}>{MONTHS[calMonth]} {calYear}</Text>
            <TouchableOpacity style={inv2.calNavBtn} onPress={() => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); }}><Text style={inv2.calNavTxt}>›</Text></TouchableOpacity>
          </View>
          <View style={inv2.calDaysRow}>{DAYS.map(d=><Text key={d} style={inv2.calDayHdr}>{d}</Text>)}</View>
          <View style={inv2.calGrid}>
            {calDays.map((day,idx)=>{
              if(!day) return <View key={'e'+idx} style={inv2.calCell}/>;
              const thisDate=new Date(calYear,calMonth,day);
              const isSelected=thisDate.toDateString()===selectedDate.toDateString();
              const isToday=thisDate.toDateString()===today.toDateString();
              return(
                <TouchableOpacity key={idx} style={[inv2.calCell,isSelected&&inv2.calCellSel,isToday&&!isSelected&&inv2.calCellToday]}
                  onPress={()=>{setSelectedDate(new Date(calYear,calMonth,day));setShowDatePicker(false);}}>
                  <Text style={[inv2.calCellTxt,isSelected&&inv2.calCellTxtSel]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
      <View style={inv2.tableWrap}>
        <View style={inv2.thead}>
          <Text style={[inv2.th,inv2.colName]}>ITEM NAME</Text>
          <Text style={[inv2.th,inv2.colCat]}>CATEGORY</Text>
          <Text style={[inv2.th,inv2.colQty]}>QTY</Text>
          <Text style={[inv2.th,inv2.colMaxQty]}>MAX QTY</Text>
          <Text style={[inv2.th,inv2.colPrice]}>PRICE</Text>
          <Text style={[inv2.th,inv2.colValue]}>VALUE</Text>
          <Text style={[inv2.th,inv2.colRestock]}>RE-STOCK</Text>
        </View>
        <WebScrollView style={{flex:1}} contentContainerStyle={{gap:0}}>
          {items.map((item,idx)=>{
            const max=getMax(item.id);
            const restock=Math.max(0,max-item.stock);
            return(
              <TouchableOpacity key={item.id} style={[inv2.trow,idx%2===0&&inv2.trowAlt]} onPress={()=>onEditItem&&onEditItem(item)} activeOpacity={0.75}>
                <View style={[inv2.td,inv2.colName]}><Text style={inv2.tdName} numberOfLines={1}>{item.emoji}  {item.name}</Text></View>
                <View style={[inv2.td,inv2.colCat]}><Text style={inv2.tdMuted} numberOfLines={1}>{item.cat}</Text></View>
                <View style={[inv2.td,inv2.colQty]}><Text style={[inv2.tdNum,item.stock===0&&{color:'#e74c3c',fontFamily:'GoogleSans_700Bold'},item.stock<=5&&item.stock>0&&{color:'#b85c00',fontFamily:'GoogleSans_700Bold'}]}>{item.stock}</Text></View>
                <View style={[inv2.td,inv2.colMaxQty]}><Text style={[inv2.tdNum,{textAlign:'center'}]}>{getMax(item.id)}</Text></View>
                <View style={[inv2.td,inv2.colPrice]}><Text style={inv2.tdNum}>₱{item.price.toLocaleString()}</Text></View>
                <View style={[inv2.td,inv2.colValue]}><Text style={[inv2.tdNum,{color:'#1a3a6b',fontFamily:'GoogleSans_700Bold'}]}>₱{(item.price*item.stock).toLocaleString()}</Text></View>
                <View style={[inv2.td,inv2.colRestock]}>
                  {restock>0?(<View style={inv2.restockBadge}><Text style={inv2.restockNeed}>Need {restock}</Text><Text style={inv2.restockSub}>({item.stock}/{max})</Text></View>):(<Text style={inv2.restockOk}>✓ OK</Text>)}
                </View>
              </TouchableOpacity>
            );
          })}
        </WebScrollView>
        <View style={inv2.tfooter}>
          <View style={[inv2.td,inv2.colName]}><Text style={inv2.tfootLbl}>TOTALS</Text></View>
          <View style={[inv2.td,inv2.colCat]}/>
          <View style={[inv2.td,inv2.colQty]}><Text style={[inv2.tfootVal,{textAlign:'center'}]}>{overallQty}</Text></View>
          <View style={[inv2.td,inv2.colMaxQty]}/>
          <View style={[inv2.td,inv2.colPrice]}><Text style={[inv2.tfootVal,{textAlign:'center'}]}>₱{overallPrice.toLocaleString()}</Text></View>
          <View style={[inv2.td,inv2.colValue]}><Text style={[inv2.tfootVal,{color:'#8a6500',textAlign:'center'}]}>₱{grandTotal.toLocaleString()}</Text></View>
          <View style={[inv2.td,inv2.colRestock]}/>
        </View>
      </View>
    </View>
  );
};

const inv2 = StyleSheet.create({
  titleRow: { flexDirection:'row',alignItems:'center',gap:6,paddingVertical:6,paddingHorizontal:12,backgroundColor:'rgba(26,58,107,0.10)',borderRadius:8,borderWidth:1,borderColor:'rgba(26,58,107,0.15)',alignSelf:'flex-start' },
  titleText: { fontFamily:'NotoSerif_700Bold',fontSize:12,color:'#1a3a6b' },
  titleCaret: { fontSize:10,color:'rgba(26,58,107,0.50)' },
  addItemBtn: { backgroundColor:'#1a3a6b',borderRadius:8,paddingVertical:7,paddingHorizontal:14,borderWidth:1,borderColor:'rgba(201,168,76,0.40)' },
  addItemBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#fff',letterSpacing:0.3 },
  calCard: { position:'absolute',top:52,left:14,zIndex:999,backgroundColor:'rgba(255,255,255,0.98)',borderRadius:10,borderWidth:1,borderColor:'rgba(26,58,107,0.18)',padding:8,shadowColor:'#000',shadowOpacity:0.18,shadowRadius:12,elevation:20,minWidth:220,maxWidth:260 },
  calNav: { flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:4 },
  calNavBtn: { width:22,height:22,borderRadius:11,backgroundColor:'rgba(26,58,107,0.08)',justifyContent:'center',alignItems:'center' },
  calNavTxt: { fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#1a3a6b' },
  calMonthLbl: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#1a3a6b' },
  calDaysRow: { flexDirection:'row',marginBottom:2 },
  calDayHdr: { flex:1,fontFamily:'GoogleSans_700Bold',fontSize:8,color:'rgba(26,58,107,0.45)',textAlign:'center',letterSpacing:0.3 },
  calGrid: { flexDirection:'row',flexWrap:'wrap' },
  calCell: { width:'14.28%',height:24,justifyContent:'center',alignItems:'center',borderRadius:4 },
  calCellSel: { backgroundColor:'#1a3a6b' },
  calCellToday: { backgroundColor:'rgba(201,168,76,0.20)',borderWidth:1,borderColor:'#c9a84c' },
  calCellTxt: { fontFamily:'GoogleSans_400Regular',fontSize:9,color:'#1a3a6b' },
  calCellTxtSel: { fontFamily:'GoogleSans_700Bold',color:'#fff' },
  tableWrap: { flex:1,minHeight:0,marginHorizontal:14,marginBottom:10 },
  thead: { flexDirection:'row',alignItems:'center',backgroundColor:'rgba(26,58,107,0.14)',borderRadius:8,paddingVertical:9,paddingHorizontal:8,marginBottom:2 },
  th: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'rgba(26,58,107,0.60)',letterSpacing:0.8,textTransform:'uppercase',textAlign:'center',borderRightWidth:1,borderColor:'rgba(26,58,107,0.10)',paddingHorizontal:4 },
  trow: { flexDirection:'row',alignItems:'center',paddingVertical:8,paddingHorizontal:8,minHeight:42,borderBottomWidth:1,borderColor:'rgba(26,58,107,0.07)' },
  trowAlt: { backgroundColor:'rgba(255,255,255,0.38)' },
  td: { justifyContent:'center',alignItems:'center',paddingHorizontal:4,borderRightWidth:1,borderColor:'rgba(26,58,107,0.10)' },
  colName:    { flex:2.2,minWidth:0,alignItems:'flex-start' },
  colCat:     { flex:1.1,minWidth:0,alignItems:'center' },
  colQty:     { flex:0.6,minWidth:0,alignItems:'center' },
  colMaxQty:  { flex:0.8,minWidth:0,alignItems:'center' },
  colPrice:   { flex:0.9,minWidth:0,alignItems:'center' },
  colValue:   { flex:1.0,minWidth:0,alignItems:'center' },
  colRestock: { flex:1.0,minWidth:0,alignItems:'center' },
  tdName:  { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#1a2d4e' },
  tdMuted: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(26,58,107,0.65)',textAlign:'center' },
  tdNum:   { fontFamily:'GoogleSans_500Medium',fontSize:11,color:'#1a2d4e',textAlign:'center' },
  restockBadge: { alignItems:'center' },
  restockNeed: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#b85c00' },
  restockSub:  { fontFamily:'GoogleSans_400Regular',fontSize:9,color:'rgba(26,58,107,0.45)' },
  restockOk:   { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#1a7a45' },
  tfooter: { flexDirection:'row',alignItems:'center',paddingVertical:10,paddingHorizontal:8,backgroundColor:'rgba(26,58,107,0.10)',borderRadius:6,marginTop:4,borderTopWidth:1.5,borderColor:'rgba(26,58,107,0.18)' },
  tfootLbl: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#1a3a6b',letterSpacing:0.5 },
  tfootVal: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#1a3a6b',textAlign:'center',letterSpacing:0.2 },
  maxQtyInput: { width:44,textAlign:'center',fontFamily:'GoogleSans_500Medium',fontSize:11,color:'#1a3a6b',backgroundColor:'rgba(255,255,255,0.80)',borderRadius:6,borderWidth:1,borderColor:'rgba(26,58,107,0.20)',paddingVertical:3,paddingHorizontal:4 },
  unitChip: { flexDirection:'row',alignItems:'center',gap:2,backgroundColor:'rgba(26,58,107,0.08)',borderRadius:6,paddingHorizontal:7,paddingVertical:4,borderWidth:1,borderColor:'rgba(26,58,107,0.15)' },
  unitChipTxt: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#1a3a6b' },
  unitChipArr: { fontSize:8,color:'rgba(26,58,107,0.45)' },
  unitMenu: { position:'absolute',top:26,left:0,backgroundColor:'#fff',borderRadius:8,borderWidth:1,borderColor:'rgba(26,58,107,0.18)',shadowColor:'#000',shadowOpacity:0.14,shadowRadius:8,elevation:12,minWidth:64,zIndex:999 },
  unitOpt: { paddingVertical:7,paddingHorizontal:10 },
  unitOptActive: { backgroundColor:'rgba(26,58,107,0.08)' },
  unitOptTxt: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'#1a3a6b' },
  unitOptTxtActive: { fontFamily:'GoogleSans_700Bold',color:'#1a3a6b' },
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
    const first=new Date(calYear,calMonth,1).getDay();
    const dim=new Date(calYear,calMonth+1,0).getDate();
    const cells=[];
    for(let i=0;i<first;i++)cells.push(null);
    for(let d=1;d<=dim;d++)cells.push(d);
    return cells;
  })();
  const parseOrderDate = (timeStr) => {
    if(!timeStr) return null;
    try{ const d=new Date(timeStr); if(!isNaN(d.getTime()))return d; const d2=new Date(timeStr.replace(/\s+/g,' ').trim()); return isNaN(d2.getTime())?null:d2; }catch{return null;}
  };
  const dateKey=(d)=>{if(!d)return'unknown';return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const todayKey=dateKey(new Date());
  const formatLabel=(key)=>{
    if(!key||key==='unknown')return'Unknown Date';
    const[y,m,day]=key.split('-');
    const d=new Date(Number(y),Number(m)-1,Number(day));
    if(key===todayKey)return`Today, ${d.toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}`;
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    if(key===dateKey(yesterday))return`Yesterday, ${d.toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}`;
    return d.toLocaleDateString('en-PH',{weekday:'short',month:'long',day:'numeric',year:'numeric'});
  };
  const grouped=React.useMemo(()=>{
    const map={};
    [...orders].forEach(o=>{const d=parseOrderDate(o.time);const k=dateKey(d);if(!map[k])map[k]={key:k,date:d,orders:[]};map[k].orders.push(o);});
    Object.values(map).forEach(g=>g.orders.sort((a,b)=>(parseOrderDate(b.time)?.getTime()||0)-(parseOrderDate(a.time)?.getTime()||0)));
    return Object.values(map).sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0));
  },[orders]);
  React.useEffect(()=>{const tg=grouped.find(g=>g.key===todayKey);setSelectedDate(tg?todayKey:(grouped[0]?.key||null));},[grouped.length]);
  const selectedGroup=grouped.find(g=>g.key===selectedDate);
  const displayOrders=selectedGroup?.orders||[];
  const dayTotal=displayOrders.reduce((s,o)=>s+Number(o.total),0);

  return(
    <View style={[sub.root,{position:'relative'}]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:6}}>
        <TouchableOpacity style={hst.calTrigger} onPress={()=>setShowCalendar(p=>!p)} activeOpacity={0.80}>
          <Text style={hst.calTriggerTxt}>{formatLabel(selectedDate)}</Text>
          <Text style={hst.calTriggerCaret}>{showCalendar?'▲':'▼'}</Text>
        </TouchableOpacity>
        <Text style={hst.txHeaderSub}>{displayOrders.length} order{displayOrders.length!==1?'s':''}{'  ·  '}<Text style={{color:'#c9a84c',fontFamily:'GoogleSans_700Bold'}}>₱{dayTotal.toFixed(2)}</Text></Text>
      </View>
      {showCalendar&&(
        <View style={hst.calCard}>
          <View style={inv2.calNav}>
            <TouchableOpacity style={inv2.calNavBtn} onPress={()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}}><Text style={inv2.calNavTxt}>{'<'}</Text></TouchableOpacity>
            <Text style={inv2.calMonthLbl}>{HST_MONTHS[calMonth]} {calYear}</Text>
            <TouchableOpacity style={inv2.calNavBtn} onPress={()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}}><Text style={inv2.calNavTxt}>{'>'}</Text></TouchableOpacity>
          </View>
          <View style={inv2.calDaysRow}>{HST_DAYS.map(d=><Text key={d} style={inv2.calDayHdr}>{d}</Text>)}</View>
          <View style={inv2.calGrid}>
            {calDays.map((day,idx)=>{
              if(!day)return<View key={'e'+idx} style={inv2.calCell}/>;
              const dk=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
              const isSel=dk===selectedDate,isToday=dk===todayKey,hasOrders=grouped.some(g=>g.key===dk);
              return(<TouchableOpacity key={idx} style={[inv2.calCell,isSel&&inv2.calCellSel,isToday&&!isSel&&inv2.calCellToday,!hasOrders&&{opacity:0.30}]} onPress={()=>{if(hasOrders){setSelectedDate(dk);setShowCalendar(false);}}} activeOpacity={hasOrders?0.75:1}>
                <Text style={[inv2.calCellTxt,isSel&&inv2.calCellTxtSel]}>{day}</Text>
                {hasOrders&&!isSel&&<View style={hst.calDot}/>}
              </TouchableOpacity>);
            })}
          </View>
        </View>
      )}
      <View style={{height:1,backgroundColor:'rgba(1,31,75,0.10)',marginVertical:8}}/>
      {displayOrders.length===0
        ?<View style={[sub.emptyBox,{flex:1}]}><MaterialIcons name="receipt-long" size={48} color="rgba(1,31,75,0.15)"/><Text style={sub.emptyTxt}>No transactions for this day.</Text></View>
        :<WebScrollView contentContainerStyle={{gap:4,paddingBottom:20}}>
          {displayOrders.map((order,idx)=>{
            const timeOnly=(()=>{const d=parseOrderDate(order.time);return d?d.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}):(order.time||'');})();
            const itemsSummary=(order.items||[]).map(i=>`${i.item?.name||i.name||'Item'} ×${i.qty}`).join(' · ');
            const isLatest=idx===0&&selectedDate===todayKey;
            const st=ORDER_STATUSES[order.status]||ORDER_STATUSES.pending;
            return(<View key={order.id} style={hst.txRow}>
              <View style={hst.txTimeCol}><Text style={hst.txTime}>{timeOnly}</Text>{isLatest&&<View style={hst.livePip}/>}</View>
              <View style={hst.txLine}><View style={[hst.txDot,isLatest&&{backgroundColor:'#e74c3c'}]}/>{idx<displayOrders.length-1&&<View style={hst.txVLine}/>}</View>
              <View style={hst.txContent}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <Text style={hst.txOrderId}>#{order.orderNo||order.id}</Text>
                  <View style={[hst.txStatusBadge,{backgroundColor:st.bg}]}><Text style={[hst.txStatusTxt,{color:st.color}]}>{st.label}</Text></View>
                </View>
                <Text style={hst.txItems} numberOfLines={2}>{itemsSummary}</Text>
                <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                  <Text style={hst.txAmount}>₱{Number(order.total).toFixed(2)}</Text>
                  <Text style={hst.txPay}>💵 Cash</Text>
                </View>
              </View>
            </View>);
          })}
        </WebScrollView>
      }
    </View>
  );
};

const EmployeeCreditsScreen = () => {
  const [creditOrders, setCreditOrders] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [selectedMember, setSelectedMember] = useState(null); // opens modal
  const [activeModalTab, setActiveModalTab] = useState('unpaid');
  const [settlingId, setSettlingId]     = useState(null);

  // ── Live feed from Firestore ─────────────────────────────────────────────
  // We listen to ALL canteen_orders then filter client-side so we catch
  // orders saved with either `payment` OR `paymentMode` field set to 'credit'.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'canteen_orders'),
      snap => {
        const all = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
        // Normalize: treat paymentMode as fallback for payment
        const credits = all.filter(o => {
          const pm = (o.payment || o.paymentMode || '').toLowerCase();
          return pm === 'credit' || pm === 'credits';
        });
        // Sort newest first
        credits.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setCreditOrders(credits);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  // ── Group by member ───────────────────────────────────────────────────────
  const grouped = React.useMemo(() => {
    const map = {};
    creditOrders.forEach(o => {
      // Normalize payment field for consistency
      const pm = (o.payment || o.paymentMode || '').toLowerCase();
      if (pm !== 'credit' && pm !== 'credits') return;
      // Resolve display name — support all possible field combinations
      const resolvedName = o.memberName
        || (o.firstName && o.lastName ? `${o.lastName}, ${o.firstName}` : null)
        || o.firstName || o.lastName
        || o.memberUserId || o.memberId
        || 'Unknown Member';
      const key = o.memberId || o.memberUserId || resolvedName;
      if (!map[key]) map[key] = {
        memberId:     o.memberId     || '',
        memberUserId: o.memberUserId || '',
        memberName:   resolvedName,
        orders: [],
      };
      map[key].orders.push(o);
    });
    return Object.values(map).sort((a, b) => a.memberName.localeCompare(b.memberName));
  }, [creditOrders]);

  const filtered = grouped.filter(g =>
    g.memberName.toLowerCase().includes(search.toLowerCase()) ||
    g.memberUserId.toLowerCase().includes(search.toLowerCase())
  );

  const fmtDateTime = (ts) => {
    try {
      if (!ts) return '—';
      const d = ts?.toDate?.() || new Date(typeof ts === 'number' ? ts : ts);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
        + '\n' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return '—'; }
  };

  const markSettled = async (docId) => {
    setSettlingId(docId);
    try {
      await updateDoc(doc(db, 'canteen_orders', docId), {
        settled: true, settledAt: serverTimestamp(),
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to mark as settled. Please try again.\n' + (e?.message || ''));
    } finally {
      setSettlingId(null);
    }
  };

  // Get live data for selected member from grouped
  const modalGroup = selectedMember
    ? grouped.find(g => (g.memberId || g.memberName) === selectedMember)
    : null;
  const unpaidOrders = modalGroup ? modalGroup.orders.filter(o => o.settled !== true) : [];
  const paidOrders   = modalGroup ? modalGroup.orders.filter(o => o.settled === true)  : [];
  const totalUnpaid  = unpaidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const totalPaid    = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);

  if (loading) return (
    <View style={[sub.root, { justifyContent: 'center', alignItems: 'center', gap: 12 }]}>
      <Text style={{ fontSize: 32 }}>🪙</Text>
      <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(1,31,75,0.50)' }}>Loading credit orders...</Text>
    </View>
  );

  return (
    <View style={sub.root}>
      {/* Search */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, margin: 16, marginBottom: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.90)', gap: 8 }}>
        <Text style={{ fontSize: 14, color: 'rgba(1,31,75,0.45)' }}>🔍</Text>
        <TextInput
          style={{ flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: '#0f1e35' }}
          value={search} onChangeText={setSearch}
          placeholder="Search member name or ID..."
          placeholderTextColor="rgba(1,31,75,0.35)"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: 'rgba(1,31,75,0.45)', fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Member list */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🪙</Text>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: 'rgba(1,31,75,0.45)', textAlign: 'center' }}>
              {search ? 'No members match your search.' : 'No credit orders yet.'}
            </Text>
          </View>
        ) : filtered.map(group => {
          const unpaid     = group.orders.filter(o => o.settled !== true);
          const paid       = group.orders.filter(o => o.settled === true);
          const totalOwed  = unpaid.reduce((s, o) => s + Number(o.total || 0), 0);
          const isSettled  = totalOwed === 0;

          return (
            <TouchableOpacity
              key={group.memberId || group.memberName}
              onPress={() => { setSelectedMember(group.memberId || group.memberName); setActiveModalTab('unpaid'); }}
              activeOpacity={0.80}
              style={{
                backgroundColor: 'rgba(255,255,255,0.55)',
                borderRadius: 14, marginBottom: 8,
                borderWidth: 1.5,
                borderColor: isSettled ? 'rgba(39,174,96,0.35)' : 'rgba(201,168,76,0.40)',
                shadowColor: '#011f4b', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2,
                overflow: 'hidden',
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingLeft: 18,
              }}
            >
              {/* Left accent */}
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: isSettled ? '#27ae60' : '#c9a84c' }} />

              {/* Avatar */}
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isSettled ? 'rgba(39,174,96,0.15)' : 'rgba(201,168,76,0.20)', borderWidth: 2, borderColor: isSettled ? '#27ae60' : '#c9a84c', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: isSettled ? '#27ae60' : '#c9a84c' }}>
                  {(group.memberName || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#0f1e35' }} numberOfLines={1}>{group.memberName}</Text>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.50)', marginTop: 2 }}>{group.memberUserId || '—'}</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: '#e67e22' }}>⏳ {unpaid.length} unpaid</Text>
                  <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: '#27ae60' }}>✅ {paid.length} paid</Text>
                </View>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 18, color: isSettled ? '#27ae60' : '#c9a84c' }}>
                  ₱ {totalOwed.toFixed(2)}
                </Text>
                {isSettled && (
                  <View style={{ backgroundColor: 'rgba(39,174,96,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(39,174,96,0.40)' }}>
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#27ae60' }}>✓ SETTLED</Text>
                  </View>
                )}
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.35)' }}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Floating Modal ─────────────────────────────────────────────────── */}
      <Modal transparent visible={!!selectedMember} animationType="fade" onRequestClose={() => setSelectedMember(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(1,15,40,0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject }} activeOpacity={1} onPress={() => setSelectedMember(null)} />

          <View style={{
            width: '100%', maxWidth: 700, maxHeight: '88%',
            backgroundColor: '#f0f5f9',
            borderRadius: 20,
            shadowColor: '#000', shadowOpacity: 0.30, shadowRadius: 24, elevation: 20,
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <LinearGradient colors={['#1a2d4e', '#243554']} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(201,168,76,0.25)', borderWidth: 2, borderColor: '#c9a84c', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: '#c9a84c' }}>
                  {(modalGroup?.memberName || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: '#fff' }}>{modalGroup?.memberName || '—'}</Text>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.50)', marginTop: 2 }}>{modalGroup?.memberUserId || '—'}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedMember(null)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* Summary cards row */}
            <View style={{ flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 0 }}>
              {/* Unpaid card */}
              <TouchableOpacity
                onPress={() => setActiveModalTab('unpaid')}
                activeOpacity={0.85}
                style={{
                  flex: 1, borderRadius: 12, padding: 12,
                  backgroundColor: activeModalTab === 'unpaid' ? '#1a2d4e' : 'rgba(255,255,255,0.55)',
                  borderWidth: 1.5, borderColor: activeModalTab === 'unpaid' ? '#c9a84c' : 'rgba(255,255,255,0.70)',
                }}
              >
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: activeModalTab === 'unpaid' ? 'rgba(255,255,255,0.55)' : 'rgba(1,31,75,0.45)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>⏳ Unpaid</Text>
                <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 22, color: activeModalTab === 'unpaid' ? '#c9a84c' : '#e67e22' }}>₱ {totalUnpaid.toFixed(2)}</Text>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: activeModalTab === 'unpaid' ? 'rgba(255,255,255,0.45)' : 'rgba(1,31,75,0.45)', marginTop: 3 }}>{unpaidOrders.length} order{unpaidOrders.length !== 1 ? 's' : ''}</Text>
              </TouchableOpacity>

              {/* Paid card */}
              <TouchableOpacity
                onPress={() => setActiveModalTab('paid')}
                activeOpacity={0.85}
                style={{
                  flex: 1, borderRadius: 12, padding: 12,
                  backgroundColor: activeModalTab === 'paid' ? '#1a4a2e' : 'rgba(255,255,255,0.55)',
                  borderWidth: 1.5, borderColor: activeModalTab === 'paid' ? '#27ae60' : 'rgba(255,255,255,0.70)',
                }}
              >
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: activeModalTab === 'paid' ? 'rgba(255,255,255,0.55)' : 'rgba(1,31,75,0.45)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>✅ Paid</Text>
                <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 22, color: activeModalTab === 'paid' ? '#4cde8a' : '#27ae60' }}>₱ {totalPaid.toFixed(2)}</Text>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: activeModalTab === 'paid' ? 'rgba(255,255,255,0.45)' : 'rgba(1,31,75,0.45)', marginTop: 3 }}>{paidOrders.length} order{paidOrders.length !== 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            </View>

            {/* Table */}
            <ScrollView style={{ flex: 1, margin: 14, marginTop: 12 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {/* Table header */}
              <View style={{ flexDirection: 'row', backgroundColor: '#1a2d4e', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 8, marginBottom: 4 }}>
                {[
                  { l: 'ORDER NO.',  f: 0.8 },
                  { l: 'DATE / TIME', f: 1.3 },
                  { l: 'ITEMS',      f: 2.0 },
                  { l: 'QTY',        f: 0.5 },
                  { l: 'PRICE',      f: 0.7 },
                  { l: 'AMOUNT',     f: 0.8 },
                  { l: '',           f: 0.8 },
                ].map(col => (
                  <Text key={col.l} style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#c9a84c', letterSpacing: 1.2, textTransform: 'uppercase', flex: col.f, textAlign: col.l === 'AMOUNT' || col.l === 'QTY' || col.l === 'PRICE' ? 'right' : 'left' }}>
                    {col.l}
                  </Text>
                ))}
              </View>

              {/* Rows */}
              {(activeModalTab === 'unpaid' ? unpaidOrders : paidOrders).length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>{activeModalTab === 'unpaid' ? '🎉' : '📋'}</Text>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: 'rgba(1,31,75,0.45)', textAlign: 'center' }}>
                    {activeModalTab === 'unpaid' ? 'No unpaid orders!' : 'No paid orders yet.'}
                  </Text>
                </View>
              ) : (activeModalTab === 'unpaid' ? unpaidOrders : paidOrders).map((order, idx) => {
                const orderItems = order.items || [];
                // One row per item; first row shows order info, rest merges
                const isPaid = activeModalTab === 'paid';
                const rowBg  = idx % 2 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.30)';
                const orderTotal = Number(order.total || 0);

                // ── empty-items fallback ──────────────────────────────────
                if (orderItems.length === 0) return (
                  <View key={order.docId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, backgroundColor: rowBg, borderRadius: 8, marginBottom: 3 }}>
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#0f1e35', flex: 0.8 }}>#{order.orderNo || '—'}</Text>
                    <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(1,31,75,0.55)', flex: 1.3 }}>{fmtDateTime(order.createdAt)}</Text>
                    <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.45)', flex: 2.0 }}>—</Text>
                    <Text style={{ flex: 0.5 }} /><Text style={{ flex: 0.7 }} />
                    <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 13, color: isPaid ? '#27ae60' : '#c9a84c', flex: 0.8, textAlign: 'right' }}>₱{orderTotal.toFixed(2)}</Text>
                    <View style={{ flex: 0.8, alignItems: 'flex-end' }}>
                      {!isPaid && (
                        <TouchableOpacity onPress={async () => { await markSettled(order.docId); setActiveModalTab('paid'); }} disabled={settlingId === order.docId} activeOpacity={0.80}
                          style={{ backgroundColor: '#27ae60', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, opacity: settlingId === order.docId ? 0.6 : 1 }}>
                          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#fff' }}>{settlingId === order.docId ? '...' : 'Paid'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );

                // ── item rows ────────────────────────────────────────────
                return [
                  // One row per item — Amount = price × qty (correct per-item amount)
                  ...orderItems.map((it, j) => {
                    const item     = it.item || it;
                    const qty      = it.qty || it.quantity || 1;
                    const lineAmt  = Number(item.price || 0) * qty;   // ← FIXED: always item×qty
                    const isFirst  = j === 0;
                    return (
                      <View key={`${order.docId}-${j}`} style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingVertical: 8, paddingHorizontal: 8,
                        backgroundColor: rowBg,
                        borderTopLeftRadius: isFirst ? 8 : 0,
                        borderTopRightRadius: isFirst ? 8 : 0,
                        borderBottomWidth: 1, borderColor: 'rgba(1,31,75,0.06)',
                      }}>
                        {/* Order No — only first row */}
                        <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: isFirst ? '#0f1e35' : 'transparent', flex: 0.8 }}>
                          {isFirst ? `#${order.orderNo || '—'}` : ''}
                        </Text>
                        {/* Date — only first row */}
                        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 9.5, color: isFirst ? 'rgba(1,31,75,0.55)' : 'transparent', flex: 1.3, lineHeight: 14 }}>
                          {isFirst ? fmtDateTime(order.createdAt) : ''}
                        </Text>
                        {/* Item name */}
                        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: '#0f1e35', flex: 2.0 }} numberOfLines={1}>
                          {item.emoji || '🍽️'} {item.name || '—'}
                        </Text>
                        {/* Qty */}
                        <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#0f1e35', flex: 0.5, textAlign: 'right' }}>
                          {qty}
                        </Text>
                        {/* Unit price */}
                        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.55)', flex: 0.7, textAlign: 'right' }}>
                          ₱{Number(item.price || 0).toFixed(2)}
                        </Text>
                        {/* Amount = price × qty — always correct per item */}
                        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.65)', flex: 0.8, textAlign: 'right' }}>
                          ₱{lineAmt.toFixed(2)}
                        </Text>
                        {/* Empty spacer to keep alignment with subtotal row */}
                        <View style={{ flex: 0.8 }} />
                      </View>
                    );
                  }),

                  // Subtotal row — shows order total + Paid button / settled date
                  <View key={`${order.docId}-subtotal`} style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 8, paddingHorizontal: 8,
                    backgroundColor: rowBg,
                    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
                    marginBottom: 6,
                    borderTopWidth: 1, borderColor: 'rgba(1,31,75,0.12)',
                  }}>
                    {/* empty cols to align with item rows */}
                    <Text style={{ flex: 0.8 }} />
                    <Text style={{ flex: 1.3 }} />
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(1,31,75,0.45)', flex: 2.0, letterSpacing: 1 }}>ORDER TOTAL</Text>
                    <Text style={{ flex: 0.5 }} />
                    <Text style={{ flex: 0.7 }} />
                    {/* Total amount — highlighted */}
                    <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 13, color: isPaid ? '#27ae60' : '#c9a84c', flex: 0.8, textAlign: 'right' }}>
                      ₱{orderTotal.toFixed(2)}
                    </Text>
                    {/* Paid button OR settled timestamp */}
                    <View style={{ flex: 0.8, alignItems: 'flex-end' }}>
                      {!isPaid ? (
                        <TouchableOpacity
                          onPress={async () => { await markSettled(order.docId); setActiveModalTab('paid'); }}
                          disabled={settlingId === order.docId}
                          activeOpacity={0.80}
                          style={{ backgroundColor: '#27ae60', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, opacity: settlingId === order.docId ? 0.6 : 1 }}
                        >
                          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#fff' }}>
                            {settlingId === order.docId ? '...' : 'Paid'}
                          </Text>
                        </TouchableOpacity>
                      ) : order.settledAt ? (
                        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: '#27ae60', textAlign: 'right' }}>
                          ✓ {fmtDateTime(order.settledAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>,
                ];
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const SalesReportScreen = ({ orders, items }) => {
  const currentYear=new Date().getFullYear();
  const[year,setYear]=useState(currentYear);
  const[yearDropdown,setYearDropdown]=useState(false);
  const[activeMonth,setActiveMonth]=useState(new Date().getMonth());
  const[expandedTxDate,setExpandedTxDate]=useState(null);
  const[expandedInvDate,setExpandedInvDate]=useState(null);
  const[showTx,setShowTx]=useState(true);
  const[showInv,setShowInv]=useState(true);
  const[showCredits,setShowCredits]=useState(true);
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const years=Array.from({length:30},(_,i)=>2025+i);
  const parseDate=(timeStr)=>{
    if(!timeStr)return null;
    try{
      if(typeof timeStr==='number')return new Date(timeStr);
      const d=new Date(timeStr);
      return isNaN(d.getTime())?null:d;
    }catch{return null;}
  };
  const getDate=(order)=>{
    if(order.createdAt)return parseDate(order.createdAt);
    return parseDate(order.time);
  };
  const fmtDateKey=(d)=>String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'-'+d.getFullYear();
  const monthOrders=orders.filter(o=>{const d=getDate(o);return d&&d.getFullYear()===year&&d.getMonth()===activeMonth;});
  const txByDay=React.useMemo(()=>{const map={};monthOrders.forEach(o=>{const d=getDate(o);if(!d)return;const k=fmtDateKey(d);if(!map[k])map[k]={key:k,orders:[]};map[k].orders.push(o);});return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key));},[monthOrders.length,activeMonth,year]);
  const invByDay=React.useMemo(()=>txByDay.map(g=>{const totalStock=(items||[]).reduce((s,i)=>s+(i.stock||0),0);const totalValue=(items||[]).reduce((s,i)=>s+(i.price||0)*(i.stock||0),0);return{key:g.key,totalStock,totalValue};}),[txByDay,items]);
  const printTxDay=(dayGroup)=>{if(typeof window==='undefined')return;const total=dayGroup.orders.reduce((s,o)=>s+Number(o.total),0);const rows=dayGroup.orders.map((o,i)=>{const its=(o.items||[]).map(it=>(it.item?.name||it.name||'Item')+' x'+it.qty).join(', ');return'<tr><td>'+(i+1)+'</td><td>#'+(o.orderNo||o.id)+'</td><td>'+(o.time||'')+'</td><td>'+its+'</td><td>&#8369;'+Number(o.total).toFixed(2)+'</td></tr>';}).join('');const html='<html><head><title>Transaction Report '+dayGroup.key+'</title><style>body{font-family:Arial,sans-serif;padding:24px}h2{color:#1a3a6b}table{width:100%;border-collapse:collapse}th{background:#1a3a6b;color:#fff;padding:8px;text-align:left;font-size:12px}td{padding:7px 8px;border-bottom:1px solid #e0e8f0;font-size:12px}tfoot td{font-weight:bold;background:#f0f5f9}</style></head><body><h2>Transaction History Report</h2><p><b>Date:</b> '+dayGroup.key+' &nbsp;|&nbsp; <b>Total Orders:</b> '+dayGroup.orders.length+' &nbsp;|&nbsp; <b>Total Earnings:</b> &#8369;'+total.toFixed(2)+'</p><table><thead><tr><th>#</th><th>Order No</th><th>Time</th><th>Items</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="4">TOTAL</td><td>&#8369;'+total.toFixed(2)+'</td></tr></tfoot></table></body></html>';const w=window.open('','_blank');w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);};
  const printInvDay=(invDay)=>{if(typeof window==='undefined')return;const rows=(items||[]).map(it=>'<tr><td>'+(it.emoji||'')+' '+(it.name||'')+'</td><td>'+(it.cat||'')+'</td><td>'+(it.stock||0)+'</td><td>&#8369;'+(it.price||0).toLocaleString()+'</td><td>&#8369;'+((it.price||0)*(it.stock||0)).toLocaleString()+'</td></tr>').join('');const totalStock=(items||[]).reduce((s,i)=>s+(i.stock||0),0);const totalValue=(items||[]).reduce((s,i)=>s+(i.price||0)*(i.stock||0),0);const html='<html><head><title>Inventory Report '+invDay.key+'</title><style>body{font-family:Arial,sans-serif;padding:24px}h2{color:#1a3a6b}table{width:100%;border-collapse:collapse}th{background:#1a3a6b;color:#fff;padding:8px;text-align:left;font-size:12px}td{padding:7px 8px;border-bottom:1px solid #e0e8f0;font-size:12px}tfoot td{font-weight:bold;background:#f0f5f9}</style></head><body><h2>Inventory Report</h2><p><b>Date:</b> '+invDay.key+' &nbsp;|&nbsp; <b>Total Stock:</b> '+invDay.totalStock+' &nbsp;|&nbsp; <b>Total Value:</b> &#8369;'+invDay.totalValue.toLocaleString()+'</p><table><thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Price</th><th>Value</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="2">TOTAL</td><td>'+totalStock+'</td><td></td><td>&#8369;'+totalValue.toLocaleString()+'</td></tr></tfoot></table></body></html>';const w=window.open('','_blank');w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);};

  return(
    <View style={sub.root}>
      <WebScrollView contentContainerStyle={{gap:0,paddingBottom:20}}>
        <View style={{alignItems:'center',marginBottom:14,position:'relative',zIndex:100}}>
          <TouchableOpacity style={rpt.yearBtn} onPress={()=>setYearDropdown(p=>!p)} activeOpacity={0.80}>
            <Text style={rpt.yearTxt}>YEAR  {year}</Text>
            <Text style={rpt.yearCaret}>{yearDropdown?'▲':'▼'}</Text>
          </TouchableOpacity>
          {yearDropdown&&(<ScrollView style={rpt.yearMenu} showsVerticalScrollIndicator={false}>{years.map(y=>(<TouchableOpacity key={y} style={[rpt.yearOpt,y===year&&rpt.yearOptActive]} onPress={()=>{setYear(y);setYearDropdown(false);}}><Text style={[rpt.yearOptTxt,y===year&&rpt.yearOptTxtActive]}>{y}</Text></TouchableOpacity>))}</ScrollView>)}
        </View>
        <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:6,marginBottom:16}}>
          {MONTHS.map((m,i)=>(<TouchableOpacity key={m} style={[rpt.monthBtn,activeMonth===i&&rpt.monthBtnActive]} onPress={()=>{setActiveMonth(i);setExpandedTxDate(null);setExpandedInvDate(null);}}><Text style={[rpt.monthTxt,activeMonth===i&&rpt.monthTxtActive]}>{m}</Text></TouchableOpacity>))}
        </View>
        <View style={rpt.section}>
          <TouchableOpacity style={rpt.sectionTitleRow} onPress={()=>setShowTx(p=>!p)} activeOpacity={0.80}><Text style={rpt.sectionTitle}>Transaction History Reports</Text><Text style={rpt.sectionToggle}>{showTx?'▲':'▼'}</Text></TouchableOpacity>
          {showTx&&<View>
            <View style={rpt.thead}><Text style={[rpt.th,{flex:1.0,textAlign:'left',paddingLeft:12}]}>DATE</Text><Text style={[rpt.th,{flex:1.1}]}>TOTAL ORDERS</Text><Text style={[rpt.th,{flex:1.3}]}>TOTAL EARNINGS</Text><Text style={[rpt.th,{width:80}]}>PRINT</Text></View>
            {txByDay.length===0?(<View style={rpt.emptyRow}><Text style={rpt.emptyTxt}>No transactions for {MONTHS[activeMonth]} {year}</Text></View>):txByDay.map((g,idx)=>{const total=g.orders.reduce((s,o)=>s+Number(o.total),0);const isOpen=expandedTxDate===g.key;return(<View key={g.key}><TouchableOpacity style={[rpt.trow,idx%2===0&&rpt.trowAlt]} onPress={()=>setExpandedTxDate(isOpen?null:g.key)} activeOpacity={0.75}><Text style={[rpt.td,{flex:1.0,fontFamily:'GoogleSans_700Bold',color:'#1a3a6b',textAlign:'left',paddingLeft:12}]}>{g.key}</Text><Text style={[rpt.td,{flex:1.1}]}>{g.orders.length}</Text><Text style={[rpt.td,{flex:1.3,fontFamily:'GoogleSans_700Bold',color:'#1a7a45'}]}>{'\u20b1'}{total.toFixed(2)}</Text><View style={{width:80,alignItems:'center',justifyContent:'center',alignSelf:'stretch',borderRightWidth:1,borderColor:'rgba(26,58,107,0.08)'}}><TouchableOpacity style={rpt.printBtn} onPress={()=>printTxDay(g)}><Text style={rpt.printBtnTxt}>Print</Text></TouchableOpacity></View></TouchableOpacity>{isOpen&&(<View style={rpt.expandPanel}><View style={rpt.expandHead}><Text style={[rpt.expandTh,{flex:0.4}]}>#</Text><Text style={[rpt.expandTh,{flex:0.8}]}>ORDER NO</Text><Text style={[rpt.expandTh,{flex:1.8}]}>ITEMS</Text><Text style={[rpt.expandTh,{flex:0.8,textAlign:'right'}]}>AMOUNT</Text></View>{g.orders.map((o,i)=>{const itms=(o.items||[]).map(it=>(it.item?.name||it.name||'Item')+' x'+it.qty).join(', ');return(<View key={o.id} style={[rpt.expandRow,i%2===0&&{backgroundColor:'rgba(255,255,255,0.30)'}]}><Text style={[rpt.expandTd,{flex:0.4}]}>{i+1}</Text><Text style={[rpt.expandTd,{flex:0.8,fontFamily:'GoogleSans_700Bold'}]}>#{o.orderNo||o.id}</Text><Text style={[rpt.expandTd,{flex:1.8}]} numberOfLines={2}>{itms}</Text><Text style={[rpt.expandTd,{flex:0.8,textAlign:'right',color:'#c9a84c',fontFamily:'GoogleSans_700Bold'}]}>{'\u20b1'}{Number(o.total).toFixed(2)}</Text></View>);})}</View>)}</View>);})}
          </View>}
        </View>
        <View style={[rpt.section,{marginTop:16}]}>
          <TouchableOpacity style={rpt.sectionTitleRow} onPress={()=>setShowInv(p=>!p)} activeOpacity={0.80}><Text style={rpt.sectionTitle}>Inventory Reports</Text><Text style={rpt.sectionToggle}>{showInv?'▲':'▼'}</Text></TouchableOpacity>
          {showInv&&<View>
            <View style={rpt.thead}><Text style={[rpt.th,{flex:1.0,textAlign:'left',paddingLeft:12}]}>DATE</Text><Text style={[rpt.th,{flex:1.1}]}>TOTAL STOCK</Text><Text style={[rpt.th,{flex:1.3}]}>TOTAL VALUE</Text><Text style={[rpt.th,{width:80}]}>PRINT</Text></View>
            {invByDay.length===0?(<View style={rpt.emptyRow}><Text style={rpt.emptyTxt}>No inventory data for {MONTHS[activeMonth]} {year}</Text></View>):invByDay.map((g,idx)=>{const isOpen=expandedInvDate===g.key;return(<View key={g.key}><TouchableOpacity style={[rpt.trow,idx%2===0&&rpt.trowAlt]} onPress={()=>setExpandedInvDate(isOpen?null:g.key)} activeOpacity={0.75}><Text style={[rpt.td,{flex:1.0,fontFamily:'GoogleSans_700Bold',color:'#1a3a6b',textAlign:'left',paddingLeft:12}]}>{g.key}</Text><Text style={[rpt.td,{flex:1.1}]}>{g.totalStock}</Text><Text style={[rpt.td,{flex:1.3,fontFamily:'GoogleSans_700Bold',color:'#1a7a45'}]}>{'\u20b1'}{g.totalValue.toLocaleString()}</Text><View style={{width:80,alignItems:'center',justifyContent:'center',alignSelf:'stretch',borderRightWidth:1,borderColor:'rgba(26,58,107,0.08)'}}><TouchableOpacity style={rpt.printBtn} onPress={()=>printInvDay(g)}><Text style={rpt.printBtnTxt}>Print</Text></TouchableOpacity></View></TouchableOpacity>{isOpen&&(<View style={rpt.expandPanel}><View style={rpt.expandHead}><Text style={[rpt.expandTh,{flex:2}]}>ITEM</Text><Text style={[rpt.expandTh,{flex:1}]}>CATEGORY</Text><Text style={[rpt.expandTh,{flex:0.6,textAlign:'center'}]}>STOCK</Text><Text style={[rpt.expandTh,{flex:0.8,textAlign:'right'}]}>VALUE</Text></View>{(items||[]).map((it,i)=>(<View key={it.id} style={[rpt.expandRow,i%2===0&&{backgroundColor:'rgba(255,255,255,0.30)'}]}><Text style={[rpt.expandTd,{flex:2,fontFamily:'GoogleSans_700Bold'}]} numberOfLines={1}>{it.emoji} {it.name}</Text><Text style={[rpt.expandTd,{flex:1}]} numberOfLines={1}>{it.cat}</Text><Text style={[rpt.expandTd,{flex:0.6,textAlign:'center'}]}>{it.stock}</Text><Text style={[rpt.expandTd,{flex:0.8,textAlign:'right',color:'#c9a84c',fontFamily:'GoogleSans_700Bold'}]}>{'\u20b1'}{((it.price||0)*(it.stock||0)).toLocaleString()}</Text></View>))}</View>)}</View>);})}
          </View>}
        </View>
        <View style={[rpt.section,{marginTop:16}]}>
          <TouchableOpacity style={rpt.sectionTitleRow} onPress={()=>setShowCredits(p=>!p)} activeOpacity={0.80}><Text style={rpt.sectionTitle}>Credits Reports</Text><Text style={rpt.sectionToggle}>{showCredits?'▲':'▼'}</Text></TouchableOpacity>
          {showCredits&&(()=>{
            const creditOrders=orders.filter(o=>{const pm=(o.payment||o.paymentMode||'').toLowerCase();return pm==='credit'||pm==='credits';});
            const unsettled=creditOrders.filter(o=>o.settled!==true);
            const settled=creditOrders.filter(o=>o.settled===true);
            const totalUnsettled=unsettled.reduce((s,o)=>s+Number(o.total||0),0);
            const totalSettled=settled.reduce((s,o)=>s+Number(o.total||0),0);
            if(creditOrders.length===0)return(<View style={rpt.emptyRow}><Text style={rpt.emptyTxt}>No credit orders for {MONTHS[activeMonth]} {year}</Text></View>);
            const monthCredit=creditOrders.filter(o=>{const d=getDate(o);return d&&d.getFullYear()===year&&d.getMonth()===activeMonth;});
            return(
              <View>
                <View style={{flexDirection:'row',gap:10,marginBottom:10,flexWrap:'wrap'}}>
                  {[
                    {l:'Total Credit Orders',v:monthCredit.length,c:'#1a3a6b'},
                    {l:'Unsettled',v:'₱'+unsettled.reduce((s,o)=>s+Number(o.total||0),0).toFixed(2),c:'#c9a84c'},
                    {l:'Settled',v:'₱'+settled.reduce((s,o)=>s+Number(o.total||0),0).toFixed(2),c:'#27ae60'},
                  ].map(stat=>(
                    <View key={stat.l} style={{flex:1,minWidth:100,backgroundColor:'rgba(255,255,255,0.55)',borderRadius:10,padding:10,borderWidth:1,borderColor:'rgba(255,255,255,0.70)'}}>
                      <Text style={{fontFamily:'GoogleSans_400Regular',fontSize:9,color:'rgba(1,31,75,0.50)',letterSpacing:1,textTransform:'uppercase',marginBottom:4}}>{stat.l}</Text>
                      <Text style={{fontFamily:'NotoSerif_700Bold',fontSize:16,color:stat.c}}>{stat.v}</Text>
                    </View>
                  ))}
                </View>
                <View style={rpt.table}>
                  <View style={rpt.thead}><Text style={[rpt.th,{flex:0.8}]}>ORDER #</Text><Text style={[rpt.th,{flex:1.5}]}>MEMBER</Text><Text style={[rpt.th,{flex:1.2}]}>DATE</Text><Text style={[rpt.th,{flex:0.9,textAlign:'right'}]}>AMOUNT</Text><Text style={[rpt.th,{flex:0.8,textAlign:'center'}]}>STATUS</Text></View>
                  {monthCredit.length===0?(<View style={rpt.emptyRow}><Text style={rpt.emptyTxt}>No credit orders this month</Text></View>):monthCredit.map((o,i)=>(
                    <View key={o.id||o.docId||i} style={[rpt.trow,i%2===0&&rpt.trowAlt]}>
                      <Text style={[rpt.td,{flex:0.8,fontFamily:'GoogleSans_700Bold',color:'#1a3a6b'}]}>#{o.orderNo||'—'}</Text>
                      <Text style={[rpt.td,{flex:1.5}]} numberOfLines={1}>{o.memberName||'—'}</Text>
                      <Text style={[rpt.td,{flex:1.2,fontSize:9}]}>{o.time||'—'}</Text>
                      <Text style={[rpt.td,{flex:0.9,textAlign:'right',fontFamily:'GoogleSans_700Bold',color:'#c9a84c'}]}>₱{Number(o.total||0).toFixed(2)}</Text>
                      <View style={{flex:0.8,alignItems:'center',justifyContent:'center'}}>
                        <View style={{backgroundColor:o.settled?'rgba(39,174,96,0.15)':'rgba(201,168,76,0.15)',borderRadius:6,paddingHorizontal:6,paddingVertical:2,borderWidth:1,borderColor:o.settled?'rgba(39,174,96,0.40)':'rgba(201,168,76,0.40)'}}>
                          <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:8,color:o.settled?'#27ae60':'#c9a84c'}}>{o.settled?'SETTLED':'UNPAID'}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
        </View>
      </WebScrollView>
    </View>
  );
};

const rpt = StyleSheet.create({
  yearBtn: { flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,paddingHorizontal:28,backgroundColor:'rgba(26,58,107,0.12)',borderRadius:12,borderWidth:1.5,borderColor:'rgba(26,58,107,0.20)' },
  yearTxt:  { fontFamily:'GoogleSans_700Bold',fontSize:20,color:'#1a3a6b',letterSpacing:1 },
  yearCaret:{ fontSize:12,color:'rgba(26,58,107,0.50)' },
  yearMenu: { position:'absolute',top:48,zIndex:9999,backgroundColor:'rgba(255,255,255,0.99)',borderRadius:10,borderWidth:1,borderColor:'rgba(26,58,107,0.18)',shadowColor:'#000',shadowOpacity:0.18,shadowRadius:12,elevation:20,minWidth:140,maxHeight:200 },
  yearOpt: { paddingVertical:10,paddingHorizontal:20,alignItems:'center' },
  yearOptActive: { backgroundColor:'rgba(26,58,107,0.08)' },
  yearOptTxt: { fontFamily:'GoogleSans_400Regular',fontSize:14,color:'#1a3a6b' },
  yearOptTxtActive: { fontFamily:'GoogleSans_700Bold',color:'#1a3a6b' },
  monthBtn: { paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:'#1a3a6b',borderWidth:1,borderColor:'rgba(26,58,107,0.60)' },
  monthBtnActive: { backgroundColor:'rgba(198,220,240,0.90)',borderColor:'#304674',borderWidth:1.5 },
  monthTxt: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'rgba(255,255,255,0.90)' },
  monthTxtActive: { fontFamily:'GoogleSans_700Bold',color:'#1a3a6b' },
  section: { backgroundColor:'rgba(255,255,255,0.22)',borderRadius:12,borderWidth:1,borderColor:'rgba(255,255,255,0.45)',overflow:'hidden' },
  sectionTitleRow: { flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:10,paddingHorizontal:12 },
  sectionToggle: { fontSize:13,color:'rgba(26,58,107,0.45)',paddingLeft:8 },
  sectionTitle: { fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#1a3a6b',letterSpacing:0.5 },
  thead: { flexDirection:'row',alignItems:'center',paddingVertical:8,paddingHorizontal:0,backgroundColor:'rgba(26,58,107,0.12)' },
  th: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'rgba(26,58,107,0.60)',letterSpacing:0.8,textTransform:'uppercase',textAlign:'center',paddingVertical:8,paddingHorizontal:6,borderRightWidth:1,borderColor:'rgba(26,58,107,0.10)' },
  trow: { flexDirection:'row',alignItems:'center',paddingVertical:0,paddingHorizontal:0,borderBottomWidth:1,borderColor:'rgba(26,58,107,0.07)',minHeight:42 },
  trowAlt: { backgroundColor:'rgba(255,255,255,0.35)' },
  td: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'#1a2d4e',textAlign:'center',paddingVertical:10,paddingHorizontal:6,borderRightWidth:1,borderColor:'rgba(26,58,107,0.08)',alignSelf:'stretch',justifyContent:'center' },
  printBtn: { alignItems:'center',backgroundColor:'#1a3a6b',borderRadius:6,paddingVertical:5,paddingHorizontal:10 },
  printBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'#fff',letterSpacing:0.3 },
  expandPanel: { backgroundColor:'rgba(26,58,107,0.04)',borderBottomWidth:1,borderColor:'rgba(26,58,107,0.10)' },
  expandHead: { flexDirection:'row',paddingVertical:6,paddingHorizontal:20,backgroundColor:'rgba(26,58,107,0.08)' },
  expandTh: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'rgba(26,58,107,0.50)',letterSpacing:0.5,textTransform:'uppercase',flex:1 },
  expandRow: { flexDirection:'row',paddingVertical:7,paddingHorizontal:20,borderBottomWidth:1,borderColor:'rgba(26,58,107,0.04)' },
  expandTd: { fontFamily:'GoogleSans_400Regular',fontSize:10,color:'#1a2d4e',flex:1 },
  emptyRow: { paddingVertical:20,alignItems:'center' },
  emptyTxt: { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(1,31,75,0.40)' },
  comingSoon: { alignItems:'center',paddingVertical:32,gap:8 },
  comingSoonEmoji: { fontSize:32 },
  comingSoonTxt: { fontFamily:'GoogleSans_700Bold',fontSize:16,color:'rgba(1,31,75,0.40)' },
  comingSoonSub: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.35)',textAlign:'center',paddingHorizontal:20 },
});

const sub = StyleSheet.create({
  root: { flex:1,padding:14,overflow:'hidden',minHeight:0 },
  emptyBox: { flex:1,alignItems:'center',justifyContent:'center',gap:10,paddingTop:60 },
  emptyTxt: { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(1,31,75,0.35)',textAlign:'center',lineHeight:18 },
});

const hst = StyleSheet.create({
  calTrigger: { flexDirection:'row',alignItems:'center',gap:6,paddingVertical:6,paddingHorizontal:12,backgroundColor:'rgba(26,58,107,0.10)',borderRadius:8,borderWidth:1,borderColor:'rgba(26,58,107,0.15)',alignSelf:'flex-start' },
  calTriggerTxt: { fontFamily:'NotoSerif_700Bold',fontSize:12,color:'#1a3a6b' },
  calTriggerCaret: { fontSize:10,color:'rgba(26,58,107,0.50)' },
  calCard: { position:'absolute',top:38,left:0,zIndex:999,backgroundColor:'rgba(255,255,255,0.98)',borderRadius:10,borderWidth:1,borderColor:'rgba(26,58,107,0.18)',padding:8,shadowColor:'#000',shadowOpacity:0.18,shadowRadius:12,elevation:20,minWidth:220,maxWidth:260 },
  calDot: { width:4,height:4,borderRadius:2,backgroundColor:'#1a3a6b',position:'absolute',bottom:2,alignSelf:'center' },
  txHeaderSub: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.50)',marginTop:2 },
  txRow: { flexDirection:'row',gap:0,minHeight:56 },
  txTimeCol: { width:52,flexShrink:0,alignItems:'flex-end',paddingRight:8,paddingTop:3,gap:4 },
  txTime: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'rgba(1,31,75,0.55)',textAlign:'right' },
  livePip: { width:6,height:6,borderRadius:3,backgroundColor:'#e74c3c' },
  txLine: { width:16,flexShrink:0,alignItems:'center' },
  txDot: { width:10,height:10,borderRadius:5,backgroundColor:'#1a3a6b',marginTop:4,flexShrink:0,zIndex:1 },
  txVLine: { flex:1,width:2,backgroundColor:'rgba(1,31,75,0.12)',marginTop:2 },
  txContent: { flex:1,backgroundColor:'rgba(255,255,255,0.65)',borderRadius:10,padding:10,marginLeft:8,marginBottom:4,borderWidth:1,borderColor:'rgba(255,255,255,0.85)',gap:4 },
  txOrderId: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#1a3a6b' },
  txStatusBadge: { borderRadius:5,paddingHorizontal:6,paddingVertical:2 },
  txStatusTxt: { fontFamily:'GoogleSans_700Bold',fontSize:9 },
  txItems: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.60)',lineHeight:15 },
  txAmount: { fontFamily:'NotoSerif_700Bold',fontSize:13,color:'#c9a84c' },
  txPay: { fontFamily:'GoogleSans_400Regular',fontSize:10,color:'rgba(1,31,75,0.45)' },
});

// ─── ORDER MONITORING PANEL ───────────────────────────────────────────────────
const STATUS_CFG = {
  pending:   { label:'PENDING',   color:'#c0392b', btnLabel:'Start Preparing', btnColor:'#e67e22', next:'preparing' },
  preparing: { label:'PREPARING', color:'#b9660a', btnLabel:'Mark as Ready',   btnColor:'#2980b9', next:'ready'     },
  ready:     { label:'READY',     color:'#1a6b2a', btnLabel:'Mark as Done',    btnColor:'#27ae60', next:'done'      },
  done:      { label:'DONE',      color:'#1a3a6b', btnLabel:null,              btnColor:null,      next:null        },
};

const OrderingMonitoring = ({ orders, onUpdateStatus }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [activeFilter, setActiveFilter] = useState('pending');

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim,{toValue:0.2,duration:800,useNativeDriver:true}),
      Animated.timing(pulseAnim,{toValue:1,  duration:800,useNativeDriver:true}),
    ]));
    loop.start();
    return ()=>loop.stop();
  }, []);

  const pendingCount   = orders.filter(o=>o.status==='pending').length;
  const preparingCount = orders.filter(o=>o.status==='preparing').length;
  const readyCount     = orders.filter(o=>o.status==='ready').length;
  const doneToday      = orders.filter(o=>{
    if(o.status!=='done')return false;
    try{const d=new Date(o.time);const t=new Date();return d.toDateString()===t.toDateString();}catch{return false;}
  }).length;

  const STAT_CARDS = [
    { key:'pending',   label:'PENDING',   num:pendingCount,   bg:'#c0392b', activeBg:'#e74c3c' },
    { key:'preparing', label:'PREPARING', num:preparingCount, bg:'#b9660a', activeBg:'#e67e22' },
    { key:'ready',     label:'READY',     num:readyCount,     bg:'#1a6b2a', activeBg:'#27ae60' },
    { key:'done',      label:'DONE',      num:doneToday,      bg:'#1a3a6b', activeBg:'#2e5fa3' },
  ];

  const filteredOrders = orders.filter(o => {
    if(activeFilter==='done'){
      if(o.status!=='done')return false;
      try{const d=new Date(o.time);const t=new Date();return d.toDateString()===t.toDateString();}catch{return false;}
    }
    return o.status===activeFilter;
  });

  const COLS = 3;

  return (
    <View style={lp.root}>
      <View style={lp.titleRow}>
        <Animated.View style={[lp.liveDot,{opacity:pulseAnim}]}/>
        <Text style={lp.title}>ORDERING MONITORING</Text>
      </View>
      <View style={lp.statCards}>
        {STAT_CARDS.map(c=>(
          <TouchableOpacity key={c.key} style={[lp.statCard,{backgroundColor:activeFilter===c.key?c.activeBg:c.bg},activeFilter===c.key&&lp.statCardActive]} onPress={()=>setActiveFilter(c.key)} activeOpacity={0.80}>
            <Text style={lp.statLabel}>{c.label}</Text>
            <Text style={lp.statNum}>{String(c.num).padStart(2,'0')}</Text>
            {activeFilter===c.key&&<View style={lp.statCardIndicator}/>}
          </TouchableOpacity>
        ))}
      </View>
      <WebScrollView style={{flex:1,minHeight:0}} contentContainerStyle={{gap:6,paddingBottom:12}}>
        {filteredOrders.length===0
          ?<View style={lp.emptyBox}>
            <Text style={lp.emptyIco}>{activeFilter==='pending'?'⏳':activeFilter==='preparing'?'🔥':activeFilter==='ready'?'✅':'✓'}</Text>
            <Text style={lp.emptyTxt}>No {activeFilter} orders</Text>
          </View>
          :(()=>{
            const rows=[];
            for(let i=0;i<filteredOrders.length;i+=COLS)rows.push(filteredOrders.slice(i,i+COLS));
            return rows.map((row,rIdx)=>(
              <View key={rIdx} style={{flexDirection:'row',gap:6}}>
                {row.map(order=>{
                  const cfg=STATUS_CFG[order.status]||STATUS_CFG.pending;
                  const itemsList=(order.items||[]).map(i=>`${i.item?.name||i.name||'?'} x${i.qty}`).join(', ');
                  const timeStr=(()=>{try{const d=new Date(order.time);return isNaN(d)?'':d.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});}catch{return'';}})();
                  return(
                    <View key={order.id} style={[lp.card,{flex:1,borderTopColor:cfg.color}]}>
                      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                        <Text style={lp.cardId}>#{order.orderNo||order.id?.slice(-4)||'--'}</Text>
                        <Text style={lp.cardTime}>{timeStr}</Text>
                      </View>
                      <Text style={lp.cardItems} numberOfLines={3}>{itemsList}</Text>
                      <Text style={lp.cardTotal}>{'\u20b1'}{Number(order.total).toFixed(0)}</Text>
                      <Text style={lp.cardPay}>{order.payment==='gcash'?'📱 GCash':'💵 Cash'}</Text>
                      {cfg.btnLabel&&(
                        <TouchableOpacity style={[lp.actionBtn,{backgroundColor:cfg.btnColor}]} onPress={()=>onUpdateStatus(order.id,cfg.next)} activeOpacity={0.80}>
                          <Text style={lp.actionBtnTxt}>{cfg.btnLabel}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
                {Array.from({length:COLS-row.length}).map((_,i)=>(<View key={`e-${i}`} style={{flex:1}}/>))}
              </View>
            ));
          })()
        }
      </WebScrollView>
    </View>
  );
};

const lp = StyleSheet.create({
  root: { flex:1,padding:10,minHeight:0,overflow:'hidden' },
  titleRow: { flexDirection:'row',alignItems:'center',gap:5,marginBottom:8,justifyContent:'center' },
  liveDot: { width:8,height:8,borderRadius:4,backgroundColor:'#e74c3c' },
  title: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#1a2d4e',letterSpacing:1.5,textDecorationLine:'underline',textAlign:'center' },
  statCards: { flexDirection:'row',gap:4,marginBottom:10 },
  statCard: { flex:1,borderRadius:10,paddingVertical:8,paddingHorizontal:2,alignItems:'center',gap:2,position:'relative',overflow:'hidden' },
  statCardActive: { shadowColor:'#000',shadowOpacity:0.25,shadowRadius:6,elevation:6,transform:[{scale:1.03}] },
  statCardIndicator: { position:'absolute',bottom:0,left:0,right:0,height:3,backgroundColor:'rgba(255,255,255,0.60)' },
  statLabel: { fontFamily:'GoogleSans_700Bold',fontSize:6,color:'#fff',letterSpacing:0.8,textAlign:'center' },
  statNum: { fontFamily:'GoogleSans_700Bold',fontSize:20,color:'#fff',lineHeight:24 },
  emptyBox: { padding:20,alignItems:'center',gap:6 },
  emptyIco: { fontSize:28 },
  emptyTxt: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.35)',textAlign:'center' },
  card: { backgroundColor:'rgba(255,255,255,0.88)',borderRadius:10,padding:8,borderTopWidth:3,borderWidth:1,borderColor:'rgba(255,255,255,0.95)',gap:4,shadowColor:'#000',shadowOpacity:0.07,shadowRadius:4,elevation:2,minHeight:110,justifyContent:'space-between' },
  cardId: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#0d2540' },
  cardTime: { fontFamily:'GoogleSans_400Regular',fontSize:9,color:'rgba(1,31,75,0.40)' },
  cardItems: { fontFamily:'GoogleSans_400Regular',fontSize:9,color:'rgba(1,31,75,0.65)',lineHeight:13,flex:1 },
  cardTotal: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#c9a84c' },
  cardPay: { fontFamily:'GoogleSans_400Regular',fontSize:8,color:'rgba(1,31,75,0.40)' },
  actionBtn: { borderRadius:6,paddingVertical:5,paddingHorizontal:4,alignItems:'center',justifyContent:'center',marginTop:2 },
  actionBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'#fff',textAlign:'center' },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function ManageCanteenScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isSmall  = width < 400;
  const isTablet = width >= 600 && width < 900;
  const isWide   = width >= 900;

  const {
    items, ads, categories, orders,
    saveItem, deleteItem, saveAd, addOrder, updateOrderStatus,
    deductStock, reloadFromStorage, setAds,
  } = useCanteen();

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const [activeTab,      setActiveTab]      = useState('cashier');
  const [activeCategory, setActiveCategory] = useState('All');
  const [search,         setSearch]         = useState('');
  const [editItem,       setEditItem]       = useState(null);
  const [editItemModal,  setEditItemModal]  = useState(false);
  const [editAd,         setEditAd]         = useState(null);
  const [editAdModal,    setEditAdModal]    = useState(false);
  const [invMaxQty,      setInvMaxQty]      = useState({});
  const [adCurrent,      setAdCurrent]      = useState(0);
  const [salesCollapsed, setSalesCollapsed] = useState(true);

  // ── New order notification ────────────────────────────────────────────────
  const [notifBanner,    setNotifBanner]    = useState(null); // { orderNo, source, total }
  const notifAnim       = useRef(new Animated.Value(-80)).current;
  const prevOrderIdsRef = useRef(null); // null = first load (skip sound)

  // Watch for new incoming orders and play sound
  useEffect(() => {
    if (!orders || orders.length === 0) return;
    const currentIds = new Set(orders.map(o => o.id));

    // Skip on first load — just record existing IDs
    if (prevOrderIdsRef.current === null) {
      prevOrderIdsRef.current = currentIds;
      return;
    }

    // Find orders that are new AND pending (from customer/member side)
    const newOrders = orders.filter(
      o => !prevOrderIdsRef.current.has(o.id) && (o.status === 'pending' || !o.status)
        && o.source !== 'cashier' // don't notify for cashier's own orders
    );

    if (newOrders.length > 0) {
      const latest = newOrders[0];
      playOrderSound();
      // Show banner
      setNotifBanner({
        orderNo: latest.orderNo || latest.id,
        source: latest.source || 'customer',
        total: latest.total || 0,
      });
      Animated.sequence([
        Animated.spring(notifAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.delay(4000),
        Animated.timing(notifAnim, { toValue: -80, duration: 300, useNativeDriver: true }),
      ]).start(() => setNotifBanner(null));
    }

    prevOrderIdsRef.current = currentIds;
  }, [orders]);

  const hdrFade    = useRef(new Animated.Value(0)).current;
  const hdrTrans   = useRef(new Animated.Value(-16)).current;
  const bodyFade   = useRef(new Animated.Value(0)).current;
  const adScrollRef = useRef(null);

  // ── FIX: Firestore onSnapshot is always live — no polling needed ──────────
  useFocusEffect(useCallback(()=>{
    reloadFromStorage();
  },[reloadFromStorage]));

  useEffect(()=>{
    Animated.parallel([
      Animated.timing(hdrFade,{toValue:1,duration:500,useNativeDriver:true}),
      Animated.timing(hdrTrans,{toValue:0,duration:500,useNativeDriver:true}),
    ]).start();
    Animated.timing(bodyFade,{toValue:1,duration:500,delay:150,useNativeDriver:true}).start();
  },[]);

  const bannerW = isWide ? Math.min(width * 0.60, 700) : width - 16;

  useEffect(()=>{
    if(!ads.length)return;
    const t=setInterval(()=>{
      setAdCurrent(prev=>{
        const next=(prev+1)%ads.length;
        adScrollRef.current?.scrollTo({x:next*bannerW,animated:true});
        return next;
      });
    },5000);
    return()=>clearInterval(t);
  },[ads.length,bannerW]);

  const handleSearch=(text)=>{
    setSearch(text);
    if(!text.trim())return;
    const cats=[...new Set(items.filter(i=>i.name.toLowerCase().includes(text.toLowerCase())).map(i=>i.cat))];
    setActiveCategory(cats.length===1?cats[0]:'All');
  };

  const filtered=items.filter(i=>{
    if(search.trim())return i.name.toLowerCase().includes(search.toLowerCase());
    return activeCategory==='All'||i.cat===activeCategory;
  });

  const openAddItem  =()=>{setEditItem(emptyItem());setEditItemModal(true);};
  const openEditItem =(item)=>{setEditItem({...item,price:String(item.price),stock:String(item.stock)});setEditItemModal(true);};
  const handleSaveItem=(updated)=>{
    saveItem(updated);
    if(updated.maxQty!==undefined)setInvMaxQty(p=>({...p,[updated.id]:updated.maxQty}));
    setEditItemModal(false);
  };
  const handleDeleteItem=(id)=>{
    if(Platform.OS==='web'){if(window.confirm('Delete this item? This cannot be undone.')){deleteItem(id);}}
    else{Alert.alert('Delete Item','Are you sure?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>deleteItem(id)}]);}
  };

  const handleSaveAd = async (updated) => {
    const base = {
      title:     updated.title    || '',
      sub:       updated.sub      || '',
      emoji:     updated.emoji    || '📢',
      image:     updated.image    || null,
      imageUrl:  updated.imageUrl || '',
      bg:        updated.bg       || ['#1a3a6b','#2e5fa3'],
      titleFmt:  updated.titleFmt || { bold:true,  italic:false, underline:false, font:'GoogleSans_700Bold'    },
      subFmt:    updated.subFmt   || { bold:false, italic:false, underline:false, font:'GoogleSans_400Regular'  },
      url:       updated.url      || '',
      target:    updated.target   || 'both',
    };
    if (updated.isNew) {
      await saveAd({ id: Date.now().toString(), ...base });
    } else {
      await saveAd({ id: updated.id, ...base });
    }
    setEditAdModal(false);
  };

  const handleDeleteAd = async (id) => {
    // Delete from Firestore directly
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      await deleteDoc(doc(db, 'canteen_ads', id));
    } catch (e) {
      // Fallback to context setAds
      setAds(prev => prev.filter(a => a.id !== id));
    }
  };

  const pendingCount=orders.filter(o=>o.status==='pending').length;

  if(!fontsLoaded)return null;

  const renderContent=()=>{
    if(activeTab==='cashier')   return <CashierScreen items={items} categories={categories} addOrder={addOrder} deductStock={deductStock} isWide={isWide}/>;
    if(activeTab==='menu')      return <ManageMenuScreen items={items} categories={categories} filtered={filtered} search={search} activeCategory={activeCategory} onSearch={handleSearch} onCategoryChange={setActiveCategory} onAddItem={openAddItem} onEditItem={openEditItem} onDeleteItem={handleDeleteItem} isWide={isWide}/>;
    if(activeTab==='inventory') return <InventoryScreen items={items} maxQtyMap={invMaxQty} onAddItem={openAddItem} onEditItem={openEditItem}/>;
    if(activeTab==='history')   return <OrderHistoryScreen orders={orders}/>;
    if(activeTab==='credits')   return <EmployeeCreditsScreen/>;
    if(activeTab==='report')    return <SalesReportScreen orders={orders} items={items}/>;
    return null;
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>
      <View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#98bad5'}]}/>
      <LinearGradient colors={['rgba(198,220,235,0.85)','rgba(152,186,213,0.40)','rgba(80,110,150,0.0)']} locations={[0,0.45,1]} start={{x:0.5,y:0.1}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>
      <LinearGradient colors={['rgba(50,80,120,0.45)','rgba(50,80,120,0.0)','rgba(50,80,120,0.45)']} locations={[0,0.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFillObject}/>
      <LinearGradient colors={['rgba(50,80,120,0.0)','rgba(60,90,130,0.35)']} locations={[0.4,1]} start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>

      {/* ── NEW ORDER NOTIFICATION BANNER ── */}
      {notifBanner && (
        <Animated.View style={{
          position:'absolute', top: Platform.OS==='web' ? 12 : 44,
          left:16, right:16, zIndex:999,
          transform:[{ translateY: notifAnim }],
        }}>
          <LinearGradient
            colors={['#1a3a6b','#2c5282']}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={{
              borderRadius:14, paddingHorizontal:16, paddingVertical:12,
              flexDirection:'row', alignItems:'center', gap:12,
              shadowColor:'#000', shadowOpacity:0.35, shadowRadius:12,
              shadowOffset:{width:0,height:4}, elevation:16,
              borderWidth:1, borderColor:'rgba(201,168,76,0.40)',
            }}
          >
            <Text style={{fontSize:24}}>🔔</Text>
            <View style={{flex:1}}>
              <Text style={{fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#fff', letterSpacing:0.3}}>
                New Order #{notifBanner.orderNo}
              </Text>
              <Text style={{fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(255,255,255,0.75)', marginTop:1}}>
                From: {notifBanner.source}  ·  ₱{Number(notifBanner.total).toFixed(2)}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      <Animated.View style={{opacity:hdrFade,transform:[{translateY:hdrTrans}],marginTop:Platform.OS==='web'?16:36,marginHorizontal:isSmall?8:10,zIndex:30,flexShrink:0}}>
        <View style={[styles.header,{paddingHorizontal:20,paddingVertical:10}]}>
          <TouchableOpacity style={styles.backBtn} onPress={()=>navigation&&navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1,{fontSize:isSmall?13:18}]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>CESLA </Text>Canteen Management
            </Text>
            <View style={styles.visitorTag}>
              <Text style={styles.visitorTagText}>🍽️  ADMIN PANEL</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.iconBtn,{position:'relative'}]}>
            <MaterialIcons name="notifications" size={19} color="#fff"/>
            {pendingCount>0&&<View style={styles.notifBadge}><Text style={styles.notifBadgeTxt}>{pendingCount}</Text></View>}
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View style={[styles.body,{opacity:bodyFade,flex:1,minHeight:0}]}>
        <View style={{ flex:1, flexDirection: isWide ? 'row' : 'column', minHeight:0, overflow:'hidden' }}>

        {/* LEFT PANEL — Order Monitoring */}
        {isWide ? (
          <View style={styles.leftPanel}>
            <OrderingMonitoring orders={orders} onUpdateStatus={updateOrderStatus}/>
          </View>
        ) : (
          /* Mobile/Tablet: collapsible ordering overview */
          <View style={[
            styles.leftPanelMobile,
            salesCollapsed && { height: 36 },
            isTablet && !salesCollapsed && { height: 170 },
          ]}>
            {/* Collapse toggle header */}
            <TouchableOpacity
              onPress={() => setSalesCollapsed(v => !v)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 12, paddingVertical: 6,
                backgroundColor: 'rgba(26,58,107,0.15)',
                borderBottomWidth: salesCollapsed ? 0 : 1,
                borderColor: 'rgba(255,255,255,0.30)',
              }}
              activeOpacity={0.80}
            >
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <View style={{ width:6, height:6, borderRadius:3, backgroundColor:'#e74c3c' }} />
                <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#1a2d4e', letterSpacing:1.2 }}>ORDERING MONITORING</Text>
              </View>
              <MaterialIcons name={salesCollapsed ? 'expand-more' : 'expand-less'} size={18} color="rgba(26,58,107,0.60)" />
            </TouchableOpacity>
            {!salesCollapsed && (
              <View style={{ flex:1, minHeight:0, overflow:'hidden' }}>
                <OrderingMonitoring orders={orders} onUpdateStatus={updateOrderStatus}/>
              </View>
            )}
          </View>
        )}

        {/* RIGHT PANEL */}
        <View style={isWide ? styles.rightPanel : styles.rightPanelMobile}>
          <View style={styles.adWrapper}>
            <ScrollView ref={adScrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e=>setAdCurrent(Math.round(e.nativeEvent.contentOffset.x/bannerW))}
              style={{width:'100%'}} contentContainerStyle={{width:bannerW*(ads.length+1)}}>
              {ads.map(ad=>{
                const imgSrc=ad.image?{uri:ad.image}:(ad.imageUrl?{uri:ad.imageUrl}:null);
                const titleStyle={
                  fontFamily: ad.titleFmt?.font || 'GoogleSans_700Bold',
                  fontStyle:  ad.titleFmt?.italic    ? 'italic' : 'normal',
                  fontWeight: ad.titleFmt?.bold      ? '700'    : '400',
                  textDecorationLine: ad.titleFmt?.underline ? 'underline' : 'none',
                };
                const subStyle={
                  fontFamily: ad.subFmt?.font || 'GoogleSans_400Regular',
                  fontStyle:  ad.subFmt?.italic    ? 'italic' : 'normal',
                  fontWeight: ad.subFmt?.bold      ? '700'    : '400',
                  textDecorationLine: ad.subFmt?.underline ? 'underline' : 'none',
                };
                const handleAdPress = () => {
                  if (ad.url) {
                    if (Platform.OS === 'web') { window.open(ad.url, '_blank'); }
                    else { import('react-native').then(({ Linking }) => Linking.openURL(ad.url)); }
                  }
                };
                return(
                  <LinearGradient key={ad.id} colors={ad.bg||['#1a3a6b','#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.adSlide,{width:bannerW}]}>
                    {imgSrc?<Image source={imgSrc} style={styles.adBgImg} resizeMode="cover"/>:<Text style={styles.adEmoji}>{ad.emoji}</Text>}
                    <TouchableOpacity style={{flex:1,minWidth:0}} onPress={handleAdPress} activeOpacity={ad.url?0.80:1}>
                      <Text style={[styles.adTitle, titleStyle]} numberOfLines={1}>{ad.title}</Text>
                      <Text style={[styles.adSub, subStyle]} numberOfLines={1}>{ad.sub}</Text>
                      {ad.url ? <Text style={{fontFamily:'GoogleSans_400Regular',fontSize:9,color:'rgba(255,255,255,0.70)',marginTop:2}}>🔗 Tap to open link</Text> : null}
                    </TouchableOpacity>
                    <View style={styles.adBadge}><Text style={styles.adBadgeTxt}>AD</Text></View>
                    {ad.target && ad.target !== 'both' && (
                      <View style={[styles.adBadge,{right:38,backgroundColor: ad.target==='member'?'rgba(39,174,96,0.55)':'rgba(230,126,34,0.55)'}]}>
                        <Text style={styles.adBadgeTxt}>{ad.target==='member'?'MEMBER':'VISITOR'}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.adEditBtn} onPress={()=>{setEditAd({...ad});setEditAdModal(true);}}>
                      <MaterialIcons name="edit" size={12} color="#fff"/>
                    </TouchableOpacity>
                    <View style={styles.adDotsInner}>
                      {ads.map((_,i)=>(<TouchableOpacity key={i} onPress={()=>{adScrollRef.current?.scrollTo({x:i*bannerW,animated:true});setAdCurrent(i);}}><View style={[styles.adDot,adCurrent===i&&styles.adDotActive]}/></TouchableOpacity>))}
                    </View>
                  </LinearGradient>
                );
              })}
              <TouchableOpacity style={[styles.adSlide,{width:bannerW,backgroundColor:'rgba(26,58,107,0.18)',justifyContent:'center',alignItems:'center',gap:8,borderWidth:2,borderColor:'rgba(255,255,255,0.40)',borderStyle:'dashed'}]}
                onPress={()=>{setEditAd({isNew:true,id:Date.now().toString(),title:'',sub:'',image:null,imageUrl:'',emoji:'📢',bg:['#1a3a6b','#2e5fa3']});setEditAdModal(true);}}>
                <MaterialIcons name="add-circle-outline" size={28} color="rgba(26,58,107,0.55)"/>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:12,color:'rgba(26,58,107,0.55)'}}>Add New Ad</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.tabBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:2}} style={{flexGrow:0}}>
              {TABS.map(tab=>(
                <TouchableOpacity key={tab.key} style={[styles.tabBtn,activeTab===tab.key&&styles.tabBtnActive]} onPress={()=>setActiveTab(tab.key)} activeOpacity={0.80}>
                  <MaterialIcons name={tab.icon} size={13} color={activeTab===tab.key?'#1a3a6b':'rgba(255,255,255,0.80)'}/>
                  <Text style={[styles.tabBtnTxt,activeTab===tab.key&&styles.tabBtnTxtActive]}>{tab.label}</Text>
                  {tab.key==='cashier'&&pendingCount>0&&(<View style={styles.tabBadge}><Text style={styles.tabBadgeTxt}>{pendingCount}</Text></View>)}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.contentArea}>{renderContent()}</View>
        </View>
        </View>
      </Animated.View>

      <ItemEditModal visible={editItemModal} item={editItem} categories={categories} onSave={handleSaveItem} onClose={()=>setEditItemModal(false)}/>
      <AdEditModal visible={editAdModal} ad={editAd} onSave={handleSaveAd} onClose={()=>setEditAdModal(false)} onDelete={handleDeleteAd}/>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex:1,flexDirection:'column' },
  header: { flexDirection:'row',alignItems:'center',backgroundColor:'rgba(26,58,107,0.92)',borderRadius:16,borderWidth:1,borderColor:'rgba(255,255,255,0.18)',shadowColor:'#011f4b',shadowOpacity:0.25,shadowRadius:12,elevation:8 },
  backBtn: { width:36,height:36,borderRadius:18,backgroundColor:'rgba(255,255,255,0.15)',borderWidth:1,borderColor:'rgba(255,255,255,0.30)',justifyContent:'center',alignItems:'center',flexShrink:0 },
  backIcon: { color:'#fff',fontSize:16,fontWeight:'600',textAlign:'center',lineHeight:20 },
  headerCenter: { flex:1,alignItems:'center',paddingHorizontal:8,minWidth:0 },
  headerH1: { fontFamily:'NotoSerif_700Bold',color:'#fff',textAlign:'center' },
  headerGold: { color:'#c9a84c' },
  visitorTag: { marginTop:2,paddingHorizontal:8,paddingVertical:2,borderRadius:20,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:1,borderColor:'rgba(255,255,255,0.40)',alignSelf:'center' },
  visitorTagText: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'#fff',letterSpacing:1.2,textTransform:'uppercase',lineHeight:13 },
  iconBtn: { width:36,height:36,borderRadius:18,backgroundColor:'rgba(255,255,255,0.15)',borderWidth:1,borderColor:'rgba(255,255,255,0.30)',justifyContent:'center',alignItems:'center',flexShrink:0 },
  notifBadge: { position:'absolute',top:4,right:4,backgroundColor:'#e74c3c',borderRadius:6,minWidth:14,height:14,alignItems:'center',justifyContent:'center',paddingHorizontal:2 },
  notifBadgeTxt: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'#fff' },
  body: { flex:1, marginTop:Platform.OS==='web'?10:6, marginBottom:16, minHeight:0, overflow:'hidden' },
  leftPanelMobile: { height: 220, flexShrink: 0, backgroundColor:'rgba(255,255,255,0.22)', borderRadius:12, marginHorizontal:8, marginTop:4, marginBottom:0, borderWidth:1, borderColor:'rgba(255,255,255,0.40)', overflow:'hidden' },
  rightPanelMobile: { flex:1, minWidth:0, minHeight:0, marginHorizontal:8, marginTop:6, marginBottom:8, flexDirection:'column', overflow:'hidden' },
  leftPanel: { flex:1.4,flexShrink:0,backgroundColor:'rgba(255,255,255,0.22)',borderRadius:16,marginLeft:10,marginRight:0,borderWidth:1,borderColor:'rgba(255,255,255,0.40)',overflow:'hidden',minHeight:0 },
  rightPanel: { flex:3,minWidth:0,minHeight:0,marginHorizontal:10,flexDirection:'column',overflow:'hidden' },
  adWrapper: { height:100,flexShrink:0,borderRadius:16,overflow:'hidden',backgroundColor:'rgba(26,58,107,0.15)',marginBottom:0 },
  adSlide: { height:100,flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingBottom:10,gap:12,overflow:'hidden' },
  adBgImg: { position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:16 },
  adEmoji: { fontSize:40,flexShrink:0 },
  adTitle: { fontFamily:'GoogleSans_700Bold',fontSize:15,color:'#fff' },
  adSub:   { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(255,255,255,0.85)' },
  adBadge: { position:'absolute',top:8,right:38,backgroundColor:'rgba(255,255,255,0.25)',borderRadius:4,paddingHorizontal:6,paddingVertical:2 },
  adBadgeTxt: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'#fff',letterSpacing:1 },
  adEditBtn: { position:'absolute',top:6,right:8,backgroundColor:'rgba(0,0,0,0.35)',borderRadius:7,padding:5 },
  adDotsInner: { position:'absolute',bottom:5,left:0,right:0,flexDirection:'row',justifyContent:'center',gap:4 },
  adDot: { width:6,height:6,borderRadius:3,backgroundColor:'rgba(255,255,255,0.40)' },
  adDotActive: { backgroundColor:'#fff',width:16 },
  tabBar: { flexShrink:0,backgroundColor:'rgba(26,58,107,0.50)',borderTopLeftRadius:12,borderTopRightRadius:12,paddingTop:5,paddingHorizontal:4,marginTop:8,flexDirection:'row' },
  tabBtn: { paddingVertical:8,paddingHorizontal:13,borderTopLeftRadius:10,borderTopRightRadius:10,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(255,255,255,0.10)',marginHorizontal:2 },
  tabBtnActive: { backgroundColor:'#eef2f8' },
  tabBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'rgba(255,255,255,0.80)' },
  tabBtnTxtActive: { color:'#1a3a6b' },
  tabBadge: { backgroundColor:'#e74c3c',borderRadius:7,minWidth:14,height:14,alignItems:'center',justifyContent:'center',paddingHorizontal:2 },
  tabBadgeTxt: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'#fff' },
  contentArea: { flex:1,minHeight:0,backgroundColor:'rgba(255,255,255,0.22)',borderBottomLeftRadius:16,borderBottomRightRadius:16,borderTopRightRadius:16,borderWidth:1,borderColor:'rgba(255,255,255,0.40)',overflow:'hidden' },
});