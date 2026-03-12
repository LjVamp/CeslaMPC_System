// src/screens/ManageCanteenScreen.js
// CESLA MPC — Manage Canteen (Admin)
// FIXED: scrollbars, overflow, history (date/time only), inventory (search, no sort chips),
//        report (dropdown year, daily stats, cash/credit/ewallet), left panel no-overflow

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform,
  ScrollView, TextInput, Modal, Alert, Animated, Image,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { NotoSerif_700Bold } from '@expo-google-fonts/noto-serif';
import { GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold } from '@expo-google-fonts/google-sans';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCanteen } from '../context/CanteenContext';
import { useFocusEffect } from '@react-navigation/native';

// ─── FORCE VISIBLE SCROLLBARS ON WEB ─────────────────────────────────────────
if (Platform.OS === 'web') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = `
    /* Show scrollbars on all RN ScrollView containers */
    div[style*="overflow"] {
      scrollbar-width: thin !important;
      scrollbar-color: rgba(26,58,107,0.45) rgba(255,255,255,0.20) !important;
    }
    div[style*="overflow"]::-webkit-scrollbar {
      width: 7px !important;
      height: 7px !important;
    }
    div[style*="overflow"]::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.20) !important;
      border-radius: 4px !important;
    }
    div[style*="overflow"]::-webkit-scrollbar-thumb {
      background: rgba(26,58,107,0.45) !important;
      border-radius: 4px !important;
    }
    div[style*="overflow"]::-webkit-scrollbar-thumb:hover {
      background: rgba(26,58,107,0.70) !important;
    }
    /* Ensure overflow is always visible, not hidden by RN web defaults */
    .rn-scroll-content-container {
      overflow-y: scroll !important;
    }
  `;
  document.head.appendChild(styleTag);
}

// Helper: forces scrollbar visible on web by setting overflow-y to scroll
const WEB_SCROLL = Platform.OS === 'web'
  ? { overflowY: 'scroll', overflowX: 'hidden' }
  : {};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const emptyItem = () => ({
  id: Date.now().toString(), name:'', cat:'Meals',
  price:'', stock:'', emoji:'🍽️', image:null,
});

const TABS = [
  { key:'cashier',   label:'Cashier',     icon:'point-of-sale'  },
  { key:'menu',      label:'Manage Menu', icon:'restaurant-menu' },
  { key:'inventory', label:'Inventory',   icon:'inventory'       },
  { key:'history',   label:'History',     icon:'history'         },
  { key:'credits',   label:'Credits',     icon:'account-balance' },
  { key:'report',    label:'Report',      icon:'bar-chart'       },
];

const ORDER_STATUSES = {
  pending:   { label:'⏳ Pending',         color:'#e67e22', bg:'rgba(230,126,34,0.12)', next:'preparing', nextLabel:'🔥 Start Preparing', nextColor:'#e67e22' },
  preparing: { label:'🔥 Preparing',        color:'#2980b9', bg:'rgba(41,128,185,0.12)', next:'ready',    nextLabel:'✅ Mark as Ready',    nextColor:'#27ae60' },
  ready:     { label:'✅ Ready to Pick Up', color:'#27ae60', bg:'rgba(39,174,96,0.12)',  next:'done',     nextLabel:'✓ Mark as Done',      nextColor:'#1a3a6b' },
  done:      { label:'✓ Done',             color:'rgba(1,31,75,0.35)', bg:'rgba(1,31,75,0.06)', next:null, nextLabel:null, nextColor:null },
};

