// src/screens/CoopScreen.js
// CESLA MPC — Cooperative Member Portal Entry
// Acts as router: shows Login → navigates to MemberCoopScreen (dashboard/register)

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
import { loginByUserId } from "../firebase/firebaseService";

// ─── BACKGROUND (shared across all screens) ────────────────────────────────
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

  // ── form state ─────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── animations ─────────────────────────────────────────────────────────────
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
    ]).start();
    Animated.parallel([
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

  // ── login handler ──────────────────────────────────────────────────────────
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
      // Navigate to MemberCoopScreen passing the authenticated member
      navigation.navigate("MemberCoopScreen", { autoMember: member });
    } catch (e) {
      setError(e.message || "Invalid User ID or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── go to register ─────────────────────────────────────────────────────────
  const handleGoRegister = () => {
    navigation.navigate("MemberCoopScreen", { startView: "register" });
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

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <AppBg />

      {/* ── HEADER ── */}
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
          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation && navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.headerCenter}>
            <Text
              style={[
                styles.headerH1,
                { fontSize: isWide ? 22 : isSmall ? 14 : 17 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              <Text style={styles.headerWhite}>Member </Text>
              <Text style={styles.headerGold}>Login</Text>
            </Text>
            <Text style={[styles.headerSub, { fontSize: isWide ? 10 : 8 }]}>
              CESLA MULTI-PURPOSE COOPERATIVE
            </Text>
          </View>

          {/* Right spacer (mirrors back btn width to keep title centered) */}
          <View style={{ width: 40, flexShrink: 0 }} />
        </View>
      </Animated.View>

      {/* ── SCROLLABLE BODY ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: isWide ? 40 : 20 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── LOGIN CARD ── */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardFade,
                transform: [{ translateY: cardTrans }],
                maxWidth: isWide ? 480 : 440,
              },
            ]}
          >
            {/* Avatar circle */}
            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={["rgba(201,168,76,0.30)", "rgba(201,168,76,0.10)"]}
                style={styles.avatarGrad}
              >
                <MaterialIcons
                  name="person"
                  size={isWide ? 44 : 36}
                  color="#c9a84c"
                />
              </LinearGradient>
            </View>

            {/* Welcome text */}
            <Text style={[styles.welcomeTitle, { fontSize: isWide ? 26 : 22 }]}>
              Welcome Back!
            </Text>
            <Text style={styles.welcomeSub}>
              Login to access your membership account
            </Text>

            {/* Hint box */}
            <View style={styles.hintBox}>
              <Text style={styles.hintTxt}>
                {"🔑 Use your "}
                <Text style={styles.hintBold}>User ID</Text>
                {" (e.g. "}
                <Text style={[styles.hintBold, { color: "#c9a84c" }]}>
                  CESLA–2025–00001
                </Text>
                {") and "}
                <Text style={[styles.hintBold, { color: "#c9a84c" }]}>
                  Password
                </Text>
                {" to login."}
              </Text>
            </View>

            {/* USER ID field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>USER ID</Text>
              <View
                style={[
                  styles.fieldRow,
                  error && !loading && styles.fieldRowErr,
                ]}
              >
                <TextInput
                  style={styles.fieldInput}
                  value={userId}
                  onChangeText={(v) => {
                    setUserId(v);
                    setError("");
                  }}
                  placeholder="CESLA–2026–00001"
                  placeholderTextColor="rgba(15,30,53,0.35)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* PASSWORD field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View
                style={[
                  styles.fieldRow,
                  error && !loading && styles.fieldRowErr,
                ]}
              >
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={pw}
                  onChangeText={(v) => {
                    setPw(v);
                    setError("");
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(15,30,53,0.35)"
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPw((p) => !p)}
                  style={{ padding: 6 }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <MaterialIcons
                    name={showPw ? "visibility-off" : "visibility"}
                    size={20}
                    color="rgba(15,30,53,0.40)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error box */}
            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons
                  name="error-outline"
                  size={14}
                  color="#e74c3c"
                  style={{ marginTop: 1 }}
                />
                <Text style={styles.errorTxt}>{error}</Text>
              </View>
            ) : null}

            {/* LOGIN button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && { opacity: 0.65 }]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              <LinearGradient
                colors={["#c9a84c", "#e8c87a"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginBtnGrad}
              >
                {loading ? (
                  <ActivityIndicator color="#0d1b3e" />
                ) : (
                  <>
                    <Text style={styles.loginBtnArrow}>→</Text>
                    <Text style={styles.loginBtnTxt}>LOGIN</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Register link */}
            <View style={styles.registerRow}>
              <Text style={styles.registerTxt}>Don't have an account? </Text>
              <TouchableOpacity onPress={handleGoRegister} activeOpacity={0.75}>
                <Text style={styles.registerLink}>Register as New Member</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── header ──────────────────────────────────────────────────────────────────
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

  // ── scroll ───────────────────────────────────────────────────────────────────
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 32,
    paddingBottom: 50,
  },

  // ── card ─────────────────────────────────────────────────────────────────────
  card: {
    width: "100%",
    borderRadius: 24,
    // glassmorphism effect matching screenshot
    backgroundColor: "rgba(178,203,222,0.38)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    padding: 28,
    alignItems: "center",
    shadowColor: "#011f4b",
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    // subtle backdrop blur on web
    ...(Platform.OS === "web" ? { backdropFilter: "blur(16px)" } : {}),
  },

  // ── avatar ───────────────────────────────────────────────────────────────────
  avatarWrap: { marginBottom: 18 },
  avatarGrad: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(201,168,76,0.45)",
  },

  // ── welcome ─────────────────────────────────────────────────────────────────
  welcomeTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontWeight: "800",
    color: "#011f4b",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  welcomeSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "rgba(1,31,75,0.60)",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 19,
  },

  // ── hint box ─────────────────────────────────────────────────────────────────
  hintBox: {
    width: "100%",
    backgroundColor: "rgba(201,168,76,0.14)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.38)",
    padding: 14,
    marginBottom: 22,
  },
  hintTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "rgba(1,31,75,0.80)",
    lineHeight: 20,
  },
  hintBold: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "#011f4b",
  },

  // ── fields ───────────────────────────────────────────────────────────────────
  fieldGroup: { width: "100%", marginBottom: 16 },
  fieldLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "rgba(1,31,75,0.55)",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 7,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(240,246,252,0.92)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "rgba(200,218,235,0.75)",
    shadowColor: "#011f4b",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fieldRowErr: { borderColor: "#e74c3c" },
  fieldInput: {
    flex: 1,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 15,
    color: "#0d1b3e",
    letterSpacing: 0.2,
  },

  // ── error ────────────────────────────────────────────────────────────────────
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    width: "100%",
    backgroundColor: "rgba(231,76,60,0.10)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(231,76,60,0.28)",
    padding: 11,
    marginBottom: 6,
  },
  errorTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "#e74c3c",
    flex: 1,
    lineHeight: 18,
  },

  // ── login button ─────────────────────────────────────────────────────────────
  loginBtn: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    marginTop: 10,
    marginBottom: 14,
    shadowColor: "#c9a84c",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  loginBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    gap: 10,
  },
  loginBtnArrow: {
    fontSize: 20,
    color: "#0d1b3e",
    fontWeight: "800",
  },
  loginBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 16,
    color: "#0d1b3e",
    letterSpacing: 3,
  },

  // ── register row ─────────────────────────────────────────────────────────────
  registerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 2,
    marginTop: 2,
  },
  registerTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "rgba(1,31,75,0.55)",
  },
  registerLink: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "#c9a84c",
    textDecorationLine: "underline",
  },
});
