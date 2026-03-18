// src/screens/ManageCanteenScreen.js
// CESLA MPC — Manage Canteen (Admin)
// Firebase Firestore connected — real-time sync

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

// ─── WEB SCROLL VIEW ──────────────────────────────────────────────────────────
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = `.cesla-sub-scroll::-webkit-scrollbar{width:7px;display:block!important}.cesla-sub-scroll::-webkit-scrollbar-thumb{background:rgba(1,31,75,0.40);border-radius:4px}.cesla-sub-scroll::-webkit-scrollbar-thumb:hover{background:rgba(1,31,75,0.65)}.cesla-sub-scroll::-webkit-scrollbar-track{background:rgba(255,255,255,0.20);border-radius:4px}.cesla-sub-scroll{scrollbar-width:thin;scrollbar-color:rgba(1,31,75,0.40) rgba(255,255,255,0.20)}`;
  document.head.appendChild(styleEl);
}
const WebScrollView = ({ children, style, contentContainerStyle, ...rest }) => {
  if (Platform.OS !== 'web') {
    return <ScrollView style={style} contentContainerStyle={contentContainerStyle} showsVerticalScrollIndicator {...rest}>{children}</ScrollView>;
  }
  const flat = StyleSheet.flatten(contentContainerStyle) || {};
  const pH = flat.paddingHorizontal !== undefined ? flat.paddingHorizontal : (flat.padding !== undefined ? flat.padding : undefined);
  return (
    <View style={[{ flex:1, minHeight:0, position:'relative', overflow:'hidden' }, style]}>
      <div className="cesla-sub-scroll" style={{
        position:'absolute', top:0, left:0, right:0, bottom:0,
        overflowY:'auto', overflowX:'hidden', display:'flex', flexDirection:'column',
      }}>
        <div style={{
          display:'flex', flexDirection:'column', flexShrink:0,
          width:'100%', boxSizing:'border-box',
          paddingTop:    flat.paddingTop    !== undefined ? `${flat.paddingTop}px`    : (flat.padding !== undefined ? `${flat.padding}px` : undefined),
          paddingBottom: flat.paddingBottom !== undefined ? `${flat.paddingBottom}px` : (flat.padding !== undefined ? `${flat.padding}px` : '12px'),
          paddingLeft:   pH !== undefined ? `${pH}px` : undefined,
          paddingRight:  pH !== undefined ? `${pH}px` : undefined,
          gap:           flat.gap !== undefined ? `${flat.gap}px` : undefined,
        }}>
          {children}
        </div>
      </div>
    </View>
  );
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const emptyItem = () => ({
  id: Date.now().toString(), name:'', cat:'Meals',
  price:'', stock:'', emoji:'🍽️', image:null,
});

const autoEmoji = (name) => {
  const n = name.toLowerCase();
  if (/rice|kanin|sinangag/.test(n))                return '🍚';
  if (/soup|sinigang|tinola|nilaga|broth/.test(n))  return '🍲';
  if (/chicken|manok|inasal/.test(n))               return '🍗';
  if (/pork|lechon|liempo|adobo|sisig/.test(n))     return '🥩';
  if (/fish|isda|bangus|tilapia|tuna/.test(n))      return '🐟';
  if (/egg|itlog/.test(n))                          return '🥚';
  if (/noodle|mami|pancit|pasta|spaghetti/.test(n)) return '🍜';
  if (/bread|pan|sandwich|burger/.test(n))          return '🍞';
  if (/cake|cupcake|pastry|donut/.test(n))          return '🎂';
  if (/cookie|biscuit|cracker/.test(n))             return '🍪';
  if (/candy|chocolate|choco|sweet/.test(n))        return '🍫';
  if (/chips|fries|nacho/.test(n))                  return '🍟';
  if (/juice|calamansi|lemon/.test(n))              return '🧃';
  if (/coffee|kape|latte|cappuccino/.test(n))       return '☕';
  if (/milk|gatas/.test(n))                         return '🥛';
  if (/tea|tsaa/.test(n))                           return '🍵';
  if (/water|tubig/.test(n))                        return '💧';
  if (/soda|softdrink|cola|sprite/.test(n))         return '🥤';
  if (/salad|vegetables|gulay/.test(n))             return '🥗';
  if (/fruit|prutas|banana|apple|mango/.test(n))    return '🍎';
  if (/snack|merienda/.test(n))                     return '🍿';
  if (/pizza/.test(n))                              return '🍕';
  if (/hotdog|sausage|longganisa/.test(n))          return '🌭';
  if (/ice cream|gelato|frozen/.test(n))            return '🍦';
  return '📦';
};

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

  const handleNameChange = (v) => {
    setForm(f => ({ ...f, name: v, emoji: f.image ? f.emoji : autoEmoji(v) }));
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
        <View style={ms.modalWrapper}>
          <View style={ms.modalCard}>
            <Text style={ms.modalTitle}>{item?.name ? 'Edit Item' : 'Add New Item'}</Text>
            <View style={{ flexDirection:'row', gap:12, alignItems:'flex-start' }}>
              <View style={{ alignItems:'center', gap:4 }}>
                <TouchableOpacity style={ms.imgPicker} onPress={pickImage}>
                  {form.image
                    ? <Image source={{uri:form.image}} style={ms.imgPreview}/>
                    : <View style={{alignItems:'center',gap:2}}><Text style={{fontSize:32}}>{form.emoji}</Text><Text style={ms.imgHint}>Upload</Text></View>
                  }
                  <View style={ms.imgBadge}><MaterialIcons name="photo-camera" size={12} color="#fff"/></View>
                </TouchableOpacity>
                {form.image && <TouchableOpacity onPress={()=>setForm(f=>({...f,image:null}))}><Text style={{fontFamily:'GoogleSans_400Regular',fontSize:10,color:'#e74c3c'}}>✕ Remove</Text></TouchableOpacity>}
                {!form.image && (
                  <View style={{alignItems:'center',gap:2}}>
                    <Text style={[ms.fieldLabel,{textAlign:'center'}]}>Emoji</Text>
                    <TextInput style={[ms.input,{textAlign:'center',fontSize:20,width:56,paddingVertical:6}]} value={form.emoji} onChangeText={v=>setForm(f=>({...f,emoji:v}))} placeholder="📦"/>
                  </View>
                )}
              </View>
              <View style={{flex:1, gap:8}}>
                <View style={ms.fieldRow}>
                  <Text style={ms.fieldLabel}>Item Name *</Text>
                  <TextInput style={ms.input} value={form.name} onChangeText={handleNameChange} placeholder="e.g. Fried Chicken"/>
                </View>
                <View style={ms.fieldRow}>
                  <Text style={ms.fieldLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:4}}>
                    <View style={{flexDirection:'row',gap:5}}>
                      {categories.filter(c=>c!=='All').map(cat=>(
                        <TouchableOpacity key={cat} style={[ms.chip,form.cat===cat&&ms.chipActive]} onPress={()=>setForm(f=>({...f,cat}))}>
                          <Text style={[ms.chipTxt,form.cat===cat&&ms.chipTxtActive]}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={{flexDirection:'row',gap:8}}>
                  <View style={[ms.fieldRow,{flex:1}]}><Text style={ms.fieldLabel}>Price (₱) *</Text><TextInput style={ms.input} value={form.price} onChangeText={v=>setForm(f=>({...f,price:v}))} keyboardType="numeric" placeholder="0.00"/></View>
                  <View style={[ms.fieldRow,{flex:1}]}><Text style={ms.fieldLabel}>Stock *</Text><TextInput style={ms.input} value={form.stock} onChangeText={v=>setForm(f=>({...f,stock:v}))} keyboardType="numeric" placeholder="0"/></View>
                </View>
              </View>
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
        </View>
      </View>
    </Modal>
  );
};

// ─── AD EDIT MODAL ────────────────────────────────────────────────────────────
const AdEditModal = ({ visible, ad, onSave, onClose, onDelete }) => {
  const [form, setForm] = useState(ad || {});
  useEffect(() => { if (ad) setForm(ad); }, [ad]);

  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 5], quality: 0.6,
      base64: true, // ← get base64 directly
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      // Use base64 string as imageUrl — works across all devices
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const base64url = `data:${mime};base64,${asset.base64}`;
      setForm(f => ({ ...f, imageUrl: base64url, image: null }));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1}/>
        <View style={[ms.modalCard,{maxWidth:420,alignSelf:'center',width:'90%'}]}>
          <Text style={ms.modalTitle}>{ad?.isNew ? 'Add New Ad' : 'Edit Ad Banner'}</Text>
          <TouchableOpacity style={[ms.imgPicker,{width:'100%',height:80,borderRadius:12}]} onPress={pickImage}>
            {(form.image || form.imageUrl)
              ? <Image source={{uri: form.image || form.imageUrl}} style={{width:'100%',height:80,borderRadius:12}} resizeMode="cover"/>
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
            <TouchableOpacity style={{flex:2,borderRadius:10,overflow:'hidden'}} onPress={()=>onSave(form)} disabled={uploading}>
              <LinearGradient colors={['#1a3a6b','#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:0}} style={{paddingVertical:11,alignItems:'center'}}>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#fff'}}>{uploading ? 'Saving...' : 'Save Ad'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ms = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(1,20,50,0.55)', justifyContent:'center', alignItems:'center', padding:20 },
  modalWrapper: { width:'100%', maxWidth:540 },
  modalCard: { backgroundColor:'#f0f5f9', borderRadius:20, padding:18, gap:12, shadowColor:'#000', shadowOpacity:0.25, shadowRadius:20, elevation:12 },
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
const CashierScreen = ({ items, categories, addOrder, deductStock, isWide: csIsWide }) => {
  const [activeCat, setActiveCat]  = useState('All');
  const [search,    setSearch]     = useState('');
  const [cart,      setCart]       = useState({});
  const [amountPaid,setAmountPaid] = useState('');
  const [receiptVisible,setReceiptVisible] = useState(false);
  const [lastOrder, setLastOrder]  = useState(null);
  const [cartCollapsed, setCartCollapsed] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Animate bottom sheet when cart opens
  const openCart = () => {
    setCartCollapsed(false);
    Animated.spring(slideAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }).start();
  };
  const closeCart = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setCartCollapsed(true));
  };

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

  // ── FIX: async — awaits Firestore writes ──────────────────────────────────
  const handlePlaceOrder = async () => {
    if(cartItems.length===0) return;
    if(paid<total){ Alert.alert('Insufficient Amount','Please enter the correct amount paid.'); return; }
    const orderNo=Math.floor(1000+Math.random()*9000);
    const now=new Date();
    const time=now.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})+'  '+now.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});
    const order={id:Date.now().toString(),orderNo,time,items:cartItems,total,amountPaid:paid,change,payment:'cash',status:'pending',source:'cashier'};
    await addOrder(order);
    await deductStock(cartItems);
    setLastOrder(order);
    clearCart();
    setTimeout(()=>setReceiptVisible(true),200);
  };

  const COLS = csIsWide ? 6 : 3;

  return (
    <View style={{flex:1,flexDirection: csIsWide ? 'row' : 'column',minHeight:0,overflow:'hidden'}}>
      {/* Items side */}
      <View style={{flex:1,minHeight:0,minWidth:0,flexDirection:'column',overflow:'hidden'}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:6}} contentContainerStyle={{paddingHorizontal:10,gap:5,paddingVertical:4}}>
          {categories.map(cat=>(
            <TouchableOpacity key={cat} style={[cs.catTab,activeCat===cat&&cs.catTabActive]} onPress={()=>setActiveCat(cat)}>
              <Text style={[cs.catTabTxt,activeCat===cat&&cs.catTabTxtActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={cs.searchRow}>
          <Text style={{fontSize:12,marginRight:5}}>🔍</Text>
          <TextInput style={cs.searchInput} placeholder="Search items..." placeholderTextColor="rgba(1,31,75,0.35)" value={search} onChangeText={setSearch}/>
          {search.length>0&&<TouchableOpacity onPress={()=>setSearch('')}><Text style={{color:'rgba(1,31,75,0.40)',fontWeight:'700'}}>✕</Text></TouchableOpacity>}
        </View>
        <WebScrollView style={{flex:1}} contentContainerStyle={{paddingTop:10,paddingHorizontal:12,paddingBottom:20,gap:8}}>
          {Array.from({length:Math.ceil(filtered.length/COLS)},(_,rowIdx)=>(
            <View key={rowIdx} style={{flexDirection:'row',gap:8,alignItems:'stretch'}}>
              {filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).map(item=>(
                <View key={item.id} style={{flex:1,alignSelf:'stretch'}}>
                <TouchableOpacity style={[cs.itemCard,item.stock===0&&{opacity:0.45},{flex:1}]} onPress={()=>item.stock>0&&addToCart(item)} activeOpacity={item.stock>0?0.75:1}>
                  <View style={cs.itemImgCircle}>
                    {item.image?<Image source={{uri:item.image}} style={{width:'100%',height:'100%',borderRadius:99}} resizeMode="cover"/>:<Text style={cs.itemEmoji}>{item.emoji}</Text>}
                  </View>
                  <Text style={cs.itemCardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={cs.itemCardPrice}>₱{item.price}</Text>
                  <Text style={cs.itemCardStock}>{item.stock===0?'Out of stock':`Stock: ${item.stock}`}</Text>
                  {cart[item.id]&&<View style={cs.cartBadge}><Text style={cs.cartBadgeTxt}>{cart[item.id].qty}</Text></View>}
                </TouchableOpacity>
                </View>
              ))}
              {Array.from({length:COLS-filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).length}).map((_,i)=>(<View key={`e-${i}`} style={{flex:1}}/>))}
            </View>
          ))}
        </WebScrollView>
      </View>

      {/* Wide: side panel cart */}
      {csIsWide && (
        <View style={cs.cartPanel}>
          <Text style={cs.cartTitle}>🛒 CART {cartItems.length > 0 ? `(${cartItems.length})` : ''}</Text>
        <View style={cs.cartItemsBox}>
          {cartItems.length===0
            ? <Text style={cs.cartEmpty}>No items added yet</Text>
            : <WebScrollView style={{flex:1}}>
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
              </WebScrollView>
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
      )}

      {/* Mobile: floating pill + animated bottom sheet (same as CanteenVisitor) */}
      {!csIsWide && (
        <>
          {/* Floating gold pill button */}
          <TouchableOpacity
            style={cs.floatCart}
            onPress={openCart}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#c9a84c','#e8c87a']}
              start={{x:0,y:0}} end={{x:1,y:0}}
              style={cs.floatCartGrad}
            >
              <Text style={cs.floatCartTxt}>
                🛒  View Cart  {cartItems.length > 0 ? `(${cartItems.length})` : ''}  •  ₱{total.toFixed(2)}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Bottom sheet with slide animation */}
          {!cartCollapsed && (
            <View style={cs.sheetOverlay}>
              <TouchableOpacity style={cs.sheetBackdrop} onPress={closeCart} activeOpacity={1} />
              <Animated.View style={[cs.sheet, { transform: [{ translateY: slideAnim.interpolate({ inputRange:[0,1], outputRange:[600,0] }) }] }]}>
                <View style={cs.sheetHandle} />
                <View style={cs.sheetHeader}>
                  <Text style={cs.cartTitle}>🛒 CART {cartItems.length > 0 ? `(${cartItems.length})` : ''}</Text>
                  <TouchableOpacity onPress={closeCart} style={cs.sheetClose}>
                    <Text style={{ color:'rgba(1,31,75,0.6)', fontSize:14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1}}>
                  <View style={{ padding: 12, gap: 8 }}>
        <View style={cs.cartItemsBox}>
          {cartItems.length===0
            ? <Text style={cs.cartEmpty}>No items added yet</Text>
            : <WebScrollView style={{flex:1}}>
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
              </WebScrollView>
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
                </ScrollView>
              </Animated.View>
            </View>
          )}
        </>
      )}

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
  searchRow: { flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.70)',borderRadius:8,paddingHorizontal:10,paddingVertical:7,marginHorizontal:8,marginBottom:4,borderWidth:1,borderColor:'rgba(255,255,255,0.90)' },
  searchInput: { flex:1,fontFamily:'GoogleSans_400Regular',fontSize:12,color:'#011f4b',paddingVertical:0 },
  itemCard: { flex:1,alignSelf:'stretch',backgroundColor:'rgba(255,255,255,0.70)',borderRadius:12,padding:8,alignItems:'center',justifyContent:'space-between',gap:3,borderWidth:1,borderColor:'rgba(255,255,255,0.85)',position:'relative',minHeight:140 },
  itemImgCircle: { width:52,height:52,borderRadius:26,backgroundColor:'rgba(240,246,252,0.90)',justifyContent:'center',alignItems:'center',overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.80)',flexShrink:0 },
  itemEmoji: { fontSize:24 },
  itemCardName: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#1a2d4e',textAlign:'center',lineHeight:14,minHeight:28,width:'100%' },
  itemCardPrice: { fontFamily:'NotoSerif_700Bold',fontSize:14,color:'#c9a84c' },
  itemCardStock: { fontFamily:'GoogleSans_400Regular',fontSize:8,color:'rgba(1,31,75,0.45)' },
  cartBadge: { position:'absolute',top:4,right:4,backgroundColor:'#e74c3c',borderRadius:8,width:16,height:16,justifyContent:'center',alignItems:'center' },
  cartBadgeTxt: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'#fff' },
  cartPanel: { width:240,flexShrink:0,backgroundColor:'rgba(255,255,255,0.22)',borderLeftWidth:1,borderColor:'rgba(255,255,255,0.40)',padding:10,gap:6,minHeight:0,overflow:'hidden' },
  cartTitle: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'rgba(1,31,75,0.65)',letterSpacing:2,paddingBottom:6,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.10)' },
  cartItemsBox: { flex:1,minHeight:50,backgroundColor:'rgba(255,255,255,0.40)',borderRadius:10,padding:8,borderWidth:1,borderColor:'rgba(255,255,255,0.65)',overflow:'hidden' },
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
  // Floating cart + bottom sheet (same as CanteenVisitor)
  floatCart: { position:'absolute', bottom:24, left:0, right:0, alignItems:'center', zIndex:50 },
  floatCartGrad: { borderRadius:30, paddingVertical:11, paddingHorizontal:32, alignItems:'center' },
  floatCartTxt: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#0d1b3e', fontWeight:'700' },
  sheetOverlay: { position:'absolute', top:0, left:0, right:0, bottom:0, justifyContent:'flex-end', zIndex:100 },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(1,20,50,0.45)' },
  sheet: { backgroundColor:'#f0f5f9', borderTopLeftRadius:24, borderTopRightRadius:24, paddingBottom:34, maxHeight:'92%', shadowColor:'#000', shadowOpacity:0.35, shadowRadius:20, shadowOffset:{width:0,height:-4}, elevation:20 },
  sheetHandle: { width:40, height:4, borderRadius:2, backgroundColor:'rgba(1,31,75,0.20)', alignSelf:'center', marginTop:10, marginBottom:6 },
  sheetHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:10, borderBottomWidth:1, borderColor:'rgba(1,31,75,0.10)' },
  sheetClose: { width:30, height:30, borderRadius:15, backgroundColor:'rgba(1,31,75,0.08)', justifyContent:'center', alignItems:'center' },
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
const ManageMenuScreen = ({ items, categories, filtered, search, activeCategory, onSearch, onCategoryChange, onAddItem, onEditItem, onDeleteItem, isWide: mmIsWide }) => {
  const COLS = mmIsWide ? 6 : 3;
  return (
    <View style={{flex:1,minHeight:0,flexDirection:'column',overflow:'hidden'}}>

      {/* ── Category tabs — horizontal scroll (same as Merchandise) ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.12)' }}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6, gap: 5 }}>
        {categories.map(cat => (
          <TouchableOpacity key={cat}
            style={[mm.catTabH, activeCategory === cat && mm.catTabHActive]}
            onPress={() => onCategoryChange(cat)}>
            <Text style={[mm.catTabHTxt, activeCategory === cat && mm.catTabHTxtActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{flex:1,minHeight:0,minWidth:0,overflow:'hidden'}}>
        <View style={mm.headerRow}>
          <Text style={mm.headerLbl} numberOfLines={1}>
            {search.trim()?`RESULTS FOR "${search.toUpperCase()}"`:activeCategory==='All'?'ALL ITEMS':activeCategory.toUpperCase()}
          </Text>
          <View style={mm.searchBox}>
            <Text style={{fontSize:11,marginRight:4}}>🔍</Text>
            <TextInput style={mm.searchInput} placeholder="Search..." placeholderTextColor="rgba(1,31,75,0.35)" value={search} onChangeText={onSearch}/>
            {search.length>0&&<TouchableOpacity onPress={()=>onSearch('')}><Text style={{color:'rgba(1,31,75,0.45)',fontWeight:'700',fontSize:12}}>✕</Text></TouchableOpacity>}
          </View>
          <TouchableOpacity style={mm.addBtn} onPress={onAddItem}>
            <MaterialIcons name="add" size={15} color="#fff"/>
            <Text style={mm.addBtnTxt}>Add Item</Text>
          </TouchableOpacity>
        </View>
        <View style={{height:1,backgroundColor:'rgba(1,31,75,0.10)',marginBottom:8,marginHorizontal:8}}/>
        <WebScrollView style={{flex:1}} contentContainerStyle={{paddingTop:10,paddingHorizontal:12,paddingBottom:20,gap:8}}>
          {filtered.length===0
            ? <Text style={mm.emptyTxt}>No items found.</Text>
            : Array.from({length:Math.ceil(filtered.length/COLS)},(_,rowIdx)=>(
              <View key={rowIdx} style={{flexDirection:'row',gap:8,alignItems:'stretch'}}>
                {filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).map(item=>(
                  <View key={item.id} style={{flex:1,minWidth:0,alignSelf:'stretch'}}>
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
        </WebScrollView>
      </View>
    </View>
  );
};

const mm = StyleSheet.create({
  catPanel: { width:130,flexShrink:0,backgroundColor:'rgba(255,255,255,0.20)',borderRightWidth:1,borderColor:'rgba(255,255,255,0.40)',padding:10 },
  catTitle: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'rgba(1,31,75,0.50)',letterSpacing:2,textTransform:'uppercase',marginBottom:6,paddingBottom:6,borderBottomWidth:1,borderColor:'rgba(1,31,75,0.10)' },
  catBtn: { paddingVertical:8,paddingHorizontal:10,borderRadius:8,marginBottom:2 },
  catBtnActive: { backgroundColor:'rgba(26,58,107,0.18)' },
  catBtnTxt: { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(1,31,75,0.60)' },
  catBtnTxtActive: { fontFamily:'GoogleSans_700Bold',color:'#1a3a6b' },
  // Horizontal tab style (same as Merchandise)
  catTabH: { paddingVertical:7, paddingHorizontal:14, borderRadius:16, backgroundColor:'rgba(255,255,255,0.35)', borderWidth:1, borderColor:'rgba(255,255,255,0.55)', alignItems:'center', justifyContent:'center' },
  catTabHActive: { backgroundColor:'#304674', borderColor:'#c9a84c' },
  catTabHTxt: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'rgba(1,31,75,0.70)' },
  catTabHTxtActive: { color:'#fff' },
  headerRow: { flexDirection:'row',alignItems:'center',gap:8,padding:8,paddingBottom:0 },
  headerLbl: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#011f4b',letterSpacing:2,flexShrink:0 },
  searchBox: { flex:1,flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.75)',borderRadius:8,paddingHorizontal:8,paddingVertical:5,borderWidth:1,borderColor:'rgba(255,255,255,0.90)' },
  searchInput: { flex:1,fontFamily:'GoogleSans_400Regular',fontSize:11,color:'#011f4b',paddingVertical:0 },
  addBtn: { flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#1a3a6b',borderRadius:8,paddingVertical:6,paddingHorizontal:10 },
  addBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#fff' },
  emptyTxt: { fontFamily:'GoogleSans_400Regular',fontSize:13,color:'rgba(1,31,75,0.40)',textAlign:'center',marginTop:30 },
  foodCard: { borderRadius:12,overflow:'hidden',flex:1,alignSelf:'stretch' },
  foodCardInner: { borderRadius:12,padding:9,borderWidth:1.5,borderColor:'rgba(255,255,255,0.75)',alignItems:'center',gap:2,flex:1,justifyContent:'space-between',position:'relative',minHeight:145 },
  adminBtns: { position:'absolute',top:4,right:4,flexDirection:'row',gap:3,zIndex:10 },
  editBtn: { backgroundColor:'rgba(26,58,107,0.12)',borderRadius:6,padding:4,borderWidth:1,borderColor:'rgba(26,58,107,0.20)' },
  delBtn: { backgroundColor:'rgba(231,76,60,0.10)',borderRadius:6,padding:4,borderWidth:1,borderColor:'rgba(231,76,60,0.20)' },
  emojiCircle: { width:46,height:46,borderRadius:23,backgroundColor:'rgba(240,246,252,0.90)',borderWidth:1.5,borderColor:'rgba(255,255,255,0.85)',justifyContent:'center',alignItems:'center',overflow:'hidden',flexShrink:0 },
  emojiTxt: { fontSize:22 },
  itemName: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'#1a2d4e',textAlign:'center',lineHeight:12,minHeight:24,alignSelf:'stretch' },
  itemStock: { fontFamily:'GoogleSans_400Regular',fontSize:8,color:'rgba(1,31,75,0.45)' },
  itemPrice: { fontFamily:'NotoSerif_700Bold',fontSize:12,color:'#c9a84c' },
  editItemBtn: { backgroundColor:'#1a3a6b',borderRadius:6,paddingVertical:5,paddingHorizontal:4,alignItems:'center',width:'100%' },
  editItemBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'#fff' },
});

// ─── INVENTORY, HISTORY, CREDITS, REPORT — unchanged from original ────────────
// (These screens have no order-writing logic, only reads — no changes needed)

const InventoryScreen = ({ items, maxQtyMap, onAddItem, onEditItem }) => {
  const today = new Date();
  const formatDateLabel = (d) => {
    const now = new Date();
    const todayKey = now.toDateString();
    const yestKey  = new Date(now - 86400000).toDateString();
    const opts = { month: 'long', day: 'numeric', year: 'numeric' };
    if (d.toDateString() === todayKey) return "Today's Stocks, " + d.toLocaleDateString('en-PH', opts);
    if (d.toDateString() === yestKey)  return "Yesterday's Stocks, " + d.toLocaleDateString('en-PH', opts);
    return "Stocks — " + d.toLocaleDateString('en-PH', opts);
  };
  const [selectedDate, setSelectedDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const calDays = (() => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const days  = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    return cells;
  })();
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const getMax = (id) => (maxQtyMap && maxQtyMap[id] !== undefined) ? maxQtyMap[id] : (items.find(i=>i.id===id)?.maxQty || 50);
  const overallPrice = items.reduce((s, i) => s + i.price, 0);
  const overallQty   = items.reduce((s, i) => s + i.stock, 0);
  const grandTotal   = items.reduce((s, i) => s + i.price * i.stock, 0);

  return (
    <View style={{ flex:1, minHeight:0, overflow:'hidden', position:'relative' }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginHorizontal:14, marginTop:8, marginBottom:6 }}>
        <TouchableOpacity style={inv2.titleRow} onPress={() => setShowDatePicker(p => !p)} activeOpacity={0.80}>
          <Text style={inv2.titleText}>{formatDateLabel(selectedDate)}</Text>
          <Text style={inv2.titleCaret}>{showDatePicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={inv2.addItemBtn} onPress={() => onAddItem && onAddItem()} activeOpacity={0.80}>
          <Text style={inv2.addItemBtnTxt}>+ Add Item</Text>
        </TouchableOpacity>
      </View>
      {showDatePicker && (
        <View style={inv2.calCard}>
          <View style={inv2.calNav}>
            <TouchableOpacity style={inv2.calNavBtn} onPress={() => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); }}><Text style={inv2.calNavTxt}>‹</Text></TouchableOpacity>
            <Text style={inv2.calMonthLbl}>{MONTHS[calMonth]} {calYear}</Text>
            <TouchableOpacity style={inv2.calNavBtn} onPress={() => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); }}><Text style={inv2.calNavTxt}>›</Text></TouchableOpacity>
          </View>
          <View style={inv2.calDaysRow}>{DAYS.map(d=><Text key={d} style={inv2.calDayHdr}>{d}</Text>)}</View>
          <View style={inv2.calGrid}>
            {calDays.map((day,idx)=>{
              if(!day) return <View key={'e'+idx} style={inv2.calCell}/>;
              const thisDate=new Date(calYear,calMonth,day);
              const isSelected=thisDate.toDateString()===selectedDate.toDateString();
              const isToday=thisDate.toDateString()===today.toDateString();
              return(
                <TouchableOpacity key={idx} style={[inv2.calCell,isSelected&&inv2.calCellSel,isToday&&!isSelected&&inv2.calCellToday]}
                  onPress={()=>{setSelectedDate(new Date(calYear,calMonth,day));setShowDatePicker(false);}}>
                  <Text style={[inv2.calCellTxt,isSelected&&inv2.calCellTxtSel]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
      <View style={inv2.tableWrap}>
        <View style={inv2.thead}>
          <Text style={[inv2.th,inv2.colName]}>ITEM NAME</Text>
          <Text style={[inv2.th,inv2.colCat]}>CATEGORY</Text>
          <Text style={[inv2.th,inv2.colQty]}>QTY</Text>
          <Text style={[inv2.th,inv2.colMaxQty]}>MAX QTY</Text>
          <Text style={[inv2.th,inv2.colPrice]}>PRICE</Text>
          <Text style={[inv2.th,inv2.colValue]}>VALUE</Text>
          <Text style={[inv2.th,inv2.colRestock]}>RE-STOCK</Text>
        </View>
        <WebScrollView style={{flex:1}} contentContainerStyle={{gap:0}}>
          {items.map((item,idx)=>{
            const max=getMax(item.id);
            const restock=Math.max(0,max-item.stock);
            return(
              <TouchableOpacity key={item.id} style={[inv2.trow,idx%2===0&&inv2.trowAlt]} onPress={()=>onEditItem&&onEditItem(item)} activeOpacity={0.75}>
                <View style={[inv2.td,inv2.colName]}><Text style={inv2.tdName} numberOfLines={1}>{item.emoji}  {item.name}</Text></View>
                <View style={[inv2.td,inv2.colCat]}><Text style={inv2.tdMuted} numberOfLines={1}>{item.cat}</Text></View>
                <View style={[inv2.td,inv2.colQty]}><Text style={[inv2.tdNum,item.stock===0&&{color:'#e74c3c',fontFamily:'GoogleSans_700Bold'},item.stock<=5&&item.stock>0&&{color:'#b85c00',fontFamily:'GoogleSans_700Bold'}]}>{item.stock}</Text></View>
                <View style={[inv2.td,inv2.colMaxQty]}><Text style={[inv2.tdNum,{textAlign:'center'}]}>{getMax(item.id)}</Text></View>
                <View style={[inv2.td,inv2.colPrice]}><Text style={inv2.tdNum}>₱{item.price.toLocaleString()}</Text></View>
                <View style={[inv2.td,inv2.colValue]}><Text style={[inv2.tdNum,{color:'#1a3a6b',fontFamily:'GoogleSans_700Bold'}]}>₱{(item.price*item.stock).toLocaleString()}</Text></View>
                <View style={[inv2.td,inv2.colRestock]}>
                  {restock>0?(<View style={inv2.restockBadge}><Text style={inv2.restockNeed}>Need {restock}</Text><Text style={inv2.restockSub}>({item.stock}/{max})</Text></View>):(<Text style={inv2.restockOk}>✓ OK</Text>)}
                </View>
              </TouchableOpacity>
            );
          })}
        </WebScrollView>
        <View style={inv2.tfooter}>
          <View style={[inv2.td,inv2.colName]}><Text style={inv2.tfootLbl}>TOTALS</Text></View>
          <View style={[inv2.td,inv2.colCat]}/>
          <View style={[inv2.td,inv2.colQty]}><Text style={[inv2.tfootVal,{textAlign:'center'}]}>{overallQty}</Text></View>
          <View style={[inv2.td,inv2.colMaxQty]}/>
          <View style={[inv2.td,inv2.colPrice]}><Text style={[inv2.tfootVal,{textAlign:'center'}]}>₱{overallPrice.toLocaleString()}</Text></View>
          <View style={[inv2.td,inv2.colValue]}><Text style={[inv2.tfootVal,{color:'#8a6500',textAlign:'center'}]}>₱{grandTotal.toLocaleString()}</Text></View>
          <View style={[inv2.td,inv2.colRestock]}/>
        </View>
      </View>
    </View>
  );
};

const inv2 = StyleSheet.create({
  titleRow: { flexDirection:'row',alignItems:'center',gap:6,paddingVertical:6,paddingHorizontal:12,backgroundColor:'rgba(26,58,107,0.10)',borderRadius:8,borderWidth:1,borderColor:'rgba(26,58,107,0.15)',alignSelf:'flex-start' },
  titleText: { fontFamily:'NotoSerif_700Bold',fontSize:12,color:'#1a3a6b' },
  titleCaret: { fontSize:10,color:'rgba(26,58,107,0.50)' },
  addItemBtn: { backgroundColor:'#1a3a6b',borderRadius:8,paddingVertical:7,paddingHorizontal:14,borderWidth:1,borderColor:'rgba(201,168,76,0.40)' },
  addItemBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#fff',letterSpacing:0.3 },
  calCard: { position:'absolute',top:52,left:14,zIndex:999,backgroundColor:'rgba(255,255,255,0.98)',borderRadius:10,borderWidth:1,borderColor:'rgba(26,58,107,0.18)',padding:8,shadowColor:'#000',shadowOpacity:0.18,shadowRadius:12,elevation:20,minWidth:220,maxWidth:260 },
  calNav: { flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:4 },
  calNavBtn: { width:22,height:22,borderRadius:11,backgroundColor:'rgba(26,58,107,0.08)',justifyContent:'center',alignItems:'center' },
  calNavTxt: { fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#1a3a6b' },
  calMonthLbl: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#1a3a6b' },
  calDaysRow: { flexDirection:'row',marginBottom:2 },
  calDayHdr: { flex:1,fontFamily:'GoogleSans_700Bold',fontSize:8,color:'rgba(26,58,107,0.45)',textAlign:'center',letterSpacing:0.3 },
  calGrid: { flexDirection:'row',flexWrap:'wrap' },
  calCell: { width:'14.28%',height:24,justifyContent:'center',alignItems:'center',borderRadius:4 },
  calCellSel: { backgroundColor:'#1a3a6b' },
  calCellToday: { backgroundColor:'rgba(201,168,76,0.20)',borderWidth:1,borderColor:'#c9a84c' },
  calCellTxt: { fontFamily:'GoogleSans_400Regular',fontSize:9,color:'#1a3a6b' },
  calCellTxtSel: { fontFamily:'GoogleSans_700Bold',color:'#fff' },
  tableWrap: { flex:1,minHeight:0,marginHorizontal:14,marginBottom:10 },
  thead: { flexDirection:'row',alignItems:'center',backgroundColor:'rgba(26,58,107,0.14)',borderRadius:8,paddingVertical:9,paddingHorizontal:8,marginBottom:2 },
  th: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'rgba(26,58,107,0.60)',letterSpacing:0.8,textTransform:'uppercase',textAlign:'center',borderRightWidth:1,borderColor:'rgba(26,58,107,0.10)',paddingHorizontal:4 },
  trow: { flexDirection:'row',alignItems:'center',paddingVertical:8,paddingHorizontal:8,minHeight:42,borderBottomWidth:1,borderColor:'rgba(26,58,107,0.07)' },
  trowAlt: { backgroundColor:'rgba(255,255,255,0.38)' },
  td: { justifyContent:'center',alignItems:'center',paddingHorizontal:4,borderRightWidth:1,borderColor:'rgba(26,58,107,0.10)' },
  colName:    { flex:2.2,minWidth:0,alignItems:'flex-start' },
  colCat:     { flex:1.1,minWidth:0,alignItems:'center' },
  colQty:     { flex:0.6,minWidth:0,alignItems:'center' },
  colMaxQty:  { flex:0.8,minWidth:0,alignItems:'center' },
  colPrice:   { flex:0.9,minWidth:0,alignItems:'center' },
  colValue:   { flex:1.0,minWidth:0,alignItems:'center' },
  colRestock: { flex:1.0,minWidth:0,alignItems:'center' },
  tdName:  { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#1a2d4e' },
  tdMuted: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(26,58,107,0.65)',textAlign:'center' },
  tdNum:   { fontFamily:'GoogleSans_500Medium',fontSize:11,color:'#1a2d4e',textAlign:'center' },
  restockBadge: { alignItems:'center' },
  restockNeed: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#b85c00' },
  restockSub:  { fontFamily:'GoogleSans_400Regular',fontSize:9,color:'rgba(26,58,107,0.45)' },
  restockOk:   { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#1a7a45' },
  tfooter: { flexDirection:'row',alignItems:'center',paddingVertical:10,paddingHorizontal:8,backgroundColor:'rgba(26,58,107,0.10)',borderRadius:6,marginTop:4,borderTopWidth:1.5,borderColor:'rgba(26,58,107,0.18)' },
  tfootLbl: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#1a3a6b',letterSpacing:0.5 },
  tfootVal: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#1a3a6b',textAlign:'center',letterSpacing:0.2 },
  maxQtyInput: { width:44,textAlign:'center',fontFamily:'GoogleSans_500Medium',fontSize:11,color:'#1a3a6b',backgroundColor:'rgba(255,255,255,0.80)',borderRadius:6,borderWidth:1,borderColor:'rgba(26,58,107,0.20)',paddingVertical:3,paddingHorizontal:4 },
  unitChip: { flexDirection:'row',alignItems:'center',gap:2,backgroundColor:'rgba(26,58,107,0.08)',borderRadius:6,paddingHorizontal:7,paddingVertical:4,borderWidth:1,borderColor:'rgba(26,58,107,0.15)' },
  unitChipTxt: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#1a3a6b' },
  unitChipArr: { fontSize:8,color:'rgba(26,58,107,0.45)' },
  unitMenu: { position:'absolute',top:26,left:0,backgroundColor:'#fff',borderRadius:8,borderWidth:1,borderColor:'rgba(26,58,107,0.18)',shadowColor:'#000',shadowOpacity:0.14,shadowRadius:8,elevation:12,minWidth:64,zIndex:999 },
  unitOpt: { paddingVertical:7,paddingHorizontal:10 },
  unitOptActive: { backgroundColor:'rgba(26,58,107,0.08)' },
  unitOptTxt: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'#1a3a6b' },
  unitOptTxtActive: { fontFamily:'GoogleSans_700Bold',color:'#1a3a6b' },
});

const OrderHistoryScreen = ({ orders }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const todayCal = new Date();
  const [calMonth, setCalMonth] = useState(todayCal.getMonth());
  const [calYear,  setCalYear]  = useState(todayCal.getFullYear());
  const HST_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const HST_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const calDays = (() => {
    const first=new Date(calYear,calMonth,1).getDay();
    const dim=new Date(calYear,calMonth+1,0).getDate();
    const cells=[];
    for(let i=0;i<first;i++)cells.push(null);
    for(let d=1;d<=dim;d++)cells.push(d);
    return cells;
  })();
  const parseOrderDate = (timeStr) => {
    if(!timeStr) return null;
    try{ const d=new Date(timeStr); if(!isNaN(d.getTime()))return d; const d2=new Date(timeStr.replace(/\s+/g,' ').trim()); return isNaN(d2.getTime())?null:d2; }catch{return null;}
  };
  const dateKey=(d)=>{if(!d)return'unknown';return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const todayKey=dateKey(new Date());
  const formatLabel=(key)=>{
    if(!key||key==='unknown')return'Unknown Date';
    const[y,m,day]=key.split('-');
    const d=new Date(Number(y),Number(m)-1,Number(day));
    if(key===todayKey)return`Today, ${d.toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}`;
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    if(key===dateKey(yesterday))return`Yesterday, ${d.toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}`;
    return d.toLocaleDateString('en-PH',{weekday:'short',month:'long',day:'numeric',year:'numeric'});
  };
  const grouped=React.useMemo(()=>{
    const map={};
    [...orders].forEach(o=>{const d=parseOrderDate(o.time);const k=dateKey(d);if(!map[k])map[k]={key:k,date:d,orders:[]};map[k].orders.push(o);});
    Object.values(map).forEach(g=>g.orders.sort((a,b)=>(parseOrderDate(b.time)?.getTime()||0)-(parseOrderDate(a.time)?.getTime()||0)));
    return Object.values(map).sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0));
  },[orders]);
  React.useEffect(()=>{const tg=grouped.find(g=>g.key===todayKey);setSelectedDate(tg?todayKey:(grouped[0]?.key||null));},[grouped.length]);
  const selectedGroup=grouped.find(g=>g.key===selectedDate);
  const displayOrders=selectedGroup?.orders||[];
  const dayTotal=displayOrders.reduce((s,o)=>s+Number(o.total),0);

  return(
    <View style={[sub.root,{position:'relative'}]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:6}}>
        <TouchableOpacity style={hst.calTrigger} onPress={()=>setShowCalendar(p=>!p)} activeOpacity={0.80}>
          <Text style={hst.calTriggerTxt}>{formatLabel(selectedDate)}</Text>
          <Text style={hst.calTriggerCaret}>{showCalendar?'▲':'▼'}</Text>
        </TouchableOpacity>
        <Text style={hst.txHeaderSub}>{displayOrders.length} order{displayOrders.length!==1?'s':''}{'  ·  '}<Text style={{color:'#c9a84c',fontFamily:'GoogleSans_700Bold'}}>₱{dayTotal.toFixed(2)}</Text></Text>
      </View>
      {showCalendar&&(
        <View style={hst.calCard}>
          <View style={inv2.calNav}>
            <TouchableOpacity style={inv2.calNavBtn} onPress={()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}}><Text style={inv2.calNavTxt}>{'<'}</Text></TouchableOpacity>
            <Text style={inv2.calMonthLbl}>{HST_MONTHS[calMonth]} {calYear}</Text>
            <TouchableOpacity style={inv2.calNavBtn} onPress={()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}}><Text style={inv2.calNavTxt}>{'>'}</Text></TouchableOpacity>
          </View>
          <View style={inv2.calDaysRow}>{HST_DAYS.map(d=><Text key={d} style={inv2.calDayHdr}>{d}</Text>)}</View>
          <View style={inv2.calGrid}>
            {calDays.map((day,idx)=>{
              if(!day)return<View key={'e'+idx} style={inv2.calCell}/>;
              const dk=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
              const isSel=dk===selectedDate,isToday=dk===todayKey,hasOrders=grouped.some(g=>g.key===dk);
              return(<TouchableOpacity key={idx} style={[inv2.calCell,isSel&&inv2.calCellSel,isToday&&!isSel&&inv2.calCellToday,!hasOrders&&{opacity:0.30}]} onPress={()=>{if(hasOrders){setSelectedDate(dk);setShowCalendar(false);}}} activeOpacity={hasOrders?0.75:1}>
                <Text style={[inv2.calCellTxt,isSel&&inv2.calCellTxtSel]}>{day}</Text>
                {hasOrders&&!isSel&&<View style={hst.calDot}/>}
              </TouchableOpacity>);
            })}
          </View>
        </View>
      )}
      <View style={{height:1,backgroundColor:'rgba(1,31,75,0.10)',marginVertical:8}}/>
      {displayOrders.length===0
        ?<View style={[sub.emptyBox,{flex:1}]}><MaterialIcons name="receipt-long" size={48} color="rgba(1,31,75,0.15)"/><Text style={sub.emptyTxt}>No transactions for this day.</Text></View>
        :<WebScrollView contentContainerStyle={{gap:4,paddingBottom:20}}>
          {displayOrders.map((order,idx)=>{
            const timeOnly=(()=>{const d=parseOrderDate(order.time);return d?d.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}):(order.time||'');})();
            const itemsSummary=(order.items||[]).map(i=>`${i.item?.name||i.name||'Item'} ×${i.qty}`).join(' · ');
            const isLatest=idx===0&&selectedDate===todayKey;
            const st=ORDER_STATUSES[order.status]||ORDER_STATUSES.pending;
            return(<View key={order.id} style={hst.txRow}>
              <View style={hst.txTimeCol}><Text style={hst.txTime}>{timeOnly}</Text>{isLatest&&<View style={hst.livePip}/>}</View>
              <View style={hst.txLine}><View style={[hst.txDot,isLatest&&{backgroundColor:'#e74c3c'}]}/>{idx<displayOrders.length-1&&<View style={hst.txVLine}/>}</View>
              <View style={hst.txContent}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <Text style={hst.txOrderId}>#{order.orderNo||order.id}</Text>
                  <View style={[hst.txStatusBadge,{backgroundColor:st.bg}]}><Text style={[hst.txStatusTxt,{color:st.color}]}>{st.label}</Text></View>
                </View>
                <Text style={hst.txItems} numberOfLines={2}>{itemsSummary}</Text>
                <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                  <Text style={hst.txAmount}>₱{Number(order.total).toFixed(2)}</Text>
                  <Text style={hst.txPay}>💵 Cash</Text>
                </View>
              </View>
            </View>);
          })}
        </WebScrollView>
      }
    </View>
  );
};

const EmployeeCreditsScreen = () => (
  <View style={[sub.root,{justifyContent:'center',alignItems:'center',gap:14}]}>
    <MaterialIcons name="account-balance" size={64} color="rgba(1,31,75,0.15)"/>
    <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:20,color:'rgba(1,31,75,0.30)'}}>Coming Soon</Text>
    <Text style={sub.emptyTxt}>Employee credit tracking will be{'\n'}available in a future update.</Text>
  </View>
);

const SalesReportScreen = ({ orders, items }) => {
  const currentYear=new Date().getFullYear();
  const[year,setYear]=useState(currentYear);
  const[yearDropdown,setYearDropdown]=useState(false);
  const[activeMonth,setActiveMonth]=useState(new Date().getMonth());
  const[expandedTxDate,setExpandedTxDate]=useState(null);
  const[expandedInvDate,setExpandedInvDate]=useState(null);
  const[showTx,setShowTx]=useState(true);
  const[showInv,setShowInv]=useState(true);
  const[showCredits,setShowCredits]=useState(true);
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const years=Array.from({length:30},(_,i)=>2025+i);
  const parseDate=(timeStr)=>{
    if(!timeStr)return null;
    try{
      if(typeof timeStr==='number')return new Date(timeStr);
      const d=new Date(timeStr);
      return isNaN(d.getTime())?null:d;
    }catch{return null;}
  };
  const getDate=(order)=>{
    if(order.createdAt)return parseDate(order.createdAt);
    return parseDate(order.time);
  };
  const fmtDateKey=(d)=>String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'-'+d.getFullYear();
  const monthOrders=orders.filter(o=>{const d=getDate(o);return d&&d.getFullYear()===year&&d.getMonth()===activeMonth;});
  const txByDay=React.useMemo(()=>{const map={};monthOrders.forEach(o=>{const d=getDate(o);if(!d)return;const k=fmtDateKey(d);if(!map[k])map[k]={key:k,orders:[]};map[k].orders.push(o);});return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key));},[monthOrders.length,activeMonth,year]);
  const invByDay=React.useMemo(()=>txByDay.map(g=>{const totalStock=(items||[]).reduce((s,i)=>s+(i.stock||0),0);const totalValue=(items||[]).reduce((s,i)=>s+(i.price||0)*(i.stock||0),0);return{key:g.key,totalStock,totalValue};}),[txByDay,items]);
  const printTxDay=(dayGroup)=>{if(typeof window==='undefined')return;const total=dayGroup.orders.reduce((s,o)=>s+Number(o.total),0);const rows=dayGroup.orders.map((o,i)=>{const its=(o.items||[]).map(it=>(it.item?.name||it.name||'Item')+' x'+it.qty).join(', ');return'<tr><td>'+(i+1)+'</td><td>#'+(o.orderNo||o.id)+'</td><td>'+(o.time||'')+'</td><td>'+its+'</td><td>&#8369;'+Number(o.total).toFixed(2)+'</td></tr>';}).join('');const html='<html><head><title>Transaction Report '+dayGroup.key+'</title><style>body{font-family:Arial,sans-serif;padding:24px}h2{color:#1a3a6b}table{width:100%;border-collapse:collapse}th{background:#1a3a6b;color:#fff;padding:8px;text-align:left;font-size:12px}td{padding:7px 8px;border-bottom:1px solid #e0e8f0;font-size:12px}tfoot td{font-weight:bold;background:#f0f5f9}</style></head><body><h2>Transaction History Report</h2><p><b>Date:</b> '+dayGroup.key+' &nbsp;|&nbsp; <b>Total Orders:</b> '+dayGroup.orders.length+' &nbsp;|&nbsp; <b>Total Earnings:</b> &#8369;'+total.toFixed(2)+'</p><table><thead><tr><th>#</th><th>Order No</th><th>Time</th><th>Items</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="4">TOTAL</td><td>&#8369;'+total.toFixed(2)+'</td></tr></tfoot></table></body></html>';const w=window.open('','_blank');w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);};
  const printInvDay=(invDay)=>{if(typeof window==='undefined')return;const rows=(items||[]).map(it=>'<tr><td>'+(it.emoji||'')+' '+(it.name||'')+'</td><td>'+(it.cat||'')+'</td><td>'+(it.stock||0)+'</td><td>&#8369;'+(it.price||0).toLocaleString()+'</td><td>&#8369;'+((it.price||0)*(it.stock||0)).toLocaleString()+'</td></tr>').join('');const totalStock=(items||[]).reduce((s,i)=>s+(i.stock||0),0);const totalValue=(items||[]).reduce((s,i)=>s+(i.price||0)*(i.stock||0),0);const html='<html><head><title>Inventory Report '+invDay.key+'</title><style>body{font-family:Arial,sans-serif;padding:24px}h2{color:#1a3a6b}table{width:100%;border-collapse:collapse}th{background:#1a3a6b;color:#fff;padding:8px;text-align:left;font-size:12px}td{padding:7px 8px;border-bottom:1px solid #e0e8f0;font-size:12px}tfoot td{font-weight:bold;background:#f0f5f9}</style></head><body><h2>Inventory Report</h2><p><b>Date:</b> '+invDay.key+' &nbsp;|&nbsp; <b>Total Stock:</b> '+invDay.totalStock+' &nbsp;|&nbsp; <b>Total Value:</b> &#8369;'+invDay.totalValue.toLocaleString()+'</p><table><thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Price</th><th>Value</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="2">TOTAL</td><td>'+totalStock+'</td><td></td><td>&#8369;'+totalValue.toLocaleString()+'</td></tr></tfoot></table></body></html>';const w=window.open('','_blank');w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);};

  return(
    <View style={sub.root}>
      <WebScrollView contentContainerStyle={{gap:0,paddingBottom:20}}>
        <View style={{alignItems:'center',marginBottom:14,position:'relative',zIndex:100}}>
          <TouchableOpacity style={rpt.yearBtn} onPress={()=>setYearDropdown(p=>!p)} activeOpacity={0.80}>
            <Text style={rpt.yearTxt}>YEAR  {year}</Text>
            <Text style={rpt.yearCaret}>{yearDropdown?'▲':'▼'}</Text>
          </TouchableOpacity>
          {yearDropdown&&(<ScrollView style={rpt.yearMenu} showsVerticalScrollIndicator={false}>{years.map(y=>(<TouchableOpacity key={y} style={[rpt.yearOpt,y===year&&rpt.yearOptActive]} onPress={()=>{setYear(y);setYearDropdown(false);}}><Text style={[rpt.yearOptTxt,y===year&&rpt.yearOptTxtActive]}>{y}</Text></TouchableOpacity>))}</ScrollView>)}
        </View>
        <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:6,marginBottom:16}}>
          {MONTHS.map((m,i)=>(<TouchableOpacity key={m} style={[rpt.monthBtn,activeMonth===i&&rpt.monthBtnActive]} onPress={()=>{setActiveMonth(i);setExpandedTxDate(null);setExpandedInvDate(null);}}><Text style={[rpt.monthTxt,activeMonth===i&&rpt.monthTxtActive]}>{m}</Text></TouchableOpacity>))}
        </View>
        <View style={rpt.section}>
          <TouchableOpacity style={rpt.sectionTitleRow} onPress={()=>setShowTx(p=>!p)} activeOpacity={0.80}><Text style={rpt.sectionTitle}>Transaction History Reports</Text><Text style={rpt.sectionToggle}>{showTx?'▲':'▼'}</Text></TouchableOpacity>
          {showTx&&<View>
            <View style={rpt.thead}><Text style={[rpt.th,{flex:1.0,textAlign:'left',paddingLeft:12}]}>DATE</Text><Text style={[rpt.th,{flex:1.1}]}>TOTAL ORDERS</Text><Text style={[rpt.th,{flex:1.3}]}>TOTAL EARNINGS</Text><Text style={[rpt.th,{width:80}]}>PRINT</Text></View>
            {txByDay.length===0?(<View style={rpt.emptyRow}><Text style={rpt.emptyTxt}>No transactions for {MONTHS[activeMonth]} {year}</Text></View>):txByDay.map((g,idx)=>{const total=g.orders.reduce((s,o)=>s+Number(o.total),0);const isOpen=expandedTxDate===g.key;return(<View key={g.key}><TouchableOpacity style={[rpt.trow,idx%2===0&&rpt.trowAlt]} onPress={()=>setExpandedTxDate(isOpen?null:g.key)} activeOpacity={0.75}><Text style={[rpt.td,{flex:1.0,fontFamily:'GoogleSans_700Bold',color:'#1a3a6b',textAlign:'left',paddingLeft:12}]}>{g.key}</Text><Text style={[rpt.td,{flex:1.1}]}>{g.orders.length}</Text><Text style={[rpt.td,{flex:1.3,fontFamily:'GoogleSans_700Bold',color:'#1a7a45'}]}>{'\u20b1'}{total.toFixed(2)}</Text><View style={{width:80,alignItems:'center',justifyContent:'center',alignSelf:'stretch',borderRightWidth:1,borderColor:'rgba(26,58,107,0.08)'}}><TouchableOpacity style={rpt.printBtn} onPress={()=>printTxDay(g)}><Text style={rpt.printBtnTxt}>Print</Text></TouchableOpacity></View></TouchableOpacity>{isOpen&&(<View style={rpt.expandPanel}><View style={rpt.expandHead}><Text style={[rpt.expandTh,{flex:0.4}]}>#</Text><Text style={[rpt.expandTh,{flex:0.8}]}>ORDER NO</Text><Text style={[rpt.expandTh,{flex:1.8}]}>ITEMS</Text><Text style={[rpt.expandTh,{flex:0.8,textAlign:'right'}]}>AMOUNT</Text></View>{g.orders.map((o,i)=>{const itms=(o.items||[]).map(it=>(it.item?.name||it.name||'Item')+' x'+it.qty).join(', ');return(<View key={o.id} style={[rpt.expandRow,i%2===0&&{backgroundColor:'rgba(255,255,255,0.30)'}]}><Text style={[rpt.expandTd,{flex:0.4}]}>{i+1}</Text><Text style={[rpt.expandTd,{flex:0.8,fontFamily:'GoogleSans_700Bold'}]}>#{o.orderNo||o.id}</Text><Text style={[rpt.expandTd,{flex:1.8}]} numberOfLines={2}>{itms}</Text><Text style={[rpt.expandTd,{flex:0.8,textAlign:'right',color:'#c9a84c',fontFamily:'GoogleSans_700Bold'}]}>{'\u20b1'}{Number(o.total).toFixed(2)}</Text></View>);})}</View>)}</View>);})}
          </View>}
        </View>
        <View style={[rpt.section,{marginTop:16}]}>
          <TouchableOpacity style={rpt.sectionTitleRow} onPress={()=>setShowInv(p=>!p)} activeOpacity={0.80}><Text style={rpt.sectionTitle}>Inventory Reports</Text><Text style={rpt.sectionToggle}>{showInv?'▲':'▼'}</Text></TouchableOpacity>
          {showInv&&<View>
            <View style={rpt.thead}><Text style={[rpt.th,{flex:1.0,textAlign:'left',paddingLeft:12}]}>DATE</Text><Text style={[rpt.th,{flex:1.1}]}>TOTAL STOCK</Text><Text style={[rpt.th,{flex:1.3}]}>TOTAL VALUE</Text><Text style={[rpt.th,{width:80}]}>PRINT</Text></View>
            {invByDay.length===0?(<View style={rpt.emptyRow}><Text style={rpt.emptyTxt}>No inventory data for {MONTHS[activeMonth]} {year}</Text></View>):invByDay.map((g,idx)=>{const isOpen=expandedInvDate===g.key;return(<View key={g.key}><TouchableOpacity style={[rpt.trow,idx%2===0&&rpt.trowAlt]} onPress={()=>setExpandedInvDate(isOpen?null:g.key)} activeOpacity={0.75}><Text style={[rpt.td,{flex:1.0,fontFamily:'GoogleSans_700Bold',color:'#1a3a6b',textAlign:'left',paddingLeft:12}]}>{g.key}</Text><Text style={[rpt.td,{flex:1.1}]}>{g.totalStock}</Text><Text style={[rpt.td,{flex:1.3,fontFamily:'GoogleSans_700Bold',color:'#1a7a45'}]}>{'\u20b1'}{g.totalValue.toLocaleString()}</Text><View style={{width:80,alignItems:'center',justifyContent:'center',alignSelf:'stretch',borderRightWidth:1,borderColor:'rgba(26,58,107,0.08)'}}><TouchableOpacity style={rpt.printBtn} onPress={()=>printInvDay(g)}><Text style={rpt.printBtnTxt}>Print</Text></TouchableOpacity></View></TouchableOpacity>{isOpen&&(<View style={rpt.expandPanel}><View style={rpt.expandHead}><Text style={[rpt.expandTh,{flex:2}]}>ITEM</Text><Text style={[rpt.expandTh,{flex:1}]}>CATEGORY</Text><Text style={[rpt.expandTh,{flex:0.6,textAlign:'center'}]}>STOCK</Text><Text style={[rpt.expandTh,{flex:0.8,textAlign:'right'}]}>VALUE</Text></View>{(items||[]).map((it,i)=>(<View key={it.id} style={[rpt.expandRow,i%2===0&&{backgroundColor:'rgba(255,255,255,0.30)'}]}><Text style={[rpt.expandTd,{flex:2,fontFamily:'GoogleSans_700Bold'}]} numberOfLines={1}>{it.emoji} {it.name}</Text><Text style={[rpt.expandTd,{flex:1}]} numberOfLines={1}>{it.cat}</Text><Text style={[rpt.expandTd,{flex:0.6,textAlign:'center'}]}>{it.stock}</Text><Text style={[rpt.expandTd,{flex:0.8,textAlign:'right',color:'#c9a84c',fontFamily:'GoogleSans_700Bold'}]}>{'\u20b1'}{((it.price||0)*(it.stock||0)).toLocaleString()}</Text></View>))}</View>)}</View>);})}
          </View>}
        </View>
        <View style={[rpt.section,{marginTop:16}]}>
          <TouchableOpacity style={rpt.sectionTitleRow} onPress={()=>setShowCredits(p=>!p)} activeOpacity={0.80}><Text style={rpt.sectionTitle}>Credits Reports</Text><Text style={rpt.sectionToggle}>{showCredits?'▲':'▼'}</Text></TouchableOpacity>
          {showCredits&&<View style={rpt.comingSoon}><Text style={rpt.comingSoonEmoji}>🚧</Text><Text style={rpt.comingSoonTxt}>Coming Soon</Text><Text style={rpt.comingSoonSub}>Credits reporting will be available in a future update.</Text></View>}
        </View>
      </WebScrollView>
    </View>
  );
};

const rpt = StyleSheet.create({
  yearBtn: { flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,paddingHorizontal:28,backgroundColor:'rgba(26,58,107,0.12)',borderRadius:12,borderWidth:1.5,borderColor:'rgba(26,58,107,0.20)' },
  yearTxt:  { fontFamily:'GoogleSans_700Bold',fontSize:20,color:'#1a3a6b',letterSpacing:1 },
  yearCaret:{ fontSize:12,color:'rgba(26,58,107,0.50)' },
  yearMenu: { position:'absolute',top:48,zIndex:9999,backgroundColor:'rgba(255,255,255,0.99)',borderRadius:10,borderWidth:1,borderColor:'rgba(26,58,107,0.18)',shadowColor:'#000',shadowOpacity:0.18,shadowRadius:12,elevation:20,minWidth:140,maxHeight:200 },
  yearOpt: { paddingVertical:10,paddingHorizontal:20,alignItems:'center' },
  yearOptActive: { backgroundColor:'rgba(26,58,107,0.08)' },
  yearOptTxt: { fontFamily:'GoogleSans_400Regular',fontSize:14,color:'#1a3a6b' },
  yearOptTxtActive: { fontFamily:'GoogleSans_700Bold',color:'#1a3a6b' },
  monthBtn: { paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:'#1a3a6b',borderWidth:1,borderColor:'rgba(26,58,107,0.60)' },
  monthBtnActive: { backgroundColor:'rgba(198,220,240,0.90)',borderColor:'#304674',borderWidth:1.5 },
  monthTxt: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'rgba(255,255,255,0.90)' },
  monthTxtActive: { fontFamily:'GoogleSans_700Bold',color:'#1a3a6b' },
  section: { backgroundColor:'rgba(255,255,255,0.22)',borderRadius:12,borderWidth:1,borderColor:'rgba(255,255,255,0.45)',overflow:'hidden' },
  sectionTitleRow: { flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:10,paddingHorizontal:12 },
  sectionToggle: { fontSize:13,color:'rgba(26,58,107,0.45)',paddingLeft:8 },
  sectionTitle: { fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#1a3a6b',letterSpacing:0.5 },
  thead: { flexDirection:'row',alignItems:'center',paddingVertical:8,paddingHorizontal:0,backgroundColor:'rgba(26,58,107,0.12)' },
  th: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'rgba(26,58,107,0.60)',letterSpacing:0.8,textTransform:'uppercase',textAlign:'center',paddingVertical:8,paddingHorizontal:6,borderRightWidth:1,borderColor:'rgba(26,58,107,0.10)' },
  trow: { flexDirection:'row',alignItems:'center',paddingVertical:0,paddingHorizontal:0,borderBottomWidth:1,borderColor:'rgba(26,58,107,0.07)',minHeight:42 },
  trowAlt: { backgroundColor:'rgba(255,255,255,0.35)' },
  td: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'#1a2d4e',textAlign:'center',paddingVertical:10,paddingHorizontal:6,borderRightWidth:1,borderColor:'rgba(26,58,107,0.08)',alignSelf:'stretch',justifyContent:'center' },
  printBtn: { alignItems:'center',backgroundColor:'#1a3a6b',borderRadius:6,paddingVertical:5,paddingHorizontal:10 },
  printBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'#fff',letterSpacing:0.3 },
  expandPanel: { backgroundColor:'rgba(26,58,107,0.04)',borderBottomWidth:1,borderColor:'rgba(26,58,107,0.10)' },
  expandHead: { flexDirection:'row',paddingVertical:6,paddingHorizontal:20,backgroundColor:'rgba(26,58,107,0.08)' },
  expandTh: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'rgba(26,58,107,0.50)',letterSpacing:0.5,textTransform:'uppercase',flex:1 },
  expandRow: { flexDirection:'row',paddingVertical:7,paddingHorizontal:20,borderBottomWidth:1,borderColor:'rgba(26,58,107,0.04)' },
  expandTd: { fontFamily:'GoogleSans_400Regular',fontSize:10,color:'#1a2d4e',flex:1 },
  emptyRow: { paddingVertical:20,alignItems:'center' },
  emptyTxt: { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(1,31,75,0.40)' },
  comingSoon: { alignItems:'center',paddingVertical:32,gap:8 },
  comingSoonEmoji: { fontSize:32 },
  comingSoonTxt: { fontFamily:'GoogleSans_700Bold',fontSize:16,color:'rgba(1,31,75,0.40)' },
  comingSoonSub: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.35)',textAlign:'center',paddingHorizontal:20 },
});

const sub = StyleSheet.create({
  root: { flex:1,padding:14,overflow:'hidden',minHeight:0 },
  emptyBox: { flex:1,alignItems:'center',justifyContent:'center',gap:10,paddingTop:60 },
  emptyTxt: { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(1,31,75,0.35)',textAlign:'center',lineHeight:18 },
});

const hst = StyleSheet.create({
  calTrigger: { flexDirection:'row',alignItems:'center',gap:6,paddingVertical:6,paddingHorizontal:12,backgroundColor:'rgba(26,58,107,0.10)',borderRadius:8,borderWidth:1,borderColor:'rgba(26,58,107,0.15)',alignSelf:'flex-start' },
  calTriggerTxt: { fontFamily:'NotoSerif_700Bold',fontSize:12,color:'#1a3a6b' },
  calTriggerCaret: { fontSize:10,color:'rgba(26,58,107,0.50)' },
  calCard: { position:'absolute',top:38,left:0,zIndex:999,backgroundColor:'rgba(255,255,255,0.98)',borderRadius:10,borderWidth:1,borderColor:'rgba(26,58,107,0.18)',padding:8,shadowColor:'#000',shadowOpacity:0.18,shadowRadius:12,elevation:20,minWidth:220,maxWidth:260 },
  calDot: { width:4,height:4,borderRadius:2,backgroundColor:'#1a3a6b',position:'absolute',bottom:2,alignSelf:'center' },
  txHeaderSub: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.50)',marginTop:2 },
  txRow: { flexDirection:'row',gap:0,minHeight:56 },
  txTimeCol: { width:52,flexShrink:0,alignItems:'flex-end',paddingRight:8,paddingTop:3,gap:4 },
  txTime: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'rgba(1,31,75,0.55)',textAlign:'right' },
  livePip: { width:6,height:6,borderRadius:3,backgroundColor:'#e74c3c' },
  txLine: { width:16,flexShrink:0,alignItems:'center' },
  txDot: { width:10,height:10,borderRadius:5,backgroundColor:'#1a3a6b',marginTop:4,flexShrink:0,zIndex:1 },
  txVLine: { flex:1,width:2,backgroundColor:'rgba(1,31,75,0.12)',marginTop:2 },
  txContent: { flex:1,backgroundColor:'rgba(255,255,255,0.65)',borderRadius:10,padding:10,marginLeft:8,marginBottom:4,borderWidth:1,borderColor:'rgba(255,255,255,0.85)',gap:4 },
  txOrderId: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#1a3a6b' },
  txStatusBadge: { borderRadius:5,paddingHorizontal:6,paddingVertical:2 },
  txStatusTxt: { fontFamily:'GoogleSans_700Bold',fontSize:9 },
  txItems: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.60)',lineHeight:15 },
  txAmount: { fontFamily:'NotoSerif_700Bold',fontSize:13,color:'#c9a84c' },
  txPay: { fontFamily:'GoogleSans_400Regular',fontSize:10,color:'rgba(1,31,75,0.45)' },
});

// ─── ORDER MONITORING PANEL ───────────────────────────────────────────────────
const STATUS_CFG = {
  pending:   { label:'PENDING',   color:'#c0392b', btnLabel:'Start Preparing', btnColor:'#e67e22', next:'preparing' },
  preparing: { label:'PREPARING', color:'#b9660a', btnLabel:'Mark as Ready',   btnColor:'#2980b9', next:'ready'     },
  ready:     { label:'READY',     color:'#1a6b2a', btnLabel:'Mark as Done',    btnColor:'#27ae60', next:'done'      },
  done:      { label:'DONE',      color:'#1a3a6b', btnLabel:null,              btnColor:null,      next:null        },
};

const OrderingMonitoring = ({ orders, onUpdateStatus }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [activeFilter, setActiveFilter] = useState('pending');

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim,{toValue:0.2,duration:800,useNativeDriver:true}),
      Animated.timing(pulseAnim,{toValue:1,  duration:800,useNativeDriver:true}),
    ]));
    loop.start();
    return ()=>loop.stop();
  }, []);

  const pendingCount   = orders.filter(o=>o.status==='pending').length;
  const preparingCount = orders.filter(o=>o.status==='preparing').length;
  const readyCount     = orders.filter(o=>o.status==='ready').length;
  const doneToday      = orders.filter(o=>{
    if(o.status!=='done')return false;
    try{const d=new Date(o.time);const t=new Date();return d.toDateString()===t.toDateString();}catch{return false;}
  }).length;

  const STAT_CARDS = [
    { key:'pending',   label:'PENDING',   num:pendingCount,   bg:'#c0392b', activeBg:'#e74c3c' },
    { key:'preparing', label:'PREPARING', num:preparingCount, bg:'#b9660a', activeBg:'#e67e22' },
    { key:'ready',     label:'READY',     num:readyCount,     bg:'#1a6b2a', activeBg:'#27ae60' },
    { key:'done',      label:'DONE',      num:doneToday,      bg:'#1a3a6b', activeBg:'#2e5fa3' },
  ];

  const filteredOrders = orders.filter(o => {
    if(activeFilter==='done'){
      if(o.status!=='done')return false;
      try{const d=new Date(o.time);const t=new Date();return d.toDateString()===t.toDateString();}catch{return false;}
    }
    return o.status===activeFilter;
  });

  const COLS = 3;

  return (
    <View style={lp.root}>
      <View style={lp.titleRow}>
        <Animated.View style={[lp.liveDot,{opacity:pulseAnim}]}/>
        <Text style={lp.title}>ORDERING MONITORING</Text>
      </View>
      <View style={lp.statCards}>
        {STAT_CARDS.map(c=>(
          <TouchableOpacity key={c.key} style={[lp.statCard,{backgroundColor:activeFilter===c.key?c.activeBg:c.bg},activeFilter===c.key&&lp.statCardActive]} onPress={()=>setActiveFilter(c.key)} activeOpacity={0.80}>
            <Text style={lp.statLabel}>{c.label}</Text>
            <Text style={lp.statNum}>{String(c.num).padStart(2,'0')}</Text>
            {activeFilter===c.key&&<View style={lp.statCardIndicator}/>}
          </TouchableOpacity>
        ))}
      </View>
      <WebScrollView style={{flex:1,minHeight:0}} contentContainerStyle={{gap:6,paddingBottom:12}}>
        {filteredOrders.length===0
          ?<View style={lp.emptyBox}>
            <Text style={lp.emptyIco}>{activeFilter==='pending'?'⏳':activeFilter==='preparing'?'🔥':activeFilter==='ready'?'✅':'✓'}</Text>
            <Text style={lp.emptyTxt}>No {activeFilter} orders</Text>
          </View>
          :(()=>{
            const rows=[];
            for(let i=0;i<filteredOrders.length;i+=COLS)rows.push(filteredOrders.slice(i,i+COLS));
            return rows.map((row,rIdx)=>(
              <View key={rIdx} style={{flexDirection:'row',gap:6}}>
                {row.map(order=>{
                  const cfg=STATUS_CFG[order.status]||STATUS_CFG.pending;
                  const itemsList=(order.items||[]).map(i=>`${i.item?.name||i.name||'?'} x${i.qty}`).join(', ');
                  const timeStr=(()=>{try{const d=new Date(order.time);return isNaN(d)?'':d.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});}catch{return'';}})();
                  return(
                    <View key={order.id} style={[lp.card,{flex:1,borderTopColor:cfg.color}]}>
                      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                        <Text style={lp.cardId}>#{order.orderNo||order.id?.slice(-4)||'--'}</Text>
                        <Text style={lp.cardTime}>{timeStr}</Text>
                      </View>
                      <Text style={lp.cardItems} numberOfLines={3}>{itemsList}</Text>
                      <Text style={lp.cardTotal}>{'\u20b1'}{Number(order.total).toFixed(0)}</Text>
                      <Text style={lp.cardPay}>{order.payment==='gcash'?'📱 GCash':'💵 Cash'}</Text>
                      {cfg.btnLabel&&(
                        <TouchableOpacity style={[lp.actionBtn,{backgroundColor:cfg.btnColor}]} onPress={()=>onUpdateStatus(order.id,cfg.next)} activeOpacity={0.80}>
                          <Text style={lp.actionBtnTxt}>{cfg.btnLabel}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
                {Array.from({length:COLS-row.length}).map((_,i)=>(<View key={`e-${i}`} style={{flex:1}}/>))}
              </View>
            ));
          })()
        }
      </WebScrollView>
    </View>
  );
};

const lp = StyleSheet.create({
  root: { flex:1,padding:10,minHeight:0,overflow:'hidden' },
  titleRow: { flexDirection:'row',alignItems:'center',gap:5,marginBottom:8,justifyContent:'center' },
  liveDot: { width:8,height:8,borderRadius:4,backgroundColor:'#e74c3c' },
  title: { fontFamily:'GoogleSans_700Bold',fontSize:10,color:'#1a2d4e',letterSpacing:1.5,textDecorationLine:'underline',textAlign:'center' },
  statCards: { flexDirection:'row',gap:4,marginBottom:10 },
  statCard: { flex:1,borderRadius:10,paddingVertical:8,paddingHorizontal:2,alignItems:'center',gap:2,position:'relative',overflow:'hidden' },
  statCardActive: { shadowColor:'#000',shadowOpacity:0.25,shadowRadius:6,elevation:6,transform:[{scale:1.03}] },
  statCardIndicator: { position:'absolute',bottom:0,left:0,right:0,height:3,backgroundColor:'rgba(255,255,255,0.60)' },
  statLabel: { fontFamily:'GoogleSans_700Bold',fontSize:6,color:'#fff',letterSpacing:0.8,textAlign:'center' },
  statNum: { fontFamily:'GoogleSans_700Bold',fontSize:20,color:'#fff',lineHeight:24 },
  emptyBox: { padding:20,alignItems:'center',gap:6 },
  emptyIco: { fontSize:28 },
  emptyTxt: { fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.35)',textAlign:'center' },
  card: { backgroundColor:'rgba(255,255,255,0.88)',borderRadius:10,padding:8,borderTopWidth:3,borderWidth:1,borderColor:'rgba(255,255,255,0.95)',gap:4,shadowColor:'#000',shadowOpacity:0.07,shadowRadius:4,elevation:2,minHeight:110,justifyContent:'space-between' },
  cardId: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'#0d2540' },
  cardTime: { fontFamily:'GoogleSans_400Regular',fontSize:9,color:'rgba(1,31,75,0.40)' },
  cardItems: { fontFamily:'GoogleSans_400Regular',fontSize:9,color:'rgba(1,31,75,0.65)',lineHeight:13,flex:1 },
  cardTotal: { fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#c9a84c' },
  cardPay: { fontFamily:'GoogleSans_400Regular',fontSize:8,color:'rgba(1,31,75,0.40)' },
  actionBtn: { borderRadius:6,paddingVertical:5,paddingHorizontal:4,alignItems:'center',justifyContent:'center',marginTop:2 },
  actionBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'#fff',textAlign:'center' },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function ManageCanteenScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isSmall  = width < 400;
  const isTablet = width >= 600 && width < 900;
  const isWide   = width >= 900;

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
  const [invMaxQty,      setInvMaxQty]      = useState({});
  const [adCurrent,      setAdCurrent]      = useState(0);
  const [salesCollapsed, setSalesCollapsed] = useState(true); // collapsed by default on mobile

  const hdrFade    = useRef(new Animated.Value(0)).current;
  const hdrTrans   = useRef(new Animated.Value(-16)).current;
  const bodyFade   = useRef(new Animated.Value(0)).current;
  const adScrollRef = useRef(null);

  // ── FIX: Firestore onSnapshot is always live — no polling needed ──────────
  useFocusEffect(useCallback(()=>{
    reloadFromStorage();
  },[reloadFromStorage]));

  useEffect(()=>{
    Animated.parallel([
      Animated.timing(hdrFade,{toValue:1,duration:500,useNativeDriver:true}),
      Animated.timing(hdrTrans,{toValue:0,duration:500,useNativeDriver:true}),
    ]).start();
    Animated.timing(bodyFade,{toValue:1,duration:500,delay:150,useNativeDriver:true}).start();
  },[]);

  const bannerW = isWide ? Math.min(width * 0.60, 700) : width - 16;

  useEffect(()=>{
    if(!ads.length)return;
    const t=setInterval(()=>{
      setAdCurrent(prev=>{
        const next=(prev+1)%ads.length;
        adScrollRef.current?.scrollTo({x:next*bannerW,animated:true});
        return next;
      });
    },5000);
    return()=>clearInterval(t);
  },[ads.length,bannerW]);

  const handleSearch=(text)=>{
    setSearch(text);
    if(!text.trim())return;
    const cats=[...new Set(items.filter(i=>i.name.toLowerCase().includes(text.toLowerCase())).map(i=>i.cat))];
    setActiveCategory(cats.length===1?cats[0]:'All');
  };

  const filtered=items.filter(i=>{
    if(search.trim())return i.name.toLowerCase().includes(search.toLowerCase());
    return activeCategory==='All'||i.cat===activeCategory;
  });

  const openAddItem  =()=>{setEditItem(emptyItem());setEditItemModal(true);};
  const openEditItem =(item)=>{setEditItem({...item,price:String(item.price),stock:String(item.stock)});setEditItemModal(true);};
  const handleSaveItem=(updated)=>{
    saveItem(updated);
    if(updated.maxQty!==undefined)setInvMaxQty(p=>({...p,[updated.id]:updated.maxQty}));
    setEditItemModal(false);
  };
  const handleDeleteItem=(id)=>{
    if(Platform.OS==='web'){if(window.confirm('Delete this item? This cannot be undone.')){deleteItem(id);}}
    else{Alert.alert('Delete Item','Are you sure?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>deleteItem(id)}]);}
  };

  const handleSaveAd = async (updated) => {
    if (updated.isNew) {
      // New ad — clean object then save to Firestore
      const newAd = {
        id: Date.now().toString(),
        title: updated.title || '',
        sub: updated.sub || '',
        emoji: updated.emoji || '📢',
        image: updated.image || null,
        imageUrl: updated.imageUrl || '',
        bg: updated.bg || ['#1a3a6b', '#2e5fa3'],
      };
      await saveAd(newAd);
    } else {
      // Existing ad — clean object (remove isNew, undefined fields)
      const cleanAd = {
        id: updated.id,
        title: updated.title || '',
        sub: updated.sub || '',
        emoji: updated.emoji || '📢',
        image: updated.image || null,
        imageUrl: updated.imageUrl || '',
        bg: updated.bg || ['#1a3a6b', '#2e5fa3'],
      };
      await saveAd(cleanAd);
    }
    setEditAdModal(false);
  };

  const handleDeleteAd = async (id) => {
    // Delete from Firestore directly
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      await deleteDoc(doc(db, 'canteen_ads', id));
    } catch (e) {
      // Fallback to context setAds
      setAds(prev => prev.filter(a => a.id !== id));
    }
  };

  const pendingCount=orders.filter(o=>o.status==='pending').length;

  if(!fontsLoaded)return null;

  const renderContent=()=>{
    if(activeTab==='cashier')   return <CashierScreen items={items} categories={categories} addOrder={addOrder} deductStock={deductStock} isWide={isWide}/>;
    if(activeTab==='menu')      return <ManageMenuScreen items={items} categories={categories} filtered={filtered} search={search} activeCategory={activeCategory} onSearch={handleSearch} onCategoryChange={setActiveCategory} onAddItem={openAddItem} onEditItem={openEditItem} onDeleteItem={handleDeleteItem} isWide={isWide}/>;
    if(activeTab==='inventory') return <InventoryScreen items={items} maxQtyMap={invMaxQty} onAddItem={openAddItem} onEditItem={openEditItem}/>;
    if(activeTab==='history')   return <OrderHistoryScreen orders={orders}/>;
    if(activeTab==='credits')   return <EmployeeCreditsScreen/>;
    if(activeTab==='report')    return <SalesReportScreen orders={orders} items={items}/>;
    return null;
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>
      <View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#98bad5'}]}/>
      <LinearGradient colors={['rgba(198,220,235,0.85)','rgba(152,186,213,0.40)','rgba(80,110,150,0.0)']} locations={[0,0.45,1]} start={{x:0.5,y:0.1}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>
      <LinearGradient colors={['rgba(50,80,120,0.45)','rgba(50,80,120,0.0)','rgba(50,80,120,0.45)']} locations={[0,0.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFillObject}/>
      <LinearGradient colors={['rgba(50,80,120,0.0)','rgba(60,90,130,0.35)']} locations={[0.4,1]} start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>

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

      <Animated.View style={[styles.body,{opacity:bodyFade,flex:1,minHeight:0}]}>
        <View style={{ flex:1, flexDirection: isWide ? 'row' : 'column', minHeight:0, overflow:'hidden' }}>

        {/* LEFT PANEL — Order Monitoring */}
        {isWide ? (
          <View style={styles.leftPanel}>
            <OrderingMonitoring orders={orders} onUpdateStatus={updateOrderStatus}/>
          </View>
        ) : (
          /* Mobile/Tablet: collapsible ordering overview */
          <View style={[
            styles.leftPanelMobile,
            salesCollapsed && { height: 36 },
            isTablet && !salesCollapsed && { height: 170 },
          ]}>
            {/* Collapse toggle header */}
            <TouchableOpacity
              onPress={() => setSalesCollapsed(v => !v)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 12, paddingVertical: 6,
                backgroundColor: 'rgba(26,58,107,0.15)',
                borderBottomWidth: salesCollapsed ? 0 : 1,
                borderColor: 'rgba(255,255,255,0.30)',
              }}
              activeOpacity={0.80}
            >
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <View style={{ width:6, height:6, borderRadius:3, backgroundColor:'#e74c3c' }} />
                <Text style={{ fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#1a2d4e', letterSpacing:1.2 }}>ORDERING MONITORING</Text>
              </View>
              <MaterialIcons name={salesCollapsed ? 'expand-more' : 'expand-less'} size={18} color="rgba(26,58,107,0.60)" />
            </TouchableOpacity>
            {!salesCollapsed && (
              <View style={{ flex:1, minHeight:0, overflow:'hidden' }}>
                <OrderingMonitoring orders={orders} onUpdateStatus={updateOrderStatus}/>
              </View>
            )}
          </View>
        )}

        {/* RIGHT PANEL */}
        <View style={isWide ? styles.rightPanel : styles.rightPanelMobile}>
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
                      {ads.map((_,i)=>(<TouchableOpacity key={i} onPress={()=>{adScrollRef.current?.scrollTo({x:i*bannerW,animated:true});setAdCurrent(i);}}><View style={[styles.adDot,adCurrent===i&&styles.adDotActive]}/></TouchableOpacity>))}
                    </View>
                  </LinearGradient>
                );
              })}
              <TouchableOpacity style={[styles.adSlide,{width:bannerW,backgroundColor:'rgba(26,58,107,0.18)',justifyContent:'center',alignItems:'center',gap:8,borderWidth:2,borderColor:'rgba(255,255,255,0.40)',borderStyle:'dashed'}]}
                onPress={()=>{setEditAd({isNew:true,id:Date.now().toString(),title:'',sub:'',image:null,imageUrl:'',emoji:'📢',bg:['#1a3a6b','#2e5fa3']});setEditAdModal(true);}}>
                <MaterialIcons name="add-circle-outline" size={28} color="rgba(26,58,107,0.55)"/>
                <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:12,color:'rgba(26,58,107,0.55)'}}>Add New Ad</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.tabBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:2}} style={{flexGrow:0}}>
              {TABS.map(tab=>(
                <TouchableOpacity key={tab.key} style={[styles.tabBtn,activeTab===tab.key&&styles.tabBtnActive]} onPress={()=>setActiveTab(tab.key)} activeOpacity={0.80}>
                  <MaterialIcons name={tab.icon} size={13} color={activeTab===tab.key?'#1a3a6b':'rgba(255,255,255,0.80)'}/>
                  <Text style={[styles.tabBtnTxt,activeTab===tab.key&&styles.tabBtnTxtActive]}>{tab.label}</Text>
                  {tab.key==='cashier'&&pendingCount>0&&(<View style={styles.tabBadge}><Text style={styles.tabBadgeTxt}>{pendingCount}</Text></View>)}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.contentArea}>{renderContent()}</View>
        </View>
        </View>
      </Animated.View>

      <ItemEditModal visible={editItemModal} item={editItem} categories={categories} onSave={handleSaveItem} onClose={()=>setEditItemModal(false)}/>
      <AdEditModal visible={editAdModal} ad={editAd} onSave={handleSaveAd} onClose={()=>setEditAdModal(false)} onDelete={handleDeleteAd}/>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex:1,flexDirection:'column' },
  header: { flexDirection:'row',alignItems:'center',backgroundColor:'rgba(26,58,107,0.92)',borderRadius:16,borderWidth:1,borderColor:'rgba(255,255,255,0.18)',shadowColor:'#011f4b',shadowOpacity:0.25,shadowRadius:12,elevation:8 },
  backBtn: { width:36,height:36,borderRadius:18,backgroundColor:'rgba(255,255,255,0.15)',borderWidth:1,borderColor:'rgba(255,255,255,0.30)',justifyContent:'center',alignItems:'center',flexShrink:0 },
  backIcon: { color:'#fff',fontSize:16,fontWeight:'600',textAlign:'center',lineHeight:20 },
  headerCenter: { flex:1,alignItems:'center',paddingHorizontal:8,minWidth:0 },
  headerH1: { fontFamily:'NotoSerif_700Bold',color:'#fff',textAlign:'center' },
  headerGold: { color:'#c9a84c' },
  visitorTag: { marginTop:2,paddingHorizontal:8,paddingVertical:2,borderRadius:20,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:1,borderColor:'rgba(255,255,255,0.40)',alignSelf:'center' },
  visitorTagText: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'#fff',letterSpacing:1.2,textTransform:'uppercase',lineHeight:13 },
  iconBtn: { width:36,height:36,borderRadius:18,backgroundColor:'rgba(255,255,255,0.15)',borderWidth:1,borderColor:'rgba(255,255,255,0.30)',justifyContent:'center',alignItems:'center',flexShrink:0 },
  notifBadge: { position:'absolute',top:4,right:4,backgroundColor:'#e74c3c',borderRadius:6,minWidth:14,height:14,alignItems:'center',justifyContent:'center',paddingHorizontal:2 },
  notifBadgeTxt: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'#fff' },
  body: { flex:1, marginTop:Platform.OS==='web'?10:6, marginBottom:16, minHeight:0, overflow:'hidden' },
  leftPanelMobile: { height: 220, flexShrink: 0, backgroundColor:'rgba(255,255,255,0.22)', borderRadius:12, marginHorizontal:8, marginTop:4, marginBottom:0, borderWidth:1, borderColor:'rgba(255,255,255,0.40)', overflow:'hidden' },
  rightPanelMobile: { flex:1, minWidth:0, minHeight:0, marginHorizontal:8, marginTop:6, marginBottom:8, flexDirection:'column', overflow:'hidden' },
  leftPanel: { flex:1.4,flexShrink:0,backgroundColor:'rgba(255,255,255,0.22)',borderRadius:16,marginLeft:10,marginRight:0,borderWidth:1,borderColor:'rgba(255,255,255,0.40)',overflow:'hidden',minHeight:0 },
  rightPanel: { flex:3,minWidth:0,minHeight:0,marginHorizontal:10,flexDirection:'column',overflow:'hidden' },
  adWrapper: { height:100,flexShrink:0,borderRadius:16,overflow:'hidden',backgroundColor:'rgba(26,58,107,0.15)',marginBottom:0 },
  adSlide: { height:100,flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingBottom:10,gap:12,overflow:'hidden' },
  adBgImg: { position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:16 },
  adEmoji: { fontSize:40,flexShrink:0 },
  adTitle: { fontFamily:'GoogleSans_700Bold',fontSize:15,color:'#fff' },
  adSub:   { fontFamily:'GoogleSans_400Regular',fontSize:12,color:'rgba(255,255,255,0.85)' },
  adBadge: { position:'absolute',top:8,right:38,backgroundColor:'rgba(255,255,255,0.25)',borderRadius:4,paddingHorizontal:6,paddingVertical:2 },
  adBadgeTxt: { fontFamily:'GoogleSans_700Bold',fontSize:9,color:'#fff',letterSpacing:1 },
  adEditBtn: { position:'absolute',top:6,right:8,backgroundColor:'rgba(0,0,0,0.35)',borderRadius:7,padding:5 },
  adDotsInner: { position:'absolute',bottom:5,left:0,right:0,flexDirection:'row',justifyContent:'center',gap:4 },
  adDot: { width:6,height:6,borderRadius:3,backgroundColor:'rgba(255,255,255,0.40)' },
  adDotActive: { backgroundColor:'#fff',width:16 },
  tabBar: { flexShrink:0,backgroundColor:'rgba(26,58,107,0.50)',borderTopLeftRadius:12,borderTopRightRadius:12,paddingTop:5,paddingHorizontal:4,marginTop:8,flexDirection:'row' },
  tabBtn: { paddingVertical:8,paddingHorizontal:13,borderTopLeftRadius:10,borderTopRightRadius:10,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(255,255,255,0.10)',marginHorizontal:2 },
  tabBtnActive: { backgroundColor:'#eef2f8' },
  tabBtnTxt: { fontFamily:'GoogleSans_700Bold',fontSize:11,color:'rgba(255,255,255,0.80)' },
  tabBtnTxtActive: { color:'#1a3a6b' },
  tabBadge: { backgroundColor:'#e74c3c',borderRadius:7,minWidth:14,height:14,alignItems:'center',justifyContent:'center',paddingHorizontal:2 },
  tabBadgeTxt: { fontFamily:'GoogleSans_700Bold',fontSize:8,color:'#fff' },
  contentArea: { flex:1,minHeight:0,backgroundColor:'rgba(255,255,255,0.22)',borderBottomLeftRadius:16,borderBottomRightRadius:16,borderTopRightRadius:16,borderWidth:1,borderColor:'rgba(255,255,255,0.40)',overflow:'hidden' },
});