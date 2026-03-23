// src/screens/ManageCoopScreen.js
// CESLA MPC — Admin Dashboard (Firebase Firestore real-time)
// Members registered via CoopScreen → Firestore 'members' (status: Pending)
// Admin sees them instantly here → Approve / Reject → member can now login
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, useWindowDimensions, Platform,
  TextInput, ActivityIndicator, Modal, KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

// ─── Firebase ────────────────────────────────────────────────────────────────
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, addDoc, serverTimestamp,
  where, getDocs, setDoc, getDoc, limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── PALETTE — matches #98bad5 light background ───────────────────────────────
const C = {
  navy:       '#0f1e35',
  navyMid:    '#1a2d4e',
  navyDeep:   '#243554',
  gold:       '#c9a84c',
  goldLt:     '#e8c87a',
  green:      '#1a8a4a',
  greenLt:    '#25a85a',
  red:        '#c0392b',
  redLt:      '#e74c3c',
  orange:     '#c47d0e',
  orangeLt:   '#e8960f',
  blue:       '#2563b0',
  blueLt:     '#3b7dd8',
  purple:     '#6d44c9',
  cyan:       '#0e8fa8',
  bgBase:     '#98bad5',
  surface:    'rgba(255,255,255,0.50)',
  surfaceHi:  'rgba(255,255,255,0.70)',
  border:     'rgba(15,30,53,0.14)',
  borderGold: 'rgba(180,130,40,0.45)',
  text:       '#0f1e35',
  textSec:    'rgba(15,30,53,0.65)',
  textMuted:  'rgba(15,30,53,0.42)',
};

const fmtCur  = v => '₱' + Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtNum  = v => Number(v || 0).toLocaleString('en-PH');
const fmtDate = ts => {
  if (!ts) return '—';
  const d = ts?.toDate?.() || new Date(ts);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtTime = ts => {
  if (!ts) return 'Never';
  const d = ts?.toDate?.() || new Date(ts);
  return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
};
const initials = name => (name || '?').split(/[\s,]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// ─── PASSWORD HASH (same algo as CoopScreen) ─────────────────────────────────
const hashPassword = pw => {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) { hash = (hash << 5) - hash + pw.charCodeAt(i); hash |= 0; }
  return 'h_' + Math.abs(hash).toString(36) + pw.length;
};

// ─── FIRESTORE ACTIONS ────────────────────────────────────────────────────────

const approveMember = async (memberId, memberName, memberUserId) => {
  await updateDoc(doc(db, 'members', memberId), {
    status: 'Active',
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'adminNotifications'), {
    type: 'approved', icon: '✅',
    title: 'Member Approved',
    message: `${memberName} (${memberUserId}) has been approved and can now login.`,
    memberId, memberUserId,
    createdAt: serverTimestamp(), read: false,
  });
  await addDoc(collection(db, 'auditLogs'), {
    action: 'Member Approved', target: memberName,
    userId: memberUserId, memberId,
    time: serverTimestamp(),
  });
};

const rejectMember = async (memberId, memberName, memberUserId, reason) => {
  await updateDoc(doc(db, 'members', memberId), {
    status: 'Rejected',
    rejectionReason: reason || '',
    rejectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'auditLogs'), {
    action: 'Member Rejected', target: memberName,
    userId: memberUserId, memberId, reason,
    time: serverTimestamp(),
  });
};

const deactivateMember = async (memberId, memberName, memberUserId) => {
  await updateDoc(doc(db, 'members', memberId), {
    status: 'Inactive', updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'auditLogs'), {
    action: 'Member Deactivated', target: memberName,
    userId: memberUserId, memberId, time: serverTimestamp(),
  });
};

const activateMember = async (memberId, memberName, memberUserId) => {
  await updateDoc(doc(db, 'members', memberId), {
    status: 'Active', updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'auditLogs'), {
    action: 'Member Activated', target: memberName,
    userId: memberUserId, memberId, time: serverTimestamp(),
  });
};

const resetPassword = async (memberId, memberName, newPw) => {
  await updateDoc(doc(db, 'members', memberId), {
    passwordHash: hashPassword(newPw),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'auditLogs'), {
    action: 'Password Reset', target: memberName, memberId,
    time: serverTimestamp(),
  });
};

const markNotifRead = async notifId => {
  await updateDoc(doc(db, 'adminNotifications', notifId), { read: true });
};

// ─── REALTIME HOOKS ───────────────────────────────────────────────────────────

const useCollection = (col, ...constraints) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, col), ...constraints);
    const unsub = onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);
  return { data, loading };
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────

const AppBg = () => (
  <>
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
    <LinearGradient
      colors={['rgba(198,220,235,0.90)', 'rgba(152,186,213,0.55)', 'rgba(110,155,185,0.20)']}
      locations={[0, 0.5, 1]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  </>
);

const Spinner = ({ msg = 'Loading...' }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
    <ActivityIndicator size="large" color={C.gold} />
    <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec }}>{msg}</Text>
  </View>
);

const StatusPill = ({ status }) => {
  const map = {
    Active:        { bg: 'rgba(26,138,74,0.18)',  border: 'rgba(26,138,74,0.50)',  color: C.green },
    Pending:       { bg: 'rgba(180,110,10,0.18)', border: 'rgba(180,110,10,0.50)', color: C.orange },
    Inactive:      { bg: 'rgba(192,57,43,0.15)',  border: 'rgba(192,57,43,0.45)',  color: C.red },
    Rejected:      { bg: 'rgba(192,57,43,0.15)',  border: 'rgba(192,57,43,0.45)',  color: C.red },
    Approved:      { bg: 'rgba(26,138,74,0.18)',  border: 'rgba(26,138,74,0.50)',  color: C.green },
    'Under Review':{ bg: 'rgba(37,99,176,0.15)',  border: 'rgba(37,99,176,0.45)',  color: C.blue },
    Overdue:       { bg: 'rgba(192,57,43,0.15)',  border: 'rgba(192,57,43,0.45)',  color: C.red },
  };
  const t = map[status] || map.Pending;
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: t.bg, borderWidth: 1, borderColor: t.border, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: t.color, letterSpacing: 0.8 }}>{status}</Text>
    </View>
  );
};

// Glass card
const GCard = ({ style, children }) => (
  <View style={[{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)', padding: 14, marginBottom: 12, shadowColor: '#1a2d4e', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }, style]}>
    {children}
  </View>
);

// Confirm / Action Modal
const ActionModal = ({ visible, title, message, confirmLabel, confirmColor, onConfirm, onCancel, loading, children }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={a.modalBg}>
      <View style={a.modalCard}>
        <Text style={a.modalTitle}>{title}</Text>
        {message ? <Text style={a.modalMsg}>{message}</Text> : null}
        {children}
        <View style={a.modalBtns}>
          <TouchableOpacity style={a.modalCancel} onPress={onCancel} disabled={loading}>
            <Text style={a.modalCancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[a.modalConfirm, { backgroundColor: confirmColor || C.green }]} onPress={onConfirm} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={a.modalConfirmTxt}>{confirmLabel}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// Metric tile
const MetricTile = ({ label, value, icon, color, sub }) => (
  <View style={[a.tile, { borderTopColor: color, borderTopWidth: 3 }]}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <View style={[a.tileIcon, { backgroundColor: color + '22' }]}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
    </View>
    <Text style={[a.tileVal, { color }]}>{value}</Text>
    <Text style={a.tileLbl}>{label}</Text>
    {sub ? <Text style={a.tileSub}>{sub}</Text> : null}
  </View>
);

// ─── SIDEBAR NAV ─────────────────────────────────────────────────────────────

const NAV = [
  { key: 'overview',      label: 'Overview',          icon: '⊞', single: true },
  { key: 'members_grp',   label: 'Members',           icon: '👥', children: [
    { key: 'pending',     label: 'Pending Approval',  icon: '⏳' },
    { key: 'all_members', label: 'All Members',       icon: '👤' },
    { key: 'delinquency', label: 'Delinquency',       icon: '⚠️' },
  ]},
  { key: 'financial_grp', label: 'Financial',         icon: '💰', children: [
    { key: 'collections', label: 'Collections',       icon: '💵' },
    { key: 'loans',       label: 'Loans',             icon: '💳' },
  ]},
  { key: 'claims_grp',    label: 'Claims',            icon: '🧾', children: [
    { key: 'claims',      label: 'Claims',            icon: '🧾' },
  ]},
  { key: 'reports_grp',   label: 'Reports',           icon: '📊', children: [
    { key: 'reports',     label: 'Reports & Analytics', icon: '📊' },
    { key: 'documents',   label: 'Document Monitoring', icon: '📁' },
  ]},
  { key: 'system_grp',    label: 'System',            icon: '⚙️', children: [
    { key: 'audit',       label: 'Audit Trail',       icon: '🧾' },
    { key: 'performance', label: 'Agent Performance', icon: '🏢' },
    { key: 'settings',    label: 'System Settings',   icon: '⚙️' },
    { key: 'notifications', label: 'Notifications',   icon: '🔔' },
  ]},
  { key: 'chat_grp',      label: 'Member Chat',       icon: '💬', children: [
    { key: 'chat_inbox',  label: 'Chat Inbox',        icon: '📥' },
    { key: 'chat_group',  label: 'Group Chat',        icon: '👥' },
  ]},
];

const SidebarItem = ({ group, active, onNav, onClose, badge }) => {
  const isGroupActive = group.single ? active === group.key : !!(group.children?.find(c => c.key === active));
  const [open, setOpen] = useState(isGroupActive && !group.single);
  const anim = useRef(new Animated.Value(isGroupActive && !group.single ? 1 : 0)).current;

  const toggle = () => {
    if (group.single) { onNav(group.key); onClose?.(); return; }
    const next = !open; setOpen(next);
    Animated.timing(anim, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  };
  const maxH   = anim.interpolate({ inputRange: [0, 1], outputRange: [0, (group.children?.length || 0) * 42] });
  const chevRot= anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={{ marginHorizontal: 6, marginBottom: 1 }}>
      <TouchableOpacity
        style={[a.sideHead, group.single && active === group.key && a.sideActive]}
        onPress={toggle} activeOpacity={0.8}
      >
        <Text style={[a.sideIcon, group.single && active === group.key && { color: '#0f1e35' }]}>{group.icon}</Text>
        <Text style={[a.sideLabel, group.single && active === group.key && { color: '#0f1e35', fontFamily: 'GoogleSans_700Bold' }, !group.single && isGroupActive && { color: C.gold }]}>{group.label}</Text>
        {badge > 0 && (
          <View style={a.sideBadge}><Text style={a.sideBadgeTxt}>{badge > 99 ? '99+' : badge}</Text></View>
        )}
        {!group.single && <Animated.Text style={[{ color: 'rgba(255,255,255,0.40)', fontSize: 17 }, { transform: [{ rotate: chevRot }] }]}>›</Animated.Text>}
      </TouchableOpacity>
      {!group.single && (
        <Animated.View style={{ maxHeight: maxH, overflow: 'hidden' }}>
          {group.children.map(c => (
            <TouchableOpacity key={c.key}
              style={[a.sideChild, active === c.key && a.sideChildActive]}
              onPress={() => { onNav(c.key); onClose?.(); }} activeOpacity={0.8}
            >
              <Text style={{ fontSize: 7, color: active === c.key ? C.gold : 'rgba(255,255,255,0.30)', width: 12, textAlign: 'center' }}>
                {active === c.key ? '◆' : '◇'}
              </Text>
              <Text style={[a.sideChildTxt, active === c.key && { color: C.gold, fontFamily: 'GoogleSans_700Bold' }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

const Sidebar = ({ active, onNav, onClose, pendingCount, notifsCount, chatUnread = 0, onLogout, onBack, canGoBack }) => (
  <View style={a.sidebar}>
    <View style={a.sidebarBrand}>
      <View style={a.sidebarLogo}><Text style={a.sidebarLogoTxt}>CS</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={a.sidebarName}>CESLA MPC</Text>
        <Text style={a.sidebarRole}>Admin Portal</Text>
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
      {NAV.map(g => (
        <SidebarItem key={g.key} group={g} active={active} onNav={onNav} onClose={onClose}
          badge={g.key === 'members_grp' ? pendingCount : g.key === 'system_grp' ? notifsCount : g.key === 'chat_grp' ? chatUnread : 0}
        />
      ))}
    </ScrollView>
    {/* Bottom actions: Back + Logout */}
    <View style={{ borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 10, gap: 6 }}>
      {onLogout && (
        <TouchableOpacity onPress={onLogout}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(201,168,76,0.18)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.40)' }}
          activeOpacity={0.8}>
          <Text style={{ fontSize: 13 }}>↩</Text>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.gold }}>Logout</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
);

// ═════════════════════════════════════════════════════════════════════════════
// ─── VIEWS ────────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// ── 1. OVERVIEW ───────────────────────────────────────────────────────────────
const OverviewView = ({ members, claims, loans }) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7);

  const total       = members.length;
  const active      = members.filter(m => m.status === 'Active').length;
  const pending     = members.filter(m => m.status === 'Pending').length;
  const newToday    = members.filter(m => { const d = m.createdAt?.toDate?.() || new Date(m.createdAt || 0); return d >= todayStart; }).length;
  const newWeek     = members.filter(m => { const d = m.createdAt?.toDate?.() || new Date(m.createdAt || 0); return d >= weekStart; }).length;
  const totalSavings= members.reduce((s, m) => s + (m.savings || 0), 0);
  const totalShares = members.reduce((s, m) => s + (m.shares  || 0), 0);
  const totalLoans  = members.reduce((s, m) => s + (m.loan    || 0), 0);
  const pendClaims  = claims.filter(c => c.status === 'Pending').length;
  const apprClaims  = claims.filter(c => c.status === 'Approved').length;
  const pendLoans   = loans.filter(l => l.status === 'Pending').length;

  // Sparkline bar chart — monthly new registrations (last 6 months)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      label: d.toLocaleDateString('en-PH', { month: 'short' }),
      count: members.filter(m => {
        const md = m.createdAt?.toDate?.() || new Date(m.createdAt || 0);
        return md.getMonth() === d.getMonth() && md.getFullYear() === d.getFullYear();
      }).length,
    };
  });
  const maxCount = Math.max(...months.map(m => m.count), 1);

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      {/* Date */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <View>
          <Text style={a.pageTitle}>Executive Overview</Text>
          <Text style={a.pageSub}>CESLA MPC · CLIMBS Employee Cooperative</Text>
        </View>
        <View style={[a.dateBadge]}>
          <Text style={a.dateTxt}>{now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
        </View>
      </View>

      {/* Key metrics */}
      <Text style={a.sHead}>📊 KEY METRICS</Text>
      <View style={a.tileGrid}>
        <MetricTile label="Total Members"     value={fmtNum(total)}       icon="👥" color={C.blue}     sub={`${active} active`} />
        <MetricTile label="Pending Approval"  value={fmtNum(pending)}     icon="⏳" color={C.orange}   sub="Awaiting review" />
        <MetricTile label="Total Savings"     value={fmtCur(totalSavings)}icon="💰" color={C.green}    sub="All members" />
        <MetricTile label="Total Shares"      value={fmtCur(totalShares)} icon="📊" color={C.gold}     sub="Share capital" />
        <MetricTile label="Loans Outstanding" value={fmtCur(totalLoans)}  icon="💳" color={C.orangeLt} sub={`${pendLoans} pending apps`} />
        <MetricTile label="Pending Claims"    value={fmtNum(pendClaims)}  icon="🧾" color={C.purple}   sub={`${apprClaims} approved`} />
      </View>

      {/* New registrations bar chart */}
      <Text style={a.sHead}>📈 NEW REGISTRATIONS (LAST 6 MONTHS)</Text>
      <GCard>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 8 }}>
          {months.map((m, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: C.blue }}>
                {m.count > 0 ? m.count : ''}
              </Text>
              <View style={{ width: '100%', backgroundColor: 'rgba(15,30,53,0.10)', borderRadius: 4, height: 60, justifyContent: 'flex-end', overflow: 'hidden' }}>
                <View style={{ width: '100%', backgroundColor: C.blue, borderRadius: 4, height: `${Math.round((m.count / maxCount) * 100)}%`, minHeight: m.count > 0 ? 4 : 0 }} />
              </View>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 8, color: C.textMuted }}>{m.label}</Text>
            </View>
          ))}
        </View>
      </GCard>

      {/* Quick stats */}
      <Text style={a.sHead}>⚡ QUICK STATS</Text>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: 'New Today',        value: newToday, color: C.cyan },
          { label: 'New This Week',    value: newWeek,  color: C.blue },
          { label: 'Inactive Members', value: members.filter(m => m.status === 'Inactive').length, color: C.textMuted },
          { label: 'Rejected',         value: members.filter(m => m.status === 'Rejected').length, color: C.red },
        ].map(s => (
          <GCard key={s.label} style={{ flex: 1, minWidth: 120, alignItems: 'center', padding: 12, marginBottom: 0 }}>
            <Text style={[a.tileVal, { color: s.color, fontSize: 24 }]}>{s.value}</Text>
            <Text style={[a.tileLbl, { textAlign: 'center' }]}>{s.label}</Text>
          </GCard>
        ))}
      </View>

      {/* Recent registrations */}
      <Text style={a.sHead}>🆕 RECENT REGISTRATIONS</Text>
      <GCard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={a.tableHdr}>
          {['Name', 'User ID', 'Date', 'Status'].map((h, i) => (
            <Text key={h} style={[a.tableHdrTxt, { flex: h === 'Name' ? 2 : 1 }]}>{h}</Text>
          ))}
        </View>
        {members.slice(0, 8).map(m => (
          <View key={m.id} style={a.tableRow}>
            <Text style={[a.tableCell, { flex: 2 }]} numberOfLines={1}>{m.name || m.firstName}</Text>
            <Text style={[a.tableCell, { flex: 1, fontSize: 10 }]} numberOfLines={1}>{m.userId}</Text>
            <Text style={[a.tableCell, { flex: 1, fontSize: 10 }]} numberOfLines={1}>{fmtDate(m.createdAt)}</Text>
            <View style={{ flex: 1 }}><StatusPill status={m.status || 'Pending'} /></View>
          </View>
        ))}
        {members.length === 0 && <Text style={[a.emptyTxt, { padding: 24 }]}>No members yet.</Text>}
      </GCard>
    </ScrollView>
  );
};

