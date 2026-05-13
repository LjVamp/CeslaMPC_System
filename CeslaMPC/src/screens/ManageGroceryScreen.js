// src/screens/ManageGroceryScreen.js
// CESLA MPC — Manage Grocery (Admin)
// Based 100% on ManageCanteenScreen.js — same design, same layout
// Differences: useGrocery context, grocery_* Firestore collections, "Grocery" branding

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Animated,
  Image,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { NotoSerif_700Bold } from "@expo-google-fonts/noto-serif";
import {
  GoogleSans_400Regular,
  GoogleSans_500Medium,
  GoogleSans_700Bold,
} from "@expo-google-fonts/google-sans";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useGrocery } from "../context/GroceryContext";
import { useFocusEffect } from "@react-navigation/native";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";

// ─── ORDER NOTIFICATION SOUND ─────────────────────────────────────────────────
const playOrderSound = async () => {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.AudioContext
  ) {
    try {
      const ctx = new window.AudioContext();
      const playTone = (freq, start, duration, gain = 0.8, type = "sine") => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const wave = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          curve[i] = ((Math.PI + 300) * x) / (Math.PI + 300 * Math.abs(x));
        }
        wave.curve = curve;
        osc.connect(wave);
        wave.connect(g);
        g.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = type;
        g.gain.setValueAtTime(0, ctx.currentTime + start);
        g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
        g.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + start + duration,
        );
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration + 0.05);
      };
      playTone(1046, 0.0, 1.2, 0.9);
      playTone(1318, 0.0, 1.0, 0.5);
      playTone(784, 0.45, 1.4, 0.9);
      playTone(988, 0.45, 1.2, 0.5);
      playTone(1046, 1.1, 1.2, 0.7);
      playTone(784, 1.55, 1.4, 0.7);
    } catch (e) {
      /* silent fail */
    }
  }
};

// ─── WEB SCROLL VIEW ──────────────────────────────────────────────────────────
if (Platform.OS === "web" && typeof document !== "undefined") {
  const styleEl = document.createElement("style");
  styleEl.textContent = `.cesla-grocery-scroll::-webkit-scrollbar{width:7px;display:block!important}.cesla-grocery-scroll::-webkit-scrollbar-thumb{background:rgba(1,31,75,0.40);border-radius:4px}.cesla-grocery-scroll::-webkit-scrollbar-thumb:hover{background:rgba(1,31,75,0.65)}.cesla-grocery-scroll::-webkit-scrollbar-track{background:rgba(255,255,255,0.20);border-radius:4px}.cesla-grocery-scroll{scrollbar-width:thin;scrollbar-color:rgba(1,31,75,0.40) rgba(255,255,255,0.20)}`;
  document.head.appendChild(styleEl);
}
const WebScrollView = ({ children, style, contentContainerStyle, ...rest }) => {
  if (Platform.OS !== "web") {
    return (
      <ScrollView
        style={style}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }
  const flat = StyleSheet.flatten(contentContainerStyle) || {};
  const pH =
    flat.paddingHorizontal !== undefined
      ? flat.paddingHorizontal
      : flat.padding !== undefined
        ? flat.padding
        : undefined;
  return (
    <View
      style={[
        { flex: 1, minHeight: 0, position: "relative", overflow: "hidden" },
        style,
      ]}
    >
      <div
        className="cesla-grocery-scroll"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            width: "100%",
            boxSizing: "border-box",
            paddingTop:
              flat.paddingTop !== undefined
                ? `${flat.paddingTop}px`
                : flat.padding !== undefined
                  ? `${flat.padding}px`
                  : undefined,
            paddingBottom:
              flat.paddingBottom !== undefined
                ? `${flat.paddingBottom}px`
                : flat.padding !== undefined
                  ? `${flat.padding}px`
                  : "12px",
            paddingLeft: pH !== undefined ? `${pH}px` : undefined,
            paddingRight: pH !== undefined ? `${pH}px` : undefined,
            gap: flat.gap !== undefined ? `${flat.gap}px` : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </View>
  );
};

// ─── IMAGE RESIZE HELPER ──────────────────────────────────────────────────────
const resizeImageToBase64 = (uri) =>
  new Promise((resolve, reject) => {
    const MAX = 300;
    if (Platform.OS === "web") {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.5));
      };
      img.onerror = reject;
      img.src = uri;
    } else {
      resolve(uri);
    }
  });

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const emptyItem = () => ({
  id: Date.now().toString(),
  name: "",
  cat: "Produce",
  price: "",
  stock: "",
  emoji: "🛒",
  image: null,
});

const autoEmoji = (name) => {
  const n = name.toLowerCase();
  if (/rice|bigas|sinangag/.test(n)) return "🍚";
  if (/milk|gatas/.test(n)) return "🥛";
  if (/egg|itlog/.test(n)) return "🥚";
  if (/chicken|manok/.test(n)) return "🍗";
  if (/pork|baboy|liempo/.test(n)) return "🥩";
  if (/fish|isda|bangus|tilapia/.test(n)) return "🐟";
  if (/bread|pan|tasty/.test(n)) return "🍞";
  if (/sugar|asukal/.test(n)) return "🍬";
  if (/salt|asin/.test(n)) return "🧂";
  if (/oil|mantika/.test(n)) return "🫙";
  if (/vegetable|gulay|kangkong|sitaw/.test(n)) return "🥦";
  if (/fruit|prutas|banana|apple|mango/.test(n)) return "🍎";
  if (/coffee|kape/.test(n)) return "☕";
  if (/juice|softdrink|soda/.test(n)) return "🧃";
  if (/water|tubig/.test(n)) return "💧";
  if (/soap|detergent|shampoo/.test(n)) return "🧴";
  if (/noodle|pancit|pasta/.test(n)) return "🍜";
  if (/canned|sardine|corned/.test(n)) return "🥫";
  if (/butter|margarine/.test(n)) return "🧈";
  if (/cheese|keso/.test(n)) return "🧀";
  return "🛒";
};

const TABS = [
  { key: "cashier", label: "Cashier", icon: "point-of-sale" },
  { key: "menu", label: "Manage Items", icon: "restaurant-menu" },
  { key: "inventory", label: "Inventory", icon: "inventory" },
  { key: "history", label: "History", icon: "history" },
  { key: "credits", label: "Credits", icon: "account-balance" },
  { key: "report", label: "Report", icon: "bar-chart" },
];

// ─── ITEM EDIT MODAL ──────────────────────────────────────────────────────────
const ItemEditModal = ({ visible, item, categories, onSave, onClose }) => {
  const [form, setForm] = useState(item || emptyItem());
  const prevIdRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      prevIdRef.current = null;
      return;
    }
    const incomingId = item?.id ?? "__new__";
    if (incomingId !== prevIdRef.current) {
      prevIdRef.current = incomingId;
      if (item) {
        setForm({
          ...item,
          price: String(item.price),
          stock: String(item.stock),
        });
      } else {
        setForm(emptyItem());
      }
    }
  }, [visible, item?.id]);

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library in Settings.",
        );
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: false,
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      try {
        const resized = await resizeImageToBase64(asset.uri);
        setForm((f) => ({ ...f, image: resized }));
      } catch (e) {
        Alert.alert(
          "Error",
          "Could not process image. Please try a different photo.",
        );
      }
    }
  };

  const handleNameChange = (v) => {
    setForm((f) => ({
      ...f,
      name: v,
      emoji: f.image ? f.emoji : autoEmoji(v),
    }));
  };

  const save = () => {
    if (!form.name.trim()) {
      Alert.alert("Error", "Item name is required.");
      return;
    }
    if (!form.price) {
      Alert.alert("Error", "Price is required.");
      return;
    }
    if (form.stock === "") {
      Alert.alert("Error", "Stock is required.");
      return;
    }
    onSave({
      ...form,
      price: parseFloat(form.price) || 0,
      stock: parseInt(form.stock) || 0,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={ms.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          activeOpacity={1}
        />
        <View style={ms.modalWrapper}>
          <View style={ms.modalCard}>
            <Text style={ms.modalTitle}>
              {item?.name ? "Edit Item" : "Add New Item"}
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <View style={{ alignItems: "center", gap: 4 }}>
                <TouchableOpacity style={ms.imgPicker} onPress={pickImage}>
                  {form.image ? (
                    <Image source={{ uri: form.image }} style={ms.imgPreview} />
                  ) : (
                    <View style={{ alignItems: "center", gap: 2 }}>
                      <Text style={{ fontSize: 32 }}>{form.emoji}</Text>
                      <Text style={ms.imgHint}>Upload</Text>
                    </View>
                  )}
                  <View style={ms.imgBadge}>
                    <MaterialIcons name="photo-camera" size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
                {form.image && (
                  <TouchableOpacity
                    onPress={() => setForm((f) => ({ ...f, image: null }))}
                  >
                    <Text
                      style={{
                        fontFamily: "GoogleSans_400Regular",
                        fontSize: 10,
                        color: "#e74c3c",
                      }}
                    >
                      ✕ Remove
                    </Text>
                  </TouchableOpacity>
                )}
                {!form.image && (
                  <View style={{ alignItems: "center", gap: 2 }}>
                    <Text style={[ms.fieldLabel, { textAlign: "center" }]}>
                      Emoji
                    </Text>
                    <TextInput
                      style={[
                        ms.input,
                        {
                          textAlign: "center",
                          fontSize: 20,
                          width: 56,
                          paddingVertical: 6,
                        },
                      ]}
                      value={form.emoji}
                      onChangeText={(v) => setForm((f) => ({ ...f, emoji: v }))}
                      placeholder="🛒"
                    />
                  </View>
                )}
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <View style={ms.fieldRow}>
                  <Text style={ms.fieldLabel}>Item Name *</Text>
                  <TextInput
                    style={ms.input}
                    value={form.name}
                    onChangeText={handleNameChange}
                    placeholder="e.g. White Rice 1kg"
                  />
                </View>
                <View style={ms.fieldRow}>
                  <Text style={ms.fieldLabel}>Category</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 4 }}
                  >
                    <View style={{ flexDirection: "row", gap: 5 }}>
                      {categories
                        .filter((c) => c !== "All")
                        .map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            style={[ms.chip, form.cat === cat && ms.chipActive]}
                            onPress={() => setForm((f) => ({ ...f, cat }))}
                          >
                            <Text
                              style={[
                                ms.chipTxt,
                                form.cat === cat && ms.chipTxtActive,
                              ]}
                            >
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={[ms.fieldRow, { flex: 1 }]}>
                    <Text style={ms.fieldLabel}>Price (₱) *</Text>
                    <TextInput
                      style={ms.input}
                      value={form.price}
                      onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                      keyboardType="numeric"
                      placeholder="0.00"
                    />
                  </View>
                  <View style={[ms.fieldRow, { flex: 1 }]}>
                    <Text style={ms.fieldLabel}>Stock *</Text>
                    <TextInput
                      style={ms.input}
                      value={form.stock}
                      onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                </View>
              </View>
            </View>
            <View style={ms.modalActions}>
              <TouchableOpacity style={ms.cancelBtn} onPress={onClose}>
                <Text style={ms.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, borderRadius: 10, overflow: "hidden" }}
                onPress={save}
              >
                <LinearGradient
                  colors={["#1a3a6b", "#2e5fa3"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 11, alignItems: "center" }}
                >
                  <Text
                    style={{
                      fontFamily: "GoogleSans_700Bold",
                      fontSize: 13,
                      color: "#fff",
                    }}
                  >
                    Save Item
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(1,20,50,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalWrapper: { width: "100%", maxWidth: 540 },
  modalCard: {
    backgroundColor: "#f0f5f9",
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  modalTitle: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 16,
    color: "#011f4b",
    textAlign: "center",
    marginBottom: 4,
  },
  imgPicker: {
    alignSelf: "center",
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "rgba(1,31,75,0.07)",
    borderWidth: 2,
    borderColor: "rgba(1,31,75,0.15)",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  imgPreview: { width: 86, height: 86, borderRadius: 43 },
  imgHint: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 9,
    color: "rgba(1,31,75,0.40)",
    textAlign: "center",
  },
  imgBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#1a3a6b",
    borderRadius: 10,
    padding: 4,
  },
  fieldRow: { gap: 4 },
  fieldLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "rgba(1,31,75,0.50)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "#011f4b",
    borderWidth: 1,
    borderColor: "rgba(1,31,75,0.12)",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(1,31,75,0.07)",
  },
  chipActive: { backgroundColor: "#1a3a6b" },
  chipTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.60)",
  },
  chipTxtActive: { fontFamily: "GoogleSans_700Bold", color: "#fff" },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "rgba(1,31,75,0.07)",
    paddingVertical: 11,
    alignItems: "center",
  },
  cancelTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "rgba(1,31,75,0.50)",
  },
});

// ─── PAYMENT CONFIRMATION MODAL ───────────────────────────────────────────────
const PaymentConfirmModal = ({
  visible,
  paymentMode,
  total,
  cartItems,
  memberName,
  memberId,
  onConfirm,
  onCancel,
}) => {
  const [amountPaid, setAmountPaid] = useState("");
  const [gcashRef, setGcashRef] = useState("");
  const [gcashConfirmed, setGcashConfirmed] = useState(false);
  const [placing, setPlacing] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setAmountPaid("");
      setGcashRef("");
      setGcashConfirmed(false);
      setPlacing(false);
    }
  }, [visible, paymentMode]);

  const paid = parseFloat(amountPaid) || 0;
  const change = paid - total;

  const canConfirm = () => {
    if (cartItems.length === 0) return false;
    if (paymentMode === "cash") return paid >= total;
    if (paymentMode === "gcash")
      return gcashRef.trim().length >= 4 && gcashConfirmed;
    if (paymentMode === "credit") return (memberName || "").trim().length > 0;
    return false;
  };

  const handleConfirm = async () => {
    if (!canConfirm() || placing) return;
    setPlacing(true);
    const payload = {
      payment: paymentMode,
      amountPaid: paymentMode === "cash" ? paid : total,
      change: paymentMode === "cash" ? change : 0,
      gcashRef: paymentMode === "gcash" ? gcashRef.trim() : null,
      memberName: paymentMode === "credit" ? memberName : null,
      memberId: paymentMode === "credit" ? memberId : null,
      settled: paymentMode !== "credit",
    };
    await onConfirm(payload);
    setPlacing(false);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={pcm.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onCancel}
          activeOpacity={1}
        />
        <View style={pcm.card}>
          {/* Header */}
          <LinearGradient colors={["#1a2d4e", "#243554"]} style={pcm.header}>
            <Text style={pcm.headerTitle}>
              {paymentMode === "cash"
                ? "💵 Cash Payment"
                : paymentMode === "gcash"
                  ? "📱 GCash Payment"
                  : "🪙 Credit / Utang"}
            </Text>
            <Text style={pcm.headerSub}>Total: ₱{total.toFixed(2)}</Text>
          </LinearGradient>

          <View style={pcm.body}>
            {/* ── CASH ── */}
            {paymentMode === "cash" && (
              <>
                <Text style={pcm.label}>Amount Received from Customer</Text>
                <TextInput
                  style={pcm.input}
                  value={amountPaid}
                  onChangeText={setAmountPaid}
                  keyboardType="numeric"
                  placeholder="₱ 0.00"
                  placeholderTextColor="rgba(1,31,75,0.30)"
                  autoFocus
                />
                {amountPaid !== "" && (
                  <View
                    style={[
                      pcm.changeBox,
                      {
                        backgroundColor:
                          change < 0
                            ? "rgba(231,76,60,0.10)"
                            : "rgba(39,174,96,0.10)",
                        borderColor:
                          change < 0
                            ? "rgba(231,76,60,0.25)"
                            : "rgba(39,174,96,0.25)",
                      },
                    ]}
                  >
                    <Text style={pcm.changeLbl}>
                      {change < 0 ? "⚠️ Kulang pa:" : "Change:"}
                    </Text>
                    <Text
                      style={[
                        pcm.changeVal,
                        { color: change < 0 ? "#e74c3c" : "#27ae60" },
                      ]}
                    >
                      ₱{Math.abs(change).toFixed(2)}
                    </Text>
                  </View>
                )}
                {paid < total && amountPaid !== "" && (
                  <Text style={pcm.errorTxt}>
                    Hindi pa pwede mag-place ng order — kulang ang bayad.
                  </Text>
                )}
              </>
            )}

            {/* ── GCASH ── */}
            {paymentMode === "gcash" && (
              <>
                <Text style={pcm.label}>GCash Reference Number</Text>
                <TextInput
                  style={pcm.input}
                  value={gcashRef}
                  onChangeText={setGcashRef}
                  placeholder="e.g. 1234567890"
                  placeholderTextColor="rgba(1,31,75,0.30)"
                  keyboardType="numeric"
                  maxLength={20}
                  autoFocus
                />
                <Text style={pcm.hint}>
                  Itype ang reference number gikan sa GCash receipt/notification
                  sa customer.
                </Text>

                <TouchableOpacity
                  style={[pcm.checkRow, gcashConfirmed && pcm.checkRowActive]}
                  onPress={() => setGcashConfirmed((v) => !v)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[pcm.checkbox, gcashConfirmed && pcm.checkboxActive]}
                  >
                    {gcashConfirmed && (
                      <Text
                        style={{ color: "#fff", fontSize: 12, lineHeight: 16 }}
                      >
                        ✓
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      pcm.checkLabel,
                      gcashConfirmed && { color: "#1a3a6b" },
                    ]}
                  >
                    Na-verify na nako ang GCash payment sa phone — ₱
                    {total.toFixed(2)} na-receive.
                  </Text>
                </TouchableOpacity>

                {gcashRef.trim().length > 0 && gcashRef.trim().length < 4 && (
                  <Text style={pcm.errorTxt}>
                    Reference number too short — minimum 4 digits.
                  </Text>
                )}
                {gcashRef.trim().length >= 4 && !gcashConfirmed && (
                  <Text style={pcm.warnTxt}>
                    ⚠️ I-check ang GCash app ug i-tick ang confirmation box.
                  </Text>
                )}
              </>
            )}

            {/* ── CREDIT ── */}
            {paymentMode === "credit" && (
              <>
                <View style={pcm.creditBanner}>
                  <Text style={pcm.creditBannerIco}>🪙</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={pcm.creditBannerName}>
                      {memberName || "Unknown Member"}
                    </Text>
                    {memberId ? (
                      <Text style={pcm.creditBannerId}>ID: {memberId}</Text>
                    ) : null}
                  </View>
                  <Text style={pcm.creditBannerAmt}>+₱{total.toFixed(2)}</Text>
                </View>
                <Text style={pcm.hint}>
                  Ang order ibutang sa credit/utang ni {memberName || "member"}.
                  Dili kini bayad karon — makita sa Credits tab para sa
                  settlement.
                </Text>
                {!(memberName || "").trim() && (
                  <Text style={pcm.errorTxt}>
                    Walay napili nga member — dili pwede mag-proceed.
                  </Text>
                )}
              </>
            )}
          </View>

          {/* Actions */}
          <View style={pcm.actions}>
            <TouchableOpacity style={pcm.cancelBtn} onPress={onCancel}>
              <Text style={pcm.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                pcm.confirmBtn,
                (!canConfirm() || placing) && { opacity: 0.45 },
              ]}
              onPress={handleConfirm}
              activeOpacity={0.8}
              disabled={!canConfirm() || placing}
            >
              <LinearGradient
                colors={
                  canConfirm() && !placing
                    ? ["#27ae60", "#2ecc71"]
                    : ["#aaa", "#bbb"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={pcm.confirmGrad}
              >
                <MaterialIcons name="check-circle" size={16} color="#fff" />
                <Text style={pcm.confirmTxt}>
                  {placing
                    ? "Saving..."
                    : paymentMode === "credit"
                      ? "Confirm Credit"
                      : "Confirm Payment"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const pcm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(1,20,50,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#f0f5f9",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
  },
  headerTitle: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 16,
    color: "#fff",
    letterSpacing: 0.3,
  },
  headerSub: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
    color: "#c9a84c",
  },
  body: { padding: 20, gap: 12 },
  label: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "rgba(1,31,75,0.55)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.90)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 16,
    color: "#011f4b",
    borderWidth: 1.5,
    borderColor: "rgba(1,31,75,0.15)",
  },
  changeBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  changeLbl: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "rgba(1,31,75,0.65)",
  },
  changeVal: { fontFamily: "NotoSerif_700Bold", fontSize: 18 },
  hint: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.50)",
    lineHeight: 17,
  },
  errorTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#e74c3c",
    textAlign: "center",
  },
  warnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#e67e22",
    textAlign: "center",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.70)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "rgba(1,31,75,0.12)",
  },
  checkRowActive: {
    borderColor: "#27ae60",
    backgroundColor: "rgba(39,174,96,0.08)",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(1,31,75,0.30)",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxActive: { backgroundColor: "#27ae60", borderColor: "#27ae60" },
  checkLabel: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(1,31,75,0.55)",
    flex: 1,
    lineHeight: 18,
  },
  creditBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(201,168,76,0.12)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.35)",
  },
  creditBannerIco: { fontSize: 28 },
  creditBannerName: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 14,
    color: "#1a2d4e",
  },
  creditBannerId: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.50)",
    marginTop: 2,
  },
  creditBannerAmt: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: "#c9a84c",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderColor: "rgba(1,31,75,0.08)",
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "rgba(1,31,75,0.07)",
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "rgba(1,31,75,0.50)",
  },
  confirmBtn: { flex: 2, borderRadius: 10, overflow: "hidden" },
  confirmGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  confirmTxt: { fontFamily: "GoogleSans_700Bold", fontSize: 13, color: "#fff" },
});