// ─── ITEM EDIT MODAL ──────────────────────────────────────────────────────────
const ItemEditModal = ({ visible, item, categories, onSave, onClose }) => {
  const [form, setForm] = useState(item || emptyItem());
  useEffect(() => {
    if (item) setForm({...item, price:String(item.price), stock:String(item.stock)});
  }, [item]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[1,1], quality:0.8,
    });
    if (!res.canceled) setForm(f=>({...f,image:res.assets[0].uri}));
  };

  const save = () => {
    if (!form.name.trim()) { Alert.alert('Error','Item name is required.'); return; }
    if (!form.price)       { Alert.alert('Error','Price is required.'); return; }
    if (form.stock==='')   { Alert.alert('Error','Stock is required.'); return; }
    onSave({...form, price:parseFloat(form.price)||0, stock:parseInt(form.stock)||0});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1}/>
        <ScrollView contentContainerStyle={{padding:16,flexGrow:1,justifyContent:'center'}} keyboardShouldPersistTaps="handled">
          <View style={ms.modalCard}>
            <Text style={ms.modalTitle}>{item?.name ? 'Edit Item' : 'Add New Item'}</Text>
            <TouchableOpacity style={ms.imgPicker} onPress={pickImage}>
              {form.image
                ? <Image source={{uri:form.image}} style={ms.imgPreview}/>
                : <View style={{alignItems:'center',gap:3}}><Text style={{fontSize:38}}>{form.emoji}</Text><Text style={ms.imgHint}>Tap to upload image</Text></View>
              }
              <View style={ms.imgBadge}><MaterialIcons name="photo-camera" size={13} color="#fff"/></View>
            </TouchableOpacity>
            {form.image&&<TouchableOpacity onPress={()=>setForm(f=>({...f,image:null}))} style={{alignSelf:'center',marginTop:-4}}><Text style={{fontFamily:'GoogleSans_400Regular',fontSize:11,color:'#e74c3c'}}>✕ Remove image</Text></TouchableOpacity>}
            {!form.image&&<View style={ms.fieldRow}><Text style={ms.fieldLabel}>Emoji (if no image)</Text><TextInput style={[ms.input,{textAlign:'center',fontSize:22}]} value={form.emoji} onChangeText={v=>setForm(f=>({...f,emoji:v}))} placeholder="🍽️"/></View>}
            <View style={ms.fieldRow}><Text style={ms.fieldLabel}>Item Name *</Text><TextInput style={ms.input} value={form.name} onChangeText={v=>setForm(f=>({...f,name:v}))} placeholder="e.g. Fried Chicken"/></View>
            <View style={ms.fieldRow}>
              <Text style={ms.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:4}}>
                <View style={{flexDirection:'row',gap:6}}>
                  {categories.filter(c=>c!=='All').map(cat=>(
                    <TouchableOpacity key={cat} style={[ms.chip,form.cat===cat&&ms.chipActive]} onPress={()=>setForm(f=>({...f,cat}))}>
                      <Text style={[ms.chipTxt,form.cat===cat&&ms.chipTxtActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={{flexDirection:'row',gap:10}}>
              <View style={[ms.fieldRow,{flex:1}]}><Text style={ms.fieldLabel}>Price (₱) *</Text><TextInput style={ms.input} value={form.price} onChangeText={v=>setForm(f=>({...f,price:v}))} keyboardType="numeric" placeholder="0.00"/></View>
              <View style={[ms.fieldRow,{flex:1}]}><Text style={ms.fieldLabel}>Stock *</Text><TextInput style={ms.input} value={form.stock} onChangeText={v=>setForm(f=>({...f,stock:v}))} keyboardType="numeric" placeholder="0"/></View>
            </View>
            <View style={ms.modalActions}>
              <TouchableOpacity style={ms.cancelBtn} onPress={onClose}><Text style={ms.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={{flex:2,borderRadius:10,overflow:'hidden'}} onPress={save}>
                <LinearGradient colors={['#1a3a6b','#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:0}} style={{paddingVertical:11,alignItems:'center'}}>
                  <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#fff'}}>Save Item</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

// ─── AD EDIT MODAL ────────────────────────────────────────────────────────────
const AdEditModal = ({ visible, ad, onSave, onClose, onDelete }) => {
  const [form, setForm] = useState(ad || {});
  useEffect(() => { if (ad) setForm(ad); }, [ad]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[16,5], quality:0.85,
    });
    if (!res.canceled) setForm(f=>({...f,image:res.assets[0].uri,imageUrl:''}));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1}/>
        <View style={[ms.modalCard,{maxWidth:420,alignSelf:'center',width:'90%'}]}>
          <Text style={ms.modalTitle}>{ad?.isNew ? 'Add New Ad' : 'Edit Ad Banner'}</Text>
          <TouchableOpacity style={[ms.imgPicker,{width:'100%',height:80,borderRadius:12}]} onPress={pickImage}>
            {form.image
              ? <Image source={{uri:form.image}} style={{width:'100%',height:80,borderRadius:12}} resizeMode="cover"/>
              : <View style={{alignItems:'center',gap:3}}><Text style={{fontSize:28}}>{form.emoji||'📢'}</Text><Text style={ms.imgHint}>Tap to upload banner image</Text></View>
            }
          </TouchableOpacity>
          <View style={ms.fieldRow}><Text style={ms.fieldLabel}>Or paste image URL</Text><TextInput style={ms.input} value={form.imageUrl||''} onChangeText={v=>setForm(f=>({...f,imageUrl:v,image:null}))} placeholder="https://..." autoCapitalize="none"/></View>
          <View style={ms.fieldRow}><Text style={ms.fieldLabel}>Title</Text><TextInput style={ms.input} value={form.title||''} onChangeText={v=>setForm(f=>({...f,title:v}))} placeholder="Ad title"/></View>
          <View style={ms.fieldRow}><Text style={ms.fieldLabel}>Subtitle</Text><TextInput style={ms.input} value={form.sub||''} onChangeText={v=>setForm(f=>({...f,sub:v}))} placeholder="Ad subtitle"/></View>
          <View style={ms.modalActions}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose}><Text style={ms.cancelTxt}>Cancel</Text></TouchableOpacity>
            {!ad?.isNew && onDelete && (
              <TouchableOpacity style={[ms.cancelBtn,{backgroundColor:'rgba(231,76,60,0.10)',borderWidth:1,borderColor:'rgba(231,76,60,0.25)'}]} onPress={()=>{onClose();onDelete(ad.id);}}>
                <Text style={[ms.cancelTxt,{color:'#e74c3c'}]}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{flex:2,borderRadius:10,overflow:'hidden'}} onPress={()=>onSave(form)}>
              <LinearGradient colors={['#1a3a6b','#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:0}} style={{paddingVertical:11,alignItems:'center'}}>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#fff'}}>Save Ad</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ms = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(1,20,50,0.55)', justifyContent:'center' },
  modalCard: { backgroundColor:'#f0f5f9', borderRadius:20, padding:20, gap:10, shadowColor:'#000', shadowOpacity:0.25, shadowRadius:20, elevation:12 },
  modalTitle: { fontFamily:'GoogleSans_700Bold', fontSize:16, color:'#011f4b', textAlign:'center', marginBottom:4 },
  imgPicker: { alignSelf:'center', width:86, height:86, borderRadius:43, backgroundColor:'rgba(1,31,75,0.07)', borderWidth:2, borderColor:'rgba(1,31,75,0.15)', borderStyle:'dashed', justifyContent:'center', alignItems:'center' },
  imgPreview: { width:86, height:86, borderRadius:43 },
  imgHint: { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.40)', textAlign:'center' },
  imgBadge: { position:'absolute', bottom:2, right:2, backgroundColor:'#1a3a6b', borderRadius:10, padding:4 },
  fieldRow: { gap:4 },
  fieldLabel: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.50)', letterSpacing:1, textTransform:'uppercase' },
  input: { backgroundColor:'rgba(255,255,255,0.88)', borderRadius:8, paddingHorizontal:10, paddingVertical:9, fontFamily:'GoogleSans_400Regular', fontSize:13, color:'#011f4b', borderWidth:1, borderColor:'rgba(1,31,75,0.12)' },
  chip: { paddingHorizontal:10, paddingVertical:5, borderRadius:12, backgroundColor:'rgba(1,31,75,0.07)' },
  chipActive: { backgroundColor:'#1a3a6b' },
  chipTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)' },
  chipTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  modalActions: { flexDirection:'row', gap:8, marginTop:4, flexWrap:'wrap' },
  cancelBtn: { flex:1, borderRadius:10, backgroundColor:'rgba(1,31,75,0.07)', paddingVertical:11, alignItems:'center' },
  cancelTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'rgba(1,31,75,0.50)' },
});

// ─── CASHIER SCREEN ───────────────────────────────────────────────────────────
const CashierScreen = ({ items, categories, addOrder, deductStock }) => {
  const [activeCat, setActiveCat]  = useState('All');
  const [search,    setSearch]     = useState('');
  const [cart,      setCart]       = useState({});
  const [amountPaid,setAmountPaid] = useState('');
  const [receiptVisible,setReceiptVisible] = useState(false);
  const [lastOrder, setLastOrder]  = useState(null);

  const filtered = items.filter(i => {
    if (search.trim()) return i.name.toLowerCase().includes(search.toLowerCase());
    return activeCat==='All' || i.cat===activeCat;
  });

  const cartItems = Object.values(cart).filter(c=>c.qty>0);
  const total = cartItems.reduce((s,{item,qty})=>s+item.price*qty, 0);
  const paid  = parseFloat(amountPaid)||0;
  const change = paid - total;

  const addToCart    = (item) => setCart(prev=>({...prev,[item.id]:{item,qty:(prev[item.id]?.qty||0)+1}}));
  const removeFromCart = (item) => setCart(prev=>{
    const qty=(prev[item.id]?.qty||0)-1;
    if(qty<=0){const n={...prev};delete n[item.id];return n;}
    return {...prev,[item.id]:{item,qty}};
  });
  const clearCart = () => { setCart({}); setAmountPaid(''); };

  const handlePlaceOrder = () => {
    if(cartItems.length===0) return;
    if(paid<total){ Alert.alert('Insufficient Amount','Please enter the correct amount paid.'); return; }
    const orderNo=Math.floor(1000+Math.random()*9000);
    const now=new Date();
    const time=now.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})+'  '+now.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});
    const order={id:Date.now().toString(),orderNo,time,items:cartItems,total,amountPaid:paid,change,payment:'cash',status:'pending'};
    addOrder(order);
    deductStock(cartItems);
    setLastOrder(order);
    clearCart();
    setTimeout(()=>setReceiptVisible(true),200);
  };

  const COLS=4;

  return (
    // FIX: flex:1 + minHeight:0 on all layers so items grid scrolls properly
    <View style={{flex:1,flexDirection:'row',minHeight:0,overflow:'hidden'}}>
      {/* Items side */}
      <View style={{flex:1,minHeight:0,minWidth:0,flexDirection:'column',overflow:'hidden'}}>
        {/* Category tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{flexGrow:0,marginBottom:6}}
          contentContainerStyle={{paddingHorizontal:10,gap:5,paddingVertical:4}}>
          {categories.map(cat=>(
            <TouchableOpacity key={cat} style={[cs.catTab,activeCat===cat&&cs.catTabActive]} onPress={()=>setActiveCat(cat)}>
              <Text style={[cs.catTabTxt,activeCat===cat&&cs.catTabTxtActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search bar */}
        <View style={cs.searchRow}>
          <MaterialIcons name="search" size={15} color="rgba(1,31,75,0.40)"/>
          <TextInput style={cs.searchInput} placeholder="Search items..." placeholderTextColor="rgba(1,31,75,0.35)"
            value={search} onChangeText={setSearch}/>
          {search.length>0&&<TouchableOpacity onPress={()=>setSearch('')}><Text style={{color:'rgba(1,31,75,0.40)',fontWeight:'700'}}>✕</Text></TouchableOpacity>}
        </View>

        {/* Items grid scrollbar */}
        <ScrollView style={[{flex:1},WEB_SCROLL]} showsVerticalScrollIndicator
          contentContainerStyle={{padding:8,gap:6,paddingBottom:20}}>
          {Array.from({length:Math.ceil(filtered.length/COLS)},(_,rowIdx)=>(
            <View key={rowIdx} style={{flexDirection:'row',gap:6}}>
              {filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).map(item=>(
                <TouchableOpacity key={item.id} style={[cs.itemCard,item.stock===0&&{opacity:0.45}]}
                  onPress={()=>item.stock>0&&addToCart(item)} activeOpacity={item.stock>0?0.75:1}>
                  <View style={cs.itemImgCircle}>
                    {item.image?<Image source={{uri:item.image}} style={{width:'100%',height:'100%',borderRadius:99}} resizeMode="cover"/>:<Text style={cs.itemEmoji}>{item.emoji}</Text>}
                  </View>
                  <Text style={cs.itemCardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={cs.itemCardPrice}>₱{item.price}</Text>
                  <Text style={cs.itemCardStock}>{item.stock===0?'Out of stock':`Stock: ${item.stock}`}</Text>
                  {cart[item.id]&&<View style={cs.cartBadge}><Text style={cs.cartBadgeTxt}>{cart[item.id].qty}</Text></View>}
                </TouchableOpacity>
              ))}
              {Array.from({length:COLS-filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).length}).map((_,i)=>(<View key={`e-${i}`} style={{flex:1}}/>))}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Cart side */}
      <View style={cs.cartPanel}>
        <Text style={cs.cartTitle}>🛒 CART</Text>
        <View style={cs.cartItemsBox}>
          {cartItems.length===0
            ? <Text style={cs.cartEmpty}>No items added yet</Text>
            : <ScrollView showsVerticalScrollIndicator style={[{flex:1},WEB_SCROLL]}>
                {cartItems.map(({item,qty})=>(
                  <View key={item.id} style={cs.cartRow}>
                    <Text style={cs.cartEmoji}>{item.emoji}</Text>
                    <View style={{flex:1,minWidth:0}}>
                      <Text style={cs.cartName} numberOfLines={1}>{item.name}</Text>
                      <Text style={cs.cartSub}>₱{item.price} × {qty} = ₱{item.price*qty}</Text>
                    </View>
                    <View style={cs.qtyRow}>
                      <TouchableOpacity style={cs.qBtn} onPress={()=>removeFromCart(item)}><Text style={cs.qBtnTxt}>−</Text></TouchableOpacity>
                      <Text style={cs.qVal}>{qty}</Text>
                      <TouchableOpacity style={[cs.qBtn,{backgroundColor:'#1a3a6b'}]} onPress={()=>addToCart(item)}><Text style={[cs.qBtnTxt,{color:'#fff'}]}>+</Text></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
          }
        </View>
        <View style={cs.totalRow}><Text style={cs.totalLbl}>TOTAL</Text><Text style={cs.totalVal}>₱ {total.toFixed(2)}</Text></View>
        <View style={{gap:3}}>
          <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:9,color:'rgba(1,31,75,0.50)',letterSpacing:1,textTransform:'uppercase'}}>Amount Paid (Cash)</Text>
          <TextInput style={cs.amtInput} value={amountPaid} onChangeText={setAmountPaid} keyboardType="numeric" placeholder="₱ 0.00" placeholderTextColor="rgba(1,31,75,0.30)"/>
        </View>
        {amountPaid!==''&&(
          <View style={[cs.changeRow,{backgroundColor:change<0?'rgba(231,76,60,0.10)':'rgba(39,174,96,0.10)',borderRadius:8,padding:8}]}>
            <Text style={cs.changeLbl}>Change</Text>
            <Text style={[cs.changeVal,{color:change<0?'#e74c3c':'#27ae60'}]}>₱ {change.toFixed(2)}</Text>
          </View>
        )}
        <TouchableOpacity style={[cs.orderBtn,cartItems.length===0&&{opacity:0.45}]} onPress={handlePlaceOrder} activeOpacity={0.80}>
          <LinearGradient colors={cartItems.length>0?['#27ae60','#2ecc71']:['#aaa','#bbb']} start={{x:0,y:0}} end={{x:1,y:0}} style={cs.orderBtnGrad}>
            <MaterialIcons name="check-circle" size={16} color="#fff"/>
            <Text style={cs.orderBtnTxt}>Place Order</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={cs.clearBtn} onPress={clearCart}>
          <MaterialIcons name="delete-sweep" size={14} color="#e74c3c"/>
          <Text style={cs.clearBtnTxt}>Clear Cart</Text>
        </TouchableOpacity>
        {lastOrder&&(
          <TouchableOpacity style={cs.receiptBtn} onPress={()=>setReceiptVisible(true)}>
            <MaterialIcons name="receipt" size={14} color="#1a3a6b"/>
            <Text style={cs.receiptBtnTxt}>Last Receipt</Text>
          </TouchableOpacity>
        )}
      </View>

      {receiptVisible&&lastOrder&&(
        <Modal transparent visible animationType="fade" onRequestClose={()=>setReceiptVisible(false)}>
          <View style={{flex:1,backgroundColor:'rgba(1,20,50,0.65)',justifyContent:'center',alignItems:'center',padding:20}}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={()=>setReceiptVisible(false)} activeOpacity={1}/>
            <View style={cs.receipt}>
              <Text style={cs.receiptTitle}>🧾 RECEIPT</Text>
              <Text style={cs.receiptSub}>CESLA Canteen</Text>
              <View style={{height:1,borderStyle:'dashed',borderTopWidth:1,borderColor:'rgba(1,31,75,0.20)',marginVertical:10}}/>
              <Text style={cs.receiptMeta}>Order #{lastOrder.orderNo}</Text>
              <Text style={cs.receiptMeta}>{lastOrder.time}</Text>
              <View style={{height:1,borderStyle:'dashed',borderTopWidth:1,borderColor:'rgba(1,31,75,0.20)',marginVertical:10}}/>
              <ScrollView style={{maxHeight:160}} showsVerticalScrollIndicator={false}>
                {(lastOrder.items||[]).map(({item,qty})=>(
                  <View key={item.id} style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                    <Text style={cs.receiptItem} numberOfLines={1}>{item.emoji} {item.name} ×{qty}</Text>
                    <Text style={cs.receiptAmt}>₱{(item.price*qty).toFixed(2)}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={{height:1,backgroundColor:'rgba(1,31,75,0.15)',marginVertical:8}}/>
              <View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={cs.receiptTotalLbl}>TOTAL</Text><Text style={cs.receiptTotalVal}>₱{lastOrder.total.toFixed(2)}</Text></View>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:3}}><Text style={cs.receiptSubLbl}>Cash</Text><Text style={cs.receiptSubVal}>₱{lastOrder.amountPaid.toFixed(2)}</Text></View>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:3}}><Text style={cs.receiptSubLbl}>Change</Text><Text style={[cs.receiptSubVal,{color:'#27ae60'}]}>₱{lastOrder.change.toFixed(2)}</Text></View>
              <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#1a3a6b',textAlign:'center',marginTop:12}}>Thank you! 🙏</Text>
              <TouchableOpacity onPress={()=>setReceiptVisible(false)} style={{marginTop:12,paddingVertical:10,backgroundColor:'rgba(26,58,107,0.10)',borderRadius:10,alignItems:'center'}}>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#1a3a6b'}}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const cs = StyleSheet.create({
  catTab: { paddingVertical:6,paddingHorizontal:14,borderRadius:16,backgroundColor:'rgba(255,255,255,0.35)',borderWidth:1,borderColor:'rgba(255,255,255,0.55)' },
  catTabActive: { backgroundColor:'#304674',borderColor:'#c9a84c' },
  catTabTxt: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'rgba(1,31,75,0.70)' },
  catTabTxtActive: { color:'#fff' },
  searchRow: { flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.70)',borderRadius:8,paddingHorizontal:10,paddingVertical:7,marginHorizontal:8,marginBottom:4,borderWidth:1,borderColor:'rgba(255,255,255,0.90)',gap:6 },
  searchInput: { flex:1,fontFamily:'GoogleSans_400Regular',fontSize:12,color:'#011f4b',paddingVertical:0 },
  itemCard: { flex:1,backgroundColor:'rgba(255,255,255,0.70)',borderRadius:12,padding:8,alignItems:'center',gap:3,borderWidth:1,borderColor:'rgba(255,255,255,0.85)',position:'relative' },
  itemImgCircle: { width:52,height:52,borderRadius:26,backgroundColor:'rgba(240,246,252,0.90)',justifyContent:'center',alignItems:'center',overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.80)' },
  itemEmoji: { fontSize:24 },
  itemCardName: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#1a2d4e',textAlign:'center',lineHeight:13,minHeight:26 },
  itemCardPrice: { fontFamily:'NotoSerif_700Bold',fontSize:13,color:'#c9a84c' },
  itemCardStock: { fontFamily:'GoogleSans_400Regular',fontSize:9,color:'rgba(1,31,75,0.45)' },
  cartBadge: { position:'absolute',top:4,right:4,backgroundColor:'#e74c3c',borderRadius:8,width:16,height:16,justifyContent:'center',alignItems:'center' },
  cartBadgeTxt: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'#fff' },
  cartPanel: { width:240,flexShrink:0,backgroundColor:'rgba(255,255,255,0.22)',borderLeftWidth:1,borderColor:'rgba(255,255,255,0.40)',padding:10,gap:6,minHeight:0,overflow:'hidden' },
  cartTitle: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'rgba(1,31,75,0.65)',letterSpacing:2,paddingBottom:6,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.10)' },
  cartItemsBox: { flex:1,minHeight:50,backgroundColor:'rgba(255,255,255,0.40)',borderRadius:10,padding:8,borderWidth:1,borderColor:'rgba(255,255,255,0.65)' },
  cartEmpty: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.40)',textAlign:'center',paddingTop:12 },
  cartRow: { flexDirection:'row',alignItems:'center',gap:5,paddingVertical:5,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.06)' },
  cartEmoji: { fontSize:15 },
  cartName: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#011f4b' },
  cartSub: { fontFamily:'GoogleSans_400Regular',fontSize:9,color:'rgba(1,31,75,0.50)' },
  qtyRow: { flexDirection:'row',alignItems:'center',gap:3 },
  qBtn: { width:18,height:18,borderRadius:9,backgroundColor:'rgba(1,31,75,0.10)',justifyContent:'center',alignItems:'center' },
  qBtnTxt: { fontSize:11,color:'#011f4b',fontWeight:'700',lineHeight:14 },
  qVal: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#011f4b',minWidth:12,textAlign:'center' },
  totalRow: { flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:3 },
  totalLbl: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'rgba(1,31,75,0.55)',letterSpacing:1 },
  totalVal: { fontFamily:'NotoSerif_700Bold',fontSize:13,color:'#c9a84c' },
  amtInput: { backgroundColor:'rgba(255,255,255,0.70)',borderRadius:8,paddingHorizontal:10,paddingVertical:7,fontFamily:'GoogleSans_400Regular',fontSize:13,color:'#011f4b',borderWidth:1,borderColor:'rgba(255,255,255,0.85)' },
  changeRow: { flexDirection:'row',justifyContent:'space-between',alignItems:'center' },
  changeLbl: { fontFamily:'GoogleSans_500Medium',fontSize:10,color:'rgba(1,31,75,0.60)' },
  changeVal: { fontFamily:'NotoSerif_700Bold',fontSize:13 },
  orderBtn: { borderRadius:10,overflow:'hidden' },
  orderBtnGrad: { flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:10 },
  orderBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#fff' },
  clearBtn: { flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,paddingVertical:7,backgroundColor:'rgba(231,76,60,0.10)',borderRadius:8,borderWidth:1,borderColor:'rgba(231,76,60,0.20)' },
  clearBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#e74c3c' },
  receiptBtn: { flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,paddingVertical:7,backgroundColor:'rgba(26,58,107,0.10)',borderRadius:8,borderWidth:1,borderColor:'rgba(26,58,107,0.20)' },
  receiptBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#1a3a6b' },
  receipt: { backgroundColor:'#fffef8',borderRadius:16,padding:20,width:'100%',maxWidth:360,shadowColor:'#000',shadowOpacity:0.25,shadowRadius:20,elevation:14 },
  receiptTitle: { fontFamily:'NotoSerif_700Bold',fontSize:18,color:'#1a2d4e',textAlign:'center' },
  receiptSub: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.50)',textAlign:'center',marginTop:2 },
  receiptMeta: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.55)',textAlign:'center',lineHeight:17 },
  receiptItem: { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'#1a2d4e',flex:1,marginRight:8 },
  receiptAmt: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#1a2d4e' },
  receiptTotalLbl: { fontFamily:'GoogleSans_700Bold',fontSize:14,color:'#1a2d4e' },
  receiptTotalVal: { fontFamily:'NotoSerif_700Bold',fontSize:16,color:'#c9a84c' },
  receiptSubLbl: { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(1,31,75,0.55)' },
  receiptSubVal: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'rgba(1,31,75,0.70)' },
});

