// src/screens/CanteenMemberScreen.js
// CESLA MPC — Canteen Member Portal
// Based 100% on CanteenVisitor.js — same design, same UI, same layout
// Differences: Firebase login (CoopScreen credentials) + member chip + order history
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCanteen } from '../context/CanteenContext';

// ── Firebase (CoopScreen login method) ──────────────────────────────────────
import {
  collection, query, where, getDocs, doc,
  updateDoc, serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ── Password hash (same as CoopScreen) ──────────────────────────────────────
const hashPw = pw => {
  let h = 0;
  for (let i = 0; i < pw.length; i++) { h = (h << 5) - h + pw.charCodeAt(i); h |= 0; }
  return 'h_' + Math.abs(h).toString(36) + pw.length;
};

// ── Firebase login ───────────────────────────────────────────────────────────
const loginByUserIdFS = async (userId, password) => {
  const snap = await getDocs(query(collection(db, 'members'), where('userId', '==', userId.trim())));
  if (snap.empty) throw new Error('User ID not found. Please check your ID.');
  const d = snap.docs[0];
  const m = { uid: d.id, ...d.data() };
  if (hashPw(password) !== m.passwordHash) throw new Error('Incorrect password. Please try again.');
  if (m.status === 'Pending')  throw new Error('Your account is pending admin approval. Please wait.');
  if (m.status === 'Rejected') throw new Error('Your registration was rejected. Please contact admin.');
  if (m.status === 'Inactive') throw new Error('Your account is inactive. Please contact admin.');
  await updateDoc(doc(db, 'members', d.id), { lastLogin: serverTimestamp() });
  const { passwordHash, ...safe } = m;
  return safe;
};
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, StatusBar, Image,
  useWindowDimensions, Platform, TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

// ─── DATA ─────────────────────────────────────────────────────────────────────




// ─── LAZY-LOAD react-native-maps (native only, avoids web import error) ────────
let MapView = null;
let Marker  = null;
if (Platform.OS !== 'web') {
  try {
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default;
    Marker  = RNMaps.Marker;
  } catch (_) { /* react-native-maps not installed */ }
}

// ─── LEAFLET HTML (injected as iframe srcdoc on web) ─────────────────────────
// Full interactive map: OpenStreetMap tiles + draggable pin + click-to-pin
// Communicates with parent via postMessage
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
  var pinColor = '${isDeliver ? '#e74c3c' : '#1a3a6b'}';

  // CDO city bounds — covers all barangays
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

  // Custom colored icon
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

  ${lat ? `setPin(${lat}, ${lng});` : ''}

  map.on('click', function(e) { setPin(e.latlng.lat, e.latlng.lng); map.panTo(e.latlng); });

  // Listen for messages from parent (e.g. "fly to location")
  window.addEventListener('message', function(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'flyTo') { setPin(msg.lat, msg.lng); map.setView([msg.lat, msg.lng], 16); }
    } catch(_) {}
  });