// ─── EMPLOYEE LIST ────────────────────────────────────────────────────────────
const EMPLOYEES = [
  "ABAO, CHARITO GALOCHINO",
  "ABELLA, SEP ALZEN PUNO",
  "ACOT, MICHAEL CARVAJAL",
  "ACTUB, JAN NIÑO FLORES",
  "AGIR, RAMIL CARBELLIDA",
  "ALING, ROSEMARIE",
  "AMPUSTA, LOVELY JANE ALEMANIA",
  "APOYA, EDGARDO DUHILAG",
  "ARSUA, RUEL TOLIBAS",
  "ASAY, IELYN GALABO",
  "ATLAO, REAGAN BUHISAN",
  "AUTOR, AMADO CONSTANTINE MALABANAN",
  "AYAG, RHEGIE JOY BALURAN",
  "AYCO, JOY VILLAMONTE",
  "BAACLO, JURYLAN ABRAGAN",
  "BABANTO, GRETCHEN MABALE",
  "BAHAY, QUEEN ROMANILLOS",
  "BAJUYO, SANNY JR L.",
  "BALAGA, ROGELIO UGAT JR.",
  "BALISTA, NIKKA JABAGAT",
  "BALISTOY, ARMAE FE DECIERDO",
  "BASADRE, MHELJUNE KIRT PALLOTO",
  "BATARA, NINA FLOR BARRO",
  "BAUTISTA, JOCELYN DUKA",
  "BAYRON, SHELOU MAE ALCARAZ",
  "BENDANILLO, IALENNE JAY",
  "BENTUZAL, RUBY JEAN JABINIAR",
  "BERNADAS, BERNADETH NICOMEDEZ",
  "BILLONES, MA. THERESA",
  "BONIAO, CYRIAN GALAMITON",
  "BORROMEO, TIMOTHY JONAH E.",
  "CABILLO, GERALD ABRIO",
  "CABISO, JOY FE LEGASON",
  "CADORNA, MICHAEL MAQUILING",
  "CAGATAN, JENNY ANNE J.",
  "CAGUIAT, THERENCE JOHN D.",
  "CAIDIC, PRINCESS LANIE MAGALLANES",
  "CAINGLET, HYACINTH BADILLA",
  "CAINOY, ANGELICA",
  "CANDEL, IRISH AGUILAR",
  "CARCUEVA, CHARNELYN Q.",
  "CASINILLO, ROWENA PESOLE",
  "CHAVEZ, CHRISTOPHER JOHN CIERVO",
  "CHUA, KENNETH POTULAN",
  "COBRADOR, JHOANA ROSE R.",
  "COQUILLA, KRISTEL VILLEGAS",
  "CORRO, MICHELLE ALISOSO",
  "CUMBA, BLESILDA LAGANG",
  "CUTAMORA, CECILMAY A.",
  "CUTOR, CORINNE MAE BAYRON",
  "DABLIO, SHANE MYRTHEL U.",
  "DAILO, REGIE",
  "DAIRO, HANNAH LIEZEL M.",
  "DAOMAR, AMOS GLENN GALVEZO",
  "DAUG, IRISH CLAIRE",
  "DE LOS SANTOS, CARLO JAMES ALAMBATIN",
  "DELA PENA, REYMART RODELAS",
  "DELOS REYES, ROMANITO UBANAN",
  "DIAZ, ANGELLAN FE L.",
  "DIAZ, RENAN PAGENTE",
  "DILANGALEN, BAI FERDAUZIA ABDULRACHMAN",
  "DIZON, DONNA MARIE MICHELLE CABATIC",
  "EBO, MICHAEL PATRICK TUDTUD",
  "EBAL, JERSON TOQUIB",
  "ELICAN, ELMER MACOMAO",
  "EMANO, RICHEL ANN EMBALSADO",
  "ENTICE, MARK ANTHONY E",
  "ESCABARTE, JEVELYN L.",
  "ESTABAYA II, JACINTO",
  "FABRIGAS, MA. ANTONETTE VILLAROSA",
  "FACTURANAN, DEXTER JARDENICO",
  "FALLE, DARYLL POTANE",
  "FERRER, EDILEN O.",
  "GABUT, CHERYLL MARIE CABEGUIN",
  "GALINATO, MICHAEL KATIPUNAN",
  "GALLA, CHERYL LIZA COLEGADO",
  "GAMAO, MELGRAY ELISAN",
  "GAMOLO, EZRA ALEA",
  "GARCIA, JASON ANUNCIADO",
  "GAUSIN, MIECHEL ASTILLERO",
  "GETUABAN, ARCEIL DONTAR",
  "GOPEZ, NICOLE CRE C.",
  "GUARDIARIO, MA. ELIZABETH C.",
  "GULANG, BERN CHARRIE MAÑUS",
  "GUMAHAD, JASMIN JOY DAGUNO",
  "ITEM, JUNEVIC RALLON",
  "JAMERO, NICOLE",
  "JARAULA, CIELO ANGELA AWATIN",
  "JOPSON, LOUIE ROSALES",
  "KATIPUNAN, MARLO DINSAG",
  "KILAT, NICHOLE JAY GRAPE",
  "LABANA, GOLDIE ANN PECCADOR",
  "LABININAY, JANE PAULINE NISPEROS",
  "LAGUE, LARRY PAUL SANTOS",
  "LOKING, RUTH THELMA NATINDIM",
  "LUMANTAS, LINDLEY NIEL CLARIN",
  "LUNGAY, CHERRYME QUILANG",
  "MABAO, ROLLY P.",
  "MAGALLONES, MARIETTA VALLEDOR",
  "MAGARIN, CHARLES LAGROSAS",
  "MAGARO, MAYDILOU O.",
  "MAGLUNSOD, FAITH ANN GARAY",
  "MALINAO, FLOROSA BACON",
  "MANGURAY, JEFFERSON PAJA",
  "MAQUIDATO, RYAN DALE BAJA",
  "MARQUEZ, MEA ANNE DYSERIE OGSID",
  "MEDRANO, RONNEL B.",
  "MINO, BRIZZA MAE REPULO",
  "MORENO, PAOLO JOSEPH LACIERDA",
  "NAGAC, JUSTINE FAITH LLAMAS",
  "NALIPONGUIT, CHARED ABALDE",
  "NAMOC, DONABELLE MAGHANOY",
  "NEBREJA, MICHAEL CABUALAN",
  "OCLIDA, THERESE ANNE M.",
  "ODARVE, CYFRED UCAB",
  "OLAPE, DIXIE GALE GALAMITON",
  "ORTEGA, NANCY GONZALES",
  "PAGAYON, JIA CARIZZA B.",
  "PAGTULON-AN, ARVIE ROSE POLINAR",
  "PAHUNANG, JOHN PATRICK",
  "PALACAIN, PHILLIP EULLARAN",
  "PAMINTAO, JAPPREY JARLATA",
  "PAMISA, JERRICHO BORJA",
  "PANILAG, CHARLYS CADIZ",
  "PANTO, JEFREY REYES",
  "PAO, FELYN PATAGOC",
  "PASAYON, ELOIZA MARIE SABANAL",
  "PEPANIA, REGINE DIALEL",
  "PILONGO, JADE ANTHONY CLERIGO",
  "PIQUERO, MARILETH LEGADOS",
  "RABOY, NOEL DANLAG",
  "RAMA, ERLYN BARRERA",
  "RAMOS, MAYR JHOREY BASADRE",
  "RANDA, EULYZA R.",
  "REGODOS, ARIES AGUILAR",
  "RETUERTO, JOHN KEITH SALVAN",
  "REYES, RAY ANTHONY BULLECER",
  "ROBRIL, MARICHELLE BARTE",
  "ROMO, DONA CLAIRE ALINDAJAO",
  "ROSALES, ALYSSA CINDE VALENZUELA",
  "ROSAURO, RENER GUISONA",
  "SABORNIDO, AMIE GRACE MANINGGO",
  "SALIOT, RHEA LEGASPI",
  "SALVADOR, MARIA RHEENA MAE PIEDAD",
  "SALVANA, ARNOLD A.",
  "SANAGA, SHIRANE BALABA",
  "SANCHEZ, EIDNOLB TALINES",
  "SANCHEZ, MILHEN CASTILLO",
  "SANTOS, RINALYN PIVIDA",
  "SENECA, MARIA THERESA LOPEZ",
  "SERRAN, NICAILLA OBIENITA",
  "SONOGAN, WILBUR BOLANDRES",
  "SORIANO, GRACE",
  "SULPOT, JANSHIN B.",
  "SURIA, ANA MARIE MIER",
  "TALIPAN, JBR EMMANUEL CHAVES",
  "TAN, JOAN MARY ORAPA",
  "TOLEDO, MIGUEL VICTOR OLANDRIA",
  "TURNO, JODELYN BENSON",
  "UCAB, PRINCESS DIANNE ONYOT",
  "UNABIA, MICHELLE MAE BLANCO",
  "VALDEZ, JONALFOR SORIANO",
  "VALERIO, CHENDY F.",
  "VALLAR, JAYCA L.",
  "VILLACES, PATRIC MANUEL B.",
  "VILLANUEVA, ALAIN REY REDONDO",
  "VIRGULA, JULIETTE CALUMBAN",
  "YBANEZ, MARY FRANCELLE NID V.",
];

