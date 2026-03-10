// src/screens/MemberCoopScreen.js
// CESLA MPC — Member Portal (Firebase-connected)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  useWindowDimensions,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { NotoSerif_700Bold } from "@expo-google-fonts/noto-serif";
import {
  GoogleSans_400Regular,
  GoogleSans_500Medium,
  GoogleSans_700Bold,
} from "@expo-google-fonts/google-sans";
import * as Clipboard from "expo-clipboard";

import {
  loginByUserId,
  logoutUser,
  changePassword,
  registerMember,
  generateNextUserId,
  listenMember,
  updateMemberProfile,
  saveAppForm,
  submitLoanApplication,
  listenMemberLoanApps,
  listenNotifications,
  markNotificationRead,
} from "../firebase/firebaseService";
import { auth } from "../firebase/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  navy: "#1a2d4e",
  navyDark: "#0f1e35",
  navyMid: "#243554",
  navyDeep: "#304674",
  gold: "#c9a84c",
  goldLight: "#e8c87a",
  blue: "#6fa3f7",
  green: "#2ecc71",
  red: "#e74c3c",
  orange: "#f5a623",
  textMain: "#0f1e35",
  textMuted: "rgba(15,30,53,0.55)",
};

const fmtCur = (v) =>
  "₱" + Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });

const V = {
  SPLASH: "splash",
  LOGIN: "login",
  REGISTER: "register",
  DASHBOARD: "dashboard",
};

const SIDEBAR_GROUPS = [
  { key: "overview", label: "OVERVIEW", icon: "⊞", single: true },
  {
    key: "account_group",
    label: "My Account",
    icon: "👤",
    children: [
      { key: "profile", label: "My Profile", icon: "👤" },
      { key: "appform", label: "Application Form", icon: "📋" },
    ],
  },
  {
    key: "shares_group",
    label: "Savings & Shares",
    icon: "💰",
    children: [
      { key: "savings", label: "Savings", icon: "💰" },
      { key: "sharecap", label: "Share Capital", icon: "📊" },
      { key: "timedeposit", label: "Time Deposit", icon: "🏦" },
    ],
  },
  {
    key: "loans_group",
    label: "Loans",
    icon: "💳",
    children: [
      { key: "applyloan", label: "Apply for a Loan", icon: "📝" },
      { key: "myloans", label: "My Loans", icon: "💳" },
      { key: "loanguidelines", label: "Guidelines", icon: "📖" },
    ],
  },
  {
    key: "settings_group",
    label: "Settings",
    icon: "⚙️",
    children: [
      { key: "changepw", label: "Change Password", icon: "🔑" },
      { key: "editprofile", label: "Edit Profile", icon: "✏️" },
      { key: "notifications", label: "Notifications", icon: "🔔" },
    ],
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const AppBg = () => (
  <>
    <View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: "#98bad5" }]}
    />
    <LinearGradient
      colors={[
        "rgba(198,220,235,0.85)",
        "rgba(152,186,213,0.40)",
        "rgba(80,110,150,0.0)",
      ]}
      locations={[0, 0.45, 1]}
      start={{ x: 0.5, y: 0.1 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  </>
);

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureEntry,
  showToggle,
  onToggle,
  error,
  editable = true,
  keyboardType,
}) => (
  <View style={m.fieldWrap}>
    <Text style={m.fieldLabel}>{label}</Text>
    <View
      style={[
        m.fieldRow,
        !editable && m.fieldRowDisabled,
        error && m.fieldRowError,
      ]}
    >
      <TextInput
        style={m.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(15,30,53,0.35)"
        secureTextEntry={secureEntry}
        editable={editable}
        keyboardType={keyboardType || "default"}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {showToggle && (
        <TouchableOpacity onPress={onToggle} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18 }}>{secureEntry ? "👁" : "🙈"}</Text>
        </TouchableOpacity>
      )}
    </View>
    {error ? <Text style={m.fieldErr}>{error}</Text> : null}
  </View>
);

const Spinner = ({ message = "Loading..." }) => (
  <View
    style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12 }}
  >
    <ActivityIndicator size="large" color={C.gold} />
    <Text
      style={{
        fontFamily: "GoogleSans_400Regular",
        fontSize: 13,
        color: C.textMuted,
      }}
    >
      {message}
    </Text>
  </View>
);