</script>
</body>
</html>`;

// ─── LOCATION PICKER MODAL ────────────────────────────────────────────────────
// FoodPanda-style:
//   • Address search bar (Nominatim / OpenStreetMap — no API key needed)
//   • "Use My Location" GPS button
//   • Interactive map: Leaflet iframe (web) | react-native-maps (native)
//   • Click/drag pin anywhere — works outside campus
const DEFAULT_REGION = { latitude:8.4822, longitude:124.6472, latitudeDelta:0.04, longitudeDelta:0.04 };

const LocationPickerModal = ({ visible, onClose, onConfirm, deliveryType }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(80)).current;

  const [coords,       setCoords]       = useState(null);
  const [address,      setAddress]      = useState('');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [suggestions,  setSuggestions]  = useState([]);
  const [searching,    setSearching]    = useState(false);
  const [locLoading,   setLocLoading]   = useState(false);
  const [region,       setRegion]       = useState(DEFAULT_REGION);
  const [mapKey,       setMapKey]       = useState(0); // force iframe re-render
  const iframeRef = useRef(null);
  const searchTimer = useRef(null);

  // ── Entrance animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue:1, duration:260, useNativeDriver:true }),
        Animated.spring(slideAnim, { toValue:0, tension:65, friction:11, useNativeDriver:true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(80);
      setSearchQuery('');
      setSuggestions([]);
    }
  }, [visible]);

  // ── Listen for pin coords from Leaflet iframe (web) ───────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type !== 'coords') return;
        const { lat, lng } = msg;
        setCoords({ lat, lng });
        // Reverse geocode via Geoapify
        try {
          const res = await fetch(
            `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&lang=en&apiKey=${GEOAPIFY_KEY}`
          );
          const data = await res.json();
          const addr = data.features?.[0]?.properties?.formatted;
          setAddress(addr || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } catch (_) {
          setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
      } catch (_) {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Search config ────────────────────────────────────────────────────────
  const GEOAPIFY_KEY = 'a331c3962fec4895bf75aa4947d35fbc'; // 🔑 free at geoapify.com (3000 req/day)
  const CDO_LAT  = 8.4822;
  const CDO_LNG  = 124.6472;
  const CDO_BBOX = '124.55,8.37,124.78,8.58';

  // ── Photon search (primary, fully free, OSM-based) ────────────────────────
  const searchPhoton = async (text) => {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(text)},Cagayan de Oro`
      + `&lat=${CDO_LAT}&lon=${CDO_LNG}&limit=6&lang=en`
    );
    const data = await res.json();
    return (data.features || [])
      .filter(f => {
        const [lng, lat] = f.geometry.coordinates;
        return lat >= 8.37 && lat <= 8.58 && lng >= 124.55 && lng <= 124.78;
      })
      .map(f => ({
        display_name: [
          f.properties.name,
          f.properties.street,
          f.properties.district,
          f.properties.city,
        ].filter(Boolean).join(', '),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        place_id: null,
      }));
  };

  // ── Geoapify search (fallback, 3000 req/day free) ─────────────────────────
  const searchGeoapify = async (text) => {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/autocomplete`
      + `?text=${encodeURIComponent(text)}`
      + `&bias=proximity:${CDO_LNG},${CDO_LAT}`
      + `&filter=rect:${CDO_BBOX}`
      + `&limit=6&lang=en&apiKey=${GEOAPIFY_KEY}`
    );
    const data = await res.json();
    return (data.features || []).map(f => ({
      display_name: f.properties.formatted,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      place_id: null,
    }));
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    clearTimeout(searchTimer.current);
    if (text.length < 2) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        let results = await searchPhoton(text);
        if (results.length === 0) {
          results = await searchGeoapify(text);
        }
        setSuggestions(results);
      } catch (_) {
        try {
          const results = await searchGeoapify(text);
          setSuggestions(results);
        } catch (__) { setSuggestions([]); }
      }
      setSearching(false);
    }, 400);
  };

  const resolvePlaceId = async () => null;

  // ── Tap suggestion → fly map to that location ───────────────────────────
  const handleSelectSuggestion = (s) => {
    setSearchQuery('');
    setSuggestions([]);
    setCoords({ lat: s.lat, lng: s.lng });
    setAddress(s.display_name);
    if (Platform.OS !== 'web') {
      setRegion({ latitude:s.lat, longitude:s.lng, latitudeDelta:0.003, longitudeDelta:0.003 });
    } else {
      setMapKey(k => k + 1);
    }
  };

  // ── GPS current location ──────────────────────────────────────────────────
  const handleGetLocation = async () => {
    setLocLoading(true);
    try {
      let latitude, longitude;
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          Alert.alert('Not Supported', 'Geolocation not supported by this browser.');
          setLocLoading(false); return;
        }
        await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(
            p => { latitude = p.coords.latitude; longitude = p.coords.longitude; res(); },
            e => rej(e),
            { enableHighAccuracy: true, timeout: 12000 }
          );
        });
      } else {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required.');
          setLocLoading(false); return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        latitude  = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }
      setCoords({ lat: latitude, lng: longitude });
      // Reverse geocode via Geoapify
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=en&apiKey=${GEOAPIFY_KEY}`
        );
        const data = await res.json();
        const addr = data.features?.[0]?.properties?.formatted;
        setAddress(addr || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      } catch (_) {
        setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
      if (Platform.OS !== 'web') {
        setRegion({ latitude, longitude, latitudeDelta:0.003, longitudeDelta:0.003 });
      } else {
        setMapKey(k => k + 1);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not get location. Please enable GPS and try again.');
    }
    setLocLoading(false);
  };

  // ── Native: marker drag → reverse geocode via Geoapify ──────────────────
  const handleMarkerDrag = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setCoords({ lat: latitude, lng: longitude });
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=en&apiKey=${GEOAPIFY_KEY}`
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
      Alert.alert('No location', 'Please set a location first.');
      return;
    }
    onConfirm({ address: address.trim(), coords });
    onClose();
  };

  const isDeliver = deliveryType === 'deliver';

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[lpStyles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[lpStyles.sheet, { transform:[{ translateY: slideAnim }] }]}>

          {/* ── Header ── */}
          <View style={lpStyles.header}>
            <Text style={lpStyles.headerIcon}>{isDeliver ? '🛵' : '🏃'}</Text>
            <View style={{ flex:1 }}>
              <Text style={lpStyles.headerTitle}>
                {isDeliver ? 'Set Delivery Location' : 'Set Pick-Up Location'}
              </Text>
              <Text style={lpStyles.headerSub}>
                {isDeliver
                  ? 'Search address or drop pin on map'
                  : 'Search or tap on map to set pick-up point'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={lpStyles.closeBtn}>
              <Text style={lpStyles.closeBtnTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── Address search bar ── */}
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
              />
              {searching && <Text style={{ fontSize:11, color:'rgba(1,31,75,0.45)' }}>…</Text>}
              {searchQuery.length > 0 && !searching && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSuggestions([]); }}>
                  <Text style={{ fontSize:13, color:'rgba(1,31,75,0.40)', paddingHorizontal:4 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <View style={lpStyles.suggestions}>
                {suggestions.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[lpStyles.suggestionItem, i < suggestions.length - 1 && lpStyles.suggestionBorder]}
                    onPress={() => handleSelectSuggestion(s)}
                    activeOpacity={0.70}
                  >
                    <Text style={lpStyles.suggestionPin}>📍</Text>
                    <Text style={lpStyles.suggestionTxt} numberOfLines={2}>{s.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── GPS button ── */}
          <TouchableOpacity
            style={lpStyles.myLocBtn}
            onPress={handleGetLocation}
            activeOpacity={0.80}
            disabled={locLoading}
          >
            <LinearGradient
              colors={isDeliver ? ['#c0392b','#e74c3c'] : ['#1a3a6b','#2c5282']}
              start={{x:0,y:0}} end={{x:1,y:0}}
              style={lpStyles.myLocGrad}
            >
              <Text style={lpStyles.myLocTxt}>
                {locLoading ? '⏳  Getting your location…' : '📡  Use My Current Location'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Map ── */}
          <View style={lpStyles.mapWrap}>
            {Platform.OS !== 'web' && MapView ? (
              /* ─ NATIVE: react-native-maps ─ */
              <>
                <MapView
                  style={{ flex:1 }}
                  region={region}
                  onPress={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    setRegion(r => ({ ...r, latitude, longitude }));
                    handleMarkerDrag({ nativeEvent: { coordinate: { latitude, longitude } } });
                  }}
                  showsUserLocation
                  showsMyLocationButton={false}
                  showsCompass
                  showsScale
                >
                  {coords && (
                    <Marker
                      coordinate={{ latitude: coords.lat, longitude: coords.lng }}
                      draggable
                      onDragEnd={handleMarkerDrag}
                      pinColor={isDeliver ? '#e74c3c' : '#1a3a6b'}
                    />
                  )}
                </MapView>
                {!coords && (
                  <View style={lpStyles.mapHint} pointerEvents="none">
                    <View style={lpStyles.mapHintBubble}>
                      <Text style={lpStyles.mapHintTxt}>👆 Tap anywhere on the map to pin</Text>
                    </View>
                  </View>
                )}
                {coords && (
                  <View style={lpStyles.mapHint} pointerEvents="none">
                    <View style={lpStyles.mapHintBubble}>
                      <Text style={lpStyles.mapHintTxt}>Drag pin to adjust</Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              /* ─ WEB: Leaflet iframe — fully interactive ─ */
              Platform.OS === 'web' ? (
                <iframe
                  key={mapKey}
                  ref={iframeRef}
                  title="Location Map"
                  srcDoc={LEAFLET_HTML(coords?.lat, coords?.lng, isDeliver)}
                  style={{ width:'100%', height:'100%', border:0, borderRadius:14 }}
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <View style={lpStyles.mapPlaceholder}>
                  <Text style={{ fontSize:36 }}>🗺️</Text>
                  <Text style={lpStyles.mapPlaceholderTxt}>Map not available. Use search or GPS.</Text>
                </View>
              )
            )}
          </View>

          {/* ── Selected address display ── */}
          <View style={lpStyles.addrRow}>
            <Text style={lpStyles.addrPin}>{isDeliver ? '📦' : '📍'}</Text>
            <TextInput
              style={lpStyles.addrInput}
              value={address}
              onChangeText={setAddress}
              placeholder={isDeliver ? 'Delivery address will appear here…' : 'Pick-up location will appear here…'}
              placeholderTextColor="rgba(1,31,75,0.35)"
              multiline
            />
            {address.length > 0 && (
              <TouchableOpacity onPress={() => { setAddress(''); setCoords(null); }}>
                <Text style={{ fontSize:13, color:'rgba(1,31,75,0.40)', paddingLeft:4 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Confirm ── */}
          <TouchableOpacity
            style={[lpStyles.confirmBtn, !address.trim() && { opacity:0.40 }]}
            onPress={handleConfirm}
            activeOpacity={0.80}
          >
            <LinearGradient
              colors={isDeliver ? ['#c0392b','#e74c3c'] : ['#27ae60','#2ecc71']}
              start={{x:0,y:0}} end={{x:1,y:0}}
              style={lpStyles.confirmGrad}
            >
              <Text style={lpStyles.confirmTxt}>✅  Confirm Location</Text>
            </LinearGradient>
          </TouchableOpacity>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const lpStyles = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(1,15,40,0.60)', justifyContent:'flex-end' },
  sheet: {
    backgroundColor:'#f0f5f9',
    borderTopLeftRadius:24, borderTopRightRadius:24,
    padding:18, gap:10, maxHeight:'92%',
    shadowColor:'#000', shadowOpacity:0.28, shadowRadius:24, elevation:20,
  },
  header: { flexDirection:'row', alignItems:'center', gap:10, marginBottom:2 },
  headerIcon: { fontSize:26 },
  headerTitle: { fontFamily:'GoogleSans_700Bold', fontSize:15, color:'#0f1e35' },
  headerSub:   { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.50)', marginTop:2 },
  closeBtn: { width:32, height:32, backgroundColor:'rgba(1,31,75,0.08)', borderRadius:16, justifyContent:'center', alignItems:'center' },
  closeBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'rgba(1,31,75,0.55)' },

  // Search
  searchWrap: { position:'relative', zIndex:99 },
  searchRow: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'#fff', borderRadius:12,
    borderWidth:1, borderColor:'rgba(200,218,235,0.90)',
    paddingHorizontal:12, paddingVertical:4, gap:8,
  },
  searchIcon: { fontSize:15 },
  searchInput: { flex:1, fontFamily:'GoogleSans_400Regular', fontSize:13, color:'#0f1e35', paddingVertical:9 },
  suggestions: {
    position:'absolute', top:'100%', left:0, right:0,
    backgroundColor:'#fff', borderRadius:12, marginTop:4,
    borderWidth:1, borderColor:'rgba(200,218,235,0.80)',
    shadowColor:'#000', shadowOpacity:0.14, shadowRadius:12,
    shadowOffset:{width:0,height:4}, elevation:12, overflow:'hidden',
  },
  suggestionItem: { flexDirection:'row', alignItems:'flex-start', paddingHorizontal:14, paddingVertical:11, gap:8 },
  suggestionBorder: { borderBottomWidth:1, borderBottomColor:'rgba(200,218,235,0.50)' },
  suggestionPin: { fontSize:14, paddingTop:1 },
  suggestionTxt: { flex:1, fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.75)', lineHeight:17 },

  // GPS btn
  myLocBtn: { borderRadius:11, overflow:'hidden' },
  myLocGrad: { paddingVertical:11, alignItems:'center' },
  myLocTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#fff' },

  // Map
  mapWrap: {
    height: 230, borderRadius:14, overflow:'hidden',
    backgroundColor:'rgba(200,218,235,0.30)',
    borderWidth:1, borderColor:'rgba(200,218,235,0.70)',
  },
  mapHint: { position:'absolute', bottom:10, left:0, right:0, alignItems:'center' },
  mapHintBubble: { backgroundColor:'rgba(0,0,0,0.55)', borderRadius:20, paddingHorizontal:14, paddingVertical:6 },
  mapHintTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#fff' },
  mapPlaceholder: { flex:1, justifyContent:'center', alignItems:'center', gap:8 },
  mapPlaceholderTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.45)', textAlign:'center', paddingHorizontal:24 },

  // Address row
  addrRow: {
    flexDirection:'row', alignItems:'flex-start',
    backgroundColor:'#fff', borderRadius:12,
    borderWidth:1, borderColor:'rgba(200,218,235,0.90)',
    paddingHorizontal:12, paddingVertical:4, gap:8,
  },
  addrPin: { fontSize:18, paddingTop:8 },
  addrInput: { flex:1, fontFamily:'GoogleSans_400Regular', fontSize:12, color:'#0f1e35', paddingVertical:9, minHeight:38, maxHeight:72 },

  // Confirm
  confirmBtn: { borderRadius:12, overflow:'hidden' },
  confirmGrad: { paddingVertical:14, alignItems:'center' },
  confirmTxt: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#fff' },
});



// ─── IMAGE ZOOM MODAL ─────────────────────────────────────────────────────────
const ImageZoomModal = ({ visible, item, onClose }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue:1, duration:220, useNativeDriver:true }),
        Animated.spring(scaleAnim, { toValue:1, tension:70, friction:11, useNativeDriver:true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
    }
  }, [visible]);
  if (!item) return null;
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex:1, backgroundColor:'rgba(1,15,40,0.80)', justifyContent:'center', alignItems:'center', opacity:fadeAnim }}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose}/>
        <Animated.View style={{ alignItems:'center', gap:16, transform:[{scale:scaleAnim}] }}>
          {/* Image or emoji */}
          <View style={{ width:220, height:220, borderRadius:110, overflow:'hidden', backgroundColor:'rgba(240,246,252,0.95)', borderWidth:3, borderColor:'rgba(255,255,255,0.90)', shadowColor:'#000', shadowOpacity:0.30, shadowRadius:20, elevation:16, justifyContent:'center', alignItems:'center' }}>
            {item.image
              ? <Image source={{ uri:item.image }} style={{ width:'100%', height:'100%' }} resizeMode="cover"/>
              : <Text style={{ fontSize:90 }}>{item.emoji}</Text>
            }
          </View>
          {/* Info */}
          <View style={{ alignItems:'center', gap:6 }}>
            <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:18, color:'#fff', textAlign:'center', paddingHorizontal:20 }}>{item.name}</Text>
            <Text style={{ fontFamily:'NotoSerif_700Bold', fontSize:22, color:'#c9a84c' }}>₱{item.price}.00</Text>
            <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:13, color:'rgba(255,255,255,0.60)' }}>Stock: {item.stock}</Text>
          </View>
          {/* Close hint */}
          <TouchableOpacity onPress={onClose} style={{ paddingHorizontal:28, paddingVertical:10, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:20, borderWidth:1, borderColor:'rgba(255,255,255,0.30)' }}>
            <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#fff' }}>✕  Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── FOOD CARD — static Add To Cart only, no inline qty ───────────────────────
const FoodCard = ({ item, onAdd }) => {
  const [zoomed, setZoomed] = useState(false);
  return (
    <View style={styles.foodCard}>
      {Platform.OS === 'web' ? (
        <LinearGradient
          colors={['rgba(220,232,242,0.80)','rgba(200,218,235,0.60)']}
          start={{x:0,y:0}} end={{x:0,y:1}}
          style={styles.foodCardInner}
        >
          <FoodCardBody item={item} onAdd={onAdd} onZoom={() => setZoomed(true)} />
        </LinearGradient>
      ) : (
        <View style={[styles.foodCardInner, { backgroundColor:'rgba(225,238,248,0.85)' }]}>
          <FoodCardBody item={item} onAdd={onAdd} onZoom={() => setZoomed(true)} />
        </View>
      )}
      <ImageZoomModal visible={zoomed} item={item} onClose={() => setZoomed(false)} />
    </View>
  );
};

const FoodCardBody = ({ item, onAdd, onZoom }) => (
  <>
    <TouchableOpacity style={styles.emojiCircle} onPress={onZoom} activeOpacity={0.80}>
      {item.image
        ? <Image source={{ uri: item.image }} style={{ width:'100%', height:'100%', borderRadius:99 }} resizeMode="cover" />
        : <Text style={styles.emojiText}>{item.emoji}</Text>
      }
    </TouchableOpacity>
    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
    <Text style={styles.itemStock}>Stock: {item.stock}</Text>
    <Text style={styles.itemPrice}>₱{item.price}.00</Text>
    <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
      <Text style={styles.addBtnText}>Add To Cart</Text>
    </TouchableOpacity>
  </>
);

// ─── RECEIPT MODAL ────────────────────────────────────────────────────────────
const ReceiptModal = ({ visible, orderData, onClose, onPrint, receiptViewRef }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue:1, duration:280, useNativeDriver:true }),
        Animated.spring(slideAnim, { toValue:0, tension:70, friction:12, useNativeDriver:true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(60);
    }
  }, [visible]);

  if (!orderData) return null;
  const { items, total, amountPaid, change, orderNo, time, paymentMode } = orderData;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.receiptOverlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <Animated.View
          ref={receiptViewRef}
          style={[styles.receiptCard, { transform:[{ translateY: slideAnim }] }]}
          {...(Platform.OS === 'web' ? { 'data-receipt-card': 'true' } : {})}
        >

          {/* Jagged top edge */}
          <View style={styles.receiptJaggedTop}>
            {Array.from({ length: 18 }).map((_,i) => (
              <View key={i} style={styles.receiptJaggedTriangle} />
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Header */}
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptShopName}>🍽️  CLIMBS CANTEEN</Text>
              <Text style={styles.receiptShopSub}>Canteen Ordering System</Text>
              <View style={styles.receiptDividerDashed} />
              <Text style={styles.receiptMeta}>Order No.: #{orderNo}</Text>
              <Text style={styles.receiptMeta}>{time}</Text>
              <Text style={styles.receiptMeta}>
                {orderData.deliveryType === 'deliver' ? '🛵 Deliver' : '🏃 Pick Up'}
                {'  |  '}{paymentMode === 'gcash' ? '📱 GCash' : paymentMode === 'credit' ? '🪙 Credit' : '💵 Cash'}
              </Text>
              {orderData.deliveryLocation ? (
                <Text style={styles.receiptMeta}>
                  {orderData.deliveryType === 'deliver' ? '📦 To: ' : '📍 At: '}{orderData.deliveryLocation}
                </Text>
              ) : null}
              <View style={styles.receiptDividerDashed} />
            </View>

            {/* Items */}
            <View style={{ paddingHorizontal: 20 }}>
              <View style={styles.receiptItemHeader}>
                <Text style={[styles.receiptItemHCol, { flex:1 }]}>ITEM</Text>
                <Text style={[styles.receiptItemHCol, { width:32, textAlign:'center' }]}>QTY</Text>
                <Text style={[styles.receiptItemHCol, { width:64, textAlign:'right' }]}>AMOUNT</Text>
              </View>
              <View style={styles.receiptDividerSolid} />
              {items.map(({ item, qty }) => (
                <View key={item.id} style={styles.receiptItemRow}>
                  <Text style={[styles.receiptItemText, { flex:1 }]} numberOfLines={1}>
                    {item.emoji} {item.name}
                  </Text>
                  <Text style={[styles.receiptItemText, { width:32, textAlign:'center' }]}>{qty}</Text>
                  <Text style={[styles.receiptItemText, { width:64, textAlign:'right' }]}>
                    ₱{(item.price * qty).toFixed(2)}
                  </Text>
                </View>
              ))}
              <View style={styles.receiptDividerSolid} />

              {/* Totals */}
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptSubTotalLabel}>Subtotal</Text>
                <Text style={styles.receiptSubTotalValue}>₱ {(orderData.subtotal ?? total).toFixed(2)}</Text>
              </View>
              {orderData.deliveryType === 'deliver' && (
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptSubTotalLabel}>🛵 Delivery Fee</Text>
                  <Text style={[styles.receiptSubTotalValue, { color:'#e74c3c' }]}>₱ {(orderData.deliveryFee ?? 0).toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptTotalLabel}>TOTAL</Text>
                <Text style={styles.receiptTotalValue}>₱ {total.toFixed(2)}</Text>
              </View>
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptSubTotalLabel}>Cash</Text>
                <Text style={styles.receiptSubTotalValue}>₱ {parseFloat(amountPaid || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptSubTotalLabel}>Change</Text>
                <Text style={[styles.receiptSubTotalValue, { color: change < 0 ? '#e74c3c' : '#27ae60' }]}>
                  ₱ {change.toFixed(2)}
                </Text>
              </View>

              <View style={styles.receiptDividerDashed} />
              <Text style={styles.receiptThankYou}>Thank you for your order! 🙏</Text>
              <Text style={styles.receiptFooter}>— CLIMBS Canteen © 2025 —</Text>
            </View>
          </ScrollView>

          {/* Jagged bottom edge */}
          <View style={styles.receiptJaggedBottom}>
            {Array.from({ length: 18 }).map((_,i) => (
              <View key={i} style={styles.receiptJaggedTriangleBottom} />
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.receiptActions}>
            <TouchableOpacity style={styles.receiptCloseBtn} onPress={onClose}>
              <Text style={styles.receiptCloseBtnText}>✕  Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.receiptPrintBtn} onPress={onPrint}>
              <LinearGradient
                colors={['#1a3a6b','#2c5282']}
                start={{x:0,y:0}} end={{x:1,y:0}}
                style={styles.receiptPrintBtnGrad}
              >
                <Text style={styles.receiptPrintBtnText}>⬇️  Download as Image</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── CART PANEL ───────────────────────────────────────────────────────────────
const CartPanel = ({ cart, onAdd, onRemove, onClear, onOrder, onPlaceOrder, isWide, hideTitle, lastOrder, onShowReceipt, orderHistory = [] }) => {
  const [checked, setChecked] = useState({});
  const [paymentMode, setPaymentMode] = useState('cash');
  const [deliveryType, setDeliveryType] = useState('pickup');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [locPickerVisible, setLocPickerVisible] = useState(false);

  // ── Canteen coords (origin for delivery distance) ──────────────────────────
  const CANTEEN_LAT = 8.4748; // update to your actual canteen coordinates
  const CANTEEN_LNG = 124.6465;
  const DELIVERY_BASE = 15;
  const DELIVERY_PER_KM = 5;

  const getDistanceKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const deliveryFee = (deliveryType === 'deliver' && deliveryCoords)
    ? Math.round(DELIVERY_BASE + getDistanceKm(CANTEEN_LAT, CANTEEN_LNG, deliveryCoords.lat, deliveryCoords.lng) * DELIVERY_PER_KM)
    : 0;

  const cartItems = Object.values(cart).filter(i => i.qty > 0);

  // Auto-check new items when added
  useEffect(() => {
    setChecked(prev => {
      const updated = { ...prev };
      cartItems.forEach(({ item }) => {
        if (updated[item.id] === undefined) updated[item.id] = true;
      });
      return updated;
    });
  }, [JSON.stringify(cartItems.map(i => i.item.id))]);

  // Reset location when switching to pick up
  useEffect(() => {
    if (deliveryType === 'pickup') {
      setDeliveryLocation('');
      setDeliveryCoords(null);
    }
  }, [deliveryType]);

  const toggleCheck = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const checkedItems = cartItems.filter(({ item }) => checked[item.id]);
  const subtotal = checkedItems.reduce((s, { item, qty }) => s + item.price * qty, 0);
  const total = subtotal + deliveryFee;

  const handlePlaceOrder = () => {
    if (checkedItems.length === 0) return;
    if (deliveryType === 'deliver' && !deliveryLocation.trim()) {
      Alert.alert('No delivery location', 'Please set your delivery location first.');
      setLocPickerVisible(true);
      return;
    }
    const orderNo = Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const time = now.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })
      + '  ' + now.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
    onPlaceOrder({ items: checkedItems, subtotal, deliveryFee, total, amountPaid: total, change: 0, orderNo, time, paymentMode, deliveryType, deliveryLocation });
  };

  return (
    <>
    <View style={[styles.cartPanel, !isWide && styles.cartPanelMobile]}>
      {!hideTitle && <Text style={styles.cartPanelTitle}>CART</Text>}

        {/* Items list with checkboxes */}
        <View style={styles.cartItemsBox}>
          {cartItems.length === 0 ? (
            <Text style={styles.cartEmpty}>Cart is empty.</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
              {cartItems.map(({ item, qty }) => (
                <View key={item.id} style={styles.cartRow}>
                  {/* Checkbox */}
                  <TouchableOpacity
                    style={[styles.checkbox, checked[item.id] && styles.checkboxChecked]}
                    onPress={() => toggleCheck(item.id)}
                  >
                    {checked[item.id] && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                  <Text style={styles.cartRowEmoji}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartRowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cartRowSub}>x{qty}  ₱{item.price * qty}</Text>
                  </View>
                  <View style={styles.cartRowQty}>
                    <TouchableOpacity style={styles.cartQBtn} onPress={() => onRemove(item)}>
                      <Text style={styles.cartQBtnText}>−</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cartQBtn, styles.cartQBtnAdd]} onPress={() => onAdd(item)}>
                      <Text style={[styles.cartQBtnText, {color:'#fff'}]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Total — based on checked items only */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal :</Text>
          <Text style={styles.totalValue}>₱ {subtotal.toFixed(2)}</Text>
        </View>
        {deliveryType === 'deliver' && (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontSize:12, color: deliveryCoords ? '#e74c3c' : 'rgba(1,31,75,0.45)' }]}>
              🛵 Delivery Fee {deliveryCoords ? `(${getDistanceKm(CANTEEN_LAT, CANTEEN_LNG, deliveryCoords.lat, deliveryCoords.lng).toFixed(1)} km)` : ''}:
            </Text>
            <Text style={[styles.totalValue, { fontSize:13, color: deliveryCoords ? '#e74c3c' : 'rgba(1,31,75,0.45)' }]}>
              {deliveryCoords ? `₱ ${deliveryFee.toFixed(2)}` : '—'}
            </Text>
          </View>
        )}
        <View style={[styles.totalRow, { borderTopWidth:1, borderColor:'rgba(1,31,75,0.12)', paddingTop:6, marginTop:2 }]}>
          <Text style={styles.totalLabel}>Total :</Text>
          <Text style={styles.totalValue}>₱ {total.toFixed(2)}</Text>
        </View>

        {/* Mode of Payment */}
        <View style={styles.paymentModeBox}>
          <Text style={styles.paymentModeLabel}>Mode of Payment</Text>
          <View style={styles.paymentModeRow}>
            <TouchableOpacity style={styles.paymentModeOption} onPress={() => setPaymentMode('cash')} activeOpacity={0.8}>
              <View style={[styles.radioOuter, paymentMode === 'cash' && styles.radioOuterActive]}>
                {paymentMode === 'cash' && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.paymentModeText, paymentMode === 'cash' && styles.paymentModeTextActive]}>💵 Cash</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.paymentModeOption} onPress={() => setPaymentMode('gcash')} activeOpacity={0.8}>
              <View style={[styles.radioOuter, paymentMode === 'gcash' && styles.radioOuterActive]}>
                {paymentMode === 'gcash' && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.paymentModeText, paymentMode === 'gcash' && styles.paymentModeTextActive]}>📱 GCash</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.paymentModeOption} onPress={() => setPaymentMode('credit')} activeOpacity={0.8}>
              <View style={[styles.radioOuter, paymentMode === 'credit' && styles.radioOuterActive]}>
                {paymentMode === 'credit' && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.paymentModeText, paymentMode === 'credit' && styles.paymentModeTextActive]}>🪙 Credit</Text>
            </TouchableOpacity>
          </View>
          {paymentMode === 'credit' && (
            <View style={{ marginTop: 6, backgroundColor: 'rgba(201,168,76,0.14)', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: 'rgba(201,168,76,0.40)' }}>
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: 'rgba(1,31,75,0.75)', lineHeight: 15 }}>
                ⚠️ Credit orders will be charged to your member account and must be settled on payday.
              </Text>
            </View>
          )}
        </View>


        {/* ── Order Type (Pick Up / Deliver) ── */}
        <View style={delivStyles.box}>
          <Text style={delivStyles.sectionLabel}>Order Type</Text>
          <View style={delivStyles.toggleRow}>
            <TouchableOpacity
              style={[delivStyles.toggleBtn, deliveryType === 'pickup' && delivStyles.toggleBtnActive]}
              onPress={() => setDeliveryType('pickup')}
              activeOpacity={0.80}
            >
              <Text style={delivStyles.toggleIcon}>🏃</Text>
              <Text style={[delivStyles.toggleTxt, deliveryType === 'pickup' && delivStyles.toggleTxtActive]}>Pick Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[delivStyles.toggleBtn, deliveryType === 'deliver' && delivStyles.toggleBtnActiveDeliver]}
              onPress={() => { setDeliveryType('deliver'); setLocPickerVisible(true); }}
              activeOpacity={0.80}
            >
              <Text style={delivStyles.toggleIcon}>🛵</Text>
              <Text style={[delivStyles.toggleTxt, deliveryType === 'deliver' && delivStyles.toggleTxtActiveDeliver]}>Deliver</Text>
            </TouchableOpacity>
          </View>
          {/* ── Delivery location row — only shown when Deliver is selected ── */}
          {deliveryType === 'deliver' && (
            <TouchableOpacity
              style={[delivStyles.mapTrigger, deliveryLocation ? delivStyles.mapTriggerSet : delivStyles.mapTriggerUnset]}
              onPress={() => setLocPickerVisible(true)}
              activeOpacity={0.80}
            >
              <Text style={delivStyles.mapTriggerPin}>📦</Text>
              <Text style={[delivStyles.mapTriggerTxt, deliveryLocation && delivStyles.mapTriggerTxtSet]} numberOfLines={2}>
                {deliveryLocation || 'Tap to set delivery location…'}
              </Text>
              <Text style={delivStyles.mapTriggerChevron}>{deliveryLocation ? '✏️' : '🗺️'}</Text>
            </TouchableOpacity>
          )}

        </View>

        {/* ── Place Order button ── */}
        <TouchableOpacity
          style={[styles.placeOrderBtn, checkedItems.length === 0 && styles.placeOrderBtnDisabled]}
          onPress={handlePlaceOrder}
          activeOpacity={checkedItems.length === 0 ? 1 : 0.80}
        >
          <LinearGradient
            colors={checkedItems.length > 0 ? ['#27ae60','#2ecc71'] : ['#aaa','#bbb']}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={styles.placeOrderGrad}
          >
            <Text style={styles.placeOrderIcon}>✅</Text>
            <Text style={styles.placeOrderText}>Place Order ({checkedItems.length})</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Clear cart button ── */}
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={onClear}
          activeOpacity={0.80}
        >
          <Text style={styles.clearBtnIcon}>🗑️</Text>
          <Text style={styles.clearBtnText}>Clear Cart</Text>
        </TouchableOpacity>

        {/* ── Download Receipt button ── */}
        <TouchableOpacity
          style={[styles.printBtn, !lastOrder && { opacity: 0.45 }]}
          onPress={lastOrder ? onShowReceipt : null}
          activeOpacity={0.80}
        >
          <Text style={styles.printBtnIcon}>⬇️</Text>
          <Text style={styles.printBtnText}>Download Receipt</Text>
        </TouchableOpacity>

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

// ─── QUEUE STATUS MODAL ───────────────────────────────────────────────────────
// Shows after order placement: tracks pending → preparing → ready → done
// Can be minimised to a floating pill; re-expands when status changes.
const QUEUE_STEPS = [
  { key: 'pending',   icon: '🕐', label: 'Order Placed',       sub: 'Your order has been received!'         },
  { key: 'preparing', icon: '🔥', label: 'Preparing Your Order', sub: 'The canteen is cooking your food.'   },
  { key: 'ready',     icon: '✅', label: 'Ready to Pick Up',    sub: 'Your order is ready! Please proceed to the canteen.' },
  { key: 'done',      icon: '🎉', label: 'Order Complete',      sub: 'Thank you for ordering!'               },
];

const QueueStatusModal = ({ visible, orderId, orderNo, currentStatus, onClose, onMinimize, minimized }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevStatus = useRef(null);

  // Entrance animation
  useEffect(() => {
    if (visible && !minimized) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue:1, duration:300, useNativeDriver:true }),
        Animated.spring(slideAnim, { toValue:0, tension:65, friction:11, useNativeDriver:true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
    }
  }, [visible, minimized]);

  // Pulse the current step icon
  useEffect(() => {
    if (currentStatus === 'done') { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [currentStatus]);

  const stepIdx   = QUEUE_STEPS.findIndex(s => s.key === currentStatus);
  const activeStep = QUEUE_STEPS[stepIdx] || QUEUE_STEPS[0];
  const isDone = currentStatus === 'done';

  if (!visible) return null;

  // ── Minimized pill — renders as an absolute overlay (not in Modal) ──
  if (minimized) {
    if (currentStatus === 'done') return null;
    const pillColor = currentStatus === 'ready' ? '#27ae60' : currentStatus === 'preparing' ? '#e67e22' : '#1a3a6b';
    return (
      <View style={[qs.pill, { backgroundColor: pillColor }]} pointerEvents="box-none">
        <TouchableOpacity
          style={{ flexDirection:'row', alignItems:'center', flex:1, gap:8 }}
          onPress={onMinimize}
          activeOpacity={0.85}
        >
          <Text style={qs.pillIcon}>{activeStep.icon}</Text>
          <Text style={qs.pillText}>Order #{orderNo} — {activeStep.label}</Text>
          <Text style={qs.pillChevron}>▲</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onMinimize}>
      <Animated.View style={[qs.overlay, { opacity: fadeAnim }]}>
        {/* Tap backdrop to minimise */}
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onMinimize} />
        <Animated.View style={[qs.card, { transform: [{ translateY: slideAnim }] }]}>

          {/* Header */}
          <View style={qs.header}>
            <Text style={qs.headerTitle}>🍽️  Order Queue</Text>
            <Text style={qs.headerOrder}>#{orderNo}</Text>
            <TouchableOpacity style={qs.minBtn} onPress={onMinimize}>
              <Text style={qs.minBtnTxt}>—</Text>
            </TouchableOpacity>
          </View>

          {/* Step tracker */}
          <View style={qs.stepsRow}>
            {QUEUE_STEPS.filter(s => s.key !== 'done').map((step, i) => {
              const stepI = QUEUE_STEPS.filter(s => s.key !== 'done').indexOf(step);
              const activeI = QUEUE_STEPS.filter(s => s.key !== 'done').findIndex(s => s.key === currentStatus);
              const done    = stepI < activeI || isDone;
              const active  = step.key === currentStatus && !isDone;
              const isLast  = stepI === 2;
              return (
                <React.Fragment key={step.key}>
                  <View style={qs.stepItem}>
                    <Animated.View style={[
                      qs.stepCircle,
                      done  && qs.stepCircleDone,
                      active && qs.stepCircleActive,
                      active && { opacity: pulseAnim },
                    ]}>
                      <Text style={qs.stepCircleIcon}>{done ? '✓' : step.icon}</Text>
                    </Animated.View>
                    <Text style={[qs.stepLabel, (done || active) && qs.stepLabelActive]}>{step.label}</Text>
                  </View>
                  {!isLast && (
                    <View style={[qs.stepLine, done && qs.stepLineDone]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* Active step detail */}
          <View style={[qs.statusBox, currentStatus === 'ready' && qs.statusBoxReady]}>
            <Text style={qs.statusIcon}>{activeStep.icon}</Text>
            <View style={{ flex:1 }}>
              <Text style={[qs.statusLabel, currentStatus === 'ready' && { color:'#27ae60' }]}>{activeStep.label}</Text>
              <Text style={qs.statusSub}>{activeStep.sub}</Text>
            </View>
          </View>

          {/* Action buttons */}
          {isDone && (
            <TouchableOpacity style={qs.closeBtn} onPress={onClose}>
              <LinearGradient colors={['#27ae60','#2ecc71']} start={{x:0,y:0}} end={{x:1,y:0}} style={qs.closeBtnGrad}>
                <Text style={qs.closeBtnTxt}>🎉  Close</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const qs = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(1,20,50,0.45)', justifyContent:'center', alignItems:'center', padding:24 },
  card: { backgroundColor:'#f0f5f9', borderRadius:24, padding:22, gap:14, shadowColor:'#000', shadowOpacity:0.22, shadowRadius:24, elevation:16, width:'100%', maxWidth:360, alignSelf:'center', margin:16 },
  header: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:2 },
  headerTitle: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#011f4b', flex:1 },
  headerOrder: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'rgba(1,31,75,0.45)' },
  minBtn: { width:28, height:28, backgroundColor:'rgba(1,31,75,0.08)', borderRadius:14, justifyContent:'center', alignItems:'center' },
  minBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'rgba(1,31,75,0.50)', lineHeight:16 },

  stepsRow: { flexDirection:'row', alignItems:'center', paddingHorizontal:4, marginVertical:6 },
  stepItem: { alignItems:'center', gap:4, flex:0 },
  stepCircle: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(1,31,75,0.10)', justifyContent:'center', alignItems:'center', borderWidth:2, borderColor:'rgba(1,31,75,0.15)' },
  stepCircleDone:   { backgroundColor:'#27ae60', borderColor:'#27ae60' },
  stepCircleActive: { backgroundColor:'#1a3a6b', borderColor:'#c9a84c', borderWidth:3 },
  stepCircleIcon: { fontSize:15 },
  stepLabel: { fontFamily:'GoogleSans_400Regular', fontSize:7.5, color:'rgba(1,31,75,0.40)', textAlign:'center', maxWidth:60, lineHeight:10 },
  stepLabelActive: { fontFamily:'GoogleSans_700Bold', color:'#1a3a6b' },
  stepLine: { flex:1, height:2, backgroundColor:'rgba(1,31,75,0.12)', marginHorizontal:3, marginBottom:14 },
  stepLineDone: { backgroundColor:'#27ae60' },

  statusBox: { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'rgba(26,58,107,0.08)', borderRadius:12, padding:12, borderWidth:1, borderColor:'rgba(26,58,107,0.12)' },
  statusBoxReady: { backgroundColor:'rgba(39,174,96,0.10)', borderColor:'rgba(39,174,96,0.30)' },
  statusIcon: { fontSize:26 },
  statusLabel: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#1a3a6b', marginBottom:2 },
  statusSub:   { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)', lineHeight:16 },

  actions: { flexDirection:'row', gap:8, marginTop:6 },
  minimizeBtn: { flex:1, paddingVertical:10, borderRadius:10, backgroundColor:'rgba(1,31,75,0.08)', alignItems:'center' },
  minimizeBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'rgba(1,31,75,0.55)' },
  closeBtn: { flex:1, borderRadius:10, overflow:'hidden' },
  closeBtnGrad: { paddingVertical:10, alignItems:'center' },
  closeBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#fff' },

  // Minimized pill
  pill: { position:'absolute', bottom:24, left:16, right:16, zIndex:999, borderRadius:30, flexDirection:'row', alignItems:'center', paddingVertical:12, paddingHorizontal:16, gap:8, shadowColor:'#000', shadowOpacity:0.22, shadowRadius:12, elevation:12 },
  pillIcon: { fontSize:18 },
  pillText: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#fff', flex:1 },
  pillChevron: { fontSize:10, color:'rgba(255,255,255,0.70)' },
});

// ─── BOTTOM SHEET CART (Mobile) ───────────────────────────────────────────────
const CartBottomSheet = ({ cart, onAdd, onRemove, onClear, onOrder, onClose, onPlaceOrder, lastOrder, onShowReceipt, orderHistory = [] }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [activeSheetTab, setActiveSheetTab] = useState('cart');

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }).start();
  }, []);

  const translateY = slideAnim.interpolate({ inputRange:[0,1], outputRange:[600,0] });

  const fmtDate = ts => {
    if (!ts) return '';
    try { const d = ts?.toDate?.() || new Date(ts); return d.toLocaleDateString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); } catch { return ''; }
  };

  return (
    <View style={styles.sheetOverlay}>
      <TouchableOpacity style={styles.sheetBackdrop} onPress={onClose} activeOpacity={1} />
      <Animated.View style={[styles.sheet, { transform:[{ translateY }] }]}>
        <View style={styles.sheetHandle} />
        {/* Tab row: Cart | History */}
        <View style={styles.sheetHeader}>
          <View style={{ flexDirection:'row', flex:1, backgroundColor:'rgba(1,31,75,0.08)', borderRadius:10, padding:3, gap:3 }}>
            {[['cart','🛒 Cart'],['history','📋 History']].map(([key, label]) => (
              <TouchableOpacity key={key} onPress={() => setActiveSheetTab(key)}
                style={[{ flex:1, paddingVertical:7, alignItems:'center', borderRadius:8 },
                  activeSheetTab === key && { backgroundColor:'#fff', shadowColor:'#000', shadowOpacity:0.10, shadowRadius:4, elevation:2 }]}>
                <Text style={{ fontFamily: activeSheetTab === key ? 'GoogleSans_700Bold' : 'GoogleSans_400Regular', fontSize:12, color: activeSheetTab === key ? '#0f1e35' : 'rgba(1,31,75,0.55)' }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
            <Text style={{ color:'rgba(1,31,75,0.6)', fontSize:14 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab content */}
        {activeSheetTab === 'cart' ? (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow:1 }}>
            <CartPanel
              cart={cart} onAdd={onAdd} onRemove={onRemove}
              onClear={onClear} onOrder={onOrder} isWide={false}
              hideTitle={true} onPlaceOrder={onPlaceOrder}
              lastOrder={lastOrder} onShowReceipt={onShowReceipt}
              orderHistory={orderHistory}
            />
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:14, flexGrow:1 }}>
            {orderHistory.length === 0 ? (
              <View style={{ alignItems:'center', paddingVertical:40 }}>
                <Text style={{ fontSize:36, marginBottom:10 }}>📋</Text>
                <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:13, color:'rgba(1,31,75,0.45)', textAlign:'center' }}>No orders yet.</Text>
              </View>
            ) : (
              orderHistory.map((order, idx) => {
                const items = order.items || [];
                const total = order.total || 0;
                const pm    = order.payment || order.paymentMode || order.paymentMethod || 'cash';
                const pmBg  = pm === 'credit' || pm === 'Credit' ? 'rgba(245,166,35,0.20)' : pm === 'gcash' || pm === 'GCash' ? 'rgba(111,163,247,0.20)' : 'rgba(46,204,113,0.20)';
                const pmBorder = pm === 'credit' || pm === 'Credit' ? 'rgba(245,166,35,0.55)' : pm === 'gcash' || pm === 'GCash' ? 'rgba(111,163,247,0.55)' : 'rgba(46,204,113,0.55)';
                return (
                  <View key={order.docId || idx} style={{ backgroundColor:'rgba(255,255,255,0.45)', borderRadius:14, padding:14, marginBottom:10, borderWidth:1.5, borderColor:'rgba(255,255,255,0.70)' }}>
                    <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <View>
                        <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#0f1e35' }}>#{order.orderNo || order.orderId || '—'}</Text>
                        <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(1,31,75,0.50)', marginTop:2 }}>{fmtDate(order.createdAt || order.time)}</Text>
                      </View>
                      <View style={{ paddingHorizontal:10, paddingVertical:4, borderRadius:20, backgroundColor: pmBg, borderWidth:1, borderColor: pmBorder }}>
                        <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#0f1e35', letterSpacing:1, textTransform:'uppercase' }}>{pm}</Text>
                      </View>
                    </View>
                    <View style={{ marginBottom:8, paddingBottom:8, borderBottomWidth:1, borderColor:'rgba(1,31,75,0.07)' }}>
                      {items.map((it, j) => {
                        const item = it.item || it;
                        const qty  = it.qty || it.quantity || 1;
                        return (
                          <Text key={j} style={{ fontFamily:'GoogleSans_400Regular', fontSize:12, color:'#0f1e35', marginBottom:3, lineHeight:18 }}>
                            {item.emoji || '🍽️'} {item.name} x{qty} — ₱{(item.price * qty).toFixed(2)}
                          </Text>
                        );
                      })}
                    </View>
                    <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#c9a84c' }}>Total: ₱{Number(total).toFixed(2)}</Text>
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
const AdBanner = ({ isWide, adAnim, ads, navigation }) => {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef(null);
  const { width } = useWindowDimensions();

  // ── Filter: show only ads targeted to 'member' or 'both' ───────────────────
  const filteredAds = ads && ads.length > 0
    ? ads.filter(ad => !ad.target || ad.target === 'both' || ad.target === 'member')
    : [];

  const ADS = filteredAds.length > 0 ? filteredAds : [
    { id:1, bg:['#1a3a6b','#2e5fa3'], emoji:'🍽️', title:"Today's Special", sub:'Fresh meals served daily!' },
    { id:2, bg:['#7b3f00','#c9a84c'], emoji:'☕',  title:'Merienda Promo',   sub:'Snacks & drinks available!' },
  ];

  // Reset current index when ADS list changes to avoid out-of-bounds
  useEffect(() => {
    setCurrent(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [ADS.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(prev => {
        const next = (prev + 1) % ADS.length;
        scrollRef.current?.scrollTo({ x: next * bannerW, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [ADS.length]);

  const bannerW = isWide ? Math.min(width * 0.55, 700) : width - 48;

  const handleScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / bannerW);
    setCurrent(idx);
  };

  // Mobile: animate show/hide via adAnim (1=visible 0=hidden)
  const mobileAnimStyle = (!isWide && adAnim) ? {
    overflow: 'hidden',
    height: adAnim.interpolate({ inputRange:[0,1], outputRange:[0, 128] }),
    opacity: adAnim.interpolate({ inputRange:[0,1], outputRange:[0, 1] }),
    marginBottom: adAnim.interpolate({ inputRange:[0,1], outputRange:[0, 8] }),
  } : {};

  return (
    <Animated.View style={[{ alignSelf:'stretch' }, mobileAnimStyle]}>
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={{ width: bannerW, alignSelf:'center' }}
        contentContainerStyle={{ width: bannerW * ADS.length }}
      >
        {ADS.map((ad) => {
          const handleAdPress = () => {
            if (!ad.url) return;
            if (ad.url === 'coop://home') {
              navigation && navigation.navigate('CoopScreen', { view: 'register' });
            } else if (Platform.OS === 'web') {
              window.open(ad.url, '_blank');
            } else {
              import('react-native').then(({ Linking }) => Linking.openURL(ad.url));
            }
          };
          return (
          <LinearGradient
            key={ad.id}
            colors={ad.bg || ['#1a3a6b','#2e5fa3']}
            start={{ x:0, y:0 }} end={{ x:1, y:1 }}
            style={[adStyles.slide, { width: bannerW }]}
          >
            {(ad.image || ad.imageUrl)
              ? <Image source={{ uri: ad.image || ad.imageUrl }} style={{ position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:16 }} resizeMode="cover" />
              : <Text style={adStyles.adEmoji}>{ad.emoji}</Text>
            }
            <TouchableOpacity style={{ flex:1 }} onPress={handleAdPress} activeOpacity={ad.url ? 0.80 : 1}>
              <Text style={adStyles.adTitle}>{ad.title}</Text>
              <Text style={adStyles.adSub}>{ad.sub}</Text>
              {ad.url ? <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(255,255,255,0.70)', marginTop:2 }}>🔗 Tap to open</Text> : null}
            </TouchableOpacity>
            <View style={adStyles.adBadge}>
              <Text style={adStyles.adBadgeTxt}>AD</Text>
            </View>
            {/* Dots inside card */}
            <View style={adStyles.dotsInner}>
              {ADS.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => {
                  scrollRef.current?.scrollTo({ x: i * bannerW, animated: true });
                  setCurrent(i);
                }}>
                  <View style={[adStyles.dot, current === i && adStyles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
};

const adStyles = StyleSheet.create({
  slide: {
    height: 120, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 20,
    gap: 16, overflow: 'hidden',
  },
  adEmoji: { fontSize: 52 },
  adTitle: { fontFamily:'GoogleSans_700Bold', fontSize:18, color:'#fff' },
  adSub:   { fontFamily:'GoogleSans_400Regular', fontSize:14, color:'rgba(255,255,255,0.85)' },
  adBadge: {
    position:'absolute', top:10, right:12,
    backgroundColor:'rgba(255,255,255,0.25)',
    borderRadius:4, paddingHorizontal:7, paddingVertical:3,
  },
  adBadgeTxt: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#fff', letterSpacing:1 },
  dotsInner: {
    position:'absolute', bottom:7, left:0, right:0,
    flexDirection:'row', justifyContent:'center', gap:5,
  },
  dot:       { width:7, height:7, borderRadius:4, backgroundColor:'rgba(255,255,255,0.40)' },
  dotActive: { backgroundColor:'#fff', width:18 },
});

// ─── CREDIT ORDER CARD — top-level component (hooks not allowed inside IIFEs) ──
const fmtCreditDate = (ts) => {
  try {
    let d;
    if (!ts) return '—';
    if (ts?.toDate) d = ts.toDate();
    else if (typeof ts === 'number') d = new Date(ts);
    else d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })
      + ' · ' + d.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', hour12:true });
  } catch { return '—'; }
};

const CreditOrderCard = ({ order }) => {
  const orderItems  = order.items || [];
  const total       = Number(order.total || 0);
  const isSettled   = order.settled === true;
  const stripeColor = isSettled ? '#27ae60' : '#c9a84c';
  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.58)',
      borderRadius:10, marginBottom:6,
      borderWidth:1, borderColor:'rgba(255,255,255,0.78)',
      overflow:'hidden', flexDirection:'row',
    }}>
      {/* Left accent stripe */}
      <View style={{ width:3, backgroundColor: stripeColor }} />

      <View style={{ flex:1, padding:10, paddingLeft:12, gap:5 }}>
        {/* Top row: order# + badge + amount */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
          <View style={{ flex:1, gap:2 }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:7 }}>
              <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#0f1e35' }}>
                #{order.orderNo || '—'}
              </Text>
              <View style={{
                paddingHorizontal:6, paddingVertical:2, borderRadius:4,
                backgroundColor: isSettled ? 'rgba(39,174,96,0.14)' : 'rgba(201,168,76,0.18)',
                borderWidth:1,
                borderColor: isSettled ? 'rgba(39,174,96,0.40)' : 'rgba(201,168,76,0.42)',
              }}>
                <Text style={{
                  fontFamily:'GoogleSans_700Bold', fontSize:8,
                  color: isSettled ? '#165c2e' : '#7a5200',
                  letterSpacing:0.5,
                }}>
                  {isSettled ? 'Settled' : 'Unsettled'}
                </Text>
              </View>
            </View>
            <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(1,31,75,0.40)' }}>
              {fmtCreditDate(order.createdAt)}
            </Text>
            {isSettled && order.settledAt && (
              <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:9, color:'#27ae60' }}>
                Settled {fmtCreditDate(order.settledAt)}
              </Text>
            )}
          </View>
          <Text style={{ fontFamily:'NotoSerif_700Bold', fontSize:14,
            color: isSettled ? '#27ae60' : '#c9a84c', marginLeft:10 }}>
            ₱ {total.toFixed(2)}
          </Text>
        </View>

        {/* Items */}
        <View style={{ borderTopWidth:1, borderColor:'rgba(1,31,75,0.06)', paddingTop:5, gap:2 }}>
          {orderItems.map((it, j) => {
            const item = it.item || it;
            const qty  = it.qty || it.quantity || 1;
            return (
              <View key={j} style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.72)', flex:1 }} numberOfLines={1}>
                  {item.emoji || '·'} {item.name}{' '}
                  <Text style={{ color:'rgba(1,31,75,0.35)' }}>×{qty}</Text>
                </Text>
                <Text style={{ fontFamily:'GoogleSans_500Medium', fontSize:11, color:'rgba(1,31,75,0.55)', marginLeft:8 }}>
                  ₱{(Number(item.price || 0) * qty).toFixed(2)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default function CanteenMemberScreen({ navigation }) {
  const { items: MENU_ITEMS, ads: CONTEXT_ADS, categories: CATEGORIES, addOrder, deductStock, orders, reloadFromStorage } = useCanteen();
  const { width, height } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, NotoSerif_700Bold_Italic,
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  // ── Member login state ───────────────────────────────────────────────────
  const [member,       setMember]       = useState(null);
  const [loginView,    setLoginView]    = useState(true);
  const [loginUserId,  setLoginUserId]  = useState('');
  const [loginPw,      setLoginPw]      = useState('');
  const [loginShowPw,  setLoginShowPw]  = useState(false);
  const [loginError,   setLoginError]   = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);
  const [menuOpen,     setMenuOpen]     = useState(false);

  // ── Per-session UI state — declared before login/logout handlers so they can reset all ──
  const [activeCategory, setActiveCategory] = useState('All');
  const [search,         setSearch]         = useState('');
  const [cart,           setCart]           = useState({});
  const [cartOpen,       setCartOpen]       = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [lastOrder,      setLastOrder]      = useState(null);
  const [mainTab,        setMainTab]        = useState('order'); // 'order' | 'history' | 'credit'
  const [creditTab,      setCreditTab]      = useState('unpaid'); // 'unpaid' | 'paid'

  const handleLogin = async () => {
    if (!loginUserId.trim()) { setLoginError('Please enter your User ID.'); return; }
    if (!loginPw.trim())     { setLoginError('Please enter your password.'); return; }
    setLoginLoading(true); setLoginError('');
    try {
      const m = await loginByUserIdFS(loginUserId.trim(), loginPw);
      // ── Reset ALL per-session state before entering as new user ──
      setCart({});
      setCartOpen(false);
      setMainTab('order');
      setLastOrder(null);
      setReceiptVisible(false);
      setSearch('');
      setActiveCategory('All');
      setOrderHistory([]);
      setMenuOpen(false);
      setQueueVisible(false);
      setQueueMinimized(false);
      setTrackedOrderId(null);
      setLiveStatus('pending');
      prevStatusRef.current = null;
      setCreditTab('unpaid');
      setMember(m);
      setLoginView(false);
    } catch (e) { setLoginError(e.message || 'Invalid credentials.'); }
    finally { setLoginLoading(false); }
  };

  // ── Reset ALL per-session state on logout ────────────────────────────────
  const handleLogout = () => {
    const doLogout = () => {
      setMember(null);
      setLoginView(true);
      setLoginUserId('');
      setLoginPw('');
      setLoginError('');
      setLoginShowPw(false);
      // Clear all session-specific state so the next user starts fresh
      setCart({});
      setCartOpen(false);
      setMainTab('order');
      setLastOrder(null);
      setReceiptVisible(false);
      setSearch('');
      setActiveCategory('All');
      setOrderHistory([]);
      setMenuOpen(false);
      setQueueVisible(false);
      setQueueMinimized(false);
      setTrackedOrderId(null);
      setLiveStatus('pending');
      prevStatusRef.current = null;
      setCreditTab('unpaid');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        doLogout();
      }
    } else {
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive', onPress: doLogout },
        ],
        { cancelable: true }
      );
    }
  };

  // ── Order history from Firestore ─────────────────────────────────────────
  // No orderBy — avoids composite index requirement; we sort client-side.
  // Also restores any active queue (pending/preparing/ready) after login.
  useEffect(() => {
    setOrderHistory([]);
    if (!member?.uid) return;
    const q = query(
      collection(db, 'canteen_orders'),
      where('memberId', '==', member.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
      // Sort newest first client-side
      docs.sort((a, b) => {
        const getTs = (o) => {
          if (!o.createdAt) return 0;
          if (o.createdAt?.toDate) return o.createdAt.toDate().getTime();
          if (typeof o.createdAt === 'number') return o.createdAt;
          return new Date(o.createdAt).getTime() || 0;
        };
        return getTs(b) - getTs(a);
      });
      setOrderHistory(docs);

      // ── Restore active queue on login: find most recent non-done order ──
      setTrackedOrderId(prev => {
        if (prev) return prev; // already tracking, don't overwrite
        const active = docs.find(o =>
          o.status === 'pending' || o.status === 'preparing' || o.status === 'ready'
        );
        if (active) {
          setLiveStatus(active.status);
          prevStatusRef.current = active.status;
          setLastOrder(lp => lp || {
            orderNo: active.orderNo,
            items: active.items || [],
            total: active.total || 0,
            amountPaid: active.total || 0,
            change: 0,
            time: '',
            paymentMode: active.payment || 'cash',
            id: active.docId,
          });
          return active.docId;
        }
        return null;
      });
    }, (err) => {
      console.warn('orderHistory snapshot error:', err.message);
      setOrderHistory([]);
    });
    return () => unsub();
  }, [member?.uid]);

  // ── Queue status tracking (same as CanteenVisitor) ──────────────────────
  const [queueVisible,   setQueueVisible]   = useState(false);
  const [queueMinimized, setQueueMinimized] = useState(false);
  const [trackedOrderId, setTrackedOrderId] = useState(null);
  const [liveStatus,     setLiveStatus]     = useState('pending');
  const prevStatusRef = useRef(null);

  const hdrFade  = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-16)).current;
  const bodyFade    = useRef(new Animated.Value(0)).current;
  const adAnim      = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const adAnimTarget = useRef(1);
  const receiptViewRef = useRef(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue:1, duration:600, useNativeDriver:true }),
      Animated.timing(hdrTrans, { toValue:0, duration:600, useNativeDriver:true }),
    ]).start();
    Animated.timing(bodyFade, { toValue:1, duration:600, delay:200, useNativeDriver:true }).start();
  }, []);

  useEffect(() => {
    reloadFromStorage();
  }, []);

  // ── Auto-show queue modal when a tracked order is restored after login ─────
  useEffect(() => {
    if (trackedOrderId && !queueVisible) {
      const status = liveStatus;
      if (status === 'pending' || status === 'preparing' || status === 'ready') {
        setTimeout(() => setQueueVisible(true), 400);
      }
    }
  }, [trackedOrderId]);

  // ── Watch orders array for status change on tracked order ─────────────────
  useEffect(() => {
    if (!trackedOrderId) return;
    const found = orders.find(o => o.id === trackedOrderId || o.docId === trackedOrderId);
    if (!found) return;
    const newStatus = found.status;
    if (newStatus !== prevStatusRef.current) {
      prevStatusRef.current = newStatus;
      setLiveStatus(newStatus);
      // Re-expand if minimized when status changes
      if (newStatus === 'ready' || newStatus === 'preparing') {
        setQueueMinimized(false);
        if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
          const msg = newStatus === 'ready'
            ? '✅ Your order is ready to pick up!'
            : '🔥 The canteen is now preparing your order!';
          if (Notification.permission === 'granted') {
            new Notification('CLIMBS Canteen', { body: msg, icon: '🍽️' });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(p => {
              if (p === 'granted') new Notification('CLIMBS Canteen', { body: msg });
            });
          }
        }
      }
      if (newStatus === 'done') {
        setQueueMinimized(false);
        setTimeout(() => {
          setQueueVisible(false);
          setTrackedOrderId(null);
        }, 2500);
      }
    }
  }, [orders, trackedOrderId]);

  const addToCart = (item) => setCart(prev => ({
    ...prev,
    [item.id]: { item, qty: (prev[item.id]?.qty || 0) + 1 },
  }));

  const removeFromCart = (item) => setCart(prev => {
    const qty = (prev[item.id]?.qty || 0) - 1;
    if (qty <= 0) { const n = {...prev}; delete n[item.id]; return n; }
    return { ...prev, [item.id]: { item, qty } };
  });

  const clearCart = () => setCart({});

  const placeOrder = () => {
    setCartOpen(false);
    clearCart();
  };

  // Called by CartPanel after building order data
  const handlePlaceOrder = async (orderData) => {
    const orderNo = orderData.orderNo || Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const time = now.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })
      + '  ' + now.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });

    const normalizedPayment = (orderData.paymentMode || 'cash') === 'credits' ? 'credit' : (orderData.paymentMode || 'cash');
    const fullOrder = {
      ...orderData,
      orderNo,
      time,
      status: 'pending',
      payment:      normalizedPayment,
      paymentMode:  normalizedPayment,
      source: 'member',
      memberId:     member?.uid    || null,
      memberName:   member?.name   || (member?.firstName && member?.lastName ? `${member.lastName}, ${member.firstName}` : null) || null,
      memberUserId: member?.userId || null,
    };

    // Save to Firestore — returns the real document ID
    const firestoreId = await addOrder(fullOrder);
    await deductStock(orderData.items);

    const trackedId = firestoreId || `ORD-${orderNo}`;
    setLastOrder({ ...orderData, orderNo, time, id: trackedId });
    setCartOpen(false);
    clearCart();

    // Start queue tracking with the real Firestore ID
    setTrackedOrderId(trackedId);
    setLiveStatus('pending');
    prevStatusRef.current = 'pending';
    setQueueMinimized(false);
    setTimeout(() => setQueueVisible(true), 300);

    // Request notification permission early
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window
        && Notification.permission === 'default') {
      Notification.requestPermission();
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
    const filename = `CLIMBS_Receipt_${orderNo}`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        // Dynamically load html2canvas from CDN if not already loaded
        if (!window.html2canvas) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        // Find the receipt card element by its data attribute
        const el = document.querySelector('[data-receipt-card="true"]');
        if (!el) { alert('Receipt not ready yet, please try again.'); return; }

        const canvas = await window.html2canvas(el, {
          scale: 3,           // high resolution
          useCORS: true,
          backgroundColor: '#fffef8',
          logging: false,
        });
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (e) {
        alert('Could not capture receipt image: ' + e.message);
      }

    } else {
      // ── MOBILE: react-native-view-shot + expo-media-library ──
      try {
        const ViewShot   = require('react-native-view-shot');
        const MediaLib   = require('expo-media-library');

        // Request gallery permission
        const { status } = await MediaLib.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Please allow access to your gallery to save the receipt.');
          return;
        }

        // Capture the receipt view ref
        if (!receiptViewRef.current) {
          Alert.alert('Error', 'Could not capture receipt. Please try again.');
          return;
        }

        const uri = await ViewShot.captureRef(receiptViewRef.current, {
          format: 'png',
          quality: 1.0,
          result: 'tmpfile',
        });

        const asset = await MediaLib.createAssetAsync(uri);
        Alert.alert(
          '✅ Saved to Gallery!',
          `Receipt #${orderNo} saved as an image in your Photos/Gallery.`,
          [{ text: 'OK' }]
        );
      } catch (e) {
        Alert.alert('Error', 'Could not save receipt.\n\nMake sure react-native-view-shot and expo-media-library are installed.\n\n' + e.message);
      }
    }
  };

  const totalItems = Object.values(cart).reduce((s,{qty}) => s+qty, 0);

  // ── Search: auto-switch category tab to where the result belongs ──
  // When typing, find all matching items. If they all belong to one category,
  // auto-switch that tab. If they span multiple categories, switch to 'All'.
  const handleSearch = (text) => {
    setSearch(text);
    if (text.trim() === '') return; // cleared — leave category as-is
    const matches = MENU_ITEMS.filter(i =>
      i.name.toLowerCase().includes(text.toLowerCase())
    );
    if (matches.length === 0) return;
    const cats = [...new Set(matches.map(i => i.cat))];
    if (cats.length === 1) {
      setActiveCategory(cats[0]); // all results in same category → switch there
    } else {
      setActiveCategory('All');   // results span multiple categories → show All
    }
  };

  const filtered = MENU_ITEMS.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    if (search.trim() !== '') return matchesSearch; // show all matches when searching
    return (activeCategory === 'All' || i.cat === activeCategory);
  });

  // Grid cols — COLS fixed per platform, CARD_W fills available space
  const CART_W  = isWide ? 230 : 0;
  const CAT_W   = isWide ? 170 : 0;
  const MARGIN  = isWide ? 80 : 20;  // centerPanel paddingH(10)*2
  const GAP_C   = Platform.OS === 'web' ? 10 : 5;
  const COLS    = Platform.OS === 'web' ? 5 : 3;
  const AVAIL   = width - CAT_W - CART_W - MARGIN - (Platform.OS==='web' ? 24 : 12);  // padding*2
  const CARD_W  = Math.floor((AVAIL - (COLS - 1) * GAP_C) / COLS);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* BACKGROUND */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor:'#98bad5' }]} />
      <LinearGradient colors={['rgba(198,220,235,0.85)','rgba(152,186,213,0.40)','rgba(80,110,150,0.0)']}
        locations={[0,0.45,1]} start={{x:0.5,y:0.1}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(50,80,120,0.45)','rgba(50,80,120,0.0)','rgba(50,80,120,0.45)']}
        locations={[0,0.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(50,80,120,0.0)','rgba(60,90,130,0.35)']}
        locations={[0.4,1]} start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject} />

      {/* HEADER */}
      <Animated.View style={{
        opacity: hdrFade, transform:[{translateY: hdrTrans}],
        marginTop: Platform.OS==='web' ? 16 : 36,
        marginHorizontal: isSmall ? 8 : 10, zIndex:10,
      }}>
        <View style={[styles.header, { paddingHorizontal: isWide ? 40:12, paddingVertical: isWide ? 16:7 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => {
            if (!loginView && member && (mainTab === 'history' || mainTab === 'credit')) {
              // If on Order History or My Credit, go back to the ordering view
              setMenuOpen(false);
              setMainTab('order');
            } else if (!loginView && member) {
              // If on the main ordering view, logout
              setMenuOpen(false);
              handleLogout();
            } else {
              // If on login view, go back to previous screen
              navigation && navigation.goBack();
            }
          }}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1, { fontSize: isWide ? 22 : isSmall ? 14:16 }]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>CLIMBS </Text>
              Canteen Ordering System
            </Text>
            <View style={styles.visitorTag}>
              <Text style={styles.visitorTagText}>
                {member ? `MEMBER · ${member.name?.split(' ')[0]?.toUpperCase()}` : 'MEMBER LOGIN'}
              </Text>
            </View>
          </View>

          {/* Right side: avatar + firstName + menu icon if logged in, else spacer */}
          {member && !loginView ? (
            <View style={styles.headerRight}>
              {/* Profile pic + firstName */}
              <>
                {member.photoURL ? (
                  <Image source={{ uri: member.photoURL }} style={styles.headerAvatar} />
                ) : (
                  <View style={styles.headerAvatarFallback}>
                    <Text style={styles.headerAvatarInitial}>
                      {(member.firstName || member.name || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.headerFirstName} numberOfLines={1}>
                  {member.firstName || member.name?.split(' ')[0] || member.userId}
                </Text>
              </>

              {/* Menu button */}
              <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuOpen(o => !o)} activeOpacity={0.80}>
                <Text style={styles.menuIcon}>☰</Text>
              </TouchableOpacity>

              {/* Dropdown menu */}
              {menuOpen && (
                <View style={styles.dropdown}>
                  {[
                      { icon: '🛒', label: 'Order Now',        tab: 'order'   },
                      { icon: '📋', label: 'Order History', tab: 'history' },
                      { icon: '🪙', label: 'My Credit',        tab: 'credit'  },
                    ].map(opt => (
                      <TouchableOpacity
                        key={opt.tab}
                        onPress={() => { setMainTab(opt.tab); setMenuOpen(false); if (loginView) return; }}
                        activeOpacity={0.75}
                        style={[styles.dropdownItem, { backgroundColor: mainTab === opt.tab ? 'rgba(201,168,76,0.15)' : 'transparent' }]}
                      >
                        <Text style={[styles.dropdownItemText, {
                          fontFamily: mainTab === opt.tab ? 'GoogleSans_700Bold' : 'GoogleSans_500Medium',
                          fontSize: 13,
                          color: mainTab === opt.tab ? '#c9a84c' : 'rgba(255,255,255,0.85)',
                        }]}>
                          {opt.icon}{'  '}{opt.label}
                        </Text>
                        {mainTab === opt.tab && <View style={{ width:3, borderRadius:2, backgroundColor:'#c9a84c', position:'absolute', left:0, top:6, bottom:6 }} />}
                      </TouchableOpacity>
                    ))}
                  <View style={{ height:1, backgroundColor:'rgba(255,255,255,0.10)', marginVertical:4 }} />
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => { setMenuOpen(false); handleLogout(); }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemText}>  Logout</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </Animated.View>

      {/* ── LOGIN VIEW ── */}
      {loginView && (
        <ScrollView contentContainerStyle={{ flexGrow:1, justifyContent:'center', alignItems:'center', paddingVertical:32, paddingHorizontal:20 }} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ width:'100%', maxWidth:420, borderRadius:22, backgroundColor:'rgba(178,203,222,0.38)', borderWidth:1.5, borderColor:'rgba(255,255,255,0.55)', padding:24, alignItems:'center', opacity: bodyFade }}>
            {/* Logo */}
            <LinearGradient colors={['#1a2d4e','#304674']} style={{ width:76, height:76, borderRadius:38, justifyContent:'center', alignItems:'center', borderWidth:2.5, borderColor:'#c9a84c', marginBottom:16 }}>
              <Text style={{ fontSize:32 }}>🍽️</Text>
            </LinearGradient>
            <Text style={{ fontFamily:'NotoSerif_700Bold', fontSize:20, color:'#0f1e35', textAlign:'center', marginBottom:4 }}>Canteen Member Portal</Text>
            <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(15,30,53,0.60)', textAlign:'center', marginBottom:14, lineHeight:18 }}>CLIMBS Cooperative — Member Login</Text>
            {/* Hint */}
            <View style={{ width:'100%', backgroundColor:'rgba(201,168,76,0.14)', borderRadius:9, borderWidth:1, borderColor:'rgba(201,168,76,0.38)', padding:10, marginBottom:14 }}>
              <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.80)', lineHeight:17 }}>
                🔑 Use your <Text style={{ fontFamily:'GoogleSans_700Bold' }}>CESLA Member User ID</Text> and password to login.
              </Text>
            </View>
            {/* User ID */}
            <View style={{ width:'100%', marginBottom:10 }}>
              <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:9, color:'rgba(1,31,75,0.55)', letterSpacing:1.8, textTransform:'uppercase', marginBottom:4 }}>MEMBER USER ID</Text>
              <View style={[{ flexDirection:'row', alignItems:'center', backgroundColor:'rgba(240,246,252,0.92)', borderRadius:10, paddingHorizontal:12, paddingVertical:11, borderWidth:1.5, borderColor:'rgba(200,218,235,0.75)' }, loginError && { borderColor:'#e74c3c' }]}>
                <TextInput style={{ fontFamily:'GoogleSans_400Regular', fontSize:13, color:'#0f1e35', flex:1 }}
                  value={loginUserId} onChangeText={v => { setLoginUserId(v); setLoginError(''); }}
                  placeholder="e.g. CESLA-2026-00001" placeholderTextColor="rgba(15,30,53,0.35)"
                  autoCapitalize="none" autoCorrect={false} />
              </View>
            </View>
            {/* Password */}
            <View style={{ width:'100%', marginBottom:10 }}>
              <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:9, color:'rgba(1,31,75,0.55)', letterSpacing:1.8, textTransform:'uppercase', marginBottom:4 }}>PASSWORD</Text>
              <View style={[{ flexDirection:'row', alignItems:'center', backgroundColor:'rgba(240,246,252,0.92)', borderRadius:10, paddingHorizontal:12, paddingVertical:11, borderWidth:1.5, borderColor:'rgba(200,218,235,0.75)' }, loginError && { borderColor:'#e74c3c' }]}>
                <TextInput style={{ fontFamily:'GoogleSans_400Regular', fontSize:13, color:'#0f1e35', flex:1 }}
                  value={loginPw} onChangeText={v => { setLoginPw(v); setLoginError(''); }}
                  placeholder="Enter your password" placeholderTextColor="rgba(15,30,53,0.35)"
                  secureTextEntry={!loginShowPw} autoCapitalize="none" autoCorrect={false} />
                <TouchableOpacity onPress={() => setLoginShowPw(p => !p)} style={{ padding:6 }}>
                  <MaterialIcons name={loginShowPw ? 'visibility-off' : 'visibility'} size={20} color="rgba(1,31,75,0.45)" />
                </TouchableOpacity>
              </View>
            </View>
            {/* Error */}
            {loginError ? (
              <View style={{ flexDirection:'row', alignItems:'flex-start', gap:6, width:'100%', backgroundColor:'rgba(231,76,60,0.10)', borderRadius:9, borderWidth:1, borderColor:'rgba(231,76,60,0.28)', padding:9, marginBottom:6 }}>
                <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#e74c3c', flex:1, lineHeight:17 }}>{loginError}</Text>
              </View>
            ) : null}
            {/* Login button */}
            <TouchableOpacity style={{ width:'100%', borderRadius:28, overflow:'hidden', marginTop:10, opacity: loginLoading ? 0.65 : 1 }}
              onPress={handleLogin} disabled={loginLoading} activeOpacity={0.85}>
              <LinearGradient colors={['#c9a84c','#e8c87a']} start={{x:0,y:0}} end={{x:1,y:0}} style={{ paddingVertical:14, alignItems:'center', justifyContent:'center' }}>
                {loginLoading
                  ? <ActivityIndicator color="#0f1e35" />
                  : <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#0f1e35', letterSpacing:1.5 }}>🍴  ENTER CANTEEN</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
            <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.50)', textAlign:'center', marginTop:10, lineHeight:17 }}>
              Don't have an account? Register via the{' '}
              <Text style={{ fontFamily:'GoogleSans_700Bold', color:'#c9a84c' }}>CESLA Cooperative Portal</Text>.
            </Text>
          </Animated.View>
        </ScrollView>
      )}

      {/* BODY */}
      {!loginView && (
      <View style={styles.body}>

      <Animated.View style={{ flex:1, flexDirection:'row', alignItems:'stretch', opacity: bodyFade, minHeight:0, overflow: Platform.OS==='web' ? 'hidden' : 'visible' }}>

        {/* ══════════════════
            LEFT PANEL (web)
            — 3 nav cards + categories (when Order Now)
        ══════════════════ */}
        {isWide && mainTab === 'order' && (
          <View style={[styles.catPanel, { justifyContent:'flex-start' }]}>

            {/* Categories */}
            <Text style={styles.catPanelTitle}>CATEGORIES</Text>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catBtn, activeCategory === cat && styles.catBtnActive]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.catBtnText, activeCategory === cat && styles.catBtnTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ══════════════════════════════════════════════
            TAB: ORDER NOW
        ══════════════════════════════════════════════ */}
        {mainTab === 'order' && (<>

        {/* CENTER — Search + Menu grid */}
        <View style={styles.centerPanel}>

          {/* Mobile: category tabs */}
          {!isWide && (<>
            {/* Category tabs row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ flexGrow:0, marginBottom:8 }}
              contentContainerStyle={{ paddingHorizontal:4, gap:5, paddingVertical:2 }}
            >
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat}
                  style={[styles.catTab, activeCategory===cat && styles.catTabActive]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[styles.catTabText, activeCategory===cat && styles.catTabTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>)}

          {/* ── Ad Banner ── */}
          <View style={{ marginBottom: isWide ? 12 : 0 }}>
            <AdBanner isWide={isWide} adAnim={adAnim} ads={CONTEXT_ADS} navigation={navigation} />
          </View>

          {/* Items panel — fills remaining space */}
          <View style={styles.itemsPanel}>
            {/* Label LEFT + Search RIGHT */}
            <View style={{ flexDirection:'row', alignItems:'center', marginBottom:6, gap:8 }}>
              <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#011f4b', letterSpacing:2, flexShrink:0 }}>
                {activeCategory === 'All' ? 'ALL ITEMS' : activeCategory.toUpperCase()}
              </Text>
              <View style={styles.searchBoxInline}>
                <Text style={{ fontSize:11, marginRight:4 }}>🔍</Text>
                <TextInput
                  style={styles.searchInputInline}
                  placeholder="Search..."
                  placeholderTextColor="rgba(1,31,75,0.35)"
                  value={search}
                  onChangeText={handleSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearch(''); setActiveCategory('All'); }}>
                    <Text style={{ color:'rgba(1,31,75,0.45)', fontSize:12, fontWeight:'700' }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={{ height:1, backgroundColor:'rgba(1,31,75,0.10)', marginBottom:8 }} />
            <ScrollView
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
              onScroll={Platform.OS !== 'web' ? (e) => {
                const y = e.nativeEvent.contentOffset.y;
                const goingDown = y > lastScrollY.current;
                lastScrollY.current = y;
                const target = goingDown && y > 10 ? 0 : 1;
                if (target !== adAnimTarget.current) {
                  adAnimTarget.current = target;
                  adAnim.stopAnimation();
                  Animated.timing(adAnim, {
                    toValue: target,
                    duration: 120,
                    useNativeDriver: false,
                  }).start();
                }
              } : undefined}
              style={{ flex:1, minHeight:0 }}
              contentContainerStyle={[styles.menuGrid, { gap: Platform.OS==='web' ? 10 : 5, paddingBottom: Platform.OS !== 'web' ? 90 : 20 }]}
            >
              {filtered.length === 0 ? (
                <Text style={styles.emptyText}>No items found.</Text>
              ) : (
                Array.from({ length: Math.ceil(filtered.length / COLS) }, (_, rowIdx) => (
                  <View key={rowIdx} style={{ flexDirection:'row', gap: Platform.OS==='web' ? 10 : 5, marginBottom: Platform.OS==='web' ? 0 : 5 }}>
                    {filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS).map(item => (
                      <View key={item.id} style={{ flex:1 }}>
                        <FoodCard item={item} onAdd={() => addToCart(item)} />
                      </View>
                    ))}
                    {Array.from({ length: COLS - filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS).length }).map((_, i) => (
                      <View key={`empty-${i}`} style={{ flex:1 }} />
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>

        {/* RIGHT — Cart panel (web only) */}
        {isWide && (
          <CartPanel
            cart={cart} onAdd={addToCart} onRemove={removeFromCart}
            onClear={clearCart} onOrder={placeOrder} isWide={isWide}
            hideTitle={false} onPlaceOrder={handlePlaceOrder}
            lastOrder={lastOrder} onShowReceipt={handleShowReceipt}
            orderHistory={orderHistory}
          />
        )}
        {/* Mobile floating cart button */}
        {!isWide && (
          <TouchableOpacity style={styles.floatCart} onPress={() => setCartOpen(true)} activeOpacity={0.85}>
            <LinearGradient colors={['#c9a84c','#e8c87a']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.floatCartGradient}>
              <Text style={styles.floatCartText}>
                🛒  View Cart  {totalItems > 0 ? `(${totalItems})` : ''}  •  ₱{Object.values(cart).reduce((s,{item,qty}) => s+item.price*qty, 0).toFixed(2)}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        </>)}
        {/* ══════════════════════════════════════════════
            TAB: ORDER HISTORY
        ══════════════════════════════════════════════ */}
        {mainTab === 'history' && (
          <HistoryTabContent
            orderHistory={orderHistory}
            isWide={isWide}
            showStatus={true}
            onShopNow={() => setMainTab('order')}
          />
        )}
        
        {mainTab === 'credit' && (() => {
          const fmtDateTime = (ts) => {
            try {
              let d;
              if (!ts) return '—';
              if (ts?.toDate) d = ts.toDate();
              else if (typeof ts === 'number') d = new Date(ts);
              else d = new Date(ts);
              if (isNaN(d.getTime())) return '—';
              return d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })
                + ' · ' + d.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', hour12:true });
            } catch { return '—'; }
          };

          const creditOrders  = orderHistory.filter(o =>
            (o.payment || o.paymentMode || '').toLowerCase() === 'credit'
          );
          const unpaidOrders  = creditOrders.filter(o => o.settled !== true);
          const paidOrders    = creditOrders.filter(o => o.settled === true);
          const totalUnpaid   = unpaidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
          const totalPaid     = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
          const displayOrders = creditTab === 'unpaid' ? unpaidOrders : paidOrders;

          return (
            <View style={{ flex:1, minHeight:0, alignItems:'stretch', paddingBottom: isWide ? 16 : 8 }}>
            <View style={{ flex:1, width:'100%', maxWidth: isWide ? 1100 : '100%', alignSelf:'center', paddingHorizontal: isWide ? 24 : 10, paddingTop:4, minHeight:0 }}>

              {/* ── Page header ── */}
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:11, color:'rgba(1,31,75,0.55)', letterSpacing:2, textTransform:'uppercase' }}>🪙 My Credit</Text>
                {unpaidOrders.length > 0 && (
                  <View style={{ backgroundColor:'rgba(201,168,76,0.18)', borderRadius:20, paddingHorizontal:9, paddingVertical:3, borderWidth:1, borderColor:'rgba(201,168,76,0.38)' }}>
                    <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#8a5c00' }}>
                      {unpaidOrders.length} unsettled
                    </Text>
                  </View>
                )}
              </View>

              {/* ── Summary tab cards ── */}
              <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
                <TouchableOpacity onPress={() => setCreditTab('unpaid')} activeOpacity={0.85} style={{ flex:1, borderRadius:10, overflow:'hidden' }}>
                  <View style={{ padding:10, borderRadius:10, borderWidth: creditTab === 'unpaid' ? 1.5 : 1, borderColor: creditTab === 'unpaid' ? '#c9a84c' : 'rgba(255,255,255,0.70)', backgroundColor: creditTab === 'unpaid' ? '#1a2d4e' : 'rgba(255,255,255,0.50)' }}>
                    <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:8, letterSpacing:1.2, textTransform:'uppercase', marginBottom:3, color: creditTab === 'unpaid' ? 'rgba(255,255,255,0.45)' : 'rgba(1,31,75,0.40)' }}>Unsettled</Text>
                    <Text style={{ fontFamily:'NotoSerif_700Bold', fontSize:17, lineHeight:20, color: creditTab === 'unpaid' ? '#c9a84c' : '#c87a1a' }}>₱ {totalUnpaid.toFixed(2)}</Text>
                    <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:9, marginTop:2, color: creditTab === 'unpaid' ? 'rgba(255,255,255,0.38)' : 'rgba(1,31,75,0.40)' }}>{unpaidOrders.length} order{unpaidOrders.length !== 1 ? 's' : ''}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCreditTab('paid')} activeOpacity={0.85} style={{ flex:1, borderRadius:10, overflow:'hidden' }}>
                  <View style={{ padding:10, borderRadius:10, borderWidth: creditTab === 'paid' ? 1.5 : 1, borderColor: creditTab === 'paid' ? '#27ae60' : 'rgba(255,255,255,0.70)', backgroundColor: creditTab === 'paid' ? '#0f3320' : 'rgba(255,255,255,0.50)' }}>
                    <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:8, letterSpacing:1.2, textTransform:'uppercase', marginBottom:3, color: creditTab === 'paid' ? 'rgba(255,255,255,0.45)' : 'rgba(1,31,75,0.40)' }}>Settled</Text>
                    <Text style={{ fontFamily:'NotoSerif_700Bold', fontSize:17, lineHeight:20, color: creditTab === 'paid' ? '#3edb82' : '#27ae60' }}>₱ {totalPaid.toFixed(2)}</Text>
                    <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:9, marginTop:2, color: creditTab === 'paid' ? 'rgba(255,255,255,0.38)' : 'rgba(1,31,75,0.40)' }}>{paidOrders.length} order{paidOrders.length !== 1 ? 's' : ''}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* ── Notice banner ── */}
              {creditTab === 'unpaid' && unpaidOrders.length > 0 && (
                <View style={{ flexDirection:'row', alignItems:'flex-start', gap:8, padding:9, borderRadius:9, marginBottom:10, backgroundColor:'rgba(201,168,76,0.10)', borderWidth:1, borderColor:'rgba(201,168,76,0.28)' }}>
                  <Text style={{ fontSize:12 }}>⚠️</Text>
                  <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.68)', lineHeight:17, flex:1 }}>
                    Ang mga orders nga <Text style={{ fontFamily:'GoogleSans_700Bold', color:'rgba(1,31,75,0.82)' }}>Credit</Text> ang payment kay ilusot sa imong sweldo o dividend sa payday. Kontaka ang canteen admin para sa settlement.
                  </Text>
                </View>
              )}
              {creditTab === 'unpaid' && unpaidOrders.length === 0 && creditOrders.length > 0 && (
                <View style={{ flexDirection:'row', alignItems:'center', gap:8, padding:9, borderRadius:9, marginBottom:10, backgroundColor:'rgba(39,174,96,0.10)', borderWidth:1, borderColor:'rgba(39,174,96,0.28)' }}>
                  <Text style={{ fontSize:14 }}>🎉</Text>
                  <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#165c2e', flex:1 }}>Wala nay unsettled credit! Bayad naka tanan.</Text>
                </View>
              )}

              {/* ── Table ── */}
              {creditOrders.length === 0 ? (
                <View style={{ alignItems:'center', paddingVertical:36, backgroundColor:'rgba(255,255,255,0.32)', borderRadius:12 }}>
                  <Text style={{ fontSize:28, marginBottom:8 }}>🪙</Text>
                  <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:13, color:'rgba(1,31,75,0.48)', textAlign:'center' }}>Wala pay credit orders</Text>
                  <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.38)', textAlign:'center', marginTop:4 }}>Mag-order gamit Credit para makita diri.</Text>
                </View>
              ) : displayOrders.length === 0 ? (
                <View style={{ alignItems:'center', paddingVertical:28, backgroundColor:'rgba(255,255,255,0.32)', borderRadius:12 }}>
                  <Text style={{ fontSize:24, marginBottom:6 }}>{creditTab === 'unpaid' ? '🎉' : '📋'}</Text>
                  <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.43)', textAlign:'center' }}>
                    {creditTab === 'unpaid' ? 'Wala nay unsettled orders!' : 'Wala pay settled orders.'}
                  </Text>
                </View>
              ) : (
                <View style={tblStyle.tableWrap}>
                  {/* Table header */}
                  <View style={tblStyle.thead}>
                    <Text style={[tblStyle.hCell, { width:110 }]}>DATE / ORDER</Text>
                    <View style={tblStyle.hDivider}/>
                    <Text style={[tblStyle.hCell, { flex:1 }]}>ITEMS</Text>
                    <View style={tblStyle.hDivider}/>
                    <Text style={[tblStyle.hCell, { width:120, textAlign:'center' }]}>TOTAL AMOUNT</Text>
                    <View style={tblStyle.hDivider}/>
                    <Text style={[tblStyle.hCell, { width:110, textAlign:'center' }]}>STATUS</Text>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={true} style={{ flex:1 }}>
                    {displayOrders.map((order, idx) => {
                      const orderItems = order.items || [];
                      const total      = Number(order.total || 0);
                      const isSettled  = order.settled === true;
                      const isEven = idx % 2 === 0;
                      return (
                        <View key={order.docId || idx} style={[tblStyle.row, isEven && tblStyle.rowEven, idx === displayOrders.length - 1 && { borderBottomWidth:0 }]}>
                          {/* Order # + date */}
                          <View style={[tblStyle.cell, { width:110 }]}>
                            <Text style={tblStyle.ordNo}>#{order.orderNo || '—'}</Text>
                            <Text style={tblStyle.ordDate}>{fmtDateTime(order.createdAt)}</Text>
                          </View>
                          {/* Items */}
                          <View style={[tblStyle.cell, { flex:1 }]}>
                            {orderItems.slice(0,2).map((it, j) => {
                              const item = it.item || it;
                              const qty  = it.qty || it.quantity || 1;
                              return (
                                <Text key={j} style={tblStyle.itemLine} numberOfLines={1}>
                                  {item.name} ×{qty}
                                </Text>
                              );
                            })}
                            {orderItems.length > 2 && (
                              <Text style={[tblStyle.itemLine, { color:'rgba(1,31,75,0.38)', fontSize:10 }]}>+{orderItems.length - 2} more</Text>
                            )}
                          </View>
                          {/* Amount */}
                          <View style={[tblStyle.cell, { width:120, alignItems:'center' }]}>
                            <Text style={[tblStyle.total, { color: isSettled ? '#27ae60' : '#c9a84c' }]}>₱{total.toFixed(2)}</Text>
                          </View>
                          {/* Status */}
                          <View style={[tblStyle.cell, { width:110, alignItems:'center' }]}>
                            <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:11, color: isSettled ? '#27ae60' : '#c9a84c' }}>
                              {isSettled ? 'Settled' : 'Unsettled'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
            </View>
          );
        })()}

      </Animated.View>
      </View>
      )}

      {/* Mobile cart bottom sheet */}
      {!isWide && cartOpen && (
        <CartBottomSheet
          cart={cart} onAdd={addToCart} onRemove={removeFromCart}
          onClear={clearCart} onOrder={placeOrder}
          onClose={() => setCartOpen(false)}
          onPlaceOrder={handlePlaceOrder}
          lastOrder={lastOrder} onShowReceipt={handleShowReceipt}
          orderHistory={orderHistory}
        />
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        visible={receiptVisible}
        orderData={lastOrder}
        onClose={() => setReceiptVisible(false)}
        onPrint={handlePrint}
        receiptViewRef={receiptViewRef}
      />

      {/* ── QUEUE STATUS — shown after placing order, minimizes to pill ── */}
      {queueVisible && !queueMinimized && (
        <QueueStatusModal
          visible={queueVisible}
          minimized={false}
          orderId={trackedOrderId}
          orderNo={lastOrder?.orderNo}
          currentStatus={liveStatus}
          onClose={() => { setQueueVisible(false); setTrackedOrderId(null); }}
          onMinimize={() => setQueueMinimized(true)}
        />
      )}
      {queueVisible && queueMinimized && (
        <QueueStatusModal
          visible={true}
          minimized={true}
          orderId={trackedOrderId}
          orderNo={lastOrder?.orderNo}
          currentStatus={liveStatus}
          onClose={() => { setQueueVisible(false); setTrackedOrderId(null); }}
          onMinimize={() => setQueueMinimized(false)}
        />
      )}

    </View>
  );
}

