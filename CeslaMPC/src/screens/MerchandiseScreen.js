// src/screens/MerchandiseScreen.js
// CESLA MPC — Merchandise Ordering System
// Same 3-panel layout as CanteenVisitor (Left Categories | Center Items+Search | Right Cart)

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, StatusBar,
  useWindowDimensions, Platform, TextInput, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

// ─── DATA ─────────────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Shirts', 'Mugs', 'Tumbler', 'Bags', 'Pens', 'Caps', 'Umbrellas', 'Stufftoys', 'Others'];

const MERCH_ITEMS = [
  { id:'1',  name:'CESLA Polo Shirt',      cat:'Shirts',    price:350, stock:20, emoji:'👕' },
  { id:'2',  name:'CESLA T-Shirt',         cat:'Shirts',    price:250, stock:30, emoji:'👕' },
  { id:'3',  name:'CESLA Polo (White)',    cat:'Shirts',    price:350, stock:15, emoji:'👔' },
  { id:'4',  name:'CESLA Ceramic Mug',     cat:'Mugs',      price:180, stock:25, emoji:'☕' },
  { id:'5',  name:'CESLA Travel Mug',      cat:'Mugs',      price:220, stock:18, emoji:'🫖' },
  { id:'6',  name:'CESLA Tumbler 500ml',   cat:'Tumbler',   price:280, stock:22, emoji:'🥤' },
  { id:'7',  name:'CESLA Tumbler 1L',      cat:'Tumbler',   price:350, stock:12, emoji:'🧋' },
  { id:'8',  name:'CESLA Tote Bag',        cat:'Bags',      price:150, stock:40, emoji:'👜' },
  { id:'9',  name:'CESLA Backpack',        cat:'Bags',      price:650, stock:10, emoji:'🎒' },
  { id:'10', name:'CESLA Sling Bag',       cat:'Bags',      price:320, stock:15, emoji:'👝' },
  { id:'11', name:'CESLA Ballpen',         cat:'Pens',      price:30,  stock:100,emoji:'🖊️' },
  { id:'12', name:'CESLA Gel Pen Set',     cat:'Pens',      price:85,  stock:60, emoji:'✒️' },
  { id:'13', name:'CESLA Snapback Cap',    cat:'Caps',      price:280, stock:20, emoji:'🧢' },
  { id:'14', name:'CESLA Bucket Hat',      cat:'Caps',      price:220, stock:18, emoji:'👒' },
  { id:'15', name:'CESLA Umbrella',        cat:'Umbrellas', price:320, stock:14, emoji:'☂️' },
  { id:'16', name:'CESLA Foldable Umbrella',cat:'Umbrellas',price:250, stock:20, emoji:'☂️' },
  { id:'17', name:'CESLA Bear Stufftoy',   cat:'Stufftoys', price:180, stock:10, emoji:'🧸' },
  { id:'18', name:'CESLA Plush Doll',      cat:'Stufftoys', price:220, stock:8,  emoji:'🪆' },
  { id:'19', name:'CESLA Keychain',        cat:'Others',    price:60,  stock:50, emoji:'🔑' },
  { id:'20', name:'CESLA Sticker Pack',    cat:'Others',    price:40,  stock:80, emoji:'🏷️' },
];

// ─── ITEM CARD ────────────────────────────────────────────────────────────────
const ItemCard = ({ item, onAdd }) => (
  <View style={styles.foodCard}>
    {Platform.OS === 'web' ? (
      <LinearGradient
        colors={['rgba(220,232,242,0.80)','rgba(200,218,235,0.60)']}
        start={{x:0,y:0}} end={{x:0,y:1}}
        style={styles.foodCardInner}
      >
        <ItemCardBody item={item} onAdd={onAdd} />
      </LinearGradient>
    ) : (
      <View style={[styles.foodCardInner, { backgroundColor:'rgba(225,238,248,0.85)' }]}>
        <ItemCardBody item={item} onAdd={onAdd} />
      </View>
    )}
  </View>
);

