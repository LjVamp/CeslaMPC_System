// src/screens/CoopScreen.js
// CESLA MPC — Employee Cooperative Portal (ALL-IN-ONE)
// Login → Register → Member Dashboard — Firebase Firestore
// view: 'login' | 'register' | 'success' | 'dashboard'
// After login, member stays in this screen — no navigation needed
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, useWindowDimensions, Platform,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ChatSystem from '../components/ChatSystem';

// ─── Firebase ────────────────────────────────────────────────────────────────
import {
  collection, query, where, getDocs, addDoc, doc,
  updateDoc, serverTimestamp, orderBy, limit, onSnapshot, setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ═════════════════════════════════════════════════════════════════════════════
// PALETTE — #98bad5 light steel-blue background
// ═════════════════════════════════════════════════════════════════════════════
const C = {
  navy:      '#0f1e35', navyMid:  '#1a2d4e', navyDeep: '#243554',
  gold:      '#c9a84c', goldLt:   '#e8c87a',
  green:     '#1a8a4a', greenLt:  '#25a85a',
  red:       '#c0392b', redLt:    '#e74c3c',
  orange:    '#c47d0e', orangeLt: '#e8960f',
  blue:      '#2563b0', blueLt:   '#3b7dd8',
  surface:   'rgba(255,255,255,0.50)',
  border:    'rgba(15,30,53,0.14)',
  text:      '#0f1e35',
  textSec:   'rgba(15,30,53,0.65)',
  textMuted: 'rgba(15,30,53,0.42)',
};

// ── Responsive hook — use anywhere ──────────────────────────────────────────
const useRwd = () => {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 600;
  return {
    width, height,
    isWide:   width >= 768,
    isMobile,
    isSmall:  width < 400,
    // 'column' on mobile, 'row' on wide — use for side-by-side field rows
    rowDir:   isMobile ? 'column' : 'row',
    // pass to a View child instead of `half` prop when in a row
    halfStyle: isMobile ? { width: '100%' } : { flex: 1 },
    col: (wide, mobile) => width >= 600 ? wide : mobile,
  };
};
const fmtCur  = v => '₱' + Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtDate = ts => { if (!ts) return '—'; const d = ts?.toDate?.() || new Date(ts); return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); };
const fmtTime = ts => { if (!ts) return '—'; const d = ts?.toDate?.() || new Date(ts); return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); };
const mkInit  = name => (name || '?').split(/[\s,]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// Photo-aware avatar — shows profile picture if set, else initials circle
const MemberAvatar = ({ member, size = 52, style }) => {
  const r = size / 2;
  if (member?.photoURL) {
    return <Image source={{ uri: member.photoURL }} style={[{ width: size, height: size, borderRadius: r, borderWidth: 2, borderColor: C.gold }, style]} />;
  }
  return (
    <View style={[{ width: size, height: size, borderRadius: r, backgroundColor: 'rgba(201,168,76,0.25)', borderWidth: 2, borderColor: C.gold, justifyContent: 'center', alignItems: 'center' }, style]}>
      <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: size * 0.34, color: C.gold }}>{mkInit(member?.name)}</Text>
    </View>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// FIRESTORE HELPERS
// ═════════════════════════════════════════════════════════════════════════════
const hashPw = pw => { let h = 0; for (let i = 0; i < pw.length; i++) { h = (h << 5) - h + pw.charCodeAt(i); h |= 0; } return 'h_' + Math.abs(h).toString(36) + pw.length; };

const generateNextUserId = async () => {
  const year = new Date().getFullYear();
  const prefix = `CESLA-${year}-`;
  const snap = await getDocs(query(collection(db, 'members'), where('userId', '>=', prefix), where('userId', '<', `CESLA-${year + 1}-`), orderBy('userId', 'desc'), limit(1)));
  if (snap.empty) return `${prefix}00001`;
  return `${prefix}${String(parseInt(snap.docs[0].data().userId.replace(prefix, ''), 10) + 1).padStart(5, '0')}`;
};

const registerMemberFS = async ({ lastName, firstName, middleName, password }) => {
  const userId = await generateNextUserId();
  const mid  = middleName?.trim() ? ' ' + middleName.trim()[0].toUpperCase() + '.' : '';
  const name = `${lastName.trim()}, ${firstName.trim()}${mid}`;
  const ref  = await addDoc(collection(db, 'members'), {
    userId, name, lastName: lastName.trim(), firstName: firstName.trim(), middleName: middleName?.trim() || '',
    passwordHash: hashPw(password), role: 'member', status: 'Pending',
    shares: 0, savings: 0, loan: 0, loanBalance: 0, creditBalance: 0,
    contact: '', email: '', address: '', appForm: {},
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    approvedAt: null, lastLogin: null, overdue: false, daysOverdue: 0,
  });
  await addDoc(collection(db, 'adminNotifications'), {
    type: 'registration', icon: '🆕', title: 'New Member Registration',
    message: `${name} (${userId}) registered and is awaiting approval.`,
    memberId: ref.id, memberUserId: userId, createdAt: serverTimestamp(), read: false,
  });
  return { uid: ref.id, userId, name };
};

const loginByUserIdFS = async (userId, password) => {
  const snap = await getDocs(query(collection(db, 'members'), where('userId', '==', userId.trim())));
  if (snap.empty) throw new Error('User ID not found. Please check your ID.');
  const d = snap.docs[0];
  const m = { uid: d.id, ...d.data() };
  if (hashPw(password) !== m.passwordHash) throw new Error('Incorrect password. Please try again.');
  if (m.status === 'Pending')  throw new Error('Your account is pending admin approval. Please wait.');
  if (m.status === 'Rejected') throw new Error('Your registration was rejected. Please contact admin.');
  if (m.status === 'Inactive') throw new Error('Your account is inactive. Please contact admin.');
  await updateDoc(doc(db, 'members', d.id), { lastLogin: serverTimestamp() });
  const { passwordHash, ...safe } = m;
  return safe;
};

// ═════════════════════════════════════════════════════════════════════════════
// SHARED UI
// ═════════════════════════════════════════════════════════════════════════════
const AppBg = () => (
  <>
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
    <LinearGradient colors={['rgba(198,220,235,0.85)', 'rgba(152,186,213,0.40)', 'rgba(80,110,150,0.0)']} locations={[0, 0.45, 1]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />
    <LinearGradient colors={['rgba(50,80,120,0.45)', 'rgba(50,80,120,0.0)', 'rgba(50,80,120,0.45)']} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
    <LinearGradient colors={['rgba(50,80,120,0.0)', 'rgba(60,90,130,0.35)']} locations={[0.4, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />
  </>
);

const Spinner = ({ msg = 'Loading...' }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
    <ActivityIndicator size="large" color={C.gold} />
    <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec }}>{msg}</Text>
  </View>
);

const GCard = ({ style, children }) => (
  <View style={[{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.78)', padding: 14, marginBottom: 12, shadowColor: '#1a2d4e', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }, style]}>
    {children}
  </View>
);

// Field for auth screens
const Field = ({ label, value, onChangeText, placeholder, secureEntry, showToggle, onToggle, error, autoCapitalize, keyboardType }) => (
  <View style={s.fieldGroup}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.fieldRow, error && s.fieldRowErr]}>
      <TextInput style={[s.fieldInput, { flex: 1 }]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(15,30,53,0.35)" secureTextEntry={!!secureEntry} autoCapitalize={autoCapitalize || 'none'} autoCorrect={false} keyboardType={keyboardType || 'default'} />
      {showToggle && <TouchableOpacity onPress={onToggle} style={{ padding: 6 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><MaterialIcons name={!secureEntry ? 'visibility-off' : 'visibility'} size={20} color="rgba(15,30,53,0.40)" /></TouchableOpacity>}
    </View>
    {error ? <Text style={s.fieldErr}>{error}</Text> : null}
  </View>
);

const FieldReg = ({ label, value, onChangeText, placeholder, secureEntry, showToggle, onToggle, error, autoCapitalize }) => (
  <View style={[s.fieldGroup, { flex: 1, minWidth: 0 }]}>
    <Text style={s.fieldLabel} numberOfLines={1}>{label}</Text>
    <View style={[s.fieldRow, error && s.fieldRowErr]}>
      <TextInput style={[s.fieldInput, { flex: 1, minWidth: 0 }]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(15,30,53,0.35)" secureTextEntry={!!secureEntry} autoCapitalize={autoCapitalize || 'none'} autoCorrect={false} />
      {showToggle && <TouchableOpacity onPress={onToggle} style={{ padding: 3 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><MaterialIcons name={secureEntry ? 'visibility' : 'visibility-off'} size={16} color="rgba(15,30,53,0.40)" /></TouchableOpacity>}
    </View>
    {error ? <Text style={s.fieldErr}>{error}</Text> : null}
  </View>
);

// Field for dashboard forms
const DField = ({ label, value, onChangeText, placeholder, secureEntry, showToggle, onToggle, editable = true, keyboardType }) => (
  <View style={{ marginBottom: 11 }}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.fieldRow, !editable && { opacity: 0.55 }]}>
      <TextInput style={[s.fieldInput, { flex: 1 }]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.textMuted} secureTextEntry={!!secureEntry} editable={editable} keyboardType={keyboardType || 'default'} autoCapitalize="none" autoCorrect={false} />
      {showToggle && <TouchableOpacity onPress={onToggle} style={{ padding: 8 }}><Text style={{ fontSize: 16 }}>{secureEntry ? '👁' : '🙈'}</Text></TouchableOpacity>}
    </View>
  </View>
);

const SaveBtn = ({ onPress, loading, done, label, doneLabel }) => (
  <TouchableOpacity style={[s.saveBtn, done && { backgroundColor: C.green }]} onPress={onPress} disabled={loading} activeOpacity={0.85}>
    {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>{done ? `✓ ${doneLabel || 'Saved!'}` : label}</Text>}
  </TouchableOpacity>
);

// ═════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═════════════════════════════════════════════════════════════════════════════
const NAV = [
  { key: 'overview',     label: 'Overview',         icon: '⊞', single: true },
  { key: 'acct_grp',     label: 'My Account',       icon: '👤', children: [
    { key: 'profile',    label: 'My Profile',       icon: '👤' },
    { key: 'appform',    label: 'Application Form', icon: '📋' },
  ]},
  { key: 'fin_grp',      label: 'Savings & Shares', icon: '💰', children: [
    { key: 'savings',    label: 'Savings',          icon: '💰' },
    { key: 'sharecap',   label: 'Share Capital',    icon: '📊' },
    { key: 'timedeposit',label: 'Time Deposit',     icon: '🏦' },
  ]},
  { key: 'loans_grp',    label: 'Loans',            icon: '💳', children: [
    { key: 'applyloan',  label: 'Apply for Loan',   icon: '📝' },
    { key: 'myloans',    label: 'My Loans',         icon: '💳' },
    { key: 'guidelines', label: 'Guidelines',       icon: '📖' },
  ]},
  { key: 'settings_grp', label: 'Settings',         icon: '⚙️', children: [
    { key: 'editprofile',label: 'Edit Profile',     icon: '✏️' },
    { key: 'changepw',   label: 'Change Password',  icon: '🔑' },
    { key: 'notifs',     label: 'Notifications',    icon: '🔔' },
  ]},
  { key: 'help_grp',     label: 'Help & Support',   icon: '💬', children: [
    { key: 'chat_admin', label: 'Chat with Admin',  icon: '🛡️' },
    { key: 'chat_members', label: 'Co-member Chat', icon: '👥' },
  ]},
];

const SidebarGroup = ({ group, active, onNav, onClose }) => {
  const isActive = group.single ? active === group.key : !!(group.children?.find(c => c.key === active));
  const [open, setOpen] = useState(isActive && !group.single);
  const anim    = useRef(new Animated.Value(isActive && !group.single ? 1 : 0)).current;
  const toggle  = () => { if (group.single) { onNav(group.key); onClose?.(); return; } const next = !open; setOpen(next); Animated.timing(anim, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: false }).start(); };
  const maxH    = anim.interpolate({ inputRange: [0, 1], outputRange: [0, (group.children?.length || 0) * 42] });
  const chevRot = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  return (
    <View style={{ marginHorizontal: 6, marginBottom: 1 }}>
      <TouchableOpacity style={[s.sideHead, group.single && active === group.key && s.sideActive]} onPress={toggle} activeOpacity={0.8}>
        <Text style={[s.sideIcon, group.single && active === group.key && { color: C.navy }]}>{group.icon}</Text>
        <Text style={[s.sideLabel, group.single && active === group.key && { color: C.navy, fontFamily: 'GoogleSans_700Bold' }, !group.single && isActive && { color: C.gold }]}>{group.label}</Text>
        {!group.single && <Animated.Text style={[{ color: 'rgba(255,255,255,0.40)', fontSize: 17 }, { transform: [{ rotate: chevRot }] }]}>›</Animated.Text>}
      </TouchableOpacity>
      {!group.single && (
        <Animated.View style={{ maxHeight: maxH, overflow: 'hidden' }}>
          {group.children.map(c => (
            <TouchableOpacity key={c.key} style={[s.sideChild, active === c.key && s.sideChildActive]} onPress={() => { onNav(c.key); onClose?.(); }} activeOpacity={0.8}>
              <Text style={{ fontSize: 7, color: active === c.key ? C.gold : 'rgba(255,255,255,0.30)', width: 12, textAlign: 'center' }}>{active === c.key ? '◆' : '◇'}</Text>
              <Text style={[s.sideChildTxt, active === c.key && { color: C.gold, fontFamily: 'GoogleSans_700Bold' }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

const MemberSidebar = ({ active, onNav, onClose, unread, onLogout, onBack, canGoBack }) => (
  <View style={s.sidebar}>
    <View style={s.sidebarBrand}>
      <View style={s.sidebarLogo}><Text style={s.sidebarLogoTxt}>CS</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.sidebarName}>CESLA MPC</Text>
        <Text style={s.sidebarRole}>Member Portal</Text>
      </View>
      {onClose && (
        <TouchableOpacity onPress={onClose}
          style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 14, lineHeight: 18 }}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 14, marginBottom: 6 }} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }} style={{ flex: 1 }}>
      {NAV.map(g => <SidebarGroup key={g.key} group={g} active={active} onNav={onNav} onClose={onClose} />)}
    </ScrollView>
    {/* Notif badge */}
    {unread > 0 && (
      <TouchableOpacity style={s.sideNotifBadge} onPress={() => { onNav('notifs'); onClose?.(); }}>
        <Text style={s.sideNotifTxt}>🔔 {unread} unread notification{unread !== 1 ? 's' : ''}</Text>
      </TouchableOpacity>
    )}
    {/* Logout button at bottom of sidebar */}
    {onLogout && (
      <TouchableOpacity
        onPress={onLogout}
        style={{ margin: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, backgroundColor: 'rgba(201,168,76,0.18)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.40)' }}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 14 }}>↩</Text>
        <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#e8c87a' }}>Logout</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEWS
// ═════════════════════════════════════════════════════════════════════════════

const TIPS = [
  { icon: '💡', title: 'Quick Tips', bullets: ['Fill your Application Form to complete membership.', 'Monitor savings and shares regularly.', 'Check guidelines before applying for a loan.'], colors: ['#1a3a6b', '#304674'] },
  { icon: '💰', title: 'Savings', bullets: ['Regular savings strengthen your standing.', 'Maintain your minimum monthly savings.', 'Contact admin for inquiries.'], colors: ['#1a6b3a', '#1a8a4a'] },
  { icon: '💳', title: 'Loan Tips', bullets: ['Loan amount is based on your share capital.', 'Timely payments maintain good standing.', 'Late payments may incur penalties.'], colors: ['#6b1a1a', '#c0392b'] },
  { icon: '📋', title: 'App Form', bullets: ['Complete all fields accurately.', 'Submit supporting documents if needed.', 'Wait for admin processing.'], colors: ['#6b440a', '#c47d0e'] },
];

const TipsCarousel = () => {
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => { setIdx(i => (i + 1) % TIPS.length); Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start(); });
    }, 4500);
    return () => clearInterval(t);
  }, []);
  const tip = TIPS[idx];
  return (
    <View style={{ padding: 14 }}>
      <Animated.View style={{ opacity: fade }}>
        <LinearGradient colors={tip.colors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ borderRadius: 18, padding: 22, alignItems: 'center', minHeight: 170, justifyContent: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>{tip.icon}</Text>
          <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: '#fff', marginBottom: 12, textAlign: 'center' }}>{tip.title}</Text>
          {tip.bullets.map((b, i) => (<View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 5, alignSelf: 'flex-start' }}><Text style={{ color: 'rgba(255,255,255,0.70)', fontSize: 14, lineHeight: 20 }}>•</Text><Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.92)', lineHeight: 20, flex: 1 }}>{b}</Text></View>))}
        </LinearGradient>
      </Animated.View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 12 }}>
        {TIPS.map((_, i) => <TouchableOpacity key={i} onPress={() => setIdx(i)} style={{ width: i === idx ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === idx ? C.gold : 'rgba(15,30,53,0.22)' }} />)}
      </View>
    </View>
  );
};

const OverviewView = ({ member, onNav, contentHeight, isMobile }) => {
  const lp = member.loan > 0 ? (member.loan - (member.loanBalance || 0)) / member.loan : 0;
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={true} style={contentHeight ? { height: contentHeight } : undefined}>
      {/* Welcome */}
      <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 14, shadowColor: '#1a2d4e', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }}>
        <LinearGradient colors={['#1a2d4e', '#243554']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: isMobile ? 14 : 18 }}>
          <MemberAvatar member={member} size={52} style={{ flexShrink: 0 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Welcome back,</Text>
            <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: isMobile ? 14 : 16, color: '#fff', lineHeight: 22 }} numberOfLines={2}>{member.name}</Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.50)', marginTop: 2 }}>{member.userId}</Text>
          </View>
          <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(26,138,74,0.35)', borderWidth: 1, borderColor: 'rgba(26,138,74,0.60)' }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#4cde8a' }}>{member.status || 'Active'}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Financial tiles — 2x2 on mobile, 4 in a row on wide */}
      <Text style={s.sHead}>💰 FINANCIAL SUMMARY</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { l: 'Savings',       v: fmtCur(member.savings),      c: C.green },
          { l: 'Share Capital', v: fmtCur(member.shares),       c: C.gold },
          { l: 'Total Assets',  v: fmtCur((member.savings || 0) + (member.shares || 0)), c: C.blueLt },
          { l: 'Loan Balance',  v: fmtCur(member.loanBalance),  c: member.loanBalance > 0 ? C.red : C.green },
        ].map(t => (
          <GCard key={t.l} style={{ flexBasis: isMobile ? '47%' : '22%', flex: 1, padding: 12, marginBottom: 0, borderTopWidth: 3, borderTopColor: t.c }}>
            <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: isMobile ? 14 : 17, color: t.c, marginBottom: 3 }} numberOfLines={1} adjustsFontSizeToFit>{t.v}</Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textSec }}>{t.l}</Text>
          </GCard>
        ))}
      </View>

      {/* Loan progress */}
      {member.loan > 0 && (
        <>
          <Text style={s.sHead}>📈 LOAN REPAYMENT PROGRESS</Text>
          <GCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec }}>Repaid</Text>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.green }}>{Math.round(lp * 100)}%</Text>
            </View>
            <View style={{ height: 10, backgroundColor: 'rgba(15,30,53,0.12)', borderRadius: 5, overflow: 'hidden' }}>
              <View style={{ height: 10, backgroundColor: C.green, borderRadius: 5, width: `${Math.round(lp * 100)}%` }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 4 }}>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted }}>Paid: {fmtCur((member.loan || 0) - (member.loanBalance || 0))}</Text>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted }}>Remaining: {fmtCur(member.loanBalance)}</Text>
            </View>
          </GCard>
        </>
      )}

      {/* Tips */}
      <Text style={s.sHead}>💡 TIPS & REMINDERS</Text>
      <GCard style={{ padding: 0, overflow: 'hidden' }}><TipsCarousel /></GCard>
    </ScrollView>
  );
};