// ─── TABLE STYLES — shared by Order History & My Credit ──────────────────────

// ─── HISTORY TAB CONTENT — same layout as MerchandiseMemberScreen ────────────
const HistoryTabContent = ({ orderHistory, isWide, showStatus = true, onShopNow }) => {
  const [sortBy,        setSortBy]       = useState(null);
  const [sortDropOpen,  setSortDropOpen] = useState(false);
  const [selectedYear,  setSelectedYear] = useState(new Date().getFullYear());
  const [yearDropOpen,  setYearDropOpen] = useState(false);
  const [reportPeriod,  setReportPeriod] = useState('daily');
  const [selectedMonth, setSelectedMonth]= useState(new Date().getMonth());

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const toDate = (ts) => {
    try {
      if (!ts) return null;
      if (ts?.toDate) return ts.toDate();
      if (typeof ts === 'number') return new Date(ts);
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    } catch { return null; }
  };
  const fmtDate = (ts) => { const d = toDate(ts); if (!d) return '—'; return d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }); };
  const fmtTime = (ts) => { const d = toDate(ts); if (!d) return ''; return d.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', hour12:true }); };

  const pmInfo = (pm) => {
    const n = (pm === 'credits' ? 'credit' : (pm || 'cash')).toLowerCase();
    if (n === 'gcash')  return { label:'GCash',  color:'#3498db' };
    if (n === 'credit') return { label:'Credit', color:'#c9a84c' };
    return { label:'Cash', color:'#27ae60' };
  };
  const stInfo = (status) => {
    switch (status) {
      case 'done':      return { label:'Completed', color:'#27ae60' };
      case 'ready':     return { label:'Ready',     color:'#2980b9' };
      case 'preparing': return { label:'Preparing', color:'#e67e22' };
      default:          return { label:'Pending',   color:'#95a5a6' };
    }
  };

  const availableYears = React.useMemo(() => {
    const years = []; for (let y = 2070; y >= 2000; y--) years.push(y); return years;
  }, []);

  const sortedOrders = React.useMemo(() => {
    const arr = [...orderHistory];
    if (sortBy === 'payment') {
      arr.sort((a,b) => (a.payment||a.paymentMode||'cash').toLowerCase().localeCompare((b.payment||b.paymentMode||'cash').toLowerCase()));
    } else if (sortBy === 'status') {
      const ORD = { pending:0, preparing:1, ready:2, done:3 };
      arr.sort((a,b) => (ORD[a.status]??99) - (ORD[b.status]??99));
    } else {
      arr.sort((a,b) => (toDate(b.createdAt)?.getTime()||0) - (toDate(a.createdAt)?.getTime()||0));
    }
    return arr;
  }, [orderHistory, sortBy]);

  const tableRows = React.useMemo(() => {
    const rows = [];
    sortedOrders.forEach(order => {
      const items = order.items || [];
      const pm = pmInfo(order.payment || order.paymentMode);
      const st = stInfo(order.status);
      if (items.length === 0) { rows.push({ order, item:null, itemIdx:0, totalItems:0, pm, st }); }
      else { items.forEach((it, idx) => rows.push({ order, item:it, itemIdx:idx, totalItems:items.length, pm, st })); }
    });
    return rows;
  }, [sortedOrders]);

  const reportData = React.useMemo(() => {
    if (reportPeriod === 'yearly') {
      const map = {};
      orderHistory.forEach(o => { const d = toDate(o.createdAt); if (!d) return; const yr = d.getFullYear(); if (!map[yr]) map[yr]={label:String(yr),count:0,total:0}; map[yr].count++; map[yr].total+=Number(o.total||0); });
      return Object.values(map).sort((a,b) => b.label - a.label);
    }
    const yearOrders = orderHistory.filter(o => { const d = toDate(o.createdAt); return d && d.getFullYear() === selectedYear; });
    if (reportPeriod === 'monthly') {
      const map = {}; for (let m=0;m<12;m++) map[m]={label:MONTHS[m],count:0,total:0};
      yearOrders.forEach(o => { const d = toDate(o.createdAt); if (!d) return; const m=d.getMonth(); map[m].count++; map[m].total+=Number(o.total||0); });
      return Object.values(map);
    }
    const map = {};
    yearOrders.filter(o => { const d=toDate(o.createdAt); return d && d.getMonth()===selectedMonth; }).forEach(o => {
      const d=toDate(o.createdAt); const day=d.getDate();
      if (!map[day]) map[day]={label:String(day).padStart(2,'0'),count:0,total:0};
      map[day].count++; map[day].total+=Number(o.total||0);
    });
    return Object.values(map).sort((a,b) => Number(a.label)-Number(b.label));
  }, [orderHistory, reportPeriod, selectedYear, selectedMonth]);

  const totalRevenue = reportData.reduce((s,r) => s+r.total, 0);
  const totalCount   = reportData.reduce((s,r) => s+r.count, 0);
  const closeDrop = () => { setSortDropOpen(false); setYearDropOpen(false); };

  return (
    <TouchableOpacity activeOpacity={1} onPress={closeDrop} style={{ flex:1 }}>
      <View style={{ flex:1, flexDirection:isWide?'row':'column', gap:10, paddingHorizontal:isWide?16:8, paddingTop:isWide?8:6, paddingBottom:isWide?16:8, minHeight:0 }}>

        {/* ══ LEFT — MY ORDER HISTORY (60%) ══ */}
        <View style={[histStyles.panel, { flex:isWide?3:1 }]}>
          <View style={histStyles.panelHeaderRow}>
            <Text style={histStyles.panelTitle}>📋 MY ORDER HISTORY</Text>
            <View style={{ flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <View style={histStyles.countBadge}>
                <Text style={histStyles.countBadgeText}>{orderHistory.length} ORDER{orderHistory.length!==1?'S':''}</Text>
              </View>
              <View style={{ position:'relative', zIndex:9999 }}>
                <TouchableOpacity style={histStyles.sortBtn} onPress={() => { setSortDropOpen(v=>!v); setYearDropOpen(false); }} activeOpacity={0.80}>
                  <MaterialIcons name="sort" size={12} color="rgba(1,31,75,0.65)" />
                  <Text style={histStyles.sortBtnText}>Sort by{sortBy ? ': '+(sortBy==='payment'?'Payment':'Status') : ''}</Text>
                  <MaterialIcons name={sortDropOpen?'keyboard-arrow-up':'keyboard-arrow-down'} size={13} color="rgba(1,31,75,0.55)" />
                </TouchableOpacity>
                {sortDropOpen && (
                  <View style={histStyles.sortDropdown}>
                    {[{key:'payment',label:'💳  Payment'},{key:'status',label:'📌  Status'},{key:null,label:'🕐  Date (default)'}].map(opt => (
                      <TouchableOpacity key={String(opt.key)} style={[histStyles.sortDropItem, sortBy===opt.key && histStyles.sortDropItemActive]}
                        onPress={() => { setSortBy(opt.key); setSortDropOpen(false); }} activeOpacity={0.75}>
                        <Text style={[histStyles.sortDropItemText, sortBy===opt.key && {color:'#1a3a6b',fontFamily:'GoogleSans_700Bold'}]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>

          {orderHistory.length === 0 ? (
            <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingVertical:40 }}>
              <Text style={{ fontSize:40, marginBottom:10 }}>📋</Text>
              <Text style={histStyles.emptyTitle}>No orders yet</Text>
              <Text style={histStyles.emptySubtitle}>Your canteen orders will appear here.</Text>
              {onShopNow && <TouchableOpacity onPress={onShopNow} style={histStyles.shopNowBtn}><Text style={histStyles.shopNowText}>Order Now →</Text></TouchableOpacity>}
            </View>
          ) : (
            <View style={{ flex:1, minHeight:0, borderRadius:10, borderWidth:1, borderColor:'rgba(200,218,235,0.80)', overflow:'hidden' }}>
              <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator nestedScrollEnabled
                {...(Platform.OS==='web' ? { style:{ flex:1, overflowY:'auto', overflowX:'hidden' } } : {})}>
                {(Platform.OS==='web'
                  ? (c) => c
                  : (c) => <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled={false}>{c}</ScrollView>
                )(
                  <View style={{ flexDirection:'column', ...(Platform.OS==='web' ? { flex:1 } : { minWidth: showStatus ? 430 : 360 }) }}>
                    <View style={{ backgroundColor:'rgba(220,232,242,0.97)', borderBottomWidth:1.5, borderBottomColor:'rgba(180,205,225,0.90)',
                      ...(Platform.OS==='web' ? { position:'sticky', top:0, zIndex:10 } : {}) }}>
                      <View style={{ flexDirection:'row', alignItems:'center', paddingVertical:8 }}>
                        <View style={[histStyles.thCell, { width:80 }]}><Text style={histStyles.thTxt}>DATE</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, { width:56 }]}><Text style={histStyles.thTxt}>ORDER #</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, Platform.OS==='web' ? { flex:1 } : { width:140 }]}><Text style={histStyles.thTxt}>ITEM NAME</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, { width:28 }]}><Text style={[histStyles.thTxt,{textAlign:'center'}]}>QTY</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, { width:50 }]}><Text style={[histStyles.thTxt,{textAlign:'center'}]}>PMT</Text></View>
                        <View style={histStyles.thDiv}/>
                        <View style={[histStyles.thCell, { width:66 }]}><Text style={[histStyles.thTxt,{textAlign:'center'}]}>TOTAL</Text></View>
                        {showStatus && (<><View style={histStyles.thDiv}/><View style={[histStyles.thCell, { width:66 }]}><Text style={[histStyles.thTxt,{textAlign:'center'}]}>STATUS</Text></View></>)}
                      </View>
                    </View>
                    {tableRows.map((row, idx) => {
                      const { order, item, itemIdx, totalItems, pm, st } = row;
                      const isFirst = itemIdx === 0;
                      const isLastOfOrder = itemIdx === totalItems-1 || totalItems===0;
                      const isEvenOrder = sortedOrders.indexOf(order) % 2 === 0;
                      const itemObj  = item?.item || item || null;
                      const itemName = itemObj?.name || item?.name || '—';
                      const qty      = item?.qty || item?.quantity || (totalItems===0 ? '—' : 1);
                      return (
                        <View key={`${order.docId||idx}-${itemIdx}`} style={[histStyles.tdRow, isEvenOrder && histStyles.tdRowEven,
                          isLastOfOrder && { borderBottomWidth:1.5, borderBottomColor:'rgba(180,205,225,0.70)' }]}>
                          <View style={[histStyles.tdCell, { width:80 }]}>
                            {isFirst && <Text style={histStyles.tdDate}>{fmtDate(order.createdAt)}</Text>}
                            {isFirst && <Text style={histStyles.tdTime}>{fmtTime(order.createdAt)}</Text>}
                          </View>
                          <View style={[histStyles.tdCell, { width:56 }]}>
                            {isFirst && <Text style={histStyles.tdOrderNo}>#{order.orderNo||'—'}</Text>}
                          </View>
                          <View style={[histStyles.tdCell, Platform.OS==='web' ? { flex:1 } : { width:140 }]}>
                            <Text style={histStyles.tdItem} numberOfLines={2}>{itemName}</Text>
                          </View>
                          <View style={[histStyles.tdCell, { width:28, alignItems:'center' }]}>
                            <Text style={histStyles.tdQty}>{qty}</Text>
                          </View>
                          <View style={[histStyles.tdCell, { width:50, alignItems:'center' }]}>
                            {isFirst && <Text style={[histStyles.tdPm, { color:pm.color }]}>{pm.label}</Text>}
                          </View>
                          <View style={[histStyles.tdCell, { width:66, alignItems:'center' }]}>
                            {isFirst && <Text style={histStyles.tdTotal}>₱{Number(order.total||0).toFixed(2)}</Text>}
                          </View>
                          {showStatus && (
                            <View style={[histStyles.tdCell, { width:66, alignItems:'center' }]}>
                              {isFirst && <Text style={[histStyles.tdStatus, { color:st.color }]}>{st.label}</Text>}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* ══ RIGHT — ANNUAL HISTORY REPORTS (40%) ══ */}
        <View style={[histStyles.panel, { zIndex:100, flex:2 }]}>
          <Text style={[histStyles.panelTitle, { marginBottom:10 }]}>📊 ANNUAL HISTORY REPORTS</Text>

          <View style={{ position:'relative', zIndex:9999, marginBottom:10, alignSelf:'flex-start' }}>
            <TouchableOpacity style={histStyles.yearBtn} onPress={() => { setYearDropOpen(v=>!v); setSortDropOpen(false); }} activeOpacity={0.80}>
              <Text style={histStyles.yearBtnText}>YEAR {selectedYear}</Text>
              <MaterialIcons name={yearDropOpen?'keyboard-arrow-up':'keyboard-arrow-down'} size={16} color="#0f1e35" />
            </TouchableOpacity>
            {yearDropOpen && (
              <View style={histStyles.yearDropdown}>
                <ScrollView style={{ maxHeight:220 }} showsVerticalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {availableYears.map(yr => (
                    <TouchableOpacity key={yr} style={[histStyles.yearDropItem, yr===selectedYear && histStyles.yearDropItemActive]}
                      onPress={() => { setSelectedYear(yr); setYearDropOpen(false); }} activeOpacity={0.75}>
                      <Text style={[histStyles.yearDropItemText, yr===selectedYear && {color:'#fff',fontFamily:'GoogleSans_700Bold'}]}>{yr}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={histStyles.periodRow}>
            {['daily','monthly','yearly'].map(p => (
              <TouchableOpacity key={p} style={[histStyles.periodTab, reportPeriod===p && histStyles.periodTabActive]} onPress={() => setReportPeriod(p)} activeOpacity={0.80}>
                <Text style={[histStyles.periodTabTxt, reportPeriod===p && histStyles.periodTabTxtActive]}>{p.charAt(0).toUpperCase()+p.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {reportPeriod === 'daily' && (
            <View style={{ height:30, marginTop:6, ...(Platform.OS==='web' ? { overflowX:'auto' } : {}) }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex:1 }}
                contentContainerStyle={{ gap:5, paddingHorizontal:2, alignItems:'center' }}
                scrollEnabled={Platform.OS!=='web'}>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity key={m} style={[histStyles.monthPill, selectedMonth===i && histStyles.monthPillActive]} onPress={() => setSelectedMonth(i)} activeOpacity={0.80}>
                    <Text style={[histStyles.monthPillTxt, selectedMonth===i && histStyles.monthPillTxtActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
            <View style={histStyles.sumCard}><Text style={histStyles.sumCardLabel}>Total Orders</Text><Text style={histStyles.sumCardValue}>{totalCount}</Text></View>
            <View style={histStyles.sumCard}><Text style={histStyles.sumCardLabel}>Total Revenue</Text><Text style={[histStyles.sumCardValue, { fontSize:14 }]}>₱{totalRevenue.toFixed(2)}</Text></View>
          </View>

          <ScrollView showsVerticalScrollIndicator style={{ flex:1, marginTop:10 }} nestedScrollEnabled>
            {reportData.length === 0 ? (
              <View style={{ alignItems:'center', paddingVertical:32 }}>
                <Text style={{ fontSize:30, marginBottom:8 }}>📊</Text>
                <Text style={histStyles.emptyTitle}>No data for this period</Text>
              </View>
            ) : (
              <View style={{ backgroundColor:'rgba(255,255,255,0.50)', borderRadius:10, overflow:'hidden', borderWidth:1, borderColor:'rgba(200,218,235,0.70)' }}>
                <View style={{ flexDirection:'row', backgroundColor:'rgba(220,232,242,0.95)', paddingVertical:8, paddingHorizontal:12, borderBottomWidth:1, borderBottomColor:'rgba(180,205,225,0.70)' }}>
                  <Text style={[histStyles.thTxt, { flex:1 }]}>{reportPeriod==='daily' ? `${MONTHS[selectedMonth].toUpperCase()} — DAY` : reportPeriod==='monthly' ? 'MONTH' : 'YEAR'}</Text>
                  <Text style={[histStyles.thTxt, { width:58, textAlign:'center' }]}>ORDERS</Text>
                  <Text style={[histStyles.thTxt, { width:90, textAlign:'right' }]}>REVENUE</Text>
                </View>
                {reportData.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <View key={idx} style={{ flexDirection:'row', paddingVertical:9, paddingHorizontal:12, backgroundColor:isEven?'rgba(255,255,255,0.30)':'rgba(210,228,242,0.30)', borderBottomWidth:1, borderBottomColor:'rgba(200,218,235,0.40)' }}>
                      <Text style={[histStyles.tdItem, { flex:1 }]}>{row.label}</Text>
                      <Text style={[histStyles.tdQty, { width:58, textAlign:'center' }]}>{row.count}</Text>
                      <Text style={[histStyles.tdTotal, { width:90, textAlign:'right' }]}>₱{row.total.toFixed(2)}</Text>
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


const delivStyles = StyleSheet.create({
  box: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200,218,235,0.80)',
    padding: 11,
    gap: 8,
    marginBottom: 2,
  },
  mapTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,218,235,0.90)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  mapTriggerSet: {
    borderColor: 'rgba(39,174,96,0.55)',
    backgroundColor: 'rgba(39,174,96,0.07)',
  },
  mapTriggerUnset: {
    borderColor: 'rgba(231,76,60,0.45)',
    backgroundColor: 'rgba(231,76,60,0.05)',
    borderStyle: 'dashed',
  },
  mapTriggerPin: { fontSize: 16 },
  mapTriggerTxt: {
    flex: 1,
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 12,
    color: 'rgba(1,31,75,0.40)',
  },
  mapTriggerTxtSet: {
    color: '#0f1e35',
    fontFamily: 'GoogleSans_500Medium',
  },
  mapTriggerChevron: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 11,
    color: 'rgba(1,31,75,0.35)',
  },
  sectionLabel: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 10,
    color: 'rgba(1,31,75,0.55)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(1,31,75,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(1,31,75,0.12)',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(26,58,107,0.12)',
    borderColor: '#1a3a6b',
  },
  toggleBtnActiveDeliver: {
    backgroundColor: 'rgba(231,76,60,0.10)',
    borderColor: '#e74c3c',
  },
  toggleIcon: { fontSize: 16 },
  toggleTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 12,
    color: 'rgba(1,31,75,0.50)',
  },
  toggleTxtActive: {
    color: '#1a3a6b',
  },
  toggleTxtActiveDeliver: {
    color: '#c0392b',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,218,235,0.90)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    gap: 6,
  },
  locPin: { fontSize: 16 },
  locInput: {
    flex: 1,
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 12,
    color: '#0f1e35',
    paddingVertical: 8,
  },

});

// ─── HISTORY STYLES ───────────────────────────────────────────────────────────
const histStyles = StyleSheet.create({
  panel: { flex:1, backgroundColor:'rgba(255,255,255,0.22)', borderRadius:16, borderWidth:1, borderColor:'rgba(255,255,255,0.45)', padding:12, overflow:'hidden', minHeight:0, minWidth:0 },
  panelHeaderRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8, flexWrap:'wrap', gap:6, zIndex:9999 },
  panelTitle: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'rgba(1,31,75,0.65)', letterSpacing:1.5, textTransform:'uppercase' },
  countBadge: { backgroundColor:'rgba(1,31,75,0.09)', borderRadius:6, paddingHorizontal:8, paddingVertical:3, borderWidth:1, borderColor:'rgba(1,31,75,0.12)' },
  countBadgeText: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'rgba(1,31,75,0.55)', letterSpacing:0.8 },
  sortBtn: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(255,255,255,0.75)', borderRadius:8, paddingHorizontal:9, paddingVertical:5, borderWidth:1, borderColor:'rgba(200,218,235,0.90)' },
  sortBtnText: { fontFamily:'GoogleSans_500Medium', fontSize:10, color:'rgba(1,31,75,0.65)' },
  sortDropdown: { position:'absolute', top:'100%', right:0, marginTop:4, backgroundColor:'#fff', borderRadius:10, borderWidth:1, borderColor:'rgba(200,218,235,0.80)', shadowColor:'#011f4b', shadowOpacity:0.18, shadowRadius:10, shadowOffset:{width:0,height:4}, elevation:9999, zIndex:9999, minWidth:168, overflow:'hidden' },
  sortDropItem: { paddingHorizontal:14, paddingVertical:11, borderBottomWidth:1, borderBottomColor:'rgba(200,218,235,0.50)' },
  sortDropItemActive: { backgroundColor:'rgba(26,58,107,0.07)' },
  sortDropItemText: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.70)' },
  thCell: { paddingHorizontal:5 },
  thTxt: { fontFamily:'GoogleSans_700Bold', fontSize:7, color:'rgba(1,31,75,0.55)', letterSpacing:1.2, textTransform:'uppercase' },
  thDiv: { width:1, alignSelf:'stretch', backgroundColor:'rgba(180,205,225,0.70)' },
  tdRow: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.30)', borderBottomWidth:1, borderBottomColor:'rgba(200,218,235,0.40)', paddingVertical:7 },
  tdRowEven: { backgroundColor:'rgba(210,228,242,0.35)' },
  tdCell: { paddingHorizontal:5 },
  tdDate: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'#0f1e35' },
  tdTime: { fontFamily:'GoogleSans_400Regular', fontSize:8, color:'rgba(1,31,75,0.45)', marginTop:1 },
  tdOrderNo: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#1a3a6b' },
  tdItem: { fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(1,31,75,0.72)', lineHeight:14 },
  tdQty: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#0f1e35', textAlign:'center' },
  tdPm: { fontFamily:'GoogleSans_700Bold', fontSize:11, textAlign:'center' },
  tdTotal: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#27ae60', textAlign:'center' },
  tdStatus: { fontFamily:'GoogleSans_700Bold', fontSize:10, textAlign:'center' },
  emptyTitle: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'rgba(1,31,75,0.55)', textAlign:'center' },
  emptySubtitle: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.40)', textAlign:'center', marginTop:4 },
  shopNowBtn: { marginTop:16, backgroundColor:'#1a2d4e', borderRadius:12, paddingHorizontal:24, paddingVertical:10 },
  shopNowText: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#c9a84c' },
  yearBtn: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(26,58,107,0.12)', borderRadius:20, paddingHorizontal:12, paddingVertical:7, borderWidth:1.5, borderColor:'rgba(26,58,107,0.25)' },
  yearBtnText: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#0f1e35', letterSpacing:0.5 },
  yearDropdown: { position:'absolute', top:'100%', left:0, marginTop:4, backgroundColor:'#fff', borderRadius:10, borderWidth:1, borderColor:'rgba(200,218,235,0.80)', shadowColor:'#011f4b', shadowOpacity:0.15, shadowRadius:10, shadowOffset:{width:0,height:4}, elevation:9999, zIndex:9999, minWidth:100 },
  yearDropItem: { paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1, borderBottomColor:'rgba(200,218,235,0.50)' },
  yearDropItemActive: { backgroundColor:'#1a3a6b' },
  yearDropItemText: { fontFamily:'GoogleSans_400Regular', fontSize:13, color:'rgba(1,31,75,0.70)', textAlign:'center' },
  periodRow: { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.35)', borderRadius:22, padding:3, gap:2 },
  periodTab: { flex:1, paddingVertical:7, borderRadius:18, alignItems:'center' },
  periodTabActive: { backgroundColor:'#1a2d4e', shadowColor:'#000', shadowOpacity:0.15, shadowRadius:4, elevation:2 },
  periodTabTxt: { fontFamily:'GoogleSans_500Medium', fontSize:12, color:'rgba(1,31,75,0.60)' },
  periodTabTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  monthPill: { paddingHorizontal:9, paddingVertical:4, borderRadius:12, backgroundColor:'rgba(26,58,107,0.10)', borderWidth:1, borderColor:'rgba(26,58,107,0.15)' },
  monthPillActive: { backgroundColor:'#1a2d4e', borderColor:'#1a2d4e' },
  monthPillTxt: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.60)' },
  monthPillTxtActive: { color:'#fff' },
  sumCard: { flex:1, backgroundColor:'rgba(255,255,255,0.50)', borderRadius:10, padding:10, borderWidth:1, borderColor:'rgba(200,218,235,0.70)', alignItems:'center' },
  sumCardLabel: { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.50)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 },
  sumCardValue: { fontFamily:'NotoSerif_700Bold', fontSize:20, color:'#0f1e35' },
});


const tblStyle = StyleSheet.create({
  tableWrap: {
    backgroundColor:'rgba(255,255,255,0.55)',
    borderRadius:10, borderWidth:1,
    borderColor:'rgba(200,218,235,0.80)',
    overflow:'hidden', flex:1, minHeight:0,
    shadowColor:'#011f4b', shadowOpacity:0.06,
    shadowRadius:8, shadowOffset:{width:0,height:2}, elevation:2,
  },
  thead: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(220,232,242,0.95)',
    borderBottomWidth:1.5, borderColor:'rgba(180,205,225,0.90)',
    paddingVertical:10,
  },
  hCell: {
    fontFamily:'GoogleSans_700Bold', fontSize:9,
    color:'rgba(1,31,75,0.55)', letterSpacing:1.8,
    textTransform:'uppercase', paddingHorizontal:14,
  },
  hDivider: { width:1, alignSelf:'stretch', backgroundColor:'rgba(180,205,225,0.70)' },
  row: {
    flexDirection:'row', alignItems:'center',
    borderBottomWidth:1, borderColor:'rgba(200,218,235,0.55)',
    paddingVertical:11,
    backgroundColor:'rgba(255,255,255,0.30)',
  },
  rowEven: { backgroundColor:'rgba(210,228,242,0.35)' },
  cell: { paddingHorizontal:14 },
  ordNo:    { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#0f1e35' },
  ordDate:  { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.45)', marginTop:2, lineHeight:13 },
  itemLine: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.72)', lineHeight:15 },
  total:    { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#27ae60' },
});

// ──────────────── STYLES ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex:1,
    ...(Platform.OS === 'web' ? { height:'100vh', maxHeight:'100vh', overflow:'hidden' } : {}),
  },

  // Header
  header: {
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    backgroundColor:'#304674', borderRadius:14,
    borderBottomWidth:1, borderColor:'rgba(201,168,76,0.25)',
    shadowColor:'#011f4b', shadowOpacity:0.20, shadowRadius:20,
    shadowOffset:{width:0,height:4}, elevation:8,
  },
  backBtn: {
    width:40, height:40, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.15)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.30)',
    justifyContent:'center', alignItems:'center', flexShrink:0, position:'relative',
  },
  backIcon: { color:'#fff', fontSize:16, fontWeight:'600', textAlign:'center', lineHeight:20 },
  headerRight: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0,
  },
  headerAvatar: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: '#c9a84c',
  },
  headerAvatarFallback: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(201,168,76,0.25)',
    borderWidth: 2, borderColor: '#c9a84c',
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarInitial: {
    fontFamily: 'NotoSerif_700Bold', fontSize: 13, color: '#c9a84c',
  },
  headerFirstName: {
    fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: '#fff',
    maxWidth: 72, letterSpacing: 0.3,
  },
  menuBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center', alignItems: 'center',
  },
  menuIcon: { color: '#fff', fontSize: 17, fontWeight: '700' },
  dropdown: {
    position: 'absolute', top: '100%', right: 0,
    marginTop: 6, minWidth: 160,
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 13, paddingHorizontal: 18,
  },
  dropdownItemText: {
    fontFamily: 'GoogleSans_500Medium', fontSize: 14, color: '#fff', letterSpacing: 0.3,
  },
  headerCenter: { flex:1, alignItems:'center', paddingHorizontal:10 },
  headerH1: {
    fontFamily:'NotoSerif_700Bold', fontWeight:'700',
    color:'#ffffff', textAlign:'center', letterSpacing:0.3,
  },
  headerGold: { fontFamily:'NotoSerif_700Bold_Italic', color:'#c9a84c', fontStyle:'italic' },
  visitorTag: {
    marginTop:0, paddingHorizontal:10, paddingVertical:3,
    borderRadius:20, backgroundColor:'rgba(255,255,255,0.18)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.60)',
    alignSelf:'center', alignItems:'center', justifyContent:'center',
  },
  visitorTagText: {
    fontFamily:'GoogleSans_700Bold', fontSize:9,
    color:'#ffffff', letterSpacing:1.5, textTransform:'uppercase',
    textAlign:'center', lineHeight:13, includeFontPadding:false,
  },
  cartDot: {
    position:'absolute', top:-2, right:-2,
    backgroundColor:'#c9a84c', width:16, height:16,
    borderRadius:8, justifyContent:'center', alignItems:'center',
  },
  cartDotText: { color:'#0d1b3e', fontSize:9, fontWeight:'800' },

  // Body layout
  body: {
    flex:1,
    marginTop: Platform.OS === 'web' ? 12 : 6,
    minHeight: 0,
    overflow: Platform.OS === 'web' ? 'hidden' : 'visible',
  },

  // LEFT — Categories panel
  catPanel: {
    width:170, backgroundColor:'rgba(255,255,255,0.22)',
    borderRadius:16, marginLeft:20, marginTop:0, marginBottom:16,
    padding:12, gap:6,
    borderWidth:1, borderColor:'rgba(255,255,255,0.40)',
    overflow:'hidden',
  },
  catPanelTitle: {
    fontFamily:'GoogleSans_700Bold', fontSize:12,
    color:'rgba(1,31,75,0.65)', letterSpacing:3,
    textTransform:'uppercase', marginBottom:6,
    paddingBottom:6, borderBottomWidth:1,
    borderColor:'rgba(1,31,75,0.12)',
  },
  catBtn: {
    paddingVertical:10, paddingHorizontal:14,
    borderRadius:10,
    backgroundColor:'rgba(255,255,255,0.55)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.70)',
  },
  catBtnActive: {
    backgroundColor:'#c9a84c', borderColor:'#c9a84c',
  },
  catBtnText: {
    fontFamily:'GoogleSans_500Medium', fontSize:13,
    color:'rgba(1,31,75,0.75)', textAlign:'center',
  },
  catBtnTextActive: {
    fontFamily:'GoogleSans_700Bold', color:'#0d1b3e',
  },

  // CENTER panel
  centerPanel: {
    flex:1, flexDirection:'column',
    paddingHorizontal: Platform.OS==='web' ? 12 : 10,
    paddingBottom: Platform.OS==='web' ? 16 : 0,
    minHeight: 0,
    overflow: Platform.OS==='web' ? 'hidden' : 'visible',
  },
  itemsPanel: {
    backgroundColor:'rgba(255,255,255,0.22)',
    borderRadius:16,
    borderWidth:1, borderColor:'rgba(255,255,255,0.40)',
    padding: Platform.OS==='web' ? 10 : 6,
    overflow:'hidden',
    flex:1,
    minHeight: 0,
    marginBottom: Platform.OS==='web' ? 16 : 8,
  },

  // ── FIX: Search bar — compact, full width, below tabs ──
  searchBoxInline: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(255,255,255,0.75)',
    borderRadius:8, paddingHorizontal:8, paddingVertical:5,
    borderWidth:1, borderColor:'rgba(255,255,255,0.90)',
    flex:1,
  },
  searchInputInline: {
    flex:1, fontFamily:'GoogleSans_400Regular',
    fontSize:11, color:'#011f4b', paddingVertical:0,
    ...(Platform.OS === 'web' ? { outlineStyle:'none' } : {}),
  },
  searchBox: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(255,255,255,0.72)',
    borderRadius:10, paddingHorizontal:10, paddingVertical:5,
    borderWidth:1, borderColor:'rgba(255,255,255,0.90)',
    marginBottom:10,
    shadowColor:'#011f4b', shadowOpacity:0.07,
    shadowRadius:6, shadowOffset:{width:0,height:2},
  },
  searchIcon: { fontSize:12, marginRight:5 },
  searchInput: {
    flex:1, fontFamily:'GoogleSans_400Regular',
    fontSize:12, color:'#011f4b',
    paddingVertical:0,
  },

  menuSectionLabel: {
    fontFamily:'GoogleSans_700Bold', fontSize:12,
    color:'#011f4b', letterSpacing:2,
    marginBottom:6, paddingBottom:6,
    borderBottomWidth:1,
    borderColor:'rgba(1,31,75,0.10)',
  },
  menuGrid: { paddingTop:2 },
  menuRow: { flexDirection:'row', flexWrap:'wrap', justifyContent:'flex-start' },
  emptyText: {
    fontFamily:'GoogleSans_400Regular', fontSize:13,
    color:'rgba(1,31,75,0.55)', padding:20,
  },

  // Mobile category tabs
  catTab: {
    paddingVertical:8, paddingHorizontal:16, borderRadius:16,
    backgroundColor:'rgba(255,255,255,0.25)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.45)',
    alignItems:'center', justifyContent:'center',
  },
  catTabActive: { backgroundColor:'#304674', borderColor:'#c9a84c' },
  catTabText: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'rgba(255,255,255,0.85)', textAlign:'center', lineHeight:16, includeFontPadding:false },
  catTabTextActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },

  // FOOD CARD — no inline qty counter
  foodCard: {
    borderRadius:14, overflow:'hidden',
    shadowColor:'#011f4b', shadowOpacity:0.10,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:3,
    flex:1,
  },
  foodCardInner: {
    borderRadius:14, padding: Platform.OS==='web' ? 14 : 8,
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.75)',
    alignItems:'center', gap: Platform.OS==='web' ? 4 : 3,
    flex:1,
    justifyContent:'space-between',
  },
  emojiCircle: {
    width: Platform.OS==='web' ? 72 : 52,
    height: Platform.OS==='web' ? 72 : 52,
    borderRadius: Platform.OS==='web' ? 36 : 26,
    backgroundColor:'rgba(240,246,252,0.90)',
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.85)',
    justifyContent:'center', alignItems:'center',
    marginBottom: Platform.OS==='web' ? 6 : 3,
    shadowColor:'#011f4b', shadowOpacity:0.08,
    shadowRadius:6, shadowOffset:{width:0,height:2},
    overflow:'hidden',
  },
  emojiText: { fontSize: Platform.OS==='web' ? 34 : 24 },
  itemName: {
    fontFamily:'GoogleSans_700Bold',
    fontSize: Platform.OS==='web' ? 11 : 9,
    color:'#1a2d4e', textAlign:'center', fontWeight:'700',
    lineHeight: Platform.OS==='web' ? 15 : 12,
    minHeight: Platform.OS==='web' ? 15 : 24,
  },
  itemStock: {
    fontFamily:'GoogleSans_400Regular',
    fontSize: Platform.OS==='web' ? 10 : 9,
    color:'rgba(1,31,75,0.45)', letterSpacing:0.2,
  },
  itemPrice: {
    fontFamily:'NotoSerif_700Bold',
    fontSize: Platform.OS==='web' ? 14 : 12,
    color:'#c9a84c', fontWeight:'700', letterSpacing:0.3,
  },
  addBtn: {
    backgroundColor:'#1a3a6b', borderRadius:7,
    paddingVertical: Platform.OS==='web' ? 8 : 6,
    paddingHorizontal:4,
    marginTop:2, alignItems:'center',
    width:'100%',
    shadowColor:'#1a3a6b', shadowOpacity:0.30,
    shadowRadius:6, shadowOffset:{width:0,height:2},
  },
  addBtnText: {
    fontFamily:'GoogleSans_700Bold',
    fontSize: Platform.OS==='web' ? 10 : 9,
    color:'#ffffff', fontWeight:'700', letterSpacing:0.3,
  },

  // RIGHT — Cart panel
  cartPanel: {
    width:230, backgroundColor:'rgba(255,255,255,0.22)',
    borderRadius:16, marginRight:20, marginBottom:16,
    padding:14, gap:8,
    borderWidth:1, borderColor:'rgba(255,255,255,0.45)',
    overflow:'hidden',
  },
  cartPanelMobile: {
    width:'100%', marginRight:0, marginBottom:0,
    borderRadius:0, backgroundColor:'transparent',
    borderWidth:0, padding:14,
  },
  cartPanelTitle: {
    fontFamily:'GoogleSans_700Bold', fontSize:13,
    color:'rgba(1,31,75,0.70)', letterSpacing:3,
    textTransform:'uppercase', marginBottom:4,
    paddingBottom:6, borderBottomWidth:1,
    borderColor:'rgba(1,31,75,0.12)',
  },
  cartItemsBox: {
    backgroundColor:'rgba(255,255,255,0.45)',
    borderRadius:10, padding:10, minHeight:60,
    borderWidth:1, borderColor:'rgba(255,255,255,0.65)',
  },
  cartEmpty: {
    fontFamily:'GoogleSans_400Regular', fontSize:12,
    color:'rgba(1,31,75,0.45)', textAlign:'center', paddingVertical:8,
  },
  cartRow: {
    flexDirection:'row', alignItems:'center',
    gap:8, paddingVertical:6,
    borderBottomWidth:1, borderColor:'rgba(1,31,75,0.07)',
  },
  cartRowEmoji: { fontSize:18 },
  cartRowName: {
    fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#011f4b',
  },
  cartRowSub: {
    fontFamily:'GoogleSans_400Regular', fontSize:10,
    color:'rgba(1,31,75,0.55)',
  },
  checkbox: {
    width:22, height:22, borderRadius:5,
    borderWidth:2, borderColor:'rgba(1,31,75,0.30)',
    alignItems:'center', justifyContent:'center',
    backgroundColor:'rgba(255,255,255,0.80)', flexShrink:0,
    marginRight:6,
  },
  checkboxChecked: { backgroundColor:'#27ae60', borderColor:'#27ae60' },
  checkmark: { color:'#fff', fontSize:13, fontWeight:'900', lineHeight:16 },

  cartRowQty: { flexDirection:'row', gap:4 },
  cartQBtn: {
    width:22, height:22, borderRadius:11,
    backgroundColor:'rgba(255,255,255,0.7)',
    borderWidth:1, borderColor:'rgba(1,31,75,0.20)',
    justifyContent:'center', alignItems:'center',
  },
  cartQBtnAdd: { backgroundColor:'#1a3a6b', borderColor:'#1a3a6b' },
  cartQBtnText: { fontSize:13, color:'#011f4b', fontWeight:'700', lineHeight:17 },

  totalRow: {
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingVertical:4,
  },
  totalLabel: {
    fontFamily:'GoogleSans_500Medium', fontSize:13, color:'rgba(1,31,75,0.75)',
  },
  totalValue: {
    fontFamily:'NotoSerif_700Bold', fontSize:15, color:'#0d1b3e',
  },
  paymentModeBox: {
    backgroundColor:'rgba(255,255,255,0.30)',
    borderRadius:10, padding:10,
    borderWidth:1, borderColor:'rgba(255,255,255,0.60)',
    marginVertical:4,
  },
  paymentModeLabel: {
    fontFamily:'GoogleSans_700Bold', fontSize:10,
    color:'rgba(1,31,75,0.60)', letterSpacing:1.2,
    textTransform:'uppercase', marginBottom:8,
  },
  paymentModeRow: { flexDirection:'row', gap:10 },
  paymentModeOption: { flexDirection:'row', alignItems:'center', gap:6, flex:1 },
  radioOuter: {
    width:18, height:18, borderRadius:9,
    borderWidth:2, borderColor:'rgba(1,31,75,0.30)',
    alignItems:'center', justifyContent:'center',
    backgroundColor:'rgba(255,255,255,0.70)',
  },
  radioOuterActive: { borderColor:'#1a3a6b' },
  radioInner: { width:9, height:9, borderRadius:5, backgroundColor:'#1a3a6b' },
  paymentModeText: {
    fontFamily:'GoogleSans_400Regular', fontSize:12,
    color:'rgba(1,31,75,0.55)',
  },
  paymentModeTextActive: {
    fontFamily:'GoogleSans_700Bold', color:'#1a3a6b',
  },
  visitorNote: {
    backgroundColor:'rgba(255,255,255,0.45)', borderRadius:8,
    paddingVertical:6, paddingHorizontal:8,
    borderWidth:1, borderColor:'rgba(255,255,255,0.65)',
  },
  visitorNoteText: {
    fontFamily:'GoogleSans_400Regular', fontSize:10,
    color:'rgba(1,31,75,0.65)', textAlign:'center',
  },
  amountLabel: {
    fontFamily:'GoogleSans_500Medium', fontSize:11,
    color:'rgba(1,31,75,0.65)',
  },
  amountInput: {
    backgroundColor:'rgba(255,255,255,0.65)',
    borderRadius:8, paddingHorizontal:10, paddingVertical:8,
    fontFamily:'GoogleSans_400Regular', fontSize:13,
    color:'#011f4b', borderWidth:1,
    borderColor:'rgba(255,255,255,0.80)',
  },
  changeRow: {
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
  },
  changeLabel: {
    fontFamily:'GoogleSans_500Medium', fontSize:12, color:'rgba(1,31,75,0.65)',
  },
  changeValue: {
    fontFamily:'NotoSerif_700Bold', fontSize:14,
  },
  placeOrderBtn: {
    borderRadius: 12, overflow:'hidden',
    shadowColor:'#27ae60', shadowOpacity:0.40,
    shadowRadius:10, shadowOffset:{width:0,height:4}, elevation:6,
  },
  placeOrderBtnDisabled: {
    shadowColor:'transparent', shadowOpacity:0, elevation:0,
  },
  placeOrderGrad: {
    flexDirection:'row', alignItems:'center', justifyContent:'center',
    gap:8, paddingVertical:14,
  },
  placeOrderIcon: { fontSize:16 },
  placeOrderText: {
    fontFamily:'GoogleSans_700Bold', fontSize:14,
    color:'#ffffff', letterSpacing:0.5,
  },
  clearBtn: {
    flexDirection:'row', alignItems:'center', justifyContent:'center',
    gap:7, backgroundColor:'#e74c3c', borderRadius:12,
    paddingVertical:12,
    shadowColor:'#e74c3c', shadowOpacity:0.35,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:4,
  },
  clearBtnIcon: { fontSize:14 },
  clearBtnText: {
    fontFamily:'GoogleSans_700Bold', fontSize:13,
    color:'#fff', letterSpacing:0.3,
  },
  printBtn: {
    flexDirection:'row', alignItems:'center', justifyContent:'center',
    gap:7, backgroundColor:'#1a3a6b', borderRadius:12,
    paddingVertical:12,
    shadowColor:'#1a3a6b', shadowOpacity:0.35,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:4,
  },
  printBtnIcon: { fontSize:14 },
  printBtnText: {
    fontFamily:'GoogleSans_700Bold', fontSize:13,
    color:'#fff', letterSpacing:0.3,
  },

  // ── Receipt Modal ────────────────────────────────────────────────────────
  receiptOverlay: {
    flex:1, backgroundColor:'rgba(5,15,40,0.65)',
    justifyContent:'center', alignItems:'center', padding:20,
  },
  receiptCard: {
    width:'100%', maxWidth:380,
    backgroundColor:'#fffef8',
    borderRadius:4,
    shadowColor:'#000', shadowOpacity:0.35,
    shadowRadius:30, shadowOffset:{width:0,height:10}, elevation:20,
    overflow:'hidden',
    maxHeight:'90%',
  },
  receiptJaggedTop: {
    flexDirection:'row', backgroundColor:'#98bad5',
    height:16, overflow:'hidden',
  },
  receiptJaggedTriangle: {
    flex:1, height:16,
    backgroundColor:'#fffef8',
    borderTopLeftRadius:8, borderTopRightRadius:8,
  },
  receiptJaggedBottom: {
    flexDirection:'row', backgroundColor:'#fffef8',
    height:16, overflow:'hidden',
  },
  receiptJaggedTriangleBottom: {
    flex:1, height:16,
    backgroundColor:'#98bad5',
    borderTopLeftRadius:8, borderTopRightRadius:8,
  },
  receiptHeader: {
    alignItems:'center', paddingTop:16, paddingHorizontal:20, paddingBottom:4,
  },
  receiptShopName: {
    fontFamily:'NotoSerif_700Bold', fontSize:17,
    color:'#1a2d4e', letterSpacing:1, textAlign:'center',
  },
  receiptShopSub: {
    fontFamily:'GoogleSans_400Regular', fontSize:11,
    color:'rgba(1,31,75,0.55)', marginTop:3, textAlign:'center',
  },
  receiptDividerDashed: {
    width:'100%', borderBottomWidth:1,
    borderColor:'rgba(1,31,75,0.18)', borderStyle:'dashed',
    marginVertical:10,
  },
  receiptDividerSolid: {
    height:1, backgroundColor:'rgba(1,31,75,0.15)', marginVertical:6,
  },
  receiptMeta: {
    fontFamily:'GoogleSans_400Regular', fontSize:11,
    color:'rgba(1,31,75,0.60)', textAlign:'center', lineHeight:17,
  },
  receiptItemHeader: {
    flexDirection:'row', marginBottom:2,
  },
  receiptItemHCol: {
    fontFamily:'GoogleSans_700Bold', fontSize:10,
    color:'rgba(1,31,75,0.50)', letterSpacing:1,
    textTransform:'uppercase',
  },
  receiptItemRow: {
    flexDirection:'row', alignItems:'center', paddingVertical:5,
    borderBottomWidth:1, borderColor:'rgba(1,31,75,0.06)',
  },
  receiptItemText: {
    fontFamily:'GoogleSans_400Regular', fontSize:12, color:'#1a2d4e',
  },
  receiptTotalRow: {
    flexDirection:'row', justifyContent:'space-between',
    alignItems:'center', paddingVertical:3,
  },
  receiptTotalLabel: {
    fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#1a2d4e', letterSpacing:0.5,
  },
  receiptTotalValue: {
    fontFamily:'NotoSerif_700Bold', fontSize:16, color:'#c9a84c',
  },
  receiptSubTotalLabel: {
    fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.60)',
  },
  receiptSubTotalValue: {
    fontFamily:'GoogleSans_700Bold', fontSize:12, color:'rgba(1,31,75,0.75)',
  },
  receiptThankYou: {
    fontFamily:'NotoSerif_700Bold', fontSize:13,
    color:'#1a2d4e', textAlign:'center', marginTop:12, marginBottom:4,
  },
  receiptFooter: {
    fontFamily:'GoogleSans_400Regular', fontSize:10,
    color:'rgba(1,31,75,0.40)', textAlign:'center', marginBottom:10,
  },
  receiptActions: {
    flexDirection:'row', gap:10,
    padding:16, borderTopWidth:1,
    borderColor:'rgba(1,31,75,0.10)',
    backgroundColor:'#fffef8',
  },
  receiptCloseBtn: {
    flex:1, paddingVertical:12, borderRadius:10,
    backgroundColor:'rgba(1,31,75,0.08)',
    borderWidth:1, borderColor:'rgba(1,31,75,0.15)',
    alignItems:'center', justifyContent:'center',
  },
  receiptCloseBtnText: {
    fontFamily:'GoogleSans_700Bold', fontSize:13, color:'rgba(1,31,75,0.65)',
  },
  receiptPrintBtn: {
    flex:2, borderRadius:10, overflow:'hidden',
    shadowColor:'#1a3a6b', shadowOpacity:0.30,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:4,
  },
  receiptPrintBtnGrad: {
    paddingVertical:12, alignItems:'center', justifyContent:'center',
  },
  receiptPrintBtnText: {
    fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#fff', letterSpacing:0.5,
  },

  // Bottom sheet
  sheetOverlay: {
    position:'absolute', top:0, left:0, right:0, bottom:0,
    justifyContent:'flex-end', zIndex:100,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:'rgba(1,20,50,0.45)',
  },
  sheet: {
    backgroundColor:'#f0f5f9',
    borderTopLeftRadius:24, borderTopRightRadius:24,
    paddingBottom:34, maxHeight:'92%',
    shadowColor:'#000', shadowOpacity:0.35,
    shadowRadius:20, shadowOffset:{width:0,height:-4}, elevation:20,
    overflow:'scroll',
  },
  sheetHandle: {
    width:40, height:4, borderRadius:2,
    backgroundColor:'rgba(1,31,75,0.20)',
    alignSelf:'center', marginTop:10, marginBottom:6,
  },
  sheetHeader: {
    flexDirection:'row', alignItems:'center',
    justifyContent:'space-between',
    paddingHorizontal:20, paddingVertical:10,
    borderBottomWidth:1, borderColor:'rgba(1,31,75,0.10)',
  },
  sheetClose: {
    width:30, height:30, borderRadius:15,
    backgroundColor:'rgba(1,31,75,0.08)',
    justifyContent:'center', alignItems:'center',
  },

  // Floating cart button
  floatCart: {
    position:'absolute', bottom:28,
    left:0, right:0,
    alignItems:'center',
  },
  floatCartGradient: {
    borderRadius:30, paddingVertical:10,
    paddingHorizontal:32, alignItems:'center',
  },
  floatCartText: {
    fontFamily:'GoogleSans_700Bold', fontSize:14,
    color:'#0d1b3e', fontWeight:'700',
  },
});