// src/screens/ManageCanteenScreen.js
// CESLA MPC — Manage Canteen (Admin)
// Connected to CanteenVisitor via CanteenContext

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

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const emptyItem = () => ({
  id: Date.now().toString(), name:'', cat:'Meals',
  price:'', stock:'', emoji:'🍽️', image:null,
});

const SUB_SCREENS = [
  { key:'items',     label:'Menu Items',       icon:'restaurant-menu' },
  { key:'queue',     label:'Live Queue',        icon:'queue',          badge:'LIVE' },
  { key:'history',   label:'Order History',     icon:'history'         },
  { key:'stocks',    label:'Stocks',            icon:'inventory'       },
  { key:'inventory', label:'Inventory',         icon:'list-alt'        },
  { key:'report',    label:'Sales Report',      icon:'bar-chart'       },
  { key:'credits',   label:'Employee Credits',  icon:'account-balance' },
];

// ─── ORDER STATUS CONFIG ──────────────────────────────────────────────────────
// Flow: pending → preparing → ready → done
const ORDER_STATUSES = {
  pending: {
    label: '⏳ Pending',
    color: '#e67e22',
    bg: 'rgba(230,126,34,0.12)',
    next: 'preparing',
    nextLabel: '🔥 Start Preparing',
    nextColor: '#e67e22',
  },
  preparing: {
    label: '🔥 Preparing',
    color: '#2980b9',
    bg: 'rgba(41,128,185,0.12)',
    next: 'ready',
    nextLabel: '✅ Mark as Ready',
    nextColor: '#27ae60',
  },
  ready: {
    label: '✅ Ready to Pick Up',
    color: '#27ae60',
    bg: 'rgba(39,174,96,0.12)',
    next: 'done',
    nextLabel: '✓ Mark as Done',
    nextColor: '#1a3a6b',
  },
  done: {
    label: '✓ Done',
    color: 'rgba(1,31,75,0.35)',
    bg: 'rgba(1,31,75,0.06)',
    next: null,
    nextLabel: null,
    nextColor: null,
  },
};