// ── 2. PENDING APPROVAL — the core feature ────────────────────────────────────
const PendingView = ({ members }) => {
  const pending = members.filter(m => m.status === 'Pending');
  const [sel,    setSel]    = useState(null);
  const [action, setAction] = useState(null); // 'approve' | 'reject'
  const [reason, setReason] = useState('');
  const [busy,   setBusy]   = useState(false);

  const open = (m, act) => { setSel(m); setAction(act); setReason(''); };
  const close = () => { setSel(null); setAction(null); };

  const confirm = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      if (action === 'approve') await approveMember(sel.id, sel.name, sel.userId);
      else                      await rejectMember(sel.id, sel.name, sel.userId, reason);
      close();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>⏳ Pending Approval</Text>
      <Text style={a.pageSub}>
        {pending.length > 0
          ? `${pending.length} employee${pending.length !== 1 ? 's' : ''} registered and waiting for your review.`
          : 'All registrations have been reviewed.'}
      </Text>

      {/* Explainer banner */}
      {pending.length > 0 && (
        <View style={a.infoBanner}>
          <Text style={a.infoBannerTxt}>
            🔔 When you <Text style={{ fontFamily: 'GoogleSans_700Bold' }}>Approve</Text> a member, they will immediately be able to login using their User ID and password.{'\n'}
            If you <Text style={{ fontFamily: 'GoogleSans_700Bold' }}>Reject</Text>, they will not be able to login.
          </Text>
        </View>
      )}

      {pending.length === 0 && (
        <GCard style={{ alignItems: 'center', padding: 44 }}>
          <Text style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>✅</Text>
          <Text style={a.emptyTxt}>No pending registrations at this time.</Text>
        </GCard>
      )}

      {pending.map(m => (
        <GCard key={m.id} style={{ borderLeftWidth: 4, borderLeftColor: C.orange }}>
          {/* Member info */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <View style={a.memberAvatar}>
              <Text style={a.memberAvatarTxt}>{initials(m.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={a.memberName}>{m.name}</Text>
              <Text style={a.memberUserId}>{m.userId}</Text>
              <Text style={a.memberMeta}>Registered: {fmtDate(m.createdAt)}</Text>
              {m.email   ? <Text style={a.memberMeta}>Email: {m.email}</Text>   : null}
              {m.contact ? <Text style={a.memberMeta}>Contact: {m.contact}</Text> : null}
            </View>
            <StatusPill status="Pending" />
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[a.btnAction, { backgroundColor: 'rgba(26,138,74,0.15)', borderColor: 'rgba(26,138,74,0.50)' }]}
              onPress={() => open(m, 'approve')} activeOpacity={0.8}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.green }}>✓  Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[a.btnAction, { backgroundColor: 'rgba(192,57,43,0.12)', borderColor: 'rgba(192,57,43,0.45)' }]}
              onPress={() => open(m, 'reject')} activeOpacity={0.8}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.red }}>✕  Reject</Text>
            </TouchableOpacity>
          </View>
        </GCard>
      ))}

      {/* Confirm modal */}
      <ActionModal
        visible={!!sel && !!action}
        title={action === 'approve' ? '✅ Approve Member' : '❌ Reject Member'}
        message={action === 'approve'
          ? `Approve ${sel?.name}?\n\nThey will be able to login immediately using their User ID (${sel?.userId}) and their registered password.`
          : `Reject ${sel?.name}'s registration?`}
        confirmLabel={action === 'approve' ? 'Approve' : 'Reject'}
        confirmColor={action === 'approve' ? C.green : C.red}
        onConfirm={confirm}
        onCancel={close}
        loading={busy}
      >
        {action === 'reject' && (
          <View style={{ marginTop: 12 }}>
            <Text style={a.modalFieldLbl}>Reason for rejection (optional)</Text>
            <TextInput
              style={a.modalInput}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Incomplete information, not a CLIMBS employee..."
              placeholderTextColor={C.textMuted}
              multiline numberOfLines={3}
            />
          </View>
        )}
      </ActionModal>
    </ScrollView>
  );
};

// ── 3. ALL MEMBERS ────────────────────────────────────────────────────────────

// Generate unique transaction number
const genTxnNo = (type, idx) => {
  const prefix = { savings: 'SAV', shares: 'SHR', loan: 'LNS' }[type] || 'TXN';
  const ts = Date.now().toString(36).toUpperCase().slice(-5);
  return `${prefix}-${ts}-${String(idx + 1).padStart(4, '0')}`;
};