const ItemCardBody = ({ item, onAdd }) => (
  <>
    <View style={styles.emojiCircle}>
      <Text style={styles.emojiText}>{item.emoji}</Text>
    </View>
    <Text style={styles.itemName}>{item.name}</Text>
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
  const { items, total, amountPaid, change, orderNo, time } = orderData;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.receiptOverlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <Animated.View
          ref={receiptViewRef}
          style={[styles.receiptCard, { transform:[{ translateY: slideAnim }] }]}
          {...(Platform.OS === 'web' ? { 'data-receipt-card': 'true' } : {})}
        >
          {/* Jagged top */}
          <View style={styles.receiptJaggedTop}>
            {Array.from({ length: 18 }).map((_,i) => (
              <View key={i} style={styles.receiptJaggedTriangle} />
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptShopName}>🏪  CESLA MERCHANDISE</Text>
              <Text style={styles.receiptShopSub}>Merchandise Ordering System</Text>
              <View style={styles.receiptDividerDashed} />
              <Text style={styles.receiptMeta}>Order No.: #{orderNo}</Text>
              <Text style={styles.receiptMeta}>{time}</Text>
              <Text style={styles.receiptMeta}>Type: Walk-in / Cash</Text>
              <View style={styles.receiptDividerDashed} />
            </View>

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
              <Text style={styles.receiptThankYou}>Thank you for your purchase! 🙏</Text>
              <Text style={styles.receiptFooter}>— CESLA MPC Merchandise © 2025 —</Text>
            </View>
          </ScrollView>

          {/* Jagged bottom */}
          <View style={styles.receiptJaggedBottom}>
            {Array.from({ length: 18 }).map((_,i) => (
              <View key={i} style={styles.receiptJaggedTriangleBottom} />
            ))}
          </View>

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
const CartPanel = ({ cart, onAdd, onRemove, onClear, onPlaceOrder, isWide, hideTitle, lastOrder, onShowReceipt }) => {
  const [amountPaid, setAmountPaid] = useState('');

  const total = Object.values(cart).reduce((s,{item,qty}) => s + item.price * qty, 0);
  const change = parseFloat(amountPaid || 0) - total;
  const cartItems = Object.values(cart).filter(i => i.qty > 0);

  const handlePlaceOrder = () => {
    if (cartItems.length === 0) return;
    const orderNo = Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const time = now.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })
      + '  ' + now.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
    onPlaceOrder({ items: cartItems, total, amountPaid, change, orderNo, time });
    setAmountPaid('');
  };

  return (
    <View style={[styles.cartPanel, !isWide && styles.cartPanelMobile]}>
      {!hideTitle && <Text style={styles.cartPanelTitle}>CART</Text>}

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

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total :</Text>
        <Text style={styles.totalValue}>₱ {total.toFixed(2)}</Text>
      </View>

      <View style={styles.visitorNote}>
        <Text style={styles.visitorNoteText}>🏪 Merchandise Order — Cash Only</Text>
      </View>

      <Text style={styles.amountLabel}>Amount Paid (₱)</Text>
      <TextInput
        style={styles.amountInput}
        value={amountPaid}
        onChangeText={setAmountPaid}
        keyboardType="numeric"
        placeholder="0.00"
        placeholderTextColor="rgba(1,31,75,0.35)"
      />

      <View style={styles.changeRow}>
        <Text style={styles.changeLabel}>Change :</Text>
        <Text style={[styles.changeValue, { color: change < 0 ? '#e74c3c' : '#c9a84c' }]}>
          ₱ {isNaN(change) ? '0.00' : change.toFixed(2)}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.placeOrderBtn, cartItems.length === 0 && styles.placeOrderBtnDisabled]}
        onPress={handlePlaceOrder}
        activeOpacity={cartItems.length === 0 ? 1 : 0.80}
      >
        <LinearGradient
          colors={cartItems.length > 0 ? ['#27ae60','#2ecc71'] : ['#aaa','#bbb']}
          start={{x:0,y:0}} end={{x:1,y:0}}
          style={styles.placeOrderGrad}
        >
          <Text style={styles.placeOrderIcon}>✅</Text>
          <Text style={styles.placeOrderText}>Place Order</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.clearBtn} onPress={onClear} activeOpacity={0.80}>
        <Text style={styles.clearBtnIcon}>🗑️</Text>
        <Text style={styles.clearBtnText}>Clear Cart</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.printBtn, !lastOrder && { opacity: 0.45 }]}
        onPress={lastOrder ? onShowReceipt : null}
        activeOpacity={0.80}
      >
        <Text style={styles.printBtnIcon}>⬇️</Text>
        <Text style={styles.printBtnText}>Download Receipt</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── BOTTOM SHEET CART (Mobile) ───────────────────────────────────────────────
