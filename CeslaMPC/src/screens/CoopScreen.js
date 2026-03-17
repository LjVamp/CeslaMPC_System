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
  TextInput, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';
import * as Clipboard from 'expo-clipboard';

// ─── Firebase ────────────────────────────────────────────────────────────────
import {
  collection, query, where, getDocs, addDoc, doc,
  updateDoc, serverTimestamp, orderBy, limit, onSnapshot,
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

const fmtCur  = v => '₱' + Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtDate = ts => { if (!ts) return '—'; const d = ts?.toDate?.() || new Date(ts); return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); };
const fmtTime = ts => { if (!ts) return '—'; const d = ts?.toDate?.() || new Date(ts); return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); };
const mkInit  = name => (name || '?').split(/[\s,]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

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

const MemberSidebar = ({ active, onNav, onClose, unread }) => (
  <View style={s.sidebar}>
    <View style={s.sidebarBrand}>
      <View style={s.sidebarLogo}><Text style={s.sidebarLogoTxt}>CS</Text></View>
      <View><Text style={s.sidebarName}>CESLA MPC</Text><Text style={s.sidebarRole}>Member Portal</Text></View>
    </View>
    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 14, marginBottom: 6 }} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
      {NAV.map(g => <SidebarGroup key={g.key} group={g} active={active} onNav={onNav} onClose={onClose} />)}
    </ScrollView>
    {unread > 0 && (
      <TouchableOpacity style={s.sideNotifBadge} onPress={() => { onNav('notifs'); onClose?.(); }}>
        <Text style={s.sideNotifTxt}>🔔 {unread} unread notification{unread !== 1 ? 's' : ''}</Text>
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

const OverviewView = ({ member, onNav }) => {
  const lp = member.loan > 0 ? (member.loan - (member.loanBalance || 0)) / member.loan : 0;
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
      {/* Welcome */}
      <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 14, shadowColor: '#1a2d4e', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }}>
        <LinearGradient colors={['#1a2d4e', '#243554']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 }}>
          <View style={s.wAvatar}><Text style={s.wAvatarTxt}>{mkInit(member.name)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Welcome back,</Text>
            <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: '#fff', lineHeight: 22 }} numberOfLines={2}>{member.name}</Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.50)', marginTop: 2 }}>{member.userId}</Text>
          </View>
          <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(26,138,74,0.35)', borderWidth: 1, borderColor: 'rgba(26,138,74,0.60)' }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#4cde8a' }}>{member.status || 'Active'}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Financial tiles */}
      <Text style={s.sHead}>💰 FINANCIAL SUMMARY</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { l: 'Savings',       v: fmtCur(member.savings),      c: C.green },
          { l: 'Share Capital', v: fmtCur(member.shares),       c: C.gold },
          { l: 'Total Assets',  v: fmtCur((member.savings || 0) + (member.shares || 0)), c: C.blueLt },
          { l: 'Loan Balance',  v: fmtCur(member.loanBalance),  c: member.loanBalance > 0 ? C.red : C.green },
        ].map(t => (
          <GCard key={t.l} style={{ flex: 1, minWidth: 130, padding: 12, marginBottom: 0, borderTopWidth: 3, borderTopColor: t.c }}>
            <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 17, color: t.c, marginBottom: 3 }}>{t.v}</Text>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted }}>Paid: {fmtCur((member.loan || 0) - (member.loanBalance || 0))}</Text>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted }}>Remaining: {fmtCur(member.loanBalance)}</Text>
            </View>
          </GCard>
        </>
      )}

      {/* Quick actions */}
      <Text style={s.sHead}>⚡ QUICK ACTIONS</Text>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {[{ label: 'Apply Loan', icon: '📝', key: 'applyloan', c: C.blue }, { label: 'My Profile', icon: '👤', key: 'profile', c: C.navyMid }, { label: 'App Form', icon: '📋', key: 'appform', c: C.orange }, { label: 'Notifs', icon: '🔔', key: 'notifs', c: C.gold }].map(q => (
          <TouchableOpacity key={q.key} style={[s.quickBtn, { flex: 1, minWidth: 130, borderTopWidth: 3, borderTopColor: q.c }]} onPress={() => onNav(q.key)} activeOpacity={0.8}>
            <Text style={{ fontSize: 22, marginBottom: 5 }}>{q.icon}</Text>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.navy, textAlign: 'center' }}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tips */}
      <Text style={s.sHead}>💡 TIPS & REMINDERS</Text>
      <GCard style={{ padding: 0, overflow: 'hidden' }}><TipsCarousel /></GCard>
    </ScrollView>
  );
};