// ── Member Detail Modal ──────────────────────────────────────────────────────
const MemberDetailModal = ({ member, onClose, height }) => {
  const [tab, setTab]       = useState('details'); // 'details' | 'savings' | 'shares' | 'loan'
  const [txns, setTxns]     = useState([]);
  const [txnLoad, setTxnLoad] = useState(false);
  const [resetPw, setResetPw] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetErr, setResetErr]   = useState('');

  const af = member.appForm || {};
  const hasAppForm = !!(af.dob || af.placeOfBirth || af.civilStatus || af.contactNo || af.empType);

  // Load transactions when switching to financial tab
  useEffect(() => {
    if (tab === 'savings' || tab === 'shares' || tab === 'loan') {
      setTxnLoad(true);
      const unsub = onSnapshot(
        query(collection(db, 'transactions'),
          where('memberId', '==', member.id),
          where('type', '==', tab),
          orderBy('createdAt', 'desc')
        ),
        snap => {
          setTxns(snap.docs.map((d, i) => ({
            id: d.id,
            txnNo: d.data().txnNo || genTxnNo(tab, i),
            ...d.data(),
          })));
          setTxnLoad(false);
        },
        () => setTxnLoad(false)
      );
      return unsub;
    }
  }, [tab, member.id]);

  const doReset = async () => {
    if (resetPw.length < 6) { setResetErr('Min. 6 characters required.'); return; }
    setResetting(true); setResetErr('');
    try {
      await resetPassword(member.id, member.name, resetPw);
      setResetDone(true); setResetPw('');
      setTimeout(() => setResetDone(false), 3000);
    } catch (e) { setResetErr(e.message || 'Reset failed.'); }
    finally { setResetting(false); }
  };

  const Row = ({ label, value, color }) => (
    <View style={{ flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.07)' }}>
      <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textMuted, width: 130, flexShrink: 0 }}>{label}</Text>
      <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: color || C.navy, flex: 1, lineHeight: 18 }}>{value || '—'}</Text>
    </View>
  );

  const TABS = [
    { key: 'details', label: '👤 Details' },
    { key: 'savings', label: '💰 Savings' },
    { key: 'shares',  label: '📊 Shares' },
    { key: 'loan',    label: '💳 Loan' },
    { key: 'reset',   label: '🔑 Reset PW' },
  ];

  const statusColor = member.status === 'Active' ? C.green : member.status === 'Inactive' ? C.red : C.orange;

  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(10,20,40,0.60)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <View style={{
          width: '100%', maxWidth: 620,
          maxHeight: height ? height * 0.90 : 600,
          backgroundColor: '#deeaf3',
          borderRadius: 20, overflow: 'hidden',
          borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
          shadowColor: '#0f1e35', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
        }}>

          {/* ── Header ── */}
          <LinearGradient colors={['#1a2d4e', '#243554']} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(201,168,76,0.28)', borderWidth: 2, borderColor: C.gold, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: C.gold }}>{initials(member.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: '#fff' }} numberOfLines={1}>{member.name}</Text>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{member.userId}</Text>
            </View>
            {/* Status pill */}
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: statusColor + '33', borderWidth: 1, borderColor: statusColor }}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: statusColor }}>{member.status}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ marginLeft: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, lineHeight: 20 }}>✕</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* ── Financial summary strip ── */}
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.45)', borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.10)' }}>
            {[
              { l: 'Savings',    v: fmtCur(member.savings),     c: C.green,  tab: 'savings' },
              { l: 'Shares',     v: fmtCur(member.shares),      c: C.gold,   tab: 'shares'  },
              { l: 'Loan Bal.',  v: fmtCur(member.loanBalance), c: member.loanBalance > 0 ? C.red : C.textMuted, tab: 'loan' },
            ].map(f => (
              <TouchableOpacity key={f.l} onPress={() => setTab(f.tab)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: tab === f.tab ? 2 : 0, borderColor: f.c }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: f.c }}>{f.v}</Text>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginTop: 1 }}>{f.l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Tabs ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.10)', flexGrow: 0 }}>
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 4 }}>
              {TABS.map(t => (
                <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
                  style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2, borderColor: tab === t.key ? C.gold : 'transparent' }}>
                  <Text style={{ fontFamily: tab === t.key ? 'GoogleSans_700Bold' : 'GoogleSans_400Regular', fontSize: 12, color: tab === t.key ? C.navy : C.textMuted }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* ── Tab Body ── */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator>

            {/* DETAILS TAB */}
            {tab === 'details' && (
              <>
                {/* Basic info — always shown */}
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.8, marginBottom: 8 }}>ACCOUNT INFO</Text>
                <Row label="User ID"       value={member.userId} />
                <Row label="Status"        value={member.status} color={statusColor} />
                <Row label="Member Since"  value={fmtDate(member.approvedAt || member.createdAt)} />
                <Row label="Last Login"    value={fmtTime(member.lastLogin)} />
                <Row label="Email"         value={member.email} />
                <Row label="Contact"       value={member.contact || af.contactNo} />
                <Row label="Address"       value={member.address || af.presentAddress} />

                {/* App Form details — only if application form was filled */}
                {hasAppForm ? (
                  <>
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.8, marginTop: 14, marginBottom: 8 }}>PERSONAL DETAILS (APPLICATION FORM)</Text>
                    <Row label="Full Name"       value={[af.salutation, member.firstName, member.middleName, member.lastName, af.suffix].filter(Boolean).join(' ')} />
                    <Row label="Gender"          value={af.gender} />
                    <Row label="Civil Status"    value={af.civilStatus} />
                    <Row label="Date of Birth"   value={af.dob} />
                    <Row label="Place of Birth"  value={af.placeOfBirth} />
                    <Row label="Nationality"     value={af.nationality === 'Others' ? af.nationalityOther : af.nationality} />
                    <Row label="Religion"        value={af.religion === 'Others' ? af.religionOther : af.religion} />
                    <Row label="No. Dependents"  value={af.numDependents} />
                    <Row label="Present Address" value={af.presentAddress ? `${af.presentAddress}${af.presentZip ? ', ' + af.presentZip : ''}` : undefined} />

                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.8, marginTop: 14, marginBottom: 8 }}>GOVERNMENT IDs</Text>
                    {(af.govIds && af.govIds.length > 0)
                      ? af.govIds.filter(g => g.type || g.number).map((g, i) => (
                          <Row key={i} label={g.type || `ID #${i+1}`} value={g.number} />
                        ))
                      : [['SSS/GSIS', af.sssGsis], ['TIN', af.tin], ['PhilHealth', af.philHealth], ['Pag-IBIG', af.pagIbig]]
                          .filter(([, v]) => v).map(([l, v]) => <Row key={l} label={l} value={v} />)
                    }

                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.8, marginTop: 14, marginBottom: 8 }}>EMPLOYMENT</Text>
                    <Row label="Status"        value={af.empType} />
                    {af.empType === 'Employed' && <>
                      <Row label="Employer"      value={af.employerName} />
                      <Row label="Position"      value={af.positionRank} />
                      <Row label="Monthly Income" value={af.monthlyIncome ? '₱' + Number(af.monthlyIncome).toLocaleString('en-PH') : undefined} color={C.green} />
                    </>}
                    {af.empType === 'Self-Employed' && <>
                      <Row label="Business"      value={af.bizName} />
                      <Row label="Nature"        value={af.bizNature} />
                      <Row label="Monthly Income" value={af.selfMonthlyIncome ? '₱' + Number(af.selfMonthlyIncome).toLocaleString('en-PH') : undefined} color={C.green} />
                    </>}
                  </>
                ) : (
                  <View style={{ marginTop: 14, backgroundColor: 'rgba(196,125,14,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(196,125,14,0.35)', padding: 12 }}>
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.orange, marginBottom: 4 }}>⚠️ Application Form Not Yet Submitted</Text>
                    <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, lineHeight: 18 }}>
                      This member has not yet filled out their Application Form. Personal details, government IDs, and employment info will appear here once submitted.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* SAVINGS / SHARES / LOAN TABS */}
            {(tab === 'savings' || tab === 'shares' || tab === 'loan') && (
              <>
                {/* Balance card */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                    {tab === 'savings' ? 'Total Savings Balance' : tab === 'shares' ? 'Total Share Capital' : 'Outstanding Loan Balance'}
                  </Text>
                  <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 28, color: tab === 'savings' ? C.green : tab === 'shares' ? C.gold : C.red }}>
                    {tab === 'savings' ? fmtCur(member.savings) : tab === 'shares' ? fmtCur(member.shares) : fmtCur(member.loanBalance)}
                  </Text>
                  {tab === 'loan' && member.loan > 0 && (
                    <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                      Original: {fmtCur(member.loan)} · Paid: {fmtCur((member.loan || 0) - (member.loanBalance || 0))}
                    </Text>
                  )}
                </View>

                {/* Transaction list */}
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.8, marginBottom: 10 }}>TRANSACTION HISTORY</Text>
                {txnLoad && <ActivityIndicator color={C.gold} style={{ marginVertical: 20 }} />}
                {!txnLoad && txns.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <Text style={{ fontSize: 28, marginBottom: 8 }}>📄</Text>
                    <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted, textAlign: 'center' }}>
                      No transactions yet.{'\n'}Contact admin for manual entries.
                    </Text>
                  </View>
                )}
                {!txnLoad && txns.map((txn, i) => {
                  const isCredit = txn.amount > 0;
                  return (
                    <View key={txn.id} style={{ backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)', borderLeftWidth: 3, borderLeftColor: isCredit ? C.green : C.red }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.navy }}>{txn.description || (isCredit ? 'Credit' : 'Debit')}</Text>
                          <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginTop: 2 }}>TXN# {txn.txnNo}</Text>
                          <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted }}>{fmtTime(txn.createdAt)}</Text>
                        </View>
                        <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 14, color: isCredit ? C.green : C.red }}>
                          {isCredit ? '+' : ''}{fmtCur(txn.amount)}
                        </Text>
                      </View>
                      {txn.remarks ? <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textSec, marginTop: 6, fontStyle: 'italic' }}>{txn.remarks}</Text> : null}
                    </View>
                  );
                })}
              </>
            )}

            {/* RESET PASSWORD TAB */}
            {tab === 'reset' && (
              <View>
                <View style={{ backgroundColor: 'rgba(201,168,76,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', padding: 12, marginBottom: 16 }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.orange, marginBottom: 4 }}>🔑 Reset Member Password</Text>
                  <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, lineHeight: 18 }}>
                    Use this only if the member forgot their password. The new password will take effect immediately.
                  </Text>
                </View>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.5, marginBottom: 6 }}>MEMBER</Text>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.navy, marginBottom: 14 }}>{member.name} · {member.userId}</Text>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.5, marginBottom: 6 }}>NEW PASSWORD (MIN. 6 CHARACTERS)</Text>
                <TextInput
                  style={{ backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(15,30,53,0.18)', padding: 12, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy, marginBottom: 6 }}
                  value={resetPw} onChangeText={v => { setResetPw(v); setResetErr(''); }}
                  placeholder="Enter new password"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry
                />
                {resetErr ? <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.red, marginBottom: 8 }}>{resetErr}</Text> : null}
                {resetDone ? <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.green, marginBottom: 8 }}>✓ Password reset successfully!</Text> : null}
                <TouchableOpacity
                  onPress={doReset}
                  disabled={resetting}
                  style={{ backgroundColor: C.navyMid, borderRadius: 10, paddingVertical: 13, alignItems: 'center', opacity: resetting ? 0.65 : 1 }}>
                  {resetting
                    ? <ActivityIndicator color={C.gold} />
                    : <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.gold }}>🔑 Reset Password</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const AllMembersView = ({ members, contentHeight }) => {
  const [search,  setSearch]  = useState('');
  const [selMember, setSelMember] = useState(null);
  const { height } = useWindowDimensions();

  // Helper — true if member has submitted their application form
  const hasAppForm = m => {
    const af = m.appForm || {};
    return !!(af.dob || af.civilStatus || af.empType || af.placeOfBirth || af.contactNo);
  };

  // Only show Active members WHO have submitted their application form
  const filtered = members.filter(m => {
    if (m.status !== 'Active') return false;
    if (!hasAppForm(m)) return false;
    const q = search.toLowerCase();
    return (m.name || '').toLowerCase().includes(q) || (m.userId || '').includes(q);
  });

  // Count active members without app form (for the reminder banner)
  const pendingAppForm = members.filter(m => m.status === 'Active' && !hasAppForm(m)).length;

  return (
    <>
      <ScrollView contentContainerStyle={[a.pageOuter, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={true}
        style={contentHeight ? { height: contentHeight } : undefined}>

        <Text style={a.pageTitle}>👥 All Members</Text>
        <Text style={a.pageSub}>Showing Active members with submitted Application Form only.</Text>

        {/* Banner: active members who haven't submitted app form yet */}
        {pendingAppForm > 0 && (
          <View style={{ backgroundColor: 'rgba(196,125,14,0.12)', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#c47d0e', borderWidth: 1, borderColor: 'rgba(196,125,14,0.30)', padding: 12, marginBottom: 14 }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#c47d0e', marginBottom: 2 }}>
              ⚠️ {pendingAppForm} Active Member{pendingAppForm !== 1 ? 's' : ''} Without Application Form
            </Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, lineHeight: 18 }}>
              These members are approved but have not yet submitted their Application Form. They will appear here once submitted.
            </Text>
          </View>
        )}

        {/* Search */}
        <View style={a.searchWrap}>
          <Text style={{ color: C.textMuted, fontSize: 14, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={a.searchInput}
            value={search} onChangeText={setSearch}
            placeholder="Search name or User ID..."
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={{ color: C.textMuted, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
          {filtered.length} member{filtered.length !== 1 ? 's' : ''} with complete application form found
        </Text>

        {/* Member rows — compact, click to open modal */}
        {filtered.map(m => (
          <TouchableOpacity key={m.id} onPress={() => setSelMember(m)} activeOpacity={0.80}>
            <GCard style={{ marginBottom: 8, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[a.memberAvatar, { backgroundColor: 'rgba(26,138,74,0.20)' }]}>
                  <Text style={a.memberAvatarTxt}>{initials(m.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[a.memberName, { color: C.blue }]}>{m.name}</Text>
                  <Text style={a.memberUserId}>{m.userId}</Text>
                  <Text style={a.memberMeta}>
                    {m.appForm?.empType ? `${m.appForm.empType}` : 'App form pending'}
                    {' · '}Joined {fmtDate(m.createdAt)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <StatusPill status={m.status} />
                  <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted }}>Tap to view →</Text>
                </View>
              </View>
              {/* Mini financials */}
              <View style={[a.finRow, { marginTop: 8 }]}>
                {[
                  { l: 'Savings',  v: fmtCur(m.savings),     c: C.green },
                  { l: 'Shares',   v: fmtCur(m.shares),      c: C.gold },
                  { l: 'Loan Bal', v: fmtCur(m.loanBalance), c: m.loanBalance > 0 ? C.red : C.textMuted },
                ].map(f => (
                  <View key={f.l} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{f.l}</Text>
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: f.c }}>{f.v}</Text>
                  </View>
                ))}
              </View>
            </GCard>
          </TouchableOpacity>
        ))}

        {filtered.length === 0 && (
          <GCard style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>👥</Text>
            <Text style={a.emptyTxt}>{search ? 'No members match your search.' : 'No members with a submitted Application Form yet.'}</Text>
          </GCard>
        )}

      </ScrollView>

      {/* Member Detail Modal */}
      {selMember && (
        <MemberDetailModal
          member={selMember}
          onClose={() => setSelMember(null)}
          height={height}
        />
      )}
    </>
  );
};

// ── 4. DELINQUENCY ────────────────────────────────────────────────────────────
const DelinquencyView = ({ members }) => {
  const overdue = members.filter(m => m.loanBalance > 0 && (m.overdue || m.daysOverdue > 0));
  const activeLoans = members.filter(m => m.loanBalance > 0 && !m.overdue && m.status === 'Active');

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>⚠️ Delinquency Tracker</Text>
      <Text style={a.pageSub}>Members with overdue or outstanding loan balances.</Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { l: 'Overdue Accounts',  v: overdue.length,     c: C.red    },
          { l: 'Active Loan Holders', v: activeLoans.length, c: C.orange },
          { l: 'Total Overdue',
            v: fmtCur(overdue.reduce((s, m) => s + (m.loanBalance || 0), 0)),
            c: C.red },
        ].map(s => (
          <GCard key={s.l} style={{ flex: 1, minWidth: 110, alignItems: 'center', padding: 14, marginBottom: 0 }}>
            <Text style={[a.tileVal, { color: s.c, fontSize: 18 }]}>{s.v}</Text>
            <Text style={[a.tileLbl, { textAlign: 'center' }]}>{s.l}</Text>
          </GCard>
        ))}
      </View>

      {overdue.length > 0 && (
        <View style={[a.infoBanner, { borderLeftColor: C.red, backgroundColor: 'rgba(192,57,43,0.10)' }]}>
          <Text style={[a.infoBannerTxt, { color: C.red }]}>
            🚨 {overdue.length} account{overdue.length !== 1 ? 's' : ''} overdue — immediate action required.
          </Text>
        </View>
      )}

      {overdue.map(m => (
        <GCard key={m.id} style={{ borderLeftWidth: 4, borderLeftColor: C.red }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[a.memberAvatar, { backgroundColor: 'rgba(192,57,43,0.18)' }]}>
              <Text style={a.memberAvatarTxt}>{initials(m.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={a.memberName}>{m.name}</Text>
              <Text style={a.memberUserId}>{m.userId}</Text>
              {m.daysOverdue > 0 && <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.red }}>{m.daysOverdue} days overdue</Text>}
            </View>
            <StatusPill status="Overdue" />
          </View>
          <View style={a.finRow}>
            {[
              { l: 'Loan Balance', v: fmtCur(m.loanBalance), c: C.red },
              { l: 'Original',     v: fmtCur(m.loan),        c: C.orangeLt },
              { l: 'Paid',         v: fmtCur((m.loan || 0) - (m.loanBalance || 0)), c: C.green },
            ].map(f => (
              <View key={f.l} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{f.l}</Text>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: f.c }}>{f.v}</Text>
              </View>
            ))}
          </View>
        </GCard>
      ))}

      {overdue.length === 0 && (
        <GCard style={{ alignItems: 'center', padding: 36 }}>
          <Text style={{ fontSize: 36, marginBottom: 10, textAlign: 'center' }}>🎉</Text>
          <Text style={a.emptyTxt}>No overdue accounts at this time.</Text>
        </GCard>
      )}

      {activeLoans.length > 0 && (
        <>
          <Text style={[a.sHead, { marginTop: 16 }]}>💳 ACTIVE LOANS (AT RISK)</Text>
          {activeLoans.map(m => (
            <GCard key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <View style={a.memberAvatar}><Text style={a.memberAvatarTxt}>{initials(m.name)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={a.memberName}>{m.name}</Text>
                <Text style={a.memberUserId}>{m.userId}</Text>
              </View>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.orangeLt }}>{fmtCur(m.loanBalance)}</Text>
            </GCard>
          ))}
        </>
      )}
    </ScrollView>
  );
};