const CartBottomSheet = ({ cart, onAdd, onRemove, onClear, onClose, onPlaceOrder, lastOrder, onShowReceipt }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

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
            <Text style={{ color:'rgba(1,31,75,0.6)', fontSize:14 }}>✕</Text>
          </TouchableOpacity>
        </View>
        <CartPanel
          cart={cart} onAdd={onAdd} onRemove={onRemove}
          onClear={onClear} isWide={false} hideTitle={true}
          onPlaceOrder={onPlaceOrder} lastOrder={lastOrder}
          onShowReceipt={onShowReceipt}
        />
      </Animated.View>
    </View>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
// ─── AD BANNER (2 slots, auto-swipe every 5s, swipeable) ─────────────────────
const AdBanner = ({ isWide }) => {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef(null);
  const { width } = useWindowDimensions();

  const ADS = [
    {
      id: 1,
      bg: ['#1a3a6b', '#2e5fa3'],
      emoji: '📦',
      title: 'CESLA Merchandise',
      sub: 'Quality products available now!',
    },
    {
      id: 2,
      bg: ['#7b3f00', '#c9a84c'],
      emoji: '🎁',
      title: 'Special Offers',
      sub: 'Check out our latest items!',
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(prev => {
        const next = (prev + 1) % ADS.length;
        scrollRef.current?.scrollTo({ x: next * bannerW, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const bannerW = isWide ? Math.min(width * 0.55, 700) : width - 64;

  const handleScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / bannerW);
    setCurrent(idx);
  };

  return (
    <View style={adStyles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={{ width: bannerW }}
        contentContainerStyle={{ width: bannerW * ADS.length }}
      >
        {ADS.map((ad, i) => (
          <LinearGradient
            key={ad.id}
            colors={ad.bg}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[adStyles.slide, { width: bannerW }]}
          >
            <Text style={adStyles.adEmoji}>{ad.emoji}</Text>
            <View>
              <Text style={adStyles.adTitle}>{ad.title}</Text>
              <Text style={adStyles.adSub}>{ad.sub}</Text>
            </View>
            <View style={adStyles.adBadge}>
              <Text style={adStyles.adBadgeTxt}>AD</Text>
            </View>
          </LinearGradient>
        ))}
      </ScrollView>
      <View style={adStyles.dots}>
        {ADS.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              scrollRef.current?.scrollTo({ x: i * bannerW, animated: true });
              setCurrent(i);
            }}
          >
            <View style={[adStyles.dot, current === i && adStyles.dotActive]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const adStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', marginBottom: 10 },
  slide: {
    height: 130, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, gap: 14, overflow: 'hidden',
  },
  adEmoji: { fontSize: 48 },
  adTitle: { fontFamily: 'GoogleSans_700Bold', fontSize: 18, color: '#fff' },
  adSub: { fontFamily: 'GoogleSans_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.80)' },
  adBadge: {
    position: 'absolute', top: 8, right: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  adBadgeTxt: { fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: '#fff', letterSpacing: 1 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(1,31,75,0.20)' },
  dotActive: { backgroundColor: '#c9a84c', width: 18 },
});


export default function MerchandiseScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, NotoSerif_700Bold_Italic,
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch]     = useState('');
  const [cart, setCart]         = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  const hdrFade  = useRef(new Animated.Value(0)).current;
  const hdrTrans = useRef(new Animated.Value(-16)).current;
  const bodyFade = useRef(new Animated.Value(0)).current;
  const receiptViewRef = useRef(null);

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

  const handlePlaceOrder = (orderData) => {
    setLastOrder(orderData);
    setCartOpen(false);
    clearCart();
    setTimeout(() => setReceiptVisible(true), 300);
  };

  const handleShowReceipt = () => setReceiptVisible(true);

  const handlePrint = async () => {
    if (!lastOrder) return;
    const { orderNo } = lastOrder;
    const filename = `CESLA_Merch_Receipt_${orderNo}`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (!window.html2canvas) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        const el = document.querySelector('[data-receipt-card="true"]');
        if (!el) { alert('Receipt not ready yet, please try again.'); return; }
        const canvas = await window.html2canvas(el, {
          scale: 3, useCORS: true, backgroundColor: '#fffef8', logging: false,
        });
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (e) {
        alert('Could not capture receipt image: ' + e.message);
      }
    } else {
      try {
        const ViewShot = require('react-native-view-shot');
        const MediaLib = require('expo-media-library');
        const { status } = await MediaLib.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Please allow access to your gallery.');
          return;
        }
        if (!receiptViewRef.current) {
          Alert.alert('Error', 'Could not capture receipt. Please try again.');
          return;
        }
        const uri = await ViewShot.captureRef(receiptViewRef.current, {
          format: 'png', quality: 1.0, result: 'tmpfile',
        });
        await MediaLib.createAssetAsync(uri);
        Alert.alert('✅ Saved to Gallery!', `Receipt #${orderNo} saved as an image.`, [{ text: 'OK' }]);
      } catch (e) {
        Alert.alert('Error', 'Could not save receipt.\n\n' + e.message);
      }
    }
  };

  const totalItems = Object.values(cart).reduce((s,{qty}) => s+qty, 0);

  const handleSearch = (text) => {
    setSearch(text);
    if (text.trim() === '') return;
    const matches = MERCH_ITEMS.filter(i => i.name.toLowerCase().includes(text.toLowerCase()));
    if (matches.length === 0) return;
    const cats = [...new Set(matches.map(i => i.cat))];
    setActiveCategory(cats.length === 1 ? cats[0] : 'All');
  };

  const filtered = MERCH_ITEMS.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    if (search.trim() !== '') return matchesSearch;
    return (activeCategory === 'All' || i.cat === activeCategory);
  });

  // Grid cols — COLS fixed per platform, CARD_W fills available space
  const CART_W = isWide ? 230 : 0;
  const CAT_W  = isWide ? 170 : 0;
  const MARGIN = isWide ? 80 : 32;
  const GAP_C  = 10;
  const COLS   = Platform.OS === 'web' ? 5 : 2;
  const AVAIL  = width - CAT_W - CART_W - MARGIN - 24;  // 24 = itemsPanel padding*2
  const CARD_W = Math.floor((AVAIL - (COLS - 1) * GAP_C) / COLS);

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
            <Text style={[styles.headerH1, { fontSize: isWide ? 22 : isSmall ? 14:16 }]}
              numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>CESLA </Text>
              Merchandise Ordering System
            </Text>
            <View style={styles.visitorTag}>
              <Text style={styles.visitorTagText}>📦  MERCHANDISE STORE</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.backBtn}>
            <Text style={{ color:'#fff', fontSize:18 }}>≡</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* BODY */}
      <Animated.View style={[styles.body, { opacity: bodyFade }]}>

        {/* LEFT — Categories (web only) */}
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

        {/* CENTER — Search + Items grid */}
        <View style={styles.centerPanel}>

          {/* Mobile category tabs */}
          {!isWide && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ flexGrow:0, marginBottom:6 }}
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

          {/* Search bar */}
          <View style={[styles.searchBar, isWide && { paddingVertical:5 }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search merchandise..."
              placeholderTextColor="rgba(1,31,75,0.40)"
              value={search}
              onChangeText={handleSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); setActiveCategory('All'); }} style={{ paddingLeft:6 }}>
                <Text style={{ color:'rgba(1,31,75,0.45)', fontSize:14, fontWeight:'700' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Ad Banner ── */}
          <AdBanner isWide={isWide} />

          {/* Items panel with explicit-height ScrollView — works on web & mobile */}
          <View style={styles.itemsPanel}>
            <Text style={styles.menuSectionLabel}>
              {search.trim() !== ''
                ? `RESULTS FOR "${search.toUpperCase()}"`
                : activeCategory === 'All' ? 'ALL ITEMS' : activeCategory.toUpperCase()
              }
            </Text>
            <ScrollView
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              style={{ height: height - (Platform.OS === 'web' ? 360 : 460) }}
              contentContainerStyle={[styles.menuGrid, { gap:10, paddingBottom:20 }]}
            >
              <View style={[styles.menuRow, { gap:10 }]}>
                {filtered.map(item => (
                  <View key={item.id} style={{ width: CARD_W }}>
                    <ItemCard item={item} onAdd={() => addToCart(item)} />
                  </View>
                ))}
                {filtered.length === 0 && (
                  <Text style={styles.emptyText}>No items found.</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* RIGHT — Cart panel (web only) */}
        {isWide && (
          <CartPanel
            cart={cart} onAdd={addToCart} onRemove={removeFromCart}
            onClear={clearCart} isWide={true} onPlaceOrder={handlePlaceOrder}
            lastOrder={lastOrder} onShowReceipt={handleShowReceipt}
          />
        )}
      </Animated.View>

      {/* Mobile: floating cart button */}
      {!isWide && (
        <TouchableOpacity style={styles.floatCart} onPress={() => setCartOpen(true)} activeOpacity={0.85}>
          <LinearGradient
            colors={['#c9a84c','#e8c87a']}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={styles.floatCartGradient}
          >
            <Text style={styles.floatCartText}>
              🛒  View Cart  {totalItems > 0 ? `(${totalItems})` : ''}  •  ₱{Object.values(cart).reduce((s,{item,qty}) => s+item.price*qty, 0).toFixed(2)}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Mobile bottom sheet */}
      {!isWide && cartOpen && (
        <CartBottomSheet
          cart={cart} onAdd={addToCart} onRemove={removeFromCart}
          onClear={clearCart} onClose={() => setCartOpen(false)}
          onPlaceOrder={handlePlaceOrder} lastOrder={lastOrder}
          onShowReceipt={handleShowReceipt}
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
    shadowColor:'#011f4b', shadowOpacity:0.20,
    shadowRadius:20, shadowOffset:{width:0,height:4}, elevation:8,
  },
  backBtn: {
    width:40, height:40, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.15)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.30)',
    justifyContent:'center', alignItems:'center', flexShrink:0,
  },
  backIcon: { color:'#fff', fontSize:17, fontWeight:'600' },
  headerCenter: { flex:1, alignItems:'center', paddingHorizontal:10 },
  headerH1: {
    fontFamily:'NotoSerif_700Bold', fontWeight:'800',
    color:'#ffffff', textAlign:'center', letterSpacing:0.5,
  },
  headerGold: { fontFamily:'NotoSerif_700Bold_Italic', color:'#c9a84c' },
  visitorTag: {
    backgroundColor:'rgba(201,168,76,0.18)',
    borderRadius:10, paddingHorizontal:10, paddingVertical:3, marginTop:3,
    borderWidth:1, borderColor:'rgba(201,168,76,0.35)',
  },
  visitorTagText: {
    fontFamily:'GoogleSans_700Bold', fontSize:9,
    color:'#c9a84c', letterSpacing:1.5,
  },
  cartDot: {
    position:'absolute', top:-4, right:-4,
    backgroundColor:'#e74c3c', borderRadius:8,
    minWidth:16, height:16, justifyContent:'center', alignItems:'center',
    paddingHorizontal:3,
  },
  cartDotText: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'#fff' },

  // Body layout — same as CanteenVisitor
  body: {
    flex:1, flexDirection:'row', marginTop:12,
  },

  // LEFT — Categories panel (exact CanteenVisitor match)
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

  // Mobile category tabs
  catTab: {
    width:90, paddingVertical:8, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.25)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.45)',
    alignItems:'center', justifyContent:'center',
  },
  catTabActive: { backgroundColor:'#304674', borderColor:'#c9a84c' },
  catTabText: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'rgba(255,255,255,0.85)', textAlign:'center' },
  catTabTextActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },

  // CENTER
  centerPanel: { flex:1, paddingHorizontal:12, paddingBottom:16 },
  itemsPanel: {
    backgroundColor:'rgba(255,255,255,0.22)',
    borderRadius:16,
    borderWidth:1, borderColor:'rgba(255,255,255,0.40)',
    padding:12,
    marginTop:0,
    overflow:'hidden',
  },
  searchBar: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(255,255,255,0.72)',
    borderRadius:12, paddingHorizontal:12, paddingVertical:8,
    borderWidth:1, borderColor:'rgba(255,255,255,0.90)',
    marginBottom:10,
    shadowColor:'#011f4b', shadowOpacity:0.07,
    shadowRadius:6, shadowOffset:{width:0,height:2},
  },
  searchIcon: { fontSize:13, marginRight:6 },
  searchInput: {
    flex:1, fontFamily:'GoogleSans_400Regular',
    fontSize:13, color:'#011f4b', paddingVertical:0,
  },
  menuSectionLabel: {
    fontFamily:'GoogleSans_700Bold', fontSize:12,
    color:'#011f4b', letterSpacing:2,
    marginBottom:10,
    paddingBottom:8,
    borderBottomWidth:1,
    borderColor:'rgba(1,31,75,0.10)',
  },
  menuGrid: { paddingTop:2 },
  menuRow: { flexDirection:'row', flexWrap:'wrap' },
  emptyText: {
    fontFamily:'GoogleSans_400Regular', fontSize:13,
    color:'rgba(1,31,75,0.55)', padding:20,
  },

  // Item card — exact CanteenVisitor match
  foodCard: {
    borderRadius:14, overflow:'hidden',
    shadowColor:'#011f4b', shadowOpacity:0.10,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:3,
  },
  foodCardInner: {
    borderRadius:14, padding:14,
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.75)',
    alignItems:'center', gap:4,
    minHeight:180, justifyContent:'space-between',
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
    color:'#1a2d4e', textAlign:'center', fontWeight:'700', lineHeight:15,
  },
  itemStock: {
    fontFamily:'GoogleSans_400Regular', fontSize:10,
    color:'rgba(1,31,75,0.45)', letterSpacing:0.2,
  },
  itemPrice: {
    fontFamily:'NotoSerif_700Bold', fontSize:14,
    color:'#c9a84c', fontWeight:'700', letterSpacing:0.3,
  },
  addBtn: {
    backgroundColor:'#1a3a6b', borderRadius:8,
    paddingVertical:8, paddingHorizontal:6,
    marginTop:4, alignItems:'center', width:'100%',
    shadowColor:'#1a3a6b', shadowOpacity:0.30,
    shadowRadius:6, shadowOffset:{width:0,height:2},
  },
  addBtnText: {
    fontFamily:'GoogleSans_700Bold', fontSize:10,
    color:'#ffffff', fontWeight:'700', letterSpacing:0.5,
  },

  // RIGHT — Cart panel (exact CanteenVisitor match)
  cartPanel: {
    width:230, backgroundColor:'rgba(255,255,255,0.22)',
    borderRadius:16, marginRight:20, marginBottom:16,
    padding:14, gap:8,
    borderWidth:1, borderColor:'rgba(255,255,255,0.45)',
  },
  cartPanelMobile: {
    width:'100%', marginRight:0, marginBottom:0,
    borderRadius:0, backgroundColor:'transparent', borderWidth:0,
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
    borderRadius:12, overflow:'hidden',
    shadowColor:'#27ae60', shadowOpacity:0.35,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:4,
  },
  placeOrderBtnDisabled: { shadowOpacity:0 },
  placeOrderGrad: {
    flexDirection:'row', alignItems:'center',
    justifyContent:'center', gap:6, paddingVertical:13,
  },
  placeOrderIcon: { fontSize:14 },
  placeOrderText: {
    fontFamily:'GoogleSans_700Bold', fontSize:14,
    color:'#ffffff', letterSpacing:0.5,
  },
  clearBtn: {
    flexDirection:'row', alignItems:'center', justifyContent:'center',
    gap:7, backgroundColor:'#e74c3c', borderRadius:12, paddingVertical:12,
    shadowColor:'#e74c3c', shadowOpacity:0.35,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:4,
  },
  clearBtnIcon: { fontSize:14 },
  clearBtnText: {
    fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#fff', letterSpacing:0.3,
  },
  printBtn: {
    flexDirection:'row', alignItems:'center', justifyContent:'center',
    gap:7, backgroundColor:'#1a3a6b', borderRadius:12, paddingVertical:12,
    shadowColor:'#1a3a6b', shadowOpacity:0.35,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:4,
  },
  printBtnIcon: { fontSize:14 },
  printBtnText: {
    fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#fff', letterSpacing:0.3,
  },

  // Receipt Modal
  receiptOverlay: {
    flex:1, backgroundColor:'rgba(5,15,40,0.65)',
    justifyContent:'center', alignItems:'center', padding:20,
  },
  receiptCard: {
    width:'100%', maxWidth:380, backgroundColor:'#fffef8',
    borderRadius:4,
    shadowColor:'#000', shadowOpacity:0.35,
    shadowRadius:30, shadowOffset:{width:0,height:10}, elevation:20,
    overflow:'hidden', maxHeight:'90%',
  },
  receiptJaggedTop: {
    flexDirection:'row', backgroundColor:'#98bad5', height:16, overflow:'hidden',
  },
  receiptJaggedTriangle: {
    flex:1, height:16, backgroundColor:'#fffef8',
    borderTopLeftRadius:8, borderTopRightRadius:8,
  },
  receiptJaggedBottom: {
    flexDirection:'row', backgroundColor:'#fffef8', height:16, overflow:'hidden',
  },
  receiptJaggedTriangleBottom: {
    flex:1, height:16, backgroundColor:'#98bad5',
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
    borderColor:'rgba(1,31,75,0.18)', borderStyle:'dashed', marginVertical:10,
  },
  receiptDividerSolid: {
    height:1, backgroundColor:'rgba(1,31,75,0.15)', marginVertical:6,
  },
  receiptMeta: {
    fontFamily:'GoogleSans_400Regular', fontSize:11,
    color:'rgba(1,31,75,0.60)', textAlign:'center', lineHeight:17,
  },
  receiptItemHeader: { flexDirection:'row', marginBottom:2 },
  receiptItemHCol: {
    fontFamily:'GoogleSans_700Bold', fontSize:10,
    color:'rgba(1,31,75,0.50)', letterSpacing:1, textTransform:'uppercase',
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
    flexDirection:'row', gap:10, padding:16,
    borderTopWidth:1, borderColor:'rgba(1,31,75,0.10)',
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
    ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(1,20,50,0.45)',
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
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingHorizontal:20, paddingVertical:10,
    borderBottomWidth:1, borderColor:'rgba(1,31,75,0.10)',
  },
  sheetClose: {
    width:30, height:30, borderRadius:15,
    backgroundColor:'rgba(1,31,75,0.08)',
    justifyContent:'center', alignItems:'center',
  },

  // Floating cart
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
