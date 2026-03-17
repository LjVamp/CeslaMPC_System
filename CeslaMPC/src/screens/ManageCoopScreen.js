// src/screens/ManageCoopScreen.js
// CESLA MPC — Admin Dashboard (Firebase Firestore real-time)
// Members registered via CoopScreen → Firestore 'members' (status: Pending)
// Admin sees them instantly here → Approve / Reject → member can now login
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, useWindowDimensions, Platform,
  TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

// ─── Firebase ────────────────────────────────────────────────────────────────
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, addDoc, serverTimestamp,
  where, getDocs,
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
  { key: 'system_grp',    label: 'System',            icon: '⚙️', children: [
    { key: 'notifications', label: 'Notifications',   icon: '🔔' },
    { key: 'audit',         label: 'Audit Log',       icon: '📜' },
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

const Sidebar = ({ active, onNav, onClose, pendingCount, notifsCount }) => (
  <View style={a.sidebar}>
    <View style={a.sidebarBrand}>
      <View style={a.sidebarLogo}><Text style={a.sidebarLogoTxt}>CS</Text></View>
      <View>
        <Text style={a.sidebarName}>CESLA MPC</Text>
        <Text style={a.sidebarRole}>Admin Portal</Text>
      </View>
    </View>
    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 14, marginBottom: 6 }} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
      {NAV.map(g => (
        <SidebarItem key={g.key} group={g} active={active} onNav={onNav} onClose={onClose}
          badge={g.key === 'members_grp' ? pendingCount : g.key === 'system_grp' ? notifsCount : 0}
        />
      ))}
    </ScrollView>
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
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
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
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
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
const AllMembersView = ({ members }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [sel,    setSel]    = useState(null);
  const [action, setAction] = useState(null); // 'deactivate'|'activate'|'resetpw'
  const [newPw,  setNewPw]  = useState('');
  const [busy,   setBusy]   = useState(false);

  const filtered = members.filter(m => {
    const name = (m.name || '').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || (m.userId || '').includes(search);
    const matchFilter = filter === 'All' || m.status === filter;
    return matchSearch && matchFilter;
  });

  const doAction = async () => {
    if (!sel || !action) return;
    setBusy(true);
    try {
      if (action === 'deactivate') await deactivateMember(sel.id, sel.name, sel.userId);
      if (action === 'activate')   await activateMember(sel.id, sel.name, sel.userId);
      if (action === 'resetpw' && newPw.length >= 6) await resetPassword(sel.id, sel.name, newPw);
      setSel(null); setAction(null); setNewPw('');
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={a.pageTitle}>👥 All Members</Text>

      {/* Search + filter */}
      <View style={a.searchWrap}>
        <Text style={{ color: C.textMuted, fontSize: 14, marginRight: 6 }}>🔍</Text>
        <TextInput
          style={a.searchInput}
          value={search} onChangeText={setSearch}
          placeholder="Search name or User ID..."
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
        />
      </View>
      <View style={a.filterRow}>
        {['All','Active','Pending','Inactive','Rejected'].map(f => (
          <TouchableOpacity key={f}
            style={[a.filterChip, filter === f && a.filterChipOn]}
            onPress={() => setFilter(f)}>
            <Text style={[a.filterChipTxt, filter === f && a.filterChipTxtOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, marginBottom: 10 }}>
        {filtered.length} member{filtered.length !== 1 ? 's' : ''} found
      </Text>

      {filtered.map(m => (
        <GCard key={m.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
            <View style={[a.memberAvatar, { backgroundColor: m.status === 'Active' ? 'rgba(26,138,74,0.20)' : 'rgba(201,168,76,0.18)' }]}>
              <Text style={a.memberAvatarTxt}>{initials(m.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={a.memberName}>{m.name}</Text>
              <Text style={a.memberUserId}>{m.userId}</Text>
              <Text style={a.memberMeta}>Joined: {fmtDate(m.createdAt)}</Text>
              <Text style={a.memberMeta}>Last login: {fmtTime(m.lastLogin)}</Text>
            </View>
            <StatusPill status={m.status || 'Pending'} />
          </View>

          {/* Financial summary */}
          <View style={a.finRow}>
            {[
              { l: 'Savings', v: fmtCur(m.savings), c: C.green },
              { l: 'Shares',  v: fmtCur(m.shares),  c: C.gold },
              { l: 'Loan Bal',v: fmtCur(m.loanBalance), c: m.loanBalance > 0 ? C.red : C.textMuted },
            ].map(f => (
              <View key={f.l} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{f.l}</Text>
                <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: f.c }}>{f.v}</Text>
              </View>
            ))}
          </View>

          {/* Admin actions */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {m.status === 'Active' && (
              <TouchableOpacity style={[a.btnSm, { borderColor: 'rgba(192,57,43,0.45)', backgroundColor: 'rgba(192,57,43,0.10)' }]}
                onPress={() => { setSel(m); setAction('deactivate'); }}>
                <Text style={[a.btnSmTxt, { color: C.red }]}>🚫 Deactivate</Text>
              </TouchableOpacity>
            )}
            {(m.status === 'Inactive' || m.status === 'Rejected') && (
              <TouchableOpacity style={[a.btnSm, { borderColor: 'rgba(26,138,74,0.45)', backgroundColor: 'rgba(26,138,74,0.12)' }]}
                onPress={() => { setSel(m); setAction('activate'); }}>
                <Text style={[a.btnSmTxt, { color: C.green }]}>✅ Activate</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[a.btnSm, { borderColor: C.borderGold, backgroundColor: 'rgba(201,168,76,0.12)' }]}
              onPress={() => { setSel(m); setAction('resetpw'); setNewPw(''); }}>
              <Text style={[a.btnSmTxt, { color: C.navy }]}>🔑 Reset PW</Text>
            </TouchableOpacity>
          </View>
        </GCard>
      ))}

      {filtered.length === 0 && (
        <GCard style={{ alignItems: 'center', padding: 36 }}>
          <Text style={a.emptyTxt}>No members match your search.</Text>
        </GCard>
      )}

      {/* Action modal */}
      <ActionModal
        visible={!!action}
        title={action === 'deactivate' ? '🚫 Deactivate Member'
             : action === 'activate'   ? '✅ Activate Member'
             : '🔑 Reset Password'}
        message={action !== 'resetpw'
          ? `${action === 'deactivate' ? 'Deactivate' : 'Activate'} account for ${sel?.name}?`
          : `Set a new password for ${sel?.name}.`}
        confirmLabel={action === 'deactivate' ? 'Deactivate' : action === 'activate' ? 'Activate' : 'Reset'}
        confirmColor={action === 'deactivate' ? C.red : C.green}
        onConfirm={doAction}
        onCancel={() => { setSel(null); setAction(null); }}
        loading={busy}
      >
        {action === 'resetpw' && (
          <View style={{ marginTop: 12 }}>
            <Text style={a.modalFieldLbl}>New Password (min. 6 characters)</Text>
            <TextInput
              style={a.modalInput}
              value={newPw} onChangeText={setNewPw}
              placeholder="Enter new password"
              placeholderTextColor={C.textMuted}
              secureTextEntry
            />
          </View>
        )}
      </ActionModal>
    </ScrollView>
  );
};

// ── 4. DELINQUENCY ────────────────────────────────────────────────────────────
const DelinquencyView = ({ members }) => {
  const overdue = members.filter(m => m.loanBalance > 0 && (m.overdue || m.daysOverdue > 0));
  const activeLoans = members.filter(m => m.loanBalance > 0 && !m.overdue && m.status === 'Active');

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
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
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
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
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
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
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
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
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
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
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
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
// ─── ADMIN DASHBOARD SHELL ────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

const AdminDashboard = ({ admin, onLogout, isWide, isSmall }) => {
  const [activeNav, setActiveNav] = useState('overview');
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

  const switchNav = key => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,  duration: 130, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 10, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      setActiveNav(key);
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
      case 'all_members':   return <AllMembersView   members={members} />;
      case 'delinquency':   return <DelinquencyView  members={members} />;
      case 'collections':   return <CollectionsView  members={members} />;
      case 'loans':         return <LoansView        loans={loans} />;
      case 'claims':        return <ClaimsView />;
      case 'notifications': return <NotifsView       members={members} />;
      case 'audit':         return <AuditView />;
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
          <TouchableOpacity style={a.logoutBtn} onPress={onLogout}>
            <Text style={a.logoutTxt}>{isSmall ? '↩' : 'Logout'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── BODY ── */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {isWide && (
          <Sidebar active={activeNav} onNav={switchNav}
            pendingCount={pendingCount} notifsCount={unreadNotifs} />
        )}
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {renderContent()}
        </Animated.View>
      </View>

      {/* ── MOBILE DRAWER ── */}
      {!isWide && drawer && (
        <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 20 }}
          activeOpacity={1} onPress={() => setDrawer(false)}>
          <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 185, zIndex: 21 }}>
            <Sidebar active={activeNav} onNav={switchNav} onClose={() => setDrawer(false)}
              pendingCount={pendingCount} notifsCount={unreadNotifs} />
          </View>
        </TouchableOpacity>
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
  sidebar:       { width: 178, backgroundColor: '#1a2d4e', borderRightWidth: 1, borderColor: 'rgba(201,168,76,0.20)' },
  sidebarBrand:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingTop: 18 },
  sidebarLogo:   { width: 30, height: 30, borderRadius: 7, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center' },
  sidebarLogoTxt:{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: '#0f1e35' },
  sidebarName:   { fontFamily: 'NotoSerif_700Bold', fontSize: 12, color: '#fff' },
  sidebarRole:   { fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: C.gold },
  sideHead:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, minHeight: 40 },
  sideActive:    { backgroundColor: C.gold },
  sideIcon:      { fontSize: 13, width: 18, textAlign: 'center', color: 'rgba(255,255,255,0.50)' },
  sideLabel:     { fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.65)', flex: 1 },
  sideBadge:     { backgroundColor: C.red, borderRadius: 9, minWidth: 17, height: 17, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  sideBadgeTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 8, color: '#fff' },
  sideChild:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 16, marginHorizontal: 4, borderRadius: 8, marginBottom: 1, minHeight: 36 },
  sideChildActive:{ backgroundColor: 'rgba(201,168,76,0.20)' },
  sideChildTxt:  { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(210,225,255,0.55)', flex: 1 },

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