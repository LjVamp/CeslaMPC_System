// src/screens/MemberCoopScreen.js
// CESLA MPC — Member Portal: Login | Register | Dashboard
// Design: matches provided screenshots — navy #1a2d4e, gold #c9a84c, glass cards

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, StatusBar,
  useWindowDimensions, Platform, TextInput,
  KeyboardAvoidingView, Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  navy:       '#1a2d4e',
  navyDark:   '#0f1e35',
  navyMid:    '#243554',
  navyDeep:   '#304674',
  gold:       '#c9a84c',
  goldLight:  '#e8c87a',
  blue:       '#6fa3f7',
  green:      '#2ecc71',
  red:        '#e74c3c',
  orange:     '#f5a623',
  white:      '#ffffff',
  textMain:   '#0f1e35',
  textMuted:  'rgba(15,30,53,0.55)',
  textLight:  'rgba(255,255,255,0.85)',
  glassBg:    'rgba(255,255,255,0.18)',
  glassBdr:   'rgba(255,255,255,0.45)',
};

// ─── VIEWS ────────────────────────────────────────────────────────────────────
const V = { LOGIN:'login', REGISTER:'register', DASHBOARD:'dashboard' };

// ─── MEMBER SIDEBAR NAV ───────────────────────────────────────────────────────
const MEMBER_NAV = [
  { key:'overview',    label:'OVERVIEW',         icon:'⊞', section:null, bold:true },
  { key:'profile',     label:'My Profile',        icon:'👤', section:'ACCOUNT' },
  { key:'appform',     label:'Application Form',  icon:'📋', section:'ACCOUNT' },
  { key:'savings',     label:'Savings',           icon:'💰', section:'SHARES & SAVINGS', parent:'shares' },
  { key:'sharecap',    label:'Share Capital',     icon:'📊', section:null, parent:'shares' },
  { key:'timedeposit', label:'Time Deposit',      icon:'🏦', section:null, parent:'shares' },
  { key:'loans',       label:'Loans',             icon:'💳', section:'LOANS' },
  { key:'changepw',   label:'Change Password',   icon:'🔑', section:'SETTINGS' },
];

// ─── SAMPLE REGISTERED MEMBERS ────────────────────────────────────────────────
const REGISTERED = [
  { userId:'CESLA-2026-00001', password:'password123', name:'Ledy Joy Bandiola',
    shares:5000, savings:12000, loan:0, loanBalance:0, status:'Active', memberSince:'2026-03-05',
    contact:'09171234567', email:'ledyjoy@email.com', address:'Davao City',
    appForm:{ occupation:'Teacher', employer:'DepEd', beneficiary:'Juan Bandiola', relationship:'Spouse' } },
  { userId:'CESLA-2026-00002', password:'password123', name:'Aseñero Azaron Rochelle',
    shares:8000, savings:20000, loan:50000, loanBalance:32000, status:'Active', memberSince:'2026-03-02',
    contact:'09281234567', email:'rochelle@email.com', address:'Davao City',
    appForm:{ occupation:'Engineer', employer:'DPWH', beneficiary:'Rosa Rochelle', relationship:'Mother' } },
];

const fmtCur  = (v) => '₱' + Number(v||0).toLocaleString('en-PH',{minimumFractionDigits:2});
const genUID  = (list) => `CESLA-${new Date().getFullYear()}-${String(list.length+3).padStart(5,'0')}`;