// ─── CASHIER SCREEN ───────────────────────────────────────────────────────────
const CashierScreen = ({
  items,
  categories,
  addOrder,
  deductStock,
  isWide: csIsWide,
}) => {
  const [activeCat, setActiveCat] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({});
  const [paymentMode, setPaymentMode] = useState("cash");
  const [memberName, setMemberName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [empSearch, setEmpSearch] = useState("");
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [cartCollapsed, setCartCollapsed] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const openCart = () => {
    setCartCollapsed(false);
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  };
  const closeCart = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setCartCollapsed(true));
  };

  const filtered = items.filter((i) => {
    if (search.trim())
      return i.name.toLowerCase().includes(search.toLowerCase());
    return activeCat === "All" || i.cat === activeCat;
  });

  const cartItems = Object.values(cart).filter((c) => c.qty > 0);
  const total = cartItems.reduce((s, { item, qty }) => s + item.price * qty, 0);

  const addToCart = (item) =>
    setCart((prev) => ({
      ...prev,
      [item.id]: { item, qty: (prev[item.id]?.qty || 0) + 1 },
    }));
  const removeFromCart = (item) =>
    setCart((prev) => {
      const qty = (prev[item.id]?.qty || 0) - 1;
      if (qty <= 0) {
        const n = { ...prev };
        delete n[item.id];
        return n;
      }
      return { ...prev, [item.id]: { item, qty } };
    });
  const clearCart = () => {
    setCart({});
    setMemberName("");
    setMemberId("");
    setEmpSearch("");
    setEmpDropdownOpen(false);
  };

  // Called only after PaymentConfirmModal validates payment
  const handleConfirmedOrder = async ({
    payment,
    amountPaid,
    change,
    gcashRef,
    memberName: mn,
    memberId: mid,
    settled,
  }) => {
    const orderNo = Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const time =
      now.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      "  " +
      now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
    const order = {
      id: Date.now().toString(),
      orderNo,
      time,
      items: cartItems,
      total,
      amountPaid,
      change,
      payment,
      gcashRef: gcashRef || null,
      memberName: mn || null,
      memberId: mid || null,
      settled,
      status: "done",
      source: "cashier",
    };
    await addOrder(order);
    await deductStock(cartItems);
    setLastOrder(order);
    setPayModalVisible(false);
    clearCart();
    setTimeout(() => setReceiptVisible(true), 200);
  };

  const COLS = csIsWide ? 6 : 3;

  const CartContent = () => (
    <View style={{ padding: csIsWide ? 0 : 12, gap: 8, flex: 1, minHeight: 0 }}>
      {/* Payment mode selector */}
      <View style={{ gap: 4 }}>
        <Text
          style={{
            fontFamily: "GoogleSans_700Bold",
            fontSize: 9,
            color: "rgba(1,31,75,0.50)",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Payment Method
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {[
            ["cash", "💵", "Cash"],
            ["gcash", "📱", "GCash"],
            ["credit", "🪙", "Credit"],
          ].map(([mode, icon, label]) => (
            <TouchableOpacity
              key={mode}
              style={[cs.payTab, paymentMode === mode && cs.payTabActive]}
              onPress={() => {
                setPaymentMode(mode);
                setEmpDropdownOpen(false);
                setEmpSearch("");
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13 }}>{icon}</Text>
              <Text
                style={[
                  cs.payTabTxt,
                  paymentMode === mode && cs.payTabTxtActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Credit: employee dropdown with search */}
      {paymentMode === "credit" && (
        <View style={{ gap: 4 }}>
          <Text
            style={{
              fontFamily: "GoogleSans_700Bold",
              fontSize: 9,
              color: "rgba(1,31,75,0.50)",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Employee Name *
          </Text>
          {/* Selected display / search trigger */}
          <TouchableOpacity
            style={[
              cs.amtInput,
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              },
            ]}
            onPress={() => {
              setEmpDropdownOpen((v) => !v);
              setEmpSearch("");
            }}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontFamily: "GoogleSans_400Regular",
                fontSize: 12,
                color: memberName ? "rgba(1,31,75,0.85)" : "rgba(1,31,75,0.30)",
                flex: 1,
              }}
              numberOfLines={1}
            >
              {memberName || "Select employee..."}
            </Text>
            <MaterialIcons
              name={
                empDropdownOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"
              }
              size={16}
              color="rgba(1,31,75,0.45)"
            />
          </TouchableOpacity>
          {/* Dropdown */}
          {empDropdownOpen && (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(1,31,75,0.15)",
                overflow: "hidden",
                elevation: 6,
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 8,
              }}
            >
              {/* Search bar */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  borderBottomWidth: 1,
                  borderColor: "rgba(1,31,75,0.08)",
                  gap: 6,
                }}
              >
                <MaterialIcons
                  name="search"
                  size={14}
                  color="rgba(1,31,75,0.40)"
                />
                <TextInput
                  style={{
                    flex: 1,
                    fontFamily: "GoogleSans_400Regular",
                    fontSize: 12,
                    color: "rgba(1,31,75,0.85)",
                    paddingVertical: 2,
                  }}
                  value={empSearch}
                  onChangeText={setEmpSearch}
                  placeholder="Search employee..."
                  placeholderTextColor="rgba(1,31,75,0.30)"
                  autoFocus
                />
                {empSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setEmpSearch("")}>
                    <MaterialIcons
                      name="close"
                      size={13}
                      color="rgba(1,31,75,0.35)"
                    />
                  </TouchableOpacity>
                )}
              </View>
              {/* List */}
              <ScrollView
                style={{ maxHeight: 180 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {EMPLOYEES.filter((e) =>
                  e.toLowerCase().includes(empSearch.toLowerCase()),
                ).map((emp) => (
                  <TouchableOpacity
                    key={emp}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      borderBottomWidth: 1,
                      borderColor: "rgba(1,31,75,0.05)",
                      backgroundColor:
                        memberName === emp
                          ? "rgba(26,58,107,0.07)"
                          : "transparent",
                    }}
                    onPress={() => {
                      setMemberName(emp);
                      setMemberId("");
                      setEmpDropdownOpen(false);
                      setEmpSearch("");
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontFamily:
                          memberName === emp
                            ? "GoogleSans_700Bold"
                            : "GoogleSans_400Regular",
                        fontSize: 12,
                        color:
                          memberName === emp ? "#1a3a6b" : "rgba(1,31,75,0.75)",
                      }}
                    >
                      {emp}
                    </Text>
                  </TouchableOpacity>
                ))}
                {EMPLOYEES.filter((e) =>
                  e.toLowerCase().includes(empSearch.toLowerCase()),
                ).length === 0 && (
                  <Text
                    style={{
                      fontFamily: "GoogleSans_400Regular",
                      fontSize: 11,
                      color: "rgba(1,31,75,0.35)",
                      textAlign: "center",
                      padding: 12,
                    }}
                  >
                    No employee found
                  </Text>
                )}
              </ScrollView>
            </View>
          )}
          {/* Clear selection */}
          {memberName ? (
            <TouchableOpacity
              onPress={() => {
                setMemberName("");
                setMemberId("");
              }}
              style={{ alignSelf: "flex-end" }}
            >
              <Text
                style={{
                  fontFamily: "GoogleSans_400Regular",
                  fontSize: 10,
                  color: "#e74c3c",
                }}
              >
                ✕ Clear selection
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={cs.cartItemsBox}>
        {cartItems.length === 0 ? (
          <Text style={cs.cartEmpty}>No items added yet</Text>
        ) : (
          <WebScrollView style={{ flex: 1 }}>
            {cartItems.map(({ item, qty }) => (
              <View key={item.id} style={cs.cartRow}>
                <Text style={cs.cartEmoji}>{item.emoji}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={cs.cartName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={cs.cartSub}>
                    ₱{item.price} × {qty} = ₱{item.price * qty}
                  </Text>
                </View>
                <View style={cs.qtyRow}>
                  <TouchableOpacity
                    style={cs.qBtn}
                    onPress={() => removeFromCart(item)}
                  >
                    <Text style={cs.qBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <Text style={cs.qVal}>{qty}</Text>
                  <TouchableOpacity
                    style={[cs.qBtn, { backgroundColor: "#1a3a6b" }]}
                    onPress={() => addToCart(item)}
                  >
                    <Text style={[cs.qBtnTxt, { color: "#fff" }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </WebScrollView>
        )}
      </View>

      <View style={cs.totalRow}>
        <Text style={cs.totalLbl}>TOTAL</Text>
        <Text style={cs.totalVal}>₱ {total.toFixed(2)}</Text>
      </View>

      <TouchableOpacity
        style={[
          cs.orderBtn,
          (cartItems.length === 0 ||
            (paymentMode === "credit" && !memberName.trim())) && {
            opacity: 0.45,
          },
        ]}
        onPress={() => {
          if (cartItems.length === 0) return;
          if (paymentMode === "credit" && !memberName.trim()) {
            Alert.alert(
              "Member Required",
              "Ibutang ang pangalan sa member para sa credit order.",
            );
            return;
          }
          setPayModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={
            cartItems.length > 0 ? ["#1a3a6b", "#2e5fa3"] : ["#aaa", "#bbb"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={cs.orderBtnGrad}
        >
          <MaterialIcons
            name={
              paymentMode === "cash"
                ? "payments"
                : paymentMode === "gcash"
                  ? "phone-android"
                  : "account-balance"
            }
            size={16}
            color="#fff"
          />
          <Text style={cs.orderBtnTxt}>
            {paymentMode === "cash"
              ? "Proceed to Payment"
              : paymentMode === "gcash"
                ? "Verify GCash"
                : "Add to Credit"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={cs.clearBtn} onPress={clearCart}>
        <MaterialIcons name="delete-sweep" size={14} color="#e74c3c" />
        <Text style={cs.clearBtnTxt}>Clear Cart</Text>
      </TouchableOpacity>
      {lastOrder && (
        <TouchableOpacity
          style={cs.receiptBtn}
          onPress={() => setReceiptVisible(true)}
        >
          <MaterialIcons name="receipt" size={14} color="#1a3a6b" />
          <Text style={cs.receiptBtnTxt}>Last Receipt</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        flexDirection: csIsWide ? "row" : "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Items side */}
      <View
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginBottom: 6 }}
          contentContainerStyle={{
            paddingHorizontal: 10,
            gap: 5,
            paddingVertical: 4,
          }}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[cs.catTab, activeCat === cat && cs.catTabActive]}
              onPress={() => setActiveCat(cat)}
            >
              <Text
                style={[cs.catTabTxt, activeCat === cat && cs.catTabTxtActive]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={cs.searchRow}>
          <Text style={{ fontSize: 12, marginRight: 5 }}>🔍</Text>
          <TextInput
            style={cs.searchInput}
            placeholder="Search items..."
            placeholderTextColor="rgba(1,31,75,0.35)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={{ color: "rgba(1,31,75,0.40)", fontWeight: "700" }}>
                ✕
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <WebScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: 10,
            paddingHorizontal: 12,
            paddingBottom: 20,
            gap: 8,
          }}
        >
          {Array.from(
            { length: Math.ceil(filtered.length / COLS) },
            (_, rowIdx) => (
              <View
                key={rowIdx}
                style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}
              >
                {filtered
                  .slice(rowIdx * COLS, rowIdx * COLS + COLS)
                  .map((item) => (
                    <View
                      key={item.id}
                      style={{ flex: 1, alignSelf: "stretch" }}
                    >
                      <TouchableOpacity
                        style={[
                          cs.itemCard,
                          item.stock === 0 && { opacity: 0.45 },
                          { flex: 1 },
                        ]}
                        onPress={() => item.stock > 0 && addToCart(item)}
                        activeOpacity={item.stock > 0 ? 0.75 : 1}
                      >
                        <View style={cs.itemImgCircle}>
                          {item.image ? (
                            <Image
                              source={{ uri: item.image }}
                              style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: 99,
                              }}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={cs.itemEmoji}>{item.emoji}</Text>
                          )}
                        </View>
                        <Text style={cs.itemCardName} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={cs.itemCardPrice}>₱{item.price}</Text>
                        <Text style={cs.itemCardStock}>
                          {item.stock === 0
                            ? "Out of stock"
                            : `Stock: ${item.stock}`}
                        </Text>
                        {cart[item.id] && (
                          <View style={cs.cartBadge}>
                            <Text style={cs.cartBadgeTxt}>
                              {cart[item.id].qty}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                {Array.from({
                  length:
                    COLS -
                    filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS).length,
                }).map((_, i) => (
                  <View key={`e-${i}`} style={{ flex: 1 }} />
                ))}
              </View>
            ),
          )}
        </WebScrollView>
      </View>

      {/* Wide: side cart panel */}
      {csIsWide && (
        <View style={cs.cartPanel}>
          <Text style={cs.cartTitle}>
            🛒 CART {cartItems.length > 0 ? `(${cartItems.length})` : ""}
          </Text>
          <CartContent />
        </View>
      )}

      {/* Mobile: floating pill + bottom sheet */}
      {!csIsWide && (
        <>
          <TouchableOpacity
            style={cs.floatCart}
            onPress={openCart}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#c9a84c", "#e8c87a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={cs.floatCartGrad}
            >
              <Text style={cs.floatCartTxt}>
                🛒 View Cart{" "}
                {cartItems.length > 0 ? `(${cartItems.length})` : ""} • ₱
                {total.toFixed(2)}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          {!cartCollapsed && (
            <View style={cs.sheetOverlay}>
              <TouchableOpacity
                style={cs.sheetBackdrop}
                onPress={closeCart}
                activeOpacity={1}
              />
              <Animated.View
                style={[
                  cs.sheet,
                  {
                    transform: [
                      {
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [600, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={cs.sheetHandle} />
                <View style={cs.sheetHeader}>
                  <Text style={cs.cartTitle}>
                    🛒 CART{" "}
                    {cartItems.length > 0 ? `(${cartItems.length})` : ""}
                  </Text>
                  <TouchableOpacity onPress={closeCart} style={cs.sheetClose}>
                    <Text style={{ color: "rgba(1,31,75,0.6)", fontSize: 14 }}>
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  <CartContent />
                </ScrollView>
              </Animated.View>
            </View>
          )}
        </>
      )}

      {/* Payment confirmation modal — gated before order saves */}
      <PaymentConfirmModal
        visible={payModalVisible}
        paymentMode={paymentMode}
        total={total}
        cartItems={cartItems}
        memberName={memberName}
        memberId={memberId}
        onConfirm={handleConfirmedOrder}
        onCancel={() => setPayModalVisible(false)}
      />

      {/* Receipt modal */}
      {receiptVisible && lastOrder && (
        <Modal
          transparent
          visible
          animationType="fade"
          onRequestClose={() => setReceiptVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(1,20,50,0.65)",
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              onPress={() => setReceiptVisible(false)}
              activeOpacity={1}
            />
            <View style={cs.receipt}>
              <Text style={cs.receiptTitle}>🧾 RECEIPT</Text>
              <Text style={cs.receiptSub}>CESLA Grocery</Text>
              <View
                style={{
                  height: 1,
                  borderStyle: "dashed",
                  borderTopWidth: 1,
                  borderColor: "rgba(1,31,75,0.20)",
                  marginVertical: 10,
                }}
              />
              <Text style={cs.receiptMeta}>Order #{lastOrder.orderNo}</Text>
              <Text style={cs.receiptMeta}>{lastOrder.time}</Text>
              <View
                style={{
                  height: 1,
                  borderStyle: "dashed",
                  borderTopWidth: 1,
                  borderColor: "rgba(1,31,75,0.20)",
                  marginVertical: 10,
                }}
              />
              <ScrollView
                style={{ maxHeight: 160 }}
                showsVerticalScrollIndicator={false}
              >
                {(lastOrder.items || []).map(({ item, qty }) => (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text style={cs.receiptItem} numberOfLines={1}>
                      {item.emoji} {item.name} ×{qty}
                    </Text>
                    <Text style={cs.receiptAmt}>
                      ₱{(item.price * qty).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <View
                style={{
                  height: 1,
                  backgroundColor: "rgba(1,31,75,0.15)",
                  marginVertical: 8,
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={cs.receiptTotalLbl}>TOTAL</Text>
                <Text style={cs.receiptTotalVal}>
                  ₱{lastOrder.total.toFixed(2)}
                </Text>
              </View>
              {lastOrder.payment === "cash" && (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 3,
                    }}
                  >
                    <Text style={cs.receiptSubLbl}>💵 Cash</Text>
                    <Text style={cs.receiptSubVal}>
                      ₱{Number(lastOrder.amountPaid).toFixed(2)}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 3,
                    }}
                  >
                    <Text style={cs.receiptSubLbl}>Change</Text>
                    <Text style={[cs.receiptSubVal, { color: "#27ae60" }]}>
                      ₱{Number(lastOrder.change).toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
              {lastOrder.payment === "gcash" && (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 3,
                    }}
                  >
                    <Text style={cs.receiptSubLbl}>📱 GCash</Text>
                    <Text style={[cs.receiptSubVal, { color: "#27ae60" }]}>
                      ✓ Verified
                    </Text>
                  </View>
                  {lastOrder.gcashRef && (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: 3,
                      }}
                    >
                      <Text style={cs.receiptSubLbl}>Ref #</Text>
                      <Text style={cs.receiptSubVal}>{lastOrder.gcashRef}</Text>
                    </View>
                  )}
                </>
              )}
              {lastOrder.payment === "credit" && (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 3,
                    }}
                  >
                    <Text style={cs.receiptSubLbl}>🪙 Credit</Text>
                    <Text style={[cs.receiptSubVal, { color: "#c9a84c" }]}>
                      Utang
                    </Text>
                  </View>
                  {lastOrder.memberName && (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: 3,
                      }}
                    >
                      <Text style={cs.receiptSubLbl}>Member</Text>
                      <Text style={cs.receiptSubVal}>
                        {lastOrder.memberName}
                      </Text>
                    </View>
                  )}
                </>
              )}
              <Text
                style={{
                  fontFamily: "GoogleSans_700Bold",
                  fontSize: 12,
                  color: "#1a3a6b",
                  textAlign: "center",
                  marginTop: 12,
                }}
              >
                Thank you! 🙏
              </Text>
              <TouchableOpacity
                onPress={() => setReceiptVisible(false)}
                style={{
                  marginTop: 12,
                  paddingVertical: 10,
                  backgroundColor: "rgba(26,58,107,0.10)",
                  borderRadius: 10,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "GoogleSans_700Bold",
                    fontSize: 13,
                    color: "#1a3a6b",
                  }}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const cs = StyleSheet.create({
  catTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  catTabActive: { backgroundColor: "#304674", borderColor: "#c9a84c" },
  catTabTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "rgba(1,31,75,0.70)",
  },
  catTabTxtActive: { color: "#fff" },
  payTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.40)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.60)",
  },
  payTabActive: { backgroundColor: "#1a3a6b", borderColor: "#c9a84c" },
  payTabTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "rgba(1,31,75,0.60)",
  },
  payTabTxtActive: { color: "#fff" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.70)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginHorizontal: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.90)",
  },
  searchInput: {
    flex: 1,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "#011f4b",
    paddingVertical: 0,
  },
  itemCard: {
    flex: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.70)",
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    position: "relative",
    minHeight: 140,
  },
  itemImgCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(240,246,252,0.90)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.80)",
    flexShrink: 0,
  },
  itemEmoji: { fontSize: 24 },
  itemCardName: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#1a2d4e",
    textAlign: "center",
    lineHeight: 14,
    minHeight: 28,
    width: "100%",
  },
  itemCardPrice: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 14,
    color: "#c9a84c",
  },
  itemCardStock: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 8,
    color: "rgba(1,31,75,0.45)",
  },
  cartBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#e74c3c",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "#fff",
  },
  cartPanel: {
    width: 240,
    flexShrink: 0,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderLeftWidth: 1,
    borderColor: "rgba(255,255,255,0.40)",
    padding: 10,
    gap: 6,
    minHeight: 0,
    overflow: "hidden",
  },
  cartTitle: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "rgba(1,31,75,0.65)",
    letterSpacing: 2,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.10)",
  },
  cartItemsBox: {
    flex: 1,
    minHeight: 180,
    backgroundColor: "rgba(255,255,255,0.40)",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    overflow: "hidden",
  },
  cartEmpty: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.40)",
    textAlign: "center",
    paddingTop: 12,
  },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.06)",
  },
  cartEmoji: { fontSize: 15 },
  cartName: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "#011f4b",
  },
  cartSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 9,
    color: "rgba(1,31,75,0.50)",
  },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  qBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(1,31,75,0.10)",
    justifyContent: "center",
    alignItems: "center",
  },
  qBtnTxt: {
    fontSize: 11,
    color: "#011f4b",
    fontWeight: "700",
    lineHeight: 14,
  },
  qVal: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#011f4b",
    minWidth: 12,
    textAlign: "center",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  totalLbl: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "rgba(1,31,75,0.55)",
    letterSpacing: 1,
  },
  totalVal: { fontFamily: "NotoSerif_700Bold", fontSize: 13, color: "#c9a84c" },
  amtInput: {
    backgroundColor: "rgba(255,255,255,0.70)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "#011f4b",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
  },
  changeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  changeLbl: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 10,
    color: "rgba(1,31,75,0.60)",
  },
  changeVal: { fontFamily: "NotoSerif_700Bold", fontSize: 13 },
  orderBtn: { borderRadius: 10, overflow: "hidden" },
  orderBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  orderBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "#fff",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    backgroundColor: "rgba(231,76,60,0.10)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(231,76,60,0.20)",
  },
  clearBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "#e74c3c",
  },
  receiptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    backgroundColor: "rgba(26,58,107,0.10)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(26,58,107,0.20)",
  },
  receiptBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "#1a3a6b",
  },
  floatCart: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  floatCartGrad: {
    borderRadius: 30,
    paddingVertical: 11,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  floatCartTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 14,
    color: "#0d1b3e",
    fontWeight: "700",
  },
  sheetOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    zIndex: 100,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(1,20,50,0.45)",
  },
  sheet: {
    backgroundColor: "#f0f5f9",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    maxHeight: "92%",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(1,31,75,0.20)",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.10)",
  },
  sheetClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(1,31,75,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  receipt: {
    backgroundColor: "#fffef8",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 14,
  },
  receiptTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: "#1a2d4e",
    textAlign: "center",
  },
  receiptSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.50)",
    textAlign: "center",
    marginTop: 2,
  },
  receiptMeta: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.55)",
    textAlign: "center",
    lineHeight: 17,
  },
  receiptItem: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "#1a2d4e",
    flex: 1,
    marginRight: 8,
  },
  receiptAmt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "#1a2d4e",
  },
  receiptTotalLbl: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 14,
    color: "#1a2d4e",
  },
  receiptTotalVal: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 16,
    color: "#c9a84c",
  },
  receiptSubLbl: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(1,31,75,0.55)",
  },
  receiptSubVal: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "rgba(1,31,75,0.70)",
  },
});