// ─── HEADER BAR ──────────────────────────────────────────────────────────────
const HeaderBar = ({ title, subtitle, onBack, isWide, isSmall, rightEl }) => (
  <View
    style={[
      m.header,
      {
        paddingHorizontal: isWide ? 40 : 16,
        paddingBottom: 14,
        paddingTop: Platform.OS === "web" ? (isWide ? 16 : 14) : 54,
      },
    ]}
  >
    {onBack ? (
      <TouchableOpacity
        style={m.backBtn}
        onPress={onBack}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={m.backIcon}>←</Text>
      </TouchableOpacity>
    ) : (
      <View style={{ width: 44 }} />
    )}
    <View style={m.headerCenter}>
      <Text
        style={[m.headerTitle, { fontSize: isWide ? 20 : isSmall ? 13 : 16 }]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[m.headerSub, { fontSize: isWide ? 10 : 8 }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {rightEl || <View style={{ width: 44 }} />}
  </View>
);

// ══════════════════════════════════════════════════════════════════════════════
// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const LoginScreen = ({ onLogin, onGoRegister, isWide }) => {
  const [userId, setUserId] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!userId.trim()) {
      setError("Please enter your User ID.");
      return;
    }
    if (!pw.trim()) {
      setError("Please enter your password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const member = await loginByUserId(userId.trim(), pw);
      onLogin(member);
    } catch (e) {
      setError(e.message || "Invalid User ID or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={m.loginOuter}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            m.loginCard,
            { opacity: fadeIn, transform: [{ translateY: slideY }] },
          ]}
        >
          <View style={m.loginAvatar}>
            <Text style={{ fontSize: 32 }}>👤</Text>
          </View>
          <Text style={m.loginTitle}>Welcome Back!</Text>
          <Text style={m.loginSubtitle}>
            Login to access your membership account
          </Text>
          <View style={m.hintBox}>
            <Text style={m.hintTxt}>
              🔑 Use your <Text style={m.hintBold}>User ID</Text> and{" "}
              <Text style={[m.hintBold, { color: C.gold }]}>Password</Text> to
              login.
            </Text>
          </View>
          <Field
            label="USER ID"
            value={userId}
            onChangeText={(v) => {
              setUserId(v);
              setError("");
            }}
            placeholder="e.g. CESLA-2026-00001"
          />
          <Field
            label="PASSWORD"
            value={pw}
            onChangeText={(v) => {
              setPw(v);
              setError("");
            }}
            placeholder="Enter your password"
            secureEntry={!showPw}
            showToggle
            onToggle={() => setShowPw((p) => !p)}
            error={error}
          />
          <TouchableOpacity
            style={m.loginBtn}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            <LinearGradient
              colors={[C.gold, C.goldLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={m.loginBtnGrad}
            >
              {loading ? (
                <ActivityIndicator color={C.navy} />
              ) : (
                <>
                  <Text style={m.loginBtnArrow}>→</Text>
                  <Text style={m.loginBtnTxt}>LOGIN</Text>
                </>
              )}
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
const RegisterScreen = ({ onGoLogin, onSuccess }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [genUid, setGenUid] = useState("Loading...");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
    // Generate a preview user ID
    generateNextUserId()
      .then(setGenUid)
      .catch(() => setGenUid("CESLA-2026-XXXXX"));
  }, []);

  const handleCreate = async () => {
    const e = {};
    if (!name.trim()) e.name = "Full name is required.";
    if (!email.trim()) e.email = "Email is required.";
    if (!email.includes("@")) e.email = "Enter a valid email address.";
    if (pw.length < 6) e.pw = "Password must be at least 6 characters.";
    if (pw !== confirmPw) e.cpw = "Passwords do not match.";
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    setLoading(true);
    try {
      // Re-generate to ensure uniqueness at submission time
      const userId = await generateNextUserId();
      const member = await registerMember({
        email: email.trim(),
        password: pw,
        name: name.trim(),
        userId,
      });
      onSuccess(member);
    } catch (err) {
      setErrors({
        general: err.message || "Registration failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(genUid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={m.loginOuter}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            m.regCard,
            { opacity: fadeIn, transform: [{ translateY: slideY }] },
          ]}
        >
          <View style={m.regAvatar}>
            <Text style={{ fontSize: 26, color: "#fff" }}>👤</Text>
          </View>
          <Text style={m.regTitle}>Create Your Account</Text>
          <Text style={m.regSubtitle}>CLIMBS Membership Portal</Text>

          {/* Steps */}
          <View style={m.stepRow}>
            {[
              { n: 1, lbl: "Create\nAccount" },
              { n: 2, lbl: "Admin\nApproval" },
              { n: 3, lbl: "Fill\nApplication" },
            ].map((step, i) => (
              <View
                key={step.n}
                style={{ flexDirection: "row", alignItems: "flex-start" }}
              >
                <View style={m.stepItem}>
                  <View
                    style={[m.stepCircle, step.n === 1 && m.stepCircleActive]}
                  >
                    <Text style={[m.stepNum, step.n === 1 && m.stepNumActive]}>
                      {step.n}
                    </Text>
                  </View>
                  <Text style={[m.stepLbl, step.n === 1 && m.stepLblActive]}>
                    {step.lbl}
                  </Text>
                </View>
                {i < 2 && <View style={m.stepLine} />}
              </View>
            ))}
          </View>

          <Field
            label="FULL NAME"
            value={name}
            onChangeText={(v) => {
              setName(v);
              setErrors((e) => ({ ...e, name: "" }));
            }}
            placeholder="e.g. Juan Dela Cruz"
            error={errors.name}
          />
          <Field
            label="EMAIL ADDRESS"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setErrors((e) => ({ ...e, email: "" }));
            }}
            placeholder="e.g. juan@email.com"
            keyboardType="email-address"
            error={errors.email}
          />

          {/* UID Preview */}
          <View style={m.uidBox}>
            <View style={{ flex: 1 }}>
              <Text style={m.uidLabel}>YOUR USER ID (AUTO-GENERATED)</Text>
              <Text style={m.uidValue}>{genUid}</Text>
            </View>
            <TouchableOpacity
              style={[m.copyBtn, copied && m.copyBtnDone]}
              onPress={handleCopy}
            >
              <Text style={m.copyBtnTxt}>
                {copied ? "✓ Copied" : "📋 Copy"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={m.uidWarning}>
            <Text style={m.uidWarningTxt}>
              ⚠️ Save your User ID!{" "}
              <Text style={m.uidWarningBold}>
                You'll use this to log in after admin approval.
              </Text>
            </Text>
          </View>

          <Field
            label="PASSWORD"
            value={pw}
            onChangeText={(v) => {
              setPw(v);
              setErrors((e) => ({ ...e, pw: "" }));
            }}
            placeholder="Min. 6 characters"
            secureEntry
            showToggle
            onToggle={() => {}}
            error={errors.pw}
          />
          <Field
            label="CONFIRM PASSWORD"
            value={confirmPw}
            onChangeText={(v) => {
              setConfirmPw(v);
              setErrors((e) => ({ ...e, cpw: "" }));
            }}
            placeholder="Re-enter your password"
            secureEntry
            error={errors.cpw}
          />

          {errors.general && (
            <Text
              style={[m.fieldErr, { textAlign: "center", marginBottom: 8 }]}
            >
              {errors.general}
            </Text>
          )}

          <TouchableOpacity
            style={m.createBtn}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={m.createBtnTxt}>CREATE ACCOUNT</Text>
            )}
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
// ─── DASHBOARD VIEWS ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const TIPS = [
  {
    icon: "💡",
    title: "Quick Tips",
    bullets: [
      "Fill out your Application Form to complete your membership.",
      "Monitor your Shares & Savings regularly.",
      "Check Loan Guidelines before applying.",
    ],
    bg: "linear-gradient(135deg, #e8720c, #f5a623)",
  },
  {
    icon: "📋",
    title: "Application Form",
    bullets: [
      "Complete all required fields accurately.",
      "Submit supporting documents if needed.",
      "Wait for admin approval.",
    ],
    bg: "linear-gradient(135deg, #1a3a6b, #304674)",
  },
  {
    icon: "💰",
    title: "Savings Reminder",
    bullets: [
      "Regular savings strengthen your standing.",
      "Maintain your minimum required monthly savings.",
      "Contact admin for savings inquiries.",
    ],
    bg: "linear-gradient(135deg, #1a6b3a, #27ae60)",
  },
  {
    icon: "💳",
    title: "Loan Guidelines",
    bullets: [
      "Loan amount is based on your share capital.",
      "Ensure timely payments to maintain good standing.",
      "Late payments may incur penalties.",
    ],
    bg: "linear-gradient(135deg, #6b1a1a, #c0392b)",
  },
];
const BG_COLORS = [
  ["#e8720c", "#f5a623"],
  ["#1a3a6b", "#304674"],
  ["#1a6b3a", "#27ae60"],
  ["#6b1a1a", "#c0392b"],
];

const TipsCarousel = () => {
  const [idx, setIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIdx((i) => (i + 1) % TIPS.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const tip = TIPS[idx];
  return (
    <View style={m.carouselWrap}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <LinearGradient
          colors={BG_COLORS[idx]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={m.tipCard}
        >
          <Text style={m.tipIcon}>{tip.icon}</Text>
          <Text style={m.tipTitle}>{tip.title}</Text>
          {tip.bullets.map((b, i) => (
            <View key={i} style={m.tipBulletRow}>
              <Text style={m.tipBulletDot}>•</Text>
              <Text style={m.tipBulletTxt}>{b}</Text>
            </View>
          ))}
        </LinearGradient>
      </Animated.View>
      <View style={m.dotRow}>
        {TIPS.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setIdx(i)}
            style={[m.dot, i === idx && m.dotActive]}
          />
        ))}
      </View>
    </View>
  );
};

const ProfileView = ({ member }) => (
  <ScrollView contentContainerStyle={m.pageOuter}>
    <Text style={m.pageTitle}>My Profile</Text>
    <View style={m.profileHead}>
      <View style={m.profileAvatar}>
        <Text style={m.profileAvatarTxt}>
          {member.name
            ?.split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("") || "ME"}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={m.profileName} numberOfLines={2}>
          {member.name}
        </Text>
        <Text style={m.profileId}>{member.userId}</Text>
        <View
          style={[
            m.statusBadge,
            member.status === "Active" ? m.statusActive : m.statusPending,
          ]}
        >
          <Text style={m.statusTxt}>{member.status}</Text>
        </View>
      </View>
    </View>
    {[
      {
        title: "Personal Information",
        rows: [
          ["Contact", member.contact || "—"],
          ["Email", member.email || "—"],
          ["Address", member.address || "—"],
          [
            "Member Since",
            typeof member.memberSince === "string"
              ? member.memberSince
              : member.memberSince?.toDate?.()?.toLocaleDateString?.("en-PH") ||
                "—",
          ],
        ],
      },
      {
        title: "Financial Overview",
        rows: [
          ["Share Capital", fmtCur(member.shares), C.gold],
          ["Savings", fmtCur(member.savings), C.green],
          ["Active Loan", fmtCur(member.loan), C.orange],
          [
            "Loan Balance",
            fmtCur(member.loanBalance),
            member.loanBalance > 0 ? C.red : C.green,
          ],
          [
            "Credit Balance",
            fmtCur(member.creditBalance),
            member.creditBalance > 0 ? C.orange : C.green,
          ],
        ],
      },
    ].map((sec) => (
      <View key={sec.title} style={m.infoSection}>
        <Text style={m.infoSectionTitle}>{sec.title}</Text>
        {sec.rows.map(([l, v, c]) => (
          <View key={l} style={m.infoRow}>
            <Text style={m.infoLabel}>{l}</Text>
            <Text style={[m.infoVal, c && { color: c }]}>{v}</Text>
          </View>
        ))}
      </View>
    ))}
  </ScrollView>
);

const AppFormView = ({ member }) => {
  const [form, setForm] = useState({
    occupation: member.appForm?.occupation || "",
    employer: member.appForm?.employer || "",
    beneficiary: member.appForm?.beneficiary || "",
    relationship: member.appForm?.relationship || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAppForm(member.uid, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.warn("saveAppForm error:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={m.pageOuter}>
      <Text style={m.pageTitle}>Application Form</Text>
      <Text style={m.pageSub}>Complete your membership application.</Text>
      <View style={m.formCard}>
        <Text style={m.formSection}>Employment Details</Text>
        <Field
          label="Occupation"
          value={form.occupation}
          onChangeText={(v) => setForm((f) => ({ ...f, occupation: v }))}
          placeholder="e.g. Teacher"
        />
        <Field
          label="Employer / Company"
          value={form.employer}
          onChangeText={(v) => setForm((f) => ({ ...f, employer: v }))}
          placeholder="e.g. DepEd"
        />
        <Text style={[m.formSection, { marginTop: 16 }]}>Beneficiary</Text>
        <Field
          label="Beneficiary Name"
          value={form.beneficiary}
          onChangeText={(v) => setForm((f) => ({ ...f, beneficiary: v }))}
          placeholder="e.g. Maria Santos"
        />
        <Field
          label="Relationship"
          value={form.relationship}
          onChangeText={(v) => setForm((f) => ({ ...f, relationship: v }))}
          placeholder="e.g. Spouse"
        />
        <TouchableOpacity
          style={[m.saveBtn, saved && m.saveBtnDone]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={m.saveBtnTxt}>
              {saved ? "✓ Saved!" : "Submit Application"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const FinanceView = ({ title, icon, value, label, color }) => (
  <ScrollView contentContainerStyle={m.pageOuter}>
    <Text style={m.pageTitle}>{title}</Text>
    <View
      style={[m.financeHeroCard, { borderTopWidth: 4, borderTopColor: color }]}
    >
      <Text style={{ fontSize: 32, marginBottom: 8 }}>{icon}</Text>
      <Text style={[m.financeHeroAmt, { color }]}>{fmtCur(value)}</Text>
      <Text style={m.financeHeroLabel}>{label}</Text>
    </View>
    <View style={m.emptyCard}>
      <Text style={m.emptyTxt}>No transactions yet.</Text>
    </View>
  </ScrollView>
);

const ApplyLoanView = ({ member }) => {
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!amount || !purpose || !term) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await submitLoanApplication({
        memberId: member.uid,
        memberName: member.name,
        amount: parseFloat(amount),
        purpose,
        term,
      });
      setDone(true);
      setAmount("");
      setPurpose("");
      setTerm("");
      setTimeout(() => setDone(false), 3000);
    } catch (e) {
      setError(e.message || "Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={m.pageOuter}>
      <Text style={m.pageTitle}>Apply for a Loan</Text>
      <Text style={m.pageSub}>Fill out the loan application form below.</Text>
      <View style={m.formCard}>
        <Text style={m.formSection}>Loan Details</Text>
        <Field
          label="Loan Amount (₱)"
          value={amount}
          onChangeText={setAmount}
          placeholder="e.g. 10000"
          keyboardType="numeric"
        />
        <Field
          label="Purpose"
          value={purpose}
          onChangeText={setPurpose}
          placeholder="e.g. Business Capital"
        />
        <Field
          label="Repayment Term"
          value={term}
          onChangeText={setTerm}
          placeholder="e.g. 12 months"
        />
        {error ? (
          <Text style={[m.fieldErr, { textAlign: "center", marginBottom: 8 }]}>
            {error}
          </Text>
        ) : null}
        <TouchableOpacity
          style={[m.saveBtn, done && m.saveBtnDone]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={m.saveBtnTxt}>
              {done ? "✓ Application Submitted!" : "Submit Loan Application"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const LoansView = ({ member, loanApps }) => {
  const progress =
    member.loan > 0 ? (member.loan - member.loanBalance) / member.loan : 0;
  return (
    <ScrollView contentContainerStyle={m.pageOuter}>
      <Text style={m.pageTitle}>My Loans</Text>
      {member.loan > 0 ? (
        <View style={m.loanDetailCard}>
          {[
            ["Total Loan", fmtCur(member.loan), C.orange],
            ["Remaining Balance", fmtCur(member.loanBalance), C.red],
            ["Amount Paid", fmtCur(member.loan - member.loanBalance), C.green],
          ].map(([l, v, c]) => (
            <View key={l} style={m.loanDetailRow}>
              <Text style={m.loanDetailLabel}>{l}</Text>
              <Text style={[m.loanDetailVal, { color: c }]}>{v}</Text>
            </View>
          ))}
          <View style={{ marginTop: 14 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <Text style={m.infoLabel}>Repayment Progress</Text>
              <Text
                style={[
                  m.infoLabel,
                  { color: C.green, fontFamily: "GoogleSans_700Bold" },
                ]}
              >
                {Math.round(progress * 100)}%
              </Text>
            </View>
            <View style={m.progressTrack}>
              <View
                style={[
                  m.progressFill,
                  { width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={m.emptyCard}>
          <Text style={{ fontSize: 36, marginBottom: 10, textAlign: "center" }}>
            📋
          </Text>
          <Text style={m.emptyTxt}>No active loans.</Text>
        </View>
      )}
      {loanApps.length > 0 && (
        <>
          <Text
            style={[m.infoSectionTitle, { marginTop: 20, marginBottom: 10 }]}
          >
            LOAN APPLICATIONS
          </Text>
          {loanApps.map((app) => (
            <View key={app.id} style={[m.infoSection, { marginBottom: 10 }]}>
              {[
                ["Amount", fmtCur(app.amount)],
                ["Purpose", app.purpose],
                ["Term", app.term],
                ["Status", app.status],
              ].map(([l, v]) => (
                <View key={l} style={m.infoRow}>
                  <Text style={m.infoLabel}>{l}</Text>
                  <Text
                    style={[
                      m.infoVal,
                      app.status === "Approved"
                        ? { color: C.green }
                        : app.status === "Rejected"
                          ? { color: C.red }
                          : {},
                    ]}
                  >
                    {v}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
};

const LoanGuidelinesView = () => (
  <ScrollView contentContainerStyle={m.pageOuter}>
    <Text style={m.pageTitle}>Loan Guidelines</Text>
    {[
      {
        title: "Eligibility",
        items: [
          "Must be an active member for at least 3 months.",
          "Must have no outstanding overdue loans.",
          "Savings balance must meet the minimum requirement.",
        ],
      },
      {
        title: "Loan Amount",
        items: [
          "Minimum loan: ₱5,000",
          "Maximum loan: Based on share capital (up to 3x)",
          "Interest rate: As determined by the cooperative board.",
        ],
      },
      {
        title: "Repayment",
        items: [
          "Monthly amortization via salary deduction or over-the-counter.",
          "Late payment penalty applies after due date.",
          "Early full payment is allowed without penalty.",
        ],
      },
    ].map((sec) => (
      <View key={sec.title} style={m.infoSection}>
        <Text style={m.infoSectionTitle}>{sec.title}</Text>
        {sec.items.map((item, i) => (
          <View key={i} style={m.tipBulletRow}>
            <Text style={[m.tipBulletDot, { color: C.navy }]}>•</Text>
            <Text style={[m.tipBulletTxt, { color: C.textMain }]}>{item}</Text>
          </View>
        ))}
      </View>
    ))}
  </ScrollView>
);

const ChangePwView = ({ member }) => {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (newPw.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPw !== confPw) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await changePassword(oldPw, newPw);
      setDone(true);
      setOldPw("");
      setNewPw("");
      setConfPw("");
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      setError(e.message || "Failed. Check your current password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={m.pageOuter}>
      <Text style={m.pageTitle}>Change Password</Text>
      <View style={m.formCard}>
        <Field
          label="Current Password"
          value={oldPw}
          onChangeText={(v) => {
            setOldPw(v);
            setError("");
          }}
          placeholder="Enter current password"
          secureEntry
        />
        <Field
          label="New Password"
          value={newPw}
          onChangeText={(v) => {
            setNewPw(v);
            setError("");
          }}
          placeholder="Min. 6 characters"
          secureEntry
        />
        <Field
          label="Confirm New Password"
          value={confPw}
          onChangeText={(v) => {
            setConfPw(v);
            setError("");
          }}
          placeholder="Re-enter new password"
          secureEntry
        />
        {error ? (
          <Text style={[m.fieldErr, { textAlign: "center", marginBottom: 8 }]}>
            {error}
          </Text>
        ) : null}
        {done ? (
          <Text
            style={{
              color: C.green,
              textAlign: "center",
              fontFamily: "GoogleSans_700Bold",
              marginBottom: 8,
            }}
          >
            Password changed successfully!
          </Text>
        ) : null}
        <TouchableOpacity
          style={m.saveBtn}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={m.saveBtnTxt}>Update Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const EditProfileView = ({ member }) => {
  const [contact, setContact] = useState(member.contact || "");
  const [email, setEmail] = useState(member.email || "");
  const [address, setAddress] = useState(member.address || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMemberProfile(member.uid, { contact, email, address });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.warn("updateMemberProfile error:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={m.pageOuter}>
      <Text style={m.pageTitle}>Edit Profile</Text>
      <View style={m.formCard}>
        <Text style={m.formSection}>Contact Information</Text>
        <Field
          label="Contact Number"
          value={contact}
          onChangeText={setContact}
          placeholder="e.g. 09171234567"
          keyboardType="phone-pad"
        />
        <Field
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          placeholder="e.g. juan@email.com"
          keyboardType="email-address"
        />
        <Field
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="e.g. Davao City"
        />
        <TouchableOpacity
          style={[m.saveBtn, saved && m.saveBtnDone]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={m.saveBtnTxt}>
              {saved ? "✓ Saved!" : "Save Changes"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const NotificationsView = ({ member }) => {
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    const unsub = listenNotifications(member.uid, setNotifs);
    return () => unsub();
  }, [member.uid]);

  return (
    <ScrollView contentContainerStyle={m.pageOuter}>
      <Text style={m.pageTitle}>Notifications</Text>
      {notifs.length === 0 ? (
        <View style={m.emptyCard}>
          <Text style={{ fontSize: 36, marginBottom: 10, textAlign: "center" }}>
            🔔
          </Text>
          <Text style={m.emptyTxt}>No notifications yet.</Text>
        </View>
      ) : (
        notifs.map((n) => (
          <TouchableOpacity
            key={n.id}
            style={[m.infoSection, { opacity: n.read ? 0.65 : 1 }]}
            onPress={() => markNotificationRead(member.uid, n.id)}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text
                style={[
                  m.infoSectionTitle,
                  { marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 },
                ]}
              >
                {n.title}
              </Text>
              {!n.read && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: C.gold,
                    marginTop: 3,
                  }}
                />
              )}
            </View>
            <Text
              style={{
                fontFamily: "GoogleSans_400Regular",
                fontSize: 13,
                color: C.textMain,
                lineHeight: 19,
              }}
            >
              {n.message}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
const SidebarGroup = ({ group, activeNav, onNav, onClose }) => {
  const isGroupActive = group.single
    ? activeNav === group.key
    : !!group.children?.find((c) => c.key === activeNav);
  const [open, setOpen] = useState(isGroupActive && !group.single);
  const anim = useRef(
    new Animated.Value(isGroupActive && !group.single ? 1 : 0),
  ).current;

  const toggle = () => {
    if (group.single) {
      onNav(group.key);
      if (onClose) onClose();
      return;
    }
    const next = !open;
    setOpen(next);
    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  };

  const maxHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (group.children?.length || 0) * 44],
  });
  const chevronRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"],
  });

  return (
    <View style={m.sidebarGroupWrap}>
      <TouchableOpacity
        style={[
          m.sidebarGroupHeader,
          group.single && activeNav === group.key && m.sidebarItemActive,
        ]}
        onPress={toggle}
        activeOpacity={0.8}
      >
        <Text
          style={[
            m.sidebarIcon,
            group.single && activeNav === group.key && m.sidebarIconActive,
          ]}
        >
          {group.icon}
        </Text>
        <Text
          style={[
            m.sidebarGroupLabel,
            group.single && activeNav === group.key && m.sidebarItemTxtActive,
            !group.single && isGroupActive && { color: C.gold },
          ]}
        >
          {group.label}
        </Text>
        {!group.single && (
          <Animated.Text
            style={[m.chevron, { transform: [{ rotate: chevronRotate }] }]}
          >
            ›
          </Animated.Text>
        )}
      </TouchableOpacity>
      {!group.single && (
        <Animated.View style={{ maxHeight, overflow: "hidden" }}>
          {group.children.map((child) => (
            <TouchableOpacity
              key={child.key}
              style={[
                m.sidebarChild,
                activeNav === child.key && m.sidebarChildActive,
              ]}
              onPress={() => {
                onNav(child.key);
                if (onClose) onClose();
              }}
              activeOpacity={0.8}
            >
              <Text style={m.sidebarChildDot}>
                {activeNav === child.key ? "◆" : "◇"}
              </Text>
              <Text
                style={[
                  m.sidebarChildTxt,
                  activeNav === child.key && m.sidebarChildTxtActive,
                ]}
              >
                {child.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

const MemberSidebar = ({ active, onNav, onClose }) => (
  <View style={m.sidebar}>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 8 }}
    >
      {SIDEBAR_GROUPS.map((group) => (
        <SidebarGroup
          key={group.key}
          group={group}
          activeNav={active}
          onNav={onNav}
          onClose={onClose}
        />
      ))}
    </ScrollView>
  </View>
);

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const MemberDashboard = ({ member, onLogout, isWide, isSmall }) => {
  const [activeNav, setActiveNav] = useState("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loanApps, setLoanApps] = useState([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Real-time loan apps listener
  useEffect(() => {
    const unsub = listenMemberLoanApps(member.uid, setLoanApps);
    return () => unsub();
  }, [member.uid]);

  const switchNav = (key) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 15,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveNav(key);
      slideAnim.setValue(15);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const renderContent = () => {
    switch (activeNav) {
      case "overview":
        return <TipsCarousel />;
      case "profile":
        return <ProfileView member={member} />;
      case "appform":
        return <AppFormView member={member} />;
      case "savings":
        return (
          <FinanceView
            title="Savings"
            icon="💰"
            value={member.savings}
            label="Total Savings Balance"
            color={C.green}
          />
        );
      case "sharecap":
        return (
          <FinanceView
            title="Share Capital"
            icon="📊"
            value={member.shares}
            label="Total Share Capital"
            color={C.gold}
          />
        );
      case "timedeposit":
        return (
          <FinanceView
            title="Time Deposit"
            icon="🏦"
            value={0}
            label="Time Deposit Balance"
            color={C.blue}
          />
        );
      case "applyloan":
        return <ApplyLoanView member={member} />;
      case "myloans":
        return <LoansView member={member} loanApps={loanApps} />;
      case "loanguidelines":
        return <LoanGuidelinesView />;
      case "changepw":
        return <ChangePwView member={member} />;
      case "editprofile":
        return <EditProfileView member={member} />;
      case "notifications":
        return <NotificationsView member={member} />;
      default:
        return <TipsCarousel />;
    }
  };

  const initials =
    member.name
      ?.split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("") || "ME";

  return (
    <View style={m.dashRoot}>
      <View
        style={[m.dashTopbar, { paddingTop: Platform.OS === "web" ? 0 : 44 }]}
      >
        <View style={m.dashTopLeft}>
          {!isWide && (
            <TouchableOpacity
              style={m.menuBtn}
              onPress={() => setDrawerOpen((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={m.menuBtnTxt}>☰</Text>
            </TouchableOpacity>
          )}
          <View style={m.dashLogoMark}>
            <Text style={m.dashLogoTxt}>CS</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[m.dashTopTitle, { fontSize: isSmall ? 12 : 14 }]}
              numberOfLines={1}
            >
              Member Dashboard
            </Text>
            {!isSmall && (
              <Text style={m.dashTopSub} numberOfLines={1}>
                CLIMBS Membership Portal
              </Text>
            )}
          </View>
        </View>
        <View style={m.dashTopRight}>
          <View style={m.dashMemberBadge}>
            <View style={m.dashMemberAvatar}>
              <Text style={m.dashMemberAvatarTxt}>{initials}</Text>
            </View>
            {isWide && (
              <Text style={m.dashMemberName} numberOfLines={1}>
                {member.name}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={m.logoutBtn}
            onPress={onLogout}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={m.logoutTxt}>{isSmall ? "↩" : "Logout"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={m.dashBody}>
        {isWide && <MemberSidebar active={activeNav} onNav={switchNav} />}
        <Animated.View
          style={[
            m.dashContent,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {renderContent()}
        </Animated.View>
      </View>

      {/* Mobile drawer */}
      {!isWide && drawerOpen && (
        <TouchableOpacity
          style={m.drawerOverlay}
          activeOpacity={1}
          onPress={() => setDrawerOpen(false)}
        >
          <View style={m.drawerSidebar}>
            <MemberSidebar
              active={activeNav}
              onNav={switchNav}
              onClose={() => setDrawerOpen(false)}
            />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export default function MemberCoopScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const isSmall = width < 400;

  // ── Route params from CoopScreen ──────────────────────────────────────────
  // autoMember: already-authenticated member object passed from CoopScreen login
  // startView:  'register' to open registration directly
  const autoMember = route?.params?.autoMember;
  const startView = route?.params?.startView;

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold,
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_700Bold,
  });

  const [view, setView] = useState(V.SPLASH);
  const [member, setMember] = useState(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Auto-login if session persists OR if member passed from CoopScreen ────
  useEffect(() => {
    // If CoopScreen already logged in and passed member data → go straight to dashboard
    if (autoMember) {
      listenMember(autoMember.uid, (data) => setMember(data));
      transitionTo(V.DASHBOARD);
      return;
    }

    // If CoopScreen wants to open register directly
    if (startView === "register") {
      transitionTo(V.REGISTER);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const { getMember } = await import("../firebase/firebaseService");
          const memberDoc = await getMember(user.uid);
          // Set up real-time listener for this member
          const { listenMember: lm } =
            await import("../firebase/firebaseService");
          lm(user.uid, (data) => setMember(data));
          transitionTo(V.DASHBOARD);
        } catch {
          transitionTo(V.LOGIN);
        }
      } else {
        transitionTo(V.LOGIN);
      }
    });
    return () => unsub();
  }, []);

  const transitionTo = (nextView, m) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      if (m !== undefined) setMember(m);
      setView(nextView);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleLogin = (m) => {
    // Start real-time member listener after login
    listenMember(m.uid, (data) => setMember(data));
    transitionTo(V.DASHBOARD);
  };

  const handleLogout = async () => {
    await logoutUser();
    setMember(null);
    // Go back to CoopScreen (login page) if navigation is available
    if (navigation) {
      navigation.navigate("CoopScreen");
    } else {
      transitionTo(V.LOGIN);
    }
  };

  if (!fontsLoaded || view === V.SPLASH) {
    return (
      <View style={{ flex: 1 }}>
        <AppBg />
        <Spinner message="Loading..." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AppBg />
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {(view === V.LOGIN || view === V.REGISTER) && (
          <HeaderBar
            title={view === V.LOGIN ? "Member Login" : "Register as New Member"}
            subtitle="CESLA MULTI-PURPOSE COOPERATIVE"
            onBack={
              view === V.REGISTER
                ? () => transitionTo(V.LOGIN)
                : navigation
                  ? () => navigation.goBack()
                  : null
            }
            isWide={isWide}
            isSmall={isSmall}
          />
        )}
        {view === V.LOGIN && (
          <LoginScreen
            onLogin={handleLogin}
            onGoRegister={() => transitionTo(V.REGISTER)}
            isWide={isWide}
          />
        )}
        {view === V.REGISTER && (
          <RegisterScreen
            onGoLogin={() => transitionTo(V.LOGIN)}
            onSuccess={() => transitionTo(V.LOGIN)}
          />
        )}
        {view === V.DASHBOARD && member && (
          <MemberDashboard
            member={member}
            onLogout={handleLogout}
            isWide={isWide}
            isSmall={isSmall}
          />
        )}
      </Animated.View>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a2d4e",
    borderBottomWidth: 2,
    borderColor: C.gold,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: { color: "#fff", fontSize: 18, fontWeight: "600" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontFamily: "NotoSerif_700Bold",
    color: "#fff",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  headerSub: {
    fontFamily: "GoogleSans_400Regular",
    color: C.gold,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 2,
  },

  loginOuter: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  loginCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.20)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    padding: 24,
    shadowColor: "#011f4b",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
  },
  loginAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(201,168,76,0.25)",
    borderWidth: 2,
    borderColor: "rgba(201,168,76,0.50)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  loginTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 22,
    color: C.navy,
    textAlign: "center",
    marginBottom: 4,
  },
  loginSubtitle: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 19,
  },
  hintBox: {
    backgroundColor: "rgba(201,168,76,0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.35)",
    padding: 14,
    marginBottom: 18,
  },
  hintTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: C.textMain,
    lineHeight: 20,
  },
  hintBold: { fontFamily: "GoogleSans_700Bold", fontSize: 13, color: C.navy },
  loginBtn: {
    borderRadius: 28,
    overflow: "hidden",
    marginTop: 16,
    marginBottom: 10,
    shadowColor: C.gold,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  loginBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  loginBtnArrow: { fontSize: 20, color: C.navy, fontWeight: "700" },
  loginBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 16,
    color: C.navy,
    letterSpacing: 2,
  },
  loginFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    flexWrap: "wrap",
    gap: 4,
  },
  loginFooterTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: C.textMuted,
  },
  loginFooterLink: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: C.gold,
  },

  regCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.80)",
    padding: 24,
    shadowColor: "#011f4b",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
  },
  regAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.navyDeep,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  regTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
    color: C.navy,
    textAlign: "center",
    marginBottom: 4,
  },
  regSubtitle: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 22,
  },
  stepItem: { alignItems: "center", width: 72 },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e5e8ee",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  stepCircleActive: { backgroundColor: C.gold },
  stepNum: { fontFamily: "GoogleSans_700Bold", fontSize: 13, color: "#aaa" },
  stepNumActive: { color: C.navy },
  stepLbl: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 9,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 13,
  },
  stepLblActive: { color: C.navy, fontFamily: "GoogleSans_700Bold" },
  stepLine: { width: 28, height: 1, backgroundColor: "#ddd", marginTop: 13 },
  uidBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.navyDeep,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  uidLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  uidValue: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 17,
    color: C.gold,
    letterSpacing: 0.5,
  },
  copyBtn: {
    backgroundColor: C.navyMid,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  copyBtnDone: {
    backgroundColor: "rgba(46,204,113,0.30)",
    borderColor: C.green,
  },
  copyBtnTxt: { fontFamily: "GoogleSans_700Bold", fontSize: 12, color: C.gold },
  uidWarning: {
    backgroundColor: "rgba(201,168,76,0.10)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.30)",
    padding: 14,
    marginBottom: 16,
  },
  uidWarningTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: C.textMain,
    lineHeight: 18,
  },
  uidWarningBold: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: C.textMain,
  },
  createBtn: {
    backgroundColor: C.navyDeep,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 10,
    shadowColor: C.navy,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  createBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 15,
    color: "#fff",
    letterSpacing: 2,
  },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: C.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(240,245,250,0.90)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "rgba(200,215,230,0.80)",
  },
  fieldRowDisabled: {
    backgroundColor: "rgba(220,230,240,0.60)",
    borderColor: "rgba(200,215,230,0.40)",
  },
  fieldRowError: { borderColor: C.red },
  fieldInput: {
    flex: 1,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 14,
    color: C.navy,
  },
  fieldErr: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: C.red,
    marginTop: 4,
  },

  dashRoot: { flex: 1 },
  dashTopbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15,30,53,0.95)",
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderColor: C.gold,
    gap: 10,
  },
  dashTopLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dashLogoMark: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: C.gold,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  dashLogoTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: C.navyDark,
    fontWeight: "800",
  },
  dashTopTitle: { fontFamily: "GoogleSans_700Bold", color: "#fff" },
  dashTopSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 9,
    color: C.gold,
  },
  dashTopRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  dashMemberBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
  dashMemberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(201,168,76,0.30)",
    borderWidth: 1.5,
    borderColor: C.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  dashMemberAvatarTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: C.gold,
  },
  dashMemberName: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(201,168,76,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.50)",
  },
  logoutTxt: { fontFamily: "GoogleSans_700Bold", fontSize: 12, color: C.gold },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuBtnTxt: { color: "#fff", fontSize: 20 },
  dashBody: { flex: 1, flexDirection: "row" },
  dashContent: { flex: 1 },
  sidebar: {
    width: 160,
    backgroundColor: "rgba(15,30,53,0.95)",
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  sidebarGroupWrap: { marginHorizontal: 6, marginBottom: 2 },
  sidebarGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    minHeight: 44,
  },
  sidebarGroupLabel: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    flex: 1,
  },
  chevron: { color: "rgba(255,255,255,0.40)", fontSize: 18, fontWeight: "600" },
  sidebarItemActive: { backgroundColor: C.gold },
  sidebarIcon: {
    fontSize: 14,
    color: "rgba(255,255,255,0.50)",
    width: 18,
    textAlign: "center",
  },
  sidebarIconActive: { color: C.navyDark },
  sidebarItemTxtActive: { fontFamily: "GoogleSans_700Bold", color: C.navyDark },
  sidebarChild: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    marginBottom: 1,
    minHeight: 40,
  },
  sidebarChildActive: { backgroundColor: "rgba(201,168,76,0.18)" },
  sidebarChildDot: {
    fontSize: 8,
    color: "rgba(255,255,255,0.35)",
    width: 12,
    textAlign: "center",
  },
  sidebarChildTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    flex: 1,
  },
  sidebarChildTxtActive: { fontFamily: "GoogleSans_700Bold", color: C.gold },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.50)",
    zIndex: 10,
  },
  drawerSidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 170,
    zIndex: 11,
  },

  pageOuter: { padding: 16, paddingBottom: 48 },
  pageTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 19,
    color: C.navy,
    marginBottom: 4,
  },
  pageSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: C.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  carouselWrap: { flex: 1, padding: 14 },
  tipCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    minHeight: 210,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  tipIcon: { fontSize: 42, marginBottom: 10 },
  tipTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: "#fff",
    marginBottom: 14,
    textAlign: "center",
  },
  tipBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 7,
    alignSelf: "flex-start",
  },
  tipBulletDot: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    lineHeight: 22,
  },
  tipBulletTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 21,
    flex: 1,
  },
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginTop: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  dotActive: { backgroundColor: C.gold, width: 20 },

  profileHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.10)",
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.navyDeep,
    borderWidth: 2.5,
    borderColor: C.gold,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  profileAvatarTxt: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
    color: "#fff",
  },
  profileName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 17,
    color: C.navy,
    flexShrink: 1,
  },
  profileId: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  statusActive: {
    backgroundColor: "rgba(46,204,113,0.22)",
    borderWidth: 1,
    borderColor: "rgba(46,204,113,0.55)",
  },
  statusPending: {
    backgroundColor: "rgba(245,166,35,0.18)",
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.45)",
  },
  statusTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "#fff",
    letterSpacing: 1,
  },

  infoSection: {
    backgroundColor: "rgba(255,255,255,0.30)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    marginBottom: 14,
  },
  infoSectionTitle: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: C.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.08)",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.06)",
  },
  infoLabel: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: C.textMuted,
    flex: 1,
  },
  infoVal: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: C.navy,
    flex: 2,
    textAlign: "right",
  },

  formCard: {
    backgroundColor: "rgba(255,255,255,0.30)",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
  },
  formSection: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: C.navy,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.10)",
  },
  saveBtn: {
    backgroundColor: C.navyDeep,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 18,
    shadowColor: C.navy,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  saveBtnDone: { backgroundColor: C.green },
  saveBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 15,
    color: "#fff",
    letterSpacing: 1,
  },

  financeHeroCard: {
    backgroundColor: "rgba(255,255,255,0.30)",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    marginBottom: 20,
  },
  financeHeroAmt: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 32,
    marginBottom: 6,
  },
  financeHeroLabel: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: C.textMuted,
  },
  loanDetailCard: {
    backgroundColor: "rgba(255,255,255,0.30)",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    marginBottom: 16,
  },
  loanDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.06)",
  },
  loanDetailLabel: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: C.textMuted,
    flex: 1,
  },
  loanDetailVal: { fontFamily: "NotoSerif_700Bold", fontSize: 17 },
  progressTrack: {
    height: 8,
    backgroundColor: "rgba(1,31,75,0.12)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: 8, backgroundColor: C.green, borderRadius: 4 },
  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 16,
    padding: 44,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
  },
  emptyTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 14,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
});