// ── 5. COLLECTIONS ────────────────────────────────────────────────────────────
const CollectionsView = ({ members }) => {
  const totalSavings = members.reduce((s, m) => s + (m.savings || 0), 0);
  const totalShares  = members.reduce((s, m) => s + (m.shares  || 0), 0);
  const totalLoans   = members.reduce((s, m) => s + (m.loan    || 0), 0);
  const totalLoanBal = members.reduce((s, m) => s + (m.loanBalance || 0), 0);
  const active = members.filter(m => m.status === 'Active');

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>💵 Collection Monitoring</Text>
      <Text style={a.pageSub}>Financial overview across all active members.</Text>

      <View style={a.tileGrid}>
        <MetricTile label="Total Savings"   value={fmtCur(totalSavings)} icon="💰" color={C.green} />
        <MetricTile label="Total Shares"    value={fmtCur(totalShares)}  icon="📊" color={C.gold} />
        <MetricTile label="Loans Released"  value={fmtCur(totalLoans)}   icon="💳" color={C.orangeLt} />
        <MetricTile label="Loan Balances"   value={fmtCur(totalLoanBal)} icon="⚠️" color={C.red} />
      </View>

      <Text style={a.sHead}>📋 PER MEMBER BREAKDOWN</Text>
      <GCard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={a.tableHdr}>
          {['Member', 'Savings', 'Shares', 'Loan Bal.'].map((h) => (
            <Text key={h} style={[a.tableHdrTxt, { flex: h === 'Member' ? 2 : 1 }]}>{h}</Text>
          ))}
        </View>
        {active.map(m => (
          <View key={m.id} style={a.tableRow}>
            <Text style={[a.tableCell, { flex: 2 }]} numberOfLines={1}>{m.name}</Text>
            <Text style={[a.tableCell, { flex: 1, color: C.green }]}>{fmtCur(m.savings)}</Text>
            <Text style={[a.tableCell, { flex: 1, color: C.gold }]}>{fmtCur(m.shares)}</Text>
            <Text style={[a.tableCell, { flex: 1, color: m.loanBalance > 0 ? C.red : C.textMuted }]}>{fmtCur(m.loanBalance)}</Text>
          </View>
        ))}
        {active.length === 0 && <Text style={[a.emptyTxt, { padding: 24 }]}>No active members.</Text>}
      </GCard>
    </ScrollView>
  );
};

// ── 6. LOANS ──────────────────────────────────────────────────────────────────
const LoansView = ({ loans }) => {
  const { data: loanApps, loading } = useCollection('loanApplications', orderBy('createdAt', 'desc'));
  const [filter, setFilter] = useState('All');
  const [sel,    setSel]    = useState(null);
  const [action, setAction] = useState(null);
  const [remarks,setRemarks]= useState('');
  const [busy,   setBusy]   = useState(false);

  const filtered = filter === 'All' ? loanApps : loanApps.filter(l => l.status === filter);

  const doAction = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'loanApplications', sel.id), {
        status: action === 'approve' ? 'Approved' : 'Rejected',
        adminRemarks: remarks,
        resolvedAt: serverTimestamp(),
      });
      if (action === 'approve') {
        await updateDoc(doc(db, 'members', sel.memberId), {
          loan: sel.amount,
          loanBalance: sel.amount,
          updatedAt: serverTimestamp(),
        });
      }
      setSel(null); setAction(null); setRemarks('');
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  if (loading) return <Spinner msg="Loading loan applications..." />;

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>💳 Loan Applications</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['Pending', C.orange], ['Approved', C.green], ['Rejected', C.red]].map(([st, c]) => (
          <GCard key={st} style={{ flex: 1, minWidth: 100, alignItems: 'center', padding: 12, marginBottom: 0 }}>
            <Text style={[a.tileVal, { color: c, fontSize: 22 }]}>{loanApps.filter(l => l.status === st).length}</Text>
            <Text style={[a.tileLbl, { textAlign: 'center' }]}>{st}</Text>
          </GCard>
        ))}
      </View>
      <View style={a.filterRow}>
        {['All','Pending','Approved','Rejected'].map(f => (
          <TouchableOpacity key={f} style={[a.filterChip, filter === f && a.filterChipOn]} onPress={() => setFilter(f)}>
            <Text style={[a.filterChipTxt, filter === f && a.filterChipTxtOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {filtered.map(l => (
        <GCard key={l.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            <View style={[a.memberAvatar, { backgroundColor: 'rgba(201,168,76,0.20)' }]}>
              <Text style={[a.memberAvatarTxt, { fontSize: 12 }]}>💳</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={a.memberName}>{l.memberName}</Text>
              <Text style={a.memberMeta}>Amount: {fmtCur(l.amount)}</Text>
              <Text style={a.memberMeta}>Purpose: {l.purpose}</Text>
              <Text style={a.memberMeta}>Term: {l.term}</Text>
              <Text style={a.memberMeta}>Filed: {fmtDate(l.createdAt)}</Text>
            </View>
            <StatusPill status={l.status || 'Pending'} />
          </View>
          {l.adminRemarks ? <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: '#9a7230', fontStyle: 'italic', marginBottom: 8 }}>Admin: {l.adminRemarks}</Text> : null}
          {(l.status === 'Pending') && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[a.btnAction, { flex: 1, backgroundColor: 'rgba(26,138,74,0.15)', borderColor: 'rgba(26,138,74,0.50)' }]}
                onPress={() => { setSel(l); setAction('approve'); setRemarks(''); }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.green }}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[a.btnAction, { flex: 1, backgroundColor: 'rgba(192,57,43,0.12)', borderColor: 'rgba(192,57,43,0.45)' }]}
                onPress={() => { setSel(l); setAction('reject'); setRemarks(''); }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.red }}>✕ Reject</Text>
              </TouchableOpacity>
            </View>
          )}
        </GCard>
      ))}
      {filtered.length === 0 && <GCard style={{ alignItems: 'center', padding: 36 }}><Text style={a.emptyTxt}>No loan applications.</Text></GCard>}
      <ActionModal
        visible={!!action} title={action === 'approve' ? '✅ Approve Loan' : '❌ Reject Loan'}
        message={`${action === 'approve' ? 'Approve' : 'Reject'} loan of ${fmtCur(sel?.amount)} for ${sel?.memberName}?`}
        confirmLabel={action === 'approve' ? 'Approve' : 'Reject'}
        confirmColor={action === 'approve' ? C.green : C.red}
        onConfirm={doAction} onCancel={() => { setSel(null); setAction(null); }} loading={busy}
      >
        <View style={{ marginTop: 12 }}>
          <Text style={a.modalFieldLbl}>Admin Remarks</Text>
          <TextInput style={a.modalInput} value={remarks} onChangeText={setRemarks} placeholder="Optional remarks..." placeholderTextColor={C.textMuted} multiline numberOfLines={2} />
        </View>
      </ActionModal>
    </ScrollView>
  );
};

// ── 7. CLAIMS ─────────────────────────────────────────────────────────────────
const ClaimsView = () => {
  const { data: claims, loading } = useCollection('claims', orderBy('filedAt', 'desc'));
  const [filter, setFilter] = useState('All');
  const [sel,    setSel]    = useState(null);
  const [action, setAction] = useState(null);
  const [remarks,setRemarks]= useState('');
  const [busy,   setBusy]   = useState(false);

  const filtered = filter === 'All' ? claims : claims.filter(c => c.status === filter);

  const doAction = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'claims', sel.id), {
        status: action === 'approve' ? 'Approved' : 'Rejected',
        adminRemarks: remarks, resolvedAt: serverTimestamp(),
      });
      setSel(null); setAction(null); setRemarks('');
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  const procDays = c => {
    if (!c.filedAt) return '—';
    const filed = c.filedAt?.toDate?.() || new Date(c.filedAt);
    const res   = c.resolvedAt?.toDate?.() || new Date();
    return Math.round((res - filed) / (1000 * 60 * 60 * 24)) + 'd';
  };

  if (loading) return <Spinner msg="Loading claims..." />;

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>🧾 Claims Management</Text>
      <View style={a.tileGrid}>
        {[['Pending', C.orange, '⏳'], ['Under Review', C.blue, '🔍'], ['Approved', C.green, '✅'], ['Rejected', C.red, '❌']].map(([st, c, ic]) => (
          <MetricTile key={st} label={st} value={fmtNum(claims.filter(x => x.status === st).length)} icon={ic} color={c} />
        ))}
      </View>
      <View style={a.filterRow}>
        {['All','Pending','Under Review','Approved','Rejected'].map(f => (
          <TouchableOpacity key={f} style={[a.filterChip, filter === f && a.filterChipOn]} onPress={() => setFilter(f)}>
            <Text style={[a.filterChipTxt, filter === f && a.filterChipTxtOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {filtered.map(c => (
        <GCard key={c.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            <View style={[a.memberAvatar, { backgroundColor: 'rgba(109,68,201,0.18)' }]}>
              <Text style={[a.memberAvatarTxt, { fontSize: 12 }]}>🧾</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={a.memberName}>{c.memberName || 'Member'}</Text>
              <Text style={a.memberMeta}>Type: {c.type || 'General'}</Text>
              <Text style={a.memberMeta}>Filed: {fmtDate(c.filedAt)}</Text>
              {(c.status === 'Approved' || c.status === 'Rejected') &&
                <Text style={a.memberMeta}>Processing: {procDays(c)}</Text>}
            </View>
            <StatusPill status={c.status || 'Pending'} />
          </View>
          {c.description && <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, marginBottom: 8 }}>{c.description}</Text>}
          {c.adminRemarks && <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: '#9a7230', fontStyle: 'italic', marginBottom: 8 }}>Admin: {c.adminRemarks}</Text>}
          {(c.status === 'Pending' || c.status === 'Under Review') && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[a.btnAction, { flex: 1, backgroundColor: 'rgba(26,138,74,0.15)', borderColor: 'rgba(26,138,74,0.50)' }]}
                onPress={() => { setSel(c); setAction('approve'); setRemarks(''); }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.green }}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[a.btnAction, { flex: 1, backgroundColor: 'rgba(192,57,43,0.12)', borderColor: 'rgba(192,57,43,0.45)' }]}
                onPress={() => { setSel(c); setAction('reject'); setRemarks(''); }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.red }}>✕ Reject</Text>
              </TouchableOpacity>
            </View>
          )}
        </GCard>
      ))}
      {filtered.length === 0 && <GCard style={{ alignItems: 'center', padding: 36 }}><Text style={a.emptyTxt}>No claims in this category.</Text></GCard>}
      <ActionModal
        visible={!!action} title={action === 'approve' ? '✅ Approve Claim' : '❌ Reject Claim'}
        message={`${action === 'approve' ? 'Approve' : 'Reject'} this claim from ${sel?.memberName}?`}
        confirmLabel={action === 'approve' ? 'Approve' : 'Reject'}
        confirmColor={action === 'approve' ? C.green : C.red}
        onConfirm={doAction} onCancel={() => { setSel(null); setAction(null); }} loading={busy}
      >
        <View style={{ marginTop: 12 }}>
          <Text style={a.modalFieldLbl}>Admin Remarks</Text>
          <TextInput style={a.modalInput} value={remarks} onChangeText={setRemarks} placeholder="Optional remarks..." placeholderTextColor={C.textMuted} multiline numberOfLines={2} />
        </View>
      </ActionModal>
    </ScrollView>
  );
};

// ── 8. NOTIFICATIONS ──────────────────────────────────────────────────────────
const NotifsView = ({ members }) => {
  const { data: notifs } = useCollection('adminNotifications', orderBy('createdAt', 'desc'));
  const unread = notifs.filter(n => !n.read).length;

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>🔔 Notifications</Text>
      <Text style={a.pageSub}>{unread} unread notification{unread !== 1 ? 's' : ''}.</Text>

      {/* Live pending members as alerts */}
      {members.filter(m => m.status === 'Pending').map(m => (
        <TouchableOpacity key={`pending-${m.id}`} style={[a.notifCard, { borderLeftColor: C.orange }]} activeOpacity={0.8}>
          <View style={[a.notifIcon, { backgroundColor: C.orange + '22' }]}>
            <Text style={{ fontSize: 18 }}>🆕</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={a.notifTitle}>New Member Registration</Text>
            <Text style={a.notifMsg}>{m.name} ({m.userId}) registered and is awaiting your approval.</Text>
            <Text style={a.notifTime}>{fmtTime(m.createdAt)}</Text>
          </View>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.orange, marginTop: 4 }} />
        </TouchableOpacity>
      ))}

      {/* Firestore admin notifications */}
      {notifs.map(n => (
        <TouchableOpacity key={n.id}
          style={[a.notifCard, { borderLeftColor: n.type === 'registration' ? C.gold : n.type === 'approved' ? C.green : C.blue, opacity: n.read ? 0.55 : 1 }]}
          onPress={() => markNotifRead(n.id)} activeOpacity={0.8}>
          <View style={[a.notifIcon, { backgroundColor: (n.type === 'approved' ? C.green : C.gold) + '22' }]}>
            <Text style={{ fontSize: 18 }}>{n.icon || '🔔'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={a.notifTitle}>{n.title}</Text>
            <Text style={a.notifMsg}>{n.message}</Text>
            <Text style={a.notifTime}>{fmtTime(n.createdAt)}</Text>
          </View>
          {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold, marginTop: 4 }} />}
        </TouchableOpacity>
      ))}

      {notifs.length === 0 && members.filter(m => m.status === 'Pending').length === 0 && (
        <GCard style={{ alignItems: 'center', padding: 36 }}>
          <Text style={{ fontSize: 36, marginBottom: 10, textAlign: 'center' }}>🔔</Text>
          <Text style={a.emptyTxt}>No notifications at this time.</Text>
        </GCard>
      )}
    </ScrollView>
  );
};

