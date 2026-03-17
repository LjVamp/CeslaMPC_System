// src/screens/ManageCoopScreen.js
// CESLA MPC — Admin Dashboard (Executive View)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, useWindowDimensions, Platform, TextInput,
  KeyboardAvoidingView, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

// ─── Firebase imports (adjust path as needed) ──────────────────────────────
import {
  collection, query, where, onSnapshot, orderBy,
  doc, updateDoc, getDocs, getDoc, Timestamp, addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── PALETTE ─────────────────────────────────────────────────────────────────
// Background: #98bad5 (steel blue) — all text/UI tuned for this light bg
const C = {
  // Core navy text — high contrast on the light steel-blue bg
  navy:     '#0f1e35',
  navyMid:  '#1a2d4e',
  navyDeep: '#243554',

  // Card surfaces — semi-transparent white for glass-card feel on the bg
  navyCard: 'rgba(255,255,255,0.40)',
  cardStrong: 'rgba(255,255,255,0.60)',

  // Accent gold — unchanged, works beautifully on steel blue
  gold:     '#c9a84c',
  goldLt:   '#e8c87a',

  // Status colors — deepened slightly for legibility on light bg
  green:    '#1a8a4a',
  greenLt:  '#25a85a',
  red:      '#c0392b',
  redLt:    '#e74c3c',
  orange:   '#c47d0e',
  orangeLt: '#e8960f',
  blue:     '#2563b0',
  blueLt:   '#3b7dd8',
  purple:   '#6d44c9',
  cyan:     '#0e8fa8',

  // Background tokens
  bgBase:   '#98bad5',    // the steel blue base
  bgLight:  '#b3cfe0',    // slightly lighter variant
  bgDeep:   '#7aa3be',    // slightly deeper for topbar/sidebar

  // Surface = cards/inputs on top of the bg
  surface:  'rgba(255,255,255,0.38)',
  surfaceHover: 'rgba(255,255,255,0.55)',
  surfaceDark: 'rgba(15,30,53,0.10)',

  // Borders — dark-on-light
  border:   'rgba(15,30,53,0.14)',
  borderMid:'rgba(15,30,53,0.22)',
  borderGold: 'rgba(180,130,40,0.45)',

  // Text
  textPrimary: '#0f1e35',       // near-black navy
  textSec:  'rgba(15,30,53,0.65)',
  textMuted:'rgba(15,30,53,0.42)',
  textWhite: '#ffffff',
};

const fmtCur = (v) => '₱' + Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtNum = (v) => Number(v || 0).toLocaleString('en-PH');
const fmtDate = (ts) => {
  if (!ts) return '—';
  if (typeof ts === 'string') return ts;
  const d = ts?.toDate?.() || new Date(ts);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtDateTime = (ts) => {
  if (!ts) return 'Never';
  const d = ts?.toDate?.() || new Date(ts);
  return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
};

// ─── SIDEBAR NAV GROUPS ───────────────────────────────────────────────────────
const ADMIN_NAV = [
  { key: 'executive',     label: 'Executive View',    icon: '⊞', single: true },
  { key: 'members_grp',   label: 'Member Management', icon: '👥', children: [
    { key: 'approval',    label: 'Pending Approval',  icon: '⏳' },
    { key: 'members',     label: 'All Members',       icon: '👤' },
    { key: 'delinquency', label: 'Delinquency',       icon: '⚠️' },
  ]},
  { key: 'financial_grp', label: 'Financial',         icon: '💰', children: [
    { key: 'collections', label: 'Collections',       icon: '💵' },
    { key: 'policies',    label: 'Policies',          icon: '📄' },
  ]},
  { key: 'claims_grp',    label: 'Claims',            icon: '🧾', children: [
    { key: 'claims',      label: 'Claims Dashboard',  icon: '📋' },
  ]},
  { key: 'notif_grp',     label: 'Alerts & Notifs',   icon: '🔔', children: [
    { key: 'notifications', label: 'Notifications',   icon: '🔔' },
  ]},
  { key: 'settings_grp',  label: 'System',            icon: '⚙️', children: [
    { key: 'audit',       label: 'Audit Log',         icon: '📜' },
  ]},
];

// ═════════════════════════════════════════════════════════════════════════════
// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

const AppBg = () => (
  <>
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#98bad5' }]} />
    <LinearGradient
      colors={['rgba(198,220,235,0.90)', 'rgba(152,186,213,0.55)', 'rgba(110,155,185,0.20)']}
      locations={[0, 0.5, 1]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  </>
);

const Spinner = ({ message = 'Loading...' }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
    <ActivityIndicator size="large" color={C.gold} />
    <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: 'rgba(15,30,53,0.55)' }}>{message}</Text>
  </View>
);

const StatusPill = ({ status }) => {
  const map = {
    Active:   { bg: 'rgba(26,138,74,0.18)',  border: 'rgba(26,138,74,0.50)',  color: C.green },
    Pending:  { bg: 'rgba(180,110,10,0.18)', border: 'rgba(180,110,10,0.50)', color: C.orange },
    Inactive: { bg: 'rgba(192,57,43,0.15)',  border: 'rgba(192,57,43,0.45)',  color: C.red },
    Approved: { bg: 'rgba(26,138,74,0.18)',  border: 'rgba(26,138,74,0.50)',  color: C.green },
    Rejected: { bg: 'rgba(192,57,43,0.15)',  border: 'rgba(192,57,43,0.45)',  color: C.red },
    'Under Review': { bg: 'rgba(37,99,176,0.15)', border: 'rgba(37,99,176,0.45)', color: C.blue },
    Overdue:  { bg: 'rgba(192,57,43,0.15)',  border: 'rgba(192,57,43,0.45)',  color: C.red },
  };
  const s = map[status] || map.Pending;
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: s.bg, borderWidth: 1, borderColor: s.border, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: s.color, letterSpacing: 0.8 }}>{status}</Text>
    </View>
  );
};

const MetricCard = ({ label, value, sub, icon, color, trend }) => (
  <View style={[a.metricCard, { borderTopColor: color, borderTopWidth: 3 }]}>
    <View style={a.metricTop}>
      <View style={[a.metricIconBg, { backgroundColor: color + '22' }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      {trend !== undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={{ fontSize: 10, color: trend >= 0 ? C.greenLt : C.redLt }}>
            {trend >= 0 ? '▲' : '▼'}
          </Text>
          <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: trend >= 0 ? C.greenLt : C.redLt }}>
            {Math.abs(trend)}%
          </Text>
        </View>
      )}
    </View>
    <Text style={[a.metricValue, { color }]}>{value}</Text>
    <Text style={a.metricLabel}>{label}</Text>
    {sub ? <Text style={a.metricSub}>{sub}</Text> : null}
  </View>
);