// ─── MANAGE ITEMS SCREEN ──────────────────────────────────────────────────────
const ManageItemsScreen = ({
  items,
  categories,
  filtered,
  search,
  activeCategory,
  onSearch,
  onCategoryChange,
  onAddItem,
  onEditItem,
  onDeleteItem,
  isWide: mmIsWide,
}) => {
  const COLS = mmIsWide ? 6 : 3;
  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{
          flexGrow: 0,
          flexShrink: 0,
          backgroundColor: "rgba(255,255,255,0.12)",
        }}
        contentContainerStyle={{
          paddingHorizontal: 8,
          paddingVertical: 6,
          gap: 5,
        }}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[mm.catTabH, activeCategory === cat && mm.catTabHActive]}
            onPress={() => onCategoryChange(cat)}
          >
            <Text
              style={[
                mm.catTabHTxt,
                activeCategory === cat && mm.catTabHTxtActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
        <View style={mm.headerRow}>
          <Text style={mm.headerLbl} numberOfLines={1}>
            {search.trim()
              ? `RESULTS FOR "${search.toUpperCase()}"`
              : activeCategory === "All"
                ? "ALL ITEMS"
                : activeCategory.toUpperCase()}
          </Text>
          <View style={mm.searchBox}>
            <Text style={{ fontSize: 11, marginRight: 4 }}>🔍</Text>
            <TextInput
              style={mm.searchInput}
              placeholder="Search..."
              placeholderTextColor="rgba(1,31,75,0.35)"
              value={search}
              onChangeText={onSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => onSearch("")}>
                <Text
                  style={{
                    color: "rgba(1,31,75,0.45)",
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={mm.addBtn} onPress={onAddItem}>
            <MaterialIcons name="add" size={15} color="#fff" />
            <Text style={mm.addBtnTxt}>Add Item</Text>
          </TouchableOpacity>
        </View>
        <View
          style={{
            height: 1,
            backgroundColor: "rgba(1,31,75,0.10)",
            marginBottom: 8,
            marginHorizontal: 8,
          }}
        />
        <WebScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: 10,
            paddingHorizontal: 12,
            paddingBottom: 20,
            gap: 8,
          }}
        >
          {filtered.length === 0 ? (
            <Text style={mm.emptyTxt}>No items found.</Text>
          ) : (
            Array.from(
              { length: Math.ceil(filtered.length / COLS) },
              (_, rowIdx) => (
                <View
                  key={rowIdx}
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "stretch",
                  }}
                >
                  {filtered
                    .slice(rowIdx * COLS, rowIdx * COLS + COLS)
                    .map((item) => (
                      <View
                        key={item.id}
                        style={{ flex: 1, minWidth: 0, alignSelf: "stretch" }}
                      >
                        <View style={mm.foodCard}>
                          <View
                            style={[
                              mm.foodCardInner,
                              { backgroundColor: "rgba(225,238,248,0.85)" },
                            ]}
                          >
                            <View style={mm.adminBtns}>
                              <TouchableOpacity
                                style={mm.editBtn}
                                onPress={() => onEditItem(item)}
                              >
                                <MaterialIcons
                                  name="edit"
                                  size={11}
                                  color="#1a3a6b"
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={mm.delBtn}
                                onPress={() => onDeleteItem(item.id)}
                              >
                                <MaterialIcons
                                  name="delete"
                                  size={11}
                                  color="#e74c3c"
                                />
                              </TouchableOpacity>
                            </View>
                            <View style={mm.emojiCircle}>
                              {item.image ? (
                                <Image
                                  source={{ uri: item.image }}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    borderRadius: 99,
                                  }}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Text style={mm.emojiTxt}>{item.emoji}</Text>
                              )}
                            </View>
                            <Text style={mm.itemName} numberOfLines={2}>
                              {item.name}
                            </Text>
                            <Text style={mm.itemStock}>
                              Stock: {item.stock}
                            </Text>
                            <Text style={mm.itemPrice}>₱{item.price}.00</Text>
                            <TouchableOpacity
                              style={mm.editItemBtn}
                              onPress={() => onEditItem(item)}
                            >
                              <Text style={mm.editItemBtnTxt}>Edit Item</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                  {Array.from({
                    length:
                      COLS -
                      filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS)
                        .length,
                  }).map((_, i) => (
                    <View key={`e-${i}`} style={{ flex: 1 }} />
                  ))}
                </View>
              ),
            )
          )}
        </WebScrollView>
      </View>
    </View>
  );
};

const mm = StyleSheet.create({
  catTabH: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  catTabHActive: { backgroundColor: "#304674", borderColor: "#c9a84c" },
  catTabHTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "rgba(1,31,75,0.70)",
  },
  catTabHTxtActive: { color: "#fff" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    paddingBottom: 0,
  },
  headerLbl: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "#011f4b",
    letterSpacing: 2,
    flexShrink: 0,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.90)",
  },
  searchInput: {
    flex: 1,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "#011f4b",
    paddingVertical: 0,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1a3a6b",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  addBtnTxt: { fontFamily: "GoogleSans_700Bold", fontSize: 11, color: "#fff" },
  emptyTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "rgba(1,31,75,0.40)",
    textAlign: "center",
    marginTop: 30,
  },
  foodCard: {
    borderRadius: 12,
    overflow: "hidden",
    flex: 1,
    alignSelf: "stretch",
  },
  foodCardInner: {
    borderRadius: 12,
    padding: 9,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    gap: 2,
    flex: 1,
    justifyContent: "space-between",
    position: "relative",
    minHeight: 145,
  },
  adminBtns: {
    position: "absolute",
    top: 4,
    right: 4,
    flexDirection: "row",
    gap: 3,
    zIndex: 10,
  },
  editBtn: {
    backgroundColor: "rgba(26,58,107,0.12)",
    borderRadius: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(26,58,107,0.20)",
  },
  delBtn: {
    backgroundColor: "rgba(231,76,60,0.10)",
    borderRadius: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(231,76,60,0.20)",
  },
  emojiCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(240,246,252,0.90)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  emojiTxt: { fontSize: 22 },
  itemName: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "#1a2d4e",
    textAlign: "center",
    lineHeight: 12,
    minHeight: 24,
    alignSelf: "stretch",
  },
  itemStock: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 8,
    color: "rgba(1,31,75,0.45)",
  },
  itemPrice: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 12,
    color: "#c9a84c",
  },
  editItemBtn: {
    backgroundColor: "#1a3a6b",
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: "center",
    width: "100%",
  },
  editItemBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 8,
    color: "#fff",
  },
});

// ─── INVENTORY SCREEN ─────────────────────────────────────────────────────────
const InventoryScreen = ({ items, maxQtyMap, onAddItem, onEditItem }) => {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  const formatDateLabel = (d) => {
    const now = new Date();
    const opts = { month: "long", day: "numeric", year: "numeric" };
    if (d.toDateString() === now.toDateString())
      return "Today's Stocks, " + d.toLocaleDateString("en-PH", opts);
    if (d.toDateString() === new Date(now - 86400000).toDateString())
      return "Yesterday's Stocks, " + d.toLocaleDateString("en-PH", opts);
    return "Stocks — " + d.toLocaleDateString("en-PH", opts);
  };

  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const calDays = (() => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const days = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    return cells;
  })();

  const getMax = (id) =>
    maxQtyMap && maxQtyMap[id] !== undefined
      ? maxQtyMap[id]
      : items.find((i) => i.id === id)?.maxQty || 50;
  const overallQty = items.reduce((s, i) => s + i.stock, 0);
  const grandTotal = items.reduce((s, i) => s + i.price * i.stock, 0);

  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginHorizontal: 14,
          marginTop: 8,
          marginBottom: 6,
        }}
      >
        <TouchableOpacity
          style={inv.titleRow}
          onPress={() => setShowDatePicker((p) => !p)}
          activeOpacity={0.8}
        >
          <Text style={inv.titleText}>{formatDateLabel(selectedDate)}</Text>
          <Text style={inv.titleCaret}>{showDatePicker ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={inv.addItemBtn}
          onPress={() => onAddItem && onAddItem()}
          activeOpacity={0.8}
        >
          <Text style={inv.addItemBtnTxt}>+ Add Item</Text>
        </TouchableOpacity>
      </View>
      {showDatePicker && (
        <View style={inv.calCard}>
          <View style={inv.calNav}>
            <TouchableOpacity
              style={inv.calNavBtn}
              onPress={() => {
                if (calMonth === 0) {
                  setCalMonth(11);
                  setCalYear((y) => y - 1);
                } else setCalMonth((m) => m - 1);
              }}
            >
              <Text style={inv.calNavTxt}>‹</Text>
            </TouchableOpacity>
            <Text style={inv.calMonthLbl}>
              {MONTHS[calMonth]} {calYear}
            </Text>
            <TouchableOpacity
              style={inv.calNavBtn}
              onPress={() => {
                if (calMonth === 11) {
                  setCalMonth(0);
                  setCalYear((y) => y + 1);
                } else setCalMonth((m) => m + 1);
              }}
            >
              <Text style={inv.calNavTxt}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={inv.calDaysRow}>
            {DAYS.map((d) => (
              <Text key={d} style={inv.calDayHdr}>
                {d}
              </Text>
            ))}
          </View>
          <View style={inv.calGrid}>
            {calDays.map((day, idx) => {
              if (!day) return <View key={"e" + idx} style={inv.calCell} />;
              const thisDate = new Date(calYear, calMonth, day);
              const isSelected =
                thisDate.toDateString() === selectedDate.toDateString();
              const isToday = thisDate.toDateString() === today.toDateString();
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    inv.calCell,
                    isSelected && inv.calCellSel,
                    isToday && !isSelected && inv.calCellToday,
                  ]}
                  onPress={() => {
                    setSelectedDate(new Date(calYear, calMonth, day));
                    setShowDatePicker(false);
                  }}
                >
                  <Text
                    style={[inv.calCellTxt, isSelected && inv.calCellTxtSel]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
      <View style={inv.tableWrap}>
        <View style={inv.thead}>
          <Text style={[inv.th, inv.colName]}>ITEM NAME</Text>
          <Text style={[inv.th, inv.colCat]}>CATEGORY</Text>
          <Text style={[inv.th, inv.colQty]}>QTY</Text>
          <Text style={[inv.th, inv.colMaxQty]}>MAX QTY</Text>
          <Text style={[inv.th, inv.colPrice]}>PRICE</Text>
          <Text style={[inv.th, inv.colValue]}>VALUE</Text>
          <Text style={[inv.th, inv.colRestock]}>RE-STOCK</Text>
        </View>
        <WebScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 0 }}>
          {items.map((item, idx) => {
            const max = getMax(item.id);
            const restock = Math.max(0, max - item.stock);
            return (
              <TouchableOpacity
                key={item.id}
                style={[inv.trow, idx % 2 === 0 && inv.trowAlt]}
                onPress={() => onEditItem && onEditItem(item)}
                activeOpacity={0.75}
              >
                <View style={[inv.td, inv.colName]}>
                  <Text style={inv.tdName} numberOfLines={1}>
                    {item.emoji} {item.name}
                  </Text>
                </View>
                <View style={[inv.td, inv.colCat]}>
                  <Text style={inv.tdMuted} numberOfLines={1}>
                    {item.cat}
                  </Text>
                </View>
                <View style={[inv.td, inv.colQty]}>
                  <Text
                    style={[
                      inv.tdNum,
                      item.stock === 0 && {
                        color: "#e74c3c",
                        fontFamily: "GoogleSans_700Bold",
                      },
                      item.stock <= 5 &&
                        item.stock > 0 && {
                          color: "#b85c00",
                          fontFamily: "GoogleSans_700Bold",
                        },
                    ]}
                  >
                    {item.stock}
                  </Text>
                </View>
                <View style={[inv.td, inv.colMaxQty]}>
                  <Text style={[inv.tdNum, { textAlign: "center" }]}>
                    {max}
                  </Text>
                </View>
                <View style={[inv.td, inv.colPrice]}>
                  <Text style={inv.tdNum}>₱{item.price.toLocaleString()}</Text>
                </View>
                <View style={[inv.td, inv.colValue]}>
                  <Text
                    style={[
                      inv.tdNum,
                      { color: "#1a3a6b", fontFamily: "GoogleSans_700Bold" },
                    ]}
                  >
                    ₱{(item.price * item.stock).toLocaleString()}
                  </Text>
                </View>
                <View style={[inv.td, inv.colRestock]}>
                  {restock > 0 ? (
                    <View style={inv.restockBadge}>
                      <Text style={inv.restockNeed}>Need {restock}</Text>
                      <Text style={inv.restockSub}>
                        ({item.stock}/{max})
                      </Text>
                    </View>
                  ) : (
                    <Text style={inv.restockOk}>✓ OK</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </WebScrollView>
        <View style={inv.tfooter}>
          <View style={[inv.td, inv.colName]}>
            <Text style={inv.tfootLbl}>TOTALS</Text>
          </View>
          <View style={[inv.td, inv.colCat]} />
          <View style={[inv.td, inv.colQty]}>
            <Text style={[inv.tfootVal, { textAlign: "center" }]}>
              {overallQty}
            </Text>
          </View>
          <View style={[inv.td, inv.colMaxQty]} />
          <View style={[inv.td, inv.colPrice]} />
          <View style={[inv.td, inv.colValue]}>
            <Text
              style={[inv.tfootVal, { color: "#8a6500", textAlign: "center" }]}
            >
              ₱{grandTotal.toLocaleString()}
            </Text>
          </View>
          <View style={[inv.td, inv.colRestock]} />
        </View>
      </View>
    </View>
  );
};

const inv = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(26,58,107,0.10)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(26,58,107,0.15)",
    alignSelf: "flex-start",
  },
  titleText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 12,
    color: "#1a3a6b",
  },
  titleCaret: { fontSize: 10, color: "rgba(26,58,107,0.50)" },
  addItemBtn: {
    backgroundColor: "#1a3a6b",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.40)",
  },
  addItemBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#fff",
    letterSpacing: 0.3,
  },
  calCard: {
    position: "absolute",
    top: 52,
    left: 14,
    zIndex: 999,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(26,58,107,0.18)",
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 20,
    minWidth: 220,
    maxWidth: 260,
  },
  calNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  calNavBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(26,58,107,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  calNavTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "#1a3a6b",
  },
  calMonthLbl: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#1a3a6b",
  },
  calDaysRow: { flexDirection: "row", marginBottom: 2 },
  calDayHdr: {
    flex: 1,
    fontFamily: "GoogleSans_700Bold",
    fontSize: 8,
    color: "rgba(26,58,107,0.45)",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: {
    width: "14.28%",
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },
  calCellSel: { backgroundColor: "#1a3a6b" },
  calCellToday: {
    backgroundColor: "rgba(201,168,76,0.20)",
    borderWidth: 1,
    borderColor: "#c9a84c",
  },
  calCellTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 9,
    color: "#1a3a6b",
  },
  calCellTxtSel: { fontFamily: "GoogleSans_700Bold", color: "#fff" },
  tableWrap: { flex: 1, minHeight: 0, marginHorizontal: 14, marginBottom: 10 },
  thead: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,58,107,0.14)",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  th: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "rgba(26,58,107,0.60)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "rgba(26,58,107,0.10)",
    paddingHorizontal: 4,
  },
  trow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 42,
    borderBottomWidth: 1,
    borderColor: "rgba(26,58,107,0.07)",
  },
  trowAlt: { backgroundColor: "rgba(255,255,255,0.38)" },
  td: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderColor: "rgba(26,58,107,0.10)",
  },
  colName: { flex: 2.2, minWidth: 0, alignItems: "flex-start" },
  colCat: { flex: 1.1, minWidth: 0, alignItems: "center" },
  colQty: { flex: 0.6, minWidth: 0, alignItems: "center" },
  colMaxQty: { flex: 0.8, minWidth: 0, alignItems: "center" },
  colPrice: { flex: 0.9, minWidth: 0, alignItems: "center" },
  colValue: { flex: 1.0, minWidth: 0, alignItems: "center" },
  colRestock: { flex: 1.0, minWidth: 0, alignItems: "center" },
  tdName: { fontFamily: "GoogleSans_700Bold", fontSize: 11, color: "#1a2d4e" },
  tdMuted: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(26,58,107,0.65)",
    textAlign: "center",
  },
  tdNum: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 11,
    color: "#1a2d4e",
    textAlign: "center",
  },
  restockBadge: { alignItems: "center" },
  restockNeed: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "#b85c00",
  },
  restockSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 9,
    color: "rgba(26,58,107,0.45)",
  },
  restockOk: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#1a7a45",
  },
  tfooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "rgba(26,58,107,0.10)",
    borderRadius: 6,
    marginTop: 4,
    borderTopWidth: 1.5,
    borderColor: "rgba(26,58,107,0.18)",
  },
  tfootLbl: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "#1a3a6b",
    letterSpacing: 0.5,
  },
  tfootVal: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "#1a3a6b",
    textAlign: "center",
    letterSpacing: 0.2,
  },
});

