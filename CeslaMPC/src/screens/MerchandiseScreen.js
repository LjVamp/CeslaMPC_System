// src/screens/MerchandiseScreen.js
// CESLA MPC — Merchandise Ordering System
// 3-panel layout: Left Categories | Center Items+Search | Right Cart

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  Image,
  useWindowDimensions,
  Platform,
  TextInput,
  Modal,
  Alert,
  PanResponder,
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
import { useFocusEffect } from "@react-navigation/native";
import { useMerchandise } from "../context/MerchandiseContext";

// ─── DATA ─────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "All",
  "Shirts",
  "Mugs",
  "Tumbler",
  "Bags",
  "Pens",
  "Caps",
  "Umbrellas",
  "Stufftoys",
  "Others",
];

// Sizes come from item.sizes (set by admin in ManageMerchandiseScreen)
// These constants are only used for grouping the display in SizePickerModal
const ADULT_SIZES_REF = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const KIDS_SIZES_REF = ["2T", "3T", "4T", "5T", "6", "8", "10", "12", "14"];
const needsSize = (item) => Array.isArray(item.sizes) && item.sizes.length > 0;

const MERCH_ITEMS = [
  {
    id: "1",
    name: "CESLA Polo Shirt",
    cat: "Shirts",
    price: 350,
    stock: 20,
    emoji: "👕",
  },
  {
    id: "2",
    name: "CESLA T-Shirt",
    cat: "Shirts",
    price: 250,
    stock: 30,
    emoji: "👕",
  },
  {
    id: "3",
    name: "CESLA Polo (White)",
    cat: "Shirts",
    price: 350,
    stock: 15,
    emoji: "👔",
  },
  {
    id: "4",
    name: "CESLA Ceramic Mug",
    cat: "Mugs",
    price: 180,
    stock: 25,
    emoji: "☕",
  },
  {
    id: "5",
    name: "CESLA Travel Mug",
    cat: "Mugs",
    price: 220,
    stock: 18,
    emoji: "🫖",
  },
  {
    id: "6",
    name: "CESLA Tumbler 500ml",
    cat: "Tumbler",
    price: 280,
    stock: 22,
    emoji: "🥤",
  },
  {
    id: "7",
    name: "CESLA Tumbler 1L",
    cat: "Tumbler",
    price: 350,
    stock: 12,
    emoji: "🧋",
  },
  {
    id: "8",
    name: "CESLA Tote Bag",
    cat: "Bags",
    price: 150,
    stock: 40,
    emoji: "👜",
  },
  {
    id: "9",
    name: "CESLA Backpack",
    cat: "Bags",
    price: 650,
    stock: 10,
    emoji: "🎒",
  },
  {
    id: "10",
    name: "CESLA Sling Bag",
    cat: "Bags",
    price: 320,
    stock: 15,
    emoji: "👝",
  },
  {
    id: "11",
    name: "CESLA Ballpen",
    cat: "Pens",
    price: 30,
    stock: 100,
    emoji: "🖊️",
  },
  {
    id: "12",
    name: "CESLA Gel Pen Set",
    cat: "Pens",
    price: 85,
    stock: 60,
    emoji: "✒️",
  },
  {
    id: "13",
    name: "CESLA Snapback Cap",
    cat: "Caps",
    price: 280,
    stock: 20,
    emoji: "🧢",
  },
  {
    id: "14",
    name: "CESLA Bucket Hat",
    cat: "Caps",
    price: 220,
    stock: 18,
    emoji: "👒",
  },
  {
    id: "15",
    name: "CESLA Umbrella",
    cat: "Umbrellas",
    price: 320,
    stock: 14,
    emoji: "☂️",
  },
  {
    id: "16",
    name: "CESLA Foldable Umbrella",
    cat: "Umbrellas",
    price: 250,
    stock: 20,
    emoji: "☂️",
  },
  {
    id: "17",
    name: "CESLA Bear Stufftoy",
    cat: "Stufftoys",
    price: 180,
    stock: 10,
    emoji: "🧸",
  },
  {
    id: "18",
    name: "CESLA Plush Doll",
    cat: "Stufftoys",
    price: 220,
    stock: 8,
    emoji: "🪆",
  },
  {
    id: "19",
    name: "CESLA Keychain",
    cat: "Others",
    price: 60,
    stock: 50,
    emoji: "🔑",
  },
  {
    id: "20",
    name: "CESLA Sticker Pack",
    cat: "Others",
    price: 40,
    stock: 80,
    emoji: "🏷️",
  },
];

// ─── LAZY-LOAD react-native-maps (native only, avoids web import error) ────────
let MapView = null;
let Marker = null;
if (Platform.OS !== "web") {
  try {
    const RNMaps = require("react-native-maps");
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
  } catch (_) {
    /* react-native-maps not installed */
  }
}

// ─── LEAFLET HTML (injected as iframe srcdoc on web) ─────────────────────────
const LEAFLET_HTML = (lat, lng, isDeliver) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body,#map { width:100%; height:100%; }
  .leaflet-control-attribution { font-size:8px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var initLat = ${lat || 8.4822};
  var initLng = ${lng || 124.6472};
  var pinColor = '${isDeliver ? "#e74c3c" : "#1a3a6b"}';
  var cdoBounds = L.latLngBounds([[8.37, 124.55], [8.58, 124.78]]);
  var map = L.map('map', {
    maxBounds: cdoBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 12,
  }).setView([initLat, initLng], ${lat ? 17 : 14});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  var icon = L.divIcon({
    html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:' + pinColor + ';border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);transform:rotate(-45deg);"></div>',
    iconSize: [26,26], iconAnchor:[13,26], className:''
  });
  var marker = null;
  function setPin(lat, lng) {
    if (marker) { marker.setLatLng([lat, lng]); }
    else {
      marker = L.marker([lat, lng], { icon: icon, draggable: true }).addTo(map);
      marker.on('dragend', function(e) {
        var ll = e.target.getLatLng();
        window.parent.postMessage(JSON.stringify({ type:'coords', lat: ll.lat, lng: ll.lng }), '*');
      });
    }
    window.parent.postMessage(JSON.stringify({ type:'coords', lat: lat, lng: lng }), '*');
  }
  ${lat ? `setPin(${lat}, ${lng});` : ""}
  map.on('click', function(e) { setPin(e.latlng.lat, e.latlng.lng); map.panTo(e.latlng); });
  window.addEventListener('message', function(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'flyTo') { setPin(msg.lat, msg.lng); map.setView([msg.lat, msg.lng], 16); }
    } catch(_) {}
  });
