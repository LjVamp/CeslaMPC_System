// src/screens/CoopScreen.js
// CESLA Multi-Purpose Cooperative — Full Portal
// Role Selection → Admin (PIN) → Admin Dashboard
//               → Member (Login/Register) → Member Dashboard

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, StatusBar,
  useWindowDimensions, Platform, TextInput,
  KeyboardAvoidingView, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ADMIN_PIN = '1234';

// ─── VIEWS ───────────────────────────────────────────────────────────────────
const V = {
  ROLE_SELECT:      'role_select',
  ADMIN_PIN:        'admin_pin',
  ADMIN_DASH:       'admin_dash',
  MEMBER_LOGIN:     'member_login',
  MEMBER_REGISTER:  'member_register',
  MEMBER_DASH:      'member_dash',
};

// ─── ADMIN NAV ────────────────────────────────────────────────────────────────
const ANAV = { DASHBOARD:'dashboard', ACCOUNTS:'accounts', MEMBERS:'members', LOANS:'loans', REPORTS:'reports' };

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  navy:'#1a2d4e', navyDark:'#0f1e35', navyMid:'#243554', navyDeep:'#304674',
  gold:'#c9a84c', goldLight:'#e8c87a',
  blue:'#6fa3f7', green:'#2ecc71', red:'#e74c3c', orange:'#f5a623',
  textMain:'#0f1e35', textMuted:'rgba(15,30,53,0.55)',
};

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const PENDING_APPS = [
  { id:'APP-001', firstName:'Carlo',  lastName:'Reyes',    contact:'09171112233', email:'carlo@email.com',  address:'Davao City', appliedAt:'2026-03-05 09:00 AM', shares:2000, savings:5000 },
  { id:'APP-002', firstName:'Grace',  lastName:'Lim',      contact:'09282223344', email:'grace@email.com',  address:'Tagum City', appliedAt:'2026-03-06 10:15 AM', shares:3000, savings:8000 },
  { id:'APP-003', firstName:'Ronnie', lastName:'Dela Paz', contact:'09393334455', email:'ronnie@email.com', address:'Digos City', appliedAt:'2026-03-06 11:30 AM', shares:1500, savings:4000 },
];

const INIT_MEMBERS = [
  { userId:'CESLA-2026-00001', password:'password123', firstName:'Ledy Joy',       lastName:'Bandiola', contact:'09171234567', email:'ledyjoy@email.com',  address:'Davao City', memberSince:'2026-03-05', shares:5000,  savings:12000, loan:0,     loanBalance:0,     status:'Active',  appForm:{} },
  { userId:'CESLA-2026-00002', password:'password123', firstName:'Aseñero Azaron', lastName:'Rochelle', contact:'09281234567', email:'rochelle@email.com', address:'Davao City', memberSince:'2026-03-02', shares:8000,  savings:20000, loan:50000, loanBalance:32000, status:'Active',  appForm:{} },
];

const LOANS_DATA = [
  { id:'LN-0001', memberId:'CESLA-2026-00002', memberName:'Rochelle, Aseñero Azaron', amount:50000, balance:32000, monthlyPayment:2000, nextDue:'2026-04-01', status:'Active', payments:[
    {date:'2026-01-01', amount:2000, note:'Monthly payment'},
    {date:'2026-02-01', amount:2000, note:'Monthly payment'},
    {date:'2026-03-01', amount:2000, note:'Monthly payment'},
  ]},
];

