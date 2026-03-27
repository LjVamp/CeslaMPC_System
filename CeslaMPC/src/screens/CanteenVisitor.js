// src/screens/CanteenVisitor.js
// CLIMBS Canteen — Visitor Food Ordering Screen
// 3-panel layout: Left Categories | Center Menu+Search | Right Cart

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCanteen } from '../context/CanteenContext';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, StatusBar, Image,
  useWindowDimensions, Platform, TextInput, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold, NotoSerif_700Bold_Italic } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';

// ─── DATA ─────────────────────────────────────────────────────────────────────


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
              <Text style={styles.receiptMeta}>Type: Walk-in  |  {paymentMode === 'gcash' ? '📱 GCash' : '💵 Cash'}</Text>
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
const CartPanel = ({ cart, onAdd, onRemove, onClear, onOrder, onPlaceOrder, isWide, hideTitle, lastOrder, onShowReceipt }) => {
  const [checked, setChecked] = useState({});
  const [paymentMode, setPaymentMode] = useState('cash');

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

  const toggleCheck = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const checkedItems = cartItems.filter(({ item }) => checked[item.id]);
  const total = checkedItems.reduce((s, { item, qty }) => s + item.price * qty, 0);

  const handlePlaceOrder = () => {
    if (checkedItems.length === 0) return;
    const orderNo = Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const time = now.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })
      + '  ' + now.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
    onPlaceOrder({ items: checkedItems, total, amountPaid: total, change: 0, orderNo, time, paymentMode });
  };

  return (
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
          </View>
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
const CartBottomSheet = ({ cart, onAdd, onRemove, onClear, onOrder, onClose, onPlaceOrder, lastOrder, onShowReceipt }) => {
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
        {/* Single CART header — no duplicate */}
        <View style={styles.sheetHeader}>
          <Text style={styles.cartPanelTitle}>CART</Text>
          <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
            <Text style={{ color:'rgba(1,31,75,0.6)', fontSize:14 }}>✕</Text>
          </TouchableOpacity>
        </View>
        {/* Scrollable content so Mode of Payment + buttons always visible */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow:1 }}
        >
          <CartPanel
            cart={cart} onAdd={onAdd} onRemove={onRemove}
            onClear={onClear} onOrder={onOrder} isWide={false}
            hideTitle={true} onPlaceOrder={onPlaceOrder}
            lastOrder={lastOrder} onShowReceipt={onShowReceipt}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
// ─── AD BANNER — dots inside card, hide/show on mobile scroll ────────────────
const AdBanner = ({ isWide, adAnim, ads }) => {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef(null);
  const { width } = useWindowDimensions();

  const ADS = ads && ads.length > 0 ? ads : [
    { id:1, bg:['#1a3a6b','#2e5fa3'], emoji:'🍽️', title:"Today's Special", sub:'Fresh meals served daily!' },
    { id:2, bg:['#7b3f00','#c9a84c'], emoji:'☕',  title:'Merienda Promo',   sub:'Snacks & drinks available!' },
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
        {ADS.map((ad) => (
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
            <View style={{ flex:1 }}>
              <Text style={adStyles.adTitle}>{ad.title}</Text>
              <Text style={adStyles.adSub}>{ad.sub}</Text>
            </View>
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
        ))}
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


export default function CanteenVisitor({ navigation }) {
  const { items: MENU_ITEMS, ads: CONTEXT_ADS, categories: CATEGORIES, addOrder, deductStock, orders, reloadFromStorage } = useCanteen();
  const { width, height } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, NotoSerif_700Bold_Italic,
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [mainTab,      setMainTab]      = useState('order'); // 'order' | 'history'
  const [orderHistory, setOrderHistory] = useState([]);

  // Queue status tracking
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
  const receiptViewRef = useRef(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  { toValue:1, duration:600, useNativeDriver:true }),
      Animated.timing(hdrTrans, { toValue:0, duration:600, useNativeDriver:true }),
    ]).start();
    Animated.timing(bodyFade, { toValue:1, duration:600, delay:200, useNativeDriver:true }).start();
  }, []);

  // Firestore onSnapshot keeps items/stock live — no polling needed
  useEffect(() => {
    reloadFromStorage();
  }, []);

  // Firestore onSnapshot on canteen_orders fires automatically when status changes
  // No polling needed — the useEffect below watches `orders` array in real time

  // ── Watch orders array for status change on tracked order ─────────────────
  useEffect(() => {
    if (!trackedOrderId) return;
    const found = orders.find(o => o.id === trackedOrderId);
    if (!found) return;
    const newStatus = found.status;
    if (newStatus !== prevStatusRef.current) {
      prevStatusRef.current = newStatus;
      setLiveStatus(newStatus);
      // Re-expand if minimized when status changes
      if (newStatus === 'ready' || newStatus === 'preparing') {
        setQueueMinimized(false);
        // Browser notification
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
        // Auto-close after 2.5s when admin marks done
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

    const fullOrder = {
      ...orderData,
      orderNo,
      time,
      status: 'pending',
      payment: orderData.paymentMode || 'cash',
      source: 'visitor',
    };

    // Save to Firestore — returns the real document ID
    const firestoreId = await addOrder(fullOrder);
    await deductStock(orderData.items);

    const trackedId = firestoreId || `ORD-${orderNo}`;
    setLastOrder({ ...orderData, orderNo, time, id: trackedId });
    setCartOpen(false);
    clearCart();

    // Push to session order history
    setOrderHistory(prev => [{ ...fullOrder, docId: trackedId, createdAt: now }, ...prev]);

    // Start tracking with the real Firestore ID
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
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation && navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1, { fontSize: isWide ? 22 : isSmall ? 14:16 }]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>CLIMBS </Text>
              Canteen Ordering System
            </Text>
            <View style={styles.visitorTag}>
              <Text style={styles.visitorTagText}>VISITOR / WALK-IN</Text>
            </View>
          </View>

          {/* Menu icon */}
          <TouchableOpacity style={styles.backBtn} onPress={() => setMenuOpen(v => !v)}>
            <Text style={{ color:'#fff', fontSize:18, textAlign:'center', lineHeight:22, includeFontPadding:false }}>≡</Text>
          </TouchableOpacity>

          {/* Dropdown */}
          {menuOpen && (
            <View style={styles.dropdown}>
              {[
                { icon: '📋', label: 'My Order History', tab: 'history' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.tab}
                  style={[styles.dropdownItem, { backgroundColor: mainTab === opt.tab ? 'rgba(201,168,76,0.15)' : 'transparent' }]}
                  onPress={() => { setMainTab(opt.tab); setMenuOpen(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dropdownItemText, { color: mainTab === opt.tab ? '#c9a84c' : 'rgba(255,255,255,0.85)', fontFamily: mainTab === opt.tab ? 'GoogleSans_700Bold' : 'GoogleSans_500Medium' }]}>
                    {opt.icon}  {opt.label}
                  </Text>
                  {mainTab === opt.tab && <View style={{ width:3, borderRadius:2, backgroundColor:'#c9a84c', position:'absolute', left:0, top:6, bottom:6 }} />}
                </TouchableOpacity>
              ))}
              <View style={{ height:1, backgroundColor:'rgba(255,255,255,0.10)', marginVertical:4 }} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setMenuOpen(false); setMainTab('order'); }}
                activeOpacity={0.75}
              >
                <Text style={styles.dropdownItemText}>🛒  Back to Ordering</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>

      {/* BODY */}
      <View style={styles.body}>

      {/* ── ORDER HISTORY TAB ── */}
      {mainTab === 'history' && (() => {
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
        return (
          <Animated.View style={{ flex:1, opacity: bodyFade, minHeight:0 }}>
          <View style={{ flex:1, minHeight:0, alignItems:'stretch', paddingBottom: isWide ? 16 : 8 }}>
          <View style={{ flex:1, width:'100%', maxWidth: isWide ? 1100 : '100%', alignSelf:'center', paddingHorizontal: isWide ? 24 : 10, paddingTop:4, minHeight:0 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:11, color:'rgba(1,31,75,0.55)', letterSpacing:1.8, textTransform:'uppercase' }}>📋 My Order History (This Session)</Text>
              <View style={{ backgroundColor:'rgba(1,31,75,0.08)', borderRadius:6, paddingHorizontal:8, paddingVertical:3 }}>
                <Text style={{ fontFamily:'GoogleSans_500Medium', fontSize:10, color:'rgba(1,31,75,0.50)' }}>{orderHistory.length} order{orderHistory.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            {orderHistory.length === 0 ? (
              <View style={{ alignItems:'center', paddingVertical:60 }}>
                <Text style={{ fontSize:48, marginBottom:12 }}>📋</Text>
                <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:15, color:'rgba(1,31,75,0.55)', textAlign:'center' }}>No orders yet</Text>
                <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.40)', textAlign:'center', marginTop:6 }}>Your orders this session will appear here.</Text>
                <TouchableOpacity onPress={() => setMainTab('order')} style={{ marginTop:18, backgroundColor:'#1a2d4e', borderRadius:12, paddingHorizontal:24, paddingVertical:10 }}>
                  <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#c9a84c' }}>Order Now →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={tblStyle.tableWrap}>
                <View style={tblStyle.thead}>
                  <Text style={[tblStyle.hCell, { width:110 }]}>DATE / ORDER</Text>
                  <View style={tblStyle.hDivider}/>
                  <Text style={[tblStyle.hCell, { flex:1 }]}>ITEMS</Text>
                  <View style={tblStyle.hDivider}/>
                  <Text style={[tblStyle.hCell, { width:90, textAlign:'center' }]}>PAYMENT</Text>
                  <View style={tblStyle.hDivider}/>
                  <Text style={[tblStyle.hCell, { width:100, textAlign:'center' }]}>TOTAL</Text>
                  <View style={tblStyle.hDivider}/>
                  <Text style={[tblStyle.hCell, { width:90, textAlign:'center' }]}>STATUS</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={true} style={{ flex:1 }}>
                  {orderHistory.map((order, idx) => {
                    const orderItems  = order.items || [];
                    const total       = order.total || 0;
                    const pm          = order.payment || order.paymentMode || 'cash';
                    const pmLabel     = pm === 'gcash' ? 'GCash' : pm === 'credit' ? 'Credit' : 'Cash';
                    const pmColor     = pm === 'credit' ? '#c9a84c' : pm === 'gcash' ? '#3498db' : '#27ae60';
                    const statusColor = order.status === 'done' ? '#27ae60' : order.status === 'ready' ? '#2980b9' : order.status === 'preparing' ? '#e67e22' : '#95a5a6';
                    const statusLabel = order.status === 'done' ? 'Completed' : order.status === 'ready' ? 'Ready' : order.status === 'preparing' ? 'Preparing' : 'Pending';
                    const isEven = idx % 2 === 0;
                    return (
                      <View key={order.docId || idx} style={[tblStyle.row, isEven && tblStyle.rowEven, idx === orderHistory.length - 1 && { borderBottomWidth:0 }]}>
                        <View style={[tblStyle.cell, { width:110 }]}>
                          <Text style={tblStyle.ordNo}>#{order.orderNo || '—'}</Text>
                          <Text style={tblStyle.ordDate}>{fmtDateTime(order.createdAt)}</Text>
                        </View>
                        <View style={[tblStyle.cell, { flex:1 }]}>
                          {orderItems.slice(0,2).map((it, j) => {
                            const item = it.item || it;
                            const qty  = it.qty || it.quantity || 1;
                            return <Text key={j} style={tblStyle.itemLine} numberOfLines={1}>{item.name} ×{qty}</Text>;
                          })}
                          {orderItems.length > 2 && <Text style={[tblStyle.itemLine, { color:'rgba(1,31,75,0.38)', fontSize:10 }]}>+{orderItems.length - 2} more</Text>}
                        </View>
                        <View style={[tblStyle.cell, { width:90, alignItems:'center' }]}>
                          <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:11, color: pmColor }}>{pmLabel}</Text>
                        </View>
                        <View style={[tblStyle.cell, { width:100, alignItems:'center' }]}>
                          <Text style={tblStyle.total}>₱{Number(total).toFixed(2)}</Text>
                        </View>
                        <View style={[tblStyle.cell, { width:90, alignItems:'center' }]}>
                          <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:11, color: statusColor }}>{statusLabel}</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
          </View>
          </Animated.View>
        );
      })()}

      {/* ── ORDERING TAB ── */}
      {mainTab === 'order' && (
      <Animated.View style={{ flex:1, flexDirection:'row', alignItems:'stretch', opacity: bodyFade, minHeight:0, overflow: Platform.OS==='web' ? 'hidden' : 'visible' }}>

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

        {/* CENTER — Search + Menu grid */}
        <View style={styles.centerPanel}>

          {/* Mobile category tabs */}
          {!isWide && (
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
          )}

          {/* ── Ad Banner ── */}
          <View style={{ marginBottom: isWide ? 12 : 0 }}>
            <AdBanner isWide={isWide} adAnim={adAnim} ads={CONTEXT_ADS} />
          </View>

          {/* Items panel — fills remaining space */}
          <View style={styles.itemsPanel}>
            {/* Label LEFT + Search RIGHT — same row, both web and mobile */}
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
                Animated.timing(adAnim, {
                  toValue: target,
                  duration: 150,
                  useNativeDriver: false,
                }).start();
              } : undefined}
              style={{ flex:1, minHeight:0 }}
              contentContainerStyle={[styles.menuGrid, { gap: Platform.OS==='web' ? 10 : 5, paddingBottom:20 }]}
            >
              {filtered.length === 0 ? (
                <Text style={styles.emptyText}>No items found.</Text>
              ) : (
                Array.from({ length: Math.ceil(filtered.length / COLS) }, (_, rowIdx) => (
                  <View key={rowIdx} style={{ flexDirection:'row', gap: Platform.OS==='web' ? 10 : 5, marginBottom: Platform.OS==='web' ? 0 : 5 }}>
                    {filtered.slice(rowIdx * COLS, rowIdx * COLS + COLS).map(item => (
                      <View key={item.id} style={{ flex:1 }}>
                        <FoodCard
                          item={item}
                          onAdd={() => addToCart(item)}
                        />
                      </View>
                    ))}
                    {/* Fill empty slots in last row */}
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
          />
        )}
        {/* Mobile floating cart button — inside body so it overlays itemsPanel */}
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
      </Animated.View>
      )}
      </View>

      {/* Mobile cart bottom sheet */}
      {!isWide && cartOpen && (
        <CartBottomSheet
          cart={cart} onAdd={addToCart} onRemove={removeFromCart}
          onClear={clearCart} onOrder={placeOrder}
          onClose={() => setCartOpen(false)}
          onPlaceOrder={handlePlaceOrder}
          lastOrder={lastOrder} onShowReceipt={handleShowReceipt}
        />
      )}





      {/* ── RECEIPT MODAL — triggered only by Download Receipt button ── */}
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
  dropdown: {
    position:'absolute', top:54, right:8, zIndex:200,
    backgroundColor:'rgba(10,25,60,0.97)',
    borderRadius:12, minWidth:200,
    paddingVertical:6,
    shadowColor:'#000', shadowOpacity:0.40,
    shadowRadius:12, shadowOffset:{width:0,height:4}, elevation:20,
    borderWidth:1, borderColor:'rgba(255,255,255,0.10)',
  },
  dropdownItem: {
    paddingHorizontal:16, paddingVertical:11,
    borderRadius:8, marginHorizontal:4,
  },
  dropdownItemText: {
    fontFamily:'GoogleSans_500Medium', fontSize:13,
    color:'rgba(255,255,255,0.85)',
  },
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