// Minimal bar chart component (no external deps)
const MiniBarChart = ({ data, color, label }) => {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <View style={a.chartWrap}>
      <Text style={a.chartLabel}>{label}</Text>
      <View style={a.chartBars}>
        {data.map((d, i) => (
          <View key={i} style={a.chartBarCol}>
            <View style={a.chartBarTrack}>
              <View style={[a.chartBarFill, { height: `${Math.round((d.v / max) * 100)}%`, backgroundColor: color }]} />
            </View>
            <Text style={a.chartBarLbl}>{d.l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── FIREBASE HOOKS ───────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function useMembers() {
  const [members, setMembers] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);
  return members;
}

function useLoanApps() {
  const [loans, setLoans] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'loanApplications'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setLoans(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);
  return loans;
}

function useClaims() {
  const [claims, setClaims] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'claims'), orderBy('filedAt', 'desc'));
    return onSnapshot(q, snap => setClaims(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);
  return claims;
}

function useAdminNotifs() {
  const [notifs, setNotifs] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'adminNotifications'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);
  return notifs;
}

// ─── Firestore actions ───────────────────────────────────────────────────────
const approveMember = async (memberId) => {
  await updateDoc(doc(db, 'members', memberId), {
    status: 'Active',
    approvedAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'adminNotifications'), {
    type: 'approval', title: 'Member Approved',
    message: `Member ID ${memberId} has been approved.`,
    createdAt: serverTimestamp(), read: false,
  });
};

const rejectMember = async (memberId, reason) => {
  await updateDoc(doc(db, 'members', memberId), {
    status: 'Rejected', rejectedAt: serverTimestamp(), rejectionReason: reason,
  });
};

const deactivateMember = async (memberId) => {
  await updateDoc(doc(db, 'members', memberId), { status: 'Inactive' });
};

const activateMember = async (memberId) => {
  await updateDoc(doc(db, 'members', memberId), { status: 'Active' });
};

const resetMemberPassword = async (memberId, newPw) => {
  const bcrypt = { hash: async (pw) => pw }; // placeholder – use real bcrypt in prod
  await updateDoc(doc(db, 'members', memberId), { passwordHash: newPw });
};

const approveClaim = async (claimId, remarks) => {
  await updateDoc(doc(db, 'claims', claimId), {
    status: 'Approved', adminRemarks: remarks, resolvedAt: serverTimestamp(),
  });
};

const rejectClaim = async (claimId, remarks) => {
  await updateDoc(doc(db, 'claims', claimId), {
    status: 'Rejected', adminRemarks: remarks, resolvedAt: serverTimestamp(),
  });
};

const markAdminNotifRead = async (notifId) => {
  await updateDoc(doc(db, 'adminNotifications', notifId), { read: true });
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── CONFIRMATION MODAL ───────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const ConfirmModal = ({ visible, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', confirmColor = C.green, children }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={a.modalOverlay}>
      <View style={a.modalCard}>
        <Text style={a.modalTitle}>{title}</Text>
        {message ? <Text style={a.modalMsg}>{message}</Text> : null}
        {children}
        <View style={a.modalBtns}>
          <TouchableOpacity style={a.modalBtnCancel} onPress={onCancel}>
            <Text style={a.modalBtnCancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[a.modalBtnConfirm, { backgroundColor: confirmColor }]} onPress={onConfirm}>
            <Text style={a.modalBtnConfirmTxt}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ═════════════════════════════════════════════════════════════════════════════
// ─── EXECUTIVE OVERVIEW ───────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const ExecutiveView = ({ members, loans, claims }) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);

  const totalMembers   = members.length;
  const activeMembers  = members.filter(m => m.status === 'Active').length;
  const pendingApproval= members.filter(m => m.status === 'Pending').length;
  const newToday       = members.filter(m => {
    const d = m.createdAt?.toDate?.() || new Date(m.createdAt || 0);
    return d >= todayStart;
  }).length;
  const newThisWeek    = members.filter(m => {
    const d = m.createdAt?.toDate?.() || new Date(m.createdAt || 0);
    return d >= weekStart;
  }).length;
  const totalCollections = members.reduce((s, m) => s + (m.savings || 0) + (m.shares || 0), 0);
  const pendingClaims  = claims.filter(c => c.status === 'Pending').length;
  const approvedClaims = claims.filter(c => c.status === 'Approved').length;
  const activeLoans    = members.filter(m => m.loanBalance > 0).length;
  const totalLoanOut   = members.reduce((s, m) => s + (m.loan || 0), 0);
  const delinquent     = members.filter(m => m.loanBalance > 0 && m.status === 'Active' && m.overdue).length;

  // Monthly bar chart mock data (replace with real Firestore aggregation in prod)
  const months = ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
  const incomeData = months.map((l, i) => ({ l, v: 120000 + Math.sin(i * 0.9) * 40000 + i * 8000 }));
  const claimData  = months.map((l, i) => ({ l, v: Math.max(1, Math.floor(Math.sin(i + 1) * 5 + 7)) }));

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
      {/* ── HEADER ── */}
      <View style={a.execHeader}>
        <View>
          <Text style={a.execTitle}>Executive Dashboard</Text>
          <Text style={a.execSub}>CESLA Multi-Purpose Cooperative · CLIMBS Employee</Text>
        </View>
        <View style={a.execDate}>
          <Text style={a.execDateTxt}>{now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
        </View>
      </View>

      {/* ── KEY METRICS ROW ── */}
      <Text style={a.sectionHead}>📊 KEY METRICS</Text>
      <View style={a.metricsGrid}>
        <MetricCard label="Total Members"     value={fmtNum(totalMembers)}   icon="👥" color={C.blueLt}  sub={`${activeMembers} active`} />
        <MetricCard label="Pending Approval"  value={fmtNum(pendingApproval)} icon="⏳" color={C.orange}  sub="Awaiting review" trend={pendingApproval > 0 ? 5 : 0} />
        <MetricCard label="Total Collections" value={fmtCur(totalCollections)} icon="💵" color={C.greenLt} sub="Savings + Shares" trend={12} />
        <MetricCard label="Active Loans"      value={fmtNum(activeLoans)}    icon="💳" color={C.gold}    sub={fmtCur(totalLoanOut) + ' out'} />
        <MetricCard label="Pending Claims"    value={fmtNum(pendingClaims)}  icon="🧾" color={C.purple}  sub={`${approvedClaims} approved`} />
        <MetricCard label="New This Week"     value={fmtNum(newThisWeek)}    icon="🆕" color={C.cyan}    sub={`${newToday} today`} trend={newThisWeek > 0 ? 8 : 0} />
      </View>

      {/* ── CHARTS ROW ── */}
      <Text style={a.sectionHead}>📈 TRENDS</Text>
      <View style={a.chartsRow}>
        <MiniBarChart data={incomeData} color={C.greenLt} label="Monthly Collections (₱)" />
        <MiniBarChart data={claimData}  color={C.purple}  label="Claims Filed per Month" />
      </View>

      {/* ── QUICK STATS ── */}
      <Text style={a.sectionHead}>⚡ QUICK STATS</Text>
      <View style={a.quickStatsGrid}>
        {[
          { label: 'Delinquent Accounts', value: delinquent, color: C.red, icon: '⚠️' },
          { label: 'Loan Apps (Pending)', value: loans.filter(l => l.status === 'Pending').length, color: C.orange, icon: '📝' },
          { label: 'Claims Under Review', value: claims.filter(c => c.status === 'Under Review').length, color: C.blue, icon: '🔍' },
          { label: 'Inactive Members',    value: members.filter(m => m.status === 'Inactive').length, color: C.textSec, icon: '🚫' },
        ].map(s => (
          <View key={s.label} style={a.quickStat}>
            <Text style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</Text>
            <Text style={[a.quickStatVal, { color: s.color }]}>{s.value}</Text>
            <Text style={a.quickStatLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── RECENT REGISTRATIONS ── */}
      <Text style={a.sectionHead}>🆕 RECENT REGISTRATIONS</Text>
      <View style={a.tableCard}>
        <View style={a.tableHeader}>
          {['Name', 'User ID', 'Registered', 'Status'].map(h => (
            <Text key={h} style={[a.tableHead, { flex: h === 'Name' ? 2 : 1 }]}>{h}</Text>
          ))}
        </View>
        {members.slice(0, 6).map(m => (
          <View key={m.id} style={a.tableRow}>
            <Text style={[a.tableCell, { flex: 2 }]} numberOfLines={1}>{m.name || m.firstName}</Text>
            <Text style={[a.tableCell, a.tableCellMono, { flex: 1 }]} numberOfLines={1}>{m.userId}</Text>
            <Text style={[a.tableCell, { flex: 1 }]} numberOfLines={1}>{fmtDate(m.createdAt)}</Text>
            <View style={{ flex: 1 }}><StatusPill status={m.status || 'Pending'} /></View>
          </View>
        ))}
        {members.length === 0 && <Text style={a.emptyTxt}>No members yet.</Text>}
      </View>
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── PENDING APPROVAL ─────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const ApprovalView = ({ members }) => {
  const pending = members.filter(m => m.status === 'Pending');
  const [selected, setSelected] = useState(null);
  const [modalType, setModalType] = useState(null); // 'approve' | 'reject'
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const openModal = (member, type) => { setSelected(member); setModalType(type); setReason(''); };
  const closeModal = () => { setSelected(null); setModalType(null); };

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      if (modalType === 'approve') await approveMember(selected.id);
      else if (modalType === 'reject') await rejectMember(selected.id, reason);
      closeModal();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={a.pageTitle}>⏳ Pending Approval</Text>
      <Text style={a.pageSub}>{pending.length} account{pending.length !== 1 ? 's' : ''} awaiting admin review.</Text>

      {pending.length === 0 && (
        <View style={a.emptyCard}>
          <Text style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>✅</Text>
          <Text style={a.emptyTxt}>All registrations have been reviewed!</Text>
        </View>
      )}

      {pending.map(m => (
        <View key={m.id} style={a.memberCard}>
          <View style={a.memberCardTop}>
            <View style={a.memberAvatar}>
              <Text style={a.memberAvatarTxt}>{(m.name || m.firstName || '?')[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={a.memberName}>{m.name || `${m.firstName} ${m.lastName}`}</Text>
              <Text style={a.memberUserId}>{m.userId}</Text>
              <Text style={a.memberDateTxt}>Registered: {fmtDate(m.createdAt)}</Text>
            </View>
            <StatusPill status="Pending" />
          </View>
          <View style={a.memberCardActions}>
            <TouchableOpacity style={a.btnApprove} onPress={() => openModal(m, 'approve')}>
              <Text style={a.btnApproveTxt}>✓ Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={a.btnReject} onPress={() => openModal(m, 'reject')}>
              <Text style={a.btnRejectTxt}>✕ Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Confirm Modal */}
      <ConfirmModal
        visible={!!selected && !!modalType}
        title={modalType === 'approve' ? '✅ Approve Member' : '❌ Reject Member'}
        message={modalType === 'approve'
          ? `Approve registration for ${selected?.name || selected?.firstName}? They will be able to log in.`
          : `Reject registration for ${selected?.name || selected?.firstName}?`}
        confirmLabel={loading ? 'Processing...' : modalType === 'approve' ? 'Approve' : 'Reject'}
        confirmColor={modalType === 'approve' ? C.green : C.red}
        onConfirm={handleConfirm}
        onCancel={closeModal}
      >
        {modalType === 'reject' && (
          <View style={{ marginVertical: 12 }}>
            <Text style={a.modalFieldLabel}>Reason for rejection (optional)</Text>
            <TextInput
              style={a.modalInput}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Incomplete information"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>
        )}
      </ConfirmModal>
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── ALL MEMBERS ──────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const MembersView = ({ members }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [pwInput, setPwInput] = useState('');
  const [loading, setLoading] = useState(false);

  const filtered = members.filter(m => {
    const name = (m.name || `${m.firstName} ${m.lastName}`).toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || m.userId?.includes(search);
    const matchFilter = filter === 'All' || m.status === filter;
    return matchSearch && matchFilter;
  });

  const handleAction = async () => {
    if (!selected || !actionModal) return;
    setLoading(true);
    try {
      if (actionModal === 'deactivate') await deactivateMember(selected.id);
      else if (actionModal === 'activate') await activateMember(selected.id);
      else if (actionModal === 'resetpw' && pwInput.length >= 6) await resetMemberPassword(selected.id, pwInput);
      setSelected(null); setActionModal(null); setPwInput('');
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={a.pageTitle}>👥 All Members</Text>

      {/* Search + Filter */}
      <View style={a.searchRow}>
        <View style={a.searchBox}>
          <Text style={{ color: C.textMuted, fontSize: 14 }}>🔍</Text>
          <TextInput
            style={a.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or User ID..."
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
          />
        </View>
      </View>
      <View style={a.filterRow}>
        {['All', 'Active', 'Pending', 'Inactive', 'Rejected'].map(f => (
          <TouchableOpacity key={f} style={[a.filterChip, filter === f && a.filterChipActive]} onPress={() => setFilter(f)}>
            <Text style={[a.filterChipTxt, filter === f && a.filterChipTxtActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={a.resultCount}>{filtered.length} member{filtered.length !== 1 ? 's' : ''}</Text>

      {filtered.map(m => (
        <View key={m.id} style={a.memberCard}>
          <View style={a.memberCardTop}>
            <View style={[a.memberAvatar, { backgroundColor: m.status === 'Active' ? 'rgba(39,174,96,0.25)' : 'rgba(201,168,76,0.20)' }]}>
              <Text style={a.memberAvatarTxt}>{(m.name || m.firstName || '?')[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={a.memberName}>{m.name || `${m.firstName} ${m.lastName}`}</Text>
              <Text style={a.memberUserId}>{m.userId}</Text>
              <Text style={a.memberDateTxt}>
                Joined: {fmtDate(m.memberSince || m.createdAt)}
                {m.lastLogin ? `  ·  Last login: ${fmtDateTime(m.lastLogin)}` : ''}
              </Text>
            </View>
            <StatusPill status={m.status || 'Pending'} />
          </View>

          {/* Financial mini-summary */}
          <View style={a.memberFinRow}>
            {[
              { l: 'Savings', v: fmtCur(m.savings), c: C.greenLt },
              { l: 'Shares', v: fmtCur(m.shares), c: C.gold },
              { l: 'Loan Bal', v: fmtCur(m.loanBalance), c: m.loanBalance > 0 ? C.redLt : C.textMuted },
            ].map(fi => (
              <View key={fi.l} style={a.memberFin}>
                <Text style={a.memberFinLabel}>{fi.l}</Text>
                <Text style={[a.memberFinVal, { color: fi.c }]}>{fi.v}</Text>
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={a.memberCardActions}>
            {m.status === 'Active' && (
              <TouchableOpacity style={a.btnSmallRed} onPress={() => { setSelected(m); setActionModal('deactivate'); }}>
                <Text style={a.btnSmallTxt}>🚫 Deactivate</Text>
              </TouchableOpacity>
            )}
            {(m.status === 'Inactive' || m.status === 'Rejected') && (
              <TouchableOpacity style={a.btnSmallGreen} onPress={() => { setSelected(m); setActionModal('activate'); }}>
                <Text style={a.btnSmallTxt}>✅ Activate</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={a.btnSmallGold} onPress={() => { setSelected(m); setActionModal('resetpw'); setPwInput(''); }}>
              <Text style={a.btnSmallTxt}>🔑 Reset PW</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {filtered.length === 0 && <View style={a.emptyCard}><Text style={a.emptyTxt}>No members found.</Text></View>}

      {/* Action Modal */}
      <ConfirmModal
        visible={!!actionModal}
        title={actionModal === 'deactivate' ? '🚫 Deactivate Member' : actionModal === 'activate' ? '✅ Activate Member' : '🔑 Reset Password'}
        message={actionModal !== 'resetpw'
          ? `${actionModal === 'deactivate' ? 'Deactivate' : 'Activate'} account for ${selected?.name || selected?.firstName}?`
          : `Set new password for ${selected?.name || selected?.firstName}.`}
        confirmLabel={loading ? 'Processing...' : actionModal === 'deactivate' ? 'Deactivate' : actionModal === 'activate' ? 'Activate' : 'Reset'}
        confirmColor={actionModal === 'deactivate' ? C.red : C.green}
        onConfirm={handleAction}
        onCancel={() => { setSelected(null); setActionModal(null); }}
      >
        {actionModal === 'resetpw' && (
          <View style={{ marginVertical: 12 }}>
            <Text style={a.modalFieldLabel}>New Password (min. 6 characters)</Text>
            <TextInput
              style={a.modalInput}
              value={pwInput}
              onChangeText={setPwInput}
              placeholder="Enter new password"
              placeholderTextColor={C.textMuted}
              secureTextEntry
            />
          </View>
        )}
      </ConfirmModal>
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── DELINQUENCY TRACKING ─────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const DelinquencyView = ({ members }) => {
  const overdue = members.filter(m => m.loanBalance > 0 && (m.overdue || m.daysOverdue > 0));
  const latePayment = members.filter(m => m.loanBalance > 0 && !m.overdue && m.status === 'Active');

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={a.pageTitle}>⚠️ Delinquency Tracker</Text>
      <Text style={a.pageSub}>Members with overdue or at-risk loan balances.</Text>

      {/* Summary Cards */}
      <View style={a.delinqSummary}>
        <View style={[a.delinqStat, { borderColor: C.red }]}>
          <Text style={[a.delinqStatVal, { color: C.redLt }]}>{overdue.length}</Text>
          <Text style={a.delinqStatLabel}>Overdue Accounts</Text>
        </View>
        <View style={[a.delinqStat, { borderColor: C.orange }]}>
          <Text style={[a.delinqStatVal, { color: C.orangeLt }]}>{latePayment.length}</Text>
          <Text style={a.delinqStatLabel}>Active Loans</Text>
        </View>
        <View style={[a.delinqStat, { borderColor: C.redLt }]}>
          <Text style={[a.delinqStatVal, { color: C.redLt }]}>{fmtCur(overdue.reduce((s, m) => s + (m.loanBalance || 0), 0))}</Text>
          <Text style={a.delinqStatLabel}>Total Overdue</Text>
        </View>
      </View>

      {overdue.length > 0 && (
        <>
          <View style={a.alertBanner}>
            <Text style={a.alertBannerTxt}>🚨 {overdue.length} account{overdue.length !== 1 ? 's' : ''} overdue — immediate attention required.</Text>
          </View>
          {overdue.map(m => (
            <View key={m.id} style={[a.memberCard, a.memberCardRed]}>
              <View style={a.memberCardTop}>
                <View style={[a.memberAvatar, { backgroundColor: 'rgba(231,76,60,0.25)' }]}>
                  <Text style={a.memberAvatarTxt}>{(m.name || m.firstName || '?')[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={a.memberName}>{m.name || `${m.firstName} ${m.lastName}`}</Text>
                  <Text style={a.memberUserId}>{m.userId}</Text>
                  {m.daysOverdue > 0 && (
                    <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.redLt, marginTop: 2 }}>
                      {m.daysOverdue} days overdue
                    </Text>
                  )}
                </View>
                <StatusPill status="Overdue" />
              </View>
              <View style={a.memberFinRow}>
                <View style={a.memberFin}>
                  <Text style={a.memberFinLabel}>Loan Balance</Text>
                  <Text style={[a.memberFinVal, { color: C.redLt }]}>{fmtCur(m.loanBalance)}</Text>
                </View>
                <View style={a.memberFin}>
                  <Text style={a.memberFinLabel}>Original Loan</Text>
                  <Text style={[a.memberFinVal, { color: C.orangeLt }]}>{fmtCur(m.loan)}</Text>
                </View>
                <View style={a.memberFin}>
                  <Text style={a.memberFinLabel}>Paid So Far</Text>
                  <Text style={[a.memberFinVal, { color: C.greenLt }]}>{fmtCur((m.loan || 0) - (m.loanBalance || 0))}</Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      {overdue.length === 0 && (
        <View style={a.emptyCard}>
          <Text style={{ fontSize: 40, marginBottom: 10, textAlign: 'center' }}>🎉</Text>
          <Text style={a.emptyTxt}>No overdue accounts at this time.</Text>
        </View>
      )}

      {latePayment.length > 0 && (
        <>
          <Text style={[a.sectionHead, { marginTop: 20 }]}>💳 ACTIVE LOANS (AT RISK)</Text>
          {latePayment.map(m => (
            <View key={m.id} style={a.memberCard}>
              <View style={a.memberCardTop}>
                <View style={a.memberAvatar}>
                  <Text style={a.memberAvatarTxt}>{(m.name || m.firstName || '?')[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={a.memberName}>{m.name || `${m.firstName} ${m.lastName}`}</Text>
                  <Text style={a.memberUserId}>{m.userId}</Text>
                </View>
                <Text style={[a.memberFinVal, { color: C.orangeLt }]}>{fmtCur(m.loanBalance)}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── COLLECTIONS ──────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const CollectionsView = ({ members }) => {
  const totalSavings = members.reduce((s, m) => s + (m.savings || 0), 0);
  const totalShares  = members.reduce((s, m) => s + (m.shares || 0), 0);
  const totalLoans   = members.reduce((s, m) => s + (m.loan || 0), 0);
  const totalLoanBal = members.reduce((s, m) => s + (m.loanBalance || 0), 0);

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={a.pageTitle}>💵 Collection Monitoring</Text>
      <Text style={a.pageSub}>Overview of all financial collections across members.</Text>

      <View style={a.metricsGrid}>
        <MetricCard label="Total Savings"    value={fmtCur(totalSavings)} icon="💰" color={C.greenLt} />
        <MetricCard label="Total Shares"     value={fmtCur(totalShares)}  icon="📊" color={C.gold} />
        <MetricCard label="Total Loans Out"  value={fmtCur(totalLoans)}   icon="💳" color={C.orangeLt} />
        <MetricCard label="Total Loan Bal."  value={fmtCur(totalLoanBal)} icon="⚠️" color={C.redLt} />
      </View>

      <Text style={a.sectionHead}>📋 PER MEMBER BREAKDOWN</Text>
      <View style={a.tableCard}>
        <View style={a.tableHeader}>
          {['Member', 'Savings', 'Shares', 'Loan Bal.'].map(h => (
            <Text key={h} style={[a.tableHead, { flex: h === 'Member' ? 2 : 1 }]}>{h}</Text>
          ))}
        </View>
        {members.filter(m => m.status === 'Active').map(m => (
          <View key={m.id} style={a.tableRow}>
            <Text style={[a.tableCell, { flex: 2 }]} numberOfLines={1}>{m.name || m.firstName}</Text>
            <Text style={[a.tableCell, { flex: 1, color: C.greenLt }]}>{fmtCur(m.savings)}</Text>
            <Text style={[a.tableCell, { flex: 1, color: C.gold }]}>{fmtCur(m.shares)}</Text>
            <Text style={[a.tableCell, { flex: 1, color: m.loanBalance > 0 ? C.redLt : C.textMuted }]}>{fmtCur(m.loanBalance)}</Text>
          </View>
        ))}
        {members.filter(m => m.status === 'Active').length === 0 && (
          <Text style={a.emptyTxt}>No active members.</Text>
        )}
      </View>
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── POLICIES ─────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const PoliciesView = ({ members }) => {
  // Mock policies — in production, fetch from Firestore 'policies' collection
  const now = new Date();
  const policies = members.flatMap(m => [
    m.savings > 0 && {
      id: `sav-${m.id}`, type: 'Savings', member: m.name || m.firstName,
      amount: m.savings, status: 'Active',
      expiresAt: null, createdAt: m.memberSince || m.createdAt,
    },
    m.shares > 0 && {
      id: `sh-${m.id}`, type: 'Share Capital', member: m.name || m.firstName,
      amount: m.shares, status: 'Active',
      expiresAt: null, createdAt: m.memberSince || m.createdAt,
    },
  ]).filter(Boolean);

  const [typeFilter, setTypeFilter] = useState('All');
  const filtered = typeFilter === 'All' ? policies : policies.filter(p => p.type === typeFilter);

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={a.pageTitle}>📄 Policy Management</Text>
      <Text style={a.pageSub}>View and filter all active/inactive member policies.</Text>

      <View style={a.filterRow}>
        {['All', 'Savings', 'Share Capital', 'Time Deposit', 'Loan'].map(f => (
          <TouchableOpacity key={f} style={[a.filterChip, typeFilter === f && a.filterChipActive]} onPress={() => setTypeFilter(f)}>
            <Text style={[a.filterChipTxt, typeFilter === f && a.filterChipTxtActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={a.resultCount}>{filtered.length} polic{filtered.length !== 1 ? 'ies' : 'y'}</Text>

      <View style={a.tableCard}>
        <View style={a.tableHeader}>
          {['Member', 'Type', 'Amount', 'Status'].map(h => (
            <Text key={h} style={[a.tableHead, { flex: h === 'Member' ? 2 : 1 }]}>{h}</Text>
          ))}
        </View>
        {filtered.map(p => (
          <View key={p.id} style={a.tableRow}>
            <Text style={[a.tableCell, { flex: 2 }]} numberOfLines={1}>{p.member}</Text>
            <Text style={[a.tableCell, { flex: 1 }]} numberOfLines={1}>{p.type}</Text>
            <Text style={[a.tableCell, { flex: 1, color: C.greenLt }]}>{fmtCur(p.amount)}</Text>
            <View style={{ flex: 1 }}><StatusPill status={p.status} /></View>
          </View>
        ))}
        {filtered.length === 0 && <Text style={a.emptyTxt}>No policies found.</Text>}
      </View>
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── CLAIMS MANAGEMENT ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const ClaimsView = ({ claims }) => {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null); // 'approve' | 'reject'
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  const filtered = filter === 'All' ? claims : claims.filter(c => c.status === filter);

  const pendingCount      = claims.filter(c => c.status === 'Pending').length;
  const underReviewCount  = claims.filter(c => c.status === 'Under Review').length;
  const approvedCount     = claims.filter(c => c.status === 'Approved').length;
  const rejectedCount     = claims.filter(c => c.status === 'Rejected').length;

  const processingDays = (claim) => {
    if (!claim.filedAt) return '—';
    const filed = claim.filedAt?.toDate?.() || new Date(claim.filedAt);
    const resolved = claim.resolvedAt?.toDate?.() || new Date();
    return Math.round((resolved - filed) / (1000 * 60 * 60 * 24));
  };

  const handleAction = async () => {
    if (!selected || !action) return;
    setLoading(true);
    try {
      if (action === 'approve') await approveClaim(selected.id, remarks);
      else await rejectClaim(selected.id, remarks);
      setSelected(null); setAction(null); setRemarks('');
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={a.pageTitle}>🧾 Claims Management</Text>

      {/* Summary Row */}
      <View style={a.metricsGrid}>
        <MetricCard label="Pending"      value={pendingCount}     icon="⏳" color={C.orange} />
        <MetricCard label="Under Review" value={underReviewCount} icon="🔍" color={C.blue} />
        <MetricCard label="Approved"     value={approvedCount}    icon="✅" color={C.green} />
        <MetricCard label="Rejected"     value={rejectedCount}    icon="❌" color={C.red} />
      </View>

      <View style={a.filterRow}>
        {['All', 'Pending', 'Under Review', 'Approved', 'Rejected'].map(f => (
          <TouchableOpacity key={f} style={[a.filterChip, filter === f && a.filterChipActive]} onPress={() => setFilter(f)}>
            <Text style={[a.filterChipTxt, filter === f && a.filterChipTxtActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.map(claim => (
        <View key={claim.id} style={a.memberCard}>
          <View style={a.memberCardTop}>
            <View style={[a.memberAvatar, { backgroundColor: 'rgba(139,92,246,0.25)' }]}>
              <Text style={a.memberAvatarTxt}>🧾</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={a.memberName}>{claim.memberName || 'Member'}</Text>
              <Text style={a.memberUserId}>Type: {claim.type || 'General'}</Text>
              <Text style={a.memberDateTxt}>Filed: {fmtDate(claim.filedAt)}</Text>
              {(claim.status === 'Approved' || claim.status === 'Rejected') && (
                <Text style={a.memberDateTxt}>Processing time: {processingDays(claim)} days</Text>
              )}
            </View>
            <StatusPill status={claim.status || 'Pending'} />
          </View>
          {claim.description && (
            <Text style={a.claimDesc}>{claim.description}</Text>
          )}
          {claim.adminRemarks && (
            <Text style={a.claimRemarks}>Admin: {claim.adminRemarks}</Text>
          )}
          {(claim.status === 'Pending' || claim.status === 'Under Review') && (
            <View style={a.memberCardActions}>
              <TouchableOpacity style={a.btnApprove} onPress={() => { setSelected(claim); setAction('approve'); setRemarks(''); }}>
                <Text style={a.btnApproveTxt}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={a.btnReject} onPress={() => { setSelected(claim); setAction('reject'); setRemarks(''); }}>
                <Text style={a.btnRejectTxt}>✕ Reject</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      {filtered.length === 0 && (
        <View style={a.emptyCard}>
          <Text style={{ fontSize: 40, marginBottom: 10, textAlign: 'center' }}>🧾</Text>
          <Text style={a.emptyTxt}>No claims in this category.</Text>
        </View>
      )}

      <ConfirmModal
        visible={!!action}
        title={action === 'approve' ? '✅ Approve Claim' : '❌ Reject Claim'}
        message={`${action === 'approve' ? 'Approve' : 'Reject'} this claim?`}
        confirmLabel={loading ? 'Processing...' : action === 'approve' ? 'Approve' : 'Reject'}
        confirmColor={action === 'approve' ? C.green : C.red}
        onConfirm={handleAction}
        onCancel={() => { setSelected(null); setAction(null); }}
      >
        <View style={{ marginVertical: 12 }}>
          <Text style={a.modalFieldLabel}>Admin Remarks</Text>
          <TextInput
            style={a.modalInput}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Add remarks or notes..."
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>
      </ConfirmModal>
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── NOTIFICATIONS CENTER ─────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const NotificationsView = ({ notifs, members, loans, claims }) => {
  // Build real-time alerts from data
  const alerts = [
    ...members.filter(m => m.status === 'Pending').map(m => ({
      id: `reg-${m.id}`, type: 'registration', icon: '🆕',
      title: 'New Member Registration',
      message: `${m.name || m.firstName} registered and is awaiting approval.`,
      time: m.createdAt, color: C.gold, read: false,
    })),
    ...loans.filter(l => l.status === 'Pending').map(l => ({
      id: `loan-${l.id}`, type: 'loan', icon: '📝',
      title: 'New Loan Application',
      message: `${l.memberName} applied for a loan of ${fmtCur(l.amount)}.`,
      time: l.createdAt, color: C.blue, read: false,
    })),
    ...claims.filter(c => c.status === 'Pending').map(c => ({
      id: `claim-${c.id}`, type: 'claim', icon: '🧾',
      title: 'New Claim Filed',
      message: `${c.memberName} filed a claim — needs review.`,
      time: c.filedAt, color: C.purple, read: false,
    })),
    ...members.filter(m => m.loanBalance > 0 && m.overdue).map(m => ({
      id: `ov-${m.id}`, type: 'overdue', icon: '🚨',
      title: 'Overdue Payment Alert',
      message: `${m.name || m.firstName} has an overdue balance of ${fmtCur(m.loanBalance)}.`,
      time: null, color: C.red, read: false,
    })),
    ...notifs,
  ].sort((a, b) => {
    const ta = a.time?.toDate?.() || new Date(a.time || 0);
    const tb = b.time?.toDate?.() || new Date(b.time || 0);
    return tb - ta;
  });

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={a.pageTitle}>🔔 Notifications & Alerts</Text>
      <Text style={a.pageSub}>{alerts.filter(n => !n.read).length} unread alerts.</Text>

      {alerts.length === 0 && (
        <View style={a.emptyCard}>
          <Text style={{ fontSize: 40, marginBottom: 10, textAlign: 'center' }}>🔔</Text>
          <Text style={a.emptyTxt}>No notifications at the moment.</Text>
        </View>
      )}

      {alerts.map((n, i) => (
        <TouchableOpacity
          key={n.id || i}
          style={[a.notifCard, { borderLeftColor: n.color, opacity: n.read ? 0.55 : 1 }]}
          onPress={() => n.id && markAdminNotifRead(n.id)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={[a.notifIconBg, { backgroundColor: n.color + '22' }]}>
              <Text style={{ fontSize: 18 }}>{n.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={a.notifTitle}>{n.title}</Text>
                {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.color }} />}
              </View>
              <Text style={a.notifMsg}>{n.message}</Text>
              {n.time && <Text style={a.notifTime}>{fmtDateTime(n.time)}</Text>}
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const AuditView = ({ members }) => {
  // Build a mock audit log from member state changes
  const logs = [
    ...members.filter(m => m.approvedAt).map(m => ({
      id: `apr-${m.id}`, action: 'Member Approved', target: m.name || m.firstName,
      time: m.approvedAt, icon: '✅', color: C.greenLt,
    })),
    ...members.filter(m => m.rejectedAt).map(m => ({
      id: `rej-${m.id}`, action: 'Member Rejected', target: m.name || m.firstName,
      time: m.rejectedAt, icon: '❌', color: C.redLt,
    })),
    ...members.map(m => ({
      id: `reg-${m.id}`, action: 'New Registration', target: m.name || m.firstName,
      time: m.createdAt, icon: '🆕', color: C.gold,
    })),
  ].sort((a, b) => {
    const ta = a.time?.toDate?.() || new Date(a.time || 0);
    const tb = b.time?.toDate?.() || new Date(b.time || 0);
    return tb - ta;
  });

  return (
    <ScrollView contentContainerStyle={a.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={a.pageTitle}>📜 Audit Log</Text>
      <Text style={a.pageSub}>System activity trail for accountability and transparency.</Text>
      <View style={a.tableCard}>
        {logs.slice(0, 40).map(log => (
          <View key={log.id} style={a.auditRow}>
            <Text style={{ fontSize: 16, width: 24 }}>{log.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[a.auditAction, { color: log.color }]}>{log.action}</Text>
              <Text style={a.auditTarget}>{log.target}</Text>
            </View>
            <Text style={a.auditTime}>{fmtDateTime(log.time)}</Text>
          </View>
        ))}
        {logs.length === 0 && <Text style={a.emptyTxt}>No activity yet.</Text>}
      </View>
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── ADMIN SIDEBAR ────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const AdminSidebarGroup = ({ group, activeNav, onNav, onClose, badge }) => {
  const isGroupActive = group.single ? activeNav === group.key : !!(group.children?.find(c => c.key === activeNav));
  const [open, setOpen] = useState(isGroupActive && !group.single);
  const anim = useRef(new Animated.Value(isGroupActive && !group.single ? 1 : 0)).current;

  const toggle = () => {
    if (group.single) { onNav(group.key); if (onClose) onClose(); return; }
    const next = !open; setOpen(next);
    Animated.timing(anim, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  };

  const maxH    = anim.interpolate({ inputRange: [0, 1], outputRange: [0, (group.children?.length || 0) * 42] });
  const chevRot = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={a.sidebarGrpWrap}>
      <TouchableOpacity
        style={[a.sidebarGrpHeader, group.single && activeNav === group.key && a.sidebarItemActive]}
        onPress={toggle} activeOpacity={0.8}
      >
        <Text style={[a.sidebarIcon, group.single && activeNav === group.key && a.sidebarIconActive]}>{group.icon}</Text>
        <Text style={[a.sidebarGrpLabel, group.single && activeNav === group.key && a.sidebarItemTxtActive, !group.single && isGroupActive && { color: C.gold }]}>
          {group.label}
        </Text>
        {badge > 0 && !group.single && (
          <View style={a.sidebarBadge}><Text style={a.sidebarBadgeTxt}>{badge > 99 ? '99+' : badge}</Text></View>
        )}
        {!group.single && <Animated.Text style={[a.chevron, { transform: [{ rotate: chevRot }] }]}>›</Animated.Text>}
      </TouchableOpacity>
      {!group.single && (
        <Animated.View style={{ maxHeight: maxH, overflow: 'hidden' }}>
          {group.children.map(child => (
            <TouchableOpacity key={child.key}
              style={[a.sidebarChild, activeNav === child.key && a.sidebarChildActive]}
              onPress={() => { onNav(child.key); if (onClose) onClose(); }}
              activeOpacity={0.8}
            >
              <Text style={a.sidebarChildDot}>{activeNav === child.key ? '◆' : '◇'}</Text>
              <Text style={[a.sidebarChildTxt, activeNav === child.key && a.sidebarChildTxtActive]}>{child.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

const AdminSidebar = ({ active, onNav, onClose, pendingCount, pendingClaims }) => (
  <View style={a.sidebar}>
    {/* Sidebar brand */}
    <View style={a.sidebarBrand}>
      <View style={a.sidebarLogoMark}>
        <Text style={a.sidebarLogoTxt}>CS</Text>
      </View>
      <View>
        <Text style={a.sidebarBrandName}>CESLA MPC</Text>
        <Text style={a.sidebarBrandSub}>Admin Portal</Text>
      </View>
    </View>
    <View style={a.sidebarDivider} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
      {ADMIN_NAV.map(group => (
        <AdminSidebarGroup
          key={group.key}
          group={group}
          activeNav={active}
          onNav={onNav}
          onClose={onClose}
          badge={group.key === 'members_grp' ? pendingCount : group.key === 'claims_grp' ? pendingClaims : 0}
        />
      ))}
    </ScrollView>
  </View>
);

// ═════════════════════════════════════════════════════════════════════════════
// ─── ADMIN DASHBOARD SHELL ────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const AdminDashboard = ({ admin, onLogout, isWide, isSmall }) => {
  const [activeNav, setActiveNav] = useState('executive');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const members = useMembers();
  const loans   = useLoanApps();
  const claims  = useClaims();
  const notifs  = useAdminNotifs();

  const pendingCount  = members.filter(m => m.status === 'Pending').length;
  const pendingClaims = claims.filter(c => c.status === 'Pending').length;
  const unreadNotifs  = notifs.filter(n => !n.read).length + pendingCount + pendingClaims;

  const switchNav = (key) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,  duration: 140, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 12, duration: 140, useNativeDriver: true }),
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
      case 'executive':      return <ExecutiveView    members={members} loans={loans} claims={claims} />;
      case 'approval':       return <ApprovalView     members={members} />;
      case 'members':        return <MembersView      members={members} />;
      case 'delinquency':    return <DelinquencyView  members={members} />;
      case 'collections':    return <CollectionsView  members={members} />;
      case 'policies':       return <PoliciesView     members={members} />;
      case 'claims':         return <ClaimsView       claims={claims} />;
      case 'notifications':  return <NotificationsView notifs={notifs} members={members} loans={loans} claims={claims} />;
      case 'audit':          return <AuditView        members={members} />;
      default:               return <ExecutiveView    members={members} loans={loans} claims={claims} />;
    }
  };

  return (
    <View style={a.dashRoot}>
      {/* ── TOP BAR ── */}
      <View style={[a.topbar, { paddingTop: Platform.OS === 'web' ? 0 : 44 }]}>
        <View style={a.topbarLeft}>
          {!isWide && (
            <TouchableOpacity style={a.menuBtn} onPress={() => setDrawerOpen(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={a.menuBtnTxt}>☰</Text>
            </TouchableOpacity>
          )}
          {isWide && (
            <>
              <View style={a.topbarLogoMark}><Text style={a.topbarLogoTxt}>CS</Text></View>
              <View>
                <Text style={a.topbarTitle}>Admin Dashboard</Text>
                <Text style={a.topbarSub}>CESLA MPC · CLIMBS Employee Cooperative</Text>
              </View>
            </>
          )}
          {!isWide && <Text style={[a.topbarTitle, { fontSize: 14 }]}>Admin Dashboard</Text>}
        </View>
        <View style={a.topbarRight}>
          {/* Notification bell */}
          <TouchableOpacity style={a.bellBtn} onPress={() => switchNav('notifications')}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
            {unreadNotifs > 0 && (
              <View style={a.bellBadge}>
                <Text style={a.bellBadgeTxt}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Admin badge */}
          <View style={a.adminBadge}>
            <View style={a.adminAvatar}><Text style={a.adminAvatarTxt}>A</Text></View>
            {isWide && <Text style={a.adminName} numberOfLines={1}>{admin?.name || 'Admin'}</Text>}
          </View>
          <TouchableOpacity style={a.logoutBtn} onPress={onLogout}>
            <Text style={a.logoutTxt}>{isSmall ? '↩' : 'Logout'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── BODY ── */}
      <View style={a.dashBody}>
        {isWide && (
          <AdminSidebar
            active={activeNav}
            onNav={switchNav}
            pendingCount={pendingCount}
            pendingClaims={pendingClaims}
          />
        )}
        <Animated.View style={[a.dashContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {renderContent()}
        </Animated.View>
      </View>

      {/* ── MOBILE DRAWER ── */}
      {!isWide && drawerOpen && (
        <TouchableOpacity style={a.drawerOverlay} activeOpacity={1} onPress={() => setDrawerOpen(false)}>
          <View style={a.drawerPanel}>
            <AdminSidebar
              active={activeNav}
              onNav={switchNav}
              onClose={() => setDrawerOpen(false)}
              pendingCount={pendingCount}
              pendingClaims={pendingClaims}
            />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
export default function ManageCoopScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const admin = route?.params?.admin || { name: 'Administrator' };

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold,
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_700Bold,
  });

  const handleLogout = () => {
    if (navigation) navigation.navigate('AdminScreen');
  };

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#98bad5' }}>
        <Spinner message="Loading admin dashboard..." />
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
  // ── Layout ──
  dashRoot:    { flex: 1 },
  dashBody:    { flex: 1, flexDirection: 'row' },
  dashContent: { flex: 1 },

  // ── Top Bar ──
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#98bad5',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 2, borderColor: C.gold,
    gap: 10,
  },
  topbarLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  topbarLogoMark: { width: 34, height: 34, borderRadius: 8, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center' },
  topbarLogoTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#0f1e35', fontWeight: '900' },
  topbarTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 15, color: '#ffffff' },
  topbarSub:   { fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: C.gold, letterSpacing: 0.5 },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn:     { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)', justifyContent: 'center', alignItems: 'center' },
  bellBadge:   { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: C.red, justifyContent: 'center', alignItems: 'center' },
  bellBadgeTxt:{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#fff' },
  adminBadge:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adminAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(201,168,76,0.30)', borderWidth: 1.5, borderColor: C.gold, justifyContent: 'center', alignItems: 'center' },
  adminAvatarTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.gold },
  adminName:   { fontFamily: 'GoogleSans_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  logoutBtn:   { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(201,168,76,0.20)', borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.55)' },
  logoutTxt:   { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.gold },
  menuBtn:     { width: 38, height: 38, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', justifyContent: 'center', alignItems: 'center' },
  menuBtnTxt:  { color: '#ffffff', fontSize: 18 },

  // ── Sidebar ──
  sidebar: { width: 180, backgroundColor: '#1a2d4e', borderRightWidth: 1, borderColor: 'rgba(201,168,76,0.25)' },
  sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingTop: 20 },
  sidebarLogoMark: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center' },
  sidebarLogoTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: '#0f1e35', fontWeight: '900' },
  sidebarBrandName:{ fontFamily: 'NotoSerif_700Bold', fontSize: 13, color: '#ffffff' },
  sidebarBrandSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: C.gold, letterSpacing: 0.5 },
  sidebarDivider:  { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 14, marginBottom: 4 },
  sidebarGrpWrap:  { marginHorizontal: 6, marginBottom: 1 },
  sidebarGrpHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, minHeight: 42 },
  sidebarGrpLabel: { fontFamily: 'GoogleSans_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.65)', flex: 1 },
  chevron:         { color: 'rgba(255,255,255,0.35)', fontSize: 17, fontWeight: '600' },
  sidebarItemActive: { backgroundColor: C.gold },
  sidebarIcon:     { fontSize: 13, width: 18, textAlign: 'center', color: 'rgba(255,255,255,0.50)' },
  sidebarIconActive: { color: '#0f1e35' },
  sidebarItemTxtActive: { fontFamily: 'GoogleSans_700Bold', color: '#0f1e35' },
  sidebarChild:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 16, marginHorizontal: 4, borderRadius: 8, marginBottom: 1, minHeight: 38 },
  sidebarChildActive: { backgroundColor: 'rgba(201,168,76,0.22)' },
  sidebarChildDot: { fontSize: 7, color: 'rgba(255,255,255,0.30)', width: 12, textAlign: 'center' },
  sidebarChildTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: 'rgba(220,232,255,0.58)', flex: 1 },
  sidebarChildTxtActive: { fontFamily: 'GoogleSans_700Bold', color: C.gold },
  sidebarBadge:    { backgroundColor: C.gold, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  sidebarBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#0f1e35' },
  drawerOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 20 },
  drawerPanel:     { position: 'absolute', top: 0, left: 0, bottom: 0, width: 185, zIndex: 21 },

  // ── Page Containers ──
  pageOuter:  { padding: 16, paddingBottom: 48 },
  pageTitle:  { fontFamily: 'NotoSerif_700Bold', fontSize: 20, color: C.navy, marginBottom: 4 },
  pageSub:    { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec, marginBottom: 18, lineHeight: 20 },
  sectionHead:{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  emptyCard:  { backgroundColor: C.surface, borderRadius: 16, padding: 44, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.65)', marginTop: 12 },
  emptyTxt:   { fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
  resultCount:{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textMuted, marginBottom: 10 },

  // ── Executive View ──
  execHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 8 },
  execTitle:  { fontFamily: 'NotoSerif_700Bold', fontSize: 22, color: C.navy },
  execSub:    { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, marginTop: 3 },
  execDate:   { backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)' },
  execDateTxt:{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec },

  // ── Metric Cards ──
  metricsGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  metricCard: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14, padding: 14, flex: 1,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)',
    shadowColor: '#1a2d4e', shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    ...(Platform.OS === 'web' ? { minWidth: 130 } : { minWidth: 140 }),
  },
  metricTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metricIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  metricValue:{ fontFamily: 'NotoSerif_700Bold', fontSize: 20, marginBottom: 4 },
  metricLabel:{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textSec, letterSpacing: 0.5 },
  metricSub:  { fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginTop: 2 },

  // ── Charts ──
  chartsRow:  { flexDirection: 'row', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  chartWrap:  { flex: 1, minWidth: 160, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)' },
  chartLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.textSec, marginBottom: 12 },
  chartBars:  { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 80 },
  chartBarCol:{ flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  chartBarTrack: { width: '100%', backgroundColor: 'rgba(15,30,53,0.10)', borderRadius: 3, overflow: 'hidden', flex: 1 },
  chartBarFill: { width: '100%', borderRadius: 3, position: 'absolute', bottom: 0 },
  chartBarLbl:{ fontFamily: 'GoogleSans_400Regular', fontSize: 8, color: C.textMuted, textAlign: 'center' },

  // ── Quick Stats ──
  quickStatsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  quickStat:  { flex: 1, minWidth: 120, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)' },
  quickStatVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 24, marginBottom: 6 },
  quickStatLabel: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textSec, textAlign: 'center' },

  // ── Table ──
  tableCard:  { backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)', marginBottom: 16 },
  tableHeader:{ flexDirection: 'row', backgroundColor: 'rgba(15,30,53,0.07)', paddingHorizontal: 14, paddingVertical: 10 },
  tableHead:  { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  tableRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderColor: 'rgba(15,30,53,0.08)' },
  tableCell:  { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec, paddingRight: 6 },
  tableCellMono: { fontFamily: 'GoogleSans_500Medium', fontSize: 11, color: C.textMuted },

  // ── Member Cards ──
  memberCard: { backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)', marginBottom: 12,
    shadowColor: '#1a2d4e', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  memberCardRed: { borderColor: 'rgba(192,57,43,0.35)', backgroundColor: 'rgba(231,76,60,0.08)' },
  memberCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  memberAvatar:  { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(201,168,76,0.25)', borderWidth: 1.5, borderColor: C.gold, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  memberAvatarTxt: { fontFamily: 'NotoSerif_700Bold', fontSize: 16, color: C.navyMid },
  memberName:    { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.navy },
  memberUserId:  { fontFamily: 'GoogleSans_500Medium', fontSize: 11, color: C.textMuted, marginTop: 2 },
  memberDateTxt: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, marginTop: 2 },
  memberFinRow:  { flexDirection: 'row', borderTopWidth: 1, borderColor: 'rgba(15,30,53,0.10)', paddingTop: 10, marginTop: 2 },
  memberFin:     { flex: 1, alignItems: 'center' },
  memberFinLabel:{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted, marginBottom: 3 },
  memberFinVal:  { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy },
  memberCardActions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },

  // ── Action Buttons ──
  btnApprove:     { flex: 1, backgroundColor: 'rgba(26,138,74,0.15)', borderWidth: 1.5, borderColor: 'rgba(26,138,74,0.50)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  btnApproveTxt:  { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.green },
  btnReject:      { flex: 1, backgroundColor: 'rgba(192,57,43,0.12)', borderWidth: 1.5, borderColor: 'rgba(192,57,43,0.45)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  btnRejectTxt:   { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.red },
  btnSmallRed:    { backgroundColor: 'rgba(192,57,43,0.12)', borderWidth: 1.5, borderColor: 'rgba(192,57,43,0.40)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  btnSmallGreen:  { backgroundColor: 'rgba(26,138,74,0.15)', borderWidth: 1.5, borderColor: 'rgba(26,138,74,0.40)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  btnSmallGold:   { backgroundColor: 'rgba(201,168,76,0.18)', borderWidth: 1.5, borderColor: 'rgba(180,130,40,0.45)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  btnSmallTxt:    { fontFamily: 'GoogleSans_700Bold', fontSize: 12, color: C.navy },

  // ── Search & Filters ──
  searchRow:  { marginBottom: 10 },
  searchBox:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.90)', gap: 10 },
  searchInput:{ flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: C.navy },
  filterRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.70)' },
  filterChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  filterChipTxt:    { fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec },
  filterChipTxtActive: { fontFamily: 'GoogleSans_700Bold', color: '#ffffff' },

  // ── Delinquency ──
  delinqSummary: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  delinqStat:    { flex: 1, minWidth: 100, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5 },
  delinqStatVal: { fontFamily: 'NotoSerif_700Bold', fontSize: 20, marginBottom: 4 },
  delinqStatLabel: { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, textAlign: 'center' },
  alertBanner:   { backgroundColor: 'rgba(192,57,43,0.12)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(192,57,43,0.38)', padding: 12, marginBottom: 14 },
  alertBannerTxt:{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.red, lineHeight: 20 },

  // ── Claims ──
  claimDesc:  { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec, lineHeight: 19, borderTopWidth: 1, borderColor: 'rgba(15,30,53,0.08)', paddingTop: 10, marginTop: 4 },
  claimRemarks:{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: '#9a7230', lineHeight: 18, marginTop: 6, fontStyle: 'italic' },

  // ── Notifications ──
  notifCard:  { backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)', borderLeftWidth: 3, marginBottom: 10 },
  notifIconBg:{ width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy },
  notifMsg:   { fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textSec, lineHeight: 19 },
  notifTime:  { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, marginTop: 4 },

  // ── Audit ──
  auditRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderBottomWidth: 1, borderColor: 'rgba(15,30,53,0.08)' },
  auditAction:{ fontFamily: 'GoogleSans_700Bold', fontSize: 13 },
  auditTarget:{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textSec, marginTop: 2 },
  auditTime:  { fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, textAlign: 'right', marginLeft: 'auto', flexShrink: 0 },

  // ── Modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,30,53,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:    { width: '100%', maxWidth: 400, backgroundColor: '#deeaf3', borderRadius: 20, padding: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.80)',
    shadowColor: '#1a2d4e', shadowOpacity: 0.20, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
  },
  modalTitle:   { fontFamily: 'NotoSerif_700Bold', fontSize: 18, color: C.navy, marginBottom: 10 },
  modalMsg:     { fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: C.textSec, lineHeight: 21, marginBottom: 8 },
  modalFieldLabel: { fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  modalInput:   { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(15,30,53,0.18)', padding: 12, fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: C.navy },
  modalBtns:    { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1.5, borderColor: 'rgba(15,30,53,0.15)', alignItems: 'center' },
  modalBtnCancelTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: C.textSec },
  modalBtnConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnConfirmTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 14, color: '#fff' },
});