// ─── APP BACKGROUND ───────────────────────────────────────────────────────────
const AppBg = () => (
  <>
    <View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#98bad5'}]}/>
    <LinearGradient colors={['rgba(198,220,235,0.85)','rgba(152,186,213,0.40)','rgba(80,110,150,0.0)']}
      locations={[0,0.45,1]} start={{x:0.5,y:0.1}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>
    <LinearGradient colors={['rgba(50,80,120,0.45)','rgba(50,80,120,0.0)','rgba(50,80,120,0.45)']}
      locations={[0,0.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFillObject}/>
    <LinearGradient colors={['rgba(50,80,120,0.0)','rgba(60,90,130,0.35)']}
      locations={[0.4,1]} start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>
  </>
);

// ─── HEADER BAR ───────────────────────────────────────────────────────────────
const HeaderBar = ({ title, subtitle, onBack, isWide, isSmall, rightEl }) => (
  <View style={[m.header,{
    paddingHorizontal: isWide?40:16,
    paddingVertical: isWide?16:12,
    marginTop: Platform.OS==='web'?0:44,
  }]}>
    {onBack ? (
      <TouchableOpacity style={m.backBtn} onPress={onBack}>
        <Text style={m.backIcon}>←</Text>
      </TouchableOpacity>
    ) : <View style={{width:40}}/>}
    <View style={m.headerCenter}>
      <Text style={[m.headerTitle,{fontSize: isWide?20:isSmall?14:17}]} adjustsFontSizeToFit numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? <Text style={[m.headerSub,{fontSize: isWide?10:8}]}>{subtitle}</Text> : null}
    </View>
    {rightEl || <View style={{width:40}}/>}
  </View>
);

// ─── INPUT FIELD ─────────────────────────────────────────────────────────────
const Field = ({ label, value, onChangeText, placeholder, secureEntry, keyboardType, error, showToggle, onToggle, editable=true, style }) => (
  <View style={[m.fieldWrap, style]}>
    <Text style={m.fieldLabel}>{label}</Text>
    <View style={[m.fieldRow, !editable && m.fieldRowDisabled, error && m.fieldRowError]}>
      <TextInput
        style={m.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(15,30,53,0.35)"
        secureTextEntry={secureEntry}
        keyboardType={keyboardType||'default'}
        editable={editable}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {showToggle && (
        <TouchableOpacity onPress={onToggle} style={m.eyeBtn}>
          <Text style={m.eyeIcon}>{secureEntry ? '👁' : '🙈'}</Text>
        </TouchableOpacity>
      )}
    </View>
    {error ? <Text style={m.fieldErr}>{error}</Text> : null}
  </View>
);

// ══════════════════════════════════════════════════════════════════════════════
// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const LoginScreen = ({ onLogin, onGoRegister, isWide, isSmall }) => {
  const [userId, setUserId]   = useState('');
  const [pw, setPw]           = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [members, setMembers] = useState(REGISTERED); // will be passed from parent later

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(30)).current;

  useEffect(()=>{
    Animated.parallel([
      Animated.timing(fadeIn, {toValue:1, duration:500, useNativeDriver:true}),
      Animated.timing(slideY, {toValue:0, duration:500, useNativeDriver:true}),
    ]).start();
  },[]);

  const handleLogin = () => {
    if (!userId.trim()) { setError('Please enter your User ID.'); return; }
    if (!pw.trim())     { setError('Please enter your password.'); return; }
    const found = REGISTERED.find(m => m.userId === userId.trim() && m.password === pw);
    if (found) { setError(''); onLogin(found); }
    else { setError('Invalid User ID or password. Please try again.'); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={m.loginOuter} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={[m.loginCard, {opacity:fadeIn, transform:[{translateY:slideY}]}]}>

          {/* Avatar icon */}
          <View style={m.loginAvatar}>
            <Text style={{fontSize:30}}>👤</Text>
          </View>

          <Text style={m.loginTitle}>Welcome Back!</Text>
          <Text style={m.loginSubtitle}>Login to access your membership account</Text>

          {/* Hint box */}
          <View style={m.hintBox}>
            <Text style={m.hintTxt}>
              {'🔑 Use your '}
              <Text style={m.hintBold}>User ID</Text>
              {' (e.g. CESLA-2026-00001) and '}
              <Text style={[m.hintBold,{color:C.gold}]}>Password</Text>
              {' to login.'}
            </Text>
          </View>

          <Field
            label="USER ID"
            value={userId}
            onChangeText={v=>{setUserId(v);setError('');}}
            placeholder="e.g. CESLA-2026-00001"
            keyboardType="default"
          />
          <Field
            label="PASSWORD"
            value={pw}
            onChangeText={v=>{setPw(v);setError('');}}
            placeholder="Enter your password"
            secureEntry={!showPw}
            showToggle
            onToggle={()=>setShowPw(s=>!s)}
          />

          {error ? <Text style={m.loginErr}>{error}</Text> : null}

          {/* Login button */}
          <TouchableOpacity style={m.loginBtn} onPress={handleLogin} activeOpacity={0.85}>
            <LinearGradient colors={[C.gold, C.goldLight]} start={{x:0,y:0}} end={{x:1,y:0}} style={m.loginBtnGrad}>
              <Text style={m.loginBtnArrow}>→</Text>
              <Text style={m.loginBtnTxt}>LOGIN</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={m.loginFooter}>
            <Text style={m.loginFooterTxt}>Don't have an account? </Text>
            <TouchableOpacity onPress={onGoRegister}>
              <Text style={m.loginFooterLink}>Register as New Member</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── REGISTER SCREEN ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const RegisterScreen = ({ onGoLogin, onRegisterSuccess, existingMembers, isWide, isSmall }) => {
  const newUid = genUID(existingMembers);
  const [name,      setName]      = useState('');
  const [pw,        setPw]        = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [showCPw,   setShowCPw]   = useState(false);
  const [errors,    setErrors]    = useState({});
  const [copied,    setCopied]    = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(30)).current;
  useEffect(()=>{
    Animated.parallel([
      Animated.timing(fadeIn,{toValue:1,duration:500,useNativeDriver:true}),
      Animated.timing(slideY,{toValue:0,duration:500,useNativeDriver:true}),
    ]).start();
  },[]);

  const copyUid = () => {
    try { Clipboard.setString(newUid); } catch(e){}
    setCopied(true);
    setTimeout(()=>setCopied(false), 2000);
  };

  const validate = () => {
    const e = {};
    if (!name.trim())         e.name = 'Full name is required.';
    if (pw.length < 6)        e.pw   = 'Password must be at least 6 characters.';
    if (pw !== confirmPw)     e.cpw  = 'Passwords do not match.';
    return e;
  };

  const handleCreate = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    const newMember = {
      userId: newUid, password: pw, name: name.trim(),
      shares:0, savings:0, loan:0, loanBalance:0,
      status:'Pending', memberSince: new Date().toISOString().split('T')[0],
      contact:'', email:'', address:'', appForm:{},
    };
    onRegisterSuccess(newMember);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={m.loginOuter} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={[m.regCard, {opacity:fadeIn, transform:[{translateY:slideY}]}]}>

          {/* Avatar */}
          <View style={m.regAvatar}>
            <Text style={{fontSize:26}}>👤</Text>
          </View>
          <Text style={m.regTitle}>Create Your Account</Text>
          <Text style={m.regSubtitle}>CLIMBS Membership Portal</Text>

          {/* Step indicator */}
          <View style={m.stepRow}>
            {[{n:1,lbl:'Create\nAccount'},{n:2,lbl:'Admin\nApproval'},{n:3,lbl:'Fill\nApplication'}].map((step,i)=>(
              <React.Fragment key={step.n}>
                <View style={m.stepItem}>
                  <View style={[m.stepCircle, step.n===1 && m.stepCircleActive]}>
                    <Text style={[m.stepNum, step.n===1 && m.stepNumActive]}>{step.n}</Text>
                  </View>
                  <Text style={[m.stepLbl, step.n===1 && m.stepLblActive]}>{step.lbl}</Text>
                </View>
                {i < 2 && <View style={m.stepLine}/>}
              </React.Fragment>
            ))}
          </View>

          {/* Full Name */}
          <Field label="Full Name" value={name} onChangeText={v=>{setName(v);setErrors(e=>({...e,name:''}))}}
            placeholder="e.g. Juan Dela Cruz" error={errors.name}/>

          {/* Auto-generated User ID */}
          <View style={m.uidBox}>
            <View style={{flex:1}}>
              <Text style={m.uidLabel}>YOUR USER ID (AUTO-GENERATED)</Text>
              <Text style={m.uidValue}>{newUid}</Text>
            </View>
            <TouchableOpacity style={[m.copyBtn, copied && m.copyBtnDone]} onPress={copyUid}>
              <Text style={m.copyBtnTxt}>{copied ? '✓ Copied' : '📋 Copy'}</Text>
            </TouchableOpacity>
          </View>

          {/* Warning */}
          <View style={m.uidWarning}>
            <Text style={m.uidWarningTxt}>
              {'⚠️ Save your User ID! '}
              <Text style={m.uidWarningBold}>You will use this to </Text>
              <Text style={[m.uidWarningBold,{color:C.gold}]}>log in</Text>
              <Text style={m.uidWarningBold}> after your account is approved by the administrator.</Text>
            </Text>
          </View>

          <Field label="Password" value={pw} onChangeText={v=>{setPw(v);setErrors(e=>({...e,pw:''}))}}
            placeholder="Create a password (min. 6 characters)" secureEntry={!showPw}
            showToggle onToggle={()=>setShowPw(s=>!s)} error={errors.pw}/>

          <Field label="Confirm Password" value={confirmPw} onChangeText={v=>{setConfirmPw(v);setErrors(e=>({...e,cpw:''}))}}
            placeholder="Re-enter your password" secureEntry={!showCPw}
            showToggle onToggle={()=>setShowCPw(s=>!s)} error={errors.cpw}/>

          <TouchableOpacity style={m.createBtn} onPress={handleCreate} activeOpacity={0.85}>
            <Text style={m.createBtnTxt}>CREATE ACCOUNT</Text>
          </TouchableOpacity>

          <View style={m.loginFooter}>
            <Text style={m.loginFooterTxt}>Already have an account? </Text>
            <TouchableOpacity onPress={onGoLogin}>
              <Text style={m.loginFooterLink}>Login here</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── MEMBER DASHBOARD ─────────────────────────════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

// Quick Tips carousel slides
const TIPS = [
  { icon:'💡', title:'Quick Tips', bullets:['Fill out your Application Form to complete your membership.','Monitor your Shares & Savings regularly.','Check Loan Guidelines before applying.'], bg:['#e8720c','#f5a623'] },
  { icon:'📋', title:'Application Form', bullets:['Complete all required fields accurately.','Submit supporting documents if needed.','Wait for admin approval before accessing all features.'], bg:['#1a3a6b','#304674'] },
  { icon:'💰', title:'Savings Reminder', bullets:['Regular savings strengthen your cooperative standing.','Maintain your minimum required monthly savings.','Contact admin for savings inquiries.'], bg:['#1a6b3a','#27ae60'] },
  { icon:'💳', title:'Loan Guidelines', bullets:['Loan amount is based on your share capital.','Ensure timely payments to maintain good standing.','Late payments may incur penalties.'], bg:['#6b1a1a','#c0392b'] },
];

const TipsCarousel = ({ isWide }) => {
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const goTo = (i) => {
    Animated.timing(fade,{toValue:0,duration:150,useNativeDriver:true}).start(()=>{
      setIdx(i);
      Animated.timing(fade,{toValue:1,duration:250,useNativeDriver:true}).start();
    });
  };

  useEffect(()=>{
    const t = setInterval(()=>goTo((idx+1)%TIPS.length), 4000);
    return ()=>clearInterval(t);
  },[idx]);

  const tip = TIPS[idx];

  return (
    <View style={m.carouselWrap}>
      <Animated.View style={{opacity:fade, flex:1}}>
        <LinearGradient colors={tip.bg} start={{x:0,y:0}} end={{x:1,y:1}} style={m.tipCard}>
          <Text style={m.tipIcon}>{tip.icon}</Text>
          <Text style={m.tipTitle}>{tip.title}</Text>
          {tip.bullets.map((b,i)=>(
            <View key={i} style={m.tipBulletRow}>
              <Text style={m.tipBulletDot}>•</Text>
              <Text style={m.tipBulletTxt}>{b}</Text>
            </View>
          ))}
        </LinearGradient>
      </Animated.View>
      <View style={m.dotRow}>
        {TIPS.map((_,i)=>(
          <TouchableOpacity key={i} onPress={()=>goTo(i)}>
            <View style={[m.dot, i===idx && m.dotActive]}/>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Profile view
const ProfileView = ({ member }) => (
  <ScrollView contentContainerStyle={m.pageOuter} showsVerticalScrollIndicator={false}>
    <Text style={m.pageTitle}>My Profile</Text>
    <View style={m.profileHead}>
      <View style={m.profileAvatar}>
        <Text style={m.profileAvatarTxt}>{member.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</Text>
      </View>
      <View>
        <Text style={m.profileName}>{member.name}</Text>
        <Text style={m.profileId}>{member.userId}</Text>
        <View style={[m.statusBadge, member.status==='Active'?m.statusActive:m.statusPending]}>
          <Text style={m.statusTxt}>{member.status}</Text>
        </View>
      </View>
    </View>
    <View style={m.infoSection}>
      <Text style={m.infoSectionTitle}>Personal Information</Text>
      {[['Contact',member.contact||'—'],['Email',member.email||'—'],['Address',member.address||'—'],['Member Since',member.memberSince]].map(([l,v])=>(
        <View key={l} style={m.infoRow}><Text style={m.infoLabel}>{l}</Text><Text style={m.infoVal}>{v}</Text></View>
      ))}
    </View>
    <View style={m.infoSection}>
      <Text style={m.infoSectionTitle}>Financial Overview</Text>
      {[['Share Capital',fmtCur(member.shares),C.gold],['Savings',fmtCur(member.savings),C.green],
        ['Active Loan',fmtCur(member.loan),C.orange],['Loan Balance',fmtCur(member.loanBalance),member.loanBalance>0?C.red:C.green]
      ].map(([l,v,c])=>(
        <View key={l} style={m.infoRow}><Text style={m.infoLabel}>{l}</Text><Text style={[m.infoVal,{color:c}]}>{v}</Text></View>
      ))}
    </View>
  </ScrollView>
);

// Application form view
const AppFormView = ({ member, onSave }) => {
  const af = member.appForm || {};
  const [occ, setOcc]   = useState(af.occupation||'');
  const [emp, setEmp]   = useState(af.employer||'');
  const [ben, setBen]   = useState(af.beneficiary||'');
  const [rel, setRel]   = useState(af.relationship||'');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave({ occupation:occ, employer:emp, beneficiary:ben, relationship:rel });
    setSaved(true);
    setTimeout(()=>setSaved(false), 2500);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={m.pageOuter} showsVerticalScrollIndicator={false}>
        <Text style={m.pageTitle}>Application Form</Text>
        <Text style={m.pageSub}>Complete your membership application form. Submitted to admin for review.</Text>
        <View style={m.formCard}>
          <Text style={m.formSection}>Employment Details</Text>
          {[[occ,setOcc,'Occupation','e.g. Teacher'],[emp,setEmp,'Employer / Company','e.g. DepEd']].map(([val,setter,lbl,ph])=>(
            <View key={lbl} style={m.fieldWrap}>
              <Text style={m.fieldLabel}>{lbl}</Text>
              <View style={m.fieldRow}><TextInput style={m.fieldInput} value={val} onChangeText={setter} placeholder={ph} placeholderTextColor="rgba(15,30,53,0.35)"/></View>
            </View>
          ))}
          <Text style={[m.formSection,{marginTop:16}]}>Beneficiary</Text>
          {[[ben,setBen,'Beneficiary Name','e.g. Maria Santos'],[rel,setRel,'Relationship','e.g. Spouse']].map(([val,setter,lbl,ph])=>(
            <View key={lbl} style={m.fieldWrap}>
              <Text style={m.fieldLabel}>{lbl}</Text>
              <View style={m.fieldRow}><TextInput style={m.fieldInput} value={val} onChangeText={setter} placeholder={ph} placeholderTextColor="rgba(15,30,53,0.35)"/></View>
            </View>
          ))}
          <TouchableOpacity style={[m.saveBtn, saved && m.saveBtnDone]} onPress={handleSave} activeOpacity={0.85}>
            <Text style={m.saveBtnTxt}>{saved ? '✓ Saved!' : 'Submit Application'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Savings / Shares / TimeDeposit views (generic)
const FinanceView = ({ title, icon, value, label, transactions, color }) => (
  <ScrollView contentContainerStyle={m.pageOuter} showsVerticalScrollIndicator={false}>
    <Text style={m.pageTitle}>{title}</Text>
    <View style={[m.financeHeroCard,{borderTopColor:color,borderTopWidth:4}]}>
      <Text style={{fontSize:32,marginBottom:8}}>{icon}</Text>
      <Text style={[m.financeHeroAmt,{color}]}>{fmtCur(value)}</Text>
      <Text style={m.financeHeroLabel}>{label}</Text>
    </View>
    <Text style={m.infoSectionTitle}>Transaction History</Text>
    {(!transactions||transactions.length===0) ? (
      <View style={m.emptyCard}><Text style={m.emptyTxt}>No transactions yet.</Text></View>
    ) : transactions.map((t,i)=>(
      <View key={i} style={m.txRow}>
        <View style={[m.txDot,{backgroundColor:color}]}/>
        <View style={{flex:1}}>
          <Text style={m.txAmt}>{fmtCur(t.amount)}</Text>
          <Text style={m.txMeta}>{t.date}  •  {t.note}</Text>
        </View>
      </View>
    ))}
  </ScrollView>
);

// Loans view
const LoansView = ({ member }) => {
  const progress = member.loan > 0 ? (member.loan - member.loanBalance) / member.loan : 0;
  return (
    <ScrollView contentContainerStyle={m.pageOuter} showsVerticalScrollIndicator={false}>
      <Text style={m.pageTitle}>My Loans</Text>
      {member.loan === 0 ? (
        <View style={m.emptyCard}>
          <Text style={{fontSize:36,marginBottom:10}}>📋</Text>
          <Text style={m.emptyTxt}>No active loans.</Text>
        </View>
      ) : (
        <View style={m.loanDetailCard}>
          <View style={m.loanDetailRow}>
            <Text style={m.loanDetailLabel}>Total Loan</Text>
            <Text style={[m.loanDetailVal,{color:C.orange}]}>{fmtCur(member.loan)}</Text>
          </View>
          <View style={m.loanDetailRow}>
            <Text style={m.loanDetailLabel}>Remaining Balance</Text>
            <Text style={[m.loanDetailVal,{color:C.red}]}>{fmtCur(member.loanBalance)}</Text>
          </View>
          <View style={m.loanDetailRow}>
            <Text style={m.loanDetailLabel}>Amount Paid</Text>
            <Text style={[m.loanDetailVal,{color:C.green}]}>{fmtCur(member.loan - member.loanBalance)}</Text>
          </View>
          <View style={{marginTop:14}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:5}}>
              <Text style={m.loanDetailLabel}>Repayment Progress</Text>
              <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:12,color:C.green}}>{Math.round(progress*100)}%</Text>
            </View>
            <View style={m.progressTrack}>
              <View style={[m.progressFill,{width:`${Math.round(progress*100)}%`}]}/>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

// Change password view
const ChangePwView = ({ member, onSave }) => {
  const [oldPw, setOldPw]     = useState('');
  const [newPw, setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showC,   setShowC]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = () => {
    if (oldPw !== member.password) { setError('Current password is incorrect.'); return; }
    if (newPw.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return; }
    setError(''); onSave(newPw);
    setOldPw(''); setNewPw(''); setConfirmPw('');
    setSuccess(true); setTimeout(()=>setSuccess(false), 2500);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
      <ScrollView contentContainerStyle={m.pageOuter} showsVerticalScrollIndicator={false}>
        <Text style={m.pageTitle}>Change Password</Text>
        <View style={m.formCard}>
          <Field label="Current Password" value={oldPw} onChangeText={v=>{setOldPw(v);setError('');}}
            placeholder="Enter current password" secureEntry={!showOld} showToggle onToggle={()=>setShowOld(s=>!s)}/>
          <Field label="New Password" value={newPw} onChangeText={v=>{setNewPw(v);setError('');}}
            placeholder="Min. 6 characters" secureEntry={!showNew} showToggle onToggle={()=>setShowNew(s=>!s)}/>
          <Field label="Confirm New Password" value={confirmPw} onChangeText={v=>{setConfirmPw(v);setError('');}}
            placeholder="Re-enter new password" secureEntry={!showC} showToggle onToggle={()=>setShowC(s=>!s)}/>
          {error ? <Text style={m.loginErr}>{error}</Text> : null}
          {success ? <Text style={[m.loginErr,{color:C.green}]}>Password changed successfully!</Text> : null}
          <TouchableOpacity style={m.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={m.saveBtnTxt}>Update Password</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Sidebar component
const MemberSidebar = ({ active, onNav, isWide, onClose }) => {
  const sections = ['ACCOUNT','SHARES & SAVINGS','LOANS','SETTINGS'];
  const ITEMS = [
    { key:'overview',    label:'OVERVIEW',        section:'__top', icon:'⊞' },
    { key:'profile',     label:'My Profile',      section:'ACCOUNT', icon:'👤' },
    { key:'appform',     label:'Application Form',section:'ACCOUNT', icon:'📋' },
    { key:'savings',     label:'Savings',         section:'SHARES & SAVINGS', icon:'💰' },
    { key:'sharecap',    label:'Share Capital',   section:'SHARES & SAVINGS', icon:'📊' },
    { key:'timedeposit', label:'Time Deposit',    section:'SHARES & SAVINGS', icon:'🏦' },
    { key:'loans',       label:'Loans',           section:'LOANS', icon:'💳' },
    { key:'changepw',    label:'Change Password', section:'SETTINGS', icon:'🔑' },
  ];

  const renderSection = (sec) => {
    const items = ITEMS.filter(i=>i.section===sec);
    return (
      <View key={sec} style={{marginBottom:4}}>
        {sec !== '__top' && <Text style={m.sidebarSec}>{sec}</Text>}
        {items.map(item=>(
          <TouchableOpacity key={item.key}
            style={[m.sidebarItem, active===item.key && m.sidebarItemActive]}
            onPress={()=>{ onNav(item.key); if(onClose) onClose(); }} activeOpacity={0.8}>
            <Text style={[m.sidebarIcon, active===item.key && m.sidebarIconActive]}>{item.icon}</Text>
            <Text style={[m.sidebarItemTxt, active===item.key && m.sidebarItemTxtActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={m.sidebar}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {['__top','ACCOUNT','SHARES & SAVINGS','LOANS','SETTINGS'].map(renderSection)}
      </ScrollView>
    </View>
  );
};

// Dashboard: full layout with sidebar + content
const MemberDashboard = ({ member, onLogout, onUpdateMember, isWide, isSmall }) => {
  const [activeNav, setActiveNav]   = useState('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchNav = (key) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {toValue:0,duration:150,useNativeDriver:true}),
      Animated.timing(slideAnim,{toValue:15,duration:150,useNativeDriver:true}),
    ]).start(()=>{
      setActiveNav(key);
      slideAnim.setValue(15);
      Animated.parallel([
        Animated.timing(fadeAnim, {toValue:1,duration:250,useNativeDriver:true}),
        Animated.timing(slideAnim,{toValue:0,duration:250,useNativeDriver:true}),
      ]).start();
    });
  };

  const renderContent = () => {
    switch(activeNav) {
      case 'overview':    return <TipsCarousel isWide={isWide}/>;
      case 'profile':     return <ProfileView member={member}/>;
      case 'appform':     return <AppFormView member={member} onSave={(af)=>onUpdateMember({...member,appForm:af})}/>;
      case 'savings':     return <FinanceView title="Savings" icon="💰" value={member.savings} label="Total Savings Balance" color={C.green} transactions={[]}/>;
      case 'sharecap':    return <FinanceView title="Share Capital" icon="📊" value={member.shares} label="Total Share Capital" color={C.gold} transactions={[]}/>;
      case 'timedeposit': return <FinanceView title="Time Deposit" icon="🏦" value={0} label="Time Deposit Balance" color={C.blue} transactions={[]}/>;
      case 'loans':       return <LoansView member={member}/>;
      case 'changepw':    return <ChangePwView member={member} onSave={(pw)=>onUpdateMember({...member,password:pw})}/>;
      default:            return <TipsCarousel isWide={isWide}/>;
    }
  };

  return (
    <View style={m.dashRoot}>
      {/* Topbar */}
      <View style={[m.dashTopbar,{paddingTop: Platform.OS==='web'?0:44}]}>
        {/* Left: Logo + Title */}
        <View style={m.dashTopLeft}>
          {!isWide && (
            <TouchableOpacity style={m.menuBtn} onPress={()=>setDrawerOpen(v=>!v)}>
              <Text style={m.menuBtnTxt}>☰</Text>
            </TouchableOpacity>
          )}
          <View style={m.dashLogoMark}><Text style={m.dashLogoTxt}>CS</Text></View>
          <View>
            <Text style={m.dashTopTitle}>Member Dashboard</Text>
            <Text style={m.dashTopSub}>CLIMBS Membership Portal</Text>
          </View>
        </View>
        {/* Right: name + logout */}
        <View style={m.dashTopRight}>
          <View style={m.dashMemberBadge}>
            <View style={m.dashMemberAvatar}>
              <Text style={m.dashMemberAvatarTxt}>{member.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</Text>
            </View>
            {isWide && <Text style={m.dashMemberName}>{member.name}</Text>}
          </View>
          <TouchableOpacity style={m.logoutBtn} onPress={onLogout}>
            <Text style={m.logoutTxt}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={m.dashBody}>
        {/* Sidebar */}
        {isWide ? (
          <MemberSidebar active={activeNav} onNav={switchNav} isWide={isWide}/>
        ) : drawerOpen && (
          <>
            <TouchableOpacity style={m.drawerOverlay} onPress={()=>setDrawerOpen(false)} activeOpacity={1}/>
            <View style={m.drawerSidebar}>
              <MemberSidebar active={activeNav} onNav={switchNav} isWide={isWide} onClose={()=>setDrawerOpen(false)}/>
            </View>
          </>
        )}

        {/* Content */}
        <Animated.View style={[m.dashContent,{opacity:fadeAnim,transform:[{translateY:slideAnim}]}]}>
          {renderContent()}
        </Animated.View>
      </View>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export default function MemberCoopScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, NotoSerif_700Bold_Italic,
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const [view,    setView]    = useState(V.LOGIN);
  const [member,  setMember]  = useState(null);
  const [members, setMembers] = useState(REGISTERED);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const transitionTo = (nextView, newMember) => {
    Animated.timing(fadeAnim,{toValue:0,duration:200,useNativeDriver:true}).start(()=>{
      if (newMember) setMember(newMember);
      setView(nextView);
      Animated.timing(fadeAnim,{toValue:1,duration:300,useNativeDriver:true}).start();
    });
  };

  const handleLogin     = (m) => transitionTo(V.DASHBOARD, m);
  const handleLogout    = ()  => transitionTo(V.LOGIN, null);
  const handleGoReg     = ()  => transitionTo(V.REGISTER);
  const handleGoLogin   = ()  => transitionTo(V.LOGIN);
  const handleRegSuccess= (m) => {
    setMembers(prev=>[...prev,m]);
    transitionTo(V.LOGIN);
  };
  const handleUpdateMember = (updated) => {
    setMember(updated);
    setMembers(prev=>prev.map(m=>m.userId===updated.userId?updated:m));
  };

  if (view === V.DASHBOARD && member) {
    return (
      <View style={{flex:1}}>
        <AppBg/>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>
        <Animated.View style={{flex:1,opacity:fadeAnim}}>
          <MemberDashboard
            member={member} onLogout={handleLogout}
            onUpdateMember={handleUpdateMember}
            isWide={isWide} isSmall={isSmall}
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={{flex:1}}>
      <AppBg/>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>

      {/* Header bar */}
      <HeaderBar
        title={view===V.LOGIN ? 'Member Login' : 'Register as New Member'}
        subtitle={view===V.LOGIN ? 'CESLA MULTI-PURPOSE COOPERATIVE' : null}
        onBack={navigation ? ()=>navigation.goBack() : null}
        isWide={isWide} isSmall={isSmall}
      />

      <Animated.View style={{flex:1, opacity:fadeAnim}}>
        {view===V.LOGIN && (
          <LoginScreen onLogin={handleLogin} onGoRegister={handleGoReg} isWide={isWide} isSmall={isSmall}/>
        )}
        {view===V.REGISTER && (
          <RegisterScreen onGoLogin={handleGoLogin} onRegisterSuccess={handleRegSuccess}
            existingMembers={members} isWide={isWide} isSmall={isSmall}/>
        )}
      </Animated.View>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const m = StyleSheet.create({

  // ── HEADER
  header: {
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    backgroundColor:'#1a2d4e',
    borderBottomWidth:2, borderColor:C.gold,
    paddingBottom:10,
  },
  backBtn: {
    width:36, height:36, borderRadius:18,
    backgroundColor:'rgba(255,255,255,0.15)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.30)',
    justifyContent:'center', alignItems:'center',
  },
  backIcon: { color:'#fff', fontSize:16, fontWeight:'600' },
  headerCenter: { flex:1, alignItems:'center' },
  headerTitle: { fontFamily:'NotoSerif_700Bold', color:'#fff', textAlign:'center', letterSpacing:0.4 },
  headerSub: { fontFamily:'GoogleSans_400Regular', color:C.gold, letterSpacing:2.5, textTransform:'uppercase', marginTop:2 },

  // ── LOGIN / REGISTER CARD
  loginOuter: { flexGrow:1, justifyContent:'center', alignItems:'center', paddingVertical:30, paddingHorizontal:16 },

  loginCard: {
    width:'100%', maxWidth:440, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.20)',
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.55)',
    padding:28,
    shadowColor:'#011f4b', shadowOpacity:0.18, shadowRadius:24, shadowOffset:{width:0,height:6},
  },
  loginAvatar: {
    width:70, height:70, borderRadius:35,
    backgroundColor:'rgba(201,168,76,0.25)',
    borderWidth:2, borderColor:'rgba(201,168,76,0.50)',
    justifyContent:'center', alignItems:'center',
    alignSelf:'center', marginBottom:18,
  },
  loginTitle: { fontFamily:'NotoSerif_700Bold', fontSize:22, color:C.navy, textAlign:'center', marginBottom:5 },
  loginSubtitle: { fontFamily:'GoogleSans_400Regular', fontSize:13, color:C.textMuted, textAlign:'center', marginBottom:18 },

  hintBox: {
    backgroundColor:'rgba(201,168,76,0.15)', borderRadius:10,
    borderWidth:1, borderColor:'rgba(201,168,76,0.35)',
    padding:12, marginBottom:18,
  },
  hintTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:C.textMain, lineHeight:18 },
  hintBold: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:C.navy },

  loginErr: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:C.red, textAlign:'center', marginBottom:8 },

  loginBtn: { borderRadius:28, overflow:'hidden', marginTop:14, marginBottom:10,
    shadowColor:C.gold, shadowOpacity:0.35, shadowRadius:10, shadowOffset:{width:0,height:3} },
  loginBtnGrad: { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:14, gap:10 },
  loginBtnArrow: { fontSize:18, color:C.navy, fontWeight:'700' },
  loginBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:15, color:C.navy, letterSpacing:2 },

  loginFooter: { flexDirection:'row', justifyContent:'center', alignItems:'center', marginTop:6 },
  loginFooterTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:C.textMuted },
  loginFooterLink: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:C.gold },

  // Register card (white bg)
  regCard: {
    width:'100%', maxWidth:460, borderRadius:20,
    backgroundColor:'#ffffff',
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.80)',
    padding:28,
    shadowColor:'#011f4b', shadowOpacity:0.20, shadowRadius:24, shadowOffset:{width:0,height:6},
  },
  regAvatar: {
    width:64, height:64, borderRadius:32, backgroundColor:C.navyDeep,
    justifyContent:'center', alignItems:'center',
    alignSelf:'center', marginBottom:14,
  },
  regTitle: { fontFamily:'NotoSerif_700Bold', fontSize:20, color:C.navy, textAlign:'center', marginBottom:4 },
  regSubtitle: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:C.textMuted, textAlign:'center', marginBottom:20 },

  // Step indicator
  stepRow: { flexDirection:'row', alignItems:'flex-start', justifyContent:'center', marginBottom:22, gap:0 },
  stepItem: { alignItems:'center', width:70 },
  stepCircle: { width:28, height:28, borderRadius:14, backgroundColor:'#e5e8ee', justifyContent:'center', alignItems:'center', marginBottom:4 },
  stepCircleActive: { backgroundColor:C.gold },
  stepNum: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#aaa' },
  stepNumActive: { color:C.navy },
  stepLbl: { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'#aaa', textAlign:'center', lineHeight:13 },
  stepLblActive: { color:C.navy, fontFamily:'GoogleSans_700Bold' },
  stepLine: { width:32, height:1, backgroundColor:'#ddd', marginTop:13 },

  // UID box
  uidBox: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:C.navyDeep, borderRadius:10, padding:14,
    marginBottom:10, gap:12,
  },
  uidLabel: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'rgba(255,255,255,0.55)', letterSpacing:1.5, marginBottom:4 },
  uidValue: { fontFamily:'GoogleSans_700Bold', fontSize:18, color:C.gold, letterSpacing:1 },
  copyBtn: {
    backgroundColor:C.navyMid, borderRadius:8,
    paddingHorizontal:12, paddingVertical:8,
    borderWidth:1, borderColor:'rgba(255,255,255,0.20)',
  },
  copyBtnDone: { backgroundColor:'rgba(46,204,113,0.30)', borderColor:C.green },
  copyBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:C.gold },

  uidWarning: {
    backgroundColor:'rgba(201,168,76,0.10)', borderRadius:10,
    borderWidth:1, borderColor:'rgba(201,168,76,0.30)',
    padding:12, marginBottom:14,
  },
  uidWarningTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:C.textMain, lineHeight:17 },
  uidWarningBold: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:C.textMain },

  createBtn: {
    backgroundColor:C.navyDeep, borderRadius:10,
    paddingVertical:14, alignItems:'center', marginTop:14, marginBottom:10,
    shadowColor:C.navy, shadowOpacity:0.25, shadowRadius:8, shadowOffset:{width:0,height:3},
  },
  createBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#fff', letterSpacing:2 },

  // ── FIELDS
  fieldWrap: { marginBottom:14 },
  fieldLabel: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:C.textMuted, letterSpacing:1.5, textTransform:'uppercase', marginBottom:5 },
  fieldRow: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(240,245,250,0.90)',
    borderRadius:10, paddingHorizontal:14, paddingVertical:12,
    borderWidth:1.5, borderColor:'rgba(200,215,230,0.80)',
  },
  fieldRowDisabled: { backgroundColor:'rgba(220,230,240,0.60)', borderColor:'rgba(200,215,230,0.40)' },
  fieldRowError: { borderColor:C.red },
  fieldInput: { flex:1, fontFamily:'GoogleSans_400Regular', fontSize:13, color:C.navy },
  eyeBtn: { paddingLeft:8 },
  eyeIcon: { fontSize:16 },
  fieldErr: { fontFamily:'GoogleSans_400Regular', fontSize:10, color:C.red, marginTop:3 },

  // ── DASHBOARD SHELL
  dashRoot: { flex:1 },
  dashTopbar: {
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    backgroundColor:'rgba(15,30,53,0.95)',
    paddingHorizontal:16, paddingBottom:10,
    borderBottomWidth:2, borderColor:C.gold,
    gap:12,
  },
  dashTopLeft: { flexDirection:'row', alignItems:'center', gap:10 },
  dashLogoMark: { width:30, height:30, borderRadius:6, backgroundColor:C.gold, justifyContent:'center', alignItems:'center' },
  dashLogoTxt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:C.navyDark, fontWeight:'800' },
  dashTopTitle: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#fff' },
  dashTopSub: { fontFamily:'GoogleSans_400Regular', fontSize:10, color:C.gold },
  dashTopRight: { flexDirection:'row', alignItems:'center', gap:10 },
  dashMemberBadge: { flexDirection:'row', alignItems:'center', gap:8 },
  dashMemberAvatar: { width:30, height:30, borderRadius:15, backgroundColor:'rgba(201,168,76,0.30)',
    borderWidth:1.5, borderColor:C.gold, justifyContent:'center', alignItems:'center' },
  dashMemberAvatarTxt: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:C.gold },
  dashMemberName: { fontFamily:'GoogleSans_500Medium', fontSize:13, color:'rgba(255,255,255,0.85)' },
  logoutBtn: {
    paddingHorizontal:14, paddingVertical:6, borderRadius:8,
    backgroundColor:'rgba(201,168,76,0.15)',
    borderWidth:1.5, borderColor:'rgba(201,168,76,0.50)',
  },
  logoutTxt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:C.gold },
  menuBtn: { width:34, height:34, borderRadius:8, backgroundColor:'rgba(255,255,255,0.12)',
    justifyContent:'center', alignItems:'center' },
  menuBtnTxt: { color:'#fff', fontSize:18 },

  dashBody: { flex:1, flexDirection:'row' },
  dashContent: { flex:1 },

  // ── SIDEBAR
  sidebar: {
    width:140, backgroundColor:'rgba(15,30,53,0.95)',
    borderRightWidth:1, borderColor:'rgba(255,255,255,0.10)',
    paddingTop:10,
  },
  sidebarSec: {
    fontFamily:'GoogleSans_700Bold', fontSize:8,
    color:'rgba(255,255,255,0.30)', letterSpacing:2,
    textTransform:'uppercase', paddingHorizontal:12,
    paddingTop:14, paddingBottom:4,
  },
  sidebarItem: {
    flexDirection:'row', alignItems:'center', gap:8,
    marginHorizontal:8, paddingVertical:9, paddingHorizontal:10,
    borderRadius:8, marginBottom:1,
  },
  sidebarItemActive: { backgroundColor:C.gold },
  sidebarIcon: { fontSize:13, color:'rgba(255,255,255,0.50)', width:16, textAlign:'center' },
  sidebarIconActive: { color:C.navyDark },
  sidebarItemTxt: { fontFamily:'GoogleSans_500Medium', fontSize:11, color:'rgba(255,255,255,0.65)', flex:1 },
  sidebarItemTxtActive: { fontFamily:'GoogleSans_700Bold', color:C.navyDark },

  // Mobile drawer
  drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.45)', zIndex:10 },
  drawerSidebar: { position:'absolute', top:0, left:0, bottom:0, width:160, zIndex:11 },

  // ── PAGE CONTENT
  pageOuter: { padding:18, paddingBottom:40 },
  pageTitle: { fontFamily:'NotoSerif_700Bold', fontSize:20, color:C.navy, marginBottom:4 },
  pageSub: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:C.textMuted, marginBottom:18, lineHeight:18 },

  // Carousel
  carouselWrap: { flex:1, padding:16 },
  tipCard: { borderRadius:18, padding:28, alignItems:'center', minHeight:220, justifyContent:'center',
    shadowColor:'#000', shadowOpacity:0.25, shadowRadius:16, shadowOffset:{width:0,height:4} },
  tipIcon: { fontSize:40, marginBottom:10 },
  tipTitle: { fontFamily:'NotoSerif_700Bold', fontSize:18, color:'#fff', marginBottom:14, textAlign:'center' },
  tipBulletRow: { flexDirection:'row', alignItems:'flex-start', gap:8, marginBottom:6, alignSelf:'flex-start' },
  tipBulletDot: { color:'rgba(255,255,255,0.7)', fontSize:14, lineHeight:20 },
  tipBulletTxt: { fontFamily:'GoogleSans_400Regular', fontSize:13, color:'rgba(255,255,255,0.92)', lineHeight:20, flex:1 },
  dotRow: { flexDirection:'row', justifyContent:'center', gap:6, marginTop:14 },
  dot: { width:7, height:7, borderRadius:4, backgroundColor:'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor:C.gold, width:18 },

  // Profile
  profileHead: { flexDirection:'row', alignItems:'center', gap:16, marginBottom:20,
    paddingBottom:16, borderBottomWidth:1, borderColor:'rgba(1,31,75,0.10)' },
  profileAvatar: { width:60, height:60, borderRadius:30, backgroundColor:C.navyDeep,
    borderWidth:2.5, borderColor:C.gold, justifyContent:'center', alignItems:'center' },
  profileAvatarTxt: { fontFamily:'NotoSerif_700Bold', fontSize:18, color:'#fff' },
  profileName: { fontFamily:'NotoSerif_700Bold', fontSize:18, color:C.navy },
  profileId: { fontFamily:'GoogleSans_500Medium', fontSize:11, color:C.textMuted, marginTop:2 },

  // Status badge
  statusBadge: { paddingHorizontal:8, paddingVertical:3, borderRadius:20, alignSelf:'flex-start', marginTop:5 },
  statusActive: { backgroundColor:'rgba(46,204,113,0.22)', borderWidth:1, borderColor:'rgba(46,204,113,0.55)' },
  statusPending:{ backgroundColor:'rgba(245,166,35,0.18)', borderWidth:1, borderColor:'rgba(245,166,35,0.45)' },
  statusTxt: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'#fff', letterSpacing:1 },

  // Info section
  infoSection: { backgroundColor:'rgba(255,255,255,0.30)', borderRadius:14, padding:14,
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.55)', marginBottom:14 },
  infoSectionTitle: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:C.textMuted, letterSpacing:2.5,
    textTransform:'uppercase', marginBottom:10, paddingBottom:6, borderBottomWidth:1, borderColor:'rgba(1,31,75,0.08)' },
  infoRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingVertical:7, borderBottomWidth:1, borderColor:'rgba(1,31,75,0.06)' },
  infoLabel: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:C.textMuted, flex:1 },
  infoVal: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:C.navy, flex:2, textAlign:'right' },

  // Form card
  formCard: { backgroundColor:'rgba(255,255,255,0.30)', borderRadius:14, padding:18,
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.55)' },
  formSection: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:C.navy, letterSpacing:1.5,
    textTransform:'uppercase', marginBottom:12, paddingBottom:6, borderBottomWidth:1, borderColor:'rgba(1,31,75,0.10)' },
  saveBtn: { backgroundColor:C.navyDeep, borderRadius:10, paddingVertical:13, alignItems:'center', marginTop:16,
    shadowColor:C.navy, shadowOpacity:0.25, shadowRadius:8, shadowOffset:{width:0,height:3} },
  saveBtnDone: { backgroundColor:C.green },
  saveBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#fff', letterSpacing:1 },

  // Finance
  financeHeroCard: { backgroundColor:'rgba(255,255,255,0.30)', borderRadius:14, padding:24,
    alignItems:'center', borderWidth:1.5, borderColor:'rgba(255,255,255,0.55)', marginBottom:20 },
  financeHeroAmt: { fontFamily:'NotoSerif_700Bold', fontSize:30, marginBottom:4 },
  financeHeroLabel: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:C.textMuted },

  txRow: { flexDirection:'row', alignItems:'flex-start', gap:10, paddingVertical:8,
    borderBottomWidth:1, borderColor:'rgba(1,31,75,0.07)' },
  txDot: { width:8, height:8, borderRadius:4, marginTop:4 },
  txAmt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:C.navy },
  txMeta: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:C.textMuted, marginTop:2 },

  // Loans
  loanDetailCard: { backgroundColor:'rgba(255,255,255,0.30)', borderRadius:14, padding:18,
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.55)', marginBottom:16 },
  loanDetailRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingVertical:8, borderBottomWidth:1, borderColor:'rgba(1,31,75,0.06)' },
  loanDetailLabel: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:C.textMuted, flex:1 },
  loanDetailVal: { fontFamily:'NotoSerif_700Bold', fontSize:16 },
  progressTrack: { height:6, backgroundColor:'rgba(1,31,75,0.12)', borderRadius:3, overflow:'hidden' },
  progressFill: { height:6, backgroundColor:C.green, borderRadius:3 },

  emptyCard: { backgroundColor:'rgba(255,255,255,0.25)', borderRadius:14, padding:40,
    alignItems:'center', borderWidth:1.5, borderColor:'rgba(255,255,255,0.45)' },
  emptyTxt: { fontFamily:'GoogleSans_400Regular', fontSize:13, color:C.textMuted, textAlign:'center' },
});