// ─── ORDER HISTORY SCREEN ─────────────────────────────────────────────────────
const OrderHistoryScreen = ({ orders }) => {
  const todayCal = new Date();
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calMonth, setCalMonth] = useState(todayCal.getMonth());
  const [calYear, setCalYear] = useState(todayCal.getFullYear());

  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const calDays = (() => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const dim = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(d);
    return cells;
  })();

  const parseOrderDate = (o) => {
    if (o.createdAt?.toDate) return o.createdAt.toDate();
    if (o.createdAt) return new Date(o.createdAt);
    if (o.time) {
      const d = new Date(o.time);
      return isNaN(d) ? null : d;
    }
    return null;
  };
  const dateKey = (d) => {
    if (!d) return "unknown";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const todayKey = dateKey(new Date());

  const grouped = React.useMemo(() => {
    const map = {};
    [...orders].forEach((o) => {
      const d = parseOrderDate(o);
      const k = dateKey(d);
      if (!map[k]) map[k] = { key: k, date: d, orders: [] };
      map[k].orders.push(o);
    });
    Object.values(map).forEach((g) =>
      g.orders.sort(
        (a, b) =>
          (parseOrderDate(b)?.getTime() || 0) -
          (parseOrderDate(a)?.getTime() || 0),
      ),
    );
    return Object.values(map).sort(
      (a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0),
    );
  }, [orders]);

  React.useEffect(() => {
    const tg = grouped.find((g) => g.key === todayKey);
    setSelectedDate(tg ? todayKey : grouped[0]?.key || null);
  }, [grouped.length]);

  const selectedGroup = grouped.find((g) => g.key === selectedDate);
  const displayOrders = selectedGroup?.orders || [];
  const dayTotal = displayOrders.reduce((s, o) => s + Number(o.total), 0);

  const formatLabel = (key) => {
    if (!key || key === "unknown") return "Unknown Date";
    const [y, m, day] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, Number(day));
    if (key === todayKey)
      return `Today, ${d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}`;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (key === dateKey(yesterday))
      return `Yesterday, ${d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}`;
    return d.toLocaleDateString("en-PH", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <View style={[sub.root, { position: "relative" }]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <TouchableOpacity
          style={hst.calTrigger}
          onPress={() => setShowCalendar((p) => !p)}
          activeOpacity={0.8}
        >
          <Text style={hst.calTriggerTxt}>{formatLabel(selectedDate)}</Text>
          <Text style={hst.calTriggerCaret}>{showCalendar ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        <Text style={hst.txHeaderSub}>
          {displayOrders.length} order{displayOrders.length !== 1 ? "s" : ""}
          {"  ·  "}
          <Text style={{ color: "#c9a84c", fontFamily: "GoogleSans_700Bold" }}>
            ₱{dayTotal.toFixed(2)}
          </Text>
        </Text>
      </View>
      {showCalendar && (
        <View style={hst.calCard}>
          <View style={inv.calNav}>
            <TouchableOpacity
              style={inv.calNavBtn}
              onPress={() => {
                if (calMonth === 0) {
                  setCalMonth(11);
                  setCalYear((y) => y - 1);
                } else setCalMonth((m) => m - 1);
              }}
            >
              <Text style={inv.calNavTxt}>{"<"}</Text>
            </TouchableOpacity>
            <Text style={inv.calMonthLbl}>
              {MONTHS[calMonth]} {calYear}
            </Text>
            <TouchableOpacity
              style={inv.calNavBtn}
              onPress={() => {
                if (calMonth === 11) {
                  setCalMonth(0);
                  setCalYear((y) => y + 1);
                } else setCalMonth((m) => m + 1);
              }}
            >
              <Text style={inv.calNavTxt}>{">"}</Text>
            </TouchableOpacity>
          </View>
          <View style={inv.calDaysRow}>
            {DAYS.map((d) => (
              <Text key={d} style={inv.calDayHdr}>
                {d}
              </Text>
            ))}
          </View>
          <View style={inv.calGrid}>
            {calDays.map((day, idx) => {
              if (!day) return <View key={"e" + idx} style={inv.calCell} />;
              const dk =
                calYear +
                "-" +
                String(calMonth + 1).padStart(2, "0") +
                "-" +
                String(day).padStart(2, "0");
              const isSel = dk === selectedDate,
                isToday = dk === todayKey,
                hasOrders = grouped.some((g) => g.key === dk);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    inv.calCell,
                    isSel && inv.calCellSel,
                    isToday && !isSel && inv.calCellToday,
                    !hasOrders && { opacity: 0.3 },
                  ]}
                  onPress={() => {
                    if (hasOrders) {
                      setSelectedDate(dk);
                      setShowCalendar(false);
                    }
                  }}
                  activeOpacity={hasOrders ? 0.75 : 1}
                >
                  <Text style={[inv.calCellTxt, isSel && inv.calCellTxtSel]}>
                    {day}
                  </Text>
                  {hasOrders && !isSel && <View style={hst.calDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
      <View
        style={{
          height: 1,
          backgroundColor: "rgba(1,31,75,0.10)",
          marginVertical: 8,
        }}
      />
      {displayOrders.length === 0 ? (
        <View style={[sub.emptyBox, { flex: 1 }]}>
          <MaterialIcons
            name="receipt-long"
            size={48}
            color="rgba(1,31,75,0.15)"
          />
          <Text style={sub.emptyTxt}>No transactions for this day.</Text>
        </View>
      ) : (
        <WebScrollView contentContainerStyle={{ gap: 4, paddingBottom: 20 }}>
          {displayOrders.map((order, idx) => {
            const d = parseOrderDate(order);
            const timeOnly = d
              ? d.toLocaleTimeString("en-PH", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : order.time || "";
            const itemsSummary = (order.items || [])
              .map((i) => `${i.item?.name || i.name || "Item"} ×${i.qty}`)
              .join(" · ");
            const isLatest = idx === 0 && selectedDate === todayKey;
            const st = ORDER_STATUSES[order.status] || ORDER_STATUSES.pending;
            return (
              <View key={order.id || order.docId} style={hst.txRow}>
                <View style={hst.txTimeCol}>
                  <Text style={hst.txTime}>{timeOnly}</Text>
                  {isLatest && <View style={hst.livePip} />}
                </View>
                <View style={hst.txLine}>
                  <View
                    style={[
                      hst.txDot,
                      isLatest && { backgroundColor: "#e74c3c" },
                    ]}
                  />
                  {idx < displayOrders.length - 1 && (
                    <View style={hst.txVLine} />
                  )}
                </View>
                <View style={hst.txContent}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <Text style={hst.txOrderId}>
                      #{order.orderNo || order.id}
                    </Text>
                    <View
                      style={[hst.txStatusBadge, { backgroundColor: st.bg }]}
                    >
                      <Text style={[hst.txStatusTxt, { color: st.color }]}>
                        {st.label}
                      </Text>
                    </View>
                    {order.memberName && (
                      <Text
                        style={{
                          fontFamily: "GoogleSans_400Regular",
                          fontSize: 9,
                          color: "rgba(1,31,75,0.55)",
                        }}
                      >
                        👤 {order.memberName}
                      </Text>
                    )}
                  </View>
                  <Text style={hst.txItems} numberOfLines={2}>
                    {itemsSummary}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Text style={hst.txAmount}>
                      ₱{Number(order.total).toFixed(2)}
                    </Text>
                    <Text style={hst.txPay}>
                      {order.payment === "gcash"
                        ? "📱 GCash"
                        : order.payment === "credit"
                          ? "🪙 Credit"
                          : "💵 Cash"}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </WebScrollView>
      )}
    </View>
  );
};

// ─── CREDITS SCREEN ───────────────────────────────────────────────────────────
const CreditsScreen = () => {
  const [creditOrders, setCreditOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState("unpaid");
  const [settlingId, setSettlingId] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "grocery_orders"),
      (snap) => {
        const all = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
        const credits = all.filter((o) => {
          const pm = (o.payment || o.paymentMode || "").toLowerCase();
          return pm === "credit" || pm === "credits";
        });
        credits.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setCreditOrders(credits);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const grouped = React.useMemo(() => {
    const map = {};
    creditOrders.forEach((o) => {
      const resolvedName =
        o.memberName ||
        (o.firstName && o.lastName ? `${o.lastName}, ${o.firstName}` : null) ||
        o.firstName ||
        o.lastName ||
        o.memberUserId ||
        o.memberId ||
        "Unknown Member";
      const key = o.memberId || o.memberUserId || resolvedName;
      if (!map[key])
        map[key] = {
          memberId: o.memberId || "",
          memberUserId: o.memberUserId || "",
          memberName: resolvedName,
          orders: [],
        };
      map[key].orders.push(o);
    });
    return Object.values(map).sort((a, b) =>
      a.memberName.localeCompare(b.memberName),
    );
  }, [creditOrders]);

  const filtered = grouped.filter(
    (g) =>
      g.memberName.toLowerCase().includes(search.toLowerCase()) ||
      g.memberUserId.toLowerCase().includes(search.toLowerCase()),
  );

  const fmtDateTime = (ts) => {
    try {
      if (!ts) return "—";
      const d = ts?.toDate?.() || new Date(typeof ts === "number" ? ts : ts);
      if (isNaN(d.getTime())) return "—";
      return (
        d.toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) +
        "\n" +
        d.toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    } catch {
      return "—";
    }
  };

  const markSettled = async (docId) => {
    setSettlingId(docId);
    try {
      await updateDoc(doc(db, "grocery_orders", docId), {
        settled: true,
        settledAt: serverTimestamp(),
      });
    } catch (e) {
      Alert.alert("Error", "Failed to mark as settled.\n" + (e?.message || ""));
    } finally {
      setSettlingId(null);
    }
  };

  const modalGroup = selectedMember
    ? grouped.find((g) => (g.memberId || g.memberName) === selectedMember)
    : null;
  const unpaidOrders = modalGroup
    ? modalGroup.orders.filter((o) => o.settled !== true)
    : [];
  const paidOrders = modalGroup
    ? modalGroup.orders.filter((o) => o.settled === true)
    : [];
  const totalUnpaid = unpaidOrders.reduce(
    (s, o) => s + Number(o.total || 0),
    0,
  );
  const totalPaid = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);

  if (loading)
    return (
      <View
        style={[
          sub.root,
          { justifyContent: "center", alignItems: "center", gap: 12 },
        ]}
      >
        <Text style={{ fontSize: 32 }}>🪙</Text>
        <Text
          style={{
            fontFamily: "GoogleSans_400Regular",
            fontSize: 13,
            color: "rgba(1,31,75,0.50)",
          }}
        >
          Loading credit orders...
        </Text>
      </View>
    );

  return (
    <View style={sub.root}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.65)",
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 9,
          margin: 16,
          marginBottom: 10,
          borderWidth: 1.5,
          borderColor: "rgba(255,255,255,0.90)",
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 14, color: "rgba(1,31,75,0.45)" }}>🔍</Text>
        <TextInput
          style={{
            flex: 1,
            fontFamily: "GoogleSans_400Regular",
            fontSize: 13,
            color: "#0f1e35",
          }}
          value={search}
          onChangeText={setSearch}
          placeholder="Search member name or ID..."
          placeholderTextColor="rgba(1,31,75,0.35)"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={{ color: "rgba(1,31,75,0.45)", fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {filtered.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 60 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🪙</Text>
          <Text
            style={{
              fontFamily: "GoogleSans_700Bold",
              fontSize: 15,
              color: "rgba(1,31,75,0.45)",
              textAlign: "center",
            }}
          >
            {search ? "No members match your search." : "No credit orders yet."}
          </Text>
        </View>
      ) : (
        /* ── Compact table list ── */
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(255,255,255,0.55)",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.80)",
            overflow: "hidden",
          }}
        >
          {/* Table header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(26,58,107,0.10)",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(26,58,107,0.12)",
            }}
          >
            <Text
              style={{
                flex: 1,
                fontFamily: "GoogleSans_700Bold",
                fontSize: 10,
                color: "rgba(1,31,75,0.50)",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Member
            </Text>
            <Text
              style={{
                fontFamily: "GoogleSans_700Bold",
                fontSize: 10,
                color: "rgba(231,76,60,0.70)",
                letterSpacing: 1,
                textTransform: "uppercase",
                marginRight: 22,
              }}
            >
              Unpaid
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {filtered.map((group, idx) => {
              const unpaid = group.orders.filter((o) => o.settled !== true);
              const totalOwed = unpaid.reduce(
                (s, o) => s + Number(o.total || 0),
                0,
              );
              const isLast = idx === filtered.length - 1;
              return (
                <TouchableOpacity
                  key={group.memberId || group.memberName}
                  onPress={() => {
                    setSelectedMember(group.memberId || group.memberName);
                    setActiveModalTab("unpaid");
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: "rgba(26,58,107,0.07)",
                    backgroundColor:
                      idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.35)",
                  }}
                >
                  {/* Name + optional ID */}
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: "GoogleSans_500Medium",
                        fontSize: 12,
                        color: "#0f1e35",
                      }}
                    >
                      {group.memberName}
                    </Text>
                    {group.memberUserId ? (
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: "GoogleSans_400Regular",
                          fontSize: 10,
                          color: "rgba(1,31,75,0.40)",
                          marginTop: 1,
                        }}
                      >
                        {group.memberUserId}
                      </Text>
                    ) : null}
                  </View>

                  {/* Unpaid amount — show ✓ if fully settled */}
                  {unpaid.length > 0 ? (
                    <Text
                      style={{
                        fontFamily: "GoogleSans_700Bold",
                        fontSize: 11,
                        color: "#e74c3c",
                        marginRight: 6,
                      }}
                    >
                      ₱{totalOwed.toFixed(2)}{" "}
                      <Text
                        style={{
                          fontFamily: "GoogleSans_400Regular",
                          fontSize: 10,
                          color: "rgba(231,76,60,0.55)",
                        }}
                      >
                        ({unpaid.length})
                      </Text>
                    </Text>
                  ) : (
                    <Text
                      style={{
                        fontFamily: "GoogleSans_400Regular",
                        fontSize: 12,
                        color: "rgba(39,174,96,0.70)",
                        marginRight: 6,
                      }}
                    >
                      ✓
                    </Text>
                  )}

                  <MaterialIcons
                    name="chevron-right"
                    size={16}
                    color="rgba(1,31,75,0.25)"
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Member detail modal */}
      <Modal
        transparent
        visible={!!selectedMember}
        animationType="fade"
        onRequestClose={() => setSelectedMember(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(1,15,40,0.55)",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
          }}
        >
          <TouchableOpacity
            style={{ ...StyleSheet.absoluteFillObject }}
            activeOpacity={1}
            onPress={() => setSelectedMember(null)}
          />
          <View
            style={{
              width: "100%",
              maxWidth: 700,
              maxHeight: "88%",
              backgroundColor: "#f0f5f9",
              borderRadius: 20,
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowRadius: 24,
              elevation: 20,
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={["#1a2d4e", "#243554"]}
              style={{
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: "rgba(201,168,76,0.25)",
                  borderWidth: 2,
                  borderColor: "#c9a84c",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "GoogleSans_700Bold",
                    fontSize: 15,
                    color: "#c9a84c",
                  }}
                >
                  {(modalGroup?.memberName || "?")
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "GoogleSans_700Bold",
                    fontSize: 15,
                    color: "#fff",
                  }}
                >
                  {modalGroup?.memberName || "—"}
                </Text>
                <Text
                  style={{
                    fontFamily: "GoogleSans_400Regular",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.50)",
                    marginTop: 2,
                  }}
                >
                  {modalGroup?.memberUserId || "—"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedMember(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            </LinearGradient>

            <View
              style={{
                flexDirection: "row",
                gap: 10,
                padding: 14,
                paddingBottom: 0,
              }}
            >
              {[
                [
                  "unpaid",
                  "⏳ Unpaid",
                  totalUnpaid,
                  unpaidOrders.length,
                  "#1a2d4e",
                  "#c9a84c",
                  "rgba(201,168,76,0.15)",
                ],
                [
                  "paid",
                  "✅ Paid",
                  totalPaid,
                  paidOrders.length,
                  "#1a4a2e",
                  "#4cde8a",
                  "rgba(39,174,96,0.10)",
                ],
              ].map(
                ([key, label, amt, cnt, activeBg, activeColor, inactiveBg]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setActiveModalTab(key)}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor:
                        activeModalTab === key
                          ? activeBg
                          : "rgba(255,255,255,0.55)",
                      borderWidth: 1.5,
                      borderColor:
                        activeModalTab === key
                          ? key === "unpaid"
                            ? "#c9a84c"
                            : "#27ae60"
                          : "rgba(255,255,255,0.70)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "GoogleSans_700Bold",
                        fontSize: 10,
                        color:
                          activeModalTab === key
                            ? "rgba(255,255,255,0.55)"
                            : "rgba(1,31,75,0.45)",
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "NotoSerif_700Bold",
                        fontSize: 22,
                        color:
                          activeModalTab === key
                            ? activeColor
                            : key === "unpaid"
                              ? "#e67e22"
                              : "#27ae60",
                      }}
                    >
                      ₱ {amt.toFixed(2)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "GoogleSans_400Regular",
                        fontSize: 11,
                        color:
                          activeModalTab === key
                            ? "rgba(255,255,255,0.45)"
                            : "rgba(1,31,75,0.45)",
                        marginTop: 3,
                      }}
                    >
                      {cnt} order{cnt !== 1 ? "s" : ""}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>

            <ScrollView
              style={{ flex: 1, margin: 14, marginTop: 12 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: "#1a2d4e",
                  borderRadius: 8,
                  paddingVertical: 9,
                  paddingHorizontal: 8,
                  marginBottom: 4,
                }}
              >
                {[
                  { l: "ORDER NO.", f: 0.8 },
                  { l: "DATE/TIME", f: 1.3 },
                  { l: "ITEMS", f: 2.0 },
                  { l: "QTY", f: 0.5 },
                  { l: "PRICE", f: 0.7 },
                  { l: "AMOUNT", f: 0.8 },
                  { l: "", f: 0.8 },
                ].map((col) => (
                  <Text
                    key={col.l}
                    style={{
                      fontFamily: "GoogleSans_700Bold",
                      fontSize: 9,
                      color: "#c9a84c",
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      flex: col.f,
                      textAlign:
                        col.l === "AMOUNT" ||
                        col.l === "QTY" ||
                        col.l === "PRICE"
                          ? "right"
                          : "left",
                    }}
                  >
                    {col.l}
                  </Text>
                ))}
              </View>

              {(activeModalTab === "unpaid" ? unpaidOrders : paidOrders)
                .length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>
                    {activeModalTab === "unpaid" ? "🎉" : "📋"}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "GoogleSans_700Bold",
                      fontSize: 13,
                      color: "rgba(1,31,75,0.45)",
                      textAlign: "center",
                    }}
                  >
                    {activeModalTab === "unpaid"
                      ? "No unpaid orders!"
                      : "No paid orders yet."}
                  </Text>
                </View>
              ) : (
                (activeModalTab === "unpaid" ? unpaidOrders : paidOrders).map(
                  (order, idx) => {
                    const orderItems = order.items || [];
                    const isPaid = activeModalTab === "paid";
                    const rowBg =
                      idx % 2 === 0
                        ? "rgba(255,255,255,0.55)"
                        : "rgba(255,255,255,0.30)";
                    const orderTotal = Number(order.total || 0);
                    return [
                      ...orderItems.map((it, j) => {
                        const item = it.item || it;
                        const qty = it.qty || it.quantity || 1;
                        const lineAmt = Number(item.price || 0) * qty;
                        const isFirst = j === 0;
                        return (
                          <View
                            key={`${order.docId}-${j}`}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingVertical: 8,
                              paddingHorizontal: 8,
                              backgroundColor: rowBg,
                              borderTopLeftRadius: isFirst ? 8 : 0,
                              borderTopRightRadius: isFirst ? 8 : 0,
                              borderBottomWidth: 1,
                              borderColor: "rgba(1,31,75,0.06)",
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: "GoogleSans_700Bold",
                                fontSize: 11,
                                color: isFirst ? "#0f1e35" : "transparent",
                                flex: 0.8,
                              }}
                            >
                              {isFirst ? `#${order.orderNo || "—"}` : ""}
                            </Text>
                            <Text
                              style={{
                                fontFamily: "GoogleSans_400Regular",
                                fontSize: 9.5,
                                color: isFirst
                                  ? "rgba(1,31,75,0.55)"
                                  : "transparent",
                                flex: 1.3,
                                lineHeight: 14,
                              }}
                            >
                              {isFirst ? fmtDateTime(order.createdAt) : ""}
                            </Text>
                            <Text
                              style={{
                                fontFamily: "GoogleSans_400Regular",
                                fontSize: 11,
                                color: "#0f1e35",
                                flex: 2.0,
                              }}
                              numberOfLines={1}
                            >
                              {item.emoji || "🛒"} {item.name || "—"}
                            </Text>
                            <Text
                              style={{
                                fontFamily: "GoogleSans_700Bold",
                                fontSize: 11,
                                color: "#0f1e35",
                                flex: 0.5,
                                textAlign: "right",
                              }}
                            >
                              {qty}
                            </Text>
                            <Text
                              style={{
                                fontFamily: "GoogleSans_400Regular",
                                fontSize: 11,
                                color: "rgba(1,31,75,0.55)",
                                flex: 0.7,
                                textAlign: "right",
                              }}
                            >
                              ₱{Number(item.price || 0).toFixed(2)}
                            </Text>
                            <Text
                              style={{
                                fontFamily: "GoogleSans_400Regular",
                                fontSize: 11,
                                color: "rgba(1,31,75,0.65)",
                                flex: 0.8,
                                textAlign: "right",
                              }}
                            >
                              ₱{lineAmt.toFixed(2)}
                            </Text>
                            <View style={{ flex: 0.8 }} />
                          </View>
                        );
                      }),
                      <View
                        key={`${order.docId}-subtotal`}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 8,
                          paddingHorizontal: 8,
                          backgroundColor: rowBg,
                          borderBottomLeftRadius: 8,
                          borderBottomRightRadius: 8,
                          marginBottom: 6,
                          borderTopWidth: 1,
                          borderColor: "rgba(1,31,75,0.12)",
                        }}
                      >
                        <Text style={{ flex: 0.8 }} />
                        <Text style={{ flex: 1.3 }} />
                        <Text
                          style={{
                            fontFamily: "GoogleSans_700Bold",
                            fontSize: 10,
                            color: "rgba(1,31,75,0.45)",
                            flex: 2.0,
                            letterSpacing: 1,
                          }}
                        >
                          ORDER TOTAL
                        </Text>
                        <Text style={{ flex: 0.5 }} />
                        <Text style={{ flex: 0.7 }} />
                        <Text
                          style={{
                            fontFamily: "NotoSerif_700Bold",
                            fontSize: 13,
                            color: isPaid ? "#27ae60" : "#c9a84c",
                            flex: 0.8,
                            textAlign: "right",
                          }}
                        >
                          ₱{orderTotal.toFixed(2)}
                        </Text>
                        <View style={{ flex: 0.8, alignItems: "flex-end" }}>
                          {!isPaid ? (
                            <TouchableOpacity
                              onPress={async () => {
                                await markSettled(order.docId);
                                setActiveModalTab("paid");
                              }}
                              disabled={settlingId === order.docId}
                              activeOpacity={0.8}
                              style={{
                                backgroundColor: "#27ae60",
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                opacity: settlingId === order.docId ? 0.6 : 1,
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: "GoogleSans_700Bold",
                                  fontSize: 10,
                                  color: "#fff",
                                }}
                              >
                                {settlingId === order.docId ? "..." : "Paid"}
                              </Text>
                            </TouchableOpacity>
                          ) : order.settledAt ? (
                            <Text
                              style={{
                                fontFamily: "GoogleSans_400Regular",
                                fontSize: 9,
                                color: "#27ae60",
                                textAlign: "right",
                              }}
                            >
                              ✓ {fmtDateTime(order.settledAt)}
                            </Text>
                          ) : null}
                        </View>
                      </View>,
                    ];
                  },
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── SALES REPORT SCREEN ─────────────────────────────────────────────────────
const SalesReportScreen = ({ orders, items }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [yearDropdown, setYearDropdown] = useState(false);
  const yearBtnRef = useRef(null);
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [activeFolder, setActiveFolder] = useState("sales");
  const [salesView, setSalesView] = useState("daily");
  const [txView, setTxView] = useState("daily");
  const [invView, setInvView] = useState("daily");

  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const MONTHS_FULL = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const years = Array.from({ length: 30 }, (_, i) => 2025 + i);

  const getDate = (order) => {
    if (order.createdAt?.toDate) return order.createdAt.toDate();
    if (order.createdAt) return new Date(order.createdAt);
    if (order.time) {
      const d = new Date(order.time);
      return isNaN(d) ? null : d;
    }
    return null;
  };

  const yearOrders = orders.filter((o) => {
    const d = getDate(o);
    return d && d.getFullYear() === year;
  });
  const monthOrders = yearOrders.filter((o) => {
    const d = getDate(o);
    return d && d.getMonth() === activeMonth;
  });

  const dailyData = React.useMemo(() => {
    const map = {};
    monthOrders.forEach((o) => {
      const d = getDate(o);
      if (!d) return;
      const k = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
      if (!map[k]) map[k] = { key: k, total: 0, count: 0 };
      map[k].total += Number(o.total || 0);
      map[k].count += 1;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [monthOrders]);

  const monthlyData = React.useMemo(() => {
    return MONTHS.map((m, i) => {
      const mo = yearOrders.filter((o) => {
        const d = getDate(o);
        return d && d.getMonth() === i;
      });
      return {
        month: m,
        monthFull: MONTHS_FULL[i],
        total: mo.reduce((s, o) => s + Number(o.total || 0), 0),
        count: mo.length,
      };
    });
  }, [yearOrders]);

  const yearlyData = React.useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const d = getDate(o);
      if (!d) return;
      const y = d.getFullYear();
      if (!map[y]) map[y] = { year: y, total: 0, count: 0 };
      map[y].total += Number(o.total || 0);
      map[y].count += 1;
    });
    return Object.values(map).sort((a, b) => b.year - a.year);
  }, [orders]);

  const monthTotal = monthOrders.reduce((s, o) => s + Number(o.total || 0), 0);

  const FOLDERS = [
    { key: "sales", label: "Sales Collection", icon: "💰" },
    { key: "tx", label: "Transaction History", icon: "📋" },
    { key: "inv", label: "Inventory Reports", icon: "📦" },
  ];

  const Controls = ({ view, setView }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
        flexWrap: "wrap",
      }}
    >
      <View>
        <TouchableOpacity
          ref={yearBtnRef}
          style={rpt.yearBtn}
          onPress={() => setYearDropdown(true)}
          activeOpacity={0.8}
        >
          <Text style={rpt.yearTxt}>YEAR {year}</Text>
          <Text style={rpt.yearCaret}>▼</Text>
        </TouchableOpacity>
        {yearDropdown && (
          <View style={rpt.yearMenu}>
            <ScrollView
              style={{ maxHeight: 180 }}
              showsVerticalScrollIndicator={false}
            >
              {years.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[rpt.yearOpt, y === year && rpt.yearOptActive]}
                  onPress={() => {
                    setYear(y);
                    setYearDropdown(false);
                  }}
                >
                  <Text
                    style={[rpt.yearOptTxt, y === year && rpt.yearOptTxtActive]}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
      {[
        ["daily", "Daily"],
        ["monthly", "Monthly"],
        ["yearly", "Yearly"],
      ].map(([k, l]) => (
        <TouchableOpacity
          key={k}
          style={[rpt.viewToggleBtn, view === k && rpt.viewToggleBtnActive]}
          onPress={() => setView(k)}
        >
          <Text
            style={[rpt.viewToggleTxt, view === k && rpt.viewToggleTxtActive]}
          >
            {l}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const MonthTabs = () => (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 5,
        marginBottom: 10,
      }}
    >
      {MONTHS.map((m, i) => (
        <TouchableOpacity
          key={m}
          style={[rpt.monthBtn, activeMonth === i && rpt.monthBtnActive]}
          onPress={() => setActiveMonth(i)}
        >
          <Text style={[rpt.monthTxt, activeMonth === i && rpt.monthTxtActive]}>
            {m}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const TableHeader = ({ cols }) => (
    <View style={rpt.thead}>
      {cols.map((c, i) => (
        <Text key={i} style={[rpt.th, c.style]}>
          {c.label}
        </Text>
      ))}
    </View>
  );

  return (
    <View style={sub.root}>
      <View style={rpt.folderTabBar}>
        {FOLDERS.map((f, i) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setActiveFolder(f.key)}
            style={[
              rpt.folderTab,
              activeFolder === f.key && rpt.folderTabActive,
              i === 0 && { marginLeft: 0 },
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                rpt.folderTabTxt,
                activeFolder === f.key && rpt.folderTabTxtActive,
              ]}
            >
              {f.icon} {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={rpt.folderCard}>
        {activeFolder === "sales" && (
          <View style={{ flex: 1, minHeight: 0 }}>
            <Controls view={salesView} setView={setSalesView} />
            {salesView === "daily" && <MonthTabs />}
            {salesView === "daily" && (
              // ── FIX: removed stray apostrophe after gap:8 ──
              <View
                style={{
                  backgroundColor: "rgba(26,58,107,0.10)",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 10,
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: "NotoSerif_700Bold",
                    fontSize: 16,
                    color: "#1a3a6b",
                  }}
                >
                  ₱
                  {monthTotal.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
                <Text
                  style={{
                    fontFamily: "GoogleSans_400Regular",
                    fontSize: 11,
                    color: "rgba(1,31,75,0.50)",
                    marginTop: 2,
                  }}
                >
                  {MONTHS_FULL[activeMonth]} {year} Total · {monthOrders.length}{" "}
                  orders
                </Text>
              </View>
            )}
            <TableHeader
              cols={[
                {
                  label: "DATE/PERIOD",
                  style: { flex: 1.2, textAlign: "left", paddingLeft: 10 },
                },
                { label: "ORDERS", style: { flex: 0.7 } },
                { label: "TOTAL", style: { flex: 1.1 } },
              ]}
            />
            <WebScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {(salesView === "daily"
                ? dailyData
                : salesView === "monthly"
                  ? monthlyData
                  : yearlyData
              ).map((g, idx) => (
                <View
                  key={idx}
                  style={[rpt.trow, idx % 2 === 0 && rpt.trowAlt]}
                >
                  <Text
                    style={[
                      rpt.td,
                      {
                        flex: 1.2,
                        fontFamily: "GoogleSans_700Bold",
                        color: "#1a3a6b",
                        textAlign: "left",
                        paddingLeft: 10,
                      },
                    ]}
                  >
                    {salesView === "daily"
                      ? g.key
                      : salesView === "monthly"
                        ? g.monthFull
                        : g.year}
                  </Text>
                  <Text style={[rpt.td, { flex: 0.7 }]}>{g.count}</Text>
                  <Text
                    style={[
                      rpt.td,
                      {
                        flex: 1.1,
                        fontFamily: "GoogleSans_700Bold",
                        color: "#c9a84c",
                      },
                    ]}
                  >
                    ₱
                    {g.total.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              ))}
              {(salesView === "daily"
                ? dailyData
                : salesView === "monthly"
                  ? monthlyData
                  : yearlyData
              ).length === 0 && (
                <View style={rpt.emptyRow}>
                  <Text style={rpt.emptyTxt}>
                    No sales data for this period.
                  </Text>
                </View>
              )}
            </WebScrollView>
          </View>
        )}

        {activeFolder === "tx" && (
          <View style={{ flex: 1, minHeight: 0 }}>
            <Controls view={txView} setView={setTxView} />
            {txView === "daily" && <MonthTabs />}
            <TableHeader
              cols={[
                {
                  label: "DATE/PERIOD",
                  style: { flex: 1.0, textAlign: "left", paddingLeft: 10 },
                },
                { label: "TOTAL ORDERS", style: { flex: 1.0 } },
                { label: "TOTAL EARNINGS", style: { flex: 1.2 } },
              ]}
            />
            <WebScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {(txView === "daily"
                ? dailyData
                : txView === "monthly"
                  ? monthlyData
                  : yearlyData
              ).map((g, idx) => (
                <View
                  key={idx}
                  style={[rpt.trow, idx % 2 === 0 && rpt.trowAlt]}
                >
                  <Text
                    style={[
                      rpt.td,
                      {
                        flex: 1.0,
                        fontFamily: "GoogleSans_700Bold",
                        color: "#1a3a6b",
                        textAlign: "left",
                        paddingLeft: 10,
                      },
                    ]}
                  >
                    {txView === "daily"
                      ? g.key
                      : txView === "monthly"
                        ? g.monthFull + " " + year
                        : g.year}
                  </Text>
                  <Text style={[rpt.td, { flex: 1.0 }]}>{g.count}</Text>
                  <Text
                    style={[
                      rpt.td,
                      {
                        flex: 1.2,
                        fontFamily: "GoogleSans_700Bold",
                        color: "#1a7a45",
                      },
                    ]}
                  >
                    ₱{g.total.toFixed(2)}
                  </Text>
                </View>
              ))}
              {(txView === "daily"
                ? dailyData
                : txView === "monthly"
                  ? monthlyData
                  : yearlyData
              ).length === 0 && (
                <View style={rpt.emptyRow}>
                  <Text style={rpt.emptyTxt}>
                    No transaction data for this period.
                  </Text>
                </View>
              )}
            </WebScrollView>
          </View>
        )}

        {activeFolder === "inv" && (
          <View style={{ flex: 1, minHeight: 0 }}>
            <Controls view={invView} setView={setInvView} />
            {invView === "daily" && <MonthTabs />}
            <View
              style={{
                backgroundColor: "rgba(26,58,107,0.10)",
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                flexDirection: "row",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <View style={{ gap: 2 }}>
                <Text
                  style={{
                    fontFamily: "GoogleSans_700Bold",
                    fontSize: 9,
                    color: "rgba(1,31,75,0.45)",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Total Items
                </Text>
                <Text
                  style={{
                    fontFamily: "NotoSerif_700Bold",
                    fontSize: 18,
                    color: "#1a3a6b",
                  }}
                >
                  {items.length}
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text
                  style={{
                    fontFamily: "GoogleSans_700Bold",
                    fontSize: 9,
                    color: "rgba(1,31,75,0.45)",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Total Stock
                </Text>
                <Text
                  style={{
                    fontFamily: "NotoSerif_700Bold",
                    fontSize: 18,
                    color: "#1a3a6b",
                  }}
                >
                  {items.reduce((s, i) => s + (i.stock || 0), 0)}
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text
                  style={{
                    fontFamily: "GoogleSans_700Bold",
                    fontSize: 9,
                    color: "rgba(1,31,75,0.45)",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Total Value
                </Text>
                <Text
                  style={{
                    fontFamily: "NotoSerif_700Bold",
                    fontSize: 18,
                    color: "#c9a84c",
                  }}
                >
                  ₱
                  {items
                    .reduce((s, i) => s + (i.price || 0) * (i.stock || 0), 0)
                    .toLocaleString()}
                </Text>
              </View>
            </View>
            <TableHeader
              cols={[
                {
                  label: "ITEM",
                  style: { flex: 2, textAlign: "left", paddingLeft: 10 },
                },
                { label: "CATEGORY", style: { flex: 1 } },
                { label: "STOCK", style: { flex: 0.7 } },
                { label: "PRICE", style: { flex: 0.9 } },
                { label: "VALUE", style: { flex: 1 } },
              ]}
            />
            <WebScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {items.map((item, idx) => (
                <View
                  key={item.id}
                  style={[rpt.trow, idx % 2 === 0 && rpt.trowAlt]}
                >
                  <Text
                    style={[
                      rpt.td,
                      {
                        flex: 2,
                        textAlign: "left",
                        paddingLeft: 10,
                        fontFamily: "GoogleSans_700Bold",
                        color: "#1a2d4e",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.emoji} {item.name}
                  </Text>
                  <Text style={[rpt.td, { flex: 1 }]}>{item.cat}</Text>
                  <Text
                    style={[
                      rpt.td,
                      {
                        flex: 0.7,
                        color:
                          item.stock === 0
                            ? "#e74c3c"
                            : item.stock <= 5
                              ? "#b85c00"
                              : "#1a2d4e",
                        fontFamily: "GoogleSans_700Bold",
                      },
                    ]}
                  >
                    {item.stock}
                  </Text>
                  <Text style={[rpt.td, { flex: 0.9 }]}>₱{item.price}</Text>
                  <Text
                    style={[
                      rpt.td,
                      {
                        flex: 1,
                        fontFamily: "GoogleSans_700Bold",
                        color: "#1a3a6b",
                      },
                    ]}
                  >
                    ₱{(item.price * item.stock).toLocaleString()}
                  </Text>
                </View>
              ))}
              {items.length === 0 && (
                <View style={rpt.emptyRow}>
                  <Text style={rpt.emptyTxt}>No items in inventory.</Text>
                </View>
              )}
            </WebScrollView>
          </View>
        )}
      </View>
    </View>
  );
};

const rpt = StyleSheet.create({
  folderTabBar: {
    flexDirection: "row",
    flexShrink: 0,
    marginTop: 0,
    paddingHorizontal: 0,
    alignItems: "flex-end",
    gap: 2,
  },
  folderTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: "rgba(26,58,107,0.45)",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.20)",
    marginRight: 2,
  },
  folderTabActive: {
    backgroundColor: "rgba(240,245,249,0.97)",
    borderColor: "rgba(255,255,255,0.55)",
    paddingBottom: 10,
  },
  folderTabTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.80)",
  },
  folderTabTxtActive: { color: "#1a3a6b" },
  folderCard: {
    flex: 1,
    minHeight: 0,
    backgroundColor: "rgba(240,245,249,0.97)",
    borderRadius: 14,
    borderTopLeftRadius: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    padding: 12,
  },
  yearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: "rgba(26,58,107,0.12)",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "rgba(26,58,107,0.20)",
  },
  yearTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "#1a3a6b",
    letterSpacing: 0.5,
  },
  yearCaret: { fontSize: 11, color: "rgba(26,58,107,0.50)" },
  yearMenu: {
    position: "absolute",
    top: 36,
    left: 0,
    zIndex: 9999,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(26,58,107,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 20,
    minWidth: 120,
    maxHeight: 180,
  },
  yearOpt: { paddingVertical: 8, paddingHorizontal: 16, alignItems: "center" },
  yearOptActive: { backgroundColor: "rgba(26,58,107,0.08)" },
  yearOptTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "#1a3a6b",
  },
  yearOptTxtActive: { fontFamily: "GoogleSans_700Bold", color: "#1a3a6b" },
  viewToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(26,58,107,0.12)",
    borderWidth: 1,
    borderColor: "rgba(26,58,107,0.18)",
  },
  viewToggleBtnActive: { backgroundColor: "#1a3a6b", borderColor: "#1a3a6b" },
  viewToggleTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "rgba(26,58,107,0.70)",
  },
  viewToggleTxtActive: { color: "#fff" },
  monthBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(26,58,107,0.85)",
    borderWidth: 1,
    borderColor: "rgba(26,58,107,0.50)",
  },
  monthBtnActive: {
    backgroundColor: "rgba(198,220,240,0.90)",
    borderColor: "#304674",
    borderWidth: 1.5,
  },
  monthTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "rgba(255,255,255,0.90)",
  },
  monthTxtActive: { fontFamily: "GoogleSans_700Bold", color: "#1a3a6b" },
  thead: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "rgba(26,58,107,0.14)",
    borderRadius: 6,
    marginBottom: 0,
  },
  th: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "rgba(26,58,107,0.60)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderColor: "rgba(26,58,107,0.10)",
  },
  trow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "rgba(26,58,107,0.07)",
    minHeight: 38,
  },
  trowAlt: { backgroundColor: "rgba(255,255,255,0.45)" },
  td: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "#1a2d4e",
    textAlign: "center",
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderColor: "rgba(26,58,107,0.08)",
    alignSelf: "stretch",
    justifyContent: "center",
  },
  emptyRow: { paddingVertical: 20, alignItems: "center" },
  emptyTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(1,31,75,0.40)",
  },
});

// ─── SHARED SUB STYLES ────────────────────────────────────────────────────────
const sub = StyleSheet.create({
  root: { flex: 1, padding: 14, overflow: "hidden", minHeight: 0 },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 60,
  },
  emptyTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(1,31,75,0.35)",
    textAlign: "center",
    lineHeight: 18,
  },
});

const hst = StyleSheet.create({
  calTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(26,58,107,0.10)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(26,58,107,0.15)",
    alignSelf: "flex-start",
  },
  calTriggerTxt: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 12,
    color: "#1a3a6b",
  },
  calTriggerCaret: { fontSize: 10, color: "rgba(26,58,107,0.50)" },
  calCard: {
    position: "absolute",
    top: 38,
    left: 0,
    zIndex: 999,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(26,58,107,0.18)",
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 20,
    minWidth: 220,
    maxWidth: 260,
  },
  calDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1a3a6b",
    position: "absolute",
    bottom: 2,
    alignSelf: "center",
  },
  txHeaderSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.50)",
    marginTop: 2,
  },
  txRow: { flexDirection: "row", gap: 0, minHeight: 56 },
  txTimeCol: {
    width: 52,
    flexShrink: 0,
    alignItems: "flex-end",
    paddingRight: 8,
    paddingTop: 3,
    gap: 4,
  },
  txTime: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "rgba(1,31,75,0.55)",
    textAlign: "right",
  },
  livePip: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#e74c3c" },
  txLine: { width: 16, flexShrink: 0, alignItems: "center" },
  txDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1a3a6b",
    marginTop: 4,
    flexShrink: 0,
    zIndex: 1,
  },
  txVLine: {
    flex: 1,
    width: 2,
    backgroundColor: "rgba(1,31,75,0.12)",
    marginTop: 2,
  },
  txContent: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: 10,
    padding: 10,
    marginLeft: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    gap: 4,
  },
  txOrderId: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "#1a3a6b",
  },
  txStatusBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  txStatusTxt: { fontFamily: "GoogleSans_700Bold", fontSize: 9 },
  txItems: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.60)",
    lineHeight: 15,
  },
  txAmount: { fontFamily: "NotoSerif_700Bold", fontSize: 13, color: "#c9a84c" },
  txPay: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 10,
    color: "rgba(1,31,75,0.45)",
  },
});

