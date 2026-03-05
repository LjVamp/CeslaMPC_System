// src/screens/CanteenVisitor.js
// CLIMBS Canteen — Visitor Food Ordering Screen
// 3-panel layout: Left Categories | Center Menu+Search | Right Cart

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, StatusBar,
  useWindowDimensions, Platform, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

// ─── DATA ─────────────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Meals', 'Drinks', 'Snacks', 'Junk Foods', 'Others'];

const MENU_ITEMS = [
  { id:'1',  name:'Fried Chicken',   cat:'Meals',      price:80,  stock:15, emoji:'🍗' },
  { id:'2',  name:'Lugaw with Egg',  cat:'Meals',      price:55,  stock:50, emoji:'🍚' },
  { id:'3',  name:'Pancit Canton',   cat:'Meals',      price:65,  stock:25, emoji:'🍜' },
  { id:'4',  name:'Pork Adobo',      cat:'Meals',      price:75,  stock:20, emoji:'🥩' },
  { id:'5',  name:'Sinangag',        cat:'Meals',      price:30,  stock:30, emoji:'🍳' },
  { id:'6',  name:'Bottled Water',   cat:'Drinks',     price:15,  stock:80, emoji:'💧' },
  { id:'7',  name:'Juice',           cat:'Drinks',     price:20,  stock:60, emoji:'🧃' },
  { id:'8',  name:'Softdrinks',      cat:'Drinks',     price:25,  stock:100,emoji:'🥤' },
  { id:'9',  name:'Biscuit',         cat:'Snacks',     price:15,  stock:40, emoji:'🍪' },
  { id:'10', name:'Chips',           cat:'Snacks',     price:20,  stock:50, emoji:'🍟' },
  { id:'11', name:'Junk Food Pack',  cat:'Junk Foods', price:18,  stock:45, emoji:'🍿' },
  { id:'12', name:'Mixed Nuts',      cat:'Junk Foods', price:35,  stock:30, emoji:'🥜' },
];

// ─── FOOD CARD (Web style — matches screenshot) ───────────────────────────────
const FoodCard = ({ item, qty, onAdd, onRemove }) => (
  <View style={styles.foodCard}>
    {Platform.OS === 'web' ? (
      <LinearGradient
        colors={['rgba(220,232,242,0.80)','rgba(200,218,235,0.60)']}
        start={{x:0,y:0}} end={{x:0,y:1}}
        style={styles.foodCardInner}
      >
        <FoodCardBody item={item} qty={qty} onAdd={onAdd} onRemove={onRemove} />
      </LinearGradient>
    ) : (
      <View style={[styles.foodCardInner, { backgroundColor:'rgba(225,238,248,0.85)' }]}>
        <FoodCardBody item={item} qty={qty} onAdd={onAdd} onRemove={onRemove} />
      </View>
    )}
  </View>
);

const FoodCardBody = ({ item, qty, onAdd, onRemove }) => (
  <>
    {/* Emoji circle */}
    <View style={styles.emojiCircle}>
      <Text style={styles.emojiText}>{item.emoji}</Text>
    </View>
    <Text style={styles.itemName}>{item.name}</Text>
    <Text style={styles.itemStock}>Stock: {item.stock}</Text>
    <Text style={styles.itemPrice}>₱{item.price}.00</Text>

    {qty > 0 ? (
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyMinus} onPress={onRemove}>
          <Text style={styles.qtyMinusText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyNum}>{qty}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addBtnText}>Add To Cart</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
        <Text style={styles.addBtnText}>Add To Cart</Text>
      </TouchableOpacity>
    )}
  </>
);