const ACTIVITY_LOG = [
  { id:1, text:'Ledy Joy Bandiola account approved',       time:'Mar 5, 2026 08:58 AM', type:'approve' },
  { id:2, text:'Aseñero Azaron Rochelle account approved', time:'Mar 2, 2026 10:58 AM', type:'approve' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmtCur  = (v) => '₱' + Number(v||0).toLocaleString('en-PH',{minimumFractionDigits:2});
const today   = ()  => new Date().toISOString().split('T')[0];
const nowStr  = ()  => new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
                       + ' ' + new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
const genUID  = (list) => `CESLA-${new Date().getFullYear()}-${String(list.length+1).padStart(5,'0')}`;

// ─── APP BACKGROUND ───────────────────────────────────────────────────────────
const AppBg = () => (
  <>
    <View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#98bad5'}]}/>
    <LinearGradient colors={['rgba(198,220,235,0.85)','rgba(152,186,213,0.40)','rgba(80,110,150,0.0)']} locations={[0,0.45,1]} start={{x:0.5,y:0.1}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>
    <LinearGradient colors={['rgba(50,80,120,0.45)','rgba(50,80,120,0.0)','rgba(50,80,120,0.45)']} locations={[0,0.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFillObject}/>
    <LinearGradient colors={['rgba(50,80,120,0.0)','rgba(60,90,130,0.35)']} locations={[0.4,1]} start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>
  </>
);

// ─── SHARED HEADER ────────────────────────────────────────────────────────────
const HeaderBar = ({ title, subtitle, titleGold, onBack, isWide, isSmall, rightEl }) => (
  <View style={[s.header,{
    paddingHorizontal:isWide?40:16, paddingVertical:isWide?16:12,
    marginTop:Platform.OS==='web'?0:44,
  }]}>
    {onBack
      ? <TouchableOpacity style={s.backBtn} onPress={onBack}><Text style={s.backIcon}>←</Text></TouchableOpacity>
      : <View style={{width:40}}/>}
    <View style={s.headerCenter}>
      <Text style={[s.headerTitle,{fontSize:isWide?20:isSmall?14:17}]} adjustsFontSizeToFit numberOfLines={1}>
        {titleGold ? <Text style={s.headerGold}>{titleGold} </Text> : null}{title}
      </Text>
      {subtitle ? <Text style={[s.headerSub,{fontSize:isWide?10:8}]}>{subtitle}</Text> : null}
    </View>
    {rightEl || <View style={{width:40}}/>}
  </View>
);

// ─── SHARED INPUT FIELD ───────────────────────────────────────────────────────
const Field = ({label,value,onChangeText,placeholder,secureEntry,keyboardType,error,showToggle,onToggle,editable=true}) => (
  <View style={s.fieldWrap}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.fieldRow, !editable&&s.fieldRowDisabled, error&&s.fieldRowError]}>
      <TextInput style={s.fieldInput} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor="rgba(15,30,53,0.35)"
        secureTextEntry={secureEntry} keyboardType={keyboardType||'default'}
        editable={editable} autoCapitalize="none" autoCorrect={false}/>
      {showToggle && (
        <TouchableOpacity onPress={onToggle} style={{paddingLeft:8}}>
          <Text style={{fontSize:16}}>{secureEntry?'👁':'🙈'}</Text>
        </TouchableOpacity>
      )}
    </View>
    {error ? <Text style={s.fieldErr}>{error}</Text> : null}
  </View>
);

// ══════════════════════════════════════════════════════════════════════════════
// ─── ROLE SELECTION ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const RoleSelect = ({ onSelectAdmin, onSelectMember, isWide }) => {
  const fadeY  = useRef(new Animated.Value(0)).current;
  const transY = useRef(new Animated.Value(30)).current;
  useEffect(()=>{
    Animated.parallel([
      Animated.timing(fadeY, {toValue:1,duration:600,useNativeDriver:true}),
      Animated.timing(transY,{toValue:0,duration:600,useNativeDriver:true}),
    ]).start();
  },[]);

  const ROLES = [
    { label:'Admin',  icon:'🔐', desc:'Manage members, accounts,\nloans & reports', accent:C.blue,   onPress:onSelectAdmin  },
    { label:'Member', icon:'👤', desc:'View profile, savings,\nshares & loans',   accent:C.gold,   onPress:onSelectMember },
  ];

  const cardW = isWide ? 280 : '100%';

  return (
    <Animated.View style={[s.roleOuter,{opacity:fadeY,transform:[{translateY:transY}]}]}>
      <Text style={s.roleTitle}>Who are you?</Text>
      <Text style={s.roleSub}>Choose your role to continue</Text>
      <View style={[s.roleRow,isWide&&{flexDirection:'row',gap:24}]}>
        {ROLES.map(role=>(
          <TouchableOpacity key={role.label} style={[s.roleCard,{width:cardW}]}
            onPress={role.onPress} activeOpacity={0.85}>
            {Platform.OS==='web' ? (
              <LinearGradient colors={['rgba(255,255,255,0.22)','rgba(255,255,255,0.10)']}
                start={{x:0,y:0}} end={{x:0,y:1}} style={s.roleCardInner}>
                <RoleCardBody role={role}/>
              </LinearGradient>
            ) : (
              <View style={[s.roleCardInner,{backgroundColor:'rgba(255,255,255,0.18)'}]}>
                <RoleCardBody role={role}/>
              </View>
            )}
            <Animated.View style={[s.roleAccentLine,{backgroundColor:role.accent}]}/>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
};

const RoleCardBody = ({role}) => (
  <>
    <View style={[s.roleIconCircle,{borderColor:role.accent+'88'}]}>
      <Text style={{fontSize:36}}>{role.icon}</Text>
    </View>
    <Text style={s.roleLabel}>{role.label.toUpperCase()}</Text>
    <Text style={s.roleDesc}>{role.desc}</Text>
    <View style={[s.roleArrow,{borderColor:'rgba(1,31,75,0.20)'}]}>
      <Text style={{color:'rgba(1,31,75,0.6)',fontSize:15,fontWeight:'600'}}>→</Text>
    </View>
  </>
);

// ══════════════════════════════════════════════════════════════════════════════
// ─── ADMIN PIN LOGIN ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const AdminPinLogin = ({ onSuccess, isWide }) => {
  const [pin,setPin]   = useState('');
  const [error,setErr] = useState('');
  const shake          = useRef(new Animated.Value(0)).current;
  const fadeIn         = useRef(new Animated.Value(0)).current;
  useEffect(()=>{ Animated.timing(fadeIn,{toValue:1,duration:450,useNativeDriver:true}).start(); },[]);

  const pushDigit = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d; setPin(next); setErr('');
    if (next.length === 4) {
      setTimeout(()=>{
        if (next === ADMIN_PIN) { onSuccess(); }
        else {
          setErr('Incorrect PIN. Try again.');
          Animated.sequence([
            Animated.timing(shake,{toValue:10, duration:55,useNativeDriver:true}),
            Animated.timing(shake,{toValue:-10,duration:55,useNativeDriver:true}),
            Animated.timing(shake,{toValue:8,  duration:55,useNativeDriver:true}),
            Animated.timing(shake,{toValue:-8, duration:55,useNativeDriver:true}),
            Animated.timing(shake,{toValue:0,  duration:55,useNativeDriver:true}),
          ]).start();
          setPin('');
        }
      },150);
    }
  };

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <View style={s.pinOuter}>
      <Animated.View style={{opacity:fadeIn,transform:[{translateX:shake}],width:'100%',alignItems:'center'}}>
        <View style={s.pinCard}>
          <View style={s.pinCardInner}>
            <View style={s.pinIconWrap}><Text style={{fontSize:32}}>🔐</Text></View>
            <Text style={s.pinTitle}>Admin Access</Text>
            <Text style={s.pinSub}>Enter your 4-digit PIN to continue</Text>
            <View style={s.pinDots}>
              {[0,1,2,3].map(i=>(
                <View key={i} style={[s.pinDot, pin.length>i&&s.pinDotOn]}/>
              ))}
            </View>
            {error ? <Text style={s.pinErr}>{error}</Text> : <View style={{height:18}}/>}
            <View style={s.numpad}>
              {KEYS.map((k,i)=> k==='' ? <View key={i} style={s.numKey}/> : (
                <TouchableOpacity key={i} style={[s.numKey,k==='⌫'&&s.numKeyDel]}
                  onPress={()=>k==='⌫'?setPin(p=>p.slice(0,-1)):pushDigit(k)} activeOpacity={0.7}>
                  <Text style={[s.numKeyTxt,k==='⌫'&&s.numKeyDelTxt]}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const AdminSidebar = ({active, onNav, pendingCount}) => {
  const ITEMS = [
    {key:ANAV.DASHBOARD, label:'Dashboard',          icon:'⊞', section:'MAIN'},
    {key:ANAV.ACCOUNTS,  label:'Account Management', icon:'◈', section:'MEMBERS'},
    {key:ANAV.MEMBERS,   label:'Members Monitoring', icon:'◉', section:'MEMBERS'},
    {key:ANAV.LOANS,     label:'Loan Management',    icon:'◈', section:'LOANS'},
    {key:ANAV.REPORTS,   label:'Reports',            icon:'▤', section:'REPORTS'},
  ];
  const secs = ['MAIN','MEMBERS','LOANS','REPORTS'];
  return (
    <View style={s.sidebar}>
      <View style={s.sidebarLogo}>
        <View style={s.sidebarLogoMark}><Text style={s.sidebarLogoTxt}>CS</Text></View>
        <Text style={s.sidebarLogoName}>CESLA Cooperative</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {secs.map(sec=>(
          <View key={sec} style={{marginBottom:6}}>
            <Text style={s.sidebarSec}>{sec}</Text>
            {ITEMS.filter(i=>i.section===sec).map(item=>(
              <TouchableOpacity key={item.key}
                style={[s.sidebarItem, active===item.key&&s.sidebarItemActive]}
                onPress={()=>onNav(item.key)} activeOpacity={0.8}>
                <Text style={[s.sidebarIcon, active===item.key&&s.sidebarIconActive]}>{item.icon}</Text>
                <Text style={[s.sidebarItemTxt, active===item.key&&s.sidebarItemTxtActive]}>{item.label}</Text>
                {item.key===ANAV.ACCOUNTS && pendingCount>0 && (
                  <View style={s.sidebarBadge}><Text style={s.sidebarBadgeTxt}>{pendingCount}</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const StatCard = ({label,value,sub,icon,accentColor}) => (
  <View style={[s.statCard,{borderTopColor:accentColor,borderTopWidth:3}]}>
    <View style={s.statTop}>
      <View>
        <Text style={s.statLabel}>{label}</Text>
        <Text style={s.statValue}>{value}</Text>
        <Text style={s.statSub}>{sub}</Text>
      </View>
      <Text style={[s.statIcon,{color:accentColor}]}>{icon}</Text>
    </View>
  </View>
);

const DashboardView = ({pending,members,loans,activity,isWide}) => (
  <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
    <Text style={s.pageTitle}>Dashboard Overview</Text>
    <Text style={s.pageSub}>Welcome back, Admin. Here's what's happening today.</Text>
    <View style={[s.statRow,isWide&&{flexDirection:'row'}]}>
      <StatCard label="PENDING ACCOUNTS" value={pending.length} sub="Awaiting approval"  icon="⏳" accentColor={C.orange}/>
      <StatCard label="APPROVED MEMBERS" value={members.length} sub="Total verified"     icon="✓"  accentColor={C.green}/>
      <StatCard label="APP. FORMS"        value={pending.length} sub="Submitted forms"   icon="📋" accentColor={C.gold}/>
      <StatCard label="ACTIVE LOANS"      value={loans.filter(l=>l.status==='Active').length} sub="Ongoing loans" icon="◆" accentColor={C.blue}/>
    </View>
    <View style={s.actCard}>
      <View style={s.actHeader}>
        <Text style={s.actTitle}>Recent Activity</Text>
        <Text style={s.actMeta}>Last {activity.length} events</Text>
      </View>
      {activity.length===0 ? <Text style={s.emptyTxt}>No recent activity.</Text>
        : activity.map(a=>(
          <View key={a.id} style={s.actRow}>
            <View style={[s.actDot,{backgroundColor:a.type==='approve'?C.green:C.orange}]}/>
            <View><Text style={s.actTxt}>{a.text}</Text><Text style={s.actTime}>{a.time}</Text></View>
          </View>
        ))}
    </View>
  </ScrollView>
);

const AccountsView = ({pending,setPending,members,setMembers,setActivity,isWide}) => {
  const [rejecting,setRejecting] = useState(null);
  const handleApprove = (app) => {
    const nm = { userId:`CESLA-${new Date().getFullYear()}-${String(members.length+1).padStart(5,'0')}`,
      password:'cesla123', firstName:app.firstName, lastName:app.lastName,
      contact:app.contact, email:app.email, address:app.address,
      memberSince:today(), shares:app.shares, savings:app.savings,
      loan:0, loanBalance:0, status:'Active', appForm:{} };
    setMembers(p=>[...p,nm]);
    setPending(p=>p.filter(x=>x.id!==app.id));
    setActivity(p=>[{id:Date.now(),type:'approve',text:`${app.firstName} ${app.lastName} account approved`,time:nowStr()},...p]);
  };
  const handleReject = (app) => {
    setPending(p=>p.filter(x=>x.id!==app.id));
    setActivity(p=>[{id:Date.now(),type:'reject',text:`${app.firstName} ${app.lastName} application rejected`,time:nowStr()},...p]);
    setRejecting(null);
  };
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Account Management</Text>
      <Text style={s.pageSub}>Review and process pending member applications.</Text>
      {pending.length===0
        ? <View style={s.emptyCard}><Text style={{fontSize:36,marginBottom:12}}>✅</Text><Text style={s.emptyCardTxt}>No pending applications</Text></View>
        : pending.map(app=>(
          <View key={app.id} style={s.appCard}>
            <View style={s.appHead}>
              <View style={s.appAvatar}><Text style={s.appAvatarTxt}>{app.firstName[0]}{app.lastName[0]}</Text></View>
              <View style={{flex:1}}>
                <Text style={s.appName}>{app.firstName} {app.lastName}</Text>
                <Text style={s.appId}>{app.id}  •  Applied {app.appliedAt}</Text>
              </View>
              <View style={s.pendingBadge}><Text style={s.pendingBadgeTxt}>PENDING</Text></View>
            </View>
            <View style={[s.appDetails,isWide&&{flexDirection:'row',flexWrap:'wrap'}]}>
              {[['Contact',app.contact],['Email',app.email],['Address',app.address],
                ['Shares',fmtCur(app.shares)],['Savings',fmtCur(app.savings)]].map(([l,v])=>(
                <View key={l} style={s.appDetailItem}>
                  <Text style={s.appDetailLabel}>{l}</Text>
                  <Text style={s.appDetailVal}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={s.appActions}>
              <TouchableOpacity style={s.rejectBtn} onPress={()=>setRejecting(app)}>
                <Text style={s.rejectBtnTxt}>✕  Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.approveBtn} onPress={()=>handleApprove(app)}>
                <LinearGradient colors={['#1a6b3a','#27ae60']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.approveBtnGrad}>
                  <Text style={s.approveBtnTxt}>✓  Approve</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ))
      }
      <Modal transparent visible={!!rejecting} animationType="fade" onRequestClose={()=>setRejecting(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reject Application?</Text>
            <Text style={s.modalBody}>Reject <Text style={{fontFamily:'GoogleSans_700Bold',color:C.navy}}>{rejecting?.firstName} {rejecting?.lastName}</Text>? This cannot be undone.</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={()=>setRejecting(null)}><Text style={s.modalCancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={()=>handleReject(rejecting)}><Text style={s.modalConfirmTxt}>Yes, Reject</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const MembersView = ({members,isWide}) => {
  const [search,setSearch] = useState('');
  const [detail,setDetail] = useState(null);
  const filtered = members.filter(m=>`${m.firstName} ${m.lastName} ${m.userId}`.toLowerCase().includes(search.toLowerCase()));
  if (detail) return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={s.breadcrumb} onPress={()=>setDetail(null)}><Text style={s.breadcrumbTxt}>← Members Monitoring</Text></TouchableOpacity>
      <View style={s.detailHead}>
        <View style={s.detailAvatar}><Text style={s.detailAvatarTxt}>{detail.firstName[0]}{detail.lastName[0]}</Text></View>
        <View>
          <Text style={s.detailName}>{detail.firstName} {detail.lastName}</Text>
          <Text style={s.detailId}>{detail.userId}</Text>
          <View style={[s.statusBadge,detail.status==='Active'?s.statusActive:s.statusInactive]}><Text style={s.statusTxt}>{detail.status}</Text></View>
        </View>
      </View>
      <View style={[isWide&&{flexDirection:'row',gap:16}]}>
        <View style={[s.detailSection,{flex:1}]}>
          <Text style={s.detailSectionTitle}>👤  Personal</Text>
          {[['Contact',detail.contact],['Email',detail.email],['Address',detail.address],['Member Since',detail.memberSince]].map(([l,v])=>(
            <View key={l} style={s.detailRow}><Text style={s.detailRowL}>{l}</Text><Text style={s.detailRowV}>{v||'—'}</Text></View>
          ))}
        </View>
        <View style={[s.detailSection,{flex:1}]}>
          <Text style={s.detailSectionTitle}>💰  Financials</Text>
          {[['Shares',fmtCur(detail.shares),C.gold],['Savings',fmtCur(detail.savings),C.green],['Loan Balance',fmtCur(detail.loanBalance),detail.loanBalance>0?C.red:C.green]].map(([l,v,c])=>(
            <View key={l} style={s.detailRow}><Text style={s.detailRowL}>{l}</Text><Text style={[s.detailRowV,{color:c}]}>{v}</Text></View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Members Monitoring</Text>
      <Text style={s.pageSub}>View all registered cooperative members.</Text>
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Text style={{fontSize:14,marginRight:6}}>🔍</Text>
          <TextInput style={s.searchInput} placeholder="Search by name or ID..." placeholderTextColor={C.textMuted} value={search} onChangeText={setSearch}/>
          {search ? <TouchableOpacity onPress={()=>setSearch('')}><Text style={{color:C.textMuted,fontWeight:'700'}}>✕</Text></TouchableOpacity> : null}
        </View>
        <Text style={s.countTxt}>{filtered.length} member{filtered.length!==1?'s':''}</Text>
      </View>
      {isWide && (
        <View style={s.tableHead}>
          {['ID','Name','Contact','Shares','Savings','Status',''].map((h,i)=>(
            <Text key={i} style={[s.tableHeadCell,i===1&&{flex:2}]}>{h}</Text>
          ))}
        </View>
      )}
      {filtered.map((m,i)=>(
        <TouchableOpacity key={m.userId} style={[s.memberRow,i%2===0&&s.memberRowAlt]} onPress={()=>setDetail(m)} activeOpacity={0.75}>
          {isWide ? (<>
            <Text style={[s.memberCell,s.cellMono]}>{m.userId}</Text>
            <Text style={[s.memberCell,{flex:2,fontFamily:'GoogleSans_700Bold',color:C.navy}]}>{m.lastName}, {m.firstName}</Text>
            <Text style={s.memberCell}>{m.contact}</Text>
            <Text style={[s.memberCell,{color:C.gold}]}>{fmtCur(m.shares)}</Text>
            <Text style={[s.memberCell,{color:C.green}]}>{fmtCur(m.savings)}</Text>
            <View style={[s.statusBadge,m.status==='Active'?s.statusActive:s.statusInactive]}><Text style={s.statusTxt}>{m.status}</Text></View>
            <TouchableOpacity style={s.viewBtn} onPress={()=>setDetail(m)}><Text style={s.viewBtnTxt}>View →</Text></TouchableOpacity>
          </>) : (
            <View style={{flex:1}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:14,color:C.navy}}>{m.lastName}, {m.firstName}</Text>
                <View style={[s.statusBadge,m.status==='Active'?s.statusActive:s.statusInactive]}><Text style={s.statusTxt}>{m.status}</Text></View>
              </View>
              <Text style={[s.cellMono,{marginTop:2,fontSize:11,color:C.textMuted}]}>{m.userId}  •  {m.contact}</Text>
              <View style={{flexDirection:'row',gap:14,marginTop:5}}>
                <Text style={{fontFamily:'GoogleSans_400Regular',fontSize:11,color:C.gold}}>Shares: {fmtCur(m.shares)}</Text>
                <Text style={{fontFamily:'GoogleSans_400Regular',fontSize:11,color:C.green}}>Savings: {fmtCur(m.savings)}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const LoansAdminView = ({loans,setLoans,isWide}) => {
  const [detail,setDetail]   = useState(null);
  const [payModal,setPayModal] = useState(null);
  const [payAmt,setPayAmt]   = useState('');
  const [payNote,setPayNote] = useState('');
  const handlePayment = () => {
    const amt = parseFloat(payAmt); if (!amt||amt<=0) return;
    setLoans(prev=>prev.map(l=>{
      if (l.id!==payModal.id) return l;
      const nb = Math.max(0,l.balance-amt);
      return {...l,balance:nb,payments:[...(l.payments||[]),{date:today(),amount:amt,note:payNote||'Payment'}],status:nb===0?'Paid':'Active'};
    }));
    if (detail?.id===payModal.id) setDetail(prev=>({...prev,balance:Math.max(0,prev.balance-payAmt)}));
    setPayModal(null); setPayAmt(''); setPayNote('');
  };
  if (detail) {
    const loan = loans.find(l=>l.id===detail.id)||detail;
    const paid = loan.amount-loan.balance;
    const prog = loan.amount>0?paid/loan.amount:0;
    return (
      <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.breadcrumb} onPress={()=>setDetail(null)}><Text style={s.breadcrumbTxt}>← Loan Management</Text></TouchableOpacity>
        <Text style={s.pageTitle}>Loan Details</Text>
        <View style={[isWide&&{flexDirection:'row',gap:16}]}>
          <View style={[s.detailSection,{flex:1}]}>
            <Text style={s.detailSectionTitle}>📋  Summary</Text>
            {[['Loan ID',loan.id],['Member',loan.memberName],['Amount',fmtCur(loan.amount)],
              ['Paid',fmtCur(paid)],['Balance',fmtCur(loan.balance)],['Status',loan.status]
            ].map(([l,v])=>(
              <View key={l} style={s.detailRow}>
                <Text style={s.detailRowL}>{l}</Text>
                <Text style={[s.detailRowV,l==='Balance'&&loan.balance>0&&{color:C.red}]}>{v}</Text>
              </View>
            ))}
            <View style={{marginTop:12}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
                <Text style={s.detailRowL}>Progress</Text>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:12,color:C.green}}>{Math.round(prog*100)}%</Text>
              </View>
              <View style={s.progressTrack}><View style={[s.progressFill,{width:`${Math.round(prog*100)}%`}]}/></View>
            </View>
            {loan.status!=='Paid' && (
              <TouchableOpacity style={s.recordPayBtn} onPress={()=>setPayModal(loan)}>
                <LinearGradient colors={['#1a3a6b','#304674']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.recordPayBtnGrad}>
                  <Text style={s.recordPayBtnTxt}>+ Record Payment</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
          <View style={[s.detailSection,{flex:1}]}>
            <Text style={s.detailSectionTitle}>💳  Payment History</Text>
            {(!loan.payments||loan.payments.length===0) ? <Text style={s.emptyTxt}>No payments yet.</Text>
              : [...loan.payments].reverse().map((p,i)=>(
                <View key={i} style={s.payHistRow}>
                  <View style={s.payHistDot}/>
                  <View style={{flex:1}}><Text style={s.payHistAmt}>{fmtCur(p.amount)}</Text><Text style={s.payHistMeta}>{p.date}  •  {p.note}</Text></View>
                </View>
              ))
            }
          </View>
        </View>
        <Modal transparent visible={!!payModal} animationType="fade" onRequestClose={()=>setPayModal(null)}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Record Payment</Text>
              <Text style={s.modalBody}>Balance: <Text style={{color:C.red,fontFamily:'GoogleSans_700Bold'}}>{fmtCur(payModal?.balance)}</Text></Text>
              <Text style={s.fieldLabel}>Amount (₱)</Text>
              <View style={s.fieldRow}><TextInput style={s.fieldInput} placeholder="e.g. 2000" placeholderTextColor={C.textMuted} keyboardType="numeric" value={payAmt} onChangeText={setPayAmt}/></View>
              <Text style={[s.fieldLabel,{marginTop:10}]}>Note</Text>
              <View style={s.fieldRow}><TextInput style={s.fieldInput} placeholder="e.g. Monthly payment" placeholderTextColor={C.textMuted} value={payNote} onChangeText={setPayNote}/></View>
              <View style={s.modalBtns}>
                <TouchableOpacity style={s.modalCancel} onPress={()=>{setPayModal(null);setPayAmt('');setPayNote('');}}><Text style={s.modalCancelTxt}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={s.modalConfirm} onPress={handlePayment}><Text style={s.modalConfirmTxt}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Loan Management</Text>
      <Text style={s.pageSub}>Track active loans, record payments, monitor balances.</Text>
      {loans.length===0 ? <View style={s.emptyCard}><Text style={{fontSize:36,marginBottom:12}}>📋</Text><Text style={s.emptyCardTxt}>No loans on record</Text></View>
        : loans.map(loan=>{
          const prog = loan.amount>0?(loan.amount-loan.balance)/loan.amount:0;
          return (
            <TouchableOpacity key={loan.id} style={s.loanCard} onPress={()=>setDetail(loan)} activeOpacity={0.82}>
              <View style={s.loanCardTop}>
                <View><Text style={s.loanId}>{loan.id}</Text><Text style={s.loanMember}>{loan.memberName}</Text></View>
                <View style={[s.statusBadge,loan.status==='Active'?s.statusActive:s.statusPaid]}><Text style={s.statusTxt}>{loan.status}</Text></View>
              </View>
              <View style={[isWide&&{flexDirection:'row',gap:28}]}>
                {[['Loan Amount',fmtCur(loan.amount),C.blue],['Balance',fmtCur(loan.balance),loan.balance>0?C.red:C.green],['Next Due',loan.nextDue,C.gold]].map(([l,v,c])=>(
                  <View key={l}><Text style={s.loanAmtLabel}>{l}</Text><Text style={[s.loanAmtVal,{color:c}]}>{v}</Text></View>
                ))}
              </View>
              <View style={{marginTop:10}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                  <Text style={s.loanAmtLabel}>Progress</Text>
                  <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:11,color:C.green}}>{Math.round(prog*100)}%</Text>
                </View>
                <View style={s.progressTrack}><View style={[s.progressFill,{width:`${Math.round(prog*100)}%`}]}/></View>
              </View>
              <Text style={s.viewLoanHint}>Tap to view details →</Text>
            </TouchableOpacity>
          );
        })
      }
    </ScrollView>
  );
};

const ReportsView = ({members,loans,pending}) => {
  const ts = members.reduce((s,m)=>s+(m.shares||0),0);
  const tsav = members.reduce((s,m)=>s+(m.savings||0),0);
  const tla = loans.reduce((s,l)=>s+(l.amount||0),0);
  const tlb = loans.reduce((s,l)=>s+(l.balance||0),0);
  return (
    <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Reports</Text>
      <Text style={s.pageSub}>Summary of cooperative financials and membership data.</Text>
      {[
        {title:'👥  Membership Summary', stats:[['Total Members',members.length,C.blue],['Active',members.filter(m=>m.status==='Active').length,C.green],['Pending Apps',pending.length,C.orange],['Total Shares',fmtCur(ts),C.gold],['Total Savings',fmtCur(tsav),C.green]]},
        {title:'💳  Loan Summary', stats:[['Total Loans',loans.length,C.blue],['Active',loans.filter(l=>l.status==='Active').length,C.orange],['Total Amount',fmtCur(tla),C.red],['Outstanding',fmtCur(tlb),tlb>0?C.red:C.green]]},
      ].map(sec=>(
        <View key={sec.title} style={s.reportSection}>
          <Text style={s.reportSectionTitle}>{sec.title}</Text>
          <View style={s.reportGrid}>
            {sec.stats.map(([l,v,c])=>(
              <View key={l} style={s.reportStat}>
                <Text style={[s.reportStatVal,{color:c}]}>{v}</Text>
                <Text style={s.reportStatLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      <View style={s.reportSection}>
        <Text style={s.reportSectionTitle}>📋  Member List</Text>
        {members.map((m,i)=>(
          <View key={m.userId} style={[s.reportRow,i%2===0&&s.reportRowAlt]}>
            <Text style={[s.reportCell,s.cellMono,{minWidth:130}]}>{m.userId}</Text>
            <Text style={[s.reportCell,{flex:2,fontFamily:'GoogleSans_700Bold',color:C.navy}]}>{m.lastName}, {m.firstName}</Text>
            <Text style={[s.reportCell,{color:C.gold}]}>{fmtCur(m.shares)}</Text>
            <Text style={[s.reportCell,{color:C.green}]}>{fmtCur(m.savings)}</Text>
            <View style={[s.statusBadge,m.status==='Active'?s.statusActive:s.statusInactive]}><Text style={s.statusTxt}>{m.status}</Text></View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const AdminDashboard = ({members,setMembers,onLogout,isWide,isSmall,navigation}) => {
  const [activeNav,setActiveNav] = useState(ANAV.DASHBOARD);
  const [drawerOpen,setDrawerOpen] = useState(false);
  const [pending,setPending]   = useState(PENDING_APPS);
  const [loans,setLoans]       = useState(LOANS_DATA);
  const [activity,setActivity] = useState(ACTIVITY_LOG);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchNav = (key) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {toValue:0,duration:150,useNativeDriver:true}),
      Animated.timing(slideAnim,{toValue:20,duration:150,useNativeDriver:true}),
    ]).start(()=>{
      setActiveNav(key); setDrawerOpen(false);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, {toValue:1,duration:280,useNativeDriver:true}),
        Animated.timing(slideAnim,{toValue:0,duration:280,useNativeDriver:true}),
      ]).start();
    });
  };

  const renderContent = () => {
    switch(activeNav) {
      case ANAV.DASHBOARD: return <DashboardView pending={pending} members={members} loans={loans} activity={activity} isWide={isWide}/>;
      case ANAV.ACCOUNTS:  return <AccountsView  pending={pending} setPending={setPending} members={members} setMembers={setMembers} setActivity={setActivity} isWide={isWide}/>;
      case ANAV.MEMBERS:   return <MembersView   members={members} isWide={isWide}/>;
      case ANAV.LOANS:     return <LoansAdminView loans={loans} setLoans={setLoans} isWide={isWide}/>;
      case ANAV.REPORTS:   return <ReportsView   members={members} loans={loans} pending={pending}/>;
    }
  };

  return (
    <View style={s.dashRoot}>
      <View style={[s.dashTopbar,{paddingTop:Platform.OS==='web'?0:44}]}>
        <View style={s.dashTopLeft}>
          {!isWide && <TouchableOpacity style={s.menuBtn} onPress={()=>setDrawerOpen(v=>!v)}><Text style={s.menuBtnTxt}>☰</Text></TouchableOpacity>}
          <View style={s.sidebarLogoMark}><Text style={s.sidebarLogoTxt}>CS</Text></View>
          <View><Text style={s.dashTopTitle}>CESLA Cooperative</Text><Text style={s.dashTopSub}>Admin Dashboard</Text></View>
        </View>
        <View style={s.dashTopRight}>
          <View style={s.topAdminBadge}><Text style={s.topAdminTxt}>A</Text></View>
          {isWide && <Text style={s.topAdminName}>Admin System Administrator</Text>}
          <TouchableOpacity style={s.signOutBtn} onPress={onLogout}><Text style={s.signOutTxt}>Sign Out</Text></TouchableOpacity>
        </View>
      </View>
      <View style={s.dashBody}>
        {isWide ? <AdminSidebar active={activeNav} onNav={switchNav} pendingCount={pending.length}/>
          : drawerOpen && (
            <>
              <TouchableOpacity style={s.drawerOverlay} onPress={()=>setDrawerOpen(false)} activeOpacity={1}/>
              <View style={s.drawerSidebar}><AdminSidebar active={activeNav} onNav={switchNav} pendingCount={pending.length}/></View>
            </>
          )}
        <Animated.View style={[s.dashContent,{opacity:fadeAnim,transform:[{translateY:slideAnim}]}]}>
          {renderContent()}
        </Animated.View>
      </View>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── MEMBER LOGIN ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const MemberLogin = ({members,onLogin,onGoRegister,isWide,isSmall}) => {
  const [userId,setUserId] = useState('');
  const [pw,setPw]         = useState('');
  const [showPw,setShowPw] = useState(false);
  const [error,setError]   = useState('');
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(30)).current;
  useEffect(()=>{
    Animated.parallel([
      Animated.timing(fadeIn,{toValue:1,duration:500,useNativeDriver:true}),
      Animated.timing(slideY,{toValue:0,duration:500,useNativeDriver:true}),
    ]).start();
  },[]);

  const handleLogin = () => {
    if (!userId.trim()) { setError('Please enter your User ID.'); return; }
    if (!pw.trim())     { setError('Please enter your password.'); return; }
    const found = members.find(m=>m.userId===userId.trim()&&m.password===pw);
    if (found) { setError(''); onLogin(found); }
    else setError('Invalid User ID or password. Please try again.');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={s.loginOuter} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={[s.loginCard,{opacity:fadeIn,transform:[{translateY:slideY}]}]}>
          <View style={s.loginAvatar}><Text style={{fontSize:30}}>👤</Text></View>
          <Text style={s.loginTitle}>Welcome Back!</Text>
          <Text style={s.loginSubtitle}>Login to access your membership account</Text>
          <View style={s.hintBox}>
            <Text style={s.hintTxt}>
              {'🔑 Use your '}
              <Text style={s.hintBold}>User ID</Text>
              {' (e.g. CESLA-2026-00001) and '}
              <Text style={[s.hintBold,{color:C.gold}]}>Password</Text>
              {' to login.'}
            </Text>
          </View>
          <Field label="USER ID" value={userId} onChangeText={v=>{setUserId(v);setError('');}} placeholder="e.g. CESLA-2026-00001"/>
          <Field label="PASSWORD" value={pw} onChangeText={v=>{setPw(v);setError('');}} placeholder="Enter your password" secureEntry={!showPw} showToggle onToggle={()=>setShowPw(s=>!s)}/>
          {error ? <Text style={s.loginErr}>{error}</Text> : null}
          <TouchableOpacity style={s.loginBtn} onPress={handleLogin} activeOpacity={0.85}>
            <LinearGradient colors={[C.gold,C.goldLight]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.loginBtnGrad}>
              <Text style={s.loginBtnArrow}>→</Text>
              <Text style={s.loginBtnTxt}>LOGIN</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={s.loginFooter}>
            <Text style={s.loginFooterTxt}>Don't have an account? </Text>
            <TouchableOpacity onPress={onGoRegister}><Text style={s.loginFooterLink}>Register as New Member</Text></TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── MEMBER REGISTER ─────────────────────────────────────────────────────────
const MemberRegister = ({members,onGoLogin,onSuccess,isWide}) => {
  const newUid = genUID(members);
  const [name,setName]         = useState('');
  const [pw,setPw]             = useState('');
  const [confirmPw,setConfirmPw] = useState('');
  const [showPw,setShowPw]     = useState(false);
  const [showCPw,setShowCPw]   = useState(false);
  const [errors,setErrors]     = useState({});
  const [copied,setCopied]     = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(30)).current;
  useEffect(()=>{
    Animated.parallel([
      Animated.timing(fadeIn,{toValue:1,duration:500,useNativeDriver:true}),
      Animated.timing(slideY,{toValue:0,duration:500,useNativeDriver:true}),
    ]).start();
  },[]);

  const validate = () => {
    const e = {};
    if (!name.trim())    e.name = 'Full name is required.';
    if (pw.length < 6)   e.pw   = 'Password must be at least 6 characters.';
    if (pw !== confirmPw) e.cpw = 'Passwords do not match.';
    return e;
  };

  const handleCreate = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    const [fn,...rest] = name.trim().split(' ');
    const ln = rest.join(' ') || '';
    onSuccess({ userId:newUid, password:pw, firstName:fn, lastName:ln,
      contact:'', email:'', address:'',
      memberSince:today(), shares:0, savings:0, loan:0, loanBalance:0,
      status:'Pending', appForm:{} });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={s.loginOuter} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={[s.regCard,{opacity:fadeIn,transform:[{translateY:slideY}]}]}>
          <View style={s.regAvatar}><Text style={{fontSize:26}}>👤</Text></View>
          <Text style={s.regTitle}>Create Your Account</Text>
          <Text style={s.regSubtitle}>CLIMBS Membership Portal</Text>
          {/* Step indicator */}
          <View style={s.stepRow}>
            {[{n:1,lbl:'Create\nAccount'},{n:2,lbl:'Admin\nApproval'},{n:3,lbl:'Fill\nApplication'}].map((step,i)=>(
              <React.Fragment key={step.n}>
                <View style={s.stepItem}>
                  <View style={[s.stepCircle,step.n===1&&s.stepCircleActive]}><Text style={[s.stepNum,step.n===1&&s.stepNumActive]}>{step.n}</Text></View>
                  <Text style={[s.stepLbl,step.n===1&&s.stepLblActive]}>{step.lbl}</Text>
                </View>
                {i<2 && <View style={s.stepLine}/>}
              </React.Fragment>
            ))}
          </View>
          <Field label="Full Name" value={name} onChangeText={v=>{setName(v);setErrors(e=>({...e,name:''}))}} placeholder="e.g. Juan Dela Cruz" error={errors.name}/>
          {/* UID box */}
          <View style={s.uidBox}>
            <View style={{flex:1}}>
              <Text style={s.uidLabel}>YOUR USER ID (AUTO-GENERATED)</Text>
              <Text style={s.uidValue}>{newUid}</Text>
            </View>
            <TouchableOpacity style={[s.copyBtn,copied&&s.copyBtnDone]} onPress={()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}}>
              <Text style={s.copyBtnTxt}>{copied?'✓ Copied':'📋 Copy'}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.uidWarning}>
            <Text style={s.uidWarningTxt}>
              {'⚠️ Save your User ID! '}
              <Text style={s.uidWarningBold}>You will use this to </Text>
              <Text style={[s.uidWarningBold,{color:C.gold}]}>log in</Text>
              <Text style={s.uidWarningBold}> after your account is approved by the administrator.</Text>
            </Text>
          </View>
          <Field label="Password" value={pw} onChangeText={v=>{setPw(v);setErrors(e=>({...e,pw:''}))}} placeholder="Create a password (min. 6 characters)" secureEntry={!showPw} showToggle onToggle={()=>setShowPw(s=>!s)} error={errors.pw}/>
          <Field label="Confirm Password" value={confirmPw} onChangeText={v=>{setConfirmPw(v);setErrors(e=>({...e,cpw:''}))}} placeholder="Re-enter your password" secureEntry={!showCPw} showToggle onToggle={()=>setShowCPw(s=>!s)} error={errors.cpw}/>
          <TouchableOpacity style={s.createBtn} onPress={handleCreate} activeOpacity={0.85}>
            <Text style={s.createBtnTxt}>CREATE ACCOUNT</Text>
          </TouchableOpacity>
          <View style={s.loginFooter}>
            <Text style={s.loginFooterTxt}>Already have an account? </Text>
            <TouchableOpacity onPress={onGoLogin}><Text style={s.loginFooterLink}>Login here</Text></TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── MEMBER DASHBOARD ────────────────────────────────────────────────────────
const TIPS = [
  {icon:'💡',title:'Quick Tips',bullets:['Fill out your Application Form to complete your membership.','Monitor your Shares & Savings regularly.','Check Loan Guidelines before applying.'],bg:['#e8720c','#f5a623']},
  {icon:'📋',title:'Application Form',bullets:['Complete all required fields accurately.','Submit supporting documents if needed.','Wait for admin approval before accessing all features.'],bg:['#1a3a6b','#304674']},
  {icon:'💰',title:'Savings Reminder',bullets:['Regular savings strengthen your cooperative standing.','Maintain your minimum required monthly savings.','Contact admin for savings inquiries.'],bg:['#1a6b3a','#27ae60']},
  {icon:'💳',title:'Loan Guidelines',bullets:['Loan amount is based on your share capital.','Ensure timely payments to maintain good standing.','Late payments may incur penalties.'],bg:['#6b1a1a','#c0392b']},
];

const TipsCarousel = ({isWide}) => {
  const [idx,setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const goTo = (i) => {
    Animated.timing(fade,{toValue:0,duration:150,useNativeDriver:true}).start(()=>{
      setIdx(i);
      Animated.timing(fade,{toValue:1,duration:250,useNativeDriver:true}).start();
    });
  };
  useEffect(()=>{ const t=setInterval(()=>goTo((idx+1)%TIPS.length),4000); return ()=>clearInterval(t); },[idx]);
  const tip = TIPS[idx];
  return (
    <View style={s.carouselWrap}>
      <Animated.View style={{opacity:fade,flex:1}}>
        <LinearGradient colors={tip.bg} start={{x:0,y:0}} end={{x:1,y:1}} style={s.tipCard}>
          <Text style={s.tipIcon}>{tip.icon}</Text>
          <Text style={s.tipTitle}>{tip.title}</Text>
          {tip.bullets.map((b,i)=>(
            <View key={i} style={s.tipBulletRow}>
              <Text style={s.tipBulletDot}>•</Text>
              <Text style={s.tipBulletTxt}>{b}</Text>
            </View>
          ))}
        </LinearGradient>
      </Animated.View>
      <View style={s.dotRow}>
        {TIPS.map((_,i)=>(
          <TouchableOpacity key={i} onPress={()=>goTo(i)}>
            <View style={[s.dot,i===idx&&s.dotActive]}/>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const MemberSidebar = ({active,onNav,isWide,onClose}) => {
  const ITEMS = [
    {key:'overview',    label:'OVERVIEW',        section:'__top', icon:'⊞'},
    {key:'profile',     label:'My Profile',      section:'ACCOUNT', icon:'👤'},
    {key:'appform',     label:'Application Form',section:'ACCOUNT', icon:'📋'},
    {key:'savings',     label:'Savings',         section:'SHARES & SAVINGS', icon:'💰'},
    {key:'sharecap',    label:'Share Capital',   section:'SHARES & SAVINGS', icon:'📊'},
    {key:'timedeposit', label:'Time Deposit',    section:'SHARES & SAVINGS', icon:'🏦'},
    {key:'loans',       label:'Loans',           section:'LOANS', icon:'💳'},
    {key:'changepw',    label:'Change Password', section:'SETTINGS', icon:'🔑'},
  ];
  return (
    <View style={s.sidebar}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {['__top','ACCOUNT','SHARES & SAVINGS','LOANS','SETTINGS'].map(sec=>(
          <View key={sec} style={{marginBottom:4}}>
            {sec!=='__top' && <Text style={s.sidebarSec}>{sec}</Text>}
            {ITEMS.filter(i=>i.section===sec).map(item=>(
              <TouchableOpacity key={item.key}
                style={[s.sidebarItem,active===item.key&&s.sidebarItemActive]}
                onPress={()=>{onNav(item.key);if(onClose)onClose();}} activeOpacity={0.8}>
                <Text style={[s.sidebarIcon,active===item.key&&s.sidebarIconActive]}>{item.icon}</Text>
                <Text style={[s.sidebarItemTxt,active===item.key&&s.sidebarItemTxtActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const MemberDashboard = ({member,onLogout,onUpdateMember,isWide}) => {
  const [activeNav,setActiveNav]   = useState('overview');
  const [drawerOpen,setDrawerOpen] = useState(false);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchNav = (key) => {
    Animated.parallel([
      Animated.timing(fadeAnim,{toValue:0,duration:150,useNativeDriver:true}),
      Animated.timing(slideAnim,{toValue:15,duration:150,useNativeDriver:true}),
    ]).start(()=>{
      setActiveNav(key);
      slideAnim.setValue(15);
      Animated.parallel([
        Animated.timing(fadeAnim,{toValue:1,duration:250,useNativeDriver:true}),
        Animated.timing(slideAnim,{toValue:0,duration:250,useNativeDriver:true}),
      ]).start();
    });
  };

  const fullName = `${member.firstName} ${member.lastName}`.trim();
  const initials = fullName.split(' ').map(w=>w[0]).slice(0,2).join('');

  const renderContent = () => {
    switch(activeNav) {
      case 'overview': return <TipsCarousel isWide={isWide}/>;
      case 'profile':  return (
        <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
          <Text style={s.pageTitle}>My Profile</Text>
          <View style={s.profileHead}>
            <View style={s.profileAvatar}><Text style={s.profileAvatarTxt}>{initials}</Text></View>
            <View>
              <Text style={s.profileName}>{fullName}</Text>
              <Text style={s.profileId}>{member.userId}</Text>
              <View style={[s.statusBadge,member.status==='Active'?s.statusActive:s.statusPending]}><Text style={s.statusTxt}>{member.status}</Text></View>
            </View>
          </View>
          <View style={s.infoSection}>
            <Text style={s.infoSectionTitle}>Personal Information</Text>
            {[['Contact',member.contact||'—'],['Email',member.email||'—'],['Address',member.address||'—'],['Member Since',member.memberSince]].map(([l,v])=>(
              <View key={l} style={s.infoRow}><Text style={s.infoLabel}>{l}</Text><Text style={s.infoVal}>{v}</Text></View>
            ))}
          </View>
          <View style={s.infoSection}>
            <Text style={s.infoSectionTitle}>Financial Overview</Text>
            {[['Share Capital',fmtCur(member.shares),C.gold],['Savings',fmtCur(member.savings),C.green],['Active Loan',fmtCur(member.loan),C.orange],['Loan Balance',fmtCur(member.loanBalance),member.loanBalance>0?C.red:C.green]].map(([l,v,c])=>(
              <View key={l} style={s.infoRow}><Text style={s.infoLabel}>{l}</Text><Text style={[s.infoVal,{color:c}]}>{v}</Text></View>
            ))}
          </View>
        </ScrollView>
      );
      case 'appform': return (
        <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
          <Text style={s.pageTitle}>Application Form</Text>
          <Text style={s.pageSub}>Complete your membership application.</Text>
          <View style={s.formCard}>
            <Text style={s.formSection}>Employment Details</Text>
            {[['Occupation','e.g. Teacher'],['Employer / Company','e.g. DepEd']].map(([l,ph])=>(
              <View key={l} style={s.fieldWrap}><Text style={s.fieldLabel}>{l}</Text>
              <View style={s.fieldRow}><TextInput style={s.fieldInput} placeholder={ph} placeholderTextColor={C.textMuted} defaultValue={member.appForm?.[l.toLowerCase()]||''}/></View></View>
            ))}
            <Text style={[s.formSection,{marginTop:16}]}>Beneficiary</Text>
            {[['Beneficiary Name','e.g. Maria Santos'],['Relationship','e.g. Spouse']].map(([l,ph])=>(
              <View key={l} style={s.fieldWrap}><Text style={s.fieldLabel}>{l}</Text>
              <View style={s.fieldRow}><TextInput style={s.fieldInput} placeholder={ph} placeholderTextColor={C.textMuted}/></View></View>
            ))}
            <TouchableOpacity style={s.saveBtn}><Text style={s.saveBtnTxt}>Submit Application</Text></TouchableOpacity>
          </View>
        </ScrollView>
      );
      case 'savings': return (
        <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
          <Text style={s.pageTitle}>Savings</Text>
          <View style={[s.financeHeroCard,{borderTopColor:C.green,borderTopWidth:4}]}>
            <Text style={{fontSize:32,marginBottom:8}}>💰</Text>
            <Text style={[s.financeHeroAmt,{color:C.green}]}>{fmtCur(member.savings)}</Text>
            <Text style={s.financeHeroLabel}>Total Savings Balance</Text>
          </View>
          <View style={s.emptyCard}><Text style={s.emptyTxt}>No transactions yet.</Text></View>
        </ScrollView>
      );
      case 'sharecap': return (
        <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
          <Text style={s.pageTitle}>Share Capital</Text>
          <View style={[s.financeHeroCard,{borderTopColor:C.gold,borderTopWidth:4}]}>
            <Text style={{fontSize:32,marginBottom:8}}>📊</Text>
            <Text style={[s.financeHeroAmt,{color:C.gold}]}>{fmtCur(member.shares)}</Text>
            <Text style={s.financeHeroLabel}>Total Share Capital</Text>
          </View>
          <View style={s.emptyCard}><Text style={s.emptyTxt}>No transactions yet.</Text></View>
        </ScrollView>
      );
      case 'timedeposit': return (
        <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
          <Text style={s.pageTitle}>Time Deposit</Text>
          <View style={[s.financeHeroCard,{borderTopColor:C.blue,borderTopWidth:4}]}>
            <Text style={{fontSize:32,marginBottom:8}}>🏦</Text>
            <Text style={[s.financeHeroAmt,{color:C.blue}]}>{fmtCur(0)}</Text>
            <Text style={s.financeHeroLabel}>Time Deposit Balance</Text>
          </View>
          <View style={s.emptyCard}><Text style={s.emptyTxt}>No time deposits yet.</Text></View>
        </ScrollView>
      );
      case 'memberloans': return (
        <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
          <Text style={s.pageTitle}>View Member Loans</Text>
          <Text style={s.pageSub}>Your active and previous loan records.</Text>
          {member.loan===0 ? (
            <View style={s.emptyCard}><Text style={{fontSize:36,marginBottom:10}}>📋</Text><Text style={s.emptyTxt}>No active loans.</Text></View>
          ) : (
            <View style={s.loanCard}>
              {[['Total Loan',fmtCur(member.loan),C.orange],['Remaining Balance',fmtCur(member.loanBalance),C.red],['Amount Paid',fmtCur(member.loan-member.loanBalance),C.green]].map(([l,v,c])=>(
                <View key={l} style={s.loanDetailRow}><Text style={s.loanAmtLabel}>{l}</Text><Text style={[s.loanAmtVal,{color:c}]}>{v}</Text></View>
              ))}
              <View style={{marginTop:12}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:5}}>
                  <Text style={s.loanAmtLabel}>Repayment Progress</Text>
                  <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:12,color:C.green}}>{Math.round(((member.loan-member.loanBalance)/member.loan)*100)}%</Text>
                </View>
                <View style={s.progressTrack}><View style={[s.progressFill,{width:`${Math.round(((member.loan-member.loanBalance)/member.loan)*100)}%`}]}/></View>
              </View>
            </View>
          )}
        </ScrollView>
      );
      case 'loantransactions': return (
        <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
          <Text style={s.pageTitle}>Loan Transactions</Text>
          <Text style={s.pageSub}>History of all your loan payments and disbursements.</Text>
          {member.loan===0 ? (
            <View style={s.emptyCard}><Text style={{fontSize:36,marginBottom:10}}>🔄</Text><Text style={s.emptyTxt}>No loan transactions yet.</Text></View>
          ) : (
            <View style={s.detailSection}>
              <Text style={s.detailSectionTitle}>💳  Payment History</Text>
              {[
                {date:'2026-01-01',amount:2000,note:'Monthly payment'},
                {date:'2026-02-01',amount:2000,note:'Monthly payment'},
                {date:'2026-03-01',amount:2000,note:'Monthly payment'},
              ].reverse().map((tx,i)=>(
                <View key={i} style={s.txRow}>
                  <View style={[s.txDot,{backgroundColor:C.green}]}/>
                  <View style={{flex:1}}>
                    <Text style={s.txAmt}>{fmtCur(tx.amount)}</Text>
                    <Text style={s.txMeta}>{tx.date}  •  {tx.note}</Text>
                  </View>
                  <View style={[s.statusBadge,s.statusActive]}><Text style={s.statusTxt}>PAID</Text></View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      );
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
          <ScrollView contentContainerStyle={s.pageOuter} showsVerticalScrollIndicator={false}>
            <Text style={s.pageTitle}>Change Password</Text>
            <View style={s.formCard}>
              {[['Current Password'],['New Password'],['Confirm New Password']].map(([l])=>(
                <View key={l} style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>{l}</Text>
                  <View style={s.fieldRow}><TextInput style={s.fieldInput} secureTextEntry placeholder="••••••••" placeholderTextColor={C.textMuted}/></View>
                </View>
              ))}
              <TouchableOpacity style={s.saveBtn}><Text style={s.saveBtnTxt}>Update Password</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      );
      default: return <TipsCarousel isWide={isWide}/>;
    }
  };

  return (
    <View style={s.dashRoot}>
      <View style={[s.dashTopbar,{paddingTop:Platform.OS==='web'?0:44}]}>
        <View style={s.dashTopLeft}>
          {!isWide && <TouchableOpacity style={s.menuBtn} onPress={()=>setDrawerOpen(v=>!v)}><Text style={s.menuBtnTxt}>☰</Text></TouchableOpacity>}
          <View style={s.sidebarLogoMark}><Text style={s.sidebarLogoTxt}>CS</Text></View>
          <View><Text style={s.dashTopTitle}>Member Dashboard</Text><Text style={s.dashTopSub}>CLIMBS Membership Portal</Text></View>
        </View>
        <View style={s.dashTopRight}>
          <View style={s.topAdminBadge}><Text style={s.topAdminTxt}>{initials}</Text></View>
          {isWide && <Text style={s.topAdminName}>{fullName}</Text>}
          <TouchableOpacity style={s.logoutBtn} onPress={onLogout}><Text style={s.logoutTxt}>Logout</Text></TouchableOpacity>
        </View>
      </View>
      <View style={s.dashBody}>
        {isWide ? <MemberSidebar active={activeNav} onNav={switchNav} isWide={isWide}/>
          : drawerOpen && (
            <>
              <TouchableOpacity style={s.drawerOverlay} onPress={()=>setDrawerOpen(false)} activeOpacity={1}/>
              <View style={s.drawerSidebar}><MemberSidebar active={activeNav} onNav={switchNav} isWide={isWide} onClose={()=>setDrawerOpen(false)}/></View>
            </>
          )}
        <Animated.View style={[s.dashContent,{opacity:fadeAnim,transform:[{translateY:slideAnim}]}]}>
          {renderContent()}
        </Animated.View>
      </View>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export default function CoopScreen({ navigation }) {
  const { width }  = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, NotoSerif_700Bold_Italic,
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const [view,       setView]       = useState(V.ROLE_SELECT);
  const [members,    setMembers]    = useState(INIT_MEMBERS);
  const [activeMember, setActiveMember] = useState(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const transitionTo = (nextView, extra) => {
    Animated.timing(fadeAnim,{toValue:0,duration:180,useNativeDriver:true}).start(()=>{
      if (extra?.member) setActiveMember(extra.member);
      setView(nextView);
      Animated.timing(fadeAnim,{toValue:1,duration:300,useNativeDriver:true}).start();
    });
  };

  // Header titles
  const HEADER = {
    [V.ROLE_SELECT]:     { title:'Multi-Purpose Cooperative', gold:'CESLA', sub:'CESLA MPC  •  MEMBER & ADMIN PORTAL' },
    [V.ADMIN_PIN]:       { title:'Admin Access',              gold:null,    sub:'ADMINISTRATOR LOGIN' },
    [V.MEMBER_LOGIN]:    { title:'Member Login',              gold:null,    sub:'CESLA MULTI-PURPOSE COOPERATIVE' },
    [V.MEMBER_REGISTER]: { title:'Register as New Member',    gold:null,    sub:null },
  };

  const showHeader = ![V.ADMIN_DASH, V.MEMBER_DASH].includes(view);
  const h = HEADER[view] || {};

  const renderView = () => {
    switch(view) {
      case V.ROLE_SELECT:
        return <RoleSelect
          onSelectAdmin={()=>transitionTo(V.ADMIN_PIN)}
          onSelectMember={()=>transitionTo(V.MEMBER_LOGIN)}
          isWide={isWide}/>;
      case V.ADMIN_PIN:
        return <AdminPinLogin onSuccess={()=>transitionTo(V.ADMIN_DASH)} isWide={isWide}/>;
      case V.ADMIN_DASH:
        return <AdminDashboard members={members} setMembers={setMembers}
          onLogout={()=>transitionTo(V.ROLE_SELECT)} isWide={isWide} isSmall={isSmall}/>;
      case V.MEMBER_LOGIN:
        return <MemberLogin members={members} onLogin={(m)=>transitionTo(V.MEMBER_DASH,{member:m})}
          onGoRegister={()=>transitionTo(V.MEMBER_REGISTER)} isWide={isWide} isSmall={isSmall}/>;
      case V.MEMBER_REGISTER:
        return <MemberRegister members={members}
          onGoLogin={()=>transitionTo(V.MEMBER_LOGIN)}
          onSuccess={(nm)=>{ setMembers(p=>[...p,nm]); transitionTo(V.MEMBER_LOGIN); }}
          isWide={isWide}/>;
      case V.MEMBER_DASH:
        return <MemberDashboard member={activeMember}
          onLogout={()=>transitionTo(V.ROLE_SELECT)}
          onUpdateMember={(um)=>{setActiveMember(um);setMembers(p=>p.map(m=>m.userId===um.userId?um:m));}}
          isWide={isWide}/>;
    }
  };

  return (
    <View style={{flex:1}}>
      <AppBg/>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>
      {showHeader && (
        <HeaderBar
          title={h.title} titleGold={h.gold} subtitle={h.sub}
          onBack={view===V.ROLE_SELECT
            ? (navigation?()=>navigation.goBack():null)
            : ()=>transitionTo(view===V.ADMIN_PIN||view===V.MEMBER_LOGIN?V.ROLE_SELECT:V.MEMBER_LOGIN)}
          isWide={isWide} isSmall={isSmall}
        />
      )}
      <Animated.View style={{flex:1,opacity:fadeAnim}}>
        {renderView()}
      </Animated.View>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // HEADER
  header:{ flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#1a2d4e',borderBottomWidth:2,borderColor:C.gold,paddingBottom:10 },
  backBtn:{ width:36,height:36,borderRadius:18,backgroundColor:'rgba(255,255,255,0.15)',borderWidth:1,borderColor:'rgba(255,255,255,0.30)',justifyContent:'center',alignItems:'center' },
  backIcon:{ color:'#fff',fontSize:16,fontWeight:'600' },
  headerCenter:{ flex:1,alignItems:'center' },
  headerTitle:{ fontFamily:'NotoSerif_700Bold',color:'#fff',textAlign:'center',letterSpacing:0.4 },
  headerGold:{ color:C.gold },
  headerSub:{ fontFamily:'GoogleSans_400Regular',color:C.gold,letterSpacing:2.5,textTransform:'uppercase',marginTop:2 },

  // ROLE SELECT
  roleOuter:{ flex:1,justifyContent:'center',alignItems:'center',paddingVertical:30,paddingHorizontal:20 },
  roleTitle:{ fontFamily:'NotoSerif_700Bold',fontSize:24,color:'#011f4b',marginBottom:6,letterSpacing:0.5 },
  roleSub:{ fontFamily:'GoogleSans_400Regular',fontSize:14,color:'rgba(255,255,255,0.88)',marginBottom:30 },
  roleRow:{ gap:20,width:'100%',maxWidth:620,alignItems:'center' },
  roleCard:{ borderRadius:22,shadowColor:'#011f4b',shadowOpacity:0.14,shadowRadius:20,shadowOffset:{width:0,height:4},elevation:5,overflow:'hidden' },
  roleCardInner:{ borderRadius:22,paddingTop:40,paddingBottom:30,paddingHorizontal:24,alignItems:'center',gap:14,borderWidth:1.5,borderColor:'rgba(255,255,255,0.55)' },
  roleIconCircle:{ width:88,height:88,borderRadius:44,backgroundColor:'rgba(255,255,255,0.28)',borderWidth:1.5,justifyContent:'center',alignItems:'center' },
  roleLabel:{ fontFamily:'NotoSerif_700Bold',fontSize:18,color:'#011f4b',letterSpacing:1 },
  roleDesc:{ fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(3,57,108,0.70)',textAlign:'center',lineHeight:18 },
  roleArrow:{ width:34,height:34,borderRadius:17,borderWidth:1,justifyContent:'center',alignItems:'center' },
  roleAccentLine:{ position:'absolute',bottom:0,width:'60%',height:2.5,borderRadius:2,alignSelf:'center' },

  // PIN LOGIN
  pinOuter:{ flex:1,justifyContent:'center',alignItems:'center',paddingVertical:20 },
  pinCard:{ width:'100%',maxWidth:340,borderRadius:24,shadowColor:'#011f4b',shadowOpacity:0.20,shadowRadius:24,shadowOffset:{width:0,height:6},overflow:'hidden' },
  pinCardInner:{ borderRadius:24,padding:32,borderWidth:1.5,borderColor:'rgba(255,255,255,0.55)',alignItems:'center',backgroundColor:'rgba(255,255,255,0.18)' },
  pinIconWrap:{ width:72,height:72,borderRadius:36,backgroundColor:'rgba(255,255,255,0.45)',borderWidth:1.5,borderColor:'rgba(255,255,255,0.70)',justifyContent:'center',alignItems:'center',marginBottom:18,alignSelf:'center' },
  pinTitle:{ fontFamily:'NotoSerif_700Bold',fontSize:22,color:C.navy,marginBottom:6,textAlign:'center' },
  pinSub:{ fontFamily:'GoogleSans_400Regular',fontSize:13,color:'rgba(1,31,75,0.65)',textAlign:'center',marginBottom:24 },
  pinDots:{ flexDirection:'row',gap:16,marginBottom:6,alignSelf:'center' },
  pinDot:{ width:16,height:16,borderRadius:8,backgroundColor:'rgba(255,255,255,0.45)',borderWidth:2,borderColor:'rgba(1,31,75,0.25)' },
  pinDotOn:{ backgroundColor:'#1a3a6b',borderColor:'#1a3a6b' },
  pinErr:{ fontFamily:'GoogleSans_400Regular',fontSize:12,color:C.red,textAlign:'center',marginBottom:8 },
  numpad:{ flexDirection:'row',flexWrap:'wrap',width:216,gap:12,marginTop:16,justifyContent:'center' },
  numKey:{ width:60,height:60,borderRadius:30,backgroundColor:'rgba(255,255,255,0.45)',borderWidth:1.5,borderColor:'rgba(255,255,255,0.70)',justifyContent:'center',alignItems:'center' },
  numKeyDel:{ backgroundColor:'rgba(231,76,60,0.15)',borderColor:'rgba(231,76,60,0.40)' },
  numKeyTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:20,color:C.navy },
  numKeyDelTxt:{ color:C.red },

  // MEMBER LOGIN / REGISTER
  loginOuter:{ flexGrow:1,justifyContent:'center',alignItems:'center',paddingVertical:30,paddingHorizontal:16 },
  loginCard:{ width:'100%',maxWidth:440,borderRadius:20,backgroundColor:'rgba(255,255,255,0.20)',borderWidth:1.5,borderColor:'rgba(255,255,255,0.55)',padding:28,shadowColor:'#011f4b',shadowOpacity:0.18,shadowRadius:24,shadowOffset:{width:0,height:6} },
  loginAvatar:{ width:70,height:70,borderRadius:35,backgroundColor:'rgba(201,168,76,0.25)',borderWidth:2,borderColor:'rgba(201,168,76,0.50)',justifyContent:'center',alignItems:'center',alignSelf:'center',marginBottom:18 },
  loginTitle:{ fontFamily:'NotoSerif_700Bold',fontSize:22,color:C.navy,textAlign:'center',marginBottom:5 },
  loginSubtitle:{ fontFamily:'GoogleSans_400Regular',fontSize:13,color:C.textMuted,textAlign:'center',marginBottom:18 },
  hintBox:{ backgroundColor:'rgba(201,168,76,0.15)',borderRadius:10,borderWidth:1,borderColor:'rgba(201,168,76,0.35)',padding:12,marginBottom:18 },
  hintTxt:{ fontFamily:'GoogleSans_400Regular',fontSize:12,color:C.textMain,lineHeight:18 },
  hintBold:{ fontFamily:'GoogleSans_700Bold',fontSize:12,color:C.navy },
  loginErr:{ fontFamily:'GoogleSans_400Regular',fontSize:12,color:C.red,textAlign:'center',marginBottom:8 },
  loginBtn:{ borderRadius:28,overflow:'hidden',marginTop:14,marginBottom:10,shadowColor:C.gold,shadowOpacity:0.35,shadowRadius:10,shadowOffset:{width:0,height:3} },
  loginBtnGrad:{ flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:14,gap:10 },
  loginBtnArrow:{ fontSize:18,color:C.navy,fontWeight:'700' },
  loginBtnTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:15,color:C.navy,letterSpacing:2 },
  loginFooter:{ flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop:6 },
  loginFooterTxt:{ fontFamily:'GoogleSans_400Regular',fontSize:12,color:C.textMuted },
  loginFooterLink:{ fontFamily:'GoogleSans_700Bold',fontSize:12,color:C.gold },

  regCard:{ width:'100%',maxWidth:460,borderRadius:20,backgroundColor:'#ffffff',borderWidth:1.5,borderColor:'rgba(255,255,255,0.80)',padding:28,shadowColor:'#011f4b',shadowOpacity:0.20,shadowRadius:24,shadowOffset:{width:0,height:6} },
  regAvatar:{ width:64,height:64,borderRadius:32,backgroundColor:C.navyDeep,justifyContent:'center',alignItems:'center',alignSelf:'center',marginBottom:14 },
  regTitle:{ fontFamily:'NotoSerif_700Bold',fontSize:20,color:C.navy,textAlign:'center',marginBottom:4 },
  regSubtitle:{ fontFamily:'GoogleSans_400Regular',fontSize:12,color:C.textMuted,textAlign:'center',marginBottom:20 },
  stepRow:{ flexDirection:'row',alignItems:'flex-start',justifyContent:'center',marginBottom:22,gap:0 },
  stepItem:{ alignItems:'center',width:70 },
  stepCircle:{ width:28,height:28,borderRadius:14,backgroundColor:'#e5e8ee',justifyContent:'center',alignItems:'center',marginBottom:4 },
  stepCircleActive:{ backgroundColor:C.gold },
  stepNum:{ fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#aaa' },
  stepNumActive:{ color:C.navy },
  stepLbl:{ fontFamily:'GoogleSans_400Regular',fontSize:9,color:'#aaa',textAlign:'center',lineHeight:13 },
  stepLblActive:{ color:C.navy,fontFamily:'GoogleSans_700Bold' },
  stepLine:{ width:32,height:1,backgroundColor:'#ddd',marginTop:13 },
  uidBox:{ flexDirection:'row',alignItems:'center',backgroundColor:C.navyDeep,borderRadius:10,padding:14,marginBottom:10,gap:12 },
  uidLabel:{ fontFamily:'GoogleSans_700Bold',fontSize:8,color:'rgba(255,255,255,0.55)',letterSpacing:1.5,marginBottom:4 },
  uidValue:{ fontFamily:'GoogleSans_700Bold',fontSize:18,color:C.gold,letterSpacing:1 },
  copyBtn:{ backgroundColor:C.navyMid,borderRadius:8,paddingHorizontal:12,paddingVertical:8,borderWidth:1,borderColor:'rgba(255,255,255,0.20)' },
  copyBtnDone:{ backgroundColor:'rgba(46,204,113,0.30)',borderColor:C.green },
  copyBtnTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:11,color:C.gold },
  uidWarning:{ backgroundColor:'rgba(201,168,76,0.10)',borderRadius:10,borderWidth:1,borderColor:'rgba(201,168,76,0.30)',padding:12,marginBottom:14 },
  uidWarningTxt:{ fontFamily:'GoogleSans_400Regular',fontSize:11,color:C.textMain,lineHeight:17 },
  uidWarningBold:{ fontFamily:'GoogleSans_700Bold',fontSize:11,color:C.textMain },
  createBtn:{ backgroundColor:C.navyDeep,borderRadius:10,paddingVertical:14,alignItems:'center',marginTop:14,marginBottom:10,shadowColor:C.navy,shadowOpacity:0.25,shadowRadius:8,shadowOffset:{width:0,height:3} },
  createBtnTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:14,color:'#fff',letterSpacing:2 },

  // FIELDS
  fieldWrap:{ marginBottom:14 },
  fieldLabel:{ fontFamily:'GoogleSans_700Bold',fontSize:10,color:C.textMuted,letterSpacing:1.5,textTransform:'uppercase',marginBottom:5 },
  fieldRow:{ flexDirection:'row',alignItems:'center',backgroundColor:'rgba(240,245,250,0.90)',borderRadius:10,paddingHorizontal:14,paddingVertical:12,borderWidth:1.5,borderColor:'rgba(200,215,230,0.80)' },
  fieldRowDisabled:{ backgroundColor:'rgba(220,230,240,0.60)',borderColor:'rgba(200,215,230,0.40)' },
  fieldRowError:{ borderColor:C.red },
  fieldInput:{ flex:1,fontFamily:'GoogleSans_400Regular',fontSize:13,color:C.navy },
  fieldErr:{ fontFamily:'GoogleSans_400Regular',fontSize:10,color:C.red,marginTop:3 },

  // DASHBOARD SHELL
  dashRoot:{ flex:1 },
  dashTopbar:{ flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'rgba(15,30,53,0.95)',paddingHorizontal:16,paddingBottom:10,borderBottomWidth:2,borderColor:C.gold,gap:12 },
  dashTopLeft:{ flexDirection:'row',alignItems:'center',gap:10 },
  dashTopRight:{ flexDirection:'row',alignItems:'center',gap:10 },
  dashTopTitle:{ fontFamily:'GoogleSans_700Bold',fontSize:14,color:'#fff' },
  dashTopSub:{ fontFamily:'GoogleSans_400Regular',fontSize:10,color:C.gold },
  topAdminBadge:{ width:30,height:30,borderRadius:15,backgroundColor:'rgba(201,168,76,0.30)',borderWidth:1.5,borderColor:C.gold,justifyContent:'center',alignItems:'center' },
  topAdminTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:10,color:C.gold },
  topAdminName:{ fontFamily:'GoogleSans_500Medium',fontSize:13,color:'rgba(255,255,255,0.85)' },
  signOutBtn:{ paddingHorizontal:14,paddingVertical:6,borderRadius:8,backgroundColor:'rgba(231,76,60,0.18)',borderWidth:1.5,borderColor:'rgba(231,76,60,0.50)' },
  signOutTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:12,color:C.red },
  logoutBtn:{ paddingHorizontal:14,paddingVertical:6,borderRadius:8,backgroundColor:'rgba(201,168,76,0.15)',borderWidth:1.5,borderColor:'rgba(201,168,76,0.50)' },
  logoutTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:12,color:C.gold },
  menuBtn:{ width:34,height:34,borderRadius:8,backgroundColor:'rgba(255,255,255,0.12)',justifyContent:'center',alignItems:'center' },
  menuBtnTxt:{ color:'#fff',fontSize:18 },
  dashBody:{ flex:1,flexDirection:'row' },
  dashContent:{ flex:1 },

  // SIDEBAR
  sidebar:{ width:160,backgroundColor:'rgba(15,30,53,0.95)',borderRightWidth:1,borderColor:'rgba(255,255,255,0.10)',paddingTop:10 },
  sidebarLogo:{ flexDirection:'row',alignItems:'center',gap:10,padding:16,borderBottomWidth:1,borderColor:'rgba(255,255,255,0.10)' },
  sidebarLogoMark:{ width:32,height:32,borderRadius:7,backgroundColor:C.gold,justifyContent:'center',alignItems:'center' },
  sidebarLogoTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:13,color:C.navyDark,fontWeight:'800' },
  sidebarLogoName:{ fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#fff' },
  sidebarSec:{ fontFamily:'GoogleSans_700Bold',fontSize:8,color:'rgba(255,255,255,0.30)',letterSpacing:2,textTransform:'uppercase',paddingHorizontal:12,paddingTop:14,paddingBottom:4 },
  sidebarItem:{ flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:8,paddingVertical:9,paddingHorizontal:10,borderRadius:8,marginBottom:1 },
  sidebarItemActive:{ backgroundColor:C.gold },
  sidebarIcon:{ fontSize:13,color:'rgba(255,255,255,0.50)',width:16,textAlign:'center' },
  sidebarIconActive:{ color:C.navyDark },
  sidebarItemTxt:{ fontFamily:'GoogleSans_500Medium',fontSize:11,color:'rgba(255,255,255,0.65)',flex:1 },
  sidebarItemTxtActive:{ fontFamily:'GoogleSans_700Bold',color:C.navyDark },
  sidebarBadge:{ marginLeft:'auto',backgroundColor:C.orange,width:18,height:18,borderRadius:9,justifyContent:'center',alignItems:'center' },
  sidebarBadgeTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#fff' },
  drawerOverlay:{ ...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.45)',zIndex:10 },
  drawerSidebar:{ position:'absolute',top:0,left:0,bottom:0,width:170,zIndex:11 },

  // PAGE CONTENT
  pageOuter:{ padding:18,paddingBottom:40 },
  pageTitle:{ fontFamily:'NotoSerif_700Bold',fontSize:20,color:C.navy,marginBottom:4 },
  pageSub:{ fontFamily:'GoogleSans_400Regular',fontSize:12,color:C.textMuted,marginBottom:18,lineHeight:18 },
  emptyTxt:{ fontFamily:'GoogleSans_400Regular',fontSize:13,color:C.textMuted,textAlign:'center',padding:24 },
  breadcrumb:{ marginBottom:16 },
  breadcrumbTxt:{ fontFamily:'GoogleSans_500Medium',fontSize:13,color:C.blue },

  // STAT CARDS
  statRow:{ gap:12,marginBottom:22 },
  statCard:{ flex:1,backgroundColor:'rgba(255,255,255,0.22)',borderRadius:14,padding:18,borderWidth:1.5,borderColor:'rgba(255,255,255,0.45)',shadowColor:'#011f4b',shadowOpacity:0.10,shadowRadius:12,shadowOffset:{width:0,height:3} },
  statTop:{ flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start' },
  statLabel:{ fontFamily:'GoogleSans_700Bold',fontSize:9,color:C.textMuted,letterSpacing:2,textTransform:'uppercase',marginBottom:6 },
  statValue:{ fontFamily:'NotoSerif_700Bold',fontSize:32,color:C.navy,lineHeight:36 },
  statSub:{ fontFamily:'GoogleSans_400Regular',fontSize:11,color:C.textMuted,marginTop:3 },
  statIcon:{ fontSize:22,opacity:0.8 },

  // ACTIVITY
  actCard:{ backgroundColor:'rgba(255,255,255,0.22)',borderRadius:14,padding:18,borderWidth:1.5,borderColor:'rgba(255,255,255,0.45)' },
  actHeader:{ flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14 },
  actTitle:{ fontFamily:'GoogleSans_700Bold',fontSize:14,color:C.navy },
  actMeta:{ fontFamily:'GoogleSans_400Regular',fontSize:11,color:C.textMuted },
  actRow:{ flexDirection:'row',alignItems:'flex-start',gap:12,paddingVertical:10,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.07)' },
  actDot:{ width:9,height:9,borderRadius:5,marginTop:4 },
  actTxt:{ fontFamily:'GoogleSans_500Medium',fontSize:13,color:C.navy },
  actTime:{ fontFamily:'GoogleSans_400Regular',fontSize:11,color:C.textMuted,marginTop:2 },

  // ACCOUNT MANAGEMENT
  appCard:{ backgroundColor:'rgba(255,255,255,0.22)',borderRadius:14,padding:18,borderWidth:1.5,borderColor:'rgba(255,255,255,0.45)',marginBottom:16 },
  appHead:{ flexDirection:'row',alignItems:'center',gap:14,marginBottom:14 },
  appAvatar:{ width:44,height:44,borderRadius:22,backgroundColor:C.navy,borderWidth:2,borderColor:C.gold,justifyContent:'center',alignItems:'center' },
  appAvatarTxt:{ fontFamily:'NotoSerif_700Bold',fontSize:16,color:'#fff' },
  appName:{ fontFamily:'GoogleSans_700Bold',fontSize:15,color:C.navy },
  appId:{ fontFamily:'GoogleSans_400Regular',fontSize:11,color:C.textMuted,marginTop:2 },
  pendingBadge:{ backgroundColor:'rgba(245,166,35,0.20)',paddingHorizontal:10,paddingVertical:4,borderRadius:20,borderWidth:1,borderColor:'rgba(245,166,35,0.55)' },
  pendingBadgeTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:9,color:C.orange,letterSpacing:1.5 },
  appDetails:{ gap:8,marginBottom:16 },
  appDetailItem:{ flex:1,minWidth:140 },
  appDetailLabel:{ fontFamily:'GoogleSans_400Regular',fontSize:10,color:C.textMuted,textTransform:'uppercase',letterSpacing:0.5,marginBottom:2 },
  appDetailVal:{ fontFamily:'GoogleSans_500Medium',fontSize:13,color:C.navy },
  appActions:{ flexDirection:'row',gap:12 },
  rejectBtn:{ flex:1,paddingVertical:11,borderRadius:10,alignItems:'center',backgroundColor:'rgba(231,76,60,0.12)',borderWidth:1.5,borderColor:'rgba(231,76,60,0.40)' },
  rejectBtnTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:13,color:C.red },
  approveBtn:{ flex:2,borderRadius:10,overflow:'hidden' },
  approveBtnGrad:{ paddingVertical:12,alignItems:'center' },
  approveBtnTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#fff' },
  emptyCard:{ backgroundColor:'rgba(255,255,255,0.22)',borderRadius:14,padding:40,alignItems:'center',borderWidth:1.5,borderColor:'rgba(255,255,255,0.45)' },
  emptyCardTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:16,color:C.navy,marginBottom:4 },

  // MEMBERS TABLE
  searchRow:{ flexDirection:'row',alignItems:'center',gap:12,marginBottom:14 },
  searchBox:{ flex:1,flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.70)',borderRadius:20,paddingHorizontal:14,paddingVertical:8,borderWidth:1,borderColor:'rgba(255,255,255,0.85)' },
  searchInput:{ flex:1,fontFamily:'GoogleSans_400Regular',fontSize:13,color:C.navy },
  countTxt:{ fontFamily:'GoogleSans_500Medium',fontSize:11,color:C.textMuted },
  tableHead:{ flexDirection:'row',paddingHorizontal:14,paddingBottom:8,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.12)',marginBottom:4 },
  tableHeadCell:{ flex:1,fontFamily:'GoogleSans_700Bold',fontSize:9,color:C.textMuted,letterSpacing:2,textTransform:'uppercase' },
  memberRow:{ flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:12,borderRadius:10,marginBottom:2,gap:8 },
  memberRowAlt:{ backgroundColor:'rgba(255,255,255,0.18)' },
  memberCell:{ flex:1,fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(1,31,75,0.75)' },
  cellMono:{ fontFamily:'GoogleSans_500Medium',fontSize:11 },
  statusBadge:{ paddingHorizontal:8,paddingVertical:3,borderRadius:20,alignSelf:'flex-start' },
  statusActive:{ backgroundColor:'rgba(46,204,113,0.22)',borderWidth:1,borderColor:'rgba(46,204,113,0.55)' },
  statusInactive:{ backgroundColor:'rgba(231,76,60,0.18)',borderWidth:1,borderColor:'rgba(231,76,60,0.45)' },
  statusPaid:{ backgroundColor:'rgba(111,163,247,0.22)',borderWidth:1,borderColor:'rgba(111,163,247,0.55)' },
  statusPending:{ backgroundColor:'rgba(245,166,35,0.18)',borderWidth:1,borderColor:'rgba(245,166,35,0.45)' },
  statusTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:9,color:'#fff',letterSpacing:1 },
  viewBtn:{ width:60,paddingVertical:5,borderRadius:8,backgroundColor:'rgba(26,58,107,0.18)',borderWidth:1,borderColor:'rgba(26,58,107,0.30)',alignItems:'center' },
  viewBtnTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#1a3a6b' },

  // DETAIL
  detailHead:{ flexDirection:'row',alignItems:'center',gap:16,marginBottom:22,paddingBottom:18,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.10)' },
  detailAvatar:{ width:64,height:64,borderRadius:32,backgroundColor:C.navy,borderWidth:2.5,borderColor:C.gold,justifyContent:'center',alignItems:'center' },
  detailAvatarTxt:{ fontFamily:'NotoSerif_700Bold',fontSize:20,color:'#fff' },
  detailName:{ fontFamily:'NotoSerif_700Bold',fontSize:19,color:C.navy },
  detailId:{ fontFamily:'GoogleSans_500Medium',fontSize:11,color:C.textMuted,marginTop:2 },
  detailSection:{ backgroundColor:'rgba(255,255,255,0.22)',borderRadius:14,padding:16,borderWidth:1.5,borderColor:'rgba(255,255,255,0.45)',marginBottom:16 },
  detailSectionTitle:{ fontFamily:'GoogleSans_700Bold',fontSize:11,color:C.textMuted,letterSpacing:2.5,textTransform:'uppercase',marginBottom:12,paddingBottom:6,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.08)' },
  detailRow:{ flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:7,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.06)' },
  detailRowL:{ fontFamily:'GoogleSans_400Regular',fontSize:12,color:C.textMuted,flex:1 },
  detailRowV:{ fontFamily:'GoogleSans_700Bold',fontSize:13,color:C.navy,flex:2,textAlign:'right' },

  // LOANS
  loanCard:{ backgroundColor:'rgba(255,255,255,0.22)',borderRadius:14,padding:18,borderWidth:1.5,borderColor:'rgba(255,255,255,0.45)',marginBottom:14 },
  loanCardTop:{ flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12 },
  loanId:{ fontFamily:'GoogleSans_700Bold',fontSize:13,color:C.textMuted,letterSpacing:1 },
  loanMember:{ fontFamily:'GoogleSans_700Bold',fontSize:15,color:C.navy,marginTop:2 },
  loanAmts:{ gap:12,marginBottom:4 },
  loanAmtLabel:{ fontFamily:'GoogleSans_400Regular',fontSize:10,color:C.textMuted,letterSpacing:0.5,marginBottom:2 },
  loanAmtVal:{ fontFamily:'NotoSerif_700Bold',fontSize:16 },
  loanDetailRow:{ flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:8,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.06)' },
  viewLoanHint:{ fontFamily:'GoogleSans_400Regular',fontSize:11,color:C.textMuted,marginTop:8,textAlign:'right' },
  progressTrack:{ height:6,backgroundColor:'rgba(1,31,75,0.12)',borderRadius:3,overflow:'hidden' },
  progressFill:{ height:6,backgroundColor:C.green,borderRadius:3 },
  recordPayBtn:{ marginTop:14,borderRadius:10,overflow:'hidden' },
  recordPayBtnGrad:{ paddingVertical:12,alignItems:'center' },
  recordPayBtnTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:14,color:'#fff' },
  payHistRow:{ flexDirection:'row',alignItems:'flex-start',gap:10,paddingVertical:8,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.06)' },
  payHistDot:{ width:8,height:8,borderRadius:4,backgroundColor:C.green,marginTop:4 },
  payHistAmt:{ fontFamily:'GoogleSans_700Bold',fontSize:13,color:C.navy },
  payHistMeta:{ fontFamily:'GoogleSans_400Regular',fontSize:11,color:C.textMuted,marginTop:2 },

  // REPORTS
  reportSection:{ backgroundColor:'rgba(255,255,255,0.22)',borderRadius:14,padding:18,borderWidth:1.5,borderColor:'rgba(255,255,255,0.45)',marginBottom:16 },
  reportSectionTitle:{ fontFamily:'GoogleSans_700Bold',fontSize:11,color:C.textMuted,letterSpacing:2.5,textTransform:'uppercase',marginBottom:16,paddingBottom:8,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.08)' },
  reportGrid:{ flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:4 },
  reportStat:{ minWidth:100,flex:1,backgroundColor:'rgba(255,255,255,0.35)',borderRadius:10,padding:14,alignItems:'center',borderWidth:1,borderColor:'rgba(255,255,255,0.60)' },
  reportStatVal:{ fontFamily:'NotoSerif_700Bold',fontSize:20,marginBottom:4 },
  reportStatLabel:{ fontFamily:'GoogleSans_400Regular',fontSize:10,color:C.textMuted,textAlign:'center' },
  reportRow:{ flexDirection:'row',alignItems:'center',paddingHorizontal:10,paddingVertical:10,borderRadius:8,marginBottom:2,gap:8 },
  reportRowAlt:{ backgroundColor:'rgba(255,255,255,0.22)' },
  reportCell:{ flex:1,fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(1,31,75,0.75)' },

  // MODAL
  modalOverlay:{ flex:1,backgroundColor:'rgba(0,0,0,0.50)',justifyContent:'center',alignItems:'center',padding:24 },
  modalCard:{ width:'100%',maxWidth:380,backgroundColor:'#f0f5f9',borderRadius:18,padding:24,shadowColor:'#000',shadowOpacity:0.30,shadowRadius:24,shadowOffset:{width:0,height:8} },
  modalTitle:{ fontFamily:'NotoSerif_700Bold',fontSize:18,color:C.navy,marginBottom:10 },
  modalBody:{ fontFamily:'GoogleSans_400Regular',fontSize:13,color:C.textMuted,lineHeight:20,marginBottom:20 },
  modalBtns:{ flexDirection:'row',gap:12,marginTop:20 },
  modalCancel:{ flex:1,paddingVertical:12,borderRadius:10,alignItems:'center',backgroundColor:'rgba(1,31,75,0.08)',borderWidth:1.5,borderColor:'rgba(1,31,75,0.18)' },
  modalCancelTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:13,color:C.textMuted },
  modalConfirm:{ flex:1,paddingVertical:12,borderRadius:10,alignItems:'center',backgroundColor:C.navy },
  modalConfirmTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#fff' },

  // MEMBER DASHBOARD - PROFILE
  profileHead:{ flexDirection:'row',alignItems:'center',gap:16,marginBottom:20,paddingBottom:16,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.10)' },
  profileAvatar:{ width:60,height:60,borderRadius:30,backgroundColor:C.navyDeep,borderWidth:2.5,borderColor:C.gold,justifyContent:'center',alignItems:'center' },
  profileAvatarTxt:{ fontFamily:'NotoSerif_700Bold',fontSize:18,color:'#fff' },
  profileName:{ fontFamily:'NotoSerif_700Bold',fontSize:18,color:C.navy },
  profileId:{ fontFamily:'GoogleSans_500Medium',fontSize:11,color:C.textMuted,marginTop:2 },
  infoSection:{ backgroundColor:'rgba(255,255,255,0.30)',borderRadius:14,padding:14,borderWidth:1.5,borderColor:'rgba(255,255,255,0.55)',marginBottom:14 },
  infoSectionTitle:{ fontFamily:'GoogleSans_700Bold',fontSize:11,color:C.textMuted,letterSpacing:2.5,textTransform:'uppercase',marginBottom:10,paddingBottom:6,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.08)' },
  infoRow:{ flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:7,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.06)' },
  infoLabel:{ fontFamily:'GoogleSans_400Regular',fontSize:12,color:C.textMuted,flex:1 },
  infoVal:{ fontFamily:'GoogleSans_700Bold',fontSize:13,color:C.navy,flex:2,textAlign:'right' },

  // FORM
  formCard:{ backgroundColor:'rgba(255,255,255,0.30)',borderRadius:14,padding:18,borderWidth:1.5,borderColor:'rgba(255,255,255,0.55)' },
  formSection:{ fontFamily:'GoogleSans_700Bold',fontSize:12,color:C.navy,letterSpacing:1.5,textTransform:'uppercase',marginBottom:12,paddingBottom:6,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.10)' },
  saveBtn:{ backgroundColor:C.navyDeep,borderRadius:10,paddingVertical:13,alignItems:'center',marginTop:16,shadowColor:C.navy,shadowOpacity:0.25,shadowRadius:8,shadowOffset:{width:0,height:3} },
  saveBtnTxt:{ fontFamily:'GoogleSans_700Bold',fontSize:14,color:'#fff',letterSpacing:1 },

  // FINANCE
  financeHeroCard:{ backgroundColor:'rgba(255,255,255,0.30)',borderRadius:14,padding:24,alignItems:'center',borderWidth:1.5,borderColor:'rgba(255,255,255,0.55)',marginBottom:20 },
  financeHeroAmt:{ fontFamily:'NotoSerif_700Bold',fontSize:30,marginBottom:4 },
  financeHeroLabel:{ fontFamily:'GoogleSans_400Regular',fontSize:12,color:C.textMuted },

  // DROPDOWN SIDEBAR
  sidebarDropHeader:{ flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:8,paddingVertical:9,paddingHorizontal:10,borderRadius:8,marginBottom:1 },
  sidebarDropHeaderActive:{ backgroundColor:'rgba(201,168,76,0.15)' },
  sidebarChevron:{ color:'rgba(255,255,255,0.40)',fontSize:18,fontWeight:'700',transform:[{rotate:'0deg'}] },
  sidebarChevronOpen:{ color:C.gold,transform:[{rotate:'90deg'}] },
  sidebarItemIndent:{ marginLeft:14,marginRight:8 },
  dropBody:{ paddingBottom:2 },
  // TX ROW
  txRow:{ flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.07)' },
  txDot:{ width:9,height:9,borderRadius:5,marginTop:0 },
  txAmt:{ fontFamily:'GoogleSans_700Bold',fontSize:13,color:C.navy },
  txMeta:{ fontFamily:'GoogleSans_400Regular',fontSize:11,color:C.textMuted,marginTop:2 },
  // CAROUSEL
  carouselWrap:{ flex:1,padding:16 },
  tipCard:{ borderRadius:18,padding:28,alignItems:'center',minHeight:220,justifyContent:'center',shadowColor:'#000',shadowOpacity:0.25,shadowRadius:16,shadowOffset:{width:0,height:4} },
  tipIcon:{ fontSize:40,marginBottom:10 },
  tipTitle:{ fontFamily:'NotoSerif_700Bold',fontSize:18,color:'#fff',marginBottom:14,textAlign:'center' },
  tipBulletRow:{ flexDirection:'row',alignItems:'flex-start',gap:8,marginBottom:6,alignSelf:'flex-start' },
  tipBulletDot:{ color:'rgba(255,255,255,0.7)',fontSize:14,lineHeight:20 },
  tipBulletTxt:{ fontFamily:'GoogleSans_400Regular',fontSize:13,color:'rgba(255,255,255,0.92)',lineHeight:20,flex:1 },
  dotRow:{ flexDirection:'row',justifyContent:'center',gap:6,marginTop:14 },
  dot:{ width:7,height:7,borderRadius:4,backgroundColor:'rgba(255,255,255,0.35)' },
  dotActive:{ backgroundColor:C.gold,width:18 },
});