// ── 9. AUDIT LOG ──────────────────────────────────────────────────────────────
const AuditView = () => {
  const { data: logs, loading } = useCollection('auditLogs', orderBy('time', 'desc'));
  const iconMap = {
    'Member Approved': '✅', 'Member Rejected': '❌',
    'Member Activated': '🔓', 'Member Deactivated': '🚫',
    'Password Reset': '🔑', 'New Registration': '🆕',
  };
  if (loading) return <Spinner msg="Loading audit log..." />;
  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>📜 Audit Log</Text>
      <Text style={a.pageSub}>System activity trail for accountability.</Text>
      <GCard style={{ padding: 0, overflow: 'hidden' }}>
        {logs.map((l, i) => (
          <View key={l.id || i} style={[a.auditRow, i === logs.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={{ fontSize: 16, width: 26 }}>{iconMap[l.action] || '📋'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy }}>{l.action}</Text>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, marginTop: 1 }}>{l.target}</Text>
              {l.userId && <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted }}>{l.userId}</Text>}
            </View>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, textAlign: 'right' }}>{fmtTime(l.time)}</Text>
          </View>
        ))}
        {logs.length === 0 && <Text style={[a.emptyTxt, { padding: 24 }]}>No activity yet.</Text>}
      </GCard>
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ── 10. REPORTS & ANALYTICS ──────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

const ReportsView = ({ members, claims, loans }) => {
  const [reportType, setReportType] = useState('financial'); // financial | member | claims
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [exported,   setExported]   = useState('');

  const now = new Date();
  const thisMonth = members.filter(m => {
    const d = m.createdAt?.toDate?.() || new Date(m.createdAt || 0);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = members.filter(m => {
    const d = m.createdAt?.toDate?.() || new Date(m.createdAt || 0);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });

  const totalSavings = members.reduce((s, m) => s + (m.savings || 0), 0);
  const totalShares  = members.reduce((s, m) => s + (m.shares  || 0), 0);
  const totalLoans   = members.reduce((s, m) => s + (m.loan    || 0), 0);
  const totalLoanBal = members.reduce((s, m) => s + (m.loanBalance || 0), 0);
  const activeCount  = members.filter(m => m.status === 'Active').length;
  const pendClaims   = claims.filter(c => c.status === 'Pending').length;
  const apprClaims   = claims.filter(c => c.status === 'Approved').length;
  const totalClaims  = claims.reduce((s, c) => s + (c.amount || 0), 0);

  const growthPct = lastMonth.length > 0
    ? Math.round(((thisMonth.length - lastMonth.length) / lastMonth.length) * 100)
    : thisMonth.length > 0 ? 100 : 0;

  const claimsThisMonth = claims.filter(c => {
    const d = c.filedAt?.toDate?.() || new Date(c.filedAt || 0);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const claimsLastMonth = claims.filter(c => {
    const d = c.filedAt?.toDate?.() || new Date(c.filedAt || 0);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  }).length;
  const claimsChange = claimsLastMonth > 0 ? Math.round(((claimsThisMonth - claimsLastMonth) / claimsLastMonth) * 100) : 0;

  // Risk alerts
  const memberClaimCounts = {};
  claims.forEach(c => { memberClaimCounts[c.memberId] = (memberClaimCounts[c.memberId] || 0) + 1; });
  const frequentClaimers = members.filter(m => (memberClaimCounts[m.id] || 0) >= 3);
  const overdueMembers   = members.filter(m => m.loanBalance > 0 && m.overdue);

  const handleExport = (format) => {
    setExported(format);
    setTimeout(() => setExported(''), 2500);
  };

  const REPORT_TABS = [
    { key: 'financial', label: '💰 Financial' },
    { key: 'member',    label: '👥 Member' },
    { key: 'claims',    label: '🧾 Claims' },
  ];

  const InsightCard = ({ icon, text, color }) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: color + '18', borderRadius: 10, borderWidth: 1, borderColor: color + '44', padding: 12, marginBottom: 8 }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.text, flex: 1, lineHeight: 18 }}>{text}</Text>
    </View>
  );

  const StatRow = ({ label, value, color }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.07)' }}>
      <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec }}>{label}</Text>
      <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: color || C.navy }}>{value}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={[a.pageOuter, { paddingBottom: 60 }]} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>📊 Reports & Analytics</Text>

      {/* Smart Insights */}
      <Text style={a.sHead}>🧠 SMART INSIGHTS</Text>
      <InsightCard icon="📈" color={growthPct >= 0 ? C.green : C.red}
        text={growthPct >= 0
          ? `Member growth is up ${growthPct}% this month compared to last month (${thisMonth.length} new vs ${lastMonth.length}).`
          : `Member registrations dropped by ${Math.abs(growthPct)}% this month vs last month.`} />
      {claimsChange !== 0 && (
        <InsightCard icon={claimsChange > 0 ? '🚨' : '✅'} color={claimsChange > 0 ? C.orange : C.green}
          text={claimsChange > 0
            ? `Claims are ${claimsChange}% higher this month (${claimsThisMonth} vs ${claimsLastMonth} last month). Review may be needed.`
            : `Claims decreased by ${Math.abs(claimsChange)}% this month. Good trend!`} />
      )}
      {totalLoanBal > 0 && (
        <InsightCard icon="💳" color={C.blue}
          text={`Total outstanding loan balance is ${fmtCur(totalLoanBal)} across ${members.filter(m => m.loanBalance > 0).length} member(s).`} />
      )}
      {frequentClaimers.length > 0 && (
        <InsightCard icon="⚠️" color={C.red}
          text={`${frequentClaimers.length} member(s) have filed 3 or more claims. Recommend review: ${frequentClaimers.slice(0,3).map(m => m.name).join(', ')}.`} />
      )}
      {overdueMembers.length > 0 && (
        <InsightCard icon="🚨" color={C.red}
          text={`${overdueMembers.length} member(s) have overdue loan payments. Immediate action recommended.`} />
      )}

      {/* Date Range Filter */}
      <Text style={a.sHead}>📅 DATE RANGE FILTER</Text>
      <GCard>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.5, marginBottom: 5 }}>FROM</Text>
            <TextInput style={{ backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(15,30,53,0.18)', padding: 10, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy }}
              value={dateFrom} onChangeText={setDateFrom} placeholder="MM/DD/YYYY" placeholderTextColor={C.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.5, marginBottom: 5 }}>TO</Text>
            <TextInput style={{ backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(15,30,53,0.18)', padding: 10, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy }}
              value={dateTo} onChangeText={setDateTo} placeholder="MM/DD/YYYY" placeholderTextColor={C.textMuted} />
          </View>
          <TouchableOpacity style={{ backgroundColor: C.navyMid, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 }} onPress={() => { setDateFrom(''); setDateTo(''); }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.gold }}>Reset</Text>
          </TouchableOpacity>
        </View>
      </GCard>

      {/* Report Type Tabs */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {REPORT_TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setReportType(t.key)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: reportType === t.key ? C.navyMid : C.surface, borderWidth: 1.5, borderColor: reportType === t.key ? C.gold : 'rgba(255,255,255,0.70)' }}>
            <Text style={{ fontFamily: reportType === t.key ? 'GoogleSans_700Bold' : 'GoogleSans_400Regular', fontSize: 11, color: reportType === t.key ? '#fff' : C.textSec }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Financial Report */}
      {reportType === 'financial' && (
        <GCard>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy, marginBottom: 12 }}>💰 Financial Summary Report</Text>
          <StatRow label="Total Savings"              value={fmtCur(totalSavings)}  color={C.green} />
          <StatRow label="Total Share Capital"         value={fmtCur(totalShares)}   color={C.gold} />
          <StatRow label="Total Loans Released"        value={fmtCur(totalLoans)}    color={C.orange} />
          <StatRow label="Outstanding Loan Balance"    value={fmtCur(totalLoanBal)}  color={C.red} />
          <StatRow label="Loan Collection Rate"        value={totalLoans > 0 ? Math.round(((totalLoans - totalLoanBal) / totalLoans) * 100) + '%' : '—'} color={C.green} />
          <StatRow label="Active Loan Holders"         value={members.filter(m => m.loanBalance > 0).length} />
          <StatRow label="Total Assets (Savings+Shares)" value={fmtCur(totalSavings + totalShares)} color={C.blue} />
        </GCard>
      )}

      {/* Member Report */}
      {reportType === 'member' && (
        <GCard>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy, marginBottom: 12 }}>👥 Member Summary Report</Text>
          <StatRow label="Total Members"     value={members.length} />
          <StatRow label="Active"            value={activeCount}    color={C.green} />
          <StatRow label="Pending Approval"  value={members.filter(m => m.status === 'Pending').length}  color={C.orange} />
          <StatRow label="Inactive"          value={members.filter(m => m.status === 'Inactive').length} color={C.red} />
          <StatRow label="Rejected"          value={members.filter(m => m.status === 'Rejected').length} color={C.red} />
          <StatRow label="New This Month"    value={thisMonth.length} color={C.blue} />
          <StatRow label="New Last Month"    value={lastMonth.length} />
          <StatRow label="Month-over-Month Growth" value={(growthPct >= 0 ? '+' : '') + growthPct + '%'} color={growthPct >= 0 ? C.green : C.red} />
          <StatRow label="With App Form Submitted" value={members.filter(m => m.appForm && Object.keys(m.appForm).length > 0).length} color={C.blue} />
        </GCard>
      )}

      {/* Claims Report */}
      {reportType === 'claims' && (
        <GCard>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy, marginBottom: 12 }}>🧾 Claims Summary Report</Text>
          <StatRow label="Total Claims Filed"    value={claims.length} />
          <StatRow label="Pending"               value={pendClaims}  color={C.orange} />
          <StatRow label="Approved"              value={apprClaims}  color={C.green} />
          <StatRow label="Rejected"              value={claims.filter(c => c.status === 'Rejected').length} color={C.red} />
          <StatRow label="Total Claims Amount"   value={fmtCur(totalClaims)} color={C.orange} />
          <StatRow label="Filed This Month"      value={claimsThisMonth} color={C.blue} />
          <StatRow label="Filed Last Month"      value={claimsLastMonth} />
          <StatRow label="Month-over-Month"      value={(claimsChange >= 0 ? '+' : '') + claimsChange + '%'} color={claimsChange > 20 ? C.red : C.green} />
          <StatRow label="Members w/ 3+ Claims"  value={frequentClaimers.length} color={frequentClaimers.length > 0 ? C.red : C.green} />
        </GCard>
      )}

      {/* Export Buttons */}
      <Text style={a.sHead}>📤 EXPORT REPORT</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity onPress={() => handleExport('PDF')}
          style={{ flex: 1, backgroundColor: exported === 'PDF' ? C.green : 'rgba(192,57,43,0.15)', borderRadius: 10, borderWidth: 1.5, borderColor: exported === 'PDF' ? C.green : 'rgba(192,57,43,0.50)', paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: exported === 'PDF' ? '#fff' : C.red }}>
            {exported === 'PDF' ? '✓ Exported!' : '📄 Export PDF'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleExport('Excel')}
          style={{ flex: 1, backgroundColor: exported === 'Excel' ? C.green : 'rgba(26,138,74,0.15)', borderRadius: 10, borderWidth: 1.5, borderColor: exported === 'Excel' ? C.green : 'rgba(26,138,74,0.50)', paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: exported === 'Excel' ? '#fff' : C.green }}>
            {exported === 'Excel' ? '✓ Exported!' : '📊 Export Excel'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 8 }}>
        Note: Connect to a file export service (e.g. react-native-fs or expo-print) to enable actual file downloads.
      </Text>
    </ScrollView>
  );
};

