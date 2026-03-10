// src/screens/CoopScreen.js
// CESLA MPC — Cooperative Member Portal Entry
// Login + Register in one screen (AsyncStorage, no Firebase)

import React, { useEffect, useRef, useState } from "react";
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
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import {
  NotoSerif_700Bold,
  NotoSerif_700Bold_Italic,
} from "@expo-google-fonts/noto-serif";
import {
  GoogleSans_400Regular,
  GoogleSans_500Medium,
  GoogleSans_700Bold,
} from "@expo-google-fonts/google-sans";
import * as Clipboard from "expo-clipboard";
import {
  loginByUserId,
  registerMember,
  generateNextUserId,
} from "./localAuthService";

// ─── BACKGROUND ──────────────────────────────────────────────────────────────
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
    <LinearGradient
      colors={[
        "rgba(50,80,120,0.45)",
        "rgba(50,80,120,0.0)",
        "rgba(50,80,120,0.45)",
      ]}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
    <LinearGradient
      colors={["rgba(50,80,120,0.0)", "rgba(60,90,130,0.35)"]}
      locations={[0.4, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  </>
);

// ─── FIELD COMPONENT ─────────────────────────────────────────────────────────
// Field para sa LOGIN (original — full width, walang flex override)
const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureEntry,
  showToggle,
  onToggle,
  error,
  autoCapitalize,
}) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.fieldRow, error && styles.fieldRowErr]}>
      <TextInput
        style={[styles.fieldInput, { flex: 1 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(15,30,53,0.35)"
        secureTextEntry={!!secureEntry}
        autoCapitalize={autoCapitalize || "none"}
        autoCorrect={false}
      />
      {showToggle && (
        <TouchableOpacity
          onPress={onToggle}
          style={{ padding: 6 }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <MaterialIcons
            name={showToggle && !secureEntry ? "visibility-off" : "visibility"}
            size={20}
            color="rgba(15,30,53,0.40)"
          />
        </TouchableOpacity>
      )}
    </View>
    {error ? <Text style={styles.fieldErr}>{error}</Text> : null}
  </View>
);

// FieldReg para sa REGISTER — may flex:1 + minWidth:0 para fit sa 2-column row
const FieldReg = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureEntry,
  showToggle,
  onToggle,
  error,
  autoCapitalize,
}) => (
  <View style={[styles.fieldGroup, { flex: 1, minWidth: 0 }]}>
    <Text style={styles.fieldLabel} numberOfLines={1}>
      {label}
    </Text>
    <View style={[styles.fieldRow, error && styles.fieldRowErr]}>
      <TextInput
        style={[styles.fieldInput, { flex: 1, minWidth: 0 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(15,30,53,0.35)"
        secureTextEntry={!!secureEntry}
        autoCapitalize={autoCapitalize || "none"}
        autoCorrect={false}
      />
      {showToggle && (
        <TouchableOpacity
          onPress={onToggle}
          style={{ padding: 3 }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <MaterialIcons
            name={secureEntry ? "visibility" : "visibility-off"}
            size={16}
            color="rgba(15,30,53,0.40)"
          />
        </TouchableOpacity>
      )}
    </View>
    {error ? <Text style={styles.fieldErr}>{error}</Text> : null}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
export default function CoopScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold,
    NotoSerif_700Bold_Italic,
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_700Bold,
  });

  // ── view: 'login' | 'register' | 'success' ───────────────────────────────
  const [view, setView] = useState("login");

  // ── LOGIN state ───────────────────────────────────────────────────────────
  const [userId, setUserId] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ── REGISTER state ────────────────────────────────────────────────────────
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConf, setShowRegConf] = useState(false);
  const [genUid, setGenUid] = useState("Loading...");
  const [copied, setCopied] = useState(false);
  const [regErrors, setRegErrors] = useState({});
  const [regLoading, setRegLoading] = useState(false);

  // ── SUCCESS state ─────────────────────────────────────────────────────────
  const [registeredMember, setRegisteredMember] = useState(null);

  // ── Animations ────────────────────────────────────────────────────────────
  const hdrFade = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-18)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardTrans = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(hdrTrans, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(cardFade, {
        toValue: 1,
        duration: 550,
        delay: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardTrans, {
        toValue: 0,
        duration: 550,
        delay: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Fetch preview UID when switching to register
  useEffect(() => {
    if (view === "register") {
      setGenUid("Loading...");
      generateNextUserId()
        .then(setGenUid)
        .catch(() => setGenUid("CESLA-2026-XXXXX"));
    }
  }, [view]);

  // ── Animate card on view switch ───────────────────────────────────────────
  const switchView = (next) => {
    Animated.timing(cardFade, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      setView(next);
      setLoginErr("");
      setRegErrors({});
      Animated.timing(cardFade, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    });
  };

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!userId.trim()) {
      setLoginErr("Please enter your User ID.");
      return;
    }
    if (!pw.trim()) {
      setLoginErr("Please enter your password.");
      return;
    }
    setLoginLoading(true);
    setLoginErr("");
    try {
      const member = await loginByUserId(userId.trim(), pw);
      navigation.navigate("MemberCoopScreen", { autoMember: member });
    } catch (e) {
      setLoginErr(e.message || "Invalid User ID or password.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ── REGISTER ──────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    const e = {};
    if (!lastName.trim()) e.lastName = "Last name is required.";
    if (!firstName.trim()) e.firstName = "First name is required.";
    if (regPw.length < 6) e.pw = "Password must be at least 6 characters.";
    if (regPw !== regConfirm) e.cpw = "Passwords do not match.";
    if (Object.keys(e).length > 0) {
      setRegErrors(e);
      return;
    }
    setRegLoading(true);
    try {
      const member = await registerMember({
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        password: regPw,
      });
      setRegisteredMember(member);
      switchView("success");
    } catch (err) {
      setRegErrors({
        general: err.message || "Registration failed. Try again.",
      });
    } finally {
      setRegLoading(false);
    }
  };

  // ── Copy UID ──────────────────────────────────────────────────────────────
  const handleCopy = async (uid) => {
    await Clipboard.setStringAsync(uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1 }}>
        <AppBg />
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#c9a84c" />
        </View>
      </View>
    );
  }

  const headerLabel =
    view === "register" ? (
      <>
        <Text style={styles.headerWhite}>Register as </Text>
        <Text style={styles.headerGold}>New Member</Text>
      </>
    ) : view === "success" ? (
      <>
        <Text style={styles.headerWhite}>Registration </Text>
        <Text style={styles.headerGold}>Complete</Text>
      </>
    ) : (
      <>
        <Text style={styles.headerWhite}>Member </Text>
        <Text style={styles.headerGold}>Login</Text>
      </>
    );

  return (
    <View style={{ flex: 1 }}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <AppBg />

      {/* HEADER */}
      <Animated.View
        style={[
          styles.headerWrap,
          {
            paddingTop: Platform.OS === "web" ? 16 : 50,
            marginHorizontal: isWide ? 20 : isSmall ? 10 : 16,
            opacity: hdrFade,
            transform: [{ translateY: hdrTrans }],
          },
        ]}
      >
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: isWide ? 36 : 14,
              paddingVertical: isWide ? 16 : 10,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() =>
              view !== "login"
                ? switchView("login")
                : navigation && navigation.goBack()
            }
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text
              style={[
                styles.headerH1,
                { fontSize: isWide ? 22 : isSmall ? 14 : 17 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {headerLabel}
            </Text>
            <Text style={[styles.headerSub, { fontSize: isWide ? 10 : 8 }]}>
              CESLA MULTI-PURPOSE COOPERATIVE
            </Text>
          </View>
          <View style={{ width: 40, flexShrink: 0 }} />
        </View>
      </Animated.View>

      {/* BODY */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            paddingHorizontal: isWide ? 60 : 20,
            paddingVertical: 16,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardFade,
                transform: [{ translateY: cardTrans }],
                width: "100%",
                maxWidth: isWide ? 400 : 380,
              },
            ]}
          >
            {/* ══ LOGIN ══ */}
            {view === "login" && (
              <>
                <View style={styles.avatarWrap}>
                  <LinearGradient
                    colors={["rgba(201,168,76,0.30)", "rgba(201,168,76,0.10)"]}
                    style={styles.avatarGrad}
                  >
                    <MaterialIcons
                      name="person"
                      size={isWide ? 34 : 28}
                      color="#c9a84c"
                    />
                  </LinearGradient>
                </View>
                <Text
                  style={[styles.cardTitle, { fontSize: isWide ? 22 : 19 }]}
                >
                  Welcome Back!
                </Text>
                <Text style={styles.cardSub}>
                  Login to access your membership account
                </Text>
                <View style={styles.hintBox}>
                  <Text style={styles.hintTxt}>
                    {"🔑 Use your "}
                    <Text style={styles.hintBold}>User ID</Text>
                    {" (e.g. "}
                    <Text style={[styles.hintBold, { color: "#c9a84c" }]}>
                      CESLA-2026-00001
                    </Text>
                    {") and "}
                    <Text style={[styles.hintBold, { color: "#c9a84c" }]}>
                      Password
                    </Text>
                    {" to login."}
                  </Text>
                </View>
                <Field
                  label="USER ID"
                  value={userId}
                  onChangeText={(v) => {
                    setUserId(v);
                    setLoginErr("");
                  }}
                  placeholder="CESLA-2026-00001"
                />
                <Field
                  label="PASSWORD"
                  value={pw}
                  onChangeText={(v) => {
                    setPw(v);
                    setLoginErr("");
                  }}
                  placeholder="Enter your password"
                  secureEntry={!showPw}
                  showToggle
                  onToggle={() => setShowPw((p) => !p)}
                />
                {loginErr ? (
                  <View style={styles.errorBox}>
                    <MaterialIcons
                      name="error-outline"
                      size={14}
                      color="#e74c3c"
                      style={{ marginTop: 1 }}
                    />
                    <Text style={styles.errorTxt}>{loginErr}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[styles.primaryBtn, loginLoading && { opacity: 0.65 }]}
                  onPress={handleLogin}
                  activeOpacity={0.85}
                  disabled={loginLoading}
                >
                  <LinearGradient
                    colors={["#c9a84c", "#e8c87a"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGrad}
                  >
                    {loginLoading ? (
                      <ActivityIndicator color="#0d1b3e" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnArrow}>→</Text>
                        <Text style={styles.primaryBtnTxt}>LOGIN</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                <View style={styles.switchRow}>
                  <Text style={styles.switchTxt}>Don't have an account? </Text>
                  <TouchableOpacity
                    onPress={() => switchView("register")}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.switchLink}>
                      Register as New Member
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ══ REGISTER ══ */}
            {view === "register" && (
              <>
                <View style={styles.avatarWrap}>
                  <LinearGradient
                    colors={["rgba(201,168,76,0.30)", "rgba(201,168,76,0.10)"]}
                    style={styles.avatarGrad}
                  >
                    <MaterialIcons
                      name="person-add"
                      size={isWide ? 30 : 24}
                      color="#c9a84c"
                    />
                  </LinearGradient>
                </View>
                <Text
                  style={[styles.cardTitle, { fontSize: isWide ? 22 : 19 }]}
                >
                  Create Your Account
                </Text>
                <Text style={styles.cardSub}>
                  CESLA Multi-Purpose Cooperative
                </Text>

                {/* Steps */}
                <View style={styles.stepRow}>
                  {[
                    { n: 1, lbl: "Create\nAccount" },
                    { n: 2, lbl: "Admin\nApproval" },
                    { n: 3, lbl: "Fill\nApplication" },
                  ].map((step, i) => (
                    <View
                      key={step.n}
                      style={{ flexDirection: "row", alignItems: "flex-start" }}
                    >
                      <View style={styles.stepItem}>
                        <View
                          style={[
                            styles.stepCircle,
                            step.n === 1 && styles.stepCircleActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.stepNum,
                              step.n === 1 && styles.stepNumActive,
                            ]}
                          >
                            {step.n}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.stepLbl,
                            step.n === 1 && styles.stepLblActive,
                          ]}
                        >
                          {step.lbl}
                        </Text>
                      </View>
                      {i < 2 && <View style={styles.stepLine} />}
                    </View>
                  ))}
                </View>

                {/* UID Preview */}
                <View style={styles.uidBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uidLabel}>
                      🔑 YOUR UNIQUE USER ID (GAMITON SA LOGIN)
                    </Text>
                    <Text style={styles.uidValue}>{genUid}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.copyBtn, copied && styles.copyBtnDone]}
                    onPress={() => handleCopy(genUid)}
                  >
                    <Text style={styles.copyBtnTxt}>
                      {copied ? "✓ Copied" : "📋 Copy"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.uidWarning}>
                  <Text style={styles.uidWarningTxt}>
                    {"⚠️ I-save ang imong User ID! "}
                    <Text style={styles.uidWarningBold}>
                      Kini gamiton sa pag-login human ma-approve sa admin.
                    </Text>
                  </Text>
                </View>

                {/* Row 1: Last Name + First Name */}
                <View style={styles.fieldRow2}>
                  <FieldReg
                    label="LAST NAME"
                    value={lastName}
                    onChangeText={(v) => {
                      setLastName(v);
                      setRegErrors((e) => ({ ...e, lastName: "" }));
                    }}
                    placeholder="Dela Cruz"
                    error={regErrors.lastName}
                    autoCapitalize="words"
                  />
                  <FieldReg
                    label="FIRST NAME"
                    value={firstName}
                    onChangeText={(v) => {
                      setFirstName(v);
                      setRegErrors((e) => ({ ...e, firstName: "" }));
                    }}
                    placeholder="Juan"
                    error={regErrors.firstName}
                    autoCapitalize="words"
                  />
                </View>

                {/* Row 2: Middle Name + Password */}
                <View style={styles.fieldRow2}>
                  <FieldReg
                    label="MIDDLE NAME"
                    value={middleName}
                    onChangeText={(v) => setMiddleName(v)}
                    placeholder="Santos (optional)"
                    autoCapitalize="words"
                  />
                  <FieldReg
                    label="PASSWORD"
                    value={regPw}
                    onChangeText={(v) => {
                      setRegPw(v);
                      setRegErrors((e) => ({ ...e, pw: "" }));
                    }}
                    placeholder="Min. 6 chars"
                    secureEntry={!showRegPw}
                    showToggle
                    onToggle={() => setShowRegPw((p) => !p)}
                    error={regErrors.pw}
                  />
                </View>

                {/* Row 3: Confirm Password full width */}
                <View style={{ width: "100%" }}>
                  <FieldReg
                    label="CONFIRM PASSWORD"
                    value={regConfirm}
                    onChangeText={(v) => {
                      setRegConfirm(v);
                      setRegErrors((e) => ({ ...e, cpw: "" }));
                    }}
                    placeholder="Re-enter your password"
                    secureEntry={!showRegConf}
                    showToggle
                    onToggle={() => setShowRegConf((p) => !p)}
                    error={regErrors.cpw}
                  />
                </View>

                {regErrors.general ? (
                  <View style={styles.errorBox}>
                    <MaterialIcons
                      name="error-outline"
                      size={14}
                      color="#e74c3c"
                      style={{ marginTop: 1 }}
                    />
                    <Text style={styles.errorTxt}>{regErrors.general}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.primaryBtn, regLoading && { opacity: 0.65 }]}
                  onPress={handleRegister}
                  activeOpacity={0.85}
                  disabled={regLoading}
                >
                  <LinearGradient
                    colors={["#c9a84c", "#e8c87a"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGrad}
                  >
                    {regLoading ? (
                      <ActivityIndicator color="#0d1b3e" />
                    ) : (
                      <Text style={styles.primaryBtnTxt}>CREATE ACCOUNT</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.switchRow}>
                  <Text style={styles.switchTxt}>
                    Already have an account?{" "}
                  </Text>
                  <TouchableOpacity
                    onPress={() => switchView("login")}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.switchLink}>Login here</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ══ SUCCESS ══ */}
            {view === "success" && registeredMember && (
              <>
                <View style={styles.avatarWrap}>
                  <LinearGradient
                    colors={["rgba(46,204,113,0.30)", "rgba(46,204,113,0.10)"]}
                    style={styles.avatarGrad}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={isWide ? 32 : 28}
                      color="#2ecc71"
                    />
                  </LinearGradient>
                </View>
                <Text
                  style={[styles.cardTitle, { fontSize: isWide ? 22 : 19 }]}
                >
                  Registration Successful!
                </Text>
                <Text style={styles.cardSub}>
                  Your account has been created. Wait for admin approval.
                </Text>

                <View style={[styles.uidBox, { marginTop: 6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uidLabel}>
                      🔑 YOUR USER ID (GAMITON SA LOGIN)
                    </Text>
                    <Text style={styles.uidValue}>
                      {registeredMember.userId}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.copyBtn, copied && styles.copyBtnDone]}
                    onPress={() => handleCopy(registeredMember.userId)}
                  >
                    <Text style={styles.copyBtnTxt}>
                      {copied ? "✓ Copied" : "📋 Copy"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.pendingBox}>
                  <MaterialIcons
                    name="hourglass-empty"
                    size={18}
                    color="#c9a84c"
                  />
                  <Text style={styles.pendingTxt}>
                    Your account is{" "}
                    <Text style={styles.pendingBold}>
                      Pending Admin Approval.
                    </Text>
                    {"\n"}Please wait for admin to activate before logging in.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    setUserId(registeredMember.userId);
                    setPw("");
                    setLastName("");
                    setFirstName("");
                    setMiddleName("");
                    setRegPw("");
                    setRegConfirm("");
                    setRegisteredMember(null);
                    switchView("login");
                  }}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#c9a84c", "#e8c87a"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGrad}
                  >
                    <Text style={styles.primaryBtnArrow}>→</Text>
                    <Text style={styles.primaryBtnTxt}>GO TO LOGIN</Text>
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

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerWrap: { zIndex: 100 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#304674",
    borderRadius: 14,
    borderBottomWidth: 1,
    borderColor: "rgba(201,168,76,0.25)",
    shadowColor: "#011f4b",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  backIcon: { color: "#fff", fontSize: 17, fontWeight: "600" },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 10 },
  headerH1: {
    fontFamily: "NotoSerif_700Bold",
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  headerWhite: { color: "#ffffff" },
  headerGold: {
    fontFamily: "NotoSerif_700Bold_Italic",
    color: "#c9a84c",
    fontStyle: "italic",
  },
  headerSub: {
    fontFamily: "GoogleSans_400Regular",
    color: "rgba(232,200,122,0.75)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 2,
    textAlign: "center",
  },

  card: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "rgba(178,203,222,0.38)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    padding: 14,
    alignItems: "center",
    shadowColor: "#011f4b",
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
    ...(Platform.OS === "web" ? { backdropFilter: "blur(16px)" } : {}),
  },
  avatarWrap: { marginBottom: 8 },
  avatarGrad: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.45)",
  },
  cardTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontWeight: "800",
    color: "#011f4b",
    textAlign: "center",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  cardSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.60)",
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 16,
  },
  hintBox: {
    width: "100%",
    backgroundColor: "rgba(201,168,76,0.14)",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.38)",
    padding: 9,
    marginBottom: 11,
  },
  hintTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.80)",
    lineHeight: 17,
  },
  hintBold: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#011f4b",
  },

  fieldGroup: { width: "100%", marginBottom: 9 },
  fieldLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "rgba(1,31,75,0.55)",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(240,246,252,0.92)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "rgba(200,218,235,0.75)",
    shadowColor: "#011f4b",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fieldRowErr: { borderColor: "#e74c3c" },
  fieldInput: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "#0d1b3e",
    letterSpacing: 0.2,
  },
  fieldErr: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 10,
    color: "#e74c3c",
    marginTop: 3,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    width: "100%",
    backgroundColor: "rgba(231,76,60,0.10)",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(231,76,60,0.28)",
    padding: 9,
    marginBottom: 5,
  },
  errorTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "#e74c3c",
    flex: 1,
    lineHeight: 17,
  },

  primaryBtn: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 10,
    shadowColor: "#c9a84c",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  primaryBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    gap: 8,
  },
  primaryBtnArrow: { fontSize: 16, color: "#0d1b3e", fontWeight: "800" },
  primaryBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "#0d1b3e",
    letterSpacing: 2.5,
  },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 2,
  },
  switchTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.55)",
  },
  switchLink: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#c9a84c",
    textDecorationLine: "underline",
  },

  // 2-column field row
  fieldRow2: { flexDirection: "row", width: "100%", gap: 6, marginBottom: 0 },

  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 11,
    width: "100%",
  },
  stepItem: { alignItems: "center", width: 62 },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.40)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 3,
  },
  stepCircleActive: { backgroundColor: "#c9a84c", borderColor: "#c9a84c" },
  stepNum: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "rgba(1,31,75,0.45)",
  },
  stepNumActive: { color: "#0d1b3e" },
  stepLbl: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 8,
    color: "rgba(1,31,75,0.50)",
    textAlign: "center",
    lineHeight: 12,
  },
  stepLblActive: { color: "#011f4b", fontFamily: "GoogleSans_700Bold" },
  stepLine: {
    width: 20,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.40)",
    marginTop: 10,
  },

  uidBox: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "rgba(15,30,53,0.75)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.35)",
    padding: 11,
    marginBottom: 8,
    gap: 10,
  },
  uidLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 8,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  uidValue: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 14,
    color: "#c9a84c",
    letterSpacing: 0.5,
  },
  copyBtn: {
    backgroundColor: "rgba(201,168,76,0.20)",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.50)",
  },
  copyBtnDone: {
    backgroundColor: "rgba(46,204,113,0.30)",
    borderColor: "#2ecc71",
  },
  copyBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "#c9a84c",
  },
  uidWarning: {
    width: "100%",
    backgroundColor: "rgba(201,168,76,0.14)",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.38)",
    padding: 9,
    marginBottom: 10,
  },
  uidWarningTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.80)",
    lineHeight: 17,
  },
  uidWarningBold: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#011f4b",
  },

  pendingBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: "rgba(201,168,76,0.14)",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.38)",
    padding: 10,
    marginBottom: 12,
  },
  pendingTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.80)",
    lineHeight: 17,
    flex: 1,
  },
  pendingBold: { fontFamily: "GoogleSans_700Bold", color: "#011f4b" },
});