// ─── MANAGE MENU SCREEN ───────────────────────────────────────────────────────
const ManageMenuScreen = ({ items, categories, filtered, search, activeCategory, onSearch, onCategoryChange, onAddItem, onEditItem, onDeleteItem }) => {
  const COLS = Platform.OS==='web' ? 5 : 3;
  return (
    // FIX: explicit flex:1 + minHeight:0 + overflow:'hidden' prevents overflow outside panel
    <View style={{flex:1,minHeight:0,flexDirection:'row',overflow:'hidden'}}>
      {/* Left categories panel */}
      <View style={mm.catPanel}>
        <Text style={mm.catTitle}>CATEGORIES</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}} contentContainerStyle={{gap:4}}>
          {categories.map(cat=>(
            <TouchableOpacity key={cat} style={[mm.catBtn,activeCategory===cat&&mm.catBtnActive]} onPress={()=>onCategoryChange(cat)}>
              <Text style={[mm.catBtnTxt,activeCategory===cat&&mm.catBtnTxtActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Right content — FIX: minHeight:0 so ScrollView can work */}
      <View style={{flex:1,minHeight:0,minWidth:0,overflow:'hidden'}}>
        <View style={mm.headerRow}>
          <Text style={mm.headerLbl} numberOfLines={1}>
            {search.trim()?`RESULTS FOR "${search.toUpperCase()}"`:activeCategory==='All'?'ALL ITEMS':activeCategory.toUpperCase()}
          </Text>
          <View style={mm.searchBox}>
            <MaterialIcons name="search" size={13} color="rgba(1,31,75,0.40)"/>
            <TextInput style={mm.searchInput} placeholder="Search..." placeholderTextColor="rgba(1,31,75,0.35)"
              value={search} onChangeText={onSearch}/>
            {search.length>0&&<TouchableOpacity onPress={()=>onSearch('')}><Text style={{color:'rgba(1,31,75,0.45)',fontWeight:'700',fontSize:12}}>✕</Text></TouchableOpacity>}
          </View>
          <TouchableOpacity style={mm.addBtn} onPress={onAddItem}>
            <MaterialIcons name="add" size={15} color="#fff"/>
            <Text style={mm.addBtnTxt}>Add Item</Text>
          </TouchableOpacity>
        </View>
        <View style={{height:1,backgroundColor:'rgba(1,31,75,0.10)',marginBottom:8,marginHorizontal:8}}/>
        {/* FIX: showsVerticalScrollIndicator + flex:1 */}
        <ScrollView showsVerticalScrollIndicator style={[{flex:1},WEB_SCROLL]}
          contentContainerStyle={{padding:8,gap:Platform.OS==='web'?10:5,paddingBottom:20}}>
          {filtered.length===0
            ? <Text style={mm.emptyTxt}>No items found.</Text>
            : Array.from({length:Math.ceil(filtered.length/COLS)},(_,rowIdx)=>(
              <View key={rowIdx} style={{flexDirection:'row',gap:Platform.OS==='web'?10:5}}>
                {filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).map(item=>(
                  <View key={item.id} style={{flex:1,minWidth:0}}>
                    <View style={mm.foodCard}>
                      <View style={[mm.foodCardInner,{backgroundColor:'rgba(225,238,248,0.85)'}]}>
                        <View style={mm.adminBtns}>
                          <TouchableOpacity style={mm.editBtn} onPress={()=>onEditItem(item)}><MaterialIcons name="edit" size={11} color="#1a3a6b"/></TouchableOpacity>
                          <TouchableOpacity style={mm.delBtn} onPress={()=>onDeleteItem(item.id)}><MaterialIcons name="delete" size={11} color="#e74c3c"/></TouchableOpacity>
                        </View>
                        <View style={mm.emojiCircle}>
                          {item.image?<Image source={{uri:item.image}} style={{width:'100%',height:'100%',borderRadius:99}} resizeMode="cover"/>:<Text style={mm.emojiTxt}>{item.emoji}</Text>}
                        </View>
                        <Text style={mm.itemName} numberOfLines={2}>{item.name}</Text>
                        <Text style={mm.itemStock}>Stock: {item.stock}</Text>
                        <Text style={mm.itemPrice}>₱{item.price}.00</Text>
                        <TouchableOpacity style={mm.editItemBtn} onPress={()=>onEditItem(item)}>
                          <Text style={mm.editItemBtnTxt}>Edit Item</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
                {Array.from({length:COLS-filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).length}).map((_,i)=>(<View key={`e-${i}`} style={{flex:1}}/>))}
              </View>
            ))
          }
        </ScrollView>
      </View>
    </View>
  );
};

const mm = StyleSheet.create({
  catPanel: { width:130,flexShrink:0,backgroundColor:'rgba(255,255,255,0.20)',borderRightWidth:1,borderColor:'rgba(255,255,255,0.40)',padding:10,minHeight:0 },
  catTitle: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'rgba(1,31,75,0.50)',letterSpacing:2,textTransform:'uppercase',marginBottom:6,paddingBottom:6,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.10)' },
  catBtn: { paddingVertical:8,paddingHorizontal:10,borderRadius:8,marginBottom:2 },
  catBtnActive: { backgroundColor:'rgba(26,58,107,0.18)' },
  catBtnTxt: { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(1,31,75,0.60)' },
  catBtnTxtActive: { fontFamily:'GoogleSans_700Bold',color:'#1a3a6b' },
  headerRow: { flexDirection:'row',alignItems:'center',gap:8,padding:8,paddingBottom:0 },
  headerLbl: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#011f4b',letterSpacing:2,flexShrink:0 },
  searchBox: { flex:1,flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.75)',borderRadius:8,paddingHorizontal:8,paddingVertical:5,borderWidth:1,borderColor:'rgba(255,255,255,0.90)',gap:4 },
  searchInput: { flex:1,fontFamily:'GoogleSans_400Regular',fontSize:11,color:'#011f4b',paddingVertical:0 },
  addBtn: { flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#1a3a6b',borderRadius:8,paddingVertical:6,paddingHorizontal:10 },
  addBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#fff' },
  emptyTxt: { fontFamily:'GoogleSans_400Regular',fontSize:13,color:'rgba(1,31,75,0.40)',textAlign:'center',marginTop:30 },
  foodCard: { borderRadius:12,overflow:'hidden',flex:1 },
  foodCardInner: { borderRadius:12,padding:Platform.OS==='web'?12:8,borderWidth:1.5,borderColor:'rgba(255,255,255,0.75)',alignItems:'center',gap:3,flex:1,justifyContent:'space-between',position:'relative' },
  adminBtns: { position:'absolute',top:4,right:4,flexDirection:'row',gap:3,zIndex:10 },
  editBtn: { backgroundColor:'rgba(26,58,107,0.12)',borderRadius:6,padding:4,borderWidth:1,borderColor:'rgba(26,58,107,0.20)' },
  delBtn: { backgroundColor:'rgba(231,76,60,0.10)',borderRadius:6,padding:4,borderWidth:1,borderColor:'rgba(231,76,60,0.20)' },
  emojiCircle: { width:Platform.OS==='web'?60:48,height:Platform.OS==='web'?60:48,borderRadius:30,backgroundColor:'rgba(240,246,252,0.90)',borderWidth:1.5,borderColor:'rgba(255,255,255,0.85)',justifyContent:'center',alignItems:'center',overflow:'hidden',flexShrink:0 },
  emojiTxt: { fontSize:Platform.OS==='web'?28:22 },
  itemName: { fontFamily:'GoogleSans_700Bold',fontSize:Platform.OS==='web'?10:9,color:'#1a2d4e',textAlign:'center',lineHeight:Platform.OS==='web'?14:12,minHeight:24,alignSelf:'stretch' },
  itemStock: { fontFamily:'GoogleSans_400Regular',fontSize:Platform.OS==='web'?9:8,color:'rgba(1,31,75,0.45)' },
  itemPrice: { fontFamily:'NotoSerif_700Bold',fontSize:Platform.OS==='web'?13:11,color:'#c9a84c' },
  editItemBtn: { backgroundColor:'#1a3a6b',borderRadius:6,paddingVertical:Platform.OS==='web'?7:5,paddingHorizontal:4,alignItems:'center',width:'100%' },
  editItemBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:Platform.OS==='web'?9:8,color:'#fff' },
});

// ─── INVENTORY SCREEN — FIX: removed sort chips, added search bar, scrollbar ──
const InventoryScreen = ({ items }) => {
  const [sort,setSort] = useState('name');
  const [search,setSearch] = useState('');
  const totalValue = items.reduce((s,i)=>s+i.price*i.stock,0);

  const sorted = [...items]
    .filter(i => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{
      if(sort==='name')  return a.name.localeCompare(b.name);
      if(sort==='price') return b.price-a.price;
      if(sort==='stock') return b.stock-a.stock;
      if(sort==='value') return (b.price*b.stock)-(a.price*a.stock);
      return 0;
    });

  return (
    // FIX: flex:1 + minHeight:0 + overflow:'hidden'
    <View style={{flex:1,minHeight:0,overflow:'hidden',padding:14}}>
      {/* Stat cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{flexGrow:0,marginBottom:10}}
        contentContainerStyle={{gap:8,paddingVertical:2}}>
        {[
          {l:'Items',       v:items.length,                              c:'#1a3a6b'},
          {l:'In Stock',    v:items.filter(i=>i.stock>0).length,        c:'#27ae60'},
          {l:'Out of Stock',v:items.filter(i=>i.stock===0).length,      c:'#e74c3c'},
          {l:'Total Value', v:`₱${totalValue.toLocaleString()}`,         c:'#c9a84c'},
        ].map(s=>(
          <View key={s.l} style={sub.statCard}>
            <Text style={[sub.statVal,{color:s.c,fontSize:s.l==='Total Value'?12:16}]}>{s.v}</Text>
            <Text style={sub.statLbl}>{s.l}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Search bar — ADDED */}
      <View style={inv.searchRow}>
        <MaterialIcons name="search" size={15} color="rgba(1,31,75,0.40)"/>
        <TextInput style={inv.searchInput} placeholder="Search inventory..."
          placeholderTextColor="rgba(1,31,75,0.35)"
          value={search} onChangeText={setSearch}/>
        {search.length>0&&<TouchableOpacity onPress={()=>setSearch('')}><Text style={{color:'rgba(1,31,75,0.45)',fontWeight:'700'}}>✕</Text></TouchableOpacity>}
      </View>

      {/* Table header — tap column to sort (no chip row) */}
      <View style={sub.tableHead}>
        {[
          {k:'name', l:'ITEM',  extra:{flex:2}},
          {k:null,   l:'CAT',   extra:{}},
          {k:'price',l:'PRICE', extra:{}},
          {k:'stock',l:'STOCK', extra:{}},
          {k:'value',l:'VALUE', extra:{textAlign:'right'}},
        ].map(col=>(
          <TouchableOpacity key={col.l} style={{flex:1,...col.extra}}
            onPress={()=>col.k&&setSort(col.k)} activeOpacity={col.k?0.7:1}>
            <Text style={[sub.thCell,col.extra,sort===col.k&&{color:'#1a3a6b',textDecorationLine:'underline'}]}>
              {col.l}{sort===col.k?' ↓':''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Table rows — FIX: showsVerticalScrollIndicator */}
      <ScrollView showsVerticalScrollIndicator style={[{flex:1,minHeight:0},WEB_SCROLL]}>
        {sorted.map((item,idx)=>(
          <View key={item.id} style={[sub.tableRow,idx%2===0&&{backgroundColor:'rgba(255,255,255,0.35)'}]}>
            <Text style={[sub.tdCell,{flex:2,fontFamily:'GoogleSans_700Bold'}]} numberOfLines={1}>{item.emoji} {item.name}</Text>
            <Text style={sub.tdCell} numberOfLines={1}>{item.cat}</Text>
            <Text style={sub.tdCell}>₱{item.price}</Text>
            <Text style={[sub.tdCell,
              item.stock===0&&{color:'#e74c3c',fontFamily:'GoogleSans_700Bold'},
              item.stock<=5&&item.stock>0&&{color:'#e67e22',fontFamily:'GoogleSans_700Bold'}
            ]}>{item.stock}</Text>
            <Text style={[sub.tdCell,{textAlign:'right',fontFamily:'GoogleSans_700Bold',color:'#1a3a6b'}]}>
              ₱{(item.price*item.stock).toLocaleString()}
            </Text>
          </View>
        ))}
        {sorted.length===0&&(
          <View style={{padding:30,alignItems:'center'}}>
            <Text style={sub.emptyTxt}>No items match "{search}"</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const inv = StyleSheet.create({
  searchRow: { flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.70)',borderRadius:8,paddingHorizontal:10,paddingVertical:8,marginBottom:10,borderWidth:1,borderColor:'rgba(255,255,255,0.90)',gap:6 },
  searchInput: { flex:1,fontFamily:'GoogleSans_400Regular',fontSize:12,color:'#011f4b',paddingVertical:0 },
});

// ─── ORDER HISTORY — FIX: no filter tabs, real-time date/time, scrollbar ──────
const OrderHistoryScreen = ({ orders }) => {
  const [now, setNow] = useState(new Date());

  // Real-time clock
  useEffect(() => {
    const t = setInterval(()=>setNow(new Date()), 1000);
    return ()=>clearInterval(t);
  }, []);

  const formatDate = (d) =>
    d.toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const formatTime = (d) =>
    d.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});

  // Sort newest first
  const sorted = [...orders].reverse();

  return (
    // FIX: flex:1 + minHeight:0
    <View style={{flex:1,minHeight:0,overflow:'hidden',padding:14}}>
      {/* Real-time date & time display */}
      <View style={hs.clockBox}>
        <MaterialIcons name="access-time" size={16} color="#1a3a6b"/>
        <View>
          <Text style={hs.clockDate}>{formatDate(now)}</Text>
          <Text style={hs.clockTime}>{formatTime(now)}</Text>
        </View>
      </View>

      {/* Orders list — FIX: showsVerticalScrollIndicator */}
      <ScrollView showsVerticalScrollIndicator style={[{flex:1,minHeight:0},WEB_SCROLL]}
        contentContainerStyle={{gap:8,paddingBottom:16}}>
        {sorted.length===0
          ? <View style={sub.emptyBox}>
              <MaterialIcons name="history" size={48} color="rgba(1,31,75,0.15)"/>
              <Text style={sub.emptyTxt}>No orders yet.</Text>
            </View>
          : sorted.map(order=>{
            const st=ORDER_STATUSES[order.status]||ORDER_STATUSES.pending;
            return(
              <View key={order.id} style={sub.orderCard}>
                <View style={sub.orderHead}>
                  <Text style={sub.orderId} numberOfLines={1}>#{order.orderNo||order.id}</Text>
                  <Text style={sub.orderTime} numberOfLines={1}>{order.time}</Text>
                  <View style={[sub.badge,{backgroundColor:st.bg}]}>
                    <Text style={[sub.badgeTxt,{color:st.color}]}>{st.label}</Text>
                  </View>
                </View>
                <Text style={sub.orderItems} numberOfLines={2}>
                  {(order.items||[]).map(i=>`${i.item?.name||i.name||'Item'} x${i.qty}`).join(' • ')}
                </Text>
                <View style={sub.orderFoot}>
                  <Text style={sub.orderTotal}>₱ {Number(order.total).toFixed(2)}</Text>
                  <Text style={sub.orderPay}>
                    {order.payment==='gcash'?'📱 GCash':order.payment==='credit'?'💳 Credit':'💵 Cash'}
                  </Text>
                </View>
              </View>
            );
          })
        }
      </ScrollView>
    </View>
  );
};

const hs = StyleSheet.create({
  clockBox: { flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'rgba(255,255,255,0.55)',borderRadius:12,padding:12,marginBottom:12,borderWidth:1,borderColor:'rgba(255,255,255,0.80)' },
  clockDate: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#1a3a6b' },
  clockTime: { fontFamily:'NotoSerif_700Bold',fontSize:18,color:'#1a3a6b',marginTop:1 },
});

// ─── EMPLOYEE CREDITS ─────────────────────────────────────────────────────────
const EmployeeCreditsScreen = () => (
  <View style={[sub.root,{justifyContent:'center',alignItems:'center',gap:14}]}>
    <MaterialIcons name="account-balance" size={64} color="rgba(1,31,75,0.15)"/>
    <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:20,color:'rgba(1,31,75,0.30)'}}>Coming Soon</Text>
    <Text style={sub.emptyTxt}>Employee credit tracking will be{'\n'}available in a future update.</Text>
  </View>
);

// ─── SALES REPORT — FIX: dropdown year, daily totals, cash/credit/ewallet, scrollbar ──
const SalesReportScreen = ({ orders }) => {
  const currentYear = new Date().getFullYear();
  const startYear   = 2024;
  // Generate years from startYear to currentYear (unlimited upward)
  const years = Array.from({length: currentYear - startYear + 1}, (_,i) => startYear + i).reverse();

  const [year, setYear]           = useState(currentYear);
  const [yearDropdown, setYearDropdown] = useState(false);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const doneOrders   = orders.filter(o=>o.status==='done');
  const todayStr     = new Date().toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'});

  // Today's figures
  const todayOrders  = doneOrders.filter(o=>o.time&&o.time.startsWith(todayStr));
  const todaySales   = todayOrders.reduce((s,o)=>s+Number(o.total),0);
  const todayCash    = todayOrders.filter(o=>!o.payment||o.payment==='cash').reduce((s,o)=>s+Number(o.total),0);
  const todayCredit  = todayOrders.filter(o=>o.payment==='credit').reduce((s,o)=>s+Number(o.total),0);
  const todayEwallet = todayOrders.filter(o=>o.payment==='gcash'||o.payment==='ewallet').reduce((s,o)=>s+Number(o.total),0);

  const getMonthOrders = (monthIdx) => doneOrders.filter(o=>{
    if(!o.time) return false;
    try {
      // Try parsing from our time string format e.g. "Mar 12, 2026  09:30 AM"
      const d = new Date(o.time);
      if(!isNaN(d.getTime())) return d.getFullYear()===year && d.getMonth()===monthIdx;
      // fallback: check string contains month abbr and year
      return o.time.includes(MONTHS[monthIdx]) && o.time.includes(String(year));
    } catch { return false; }
  });

  const monthlyTotals = MONTHS.map((_,i)=>getMonthOrders(i).reduce((s,o)=>s+Number(o.total),0));
  const maxMonth = Math.max(...monthlyTotals, 1);

  // Top items
  const itemMap={};
  doneOrders.forEach(o=>(o.items||[]).forEach(i=>{const nm=i.item?.name||i.name||'Item';itemMap[nm]=(itemMap[nm]||0)+i.qty;}));
  const topItems=Object.entries(itemMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return (
    // FIX: flex:1 + minHeight:0 + overflow:'hidden'
    <View style={{flex:1,minHeight:0,overflow:'hidden',padding:14}}>

      {/* Year selector — dropdown style */}
      <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12,zIndex:20}}>
        <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:11,color:'rgba(1,31,75,0.55)',letterSpacing:1}}>YEAR :</Text>
        <View style={{position:'relative'}}>
          <TouchableOpacity style={rp.yearBtn} onPress={()=>setYearDropdown(v=>!v)} activeOpacity={0.80}>
            <Text style={rp.yearBtnTxt}>{year}</Text>
            <MaterialIcons name={yearDropdown?'arrow-drop-up':'arrow-drop-down'} size={18} color="#fff"/>
          </TouchableOpacity>
          {yearDropdown&&(
            <View style={rp.yearDropdown}>
              <ScrollView style={{maxHeight:160}} showsVerticalScrollIndicator>
                {years.map(y=>(
                  <TouchableOpacity key={y} style={[rp.yearOption,y===year&&rp.yearOptionActive]}
                    onPress={()=>{setYear(y);setYearDropdown(false);}}>
                    <Text style={[rp.yearOptionTxt,y===year&&{color:'#fff',fontFamily:'GoogleSans_700Bold'}]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      {/* Today's summary cards */}
      <View style={{marginBottom:12}}>
        <Text style={[sub.sectionTitle2,{marginBottom:6}]}>📊 TODAY'S SALES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{gap:8,paddingVertical:2}}>
          {[
            {l:'Total Sales',v:`₱${todaySales.toFixed(2)}`, c:'#27ae60'},
            {l:'Orders',     v:todayOrders.length,          c:'#1a3a6b'},
            {l:'💵 Cash',    v:`₱${todayCash.toFixed(2)}`,  c:'#c9a84c'},
            {l:'💳 Credit',  v:`₱${todayCredit.toFixed(2)}`,c:'#8e44ad'},
            {l:'📱 E-Wallet',v:`₱${todayEwallet.toFixed(2)}`,c:'#2980b9'},
          ].map(s=>(
            <View key={s.l} style={sub.statCard}>
              <Text style={[sub.statVal,{color:s.c,fontSize:12}]}>{s.v}</Text>
              <Text style={sub.statLbl}>{s.l}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Main scrollable content */}
      <ScrollView showsVerticalScrollIndicator style={[{flex:1,minHeight:0},WEB_SCROLL]} contentContainerStyle={{paddingBottom:20}}>
        {/* Monthly bar chart */}
        <Text style={sub.sectionTitle2}>📅 Monthly Earnings — {year}</Text>
        <View style={{flexDirection:'row',gap:4,alignItems:'flex-end',height:90,marginBottom:16,paddingHorizontal:4}}>
          {MONTHS.map((m,i)=>{
            const val=monthlyTotals[i];
            const barH=val>0?Math.max(8,(val/maxMonth)*72):4;
            return(
              <View key={m} style={{flex:1,alignItems:'center',gap:2}}>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:6,color:val>0?'#1a3a6b':'transparent'}}>
                  {val>0?`₱${val>=1000?`${(val/1000).toFixed(1)}k`:val.toFixed(0)}`:''}
                </Text>
                <View style={{width:'100%',height:barH,backgroundColor:val>0?'#1a3a6b':'rgba(1,31,75,0.12)',borderRadius:3}}/>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:6,color:'rgba(1,31,75,0.50)'}}>{m}</Text>
              </View>
            );
          })}
        </View>

        {/* Monthly breakdown table */}
        <Text style={sub.sectionTitle2}>📋 Monthly Breakdown</Text>
        <View style={sub.tableHead}>
          <Text style={[sub.thCell,{flex:1.2}]}>MONTH</Text>
          <Text style={sub.thCell}>ORDERS</Text>
          <Text style={[sub.thCell,{textAlign:'right',flex:1.5}]}>TOTAL</Text>
        </View>
        {MONTHS.map((m,i)=>{
          const mo=getMonthOrders(i);
          const tot=mo.reduce((s,o)=>s+Number(o.total),0);
          const cash=mo.filter(o=>!o.payment||o.payment==='cash').reduce((s,o)=>s+Number(o.total),0);
          const credit=mo.filter(o=>o.payment==='credit').reduce((s,o)=>s+Number(o.total),0);
          const ew=mo.filter(o=>o.payment==='gcash'||o.payment==='ewallet').reduce((s,o)=>s+Number(o.total),0);
          return(
            <View key={m}>
              <View style={[sub.tableRow,i%2===0&&{backgroundColor:'rgba(255,255,255,0.35)'}]}>
                <Text style={[sub.tdCell,{flex:1.2,fontFamily:'GoogleSans_700Bold',color:'#1a3a6b'}]}>{m} {year}</Text>
                <Text style={sub.tdCell}>{mo.length}</Text>
                <Text style={[sub.tdCell,{textAlign:'right',flex:1.5,fontFamily:'GoogleSans_700Bold',color:tot>0?'#c9a84c':'rgba(1,31,75,0.30)'}]}>
                  ₱{tot.toFixed(2)}
                </Text>
              </View>
              {tot>0&&(
                <View style={{flexDirection:'row',gap:10,paddingHorizontal:12,paddingBottom:4,paddingTop:2,backgroundColor:i%2===0?'rgba(255,255,255,0.20)':'transparent'}}>
                  <Text style={rp.subBreakTxt}>💵 ₱{cash.toFixed(0)}</Text>
                  <Text style={rp.subBreakTxt}>💳 ₱{credit.toFixed(0)}</Text>
                  <Text style={rp.subBreakTxt}>📱 ₱{ew.toFixed(0)}</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Top items */}
        {topItems.length>0&&<>
          <Text style={[sub.sectionTitle2,{marginTop:16}]}>🏆 Top Selling Items</Text>
          {topItems.map(([name,qty],i)=>(
            <View key={name} style={sub.topItemRow}>
              <Text style={sub.topItemRank}>#{i+1}</Text>
              <Text style={[sub.topItemName,{flex:1}]} numberOfLines={1}>{name}</Text>
              <View style={[sub.topItemBar,{width:`${Math.min(100,(qty/topItems[0][1])*100)}%`}]}/>
              <Text style={sub.topItemQty}>{qty} sold</Text>
            </View>
          ))}
        </>}
      </ScrollView>
    </View>
  );
};

const rp = StyleSheet.create({
  yearBtn: { flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#1a3a6b',borderRadius:10,paddingVertical:6,paddingHorizontal:12,borderWidth:1,borderColor:'#c9a84c' },
  yearBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#fff' },
  yearDropdown: { position:'absolute',top:36,left:0,backgroundColor:'#f0f5f9',borderRadius:10,borderWidth:1,borderColor:'rgba(1,31,75,0.18)',width:100,zIndex:999,shadowColor:'#000',shadowOpacity:0.15,shadowRadius:8,elevation:10 },
  yearOption: { paddingVertical:8,paddingHorizontal:14 },
  yearOptionActive: { backgroundColor:'#1a3a6b',borderRadius:8 },
  yearOptionTxt: { fontFamily:'GoogleSans_400Regular',fontSize:13,color:'#1a3a6b' },
  subBreakTxt: { fontFamily:'GoogleSans_400Regular',fontSize:10,color:'rgba(1,31,75,0.50)' },
});

// ─── SHARED SUB-SCREEN STYLES ─────────────────────────────────────────────────
const sub = StyleSheet.create({
  root: { flex:1, padding:14, overflow:'hidden' },
  emptyBox: { flex:1, alignItems:'center', justifyContent:'center', gap:10, paddingTop:60 },
  emptyTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.35)', textAlign:'center', lineHeight:18 },
  filterBtn: { paddingHorizontal:14, paddingVertical:7, borderRadius:20, backgroundColor:'rgba(255,255,255,0.40)', borderWidth:1, borderColor:'rgba(255,255,255,0.60)' },
  filterBtnActive: { backgroundColor:'#1a3a6b', borderColor:'#c9a84c' },
  filterTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.60)' },
  filterTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  statRow: { flexDirection:'row', gap:8 },
  statCard: { minWidth:80, backgroundColor:'rgba(255,255,255,0.60)', borderRadius:12, padding:10, alignItems:'center', gap:3 },
  statVal:  { fontFamily:'GoogleSans_700Bold', fontSize:16, color:'#1a3a6b' },
  statLbl:  { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.45)', textAlign:'center' },
  sectionTitle2: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'rgba(1,31,75,0.55)', letterSpacing:1, textTransform:'uppercase', marginBottom:8, marginTop:4 },
  sortChip: { paddingHorizontal:12, paddingVertical:6, borderRadius:14, backgroundColor:'rgba(255,255,255,0.40)', borderWidth:1, borderColor:'rgba(255,255,255,0.60)' },
  sortChipActive: { backgroundColor:'#1a3a6b' },
  sortTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)' },
  sortTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  tableHead: { flexDirection:'row', paddingVertical:8, paddingHorizontal:10, backgroundColor:'rgba(26,58,107,0.12)', borderRadius:8, marginBottom:4 },
  thCell: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.55)', flex:1, letterSpacing:0.5 },
  tableRow: { flexDirection:'row', paddingVertical:9, paddingHorizontal:10, borderRadius:6, marginBottom:2 },
  tdCell:  { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#1a2d4e', flex:1 },
  topItemRow: { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:7, borderBottomWidth:1, borderColor:'rgba(1,31,75,0.06)' },
  topItemRank: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#c9a84c', width:24, flexShrink:0 },
  topItemName: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'#1a2d4e' },
  topItemBar: { height:6, backgroundColor:'rgba(26,58,107,0.20)', borderRadius:3, maxWidth:80 },
  topItemQty: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#1a3a6b', width:55, textAlign:'right', flexShrink:0 },
  sectionHead: { borderLeftWidth:3, paddingLeft:10, marginBottom:8 },
  sectionTitle: { fontFamily:'GoogleSans_700Bold', fontSize:12, letterSpacing:0.5 },
  orderCard: { backgroundColor:'rgba(255,255,255,0.65)', borderRadius:12, padding:12, borderWidth:1, borderColor:'rgba(255,255,255,0.80)', gap:6 },
  orderHead: { flexDirection:'row', alignItems:'center', gap:8, overflow:'hidden' },
  orderId:   { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#1a3a6b', flexShrink:1 },
  orderTime: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.45)', flex:1 },
  badge:     { borderRadius:6, paddingHorizontal:7, paddingVertical:2, flexShrink:0 },
  badgeTxt:  { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#1a2d4e' },
  orderItems:{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)', lineHeight:16 },
  orderFoot: { flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' },
  orderTotal:{ fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#c9a84c', flexShrink:0 },
  orderPay:  { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.50)', flex:1 },
});

// ─── LEFT PANEL: ORDERING MONITORING — FIX: proper flex + overflow:hidden ─────
const OrderingMonitoring = ({ orders, onUpdateStatus }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim,{toValue:0.2,duration:800,useNativeDriver:true}),
      Animated.timing(pulseAnim,{toValue:1,  duration:800,useNativeDriver:true}),
    ]));
    loop.start();
    return ()=>loop.stop();
  }, []);

  const pending   = orders.filter(o=>o.status==='pending');
  const preparing = orders.filter(o=>o.status==='preparing');
  const done      = orders.filter(o=>o.status==='done');
  const tabData   = { pending, preparing, done };

  const TAB_CFG = {
    pending:   { color:'#e74c3c', bg:'rgba(231,76,60,0.18)',   label:'PENDING',   num:pending.length   },
    preparing: { color:'#e67e22', bg:'rgba(230,126,34,0.18)', label:'PREPARING', num:preparing.length },
    done:      { color:'#27ae60', bg:'rgba(39,174,96,0.18)',   label:'DONE',      num:done.length      },
  };

  const displayOrders = tabData[activeTab]||[];
  const cfg = TAB_CFG[activeTab];

  return (
    // FIX: flex:1 + minHeight:0 + overflow:'hidden' — this prevents the panel from growing beyond screen
    <View style={{flex:1,minHeight:0,overflow:'hidden',padding:10}}>

      {/* Title */}
      <View style={lp.titleRow}>
        <Animated.View style={[lp.liveDot,{opacity:pulseAnim}]}/>
        <Text style={lp.title}>ORDERING MONITORING</Text>
      </View>

      {/* 3 stat tab cards */}
      <View style={lp.statCards}>
        {Object.entries(TAB_CFG).map(([key,c])=>(
          <TouchableOpacity key={key}
            style={[lp.statCard,{backgroundColor:c.bg,borderColor:activeTab===key?c.color:'transparent',borderWidth:2}]}
            onPress={()=>setActiveTab(key)} activeOpacity={0.80}>
            <Text style={[lp.statLabel,{color:c.color}]}>{c.label}</Text>
            <Text style={[lp.statNum,{color:c.color}]}>{String(c.num).padStart(2,'0')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Section label */}
      <View style={[lp.sectionBar,{borderLeftColor:cfg.color}]}>
        <Text style={[lp.sectionLbl,{color:cfg.color}]}>{cfg.label}</Text>
        <Text style={[lp.sectionCount,{color:cfg.color}]}>{displayOrders.length} order{displayOrders.length!==1?'s':''}</Text>
      </View>

      {/* Orders scroll — FIX: flex:1 + minHeight:0 */}
      <ScrollView style={[{flex:1,minHeight:0},WEB_SCROLL]} showsVerticalScrollIndicator
        contentContainerStyle={{gap:6,paddingBottom:12}}>
        {displayOrders.length===0
          ? <View style={lp.emptyBox}>
              <Text style={lp.emptyIco}>📋</Text>
              <Text style={lp.emptyTxt}>No {activeTab} orders</Text>
            </View>
          : displayOrders.map(order=>{
            const st=ORDER_STATUSES[order.status]||ORDER_STATUSES.pending;
            const itemsList=(order.items||[]).map(i=>`${i.item?.name||i.name||'Item'} ×${i.qty}`).join(', ');
            return(
              <View key={order.id} style={[lp.card,{borderLeftColor:cfg.color}]}>
                <View style={lp.cardHead}>
                  <Text style={lp.cardId}>#{order.orderNo||order.id?.slice(-6)||'---'}</Text>
                  <Text style={lp.cardTime} numberOfLines={1}>{order.time||'Just now'}</Text>
                </View>
                <Text style={lp.cardItems} numberOfLines={2}>{itemsList}</Text>
                <View style={lp.cardFoot}>
                  <Text style={lp.cardTotal}>₱{Number(order.total).toFixed(0)}</Text>
                  <View style={{flexDirection:'row',gap:5,alignItems:'center'}}>
                    {st.next&&(
                      <TouchableOpacity
                        style={[lp.actionBtn,{backgroundColor:st.nextColor}]}
                        onPress={()=>onUpdateStatus(order.id,st.next)}>
                        <Text style={lp.actionBtnTxt}>{st.nextLabel?.replace(/^[^\w\s]*\s*/,'')}</Text>
                      </TouchableOpacity>
                    )}
                    <View style={[lp.statusBadge,{backgroundColor:cfg.bg}]}>
                      <Text style={[lp.statusBadgeTxt,{color:cfg.color}]}>{cfg.label}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        }
      </ScrollView>
    </View>
  );
};

const lp = StyleSheet.create({
  titleRow: { flexDirection:'row', alignItems:'center', gap:5, marginBottom:8, justifyContent:'center' },
  liveDot:  { width:8, height:8, borderRadius:4, backgroundColor:'#e74c3c' },
  title:    { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#1a2d4e', letterSpacing:1.5, textDecorationLine:'underline', textAlign:'center' },
  statCards: { flexDirection:'row', gap:4, marginBottom:8 },
  statCard:  { flex:1, borderRadius:10, paddingVertical:7, paddingHorizontal:3, alignItems:'center', gap:1 },
  statLabel: { fontFamily:'GoogleSans_700Bold', fontSize:6, letterSpacing:0.8 },
  statNum:   { fontFamily:'GoogleSans_700Bold', fontSize:20, lineHeight:24 },
  sectionBar: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderLeftWidth:3, paddingLeft:7, marginBottom:7, paddingVertical:2 },
  sectionLbl: { fontFamily:'GoogleSans_700Bold', fontSize:9, letterSpacing:2, textTransform:'uppercase' },
  sectionCount: { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.45)' },
  emptyBox: { padding:20, alignItems:'center', gap:6 },
  emptyIco: { fontSize:28 },
  emptyTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.35)', textAlign:'center' },
  card: { backgroundColor:'rgba(255,255,255,0.80)', borderRadius:10, padding:10, borderLeftWidth:4, borderWidth:1, borderColor:'rgba(255,255,255,0.95)', gap:4, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:4, elevation:2 },
  cardHead:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  cardId:    { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#0d2540' },
  cardTime:  { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.40)', flexShrink:1, textAlign:'right' },
  cardItems: { fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(1,31,75,0.65)', lineHeight:14 },
  cardFoot:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:2 },
  cardTotal: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#c9a84c' },
  statusBadge:   { borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  statusBadgeTxt:{ fontFamily:'GoogleSans_700Bold', fontSize:9, letterSpacing:0.5 },
  actionBtn:    { borderRadius:6, paddingVertical:4, paddingHorizontal:10, alignItems:'center', justifyContent:'center' },
  actionBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'#fff' },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function ManageCanteenScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isSmall = width < 400;

  const {
    items, ads, categories, orders,
    saveItem, deleteItem, saveAd, addOrder, updateOrderStatus,
    deductStock, reloadFromStorage, setAds,
  } = useCanteen();

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const [activeTab,      setActiveTab]      = useState('cashier');
  const [activeCategory, setActiveCategory] = useState('All');
  const [search,         setSearch]         = useState('');
  const [editItem,       setEditItem]       = useState(null);
  const [editItemModal,  setEditItemModal]  = useState(false);
  const [editAd,         setEditAd]         = useState(null);
  const [editAdModal,    setEditAdModal]    = useState(false);
  const [adCurrent,      setAdCurrent]      = useState(0);

  const hdrFade    = useRef(new Animated.Value(0)).current;
  const hdrTrans   = useRef(new Animated.Value(-16)).current;
  const bodyFade   = useRef(new Animated.Value(0)).current;
  const adScrollRef = useRef(null);

  useFocusEffect(useCallback(()=>{
    reloadFromStorage();
    const poll = setInterval(()=>{ reloadFromStorage(); }, 3000);
    return ()=>clearInterval(poll);
  },[reloadFromStorage]));

  useEffect(()=>{
    Animated.parallel([
      Animated.timing(hdrFade, {toValue:1,duration:500,useNativeDriver:true}),
      Animated.timing(hdrTrans,{toValue:0,duration:500,useNativeDriver:true}),
    ]).start();
    Animated.timing(bodyFade,{toValue:1,duration:500,delay:150,useNativeDriver:true}).start();
  },[]);

  const bannerW = Math.min(width*0.60, 700);

  useEffect(()=>{
    if(!ads.length) return;
    const t=setInterval(()=>{
      setAdCurrent(prev=>{
        const next=(prev+1)%ads.length;
        adScrollRef.current?.scrollTo({x:next*bannerW,animated:true});
        return next;
      });
    },5000);
    return()=>clearInterval(t);
  },[ads.length,bannerW]);

  const handleSearch = (text)=>{
    setSearch(text);
    if(!text.trim()) return;
    const cats=[...new Set(items.filter(i=>i.name.toLowerCase().includes(text.toLowerCase())).map(i=>i.cat))];
    setActiveCategory(cats.length===1?cats[0]:'All');
  };

  const filtered = items.filter(i=>{
    if(search.trim()) return i.name.toLowerCase().includes(search.toLowerCase());
    return activeCategory==='All' || i.cat===activeCategory;
  });

  const openAddItem  = ()=>{setEditItem(emptyItem());setEditItemModal(true);};
  const openEditItem = (item)=>{setEditItem({...item,price:String(item.price),stock:String(item.stock)});setEditItemModal(true);};
  const handleSaveItem   = (updated)=>{saveItem(updated);setEditItemModal(false);};
  const handleDeleteItem = (id)=>{
    Alert.alert('Delete Item','Are you sure?',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive',onPress:()=>deleteItem(id)},
    ]);
  };

  const handleSaveAd = (updated)=>{
    if(updated.isNew){
      const newAd={...updated,id:Date.now().toString(),isNew:undefined,bg:['#1a3a6b','#2e5fa3'],emoji:updated.emoji||'📢'};
      setAds(prev=>[...prev,newAd]);
    } else {
      saveAd(updated);
    }
    setEditAdModal(false);
  };

  const handleDeleteAd = (id)=>{ setAds(prev=>prev.filter(a=>a.id!==id)); };

  const pendingCount = orders.filter(o=>o.status==='pending').length;

  if (!fontsLoaded) return null;

  const renderContent = ()=>{
    if(activeTab==='cashier')   return <CashierScreen items={items} categories={categories} addOrder={addOrder} deductStock={deductStock}/>;
    if(activeTab==='menu')      return <ManageMenuScreen items={items} categories={categories} filtered={filtered} search={search} activeCategory={activeCategory} onSearch={handleSearch} onCategoryChange={setActiveCategory} onAddItem={openAddItem} onEditItem={openEditItem} onDeleteItem={handleDeleteItem}/>;
    if(activeTab==='inventory') return <InventoryScreen items={items}/>;
    if(activeTab==='history')   return <OrderHistoryScreen orders={orders}/>;
    if(activeTab==='credits')   return <EmployeeCreditsScreen/>;
    if(activeTab==='report')    return <SalesReportScreen orders={orders}/>;
    return null;
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>
      <View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#98bad5'}]}/>
      <LinearGradient colors={['rgba(198,220,235,0.85)','rgba(152,186,213,0.40)','rgba(80,110,150,0.0)']} locations={[0,0.45,1]} start={{x:0.5,y:0.1}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>
      <LinearGradient colors={['rgba(50,80,120,0.45)','rgba(50,80,120,0.0)','rgba(50,80,120,0.45)']} locations={[0,0.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFillObject}/>
      <LinearGradient colors={['rgba(50,80,120,0.0)','rgba(60,90,130,0.35)']} locations={[0.4,1]} start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>

      {/* HEADER */}
      <Animated.View style={{opacity:hdrFade,transform:[{translateY:hdrTrans}],marginTop:Platform.OS==='web'?16:36,marginHorizontal:isSmall?8:10,zIndex:30,flexShrink:0}}>
        <View style={[styles.header,{paddingHorizontal:20,paddingVertical:10}]}>
          <TouchableOpacity style={styles.backBtn} onPress={()=>navigation&&navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1,{fontSize:isSmall?13:18}]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>CESLA </Text>Canteen Management
            </Text>
            <View style={styles.visitorTag}>
              <Text style={styles.visitorTagText}>🍽️  ADMIN PANEL</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.iconBtn,{position:'relative'}]}>
            <MaterialIcons name="notifications" size={19} color="#fff"/>
            {pendingCount>0&&<View style={styles.notifBadge}><Text style={styles.notifBadgeTxt}>{pendingCount}</Text></View>}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* BODY — FIX: flex:1 + minHeight:0 prevents children from escaping screen bounds */}
      <Animated.View style={[styles.body,{opacity:bodyFade}]}>

        {/* LEFT PANEL — FIX: fixed width + overflow:hidden */}
        <View style={styles.leftPanel}>
          <OrderingMonitoring orders={orders} onUpdateStatus={updateOrderStatus}/>
        </View>

        {/* RIGHT PANEL — FIX: flex:1 + minHeight:0 */}
        <View style={styles.rightPanel}>

          {/* Ad banner */}
          <View style={styles.adWrapper}>
            <ScrollView ref={adScrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e=>setAdCurrent(Math.round(e.nativeEvent.contentOffset.x/bannerW))}
              style={{width:'100%'}} contentContainerStyle={{width:bannerW*(ads.length+1)}}>
              {ads.map(ad=>{
                const imgSrc=ad.image?{uri:ad.image}:(ad.imageUrl?{uri:ad.imageUrl}:null);
                return(
                  <LinearGradient key={ad.id} colors={ad.bg||['#1a3a6b','#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.adSlide,{width:bannerW}]}>
                    {imgSrc?<Image source={imgSrc} style={styles.adBgImg} resizeMode="cover"/>:<Text style={styles.adEmoji}>{ad.emoji}</Text>}
                    <View style={{flex:1,minWidth:0}}>
                      <Text style={styles.adTitle} numberOfLines={1}>{ad.title}</Text>
                      <Text style={styles.adSub} numberOfLines={1}>{ad.sub}</Text>
                    </View>
                    <View style={styles.adBadge}><Text style={styles.adBadgeTxt}>AD</Text></View>
                    <TouchableOpacity style={styles.adEditBtn} onPress={()=>{setEditAd({...ad});setEditAdModal(true);}}>
                      <MaterialIcons name="edit" size={12} color="#fff"/>
                    </TouchableOpacity>
                    <View style={styles.adDotsInner}>
                      {ads.map((_,i)=>(
                        <TouchableOpacity key={i} onPress={()=>{adScrollRef.current?.scrollTo({x:i*bannerW,animated:true});setAdCurrent(i);}}>
                          <View style={[styles.adDot,adCurrent===i&&styles.adDotActive]}/>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </LinearGradient>
                );
              })}
              <TouchableOpacity
                style={[styles.adSlide,{width:bannerW,backgroundColor:'rgba(26,58,107,0.18)',justifyContent:'center',alignItems:'center',gap:8,borderWidth:2,borderColor:'rgba(255,255,255,0.40)',borderStyle:'dashed'}]}
                onPress={()=>{setEditAd({isNew:true,id:Date.now().toString(),title:'',sub:'',image:null,imageUrl:'',emoji:'📢',bg:['#1a3a6b','#2e5fa3']});setEditAdModal(true);}}>
                <MaterialIcons name="add-circle-outline" size={28} color="rgba(26,58,107,0.55)"/>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:12,color:'rgba(26,58,107,0.55)'}}>Add New Ad</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:2}} style={{flexGrow:0}}>
              {TABS.map(tab=>(
                <TouchableOpacity key={tab.key}
                  style={[styles.tabBtn, activeTab===tab.key&&styles.tabBtnActive]}
                  onPress={()=>setActiveTab(tab.key)} activeOpacity={0.80}>
                  <MaterialIcons name={tab.icon} size={13} color={activeTab===tab.key?'#1a3a6b':'rgba(255,255,255,0.80)'}/>
                  <Text style={[styles.tabBtnTxt, activeTab===tab.key&&styles.tabBtnTxtActive]}>{tab.label}</Text>
                  {tab.key==='cashier'&&pendingCount>0&&(
                    <View style={styles.tabBadge}><Text style={styles.tabBadgeTxt}>{pendingCount}</Text></View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Content area — FIX: flex:1 + minHeight:0 + overflow:'hidden' */}
          <View style={styles.contentArea}>
            {renderContent()}
          </View>
        </View>
      </Animated.View>

      <ItemEditModal visible={editItemModal} item={editItem} categories={categories} onSave={handleSaveItem} onClose={()=>setEditItemModal(false)}/>
      <AdEditModal visible={editAdModal} ad={editAd} onSave={handleSaveAd} onClose={()=>setEditAdModal(false)} onDelete={handleDeleteAd}/>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex:1, flexDirection:'column' },
  header: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(26,58,107,0.92)', borderRadius:16, borderWidth:1, borderColor:'rgba(255,255,255,0.18)', shadowColor:'#011f4b', shadowOpacity:0.25, shadowRadius:12, elevation:8 },
  backBtn: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.15)', borderWidth:1, borderColor:'rgba(255,255,255,0.30)', justifyContent:'center', alignItems:'center', flexShrink:0 },
  backIcon: { color:'#fff', fontSize:16, fontWeight:'600', textAlign:'center', lineHeight:20 },
  headerCenter: { flex:1, alignItems:'center', paddingHorizontal:8, minWidth:0 },
  headerH1: { fontFamily:'NotoSerif_700Bold', color:'#fff', textAlign:'center' },
  headerGold: { color:'#c9a84c' },
  visitorTag: { marginTop:2, paddingHorizontal:8, paddingVertical:2, borderRadius:20, backgroundColor:'rgba(255,255,255,0.18)', borderWidth:1, borderColor:'rgba(255,255,255,0.40)', alignSelf:'center' },
  visitorTagText: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'#fff', letterSpacing:1.2, textTransform:'uppercase', lineHeight:13 },
  iconBtn: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.15)', borderWidth:1, borderColor:'rgba(255,255,255,0.30)', justifyContent:'center', alignItems:'center', flexShrink:0 },
  notifBadge: { position:'absolute', top:4, right:4, backgroundColor:'#e74c3c', borderRadius:6, minWidth:14, height:14, alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  notifBadgeTxt: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'#fff' },

  // BODY — FIX: flex:1 + minHeight:0 + overflow:'hidden'
  body: {
    flex:1,
    flexDirection:'row',
    marginTop: Platform.OS==='web'?10:6,
    marginBottom:16,
    minHeight:0,
    overflow:'hidden',
    alignItems:'stretch',
  },

  // LEFT PANEL — FIX: fixed flex ratio, overflow:'hidden', minHeight:0
  leftPanel: {
    flex:1.4,
    flexShrink:0,
    backgroundColor:'rgba(255,255,255,0.22)',
    borderRadius:16,
    marginLeft:10,
    marginRight:0,
    borderWidth:1,
    borderColor:'rgba(255,255,255,0.40)',
    overflow:'hidden',       // ← critical: clips children
    minHeight:0,             // ← critical: allows flex to work correctly
  },

  // RIGHT PANEL — FIX: flex:1 + minHeight:0
  rightPanel: {
    flex:3,
    minWidth:0,
    minHeight:0,
    marginHorizontal:10,
    flexDirection:'column',
    overflow:'hidden',
  },

  adWrapper: {
    height:100,
    flexShrink:0,
    borderRadius:16,
    overflow:'hidden',
    backgroundColor:'rgba(26,58,107,0.15)',
  },
  adSlide: { height:100, flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingBottom:10, gap:12, overflow:'hidden' },
  adBgImg: { position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:16 },
  adEmoji: { fontSize:40, flexShrink:0 },
  adTitle: { fontFamily:'GoogleSans_700Bold', fontSize:15, color:'#fff' },
  adSub:   { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(255,255,255,0.85)' },
  adBadge: { position:'absolute', top:8, right:38, backgroundColor:'rgba(255,255,255,0.25)', borderRadius:4, paddingHorizontal:6, paddingVertical:2 },
  adBadgeTxt: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'#fff', letterSpacing:1 },
  adEditBtn: { position:'absolute', top:6, right:8, backgroundColor:'rgba(0,0,0,0.35)', borderRadius:7, padding:5 },
  adDotsInner: { position:'absolute', bottom:5, left:0, right:0, flexDirection:'row', justifyContent:'center', gap:4 },
  adDot: { width:6, height:6, borderRadius:3, backgroundColor:'rgba(255,255,255,0.40)' },
  adDotActive: { backgroundColor:'#fff', width:16 },

  tabBar: {
    flexShrink:0,
    backgroundColor:'rgba(26,58,107,0.50)',
    borderTopLeftRadius:12,
    borderTopRightRadius:12,
    paddingTop:5,
    paddingHorizontal:4,
    marginTop:8,
    flexDirection:'row',
  },
  tabBtn: { paddingVertical:8, paddingHorizontal:13, borderTopLeftRadius:10, borderTopRightRadius:10, flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(255,255,255,0.10)', marginHorizontal:2 },
  tabBtnActive: { backgroundColor:'#eef2f8' },
  tabBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'rgba(255,255,255,0.80)' },
  tabBtnTxtActive: { color:'#1a3a6b' },
  tabBadge: { backgroundColor:'#e74c3c', borderRadius:7, minWidth:14, height:14, alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  tabBadgeTxt: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'#fff' },

  // CONTENT AREA — FIX: flex:1 + minHeight:0 + overflow:'hidden'
  contentArea: {
    flex:1,
    minHeight:0,
    backgroundColor:'rgba(255,255,255,0.22)',
    borderBottomLeftRadius:16,
    borderBottomRightRadius:16,
    borderTopRightRadius:16,
    borderWidth:1,
    borderColor:'rgba(255,255,255,0.40)',
    overflow:'hidden',
  },
});