// src/screens/CoopScreen.js
// CESLA MPC — Admin Dashboard (Firebase-connected)
// Design: Original CESLA Cooperative dashboard style
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, useWindowDimensions, Platform,
  TextInput, KeyboardAvoidingView, ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

import {
  loginMember, logoutUser,
  listenAllMembers, setMemberStatus, updateMemberFinancials,
  listenAllOrders, getTodaySales,
  listenAllLoanApps, resolveLoanApp,
  sendNotification, seedMenuItems,
} from '../firebase/firebaseService';
import { auth } from '../firebase/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  navy:     '#1a2d4e', navyDark: '#0f1e35',
  gold:     '#c9a84c', goldLight: '#e8c87a',
  green:    '#2ecc71', red: '#e74c3c', orange: '#f5a623', blue: '#6fa3f7',
  textMain: '#1a2d4e', textMuted: 'rgba(26,45,78,0.55)',
};

const fmtCur = (v) => '₱' + Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const V = { SPLASH: 'splash', LOGIN: 'login', DASHBOARD: 'dashboard' };

const fmtDate = (ts) => {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ─── SIDEBAR STRUCTURE ───────────────────────────────────────────────────────
const SIDEBAR = [
  { section: 'MAIN', items: [
    { key: 'dashboard',  label: 'Dashboard',          icon: '⊞' },
  ]},
  { section: 'MEMBERS', items: [
    { key: 'accounts',   label: 'Account Management', icon: '◆' },
    { key: 'monitoring', label: 'Members Monitoring', icon: '◆' },
  ]},
  { section: 'LOANS', items: [
    { key: 'loans',      label: 'Loan Management',    icon: '◆' },
  ]},
  { section: 'CANTEEN', items: [
    { key: 'orders',     label: 'Canteen Orders',     icon: '◆' },
    { key: 'menu',       label: 'Manage Menu',        icon: '◆' },
  ]},
  { section: 'TOOLS', items: [
    { key: 'notify',     label: 'Notify Member',      icon: '◆' },
  ]},
];

// ─── BACKGROUND ──────────────────────────────────────────────────────────────
const AppBg = () => (
  <>
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
    <LinearGradient
      colors={['rgba(198,220,235,0.85)', 'rgba(152,186,213,0.40)', 'rgba(80,110,150,0.0)']}
      locations={[0, 0.45, 1]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  </>
);

// ─── FIELD ───────────────────────────────────────────────────────────────────
const Field = ({ label, value, onChangeText, placeholder, secureEntry, showToggle, onToggle, error, keyboardType }) => (
  <View style={s.fieldWrap}>
    {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
    <View style={[s.fieldRow, error && s.fieldRowError]}>
      <TextInput
        style={s.fieldInput} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor="rgba(26,45,78,0.35)"
        secureTextEntry={secureEntry} keyboardType={keyboardType || 'default'}
        autoCapitalize="none" autoCorrect={false}
      />
      {showToggle && (
        <TouchableOpacity onPress={onToggle} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18 }}>{secureEntry ? '👁' : '🙈'}</Text>
        </TouchableOpacity>
      )}
    </View>
    {error ? <Text style={s.fieldErr}>{error}</Text> : null}
  </View>
);

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN LOGIN
// ══════════════════════════════════════════════════════════════════════════════
const AdminLogin = ({ onLogin, navigation, isWide, isSmall }) => {
  const [email,   setEmail]   = useState('');
  const [pw,      setPw]      = useState('');
  const [showPw,  setShowPw]  = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim()) { setError('Please enter your admin email.'); return; }
    if (!pw.trim())    { setError('Please enter your password.'); return; }
    setLoading(true); setError('');
    try {
      const member = await loginMember(email.trim(), pw);
      if (member.role !== 'admin') { await logoutUser(); setError('Access denied. Administrators only.'); return; }
      onLogin(member);
    } catch (e) {
      setError('Invalid email or password. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <View style={s.loginTopbar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={s.logoBox}><Text style={s.logoBoxTxt}>CS</Text></View>
          <Text style={s.topbarTitle}>CESLA Cooperative</Text>
        </View>
        {navigation && (
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'GoogleSans_500Medium' }}>← Back</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.loginOuter} keyboardShouldPersistTaps="handled">
          <Animated.View style={[s.loginCard, { opacity: fadeIn, transform: [{ translateY: slideY }] }]}>
            <LinearGradient colors={[C.gold, C.goldLight]} style={s.loginLogo}>
              <Text style={{ fontSize: 34 }}>🛡️</Text>
            </LinearGradient>
            <Text style={s.loginTitle}>Admin Portal</Text>
            <Text style={s.loginSub}>CESLA Multi-Purpose Cooperative</Text>
            <View style={s.adminBadge}>
              <Text style={s.adminBadgeTxt}>🔒  AUTHORIZED PERSONNEL ONLY</Text>
            </View>
            <Field label="ADMIN EMAIL" value={email} onChangeText={v => { setEmail(v); setError(''); }} placeholder="admin@cesla-mpc.com" keyboardType="email-address" />
            <Field label="PASSWORD" value={pw} onChangeText={v => { setPw(v); setError(''); }} placeholder="Enter your password" secureEntry={!showPw} showToggle onToggle={() => setShowPw(p => !p)} error={error} />
            <TouchableOpacity style={s.loginBtn} onPress={handleLogin} activeOpacity={0.85} disabled={loading}>
              <LinearGradient colors={[C.gold, C.goldLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.loginBtnGrad}>
                {loading ? <ActivityIndicator color={C.navyDark} /> : <Text style={s.loginBtnTxt}>→  SIGN IN AS ADMIN</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={s.loginNote}>This portal is restricted to cooperative administrators.{'\n'}For member access, use the Member Portal.</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ══════════════════════════════════════════════════════════════════════════════
const DashboardTab = ({ members, loanApps, admin }) => {
  const [sales, setSales] = useState({ totalOrders: 0, totalSales: 0 });
  useEffect(() => { getTodaySales().then(setSales).catch(() => {}); }, []);

  const pendingMembers  = members.filter(m => m.status === 'Pending').length;
  const approvedMembers = members.filter(m => m.status === 'Active').length;
  const appForms        = members.filter(m => m.appForm?.submitted).length;
  const activeLoans     = loanApps.filter(a => a.status === 'Approved').length;

  const activity = [
    ...members.filter(m => m.status === 'Active' && m.approvedAt).map(m => ({ text: `${m.name} account approved`, date: m.approvedAt, color: C.green })),
    ...members.filter(m => m.status === 'Pending' && m.createdAt).map(m => ({ text: `${m.name} submitted application`, date: m.createdAt, color: C.orange })),
    ...loanApps.filter(a => a.status === 'Approved' && a.resolvedAt).map(a => ({ text: `${a.memberName} loan approved — ${fmtCur(a.amount)}`, date: a.resolvedAt, color: C.blue })),
    ...loanApps.filter(a => a.status === 'Pending' && a.createdAt).map(a => ({ text: `${a.memberName} applied for a loan — ${fmtCur(a.amount)}`, date: a.createdAt, color: C.orange })),
  ].filter(a => a.date).sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const db = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return db - da;
  }).slice(0, 30);

  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Dashboard Overview</Text>
      <Text style={s.pageSub}>Welcome back, {admin?.name}. Here's what's happening today.</Text>

      <View style={s.statRow}>
        {[
          { label: 'PENDING ACCOUNTS', value: pendingMembers,  sub: 'Awaiting approval', accent: C.orange, icon: '⏳' },
          { label: 'APPROVED MEMBERS', value: approvedMembers, sub: 'Total verified',     accent: C.green,  icon: '✓' },
          { label: 'APP. FORMS',       value: appForms,        sub: 'Submitted forms',    accent: C.blue,   icon: '📋' },
          { label: 'ACTIVE LOANS',     value: activeLoans,     sub: 'Ongoing loans',      accent: C.red,    icon: '◆' },
        ].map(card => (
          <View key={card.label} style={[s.statCard, { borderTopColor: card.accent }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={s.statLabel}>{card.label}</Text>
              <Text style={{ fontSize: 20 }}>{card.icon}</Text>
            </View>
            <Text style={[s.statVal, { color: card.accent }]}>{card.value}</Text>
            <Text style={s.statSub}>{card.sub}</Text>
          </View>
        ))}
      </View>

      <View style={s.activityCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={s.activityTitle}>Recent Activity</Text>
          <Text style={s.memberMeta}>Last {Math.min(activity.length, 30)} events</Text>
        </View>
        {activity.length === 0
          ? <Text style={s.memberMeta}>No recent activity yet.</Text>
          : activity.map((a, i) => (
            <View key={i} style={s.activityRow}>
              <View style={[s.activityDot, { backgroundColor: a.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.activityText}>{a.text}</Text>
                <Text style={s.memberMeta}>{fmtDate(a.date)}</Text>
              </View>
            </View>
          ))}
      </View>
    </ScrollView>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ACCOUNT MANAGEMENT TAB
// ══════════════════════════════════════════════════════════════════════════════
const AccountsTab = ({ members }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editShares, setEditShares] = useState('');
  const [editSavings, setEditSavings] = useState('');
  const [saving, setSaving] = useState(false);

  const pending = members.filter(m =>
    m.status === 'Pending' &&
    (m.name?.toLowerCase().includes(search.toLowerCase()) || m.userId?.toLowerCase().includes(search.toLowerCase()))
  );

  const openEdit = (member) => {
    setSelected(member);
    setEditShares(String(member.shares || 0));
    setEditSavings(String(member.savings || 0));
    setEditModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMemberFinancials(selected.uid, { shares: parseFloat(editShares || 0), savings: parseFloat(editSavings || 0) });
      setEditModal(false);
    } catch (e) { console.warn(e); }
    finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchBar}>
        <Text style={{ fontSize: 14, marginRight: 8, color: C.textMuted }}>🔍</Text>
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search pending accounts..." placeholderTextColor={C.textMuted} />
        {search ? <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 8 }}><Text style={{ color: C.textMuted, fontWeight: '700' }}>✕</Text></TouchableOpacity> : null}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Account Management</Text>
        <Text style={s.pageSub}>Review and approve pending member applications.</Text>
        {pending.length === 0
          ? <View style={s.emptyCard}><Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>✅</Text><Text style={s.memberMeta}>No pending accounts.</Text></View>
          : pending.map(member => (
            <View key={member.uid} style={s.memberCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={s.avatar}><Text style={s.avatarTxt}>{member.name?.split(' ').map(w => w[0]).slice(0, 2).join('') || '??'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>{member.name}</Text>
                  <Text style={s.memberMeta}>{member.userId} · {member.email}</Text>
                </View>
                <View style={s.badgePending}><Text style={s.badgeTxt}>PENDING</Text></View>
              </View>
              <View style={s.actionRow}>
                <TouchableOpacity style={s.btnApprove} onPress={() => setMemberStatus(member.uid, 'Active').catch(console.warn)}>
                  <Text style={s.btnApproveTxt}>✅ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnEdit} onPress={() => openEdit(member)}>
                  <Text style={s.btnEditTxt}>✏️ Edit Financials</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnReject} onPress={() => setMemberStatus(member.uid, 'Rejected').catch(console.warn)}>
                  <Text style={s.btnRejectTxt}>❌ Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
      </ScrollView>

      <Modal transparent visible={editModal} animationType="fade" onRequestClose={() => setEditModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Edit Financials</Text>
            <Text style={s.memberMeta}>{selected?.name}</Text>
            <View style={{ height: 1.5, backgroundColor: C.gold, marginVertical: 14 }} />
            <Field label="SHARE CAPITAL (₱)" value={editShares} onChangeText={setEditShares} placeholder="0" keyboardType="numeric" />
            <Field label="SAVINGS (₱)" value={editSavings} onChangeText={setEditSavings} placeholder="0" keyboardType="numeric" />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: 'rgba(26,45,78,0.08)' }]} onPress={() => setEditModal(false)}>
                <Text style={[s.modalBtnTxt, { color: C.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: C.gold, flex: 2 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={C.navyDark} /> : <Text style={[s.modalBtnTxt, { color: C.navyDark }]}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MEMBERS MONITORING TAB
// ══════════════════════════════════════════════════════════════════════════════
const MonitoringTab = ({ members }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const filtered = members.filter(m =>
    (filter === 'All' || m.status === filter) &&
    (m.name?.toLowerCase().includes(search.toLowerCase()) || m.userId?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchBar}>
        <Text style={{ fontSize: 14, marginRight: 8, color: C.textMuted }}>🔍</Text>
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search members..." placeholderTextColor={C.textMuted} />
        {search ? <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 8 }}><Text style={{ color: C.textMuted, fontWeight: '700' }}>✕</Text></TouchableOpacity> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        {['All', 'Active', 'Pending', 'Suspended'].map(f => (
          <TouchableOpacity key={f} style={[s.pill, filter === f && s.pillActive]} onPress={() => setFilter(f)}>
            <Text style={[s.pillTxt, filter === f && s.pillTxtActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Members Monitoring ({filtered.length})</Text>
        {filtered.length === 0
          ? <View style={s.emptyCard}><Text style={s.memberMeta}>No members found.</Text></View>
          : filtered.map(member => (
            <View key={member.uid} style={s.memberCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={s.avatar}><Text style={s.avatarTxt}>{member.name?.split(' ').map(w => w[0]).slice(0, 2).join('') || '??'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>{member.name}</Text>
                  <Text style={s.memberMeta}>{member.userId}</Text>
                  <Text style={s.memberMeta}>{member.email}</Text>
                </View>
                <View style={member.status === 'Active' ? s.badgeActive : member.status === 'Pending' ? s.badgePending : s.badgeSuspended}>
                  <Text style={s.badgeTxt}>{member.status?.toUpperCase()}</Text>
                </View>
              </View>
              <View style={s.finRow}>
                {[['Shares', fmtCur(member.shares), C.gold], ['Savings', fmtCur(member.savings), C.green], ['Loan Bal', fmtCur(member.loanBalance), member.loanBalance > 0 ? C.red : C.green], ['Credit', fmtCur(member.creditBalance), member.creditBalance > 0 ? C.orange : C.green]].map(([l, v, c]) => (
                  <View key={l} style={s.finItem}><Text style={s.finLabel}>{l}</Text><Text style={[s.finVal, { color: c }]}>{v}</Text></View>
                ))}
              </View>
              <View style={s.actionRow}>
                {member.status === 'Active' && <TouchableOpacity style={s.btnReject} onPress={() => setMemberStatus(member.uid, 'Suspended').catch(console.warn)}><Text style={s.btnRejectTxt}>🚫 Suspend</Text></TouchableOpacity>}
                {member.status === 'Suspended' && <TouchableOpacity style={s.btnApprove} onPress={() => setMemberStatus(member.uid, 'Active').catch(console.warn)}><Text style={s.btnApproveTxt}>♻️ Reactivate</Text></TouchableOpacity>}
              </View>
            </View>
          ))}
      </ScrollView>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// LOAN MANAGEMENT TAB
// ══════════════════════════════════════════════════════════════════════════════
const LoansTab = ({ loanApps }) => {
  const [processing, setProcessing] = useState(null);
  const handleResolve = async (app, status) => {
    setProcessing(app.id + status);
    try { await resolveLoanApp(app.id, status, app.memberId, app.amount); }
    catch (e) { console.warn(e); }
    finally { setProcessing(null); }
  };
  const pending  = loanApps.filter(a => a.status === 'Pending');
  const resolved = loanApps.filter(a => a.status !== 'Pending');

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Loan Management</Text>
      <Text style={s.pageSub}>Review and resolve member loan applications.</Text>
      {pending.length === 0
        ? <View style={s.emptyCard}><Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>✅</Text><Text style={s.memberMeta}>No pending loan applications.</Text></View>
        : <>
          <Text style={s.sectionLbl}>PENDING ({pending.length})</Text>
          {pending.map(app => (
            <View key={app.id} style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <View><Text style={s.memberName}>{app.memberName}</Text><Text style={s.memberMeta}>{app.memberId}</Text></View>
                <View style={s.badgePending}><Text style={s.badgeTxt}>PENDING</Text></View>
              </View>
              {[['Amount', fmtCur(app.amount)], ['Purpose', app.purpose], ['Term', app.term]].map(([l, v]) => (
                <View key={l} style={s.loanRow}><Text style={s.finLabel}>{l}</Text><Text style={s.memberName}>{v}</Text></View>
              ))}
              <View style={[s.actionRow, { marginTop: 12 }]}>
                <TouchableOpacity style={[s.btnApprove, { flex: 1 }]} onPress={() => handleResolve(app, 'Approved')} disabled={!!processing}>
                  {processing === app.id + 'Approved' ? <ActivityIndicator color={C.green} size="small" /> : <Text style={s.btnApproveTxt}>✅ Approve</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnReject, { flex: 1 }]} onPress={() => handleResolve(app, 'Rejected')} disabled={!!processing}>
                  {processing === app.id + 'Rejected' ? <ActivityIndicator color={C.red} size="small" /> : <Text style={s.btnRejectTxt}>❌ Reject</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>}
      {resolved.length > 0 && (
        <>
          <Text style={[s.sectionLbl, { marginTop: 20 }]}>RESOLVED ({resolved.length})</Text>
          {resolved.slice(0, 15).map(app => (
            <View key={app.id} style={[s.card, { opacity: 0.75 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View><Text style={s.memberName}>{app.memberName}</Text><Text style={s.memberMeta}>{fmtCur(app.amount)} — {app.purpose}</Text></View>
                <View style={app.status === 'Approved' ? s.badgeActive : s.badgeSuspended}><Text style={s.badgeTxt}>{app.status?.toUpperCase()}</Text></View>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CANTEEN ORDERS TAB
// ══════════════════════════════════════════════════════════════════════════════
const OrdersTab = ({ orders }) => (
  <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
    <Text style={s.pageTitle}>Canteen Orders ({orders.length})</Text>
    {orders.length === 0
      ? <View style={s.emptyCard}><Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>🍽️</Text><Text style={s.memberMeta}>No orders yet today.</Text></View>
      : orders.map(order => (
        <View key={order.docId || order.orderId} style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View><Text style={s.memberName}>{order.orderId}</Text><Text style={s.memberMeta}>{order.memberName} · {order.createdAt}</Text></View>
            <View style={order.paymentMethod === 'Credit' ? s.badgePending : s.badgeActive}><Text style={s.badgeTxt}>{order.paymentMethod?.toUpperCase()}</Text></View>
          </View>
          {order.items?.map((item, i) => <Text key={i} style={[s.memberMeta, { marginBottom: 2 }]}>{item.emoji} {item.name} x{item.qty} — {fmtCur(item.price * item.qty)}</Text>)}
          <View style={[s.loanRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: 'rgba(26,45,78,0.08)' }]}>
            <Text style={s.finLabel}>Total</Text>
            <Text style={s.memberName}>{fmtCur(order.total)}</Text>
          </View>
        </View>
      ))}
  </ScrollView>
);

// ══════════════════════════════════════════════════════════════════════════════
// MENU TAB
// ══════════════════════════════════════════════════════════════════════════════
const MenuTab = () => {
  const [seeding, setSeeding] = useState(false);
  const [seeded,  setSeeded]  = useState(false);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={s.pageTitle}>Manage Menu</Text>
      <View style={s.card}>
        <Text style={[s.memberName, { marginBottom: 6 }]}>🌱 Seed Default Menu Items</Text>
        <Text style={s.memberMeta}>Populate Firestore with the default 20 canteen items. Run only ONCE when setting up for the first time.</Text>
        <TouchableOpacity style={[s.btnApprove, { marginTop: 12, opacity: seeded ? 0.5 : 1 }]} onPress={async () => { setSeeding(true); try { await seedMenuItems(); setSeeded(true); } catch(e){} finally { setSeeding(false); }}} disabled={seeding || seeded}>
          {seeding ? <ActivityIndicator color={C.green} size="small" /> : <Text style={s.btnApproveTxt}>{seeded ? '✓ Seeded!' : 'Seed Default Menu'}</Text>}
        </TouchableOpacity>
      </View>
      <View style={s.card}>
        <Text style={[s.memberName, { marginBottom: 6 }]}>📝 Edit Menu Items Directly</Text>
        <Text style={s.memberMeta}>{'Firebase Console → Firestore → menuItems collection\n\nEach item has: name, category, price, stock, emoji, available\n\nChanges appear instantly in the Canteen app!'}</Text>
      </View>
    </ScrollView>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFY TAB
// ══════════════════════════════════════════════════════════════════════════════
const NotifyTab = ({ members }) => {
  const [selectedUid, setSelectedUid] = useState('');
  const [title,   setTitle]   = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [search,  setSearch]  = useState('');
  const filtered = members.filter(m => m.name?.toLowerCase().includes(search.toLowerCase()) || m.userId?.toLowerCase().includes(search.toLowerCase()));
  const selectedMember = members.find(m => m.uid === selectedUid);

  const handleSend = async () => {
    if (!selectedUid || !title.trim() || !message.trim()) return;
    setSending(true);
    try {
      await sendNotification(selectedUid, { title: title.trim(), message: message.trim(), type: 'admin' });
      setSent(true); setTitle(''); setMessage(''); setSelectedUid('');
      setTimeout(() => setSent(false), 3000);
    } catch (e) { console.warn(e); }
    finally { setSending(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Text style={s.pageTitle}>Notify a Member</Text>
      <Text style={s.fieldLabel}>SELECT MEMBER</Text>
      <View style={[s.searchBar, { margin: 0, marginBottom: 12 }]}>
        <Text style={{ fontSize: 14, marginRight: 8, color: C.textMuted }}>🔍</Text>
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search member..." placeholderTextColor={C.textMuted} />
      </View>
      {search.length > 0 && (
        <View style={{ backgroundColor: 'rgba(255,255,255,0.60)', borderRadius: 10, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.70)' }}>
          {filtered.slice(0, 5).map(m => (
            <TouchableOpacity key={m.uid} style={[{ padding: 12, borderBottomWidth: 1, borderColor: 'rgba(26,45,78,0.07)' }, selectedUid === m.uid && { backgroundColor: 'rgba(201,168,76,0.15)' }]}
              onPress={() => { setSelectedUid(m.uid); setSearch(''); }}>
              <Text style={s.memberName}>{m.name}</Text><Text style={s.memberMeta}>{m.userId}</Text>
            </TouchableOpacity>
          ))}
          {filtered.length === 0 && <Text style={{ padding: 12, color: C.textMuted }}>No members found.</Text>}
        </View>
      )}
      {selectedMember && (
        <View style={{ backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)' }}>
          <Text style={s.memberName}>📬 Sending to: {selectedMember.name}</Text>
          <Text style={s.memberMeta}>{selectedMember.userId}</Text>
        </View>
      )}
      <Field label="NOTIFICATION TITLE" value={title} onChangeText={setTitle} placeholder="e.g. Loan Update, Meeting Reminder" />
      <Text style={s.fieldLabel}>MESSAGE</Text>
      <View style={[s.fieldRow, { marginBottom: 16 }]}>
        <TextInput style={[s.fieldInput, { minHeight: 90, textAlignVertical: 'top' }]} value={message} onChangeText={setMessage} placeholder="Type your message here..." placeholderTextColor="rgba(26,45,78,0.35)" multiline />
      </View>
      {sent && <Text style={{ color: C.green, fontFamily: 'GoogleSans_700Bold', textAlign: 'center', marginBottom: 10 }}>✓ Notification sent!</Text>}
      <TouchableOpacity style={[s.btnApprove, { opacity: (!selectedUid || !title || !message || sending) ? 0.45 : 1 }]} onPress={handleSend} disabled={!selectedUid || !title.trim() || !message.trim() || sending}>
        {sending ? <ActivityIndicator color={C.green} size="small" /> : <Text style={s.btnApproveTxt}>🔔  Send Notification</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD SHELL
// ══════════════════════════════════════════════════════════════════════════════
const AdminDashboard = ({ admin, onLogout, isWide, isSmall }) => {
  const [activeNav,  setActiveNav]  = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [members,    setMembers]    = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [loanApps,   setLoanApps]   = useState([]);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const u1 = listenAllMembers(setMembers);
    const u2 = listenAllOrders(setOrders);
    const u3 = listenAllLoanApps(setLoanApps);
    return () => { u1(); u2(); u3(); };
  }, []);

  const switchNav = (key) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,  duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 10, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setActiveNav(key); setDrawerOpen(false);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const pendingCount = members.filter(m => m.status === 'Pending').length;
  const loanCount    = loanApps.filter(a => a.status === 'Pending').length;

  const renderContent = () => {
    switch (activeNav) {
      case 'dashboard':  return <DashboardTab  members={members} loanApps={loanApps} admin={admin} />;
      case 'accounts':   return <AccountsTab   members={members} />;
      case 'monitoring': return <MonitoringTab members={members} />;
      case 'loans':      return <LoansTab      loanApps={loanApps} />;
      case 'orders':     return <OrdersTab     orders={orders} />;
      case 'menu':       return <MenuTab />;
      case 'notify':     return <NotifyTab     members={members} />;
      default:           return <DashboardTab  members={members} loanApps={loanApps} admin={admin} />;
    }
  };

  const SidebarContent = ({ onClose }) => (
    <View style={s.sidebar}>
      <View style={s.sidebarLogo}>
        <View style={s.logoBox}><Text style={s.logoBoxTxt}>CS</Text></View>
        <Text style={s.sidebarLogoTxt}>CESLA Cooperative</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {SIDEBAR.map(group => (
          <View key={group.section}>
            <Text style={s.sidebarSection}>{group.section}</Text>
            {group.items.map(item => {
              const badge  = item.key === 'accounts' ? pendingCount : item.key === 'loans' ? loanCount : 0;
              const active = activeNav === item.key;
              return (
                <TouchableOpacity key={item.key} style={[s.navItem, active && s.navItemActive]}
                  onPress={() => { switchNav(item.key); if (onClose) onClose(); }} activeOpacity={0.75}>
                  <Text style={[s.navIcon, active && s.navIconActive]}>{item.icon}</Text>
                  <Text style={[s.navLabel, active && s.navLabelActive]}>{item.label}</Text>
                  {badge > 0 && <View style={s.navBadge}><Text style={s.navBadgeTxt}>{badge}</Text></View>}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={s.dashRoot}>
      {/* Topbar */}
      <View style={[s.topbar, { paddingTop: Platform.OS === 'web' ? 0 : 44 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {!isWide && (
            <TouchableOpacity style={s.menuBtn} onPress={() => setDrawerOpen(v => !v)}>
              <Text style={{ color: '#fff', fontSize: 20 }}>☰</Text>
            </TouchableOpacity>
          )}
          <View style={s.logoBox}><Text style={s.logoBoxTxt}>CS</Text></View>
          <Text style={s.topbarTitle}>CESLA Cooperative</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
            <View style={s.adminAvatar}><Text style={s.adminAvatarTxt}>A</Text></View>
            {!isSmall && <Text style={{ fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: '#fff' }} numberOfLines={1}>{admin.name}</Text>}
          </View>
          <TouchableOpacity style={s.signOutBtn} onPress={onLogout}>
            <Text style={s.signOutTxt}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {isWide && <SidebarContent />}
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {renderContent()}
        </Animated.View>
      </View>

      {/* Mobile Drawer */}
      {!isWide && drawerOpen && (
        <TouchableOpacity style={s.drawerOverlay} activeOpacity={1} onPress={() => setDrawerOpen(false)}>
          <View style={s.drawerContainer}><SidebarContent onClose={() => setDrawerOpen(false)} /></View>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════════════════
export default function CoopScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({ NotoSerif_700Bold, GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold });
  const [view,  setView]  = useState(V.SPLASH);
  const [admin, setAdmin] = useState(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const { getMember } = await import('../firebase/firebaseService');
          const doc = await getMember(user.uid);
          if (doc.role === 'admin') { setAdmin(doc); transitionTo(V.DASHBOARD); }
          else { await logoutUser(); transitionTo(V.LOGIN); }
        } catch { transitionTo(V.LOGIN); }
      } else { transitionTo(V.LOGIN); }
    });
    return () => unsub();
  }, []);

  const transitionTo = (next) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      setView(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    });
  };

  const handleLogin  = (a) => { setAdmin(a); transitionTo(V.DASHBOARD); };
  const handleLogout = async () => { await logoutUser(); setAdmin(null); transitionTo(V.LOGIN); };

  if (!fontsLoaded || view === V.SPLASH) {
    return (
      <View style={{ flex: 1 }}>
        <AppBg />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={C.navy} />
          <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted }}>Loading Admin Portal...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AppBg />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {view === V.LOGIN     && <AdminLogin onLogin={handleLogin} navigation={navigation} isWide={isWide} isSmall={isSmall} />}
        {view === V.DASHBOARD && admin && <AdminDashboard admin={admin} onLogout={handleLogout} isWide={isWide} isSmall={isSmall} />}
      </Animated.View>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Login
  loginTopbar: { backgroundColor: C.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, paddingTop: Platform.OS === 'web' ? 14 : 54, borderBottomWidth: 2, borderColor: C.gold },
  backBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  loginOuter: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16 },
  loginCard: { width: '100%', maxWidth: 440, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', padding: 28, shadowColor: '#011f4b', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 6 } },
  loginLogo: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 18, borderWidth: 2.5, borderColor: 'rgba(201,168,76,0.50)' },
  loginTitle: { fontFamily: 'NotoSerif_700Bold', fontSize: 24, color: C.navy, textAlign: 'center', marginBottom: 4 },
  loginSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 19 },
  adminBadge: { backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(201,168,76,0.40)', padding: 12, marginBottom: 20, alignItems: 'center' },
  adminBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.navy, letterSpacing: 2 },
  loginBtn: { borderRadius: 28, overflow: 'hidden', marginTop: 18, marginBottom: 14 },
  loginBtnGrad: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  loginBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: C.navyDark, letterSpacing: 1.5 },
  loginNote: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 17 },

  // Fields
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(240,245,250,0.90)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: 'rgba(200,215,230,0.80)' },
  fieldRowError: { borderColor: C.red },
  fieldInput: { flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: C.navy },
  fieldErr: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.red, marginTop: 4 },

  // Dashboard shell
  dashRoot: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.navy, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 2, borderColor: C.gold, gap: 10 },
  topbarTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: '#fff' },
  logoBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center' },
  logoBoxTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navyDark },
  menuBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.10)', justifyContent: 'center', alignItems: 'center' },
  adminAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center' },
  adminAvatarTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.navyDark },
  signOutBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.red },
  signOutTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#fff' },

  // Sidebar
  sidebar: { width: 210, backgroundColor: C.navy, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sidebarLogo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18, paddingTop: 22, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  sidebarLogoTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff' },
  sidebarSection: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, marginHorizontal: 6, marginBottom: 2, borderRadius: 8, minHeight: 40 },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  navIcon: { fontSize: 13, color: 'rgba(255,255,255,0.40)', width: 18, textAlign: 'center' },
  navIconActive: { color: C.gold },
  navLabel: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.60)', flex: 1 },
  navLabelActive: { fontFamily: 'GoogleSans_700Bold', color: '#fff' },
  navBadge: { backgroundColor: C.red, borderRadius: 8, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  navBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#fff' },
  drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.50)', zIndex: 10 },
  drawerContainer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 220, zIndex: 11 },

  // Content
  pageOuter: { padding: 20, paddingBottom: 48 },
  pageTitle: { fontFamily: 'NotoSerif_700Bold', fontSize: 22, color: C.navy, marginBottom: 4 },
  pageSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 19 },
  sectionLbl: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },

  // Stat cards
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 130, backgroundColor: 'rgba(255,255,255,0.30)', borderRadius: 14, padding: 16, borderTopWidth: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  statLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: C.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  statVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 32, marginBottom: 4 },
  statSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted },

  // Activity
  activityCard: { backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  activityTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: C.navy },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: 'rgba(26,45,78,0.07)' },
  activityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  activityText: { fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: C.navy, marginBottom: 2 },

  // Members
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 14, margin: 16, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.60)' },
  searchInput: { flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.30)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.50)' },
  pillActive: { backgroundColor: C.navy, borderColor: C.navy },
  pillTxt: { fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: C.textMuted },
  pillTxtActive: { color: '#fff' },
  memberCard: { backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.gold },
  memberName: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.navy, marginBottom: 2 },
  memberMeta: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, lineHeight: 16 },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  finRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  finItem: { flex: 1, minWidth: 60, backgroundColor: 'rgba(255,255,255,0.40)', borderRadius: 8, padding: 8, alignItems: 'center' },
  finLabel: { fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: C.textMuted, marginBottom: 3 },
  finVal: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.navy },

  // Badges
  badgeActive:    { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(46,204,113,0.15)',  borderWidth: 1, borderColor: 'rgba(46,204,113,0.50)'  },
  badgePending:   { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(245,166,35,0.15)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.50)' },
  badgeSuspended: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(231,76,60,0.15)',  borderWidth: 1, borderColor: 'rgba(231,76,60,0.50)'  },
  badgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: C.navy, letterSpacing: 0.8 },

  // Buttons
  btnApprove:    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: 'rgba(46,204,113,0.15)',  borderWidth: 1, borderColor: 'rgba(46,204,113,0.45)',  alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  btnApproveTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#1a7a4a' },
  btnEdit:       { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: 'rgba(111,163,247,0.15)', borderWidth: 1, borderColor: 'rgba(111,163,247,0.45)', alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  btnEditTxt:    { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#2a5ba8' },
  btnReject:     { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: 'rgba(231,76,60,0.12)',   borderWidth: 1, borderColor: 'rgba(231,76,60,0.40)',   alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  btnRejectTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#c0392b' },

  // Cards
  card: { backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', marginBottom: 12 },
  loanRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderColor: 'rgba(26,45,78,0.06)' },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 14, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 380, backgroundColor: 'rgba(220,232,242,0.98)', borderRadius: 20, padding: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)' },
  modalTitle: { fontFamily: 'NotoSerif_700Bold', fontSize: 18, color: C.navy, marginBottom: 4 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  modalBtnTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 14 },
});