// ─── CART PANEL ───────────────────────────────────────────────────────────────
const CartPanel = ({ cart, onAdd, onRemove, onClear, onOrder, isWide }) => {
  const [amountPaid, setAmountPaid] = useState('');
  const total = Object.values(cart).reduce((s,{item,qty}) => s + item.price * qty, 0);
  const change = parseFloat(amountPaid || 0) - total;
  const cartItems = Object.values(cart).filter(i => i.qty > 0);

  return (
    <View style={[styles.cartPanel, !isWide && styles.cartPanelMobile]}>
      {/* CART title */}
      <Text style={styles.cartPanelTitle}>CART</Text>

      {/* Items list */}
      <View style={styles.cartItemsBox}>
        {cartItems.length === 0 ? (
          <Text style={styles.cartEmpty}>Cart is empty.</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
            {cartItems.map(({ item, qty }) => (
              <View key={item.id} style={styles.cartRow}>
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

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total :</Text>
        <Text style={styles.totalValue}>₱ {total.toFixed(2)}</Text>
      </View>

      {/* Visitor note */}
      <View style={styles.visitorNote}>
        <Text style={styles.visitorNoteText}>👤 Ordering as Visitor — Cash Only</Text>
      </View>

      {/* Amount paid */}
      <Text style={styles.amountLabel}>Amount Paid (₱)</Text>
      <TextInput
        style={styles.amountInput}
        value={amountPaid}
        onChangeText={setAmountPaid}
        keyboardType="numeric"
        placeholder="0.00"
        placeholderTextColor="rgba(1,31,75,0.35)"
      />

      {/* Change */}
      <View style={styles.changeRow}>
        <Text style={styles.changeLabel}>Change :</Text>
        <Text style={[styles.changeValue, { color: change < 0 ? '#e74c3c' : '#c9a84c' }]}>
          ₱ {isNaN(change) ? '0.00' : change.toFixed(2)}
        </Text>
      </View>

      {/* Place Order */}
      <TouchableOpacity
        style={[styles.placeOrderBtn, cartItems.length === 0 && { opacity: 0.5 }]}
        onPress={cartItems.length > 0 ? onOrder : null}
      >
        <Text style={styles.placeOrderText}>Place Order</Text>
      </TouchableOpacity>

      {/* Clear cart */}
      <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
        <Text style={styles.clearBtnText}>Clear cart</Text>
      </TouchableOpacity>

      {/* Print receipt */}
      <TouchableOpacity style={styles.printBtn}>
        <Text style={styles.printBtnText}>Print Receipt</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── BOTTOM SHEET CART (Mobile) ───────────────────────────────────────────────
const CartBottomSheet = ({ cart, onAdd, onRemove, onClear, onOrder, onClose, totalItems }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [amountPaid, setAmountPaid] = useState('');
  const total = Object.values(cart).reduce((s,{item,qty}) => s + item.price * qty, 0);
  const change = parseFloat(amountPaid || 0) - total;
  const cartItems = Object.values(cart).filter(i => i.qty > 0);

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }).start();
  }, []);

  const translateY = slideAnim.interpolate({ inputRange:[0,1], outputRange:[600,0] });

  return (
    <View style={styles.sheetOverlay}>
      <TouchableOpacity style={styles.sheetBackdrop} onPress={onClose} activeOpacity={1} />
      <Animated.View style={[styles.sheet, { transform:[{ translateY }] }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.cartPanelTitle}>CART</Text>
          <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
            <Text style={{ color:'#fff', fontSize:14 }}>✕</Text>
          </TouchableOpacity>
        </View>
        <CartPanel
          cart={cart} onAdd={onAdd} onRemove={onRemove}
          onClear={onClear} onOrder={onOrder} isWide={false}
        />
      </Animated.View>
    </View>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function CanteenVisitor({ navigation }) {
  const { width } = useWindowDimensions();
  const isWide  = width >= 900;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, NotoSerif_700Bold_Italic,
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);

  const hdrFade  = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-16)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue:1, duration:600, useNativeDriver:true }),
      Animated.timing(hdrTrans, { toValue:0, duration:600, useNativeDriver:true }),
    ]).start();
    Animated.timing(bodyFade, { toValue:1, duration:600, delay:200, useNativeDriver:true }).start();
  }, []);

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
    alert('Order placed! Thank you for ordering at CLIMBS Canteen.');
  };

  const totalItems = Object.values(cart).reduce((s,{qty}) => s+qty, 0);

  const filtered = MENU_ITEMS.filter(i =>
    (activeCategory === 'All' || i.cat === activeCategory) &&
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  // Grid cols — matches screenshot: 6 cols on wide, 2-3 on mobile
  const CART_W  = isWide ? 230 : 0;
  const CAT_W   = isWide ? 170 : 0;
  const MARGIN  = isWide ? 40 : 0;
  const CENTER  = width - CAT_W - CART_W - MARGIN;
  const COLS    = isWide ? 6 : isSmall ? 2 : 3;
  const GAP_C   = isWide ? 10 : 10;
  const CARD_W  = isWide
    ? Math.floor((CENTER - 24 - (COLS-1)*GAP_C) / COLS)
    : Math.floor((width - 32 - (COLS-1)*GAP_C) / COLS);

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
        marginTop: Platform.OS==='web' ? 16 : 50,
        marginHorizontal: isSmall ? 12 : 20, zIndex:10,
      }}>
        <View style={[styles.header, { paddingHorizontal: isWide ? 40:16, paddingVertical: isWide ? 16:10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation && navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1, { fontSize: isWide ? 22 : isSmall ? 14:16 }]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>CLIMBS </Text>
              Canteen Ordering System
            </Text>
            <View style={styles.visitorTag}>
              <Text style={styles.visitorTagText}>🚶 VISITOR / WALK-IN</Text>
            </View>
          </View>

          {/* Hamburger / Cart icon */}
          <TouchableOpacity style={styles.backBtn} onPress={() => !isWide && setCartOpen(true)}>
            <Text style={{ color:'#fff', fontSize:18 }}>{isWide ? '≡' : '🛒'}</Text>
            {!isWide && totalItems > 0 && (
              <View style={styles.cartDot}>
                <Text style={styles.cartDotText}>{totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* BODY */}
      <Animated.View style={[styles.body, { opacity: bodyFade }]}>

        {/* LEFT — Categories */}
        {isWide && (
          <View style={styles.catPanel}>
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

        {/* CENTER — Search + Menu grid */}
        <View style={styles.centerPanel}>
          {/* Mobile category tabs */}
          {!isWide && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ flexGrow:0, marginBottom:8 }}
              contentContainerStyle={{ paddingHorizontal:16, gap:8, paddingVertical:4 }}
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
          )}

          {/* Search + Label row */}
          <View style={styles.menuTopRow}>
            <Text style={styles.menuSectionLabel}>
              {activeCategory === 'All' ? 'ALL ITEMS' : activeCategory.toUpperCase()}
            </Text>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search items..."
                placeholderTextColor="rgba(1,31,75,0.40)"
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </View>

          {/* Menu grid */}
          <ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.menuGrid, { gap:10, paddingBottom:30 }]}
          >
            <View style={[styles.menuRow, { gap:10 }]}>
              {filtered.map(item => (
                <View key={item.id} style={{ width: CARD_W }}>
                  <FoodCard
                    item={item}
                    qty={cart[item.id]?.qty || 0}
                    onAdd={() => addToCart(item)}
                    onRemove={() => removeFromCart(item)}
                  />
                </View>
              ))}
              {filtered.length === 0 && (
                <Text style={styles.emptyText}>No items found.</Text>
              )}
            </View>
          </ScrollView>
        </View>

        {/* RIGHT — Cart (web only) */}
        {isWide && (
          <CartPanel
            cart={cart} onAdd={addToCart} onRemove={removeFromCart}
            onClear={clearCart} onOrder={placeOrder} isWide={isWide}
          />
        )}
      </Animated.View>

      {/* Mobile cart bottom sheet */}
      {!isWide && cartOpen && (
        <CartBottomSheet
          cart={cart} onAdd={addToCart} onRemove={removeFromCart}
          onClear={clearCart} onOrder={placeOrder}
          onClose={() => setCartOpen(false)}
          totalItems={totalItems}
        />
      )}

      {/* Mobile floating cart btn */}
      {!isWide && totalItems > 0 && !cartOpen && (
        <TouchableOpacity style={styles.floatCart} onPress={() => setCartOpen(true)}>
          <LinearGradient colors={['#c9a84c','#e8c87a']} start={{x:0,y:0}} end={{x:1,y:0}}
            style={styles.floatCartGradient}>
            <Text style={styles.floatCartText}>🛒  View Order  •  ₱{Object.values(cart).reduce((s,{item,qty})=>s+item.price*qty,0)}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex:1 },

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
  backIcon: { color:'#fff', fontSize:17, fontWeight:'600' },
  headerCenter: { flex:1, alignItems:'center', paddingHorizontal:10 },
  headerH1: {
    fontFamily:'NotoSerif_700Bold', fontWeight:'700',
    color:'#ffffff', textAlign:'center', letterSpacing:0.3,
  },
  headerGold: { fontFamily:'NotoSerif_700Bold_Italic', color:'#c9a84c', fontStyle:'italic' },
  visitorTag: {
    marginTop:4, paddingHorizontal:12, paddingVertical:3,
    borderRadius:20, backgroundColor:'rgba(46,204,113,0.25)',
    borderWidth:1, borderColor:'rgba(46,204,113,0.50)',
  },
  visitorTagText: {
    fontFamily:'GoogleSans_700Bold', fontSize:9,
    color:'#2ecc71', letterSpacing:1.5, textTransform:'uppercase',
  },
  cartDot: {
    position:'absolute', top:-2, right:-2,
    backgroundColor:'#c9a84c', width:16, height:16,
    borderRadius:8, justifyContent:'center', alignItems:'center',
  },
  cartDotText: { color:'#0d1b3e', fontSize:9, fontWeight:'800' },

  // Body layout
  body: {
    flex:1, flexDirection:'row', marginTop:12,
    paddingHorizontal:0,
  },

  // LEFT — Categories panel
  catPanel: {
    width:170, backgroundColor:'rgba(255,255,255,0.22)',
    borderRadius:16, marginLeft:20, marginBottom:16,
    padding:12, gap:6,
    borderWidth:1, borderColor:'rgba(255,255,255,0.40)',
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
    flex:1, paddingHorizontal:10, paddingRight:8,
  },
  menuTopRow: {
    flexDirection:'row', alignItems:'center',
    justifyContent:'space-between', marginBottom:12, gap:10,
  },
  menuSectionLabel: {
    fontFamily:'GoogleSans_700Bold', fontSize:14,
    color:'#011f4b', letterSpacing:2,
  },
  searchBox: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(255,255,255,0.70)',
    borderRadius:20, paddingHorizontal:14, paddingVertical:7,
    borderWidth:1, borderColor:'rgba(255,255,255,0.85)',
    flex:1, maxWidth:260,
    shadowColor:'#011f4b', shadowOpacity:0.07,
    shadowRadius:8, shadowOffset:{width:0,height:2},
  },
  searchIcon: { fontSize:13, marginRight:6 },
  searchInput: {
    flex:1, fontFamily:'GoogleSans_400Regular',
    fontSize:13, color:'#011f4b',
  },
  menuGrid: { paddingTop:4 },
  menuRow: { flexDirection:'row', flexWrap:'wrap' },
  emptyText: {
    fontFamily:'GoogleSans_400Regular', fontSize:13,
    color:'rgba(1,31,75,0.55)', padding:20,
  },

  // Mobile category tabs
  catTab: {
    paddingHorizontal:16, paddingVertical:7, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.25)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.45)',
  },
  catTabActive: { backgroundColor:'#304674', borderColor:'#c9a84c' },
  catTabText: { fontFamily:'GoogleSans_500Medium', fontSize:12, color:'rgba(255,255,255,0.85)' },
  catTabTextActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },

  // FOOD CARD
  foodCard: {
    borderRadius:14, overflow:'hidden',
    shadowColor:'#011f4b', shadowOpacity:0.10,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:3,
  },
  foodCardInner: {
    borderRadius:14, padding:14,
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.75)',
    alignItems:'center', gap:4,
    minHeight:180,
    justifyContent:'space-between',
  },
  emojiCircle: {
    width:72, height:72, borderRadius:36,
    backgroundColor:'rgba(240,246,252,0.90)',
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.85)',
    justifyContent:'center', alignItems:'center',
    marginBottom:6,
    shadowColor:'#011f4b', shadowOpacity:0.08,
    shadowRadius:6, shadowOffset:{width:0,height:2},
  },
  emojiText: { fontSize:34 },
  itemName: {
    fontFamily:'GoogleSans_700Bold', fontSize:11,
    color:'#1a2d4e', textAlign:'center', fontWeight:'700',
    lineHeight:15,
  },
  itemStock: {
    fontFamily:'GoogleSans_400Regular', fontSize:10,
    color:'rgba(1,31,75,0.45)', letterSpacing:0.2,
  },
  itemPrice: {
    fontFamily:'NotoSerif_700Bold', fontSize:14,
    color:'#c9a84c', fontWeight:'700', letterSpacing:0.3,
  },
  qtyRow: { flexDirection:'row', alignItems:'center', gap:6, marginTop:2 },
  qtyMinus: {
    width:28, height:28, borderRadius:14,
    backgroundColor:'rgba(255,255,255,0.6)',
    borderWidth:1, borderColor:'rgba(1,31,75,0.20)',
    justifyContent:'center', alignItems:'center',
  },
  qtyMinusText: { fontSize:16, color:'#011f4b', fontWeight:'700', lineHeight:20 },
  qtyNum: {
    fontFamily:'GoogleSans_700Bold', fontSize:13,
    color:'#011f4b', minWidth:16, textAlign:'center',
  },
  addBtn: {
    backgroundColor:'#1a3a6b', borderRadius:8,
    paddingVertical:8, paddingHorizontal:6,
    marginTop:4, alignItems:'center',
    width:'100%',
    shadowColor:'#1a3a6b', shadowOpacity:0.30,
    shadowRadius:6, shadowOffset:{width:0,height:2},
  },
  addBtnText: {
    fontFamily:'GoogleSans_700Bold', fontSize:10,
    color:'#ffffff', fontWeight:'700', letterSpacing:0.5,
  },

  // RIGHT — Cart panel
  cartPanel: {
    width:230, backgroundColor:'rgba(255,255,255,0.22)',
    borderRadius:16, marginRight:20, marginBottom:16,
    padding:14, gap:8,
    borderWidth:1, borderColor:'rgba(255,255,255,0.45)',
  },
  cartPanelMobile: {
    width:'100%', marginRight:0, marginBottom:0,
    borderRadius:0, backgroundColor:'transparent',
    borderWidth:0,
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
    fontFamily:'NotoSerif_700Bold', fontSize:15, color:'#c9a84c',
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
    backgroundColor:'#27ae60', borderRadius:10,
    paddingVertical:12, alignItems:'center',
    shadowColor:'#27ae60', shadowOpacity:0.35,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:4,
  },
  placeOrderText: {
    fontFamily:'GoogleSans_700Bold', fontSize:14,
    color:'#ffffff', fontWeight:'700',
  },
  clearBtn: {
    backgroundColor:'rgba(231,76,60,0.12)',
    borderRadius:10, paddingVertical:9, alignItems:'center',
    borderWidth:1, borderColor:'rgba(231,76,60,0.30)',
  },
  clearBtnText: {
    fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#e74c3c',
  },
  printBtn: {
    backgroundColor:'rgba(201,168,76,0.12)',
    borderRadius:10, paddingVertical:9, alignItems:'center',
    borderWidth:1, borderColor:'rgba(201,168,76,0.35)',
  },
  printBtnText: {
    fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#c9a84c',
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
    paddingBottom:34, maxHeight:'90%',
    shadowColor:'#000', shadowOpacity:0.35,
    shadowRadius:20, shadowOffset:{width:0,height:-4}, elevation:20,
  },
  sheetHandle: {
    width:40, height:4, borderRadius:2,
    backgroundColor:'rgba(1,31,75,0.20)',
    alignSelf:'center', marginTop:10, marginBottom:6,
  },
  sheetHeader: {
    flexDirection:'row', alignItems:'center',
    justifyContent:'space-between',
    paddingHorizontal:20, paddingBottom:8,
    borderBottomWidth:1, borderColor:'rgba(1,31,75,0.10)',
  },
  sheetClose: {
    width:30, height:30, borderRadius:15,
    backgroundColor:'rgba(1,31,75,0.10)',
    justifyContent:'center', alignItems:'center',
  },

  // Float cart
  floatCart: {
    position:'absolute', bottom:24, left:24, right:24,
    borderRadius:30, shadowColor:'#c9a84c',
    shadowOpacity:0.4, shadowRadius:16,
    shadowOffset:{width:0,height:4}, elevation:10,
  },
  floatCartGradient: {
    borderRadius:30, paddingVertical:14,
    paddingHorizontal:24, alignItems:'center',
  },
  floatCartText: {
    fontFamily:'GoogleSans_700Bold', fontSize:15,
    color:'#0d1b3e', fontWeight:'700',
  },
});