// ─── ITEM EDIT MODAL ──────────────────────────────────────────────────────────
const ItemEditModal = ({ visible, item, categories, onSave, onClose }) => {
  const [form, setForm] = useState(item || emptyItem());
  useEffect(() => {
    if (item) setForm({...item, price: String(item.price), stock: String(item.stock) });
  }, [item]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[1,1], quality:0.8,
    });
    if (!res.canceled) setForm(f => ({ ...f, image: res.assets[0].uri }));
  };

  const save = () => {
    if (!form.name.trim()) { Alert.alert('Error','Item name is required.'); return; }
    if (!form.price)       { Alert.alert('Error','Price is required.'); return; }
    if (form.stock === '') { Alert.alert('Error','Stock is required.'); return; }
    onSave({ ...form, price: parseFloat(form.price)||0, stock: parseInt(form.stock)||0 });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <ScrollView contentContainerStyle={{ padding:16, flexGrow:1, justifyContent:'center' }} keyboardShouldPersistTaps="handled">
          <View style={ms.modalCard}>
            <Text style={ms.modalTitle}>{item?.name ? 'Edit Item' : 'Add New Item'}</Text>
            <TouchableOpacity style={ms.imgPicker} onPress={pickImage}>
              {form.image
                ? <Image source={{ uri:form.image }} style={ms.imgPreview} />
                : <View style={{ alignItems:'center', gap:3 }}>
                    <Text style={{ fontSize:38 }}>{form.emoji}</Text>
                    <Text style={ms.imgHint}>Tap to upload image</Text>
                  </View>
              }
              <View style={ms.imgBadge}><MaterialIcons name="photo-camera" size={13} color="#fff" /></View>
            </TouchableOpacity>
            {form.image && (
              <TouchableOpacity onPress={() => setForm(f=>({...f,image:null}))} style={{ alignSelf:'center', marginTop:-4 }}>
                <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#e74c3c' }}>Remove image</Text>
              </TouchableOpacity>
            )}
            {!form.image && (
              <View style={ms.fieldRow}>
                <Text style={ms.fieldLabel}>Emoji (if no image)</Text>
                <TextInput style={[ms.input,{textAlign:'center',fontSize:22}]}
                  value={form.emoji} onChangeText={v=>setForm(f=>({...f,emoji:v}))} placeholder="🍽️" />
              </View>
            )}
            <View style={ms.fieldRow}>
              <Text style={ms.fieldLabel}>Item Name *</Text>
              <TextInput style={ms.input} value={form.name}
                onChangeText={v=>setForm(f=>({...f,name:v}))} placeholder="e.g. Fried Chicken" />
            </View>
            <View style={ms.fieldRow}>
              <Text style={ms.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:4}}>
                <View style={{flexDirection:'row',gap:6}}>
                  {categories.filter(c=>c!=='All').map(cat=>(
                    <TouchableOpacity key={cat} style={[ms.chip, form.cat===cat && ms.chipActive]}
                      onPress={()=>setForm(f=>({...f,cat}))}>
                      <Text style={[ms.chipTxt, form.cat===cat && ms.chipTxtActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={{flexDirection:'row',gap:10}}>
              <View style={[ms.fieldRow,{flex:1}]}>
                <Text style={ms.fieldLabel}>Price (₱) *</Text>
                <TextInput style={ms.input} value={form.price}
                  onChangeText={v=>setForm(f=>({...f,price:v}))} keyboardType="numeric" placeholder="0.00" />
              </View>
              <View style={[ms.fieldRow,{flex:1}]}>
                <Text style={ms.fieldLabel}>Stock *</Text>
                <TextInput style={ms.input} value={form.stock}
                  onChangeText={v=>setForm(f=>({...f,stock:v}))} keyboardType="numeric" placeholder="0" />
              </View>
            </View>
            <View style={ms.modalActions}>
              <TouchableOpacity style={ms.cancelBtn} onPress={onClose}>
                <Text style={ms.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{flex:2,borderRadius:10,overflow:'hidden'}} onPress={save}>
                <LinearGradient colors={['#1a3a6b','#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:0}}
                  style={{paddingVertical:11,alignItems:'center'}}>
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
const AdEditModal = ({ visible, ad, onSave, onClose }) => {
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
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={[ms.modalCard,{maxWidth:420,alignSelf:'center',width:'90%'}]}>
          <Text style={ms.modalTitle}>Edit Ad Banner</Text>
          <TouchableOpacity style={[ms.imgPicker,{width:'100%',height:80,borderRadius:12}]} onPress={pickImage}>
            {form.image
              ? <Image source={{uri:form.image}} style={{width:'100%',height:80,borderRadius:12}} resizeMode="cover"/>
              : <View style={{alignItems:'center',gap:3}}><Text style={{fontSize:28}}>{form.emoji}</Text><Text style={ms.imgHint}>Tap to upload banner image</Text></View>
            }
          </TouchableOpacity>
          <View style={ms.fieldRow}>
            <Text style={ms.fieldLabel}>Or paste image URL</Text>
            <TextInput style={ms.input} value={form.imageUrl||''}
              onChangeText={v=>setForm(f=>({...f,imageUrl:v,image:null}))} placeholder="https://..." autoCapitalize="none"/>
          </View>
          <View style={ms.fieldRow}>
            <Text style={ms.fieldLabel}>Title</Text>
            <TextInput style={ms.input} value={form.title||''} onChangeText={v=>setForm(f=>({...f,title:v}))} placeholder="Ad title"/>
          </View>
          <View style={ms.fieldRow}>
            <Text style={ms.fieldLabel}>Subtitle</Text>
            <TextInput style={ms.input} value={form.sub||''} onChangeText={v=>setForm(f=>({...f,sub:v}))} placeholder="Ad subtitle"/>
          </View>
          <View style={ms.modalActions}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose}><Text style={ms.cancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={{flex:2,borderRadius:10,overflow:'hidden'}} onPress={()=>onSave(form)}>
              <LinearGradient colors={['#1a3a6b','#2e5fa3']} start={{x:0,y:0}} end={{x:1,y:0}}
                style={{paddingVertical:11,alignItems:'center'}}>
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
  modalCard: { backgroundColor:'#f0f5f9', borderRadius:20, padding:20, gap:10,
    shadowColor:'#000', shadowOpacity:0.25, shadowRadius:20, elevation:12 },
  modalTitle: { fontFamily:'GoogleSans_700Bold', fontSize:16, color:'#011f4b', textAlign:'center', marginBottom:4 },
  imgPicker: { alignSelf:'center', width:86, height:86, borderRadius:43,
    backgroundColor:'rgba(1,31,75,0.07)', borderWidth:2, borderColor:'rgba(1,31,75,0.15)',
    borderStyle:'dashed', justifyContent:'center', alignItems:'center' },
  imgPreview: { width:86, height:86, borderRadius:43 },
  imgHint: { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.40)', textAlign:'center' },
  imgBadge: { position:'absolute', bottom:2, right:2, backgroundColor:'#1a3a6b', borderRadius:10, padding:4 },
  fieldRow: { gap:4 },
  fieldLabel: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.50)', letterSpacing:1, textTransform:'uppercase' },
  input: { backgroundColor:'rgba(255,255,255,0.88)', borderRadius:8, paddingHorizontal:10, paddingVertical:9,
    fontFamily:'GoogleSans_400Regular', fontSize:13, color:'#011f4b',
    borderWidth:1, borderColor:'rgba(1,31,75,0.12)' },
  chip: { paddingHorizontal:10, paddingVertical:5, borderRadius:12, backgroundColor:'rgba(1,31,75,0.07)' },
  chipActive: { backgroundColor:'#1a3a6b' },
  chipTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)' },
  chipTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  modalActions: { flexDirection:'row', gap:10, marginTop:4 },
  cancelBtn: { flex:1, borderRadius:10, backgroundColor:'rgba(1,31,75,0.07)', paddingVertical:11, alignItems:'center' },
  cancelTxt: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'rgba(1,31,75,0.50)' },
});

// ─── ORDER HISTORY SCREEN ─────────────────────────────────────────────────────
const OrderHistoryScreen = ({ orders }) => {
  const [filter, setFilter] = useState('all');
  const FILTERS = [{k:'all',l:'All'},{k:'pending',l:'Pending'},{k:'preparing',l:'Preparing'},{k:'ready',l:'Ready'},{k:'done',l:'Done'}];
  const filtered = filter==='all' ? orders : orders.filter(o=>o.status===filter);
  return (
    <View style={sub.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:12}}
        contentContainerStyle={{gap:6,paddingVertical:2}}>
        <View style={{flexDirection:'row',gap:6}}>
          {FILTERS.map(f=>(
            <TouchableOpacity key={f.k} style={[sub.filterBtn,filter===f.k&&sub.filterBtnActive]} onPress={()=>setFilter(f.k)}>
              <Text style={[sub.filterTxt,filter===f.k&&sub.filterTxtActive]}>{f.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}}>
        {filtered.length===0
          ? <View style={sub.emptyBox}><MaterialIcons name="history" size={48} color="rgba(1,31,75,0.15)"/><Text style={sub.emptyTxt}>No orders found.</Text></View>
          : filtered.map(order => {
            const st = ORDER_STATUSES[order.status] || ORDER_STATUSES.pending;
            return (
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
                  <Text style={sub.orderPay}>{order.payment==='gcash'?'📱 GCash':'💵 Cash'}</Text>
                </View>
              </View>
            );
          })
        }
      </ScrollView>
    </View>
  );
};

// ─── STOCKS SCREEN ────────────────────────────────────────────────────────────
const StocksScreen = ({ items, onEdit }) => {
  const low    = items.filter(i=>i.stock>0&&i.stock<=5);
  const out    = items.filter(i=>i.stock===0);
  const normal = items.filter(i=>i.stock>5);
  const Section = ({ title, color, data }) => data.length===0 ? null : (
    <View style={{marginBottom:14}}>
      <View style={[sub.sectionHead,{borderLeftColor:color}]}>
        <Text style={[sub.sectionTitle,{color}]}>{title} ({data.length})</Text>
      </View>
      {data.map(item=>(
        <View key={item.id} style={sub.stockRow}>
          <View style={sub.stockImgWrap}>
            {item.image ? <Image source={{uri:item.image}} style={sub.stockImg}/> : <Text style={{fontSize:22}}>{item.emoji}</Text>}
          </View>
          <View style={{flex:1,minWidth:0}}>
            <Text style={sub.stockName} numberOfLines={1}>{item.name}</Text>
            <Text style={sub.stockCat}>{item.cat} • ₱{item.price}</Text>
          </View>
          <View style={[sub.stockQtyBox,item.stock===0&&{backgroundColor:'rgba(231,76,60,0.12)'},item.stock<=5&&item.stock>0&&{backgroundColor:'rgba(243,156,18,0.12)'}]}>
            <Text style={[sub.stockQty,item.stock===0&&{color:'#e74c3c'},item.stock<=5&&item.stock>0&&{color:'#e67e22'}]}>{item.stock}</Text>
            <Text style={sub.stockQtyLbl}>pcs</Text>
          </View>
          <TouchableOpacity style={sub.editBtn} onPress={()=>onEdit(item)}>
            <MaterialIcons name="edit" size={15} color="#1a3a6b"/>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
  return (
    <View style={sub.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:14}} contentContainerStyle={{paddingVertical:2}}>
        <View style={sub.statRow}>
          {[{l:'Total',v:items.length,c:'#1a3a6b'},{l:'Normal',v:normal.length,c:'#27ae60'},{l:'Low Stock',v:low.length,c:'#e67e22'},{l:'Out',v:out.length,c:'#e74c3c'}].map(s=>(
            <View key={s.l} style={sub.statCard}><Text style={[sub.statVal,{color:s.c}]}>{s.v}</Text><Text style={sub.statLbl}>{s.l}</Text></View>
          ))}
        </View>
      </ScrollView>
      <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}}>
        <Section title="Out of Stock" color="#e74c3c" data={out} />
        <Section title="Low Stock (≤5)" color="#e67e22" data={low} />
        <Section title="In Stock" color="#27ae60" data={normal} />
      </ScrollView>
    </View>
  );
};

// ─── INVENTORY SCREEN ─────────────────────────────────────────────────────────
const InventoryScreen = ({ items }) => {
  const [sort,setSort] = useState('name');
  const totalValue = items.reduce((s,i)=>s+i.price*i.stock,0);
  const sorted = [...items].sort((a,b)=>{
    if(sort==='name')  return a.name.localeCompare(b.name);
    if(sort==='price') return b.price-a.price;
    if(sort==='stock') return b.stock-a.stock;
    if(sort==='value') return (b.price*b.stock)-(a.price*a.stock);
    return 0;
  });
  return (
    <View style={sub.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:8}} contentContainerStyle={{paddingVertical:2}}>
        <View style={sub.statRow}>
          {[{l:'Items',v:items.length,c:'#1a3a6b'},{l:'In Stock',v:items.filter(i=>i.stock>0).length,c:'#27ae60'},{l:'Out',v:items.filter(i=>i.stock===0).length,c:'#e74c3c'},{l:'Total Value',v:`₱${totalValue.toLocaleString()}`,c:'#c9a84c'}].map(s=>(
            <View key={s.l} style={sub.statCard}><Text style={[sub.statVal,{color:s.c,fontSize:s.l==='Total Value'?12:16}]}>{s.v}</Text><Text style={sub.statLbl}>{s.l}</Text></View>
          ))}
        </View>
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:8}} contentContainerStyle={{gap:6,paddingVertical:2}}>
        {[{k:'name',l:'Name'},{k:'price',l:'Price'},{k:'stock',l:'Stock'},{k:'value',l:'Value'}].map(s=>(
          <TouchableOpacity key={s.k} style={[sub.sortChip,sort===s.k&&sub.sortChipActive]} onPress={()=>setSort(s.k)}>
            <Text style={[sub.sortTxt,sort===s.k&&sub.sortTxtActive]}>Sort: {s.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={sub.tableHead}>
        <Text style={[sub.thCell,{flex:2}]}>ITEM</Text>
        <Text style={sub.thCell}>CAT</Text>
        <Text style={sub.thCell}>PRICE</Text>
        <Text style={sub.thCell}>STOCK</Text>
        <Text style={[sub.thCell,{textAlign:'right'}]}>VALUE</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}}>
        {sorted.map((item,idx)=>(
          <View key={item.id} style={[sub.tableRow,idx%2===0&&{backgroundColor:'rgba(255,255,255,0.35)'}]}>
            <Text style={[sub.tdCell,{flex:2,fontFamily:'GoogleSans_700Bold'}]} numberOfLines={1}>{item.emoji} {item.name}</Text>
            <Text style={sub.tdCell} numberOfLines={1}>{item.cat}</Text>
            <Text style={sub.tdCell}>₱{item.price}</Text>
            <Text style={[sub.tdCell,item.stock===0&&{color:'#e74c3c',fontFamily:'GoogleSans_700Bold'},item.stock<=5&&item.stock>0&&{color:'#e67e22',fontFamily:'GoogleSans_700Bold'}]}>{item.stock}</Text>
            <Text style={[sub.tdCell,{textAlign:'right',fontFamily:'GoogleSans_700Bold',color:'#1a3a6b'}]}>₱{(item.price*item.stock).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

// ─── SALES REPORT SCREEN ──────────────────────────────────────────────────────
const SalesReportScreen = ({ orders }) => {
  const done = orders.filter(o=>o.status==='done');
  const totalSales = done.reduce((s,o)=>s+Number(o.total),0);
  const cashTotal  = done.filter(o=>o.payment==='cash').reduce((s,o)=>s+Number(o.total),0);
  const gcashTotal = done.filter(o=>o.payment==='gcash').reduce((s,o)=>s+Number(o.total),0);
  const itemMap = {};
  done.forEach(o=>(o.items||[]).forEach(i=>{
    const name = i.item?.name||i.name||'Item';
    itemMap[name]=(itemMap[name]||0)+i.qty;
  }));
  const topItems = Object.entries(itemMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return (
    <View style={sub.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:14}} contentContainerStyle={{paddingVertical:2}}>
        <View style={sub.statRow}>
          {[{l:'Total Sales',v:`₱${totalSales.toFixed(2)}`,c:'#27ae60'},{l:'Orders Done',v:done.length,c:'#1a3a6b'},{l:'Cash',v:`₱${cashTotal.toFixed(2)}`,c:'#c9a84c'},{l:'GCash',v:`₱${gcashTotal.toFixed(2)}`,c:'#2e5fa3'}].map(s=>(
            <View key={s.l} style={sub.statCard}><Text style={[sub.statVal,{color:s.c,fontSize:12}]}>{s.v}</Text><Text style={sub.statLbl}>{s.l}</Text></View>
          ))}
        </View>
      </ScrollView>
      <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}}>
        {topItems.length>0&&(
          <View style={{marginBottom:16}}>
            <Text style={sub.sectionTitle2}>🏆 Top Selling Items</Text>
            {topItems.map(([name,qty],i)=>(
              <View key={name} style={sub.topItemRow}>
                <Text style={sub.topItemRank}>#{i+1}</Text>
                <Text style={[sub.topItemName,{flex:1}]} numberOfLines={1}>{name}</Text>
                <View style={[sub.topItemBar,{width:`${Math.min(100,(qty/topItems[0][1])*100)}%`}]}/>
                <Text style={sub.topItemQty}>{qty} sold</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={sub.sectionTitle2}>📋 Completed Orders</Text>
        {done.length===0
          ? <View style={sub.emptyBox}><Text style={sub.emptyTxt}>No completed orders yet.</Text></View>
          : <>
            <View style={sub.tableHead}>
              <Text style={[sub.thCell,{flex:1.2}]}>ORDER</Text>
              <Text style={sub.thCell}>TIME</Text>
              <Text style={sub.thCell}>TOTAL</Text>
              <Text style={[sub.thCell,{textAlign:'right'}]}>PAY</Text>
            </View>
            {done.map((order,idx)=>(
              <View key={order.id} style={[sub.tableRow,idx%2===0&&{backgroundColor:'rgba(255,255,255,0.35)'}]}>
                <Text style={[sub.tdCell,{flex:1.2,fontFamily:'GoogleSans_700Bold',color:'#1a3a6b'}]} numberOfLines={1}>#{order.orderNo||order.id}</Text>
                <Text style={sub.tdCell} numberOfLines={1}>{order.time}</Text>
                <Text style={[sub.tdCell,{fontFamily:'GoogleSans_700Bold',color:'#c9a84c'}]}>₱{Number(order.total).toFixed(2)}</Text>
                <Text style={[sub.tdCell,{textAlign:'right'}]}>{order.payment==='gcash'?'📱':'💵'}</Text>
              </View>
            ))}
          </>
        }
      </ScrollView>
    </View>
  );
};

// ─── EMPLOYEE CREDITS ─────────────────────────────────────────────────────────
const EmployeeCreditsScreen = () => (
  <View style={[sub.root,{justifyContent:'center',alignItems:'center',gap:14}]}>
    <MaterialIcons name="account-balance" size={64} color="rgba(1,31,75,0.15)"/>
    <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:20,color:'rgba(1,31,75,0.30)'}}>Coming Soon</Text>
    <Text style={sub.emptyTxt}>Employee credit tracking will be{'\n'}available in a future update.</Text>
  </View>
);

// ─── LIVE QUEUE — CANTEEN ORDER MONITOR ──────────────────────────────────────
const LiveQueueScreen = ({ orders, onUpdateStatus }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const { width } = useWindowDimensions();
  const isWide = width >= 680;
  const [tab, setTab] = useState('pending');

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim,{toValue:0.15,duration:700,useNativeDriver:true}),
      Animated.timing(pulseAnim,{toValue:1,   duration:700,useNativeDriver:true}),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const pending   = orders.filter(o => o.status === 'pending');
  const preparing = orders.filter(o => o.status === 'preparing');
  const ready     = orders.filter(o => o.status === 'ready');
  const done      = orders.filter(o => o.status === 'done');

  // ── Mini order card ────────────────────────────────────────────────────────
  const OrderCard = ({ order, colColor }) => {
    const st = ORDER_STATUSES[order.status] || ORDER_STATUSES.pending;
    return (
      <View style={[qm.card, {borderLeftColor:colColor}]}>
        {/* ID + time on same row */}
        <View style={qm.cardRow}>
          <Text style={qm.cardId} numberOfLines={1}>#{order.orderNo||order.id?.slice(-5)||'---'}</Text>
          <Text style={qm.cardTime}>{order.time||''}</Text>
        </View>
        {/* Items */}
        {(order.items||[]).map((i,idx)=>{
          const name  = i.item?.name||i.name||'Item';
          const price = i.item?.price||i.price||0;
          return (
            <View key={idx} style={qm.itemRow}>
              <Text style={qm.itemName} numberOfLines={1}>{name} ×{i.qty}</Text>
              <Text style={qm.itemPrice}>₱{(price*i.qty).toFixed(0)}</Text>
            </View>
          );
        })}
        {/* Footer */}
        <View style={qm.cardFoot}>
          <Text style={qm.totalAmt}>₱{Number(order.total).toFixed(0)}</Text>
          <Text style={qm.payIcon}>{order.payment==='gcash'?'📱':'💵'}</Text>
          {st.next && (
            <>
              <TouchableOpacity style={[qm.actionBtn,{backgroundColor:st.nextColor||st.color}]}
                onPress={()=>onUpdateStatus(order.id,st.next)} activeOpacity={0.82}>
                <Text style={qm.actionBtnTxt} numberOfLines={1}>
                  {st.nextLabel.replace(/^[^\w]*\w+\s/,'')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={qm.skipBtn}
                onPress={()=>onUpdateStatus(order.id,'done')} activeOpacity={0.82}>
                <Text style={qm.skipTxt}>✕</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // ── Scrollable column ──────────────────────────────────────────────────────
  const Column = ({ title, colOrders, color, icon }) => (
    <View style={qm.column}>
      <View style={[qm.colHeader,{borderBottomColor:color}]}>
        <Text style={[qm.colTitle,{color}]}>{icon} {title}</Text>
        <View style={[qm.colBadge,{backgroundColor:color}]}>
          <Text style={qm.colBadgeTxt}>{colOrders.length}</Text>
        </View>
      </View>
      <ScrollView style={{flex:1}} showsVerticalScrollIndicator
        contentContainerStyle={{gap:5,paddingBottom:8}}>
        {colOrders.length===0
          ? <View style={qm.colEmpty}>
              <Text style={{fontSize:18,opacity:0.2,textAlign:'center'}}>{icon}</Text>
              <Text style={qm.colEmptyTxt}>Empty</Text>
            </View>
          : colOrders.map(o=><OrderCard key={o.id} order={o} colColor={color}/>)
        }
      </ScrollView>
    </View>
  );

  const tabCols = {
    pending:   {orders:pending,   color:'#b8952a', icon:'⏳'},
    preparing: {orders:preparing, color:'#2471a3', icon:'🔥'},
    ready:     {orders:ready,     color:'#1a7a4a', icon:'✅'},
  };

  return (
    <View style={qm.root}>

      {/* ── Top bar ── */}
      <View style={qm.topBar}>
        <View style={{flex:1,minWidth:0}}>
          <Text style={qm.title} numberOfLines={1}>
            <Text style={{color:'#c9a84c'}}>Canteen </Text>Order Monitor
          </Text>
          <Text style={qm.subtitle}>CESLA CANTEEN ADMIN PANEL</Text>
        </View>
        <View style={qm.livePill}>
          <Animated.View style={[qm.liveDot,{opacity:pulseAnim}]}/>
          <Text style={qm.liveTxt}>LIVE</Text>
        </View>
      </View>

      {/* ── Stat chips ── */}
      <View style={qm.statRow}>
        {[
          {lbl:'PENDING',   val:pending.length,   col:'#b8952a'},
          {lbl:'PREPARING', val:preparing.length, col:'#2471a3'},
          {lbl:'READY',     val:ready.length,     col:'#1a7a4a'},
          {lbl:'TODAY',     val:orders.length,    col:'rgba(10,35,65,0.50)'},
        ].map(s=>(
          <View key={s.lbl} style={qm.statCard}>
            <Text style={[qm.statVal,{color:s.col}]}>{s.val}</Text>
            <Text style={qm.statLbl}>{s.lbl}</Text>
          </View>
        ))}
      </View>

      {/* ── Empty state ── */}
      {orders.length===0 && (
        <View style={qm.emptyState}>
          <MaterialIcons name="receipt-long" size={36} color="rgba(10,35,65,0.15)"/>
          <Text style={qm.emptyTxt}>No orders yet</Text>
        </View>
      )}

      {/* ── Kanban (flex:1 + minHeight:0 = fills space without overflow) ── */}
      {orders.length>0 && (
        isWide ? (
          <View style={qm.kanban}>
            <Column title="Pending"   colOrders={pending}   color="#b8952a" icon="⏳"/>
            <Column title="Preparing" colOrders={preparing} color="#2471a3" icon="🔥"/>
            <Column title="Ready"     colOrders={ready}     color="#1a7a4a" icon="✅"/>
          </View>
        ) : (
          <View style={{flex:1,minHeight:0}}>
            <View style={qm.tabRow}>
              {Object.entries(tabCols).map(([k,c])=>(
                <TouchableOpacity key={k}
                  style={[qm.tab, tab===k&&{borderBottomColor:c.color,borderBottomWidth:2}]}
                  onPress={()=>setTab(k)}>
                  <Text style={[qm.tabTxt, tab===k&&{color:c.color}]}>
                    {c.icon} {k.charAt(0).toUpperCase()+k.slice(1)}
                  </Text>
                  <View style={[qm.tabBadge,{backgroundColor:c.color}]}>
                    <Text style={qm.tabBadgeTxt}>{c.orders.length}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView style={{flex:1}} showsVerticalScrollIndicator
              contentContainerStyle={{gap:6,padding:8}}>
              {tabCols[tab].orders.length===0
                ? <View style={[qm.colEmpty,{marginTop:24}]}>
                    <Text style={{fontSize:24,opacity:0.2}}>{tabCols[tab].icon}</Text>
                    <Text style={qm.colEmptyTxt}>No orders</Text>
                  </View>
                : tabCols[tab].orders.map(o=>(
                    <OrderCard key={o.id} order={o} colColor={tabCols[tab].color}/>
                  ))
              }
            </ScrollView>
          </View>
        )
      )}

      {/* ── Done strip ── */}
      {done.length>0 && (
        <View style={qm.doneStrip}>
          <Text style={qm.doneLbl}>✓ DONE ({done.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap:5,paddingVertical:1}}>
            {done.map(o=>(
              <View key={o.id} style={qm.doneChip}>
                <Text style={qm.doneChipTxt}>
                  #{o.orderNo||o.id?.slice(-5)} · ₱{Number(o.total).toFixed(0)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

// ── Live Queue styles (compact, overflow-safe) ────────────────────────────────
const qm = StyleSheet.create({
  // flex:1 + overflow hidden — panel container clips it perfectly
  root: { flex:1, backgroundColor:'#98bad5', overflow:'hidden' },

  // Top bar
  topBar: { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingHorizontal:12, paddingTop:10, paddingBottom:6 },
  title:    { fontFamily:'NotoSerif_700Bold', fontSize:14, color:'#0d2540' },
  subtitle: { fontFamily:'GoogleSans_700Bold', fontSize:7, color:'rgba(10,35,65,0.40)',
    letterSpacing:1.8, marginTop:1 },
  livePill: { flexDirection:'row', alignItems:'center', gap:4,
    borderWidth:1, borderColor:'#1a7a4a', borderRadius:16,
    paddingHorizontal:7, paddingVertical:3, backgroundColor:'rgba(26,122,74,0.12)' },
  liveDot: { width:5, height:5, borderRadius:3, backgroundColor:'#1a7a4a' },
  liveTxt: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'#1a7a4a', letterSpacing:1 },

  // Stat chips
  statRow: { flexDirection:'row', gap:5, paddingHorizontal:8, paddingBottom:7 },
  statCard: { flex:1, backgroundColor:'rgba(10,45,80,0.14)', borderRadius:9, padding:7,
    borderWidth:1, borderColor:'rgba(255,255,255,0.45)' },
  statVal:  { fontFamily:'GoogleSans_700Bold', fontSize:16, lineHeight:19 },
  statLbl:  { fontFamily:'GoogleSans_700Bold', fontSize:6, color:'rgba(10,35,65,0.50)',
    letterSpacing:1, marginTop:1 },

  // Kanban — fills remaining space, no overflow
  kanban: { flex:1, minHeight:0, flexDirection:'row', paddingHorizontal:5 },
  column: { flex:1, minHeight:0, marginHorizontal:3 },
  colHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingBottom:4, borderBottomWidth:1.5, marginBottom:5 },
  colTitle:  { fontFamily:'GoogleSans_700Bold', fontSize:9, letterSpacing:1 },
  colBadge:  { width:15, height:15, borderRadius:8, alignItems:'center', justifyContent:'center' },
  colBadgeTxt: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'#fff' },
  colEmpty:  { alignItems:'center', gap:3, paddingTop:20 },
  colEmptyTxt: { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(10,35,65,0.32)' },

  // Order card — intentionally small
  card: { backgroundColor:'rgba(255,255,255,0.60)', borderRadius:8, padding:8,
    borderLeftWidth:2.5, gap:3,
    borderWidth:1, borderColor:'rgba(255,255,255,0.85)',
    shadowColor:'#0d2540', shadowOpacity:0.08, shadowRadius:3, elevation:1 },
  cardRow:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  cardId:   { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#0d2540', flex:1 },
  cardTime: { fontFamily:'GoogleSans_400Regular', fontSize:8,
    color:'rgba(10,35,65,0.40)', flexShrink:0 },
  itemRow:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  itemName: { fontFamily:'GoogleSans_400Regular', fontSize:9,
    color:'rgba(10,35,65,0.72)', flex:1 },
  itemPrice:{ fontFamily:'GoogleSans_700Bold', fontSize:9, color:'#b8952a', flexShrink:0 },

  // Card footer: total · emoji · action · skip
  cardFoot: { flexDirection:'row', alignItems:'center', gap:4, marginTop:1 },
  totalAmt: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#b8952a' },
  payIcon:  { fontSize:11 },
  actionBtn:{ flex:1, borderRadius:6, paddingVertical:5, alignItems:'center' },
  actionBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'#fff' },
  skipBtn:  { backgroundColor:'rgba(10,45,80,0.10)', borderRadius:6,
    paddingVertical:5, paddingHorizontal:7, alignItems:'center',
    borderWidth:1, borderColor:'rgba(10,45,80,0.15)' },
  skipTxt:  { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'rgba(10,35,65,0.50)' },

  // Narrow tab bar
  tabRow: { flexDirection:'row', borderBottomWidth:1,
    borderColor:'rgba(10,35,65,0.10)', paddingHorizontal:8 },
  tab: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
    gap:3, paddingVertical:7, borderBottomColor:'transparent', borderBottomWidth:2 },
  tabTxt: { fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(10,35,65,0.45)' },
  tabBadge: { borderRadius:6, minWidth:14, height:14,
    alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  tabBadgeTxt: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'#fff' },

  // Done strip at bottom
  doneStrip: { paddingHorizontal:8, paddingTop:5, paddingBottom:4,
    borderTopWidth:1, borderColor:'rgba(10,35,65,0.08)' },
  doneLbl: { fontFamily:'GoogleSans_700Bold', fontSize:7,
    color:'rgba(10,35,65,0.35)', letterSpacing:1.2, marginBottom:3 },
  doneChip: { backgroundColor:'rgba(10,45,80,0.09)', borderRadius:7,
    paddingHorizontal:8, paddingVertical:4,
    borderWidth:1, borderColor:'rgba(255,255,255,0.55)' },
  doneChipTxt: { fontFamily:'GoogleSans_400Regular', fontSize:9,
    color:'rgba(10,35,65,0.55)' },

  // Empty state
  emptyState: { flex:1, alignItems:'center', justifyContent:'center', gap:6 },
  emptyTxt:   { fontFamily:'GoogleSans_700Bold', fontSize:13,
    color:'rgba(10,35,65,0.25)' },
});

// ─── SHARED SUB-SCREEN STYLES ─────────────────────────────────────────────────
const sub = StyleSheet.create({
  root: { flex:1, padding:14 },
  emptyBox: { flex:1, alignItems:'center', justifyContent:'center', gap:10, paddingTop:60 },
  emptyTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.35)', textAlign:'center', lineHeight:18 },
  filterBtn: { paddingHorizontal:14, paddingVertical:7, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.40)', borderWidth:1, borderColor:'rgba(255,255,255,0.60)' },
  filterBtnActive: { backgroundColor:'#1a3a6b', borderColor:'#c9a84c' },
  filterTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.60)' },
  filterTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  statRow: { flexDirection:'row', gap:8 },
  statCard: { minWidth:80, backgroundColor:'rgba(255,255,255,0.60)', borderRadius:12, padding:10, alignItems:'center', gap:3 },
  statVal:  { fontFamily:'GoogleSans_700Bold', fontSize:16, color:'#1a3a6b' },
  statLbl:  { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.45)', textAlign:'center' },
  sectionHead: { borderLeftWidth:3, paddingLeft:10, marginBottom:8 },
  sectionTitle: { fontFamily:'GoogleSans_700Bold', fontSize:12, letterSpacing:0.5 },
  sectionTitle2:{ fontFamily:'GoogleSans_700Bold', fontSize:12, color:'rgba(1,31,75,0.55)', letterSpacing:1,
    textTransform:'uppercase', marginBottom:8, marginTop:4 },
  stockRow: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:9,
    borderBottomWidth:1, borderColor:'rgba(1,31,75,0.06)' },
  stockImgWrap:{ width:36, height:36, borderRadius:18, backgroundColor:'rgba(1,31,75,0.06)',
    alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 },
  stockImg: { width:36, height:36, borderRadius:18 },
  stockName:{ fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#1a2d4e' },
  stockCat: { fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(1,31,75,0.45)' },
  stockQtyBox: { backgroundColor:'rgba(39,174,96,0.12)', borderRadius:8, paddingHorizontal:8, paddingVertical:4, alignItems:'center', flexShrink:0 },
  stockQty:    { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#27ae60' },
  stockQtyLbl: { fontFamily:'GoogleSans_400Regular', fontSize:8, color:'rgba(1,31,75,0.40)' },
  editBtn: { padding:6, backgroundColor:'rgba(1,31,75,0.07)', borderRadius:8, flexShrink:0 },
  sortChip: { paddingHorizontal:12, paddingVertical:6, borderRadius:14,
    backgroundColor:'rgba(255,255,255,0.40)', borderWidth:1, borderColor:'rgba(255,255,255,0.60)' },
  sortChipActive: { backgroundColor:'#1a3a6b' },
  sortTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)' },
  sortTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  tableHead: { flexDirection:'row', paddingVertical:8, paddingHorizontal:10,
    backgroundColor:'rgba(26,58,107,0.12)', borderRadius:8, marginBottom:4 },
  thCell: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.55)', flex:1, letterSpacing:0.5 },
  tableRow:{ flexDirection:'row', paddingVertical:9, paddingHorizontal:10, borderRadius:6, marginBottom:2 },
  tdCell:  { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#1a2d4e', flex:1 },
  topItemRow: { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:7,
    borderBottomWidth:1, borderColor:'rgba(1,31,75,0.06)' },
  topItemRank:{ fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#c9a84c', width:24, flexShrink:0 },
  topItemName:{ fontFamily:'GoogleSans_400Regular', fontSize:12, color:'#1a2d4e' },
  topItemBar: { height:6, backgroundColor:'rgba(26,58,107,0.20)', borderRadius:3, maxWidth:80 },
  topItemQty: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#1a3a6b', width:55, textAlign:'right', flexShrink:0 },
  orderCard: { backgroundColor:'rgba(255,255,255,0.65)', borderRadius:12, padding:12, marginBottom:8,
    borderWidth:1, borderColor:'rgba(255,255,255,0.80)', gap:6 },
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

// ─── DROPDOWN MENU ────────────────────────────────────────────────────────────
const DropdownMenu = ({ visible, activeScreen, pendingCount, onSelect }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-8)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {toValue:1,duration:160,useNativeDriver:true}),
        Animated.timing(slideAnim,{toValue:0,duration:160,useNativeDriver:true}),
      ]).start();
    } else { fadeAnim.setValue(0); slideAnim.setValue(-8); }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[dd.menu,{opacity:fadeAnim,transform:[{translateY:slideAnim}]}]}>
      {SUB_SCREENS.map((s,idx)=>(
        <TouchableOpacity key={s.key}
          style={[dd.item,idx<SUB_SCREENS.length-1&&dd.itemBorder,activeScreen===s.key&&dd.itemActive]}
          onPress={()=>onSelect(s.key)}>
          <MaterialIcons name={s.icon} size={17} color={activeScreen===s.key?'#1a3a6b':'rgba(1,31,75,0.55)'}/>
          <Text style={[dd.itemTxt,activeScreen===s.key&&{fontFamily:'GoogleSans_700Bold',color:'#1a3a6b'}]}>{s.label}</Text>
          {s.badge==='LIVE'&&pendingCount>0&&(
            <View style={dd.liveBadge}><Text style={dd.liveBadgeTxt}>{pendingCount}</Text></View>
          )}
          {activeScreen===s.key&&<MaterialIcons name="check" size={14} color="#1a3a6b"/>}
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
};
const dd = StyleSheet.create({
  menu: { position:'absolute', top:48, right:0, backgroundColor:'#fff',
    borderRadius:14, paddingVertical:5, minWidth:210, zIndex:999,
    shadowColor:'#000', shadowOpacity:0.18, shadowRadius:16, elevation:14,
    borderWidth:1, borderColor:'rgba(1,31,75,0.07)' },
  item: { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:11, gap:10 },
  itemBorder: { borderBottomWidth:1, borderColor:'rgba(1,31,75,0.05)' },
  itemActive: { backgroundColor:'rgba(26,58,107,0.06)' },
  itemTxt: { fontFamily:'GoogleSans_400Regular', fontSize:13, color:'rgba(1,31,75,0.70)', flex:1 },
  liveBadge: { backgroundColor:'#e74c3c', borderRadius:8, minWidth:18, height:18, alignItems:'center', justifyContent:'center', paddingHorizontal:4 },
  liveBadgeTxt: { fontFamily:'GoogleSans_700Bold', fontSize:9, color:'#fff' },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function ManageCanteenScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const isWide  = width >= 768;
  const isSmall = width < 400;
  const COLS    = Platform.OS === 'web' ? 5 : 3;

  const {
    items, ads, categories, orders,
    saveItem, deleteItem, saveAd, updateOrderStatus,
    reloadFromStorage,
  } = useCanteen();

  const [fontsLoaded] = useFonts({
    NotoSerif_700Bold, GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_700Bold,
  });

  const [activeScreen,   setActiveScreen]   = useState('items');
  const [activeCategory, setActiveCategory] = useState('All');
  const [search,         setSearch]         = useState('');
  const [menuOpen,       setMenuOpen]       = useState(false);

  useFocusEffect(
    useCallback(() => { reloadFromStorage(); }, [reloadFromStorage])
  );

  const [editItem,      setEditItem]      = useState(null);
  const [editItemModal, setEditItemModal] = useState(false);
  const [editAd,        setEditAd]        = useState(null);
  const [editAdModal,   setEditAdModal]   = useState(false);
  const [adCurrent,     setAdCurrent]     = useState(0);

  const hdrFade     = useRef(new Animated.Value(0)).current;
  const hdrTrans    = useRef(new Animated.Value(-16)).current;
  const bodyFade    = useRef(new Animated.Value(0)).current;
  const adAnim      = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const adScrollRef = useRef(null);

  const H_MARGIN = isSmall ? 8 : 10;
  const C_PAD    = Platform.OS === 'web' ? 12 : 10;
  const bannerW  = isWide
    ? Math.min(width * 0.55, 700)
    : width - (H_MARGIN * 2) - (C_PAD * 2);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade, {toValue:1,duration:500,useNativeDriver:true}),
      Animated.timing(hdrTrans,{toValue:0,duration:500,useNativeDriver:true}),
    ]).start();
    Animated.timing(bodyFade,{toValue:1,duration:500,delay:150,useNativeDriver:true}).start();
  }, []);

  useEffect(() => {
    if (!ads.length) return;
    const t = setInterval(() => {
      setAdCurrent(prev => {
        const next = (prev+1) % ads.length;
        adScrollRef.current?.scrollTo({x:next*bannerW,animated:true});
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [ads.length, bannerW]);

  const handleSearch = (text) => {
    setSearch(text);
    if (!text.trim()) return;
    const cats = [...new Set(items.filter(i=>i.name.toLowerCase().includes(text.toLowerCase())).map(i=>i.cat))];
    setActiveCategory(cats.length===1 ? cats[0] : 'All');
  };

  const filtered = items.filter(i => {
    if (search.trim()) return i.name.toLowerCase().includes(search.toLowerCase());
    return activeCategory==='All' || i.cat===activeCategory;
  });

  const openAddItem  = () => { setEditItem(emptyItem()); setEditItemModal(true); };
  const openEditItem = (item) => { setEditItem({...item,price:String(item.price),stock:String(item.stock)}); setEditItemModal(true); };
  const handleSaveItem   = (updated) => { saveItem(updated); setEditItemModal(false); };
  const handleDeleteItem = (id) => {
    Alert.alert('Delete Item','Are you sure?',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive',onPress:()=>deleteItem(id)},
    ]);
  };
  const handleSaveAd    = (updated) => { saveAd(updated); setEditAdModal(false); };
  const handleMenuSelect = (key)    => { setMenuOpen(false); setActiveScreen(key); };

  const pendingCount = orders.filter(o=>o.status==='pending').length;
  const currentScreenLabel = SUB_SCREENS.find(s=>s.key===activeScreen)?.label || 'Menu Items';

  if (!fontsLoaded) return null;

  const renderSubScreen = () => {
    if (activeScreen==='queue')     return <LiveQueueScreen orders={orders} onUpdateStatus={updateOrderStatus}/>;
    if (activeScreen==='history')   return <OrderHistoryScreen orders={orders}/>;
    if (activeScreen==='stocks')    return <StocksScreen items={items} onEdit={(item)=>{setActiveScreen('items');setTimeout(()=>openEditItem(item),200);}}/>;
    if (activeScreen==='inventory') return <InventoryScreen items={items}/>;
    if (activeScreen==='report')    return <SalesReportScreen orders={orders}/>;
    if (activeScreen==='credits')   return <EmployeeCreditsScreen/>;
    return null;
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>
      <View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#98bad5'}]}/>
      <LinearGradient colors={['rgba(198,220,235,0.85)','rgba(152,186,213,0.40)','rgba(80,110,150,0.0)']}
        locations={[0,0.45,1]} start={{x:0.5,y:0.1}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>
      <LinearGradient colors={['rgba(50,80,120,0.45)','rgba(50,80,120,0.0)','rgba(50,80,120,0.45)']}
        locations={[0,0.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFillObject}/>
      <LinearGradient colors={['rgba(50,80,120,0.0)','rgba(60,90,130,0.35)']}
        locations={[0.4,1]} start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject}/>

      {/* HEADER */}
      <Animated.View style={{opacity:hdrFade,transform:[{translateY:hdrTrans}],
        marginTop:Platform.OS==='web'?16:36,marginHorizontal:isSmall?8:10,zIndex:30}}>
        <View style={[styles.header,{paddingHorizontal:isWide?40:12,paddingVertical:isWide?16:7}]}>
          <TouchableOpacity style={styles.backBtn} onPress={()=>navigation&&navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerH1,{fontSize:isWide?20:isSmall?13:15}]} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={styles.headerGold}>CESLA </Text>Canteen Management
            </Text>
            <View style={styles.visitorTag}>
              <Text style={styles.visitorTagText}>🍽️  ADMIN  •  {currentScreenLabel.toUpperCase()}</Text>
            </View>
          </View>
          <View style={{flexDirection:'row',gap:8,alignItems:'center',position:'relative'}}>
            <TouchableOpacity style={styles.iconBtn} onPress={()=>handleMenuSelect('queue')}>
              <MaterialIcons name="notifications" size={19} color="#fff"/>
              {pendingCount>0&&(
                <View style={styles.notifBadge}><Text style={styles.notifBadgeTxt}>{pendingCount}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={()=>setMenuOpen(v=>!v)}>
              <MaterialIcons name="menu" size={19} color="#fff"/>
            </TouchableOpacity>
            <DropdownMenu visible={menuOpen} activeScreen={activeScreen}
              pendingCount={pendingCount} onSelect={handleMenuSelect}/>
          </View>
        </View>
      </Animated.View>

      {/* BODY */}
      <Animated.View style={[styles.body,{opacity:bodyFade,flex:1,minHeight:0}]}>
        {activeScreen!=='items' ? (
          <View style={{flex:1,
            marginHorizontal: isWide?20:10,
            marginBottom:16,
            backgroundColor: activeScreen==='queue' ? '#7aa8c7' : 'rgba(255,255,255,0.22)',
            borderRadius:16,
            borderWidth:1,
            borderColor: activeScreen==='queue' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.40)',
            overflow:'hidden',alignSelf:'stretch'}}>
            {renderSubScreen()}
          </View>
        ) : (
          <>
            {isWide && (
              <View style={styles.catPanel}>
                <Text style={styles.catPanelTitle}>CATEGORIES</Text>
                {categories.map(cat=>(
                  <TouchableOpacity key={cat} style={[styles.catBtn,activeCategory===cat&&styles.catBtnActive]}
                    onPress={()=>setActiveCategory(cat)}>
                    <Text style={[styles.catBtnText,activeCategory===cat&&styles.catBtnTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={[styles.centerPanel,{minWidth:0}]}>
              {!isWide&&(
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={{flexGrow:0,marginBottom:8}} contentContainerStyle={{paddingHorizontal:4,gap:5,paddingVertical:2}}>
                  {categories.map(cat=>(
                    <TouchableOpacity key={cat} style={[styles.catTab,activeCategory===cat&&styles.catTabActive]}
                      onPress={()=>setActiveCategory(cat)}>
                      <Text style={[styles.catTabText,activeCategory===cat&&styles.catTabTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* AD BANNER */}
              <View style={{width:bannerW,alignSelf:'center',overflow:'hidden',borderRadius:16,marginBottom:8}}>
                <Animated.View style={[!isWide&&{
                  height:adAnim.interpolate({inputRange:[0,1],outputRange:[0,128]}),
                  opacity:adAnim.interpolate({inputRange:[0,1],outputRange:[0,1]}),
                }]}>
                  <ScrollView ref={adScrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={e=>setAdCurrent(Math.round(e.nativeEvent.contentOffset.x/bannerW))}
                    style={{width:bannerW}} contentContainerStyle={{width:bannerW*ads.length}}>
                    {ads.map(ad=>{
                      const imgSrc = ad.image?{uri:ad.image}:(ad.imageUrl?{uri:ad.imageUrl}:null);
                      return (
                        <LinearGradient key={ad.id} colors={ad.bg} start={{x:0,y:0}} end={{x:1,y:1}}
                          style={[styles.adSlide,{width:bannerW}]}>
                          {imgSrc
                            ? <Image source={imgSrc} style={styles.adBgImg} resizeMode="cover"/>
                            : <Text style={styles.adEmoji}>{ad.emoji}</Text>
                          }
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
                              <TouchableOpacity key={i} onPress={()=>{
                                adScrollRef.current?.scrollTo({x:i*bannerW,animated:true});
                                setAdCurrent(i);
                              }}>
                                <View style={[styles.adDot,adCurrent===i&&styles.adDotActive]}/>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </LinearGradient>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
              </View>

              {/* ITEMS PANEL */}
              <View style={[styles.itemsPanel,{minWidth:0}]}>
                <View style={styles.itemsHeaderRow}>
                  <Text style={styles.itemsHeaderLabel} numberOfLines={1}>
                    {search.trim()?`RESULTS FOR "${search.toUpperCase()}"`:activeCategory==='All'?'ALL ITEMS':activeCategory.toUpperCase()}
                  </Text>
                  <View style={[styles.searchBoxInline,{flex:1,minWidth:0}]}>
                    <Text style={{fontSize:11,marginRight:4}}>🔍</Text>
                    <TextInput style={styles.searchInputInline} placeholder="Search..."
                      placeholderTextColor="rgba(1,31,75,0.35)" value={search} onChangeText={handleSearch}/>
                    {search.length>0&&(
                      <TouchableOpacity onPress={()=>{setSearch('');setActiveCategory('All');}}>
                        <Text style={{color:'rgba(1,31,75,0.45)',fontSize:12,fontWeight:'700'}}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity style={[styles.addItemBtn,{flexShrink:0}]} onPress={openAddItem}>
                    <MaterialIcons name="add" size={16} color="#fff"/>
                    {isWide&&<Text style={styles.addItemTxt}>Add Item</Text>}
                  </TouchableOpacity>
                </View>
                <View style={{height:1,backgroundColor:'rgba(1,31,75,0.10)',marginBottom:8}}/>
                <ScrollView showsVerticalScrollIndicator scrollEventThrottle={16}
                  onScroll={Platform.OS!=='web'?e=>{
                    const y=e.nativeEvent.contentOffset.y;
                    const goingDown=y>lastScrollY.current;
                    lastScrollY.current=y;
                    Animated.timing(adAnim,{toValue:goingDown&&y>10?0:1,duration:150,useNativeDriver:false}).start();
                  }:undefined}
                  style={{flex:1}} contentContainerStyle={{gap:Platform.OS==='web'?10:5,paddingBottom:20}}>
                  {filtered.length===0
                    ? <Text style={styles.emptyText}>No items found.</Text>
                    : Array.from({length:Math.ceil(filtered.length/COLS)},(_,rowIdx)=>(
                      <View key={rowIdx} style={{flexDirection:'row',gap:Platform.OS==='web'?10:5}}>
                        {filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).map(item=>(
                          <View key={item.id} style={{flex:1,minWidth:0}}>
                            <View style={styles.foodCard}>
                              <View style={[styles.foodCardInner,{backgroundColor:'rgba(225,238,248,0.85)'}]}>
                                <View style={styles.cardAdminBtns}>
                                  <TouchableOpacity style={styles.cardEditBtn} onPress={()=>openEditItem(item)}>
                                    <MaterialIcons name="edit" size={11} color="#1a3a6b"/>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={styles.cardDeleteBtn} onPress={()=>handleDeleteItem(item.id)}>
                                    <MaterialIcons name="delete" size={11} color="#e74c3c"/>
                                  </TouchableOpacity>
                                </View>
                                <View style={styles.emojiCircle}>
                                  {item.image
                                    ? <Image source={{uri:item.image}} style={{width:'100%',height:'100%',borderRadius:99}} resizeMode="cover"/>
                                    : <Text style={styles.emojiText}>{item.emoji}</Text>
                                  }
                                </View>
                                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                                <Text style={styles.itemStock}>Stock: {item.stock}</Text>
                                <Text style={styles.itemPrice}>₱{item.price}.00</Text>
                                <TouchableOpacity style={styles.addBtn} onPress={()=>openEditItem(item)}>
                                  <Text style={styles.addBtnText}>Edit Item</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        ))}
                        {Array.from({length:COLS-filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).length}).map((_,i)=>(
                          <View key={`e-${i}`} style={{flex:1}}/>
                        ))}
                      </View>
                    ))
                  }
                </ScrollView>
              </View>
            </View>
          </>
        )}
      </Animated.View>

      {menuOpen&&(
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={()=>setMenuOpen(false)} activeOpacity={0}/>
      )}

      <ItemEditModal visible={editItemModal} item={editItem} categories={categories}
        onSave={handleSaveItem} onClose={()=>setEditItemModal(false)}/>
      <AdEditModal visible={editAdModal} ad={editAd}
        onSave={handleSaveAd} onClose={()=>setEditAdModal(false)}/>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex:1 },
  header: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(26,58,107,0.92)',
    borderRadius:16, borderWidth:1, borderColor:'rgba(255,255,255,0.18)',
    shadowColor:'#011f4b', shadowOpacity:0.25, shadowRadius:12, elevation:8 },
  backBtn: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.15)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.30)', justifyContent:'center', alignItems:'center', flexShrink:0 },
  backIcon: { color:'#fff', fontSize:16, fontWeight:'600', textAlign:'center', lineHeight:20 },
  headerCenter: { flex:1, alignItems:'center', paddingHorizontal:8, minWidth:0 },
  headerH1: { fontFamily:'NotoSerif_700Bold', color:'#fff', textAlign:'center' },
  headerGold: { color:'#c9a84c' },
  visitorTag: { marginTop:2, paddingHorizontal:8, paddingVertical:2, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.18)', borderWidth:1, borderColor:'rgba(255,255,255,0.40)', alignSelf:'center' },
  visitorTagText: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'#fff',
    letterSpacing:1.2, textTransform:'uppercase', lineHeight:13 },
  iconBtn: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.15)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.30)', justifyContent:'center', alignItems:'center', flexShrink:0 },
  notifBadge: { position:'absolute', top:4, right:4, backgroundColor:'#e74c3c', borderRadius:6,
    minWidth:14, height:14, alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  notifBadgeTxt: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'#fff' },
  body: { flex:1, flexDirection:'row', marginTop:Platform.OS==='web'?12:6, overflow:'hidden' },
  catPanel: { width:170, flexShrink:0, backgroundColor:'rgba(255,255,255,0.22)', borderRadius:16,
    marginLeft:20, marginBottom:16, padding:14, borderWidth:1, borderColor:'rgba(255,255,255,0.40)', gap:4 },
  catPanelTitle: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.55)',
    letterSpacing:2, textTransform:'uppercase', marginBottom:6, paddingBottom:6,
    borderBottomWidth:1, borderColor:'rgba(1,31,75,0.10)' },
  catBtn: { paddingVertical:8, paddingHorizontal:10, borderRadius:10 },
  catBtnActive: { backgroundColor:'rgba(26,58,107,0.15)' },
  catBtnText: { fontFamily:'GoogleSans_400Regular', fontSize:13, color:'rgba(1,31,75,0.65)' },
  catBtnTextActive: { fontFamily:'GoogleSans_700Bold', color:'#1a3a6b' },
  catTab: { paddingVertical:8, paddingHorizontal:16, borderRadius:16,
    backgroundColor:'rgba(255,255,255,0.25)', borderWidth:1, borderColor:'rgba(255,255,255,0.45)' },
  catTabActive: { backgroundColor:'#304674', borderColor:'#c9a84c' },
  catTabText: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'rgba(255,255,255,0.85)', lineHeight:16, includeFontPadding:false },
  catTabTextActive: { color:'#fff' },
  centerPanel: { flex:1, flexDirection:'column', paddingHorizontal:Platform.OS==='web'?12:10, paddingBottom:Platform.OS==='web'?16:0 },
  searchBoxInline: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.75)',
    borderRadius:8, paddingHorizontal:8, paddingVertical:5, borderWidth:1, borderColor:'rgba(255,255,255,0.90)', flex:1 },
  searchInputInline: { flex:1, fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#011f4b', paddingVertical:0, minWidth:0 },
  itemsHeaderRow: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:6 },
  itemsHeaderLabel: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#011f4b', letterSpacing:2, flexShrink:0 },
  addItemBtn: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#1a3a6b',
    borderRadius:8, paddingVertical:6, paddingHorizontal:Platform.OS==='web'?12:8 },
  addItemTxt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#fff' },
  adSlide: { height:120, borderRadius:16, flexDirection:'row', alignItems:'center',
    paddingHorizontal:20, paddingBottom:20, gap:16, overflow:'hidden' },
  adBgImg: { position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:16 },
  adEmoji: { fontSize:52, flexShrink:0 },
  adTitle: { fontFamily:'GoogleSans_700Bold', fontSize:18, color:'#fff' },
  adSub:   { fontFamily:'GoogleSans_400Regular', fontSize:14, color:'rgba(255,255,255,0.85)' },
  adBadge: { position:'absolute', top:10, right:42, backgroundColor:'rgba(255,255,255,0.25)',
    borderRadius:4, paddingHorizontal:7, paddingVertical:3 },
  adBadgeTxt: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#fff', letterSpacing:1 },
  adEditBtn: { position:'absolute', top:8, right:10, backgroundColor:'rgba(0,0,0,0.35)', borderRadius:8, padding:5 },
  adDotsInner: { position:'absolute', bottom:7, left:0, right:0, flexDirection:'row', justifyContent:'center', gap:5 },
  adDot: { width:7, height:7, borderRadius:4, backgroundColor:'rgba(255,255,255,0.40)' },
  adDotActive: { backgroundColor:'#fff', width:18 },
  itemsPanel: { backgroundColor:'rgba(255,255,255,0.22)', borderRadius:16, borderWidth:1,
    borderColor:'rgba(255,255,255,0.40)', padding:Platform.OS==='web'?10:6, overflow:'hidden',
    flex:1, marginBottom:Platform.OS==='web'?16:8 },
  foodCard: { borderRadius:14, overflow:'hidden', shadowColor:'#011f4b', shadowOpacity:0.10,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:3, flex:1 },
  foodCardInner: { borderRadius:14, padding:Platform.OS==='web'?14:8, borderWidth:1.5,
    borderColor:'rgba(255,255,255,0.75)', alignItems:'center', gap:Platform.OS==='web'?4:3,
    flex:1, justifyContent:'space-between' },
  cardAdminBtns: { position:'absolute', top:5, right:5, flexDirection:'row', gap:4, zIndex:10 },
  cardEditBtn: { backgroundColor:'rgba(26,58,107,0.12)', borderRadius:6, padding:4, borderWidth:1, borderColor:'rgba(26,58,107,0.20)' },
  cardDeleteBtn: { backgroundColor:'rgba(231,76,60,0.10)', borderRadius:6, padding:4, borderWidth:1, borderColor:'rgba(231,76,60,0.20)' },
  emojiCircle: { width:Platform.OS==='web'?72:52, height:Platform.OS==='web'?72:52,
    borderRadius:Platform.OS==='web'?36:26, backgroundColor:'rgba(240,246,252,0.90)',
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.85)', justifyContent:'center', alignItems:'center',
    marginBottom:Platform.OS==='web'?6:3, overflow:'hidden', flexShrink:0 },
  emojiText: { fontSize:Platform.OS==='web'?34:24 },
  itemName: { fontFamily:'GoogleSans_700Bold', fontSize:Platform.OS==='web'?11:9, color:'#1a2d4e',
    textAlign:'center', lineHeight:Platform.OS==='web'?15:12,
    minHeight:Platform.OS==='web'?15:24, alignSelf:'stretch' },
  itemStock: { fontFamily:'GoogleSans_400Regular', fontSize:Platform.OS==='web'?10:9, color:'rgba(1,31,75,0.45)', letterSpacing:0.2 },
  itemPrice: { fontFamily:'NotoSerif_700Bold', fontSize:Platform.OS==='web'?14:12, color:'#c9a84c', letterSpacing:0.3 },
  addBtn: { backgroundColor:'#1a3a6b', borderRadius:7, paddingVertical:Platform.OS==='web'?8:6,
    paddingHorizontal:4, marginTop:2, alignItems:'center', width:'100%' },
  addBtnText: { fontFamily:'GoogleSans_700Bold', fontSize:Platform.OS==='web'?10:9, color:'#fff', letterSpacing:0.3 },
  emptyText: { fontFamily:'GoogleSans_400Regular', fontSize:13, color:'rgba(1,31,75,0.40)', textAlign:'center', marginTop:30 },
});