</script>
</body>
</html>`;

const DEFAULT_REGION = {
  latitude: 8.4822,
  longitude: 124.6472,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

// ─── LOCATION PICKER MODAL ────────────────────────────────────────────────────
const LocationPickerModal = ({ visible, onClose, onConfirm, deliveryType }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(80)).current;

  const [coords, setCoords] = useState(null);
  const [address, setAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [mapKey, setMapKey] = useState(0);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(80);
      setSearchQuery("");
      setSuggestions([]);
    }
  }, [visible]);

  // Listen for pin coords from Leaflet iframe (web)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type !== "coords") return;
        const { lat, lng } = msg;
        setCoords({ lat, lng });
        try {
          const res = await fetch(
            `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&lang=en&apiKey=${GEOAPIFY_KEY}`,
          );
          const data = await res.json();
          const addr = data.features?.[0]?.properties?.formatted;
          setAddress(addr || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } catch (_) {
          setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
      } catch (_) {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const GEOAPIFY_KEY = "a331c3962fec4895bf75aa4947d35fbc";
  const CDO_LAT = 8.4822;
  const CDO_LNG = 124.6472;
  const CDO_BBOX = "124.55,8.37,124.78,8.58";

  // Photon search (primary, fully free, OSM-based)
  const searchPhoton = async (text) => {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(text)},Cagayan de Oro` +
        `&lat=${CDO_LAT}&lon=${CDO_LNG}&limit=6&lang=en`,
    );
    const data = await res.json();
    return (data.features || [])
      .filter((f) => {
        const [lng, lat] = f.geometry.coordinates;
        return lat >= 8.37 && lat <= 8.58 && lng >= 124.55 && lng <= 124.78;
      })
      .map((f) => ({
        display_name: [
          f.properties.name,
          f.properties.street,
          f.properties.district,
          f.properties.city,
        ]
          .filter(Boolean)
          .join(", "),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        place_id: null,
      }));
  };

  // Geoapify search (fallback, 3000 req/day free)
  const searchGeoapify = async (text) => {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/autocomplete` +
        `?text=${encodeURIComponent(text)}` +
        `&bias=proximity:${CDO_LNG},${CDO_LAT}` +
        `&filter=rect:${CDO_BBOX}` +
        `&limit=6&lang=en&apiKey=${GEOAPIFY_KEY}`,
    );
    const data = await res.json();
    return (data.features || []).map((f) => ({
      display_name: f.properties.formatted,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      place_id: null,
    }));
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    clearTimeout(searchTimer.current);
    if (text.length < 2) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        let results = await searchPhoton(text);
        if (results.length === 0) results = await searchGeoapify(text);
        setSuggestions(results);
      } catch (_) {
        try {
          const results = await searchGeoapify(text);
          setSuggestions(results);
        } catch (__) {
          setSuggestions([]);
        }
      }
      setSearching(false);
    }, 400);
  };

  const handleSelectSuggestion = (s) => {
    setSearchQuery("");
    setSuggestions([]);
    setCoords({ lat: s.lat, lng: s.lng });
    setAddress(s.display_name);
    if (Platform.OS !== "web") {
      setRegion({
        latitude: s.lat,
        longitude: s.lng,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
      });
    } else {
      setMapKey((k) => k + 1);
    }
  };

  const handleGetLocation = async () => {
    setLocLoading(true);
    try {
      let latitude, longitude;
      if (Platform.OS === "web") {
        if (!navigator.geolocation) {
          Alert.alert(
            "Not Supported",
            "Geolocation not supported by this browser.",
          );
          setLocLoading(false);
          return;
        }
        await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(
            (p) => {
              latitude = p.coords.latitude;
              longitude = p.coords.longitude;
              res();
            },
            (e) => rej(e),
            { enableHighAccuracy: true, timeout: 12000 },
          );
        });
      } else {
        const Location = require("expo-location");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Location permission is required.");
          setLocLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }
      setCoords({ lat: latitude, lng: longitude });
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=en&apiKey=${GEOAPIFY_KEY}`,
        );
        const data = await res.json();
        const addr = data.features?.[0]?.properties?.formatted;
        setAddress(addr || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      } catch (_) {
        setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
      if (Platform.OS !== "web") {
        setRegion({
          latitude,
          longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        });
      } else {
        setMapKey((k) => k + 1);
      }
    } catch (e) {
      Alert.alert(
        "Error",
        "Could not get location. Please enable GPS and try again.",
      );
    }
    setLocLoading(false);
  };

  const handleMarkerDrag = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setCoords({ lat: latitude, lng: longitude });
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=en&apiKey=${GEOAPIFY_KEY}`,
      );
      const data = await res.json();
      const addr = data.features?.[0]?.properties?.formatted;
      setAddress(addr || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    } catch (_) {
      setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    }
  };

  const handleConfirm = () => {
    if (!address.trim()) {
      Alert.alert("No location", "Please set a location first.");
      return;
    }
    onConfirm({ address: address.trim(), coords });
    onClose();
  };

  const isDeliver = deliveryType === "deliver";
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[lpStyles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[lpStyles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Header */}
          <View style={lpStyles.header}>
            <Text style={lpStyles.headerIcon}>{isDeliver ? "🛵" : "🏃"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={lpStyles.headerTitle}>
                {isDeliver ? "Set Delivery Location" : "Set Pick-Up Location"}
              </Text>
              <Text style={lpStyles.headerSub}>
                {isDeliver
                  ? "Search address or drop pin on map"
                  : "Search or tap on map to set pick-up point"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={lpStyles.closeBtn}>
              <Text style={lpStyles.closeBtnTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Address search bar */}
          <View style={lpStyles.searchWrap}>
            <View style={lpStyles.searchRow}>
              <Text style={lpStyles.searchIcon}>🔍</Text>
              <TextInput
                style={lpStyles.searchInput}
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder="Search address, landmark, place…"
                placeholderTextColor="rgba(1,31,75,0.35)"
                returnKeyType="search"
                {...(Platform.OS === "web" ? { outlineStyle: "none" } : {})}
              />
              {searching && (
                <Text style={{ fontSize: 11, color: "rgba(1,31,75,0.45)" }}>
                  …
                </Text>
              )}
              {searchQuery.length > 0 && !searching && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery("");
                    setSuggestions([]);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: "rgba(1,31,75,0.40)",
                      paddingHorizontal: 4,
                    }}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {suggestions.length > 0 && (
              <View style={lpStyles.suggestions}>
                {suggestions.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      lpStyles.suggestionItem,
                      i < suggestions.length - 1 && lpStyles.suggestionBorder,
                    ]}
                    onPress={() => handleSelectSuggestion(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={lpStyles.suggestionPin}>📍</Text>
                    <Text style={lpStyles.suggestionTxt} numberOfLines={2}>
                      {s.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* GPS button */}
          <TouchableOpacity
            style={lpStyles.myLocBtn}
            onPress={handleGetLocation}
            activeOpacity={0.8}
            disabled={locLoading}
          >
            <LinearGradient
              colors={
                isDeliver ? ["#c0392b", "#e74c3c"] : ["#1a3a6b", "#2c5282"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={lpStyles.myLocGrad}
            >
              <Text style={lpStyles.myLocTxt}>
                {locLoading
                  ? "⏳  Getting your location…"
                  : "📡  Use My Current Location"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Map */}
          <View style={lpStyles.mapWrap}>
            {Platform.OS !== "web" && MapView ? (
              <>
                <MapView
                  style={{ flex: 1 }}
                  region={region}
                  onPress={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    setRegion((r) => ({ ...r, latitude, longitude }));
                    handleMarkerDrag({
                      nativeEvent: { coordinate: { latitude, longitude } },
                    });
                  }}
                  showsUserLocation
                  showsMyLocationButton={false}
                  showsCompass
                  showsScale
                >
                  {coords && (
                    <Marker
                      coordinate={{
                        latitude: coords.lat,
                        longitude: coords.lng,
                      }}
                      draggable
                      onDragEnd={handleMarkerDrag}
                      pinColor={isDeliver ? "#e74c3c" : "#1a3a6b"}
                    />
                  )}
                </MapView>
                {!coords && (
                  <View style={lpStyles.mapHint} pointerEvents="none">
                    <View style={lpStyles.mapHintBubble}>
                      <Text style={lpStyles.mapHintTxt}>
                        👆 Tap anywhere on the map to pin
                      </Text>
                    </View>
                  </View>
                )}
              </>
            ) : Platform.OS === "web" ? (
              <iframe
                key={mapKey}
                title="Location Map"
                srcDoc={LEAFLET_HTML(coords?.lat, coords?.lng, isDeliver)}
                style={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                  borderRadius: 14,
                }}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <View style={lpStyles.mapPlaceholder}>
                <Text style={{ fontSize: 36 }}>🗺️</Text>
                <Text style={lpStyles.mapPlaceholderTxt}>
                  Map not available. Use search or GPS.
                </Text>
              </View>
            )}
          </View>

          {/* Address display / manual edit */}
          <View style={lpStyles.addrRow}>
            <Text style={lpStyles.addrPin}>{isDeliver ? "📦" : "📍"}</Text>
            <TextInput
              style={lpStyles.addrInput}
              value={address}
              onChangeText={setAddress}
              placeholder={
                isDeliver
                  ? "Delivery address will appear here…"
                  : "Pick-up location will appear here…"
              }
              placeholderTextColor="rgba(1,31,75,0.35)"
              multiline
              {...(Platform.OS === "web" ? { outlineStyle: "none" } : {})}
            />
            {address.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setAddress("");
                  setCoords(null);
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: "rgba(1,31,75,0.40)",
                    paddingLeft: 4,
                  }}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Confirm button */}
          <TouchableOpacity
            style={[lpStyles.confirmBtn, !address.trim() && { opacity: 0.4 }]}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                isDeliver ? ["#c0392b", "#e74c3c"] : ["#27ae60", "#2ecc71"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={lpStyles.confirmGrad}
            >
              <Text style={lpStyles.confirmTxt}>✅ Confirm Location</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const lpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(1,15,40,0.60)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#f0f5f9",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    gap: 10,
    maxHeight: "92%",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 2,
  },
  headerIcon: { fontSize: 26 },
  headerTitle: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 15,
    color: "#0f1e35",
  },
  headerSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.50)",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    backgroundColor: "rgba(1,31,75,0.08)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 14,
    color: "rgba(1,31,75,0.55)",
  },
  searchWrap: { position: "relative", zIndex: 99 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200,218,235,0.90)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  searchIcon: { fontSize: 15 },
  searchInput: {
    flex: 1,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "#0f1e35",
    paddingVertical: 9,
  },
  suggestions: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(200,218,235,0.80)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200,218,235,0.50)",
  },
  suggestionPin: { fontSize: 14, paddingTop: 1 },
  suggestionTxt: {
    flex: 1,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(1,31,75,0.75)",
    lineHeight: 17,
  },
  myLocBtn: { borderRadius: 11, overflow: "hidden" },
  myLocGrad: { paddingVertical: 11, alignItems: "center" },
  myLocTxt: { fontFamily: "GoogleSans_700Bold", fontSize: 13, color: "#fff" },
  mapWrap: {
    height: 230,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(200,218,235,0.30)",
    borderWidth: 1,
    borderColor: "rgba(200,218,235,0.70)",
  },
  mapHint: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  mapHintBubble: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  mapHintTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "#fff",
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  mapPlaceholderTxt: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(1,31,75,0.45)",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  addrRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200,218,235,0.90)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  addrPin: { fontSize: 18, paddingTop: 8 },
  addrInput: {
    flex: 1,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "#0f1e35",
    paddingVertical: 9,
    minHeight: 38,
    maxHeight: 72,
  },
  confirmBtn: { borderRadius: 12, overflow: "hidden" },
  confirmGrad: { paddingVertical: 14, alignItems: "center" },
  confirmTxt: { fontFamily: "GoogleSans_700Bold", fontSize: 14, color: "#fff" },
});

// ─── DELIVERY STYLES ──────────────────────────────────────────────────────────
const delivStyles = StyleSheet.create({
  box: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200,218,235,0.80)",
    padding: 11,
    gap: 8,
    marginBottom: 2,
  },
  sectionLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "rgba(1,31,75,0.55)",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "rgba(1,31,75,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(1,31,75,0.12)",
  },
  toggleBtnActive: {
    backgroundColor: "rgba(26,58,107,0.12)",
    borderColor: "#1a3a6b",
  },
  toggleBtnActiveDeliver: {
    backgroundColor: "rgba(231,76,60,0.10)",
    borderColor: "#e74c3c",
  },
  toggleIcon: { fontSize: 16 },
  toggleTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "rgba(1,31,75,0.50)",
  },
  toggleTxtActive: { color: "#1a3a6b" },
  toggleTxtActiveDeliver: { color: "#c0392b" },
  mapTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.80)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200,218,235,0.90)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  mapTriggerSet: {
    borderColor: "rgba(39,174,96,0.55)",
    backgroundColor: "rgba(39,174,96,0.07)",
  },
  mapTriggerUnset: {
    borderColor: "rgba(231,76,60,0.45)",
    backgroundColor: "rgba(231,76,60,0.05)",
    borderStyle: "dashed",
  },
  mapTriggerPin: { fontSize: 16 },
  mapTriggerTxt: {
    flex: 1,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(1,31,75,0.40)",
  },
  mapTriggerTxtSet: { color: "#0f1e35", fontFamily: "GoogleSans_500Medium" },
  mapTriggerChevron: { fontSize: 16 },
});

// ─── SIZE PICKER MODAL ────────────────────────────────────────────────────────
const SizePickerModal = ({ visible, item, onConfirm, onClose }) => {
  const [sel, setSel] = React.useState(null);
  React.useEffect(() => {
    if (visible) setSel(null);
  }, [visible]);
  if (!item) return null;

  // Use the item's own sizes (set by admin); fall back gracefully
  const availableSizes =
    Array.isArray(item.sizes) && item.sizes.length > 0 ? item.sizes : [];

  // Split into adult vs kids groups for display
  const adultSizes = availableSizes.filter((s) => ADULT_SIZES_REF.includes(s));
  const kidsSizes = availableSizes.filter((s) => KIDS_SIZES_REF.includes(s));
  // Any custom sizes not in either reference list
  const otherSizes = availableSizes.filter(
    (s) => !ADULT_SIZES_REF.includes(s) && !KIDS_SIZES_REF.includes(s),
  );

  const SizeChip = ({ size, isKids }) => (
    <TouchableOpacity
      key={size}
      onPress={() => setSel(size)}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor:
          sel === size
            ? isKids
              ? "#1a6b45"
              : "#1a3a6b"
            : "rgba(1,31,75,0.07)",
        borderWidth: 1.5,
        borderColor:
          sel === size
            ? isKids
              ? "#1a6b45"
              : "#1a3a6b"
            : "rgba(1,31,75,0.15)",
        minWidth: 50,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "GoogleSans_700Bold",
          fontSize: 13,
          color: sel === size ? "#fff" : "rgba(1,31,75,0.65)",
        }}
      >
        {size}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(1,20,50,0.60)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          activeOpacity={1}
        />
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 18,
            padding: 22,
            width: 320,
            gap: 14,
          }}
        >
          {/* Header */}
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text
              style={{
                fontFamily: "GoogleSans_700Bold",
                fontSize: 15,
                color: "#1a3a6b",
              }}
            >
              {item.emoji} Select Size
            </Text>
            <Text
              style={{
                fontFamily: "GoogleSans_400Regular",
                fontSize: 12,
                color: "rgba(1,31,75,0.55)",
                textAlign: "center",
              }}
              numberOfLines={2}
            >
              {item.name}
            </Text>
          </View>

          {availableSizes.length === 0 ? (
            <Text
              style={{
                fontFamily: "GoogleSans_400Regular",
                fontSize: 12,
                color: "rgba(1,31,75,0.45)",
                textAlign: "center",
                paddingVertical: 8,
              }}
            >
              No sizes set for this item.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {/* Adult sizes */}
              {adultSizes.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: "GoogleSans_700Bold",
                      fontSize: 9,
                      color: "rgba(26,58,107,0.50)",
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                    }}
                  >
                    ADULT
                  </Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                  >
                    {adultSizes.map((sz) => (
                      <SizeChip key={sz} size={sz} isKids={false} />
                    ))}
                  </View>
                </View>
              )}

              {/* Kids sizes */}
              {kidsSizes.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: "GoogleSans_700Bold",
                      fontSize: 9,
                      color: "rgba(26,107,69,0.60)",
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                    }}
                  >
                    KIDS
                  </Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                  >
                    {kidsSizes.map((sz) => (
                      <SizeChip key={sz} size={sz} isKids={true} />
                    ))}
                  </View>
                </View>
              )}

              {/* Other / custom sizes */}
              {otherSizes.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: "GoogleSans_700Bold",
                      fontSize: 9,
                      color: "rgba(1,31,75,0.45)",
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                    }}
                  >
                    OTHER
                  </Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                  >
                    {otherSizes.map((sz) => (
                      <SizeChip key={sz} size={sz} isKids={false} />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Action buttons */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 11,
                borderRadius: 10,
                backgroundColor: "rgba(1,31,75,0.07)",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "GoogleSans_700Bold",
                  fontSize: 13,
                  color: "rgba(1,31,75,0.50)",
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => sel && onConfirm(sel)}
              style={{
                flex: 2,
                paddingVertical: 11,
                borderRadius: 10,
                backgroundColor: sel ? "#1a3a6b" : "rgba(1,31,75,0.20)",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "GoogleSans_700Bold",
                  fontSize: 13,
                  color: "#fff",
                }}
              >
                {sel ? "Confirm — " + sel : "Pick a size"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Color reference (mirrors ManageMerchandiseScreen COLOR_OPTIONS)
const COLOR_OPTIONS_REF = {
  Mugs: [
    { label: "Gray", hex: "#9e9e9e" },
    { label: "Pink", hex: "#f48fb1" },
  ],
  Shirts: [
    { label: "White", hex: "#f5f5f5" },
    { label: "Navy Blue", hex: "#1a3a6b" },
    { label: "Royal Blue", hex: "#2979ff" },
    { label: "Khaki", hex: "#c8b560" },
  ],
  Caps: [
    { label: "White", hex: "#f5f5f5" },
    { label: "Navy Blue", hex: "#1a3a6b" },
    { label: "Royal Blue", hex: "#2979ff" },
    { label: "Khaki", hex: "#c8b560" },
  ],
};

// ─── FULL-SCREEN IMAGE VIEWER ─────────────────────────────────────────────────
const FullImageViewer = ({ visible, images, startIndex, onClose }) => {
  const [curIdx, setCurIdx] = useState(startIndex || 0);
  const scrollRef = useRef(null);
  const { width: SW, height: SH } = useWindowDimensions();
  const [scale, setScale] = useState(1);
  const lastScale = useRef(1);
  const lastDist = useRef(null);

  useEffect(() => {
    if (visible) {
      setCurIdx(startIndex || 0);
      setScale(1);
      lastScale.current = 1;
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          x: (startIndex || 0) * SW,
          animated: false,
        });
      }, 50);
    }
  }, [visible, startIndex]);

  const handleScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (idx !== curIdx) {
      setCurIdx(idx);
      setScale(1);
      lastScale.current = 1;
    }
  };

  const handleTouchMove = (e) => {
    if (e.nativeEvent.touches.length === 2) {
      const [t1, t2] = e.nativeEvent.touches;
      const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      if (lastDist.current !== null) {
        const delta = dist / lastDist.current;
        const next = Math.min(4, Math.max(1, lastScale.current * delta));
        setScale(next);
      }
      lastDist.current = dist;
    }
  };
  const handleTouchEnd = (e) => {
    if (e.nativeEvent.touches.length < 2) {
      lastScale.current = scale;
      lastDist.current = null;
      if (scale < 1.05) {
        setScale(1);
        lastScale.current = 1;
      }
    }
  };

  if (!visible || !images || images.length === 0) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.96)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={onClose}
          style={{
            position: "absolute",
            top: Platform.OS === "web" ? 16 : 48,
            right: 16,
            zIndex: 10,
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "rgba(255,255,255,0.18)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            ✕
          </Text>
        </TouchableOpacity>
        {images.length > 1 && (
          <View
            style={{
              position: "absolute",
              top: Platform.OS === "web" ? 20 : 54,
              alignSelf: "center",
              zIndex: 10,
              backgroundColor: "rgba(0,0,0,0.45)",
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12 }}>
              {curIdx + 1} / {images.length}
            </Text>
          </View>
        )}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={{ width: SW, height: SH }}
          contentContainerStyle={{ width: SW * images.length, height: SH }}
          scrollEnabled={scale <= 1}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {images.map((uri, i) => (
            <View
              key={i}
              style={{
                width: SW,
                height: SH,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Image
                source={{ uri }}
                style={{ width: SW, height: SH * 0.85, transform: [{ scale }] }}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>
        {images.length > 1 && (
          <View
            style={{
              position: "absolute",
              bottom: 40,
              left: 0,
              right: 0,
              flexDirection: "row",
              justifyContent: "center",
              gap: 7,
            }}
          >
            {images.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  scrollRef.current?.scrollTo({ x: i * SW, animated: true });
                  setCurIdx(i);
                }}
              >
                <View
                  style={{
                    width: curIdx === i ? 20 : 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor:
                      curIdx === i ? "#fff" : "rgba(255,255,255,0.45)",
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ position: "absolute", bottom: 16, alignSelf: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>
            {Platform.OS === "web"
              ? "Pinch or scroll to zoom"
              : "Pinch to zoom"}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

// ─── ITEM DETAIL MODAL (Visitor) ──────────────────────────────────────────────
const ItemDetailModal = ({ visible, item, onClose, onAdd }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [imgIdx, setImgIdx] = useState(0);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [selColor, setSelColor] = useState(null);
  const [selSize, setSelSize] = useState(null);
  const scrollRef = useRef(null);
  const { width: SW } = useWindowDimensions();
  const MODAL_W = Math.min(320, SW * 0.9);

  useEffect(() => {
    if (visible) {
      setImgIdx(0);
      setFullViewOpen(false);
      setSelColor(null);
      setSelSize(null);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 68,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.88);
      slideAnim.setValue(40);
    }
  }, [visible]);

  if (!item) return null;
  const imgs =
    Array.isArray(item.images) && item.images.length > 0
      ? item.images
      : item.image
        ? [item.image]
        : [];
  const hasColors = Array.isArray(item.colors) && item.colors.length > 0;
  const hasSizes = Array.isArray(item.sizes) && item.sizes.length > 0;

  const colorReady = !hasColors || selColor !== null;
  const sizeReady = !hasSizes || selSize !== null;
  const canAdd = item.stock > 0 && colorReady && sizeReady;

  const missingLabel = () => {
    if (item.stock === 0) return "Out of Stock";
    const parts = [];
    if (hasColors && !selColor) parts.push("color");
    if (hasSizes && !selSize) parts.push("size");
    if (parts.length > 0) return "Pick a " + parts.join(" & ");
    return "🛒  Add To Cart";
  };

  return (
    <>
      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={onClose}
      >
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: "rgba(1,15,40,0.82)",
            justifyContent: "center",
            alignItems: "center",
            opacity: fadeAnim,
          }}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={onClose}
          />
          <Animated.View
            style={{
              width: MODAL_W,
              borderRadius: 24,
              backgroundColor: "#f0f5f9",
              shadowColor: "#000",
              shadowOpacity: 0.35,
              shadowRadius: 24,
              elevation: 20,
              overflow: "hidden",
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
            }}
          >
            {/* Image carousel */}
            <View
              style={{
                width: MODAL_W,
                height: 220,
                backgroundColor: "rgba(200,218,235,0.60)",
                position: "relative",
              }}
            >
              {imgs.length > 0 ? (
                <>
                  <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) =>
                      setImgIdx(
                        Math.round(e.nativeEvent.contentOffset.x / MODAL_W),
                      )
                    }
                    style={{ width: MODAL_W, height: 220 }}
                    contentContainerStyle={{
                      width: MODAL_W * imgs.length,
                      height: 220,
                    }}
                  >
                    {imgs.map((uri, i) => (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.9}
                        onPress={() => setFullViewOpen(true)}
                        style={{ width: MODAL_W, height: 220 }}
                      >
                        <Image
                          source={{ uri }}
                          style={{ width: MODAL_W, height: 220 }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      backgroundColor: "rgba(0,0,0,0.38)",
                      borderRadius: 8,
                      paddingHorizontal: 7,
                      paddingVertical: 3,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 9 }}>
                      🔍 Tap to view
                    </Text>
                  </View>
                  {imgs.length > 1 && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 10,
                        left: 0,
                        right: 0,
                        flexDirection: "row",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      {imgs.map((_, i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => {
                            scrollRef.current?.scrollTo({
                              x: i * MODAL_W,
                              animated: true,
                            });
                            setImgIdx(i);
                          }}
                        >
                          <View
                            style={{
                              width: imgIdx === i ? 18 : 7,
                              height: 7,
                              borderRadius: 4,
                              backgroundColor:
                                imgIdx === i
                                  ? "#fff"
                                  : "rgba(255,255,255,0.50)",
                            }}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 80 }}>{item.emoji}</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={onClose}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "rgba(1,20,50,0.55)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: "700",
                    lineHeight: 16,
                  }}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {/* Details */}
            <View style={{ padding: 20, gap: 8 }}>
              <Text
                style={{
                  fontFamily: "GoogleSans_700Bold",
                  fontSize: 18,
                  color: "#011f4b",
                  lineHeight: 24,
                }}
              >
                {item.name}
              </Text>
              <Text
                style={{
                  fontFamily: "NotoSerif_700Bold",
                  fontSize: 26,
                  color: "#c9a84c",
                  lineHeight: 30,
                }}
              >
                ₱{item.price}.00
              </Text>
              <Text
                style={{
                  fontFamily: "GoogleSans_400Regular",
                  fontSize: 13,
                  color: "rgba(1,31,75,0.55)",
                }}
              >
                Stock: {item.stock}
              </Text>

              {/* ── Selectable Colors ── */}
              {hasColors && (
                <View style={{ gap: 5 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "GoogleSans_700Bold",
                        fontSize: 10,
                        color: "rgba(1,31,75,0.45)",
                        letterSpacing: 1,
                        textTransform: "uppercase",
                      }}
                    >
                      COLORS:
                    </Text>
                    {selColor ? (
                      <Text
                        style={{
                          fontFamily: "GoogleSans_700Bold",
                          fontSize: 10,
                          color: "#1a3a6b",
                        }}
                      >
                        {selColor}
                      </Text>
                    ) : (
                      <Text
                        style={{
                          fontFamily: "GoogleSans_400Regular",
                          fontSize: 10,
                          color: "#e74c3c",
                        }}
                      >
                        — pick one
                      </Text>
                    )}
                  </View>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {item.colors.map((c) => {
                      const hex =
                        Object.values(COLOR_OPTIONS_REF)
                          .flat()
                          .find((x) => x.label === c)?.hex || "#999";
                      const isSelected = selColor === c;
                      return (
                        <TouchableOpacity
                          key={c}
                          onPress={() => setSelColor(c)}
                          style={{ alignItems: "center", gap: 3 }}
                          activeOpacity={0.75}
                        >
                          <View
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 15,
                              backgroundColor: hex,
                              borderWidth: isSelected ? 3 : 1.5,
                              borderColor: isSelected
                                ? "#1a3a6b"
                                : "rgba(0,0,0,0.18)",
                            }}
                          />
                          {isSelected && (
                            <View
                              style={{
                                position: "absolute",
                                top: 7,
                                left: 0,
                                right: 0,
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  color: "#fff",
                                  textShadowColor: "rgba(0,0,0,0.5)",
                                  textShadowRadius: 3,
                                  textShadowOffset: { width: 0, height: 1 },
                                }}
                              >
                                ✓
                              </Text>
                            </View>
                          )}
                          <Text
                            style={{
                              fontFamily: "GoogleSans_700Bold",
                              fontSize: 9,
                              color: isSelected
                                ? "#1a3a6b"
                                : "rgba(1,31,75,0.50)",
                            }}
                          >
                            {c}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ── Selectable Sizes ── */}
              {hasSizes && (
                <View style={{ gap: 5 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "GoogleSans_700Bold",
                        fontSize: 10,
                        color: "rgba(1,31,75,0.45)",
                        letterSpacing: 1,
                        textTransform: "uppercase",
                      }}
                    >
                      SIZES:
                    </Text>
                    {selSize ? (
                      <Text
                        style={{
                          fontFamily: "GoogleSans_700Bold",
                          fontSize: 10,
                          color: "#1a3a6b",
                        }}
                      >
                        {selSize}
                      </Text>
                    ) : (
                      <Text
                        style={{
                          fontFamily: "GoogleSans_400Regular",
                          fontSize: 10,
                          color: "#e74c3c",
                        }}
                      >
                        — pick one
                      </Text>
                    )}
                  </View>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                  >
                    {item.sizes.map((sz) => {
                      const isSelected = selSize === sz;
                      return (
                        <TouchableOpacity
                          key={sz}
                          onPress={() => setSelSize(sz)}
                          style={{
                            paddingHorizontal: 13,
                            paddingVertical: 7,
                            borderRadius: 8,
                            backgroundColor: isSelected
                              ? "#1a3a6b"
                              : "rgba(26,58,107,0.08)",
                            borderWidth: isSelected ? 2 : 1,
                            borderColor: isSelected
                              ? "#1a3a6b"
                              : "rgba(26,58,107,0.20)",
                          }}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={{
                              fontFamily: "GoogleSans_700Bold",
                              fontSize: 12,
                              color: isSelected ? "#fff" : "#1a3a6b",
                            }}
                          >
                            {sz}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <TouchableOpacity
                onPress={() => {
                  if (!canAdd) return;
                  onAdd(selColor, selSize);
                  onClose();
                }}
                disabled={!canAdd}
                style={{
                  marginTop: 4,
                  borderRadius: 14,
                  overflow: "hidden",
                  opacity: canAdd ? 1 : 0.5,
                }}
              >
                <LinearGradient
                  colors={
                    canAdd ? ["#1a3a6b", "#2e5fa3"] : ["#9e9e9e", "#bdbdbd"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 14, alignItems: "center" }}
                >
                  <Text
                    style={{
                      fontFamily: "GoogleSans_700Bold",
                      fontSize: 14,
                      color: "#fff",
                    }}
                  >
                    {missingLabel()}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {visible && (
        <FullImageViewer
          visible={fullViewOpen}
          images={imgs}
          startIndex={imgIdx}
          onClose={() => setFullViewOpen(false)}
        />
      )}
    </>
  );
};

// ─── ITEM CARD ────────────────────────────────────────────────────────────────
const ItemCard = ({ item, onAdd }) => {
  const [detailVisible, setDetailVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [imgIdx, setImgIdx] = useState(0);
  const imgScrollRef = useRef(null);

  const imgs =
    Array.isArray(item.images) && item.images.length > 0
      ? item.images
      : item.image
        ? [item.image]
        : [];

  const handlePressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  const CARD_IMG_SIZE = Platform.OS === "web" ? 86 : 62;

  const hasColors = Array.isArray(item.colors) && item.colors.length > 0;
  const hasSizes = Array.isArray(item.sizes) && item.sizes.length > 0;

  return (
    <>
      <Animated.View
        style={[styles.foodCard, { transform: [{ scale: scaleAnim }] }]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setDetailVisible(true)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={{ flex: 1 }}
        >
          <LinearGradient
            colors={["rgba(220,232,242,0.90)", "rgba(200,218,235,0.70)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.foodCardInner}
          >
            {/* Image carousel or emoji */}
            {imgs.length > 0 ? (
              <View
                style={[
                  styles.cardImgWrap,
                  { width: CARD_IMG_SIZE, height: CARD_IMG_SIZE },
                ]}
              >
                <ScrollView
                  ref={imgScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) =>
                    setImgIdx(
                      Math.round(e.nativeEvent.contentOffset.x / CARD_IMG_SIZE),
                    )
                  }
                  style={{ width: CARD_IMG_SIZE, height: CARD_IMG_SIZE }}
                  contentContainerStyle={{
                    width: CARD_IMG_SIZE * imgs.length,
                    height: CARD_IMG_SIZE,
                  }}
                >
                  {imgs.map((uri, i) => (
                    <Image
                      key={i}
                      source={{ uri }}
                      style={{ width: CARD_IMG_SIZE, height: CARD_IMG_SIZE }}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
                {imgs.length > 1 && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 3,
                      left: 0,
                      right: 0,
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 3,
                    }}
                  >
                    {imgs.map((_, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={(e) => {
                          e.stopPropagation && e.stopPropagation();
                          imgScrollRef.current?.scrollTo({
                            x: i * CARD_IMG_SIZE,
                            animated: true,
                          });
                          setImgIdx(i);
                        }}
                      >
                        <View
                          style={{
                            width: imgIdx === i ? 10 : 4,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor:
                              imgIdx === i ? "#1a3a6b" : "rgba(1,31,75,0.30)",
                          }}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emojiCircle}>
                <Text style={styles.emojiText}>{item.emoji}</Text>
              </View>
            )}

            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.itemPrice}>₱{item.price}.00</Text>
            <Text style={styles.itemStock}>Stock: {item.stock}</Text>

            {/* Color dots */}
            {hasColors && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: 3,
                  marginTop: 1,
                }}
              >
                {item.colors.slice(0, 5).map((c) => {
                  const hex =
                    Object.values(COLOR_OPTIONS_REF)
                      .flat()
                      .find((x) => x.label === c)?.hex || "#999";
                  return (
                    <View
                      key={c}
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: hex,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.18)",
                      }}
                    />
                  );
                })}
              </View>
            )}

            {/* Size chips */}
            {hasSizes && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: 2,
                  marginTop: 1,
                }}
              >
                {item.sizes.slice(0, 3).map((sz) => (
                  <View
                    key={sz}
                    style={{
                      backgroundColor: "rgba(26,58,107,0.12)",
                      borderRadius: 4,
                      paddingHorizontal: 4,
                      paddingVertical: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "GoogleSans_700Bold",
                        fontSize: 7,
                        color: "#1a3a6b",
                      }}
                    >
                      {sz}
                    </Text>
                  </View>
                ))}
                {item.sizes.length > 3 && (
                  <View
                    style={{
                      borderRadius: 4,
                      paddingHorizontal: 3,
                      paddingVertical: 1,
                      backgroundColor: "rgba(26,58,107,0.07)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "GoogleSans_400Regular",
                        fontSize: 7,
                        color: "rgba(26,58,107,0.55)",
                      }}
                    >
                      +{item.sizes.length - 3}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.addBtn, item.stock === 0 && { opacity: 0.45 }]}
              onPress={(e) => {
                e.stopPropagation && e.stopPropagation();
                if ((hasColors || hasSizes) && item.stock > 0) {
                  setDetailVisible(true);
                } else {
                  onAdd(null, null);
                }
              }}
              disabled={item.stock === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>
                {item.stock === 0 ? "Out of Stock" : "Add To Cart"}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <ItemDetailModal
        visible={detailVisible}
        item={item}
        onClose={() => setDetailVisible(false)}
        onAdd={(color, size) => onAdd(color, size)}
      />
    </>
  );
};

const ReceiptModal = ({
  visible,
  orderData,
  onClose,
  onPrint,
  receiptViewRef,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 70,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(60);
    }
  }, [visible]);

  if (!orderData) return null;
  const { items, total, amountPaid, change, orderNo, time, paymentMode } =
    orderData;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.receiptOverlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          ref={receiptViewRef}
          style={[
            styles.receiptCard,
            { transform: [{ translateY: slideAnim }] },
          ]}
          {...(Platform.OS === "web" ? { "data-receipt-card": "true" } : {})}
        >
          {/* Jagged top edge */}
          <View style={styles.receiptJaggedTop}>
            {Array.from({ length: 18 }).map((_, i) => (
              <View key={i} style={styles.receiptJaggedTriangle} />
            ))}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Header */}
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptShopName}>🏪 CESLA MERCHANDISE</Text>
              <Text style={styles.receiptShopSub}>
                Merchandise Ordering System
              </Text>
              <View style={styles.receiptDividerDashed} />
              <Text style={styles.receiptMeta}>Order No.: #{orderNo}</Text>
              <Text style={styles.receiptMeta}>{time}</Text>
              <Text style={styles.receiptMeta}>Type: Walk-in / Visitor</Text>
              <Text style={styles.receiptMeta}>
                {orderData.deliveryType === "deliver"
                  ? "🛵 Deliver"
                  : "🏃 Pick Up"}
                {"  |  "}
                {paymentMode === "gcash" ? "📱 GCash" : "💵 Cash"}
              </Text>
              {orderData.deliveryLocation ? (
                <Text style={styles.receiptMeta}>
                  {orderData.deliveryType === "deliver" ? "📦 To: " : "📍 At: "}
                  {orderData.deliveryLocation}
                </Text>
              ) : null}
              <View style={styles.receiptDividerDashed} />
            </View>

            {/* Items */}
            <View style={{ paddingHorizontal: 20 }}>
              <View style={styles.receiptItemHeader}>
                <Text style={[styles.receiptItemHCol, { flex: 1 }]}>ITEM</Text>
                <Text
                  style={[
                    styles.receiptItemHCol,
                    { width: 32, textAlign: "center" },
                  ]}
                >
                  QTY
                </Text>
                <Text
                  style={[
                    styles.receiptItemHCol,
                    { width: 64, textAlign: "right" },
                  ]}
                >
                  AMOUNT
                </Text>
              </View>
              <View style={styles.receiptDividerSolid} />
              {items.map(({ item, qty, color, size }) => {
                const variantLabel = [color, size].filter(Boolean).join(" / ");
                const rowKey =
                  item.id +
                  (color ? "-" + color : "") +
                  (size ? "-" + size : "");
                return (
                  <View key={rowKey} style={styles.receiptItemRow}>
                    <Text
                      style={[styles.receiptItemText, { flex: 1 }]}
                      numberOfLines={1}
                    >
                      {item.emoji} {item.name}
                      {variantLabel ? " [" + variantLabel + "]" : ""}
                    </Text>
                    <Text
                      style={[
                        styles.receiptItemText,
                        { width: 32, textAlign: "center" },
                      ]}
                    >
                      {qty}
                    </Text>
                    <Text
                      style={[
                        styles.receiptItemText,
                        { width: 64, textAlign: "right" },
                      ]}
                    >
                      ₱{(item.price * qty).toFixed(2)}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.receiptDividerSolid} />

              {/* Totals */}
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptSubTotalLabel}>Subtotal</Text>
                <Text style={styles.receiptSubTotalValue}>
                  ₱ {(orderData.subtotal ?? total).toFixed(2)}
                </Text>
              </View>
              {orderData.deliveryType === "deliver" && (
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptSubTotalLabel}>
                    🛵 Delivery Fee
                  </Text>
                  <Text
                    style={[styles.receiptSubTotalValue, { color: "#e74c3c" }]}
                  >
                    ₱ {(orderData.deliveryFee ?? 0).toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptTotalLabel}>TOTAL</Text>
                <Text style={styles.receiptTotalValue}>
                  ₱ {total.toFixed(2)}
                </Text>
              </View>
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptSubTotalLabel}>Cash</Text>
                <Text style={styles.receiptSubTotalValue}>
                  ₱ {parseFloat(amountPaid || 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptSubTotalLabel}>Change</Text>
                <Text
                  style={[
                    styles.receiptSubTotalValue,
                    { color: change < 0 ? "#e74c3c" : "#27ae60" },
                  ]}
                >
                  ₱ {change.toFixed(2)}
                </Text>
              </View>

              <View style={styles.receiptDividerDashed} />
              <Text style={styles.receiptThankYou}>
                Thank you for your order! 🙏
              </Text>
              <Text style={styles.receiptFooter}>
                — CESLA MPC Merchandise © 2025 —
              </Text>
            </View>
          </ScrollView>

          {/* Jagged bottom edge */}
          <View style={styles.receiptJaggedBottom}>
            {Array.from({ length: 18 }).map((_, i) => (
              <View key={i} style={styles.receiptJaggedTriangleBottom} />
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.receiptActions}>
            <TouchableOpacity style={styles.receiptCloseBtn} onPress={onClose}>
              <Text style={styles.receiptCloseBtnText}>✕ Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.receiptPrintBtn} onPress={onPrint}>
              <LinearGradient
                colors={["#1a3a6b", "#2c5282"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.receiptPrintBtnGrad}
              >
                <Text style={styles.receiptPrintBtnText}>
                  ⬇️ Download as Image
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── CART PANEL ───────────────────────────────────────────────────────────────
const CartPanel = ({
  cart,
  onAdd,
  onRemove,
  onClear,
  onOrder,
  onPlaceOrder,
  isWide,
  hideTitle,
  lastOrder,
  onShowReceipt,
  orderHistory = [],
}) => {
  const [checked, setChecked] = useState({});
  const [paymentMode, setPaymentMode] = useState("cash");
  const [deliveryType, setDeliveryType] = useState("pickup");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [locPickerVisible, setLocPickerVisible] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState("cart"); // 'cart' | 'placed'
  const pendingCount = orderHistory.filter((o) => {
    const s = o.status || "done";
    return s === "pending" || s === "preparing" || s === "ready";
  }).length;

  // Merchandise store origin coords (update to actual location)
  const MERCH_LAT = 8.4748;
  const MERCH_LNG = 124.6465;
  const DELIVERY_BASE = 15;
  const DELIVERY_PER_KM = 5;

  const getDistanceKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const deliveryFee =
    deliveryType === "deliver" && deliveryCoords
      ? Math.round(
          DELIVERY_BASE +
            getDistanceKm(
              MERCH_LAT,
              MERCH_LNG,
              deliveryCoords.lat,
              deliveryCoords.lng,
            ) *
              DELIVERY_PER_KM,
        )
      : 0;

  const cartItems = Object.values(cart).filter((i) => i.qty > 0);

  // Auto-check new items when added
  useEffect(() => {
    setChecked((prev) => {
      const updated = { ...prev };
      cartItems.forEach(({ item, color, size }) => {
        const k =
          item.id + (color ? "-" + color : "") + (size ? "-" + size : "");
        if (updated[k] === undefined) updated[k] = true;
      });
      return updated;
    });
  }, [
    JSON.stringify(
      cartItems.map((i) => i.item.id + (i.color || "") + (i.size || "")),
    ),
  ]);

  // Reset location when switching to pick up
  useEffect(() => {
    if (deliveryType === "pickup") {
      setDeliveryLocation("");
      setDeliveryCoords(null);
    }
  }, [deliveryType]);

  const toggleCheck = (id) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const checkedItems = cartItems.filter(({ item, color, size }) => {
    const k = item.id + (color ? "-" + color : "") + (size ? "-" + size : "");
    return checked[k];
  });
  const subtotal = checkedItems.reduce(
    (s, { item, qty }) => s + item.price * qty,
    0,
  );
  const total = subtotal + deliveryFee;

  const handlePlaceOrder = () => {
    if (checkedItems.length === 0) return;
    if (deliveryType === "deliver" && !deliveryLocation.trim()) {
      Alert.alert(
        "No delivery location",
        "Please set your delivery location first.",
      );
      setLocPickerVisible(true);
      return;
    }
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
    onPlaceOrder({
      items: checkedItems,
      subtotal,
      deliveryFee,
      total,
      amountPaid: total,
      change: 0,
      orderNo,
      time,
      paymentMode,
      deliveryType,
      deliveryLocation,
    });
  };

  // ── Placed Orders tab date formatter ──────────────────────────────────────
  const fmtDatePanel = (ts) => {
    if (!ts) return "";
    try {
      const d = ts?.toDate?.() || new Date(ts);
      return d.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <>
      <View style={[styles.cartPanel, !isWide && styles.cartPanelMobile]}>
        {/* ── Tab row: Cart | Placed Orders — only shown on wide/desktop panel, not inside CartBottomSheet ── */}
        {!hideTitle && (
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "rgba(1,31,75,0.08)",
              borderRadius: 10,
              padding: 3,
              gap: 3,
              marginBottom: 10,
            }}
          >
            {[
              ["cart", "🛒 Cart"],
              ["placed", "📋 Placed Orders"],
            ].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => setActivePanelTab(key)}
                style={[
                  {
                    flex: 1,
                    paddingVertical: 7,
                    alignItems: "center",
                    borderRadius: 8,
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 5,
                  },
                  activePanelTab === key && {
                    backgroundColor: "#fff",
                    shadowColor: "#000",
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontFamily:
                      activePanelTab === key
                        ? "GoogleSans_700Bold"
                        : "GoogleSans_400Regular",
                    fontSize: 11,
                    color:
                      activePanelTab === key ? "#0f1e35" : "rgba(1,31,75,0.55)",
                  }}
                >
                  {label}
                </Text>
                {key === "placed" && pendingCount > 0 && (
                  <View
                    style={{
                      backgroundColor: "#e74c3c",
                      borderRadius: 10,
                      minWidth: 18,
                      height: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 10,
                        fontFamily: "GoogleSans_700Bold",
                        lineHeight: 12,
                      }}
                    >
                      {pendingCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ══ CART TAB ══ */}
        {activePanelTab === "cart" && (
          <>
            {/* Items list with checkboxes */}
            <View style={styles.cartItemsBox}>
              {cartItems.length === 0 ? (
                <Text style={styles.cartEmpty}>Cart is empty.</Text>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 200 }}
                >
                  {cartItems.map(({ item, qty, color, size }) => {
                    const cartKey =
                      item.id +
                      (color ? "-" + color : "") +
                      (size ? "-" + size : "");
                    const variantLabel = [color, size]
                      .filter(Boolean)
                      .join(" / ");
                    return (
                      <View key={cartKey} style={styles.cartRow}>
                        {/* Checkbox */}
                        <TouchableOpacity
                          style={[
                            styles.checkbox,
                            checked[cartKey] && styles.checkboxChecked,
                          ]}
                          onPress={() => toggleCheck(cartKey)}
                        >
                          {checked[cartKey] && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </TouchableOpacity>
                        <Text style={styles.cartRowEmoji}>{item.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cartRowName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {variantLabel ? (
                            <Text style={styles.cartRowSub}>
                              {variantLabel} · x{qty} ₱{item.price * qty}
                            </Text>
                          ) : (
                            <Text style={styles.cartRowSub}>
                              x{qty} ₱{item.price * qty}
                            </Text>
                          )}
                        </View>
                        <View style={styles.cartRowQty}>
                          <TouchableOpacity
                            style={styles.cartQBtn}
                            onPress={() => onRemove(item, color, size)}
                          >
                            <Text style={styles.cartQBtnText}>−</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.cartQBtn, styles.cartQBtnAdd]}
                            onPress={() => onAdd(item, color, size)}
                          >
                            <Text
                              style={[styles.cartQBtnText, { color: "#fff" }]}
                            >
                              +
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Total — based on checked items only */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal :</Text>
              <Text style={styles.totalValue}>₱ {subtotal.toFixed(2)}</Text>
            </View>
            {deliveryType === "deliver" && (
              <View style={styles.totalRow}>
                <Text
                  style={[
                    styles.totalLabel,
                    {
                      fontSize: 12,
                      color: deliveryCoords ? "#e74c3c" : "rgba(1,31,75,0.45)",
                    },
                  ]}
                >
                  🛵 Delivery Fee{" "}
                  {deliveryCoords
                    ? `(${getDistanceKm(MERCH_LAT, MERCH_LNG, deliveryCoords.lat, deliveryCoords.lng).toFixed(1)} km)`
                    : ""}
                  :
                </Text>
                <Text
                  style={[
                    styles.totalValue,
                    {
                      fontSize: 13,
                      color: deliveryCoords ? "#e74c3c" : "rgba(1,31,75,0.45)",
                    },
                  ]}
                >
                  {deliveryCoords ? `₱ ${deliveryFee.toFixed(2)}` : "—"}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.totalRow,
                {
                  borderTopWidth: 1,
                  borderColor: "rgba(1,31,75,0.12)",
                  paddingTop: 6,
                  marginTop: 2,
                },
              ]}
            >
              <Text style={styles.totalLabel}>Total :</Text>
              <Text style={styles.totalValue}>₱ {total.toFixed(2)}</Text>
            </View>

            {/* Mode of Payment */}
            <View style={styles.paymentModeBox}>
              <Text style={styles.paymentModeLabel}>Mode of Payment</Text>
              <View style={styles.paymentModeRow}>
                {[
                  { key: "cash", label: "💵 Cash" },
                  { key: "gcash", label: "📱 GCash" },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={styles.paymentModeOption}
                    onPress={() => setPaymentMode(p.key)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        paymentMode === p.key && styles.radioOuterActive,
                      ]}
                    >
                      {paymentMode === p.key && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.paymentModeText,
                        paymentMode === p.key && styles.paymentModeTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Order Type (Pick Up / Deliver) ── */}
            <View style={delivStyles.box}>
              <Text style={delivStyles.sectionLabel}>Order Type</Text>
              <View style={delivStyles.toggleRow}>
                <TouchableOpacity
                  style={[
                    delivStyles.toggleBtn,
                    deliveryType === "pickup" && delivStyles.toggleBtnActive,
                  ]}
                  onPress={() => setDeliveryType("pickup")}
                  activeOpacity={0.8}
                >
                  <Text style={delivStyles.toggleIcon}>🏃</Text>
                  <Text
                    style={[
                      delivStyles.toggleTxt,
                      deliveryType === "pickup" && delivStyles.toggleTxtActive,
                    ]}
                  >
                    Pick Up
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    delivStyles.toggleBtn,
                    deliveryType === "deliver" &&
                      delivStyles.toggleBtnActiveDeliver,
                  ]}
                  onPress={() => {
                    setDeliveryType("deliver");
                    setLocPickerVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={delivStyles.toggleIcon}>🛵</Text>
                  <Text
                    style={[
                      delivStyles.toggleTxt,
                      deliveryType === "deliver" &&
                        delivStyles.toggleTxtActiveDeliver,
                    ]}
                  >
                    Deliver
                  </Text>
                </TouchableOpacity>
              </View>
              {deliveryType === "deliver" && (
                <TouchableOpacity
                  style={[
                    delivStyles.mapTrigger,
                    deliveryLocation
                      ? delivStyles.mapTriggerSet
                      : delivStyles.mapTriggerUnset,
                  ]}
                  onPress={() => setLocPickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={delivStyles.mapTriggerPin}>📦</Text>
                  <Text
                    style={[
                      delivStyles.mapTriggerTxt,
                      deliveryLocation && delivStyles.mapTriggerTxtSet,
                    ]}
                    numberOfLines={2}
                  >
                    {deliveryLocation || "Tap to set delivery location…"}
                  </Text>
                  <Text style={delivStyles.mapTriggerChevron}>
                    {deliveryLocation ? "✏️" : "🗺️"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Place Order button ── */}
            <TouchableOpacity
              style={[
                styles.placeOrderBtn,
                checkedItems.length === 0 && styles.placeOrderBtnDisabled,
              ]}
              onPress={handlePlaceOrder}
              activeOpacity={checkedItems.length === 0 ? 1 : 0.8}
            >
              <LinearGradient
                colors={
                  checkedItems.length > 0
                    ? ["#27ae60", "#2ecc71"]
                    : ["#aaa", "#bbb"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.placeOrderGrad}
              >
                <Text style={styles.placeOrderIcon}>✅</Text>
                <Text style={styles.placeOrderText}>
                  Place Order ({checkedItems.length})
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* ── Clear cart button ── */}
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={onClear}
              activeOpacity={0.8}
            >
              <Text style={styles.clearBtnIcon}>🗑️</Text>
              <Text style={styles.clearBtnText}>Clear Cart</Text>
            </TouchableOpacity>

            {/* ── Download Receipt button ── */}
            <TouchableOpacity
              style={[styles.printBtn, !lastOrder && { opacity: 0.45 }]}
              onPress={lastOrder ? onShowReceipt : null}
              activeOpacity={0.8}
            >
              <Text style={styles.printBtnIcon}>⬇️</Text>
              <Text style={styles.printBtnText}>Download Receipt</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ══ PLACED ORDERS TAB ══ */}
        {activePanelTab === "placed" && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            {orderHistory.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 32, marginBottom: 10 }}>📋</Text>
                <Text
                  style={{
                    fontFamily: "GoogleSans_400Regular",
                    fontSize: 12,
                    color: "rgba(1,31,75,0.45)",
                    textAlign: "center",
                  }}
                >
                  No placed orders yet.
                </Text>
              </View>
            ) : (
              orderHistory.map((order, idx) => {
                const items = order.items || [];
                const total = order.total || 0;
                const pm =
                  order.payment ||
                  order.paymentMode ||
                  order.paymentMethod ||
                  "cash";
                const pmBg =
                  pm === "gcash" || pm === "GCash"
                    ? "rgba(111,163,247,0.20)"
                    : "rgba(46,204,113,0.20)";
                const pmBorder =
                  pm === "gcash" || pm === "GCash"
                    ? "rgba(111,163,247,0.55)"
                    : "rgba(46,204,113,0.55)";
                const status = order.status || "done";
                const statusConfig = {
                  pending: {
                    label: "Order Placed",
                    icon: "🕐",
                    color: "#95a5a6",
                    bg: "rgba(149,165,166,0.15)",
                    border: "rgba(149,165,166,0.35)",
                  },
                  preparing: {
                    label: "Preparing",
                    icon: "🔥",
                    color: "#e67e22",
                    bg: "rgba(230,126,34,0.15)",
                    border: "rgba(230,126,34,0.40)",
                  },
                  ready: {
                    label: "Ready for Pick Up",
                    icon: "✅",
                    color: "#27ae60",
                    bg: "rgba(39,174,96,0.15)",
                    border: "rgba(39,174,96,0.40)",
                  },
                  done: {
                    label: "Completed",
                    icon: "🎉",
                    color: "#2980b9",
                    bg: "rgba(41,128,185,0.12)",
                    border: "rgba(41,128,185,0.30)",
                  },
                };
                const stCfg = statusConfig[status] || statusConfig.done;
                const isActive =
                  status === "pending" ||
                  status === "preparing" ||
                  status === "ready";
                const STEPS = ["pending", "preparing", "ready"];
                const stepIdx = STEPS.indexOf(status);
                const stepLabels = {
                  pending: "Placed",
                  preparing: "Preparing",
                  ready: "Ready",
                };
                return (
                  <View
                    key={order.docId || idx}
                    style={{
                      backgroundColor: isActive
                        ? "rgba(255,255,255,0.62)"
                        : "rgba(255,255,255,0.38)",
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 8,
                      borderWidth: isActive ? 2 : 1.5,
                      borderColor: isActive
                        ? stCfg.border
                        : "rgba(255,255,255,0.70)",
                      shadowColor: isActive ? stCfg.color : "transparent",
                      shadowOpacity: isActive ? 0.15 : 0,
                      shadowRadius: 6,
                      elevation: isActive ? 3 : 0,
                    }}
                  >
                    {/* Header: order# + date + status badge */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 6,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: "GoogleSans_700Bold",
                            fontSize: 12,
                            color: "#0f1e35",
                          }}
                        >
                          #{order.orderNo || "—"}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "GoogleSans_400Regular",
                            fontSize: 9,
                            color: "rgba(1,31,75,0.50)",
                            marginTop: 1,
                          }}
                        >
                          {fmtDatePanel(order.createdAt || order.time)}
                        </Text>
                      </View>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 16,
                          backgroundColor: stCfg.bg,
                          borderWidth: 1,
                          borderColor: stCfg.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Text style={{ fontSize: 10 }}>{stCfg.icon}</Text>
                        <Text
                          style={{
                            fontFamily: "GoogleSans_700Bold",
                            fontSize: 9,
                            color: stCfg.color,
                            letterSpacing: 0.3,
                          }}
                        >
                          {stCfg.label}
                        </Text>
                      </View>
                    </View>
                    {/* Queue progress tracker — only for active orders */}
                    {isActive && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 8,
                          paddingHorizontal: 2,
                        }}
                      >
                        {STEPS.map((step, i) => {
                          const sCfg = statusConfig[step];
                          const isDone = i < stepIdx;
                          const isNow = i === stepIdx;
                          return (
                            <React.Fragment key={step}>
                              <View style={{ alignItems: "center", gap: 2 }}>
                                <View
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: isDone
                                      ? "#27ae60"
                                      : isNow
                                        ? stCfg.color
                                        : "rgba(1,31,75,0.10)",
                                    borderWidth: 2,
                                    borderColor: isDone
                                      ? "#27ae60"
                                      : isNow
                                        ? stCfg.color
                                        : "rgba(1,31,75,0.15)",
                                    justifyContent: "center",
                                    alignItems: "center",
                                  }}
                                >
                                  <Text style={{ fontSize: 10 }}>
                                    {isDone ? "✓" : sCfg.icon}
                                  </Text>
                                </View>
                                <Text
                                  style={{
                                    fontFamily: isNow
                                      ? "GoogleSans_700Bold"
                                      : "GoogleSans_400Regular",
                                    fontSize: 7,
                                    color: isNow
                                      ? stCfg.color
                                      : "rgba(1,31,75,0.40)",
                                    textAlign: "center",
                                    maxWidth: 38,
                                  }}
                                >
                                  {stepLabels[step]}
                                </Text>
                              </View>
                              {i < STEPS.length - 1 && (
                                <View
                                  style={{
                                    flex: 1,
                                    height: 2,
                                    backgroundColor: isDone
                                      ? "#27ae60"
                                      : "rgba(1,31,75,0.12)",
                                    marginHorizontal: 2,
                                    marginBottom: 12,
                                  }}
                                />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </View>
                    )}
                    {/* Payment + delivery badges */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 6,
                        gap: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 10,
                          backgroundColor: pmBg,
                          borderWidth: 1,
                          borderColor: pmBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "GoogleSans_700Bold",
                            fontSize: 8,
                            color: "#0f1e35",
                            letterSpacing: 0.6,
                            textTransform: "uppercase",
                          }}
                        >
                          {pm}
                        </Text>
                      </View>
                      {order.deliveryType === "deliver" && (
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 10,
                            backgroundColor: "rgba(231,76,60,0.12)",
                            borderWidth: 1,
                            borderColor: "rgba(231,76,60,0.35)",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "GoogleSans_700Bold",
                              fontSize: 8,
                              color: "#c0392b",
                            }}
                          >
                            🛵 Delivery
                          </Text>
                        </View>
                      )}
                    </View>
                    {/* Items */}
                    <View
                      style={{
                        marginBottom: 6,
                        paddingBottom: 6,
                        borderBottomWidth: 1,
                        borderColor: "rgba(1,31,75,0.07)",
                      }}
                    >
                      {items.map((it, j) => {
                        const item = it.item || it;
                        const qty = it.qty || it.quantity || 1;
                        return (
                          <Text
                            key={j}
                            style={{
                              fontFamily: "GoogleSans_400Regular",
                              fontSize: 11,
                              color: "#0f1e35",
                              marginBottom: 2,
                              lineHeight: 16,
                            }}
                            numberOfLines={1}
                          >
                            {item.emoji || "🛍️"} {item.name} x{qty} — ₱
                            {(item.price * qty).toFixed(2)}
                          </Text>
                        );
                      })}
                    </View>
                    <Text
                      style={{
                        fontFamily: "GoogleSans_700Bold",
                        fontSize: 12,
                        color: "#c9a84c",
                      }}
                    >
                      Total: ₱{Number(total).toFixed(2)}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      {/* Location Picker Modal */}
      <LocationPickerModal
        visible={locPickerVisible}
        onClose={() => setLocPickerVisible(false)}
        onConfirm={({ address, coords }) => {
          setDeliveryLocation(address);
          setDeliveryCoords(coords);
        }}
        deliveryType={deliveryType}
      />
    </>
  );
};

// ─── BOTTOM SHEET CART (Mobile) ───────────────────────────────────────────────
const CartBottomSheet = ({
  cart,
  onAdd,
  onRemove,
  onClear,
  onOrder,
  onClose,
  onPlaceOrder,
  lastOrder,
  onShowReceipt,
  orderHistory = [],
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [activeSheetTab, setActiveSheetTab] = useState("cart");
  const pendingCount = orderHistory.filter((o) => {
    const s = o.status || "done";
    return s === "pending" || s === "preparing" || s === "ready";
  }).length;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const fmtDate = (ts) => {
    if (!ts) return "";
    try {
      const d = ts?.toDate?.() || new Date(ts);
      return d.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <View style={styles.sheetOverlay}>
      <TouchableOpacity
        style={styles.sheetBackdrop}
        onPress={onClose}
        activeOpacity={1}
      />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.sheetHandle} />
        {/* Tab row: Cart | Placed Orders */}
        <View style={styles.sheetHeader}>
          <View
            style={{
              flexDirection: "row",
              flex: 1,
              backgroundColor: "rgba(1,31,75,0.08)",
              borderRadius: 10,
              padding: 3,
              gap: 3,
            }}
          >
            {[
              ["cart", "🛒 Cart"],
              ["placed", "📋 Placed Orders"],
            ].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => setActiveSheetTab(key)}
                style={[
                  {
                    flex: 1,
                    paddingVertical: 7,
                    alignItems: "center",
                    borderRadius: 8,
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 5,
                  },
                  activeSheetTab === key && {
                    backgroundColor: "#fff",
                    shadowColor: "#000",
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily:
                      activeSheetTab === key
                        ? "GoogleSans_700Bold"
                        : "GoogleSans_400Regular",
                    fontSize: 12,
                    color:
                      activeSheetTab === key ? "#0f1e35" : "rgba(1,31,75,0.55)",
                  }}
                >
                  {label}
                </Text>
                {key === "placed" && pendingCount > 0 && (
                  <View
                    style={{
                      backgroundColor: "#e74c3c",
                      borderRadius: 10,
                      minWidth: 18,
                      height: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 10,
                        fontFamily: "GoogleSans_700Bold",
                        lineHeight: 12,
                      }}
                    >
                      {pendingCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
            <Text style={{ color: "rgba(1,31,75,0.6)", fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab content */}
        {activeSheetTab === "cart" ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <CartPanel
              cart={cart}
              onAdd={onAdd}
              onRemove={onRemove}
              onClear={onClear}
              onOrder={onOrder}
              isWide={false}
              hideTitle={true}
              onPlaceOrder={onPlaceOrder}
              lastOrder={lastOrder}
              onShowReceipt={onShowReceipt}
              orderHistory={orderHistory}
            />
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 14, flexGrow: 1 }}
          >
            {orderHistory.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 36, marginBottom: 10 }}>📋</Text>
                <Text
                  style={{
                    fontFamily: "GoogleSans_400Regular",
                    fontSize: 13,
                    color: "rgba(1,31,75,0.45)",
                    textAlign: "center",
                  }}
                >
                  No placed orders yet.
                </Text>
              </View>
            ) : (
              orderHistory.map((order, idx) => {
                const items = order.items || [];
                const total = order.total || 0;
                const pm =
                  order.payment ||
                  order.paymentMode ||
                  order.paymentMethod ||
                  "cash";
                const pmBg =
                  pm === "gcash" || pm === "GCash"
                    ? "rgba(111,163,247,0.20)"
                    : "rgba(46,204,113,0.20)";
                const pmBorder =
                  pm === "gcash" || pm === "GCash"
                    ? "rgba(111,163,247,0.55)"
                    : "rgba(46,204,113,0.55)";
                const status = order.status || "done";
                const statusConfig = {
                  pending: {
                    label: "Order Placed",
                    icon: "🕐",
                    color: "#95a5a6",
                    bg: "rgba(149,165,166,0.15)",
                    border: "rgba(149,165,166,0.35)",
                  },
                  preparing: {
                    label: "Preparing",
                    icon: "🔥",
                    color: "#e67e22",
                    bg: "rgba(230,126,34,0.15)",
                    border: "rgba(230,126,34,0.40)",
                  },
                  ready: {
                    label: "Ready for Pick Up",
                    icon: "✅",
                    color: "#27ae60",
                    bg: "rgba(39,174,96,0.15)",
                    border: "rgba(39,174,96,0.40)",
                  },
                  done: {
                    label: "Completed",
                    icon: "🎉",
                    color: "#2980b9",
                    bg: "rgba(41,128,185,0.12)",
                    border: "rgba(41,128,185,0.30)",
                  },
                };
                const stCfg = statusConfig[status] || statusConfig.done;
                const isActive =
                  status === "pending" ||
                  status === "preparing" ||
                  status === "ready";
                const STEPS = ["pending", "preparing", "ready"];
                const stepIdx = STEPS.indexOf(status);
                const stepLabels = {
                  pending: "Placed",
                  preparing: "Preparing",
                  ready: "Ready",
                };
                return (
                  <View
                    key={order.docId || idx}
                    style={{
                      backgroundColor: isActive
                        ? "rgba(255,255,255,0.62)"
                        : "rgba(255,255,255,0.38)",
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: isActive ? 2 : 1.5,
                      borderColor: isActive
                        ? stCfg.border
                        : "rgba(255,255,255,0.70)",
                      shadowColor: isActive ? stCfg.color : "transparent",
                      shadowOpacity: isActive ? 0.15 : 0,
                      shadowRadius: 8,
                      elevation: isActive ? 3 : 0,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: "GoogleSans_700Bold",
                            fontSize: 13,
                            color: "#0f1e35",
                          }}
                        >
                          #{order.orderNo || order.orderId || "—"}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "GoogleSans_400Regular",
                            fontSize: 10,
                            color: "rgba(1,31,75,0.50)",
                            marginTop: 2,
                          }}
                        >
                          {fmtDate(order.createdAt || order.time)}
                        </Text>
                      </View>
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 20,
                          backgroundColor: stCfg.bg,
                          borderWidth: 1,
                          borderColor: stCfg.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontSize: 11 }}>{stCfg.icon}</Text>
                        <Text
                          style={{
                            fontFamily: "GoogleSans_700Bold",
                            fontSize: 10,
                            color: stCfg.color,
                            letterSpacing: 0.4,
                          }}
                        >
                          {stCfg.label}
                        </Text>
                      </View>
                    </View>
                    {isActive && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 10,
                          paddingHorizontal: 4,
                        }}
                      >
                        {STEPS.map((step, i) => {
                          const sCfg = statusConfig[step];
                          const isDone = i < stepIdx;
                          const isNow = i === stepIdx;
                          return (
                            <React.Fragment key={step}>
                              <View style={{ alignItems: "center", gap: 2 }}>
                                <View
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    backgroundColor: isDone
                                      ? "#27ae60"
                                      : isNow
                                        ? stCfg.color
                                        : "rgba(1,31,75,0.10)",
                                    borderWidth: 2,
                                    borderColor: isDone
                                      ? "#27ae60"
                                      : isNow
                                        ? stCfg.color
                                        : "rgba(1,31,75,0.15)",
                                    justifyContent: "center",
                                    alignItems: "center",
                                  }}
                                >
                                  <Text style={{ fontSize: 12 }}>
                                    {isDone ? "✓" : sCfg.icon}
                                  </Text>
                                </View>
                                <Text
                                  style={{
                                    fontFamily: isNow
                                      ? "GoogleSans_700Bold"
                                      : "GoogleSans_400Regular",
                                    fontSize: 8,
                                    color: isNow
                                      ? stCfg.color
                                      : "rgba(1,31,75,0.40)",
                                    textAlign: "center",
                                    maxWidth: 44,
                                  }}
                                >
                                  {stepLabels[step]}
                                </Text>
                              </View>
                              {i < STEPS.length - 1 && (
                                <View
                                  style={{
                                    flex: 1,
                                    height: 2,
                                    backgroundColor: isDone
                                      ? "#27ae60"
                                      : "rgba(1,31,75,0.12)",
                                    marginHorizontal: 3,
                                    marginBottom: 14,
                                  }}
                                />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </View>
                    )}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 6,
                        gap: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 10,
                          backgroundColor: pmBg,
                          borderWidth: 1,
                          borderColor: pmBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "GoogleSans_700Bold",
                            fontSize: 8,
                            color: "#0f1e35",
                            letterSpacing: 0.6,
                            textTransform: "uppercase",
                          }}
                        >
                          {pm}
                        </Text>
                      </View>
                      {order.deliveryType === "deliver" && (
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 10,
                            backgroundColor: "rgba(231,76,60,0.12)",
                            borderWidth: 1,
                            borderColor: "rgba(231,76,60,0.35)",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "GoogleSans_700Bold",
                              fontSize: 8,
                              color: "#c0392b",
                            }}
                          >
                            🛵 Delivery
                          </Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={{
                        marginBottom: 6,
                        paddingBottom: 6,
                        borderBottomWidth: 1,
                        borderColor: "rgba(1,31,75,0.07)",
                      }}
                    >
                      {items.map((it, j) => {
                        const item = it.item || it;
                        const qty = it.qty || it.quantity || 1;
                        return (
                          <Text
                            key={j}
                            style={{
                              fontFamily: "GoogleSans_400Regular",
                              fontSize: 11,
                              color: "#0f1e35",
                              marginBottom: 2,
                              lineHeight: 16,
                            }}
                            numberOfLines={1}
                          >
                            {item.emoji || "🛍️"} {item.name} x{qty} — ₱
                            {(item.price * qty).toFixed(2)}
                          </Text>
                        );
                      })}
                    </View>
                    <Text
                      style={{
                        fontFamily: "GoogleSans_700Bold",
                        fontSize: 12,
                        color: "#c9a84c",
                      }}
                    >
                      Total: ₱{Number(total).toFixed(2)}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
// ─── AD BANNER — dots inside card, hide/show on mobile scroll ────────────────

// ─── HISTORY TAB CONTENT (shared by Member + Visitor screens) ─────────────────
const HistoryTabContent = ({
  orderHistory,
  isWide,
  showStatus = true,
  onShopNow,
}) => {
  const [sortBy, setSortBy] = useState(null); // null | 'payment' | 'status'
  const [sortDropOpen, setSortDropOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearDropOpen, setYearDropOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState("daily"); // 'daily' | 'monthly' | 'yearly'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0–11

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
  const MONTH_FULL = [
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

  const toDate = (ts) => {
    try {
      if (!ts) return null;
      if (ts?.toDate) return ts.toDate();
      if (typeof ts === "number") return new Date(ts);
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  const fmtDate = (ts) => {
    const d = toDate(ts);
    if (!d) return "—";
    return d.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const fmtTime = (ts) => {
    const d = toDate(ts);
    if (!d) return "";
    return d.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const pmInfo = (pm) => {
    const n = (pm === "credits" ? "credit" : pm || "cash").toLowerCase();
    if (n === "gcash") return { label: "GCash", color: "#3498db" };
    if (n === "credit") return { label: "Credit", color: "#c9a84c" };
    return { label: "Cash", color: "#27ae60" };
  };

  const stInfo = (status) => {
    switch (status) {
      case "done":
        return { label: "Completed", color: "#27ae60" };
      case "ready":
        return { label: "Ready", color: "#2980b9" };
      case "preparing":
        return { label: "Preparing", color: "#e67e22" };
      default:
        return { label: "Pending", color: "#95a5a6" };
    }
  };

  // Available years: always 2025–2070
  const availableYears = React.useMemo(() => {
    const years = [];
    for (let y = 2070; y >= 2000; y--) years.push(y);
    return years;
  }, []);

  // Sorted orders
  const sortedOrders = React.useMemo(() => {
    const arr = [...orderHistory];
    if (sortBy === "payment") {
      arr.sort((a, b) => {
        const pa = (a.payment || a.paymentMode || "cash").toLowerCase();
        const pb = (b.payment || b.paymentMode || "cash").toLowerCase();
        return pa.localeCompare(pb);
      });
    } else if (sortBy === "status") {
      const ORD = { pending: 0, preparing: 1, ready: 2, done: 3 };
      arr.sort((a, b) => (ORD[a.status] ?? 99) - (ORD[b.status] ?? 99));
    } else {
      arr.sort((a, b) => {
        const ta = toDate(a.createdAt)?.getTime() || 0;
        const tb = toDate(b.createdAt)?.getTime() || 0;
        return tb - ta;
      });
    }
    return arr;
  }, [orderHistory, sortBy]);

  // Flat rows (one per item per order)
  const tableRows = React.useMemo(() => {
    const rows = [];
    sortedOrders.forEach((order) => {
      const items = order.items || [];
      const pm = pmInfo(order.payment || order.paymentMode);
      const st = stInfo(order.status);
      if (items.length === 0) {
        rows.push({ order, item: null, itemIdx: 0, totalItems: 0, pm, st });
      } else {
        items.forEach((it, idx) => {
          rows.push({
            order,
            item: it,
            itemIdx: idx,
            totalItems: items.length,
            pm,
            st,
          });
        });
      }
    });
    return rows;
  }, [sortedOrders]);

  // Report data
  const reportData = React.useMemo(() => {
    if (reportPeriod === "yearly") {
      const map = {};
      orderHistory.forEach((o) => {
        const d = toDate(o.createdAt);
        if (!d) return;
        const yr = d.getFullYear();
        if (!map[yr]) map[yr] = { label: String(yr), count: 0, total: 0 };
        map[yr].count++;
        map[yr].total += Number(o.total || 0);
      });
      return Object.values(map).sort((a, b) => b.label - a.label);
    }
    const yearOrders = orderHistory.filter((o) => {
      const d = toDate(o.createdAt);
      return d && d.getFullYear() === selectedYear;
    });
    if (reportPeriod === "monthly") {
      const map = {};
      for (let m = 0; m < 12; m++)
        map[m] = { label: MONTHS[m], count: 0, total: 0 };
      yearOrders.forEach((o) => {
        const d = toDate(o.createdAt);
        if (!d) return;
        const m = d.getMonth();
        map[m].count++;
        map[m].total += Number(o.total || 0);
      });
      return Object.values(map);
    }
    // Daily
    const map = {};
    yearOrders
      .filter((o) => {
        const d = toDate(o.createdAt);
        return d && d.getMonth() === selectedMonth;
      })
      .forEach((o) => {
        const d = toDate(o.createdAt);
        const day = d.getDate();
        if (!map[day])
          map[day] = {
            label: String(day).padStart(2, "0"),
            count: 0,
            total: 0,
          };
        map[day].count++;
        map[day].total += Number(o.total || 0);
      });
    return Object.values(map).sort((a, b) => Number(a.label) - Number(b.label));
  }, [orderHistory, reportPeriod, selectedYear, selectedMonth]);

  const totalRevenue = reportData.reduce((s, r) => s + r.total, 0);
  const totalCount = reportData.reduce((s, r) => s + r.count, 0);

  const closeDrop = () => {
    setSortDropOpen(false);
    setYearDropOpen(false);
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={closeDrop} style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          flexDirection: isWide ? "row" : "column",
          gap: 10,
          paddingHorizontal: isWide ? 16 : 8,
          paddingTop: isWide ? 8 : 6,
          paddingBottom: isWide ? 16 : 8,
          minHeight: 0,
        }}
      >
        {/* ══════════════ LEFT — MY ORDER HISTORY ══════════════ */}
        <View style={[histStyles.panel, { flex: isWide ? 3 : 1 }]}>
          {/* Panel header row */}
          <View style={histStyles.panelHeaderRow}>
            <Text style={histStyles.panelTitle}>📋 MY ORDER HISTORY</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {/* Order count badge */}
              <View style={histStyles.countBadge}>
                <Text style={histStyles.countBadgeText}>
                  {orderHistory.length} ORDER
                  {orderHistory.length !== 1 ? "S" : ""}
                </Text>
              </View>

              {/* Sort By dropdown trigger */}
              <View style={{ position: "relative", zIndex: 9999 }}>
                <TouchableOpacity
                  style={histStyles.sortBtn}
                  onPress={() => {
                    setSortDropOpen((v) => !v);
                    setYearDropOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="sort"
                    size={12}
                    color="rgba(1,31,75,0.65)"
                  />
                  <Text style={histStyles.sortBtnText}>
                    Sort by
                    {sortBy
                      ? ": " + (sortBy === "payment" ? "Payment" : "Status")
                      : ""}
                  </Text>
                  <MaterialIcons
                    name={
                      sortDropOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"
                    }
                    size={13}
                    color="rgba(1,31,75,0.55)"
                  />
                </TouchableOpacity>
                {sortDropOpen && (
                  <View style={histStyles.sortDropdown}>
                    {[
                      { key: "payment", label: "💳  Payment" },
                      { key: "status", label: "📌  Status" },
                      { key: null, label: "🕐  Date (default)" },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={String(opt.key)}
                        style={[
                          histStyles.sortDropItem,
                          sortBy === opt.key && histStyles.sortDropItemActive,
                        ]}
                        onPress={() => {
                          setSortBy(opt.key);
                          setSortDropOpen(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            histStyles.sortDropItemText,
                            sortBy === opt.key && {
                              color: "#1a3a6b",
                              fontFamily: "GoogleSans_700Bold",
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Table or empty state */}
          {orderHistory.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 40,
              }}
            >
              <Text style={{ fontSize: 40, marginBottom: 10 }}>📋</Text>
              <Text style={histStyles.emptyTitle}>No orders yet</Text>
              <Text style={histStyles.emptySubtitle}>
                Your merchandise orders will appear here.
              </Text>
              {onShopNow && (
                <TouchableOpacity
                  onPress={onShopNow}
                  style={histStyles.shopNowBtn}
                >
                  <Text style={histStyles.shopNowText}>Shop Now →</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View
              style={{
                flex: 1,
                minHeight: 0,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(200,218,235,0.80)",
                overflow: "hidden",
              }}
            >
              {/* Outer scroll: vertical for rows */}
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                {...(Platform.OS === "web"
                  ? {
                      style: {
                        flex: 1,
                        overflowY: "auto",
                        overflowX: "hidden",
                      },
                    }
                  : {})}
              >
                {/* Web: plain View fills panel width. Mobile: horizontal ScrollView for overflow. */}
                {(Platform.OS === "web"
                  ? (c) => c
                  : (c) => (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator
                        nestedScrollEnabled={false}
                      >
                        {c}
                      </ScrollView>
                    ))(
                  <View
                    style={{
                      flexDirection: "column",
                      ...(Platform.OS === "web"
                        ? { flex: 1 }
                        : { minWidth: showStatus ? 564 : 508 }),
                    }}
                  >
                    {/* Thead — sticky on web */}
                    <View
                      style={{
                        backgroundColor: "rgba(220,232,242,0.97)",
                        borderBottomWidth: 1.5,
                        borderBottomColor: "rgba(180,205,225,0.90)",
                        ...(Platform.OS === "web"
                          ? { position: "sticky", top: 0, zIndex: 10 }
                          : {}),
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 8,
                        }}
                      >
                        <View style={[histStyles.thCell, { width: 80 }]}>
                          <Text style={histStyles.thTxt}>DATE</Text>
                        </View>
                        <View style={histStyles.thDiv} />
                        <View style={[histStyles.thCell, { width: 56 }]}>
                          <Text style={histStyles.thTxt}>ORDER #</Text>
                        </View>
                        <View style={histStyles.thDiv} />
                        <View
                          style={[
                            histStyles.thCell,
                            Platform.OS === "web"
                              ? { flex: 1 }
                              : { width: 120 },
                          ]}
                        >
                          <Text style={histStyles.thTxt}>ITEM NAME</Text>
                        </View>
                        <View style={histStyles.thDiv} />
                        <View style={[histStyles.thCell, { width: 28 }]}>
                          <Text
                            style={[histStyles.thTxt, { textAlign: "center" }]}
                          >
                            QTY
                          </Text>
                        </View>
                        <View style={histStyles.thDiv} />
                        <View style={[histStyles.thCell, { width: 36 }]}>
                          <Text
                            style={[histStyles.thTxt, { textAlign: "center" }]}
                          >
                            SIZE
                          </Text>
                        </View>
                        <View style={histStyles.thDiv} />
                        <View style={[histStyles.thCell, { width: 50 }]}>
                          <Text
                            style={[histStyles.thTxt, { textAlign: "center" }]}
                          >
                            COLOR
                          </Text>
                        </View>
                        <View style={histStyles.thDiv} />
                        <View style={[histStyles.thCell, { width: 56 }]}>
                          <Text
                            style={[histStyles.thTxt, { textAlign: "center" }]}
                          >
                            CHAR
                          </Text>
                        </View>
                        <View style={histStyles.thDiv} />
                        <View style={[histStyles.thCell, { width: 50 }]}>
                          <Text
                            style={[histStyles.thTxt, { textAlign: "center" }]}
                          >
                            PMT
                          </Text>
                        </View>
                        <View style={histStyles.thDiv} />
                        <View style={[histStyles.thCell, { width: 66 }]}>
                          <Text
                            style={[histStyles.thTxt, { textAlign: "center" }]}
                          >
                            TOTAL
                          </Text>
                        </View>
                        {showStatus && (
                          <>
                            <View style={histStyles.thDiv} />
                            <View style={[histStyles.thCell, { width: 66 }]}>
                              <Text
                                style={[
                                  histStyles.thTxt,
                                  { textAlign: "center" },
                                ]}
                              >
                                STATUS
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    </View>

                    {/* Body rows */}
                    {tableRows.map((row, idx) => {
                      const { order, item, itemIdx, totalItems, pm, st } = row;
                      const isFirst = itemIdx === 0;
                      const isLastOfOrder =
                        itemIdx === totalItems - 1 || totalItems === 0;
                      const isEvenOrder = sortedOrders.indexOf(order) % 2 === 0;

                      const itemObj = item?.item || item || null;
                      const itemName = itemObj?.name || item?.name || "—";
                      const qty =
                        item?.qty ||
                        item?.quantity ||
                        (totalItems === 0 ? "—" : 1);
                      const size = item?.size || itemObj?.size || null;
                      const color = item?.color || itemObj?.color || null;
                      const character =
                        item?.character || itemObj?.character || null;

                      return (
                        <View
                          key={`${order.docId || idx}-${itemIdx}`}
                          style={[
                            histStyles.tdRow,
                            isEvenOrder && histStyles.tdRowEven,
                            isLastOfOrder && {
                              borderBottomWidth: 1.5,
                              borderBottomColor: "rgba(180,205,225,0.70)",
                            },
                          ]}
                        >
                          {/* DATE */}
                          <View style={[histStyles.tdCell, { width: 80 }]}>
                            {isFirst && (
                              <Text style={histStyles.tdDate}>
                                {fmtDate(order.createdAt)}
                              </Text>
                            )}
                            {isFirst && (
                              <Text style={histStyles.tdTime}>
                                {fmtTime(order.createdAt)}
                              </Text>
                            )}
                          </View>
                          {/* ORDER # */}
                          <View style={[histStyles.tdCell, { width: 56 }]}>
                            {isFirst && (
                              <Text style={histStyles.tdOrderNo}>
                                #{order.orderNo || "—"}
                              </Text>
                            )}
                          </View>
                          {/* ITEM NAME */}
                          <View
                            style={[
                              histStyles.tdCell,
                              Platform.OS === "web"
                                ? { flex: 1 }
                                : { width: 120 },
                            ]}
                          >
                            <Text style={histStyles.tdItem} numberOfLines={2}>
                              {itemName}
                            </Text>
                          </View>
                          {/* QTY */}
                          <View
                            style={[
                              histStyles.tdCell,
                              { width: 28, alignItems: "center" },
                            ]}
                          >
                            <Text style={histStyles.tdQty}>{qty}</Text>
                          </View>
                          {/* SIZE */}
                          <View
                            style={[
                              histStyles.tdCell,
                              { width: 36, alignItems: "center" },
                            ]}
                          >
                            <Text
                              style={[
                                histStyles.tdVariant,
                                !size && histStyles.tdNone,
                              ]}
                            >
                              {size || "None"}
                            </Text>
                          </View>
                          {/* COLOR */}
                          <View
                            style={[
                              histStyles.tdCell,
                              { width: 50, alignItems: "center" },
                            ]}
                          >
                            <Text
                              style={[
                                histStyles.tdVariant,
                                !color && histStyles.tdNone,
                              ]}
                            >
                              {color || "None"}
                            </Text>
                          </View>
                          {/* CHARACTER */}
                          <View
                            style={[
                              histStyles.tdCell,
                              { width: 56, alignItems: "center" },
                            ]}
                          >
                            <Text
                              style={[
                                histStyles.tdVariant,
                                !character && histStyles.tdNone,
                              ]}
                            >
                              {character || "None"}
                            </Text>
                          </View>
                          {/* PAYMENT */}
                          <View
                            style={[
                              histStyles.tdCell,
                              { width: 50, alignItems: "center" },
                            ]}
                          >
                            {isFirst && (
                              <Text
                                style={[histStyles.tdPm, { color: pm.color }]}
                              >
                                {pm.label}
                              </Text>
                            )}
                          </View>
                          {/* TOTAL */}
                          <View
                            style={[
                              histStyles.tdCell,
                              { width: 66, alignItems: "center" },
                            ]}
                          >
                            {isFirst && (
                              <Text style={histStyles.tdTotal}>
                                ₱{Number(order.total || 0).toFixed(2)}
                              </Text>
                            )}
                          </View>
                          {/* STATUS */}
                          {showStatus && (
                            <View
                              style={[
                                histStyles.tdCell,
                                { width: 66, alignItems: "center" },
                              ]}
                            >
                              {isFirst && (
                                <Text
                                  style={[
                                    histStyles.tdStatus,
                                    { color: st.color },
                                  ]}
                                >
                                  {st.label}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>,
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* ══════════════ RIGHT — ANNUAL HISTORY REPORTS ══════════════ */}
        <View style={[histStyles.panel, { zIndex: 100, flex: 2 }]}>
          {/* Panel header */}
          <Text style={[histStyles.panelTitle, { marginBottom: 10 }]}>
            📊 ANNUAL HISTORY REPORTS
          </Text>

          {/* Year selector */}
          <View
            style={{
              position: "relative",
              zIndex: 9999,
              marginBottom: 10,
              alignSelf: "flex-start",
            }}
          >
            <TouchableOpacity
              style={histStyles.yearBtn}
              onPress={() => {
                setYearDropOpen((v) => !v);
                setSortDropOpen(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={histStyles.yearBtnText}>YEAR {selectedYear}</Text>
              <MaterialIcons
                name={
                  yearDropOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"
                }
                size={16}
                color="#0f1e35"
              />
            </TouchableOpacity>
            {yearDropOpen && (
              <View style={histStyles.yearDropdown}>
                <ScrollView
                  style={{ maxHeight: 220 }}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {availableYears.map((yr) => (
                    <TouchableOpacity
                      key={yr}
                      style={[
                        histStyles.yearDropItem,
                        yr === selectedYear && histStyles.yearDropItemActive,
                      ]}
                      onPress={() => {
                        setSelectedYear(yr);
                        setYearDropOpen(false);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          histStyles.yearDropItemText,
                          yr === selectedYear && {
                            color: "#fff",
                            fontFamily: "GoogleSans_700Bold",
                          },
                        ]}
                      >
                        {yr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Period tabs: Daily | Monthly | Yearly */}
          <View style={histStyles.periodRow}>
            {["daily", "monthly", "yearly"].map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  histStyles.periodTab,
                  reportPeriod === p && histStyles.periodTabActive,
                ]}
                onPress={() => setReportPeriod(p)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    histStyles.periodTabTxt,
                    reportPeriod === p && histStyles.periodTabTxtActive,
                  ]}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Month pills (Daily only) */}
          {reportPeriod === "daily" && (
            <View
              style={{
                height: 30,
                marginTop: 6,
                ...(Platform.OS === "web" ? { overflowX: "auto" } : {}),
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{
                  gap: 5,
                  paddingHorizontal: 2,
                  alignItems: "center",
                }}
                scrollEnabled={Platform.OS !== "web"}
              >
                {MONTHS.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      histStyles.monthPill,
                      selectedMonth === i && histStyles.monthPillActive,
                    ]}
                    onPress={() => setSelectedMonth(i)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        histStyles.monthPillTxt,
                        selectedMonth === i && histStyles.monthPillTxtActive,
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Summary cards */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <View style={histStyles.sumCard}>
              <Text style={histStyles.sumCardLabel}>Total Orders</Text>
              <Text style={histStyles.sumCardValue}>{totalCount}</Text>
            </View>
            <View style={histStyles.sumCard}>
              <Text style={histStyles.sumCardLabel}>Total Revenue</Text>
              <Text style={[histStyles.sumCardValue, { fontSize: 14 }]}>
                ₱{totalRevenue.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Report table */}
          <ScrollView
            showsVerticalScrollIndicator
            style={{ flex: 1, marginTop: 10 }}
            nestedScrollEnabled
          >
            {reportData.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Text style={{ fontSize: 30, marginBottom: 8 }}>📊</Text>
                <Text style={histStyles.emptyTitle}>
                  No data for this period
                </Text>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.50)",
                  borderRadius: 10,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "rgba(200,218,235,0.70)",
                }}
              >
                {/* Report header */}
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: "rgba(220,232,242,0.95)",
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(180,205,225,0.70)",
                  }}
                >
                  <Text style={[histStyles.thTxt, { flex: 1 }]}>
                    {reportPeriod === "daily"
                      ? `${MONTHS[selectedMonth].toUpperCase()} — DAY`
                      : reportPeriod === "monthly"
                        ? "MONTH"
                        : "YEAR"}
                  </Text>
                  <Text
                    style={[
                      histStyles.thTxt,
                      { width: 58, textAlign: "center" },
                    ]}
                  >
                    ORDERS
                  </Text>
                  <Text
                    style={[
                      histStyles.thTxt,
                      { width: 90, textAlign: "right" },
                    ]}
                  >
                    REVENUE
                  </Text>
                </View>
                {reportData.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <View
                      key={idx}
                      style={{
                        flexDirection: "row",
                        paddingVertical: 9,
                        paddingHorizontal: 12,
                        backgroundColor: isEven
                          ? "rgba(255,255,255,0.30)"
                          : "rgba(210,228,242,0.30)",
                        borderBottomWidth: 1,
                        borderBottomColor: "rgba(200,218,235,0.40)",
                      }}
                    >
                      <Text style={[histStyles.tdItem, { flex: 1 }]}>
                        {row.label}
                      </Text>
                      <Text
                        style={[
                          histStyles.tdQty,
                          { width: 58, textAlign: "center" },
                        ]}
                      >
                        {row.count}
                      </Text>
                      <Text
                        style={[
                          histStyles.tdTotal,
                          { width: 90, textAlign: "right" },
                        ]}
                      >
                        ₱{row.total.toFixed(2)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── HISTORY STYLES ────────────────────────────────────────────────────────────
const histStyles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    padding: 12,
    overflow: "hidden",
    minHeight: 0,
    minWidth: 0,
  },
  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 6,
    zIndex: 9999,
  },
  panelTitle: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "rgba(1,31,75,0.65)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  countBadge: {
    backgroundColor: "rgba(1,31,75,0.09)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(1,31,75,0.12)",
  },
  countBadgeText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "rgba(1,31,75,0.55)",
    letterSpacing: 0.8,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(200,218,235,0.90)",
  },
  sortBtnText: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 10,
    color: "rgba(1,31,75,0.65)",
  },
  sortDropdown: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200,218,235,0.80)",
    shadowColor: "#011f4b",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 9999,
    zIndex: 9999,
    minWidth: 168,
    overflow: "hidden",
  },
  sortDropItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200,218,235,0.50)",
  },
  sortDropItemActive: { backgroundColor: "rgba(26,58,107,0.07)" },
  sortDropItemText: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(1,31,75,0.70)",
  },
  // Table
  thCell: { paddingHorizontal: 5 },
  thTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 7,
    color: "rgba(1,31,75,0.55)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  thDiv: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(180,205,225,0.70)",
  },
  tdRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.30)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200,218,235,0.40)",
    paddingVertical: 7,
  },
  tdRowEven: { backgroundColor: "rgba(210,228,242,0.35)" },
  tdCell: { paddingHorizontal: 5 },
  tdDate: { fontFamily: "GoogleSans_700Bold", fontSize: 9, color: "#0f1e35" },
  tdTime: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 8,
    color: "rgba(1,31,75,0.45)",
    marginTop: 1,
  },
  tdOrderNo: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "#1a3a6b",
  },
  tdItem: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 10,
    color: "rgba(1,31,75,0.72)",
    lineHeight: 14,
  },
  tdQty: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "#0f1e35",
    textAlign: "center",
  },
  tdVariant: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 9,
    color: "rgba(1,31,75,0.65)",
    textAlign: "center",
  },
  tdNone: {
    color: "rgba(1,31,75,0.28)",
    fontFamily: "GoogleSans_400Regular",
    fontStyle: "italic",
  },
  tdPm: { fontFamily: "GoogleSans_700Bold", fontSize: 11, textAlign: "center" },
  tdTotal: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#27ae60",
    textAlign: "center",
  },
  tdStatus: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    textAlign: "center",
  },
  // Empty
  emptyTitle: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 14,
    color: "rgba(1,31,75,0.55)",
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.40)",
    textAlign: "center",
    marginTop: 4,
  },
  shopNowBtn: {
    marginTop: 16,
    backgroundColor: "#1a2d4e",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  shopNowText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "#c9a84c",
  },
  // Year
  yearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(26,58,107,0.12)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: "rgba(26,58,107,0.25)",
  },
  yearBtnText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "#0f1e35",
    letterSpacing: 0.5,
  },
  yearDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200,218,235,0.80)",
    shadowColor: "#011f4b",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 9999,
    zIndex: 9999,
    minWidth: 100,
  },
  yearDropItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200,218,235,0.50)",
  },
  yearDropItemActive: { backgroundColor: "#1a3a6b" },
  yearDropItemText: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "rgba(1,31,75,0.70)",
    textAlign: "center",
  },
  // Period
  periodRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 22,
    padding: 3,
    gap: 2,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 18,
    alignItems: "center",
  },
  periodTabActive: {
    backgroundColor: "#1a2d4e",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  periodTabTxt: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 12,
    color: "rgba(1,31,75,0.60)",
  },
  periodTabTxtActive: { fontFamily: "GoogleSans_700Bold", color: "#fff" },
  // Month pills
  monthPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(26,58,107,0.10)",
    borderWidth: 1,
    borderColor: "rgba(26,58,107,0.15)",
  },
  monthPillActive: { backgroundColor: "#1a2d4e", borderColor: "#1a2d4e" },
  monthPillTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "rgba(1,31,75,0.60)",
  },
  monthPillTxtActive: { color: "#fff" },
  // Summary cards
  sumCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.50)",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(200,218,235,0.70)",
    alignItems: "center",
  },
  sumCardLabel: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 9,
    color: "rgba(1,31,75,0.50)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  sumCardValue: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
    color: "#0f1e35",
  },
});

const AdBanner = ({ isWide, adAnim, navigation }) => {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef(null);
  const { width } = useWindowDimensions();

  // Pull live ads from Firestore via context; filter out member-only ads
  // Uses `target` field: 'both' | 'member' | 'visitor'
  const { ads: contextAds } = useMerchandise();
  const ADS =
    contextAds && contextAds.length > 0
      ? contextAds.filter((ad) => (ad.target || "both") !== "member")
      : [
          {
            id: 1,
            bg: ["#1a3a6b", "#2e5fa3"],
            emoji: "📦",
            title: "CESLA Merchandise",
            sub: "Quality products available now!",
          },
          {
            id: 2,
            bg: ["#7b3f00", "#c9a84c"],
            emoji: "🎁",
            title: "Special Offers",
            sub: "Check out our latest items!",
          },
        ];

  useEffect(() => {
    if (ADS.length === 0) return;
    const timer = setInterval(() => {
      setCurrent((prev) => {
        const next = (prev + 1) % ADS.length;
        scrollRef.current?.scrollTo({ x: next * bannerW, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [ADS.length]);

  // Reset current index if it's out of range after filtering
  useEffect(() => {
    if (ADS.length > 0 && current >= ADS.length) {
      setCurrent(0);
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [ADS.length]);

  const bannerW = isWide ? Math.min(width * 0.55, 700) : width - 48;

  const handleScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / bannerW);
    setCurrent(idx);
  };

  // Mobile: instantly show/hide via adVisible boolean (no animation to prevent glitch)
  const mobileHideStyle =
    !isWide && adAnim === false
      ? {
          display: "none",
        }
      : {};

  return (
    <View style={[{ alignSelf: "stretch" }, mobileHideStyle]}>
      {ADS.length === 0 ? null : (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={{ width: bannerW, alignSelf: "center" }}
          contentContainerStyle={{ width: bannerW * ADS.length }}
        >
          {ADS.map((ad) => {
            const titleStyle = {
              fontFamily: ad.titleFmt?.font || "GoogleSans_700Bold",
              fontStyle: ad.titleFmt?.italic ? "italic" : "normal",
              fontWeight: ad.titleFmt?.bold ? "700" : "400",
              textDecorationLine: ad.titleFmt?.underline ? "underline" : "none",
            };
            const subStyle = {
              fontFamily: ad.subFmt?.font || "GoogleSans_400Regular",
              fontStyle: ad.subFmt?.italic ? "italic" : "normal",
              fontWeight: ad.subFmt?.bold ? "700" : "400",
              textDecorationLine: ad.subFmt?.underline ? "underline" : "none",
            };
            const handleAdPress = () => {
              if (!ad.url) return;
              if (ad.url === "coop://home") {
                navigation &&
                  navigation.navigate("CoopScreen", { view: "register" });
              } else if (Platform.OS === "web") {
                window.open(ad.url, "_blank");
              } else {
                import("react-native").then(({ Linking }) =>
                  Linking.openURL(ad.url),
                );
              }
            };
            const imgSrc = ad.image
              ? { uri: ad.image }
              : ad.imageUrl
                ? { uri: ad.imageUrl }
                : null;
            return (
              <LinearGradient
                key={ad.id}
                colors={ad.bg || ["#1a3a6b", "#2e5fa3"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[adStyles.slide, { width: bannerW }]}
              >
                {imgSrc ? (
                  <Image
                    source={imgSrc}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: 16,
                    }}
                    resizeMode="cover"
                  />
                ) : null}
                {!imgSrc ? (
                  <Text style={adStyles.adEmoji}>{ad.emoji || "📦"}</Text>
                ) : null}
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={handleAdPress}
                  activeOpacity={ad.url ? 0.8 : 1}
                >
                  <Text style={[adStyles.adTitle, titleStyle]}>{ad.title}</Text>
                  <Text style={[adStyles.adSub, subStyle]}>{ad.sub}</Text>
                  {ad.url ? (
                    <Text
                      style={{
                        fontFamily: "GoogleSans_400Regular",
                        fontSize: 10,
                        color: "rgba(255,255,255,0.70)",
                        marginTop: 2,
                      }}
                    >
                      🔗 Tap to open
                    </Text>
                  ) : null}
                </TouchableOpacity>
                <View style={adStyles.adBadge}>
                  <Text style={adStyles.adBadgeTxt}>AD</Text>
                </View>
                {/* Dots inside card */}
                <View style={adStyles.dotsInner}>
                  {ADS.map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        scrollRef.current?.scrollTo({
                          x: i * bannerW,
                          animated: true,
                        });
                        setCurrent(i);
                      }}
                    >
                      <View
                        style={[
                          adStyles.dot,
                          current === i && adStyles.dotActive,
                        ]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </LinearGradient>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const adStyles = StyleSheet.create({
  slide: {
    height: 120,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
    overflow: "hidden",
  },
  adEmoji: { fontSize: 52 },
  adTitle: { fontFamily: "GoogleSans_700Bold", fontSize: 18, color: "#fff" },
  adSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
  },
  adBadge: {
    position: "absolute",
    top: 10,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  adBadgeTxt: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "#fff",
    letterSpacing: 1,
  },
  dotsInner: {
    position: "absolute",
    bottom: 7,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.40)",
  },
  dotActive: { backgroundColor: "#fff", width: 18 },
});

export default function MerchandiseScreen({ navigation, route }) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768;
  const isSmall = width < 400;

  // ── Back navigation — pop this screen off the stack cleanly ──
  const handleBack = () => {
    if (!navigation) return;
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("MerchandisePortalScreen");
  };

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold,
    NotoSerif_700Bold_Italic,
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_700Bold,
  });

  // ── Live data from shared MerchandiseContext ──────────────────────────────
  const {
    items: MERCH_ITEMS,
    categories: CATEGORIES,
    orders: contextOrders,
    reloadFromStorage,
    addOrder,
    deductStock,
  } = useMerchandise();

  // ── Visitor order history — pulled live from Firestore via context ──────────
  // Filter only visitor orders so member orders don't mix in
  const orderHistory = (contextOrders || []).filter(
    (o) => o.source === "visitor",
  );

  // Reload on focus so visitor always sees latest items from admin
  useFocusEffect(
    useCallback(() => {
      reloadFromStorage();
    }, [reloadFromStorage]),
  );

  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  const hdrFade = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-16)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;
  const [adVisible, setAdVisible] = useState(true);
  const adVisibleRef = useRef(true);
  const receiptViewRef = useRef(null);

  // ── Mobile panel expand/collapse via header drag only ──────────────────────
  const [panelExpanded, setPanelExpanded] = useState(false);
  const panelExpandedRef = useRef(false);

  const panelPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -10) {
          panelExpandedRef.current = true;
          setPanelExpanded(true);
          adVisibleRef.current = false;
          setAdVisible(false);
        } else if (gs.dy > 10) {
          panelExpandedRef.current = false;
          setPanelExpanded(false);
          adVisibleRef.current = true;
          setAdVisible(true);
        }
      },
    }),
  ).current;

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
    Animated.timing(bodyFade, {
      toValue: 1,
      duration: 600,
      delay: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  const [sizePickerItem, setSizePickerItem] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mainTab, setMainTab] = useState("order"); // 'order' | 'history'

  const addToCart = (item, color, size) => {
    const key = item.id + (color ? "-" + color : "") + (size ? "-" + size : "");
    setCart((prev) => ({
      ...prev,
      [key]: {
        item,
        qty: (prev[key] ? prev[key].qty : 0) + 1,
        color: color || null,
        size: size || null,
      },
    }));
  };

  const removeFromCart = (item, color, size) => {
    const key = item.id + (color ? "-" + color : "") + (size ? "-" + size : "");
    setCart((prev) => {
      const qty = (prev[key] ? prev[key].qty : 0) - 1;
      if (qty <= 0) {
        const n = { ...prev };
        delete n[key];
        return n;
      }
      return {
        ...prev,
        [key]: { item, qty, color: color || null, size: size || null },
      };
    });
  };

  const clearCart = () => setCart({});

  const placeOrder = () => {
    setCartOpen(false);
    clearCart();
  };

  // Called by CartPanel after building order data — saves to Firestore
  const handlePlaceOrder = async (orderData) => {
    setLastOrder(orderData);
    setCartOpen(false);
    clearCart();
    setTimeout(() => setReceiptVisible(true), 300);

    // Then save to Firestore in background
    try {
      await addOrder({
        ...orderData,
        status: "done",
        source: "visitor",
      });
      await deductStock(orderData.items);
    } catch (e) {
      console.warn("handlePlaceOrder Firestore error:", e);
    }
  };

  const handleShowReceipt = () => setReceiptVisible(true);

  // ── Download receipt as file ──────────────────────────────────────────────
  // Web  → generates an HTML receipt file and triggers browser download
  // Mobile → saves a .txt receipt to device via expo-file-system + expo-sharing
  // ── Download receipt as PNG image ─────────────────────────────────────────
  // Web  → html2canvas captures the receipt card div → download as PNG
  // Mobile → react-native-view-shot captures the View → expo-media-library saves to Gallery
  const handlePrint = async () => {
    if (!lastOrder) return;
    const { orderNo } = lastOrder;
    const filename = "CLIMBS_Receipt_" + orderNo;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        // Dynamically load html2canvas from CDN if not already loaded
        if (!window.html2canvas) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src =
              "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        // Find the receipt card element by its data attribute
        const el = document.querySelector('[data-receipt-card="true"]');
        if (!el) {
          alert("Receipt not ready yet, please try again.");
          return;
        }

        const canvas = await window.html2canvas(el, {
          scale: 3, // high resolution
          useCORS: true,
          backgroundColor: "#fffef8",
          logging: false,
        });
        const link = document.createElement("a");
        link.download = filename + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      } catch (e) {
        alert("Could not capture receipt image: " + e.message);
      }
    } else {
      // ── MOBILE: react-native-view-shot + expo-media-library ──
      try {
        const ViewShot = require("react-native-view-shot");
        const MediaLib = require("expo-media-library");

        // Request gallery permission
        const { status } = await MediaLib.requestPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Please allow access to your gallery to save the receipt.",
          );
          return;
        }

        // Capture the receipt view ref
        if (!receiptViewRef.current) {
          Alert.alert("Error", "Could not capture receipt. Please try again.");
          return;
        }

        const uri = await ViewShot.captureRef(receiptViewRef.current, {
          format: "png",
          quality: 1.0,
          result: "tmpfile",
        });

        const asset = await MediaLib.createAssetAsync(uri);
        Alert.alert(
          "✅ Saved to Gallery!",
          "Receipt #" + orderNo + " saved as an image in your Photos/Gallery.",
          [{ text: "OK" }],
        );
      } catch (e) {
        Alert.alert(
          "Error",
          "Could not save receipt.\n\nMake sure react-native-view-shot and expo-media-library are installed.\n\n" +
            e.message,
        );
      }
    }
  };

  const totalItems = Object.values(cart).reduce((s, { qty }) => s + qty, 0);

  // ── Search: auto-switch category tab to where the result belongs ──
  // When typing, find all matching items. If they all belong to one category,
  // auto-switch that tab. If they span multiple categories, switch to 'All'.
  const handleSearch = (text) => {
    setSearch(text);
    if (text.trim() === "") return; // cleared — leave category as-is
    const matches = MERCH_ITEMS.filter((i) =>
      i.name.toLowerCase().includes(text.toLowerCase()),
    );
    if (matches.length === 0) return;
    const cats = [...new Set(matches.map((i) => i.cat))];
    if (cats.length === 1) {
      setActiveCategory(cats[0]); // all results in same category → switch there
    } else {
      setActiveCategory("All"); // results span multiple categories → show All
    }
  };

  const filtered = MERCH_ITEMS.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    if (search.trim() !== "") return matchesSearch; // show all matches when searching
    return activeCategory === "All" || i.cat === activeCategory;
  });

  // Grid cols — COLS fixed per platform, CARD_W fills available space
  const CART_W = isWide ? 280 : 0;
  const CAT_W = isWide ? 170 : 0;
  const MARGIN = isWide ? 80 : 20; // centerPanel paddingH(10)*2
  const GAP_C = Platform.OS === "web" ? (isWide ? 10 : 5) : 5;
  const COLS = Platform.OS === "web" ? (isWide ? 5 : 3) : 3;
  const AVAIL =
    width - CAT_W - CART_W - MARGIN - (Platform.OS === "web" ? 24 : 12); // padding*2
  const CARD_W = Math.floor((AVAIL - (COLS - 1) * GAP_C) / COLS);

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* BACKGROUND */}
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

      {/* HEADER */}
      <Animated.View
        style={{
          opacity: hdrFade,
          transform: [{ translateY: hdrTrans }],
          marginTop: Platform.OS === "web" ? (isWide ? 16 : 36) : 36,
          marginHorizontal: isSmall ? 8 : 10,
          zIndex: 10,
        }}
      >
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: isWide ? 40 : 12,
              paddingVertical: isWide ? 16 : 7,
            },
          ]}
        >
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text
              style={[
                styles.headerH1,
                { fontSize: isWide ? 22 : isSmall ? 14 : 16 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              <Text style={styles.headerGold}>CESLA </Text>
              {isWide ? "Merchandise Ordering System" : "Merchandise"}
            </Text>
            {isWide && (
              <View style={styles.visitorTag}>
                <Text style={styles.visitorTagText}>📦 MERCHANDISE STORE</Text>
              </View>
            )}
          </View>

          {/* Menu icon */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setMenuOpen((v) => !v)}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 18,
                textAlign: "center",
                lineHeight: 22,
                includeFontPadding: false,
              }}
            >
              ≡
            </Text>
          </TouchableOpacity>

          {/* Dropdown */}
          {menuOpen && (
            <View style={styles.dropdown}>
              {[{ icon: "📋", label: "Order History", tab: "history" }].map(
                (opt) => (
                  <TouchableOpacity
                    key={opt.tab}
                    style={[
                      styles.dropdownItem,
                      {
                        backgroundColor:
                          mainTab === opt.tab
                            ? "rgba(201,168,76,0.15)"
                            : "transparent",
                      },
                    ]}
                    onPress={() => {
                      setMainTab(opt.tab);
                      setMenuOpen(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        {
                          color:
                            mainTab === opt.tab
                              ? "#c9a84c"
                              : "rgba(255,255,255,0.85)",
                          fontFamily:
                            mainTab === opt.tab
                              ? "GoogleSans_700Bold"
                              : "GoogleSans_500Medium",
                        },
                      ]}
                    >
                      {opt.icon} {opt.label}
                    </Text>
                    {mainTab === opt.tab && (
                      <View
                        style={{
                          width: 3,
                          borderRadius: 2,
                          backgroundColor: "#c9a84c",
                          position: "absolute",
                          left: 0,
                          top: 6,
                          bottom: 6,
                        }}
                      />
                    )}
                  </TouchableOpacity>
                ),
              )}
            </View>
          )}
        </View>
      </Animated.View>

      {/* BODY */}
      <Animated.View style={[styles.body, { opacity: bodyFade }]}>
        {/* ── HISTORY TAB ── */}
        {mainTab === "history" && (
          <HistoryTabContent
            orderHistory={orderHistory}
            isWide={isWide}
            showStatus={true}
            onShopNow={() => setMainTab("order")}
          />
        )}

        {/* ── ORDERING TAB ── */}
        {mainTab === "order" && (
          <Animated.View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "stretch",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {/* LEFT — Categories (web only) */}
            {isWide && (
              <View style={styles.catPanel}>
                <Text style={styles.catPanelTitle}>CATEGORIES</Text>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catBtn,
                      activeCategory === cat && styles.catBtnActive,
                    ]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.catBtnText,
                        activeCategory === cat && styles.catBtnTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* CENTER — Search + Menu grid */}
            <View style={styles.centerPanel}>
              {/* Mobile category tabs */}
              {!isWide && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, marginBottom: 8 }}
                  contentContainerStyle={{
                    paddingHorizontal: 4,
                    gap: 5,
                    paddingVertical: 2,
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catTab,
                        activeCategory === cat && styles.catTabActive,
                      ]}
                      onPress={() => setActiveCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catTabText,
                          activeCategory === cat && styles.catTabTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* ── Ad Banner ── */}
              <View style={{ marginBottom: 12, flexShrink: 0 }}>
                <AdBanner
                  isWide={isWide}
                  adAnim={adVisible}
                  navigation={navigation}
                />
              </View>

              {/* Items panel — fills remaining space */}
              <View
                style={[
                  styles.itemsPanel,
                  !isWide && panelExpanded && { flex: 3 },
                ]}
              >
                {/* Panel header — drag handle, ONLY triggers swipe up/down on mobile */}
                <View
                  {...(!isWide ? panelPanResponder.panHandlers : {})}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 6,
                    gap: 8,
                    paddingVertical: !isWide ? 6 : 0,
                  }}
                >
                  {!isWide && (
                    <View
                      style={{
                        position: "absolute",
                        top: -10,
                        left: 0,
                        right: 0,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: "rgba(1,31,75,0.18)",
                        }}
                      />
                    </View>
                  )}
                  <Text
                    style={{
                      fontFamily: "GoogleSans_700Bold",
                      fontSize: 12,
                      color: "#011f4b",
                      letterSpacing: 2,
                      flexShrink: 0,
                    }}
                  >
                    {search.trim() !== ""
                      ? 'RESULTS FOR "' + search.toUpperCase() + '"'
                      : activeCategory === "All"
                        ? "ALL ITEMS"
                        : activeCategory.toUpperCase()}
                  </Text>
                  <View style={styles.searchBoxInline}>
                    <Text style={{ fontSize: 11, marginRight: 4 }}>🔍</Text>
                    <TextInput
                      style={styles.searchInputInline}
                      placeholder="Search..."
                      placeholderTextColor="rgba(1,31,75,0.35)"
                      value={search}
                      onChangeText={handleSearch}
                    />
                    {search.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setSearch("");
                          setActiveCategory("All");
                        }}
                      >
                        <Text
                          style={{
                            color: "rgba(1,31,75,0.45)",
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          ✕
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View
                  style={{
                    height: 1,
                    backgroundColor: "rgba(1,31,75,0.10)",
                    marginBottom: 8,
                  }}
                />
                <ScrollView
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  style={
                    Platform.OS === "web" && isWide
                      ? { height: height - 310 }
                      : { flex: 1 }
                  }
                  contentContainerStyle={[
                    styles.menuGrid,
                    {
                      gap: Platform.OS === "web" ? 10 : 5,
                      paddingBottom: Platform.OS !== "web" ? 90 : 20,
                    },
                  ]}
                >
                  {filtered.length === 0 ? (
                    <Text style={styles.emptyText}>No items found.</Text>
                  ) : (
                    Array.from(
                      { length: Math.ceil(filtered.length / COLS) },
                      (_, rowIdx) => (
                        <View
                          key={rowIdx}
                          style={{
                            flexDirection: "row",
                            gap: Platform.OS === "web" ? 10 : 5,
                            marginBottom: Platform.OS === "web" ? 0 : 5,
                          }}
                        >
                          {filtered
                            .slice(rowIdx * COLS, rowIdx * COLS + COLS)
                            .map((item) => (
                              <View key={item.id} style={{ flex: 1 }}>
                                <ItemCard
                                  item={item}
                                  onAdd={(color, size) =>
                                    addToCart(item, color, size)
                                  }
                                />
                              </View>
                            ))}
                          {/* Fill empty slots in last row */}
                          {Array.from({
                            length:
                              COLS -
                              filtered.slice(
                                rowIdx * COLS,
                                rowIdx * COLS + COLS,
                              ).length,
                          }).map((_, i) => (
                            <View key={"empty-" + i} style={{ flex: 1 }} />
                          ))}
                        </View>
                      ),
                    )
                  )}
                </ScrollView>
              </View>
            </View>

            {/* RIGHT — Cart panel (web only) */}
            {isWide && (
              <CartPanel
                cart={cart}
                onAdd={addToCart}
                onRemove={removeFromCart}
                onClear={clearCart}
                onOrder={placeOrder}
                isWide={isWide}
                hideTitle={false}
                onPlaceOrder={handlePlaceOrder}
                lastOrder={lastOrder}
                onShowReceipt={handleShowReceipt}
                orderHistory={orderHistory}
              />
            )}
            {/* Mobile floating cart button — inside body so it overlays itemsPanel */}
            {!isWide && (
              <TouchableOpacity
                style={styles.floatCart}
                onPress={() => setCartOpen(true)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#c9a84c", "#e8c87a"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.floatCartGradient}
                >
                  <Text style={styles.floatCartText}>
                    🛒 View Cart {totalItems > 0 ? "(" + totalItems + ")" : ""}{" "}
                    • ₱
                    {Object.values(cart)
                      .reduce((s, { item, qty }) => s + item.price * qty, 0)
                      .toFixed(2)}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </Animated.View>
      {!isWide && cartOpen && (
        <CartBottomSheet
          cart={cart}
          onAdd={addToCart}
          onRemove={removeFromCart}
          onClear={clearCart}
          onOrder={placeOrder}
          onClose={() => setCartOpen(false)}
          onPlaceOrder={handlePlaceOrder}
          lastOrder={lastOrder}
          onShowReceipt={handleShowReceipt}
          orderHistory={orderHistory}
        />
      )}

      <SizePickerModal
        visible={!!sizePickerItem}
        item={sizePickerItem}
        onConfirm={(size) => {
          addToCart(sizePickerItem, size);
          setSizePickerItem(null);
        }}
        onClose={() => setSizePickerItem(null)}
      />

      {/* ── RECEIPT MODAL — rendered at root level so it works on both web & mobile ── */}
      <ReceiptModal
        visible={receiptVisible}
        orderData={lastOrder}
        onClose={() => setReceiptVisible(false)}
        onPrint={handlePrint}
        receiptViewRef={receiptViewRef}
      />
    </View>
  );
}

// ──────────────── STYLES ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...(Platform.OS === "web"
      ? { height: "100dvh", maxHeight: "100dvh", overflow: "hidden" }
      : {}),
  },

  // Header
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
    position: "relative",
  },
  backIcon: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 10 },
  headerH1: {
    fontFamily: "NotoSerif_700Bold",
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  headerGold: {
    fontFamily: "NotoSerif_700Bold_Italic",
    color: "#c9a84c",
    fontStyle: "italic",
  },
  visitorTag: {
    marginTop: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.60)",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  visitorTagText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "#ffffff",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 13,
    includeFontPadding: false,
  },
  cartDot: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#c9a84c",
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cartDotText: { color: "#0d1b3e", fontSize: 9, fontWeight: "800" },

  // Body layout
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: Platform.OS === "web" ? 12 : 6,
    minHeight: 0,
    overflow: "hidden",
  },

  // LEFT — Categories panel
  catPanel: {
    width: 170,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 16,
    marginLeft: 20,
    marginBottom: 16,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.40)",
    overflow: "hidden",
    minHeight: 0,
  },
  catPanelTitle: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "rgba(1,31,75,0.65)",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.12)",
  },
  catBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.70)",
  },
  catBtnActive: {
    backgroundColor: "#c9a84c",
    borderColor: "#c9a84c",
  },
  catBtnText: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 13,
    color: "rgba(1,31,75,0.75)",
    textAlign: "center",
  },
  catBtnTextActive: {
    fontFamily: "GoogleSans_700Bold",
    color: "#0d1b3e",
  },

  // CENTER panel
  centerPanel: {
    flex: 1,
    flexDirection: "column",
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === "web" ? 16 : 0,
    minHeight: 0,
    overflow: "hidden",
  },
  itemsPanel: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.40)",
    padding: Platform.OS === "web" ? 10 : 6,
    overflow: "hidden",
    flex: 1,
    marginBottom: Platform.OS === "web" ? 16 : 8,
  },

  // ── FIX: Search bar — compact, full width, below tabs ──
  searchBoxInline: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.90)",
    flex: 1,
  },
  searchInputInline: {
    flex: 1,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "#011f4b",
    paddingVertical: 0,
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}),
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.90)",
    marginBottom: 10,
    shadowColor: "#011f4b",
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchIcon: { fontSize: 12, marginRight: 5 },
  searchInput: {
    flex: 1,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "#011f4b",
    paddingVertical: 0,
  },

  menuSectionLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "#011f4b",
    letterSpacing: 2,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.10)",
  },
  menuGrid: { paddingTop: 2 },
  menuRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  emptyText: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "rgba(1,31,75,0.55)",
    padding: 20,
  },

  // Mobile category tabs
  catTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  catTabActive: { backgroundColor: "#304674", borderColor: "#c9a84c" },
  catTabText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 16,
    includeFontPadding: false,
  },
  catTabTextActive: { fontFamily: "GoogleSans_700Bold", color: "#fff" },

  // FOOD CARD — new card design with image carousel + detail popup
  foodCard: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#011f4b",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    flex: 1,
  },
  foodCardInner: {
    borderRadius: 14,
    padding: Platform.OS === "web" ? 10 : 8,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.80)",
    alignItems: "center",
    gap: Platform.OS === "web" ? 5 : 3,
    flex: 1,
    justifyContent: "space-between",
  },
  cardImgWrap: {
    borderRadius: 10,
    overflow: "hidden",
    alignSelf: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    marginBottom: Platform.OS === "web" ? 4 : 2,
  },
  emojiCircle: {
    width: Platform.OS === "web" ? 72 : 52,
    height: Platform.OS === "web" ? 72 : 52,
    borderRadius: Platform.OS === "web" ? 36 : 26,
    backgroundColor: "rgba(240,246,252,0.90)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Platform.OS === "web" ? 6 : 3,
    shadowColor: "#011f4b",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  emojiText: { fontSize: Platform.OS === "web" ? 34 : 24 },
  itemName: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: Platform.OS === "web" ? 11 : 9,
    color: "#1a2d4e",
    textAlign: "center",
    fontWeight: "700",
    lineHeight: Platform.OS === "web" ? 15 : 12,
    minHeight: Platform.OS === "web" ? 15 : 24,
  },
  itemStock: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: Platform.OS === "web" ? 10 : 9,
    color: "rgba(1,31,75,0.45)",
    letterSpacing: 0.2,
  },
  itemPrice: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: Platform.OS === "web" ? 14 : 12,
    color: "#c9a84c",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  addBtn: {
    backgroundColor: "#1a3a6b",
    borderRadius: 7,
    paddingVertical: Platform.OS === "web" ? 8 : 6,
    paddingHorizontal: 4,
    marginTop: 2,
    alignItems: "center",
    width: "100%",
    shadowColor: "#1a3a6b",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  addBtnText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: Platform.OS === "web" ? 10 : 9,
    color: "#ffffff",
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // RIGHT — Cart panel
  cartPanel: {
    width: 280,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 16,
    marginRight: 20,
    marginBottom: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    overflow: "hidden",
    minHeight: 0,
  },
  cartPanelMobile: {
    width: "100%",
    marginRight: 0,
    marginBottom: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 14,
  },
  cartPanelTitle: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "rgba(1,31,75,0.70)",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.12)",
  },
  cartItemsBox: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 10,
    padding: 10,
    minHeight: 60,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
  },
  cartEmpty: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(1,31,75,0.45)",
    textAlign: "center",
    paddingVertical: 8,
  },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.07)",
  },
  cartRowEmoji: { fontSize: 18 },
  cartRowName: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 11,
    color: "#011f4b",
  },
  cartRowSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 10,
    color: "rgba(1,31,75,0.55)",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "rgba(1,31,75,0.30)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.80)",
    flexShrink: 0,
    marginRight: 6,
  },
  checkboxChecked: { backgroundColor: "#27ae60", borderColor: "#27ae60" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "900", lineHeight: 16 },

  cartRowQty: { flexDirection: "row", gap: 4 },
  cartQBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(1,31,75,0.20)",
    justifyContent: "center",
    alignItems: "center",
  },
  cartQBtnAdd: { backgroundColor: "#1a3a6b", borderColor: "#1a3a6b" },
  cartQBtnText: {
    fontSize: 13,
    color: "#011f4b",
    fontWeight: "700",
    lineHeight: 17,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  totalLabel: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 13,
    color: "rgba(1,31,75,0.75)",
  },
  totalValue: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 15,
    color: "#0d1b3e",
  },
  paymentModeBox: {
    backgroundColor: "rgba(255,255,255,0.30)",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.60)",
    marginVertical: 4,
  },
  paymentModeLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "rgba(1,31,75,0.60)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  paymentModeRow: { flexDirection: "column", gap: 8 },
  paymentModeOption: { flexDirection: "row", alignItems: "center", gap: 8 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "rgba(1,31,75,0.30)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.70)",
  },
  radioOuterActive: { borderColor: "#1a3a6b" },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#1a3a6b",
  },
  paymentModeText: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(1,31,75,0.55)",
  },
  paymentModeTextActive: {
    fontFamily: "GoogleSans_700Bold",
    color: "#1a3a6b",
  },
  visitorNote: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
  },
  visitorNoteText: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 10,
    color: "rgba(1,31,75,0.65)",
    textAlign: "center",
  },
  amountLabel: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 11,
    color: "rgba(1,31,75,0.65)",
  },
  amountInput: {
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: "GoogleSans_400Regular",
    fontSize: 13,
    color: "#011f4b",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.80)",
  },
  changeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  changeLabel: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 12,
    color: "rgba(1,31,75,0.65)",
  },
  changeValue: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 14,
  },
  placeOrderBtn: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#27ae60",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  placeOrderBtnDisabled: {
    shadowColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  placeOrderGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  placeOrderIcon: { fontSize: 16 },
  placeOrderText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 14,
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#e74c3c",
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: "#e74c3c",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  clearBtnIcon: { fontSize: 14 },
  clearBtnText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "#fff",
    letterSpacing: 0.3,
  },
  printBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#1a3a6b",
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: "#1a3a6b",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  printBtnIcon: { fontSize: 14 },
  printBtnText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "#fff",
    letterSpacing: 0.3,
  },

  // ── Receipt Modal ────────────────────────────────────────────────────────
  receiptOverlay: {
    flex: 1,
    backgroundColor: "rgba(5,15,40,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  receiptCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fffef8",
    borderRadius: 4,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
    overflow: "hidden",
    maxHeight: "90%",
  },
  receiptJaggedTop: {
    flexDirection: "row",
    backgroundColor: "#98bad5",
    height: 16,
    overflow: "hidden",
  },
  receiptJaggedTriangle: {
    flex: 1,
    height: 16,
    backgroundColor: "#fffef8",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  receiptJaggedBottom: {
    flexDirection: "row",
    backgroundColor: "#fffef8",
    height: 16,
    overflow: "hidden",
  },
  receiptJaggedTriangleBottom: {
    flex: 1,
    height: 16,
    backgroundColor: "#98bad5",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  receiptHeader: {
    alignItems: "center",
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  receiptShopName: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 17,
    color: "#1a2d4e",
    letterSpacing: 1,
    textAlign: "center",
  },
  receiptShopSub: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.55)",
    marginTop: 3,
    textAlign: "center",
  },
  receiptDividerDashed: {
    width: "100%",
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.18)",
    borderStyle: "dashed",
    marginVertical: 10,
  },
  receiptDividerSolid: {
    height: 1,
    backgroundColor: "rgba(1,31,75,0.15)",
    marginVertical: 6,
  },
  receiptMeta: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.60)",
    textAlign: "center",
    lineHeight: 17,
  },
  receiptItemHeader: {
    flexDirection: "row",
    marginBottom: 2,
  },
  receiptItemHCol: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 10,
    color: "rgba(1,31,75,0.50)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  receiptItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: "rgba(1,31,75,0.06)",
  },
  receiptItemText: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "#1a2d4e",
  },
  receiptTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  receiptTotalLabel: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 14,
    color: "#1a2d4e",
    letterSpacing: 0.5,
  },
  receiptTotalValue: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 16,
    color: "#c9a84c",
  },
  receiptSubTotalLabel: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 12,
    color: "rgba(1,31,75,0.60)",
  },
  receiptSubTotalValue: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 12,
    color: "rgba(1,31,75,0.75)",
  },
  receiptThankYou: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 13,
    color: "#1a2d4e",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  receiptFooter: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 10,
    color: "rgba(1,31,75,0.40)",
    textAlign: "center",
    marginBottom: 10,
  },
  receiptActions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderColor: "rgba(1,31,75,0.10)",
    backgroundColor: "#fffef8",
  },
  receiptCloseBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(1,31,75,0.08)",
    borderWidth: 1,
    borderColor: "rgba(1,31,75,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  receiptCloseBtnText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "rgba(1,31,75,0.65)",
  },
  receiptPrintBtn: {
    flex: 2,
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#1a3a6b",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  receiptPrintBtnGrad: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptPrintBtnText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 13,
    color: "#fff",
    letterSpacing: 0.5,
  },

  // Bottom sheet
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
    overflow: "scroll",
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

  // Floating cart button
  floatCart: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  floatCartGradient: {
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  floatCartText: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 14,
    color: "#0d1b3e",
    fontWeight: "700",
  },
  dropdown: {
    position: "absolute",
    top: 54,
    right: 8,
    zIndex: 200,
    backgroundColor: "rgba(10,25,60,0.97)",
    borderRadius: 12,
    minWidth: 200,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  dropdownItemText: {
    fontFamily: "GoogleSans_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
});

const msHistTbl = StyleSheet.create({
  tableWrap: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200,218,235,0.80)",
    overflow: "hidden",
    flex: 1,
    minHeight: 0,
    shadowColor: "#011f4b",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thead: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(220,232,242,0.95)",
    borderBottomWidth: 1.5,
    borderColor: "rgba(180,205,225,0.90)",
    paddingVertical: 10,
  },
  hCell: {
    fontFamily: "GoogleSans_700Bold",
    fontSize: 9,
    color: "rgba(1,31,75,0.55)",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    paddingHorizontal: 14,
  },
  hDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(180,205,225,0.70)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "rgba(200,218,235,0.55)",
    paddingVertical: 11,
    backgroundColor: "rgba(255,255,255,0.30)",
  },
  rowEven: { backgroundColor: "rgba(210,228,242,0.35)" },
  cell: { paddingHorizontal: 14 },
  ordNo: { fontFamily: "GoogleSans_700Bold", fontSize: 11, color: "#0f1e35" },
  ordDate: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 9,
    color: "rgba(1,31,75,0.45)",
    marginTop: 2,
    lineHeight: 13,
  },
  itemLine: {
    fontFamily: "GoogleSans_400Regular",
    fontSize: 11,
    color: "rgba(1,31,75,0.72)",
    lineHeight: 15,
  },
  total: { fontFamily: "GoogleSans_700Bold", fontSize: 12, color: "#27ae60" },
});