// ─── 11. DOCUMENT MONITORING ──────────────────────────────────────────────────
const DocumentsView = ({ members }) => {
  const [filter, setFilter] = useState('All'); // All | Complete | Incomplete

  const REQUIRED_DOCS = ['Application Form', 'Government ID', 'Certificate of Net Take Home Pay', 'Share Capital Ledger'];

  const membersWithStatus = members.filter(m => m.status === 'Active').map(m => {
    const af = m.appForm || {};
    const hasAppForm   = !!(af.dob || af.civilStatus || af.empType);
    const hasGovIds    = !!(af.govIds?.some(g => g.type && g.number) || af.sssGsis || af.tin);
    const hasCertNTHP  = !!(af.employerName || af.empType === 'Self-Employed' || af.empType === 'Unemployed');
    const hasShareCap  = (m.shares || 0) > 0;

    const docs = [
      { label: 'Application Form',             done: hasAppForm },
      { label: 'Government ID(s)',              done: hasGovIds },
      { label: 'Cert. of Net Take Home Pay',   done: hasCertNTHP },
      { label: 'Share Capital (₱5,000 min)',   done: hasShareCap },
    ];
    const complete = docs.filter(d => d.done).length;
    const isComplete = complete === docs.length;
    return { ...m, docs, complete, total: docs.length, isComplete };
  });

  const incomplete = membersWithStatus.filter(m => !m.isComplete);
  const complete   = membersWithStatus.filter(m => m.isComplete);

  const shown = filter === 'All' ? membersWithStatus
    : filter === 'Complete' ? complete
    : incomplete;

  return (
    <ScrollView contentContainerStyle={[a.pageOuter, { paddingBottom: 60 }]} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>📁 Document Monitoring</Text>
      <Text style={a.pageSub}>Track document completeness for all active members.</Text>

      {/* Summary tiles */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { l: 'Total Active', v: membersWithStatus.length, c: C.blue },
          { l: 'Complete',     v: complete.length,    c: C.green },
          { l: 'Incomplete',   v: incomplete.length,  c: C.red },
        ].map(s => (
          <GCard key={s.l} style={{ flex: 1, minWidth: 100, alignItems: 'center', padding: 12, marginBottom: 0 }}>
            <Text style={[a.tileVal, { color: s.c, fontSize: 22 }]}>{s.v}</Text>
            <Text style={[a.tileLbl, { textAlign: 'center' }]}>{s.l}</Text>
          </GCard>
        ))}
      </View>

      {/* Incomplete alert banner */}
      {incomplete.length > 0 && (
        <View style={{ backgroundColor: 'rgba(192,57,43,0.12)', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: C.red, borderWidth: 1, borderColor: 'rgba(192,57,43,0.30)', padding: 12, marginBottom: 14 }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.red, marginBottom: 3 }}>⚠️ Incomplete Documents Alert</Text>
          <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, lineHeight: 18 }}>
            {incomplete.length} active member{incomplete.length !== 1 ? 's have' : ' has'} missing documents. Please follow up.
          </Text>
        </View>
      )}

      {/* Filter chips */}
      <View style={a.filterRow}>
        {['All', 'Complete', 'Incomplete'].map(f => (
          <TouchableOpacity key={f} style={[a.filterChip, filter === f && a.filterChipOn]} onPress={() => setFilter(f)}>
            <Text style={[a.filterChipTxt, filter === f && a.filterChipTxtOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Member document cards */}
      {shown.map(m => (
        <GCard key={m.id} style={{ borderLeftWidth: 3, borderLeftColor: m.isComplete ? C.green : C.red }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <View style={[a.memberAvatar, { backgroundColor: m.isComplete ? 'rgba(26,138,74,0.20)' : 'rgba(192,57,43,0.18)' }]}>
              <Text style={a.memberAvatarTxt}>{initials(m.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={a.memberName}>{m.name}</Text>
              <Text style={a.memberUserId}>{m.userId}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: m.isComplete ? C.green : C.red }}>{m.complete}/{m.total}</Text>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted }}>docs</Text>
            </View>
          </View>
          {/* Progress bar */}
          <View style={{ height: 6, backgroundColor: 'rgba(15,30,53,0.12)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: m.isComplete ? C.green : C.orange, width: `${Math.round((m.complete / m.total) * 100)}%` }} />
          </View>
          {/* Doc checklist */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {m.docs.map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: d.done ? 'rgba(26,138,74,0.12)' : 'rgba(192,57,43,0.10)', borderWidth: 1, borderColor: d.done ? 'rgba(26,138,74,0.35)' : 'rgba(192,57,43,0.30)' }}>
                <Text style={{ fontSize: 10 }}>{d.done ? '✅' : '❌'}</Text>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: d.done ? C.green : C.red }}>{d.label}</Text>
              </View>
            ))}
          </View>
        </GCard>
      ))}
      {shown.length === 0 && (
        <GCard style={{ alignItems: 'center', padding: 36 }}>
          <Text style={{ fontSize: 32, marginBottom: 10 }}>📁</Text>
          <Text style={a.emptyTxt}>No members in this category.</Text>
        </GCard>
      )}
    </ScrollView>
  );
};

// ─── 12. ENHANCED AUDIT TRAIL ─────────────────────────────────────────────────
const AuditTrailView = () => {
  const { data: logs, loading } = useCollection('auditLogs', orderBy('time', 'desc'));
  const [filter, setFilter] = useState('All');

  const actionTypes = ['All', 'Member Approved', 'Member Rejected', 'Password Reset', 'Member Activated', 'Member Deactivated', 'Loan Approved'];
  const iconMap = {
    'Member Approved':    { icon: '✅', color: C.green  },
    'Member Rejected':    { icon: '❌', color: C.red    },
    'Member Activated':   { icon: '🔓', color: C.green  },
    'Member Deactivated': { icon: '🚫', color: C.red    },
    'Password Reset':     { icon: '🔑', color: C.orange },
    'New Registration':   { icon: '🆕', color: C.blue   },
    'Loan Approved':      { icon: '💳', color: C.green  },
    'Loan Rejected':      { icon: '💳', color: C.red    },
    'Claim Approved':     { icon: '🧾', color: C.green  },
    'Claim Rejected':     { icon: '🧾', color: C.red    },
  };

  const filtered = filter === 'All' ? logs : logs.filter(l => l.action === filter);

  if (loading) return <Spinner msg="Loading audit trail..." />;

  return (
    <ScrollView contentContainerStyle={[a.pageOuter, { paddingBottom: 60 }]} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>🧾 Audit Trail</Text>
      <Text style={a.pageSub}>Complete system activity log for full accountability.</Text>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { l: 'Total Logs',      v: logs.length,                               c: C.blue   },
          { l: 'Today',           v: logs.filter(l => { const d = l.time?.toDate?.() || new Date(l.time || 0); const n = new Date(); return d.toDateString() === n.toDateString(); }).length, c: C.navy },
          { l: 'Approvals',       v: logs.filter(l => l.action?.includes('Approved')).length, c: C.green },
          { l: 'Rejections',      v: logs.filter(l => l.action?.includes('Rejected')).length, c: C.red },
        ].map(s => (
          <GCard key={s.l} style={{ flex: 1, minWidth: 80, alignItems: 'center', padding: 10, marginBottom: 0 }}>
            <Text style={[a.tileVal, { color: s.c, fontSize: 18 }]}>{s.v}</Text>
            <Text style={[a.tileLbl, { textAlign: 'center', fontSize: 9 }]}>{s.l}</Text>
          </GCard>
        ))}
      </View>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
          {actionTypes.map(f => (
            <TouchableOpacity key={f} style={[a.filterChip, filter === f && a.filterChipOn]} onPress={() => setFilter(f)}>
              <Text style={[a.filterChipTxt, filter === f && a.filterChipTxtOn, { fontSize: 11 }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Log entries */}
      <GCard style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.map((l, i) => {
          const meta = iconMap[l.action] || { icon: '📋', color: C.textMuted };
          return (
            <View key={l.id || i} style={[a.auditRow, i === filtered.length - 1 && { borderBottomWidth: 0 }, { alignItems: 'center' }]}>
              <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: meta.color + '20', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <Text style={{ fontSize: 14 }}>{meta.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: meta.color }}>{l.action}</Text>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, marginTop: 1 }}>
                  {l.adminName ? `Admin ${l.adminName} ` : ''}{l.target ? `→ ${l.target}` : ''}
                </Text>
                {l.userId && <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted }}>{l.userId}</Text>}
                {l.reason && <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, fontStyle: 'italic' }}>Reason: {l.reason}</Text>}
              </View>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, textAlign: 'right', flexShrink: 0, maxWidth: 80 }}>{fmtTime(l.time)}</Text>
            </View>
          );
        })}
        {filtered.length === 0 && <Text style={[a.emptyTxt, { padding: 24 }]}>No activity logs found.</Text>}
      </GCard>
    </ScrollView>
  );
};

// ─── 13. AGENT / BRANCH PERFORMANCE ──────────────────────────────────────────
const PerformanceView = ({ members, loans, claims }) => {
  const [tab, setTab] = useState('agents');

  // Compute agent scores from appForm recommendedBy field
  const agentMap = {};
  members.filter(m => m.status === 'Active').forEach(m => {
    const agent = m.appForm?.recommendedBy?.trim() || 'Unassigned';
    if (!agentMap[agent]) agentMap[agent] = { name: agent, members: 0, savings: 0, shares: 0, loans: 0 };
    agentMap[agent].members++;
    agentMap[agent].savings += m.savings || 0;
    agentMap[agent].shares  += m.shares  || 0;
    agentMap[agent].loans   += m.loan    || 0;
  });
  const agents = Object.values(agentMap).sort((a, b) => b.members - a.members);

  const RankBadge = ({ rank }) => {
    const colors = { 1: ['#FFD700', '#B8860B'], 2: ['#C0C0C0', '#808080'], 3: ['#CD7F32', '#8B4513'] };
    const c = colors[rank] || ['rgba(15,30,53,0.15)', C.textMuted];
    return (
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c[0], justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: rank <= 3 ? '#fff' : C.textMuted }}>#{rank}</Text>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={[a.pageOuter, { paddingBottom: 60 }]} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>🏢 Agent Performance</Text>
      <Text style={a.pageSub}>Rankings based on members referred and collections.</Text>

      {/* Tab */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {[{ key: 'agents', label: '👤 Top Agents' }, { key: 'collections', label: '💰 Collections' }].map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: tab === t.key ? C.navyMid : C.surface, borderWidth: 1.5, borderColor: tab === t.key ? C.gold : 'rgba(255,255,255,0.70)' }}>
            <Text style={{ fontFamily: tab === t.key ? 'GoogleSans_700Bold' : 'GoogleSans_400Regular', fontSize: 12, color: tab === t.key ? '#fff' : C.textSec }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'agents' && (
        <>
          <Text style={a.sHead}>🏆 TOP 5 AGENTS (BY MEMBERS REFERRED)</Text>
          {agents.slice(0, 5).map((ag, i) => (
            <GCard key={ag.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <RankBadge rank={i + 1} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.navy }}>{ag.name}</Text>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted }}>{ag.members} member{ag.members !== 1 ? 's' : ''} referred</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.green }}>{fmtCur(ag.savings + ag.shares)}</Text>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted }}>Total Assets</Text>
              </View>
            </GCard>
          ))}
          {agents.length === 0 && (
            <GCard style={{ alignItems: 'center', padding: 32 }}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🏢</Text>
              <Text style={a.emptyTxt}>No agent data yet. Ensure members fill the "Recommended By" field in the Application Form.</Text>
            </GCard>
          )}
        </>
      )}

      {tab === 'collections' && (
        <>
          <Text style={a.sHead}>💰 COLLECTIONS BY AGENT</Text>
          <GCard style={{ padding: 0, overflow: 'hidden' }}>
            <View style={[a.tableHdr]}>
              {['Agent', 'Members', 'Savings', 'Shares', 'Loans'].map((h, i) => (
                <Text key={h} style={[a.tableHdrTxt, { flex: i === 0 ? 2 : 1 }]}>{h}</Text>
              ))}
            </View>
            {agents.map((ag, i) => (
              <View key={ag.name} style={[a.tableRow, { backgroundColor: i % 2 === 1 ? 'rgba(255,255,255,0.30)' : 'transparent' }]}>
                <Text style={[a.tableCell, { flex: 2, fontFamily: 'GoogleSans_700Bold', color: C.navy, fontSize: 12 }]} numberOfLines={1}>{ag.name}</Text>
                <Text style={[a.tableCell, { flex: 1, textAlign: 'center' }]}>{ag.members}</Text>
                <Text style={[a.tableCell, { flex: 1, color: C.green, fontSize: 11 }]} numberOfLines={1}>{fmtCur(ag.savings)}</Text>
                <Text style={[a.tableCell, { flex: 1, color: C.gold, fontSize: 11  }]} numberOfLines={1}>{fmtCur(ag.shares)}</Text>
                <Text style={[a.tableCell, { flex: 1, color: C.orange, fontSize: 11}]} numberOfLines={1}>{fmtCur(ag.loans)}</Text>
              </View>
            ))}
            {agents.length === 0 && <Text style={[a.emptyTxt, { padding: 24 }]}>No data available.</Text>}
          </GCard>
        </>
      )}
    </ScrollView>
  );
};