const ProfileView = ({ member, contentHeight }) => {
  const af = member.appForm || {};
  const fullName = [af.salutation, member.firstName, member.middleName ? member.middleName + ' ' : '', member.lastName, af.suffix].filter(Boolean).join(' ') || member.name || '—';
  const address  = af.presentAddress ? `${af.presentAddress}${af.presentZip ? ', ' + af.presentZip : ''}` : (member.address || '—');
  const contact  = af.contactNo || member.contact || '—';
  const email    = member.email || '—';

  const empLabel = af.empType === 'Employed'
    ? [af.positionRank, af.employerName].filter(Boolean).join(' @ ') || 'Employed'
    : af.empType === 'Self-Employed'
    ? [af.bizName, af.bizNature].filter(Boolean).join(' — ') || 'Self-Employed'
    : af.unemployedType || af.empType || '—';

  const InfoRow = ({ label, value, color }) => (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoVal, color && { color, fontFamily: 'GoogleSans_700Bold' }]}>{value || '—'}</Text>
    </View>
  );

  const SectionTitle = ({ title, mt }) => (
    <Text style={[s.secTitle, mt && { marginTop: mt }]}>{title}</Text>
  );

  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={true} style={contentHeight ? { height: contentHeight } : undefined}>
      <Text style={s.pageTitle}>My Profile</Text>

      {/* ── Header card ── */}
      <GCard style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
        <LinearGradient colors={['#1a2d4e', '#243554']} style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <MemberAvatar member={member} size={56} style={{ flexShrink: 0 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 18, color: '#fff' }} numberOfLines={2}>{fullName}</Text>
              <Text style={{ fontFamily: 'GoogleSans_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{member.userId}</Text>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 1 }}>Member since {fmtDate(member.approvedAt || member.createdAt)}</Text>
            </View>
            <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(26,138,74,0.35)', borderWidth: 1, borderColor: 'rgba(26,138,74,0.60)' }}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#4cde8a' }}>{member.status || 'Active'}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ padding: 14 }}>

          {/* ── Personal Information ── */}
          <SectionTitle title="👤  Personal Information" />
          <InfoRow label="Full Name"        value={fullName} />
          <InfoRow label="Gender"           value={af.gender} />
          <InfoRow label="Civil Status"     value={af.civilStatus} />
          <InfoRow label="Date of Birth"    value={af.dob} />
          <InfoRow label="Place of Birth"   value={af.placeOfBirth} />
          <InfoRow label="Nationality"      value={af.nationality === 'Others' ? af.nationalityOther : af.nationality} />
          <InfoRow label="Religion"         value={af.religion === 'Others' ? af.religionOther : af.religion} />
          <InfoRow label="No. of Dependents" value={af.numDependents} />
          <InfoRow label="Recommended By"  value={af.recommendedBy} />

          {/* ── Contact Details ── */}
          <SectionTitle title="📞  Contact Details" mt={14} />
          <InfoRow label="Contact No."     value={contact} />
          <InfoRow label="Email"           value={email} />
          <InfoRow label="Present Address" value={address} />
          {af.permanentAddress ? <InfoRow label="Permanent Address" value={`${af.permanentAddress}${af.permanentZip ? ', ' + af.permanentZip : ''}`} /> : null}

          {/* ── Government IDs ── */}
          <SectionTitle title="🪪  Government IDs" mt={14} />
          {(af.govIds && af.govIds.length > 0)
            ? af.govIds.filter(g => g.type || g.number).map((g, i) => (
                <InfoRow key={i} label={g.type || `ID #${i + 1}`} value={g.number} />
              ))
            : [['SSS / GSIS', af.sssGsis], ['TIN', af.tin], ['PhilHealth', af.philHealth], ['Pag-IBIG', af.pagIbig]]
                .map(([l, v]) => <InfoRow key={l} label={l} value={v} />)
          }

          {/* ── Employment ── */}
          <SectionTitle title="💼  Employment" mt={14} />
          <InfoRow label="Status"      value={af.empType} />
          {af.empType === 'Employed' && <>
            <InfoRow label="Employer"        value={af.employerName} />
            <InfoRow label="Office Address"  value={af.officeAddress} />
            <InfoRow label="Nature of Biz"   value={af.natureOfBiz} />
            <InfoRow label="Employment Type" value={af.employmentType === 'Others' ? af.employmentTypeOther : af.employmentType} />
            <InfoRow label="Position / Rank" value={af.positionRank} />
            <InfoRow label="Monthly Income"  value={af.monthlyIncome ? '₱' + Number(af.monthlyIncome).toLocaleString('en-PH') : undefined} color={C.green} />
          </>}
          {af.empType === 'Self-Employed' && <>
            <InfoRow label="Business Name"   value={af.bizName} />
            <InfoRow label="Business Type"   value={af.bizType} />
            <InfoRow label="Nature of Biz"   value={af.bizNature} />
            <InfoRow label="Asset Size"      value={af.assetSize ? '₱' + Number(af.assetSize).toLocaleString('en-PH') : undefined} />
            <InfoRow label="Share in Biz"    value={af.shareInBiz ? af.shareInBiz + '%' : undefined} />
            <InfoRow label="Monthly Income"  value={af.selfMonthlyIncome ? '₱' + Number(af.selfMonthlyIncome).toLocaleString('en-PH') : undefined} color={C.green} />
          </>}
          {af.empType === 'Unemployed' && <>
            <InfoRow label="Type" value={af.unemployedType === 'Others' ? af.unemployedOther : af.unemployedType} />
          </>}

          {/* ── Financial Overview ── */}
          <SectionTitle title="💰  Financial Overview" mt={14} />
          <InfoRow label="Share Capital"  value={fmtCur(member.shares)}       color={C.gold} />
          <InfoRow label="Savings"        value={fmtCur(member.savings)}      color={C.green} />
          <InfoRow label="Active Loan"    value={fmtCur(member.loan)}         color={member.loan > 0 ? C.orange : undefined} />
          <InfoRow label="Loan Balance"   value={fmtCur(member.loanBalance)}  color={member.loanBalance > 0 ? C.red : C.green} />
          <InfoRow label="Credit Balance" value={fmtCur(member.creditBalance)} color={C.orange} />

        </View>
      </GCard>
    </ScrollView>
  );
};