// ─── SALES OVERVIEW PANEL ─────────────────────────────────────────────────────
const OrderingMonitoring = ({ orders, items }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const today = new Date().toDateString();

  const todayOrders = orders.filter((o) => {
    try {
      const ts =
        o.createdAt?.toDate?.() || new Date(o.createdAt || o.time || 0);
      return ts.toDateString() === today;
    } catch {
      return false;
    }
  });

  const todaySales = todayOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const itemsSold = todayOrders.reduce(
    (s, o) => s + (o.items || []).reduce((a, i) => a + (i.qty || 1), 0),
    0,
  );
  const lowStockCount = (items || []).filter(
    (i) => i.stock > 0 && i.stock <= 5,
  ).length;
  const outOfStockCount = (items || []).filter((i) => i.stock === 0).length;

  const recentOrders = [...todayOrders].sort((a, b) => {
    const ta =
      a.createdAt?.toDate?.()?.getTime() ||
      new Date(a.createdAt || a.time || 0).getTime();
    const tb =
      b.createdAt?.toDate?.()?.getTime() ||
      new Date(b.createdAt || b.time || 0).getTime();
    return tb - ta;
  });

  const fmtTime = (o) => {
    try {
      const ts =
        o.createdAt?.toDate?.() || new Date(o.createdAt || o.time || 0);
      let h = ts.getHours();
      const m = String(ts.getMinutes()).padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    } catch {
      return "";
    }
  };

  return (
    <View style={lp.root}>
      <View style={lp.titleRow}>
        <Animated.View style={[lp.liveDot, { opacity: pulseAnim }]} />
        <Text style={lp.title}>SALES OVERVIEW</Text>
      </View>

      {/* Stat cards row 1 */}
      <View style={lp.statRow}>
        <LinearGradient
          colors={["#27ae60", "#2ecc71"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={lp.statCard}
        >
          <Text style={lp.statVal}>₱{todaySales.toFixed(0)}</Text>
          <Text style={lp.statLabel}>Today's Sales</Text>
        </LinearGradient>
        <LinearGradient
          colors={["#1a3a6b", "#2e5fa3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={lp.statCard}
        >
          <Text style={lp.statVal}>{itemsSold}</Text>
          <Text style={lp.statLabel}>Items Sold</Text>
        </LinearGradient>
      </View>

      {/* Stat cards row 2 */}
      <View style={lp.statRow}>
        <LinearGradient
          colors={["#e67e22", "#f39c12"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={lp.statCard}
        >
          <Text style={lp.statVal}>{lowStockCount}</Text>
          <Text style={lp.statLabel}>Low Stock</Text>
        </LinearGradient>
        <LinearGradient
          colors={["#c0392b", "#e74c3c"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={lp.statCard}
        >
          <Text style={lp.statVal}>{outOfStockCount}</Text>
          <Text style={lp.statLabel}>Out of Stock</Text>
        </LinearGradient>
      </View>

      <Text style={lp.recentLabel}>TODAY'S ORDERS</Text>

      {/* ── Compact table ── */}
      <View style={lp.tableWrap}>
        {/* Table header */}
        <View style={lp.tableHeader}>
          <Text style={[lp.tableHeadTxt, { flex: 1 }]}>Order</Text>
          <Text style={[lp.tableHeadTxt, { width: 48, textAlign: "center" }]}>
            Pay
          </Text>
          <Text style={[lp.tableHeadTxt, { width: 38, textAlign: "right" }]}>
            Time
          </Text>
          <Text style={[lp.tableHeadTxt, { width: 50, textAlign: "right" }]}>
            Total
          </Text>
        </View>

        <WebScrollView style={{ flex: 1, minHeight: 0 }}>
          {recentOrders.length === 0 ? (
            <View style={lp.emptyBox}>
              <Text style={lp.emptyIco}>🛒</Text>
              <Text style={lp.emptyTxt}>No orders today</Text>
            </View>
          ) : (
            recentOrders.map((order, idx) => {
              const itemsList = (order.items || [])
                .map((i) => `${i.item?.name || i.name || "?"} x${i.qty || 1}`)
                .join(", ");
              const payLabel =
                order.payment === "gcash"
                  ? "GCash"
                  : order.payment === "credit"
                    ? "Credit"
                    : "Cash";
              const isLast = idx === recentOrders.length - 1;
              return (
                <View
                  key={order.id || order.docId}
                  style={[
                    lp.tableRow,
                    {
                      borderBottomWidth: isLast ? 0 : 1,
                      backgroundColor:
                        idx % 2 === 0
                          ? "transparent"
                          : "rgba(255,255,255,0.35)",
                    },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text style={lp.orderId} numberOfLines={1}>
                      #{order.orderNo || order.id?.slice(-4) || "--"}
                    </Text>
                    <Text style={lp.orderItems} numberOfLines={1}>
                      {itemsList}
                    </Text>
                  </View>
                  <Text
                    style={{
                      width: 48,
                      textAlign: "center",
                      fontFamily: "GoogleSans_700Bold",
                      fontSize: 8,
                      color: "rgba(1,31,75,0.60)",
                    }}
                    numberOfLines={1}
                  >
                    {payLabel}
                  </Text>
                  <Text
                    style={[lp.orderTime, { width: 38, textAlign: "right" }]}
                    numberOfLines={1}
                  >
                    {fmtTime(order)}
                  </Text>
                  <Text
                    style={[lp.orderTotal, { width: 50, textAlign: "right" }]}
                  >
                    ₱{Number(order.total).toFixed(0)}
                  </Text>
                </View>
              );
            })
          )}
        </WebScrollView>
      </View>
    </View>
  );
};

const lp = StyleSheet.create({
  root: { flex: 1, padding: 10, minHeight: 0, overflow: "hidden" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
    justifyContent: "center",
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#27ae60" },
  title: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "#1a2d4e",
    letterSpacing: 1.5,
    textDecorationLine: "underline",
    textAlign: "center",
  },
  statRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  statCard: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  statVal: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 18,
    color: "#fff",
    lineHeight: 22,
  },
  statLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 8,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  recentLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "rgba(1,31,75,0.50)",
    letterSpacing: 1.2,
    marginBottom: 5,
    marginTop: 4,
  },
  emptyBox: { padding: 20, alignItems: "center", gap: 6 },
  emptyIco: { fontSize: 28 },
  emptyTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.35)",
    textAlign: "center",
  },
  // ── Compact table styles ──
  tableWrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.80)",
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,58,107,0.10)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(26,58,107,0.12)",
  },
  tableHeadTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 8,
    color: "rgba(1,31,75,0.50)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomColor: "rgba(26,58,107,0.07)",
  },
  orderId: { fontFamily: "GoogleSans_700Bold", fontSize: 10, color: "#0d2540" },
  orderTime: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 9,
    color: "rgba(1,31,75,0.45)",
  },
  orderTotal: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#c9a84c",
  },
  orderItems: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 9,
    color: "rgba(1,31,75,0.55)",
    lineHeight: 12,
  },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function ManageGroceryScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isSmall = width < 400;
  const isTablet = width >= 600 && width < 900;
  const isWide = width >= 900;

  const { items, categories, orders, reloadFromStorage } = useGrocery();

  const [ads, setAds] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "grocery_ads"),
      (snap) => {
        setAds(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {},
    );
    return unsub;
  }, []);

  const saveItem = async (item) => {
    try {
      const { setDoc, doc: fsDoc } = await import("firebase/firestore");
      await setDoc(fsDoc(db, "grocery_items", item.id), item, { merge: true });
    } catch (e) {
      Alert.alert("Error", "Could not save item: " + e.message);
    }
  };

  const deleteItem = async (id) => {
    try {
      await deleteDoc(doc(db, "grocery_items", id));
    } catch (e) {
      Alert.alert("Error", "Could not delete item.");
    }
  };

  const addOrder = async (order) => {
    try {
      const ref = await addDoc(collection(db, "grocery_orders"), {
        ...order,
        createdAt: serverTimestamp(),
        status: "done",
      });
      return ref.id;
    } catch (e) {
      console.warn("addOrder (grocery) error:", e.message);
      return null;
    }
  };

  const deductStock = async (orderItems) => {
    try {
      for (const { item, qty } of orderItems) {
        if (!item?.id) continue;
        const newStock = Math.max(0, (item.stock ?? 0) - qty);
        await updateDoc(doc(db, "grocery_items", item.id), { stock: newStock });
      }
    } catch (e) {
      console.warn("deductStock (grocery) error:", e.message);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, "grocery_orders", orderId), {
        status: newStatus,
      });
    } catch (e) {
      console.warn("updateOrderStatus (grocery) error:", e.message);
    }
  };

  const saveAd = async (ad) => {
    try {
      const { setDoc, doc: fsDoc } = await import("firebase/firestore");
      await setDoc(fsDoc(db, "grocery_ads", ad.id), ad, { merge: true });
    } catch (e) {
      Alert.alert("Error", "Could not save ad: " + e.message);
    }
  };

  const deleteAd = async (id) => {
    try {
      await deleteDoc(doc(db, "grocery_ads", id));
    } catch (e) {
      setAds((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold,
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_700Bold,
  });

  const [activeTab, setActiveTab] = useState("cashier");
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState(null);
  const [editItemModal, setEditItemModal] = useState(false);
  const [invMaxQty, setInvMaxQty] = useState({});
  const [adCurrent, setAdCurrent] = useState(0);
  const [salesCollapsed, setSalesCollapsed] = useState(true);

  const [notifBanner, setNotifBanner] = useState(null);
  const notifAnim = useRef(new Animated.Value(-80)).current;
  const prevOrderIdsRef = useRef(null);

  useEffect(() => {
    if (!orders || orders.length === 0) return;
    const currentIds = new Set(orders.map((o) => o.id || o.docId));
    if (prevOrderIdsRef.current === null) {
      prevOrderIdsRef.current = currentIds;
      return;
    }
    const newOrders = orders.filter(
      (o) =>
        !prevOrderIdsRef.current.has(o.id || o.docId) &&
        (o.status === "pending" || !o.status) &&
        o.source !== "cashier",
    );
    if (newOrders.length > 0) {
      const latest = newOrders[0];
      playOrderSound();
      setNotifBanner({
        orderNo: latest.orderNo || latest.id,
        source: latest.memberName || latest.source || "customer",
        total: latest.total || 0,
      });
      Animated.sequence([
        Animated.spring(notifAnim, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.delay(4000),
        Animated.timing(notifAnim, {
          toValue: -80,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setNotifBanner(null));
    }
    prevOrderIdsRef.current = currentIds;
  }, [orders]);

  const hdrFade = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-16)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;
  const adScrollRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      reloadFromStorage();
    }, [reloadFromStorage]),
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(hdrTrans, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
    Animated.timing(bodyFade, {
      toValue: 1,
      duration: 500,
      delay: 150,
      useNativeDriver: true,
    }).start();
  }, []);

  const bannerW = isWide ? Math.min(width * 0.6, 700) : width - 16;

  useEffect(() => {
    if (!ads.length) return;
    const t = setInterval(() => {
      setAdCurrent((prev) => {
        const next = (prev + 1) % ads.length;
        adScrollRef.current?.scrollTo({ x: next * bannerW, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [ads.length, bannerW]);

  const handleSearch = (text) => {
    setSearch(text);
    if (!text.trim()) return;
    const cats = [
      ...new Set(
        items
          .filter((i) => i.name.toLowerCase().includes(text.toLowerCase()))
          .map((i) => i.cat),
      ),
    ];
    setActiveCategory(cats.length === 1 ? cats[0] : "All");
  };

  const filtered = items.filter((i) => {
    if (search.trim())
      return i.name.toLowerCase().includes(search.toLowerCase());
    return activeCategory === "All" || i.cat === activeCategory;
  });

  const openAddItem = () => {
    setEditItem(emptyItem());
    setEditItemModal(true);
  };
  const openEditItem = (item) => {
    setEditItem({
      ...item,
      price: String(item.price),
      stock: String(item.stock),
    });
    setEditItemModal(true);
  };

  const handleSaveItem = (updated) => {
    saveItem(updated);
    if (updated.maxQty !== undefined)
      setInvMaxQty((p) => ({ ...p, [updated.id]: updated.maxQty }));
    setEditItemModal(false);
  };

  const handleDeleteItem = (id) => {
    if (Platform.OS === "web") {
      if (window.confirm("Delete this item? This cannot be undone.")) {
        deleteItem(id);
      }
    } else {
      Alert.alert("Delete Item", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteItem(id) },
      ]);
    }
  };

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  if (!fontsLoaded) return null;

  const renderContent = () => {
    if (activeTab === "cashier")
      return (
        <CashierScreen
          items={items}
          categories={categories}
          addOrder={addOrder}
          deductStock={deductStock}
          isWide={isWide}
        />
      );
    if (activeTab === "menu")
      return (
        <ManageItemsScreen
          items={items}
          categories={categories}
          filtered={filtered}
          search={search}
          activeCategory={activeCategory}
          onSearch={handleSearch}
          onCategoryChange={setActiveCategory}
          onAddItem={openAddItem}
          onEditItem={openEditItem}
          onDeleteItem={handleDeleteItem}
          isWide={isWide}
        />
      );
    if (activeTab === "inventory")
      return (
        <InventoryScreen
          items={items}
          maxQtyMap={invMaxQty}
          onAddItem={openAddItem}
          onEditItem={openEditItem}
        />
      );
    if (activeTab === "history") return <OrderHistoryScreen orders={orders} />;
    if (activeTab === "credits") return <CreditsScreen />;
    if (activeTab === "report")
      return <SalesReportScreen orders={orders} items={items} />;
    return null;
  };

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
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

      {notifBanner && (
        <Animated.View
          style={{
            position: "absolute",
            top: Platform.OS === "web" ? 12 : 44,
            left: 16,
            right: 16,
            zIndex: 999,
            transform: [{ translateY: notifAnim }],
          }}
        >
          <LinearGradient
            colors={["#1a6b3a", "#27ae60"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              shadowColor: "#000",
              shadowOpacity: 0.35,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 16,
              borderWidth: 1,
              borderColor: "rgba(201,168,76,0.40)",
            }}
          >
            <Text style={{ fontSize: 24 }}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "GoogleSans_700Bold",
                  fontSize: 13,
                  color: "#fff",
                  letterSpacing: 0.3,
                }}
              >
                New Grocery Order #{notifBanner.orderNo}
              </Text>
              <Text
                style={{
                  fontFamily: "GoogleSans_400Regular",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.75)",
                  marginTop: 1,
                }}
              >
                From: {notifBanner.source} · ₱
                {Number(notifBanner.total).toFixed(2)}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      <Animated.View
        style={{
          opacity: hdrFade,
          transform: [{ translateY: hdrTrans }],
          marginTop: Platform.OS === "web" ? 16 : 36,
          marginHorizontal: isSmall ? 8 : 10,
          zIndex: 30,
          flexShrink: 0,
        }}
      >
        <View
          style={[
            styles.header,
            { paddingHorizontal: 20, paddingVertical: 10 },
          ]}
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation && navigation.goBack()}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text
              style={[styles.headerH1, { fontSize: isSmall ? 13 : 18 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              <Text style={styles.headerGold}>CESLA </Text>Grocery Management
            </Text>
            <View style={styles.visitorTag}>
              <Text style={styles.visitorTagText}>🛒 ADMIN PANEL</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.iconBtn, { position: "relative" }]}>
            <MaterialIcons name="notifications" size={19} color="#fff" />
            {pendingCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeTxt}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View
        style={[styles.body, { opacity: bodyFade, flex: 1, minHeight: 0 }]}
      >
        <View
          style={{
            flex: 1,
            flexDirection: isWide ? "row" : "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {isWide ? (
            <View style={styles.leftPanel}>
              <OrderingMonitoring orders={orders} items={items} />
            </View>
          ) : (
            <View
              style={[
                styles.leftPanelMobile,
                salesCollapsed && { height: 36 },
                isTablet && !salesCollapsed && { height: 170 },
              ]}
            >
              <TouchableOpacity
                onPress={() => setSalesCollapsed((v) => !v)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: "rgba(26,58,107,0.15)",
                  borderBottomWidth: salesCollapsed ? 0 : 1,
                  borderColor: "rgba(255,255,255,0.30)",
                }}
                activeOpacity={0.8}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: "#27ae60",
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: "GoogleSans_700Bold",
                      fontSize: 10,
                      color: "#1a2d4e",
                      letterSpacing: 1.2,
                    }}
                  >
                    SALES OVERVIEW
                  </Text>
                </View>
                <MaterialIcons
                  name={salesCollapsed ? "expand-more" : "expand-less"}
                  size={18}
                  color="rgba(26,58,107,0.60)"
                />
              </TouchableOpacity>
              {!salesCollapsed && (
                <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                  <OrderingMonitoring orders={orders} items={items} />
                </View>
              )}
            </View>
          )}

          <View style={isWide ? styles.rightPanel : styles.rightPanelMobile}>
            <View style={styles.adWrapper}>
              <ScrollView
                ref={adScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) =>
                  setAdCurrent(
                    Math.round(e.nativeEvent.contentOffset.x / bannerW),
                  )
                }
                style={{ width: "100%" }}
                contentContainerStyle={{ width: bannerW * (ads.length + 1) }}
              >
                {ads.map((ad) => {
                  const imgSrc = ad.image
                    ? { uri: ad.image }
                    : ad.imageUrl
                      ? { uri: ad.imageUrl }
                      : null;
                  return (
                    <LinearGradient
                      key={ad.id}
                      colors={ad.bg || ["#1a6b3a", "#27ae60"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.adSlide, { width: bannerW }]}
                    >
                      {imgSrc ? (
                        <Image
                          source={imgSrc}
                          style={styles.adBgImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.adEmoji}>{ad.emoji || "🛒"}</Text>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.adTitle} numberOfLines={1}>
                          {ad.title}
                        </Text>
                        <Text style={styles.adSub} numberOfLines={1}>
                          {ad.sub}
                        </Text>
                      </View>
                      <View style={styles.adBadge}>
                        <Text style={styles.adBadgeTxt}>AD</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.adEditBtn}
                        onPress={async () => {
                          if (Platform.OS === "web") {
                            if (window.confirm("Delete this ad?")) {
                              await deleteAd(ad.id);
                            }
                          } else {
                            Alert.alert("Delete Ad", "Remove this ad?", [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => deleteAd(ad.id),
                              },
                            ]);
                          }
                        }}
                      >
                        <MaterialIcons name="delete" size={12} color="#fff" />
                      </TouchableOpacity>
                      <View style={styles.adDotsInner}>
                        {ads.map((_, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => {
                              adScrollRef.current?.scrollTo({
                                x: i * bannerW,
                                animated: true,
                              });
                              setAdCurrent(i);
                            }}
                          >
                            <View
                              style={[
                                styles.adDot,
                                adCurrent === i && styles.adDotActive,
                              ]}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </LinearGradient>
                  );
                })}
                <TouchableOpacity
                  style={[
                    styles.adSlide,
                    {
                      width: bannerW,
                      backgroundColor: "rgba(26,58,107,0.18)",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 8,
                      borderWidth: 2,
                      borderColor: "rgba(255,255,255,0.40)",
                      borderStyle: "dashed",
                    },
                  ]}
                  onPress={async () => {
                    const title =
                      Platform.OS === "web"
                        ? window.prompt("Ad Title:", "Today's Deals")
                        : "New Ad";
                    if (!title) return;
                    const sub =
                      Platform.OS === "web"
                        ? window.prompt(
                            "Ad Subtitle:",
                            "Fresh groceries available!",
                          )
                        : "";
                    const newAd = {
                      id: Date.now().toString(),
                      title: title || "New Ad",
                      sub: sub || "",
                      emoji: "🛒",
                      bg: ["#1a6b3a", "#27ae60"],
                      imageUrl: "",
                      image: null,
                      target: "both",
                      url: "",
                    };
                    await saveAd(newAd);
                  }}
                >
                  <MaterialIcons
                    name="add-circle-outline"
                    size={28}
                    color="rgba(26,58,107,0.55)"
                  />
                  <Text
                    style={{
                      fontFamily: "GoogleSans_700Bold",
                      fontSize: 12,
                      color: "rgba(26,58,107,0.55)",
                    }}
                  >
                    Add New Ad
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            <View style={styles.tabBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 2 }}
                style={{ flexGrow: 0 }}
              >
                {TABS.map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tabBtn,
                      activeTab === tab.key && styles.tabBtnActive,
                    ]}
                    onPress={() => setActiveTab(tab.key)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name={tab.icon}
                      size={13}
                      color={
                        activeTab === tab.key
                          ? "#1a3a6b"
                          : "rgba(255,255,255,0.80)"
                      }
                    />
                    <Text
                      style={[
                        styles.tabBtnTxt,
                        activeTab === tab.key && styles.tabBtnTxtActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                    {tab.key === "cashier" && pendingCount > 0 && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeTxt}>{pendingCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.contentArea}>{renderContent()}</View>
          </View>
        </View>
      </Animated.View>

      <ItemEditModal
        visible={editItemModal}
        item={editItem}
        categories={categories}
        onSave={handleSaveItem}
        onClose={() => setEditItemModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "column" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,58,107,0.92)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#011f4b",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  backIcon: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
    minWidth: 0,
  },
  headerH1: {
    fontFamily: "NotoSerif_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  headerGold: { color: "#c9a84c" },
  visitorTag: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.40)",
    alignSelf: "center",
  },
  visitorTagText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 8,
    color: "#fff",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    lineHeight: 13,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#e74c3c",
    borderRadius: 6,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  notifBadgeTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 8,
    color: "#fff",
  },
  body: {
    flex: 1,
    marginTop: Platform.OS === "web" ? 10 : 6,
    marginBottom: 16,
    minHeight: 0,
    overflow: "hidden",
  },
  leftPanelMobile: {
    height: 220,
    flexShrink: 0,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 12,
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.40)",
    overflow: "hidden",
  },
  rightPanelMobile: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    marginHorizontal: 8,
    marginTop: 6,
    marginBottom: 8,
    flexDirection: "column",
    overflow: "hidden",
  },
  leftPanel: {
    flex: 1.4,
    flexShrink: 0,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 16,
    marginLeft: 10,
    marginRight: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.40)",
    overflow: "hidden",
    minHeight: 0,
  },
  rightPanel: {
    flex: 3,
    minWidth: 0,
    minHeight: 0,
    marginHorizontal: 10,
    flexDirection: "column",
    overflow: "hidden",
  },
  adWrapper: {
    height: 100,
    flexShrink: 0,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(26,58,107,0.15)",
    marginBottom: 0,
  },
  adSlide: {
    height: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
    overflow: "hidden",
  },
  adBgImg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  adEmoji: { fontSize: 40, flexShrink: 0 },
  adTitle: { fontFamily: "GoogleSans_700Bold", fontSize: 15, color: "#fff" },
  adSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  adBadge: {
    position: "absolute",
    top: 8,
    right: 38,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adBadgeTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "#fff",
    letterSpacing: 1,
  },
  adEditBtn: {
    position: "absolute",
    top: 6,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 7,
    padding: 5,
  },
  adDotsInner: {
    position: "absolute",
    bottom: 5,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  adDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.40)",
  },
  adDotActive: { backgroundColor: "#fff", width: 16 },
  tabBar: {
    flexShrink: 0,
    backgroundColor: "rgba(26,58,107,0.50)",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 5,
    paddingHorizontal: 4,
    marginTop: 8,
    flexDirection: "row",
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginHorizontal: 2,
  },
  tabBtnActive: { backgroundColor: "#eef2f8" },
  tabBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.80)",
  },
  tabBtnTxtActive: { color: "#1a3a6b" },
  tabBadge: {
    backgroundColor: "#e74c3c",
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  tabBadgeTxt: { fontFamily: "GoogleSans_700Bold", fontSize: 8, color: "#fff" },
  contentArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.40)",
    overflow: "hidden",
  },
});