// ─── 14. SYSTEM SETTINGS ──────────────────────────────────────────────────────
const SettingsView = () => {
  const [rates, setRates] = useState({ regular: '8', salary: '10', vehicle: '8', petty: '1', emergency: '0', educational: '10', housing: '8', solar: '8' });
  const [penalties, setPenalties]   = useState({ latePayment: '2', penaltyGrace: '3' });
  const [sysInfo, setSysInfo]       = useState({ orgName: 'CESLA Multi-Purpose Cooperative', address: 'Cagayan de Oro City', contact: '', email: '' });
  const [savedSection, setSavedSection] = useState('');

  const save = (section) => { setSavedSection(section); setTimeout(() => setSavedSection(''), 2500); };

  const SettingField = ({ label, value, onChangeText, keyboardType, suffix }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.5, marginBottom: 5 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(15,30,53,0.18)', paddingHorizontal: 12, paddingVertical: 10 }}>
        <TextInput style={{ flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy }}
          value={value} onChangeText={onChangeText}
          keyboardType={keyboardType || 'default'} autoCorrect={false} />
        {suffix && <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textMuted }}>{suffix}</Text>}
      </View>
    </View>
  );

  const SaveBtn = ({ section }) => (
    <TouchableOpacity onPress={() => save(section)}
      style={{ backgroundColor: savedSection === section ? C.green : C.navyMid, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 4 }}>
      <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: savedSection === section ? '#fff' : C.gold }}>
        {savedSection === section ? '✓ Saved!' : '💾 Save Changes'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={[a.pageOuter, { paddingBottom: 60 }]} showsVerticalScrollIndicator={true} persistentScrollbar={true}>
      <Text style={a.pageTitle}>⚙️ System Settings</Text>
      <Text style={a.pageSub}>Manage cooperative-wide configurations.</Text>

      {/* Org Info */}
      <Text style={a.sHead}>🏢 ORGANIZATION INFO</Text>
      <GCard>
        <SettingField label="ORGANIZATION NAME" value={sysInfo.orgName} onChangeText={v => setSysInfo(s => ({ ...s, orgName: v }))} />
        <SettingField label="ADDRESS"           value={sysInfo.address} onChangeText={v => setSysInfo(s => ({ ...s, address: v }))} />
        <SettingField label="CONTACT NUMBER"    value={sysInfo.contact} onChangeText={v => setSysInfo(s => ({ ...s, contact: v }))} keyboardType="phone-pad" />
        <SettingField label="EMAIL ADDRESS"     value={sysInfo.email}   onChangeText={v => setSysInfo(s => ({ ...s, email: v }))}   keyboardType="email-address" />
        <SaveBtn section="orginfo" />
      </GCard>

      {/* Interest Rates */}
      <Text style={a.sHead}>💰 LOAN INTEREST RATES</Text>
      <GCard>
        {[
          ['Regular Loan',   'regular'],
          ['Salary Loan',    'salary'],
          ['Vehicle Loan',   'vehicle'],
          ['Petty Cash',     'petty'],
          ['Emergency Loan', 'emergency'],
          ['Educational',    'educational'],
          ['Housing/Home',   'housing'],
          ['Solar Solutions','solar'],
        ].map(([label, key]) => (
          <SettingField key={key} label={label.toUpperCase()} value={rates[key]}
            onChangeText={v => setRates(r => ({ ...r, [key]: v }))}
            keyboardType="numeric" suffix="% p.a." />
        ))}
        <SaveBtn section="rates" />
      </GCard>

      {/* Penalties */}
      <Text style={a.sHead}>⚠️ PENALTIES</Text>
      <GCard>
        <SettingField label="LATE PAYMENT PENALTY" value={penalties.latePayment}
          onChangeText={v => setPenalties(p => ({ ...p, latePayment: v }))} keyboardType="numeric" suffix="% of amort." />
        <SettingField label="GRACE PERIOD (DAYS)" value={penalties.penaltyGrace}
          onChangeText={v => setPenalties(p => ({ ...p, penaltyGrace: v }))} keyboardType="numeric" suffix="days" />
        <SaveBtn section="penalties" />
      </GCard>

      <View style={{ backgroundColor: 'rgba(201,168,76,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', padding: 12 }}>
        <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.orange, marginBottom: 4 }}>ℹ️ Note</Text>
        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, lineHeight: 18 }}>
          Settings are stored locally in this session. To persist settings across sessions, connect to a Firestore "settings" collection in Firebase.
        </Text>
      </View>
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── ADMIN DASHBOARD SHELL ────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// ─── ADMIN CHAT VIEWS ─────────────────────────────────────────────────────────

const fmtChatTime = ts => {
  if (!ts) return '';
  const d = ts?.toDate?.() || new Date(ts);
  return d.toLocaleString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
};
const mkChatInit = name =>
  (name || '?').split(/[\s,]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// ── Single chat room (admin ↔ member) ────────────────────────────────────────
const AdminChatRoom = ({ roomId, memberName, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, 'chatRooms', roomId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    });
    return unsub;
  }, [roomId]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: 'admin',
        senderName: 'Admin',
        text: text.trim(),
        createdAt: serverTimestamp(),
        readBy: ['admin'],
      });
      await updateDoc(doc(db, 'chatRooms', roomId), {
        lastMessage: text.trim(),
        lastAt: serverTimestamp(),
        lastSender: 'Admin',
      });
      setText('');
    } catch (e) { console.warn(e); }
    finally { setSending(false); }
  };

  return (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      {/* Header */}
      <LinearGradient colors={['#1a2d4e', '#243554']}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
        <TouchableOpacity onPress={onBack}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: C.gold, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(201,168,76,0.25)', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.gold }}>{mkChatInit(memberName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#fff' }}>{memberName}</Text>
          <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Support Chat · Admin View</Text>
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(26,138,74,0.30)', borderWidth: 1, borderColor: 'rgba(26,138,74,0.60)' }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#4cde8a' }}>● Live</Text>
        </View>
      </LinearGradient>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: 'rgba(152,186,213,0.12)' }}
        contentContainerStyle={{ padding: 14, paddingBottom: 10 }}
        showsVerticalScrollIndicator={true}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🛡️</Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 }}>
              No messages yet.{'\n'}The member will see your reply instantly.
            </Text>
          </View>
        )}
        {messages.map((msg, i) => {
          const isAdmin = msg.senderId === 'admin';
          const prev = messages[i - 1];
          const showName = !isAdmin && msg.senderId !== prev?.senderId;
          return (
            <View key={msg.id} style={[{ marginBottom: 8, maxWidth: '78%' },
              isAdmin ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
              {showName && (
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, marginBottom: 3, paddingLeft: 2 }}>
                  {msg.senderName}
                </Text>
              )}
              <View style={[{ borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
                isAdmin
                  ? { backgroundColor: '#1a2d4e', borderBottomRightRadius: 4 }
                  : { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#0f1e35', shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }
              ]}>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: isAdmin ? '#fff' : C.navy, lineHeight: 19 }}>
                  {msg.text}
                </Text>
              </View>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: C.textMuted, marginTop: 3, paddingHorizontal: 2, textAlign: isAdmin ? 'right' : 'left' }}>
                {fmtChatTime(msg.createdAt)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: 'rgba(255,255,255,0.85)', borderTopWidth: 1, borderColor: 'rgba(15,30,53,0.10)' }}>
          <TextInput
            style={{ flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy, backgroundColor: 'rgba(240,246,252,0.90)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: 'rgba(200,218,235,0.75)', maxHeight: 90 }}
            value={text} onChangeText={setText}
            placeholder={`Reply to ${memberName}...`}
            placeholderTextColor={C.textMuted}
            multiline maxLength={500}
          />
          <TouchableOpacity onPress={send} disabled={!text.trim() || sending}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() ? '#1a2d4e' : 'rgba(15,30,53,0.20)', justifyContent: 'center', alignItems: 'center' }}>
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ fontSize: 18 }}>➤</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