// ── Radio Button Row ────────────────────────────────────────────────────────
const RadioRow = ({ label: rowLabel, options, selected, onSelect }) => (
  <View style={{ marginBottom: 12 }}>
    {rowLabel ? <Text style={af.fieldLabel}>{rowLabel}</Text> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 }}>
      {options.map(opt => (
        <TouchableOpacity key={opt} onPress={() => onSelect(opt)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1.5, borderColor: selected === opt ? C.gold : 'rgba(15,30,53,0.18)', backgroundColor: selected === opt ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.55)' }}
          activeOpacity={0.7}>
          <View style={[af.radio, selected === opt && af.radioActive]}>
            {selected === opt && <View style={af.radioDot} />}
          </View>
          <Text style={[af.radioLabel, selected === opt && { color: C.navyMid, fontFamily: 'GoogleSans_700Bold' }]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

// ── Dropdown Picker ─────────────────────────────────────────────────────────
const DropdownPicker = ({ label: l, options, value, onSelect, placeholder, half }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={[{ marginBottom: 12 }, half && { flex: 1 }]}>
      <Text style={af.fieldLabel}>{l}</Text>
      <TouchableOpacity style={[af.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
        onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={{ fontFamily: value ? 'GoogleSans_400Regular' : 'GoogleSans_400Regular', fontSize: 13, color: value ? C.navy : C.textMuted, flex: 1 }}>{value || placeholder}</Text>
        <Text style={{ fontSize: 12, color: C.textMuted }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={af.dropdownList}>
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator>
            {options.map(opt => (
              <TouchableOpacity key={opt} style={[af.dropdownItem, value === opt && af.dropdownItemActive]}
                onPress={() => { onSelect(opt); setOpen(false); }} activeOpacity={0.8}>
                <Text style={[af.dropdownTxt, value === opt && { color: C.gold, fontFamily: 'GoogleSans_700Bold' }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

// ── Date Picker (compact) ───────────────────────────────────────────────────
const DatePicker = ({ label: l, value, onChange, half }) => {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const years  = Array.from({ length: 80 }, (_, i) => String(currentYear - i));
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const days   = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  const parts    = (value || '').split('/');
  const selMonth = parts[0] ? months[parseInt(parts[0]) - 1] || '' : '';
  const selDay   = parts[1] || '';
  const selYear  = parts[2] || '';

  const buildDate = (m, d, y) => `${String(months.indexOf(m) + 1).padStart(2, '0')}/${d}/${y}`;
  const displayVal = value ? `${selMonth} ${selDay}, ${selYear}` : '';

  const [tmpM, setTmpM] = useState(selMonth);
  const [tmpD, setTmpD] = useState(selDay);
  const [tmpY, setTmpY] = useState(selYear);

  const apply = () => {
    if (tmpM && tmpD && tmpY) { onChange(buildDate(tmpM, tmpD, tmpY)); setOpen(false); }
  };

  return (
    <View style={[{ marginBottom: 12 }, half && { flex: 1 }]}>
      <Text style={af.fieldLabel}>{l}</Text>
      <TouchableOpacity style={[af.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
        onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: displayVal ? C.navy : C.textMuted, flex: 1 }}>
          {displayVal || 'Select date'}
        </Text>
        <Text style={{ fontSize: 13 }}>📅</Text>
      </TouchableOpacity>
      {open && (
        <View style={{ borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(200,218,235,0.75)', backgroundColor: 'rgba(240,246,252,0.98)', padding: 12, marginTop: 4, marginBottom: 4 }}>
          {/* Month row */}
          <Text style={[af.fieldLabel, { fontSize: 8, marginBottom: 4 }]}>MONTH</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {months.map(m => (
              <TouchableOpacity key={m} onPress={() => setTmpM(m)}
                style={{ paddingHorizontal: 8, paddingVertical: 5, marginRight: 4, borderRadius: 6,
                  backgroundColor: tmpM === m ? C.gold : 'rgba(15,30,53,0.08)',
                  borderWidth: 1, borderColor: tmpM === m ? C.gold : 'transparent' }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: tmpM === m ? '#fff' : C.navy }}>{m.slice(0,3)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Day row */}
          <Text style={[af.fieldLabel, { fontSize: 8, marginBottom: 4 }]}>DAY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {days.map(d => (
              <TouchableOpacity key={d} onPress={() => setTmpD(d)}
                style={{ width: 28, height: 28, marginRight: 4, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: tmpD === d ? C.navyMid : 'rgba(15,30,53,0.08)',
                  borderWidth: 1, borderColor: tmpD === d ? C.navyMid : 'transparent' }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: tmpD === d ? '#fff' : C.navy }}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Year — compact 2-column scroll */}
          <Text style={[af.fieldLabel, { fontSize: 8, marginBottom: 4 }]}>YEAR</Text>
          <ScrollView style={{ maxHeight: 88, marginBottom: 8 }} showsVerticalScrollIndicator nestedScrollEnabled>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {years.map(y => (
                <TouchableOpacity key={y} onPress={() => setTmpY(y)}
                  style={{ width: 50, paddingVertical: 5, borderRadius: 6, alignItems: 'center',
                    backgroundColor: tmpY === y ? C.navyDeep : 'rgba(15,30,53,0.08)',
                    borderWidth: 1, borderColor: tmpY === y ? C.navyDeep : 'transparent' }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: tmpY === y ? '#fff' : C.navy }}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(15,30,53,0.20)', alignItems: 'center' }} onPress={() => setOpen(false)}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textSec }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 8, borderRadius: 8, backgroundColor: C.navyMid, alignItems: 'center' }} onPress={apply}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.gold }}>✓ Apply Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ── Text Field ──────────────────────────────────────────────────────────────
const AF = ({ label: l, value, onChangeText, placeholder, keyboardType, half, editable = true, multiline }) => (
  <View style={[{ marginBottom: 12 }, half && { flex: 1 }]}>
    <Text style={af.fieldLabel}>{l}</Text>
    <TextInput
      style={[af.input, !editable && { opacity: 0.55, backgroundColor: 'rgba(15,30,53,0.06)' }, multiline && { minHeight: 60, textAlignVertical: 'top', paddingTop: 9 }]}
      value={value} onChangeText={onChangeText}
      placeholder={placeholder} placeholderTextColor={C.textMuted}
      keyboardType={keyboardType || 'default'} autoCorrect={false}
      editable={editable} multiline={multiline}
    />
  </View>
);

const RELIGIONS = ['Roman Catholic','Islam','Iglesia ni Cristo','Seventh-day Adventist','Born Again Christian','Baptist','Methodist','Jehovah\'s Witness','Buddhism','Others'];
const PROVINCES_PH = [
  'Abra','Agusan del Norte','Agusan del Sur','Aklan','Albay','Antique','Apayao','Aurora',
  'Basilan','Bataan','Batanes','Batangas','Benguet','Biliran','Bohol','Bukidnon','Bulacan',
  'Cagayan','Camarines Norte','Camarines Sur','Camiguin','Capiz','Catanduanes','Cavite','Cebu',
  'Compostela Valley (Davao de Oro)','Cotabato (North Cotabato)','Davao de Oro','Davao del Norte',
  'Davao del Sur','Davao Occidental','Davao Oriental','Dinagat Islands','Eastern Samar',
  'Guimaras','Ifugao','Ilocos Norte','Ilocos Sur','Iloilo','Isabela','Kalinga','La Union',
  'Laguna','Lanao del Norte','Lanao del Sur','Leyte','Maguindanao','Marinduque','Masbate',
  'Metro Manila (NCR)','Misamis Occidental','Misamis Oriental','Mountain Province','Negros Occidental',
  'Negros Oriental','Northern Samar','Nueva Ecija','Nueva Vizcaya','Occidental Mindoro',
  'Oriental Mindoro','Palawan','Pampanga','Pangasinan','Quezon','Quirino','Rizal','Romblon',
  'Samar (Western Samar)','Sarangani','Siquijor','Sorsogon','South Cotabato','Southern Leyte',
  'Sultan Kudarat','Sulu','Surigao del Norte','Surigao del Sur','Tarlac','Tawi-Tawi',
  'Zambales','Zamboanga del Norte','Zamboanga del Sur','Zamboanga Sibugay','Others',
];

const MUNICIPALITIES_BY_PROVINCE = {
  'Misamis Oriental': ['Alubijid','Balingasag','Balingoan','Binuangan','Cagayan de Oro City','Claveria','El Salvador','Gingoog City','Gitagum','Initao','Jasaan','Kinoguitan','Lagonglong','Laguindingan','Libertad','Lugait','Magsaysay','Manticao','Medina','Naawan','Opol','Salay','Sugbongcogon','Tagoloan','Talisayan','Villanueva','Others'],
  'Davao del Sur': ['Bansalan','Davao City','Digos City','Don Marcelino','Hagonoy','Jose Abad Santos','Kiblawan','Magsaysay','Malalag','Malita','Matanao','Padada','Santa Cruz','Sulop','Others'],
  'Davao del Norte': ['Asuncion','Braulio E. Dujali','Carmen','Island Garden City of Samal','Kapalong','Monkayo','New Corella','Panabo City','San Isidro','Santo Tomas','Tagum City','Talaingod','Others'],
  'Bukidnon': ['Baungon','Cabanglasan','Damulog','Dangcagan','Don Carlos','Impasug-ong','Kadingilan','Kalilangan','Kibawe','Kitaotao','Lantapan','Libona','Malaybalay City','Malitbog','Manolo Fortich','Maramag','Pangantucan','Quezon','San Fernando','Sumilao','Talakag','Valencia City','Others'],
  'Lanao del Norte': ['Bacolod','Baloi','Baroy','Iligan City','Kapatagan','Kauswagan','Kolambugan','Lala','Linamon','Maigo','Matungao','Munai','Nunungan','Pantao Ragat','Pantar','Poona Piagapo','Salvador','Sapad','Sultan Naga Dimaporo','Tagoloan II','Tangcal','Tubod','Others'],
  'Metro Manila (NCR)': ['Caloocan','Las Piñas','Makati','Malabon','Mandaluyong','Manila','Marikina','Muntinlupa','Navotas','Parañaque','Pasay','Pasig','Pateros','Quezon City','San Juan','Taguig','Valenzuela','Others'],
  'Cebu': ['Alcantara','Alcoy','Alegria','Aloguinsan','Argao','Asturias','Badian','Balamban','Bantayan','Barili','Bogo City','Boljoon','Borbon','Carcar City','Carmen','Catmon','Cebu City','Compostela','Consolacion','Cordova','Daanbantayan','Dalaguete','Danao City','Dumanjug','Ginatilan','Lapu-Lapu City','Liloan','Madridejos','Malabuyoc','Mandaue City','Medellin','Minglanilla','Moalboal','Naga City','Oslob','Pilar','Pinamungahan','Poro','Ronda','Samboan','San Fernando','San Francisco','San Remigio','Santa Fe','Santander','Sibonga','Sogod','Tabogon','Tabuelan','Talisay City','Toledo City','Tuburan','Tudela','Others'],
  'Others': ['Others'],
};

// Barangay suggestions per municipality (common ones — expand as needed)
const BARANGAYS_BY_CITY = {
  'Cagayan de Oro City': ['Agusan','Balubal','Balulang','Barangay 1','Barangay 2','Barangay 3','Barangay 4','Barangay 5','Barangay 6','Barangay 7','Barangay 8','Barangay 9','Barangay 10','Barangay 11','Barangay 12','Barangay 13','Barangay 14','Barangay 15','Barangay 16','Barangay 17','Barangay 18','Barangay 19','Barangay 20','Barangay 21','Barangay 22','Barangay 23','Barangay 24','Barangay 25','Baikingon','Bayabas','Bayanga','Besigan','Bonbon','Bugo','Bulua','Canitoan','Carmen','Consolacion','Cugman','Dansolihon','Del Monte','Dologon','Dungguan','Gusa','Indahag','Iponan','Kauswagan','Lapasan','Lawis','Layawan','Lumbia','Macabalan','Macasandig','Mambuaya','Mamugtan','Maraymaray','Maybolo','Nazareth','Pagalungan','Pagatpat','Patpat','Pigsag-an','Puerto','Puntod','Rodero','Rosal','Sto. Niño','Tablon','Taglimao','Tagpangi','Tignapoloan','Tumpagon','Tuburan','Upper Carmen','Upper Hilltop','Upper Lumbia','Velez','Others'],
  'Tagum City': ['Apokon','Bincungan','Busaon','Canocotan','Cuambogan','La Filipina','Liboganon','Madaum','Magdum','Magugpo East','Magugpo North','Magugpo Poblacion','Magugpo South','Magugpo West','Mankilam','New Balamban','New Visayas','Pagsabangan','Pandapan','San Agustin','San Isidro','San Miguel','Visayan Village','Others'],
  'Iligan City': ['Abuno','Acmac','Bagong Silang','Buru-un','Dalipuga','Del Carmen','Digkilaan','Ditucalan','Dulag','Hunyon','Hinaplanon','Hindang','Kabacsanan','Kalilangan','Kiwalan','Lanipao','Luinab','Mahayahay','Mainit','Mandulog','Maria Cristina','Palao','Panorugon','Puga-an','Rogongon','San Miguel','San Roque','Santiago','Santo Rosario','Saray','Suarez','Tambacan','Tibanga','Tipanoy','Tominobo Lower','Tominobo Upper','Tubod','Ubaldo Laya','Upper Hinaplanon','Upper Tominobo','Villa Verde','Others'],
};

// Address search component with separate Barangay/Municipality/Province
const AddressPicker = ({ label, barangay, municipality, province, houseStreet, zip, onChangeBgy, onChangeMun, onChangeProv, onChangeHouseStreet, onChangeZip }) => {
  const [showProvDrop, setShowProvDrop] = useState(false);
  const [showMunDrop,  setShowMunDrop]  = useState(false);
  const [showBgyDrop,  setShowBgyDrop]  = useState(false);
  const [provSearch,   setProvSearch]   = useState('');
  const [munSearch,    setMunSearch]    = useState('');
  const [bgySearch,    setBgySearch]    = useState('');

  const munList  = (municipality && MUNICIPALITIES_BY_PROVINCE[province]) ? MUNICIPALITIES_BY_PROVINCE[province] : (MUNICIPALITIES_BY_PROVINCE[province] || []);
  const bgyList  = BARANGAYS_BY_CITY[municipality] || [];

  const filteredProv = PROVINCES_PH.filter(p => p.toLowerCase().includes(provSearch.toLowerCase()));
  const filteredMun  = munList.filter(m => m.toLowerCase().includes(munSearch.toLowerCase()));
  const filteredBgy  = bgyList.filter(b => b.toLowerCase().includes(bgySearch.toLowerCase()));

  return (
    <View style={{ marginBottom: 12 }}>
      {label && <Text style={af.fieldLabel}>{label}</Text>}
      {/* House No. / Street */}
      <Text style={[af.fieldLabel, { marginBottom: 4 }]}>HOUSE NO. / STREET</Text>
      <TextInput style={[af.input, { marginBottom: 8 }]} value={houseStreet} onChangeText={onChangeHouseStreet} placeholder="e.g. 123 Rizal Street" placeholderTextColor={C.textMuted} autoCorrect={false} />

      {/* Province */}
      <Text style={[af.fieldLabel, { marginBottom: 4 }]}>PROVINCE / REGION</Text>
      <TouchableOpacity style={[af.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }]} onPress={() => { setShowProvDrop(o => !o); setShowMunDrop(false); setShowBgyDrop(false); }} activeOpacity={0.8}>
        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: province ? C.navy : C.textMuted, flex: 1 }}>{province || 'Select province'}</Text>
        <Text style={{ fontSize: 11, color: C.textMuted }}>{showProvDrop ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {showProvDrop && (
        <View style={[af.dropdownList, { marginBottom: 8, maxHeight: 220 }]}>
          <TextInput style={[af.input, { marginBottom: 6, fontSize: 12 }]} value={provSearch} onChangeText={setProvSearch} placeholder="Search province..." placeholderTextColor={C.textMuted} autoCorrect={false} />
          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled showsVerticalScrollIndicator>
            {filteredProv.map(opt => (
              <TouchableOpacity key={opt} style={[af.dropdownItem, province === opt && af.dropdownItemActive]} onPress={() => { onChangeProv(opt); onChangeMun(''); onChangeBgy(''); setShowProvDrop(false); setProvSearch(''); }} activeOpacity={0.8}>
                <Text style={[af.dropdownTxt, province === opt && { color: C.gold, fontFamily: 'GoogleSans_700Bold' }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Municipality / City */}
      <Text style={[af.fieldLabel, { marginBottom: 4 }]}>CITY / MUNICIPALITY</Text>
      <TouchableOpacity style={[af.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }]} onPress={() => { setShowMunDrop(o => !o); setShowProvDrop(false); setShowBgyDrop(false); }} activeOpacity={0.8}>
        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: municipality ? C.navy : C.textMuted, flex: 1 }}>{municipality || 'Select city / municipality'}</Text>
        <Text style={{ fontSize: 11, color: C.textMuted }}>{showMunDrop ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {showMunDrop && (
        <View style={[af.dropdownList, { marginBottom: 8, maxHeight: 220 }]}>
          <TextInput style={[af.input, { marginBottom: 6, fontSize: 12 }]} value={munSearch} onChangeText={setMunSearch} placeholder="Search city/municipality..." placeholderTextColor={C.textMuted} autoCorrect={false} />
          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled showsVerticalScrollIndicator>
            {(filteredMun.length > 0 ? filteredMun : ['Others']).map(opt => (
              <TouchableOpacity key={opt} style={[af.dropdownItem, municipality === opt && af.dropdownItemActive]} onPress={() => { onChangeMun(opt); onChangeBgy(''); setShowMunDrop(false); setMunSearch(''); }} activeOpacity={0.8}>
                <Text style={[af.dropdownTxt, municipality === opt && { color: C.gold, fontFamily: 'GoogleSans_700Bold' }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={af.dropdownItem} onPress={() => { setShowMunDrop(false); }}>
              <TextInput style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.navy, padding: 0 }} value={munSearch} onChangeText={v => { setMunSearch(v); onChangeMun(v); }} placeholder="Type manually..." placeholderTextColor={C.textMuted} autoCorrect={false} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Barangay */}
      <Text style={[af.fieldLabel, { marginBottom: 4 }]}>BARANGAY</Text>
      {bgyList.length > 0 ? (
        <>
          <TouchableOpacity style={[af.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }]} onPress={() => { setShowBgyDrop(o => !o); setShowProvDrop(false); setShowMunDrop(false); }} activeOpacity={0.8}>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: barangay ? C.navy : C.textMuted, flex: 1 }}>{barangay || 'Select barangay'}</Text>
            <Text style={{ fontSize: 11, color: C.textMuted }}>{showBgyDrop ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showBgyDrop && (
            <View style={[af.dropdownList, { marginBottom: 8, maxHeight: 220 }]}>
              <TextInput style={[af.input, { marginBottom: 6, fontSize: 12 }]} value={bgySearch} onChangeText={setBgySearch} placeholder="Search barangay..." placeholderTextColor={C.textMuted} autoCorrect={false} />
              <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled showsVerticalScrollIndicator>
                {filteredBgy.map(opt => (
                  <TouchableOpacity key={opt} style={[af.dropdownItem, barangay === opt && af.dropdownItemActive]} onPress={() => { onChangeBgy(opt); setShowBgyDrop(false); setBgySearch(''); }} activeOpacity={0.8}>
                    <Text style={[af.dropdownTxt, barangay === opt && { color: C.gold, fontFamily: 'GoogleSans_700Bold' }]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      ) : (
        <TextInput style={[af.input, { marginBottom: 8 }]} value={barangay} onChangeText={onChangeBgy} placeholder="e.g. Brgy. Poblacion" placeholderTextColor={C.textMuted} autoCorrect={false} />
      )}

      {/* ZIP */}
      <Text style={[af.fieldLabel, { marginBottom: 4 }]}>ZIP CODE</Text>
      <TextInput style={af.input} value={zip} onChangeText={onChangeZip} placeholder="e.g. 9000" placeholderTextColor={C.textMuted} keyboardType="numeric" autoCorrect={false} />
    </View>
  );
};

const GOV_ID_TYPES = [
  'SSS', 'GSIS', 'TIN', 'PhilHealth', 'Pag-IBIG (HDMF)',
  'Philippine Passport', 'Driver\'s License', 'Voter\'s ID',
  'PRC ID', 'Postal ID', 'Senior Citizen ID', 'PWD ID',
  'UMID', 'National ID (PhilSys)', 'OFW ID', 'Others',
];

// ── Gov ID Picker — dropdown type + number input ────────────────────────────
const GovIdPicker = ({ label: l, idType, idNumber, onTypeChange, onNumberChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      {l ? <Text style={af.fieldLabel}>{l}</Text> : null}
      <TouchableOpacity
        style={[af.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }]}
        onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: idType ? C.navy : C.textMuted, flex: 1 }}>
          {idType || 'Select ID type'}
        </Text>
        <Text style={{ fontSize: 11, color: C.textMuted }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={[af.dropdownList, { marginBottom: 5 }]}>
          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled showsVerticalScrollIndicator>
            {GOV_ID_TYPES.map(opt => (
              <TouchableOpacity key={opt} style={[af.dropdownItem, idType === opt && af.dropdownItemActive]}
                onPress={() => { onTypeChange(opt); setOpen(false); }} activeOpacity={0.8}>
                <Text style={[af.dropdownTxt, idType === opt && { color: C.gold, fontFamily: 'GoogleSans_700Bold' }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {/* ID Number input */}
      <TextInput
        style={[af.input, { fontSize: 12 }]}
        value={idNumber} onChangeText={onNumberChange}
        placeholder={placeholder || 'Enter ID number'}
        placeholderTextColor={C.textMuted}
        autoCorrect={false} autoCapitalize="characters"
      />
    </View>
  );
};

// ─── Application Form HTML Generator (for Print/PDF) ─────────────────────────
const generateAppFormHTML = (member, form) => {
  const f = form;
  const govIds = (f.govIds || []).filter(g => g.type || g.number);
  const fullName = [member.lastName, member.firstName, member.middleName].filter(Boolean).join(', ');
  const presentAddr = [f.presentHouseStreet, f.presentBarangay, f.presentMunicipality, f.presentProvince].filter(Boolean).join(', ') || f.presentAddress || '';
  const permanentAddr = [f.permanentHouseStreet, f.permanentBarangay, f.permanentMunicipality, f.permanentProvince].filter(Boolean).join(', ') || f.permanentAddress || '';
  const religion = f.religion === 'Others' ? f.religionOther : f.religion;
  const nationality = f.nationality === 'Others' ? f.nationalityOther : f.nationality;
  const sssGsis = govIds.find(g => g.type === 'SSS' || g.type === 'GSIS');
  const tin     = govIds.find(g => g.type === 'TIN');
  const otherIds = govIds.filter(g => g.type !== 'SSS' && g.type !== 'GSIS' && g.type !== 'TIN');

  const line = (val, minW = '180px') => `<span style="display:inline-block;min-width:${minW};border-bottom:1px solid #333;padding:1px 4px;font-size:11px;">${val || ''}</span>`;
  const radio = (checked) => `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;border:1.5px solid #333;text-align:center;line-height:10px;font-size:8px;vertical-align:middle;margin-right:2px;">${checked ? '●' : ''}</span>`;
  const cell = (val, style='') => `<td style="border:1px solid #555;padding:4px 6px;font-size:10px;${style}">${val || '&nbsp;'}</td>`;
  const hdr  = (val, style='') => `<th style="border:1px solid #555;padding:4px 6px;font-size:10px;font-weight:bold;text-align:center;background:#f0f0f0;${style}">${val}</th>`;

  const today = new Date().toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>CESLA MPC Application Form</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size:11px; color:#111; }
  .page { width:210mm; min-height:277mm; padding:12mm 16mm 10mm; page-break-after:always; }
  .page:last-child { page-break-after:auto; }
  .header { display:flex; align-items:flex-start; gap:14px; margin-bottom:8px; }
  .header img { width:70px; height:70px; object-fit:contain; }
  .header-text { flex:1; }
  .header-text h1 { font-size:17px; font-weight:bold; margin-bottom:2px; }
  .header-text p { font-size:10px; color:#444; line-height:1.5; }
  .photo-box { width:65px; height:80px; border:1.5px solid #333; display:flex; align-items:center; justify-content:center; font-size:9px; color:#666; text-align:center; flex-shrink:0; }
  .form-title { text-align:center; font-size:13px; font-weight:bold; letter-spacing:2px; margin:8px 0 10px; text-transform:uppercase; }
  .outer { border:1.5px solid #444; }
  .rb { border-bottom:1px solid #555; padding:5px 8px; font-size:11px; line-height:1.9; }
  .rb:last-child { border-bottom:none; }
  .sec { background:#1a2d4e; color:#fff; text-align:center; font-size:10px; font-weight:bold; letter-spacing:1.5px; padding:4px 8px; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { padding:8mm 14mm; }
  }
</style>
</head><body>

<!-- PAGE 1 -->
<div class="page">
  <div class="header">
    <img src="CESLA_logo.png" alt="CESLA" onerror="this.style.display='none'" />
    <div class="header-text">
      <h1>CESLA Multi-Purpose Cooperative</h1>
      <p>CLIMBS Bldg., Upper Zone 5, National Highway, Bulua, Cagayan De Oro City</p>
      <p>Email: cec@climbs.coop</p>
    </div>
    <div class="photo-box">2x2<br/>Photo</div>
  </div>

  <div class="form-title">Application Form</div>

  <div class="outer">
    <!-- App Date + No -->
    <div class="rb" style="display:flex;justify-content:space-between;">
      <span>Application Date: &nbsp;${line(f.appDate,'130px')}</span>
      <span>Application No: &nbsp;${line(f.appNo,'130px')}</span>
    </div>

    <div class="sec">PERSONAL DETAILS</div>

    <!-- Salutation + Gender -->
    <div class="rb">
      ${radio(f.salutation==='Mr.')} Mr. &nbsp;&nbsp;
      ${radio(f.salutation==='Mrs.')} Mrs. &nbsp;&nbsp;
      ${radio(f.salutation==='Ms.')} Ms.
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      Gender: &nbsp;${radio(f.gender==='Male')} Male &nbsp;&nbsp; ${radio(f.gender==='Female')} Female
    </div>

    <!-- Name -->
    <div class="rb" style="display:flex;gap:0;padding:0;">
      <div style="flex:2;border-right:1px solid #555;padding:5px 8px;">
        <div style="font-size:9px;color:#777;">Last Name</div>
        <div style="font-size:12px;font-weight:bold;">${member.lastName || '&nbsp;'}</div>
      </div>
      <div style="flex:2;border-right:1px solid #555;padding:5px 8px;">
        <div style="font-size:9px;color:#777;">First Name</div>
        <div style="font-size:12px;">${member.firstName || '&nbsp;'}</div>
      </div>
      <div style="flex:2;border-right:1px solid #555;padding:5px 8px;">
        <div style="font-size:9px;color:#777;">Middle Name</div>
        <div style="font-size:12px;">${member.middleName || '&nbsp;'}</div>
      </div>
      <div style="flex:1;padding:5px 8px;">
        <div style="font-size:9px;color:#777;">Suffix</div>
        <div style="font-size:12px;">${f.suffix || '&nbsp;'}</div>
      </div>
    </div>

    <!-- DOB + Nationality -->
    <div class="rb">
      Date of Birth (MM/DD/YYYY): ${line(f.dob,'120px')}
      &nbsp;&nbsp;&nbsp;
      Nationality: &nbsp;${radio(f.nationality==='Filipino')} Filipino &nbsp;
      ${radio(f.nationality==='Others')} Others (please specify) ${line(nationality==='Filipino'?'':nationality,'90px')}
    </div>

    <!-- Place of Birth + Religion + Dependents -->
    <div class="rb">
      Place of Birth: ${line(f.placeOfBirth,'190px')}
      &nbsp;&nbsp;&nbsp;
      Religion: ${line(religion,'130px')}
      &nbsp;&nbsp;&nbsp;
      Number of Dependents: ${line(f.numDependents,'55px')}
    </div>

    <!-- Civil Status -->
    <div class="rb">
      Civil Status: &nbsp;
      ${radio(f.civilStatus==='Single')} Single &nbsp;&nbsp;
      ${radio(f.civilStatus==='Married')} Married &nbsp;&nbsp;
      ${radio(f.civilStatus==='Legally Separated')} Legally Separated &nbsp;&nbsp;
      ${radio(f.civilStatus==='Others')} Others
    </div>

    <!-- Gov IDs -->
    <div class="rb">
      SSS/GSIS Number: ${line(sssGsis?.number,'120px')} &nbsp;&nbsp;
      Tax Identification Number: ${line(tin?.number,'120px')} &nbsp;&nbsp;
      Other IDs: ${line(otherIds.map(g=>`${g.type}: ${g.number}`).join(' | '),'120px')}
    </div>

    <!-- Referrer -->
    <div class="rb">
      Who recommended you to CEC? ${line(f.recommendedBy,'170px')}
    </div>
    <div class="rb">
      Contact No: ${line(f.contactNo || member.contact,'170px')}
    </div>

    <!-- Family Members -->
    <div class="rb" style="font-weight:bold;font-size:11px;padding:5px 8px;">Family Members:</div>
    <table>
      <tr>
        ${hdr('Name','width:35%')}${hdr('Relation','width:20%')}${hdr('Age','width:10%')}${hdr('Occupation')}
      </tr>
      ${(f.family || Array(5).fill({})).map(r=>`<tr style="height:20px;">${cell(r.name)}${cell(r.relation)}${cell(r.age)}${cell(r.occupation)}</tr>`).join('')}
    </table>

    <!-- Contact Details -->
    <div class="sec">CONTACT DETAILS</div>
    <div class="rb">
      Present Address: ${line(presentAddr,'300px')} &nbsp;&nbsp; Zip Code: ${line(f.presentZip,'65px')}
    </div>
    <div class="rb">
      Length of Stay in Present Address: ${line(f.stayYears,'50px')} years &nbsp; ${line(f.stayMonths,'50px')} months
    </div>
    <div class="rb">
      Permanent Address: ${line(permanentAddr || '(Same as present address)','295px')} &nbsp;&nbsp; Zip Code: ${line(f.permanentZip,'65px')}
    </div>
  </div>
</div>

<!-- PAGE 2 -->
<div class="page">
  <div style="text-align:center;font-size:11px;font-weight:bold;border-bottom:1px solid #333;padding-bottom:5px;margin-bottom:8px;">
    CESLA Multi-Purpose Cooperative &nbsp;—&nbsp; Application Form (Page 2) &nbsp;—&nbsp; ${fullName}
  </div>

  <div class="outer">
    <div class="sec">EMPLOYMENT DETAILS</div>
    <table>
      <tr>
        ${hdr('EMPLOYED','width:34%')}${hdr('SELF-EMPLOYED','width:33%')}${hdr('UNEMPLOYED','width:33%')}
      </tr>
      <tr style="vertical-align:top;">
        <td style="border:1px solid #555;padding:6px 8px;font-size:10px;line-height:2;vertical-align:top;">
          Employer/Business Name:<br>${line(f.employerName,'165px')}<br>
          Office Address:<br>${line(f.officeAddress,'165px')}<br>
          Nature of Business: ${line(f.natureOfBiz,'115px')}<br>
          Office No: ${line(f.officeNo,'75px')} &nbsp; Fax No: ${line(f.faxNo,'55px')}<br>
          Employment Type: &nbsp;
          ${radio(f.employmentType==='Private')} Private &nbsp;
          ${radio(f.employmentType==='Government')} Government<br>
          &nbsp;&nbsp;${radio(f.employmentType==='Others')} Others: ${line(f.employmentTypeOther,'75px')}<br>
          Position/Rank: ${line(f.positionRank,'115px')}<br>
          Monthly Income: ${line(f.monthlyIncome,'105px')}<br>
          <span style="font-size:9px;font-style:italic;">*If less than six (6) months in current<br>employment, please fill-up below:</span><br>
          Previous Employer:<br>${line(f.prevEmployer,'165px')}<br>
          Yrs. In Company: ${line(f.yrsInCompany,'75px')}<br>
          Position/Rank: ${line(f.prevPosition,'110px')}
        </td>
        <td style="border:1px solid #555;padding:6px 8px;font-size:10px;line-height:2;vertical-align:top;">
          Name of Business:<br>${line(f.bizName,'155px')}<br>
          Type of Business:<br>
          ${radio(f.bizType==='Sole Prop')} Sole Prop &nbsp;
          ${radio(f.bizType==='Partnership')} Partnership &nbsp;
          ${radio(f.bizType==='Corp')} Corp<br>
          Nature of Business: ${line(f.bizNature,'115px')}<br>
          Asset Size of Business (Php):<br>${line(f.assetSize,'150px')}<br>
          Share in Business (%): ${line(f.shareInBiz,'85px')}<br>
          Monthly Income: ${line(f.selfMonthlyIncome,'105px')}
        </td>
        <td style="border:1px solid #555;padding:6px 8px;font-size:10px;line-height:2.2;vertical-align:top;">
          ${radio(f.unemployedType==='Housewife')} Housewife<br>
          ${radio(f.unemployedType==='Student')} Student<br>
          ${radio(f.unemployedType==='Others')} Others (please specify)<br>
          ${line(f.unemployedOther,'140px')}
        </td>
      </tr>
    </table>

    <!-- Certification -->
    <div style="padding:8px 10px;font-size:10px;line-height:1.65;border-top:1px solid #555;">
      I/We hereby certify that all the data and statements in this application are correct and are made for obtaining
      credit, and the signature(s) appearing thereon is(are) genuine. I/We authorize you to obtain such information as
      you may require connecting the statements made in this application and that the sources which you may apply
      are authorized to provide any information relative to this application. <strong>I/We agree this will remain your property
      whether the credit is granted or not.</strong>
    </div>

    <!-- Signatures -->
    <div style="display:flex;border-top:1px solid #555;">
      <div style="flex:1;border-right:1px solid #555;padding:32px 8px 8px;font-size:9px;text-align:center;color:#555;">
        Signature of Applicant over Printed Name
      </div>
      <div style="flex:1;border-right:1px solid #555;padding:32px 8px 8px;font-size:9px;text-align:center;color:#555;">
        Signature of Spouse over Printed Name
      </div>
      <div style="flex:1;padding:32px 8px 8px;font-size:9px;text-align:center;color:#555;">
        Witnessed by
      </div>
    </div>
  </div>

  <div style="text-align:center;margin-top:10px;font-size:8px;color:#999;">
    CESLA Multi-Purpose Cooperative &nbsp;|&nbsp; CLIMBS Employee Cooperative &nbsp;|&nbsp;
    Generated: ${today} &nbsp;|&nbsp; User ID: ${member.userId || ''}
  </div>
</div>

</body></html>`;
};

const AppFormView = ({ member, contentHeight, isMobile: isMobileProp }) => {
  const { isMobile: rwdMobile, rowDir, halfStyle } = useRwd();
  const isMobile = isMobileProp ?? rwdMobile;
  const af0 = member.appForm || {};
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' }).replace(/\//g, '/');
  const autoAppNo = af0.appNo || `APP-${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${member.uid?.slice(-4)?.toUpperCase() || 'XXXX'}`;
  const [form, setForm] = useState({
    appDate: af0.appDate || todayStr, appNo: autoAppNo,
    salutation: af0.salutation || '', gender: af0.gender || '',
    suffix: af0.suffix || '',
    dob: af0.dob || '',
    placeOfBirth: af0.placeOfBirth || '',
    nationality: af0.nationality || 'Filipino', nationalityOther: af0.nationalityOther || '',
    religion: af0.religion || '', religionOther: af0.religionOther || '',
    numDependents: af0.numDependents || '0',
    civilStatus: af0.civilStatus || '',
    // Gov IDs — array of { type, number }
    govIds: af0.govIds || [
      { type: af0.sssGsis ? 'SSS' : '', number: af0.sssGsis || '' },
      { type: af0.tin ? 'TIN' : '', number: af0.tin || '' },
      { type: af0.philHealth ? 'PhilHealth' : '', number: af0.philHealth || '' },
      { type: af0.pagIbig ? 'Pag-IBIG (HDMF)' : '', number: af0.pagIbig || '' },
    ],
    recommendedBy: af0.recommendedBy || '',
    contactNo: af0.contactNo || '',
    family: af0.family || Array(5).fill(null).map(() => ({ name: '', relation: '', age: '', occupation: '' })),
    presentHouseStreet: af0.presentHouseStreet || '', presentBarangay: af0.presentBarangay || '',
    presentMunicipality: af0.presentMunicipality || '', presentProvince: af0.presentProvince || '',
    presentAddress: af0.presentAddress || '', presentZip: af0.presentZip || '',
    stayYears: af0.stayYears || '', stayMonths: af0.stayMonths || '',
    permanentHouseStreet: af0.permanentHouseStreet || '', permanentBarangay: af0.permanentBarangay || '',
    permanentMunicipality: af0.permanentMunicipality || '', permanentProvince: af0.permanentProvince || '',
    permanentAddress: af0.permanentAddress || '', permanentZip: af0.permanentZip || '',
    empType: af0.empType || '',
    employerName: af0.employerName || '', officeAddress: af0.officeAddress || '',
    natureOfBiz: af0.natureOfBiz || '', officeNo: af0.officeNo || '', faxNo: af0.faxNo || '',
    employmentType: af0.employmentType || '', employmentTypeOther: af0.employmentTypeOther || '',
    positionRank: af0.positionRank || '', monthlyIncome: af0.monthlyIncome || '',
    prevEmployer: af0.prevEmployer || '', yrsInCompany: af0.yrsInCompany || '', prevPosition: af0.prevPosition || '',
    bizName: af0.bizName || '', bizType: af0.bizType || '', bizNature: af0.bizNature || '',
    assetSize: af0.assetSize || '', shareInBiz: af0.shareInBiz || '', selfMonthlyIncome: af0.selfMonthlyIncome || '',
    unemployedType: af0.unemployedType || '', unemployedOther: af0.unemployedOther || '',
  });

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [page,   setPage]   = useState(1);
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      let html = generateAppFormHTML(member, form);
      if (Platform.OS === 'web') {
        // Embed logo as base64 so it prints correctly
        try {
          const resp = await fetch(require('../../../assets/CESLA_logo.png'));
          const blob = await resp.blob();
          const b64 = await new Promise(res => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.readAsDataURL(blob);
          });
          html = html.replace('src="CESLA_logo.png"', `src="${b64}"`);
        } catch (e) {}
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 600);
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save or Share Application Form' });
        } else {
          await Print.printAsync({ html });
        }
      }
    } catch (e) { console.warn('Print error:', e); }
    finally { setPrinting(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setFamily = (idx, key, val) => setForm(f => {
    const fam = [...f.family];
    fam[idx] = { ...fam[idx], [key]: val };
    return { ...f, family: fam };
  });
  const setGovId = (idx, field, val) => setForm(f => {
    const ids = [...f.govIds];
    ids[idx] = { ...ids[idx], [field]: val };
    return { ...f, govIds: ids };
  });
  const addGovId = () => setForm(f => ({ ...f, govIds: [...f.govIds, { type: '', number: '' }] }));

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'members', member.uid), { appForm: form, updatedAt: serverTimestamp() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.warn(e); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView
      contentContainerStyle={[s.pageOuter, { paddingBottom: 80 }]}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled={true}
      keyboardShouldPersistTaps="handled"
      style={contentHeight ? { height: contentHeight } : undefined}
    >
      <Text style={s.pageTitle}>📋 Application Form</Text>
      <Text style={s.pageSub}>CESLA Multi-Purpose Cooperative — Official Membership Application</Text>

      {/* Tab selector */}
      <View style={af.pageTabs}>
        {['Personal Details', 'Employment Details'].map((tab, i) => (
          <TouchableOpacity key={tab}
            style={[af.pageTab, page === i + 1 && af.pageTabActive]}
            onPress={() => setPage(i + 1)} activeOpacity={0.8}>
            <Text style={[af.pageTabTxt, page === i + 1 && af.pageTabTxtActive]}>
              {i + 1}. {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* PAGE 1: PERSONAL DETAILS */}
      {page === 1 && (
        <>
          <GCard>
            <View style={{ flexDirection: rowDir, gap: 10 }}>
              <View style={halfStyle}>
                <Text style={af.fieldLabel}>APPLICATION DATE</Text>
                <View style={[af.input, { justifyContent: 'center', opacity: 0.85, backgroundColor: 'rgba(15,30,53,0.06)' }]}>
                  <Text style={{ fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: C.navy }}>{form.appDate}</Text>
                </View>
              </View>
              <View style={halfStyle}>
                <Text style={af.fieldLabel}>APPLICATION NO.</Text>
                <View style={[af.input, { justifyContent: 'center', opacity: 0.85, backgroundColor: 'rgba(15,30,53,0.06)' }]}>
                  <Text style={{ fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: C.navy }}>{form.appNo}</Text>
                </View>
              </View>
            </View>
          </GCard>

          <Text style={af.secHeader}>PERSONAL DETAILS</Text>
          <GCard>
            <RadioRow label="Salutation" options={['Mr.', 'Mrs.', 'Ms.']} selected={form.salutation} onSelect={v => set('salutation', v)} />
            <RadioRow label="Gender" options={['Male', 'Female']} selected={form.gender} onSelect={v => set('gender', v)} />
            <View style={{ flexDirection: rowDir, gap: 8 }}>
              <View style={halfStyle}><AF l="LAST NAME"  value={member.lastName || member.name?.split(',')[0] || ''} placeholder="—" editable={false} /></View>
              <View style={halfStyle}><AF l="FIRST NAME" value={member.firstName || ''} placeholder="—" editable={false} /></View>
            </View>
            <View style={{ flexDirection: rowDir, gap: 8 }}>
              <View style={halfStyle}><AF l="MIDDLE NAME" value={member.middleName || ''} placeholder="—" editable={false} /></View>
              <View style={halfStyle}><AF l="SUFFIX"      value={form.suffix} onChangeText={v => set('suffix', v)} placeholder="Jr., Sr., II" /></View>
            </View>

            <DatePicker l="DATE OF BIRTH" value={form.dob} onChange={v => set('dob', v)} />
            <AF l="PLACE OF BIRTH" value={form.placeOfBirth} onChangeText={v => set('placeOfBirth', v)} placeholder="City / Municipality, Province" />

            <RadioRow label="Nationality" options={['Filipino', 'Others']} selected={form.nationality} onSelect={v => set('nationality', v)} />
            {form.nationality === 'Others' && (
              <AF l="SPECIFY NATIONALITY" value={form.nationalityOther} onChangeText={v => set('nationalityOther', v)} placeholder="Enter nationality" />
            )}

            <DropdownPicker l="RELIGION" options={RELIGIONS} value={form.religion} onSelect={v => set('religion', v)} placeholder="Select religion" />
            {form.religion === 'Others' && (
              <AF l="SPECIFY RELIGION" value={form.religionOther} onChangeText={v => set('religionOther', v)} placeholder="Enter religion" />
            )}

            <Text style={[af.fieldLabel, { marginTop: 4 }]}>NO. OF DEPENDENTS</Text>
            <DropdownPicker l="" options={['0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15+']} value={form.numDependents} onSelect={v => set('numDependents', v)} placeholder="Select number" />
            <RadioRow label="Civil Status" options={['Single', 'Married', 'Legally Separated', 'Others']} selected={form.civilStatus} onSelect={v => set('civilStatus', v)} />

            <Text style={[af.secHeader, { marginTop: 4 }]}>GOVERNMENT IDs</Text>
            {/* 2-col on wide, 1-col on mobile */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {form.govIds.map((gid, idx) => (
                <View key={idx} style={{ flex: 1, flexBasis: isMobile ? '100%' : '48%', minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3, height: 18 }}>
                    <Text style={[af.fieldLabel, { marginBottom: 0 }]}>ID #{idx + 1}</Text>
                    <TouchableOpacity
                      onPress={() => setForm(f => ({ ...f, govIds: f.govIds.filter((_, i) => i !== idx) }))}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={{ opacity: idx === 0 ? 0 : 1 }}
                      disabled={idx === 0}>
                      <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.red }}>✕ Remove</Text>
                    </TouchableOpacity>
                  </View>
                  <GovIdPicker
                    l=""
                    idType={gid.type}
                    idNumber={gid.number}
                    onTypeChange={v => setGovId(idx, 'type', v)}
                    onNumberChange={v => setGovId(idx, 'number', v)}
                    placeholder="Enter ID number"
                  />
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={addGovId}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 15, color: C.blue }}>＋</Text>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.blue }}>Add Another ID</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: rowDir, gap: 8 }}>
              <View style={halfStyle}><AF l="NAME OF REFERRER (CEC)" value={form.recommendedBy} onChangeText={v => set('recommendedBy', v)} placeholder="Full name of referrer" /></View>
              <View style={halfStyle}><AF l="REFERRER CONTACT NO."   value={form.contactNo}     onChangeText={v => set('contactNo', v)}     placeholder="09XXXXXXXXX" keyboardType="phone-pad" /></View>
            </View>
          </GCard>

          <Text style={af.secHeader}>FAMILY MEMBERS</Text>
          <GCard style={{ padding: 0, overflow: 'hidden' }}>
            <View style={af.tableHeader}>
              {[{l:'Name',f:2},{l:'Relation',f:1},{l:'Age',f:0.6},{l:'Occupation',f:1.4}].map(h => (
                <Text key={h.l} style={[af.tableHeaderTxt, { flex: h.f }]}>{h.l}</Text>
              ))}
            </View>
            {form.family.map((row, idx) => (
              <View key={idx} style={[af.tableRow, idx % 2 === 1 && { backgroundColor: 'rgba(255,255,255,0.35)' }]}>
                <TextInput style={[af.tableCell, { flex: 2 }]}                                              value={row.name}       onChangeText={v => setFamily(idx, 'name', v)}       placeholder="Name"       placeholderTextColor={C.textMuted} />
                <TextInput style={[af.tableCell, { flex: 1,   borderLeftWidth: 1, borderColor: C.border }]} value={row.relation}   onChangeText={v => setFamily(idx, 'relation', v)}   placeholder="Relation"   placeholderTextColor={C.textMuted} />
                <TextInput style={[af.tableCell, { flex: 0.6, borderLeftWidth: 1, borderColor: C.border }]} value={row.age}        onChangeText={v => setFamily(idx, 'age', v)}        placeholder="Age"        placeholderTextColor={C.textMuted} keyboardType="numeric" />
                <TextInput style={[af.tableCell, { flex: 1.4, borderLeftWidth: 1, borderColor: C.border }]} value={row.occupation} onChangeText={v => setFamily(idx, 'occupation', v)} placeholder="Occupation" placeholderTextColor={C.textMuted} />
              </View>
            ))}
          </GCard>

          <Text style={af.secHeader}>CONTACT DETAILS</Text>
          <GCard>
            <Text style={[af.fieldLabel, { fontSize: 10, color: C.navyMid, marginBottom: 8 }]}>📍 PRESENT ADDRESS</Text>
            <AddressPicker
              barangay={form.presentBarangay}
              municipality={form.presentMunicipality}
              province={form.presentProvince}
              houseStreet={form.presentHouseStreet}
              zip={form.presentZip}
              onChangeBgy={v => set('presentBarangay', v)}
              onChangeMun={v => set('presentMunicipality', v)}
              onChangeProv={v => set('presentProvince', v)}
              onChangeHouseStreet={v => set('presentHouseStreet', v)}
              onChangeZip={v => set('presentZip', v)}
            />
            <View style={{ flexDirection: rowDir, gap: 8, marginBottom: 8 }}>
              <View style={isMobile ? {} : { flex: 1 }}>
                <Text style={af.fieldLabel}>YEARS OF STAY</Text>
                <TextInput style={[af.input, { marginBottom: 0 }]} value={form.stayYears} onChangeText={v => set('stayYears', v)} placeholder="e.g. 3" placeholderTextColor={C.textMuted} keyboardType="numeric" autoCorrect={false} />
              </View>
              <View style={isMobile ? {} : { flex: 1 }}>
                <Text style={af.fieldLabel}>MONTHS OF STAY</Text>
                <TextInput style={[af.input, { marginBottom: 0 }]} value={form.stayMonths} onChangeText={v => set('stayMonths', v)} placeholder="e.g. 6" placeholderTextColor={C.textMuted} keyboardType="numeric" autoCorrect={false} />
              </View>
            </View>

            <View style={{ height: 12 }} />
            <Text style={[af.fieldLabel, { fontSize: 10, color: C.navyMid, marginBottom: 4 }]}>📍 PERMANENT ADDRESS</Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginBottom: 8, fontStyle: 'italic' }}>Leave blank if same as present address</Text>
            <AddressPicker
              barangay={form.permanentBarangay}
              municipality={form.permanentMunicipality}
              province={form.permanentProvince}
              houseStreet={form.permanentHouseStreet}
              zip={form.permanentZip}
              onChangeBgy={v => set('permanentBarangay', v)}
              onChangeMun={v => set('permanentMunicipality', v)}
              onChangeProv={v => set('permanentProvince', v)}
              onChangeHouseStreet={v => set('permanentHouseStreet', v)}
              onChangeZip={v => set('permanentZip', v)}
            />
          </GCard>

          <TouchableOpacity style={af.fullBtn} onPress={() => setPage(2)} activeOpacity={0.85}>
            <LinearGradient colors={['#1a2d4e', '#243554']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={af.fullBtnGrad}>
              <Text style={af.fullBtnTxt}>Next: Employment Details  →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* PAGE 2: EMPLOYMENT DETAILS */}
      {page === 2 && (
        <>
          <Text style={af.secHeader}>EMPLOYMENT DETAILS</Text>
          <GCard>
            <RadioRow label="Employment Status" options={['Employed', 'Self-Employed', 'Unemployed']} selected={form.empType} onSelect={v => set('empType', v)} />
          </GCard>

          {form.empType === 'Employed' && (
            <GCard>
              <Text style={s.secTitle}>Employed</Text>
              <AF l="EMPLOYER / BUSINESS NAME" value={form.employerName}  onChangeText={v => set('employerName', v)}  placeholder="Name of employer" />
              <AF l="OFFICE ADDRESS"           value={form.officeAddress} onChangeText={v => set('officeAddress', v)} placeholder="Complete office address" />
              <AF l="NATURE OF BUSINESS"       value={form.natureOfBiz}   onChangeText={v => set('natureOfBiz', v)}   placeholder="e.g. Government Agency" />
              <View style={{ flexDirection: rowDir, gap: 8 }}>
                <View style={halfStyle}><AF l="OFFICE NO." value={form.officeNo} onChangeText={v => set('officeNo', v)} placeholder="(088) XXX-XXXX" keyboardType="phone-pad" /></View>
                <View style={halfStyle}><AF l="FAX NO."    value={form.faxNo}    onChangeText={v => set('faxNo', v)}    placeholder="(088) XXX-XXXX" keyboardType="phone-pad" /></View>
              </View>
              <RadioRow label="Employment Type" options={['Private', 'Government', 'Others']} selected={form.employmentType} onSelect={v => set('employmentType', v)} />
              {form.employmentType === 'Others' && (
                <AF l="SPECIFY TYPE" value={form.employmentTypeOther} onChangeText={v => set('employmentTypeOther', v)} placeholder="Specify" />
              )}
              <View style={{ flexDirection: rowDir, gap: 8 }}>
                <View style={halfStyle}><AF l="POSITION / RANK"    value={form.positionRank}  onChangeText={v => set('positionRank', v)}  placeholder="e.g. Teacher I"  /></View>
                <View style={halfStyle}><AF l="MONTHLY INCOME (₱)" value={form.monthlyIncome} onChangeText={v => set('monthlyIncome', v)} placeholder="e.g. 25000" keyboardType="numeric" /></View>
              </View>
              <View style={af.noteBox}>
                <Text style={af.noteTxt}>* If less than 6 months in current employment, fill in previous employer below.</Text>
              </View>
              <AF l="PREVIOUS EMPLOYER" value={form.prevEmployer} onChangeText={v => set('prevEmployer', v)} placeholder="Previous employer name" />
              <View style={{ flexDirection: rowDir, gap: 8 }}>
                <View style={halfStyle}><AF l="YRS IN COMPANY"  value={form.yrsInCompany} onChangeText={v => set('yrsInCompany', v)} placeholder="0" keyboardType="numeric" /></View>
                <View style={halfStyle}><AF l="POSITION / RANK" value={form.prevPosition} onChangeText={v => set('prevPosition', v)} placeholder="Previous position" /></View>
              </View>
            </GCard>
          )}

          {form.empType === 'Self-Employed' && (
            <GCard>
              <Text style={s.secTitle}>Self-Employed</Text>
              <AF l="NAME OF BUSINESS" value={form.bizName}   onChangeText={v => set('bizName', v)}   placeholder="Business name" />
              <RadioRow label="Type of Business" options={['Sole Prop', 'Partnership', 'Corp']} selected={form.bizType} onSelect={v => set('bizType', v)} />
              <AF l="NATURE OF BUSINESS" value={form.bizNature} onChangeText={v => set('bizNature', v)} placeholder="e.g. Retail, Trading" />
              <View style={{ flexDirection: rowDir, gap: 8 }}>
                <View style={halfStyle}><AF l="ASSET SIZE (₱)"  value={form.assetSize}  onChangeText={v => set('assetSize', v)}  placeholder="e.g. 500000" keyboardType="numeric" /></View>
                <View style={halfStyle}><AF l="SHARE IN BIZ (%)" value={form.shareInBiz} onChangeText={v => set('shareInBiz', v)} placeholder="e.g. 50"     keyboardType="numeric" /></View>
              </View>
              <AF l="MONTHLY INCOME (₱)" value={form.selfMonthlyIncome} onChangeText={v => set('selfMonthlyIncome', v)} placeholder="e.g. 30000" keyboardType="numeric" />
            </GCard>
          )}

          {form.empType === 'Unemployed' && (
            <GCard>
              <Text style={s.secTitle}>Unemployed</Text>
              <RadioRow label="Status" options={['Housewife', 'Student', 'Others']} selected={form.unemployedType} onSelect={v => set('unemployedType', v)} />
              {form.unemployedType === 'Others' && (
                <AF l="PLEASE SPECIFY" value={form.unemployedOther} onChangeText={v => set('unemployedOther', v)} placeholder="Specify status" />
              )}
            </GCard>
          )}

          <GCard style={{ backgroundColor: 'rgba(15,30,53,0.06)', borderColor: 'rgba(15,30,53,0.18)' }}>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textSec, lineHeight: 18, textAlign: 'justify' }}>
              I/We hereby certify that all the data and statements in this application are correct and are made for obtaining credit, and the signature(s) appearing thereon is(are) genuine. I/We authorize you to obtain such information as you may require connecting the statements made in this application and that the sources which you may apply are authorized to provide any information relative to this application.{" "}
              <Text style={{ fontFamily: 'GoogleSans_700Bold', color: C.navy }}>I/We agree this will remain your property whether the credit is granted or not.</Text>
            </Text>
          </GCard>

          {/* Buttons — 3 columns in one row */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
            {/* Back */}
            <TouchableOpacity style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }} onPress={() => setPage(1)} activeOpacity={0.85}>
              <LinearGradient colors={['#304674', '#1a2d4e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 13, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#fff', textAlign: 'center' }}>← Back</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Submit */}
            <TouchableOpacity style={{ flex: 1.4, borderRadius: 12, overflow: 'hidden', opacity: saving ? 0.7 : 1 }} onPress={save} disabled={saving} activeOpacity={0.85}>
              <LinearGradient colors={saved ? ['#1a8a4a', '#25a85a'] : ['#c9a84c', '#e8c87a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 13, alignItems: 'center', justifyContent: 'center' }}>
                {saving
                  ? <ActivityIndicator color={C.navy} />
                  : <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: saved ? '#fff' : C.navy, textAlign: 'center' }}>
                      {saved ? '✓ Submitted!' : '📨 Submit'}
                    </Text>}
              </LinearGradient>
            </TouchableOpacity>

            {/* Print */}
            <TouchableOpacity style={{ flex: 1, borderRadius: 12, overflow: 'hidden', opacity: printing ? 0.7 : 1 }} onPress={handlePrint} disabled={printing} activeOpacity={0.85}>
              <LinearGradient colors={['#1a2d4e', '#243554']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 13, alignItems: 'center', justifyContent: 'center' }}>
                {printing
                  ? <ActivityIndicator color={C.gold} />
                  : <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.gold, textAlign: 'center' }}>🖨️ Print</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
};

// AppForm styles
const af = StyleSheet.create({
  fieldLabel:       { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(1,31,75,0.55)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  input:            { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy, backgroundColor: 'rgba(240,246,252,0.92)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1.5, borderColor: 'rgba(200,218,235,0.75)' },
  radio:            { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: C.navyMid, justifyContent: 'center', alignItems: 'center' },
  radioActive:      { borderColor: C.gold, backgroundColor: 'rgba(201,168,76,0.15)' },
  radioDot:         { width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold },
  radioLabel:       { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.navy },
  secHeader:        { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  pageTabs:         { flexDirection: 'row', gap: 8, marginBottom: 14 },
  pageTab:          { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.60)', alignItems: 'center' },
  pageTabActive:    { backgroundColor: C.navyMid, borderColor: C.gold },
  pageTabTxt:       { fontFamily: 'GoogleSans_500Medium', fontSize: 11, color: C.textSec, textAlign: 'center' },
  pageTabTxtActive: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#fff' },
  fullBtn:          { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  fullBtnGrad:      { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  fullBtnTxt:       { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#fff', letterSpacing: 0.8 },
  noteBox:          { backgroundColor: 'rgba(201,168,76,0.12)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', padding: 9, marginBottom: 10 },
  noteTxt:          { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.70)', fontStyle: 'italic' },
  dropdownList:     { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(200,218,235,0.90)', marginTop: 4, shadowColor: '#1a2d4e', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, zIndex: 999 },
  dropdownItem:     { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.06)' },
  dropdownItemActive:{ backgroundColor: 'rgba(201,168,76,0.12)' },
  dropdownTxt:      { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy },
  tableHeader:      { flexDirection: 'row', backgroundColor: '#1a2d4e', paddingVertical: 9, paddingHorizontal: 6 },
  tableHeaderTxt:   { flex: 1, fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.gold, textAlign: 'center' },
  tableRow:         { flexDirection: 'row', borderTopWidth: 1, borderColor: 'rgba(15,30,53,0.10)' },
  tableCell:        { flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.navy, paddingHorizontal: 7, paddingVertical: 8 },
});

const FinanceView = ({ title, icon, value, label, color, member, contentHeight }) => (
  <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={true} style={contentHeight ? { height: contentHeight } : undefined}>
    <Text style={s.pageTitle}>{title}</Text>
    <GCard style={{ alignItems: 'center', padding: 28, borderTopWidth: 4, borderTopColor: color }}>
      <Text style={{ fontSize: 32, marginBottom: 10 }}>{icon}</Text>
      <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 32, color, marginBottom: 6 }}>{fmtCur(value)}</Text>
      <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec }}>{label}</Text>
      <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, marginTop: 4 }}>Last updated: {fmtDate(member.updatedAt)}</Text>
    </GCard>
    <Text style={s.sHead}>📋 TRANSACTION HISTORY</Text>
    <GCard style={{ alignItems: 'center', padding: 32 }}>
      <Text style={{ fontSize: 32, marginBottom: 10 }}>📄</Text>
      <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 }}>No transactions yet.{'\n'}Contact admin for manual entries.</Text>
    </GCard>
  </ScrollView>
);

const ApplyLoanView = ({ member, contentHeight }) => {
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!amount || !purpose || !term) { setError('Please fill in all fields.'); return; }
    const amt = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(amt) || amt <= 0) { setError('Please enter a valid amount.'); return; }
    setLoading(true); setError('');
    try {
      await addDoc(collection(db, 'loanApplications'), { memberId: member.uid, memberName: member.name, memberUserId: member.userId, amount: amt, purpose, term, status: 'Pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await addDoc(collection(db, 'adminNotifications'), { type: 'loan', icon: '💳', title: 'New Loan Application', message: `${member.name} applied for a loan of ${fmtCur(amt)}.`, memberId: member.uid, memberUserId: member.userId, createdAt: serverTimestamp(), read: false });
      setDone(true); setAmount(''); setPurpose(''); setTerm('');
      setTimeout(() => setDone(false), 3000);
    } catch (e) { setError(e.message || 'Submission failed.'); }
    finally { setLoading(false); }
  };
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={true} style={contentHeight ? { height: contentHeight } : undefined}>
      <Text style={s.pageTitle}>📝 Apply for a Loan</Text>
      <Text style={s.pageSub}>Your application will be reviewed by the admin.</Text>
      <GCard style={{ backgroundColor: 'rgba(37,99,176,0.10)', borderColor: 'rgba(37,99,176,0.30)' }}>
        <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.blue, marginBottom: 6 }}>📌 Before You Apply</Text>
        {['Must be active for at least 3 months.', 'Loan is up to 3x your share capital.', `Your share capital: ${fmtCur(member.shares)}`, `Estimated max loan: ${fmtCur((member.shares || 0) * 3)}`].map((t, i) => (
          <Text key={i} style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, lineHeight: 19 }}>• {t}</Text>
        ))}
      </GCard>
      <GCard>
        <Text style={s.secTitle}>Loan Details</Text>
        <DField label="LOAN AMOUNT (₱)" value={amount}  onChangeText={v => { setAmount(v);  setError(''); }} placeholder="e.g. 10000" keyboardType="numeric" />
        <DField label="PURPOSE"          value={purpose} onChangeText={v => { setPurpose(v); setError(''); }} placeholder="e.g. Business Capital, Medical" />
        <DField label="REPAYMENT TERM"   value={term}    onChangeText={v => { setTerm(v);    setError(''); }} placeholder="e.g. 12 months" />
        {error ? <View style={{ backgroundColor: 'rgba(192,57,43,0.10)', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(192,57,43,0.28)', padding: 10, marginBottom: 8 }}><Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.red }}>{error}</Text></View> : null}
        <SaveBtn onPress={submit} loading={loading} done={done} label="Submit Application" doneLabel="Application Submitted!" />
      </GCard>
    </ScrollView>
  );
};

const MyLoansView = ({ member, contentHeight }) => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    return onSnapshot(query(collection(db, 'loanApplications'), where('memberId', '==', member.uid), orderBy('createdAt', 'desc')), snap => { setApps(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
  }, [member.uid]);
  const prog = member.loan > 0 ? (member.loan - (member.loanBalance || 0)) / member.loan : 0;
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={true} style={contentHeight ? { height: contentHeight } : undefined}>
      <Text style={s.pageTitle}>💳 My Loans</Text>
      {member.loan > 0 ? (
        <GCard style={{ borderTopWidth: 4, borderTopColor: C.orange }}>
          <Text style={s.secTitle}>Active Loan</Text>
          {[['Total Loan', fmtCur(member.loan), C.orange], ['Remaining', fmtCur(member.loanBalance), C.red], ['Paid', fmtCur(member.loan - (member.loanBalance || 0)), C.green]].map(([l, v, c]) => (
            <View key={l} style={s.infoRow}><Text style={s.infoLabel}>{l}</Text><Text style={[s.infoVal, { color: c, fontFamily: 'GoogleSans_700Bold' }]}>{v}</Text></View>
          ))}
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}><Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec }}>Repayment Progress</Text><Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.green }}>{Math.round(prog * 100)}%</Text></View>
            <View style={{ height: 10, backgroundColor: 'rgba(15,30,53,0.12)', borderRadius: 5, overflow: 'hidden' }}><View style={{ height: 10, backgroundColor: C.green, borderRadius: 5, width: `${Math.round(prog * 100)}%` }} /></View>
          </View>
        </GCard>
      ) : (
        <GCard style={{ alignItems: 'center', padding: 32 }}><Text style={{ fontSize: 36, marginBottom: 10 }}>📋</Text><Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' }}>No active loan.</Text></GCard>
      )}
      {!loading && apps.length > 0 && (
        <>
          <Text style={s.sHead}>📄 LOAN APPLICATIONS</Text>
          {apps.map(app => { const sc = app.status === 'Approved' ? C.green : app.status === 'Rejected' ? C.red : C.orange; return (
            <GCard key={app.id} style={{ borderLeftWidth: 3, borderLeftColor: sc }}>
              {[['Amount', fmtCur(app.amount)], ['Purpose', app.purpose], ['Term', app.term], ['Filed', fmtDate(app.createdAt)], ['Status', app.status]].map(([l, v]) => (<View key={l} style={s.infoRow}><Text style={s.infoLabel}>{l}</Text><Text style={[s.infoVal, l === 'Status' && { color: sc, fontFamily: 'GoogleSans_700Bold' }]}>{v}</Text></View>))}
              {app.adminRemarks ? <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: '#9a7230', fontStyle: 'italic', marginTop: 6 }}>Admin: {app.adminRemarks}</Text> : null}
            </GCard>
          ); })}
        </>
      )}
      {loading && <Spinner msg="Loading..." />}
    </ScrollView>
  );
};

// ── Per-loan guideline data ───────────────────────────────────────────────
const LOAN_TYPES = [
  {
    key: 'regular',
    title: 'Regular Loan',
    icon: '🏦',
    color: C.blue,
    effective: 'January 1, 2026',
    terms: { term: '36 months', amount: '₱300,000.00', interest: '8% per annum', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS with at least 6 months of service',
    security: 'Share Capital at least ₱5,000.00 + Future Indemnity Claim (Loan Insurance)',
    loanAmount: 'Times 2 of the Share Capital, max ₱300,000.00',
    approvalLimits: ['Manager — ₱50,000.00 and below', 'CreCom — ₱50,000.01 to ₱150,000.00', 'BOD — ₱150,000.01 and above'],
    processingTime: '7 working days upon receipt of application form',
    renewal: '6 months',
    documents: ['Loan Application Form', 'Certificate of Net Take Home Pay', 'Share Capital Ledger', 'Loan Ledger', 'Loan Computation & Proceeds', 'Schedule of Loan Amortization'],
    modeOfPayment: 'Monthly salary deduction every 15th & 30th',
  },
  {
    key: 'salary',
    title: 'Salary Loan',
    icon: '💼',
    color: C.navyMid,
    effective: 'January 1, 2026',
    terms: { term: '36 months', amount: '₱200,000.00', interest: '10% per annum', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS with at least 6 months of service',
    security: 'Share Capital at least ₱5,000.00 + Future Indemnity Claim (Loan Insurance)',
    loanAmount: 'Maximum amount of ₱200,000.00',
    approvalLimits: ['Manager — ₱50,000.00 and below', 'CreCom — ₱50,000.01 to ₱150,000.00', 'BOD — ₱150,000.01 and above'],
    processingTime: '5 working days upon receipt of application form',
    renewal: '6 months',
    documents: ['Loan Application Form', 'Certificate of Net Take Home Pay', 'Share Capital Ledger', 'Loan Ledger', 'Loan Computation & Proceeds', 'Schedule of Loan Amortization'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'vehicle',
    title: 'Vehicle Loan',
    icon: '🚗',
    color: '#2a6496',
    effective: 'January 1, 2026',
    terms: { term: '60 months', amount: 'Max ₱1M (20% of total price)', interest: '8% per annum', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS with at least 6 months of service',
    security: 'Share Capital at least ₱5,000.00 + Future Indemnity Claim (Loan Insurance)',
    loanAmount: 'Variable',
    approvalLimits: ['Manager — ₱50,000.00 and below', 'CreCom — ₱50,000.01 to ₱150,000.00', 'BOD — ₱150,000.01 to ₱1,000,000.00'],
    processingTime: '7 working days upon receipt of application form',
    renewal: 'Upon full payment of the loan',
    documents: ['Brand New: Loan Application Form & Co-Maker Form (with photo)', 'Certificate of Net Take Home Pay', 'Proof of Quotation with photo of the unit', 'Proof of engine and chassis number', '2nd Hand: Accomplished Loan App & Co-Maker Form (with photo)', 'Proof of unit last price with photo (include plate #)', 'Photocopy of latest OR & CR', 'Stencil of engine & chassis number', 'Latest Cedula (seller), TIN ID or 2 gov\'t IDs (seller)', 'Unit must be year 2000 and up', 'TMG/PNP clearance of the unit'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'petty',
    title: 'Petty Cash Loan',
    icon: '💵',
    color: C.orange,
    effective: 'January 1, 2026',
    terms: { term: '3 months', amount: '₱5,000.00', interest: '1% per month', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS with at least 6 months of service',
    security: 'Share Capital at least ₱5,000.00',
    loanAmount: 'Maximum amount of ₱5,000.00',
    approvalLimits: ['Manager'],
    processingTime: 'Within 24 hours from receipt of loan application form',
    renewal: '50% payment',
    documents: ['Petty Cash Application Form'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'special',
    title: 'Special Loan (DTI)',
    icon: '⭐',
    color: '#7b3fa0',
    effective: 'January 1, 2026',
    terms: { term: '18 months', amount: '₱20,000.00', interest: '12% per annum', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS with at least 6 months of service',
    security: 'Share Capital at least ₱5,000.00 + Future Indemnity Claim (Loan Insurance)',
    loanAmount: 'Maximum amount of ₱20,000.00',
    approvalLimits: ['Manager'],
    processingTime: '5 working days upon receipt of application form',
    renewal: '6 months or 50% payment',
    documents: ['Loan Application Form', 'Certificate of Net Take Home Pay', 'Share Capital Ledger', 'Loan Ledger', 'Loan Computation & Proceeds'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'appliance',
    title: 'Appliance Loan',
    icon: '📺',
    color: '#16847a',
    effective: 'January 1, 2026',
    terms: { term: '12 months', amount: '₱30,000.00', interest: '12% per annum', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS with at least 6 months of service',
    security: 'Share Capital at least ₱5,000.00 + Future Indemnity Claim (Loan Insurance)',
    loanAmount: 'Maximum amount of ₱30,000.00',
    approvalLimits: ['Manager'],
    processingTime: '5 working days upon receipt of application form',
    renewal: '6 months or 50% payment',
    documents: ['Loan Application Form', 'Certificate of Net Take Home Pay', 'Photo of desired appliance with price quotation from the store', 'After payment, submit photocopy of receipt'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'healthcare',
    title: 'Healthcare Loan',
    icon: '🏥',
    color: C.red,
    effective: 'January 1, 2026',
    terms: { term: '12 months', amount: 'Variable', interest: 'N/A', serviceCharge: '2%' },
    qualification: 'Principal: Regular employee of CLIMBS with at least 6 months of service. Dependents: ages up to 70 y.o. only. Member of Good Standing (no past due amort. in all CEC loans).',
    security: 'Share Capital at least ₱5,000.00',
    loanAmount: 'Variable',
    approvalLimits: ['Manager — ₱50,000.00 and below'],
    processingTime: 'N/A',
    renewal: 'Upon full payment, annual',
    documents: ['Certificate of Net Take Home Pay'],
    modeOfPayment: 'Monthly Salary Deduction 15th & 30th',
  },
  {
    key: 'emergency',
    title: 'Emergency Loan',
    icon: '🚨',
    color: '#c0392b',
    effective: 'January 1, 2026',
    terms: [
      { term: '6 months', amount: 'Less than ₱10,000.00', interest: 'No interest', serviceCharge: '2%' },
      { term: '24 months', amount: '₱10,000.01 to ₱25,000.00', interest: '8% per annum', serviceCharge: '2%' },
      { term: '36 months', amount: '₱25,000.01 to ₱50,000.00', interest: '8% per annum', serviceCharge: '2%' },
    ],
    qualification: 'Regular employee of CLIMBS with at least 6 months of service',
    security: 'Share Capital at least ₱5,000.00',
    loanAmount: 'Variable',
    approvalLimits: ['Manager — ₱50,000.00 and below'],
    processingTime: '1 working day upon receipt of application form',
    renewal: 'Anytime',
    documents: ['Loan Application Form', 'Certificate of Net Take Home Pay', 'Doctor\'s prescription for medicines', 'Medical Certificate', 'Photocopy of receipts (laboratory & MC)', 'Admission Slip & Billing', 'Reasons for availment: Calamity / Death (immediate family) / Chronic Diseases & Ailments / Fortuitous events'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'educational',
    title: 'Educational Loan',
    icon: '🎓',
    color: '#1a6b3a',
    effective: 'January 1, 2026',
    terms: { term: '10 months', amount: '₱50,000.00', interest: '10% per annum', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS with at least 1 year membership in CEC',
    security: 'Share Capital at least ₱5,000.00 + Retirement Pay Computation',
    loanAmount: 'Maximum amount of ₱50,000.00',
    approvalLimits: ['Manager — ₱50,000.00 and below'],
    processingTime: '5 working days upon receipt of application form',
    renewal: 'Semester (college) / Annual (K-12)',
    documents: ['Loan Application Form', 'Certificate of Net Take Home Pay', 'Billing Statement &/or School Assessment duly signed by the School Registrar', 'Official Receipt'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'cashadvance',
    title: 'Cash Advance Loan',
    icon: '💸',
    color: C.gold,
    effective: 'January 1, 2026',
    terms: { term: 'Payment upon release', amount: '80% of Actual Amount', interest: '1% per month', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS',
    security: 'Share Capital at least ₱5,000.00',
    loanAmount: '80% of Actual Amount',
    approvalLimits: ['Manager — ₱50,000.00 and below', 'CreCom — ₱50,000.01 to ₱150,000.00'],
    processingTime: 'Within 24 hours from receipt of loan application form',
    renewal: 'N/A',
    documents: ['Loan Application Form', 'Certificate from HR Manager or Comp. Ben Officer'],
    modeOfPayment: 'Every Incentive/Bonus released. Settlement of payment at the end of the year.',
  },
  {
    key: 'buyout',
    title: 'Buy Out Loan',
    icon: '🔄',
    color: '#c47d0e',
    effective: 'January 1, 2026',
    terms: { term: '60 months', amount: '80% Retirement Benefits', interest: '18%, diminishing', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS with at least 6 months of service',
    security: 'Share Capital at least ₱5,000.00 + Retirement Pay Computation',
    loanAmount: 'Retirement Benefit',
    approvalLimits: ['Manager — ₱50,000.00 and below', 'CreCom — ₱50,000.01 to ₱150,000.00', 'BOD — ₱150,000.01 and above'],
    processingTime: '7 working days upon receipt of application form',
    renewal: 'Upon full payment of the loan',
    documents: ['Loan Application Form', 'Co-maker Statement Form', 'Certificate of Net Take Home Pay', 'Outstanding Statement of Account', 'If loan amount equals retirement benefit: collateral required (TCT or OR/CR of vehicle less than 3 years, free of encumbrance)'],
    modeOfPayment: 'Salary Deduction every 15th & 30th',
  },
  {
    key: 'rice',
    title: 'Rice Loan',
    icon: '🍚',
    color: '#8a6a1a',
    effective: 'January 1, 2026',
    terms: { term: '1 month', amount: 'Variable', interest: '1% per month', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS & CEC members',
    security: 'Share Capital at least ₱5,000.00',
    loanAmount: 'Variable',
    approvalLimits: ['Manager'],
    processingTime: '3 working days upon receipt of application form',
    renewal: 'Upon full payment of the loan',
    documents: ['Loan Application Form', 'Certificate of Net Take Home Pay'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'grocery',
    title: 'Grocery Loan',
    icon: '🛒',
    color: '#2e7d32',
    effective: 'January 1, 2026',
    terms: { term: '1 month', amount: '₱5,000.00', interest: '1% per month', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS & CEC members',
    security: 'Share Capital at least ₱5,000.00',
    loanAmount: '₱5,000.00',
    approvalLimits: ['Manager'],
    processingTime: 'Within 24 hours from receipt of loan application form',
    renewal: 'Full payment of previous grocery loan',
    documents: ['Loan Application Form', 'Certificate of Net Take Home Pay'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'travel',
    title: 'Travel Loan',
    icon: '✈️',
    color: '#1565c0',
    effective: 'January 1, 2026',
    terms: { term: '12 months', amount: '₱25,000.00', interest: '12% per annum', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS',
    security: 'Share Capital at least ₱5,000.00',
    loanAmount: '₱25,000.00',
    approvalLimits: ['Manager — ₱50,000.00 and below'],
    processingTime: '7 working days upon receipt of application form',
    renewal: 'Upon full payment of the loan',
    documents: ['Loan Application Form', 'Certificate of Net Take Home Pay'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'lad',
    title: 'Loan Against Deposit (LAD)',
    icon: '🏧',
    color: C.green,
    effective: 'January 1, 2026',
    terms: { term: '12 months', amount: '85% of total deposits', interest: '6% per annum', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS, CEC Members, No existing regular loan',
    security: 'Share Capital at least ₱5,000.00 + Savings',
    loanAmount: '85% of total deposits',
    approvalLimits: ['Manager — ₱50,000.00 and below', 'CreCom — ₱50,000.01 to ₱150,000.00', 'BOD — ₱150,000.01 and above'],
    processingTime: '5 working days upon receipt of application form',
    renewal: '6 months or 50% payment',
    documents: ['Loan Application Form', 'Certificate of Net Take Home Pay'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'housing',
    title: 'Housing / Home Improvement Loan',
    icon: '🏠',
    color: '#5d4037',
    effective: 'January 1, 2026',
    terms: { term: '60 months', amount: '80% Retirement Benefits', interest: '8% per annum', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS with at least 6 months of service',
    security: 'Share Capital at least ₱5,000.00 + Future Indemnity Claim (Loan Insurance)',
    loanAmount: 'Maximum amount of retirement benefits',
    approvalLimits: ['Manager — ₱50,000.00 and below', 'CreCom — ₱50,000.01 to ₱150,000.00', 'BOD — ₱150,000.01 and above'],
    processingTime: '7 working days upon receipt of application form',
    renewal: '50% payment',
    documents: ['Loan Application Form & Co-Maker Form', 'Bill of Materials signed by Carpenter/Contractor (Home Improvement)', 'Certificate of Net Take Home Pay', 'Share Capital Ledger', 'Loan Ledger', 'Loan Computation & Proceeds', 'Schedule of Loan Amortization', 'New/Additional: Contractor\'s Equity Quotation, Vicinity Map/Sketch of property', 'If loan = retirement benefit: collateral required'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
  },
  {
    key: 'solar',
    title: 'Solar Solutions Loan',
    icon: '☀️',
    color: '#e65100',
    effective: 'February 1, 2026',
    terms: { term: '36 months', amount: '80% Retirement Benefits', interest: '8% per annum', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS with at least 6 months of service',
    security: 'Share Capital at least ₱5,000.00 + Future Indemnity Claim (Loan Insurance)',
    loanAmount: 'Maximum amount of retirement benefits',
    approvalLimits: ['Manager — ₱50,000.00 and below', 'CreCom — ₱50,000.01 to ₱150,000.00', 'BOD — ₱150,000.01 and above'],
    processingTime: '7 working days upon receipt of application form',
    renewal: 'Full payment',
    documents: ['Loan Application Form & Co-Maker Form', 'Certificate of Net Take Home Pay', 'Share Capital Ledger', 'Loan Ledger', 'Loan Computation & Proceeds', 'Schedule of Loan Amortization', 'If loan = retirement benefit: collateral required'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
    badge: 'NEW',
  },
  {
    key: 'nonlife',
    title: 'Non-Life Insurance Loan',
    icon: '🛡️',
    color: '#37474f',
    effective: 'February 1, 2026',
    terms: { term: '12 months', amount: '₱50,000.00', interest: 'N/A', serviceCharge: '2%' },
    qualification: 'Regular employee of CLIMBS with at least 6 months of service',
    security: 'Share Capital at least ₱5,000.00',
    loanAmount: '₱50,000.00',
    approvalLimits: ['Manager — ₱50,000.00 and below'],
    processingTime: '7 working days upon receipt of application form',
    renewal: 'Full payment',
    documents: ['Loan Application Form', 'Certificate of Net Take Home Pay', 'Photocopy of SOA from NL department', 'Photocopy of Policy from NL department'],
    modeOfPayment: 'Monthly Salary Deduction every 15th & 30th',
    badge: 'NEW',
  },
];

const LoanCard = ({ loan, expanded, onToggle }) => {
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: expanded ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [expanded]);

  const isMultiTerm = Array.isArray(loan.terms);

  const Row = ({ label, value }) => (
    <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.07)' }}>
      <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textMuted, width: 110, flexShrink: 0 }}>{label}</Text>
      <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.text, flex: 1, lineHeight: 18 }}>{value}</Text>
    </View>
  );

  return (
    <GCard style={{ padding: 0, overflow: 'hidden', marginBottom: 12, borderTopWidth: 3, borderTopColor: loan.color }}>
      {/* Header — always visible */}
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: loan.color + '22', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 20 }}>{loan.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: loan.color }}>{loan.title}</Text>
            {loan.badge && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: C.green }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#fff' }}>{loan.badge}</Text>
              </View>
            )}
          </View>
          <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginTop: 1 }}>Effective: {loan.effective}</Text>
          {!expanded && (
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textSec, marginTop: 3 }} numberOfLines={1}>
              {isMultiTerm ? 'Variable terms' : `${loan.terms.term} · ${loan.terms.amount} · ${loan.terms.interest}`}
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 18, color: C.textMuted }}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Expandable body */}
      {expanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          {/* Term table */}
          <View style={{ backgroundColor: loan.color + '15', borderRadius: 10, padding: 10, marginBottom: 12 }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: loan.color, letterSpacing: 1.5, marginBottom: 8 }}>TERM OF LOAN & RATES</Text>
            {isMultiTerm ? (
              <>
                <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                  {['Term', 'Amount', 'Interest', 'Service'].map(h => (
                    <Text key={h} style={{ flex: 1, fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: loan.color, textAlign: 'center' }}>{h}</Text>
                  ))}
                </View>
                {loan.terms.map((t, i) => (
                  <View key={i} style={{ flexDirection: 'row', paddingVertical: 4, borderTopWidth: 1, borderColor: 'rgba(15,30,53,0.08)' }}>
                    {[t.term, t.amount, t.interest, t.serviceCharge].map((v, j) => (
                      <Text key={j} style={{ flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.text, textAlign: 'center', lineHeight: 15 }}>{v}</Text>
                    ))}
                  </View>
                ))}
              </>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[['Max Term', loan.terms.term], ['Max Amount', loan.terms.amount], ['Interest', loan.terms.interest], ['Service Charge', loan.terms.serviceCharge]].map(([l, v]) => (
                  <View key={l} style={{ minWidth: 120, flex: 1 }}>
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: loan.color }}>{l}</Text>
                    <Text style={{ fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: C.text, marginTop: 2 }}>{v}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Row label="Qualification" value={loan.qualification} />
          <Row label="Security" value={loan.security} />
          <Row label="Loan Amount" value={loan.loanAmount} />
          <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.07)' }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textMuted, width: 110, flexShrink: 0 }}>Approval Limits</Text>
            <View style={{ flex: 1 }}>
              {loan.approvalLimits.map((a, i) => (
                <Text key={i} style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.text, lineHeight: 20 }}>• {a}</Text>
              ))}
            </View>
          </View>
          <Row label="Processing Time" value={loan.processingTime} />
          <Row label="Renewal" value={loan.renewal} />
          <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.07)' }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textMuted, width: 110, flexShrink: 0 }}>Documents</Text>
            <View style={{ flex: 1 }}>
              {loan.documents.map((d, i) => (
                <Text key={i} style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.text, lineHeight: 20 }}>• {d}</Text>
              ))}
            </View>
          </View>
          <Row label="Mode of Payment" value={loan.modeOfPayment} />
        </View>
      )}
    </GCard>
  );
};

const GuidelinesView = ({ contentHeight }) => {
  const [expanded, setExpanded] = useState(null);
  const toggle = key => setExpanded(prev => prev === key ? null : key);
  return (
    <ScrollView contentContainerStyle={[s.pageOuter, { paddingBottom: 80 }]} showsVerticalScrollIndicator={true} style={contentHeight ? { height: contentHeight } : undefined}>
      <Text style={s.pageTitle}>📖 Loan Guidelines</Text>
      <Text style={s.pageSub}>Tap each loan type to view full details. Effective January 1, 2026.</Text>
      {LOAN_TYPES.map(loan => (
        <LoanCard key={loan.key} loan={loan} expanded={expanded === loan.key} onToggle={() => toggle(loan.key)} />
      ))}
    </ScrollView>
  );
};

const EditProfileView = ({ member, contentHeight }) => {
  const af0 = member.appForm || {};

  // Basic contact fields
  const [contact, setContact] = useState(member.contact || af0.contactNo || '');
  const [email,   setEmail]   = useState(member.email   || '');
  const [address, setAddress] = useState(member.address || af0.presentAddress || '');

  // Photo
  const [photoUri,   setPhotoUri]   = useState(member.photoURL || null);
  const [uploading,  setUploading]  = useState(false);

  // App form editable fields
  const [salutation,  setSalutation]  = useState(af0.salutation  || '');
  const [suffix,      setSuffix]      = useState(af0.suffix      || '');
  const [dob,         setDob]         = useState(af0.dob         || '');
  const [placeOfBirth,setPlaceOfBirth]= useState(af0.placeOfBirth|| '');
  const [religion,    setReligion]    = useState(af0.religion    || '');
  const [religionOther,setReligionOther]=useState(af0.religionOther||'');
  const [civilStatus, setCivilStatus] = useState(af0.civilStatus || '');
  const [numDependents,setNumDependents]=useState(af0.numDependents||'0');
  const [presentAddress,setPresentAddress]=useState(af0.presentAddress||'');
  const [presentZip,  setPresentZip]  = useState(af0.presentZip  || '');
  const [empType,     setEmpType]     = useState(af0.empType     || '');
  const [employerName,setEmployerName]= useState(af0.employerName|| '');
  const [positionRank,setPositionRank]= useState(af0.positionRank|| '');
  const [monthlyIncome,setMonthlyIncome]=useState(af0.monthlyIncome||'');

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { alert('Permission needed to access photos.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const dataUri = `data:image/jpeg;base64,${asset.base64}`;
        setPhotoUri(dataUri);
      }
    } catch (e) { console.warn('Photo pick error:', e); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const updatedAppForm = {
        ...af0,
        salutation, suffix, dob, placeOfBirth,
        religion, religionOther, civilStatus, numDependents,
        presentAddress, presentZip,
        contactNo: contact,
        empType, employerName, positionRank, monthlyIncome,
      };
      await updateDoc(doc(db, 'members', member.uid), {
        contact, email, address,
        photoURL: photoUri || member.photoURL || null,
        appForm: updatedAppForm,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.warn(e); }
    finally { setSaving(false); }
  };

  const SectionHead = ({ title }) => (
    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, marginTop: 14, paddingBottom: 6, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.10)' }}>{title}</Text>
  );

  return (
    <ScrollView contentContainerStyle={[s.pageOuter, { paddingBottom: 60 }]}
      showsVerticalScrollIndicator={true}
      style={contentHeight ? { height: contentHeight } : undefined}
      keyboardShouldPersistTaps="handled">

      <Text style={s.pageTitle}>✏️ Edit Profile</Text>
      <Text style={s.pageSub}>Changes will reflect automatically in My Profile.</Text>

      {/* ── Profile Photo ── */}
      <GCard style={{ alignItems: 'center', padding: 20 }}>
        <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} style={{ alignItems: 'center', gap: 10 }}>
          {photoUri
            ? <Image source={{ uri: photoUri }} style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: C.gold }} />
            : (
              <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(201,168,76,0.25)', borderWidth: 3, borderColor: C.gold, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 30, color: C.gold }}>{mkInit(member.name)}</Text>
              </View>
            )
          }
          <View style={{ backgroundColor: C.navyMid, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.gold }}>📷  {photoUri ? 'Change Photo' : 'Upload Photo'}</Text>
          </View>
        </TouchableOpacity>
        {photoUri && (
          <TouchableOpacity onPress={() => setPhotoUri(null)} style={{ marginTop: 6 }}>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.red }}>✕ Remove photo</Text>
          </TouchableOpacity>
        )}
        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginTop: 6, textAlign: 'center' }}>
          Square photo recommended · max 1MB
        </Text>
      </GCard>

      {/* ── Contact Info ── */}
      <GCard>
        <SectionHead title="📞 Contact Information" />
        <DField label="CONTACT NUMBER" value={contact} onChangeText={setContact} placeholder="e.g. 09171234567" keyboardType="phone-pad" />
        <DField label="EMAIL ADDRESS"  value={email}   onChangeText={setEmail}   placeholder="e.g. juan@email.com" keyboardType="email-address" />
        <DField label="HOME ADDRESS"   value={address} onChangeText={setAddress} placeholder="e.g. Cagayan de Oro City" />
      </GCard>

      {/* ── Personal Details ── */}
      <GCard>
        <SectionHead title="👤 Personal Details" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>SALUTATION</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 11 }}>
              {['Mr.','Mrs.','Ms.'].map(opt => (
                <TouchableOpacity key={opt} onPress={() => setSalutation(opt)}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: salutation === opt ? C.gold : 'rgba(15,30,53,0.18)', backgroundColor: salutation === opt ? 'rgba(201,168,76,0.15)' : C.surface }}>
                  <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.navy }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <DField label="SUFFIX" value={suffix} onChangeText={setSuffix} placeholder="Jr., Sr., II" />
        </View>
        <DField label="DATE OF BIRTH (MM/DD/YYYY)" value={dob} onChangeText={setDob} placeholder="e.g. 01/15/1990" />
        <DField label="PLACE OF BIRTH" value={placeOfBirth} onChangeText={setPlaceOfBirth} placeholder="City / Municipality, Province" />
        <Text style={s.fieldLabel}>CIVIL STATUS</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 11 }}>
          {['Single','Married','Legally Separated','Others'].map(opt => (
            <TouchableOpacity key={opt} onPress={() => setCivilStatus(opt)}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: civilStatus === opt ? C.gold : 'rgba(15,30,53,0.18)', backgroundColor: civilStatus === opt ? 'rgba(201,168,76,0.15)' : C.surface }}>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.navy }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <DField label="NUMBER OF DEPENDENTS" value={numDependents} onChangeText={setNumDependents} placeholder="0" keyboardType="numeric" />
        <DField label="RELIGION" value={religion} onChangeText={setReligion} placeholder="e.g. Roman Catholic" />
        {religion === 'Others' && <DField label="SPECIFY RELIGION" value={religionOther} onChangeText={setReligionOther} placeholder="Enter religion" />}
      </GCard>

      {/* ── Present Address ── */}
      <GCard>
        <SectionHead title="🏠 Present Address" />
        <DField label="PRESENT ADDRESS" value={presentAddress} onChangeText={setPresentAddress} placeholder="House No., Street, Barangay, City" />
        <DField label="ZIP CODE" value={presentZip} onChangeText={setPresentZip} placeholder="e.g. 9000" keyboardType="numeric" />
      </GCard>

      {/* ── Employment ── */}
      <GCard>
        <SectionHead title="💼 Employment" />
        <Text style={s.fieldLabel}>EMPLOYMENT STATUS</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 11 }}>
          {['Employed','Self-Employed','Unemployed'].map(opt => (
            <TouchableOpacity key={opt} onPress={() => setEmpType(opt)}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: empType === opt ? C.gold : 'rgba(15,30,53,0.18)', backgroundColor: empType === opt ? 'rgba(201,168,76,0.15)' : C.surface }}>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.navy }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {empType === 'Employed' && <>
          <DField label="EMPLOYER NAME"    value={employerName}   onChangeText={setEmployerName}   placeholder="Name of employer" />
          <DField label="POSITION / RANK"  value={positionRank}   onChangeText={setPositionRank}   placeholder="e.g. Teacher I" />
          <DField label="MONTHLY INCOME (₱)" value={monthlyIncome} onChangeText={setMonthlyIncome} placeholder="e.g. 25000" keyboardType="numeric" />
        </>}
      </GCard>

      <SaveBtn onPress={save} loading={saving} done={saved} label="Save All Changes" doneLabel="Profile Updated!" />
    </ScrollView>
  );
};

const ChangePasswordView = ({ member, contentHeight }) => {
  const [oldPw, setOldPw]   = useState('');
  const [newPw, setNewPw]   = useState('');
  const [confPw, setConfPw] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError]   = useState('');
  const [done,  setDone]    = useState(false);
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (newPw.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPw !== confPw) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      const snap = await getDocs(query(collection(db, 'members'), where('userId', '==', member.userId)));
      if (snap.empty) throw new Error('Member not found.');
      if (snap.docs[0].data().passwordHash !== hashPw(oldPw)) throw new Error('Current password is incorrect.');
      await updateDoc(doc(db, 'members', member.uid), { passwordHash: hashPw(newPw), updatedAt: serverTimestamp() });
      setDone(true); setOldPw(''); setNewPw(''); setConfPw('');
      setTimeout(() => setDone(false), 3000);
    } catch (e) { setError(e.message || 'Failed.'); }
    finally { setLoading(false); }
  };
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={true} style={contentHeight ? { height: contentHeight } : undefined}>
      <Text style={s.pageTitle}>🔑 Change Password</Text>
      <GCard>
        <DField label="CURRENT PASSWORD"     value={oldPw}  onChangeText={v => { setOldPw(v);  setError(''); }} placeholder="Current password"    secureEntry={!showOld} showToggle onToggle={() => setShowOld(p => !p)} />
        <DField label="NEW PASSWORD"         value={newPw}  onChangeText={v => { setNewPw(v);  setError(''); }} placeholder="Min. 6 characters"    secureEntry={!showNew} showToggle onToggle={() => setShowNew(p => !p)} />
        <DField label="CONFIRM NEW PASSWORD" value={confPw} onChangeText={v => { setConfPw(v); setError(''); }} placeholder="Re-enter new password" secureEntry={!showNew} />
        {error ? <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.red, textAlign: 'center', marginBottom: 8 }}>{error}</Text> : null}
        {done  ? <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.green, textAlign: 'center', marginBottom: 8 }}>✓ Password changed!</Text> : null}
        <SaveBtn onPress={save} loading={loading} done={false} label="Update Password" />
      </GCard>
    </ScrollView>
  );
};

const NotifsView = ({ member, contentHeight }) => {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    return onSnapshot(query(collection(db, 'members', member.uid, 'notifications'), orderBy('createdAt', 'desc')), snap => { setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false));
  }, [member.uid]);
  const markRead = async id => updateDoc(doc(db, 'members', member.uid, 'notifications', id), { read: true });
  const sysNotifs = member.approvedAt ? [{ id: 'sys', icon: '✅', title: 'Account Approved!', message: `Your membership was approved on ${fmtDate(member.approvedAt)}. You now have full access.`, color: C.green, createdAt: member.approvedAt, read: true }] : [];
  const all = [...sysNotifs, ...notifs];
  if (loading) return <Spinner msg="Loading notifications..." />;
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={true} style={contentHeight ? { height: contentHeight } : undefined}>
      <Text style={s.pageTitle}>🔔 Notifications</Text>
      <Text style={s.pageSub}>{all.filter(n => !n.read).length} unread.</Text>
      {all.length === 0 && <GCard style={{ alignItems: 'center', padding: 40 }}><Text style={{ fontSize: 36, marginBottom: 10 }}>🔔</Text><Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center' }}>No notifications yet.</Text></GCard>}
      {all.map(n => (
        <TouchableOpacity key={n.id} style={[s.notifCard, { borderLeftColor: n.color || C.gold, opacity: n.read ? 0.60 : 1 }]} onPress={() => !n.read && n.id !== 'sys' && markRead(n.id)} activeOpacity={0.8}>
          <View style={[s.notifIcon, { backgroundColor: (n.color || C.gold) + '22' }]}><Text style={{ fontSize: 18 }}>{n.icon || '🔔'}</Text></View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <Text style={s.notifTitle}>{n.title}</Text>
              {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.color || C.gold }} />}
            </View>
            <Text style={s.notifMsg}>{n.message}</Text>
            <Text style={s.notifTime}>{fmtTime(n.createdAt)}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// ─── CHAT DIRECT VIEW (full page, sidebar-triggered) ─────────────────────────
const ChatDirectView = ({ member, chatType, contentHeight }) => {
  const [roomId, setRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [screen, setScreen] = useState(chatType === 'admin' ? 'room' : 'list');
  const scrollRef = useRef(null);

  // Setup room
  useEffect(() => {
    if (chatType === 'admin') {
      const rId = `admin_${member.uid}`;
      setDoc(doc(db, 'chatRooms', rId), {
        type: 'admin', memberId: member.uid, memberName: member.name,
        createdAt: serverTimestamp(), lastMessage: null, lastAt: serverTimestamp(),
      }, { merge: true }).then(() => setRoomId(rId));
    } else if (chatType === 'members') {
      setDoc(doc(db, 'chatRooms', 'group_members'), {
        type: 'group', name: 'Members Group Chat',
        createdAt: serverTimestamp(), lastMessage: null, lastAt: serverTimestamp(),
      }, { merge: true }).then(() => setRoomId('group_members'));
    }
  }, [chatType, member.uid]);

  // Load active members for DM list
  useEffect(() => {
    if (chatType !== 'members') return;
    const q = query(collection(db, 'members'), where('status', '==', 'Active'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() })).filter(m => m.id !== member.uid));
    });
    return unsub;
  }, [chatType]);

  // Load messages for active room
  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, 'chatRooms', roomId, 'messages'), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [roomId]);

  const send = async () => {
    if (!text.trim() || sending || !roomId) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: member.uid, senderName: member.name,
        text: text.trim(), createdAt: serverTimestamp(), readBy: [member.uid],
      });
      await updateDoc(doc(db, 'chatRooms', roomId), {
        lastMessage: text.trim(), lastAt: serverTimestamp(), lastSender: member.name,
      });
      setText('');
    } catch (e) { console.warn(e); }
    finally { setSending(false); }
  };

  const selectDM = async (target) => {
    const dmId = [member.uid, target.uid].sort().join('_');
    await setDoc(doc(db, 'chatRooms', dmId), {
      type: 'dm', members: [member.uid, target.uid],
      memberNames: { [member.uid]: member.name, [target.uid]: target.name },
      createdAt: serverTimestamp(), lastMessage: null, lastAt: serverTimestamp(),
    }, { merge: true });
    setRoomId(dmId);
    setSelectedMember(target);
    setScreen('dm');
  };

  const fmtT = ts => { if (!ts) return ''; const d = ts?.toDate?.() || new Date(ts); return d.toLocaleString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true }); };
  const mkI = name => (name || '?').split(/[\s,]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const RoomMessages = ({ title, subtitle }) => (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      {/* Header */}
      <LinearGradient colors={['#1a2d4e', '#243554']} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
        {chatType === 'members' && (
          <TouchableOpacity onPress={() => { setScreen('list'); setSelectedMember(null); }}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: C.gold, fontSize: 16 }}>←</Text>
          </TouchableOpacity>
        )}
        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(201,168,76,0.25)', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 18 }}>{chatType === 'admin' ? '🛡️' : screen === 'dm' ? '💬' : '👥'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#fff' }}>{title}</Text>
          <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{subtitle}</Text>
        </View>
        {chatType === 'admin' && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(26,138,74,0.30)', borderWidth: 1, borderColor: 'rgba(26,138,74,0.60)' }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#4cde8a' }}>● Live</Text>
          </View>
        )}
      </LinearGradient>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: 'rgba(152,186,213,0.12)' }}
        contentContainerStyle={{ padding: 14, paddingBottom: 10 }}
        showsVerticalScrollIndicator={true}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>{chatType === 'admin' ? '🛡️' : screen === 'dm' ? '💬' : '👥'}</Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 }}>
              {chatType === 'admin' ? 'Send a message to Admin.\nWe\'ll get back to you shortly.' :
               screen === 'dm' ? `Start chatting with ${selectedMember?.name}.` :
               'Welcome to the Group Chat!\nSay hello to your co-members.'}
            </Text>
          </View>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.senderId === member.uid;
          const prev = messages[i - 1];
          const showName = !isMine && msg.senderId !== prev?.senderId && chatType !== 'admin' && screen !== 'dm';
          return (
            <View key={msg.id} style={[{ marginBottom: 8, maxWidth: '78%' }, isMine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
              {showName && <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, marginBottom: 3, paddingLeft: 2 }}>{msg.senderName}</Text>}
              <View style={[{ borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
                isMine ? { backgroundColor: '#1a2d4e', borderBottomRightRadius: 4 } : { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#0f1e35', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }]}>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: isMine ? '#fff' : C.navy, lineHeight: 19 }}>{msg.text}</Text>
              </View>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: C.textMuted, marginTop: 3, paddingHorizontal: 2, textAlign: isMine ? 'right' : 'left' }}>{fmtT(msg.createdAt)}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Input */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: 'rgba(255,255,255,0.80)', borderTopWidth: 1, borderColor: 'rgba(15,30,53,0.10)' }}>
        <TextInput
          style={{ flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy, backgroundColor: 'rgba(240,246,252,0.90)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: 'rgba(200,218,235,0.75)', maxHeight: 90 }}
          value={text} onChangeText={setText}
          placeholder="Type a message..." placeholderTextColor={C.textMuted}
          multiline maxLength={500}
        />
        <TouchableOpacity onPress={send} disabled={!text.trim() || sending}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() ? '#1a2d4e' : 'rgba(15,30,53,0.20)', justifyContent: 'center', alignItems: 'center' }}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 18 }}>➤</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Member List (for co-member chat)
  if (chatType === 'members' && screen === 'list') {
    const filtered = members.filter(m => (m.name || '').toLowerCase().includes(search.toLowerCase()) || (m.userId || '').includes(search));
    return (
      <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={true} style={contentHeight ? { height: contentHeight } : undefined}>
        <Text style={s.pageTitle}>👥 Co-member Chat</Text>
        <Text style={s.pageSub}>Chat with approved members. Choose a conversation below.</Text>
        {/* Group Chat */}
        <TouchableOpacity onPress={() => { setRoomId('group_members'); setScreen('group'); }}
          style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
          <LinearGradient colors={['#1a2d4e', '#243554']} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
            <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(201,168,76,0.25)', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 22 }}>👥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: '#fff' }}>Members Group Chat</Text>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Chat with all approved members</Text>
            </View>
            <Text style={{ color: C.gold, fontSize: 20 }}>›</Text>
          </LinearGradient>
        </TouchableOpacity>
        {/* DM Search */}
        <Text style={s.sHead}>💬 DIRECT MESSAGES</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.90)', marginBottom: 12 }}>
          <Text style={{ color: C.textMuted, fontSize: 14, marginRight: 6 }}>🔍</Text>
          <TextInput style={{ flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy }} value={search} onChangeText={setSearch} placeholder="Search member..." placeholderTextColor={C.textMuted} autoCapitalize="none" />
        </View>
        {filtered.map(m => (
          <TouchableOpacity key={m.id} onPress={() => selectDM(m)} activeOpacity={0.8}>
            <GCard style={{ padding: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(201,168,76,0.22)', borderWidth: 1.5, borderColor: C.gold, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.gold }}>{mkI(m.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy }}>{m.name}</Text>
                  <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted }}>{m.userId}</Text>
                </View>
                <Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>
              </View>
            </GCard>
          </TouchableOpacity>
        ))}
        {filtered.length === 0 && <GCard style={{ alignItems: 'center', padding: 32 }}><Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted }}>No members found.</Text></GCard>}
      </ScrollView>
    );
  }

  // Room view (admin / group / DM)
  const roomTitle =
    chatType === 'admin' ? 'Admin / Support' :
    screen === 'dm' ? (selectedMember?.name || 'Direct Message') :
    'Members Group Chat';
  const roomSub =
    chatType === 'admin' ? 'Live support · CESLA MPC Admin' :
    screen === 'dm' ? 'Direct Message' :
    'Group · All Approved Members';

  return (
    <View style={[{ flex: 1 }, contentHeight ? { height: contentHeight } : undefined]}>
      <RoomMessages title={roomTitle} subtitle={roomSub} />
    </View>
  );
};

// ─── MEMBER DASHBOARD ─────────────────────────────────────────────────────────
const MemberDashboard = ({ memberInit, onLogout, isWide, isSmall }) => {
  const { height, isMobile } = useRwd();
  const topbarHeight = Platform.OS === 'web' ? 62 : isSmall ? 58 : 62;
  const contentHeight = height - topbarHeight;

  const [nav,        setNav]        = useState('overview');
  const [navHistory, setNavHistory] = useState(['overview']); // for back button
  const [member, setMember] = useState(memberInit);
  const [drawer, setDrawer] = useState(false);
  const [unread, setUnread] = useState(0);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Real-time member sync
  useEffect(() => { if (!memberInit?.uid) return; return onSnapshot(doc(db, 'members', memberInit.uid), snap => { if (snap.exists()) setMember({ uid: snap.id, ...snap.data() }); }); }, [memberInit?.uid]);
  // Unread count
  useEffect(() => { if (!memberInit?.uid) return; return onSnapshot(query(collection(db, 'members', memberInit.uid, 'notifications'), where('read', '==', false)), snap => setUnread(snap.size)); }, [memberInit?.uid]);

  const switchNav = key => {
    Animated.parallel([Animated.timing(fadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 10, duration: 130, useNativeDriver: true })]).start(() => {
      setNavHistory(prev => [...prev, key]);
      setNav(key);
      Animated.parallel([Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true })]).start();
    });
  };

  // Go back in nav history
  const goBack = () => {
    if (navHistory.length <= 1) return;
    const newHistory = navHistory.slice(0, -1);
    const prevNav = newHistory[newHistory.length - 1];
    Animated.parallel([Animated.timing(fadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 10, duration: 130, useNativeDriver: true })]).start(() => {
      setNavHistory(newHistory);
      setNav(prevNav);
      Animated.parallel([Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true })]).start();
    });
  };

  const renderContent = () => {
    const h = contentHeight;
    const m = isMobile;
    switch (nav) {
      case 'overview':     return <OverviewView     member={member} onNav={switchNav} contentHeight={h} isMobile={m} />;
      case 'profile':      return <ProfileView      member={member} contentHeight={h} isMobile={m} />;
      case 'appform':      return <AppFormView       member={member} contentHeight={h} isMobile={m} />;
      case 'savings':      return <FinanceView title="Savings"       icon="💰" value={member.savings} label="Total Savings Balance" color={C.green}  member={member} contentHeight={h} isMobile={m} />;
      case 'sharecap':     return <FinanceView title="Share Capital" icon="📊" value={member.shares}  label="Total Share Capital"   color={C.gold}   member={member} contentHeight={h} isMobile={m} />;
      case 'timedeposit':  return <FinanceView title="Time Deposit"  icon="🏦" value={0}              label="Time Deposit Balance"  color={C.blueLt} member={member} contentHeight={h} isMobile={m} />;
      case 'applyloan':    return <ApplyLoanView     member={member} contentHeight={h} isMobile={m} />;
      case 'myloans':      return <MyLoansView       member={member} contentHeight={h} isMobile={m} />;
      case 'guidelines':   return <GuidelinesView    contentHeight={h} isMobile={m} />;
      case 'editprofile':  return <EditProfileView   member={member} contentHeight={h} isMobile={m} />;
      case 'changepw':     return <ChangePasswordView member={member} contentHeight={h} isMobile={m} />;
      case 'notifs':       return <NotifsView        member={member} contentHeight={h} isMobile={m} />;
      case 'chat_admin':   return <ChatDirectView    member={member} chatType="admin"   contentHeight={h} />;
      case 'chat_members': return <ChatDirectView    member={member} chatType="members" contentHeight={h} />;
      default:             return <OverviewView      member={member} onNav={switchNav} contentHeight={h} isMobile={m} />;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Top bar */}
      <View style={[s.dashTopbar, { paddingTop: Platform.OS === 'web' ? 0 : 44 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {!isWide && <TouchableOpacity style={s.menuBtn} onPress={() => setDrawer(v => !v)}><Text style={{ color: '#fff', fontSize: 18 }}>☰</Text></TouchableOpacity>}
          <View style={s.dashLogo}><Text style={s.dashLogoTxt}>CS</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[s.dashTitle, { fontSize: isSmall ? 12 : 14 }]} numberOfLines={1}>Member Dashboard</Text>
            {!isSmall && <Text style={s.dashSub}>CESLA MPC · CLIMBS Employee Cooperative</Text>}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={s.bellBtn} onPress={() => switchNav('notifs')}>
            <Text style={{ fontSize: 16 }}>🔔</Text>
            {unread > 0 && <View style={s.bellBadge}><Text style={s.bellBadgeTxt}>{unread > 9 ? '9+' : unread}</Text></View>}
          </TouchableOpacity>
          {/* Profile avatar — tappable → goes to My Profile */}
          <TouchableOpacity onPress={() => switchNav('profile')} activeOpacity={0.8}>
            <MemberAvatar member={member} size={32} />
          </TouchableOpacity>
          {isWide && <Text style={{ fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.85)', maxWidth: 120 }} numberOfLines={1}>{member.name}</Text>}
        </View>
      </View>
      {/* Body */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {isWide && <MemberSidebar active={nav} onNav={switchNav} unread={unread} onLogout={onLogout} onBack={goBack} canGoBack={navHistory.length > 1} />}
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {renderContent()}
        </Animated.View>
      </View>
      {/* Mobile drawer — starts BELOW topbar so it doesn't cover it */}
      {!isWide && drawer && (
        <View style={{ position: 'absolute', top: topbarHeight, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
          {/* Backdrop */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.50)' }}
            activeOpacity={1} onPress={() => setDrawer(false)} />
          {/* Sidebar panel — full height below topbar */}
          <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 220, flexDirection: 'column' }}>
            <MemberSidebar active={nav} onNav={switchNav} onClose={() => setDrawer(false)} unread={unread}
              onLogout={() => { setDrawer(false); onLogout(); }}
              onBack={() => { goBack(); setDrawer(false); }}
              canGoBack={navHistory.length > 1} />
          </View>
        </View>
      )}
      {/* Floating Chat System */}
      <ChatSystem currentMember={member} />
    </View>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — CoopScreen handles EVERYTHING in one screen
// Login → Register → (admin approves) → Dashboard — no navigation.navigate()
// ═════════════════════════════════════════════════════════════════════════════
export default function CoopScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({ NotoSerif_700Bold, NotoSerif_700Bold_Italic, GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold });

  // view: 'login' | 'register' | 'success' | 'dashboard'
  const [view,   setView]   = useState('login');
  const [member, setMember] = useState(null);

  // Login state
  const [userId,       setUserId]       = useState('');
  const [pw,           setPw]           = useState('');
  const [showPw,       setShowPw]       = useState(false);
  const [loginErr,     setLoginErr]     = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [lastName,    setLastName]    = useState('');
  const [firstName,   setFirstName]   = useState('');
  const [middleName,  setMiddleName]  = useState('');
  const [regPw,       setRegPw]       = useState('');
  const [regConfirm,  setRegConfirm]  = useState('');
  const [showRegPw,   setShowRegPw]   = useState(false);
  const [showRegConf, setShowRegConf] = useState(false);
  const [genUid,      setGenUid]      = useState('Loading...');
  const [copied,      setCopied]      = useState(false);
  const [regErrors,   setRegErrors]   = useState({});
  const [regLoading,  setRegLoading]  = useState(false);
  const [regMember,   setRegMember]   = useState(null);

  // Animations
  const hdrFade  = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-18)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardTrans= useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(hdrTrans, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(cardFade, { toValue: 1, duration: 550, delay: 180, useNativeDriver: true }),
      Animated.timing(cardTrans,{ toValue: 0, duration: 550, delay: 180, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (view === 'register') {
      setGenUid('Loading...');
      generateNextUserId().then(setGenUid).catch(() => setGenUid('CESLA-2026-XXXXX'));
    }
  }, [view]);

  const switchView = next => {
    Animated.timing(cardFade, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      setView(next); setLoginErr(''); setRegErrors({});
      Animated.timing(cardFade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    });
  };

  const handleLogin = async () => {
    if (!userId.trim()) { setLoginErr('Please enter your User ID.'); return; }
    if (!pw.trim())     { setLoginErr('Please enter your password.'); return; }
    setLoginLoading(true); setLoginErr('');
    try {
      const m = await loginByUserIdFS(userId.trim(), pw);
      setMember(m);
      setView('dashboard'); // ← stays in same screen, no navigation needed
    } catch (e) { setLoginErr(e.message || 'Invalid User ID or password.'); }
    finally { setLoginLoading(false); }
  };

  const handleRegister = async () => {
    const e = {};
    if (!lastName.trim())     e.lastName  = 'Last name is required.';
    if (!firstName.trim())    e.firstName = 'First name is required.';
    if (regPw.length < 6)     e.pw        = 'Min. 6 characters.';
    if (regPw !== regConfirm) e.cpw       = 'Passwords do not match.';
    if (Object.keys(e).length > 0) { setRegErrors(e); return; }
    setRegLoading(true);
    try {
      const m = await registerMemberFS({ lastName: lastName.trim(), firstName: firstName.trim(), middleName: middleName.trim(), password: regPw });
      setRegMember(m); switchView('success');
    } catch (err) { setRegErrors({ general: err.message || 'Registration failed.' }); }
    finally { setRegLoading(false); }
  };

  const handleCopy = async uid => { await Clipboard.setStringAsync(uid); setCopied(true); setTimeout(() => setCopied(false), 2500); };
  const handleLogout = () => {
    setMember(null); setUserId(''); setPw(''); setView('login');
    // Reset navigation stack — skip AdminScreen to avoid auto-redirecting to ManageCanteenScreen
    if (navigation) {
      const state = navigation.getState();
      const routes = state?.routes || [];
      const prevRoute = routes[routes.length - 2];
      if (prevRoute && prevRoute.name === 'AdminScreen') {
        navigation.navigate('Home');
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    }
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1 }}><AppBg /><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#c9a84c" /></View></View>;
  }

  // ── DASHBOARD — full screen, no header ──────────────────────────────────
  if (view === 'dashboard' && member) {
    return (
      <View style={{ flex: 1 }}>
        <AppBg />
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <MemberDashboard memberInit={member} onLogout={handleLogout} isWide={isWide} isSmall={isSmall} />
      </View>
    );
  }

  // ── AUTH SCREENS ─────────────────────────────────────────────────────────
  const headerLabel =
    view === 'register' ? <><Text style={s.headerWhite}>Register as </Text><Text style={s.headerGold}>New Member</Text></> :
    view === 'success'  ? <><Text style={s.headerWhite}>Registration </Text><Text style={s.headerGold}>Complete!</Text></> :
                          <><Text style={s.headerWhite}>Member </Text><Text style={s.headerGold}>Login</Text></>;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AppBg />

      {/* Header */}
      <Animated.View style={[s.headerWrap, { paddingTop: Platform.OS === 'web' ? 16 : 50, marginHorizontal: isWide ? 20 : isSmall ? 10 : 16, opacity: hdrFade, transform: [{ translateY: hdrTrans }] }]}>
        <View style={[s.header, { paddingHorizontal: isWide ? 36 : 14, paddingVertical: isWide ? 16 : 10 }]}>
          <TouchableOpacity style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => {
              if (view !== 'login') {
                switchView('login');
              } else if (navigation) {
                const state = navigation.getState();
                const routes = state?.routes || [];
                const prevRoute = routes[routes.length - 2];
                if (prevRoute && prevRoute.name === 'AdminScreen') {
                  navigation.navigate('Home');
                } else if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Home');
                }
              }
            }}>
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={[s.headerH1, { fontSize: isWide ? 22 : isSmall ? 14 : 17 }]} numberOfLines={1} adjustsFontSizeToFit>{headerLabel}</Text>
            <Text style={[s.headerSub, { fontSize: isWide ? 10 : 8 }]}>CESLA MULTI-PURPOSE COOPERATIVE</Text>
          </View>
          <View style={{ width: 40, flexShrink: 0 }} />
        </View>
      </Animated.View>

      {/* Body */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: isWide ? 60 : 20, paddingVertical: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={[s.card, { opacity: cardFade, transform: [{ translateY: cardTrans }], width: '100%', maxWidth: isWide ? 420 : 400 }]}>

            {/* ══ LOGIN ══ */}
            {view === 'login' && (
              <>
                <View style={s.avatarWrap}><LinearGradient colors={['rgba(201,168,76,0.30)', 'rgba(201,168,76,0.10)']} style={s.avatarGrad}><MaterialIcons name="person" size={isWide ? 34 : 28} color="#c9a84c" /></LinearGradient></View>
                <Text style={[s.cardTitle, { fontSize: isWide ? 22 : 19 }]}>Welcome Back!</Text>
                <Text style={s.cardSub}>Login to access your membership account</Text>
                <View style={s.fbBadge}><View style={s.fbDot} /><Text style={s.fbBadgeTxt}>Connected to Firebase · Real-time sync</Text></View>
                <View style={s.hintBox}><Text style={s.hintTxt}>{'🔑 Use your '}<Text style={s.hintBold}>User ID</Text>{' (e.g. '}<Text style={[s.hintBold, { color: '#c9a84c' }]}>CESLA-2026-00001</Text>{') and '}<Text style={[s.hintBold, { color: '#c9a84c' }]}>Password</Text>{' to login.'}</Text></View>
                <Field label="USER ID"  value={userId} onChangeText={v => { setUserId(v); setLoginErr(''); }} placeholder="CESLA-2026-00001" />
                <Field label="PASSWORD" value={pw}     onChangeText={v => { setPw(v);     setLoginErr(''); }} placeholder="Enter your password" secureEntry={!showPw} showToggle onToggle={() => setShowPw(p => !p)} />
                {loginErr ? <View style={s.errorBox}><MaterialIcons name="error-outline" size={14} color="#c0392b" style={{ marginTop: 1 }} /><Text style={s.errorTxt}>{loginErr}</Text></View> : null}
                <TouchableOpacity style={[s.primaryBtn, loginLoading && { opacity: 0.65 }]} onPress={handleLogin} activeOpacity={0.85} disabled={loginLoading}>
                  <LinearGradient colors={['#c9a84c', '#e8c87a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnGrad}>
                    {loginLoading ? <ActivityIndicator color="#0d1b3e" /> : <><Text style={s.primaryBtnArrow}>→</Text><Text style={s.primaryBtnTxt}>LOGIN</Text></>}
                  </LinearGradient>
                </TouchableOpacity>
                <View style={s.switchRow}><Text style={s.switchTxt}>Don't have an account? </Text><TouchableOpacity onPress={() => switchView('register')} activeOpacity={0.75}><Text style={s.switchLink}>Register as New Member</Text></TouchableOpacity></View>
              </>
            )}

            {/* ══ REGISTER ══ */}
            {view === 'register' && (
              <>
                <View style={s.avatarWrap}><LinearGradient colors={['rgba(201,168,76,0.30)', 'rgba(201,168,76,0.10)']} style={s.avatarGrad}><MaterialIcons name="person-add" size={isWide ? 30 : 24} color="#c9a84c" /></LinearGradient></View>
                <Text style={[s.cardTitle, { fontSize: isWide ? 22 : 19 }]}>Create Your Account</Text>
                <Text style={s.cardSub}>CESLA Multi-Purpose Cooperative · CLIMBS Employee</Text>
                <View style={s.stepRow}>
                  {[{ n: 1, lbl: 'Create\nAccount' }, { n: 2, lbl: 'Admin\nApproval' }, { n: 3, lbl: 'Login &\nAccess' }].map((step, i) => (
                    <View key={step.n} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={s.stepItem}><View style={[s.stepCircle, step.n === 1 && s.stepCircleActive]}><Text style={[s.stepNum, step.n === 1 && s.stepNumActive]}>{step.n}</Text></View><Text style={[s.stepLbl, step.n === 1 && s.stepLblActive]}>{step.lbl}</Text></View>
                      {i < 2 && <View style={s.stepLine} />}
                    </View>
                  ))}
                </View>
                <View style={s.uidBox}>
                  <View style={{ flex: 1 }}><Text style={s.uidLabel}>🔑 YOUR UNIQUE USER ID (GAMITON SA LOGIN)</Text><Text style={s.uidValue}>{genUid}</Text></View>
                  <TouchableOpacity style={[s.copyBtn, copied && s.copyBtnDone]} onPress={() => handleCopy(genUid)}><Text style={s.copyBtnTxt}>{copied ? '✓ Copied' : '📋 Copy'}</Text></TouchableOpacity>
                </View>
                <View style={s.uidWarning}><Text style={s.uidWarningTxt}>{'⚠️ I-save ang imong User ID! '}<Text style={s.uidWarningBold}>Kini gamiton sa pag-login human ma-approve sa admin.</Text></Text></View>
                <View style={s.fieldRow2}>
                  <FieldReg label="LAST NAME"  value={lastName}  onChangeText={v => { setLastName(v);  setRegErrors(e => ({ ...e, lastName: '' })); }}  placeholder="Dela Cruz" error={regErrors.lastName}  autoCapitalize="words" />
                  <FieldReg label="FIRST NAME" value={firstName} onChangeText={v => { setFirstName(v); setRegErrors(e => ({ ...e, firstName: '' })); }} placeholder="Juan"      error={regErrors.firstName} autoCapitalize="words" />
                </View>
                <View style={s.fieldRow2}>
                  <FieldReg label="MIDDLE NAME" value={middleName} onChangeText={v => setMiddleName(v)} placeholder="Santos (opt.)" autoCapitalize="words" />
                  <FieldReg label="PASSWORD"    value={regPw}      onChangeText={v => { setRegPw(v);      setRegErrors(e => ({ ...e, pw: '' })); }}  placeholder="Min. 6 chars" secureEntry={!showRegPw} showToggle onToggle={() => setShowRegPw(p => !p)} error={regErrors.pw} />
                </View>
                <View style={{ width: '100%' }}>
                  <FieldReg label="CONFIRM PASSWORD" value={regConfirm} onChangeText={v => { setRegConfirm(v); setRegErrors(e => ({ ...e, cpw: '' })); }} placeholder="Re-enter password" secureEntry={!showRegConf} showToggle onToggle={() => setShowRegConf(p => !p)} error={regErrors.cpw} />
                </View>
                {regErrors.general ? <View style={s.errorBox}><MaterialIcons name="error-outline" size={14} color="#c0392b" style={{ marginTop: 1 }} /><Text style={s.errorTxt}>{regErrors.general}</Text></View> : null}
                <TouchableOpacity style={[s.primaryBtn, regLoading && { opacity: 0.65 }]} onPress={handleRegister} activeOpacity={0.85} disabled={regLoading}>
                  <LinearGradient colors={['#c9a84c', '#e8c87a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnGrad}>
                    {regLoading ? <ActivityIndicator color="#0d1b3e" /> : <Text style={s.primaryBtnTxt}>CREATE ACCOUNT</Text>}
                  </LinearGradient>
                </TouchableOpacity>
                <View style={s.switchRow}><Text style={s.switchTxt}>Already have an account? </Text><TouchableOpacity onPress={() => switchView('login')} activeOpacity={0.75}><Text style={s.switchLink}>Login here</Text></TouchableOpacity></View>
              </>
            )}

            {/* ══ SUCCESS ══ */}
            {view === 'success' && regMember && (
              <>
                <View style={s.avatarWrap}><LinearGradient colors={['rgba(26,138,74,0.30)', 'rgba(26,138,74,0.10)']} style={s.avatarGrad}><MaterialIcons name="check-circle" size={isWide ? 32 : 28} color="#1a8a4a" /></LinearGradient></View>
                <Text style={[s.cardTitle, { fontSize: isWide ? 22 : 19 }]}>Registration Submitted!</Text>
                <Text style={s.cardSub}>Your account has been saved to Firebase. Wait for admin approval.</Text>
                <View style={[s.uidBox, { marginTop: 6 }]}>
                  <View style={{ flex: 1 }}><Text style={s.uidLabel}>🔑 YOUR USER ID (GAMITON SA LOGIN)</Text><Text style={s.uidValue}>{regMember.userId}</Text></View>
                  <TouchableOpacity style={[s.copyBtn, copied && s.copyBtnDone]} onPress={() => handleCopy(regMember.userId)}><Text style={s.copyBtnTxt}>{copied ? '✓ Copied' : '📋 Copy'}</Text></TouchableOpacity>
                </View>
                <View style={s.flowCard}>
                  {[{ icon: '✅', label: 'Account created in Firebase', done: true }, { icon: '🔔', label: 'Admin notified automatically', done: true }, { icon: '⏳', label: 'Waiting for admin approval', done: false }, { icon: '🔓', label: 'Login after approval', done: false }].map((step, i) => (
                    <View key={i} style={s.flowRow}><Text style={{ fontSize: 14 }}>{step.icon}</Text><Text style={[s.flowTxt, step.done && s.flowTxtDone]}>{step.label}</Text></View>
                  ))}
                </View>
                <View style={s.pendingBox}><MaterialIcons name="hourglass-empty" size={18} color="#c9a84c" /><Text style={s.pendingTxt}>Your account is <Text style={s.pendingBold}>Pending Admin Approval.</Text>{'\n'}Login after the admin activates your account.</Text></View>
                <TouchableOpacity style={s.primaryBtn} onPress={() => { setUserId(regMember.userId); setPw(''); setRegMember(null); switchView('login'); }} activeOpacity={0.85}>
                  <LinearGradient colors={['#c9a84c', '#e8c87a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnGrad}>
                    <Text style={s.primaryBtnArrow}>→</Text><Text style={s.primaryBtnTxt}>GO TO LOGIN</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  // Auth header
  headerWrap:   { zIndex: 100 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#304674', borderRadius: 14, borderBottomWidth: 1, borderColor: 'rgba(201,168,76,0.25)', shadowColor: '#011f4b', shadowOpacity: 0.20, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  backIcon:     { color: '#fff', fontSize: 17, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  headerH1:     { fontFamily: 'NotoSerif_700Bold', fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
  headerWhite:  { color: '#ffffff' },
  headerGold:   { fontFamily: 'NotoSerif_700Bold_Italic', color: '#c9a84c', fontStyle: 'italic' },
  headerSub:    { fontFamily: 'GoogleSans_400Regular', color: 'rgba(232,200,122,0.75)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },

  // Auth card
  card:         { width: '100%', borderRadius: 18, backgroundColor: 'rgba(178,203,222,0.38)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', padding: 14, alignItems: 'center', shadowColor: '#011f4b', shadowOpacity: 0.13, shadowRadius: 18, shadowOffset: { width: 0, height: 5 }, elevation: 5, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {}) },
  avatarWrap:   { marginBottom: 8 },
  avatarGrad:   { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.45)' },
  cardTitle:    { fontFamily: 'NotoSerif_700Bold', fontWeight: '800', color: '#011f4b', textAlign: 'center', marginBottom: 2, letterSpacing: 0.3 },
  cardSub:      { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.60)', textAlign: 'center', marginBottom: 10, lineHeight: 16 },
  fbBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(26,138,74,0.12)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(26,138,74,0.35)', paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  fbDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1a8a4a' },
  fbBadgeTxt:   { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: '#1a8a4a' },
  hintBox:      { width: '100%', backgroundColor: 'rgba(201,168,76,0.14)', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(201,168,76,0.38)', padding: 9, marginBottom: 11 },
  hintTxt:      { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.80)', lineHeight: 17 },
  hintBold:     { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#011f4b' },

  // Fields
  fieldGroup:   { width: '100%', marginBottom: 9 },
  fieldLabel:   { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(1,31,75,0.55)', letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 4 },
  fieldRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(240,246,252,0.92)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1.5, borderColor: 'rgba(200,218,235,0.75)', shadowColor: '#011f4b', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  fieldRowErr:  { borderColor: '#c0392b' },
  fieldInput:   { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: '#0d1b3e', letterSpacing: 0.2 },
  fieldErr:     { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: '#c0392b', marginTop: 3 },
  errorBox:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, width: '100%', backgroundColor: 'rgba(192,57,43,0.10)', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(192,57,43,0.28)', padding: 9, marginBottom: 5 },
  errorTxt:     { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: '#c0392b', flex: 1, lineHeight: 17 },

  // Buttons
  primaryBtn:     { width: '100%', borderRadius: 28, overflow: 'hidden', marginTop: 6, marginBottom: 10, shadowColor: '#c9a84c', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  primaryBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, gap: 8 },
  primaryBtnArrow:{ fontSize: 16, color: '#0d1b3e', fontWeight: '800' },
  primaryBtnTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#0d1b3e', letterSpacing: 2.5 },
  saveBtn:        { backgroundColor: '#243554', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16, shadowColor: '#0f1e35', shadowOpacity: 0.20, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  saveBtnTxt:     { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#fff', letterSpacing: 1 },
  switchRow:      { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 2 },
  switchTxt:      { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.55)' },
  switchLink:     { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#c9a84c', textDecorationLine: 'underline' },

  // Register
  fieldRow2:      { flexDirection: 'row', width: '100%', gap: 6, marginBottom: 0 },
  stepRow:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 11, width: '100%' },
  stepItem:       { alignItems: 'center', width: 68 },
  stepCircle:     { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.40)', justifyContent: 'center', alignItems: 'center', marginBottom: 3 },
  stepCircleActive:{ backgroundColor: '#c9a84c', borderColor: '#c9a84c' },
  stepNum:        { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: 'rgba(1,31,75,0.45)' },
  stepNumActive:  { color: '#0d1b3e' },
  stepLbl:        { fontFamily: 'GoogleSans_400Regular', fontSize: 8, color: 'rgba(1,31,75,0.50)', textAlign: 'center', lineHeight: 12 },
  stepLblActive:  { color: '#011f4b', fontFamily: 'GoogleSans_700Bold' },
  stepLine:       { width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.40)', marginTop: 10 },
  uidBox:         { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: 'rgba(15,30,53,0.78)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201,168,76,0.40)', padding: 11, marginBottom: 8, gap: 10 },
  uidLabel:       { fontFamily: 'GoogleSans_700Bold', fontSize: 8, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5, marginBottom: 3 },
  uidValue:       { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#c9a84c', letterSpacing: 0.5 },
  copyBtn:        { backgroundColor: 'rgba(201,168,76,0.20)', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(201,168,76,0.50)' },
  copyBtnDone:    { backgroundColor: 'rgba(26,138,74,0.28)', borderColor: '#1a8a4a' },
  copyBtnTxt:     { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#c9a84c' },
  uidWarning:     { width: '100%', backgroundColor: 'rgba(201,168,76,0.14)', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(201,168,76,0.38)', padding: 9, marginBottom: 10 },
  uidWarningTxt:  { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.80)', lineHeight: 17 },
  uidWarningBold: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#011f4b' },

  // Success
  flowCard:      { width: '100%', backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.70)', padding: 12, marginBottom: 10, gap: 8 },
  flowRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flowTxt:       { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(1,31,75,0.50)', flex: 1 },
  flowTxtDone:   { fontFamily: 'GoogleSans_700Bold', color: '#1a8a4a' },
  pendingBox:    { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: 'rgba(201,168,76,0.14)', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(201,168,76,0.38)', padding: 10, marginBottom: 12 },
  pendingTxt:    { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(1,31,75,0.80)', lineHeight: 17, flex: 1 },
  pendingBold:   { fontFamily: 'GoogleSans_700Bold', color: '#011f4b' },

  // Dashboard top bar
  dashTopbar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a2d4e', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 2, borderColor: '#c9a84c', gap: 8 },
  dashLogo:      { width: 32, height: 32, borderRadius: 8, backgroundColor: '#c9a84c', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  dashLogoTxt:   { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#0f1e35' },
  dashTitle:     { fontFamily: 'GoogleSans_700Bold', color: '#fff' },
  dashSub:       { fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: '#c9a84c' },
  menuBtn:       { width: 38, height: 38, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', justifyContent: 'center', alignItems: 'center' },
  bellBtn:       { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', justifyContent: 'center', alignItems: 'center' },
  bellBadge:     { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#c0392b', justifyContent: 'center', alignItems: 'center' },
  bellBadgeTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 8, color: '#fff' },
  memAvatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(201,168,76,0.28)', borderWidth: 1.5, borderColor: '#c9a84c', justifyContent: 'center', alignItems: 'center' },
  memAvatarTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#c9a84c' },
  logoutBtn:     { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(201,168,76,0.18)', borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.50)' },
  logoutTxt:     { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#c9a84c' },

  // Sidebar
  sidebar:        { width: 160, maxWidth: 160, flexShrink: 0, flexGrow: 0, backgroundColor: '#1a2d4e', borderRightWidth: 1, borderColor: 'rgba(201,168,76,0.20)', flexDirection: 'column' },
  sidebarBrand:   { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, paddingTop: 14 },
  sidebarLogo:    { width: 26, height: 26, borderRadius: 6, backgroundColor: '#c9a84c', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  sidebarLogoTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#0f1e35' },
  sidebarName:    { fontFamily: 'NotoSerif_700Bold', fontSize: 11, color: '#fff' },
  sidebarRole:    { fontFamily: 'GoogleSans_400Regular', fontSize: 8, color: '#c9a84c' },
  sideHead:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, minHeight: 36 },
  sideActive:     { backgroundColor: '#c9a84c' },
  sideIcon:       { fontSize: 12, width: 16, textAlign: 'center', color: 'rgba(255,255,255,0.50)' },
  sideLabel:      { fontFamily: 'GoogleSans_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.65)', flex: 1 },
  sideChild:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, marginHorizontal: 3, borderRadius: 7, marginBottom: 1, minHeight: 32 },
  sideChildActive:{ backgroundColor: 'rgba(201,168,76,0.20)' },
  sideChildTxt:   { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(210,225,255,0.55)', flex: 1 },
  sideNotifBadge: { margin: 10, backgroundColor: 'rgba(201,168,76,0.18)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201,168,76,0.40)', padding: 10 },
  sideNotifTxt:   { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#e8c87a', textAlign: 'center' },

  // Dashboard pages
  pageOuter:     { padding: 16, paddingBottom: 48 },
  pageTitle:     { fontFamily: 'NotoSerif_700Bold', fontSize: 20, color: '#0f1e35', marginBottom: 4 },
  pageSub:       { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(15,30,53,0.65)', marginBottom: 16, lineHeight: 20 },
  sHead:         { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: 'rgba(15,30,53,0.42)', letterSpacing: 2.2, textTransform: 'uppercase', marginBottom: 10, marginTop: 6 },
  secTitle:      { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#0f1e35', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.10)' },
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.06)' },
  infoLabel:     { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(15,30,53,0.65)', flex: 1 },
  infoVal:       { fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: '#0f1e35', flex: 2, textAlign: 'right' },

  // Welcome / profile avatars
  wAvatar:       { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(201,168,76,0.25)', borderWidth: 2, borderColor: '#c9a84c', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  wAvatarTxt:    { fontFamily: 'NotoSerif_700Bold', fontSize: 18, color: '#c9a84c' },
  profAvatar:    { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(201,168,76,0.28)', borderWidth: 2.5, borderColor: '#c9a84c', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  profAvatarTxt: { fontFamily: 'NotoSerif_700Bold', fontSize: 20, color: '#c9a84c' },

  // Quick actions
  quickBtn:      { backgroundColor: 'rgba(255,255,255,0.50)', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.78)', shadowColor: '#1a2d4e', shadowOpacity: 0.07, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },

  // Notifications
  notifCard:     { backgroundColor: 'rgba(255,255,255,0.50)', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.78)', borderLeftWidth: 4, marginBottom: 10, flexDirection: 'row', gap: 12 },
  notifIcon:     { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifTitle:    { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#0f1e35' },
  notifMsg:      { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(15,30,53,0.65)', lineHeight: 18, marginTop: 2 },
  notifTime:     { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(15,30,53,0.42)', marginTop: 3 },
});