const ProfileView = ({ member }) => (
  <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
    <Text style={s.pageTitle}>My Profile</Text>
    <GCard style={{ padding: 0, overflow: 'hidden' }}>
      <LinearGradient colors={['#1a2d4e', '#243554']} style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={s.profAvatar}><Text style={s.profAvatarTxt}>{mkInit(member.name)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 18, color: '#fff' }} numberOfLines={2}>{member.name}</Text>
            <Text style={{ fontFamily: 'GoogleSans_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>{member.userId}</Text>
          </View>
          <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(26,138,74,0.35)', borderWidth: 1, borderColor: 'rgba(26,138,74,0.60)' }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#4cde8a' }}>{member.status || 'Active'}</Text>
          </View>
        </View>
      </LinearGradient>
      <View style={{ padding: 14 }}>
        <Text style={s.secTitle}>Personal Information</Text>
        {[['Contact', member.contact || '—'], ['Email', member.email || '—'], ['Address', member.address || '—'], ['Member Since', fmtDate(member.approvedAt || member.createdAt)]].map(([l, v]) => (
          <View key={l} style={s.infoRow}><Text style={s.infoLabel}>{l}</Text><Text style={s.infoVal}>{v}</Text></View>
        ))}
        <Text style={[s.secTitle, { marginTop: 14 }]}>Financial Overview</Text>
        {[['Share Capital', fmtCur(member.shares), C.gold], ['Savings', fmtCur(member.savings), C.green], ['Active Loan', fmtCur(member.loan), C.orange], ['Loan Balance', fmtCur(member.loanBalance), member.loanBalance > 0 ? C.red : C.green], ['Credit Balance', fmtCur(member.creditBalance), C.orange]].map(([l, v, c]) => (
          <View key={l} style={s.infoRow}><Text style={s.infoLabel}>{l}</Text><Text style={[s.infoVal, c && { color: c, fontFamily: 'GoogleSans_700Bold' }]}>{v}</Text></View>
        ))}
      </View>
    </GCard>
  </ScrollView>
);

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