// ── Chat Inbox — list of all member support rooms ────────────────────────────
const AdminChatInbox = ({ onSelectRoom }) => {
  const [rooms, setRooms]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    // Listen to all admin-type chat rooms
    const q = query(
      collection(db, 'chatRooms'),
      where('type', '==', 'admin'),
      orderBy('lastAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = rooms.filter(r =>
    (r.memberName || '').toLowerCase().includes(search.toLowerCase())
  );

  // Unread count for a room (messages not readBy 'admin')
  const [unreadMap, setUnreadMap] = useState({});
  useEffect(() => {
    const unsubs = rooms.map(room => {
      const q = query(
        collection(db, 'chatRooms', room.id, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      return onSnapshot(q, snap => {
        const unread = snap.docs.filter(d => {
          const rb = d.data().readBy || [];
          return !rb.includes('admin') && d.data().senderId !== 'admin';
        }).length;
        setUnreadMap(prev => ({ ...prev, [room.id]: unread }));
      }, () => {});
    });
    return () => unsubs.forEach(u => u());
  }, [rooms]);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={C.gold} />
      <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec, marginTop: 10 }}>Loading chats...</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={[a.pageOuter, { paddingBottom: 48 }]} showsVerticalScrollIndicator={true}>
      <Text style={a.pageTitle}>📥 Chat Inbox</Text>
      <Text style={a.pageSub}>Real-time support messages from members. Tap to reply.</Text>

      {/* Search */}
      <View style={a.searchWrap}>
        <Text style={{ color: C.textMuted, fontSize: 14, marginRight: 6 }}>🔍</Text>
        <TextInput
          style={a.searchInput}
          value={search} onChangeText={setSearch}
          placeholder="Search member name..."
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={{ color: C.textMuted, fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary badges */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Total Chats',  v: rooms.length,                                              c: C.blue   },
          { l: 'Unread',       v: Object.values(unreadMap).reduce((s, n) => s + n, 0),       c: C.red    },
          { l: 'Active Today', v: rooms.filter(r => { const d = r.lastAt?.toDate?.() || new Date(r.lastAt || 0); return d.toDateString() === new Date().toDateString(); }).length, c: C.green },
        ].map(s => (
          <GCard key={s.l} style={{ flex: 1, alignItems: 'center', padding: 12, marginBottom: 0 }}>
            <Text style={[a.tileVal, { color: s.c, fontSize: 20 }]}>{s.v}</Text>
            <Text style={[a.tileLbl, { textAlign: 'center' }]}>{s.l}</Text>
          </GCard>
        ))}
      </View>

      {filtered.length === 0 && (
        <GCard style={{ alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
          <Text style={a.emptyTxt}>{search ? 'No chats match your search.' : 'No member chats yet.\nMembers can message you from the Member Portal.'}</Text>
        </GCard>
      )}

      {filtered.map(room => {
        const unread = unreadMap[room.id] || 0;
        const hasUnread = unread > 0;
        return (
          <TouchableOpacity key={room.id} onPress={() => onSelectRoom(room)} activeOpacity={0.80}>
            <GCard style={[{ padding: 14, marginBottom: 8 }, hasUnread && { borderLeftWidth: 3, borderLeftColor: C.gold, backgroundColor: 'rgba(201,168,76,0.08)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: hasUnread ? 'rgba(201,168,76,0.28)' : 'rgba(15,30,53,0.10)', borderWidth: 2, borderColor: hasUnread ? C.gold : 'rgba(15,30,53,0.15)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 16, color: hasUnread ? C.gold : C.textMuted }}>{mkChatInit(room.memberName)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.navy }} numberOfLines={1}>{room.memberName || 'Member'}</Text>
                    {hasUnread && (
                      <View style={{ backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#fff' }}>{unread} new</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: hasUnread ? C.navy : C.textSec, marginTop: 2 }} numberOfLines={1}>
                    {room.lastMessage
                      ? `${room.lastSender === 'Admin' ? 'You' : room.lastSender || 'Member'}: ${room.lastMessage}`
                      : 'No messages yet'}
                  </Text>
                  <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                    {fmtTime(room.lastAt)}
                  </Text>
                </View>
                <Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>
              </View>
            </GCard>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

// ── Admin Chat Inbox Shell (inbox → room) ────────────────────────────────────
const AdminChatInboxView = () => {
  const [activeRoom, setActiveRoom] = useState(null);
  return (
    <View style={{ flex: 1 }}>
      {activeRoom
        ? <AdminChatRoom
            roomId={activeRoom.id}
            memberName={activeRoom.memberName}
            onBack={() => setActiveRoom(null)}
          />
        : <AdminChatInbox onSelectRoom={setActiveRoom} />
      }
    </View>
  );
};

// ── Admin Group Chat View ─────────────────────────────────────────────────────
const AdminGroupChatView = () => {
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Ensure group room exists
    setDoc(doc(db, 'chatRooms', 'group_members'), {
      type: 'group', name: 'Members Group Chat',
      createdAt: serverTimestamp(), lastMessage: null, lastAt: serverTimestamp(),
    }, { merge: true });

    const q = query(
      collection(db, 'chatRooms', 'group_members', 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    });
    return unsub;
  }, []);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'chatRooms', 'group_members', 'messages'), {
        senderId: 'admin',
        senderName: 'Admin 🛡️',
        text: text.trim(),
        createdAt: serverTimestamp(),
        readBy: ['admin'],
      });
      await updateDoc(doc(db, 'chatRooms', 'group_members'), {
        lastMessage: text.trim(),
        lastAt: serverTimestamp(),
        lastSender: 'Admin',
      });
      setText('');
    } catch (e) { console.warn(e); }
    finally { setSending(false); }
  };

  return (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      {/* Header */}
      <LinearGradient colors={['#1a2d4e', '#243554']}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(201,168,76,0.25)', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 22 }}>👥</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: '#fff' }}>Members Group Chat</Text>
          <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Broadcast to all members · Admin view</Text>
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(26,138,74,0.30)', borderWidth: 1, borderColor: 'rgba(26,138,74,0.60)' }}>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#4cde8a' }}>● Live</Text>
        </View>
      </LinearGradient>

      {/* Info banner */}
      <View style={{ backgroundColor: 'rgba(201,168,76,0.12)', borderLeftWidth: 3, borderLeftColor: C.gold, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.08)' }}>
        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textSec }}>
          💡 Messages you send here are visible to <Text style={{ fontFamily: 'GoogleSans_700Bold', color: C.navy }}>all approved members</Text> in their group chat.
        </Text>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: 'rgba(152,186,213,0.12)' }}
        contentContainerStyle={{ padding: 14, paddingBottom: 10 }}
        showsVerticalScrollIndicator={true}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>👥</Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 }}>
              Group chat is empty.{'\n'}Send an announcement or greeting!
            </Text>
          </View>
        )}
        {messages.map((msg, i) => {
          const isAdmin = msg.senderId === 'admin';
          const prev = messages[i - 1];
          const showName = msg.senderId !== prev?.senderId;
          return (
            <View key={msg.id} style={[{ marginBottom: 8, maxWidth: '78%' },
              isAdmin ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
              {showName && (
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: isAdmin ? C.gold : C.textMuted, marginBottom: 3, paddingHorizontal: 2, textAlign: isAdmin ? 'right' : 'left' }}>
                  {isAdmin ? 'You (Admin)' : msg.senderName}
                </Text>
              )}
              <View style={[{ borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
                isAdmin
                  ? { backgroundColor: '#1a2d4e', borderBottomRightRadius: 4 }
                  : { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#0f1e35', shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }
              ]}>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: isAdmin ? '#fff' : C.navy, lineHeight: 19 }}>
                  {msg.text}
                </Text>
              </View>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: C.textMuted, marginTop: 3, paddingHorizontal: 2, textAlign: isAdmin ? 'right' : 'left' }}>
                {fmtChatTime(msg.createdAt)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: 'rgba(255,255,255,0.85)', borderTopWidth: 1, borderColor: 'rgba(15,30,53,0.10)' }}>
          <TextInput
            style={{ flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy, backgroundColor: 'rgba(240,246,252,0.90)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: 'rgba(200,218,235,0.75)', maxHeight: 90 }}
            value={text} onChangeText={setText}
            placeholder="Send a message to all members..."
            placeholderTextColor={C.textMuted}
            multiline maxLength={500}
          />
          <TouchableOpacity onPress={send} disabled={!text.trim() || sending}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() ? '#1a2d4e' : 'rgba(15,30,53,0.20)', justifyContent: 'center', alignItems: 'center' }}>
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ fontSize: 18 }}>➤</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const AdminDashboard = ({ admin, onLogout, isWide, isSmall }) => {
  const { height } = useWindowDimensions();
  const [activeNav, setActiveNav] = useState('overview');
  const [navHistory, setNavHistory] = useState(['overview']); // track nav history for back button
  const [drawer,    setDrawer]    = useState(false);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Real-time data
  const { data: members } = useCollection('members',             orderBy('createdAt', 'desc'));
  const { data: claims  } = useCollection('claims',              orderBy('filedAt',   'desc'));
  const { data: loans   } = useCollection('loanApplications',    orderBy('createdAt', 'desc'));
  const { data: notifs  } = useCollection('adminNotifications',  orderBy('createdAt', 'desc'));

  const pendingCount = members.filter(m => m.status === 'Pending').length;
  const unreadNotifs = notifs.filter(n => !n.read).length + pendingCount;

  // Real-time unread chat count across all admin chat rooms
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    const q = query(collection(db, 'chatRooms'), where('type', '==', 'admin'));
    const unsub = onSnapshot(q, async snap => {
      let total = 0;
      snap.docs.forEach(roomDoc => {
        // We'll count via sub-collection via a separate listener set
      });
      // Simpler: track via lastSender not being admin
      const unreadRooms = snap.docs.filter(d => {
        const data = d.data();
        return data.lastMessage && data.lastSender && data.lastSender !== 'Admin';
      }).length;
      setChatUnread(unreadRooms);
    }, () => {});
    return unsub;
  }, []);

  const switchNav = key => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,  duration: 130, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 10, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      setNavHistory(prev => [...prev, key]);
      setActiveNav(key);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  };

  // Go back in nav history
  const goBack = () => {
    if (navHistory.length <= 1) return;
    const newHistory = navHistory.slice(0, -1);
    const prevNav = newHistory[newHistory.length - 1];
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,  duration: 130, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 10, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      setNavHistory(newHistory);
      setActiveNav(prevNav);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  };

  const renderContent = () => {
    switch (activeNav) {
      case 'overview':      return <OverviewView     members={members} claims={claims} loans={loans} />;
      case 'pending':       return <PendingView      members={members} />;
      case 'all_members':   return <AllMembersView   members={members} contentHeight={height - 62} />;
      case 'delinquency':   return <DelinquencyView  members={members} />;
      case 'collections':   return <CollectionsView  members={members} />;
      case 'loans':         return <LoansView        loans={loans} />;
      case 'claims':        return <ClaimsView />;
      case 'reports':       return <ReportsView      members={members} claims={claims} loans={loans} />;
      case 'documents':     return <DocumentsView    members={members} />;
      case 'audit':         return <AuditTrailView />;
      case 'performance':   return <PerformanceView  members={members} loans={loans} claims={claims} />;
      case 'settings':      return <SettingsView />;
      case 'notifications': return <NotifsView       members={members} />;
      case 'chat_inbox':    return <AdminChatInboxView />;
      case 'chat_group':    return <AdminGroupChatView />;
      default:              return <OverviewView     members={members} claims={claims} loans={loans} />;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* ── TOP BAR ── */}
      <View style={[a.topbar, { paddingTop: Platform.OS === 'web' ? 0 : 44 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {!isWide && (
            <TouchableOpacity style={a.menuBtn} onPress={() => setDrawer(v => !v)}>
              <Text style={{ color: '#fff', fontSize: 18 }}>☰</Text>
            </TouchableOpacity>
          )}
          <View style={a.topbarLogo}><Text style={a.topbarLogoTxt}>CS</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[a.topbarTitle, { fontSize: isSmall ? 13 : 15 }]} numberOfLines={1}>Admin Dashboard</Text>
            {!isSmall && <Text style={a.topbarSub}>CESLA MPC · CLIMBS Employee Cooperative</Text>}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Notification bell */}
          <TouchableOpacity style={a.bellBtn} onPress={() => switchNav('notifications')}>
            <Text style={{ fontSize: 17 }}>🔔</Text>
            {unreadNotifs > 0 && (
              <View style={a.bellBadge}><Text style={a.bellBadgeTxt}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text></View>
            )}
          </TouchableOpacity>
          {/* Chat quick-access */}
          <TouchableOpacity style={a.bellBtn} onPress={() => switchNav('chat_inbox')}>
            <Text style={{ fontSize: 17 }}>💬</Text>
            {chatUnread > 0 && (
              <View style={a.bellBadge}><Text style={a.bellBadgeTxt}>{chatUnread > 9 ? '9+' : chatUnread}</Text></View>
            )}
          </TouchableOpacity>
          {/* Pending members quick badge */}
          {pendingCount > 0 && (
            <TouchableOpacity style={a.pendingBadge} onPress={() => switchNav('pending')}>
              <Text style={a.pendingBadgeTxt}>⏳ {pendingCount} Pending</Text>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={a.adminAvatar}><Text style={a.adminAvatarTxt}>A</Text></View>
            {isWide && <Text style={{ fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>{admin?.name || 'Admin'}</Text>}
          </View>
        </View>
      </View>

      {/* ── BODY ── */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {isWide && (
          <Sidebar active={activeNav} onNav={switchNav}
            pendingCount={pendingCount} notifsCount={unreadNotifs} chatUnread={chatUnread}
            onLogout={onLogout} onBack={goBack} canGoBack={navHistory.length > 1} />
        )}
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {renderContent()}
        </Animated.View>
      </View>

      {/* ── MOBILE DRAWER — full screen height ── */}
      {!isWide && drawer && (
        <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 20, flexDirection: 'row' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
            activeOpacity={1} onPress={() => setDrawer(false)} />
          <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 220, zIndex: 21, flexDirection: 'column' }}>
            <Sidebar active={activeNav} onNav={switchNav} onClose={() => setDrawer(false)}
              pendingCount={pendingCount} notifsCount={unreadNotifs} chatUnread={chatUnread}
              onLogout={() => { setDrawer(false); onLogout(); }}
              onBack={() => { goBack(); setDrawer(false); }}
              canGoBack={navHistory.length > 1} />
          </View>
        </View>
      )}
    </View>
  );
};

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function ManageCoopScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const admin = route?.params?.admin || { name: 'Administrator' };

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold,
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const handleLogout = () => {
    if (navigation) navigation.navigate('AdminScreen');
  };

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#98bad5' }}>
        <Spinner msg="Loading admin dashboard..." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AppBg />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AdminDashboard admin={admin} onLogout={handleLogout} isWide={isWide} isSmall={isSmall} />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const a = StyleSheet.create({
  // ── Top bar ──
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1a2d4e',
    paddingHorizontal: 14, paddingBottom: 12,
    borderBottomWidth: 2, borderColor: C.gold, gap: 8,
  },
  topbarLogo:    { width: 32, height: 32, borderRadius: 8, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  topbarLogoTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#0f1e35' },
  topbarTitle:   { fontFamily: 'GoogleSans_700Bold', color: '#fff' },
  topbarSub:     { fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: C.gold },
  menuBtn:       { width: 38, height: 38, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)', justifyContent: 'center', alignItems: 'center' },
  bellBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', justifyContent: 'center', alignItems: 'center' },
  bellBadge:     { position: 'absolute', top: -4, right: -4, width: 17, height: 17, borderRadius: 9, backgroundColor: C.red, justifyContent: 'center', alignItems: 'center' },
  bellBadgeTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 8, color: '#fff' },
  pendingBadge:  { backgroundColor: 'rgba(196,125,14,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(196,125,14,0.55)' },
  pendingBadgeTxt:{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.goldLt },
  adminAvatar:   { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(201,168,76,0.25)', borderWidth: 1.5, borderColor: C.gold, justifyContent: 'center', alignItems: 'center' },
  adminAvatarTxt:{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.gold },
  logoutBtn:     { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(201,168,76,0.18)', borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.50)' },
  logoutTxt:     { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.gold },

  // ── Sidebar ──
  sidebar:       { width: 160, maxWidth: 160, flexShrink: 0, flexGrow: 0, backgroundColor: '#1a2d4e', borderRightWidth: 1, borderColor: 'rgba(201,168,76,0.20)', flexDirection: 'column' },
  sidebarBrand:  { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, paddingTop: 14 },
  sidebarLogo:   { width: 26, height: 26, borderRadius: 6, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  sidebarLogoTxt:{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: '#0f1e35' },
  sidebarName:   { fontFamily: 'NotoSerif_700Bold', fontSize: 11, color: '#fff' },
  sidebarRole:   { fontFamily: 'GoogleSans_400Regular', fontSize: 8, color: C.gold },
  sideHead:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, minHeight: 36 },
  sideActive:    { backgroundColor: C.gold },
  sideIcon:      { fontSize: 12, width: 16, textAlign: 'center', color: 'rgba(255,255,255,0.50)' },
  sideLabel:     { fontFamily: 'GoogleSans_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.65)', flex: 1 },
  sideBadge:     { backgroundColor: C.red, borderRadius: 9, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  sideBadgeTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 8, color: '#fff' },
  sideChild:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, marginHorizontal: 3, borderRadius: 7, marginBottom: 1, minHeight: 32 },
  sideChildActive:{ backgroundColor: 'rgba(201,168,76,0.20)' },
  sideChildTxt:  { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: 'rgba(210,225,255,0.55)', flex: 1 },

  // ── Page ──
  pageOuter:  { padding: 16, paddingBottom: 48 },
  pageTitle:  { fontFamily: 'NotoSerif_700Bold', fontSize: 20, color: C.navy, marginBottom: 4 },
  pageSub:    { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec, marginBottom: 16, lineHeight: 20 },
  sHead:      { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 2.2, textTransform: 'uppercase', marginBottom: 10, marginTop: 6 },
  emptyTxt:   { fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
  dateBadge:  { backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)' },
  dateTxt:    { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec },

  // ── Info banner ──
  infoBanner: {
    backgroundColor: 'rgba(201,168,76,0.12)', borderRadius: 12,
    borderLeftWidth: 4, borderLeftColor: C.gold,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)',
    padding: 12, marginBottom: 14,
  },
  infoBannerTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, lineHeight: 19 },

  // ── Tiles ──
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  tile: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14, flex: 1,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)',
    shadowColor: '#1a2d4e', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    ...(Platform.OS === 'web' ? { minWidth: 130 } : { minWidth: 140 }),
  },
  tileIcon:  { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  tileVal:   { fontFamily: 'NotoSerif_700Bold', fontSize: 20, marginBottom: 3 },
  tileLbl:   { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textSec, letterSpacing: 0.4 },
  tileSub:   { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginTop: 2 },

  // ── Table ──
  tableHdr:    { flexDirection: 'row', backgroundColor: 'rgba(15,30,53,0.07)', paddingHorizontal: 14, paddingVertical: 10 },
  tableHdrTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  tableRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderColor: 'rgba(15,30,53,0.08)' },
  tableCell:   { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec, paddingRight: 4 },

  // ── Member card parts ──
  memberAvatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(201,168,76,0.22)', borderWidth: 1.5, borderColor: C.gold, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  memberAvatarTxt: { fontFamily: 'NotoSerif_700Bold', fontSize: 15, color: C.navyMid },
  memberName:      { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.navy },
  memberUserId:    { fontFamily: 'GoogleSans_500Medium', fontSize: 11, color: C.textMuted, marginTop: 1 },
  memberMeta:      { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, marginTop: 1 },
  finRow:          { flexDirection: 'row', borderTopWidth: 1, borderColor: 'rgba(15,30,53,0.10)', paddingTop: 10, marginTop: 6 },

  // ── Buttons ──
  btnAction: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  btnSm:     { borderWidth: 1.5, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 11 },
  btnSmTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 12 },

  // ── Search / Filter ──
  searchWrap:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.90)', marginBottom: 10 },
  searchInput:    { flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy },
  filterRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filterChip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.70)' },
  filterChipOn:   { backgroundColor: C.navy, borderColor: C.navy },
  filterChipTxt:  { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec },
  filterChipTxtOn:{ fontFamily: 'GoogleSans_700Bold', color: '#fff' },

  // ── Notifications ──
  notifCard:   { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)', borderLeftWidth: 4, marginBottom: 10, flexDirection: 'row', gap: 12 },
  notifIcon:   { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifTitle:  { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy },
  notifMsg:    { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, lineHeight: 18, marginTop: 2 },
  notifTime:   { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginTop: 3 },

  // ── Audit ──
  auditRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.08)' },

  // ── Modal ──
  modalBg:         { flex: 1, backgroundColor: 'rgba(15,30,53,0.52)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:       { width: '100%', maxWidth: 420, backgroundColor: '#deeaf3', borderRadius: 20, padding: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)', shadowColor: '#1a2d4e', shadowOpacity: 0.20, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
  modalTitle:      { fontFamily: 'NotoSerif_700Bold', fontSize: 18, color: C.navy, marginBottom: 8 },
  modalMsg:        { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec, lineHeight: 20, marginBottom: 4 },
  modalFieldLbl:   { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 7 },
  modalInput:      { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(15,30,53,0.18)', padding: 11, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy },
  modalBtns:       { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancel:     { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1.5, borderColor: 'rgba(15,30,53,0.15)', alignItems: 'center' },
  modalCancelTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.textSec },
  modalConfirm:    { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalConfirmTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#fff' },
});