// ── Date Picker (calendar dropdown) ────────────────────────────────────────
const DatePicker = ({ label: l, value, onChange, half }) => {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const years  = Array.from({ length: 80 }, (_, i) => String(currentYear - i));
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const days   = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  // Parse stored value "MM/DD/YYYY"
  const parts   = (value || '').split('/');
  const selMonth= parts[0] ? months[parseInt(parts[0]) - 1] || '' : '';
  const selDay  = parts[1] || '';
  const selYear = parts[2] || '';

  const buildDate = (m, d, y) => {
    const mIdx = String(months.indexOf(m) + 1).padStart(2, '0');
    return `${mIdx}/${d}/${y}`;
  };

  const [tmpM, setTmpM] = useState(selMonth);
  const [tmpD, setTmpD] = useState(selDay);
  const [tmpY, setTmpY] = useState(selYear);

  const apply = () => {
    if (tmpM && tmpD && tmpY) { onChange(buildDate(tmpM, tmpD, tmpY)); setOpen(false); }
  };

  const displayVal = value ? `${selMonth} ${selDay}, ${selYear}` : '';

  return (
    <View style={[{ marginBottom: 12 }, half && { flex: 1 }]}>
      <Text style={af.fieldLabel}>{l}</Text>
      <TouchableOpacity style={[af.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
        onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: displayVal ? C.navy : C.textMuted, flex: 1 }}>
          {displayVal || 'Select date'}
        </Text>
        <Text style={{ fontSize: 14 }}>📅</Text>
      </TouchableOpacity>
      {open && (
        <View style={[af.dropdownList, { padding: 12 }]}>
          <Text style={[af.fieldLabel, { marginBottom: 8 }]}>SELECT DATE</Text>
          {/* Month */}
          <Text style={[af.fieldLabel, { fontSize: 8 }]}>MONTH</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {months.map(m => (
              <TouchableOpacity key={m} onPress={() => setTmpM(m)}
                style={{ paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, borderRadius: 8, backgroundColor: tmpM === m ? C.gold : 'rgba(15,30,53,0.08)', borderWidth: 1, borderColor: tmpM === m ? C.gold : 'transparent' }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: tmpM === m ? '#fff' : C.navy }}>{m.slice(0,3)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Day */}
          <Text style={[af.fieldLabel, { fontSize: 8 }]}>DAY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {days.map(d => (
              <TouchableOpacity key={d} onPress={() => setTmpD(d)}
                style={{ width: 34, paddingVertical: 6, marginRight: 5, borderRadius: 8, alignItems: 'center', backgroundColor: tmpD === d ? C.navyMid : 'rgba(15,30,53,0.08)', borderWidth: 1, borderColor: tmpD === d ? C.navyMid : 'transparent' }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: tmpD === d ? '#fff' : C.navy }}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Year */}
          <Text style={[af.fieldLabel, { fontSize: 8 }]}>YEAR</Text>
          <ScrollView style={{ maxHeight: 130, marginBottom: 12 }} showsVerticalScrollIndicator>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {years.map(y => (
                <TouchableOpacity key={y} onPress={() => setTmpY(y)}
                  style={{ width: 58, paddingVertical: 6, borderRadius: 8, alignItems: 'center', backgroundColor: tmpY === y ? C.navyDeep : 'rgba(15,30,53,0.08)', borderWidth: 1, borderColor: tmpY === y ? C.navyDeep : 'transparent' }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: tmpY === y ? '#fff' : C.navy }}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(15,30,53,0.20)', alignItems: 'center' }} onPress={() => setOpen(false)}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.textSec }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 2, paddingVertical: 10, borderRadius: 10, backgroundColor: C.navyMid, alignItems: 'center' }} onPress={apply}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.gold }}>✓ Apply Date</Text>
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
const PROVINCES_PH = ['Agusan del Norte','Agusan del Sur','Bukidnon','Camiguin','Davao de Oro','Davao del Norte','Davao del Sur','Davao Occidental','Davao Oriental','Dinagat Islands','Lanao del Norte','Lanao del Sur','Maguindanao','Misamis Occidental','Misamis Oriental','North Cotabato','Sarangani','South Cotabato','Sultan Kudarat','Surigao del Norte','Surigao del Sur','Zamboanga del Norte','Zamboanga del Sur','Zamboanga Sibugay','Others'];

const AppFormView = ({ member }) => {
  const af0 = member.appForm || {};
  const [form, setForm] = useState({
    appDate: af0.appDate || '', appNo: af0.appNo || '',
    salutation: af0.salutation || '', gender: af0.gender || '',
    suffix: af0.suffix || '',
    dob: af0.dob || '',
    placeOfBirth: af0.placeOfBirth || '',
    nationality: af0.nationality || 'Filipino', nationalityOther: af0.nationalityOther || '',
    religion: af0.religion || '', religionOther: af0.religionOther || '',
    numDependents: af0.numDependents || '',
    civilStatus: af0.civilStatus || '',
    sssGsis: af0.sssGsis || '',
    tin: af0.tin || '',
    philHealth: af0.philHealth || '',
    pagIbig: af0.pagIbig || '',
    recommendedBy: af0.recommendedBy || '',
    contactNo: af0.contactNo || '',
    family: af0.family || Array(5).fill(null).map(() => ({ name: '', relation: '', age: '', occupation: '' })),
    presentAddress: af0.presentAddress || '', presentZip: af0.presentZip || '',
    stayYears: af0.stayYears || '', stayMonths: af0.stayMonths || '',
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

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setFamily = (idx, key, val) => setForm(f => {
    const fam = [...f.family];
    fam[idx] = { ...fam[idx], [key]: val };
    return { ...f, family: fam };
  });

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
      contentContainerStyle={[s.pageOuter, { paddingBottom: 60 }]}
      showsVerticalScrollIndicator
      indicatorStyle="black"
      persistentScrollbar
    >
      <Text style={s.pageTitle}>📋 Application Form</Text>
      <Text style={s.pageSub}>CESLA Multi-Purpose Cooperative \u2014 Official Membership Application</Text>

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
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AF l="APPLICATION DATE" value={form.appDate} onChangeText={v => set('appDate', v)} placeholder="e.g. 01/15/2026" half />
              <AF l="APPLICATION NO."  value={form.appNo}   onChangeText={v => set('appNo', v)}   placeholder="Auto-assigned"   half />
            </View>
          </GCard>

          <Text style={af.secHeader}>PERSONAL DETAILS</Text>
          <GCard>
            <RadioRow label="Salutation" options={['Mr.', 'Mrs.', 'Ms.']} selected={form.salutation} onSelect={v => set('salutation', v)} />
            <RadioRow label="Gender" options={['Male', 'Female']} selected={form.gender} onSelect={v => set('gender', v)} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AF l="LAST NAME"   value={member.lastName || member.name?.split(',')[0] || ''} placeholder="\u2014" editable={false} half />
              <AF l="FIRST NAME"  value={member.firstName || ''}  placeholder="\u2014" editable={false} half />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AF l="MIDDLE NAME" value={member.middleName || ''} placeholder="\u2014" editable={false} half />
              <AF l="SUFFIX"      value={form.suffix} onChangeText={v => set('suffix', v)} placeholder="Jr., Sr., II" half />
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

            <AF l="NUMBER OF DEPENDENTS" value={form.numDependents} onChangeText={v => set('numDependents', v)} placeholder="0" keyboardType="numeric" />
            <RadioRow label="Civil Status" options={['Single', 'Married', 'Legally Separated', 'Others']} selected={form.civilStatus} onSelect={v => set('civilStatus', v)} />

            <Text style={[af.secHeader, { marginTop: 4 }]}>GOVERNMENT IDs</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AF l="SSS / GSIS NUMBER"  value={form.sssGsis}    onChangeText={v => set('sssGsis', v)}    placeholder="12-3456789-0"    half />
              <AF l="TAX ID (TIN)"       value={form.tin}        onChangeText={v => set('tin', v)}        placeholder="123-456-789"     half />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AF l="PHILHEALTH NO."     value={form.philHealth} onChangeText={v => set('philHealth', v)} placeholder="01-234567890-1"   half />
              <AF l="PAG-IBIG (HDMF)"   value={form.pagIbig}   onChangeText={v => set('pagIbig', v)}    placeholder="1234-5678-9012"  half />
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AF l="RECOMMENDED BY (CEC)" value={form.recommendedBy} onChangeText={v => set('recommendedBy', v)} placeholder="Name of referrer" half />
              <AF l="CONTACT NO."          value={form.contactNo}     onChangeText={v => set('contactNo', v)}     placeholder="09XXXXXXXXX" keyboardType="phone-pad" half />
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
            <AF l="PRESENT ADDRESS" value={form.presentAddress} onChangeText={v => set('presentAddress', v)} placeholder="House No., Street, Barangay, City" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AF l="ZIP CODE"    value={form.presentZip}  onChangeText={v => set('presentZip', v)}  placeholder="9000" keyboardType="numeric" half />
              <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                <AF l="STAY (YRS)" value={form.stayYears}  onChangeText={v => set('stayYears', v)}  placeholder="0" keyboardType="numeric" half />
                <AF l="STAY (MOS)" value={form.stayMonths} onChangeText={v => set('stayMonths', v)} placeholder="0" keyboardType="numeric" half />
              </View>
            </View>
            <AF l="PERMANENT ADDRESS" value={form.permanentAddress} onChangeText={v => set('permanentAddress', v)} placeholder="If same, leave blank" />
            <AF l="ZIP CODE"          value={form.permanentZip}     onChangeText={v => set('permanentZip', v)}     placeholder="9000" keyboardType="numeric" half />
          </GCard>

          <TouchableOpacity style={af.fullBtn} onPress={() => setPage(2)} activeOpacity={0.85}>
            <LinearGradient colors={['#1a2d4e', '#243554']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={af.fullBtnGrad}>
              <Text style={af.fullBtnTxt}>Next: Employment Details  \u2192</Text>
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
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AF l="OFFICE NO." value={form.officeNo} onChangeText={v => set('officeNo', v)} placeholder="(088) XXX-XXXX" keyboardType="phone-pad" half />
                <AF l="FAX NO."    value={form.faxNo}    onChangeText={v => set('faxNo', v)}    placeholder="(088) XXX-XXXX" keyboardType="phone-pad" half />
              </View>
              <RadioRow label="Employment Type" options={['Private', 'Government', 'Others']} selected={form.employmentType} onSelect={v => set('employmentType', v)} />
              {form.employmentType === 'Others' && (
                <AF l="SPECIFY TYPE" value={form.employmentTypeOther} onChangeText={v => set('employmentTypeOther', v)} placeholder="Specify" />
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AF l="POSITION / RANK"    value={form.positionRank}  onChangeText={v => set('positionRank', v)}  placeholder="e.g. Teacher I"  half />
                <AF l="MONTHLY INCOME (\u20B1)" value={form.monthlyIncome} onChangeText={v => set('monthlyIncome', v)} placeholder="e.g. 25000" keyboardType="numeric" half />
              </View>
              <View style={af.noteBox}>
                <Text style={af.noteTxt}>* If less than 6 months in current employment, fill in previous employer below.</Text>
              </View>
              <AF l="PREVIOUS EMPLOYER" value={form.prevEmployer} onChangeText={v => set('prevEmployer', v)} placeholder="Previous employer name" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AF l="YRS IN COMPANY"  value={form.yrsInCompany} onChangeText={v => set('yrsInCompany', v)} placeholder="0" keyboardType="numeric" half />
                <AF l="POSITION / RANK" value={form.prevPosition} onChangeText={v => set('prevPosition', v)} placeholder="Previous position" half />
              </View>
            </GCard>
          )}

          {form.empType === 'Self-Employed' && (
            <GCard>
              <Text style={s.secTitle}>Self-Employed</Text>
              <AF l="NAME OF BUSINESS" value={form.bizName}   onChangeText={v => set('bizName', v)}   placeholder="Business name" />
              <RadioRow label="Type of Business" options={['Sole Prop', 'Partnership', 'Corp']} selected={form.bizType} onSelect={v => set('bizType', v)} />
              <AF l="NATURE OF BUSINESS" value={form.bizNature} onChangeText={v => set('bizNature', v)} placeholder="e.g. Retail, Trading" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AF l="ASSET SIZE (\u20B1)"   value={form.assetSize}  onChangeText={v => set('assetSize', v)}  placeholder="e.g. 500000" keyboardType="numeric" half />
                <AF l="SHARE IN BIZ (%)"  value={form.shareInBiz} onChangeText={v => set('shareInBiz', v)} placeholder="e.g. 50"     keyboardType="numeric" half />
              </View>
              <AF l="MONTHLY INCOME (\u20B1)" value={form.selfMonthlyIncome} onChangeText={v => set('selfMonthlyIncome', v)} placeholder="e.g. 30000" keyboardType="numeric" />
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

          {/* Buttons — stacked, no overlap */}
          <TouchableOpacity style={[af.fullBtn, { marginBottom: 10 }]} onPress={() => setPage(1)} activeOpacity={0.85}>
            <LinearGradient colors={['#304674', '#1a2d4e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={af.fullBtnGrad}>
              <Text style={af.fullBtnTxt}>\u2190  Back to Personal Details</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[af.fullBtn, { marginBottom: 16, opacity: saving ? 0.7 : 1 }]}
            onPress={save} disabled={saving} activeOpacity={0.85}>
            <LinearGradient
              colors={saved ? ['#1a8a4a', '#25a85a'] : ['#c9a84c', '#e8c87a']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={af.fullBtnGrad}>
              {saving
                ? <ActivityIndicator color={C.navy} />
                : <Text style={[af.fullBtnTxt, { color: saved ? '#fff' : C.navy }]}>
                    {saved ? '\u2713  Application Saved!' : '\u{1F4BE}  Save Application Form'}
                  </Text>}
            </LinearGradient>
          </TouchableOpacity>
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

const FinanceView = ({ title, icon, value, label, color, member }) => (
  <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
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

const ApplyLoanView = ({ member }) => {
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
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
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

const MyLoansView = ({ member }) => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    return onSnapshot(query(collection(db, 'loanApplications'), where('memberId', '==', member.uid), orderBy('createdAt', 'desc')), snap => { setApps(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
  }, [member.uid]);
  const prog = member.loan > 0 ? (member.loan - (member.loanBalance || 0)) / member.loan : 0;
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
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

const GuidelinesView = () => (
  <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
    <Text style={s.pageTitle}>📖 Loan Guidelines</Text>
    <Text style={s.pageSub}>Read carefully before applying.</Text>
    {[
      { title: 'Eligibility', color: C.blue, items: ['Active member for at least 3 months.', 'No outstanding overdue loans.', 'Savings balance meets minimum requirement.', 'Must be a regular CLIMBS employee.'] },
      { title: 'Loan Amount & Terms', color: C.gold, items: ['Minimum: ₱5,000', 'Maximum: up to 3x share capital.', 'Interest rate: as set by the board.', 'Processing fee may apply.'] },
      { title: 'Repayment Policy', color: C.green, items: ['Monthly via salary deduction or OTC.', 'Late payment penalty applies.', 'Early full payment allowed — no penalty.', 'Failure to pay affects membership standing.'] },
      { title: 'Required Documents', color: C.orange, items: ['Filled loan application form.', 'Valid government-issued ID.', 'Latest payslip or certificate of employment.', 'Co-maker may be required.'] },
    ].map(sec => (
      <GCard key={sec.title} style={{ borderLeftWidth: 4, borderLeftColor: sec.color }}>
        <Text style={[s.secTitle, { color: sec.color }]}>{sec.title}</Text>
        {sec.items.map((item, i) => (<View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}><Text style={{ color: sec.color, fontSize: 14, lineHeight: 20 }}>•</Text><Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec, lineHeight: 20, flex: 1 }}>{item}</Text></View>))}
      </GCard>
    ))}
  </ScrollView>
);

const EditProfileView = ({ member }) => {
  const [contact, setContact] = useState(member.contact || '');
  const [email,   setEmail]   = useState(member.email   || '');
  const [address, setAddress] = useState(member.address || '');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const save = async () => { setSaving(true); try { await updateDoc(doc(db, 'members', member.uid), { contact, email, address, updatedAt: serverTimestamp() }); setSaved(true); setTimeout(() => setSaved(false), 2500); } catch (e) {} finally { setSaving(false); } };
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>✏️ Edit Profile</Text>
      <Text style={s.pageSub}>Changes saved directly to Firebase.</Text>
      <GCard>
        <DField label="CONTACT NUMBER" value={contact} onChangeText={setContact} placeholder="e.g. 09171234567" keyboardType="phone-pad" />
        <DField label="EMAIL ADDRESS"  value={email}   onChangeText={setEmail}   placeholder="e.g. juan@email.com" keyboardType="email-address" />
        <DField label="ADDRESS"        value={address} onChangeText={setAddress} placeholder="e.g. Cagayan de Oro City" />
        <SaveBtn onPress={save} loading={saving} done={saved} label="Save Changes" />
      </GCard>
    </ScrollView>
  );
};

const ChangePasswordView = ({ member }) => {
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
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
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

const NotifsView = ({ member }) => {
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
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
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

// ═════════════════════════════════════════════════════════════════════════════
// MEMBER DASHBOARD SHELL
// ═════════════════════════════════════════════════════════════════════════════
const MemberDashboard = ({ memberInit, onLogout, isWide, isSmall }) => {
  const [nav,    setNav]    = useState('overview');
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
      setNav(key);
      Animated.parallel([Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true })]).start();
    });
  };

  const renderContent = () => {
    switch (nav) {
      case 'overview':     return <OverviewView     member={member} onNav={switchNav} />;
      case 'profile':      return <ProfileView      member={member} />;
      case 'appform':      return <AppFormView       member={member} />;
      case 'savings':      return <FinanceView title="Savings"       icon="💰" value={member.savings} label="Total Savings Balance" color={C.green}  member={member} />;
      case 'sharecap':     return <FinanceView title="Share Capital" icon="📊" value={member.shares}  label="Total Share Capital"   color={C.gold}   member={member} />;
      case 'timedeposit':  return <FinanceView title="Time Deposit"  icon="🏦" value={0}              label="Time Deposit Balance"  color={C.blueLt} member={member} />;
      case 'applyloan':    return <ApplyLoanView     member={member} />;
      case 'myloans':      return <MyLoansView       member={member} />;
      case 'guidelines':   return <GuidelinesView />;
      case 'editprofile':  return <EditProfileView   member={member} />;
      case 'changepw':     return <ChangePasswordView member={member} />;
      case 'notifs':       return <NotifsView        member={member} />;
      default:             return <OverviewView      member={member} onNav={switchNav} />;
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
          <View style={s.memAvatar}><Text style={s.memAvatarTxt}>{mkInit(member.name)}</Text></View>
          {isWide && <Text style={{ fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.85)', maxWidth: 120 }} numberOfLines={1}>{member.name}</Text>}
          <TouchableOpacity style={s.logoutBtn} onPress={onLogout}><Text style={s.logoutTxt}>{isSmall ? '↩' : 'Logout'}</Text></TouchableOpacity>
        </View>
      </View>
      {/* Body */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {isWide && <MemberSidebar active={nav} onNav={switchNav} unread={unread} />}
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>{renderContent()}</Animated.View>
      </View>
      {/* Mobile drawer */}
      {!isWide && drawer && (
        <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 20 }} activeOpacity={1} onPress={() => setDrawer(false)}>
          <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 185, zIndex: 21 }}>
            <MemberSidebar active={nav} onNav={switchNav} onClose={() => setDrawer(false)} unread={unread} />
          </View>
        </TouchableOpacity>
      )}
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
  const handleLogout = () => { setMember(null); setUserId(''); setPw(''); setView('login'); };

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
          <TouchableOpacity style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => view !== 'login' ? switchView('login') : navigation?.goBack()}>
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
  sidebar:        { width: 175, backgroundColor: '#1a2d4e', borderRightWidth: 1, borderColor: 'rgba(201,168,76,0.20)' },
  sidebarBrand:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingTop: 18 },
  sidebarLogo:    { width: 30, height: 30, borderRadius: 7, backgroundColor: '#c9a84c', justifyContent: 'center', alignItems: 'center' },
  sidebarLogoTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#0f1e35' },
  sidebarName:    { fontFamily: 'NotoSerif_700Bold', fontSize: 12, color: '#fff' },
  sidebarRole:    { fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: '#c9a84c' },
  sideHead:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, minHeight: 40 },
  sideActive:     { backgroundColor: '#c9a84c' },
  sideIcon:       { fontSize: 13, width: 18, textAlign: 'center', color: 'rgba(255,255,255,0.50)' },
  sideLabel:      { fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.65)', flex: 1 },
  sideChild:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 16, marginHorizontal: 4, borderRadius: 8, marginBottom: 1, minHeight: 36 },
  sideChildActive:{ backgroundColor: 'rgba(201,168,76,0.20)' },
  sideChildTxt:   { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(210,225,255,0.55)', flex: 1 },
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