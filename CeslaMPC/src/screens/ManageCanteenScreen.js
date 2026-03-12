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

// ─── ITEM EDIT MODAL ──────────────────────────────────────────────────────────
const ItemEditModal = ({ visible, item, categories, onSave, onClose }) => {
  const [form, setForm] = useState(item || emptyItem());
  useEffect(() => { if (item) setForm({...item, price: String(item.price), stock: String(item.stock) }); }, [item]);

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

            {/* Image picker */}
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
                <Text style={{ fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#e74c3c' }}>✕ Remove image</Text>
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
                    <TouchableOpacity key={cat}
                      style={[ms.chip, form.cat===cat && ms.chipActive]}
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

// ─── SUB-SCREENS ──────────────────────────────────────────────────────────────

// ORDER HISTORY SCREEN
const OrderHistoryScreen = ({ orders }) => {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const FILTERS = [{k:'all',l:'All'},{k:'pending',l:'Pending'},{k:'done',l:'Done'}];
  return (
    <View style={sub.root}>
      <View style={sub.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.k} style={[sub.filterBtn, filter===f.k && sub.filterBtnActive]} onPress={()=>setFilter(f.k)}>
            <Text style={[sub.filterTxt, filter===f.k && sub.filterTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}}>
        {filtered.length === 0
          ? <View style={sub.emptyBox}><MaterialIcons name="history" size={48} color="rgba(1,31,75,0.15)"/><Text style={sub.emptyTxt}>No orders found.</Text></View>
          : filtered.map(order => (
            <View key={order.id} style={sub.orderCard}>
              <View style={sub.orderHead}>
                <Text style={sub.orderId}>{order.id}</Text>
                <Text style={sub.orderTime}>{order.time}</Text>
                <View style={[sub.badge, order.status==='done' ? sub.badgeDone : sub.badgePending]}>
                  <Text style={sub.badgeTxt}>{order.status==='done'?'✅ Done':'⏳ Pending'}</Text>
                </View>
              </View>
              <Text style={sub.orderItems}>{order.items.map(i=>`${i.name} x${i.qty}`).join(' • ')}</Text>
              <View style={sub.orderFoot}>
                <Text style={sub.orderTotal}>₱ {Number(order.total).toFixed(2)}</Text>
                <Text style={sub.orderPay}>{order.payment==='gcash'?'📱 GCash':'💵 Cash'}</Text>
              </View>
            </View>
          ))
        }
      </ScrollView>
    </View>
  );
};

// STOCKS SCREEN
const StocksScreen = ({ items, onEdit }) => {
  const low    = items.filter(i => i.stock > 0 && i.stock <= 5);
  const out    = items.filter(i => i.stock === 0);
  const normal = items.filter(i => i.stock > 5);
  const Section = ({ title, color, data }) => data.length === 0 ? null : (
    <View style={{marginBottom:14}}>
      <View style={[sub.sectionHead, {borderLeftColor:color}]}>
        <Text style={[sub.sectionTitle,{color}]}>{title} ({data.length})</Text>
      </View>
      {data.map(item => (
        <View key={item.id} style={sub.stockRow}>
          <View style={sub.stockImgWrap}>
            {item.image ? <Image source={{uri:item.image}} style={sub.stockImg}/> : <Text style={{fontSize:22}}>{item.emoji}</Text>}
          </View>
          <View style={{flex:1}}>
            <Text style={sub.stockName}>{item.name}</Text>
            <Text style={sub.stockCat}>{item.cat} • ₱{item.price}</Text>
          </View>
          <View style={[sub.stockQtyBox, item.stock===0 && {backgroundColor:'rgba(231,76,60,0.12)'}, item.stock<=5&&item.stock>0 && {backgroundColor:'rgba(243,156,18,0.12)'}]}>
            <Text style={[sub.stockQty, item.stock===0&&{color:'#e74c3c'}, item.stock<=5&&item.stock>0&&{color:'#e67e22'}]}>{item.stock}</Text>
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
      <View style={sub.statRow}>
        {[
          {l:'Total', v:items.length, c:'#1a3a6b'},
          {l:'Normal', v:normal.length, c:'#27ae60'},
          {l:'Low Stock', v:low.length, c:'#e67e22'},
          {l:'Out', v:out.length, c:'#e74c3c'},
        ].map(s=>(
          <View key={s.l} style={sub.statCard}>
            <Text style={[sub.statVal,{color:s.c}]}>{s.v}</Text>
            <Text style={sub.statLbl}>{s.l}</Text>
          </View>
        ))}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}}>
        <Section title="Out of Stock" color="#e74c3c" data={out} />
        <Section title="Low Stock (≤5)"  color="#e67e22" data={low} />
        <Section title="In Stock"      color="#27ae60" data={normal} />
      </ScrollView>
    </View>
  );
};

// INVENTORY SCREEN
const InventoryScreen = ({ items }) => {
  const [sort, setSort] = useState('name');
  const totalValue = items.reduce((s,i)=>s+i.price*i.stock,0);
  const sorted = [...items].sort((a,b)=>{
    if (sort==='name')  return a.name.localeCompare(b.name);
    if (sort==='price') return b.price - a.price;
    if (sort==='stock') return b.stock - a.stock;
    if (sort==='value') return (b.price*b.stock) - (a.price*a.stock);
    return 0;
  });
  return (
    <View style={sub.root}>
      <View style={sub.statRow}>
        {[
          {l:'Items', v:items.length, c:'#1a3a6b'},
          {l:'In Stock', v:items.filter(i=>i.stock>0).length, c:'#27ae60'},
          {l:'Out', v:items.filter(i=>i.stock===0).length, c:'#e74c3c'},
          {l:'Total Value', v:`₱${totalValue.toLocaleString()}`, c:'#c9a84c'},
        ].map(s=>(
          <View key={s.l} style={sub.statCard}>
            <Text style={[sub.statVal,{color:s.c,fontSize:s.l==='Total Value'?12:16}]}>{s.v}</Text>
            <Text style={sub.statLbl}>{s.l}</Text>
          </View>
        ))}
      </View>
      {/* Sort tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:8}}
        contentContainerStyle={{gap:6,paddingHorizontal:2,paddingVertical:2}}>
        {[{k:'name',l:'Name'},{k:'price',l:'Price'},{k:'stock',l:'Stock'},{k:'value',l:'Value'}].map(s=>(
          <TouchableOpacity key={s.k} style={[sub.sortChip, sort===s.k && sub.sortChipActive]} onPress={()=>setSort(s.k)}>
            <Text style={[sub.sortTxt, sort===s.k && sub.sortTxtActive]}>Sort: {s.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* Table */}
      <View style={sub.tableHead}>
        <Text style={[sub.thCell,{flex:2}]}>ITEM</Text>
        <Text style={sub.thCell}>CAT</Text>
        <Text style={sub.thCell}>PRICE</Text>
        <Text style={sub.thCell}>STOCK</Text>
        <Text style={[sub.thCell,{textAlign:'right'}]}>VALUE</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}}>
        {sorted.map((item,idx)=>(
          <View key={item.id} style={[sub.tableRow, idx%2===0 && {backgroundColor:'rgba(255,255,255,0.35)'}]}>
            <Text style={[sub.tdCell,{flex:2,fontFamily:'GoogleSans_700Bold'}]} numberOfLines={1}>{item.emoji} {item.name}</Text>
            <Text style={sub.tdCell}>{item.cat}</Text>
            <Text style={sub.tdCell}>₱{item.price}</Text>
            <Text style={[sub.tdCell, item.stock===0&&{color:'#e74c3c',fontFamily:'GoogleSans_700Bold'}, item.stock<=5&&item.stock>0&&{color:'#e67e22',fontFamily:'GoogleSans_700Bold'}]}>{item.stock}</Text>
            <Text style={[sub.tdCell,{textAlign:'right',fontFamily:'GoogleSans_700Bold',color:'#1a3a6b'}]}>₱{(item.price*item.stock).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

// SALES REPORT SCREEN
const SalesReportScreen = ({ orders }) => {
  const [period, setPeriod] = useState('all');
  const done = orders.filter(o=>o.status==='done');
  const totalSales   = done.reduce((s,o)=>s+Number(o.total),0);
  const cashTotal    = done.filter(o=>o.payment==='cash').reduce((s,o)=>s+Number(o.total),0);
  const gcashTotal   = done.filter(o=>o.payment==='gcash').reduce((s,o)=>s+Number(o.total),0);

  // Item frequency
  const itemMap = {};
  done.forEach(o => o.items.forEach(i => {
    itemMap[i.name] = (itemMap[i.name]||0) + i.qty;
  }));
  const topItems = Object.entries(itemMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return (
    <View style={sub.root}>
      <View style={sub.statRow}>
        {[
          {l:'Total Sales',   v:`₱${totalSales.toFixed(2)}`, c:'#27ae60'},
          {l:'Orders Done',   v:done.length,                 c:'#1a3a6b'},
          {l:'💵 Cash',       v:`₱${cashTotal.toFixed(2)}`,  c:'#c9a84c'},
          {l:'📱 GCash',      v:`₱${gcashTotal.toFixed(2)}`, c:'#2e5fa3'},
        ].map(s=>(
          <View key={s.l} style={sub.statCard}>
            <Text style={[sub.statVal,{color:s.c,fontSize:12}]}>{s.v}</Text>
            <Text style={sub.statLbl}>{s.l}</Text>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}}>
        {/* Top Items */}
        {topItems.length > 0 && (
          <View style={{marginBottom:16}}>
            <Text style={sub.sectionTitle2}>🏆 Top Selling Items</Text>
            {topItems.map(([name,qty],i)=>(
              <View key={name} style={sub.topItemRow}>
                <Text style={sub.topItemRank}>#{i+1}</Text>
                <Text style={[sub.topItemName,{flex:1}]}>{name}</Text>
                <View style={[sub.topItemBar, {width:`${Math.min(100,(qty/topItems[0][1])*100)}%`}]} />
                <Text style={sub.topItemQty}>{qty} sold</Text>
              </View>
            ))}
          </View>
        )}

        {/* Completed orders table */}
        <Text style={sub.sectionTitle2}>📋 Completed Orders</Text>
        {done.length === 0
          ? <View style={sub.emptyBox}><Text style={sub.emptyTxt}>No completed orders yet.</Text></View>
          : <>
            <View style={sub.tableHead}>
              <Text style={[sub.thCell,{flex:1.2}]}>ORDER ID</Text>
              <Text style={sub.thCell}>TIME</Text>
              <Text style={sub.thCell}>TOTAL</Text>
              <Text style={[sub.thCell,{textAlign:'right'}]}>PAY</Text>
            </View>
            {done.map((order,idx)=>(
              <View key={order.id} style={[sub.tableRow, idx%2===0 && {backgroundColor:'rgba(255,255,255,0.35)'}]}>
                <Text style={[sub.tdCell,{flex:1.2,fontFamily:'GoogleSans_700Bold',color:'#1a3a6b'}]}>{order.id}</Text>
                <Text style={sub.tdCell}>{order.time}</Text>
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

// EMPLOYEE CREDITS SCREEN
const EmployeeCreditsScreen = () => (
  <View style={[sub.root,{justifyContent:'center',alignItems:'center',gap:14}]}>
    <MaterialIcons name="account-balance" size={64} color="rgba(1,31,75,0.15)"/>
    <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:20,color:'rgba(1,31,75,0.30)'}}>Coming Soon</Text>
    <Text style={sub.emptyTxt}>Employee credit tracking will be{'\n'}available in a future update.</Text>
  </View>
);

// LIVE QUEUE SCREEN
const LiveQueueScreen = ({ orders, onUpdateStatus }) => {
  const pending = orders.filter(o=>o.status==='pending');
  const done    = orders.filter(o=>o.status==='done');
  return (
    <View style={sub.root}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:12}}>
        <View style={{width:10,height:10,borderRadius:5,backgroundColor:'#e74c3c'}}/>
        <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:13,color:'#e74c3c',letterSpacing:2}}>LIVE</Text>
        <Text style={{fontFamily:'GoogleSans_400Regular',fontSize:11,color:'rgba(1,31,75,0.45)',marginLeft:'auto'}}>
          {pending.length} pending • {done.length} done
        </Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}}>
        {orders.length === 0
          ? <View style={sub.emptyBox}>
              <MaterialIcons name="queue" size={48} color="rgba(1,31,75,0.15)"/>
              <Text style={sub.emptyTxt}>No orders yet.{'\n'}Orders will appear here in real-time.</Text>
            </View>
          : orders.map(order=>(
            <View key={order.id} style={[sub.orderCard, order.status==='done' && {opacity:0.55}]}>
              <View style={sub.orderHead}>
                <Text style={sub.orderId}>{order.id}</Text>
                <Text style={sub.orderTime}>{order.time}</Text>
                <View style={[sub.badge, order.status==='done' ? sub.badgeDone : sub.badgePending]}>
                  <Text style={sub.badgeTxt}>{order.status==='done'?'✅ Done':'⏳ Pending'}</Text>
                </View>
              </View>
              <Text style={sub.orderItems}>{order.items.map(i=>`${i.name} x${i.qty}`).join(' • ')}</Text>
              <View style={sub.orderFoot}>
                <Text style={sub.orderTotal}>₱ {Number(order.total).toFixed(2)}</Text>
                <Text style={sub.orderPay}>{order.payment==='gcash'?'📱 GCash':'💵 Cash'}</Text>
                {order.status==='pending' && (
                  <TouchableOpacity style={sub.doneBtn} onPress={()=>onUpdateStatus(order.id,'done')}>
                    <Text style={sub.doneBtnTxt}>Mark Done ✓</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        }
      </ScrollView>
    </View>
  );
};

const sub = StyleSheet.create({
  root: { flex:1, padding:16 },
  emptyBox: { flex:1, alignItems:'center', justifyContent:'center', gap:10, paddingTop:60 },
  emptyTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.35)', textAlign:'center', lineHeight:18 },
  filterRow: { flexDirection:'row', gap:8, marginBottom:12 },
  filterBtn: { paddingHorizontal:16, paddingVertical:7, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.40)', borderWidth:1, borderColor:'rgba(255,255,255,0.60)' },
  filterBtnActive: { backgroundColor:'#1a3a6b', borderColor:'#c9a84c' },
  filterTxt: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'rgba(1,31,75,0.60)' },
  filterTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  statRow: { flexDirection:'row', gap:8, marginBottom:14, flexWrap:'wrap' },
  statCard: { flex:1, minWidth:70, backgroundColor:'rgba(255,255,255,0.60)', borderRadius:12,
    padding:10, alignItems:'center', gap:3 },
  statVal: { fontFamily:'GoogleSans_700Bold', fontSize:16, color:'#1a3a6b' },
  statLbl: { fontFamily:'GoogleSans_400Regular', fontSize:9, color:'rgba(1,31,75,0.45)', textAlign:'center' },
  sectionHead: { borderLeftWidth:3, paddingLeft:10, marginBottom:8 },
  sectionTitle: { fontFamily:'GoogleSans_700Bold', fontSize:12, letterSpacing:0.5 },
  sectionTitle2: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'rgba(1,31,75,0.55)', letterSpacing:1,
    textTransform:'uppercase', marginBottom:8, marginTop:4 },
  stockRow: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:9,
    borderBottomWidth:1, borderColor:'rgba(1,31,75,0.06)' },
  stockImgWrap: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(1,31,75,0.06)',
    alignItems:'center', justifyContent:'center', overflow:'hidden' },
  stockImg: { width:36, height:36, borderRadius:18 },
  stockName: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#1a2d4e' },
  stockCat: { fontFamily:'GoogleSans_400Regular', fontSize:10, color:'rgba(1,31,75,0.45)' },
  stockQtyBox: { backgroundColor:'rgba(39,174,96,0.12)', borderRadius:8, paddingHorizontal:8, paddingVertical:4, alignItems:'center' },
  stockQty: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#27ae60' },
  stockQtyLbl: { fontFamily:'GoogleSans_400Regular', fontSize:8, color:'rgba(1,31,75,0.40)' },
  editBtn: { padding:6, backgroundColor:'rgba(1,31,75,0.07)', borderRadius:8 },
  sortChip: { paddingHorizontal:12, paddingVertical:6, borderRadius:14,
    backgroundColor:'rgba(255,255,255,0.40)', borderWidth:1, borderColor:'rgba(255,255,255,0.60)' },
  sortChipActive: { backgroundColor:'#1a3a6b' },
  sortTxt: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)' },
  sortTxtActive: { fontFamily:'GoogleSans_700Bold', color:'#fff' },
  tableHead: { flexDirection:'row', paddingVertical:8, paddingHorizontal:10,
    backgroundColor:'rgba(26,58,107,0.12)', borderRadius:8, marginBottom:4 },
  thCell: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'rgba(1,31,75,0.55)', flex:1, letterSpacing:0.5 },
  tableRow: { flexDirection:'row', paddingVertical:9, paddingHorizontal:10,
    borderRadius:6, marginBottom:2 },
  tdCell: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#1a2d4e', flex:1 },
  topItemRow: { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:7,
    borderBottomWidth:1, borderColor:'rgba(1,31,75,0.06)' },
  topItemRank: { fontFamily:'GoogleSans_700Bold', fontSize:14, color:'#c9a84c', width:24 },
  topItemName: { fontFamily:'GoogleSans_400Regular', fontSize:12, color:'#1a2d4e' },
  topItemBar: { height:6, backgroundColor:'rgba(26,58,107,0.20)', borderRadius:3, maxWidth:80 },
  topItemQty: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#1a3a6b', width:55, textAlign:'right' },
  orderCard: { backgroundColor:'rgba(255,255,255,0.65)', borderRadius:12, padding:12, marginBottom:8,
    borderWidth:1, borderColor:'rgba(255,255,255,0.80)', gap:6 },
  orderHead: { flexDirection:'row', alignItems:'center', gap:8 },
  orderId: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#1a3a6b' },
  orderTime: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.45)', flex:1 },
  badge: { borderRadius:6, paddingHorizontal:7, paddingVertical:2 },
  badgePending: { backgroundColor:'rgba(231,76,60,0.10)' },
  badgeDone: { backgroundColor:'rgba(39,174,96,0.10)' },
  badgeTxt: { fontFamily:'GoogleSans_700Bold', fontSize:10, color:'#1a2d4e' },
  orderItems: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.60)', lineHeight:16 },
  orderFoot: { flexDirection:'row', alignItems:'center', gap:8 },
  orderTotal: { fontFamily:'GoogleSans_700Bold', fontSize:13, color:'#c9a84c' },
  orderPay: { fontFamily:'GoogleSans_400Regular', fontSize:11, color:'rgba(1,31,75,0.50)', flex:1 },
  doneBtn: { backgroundColor:'#27ae60', borderRadius:8, paddingHorizontal:10, paddingVertical:5 },
  doneBtnTxt: { fontFamily:'GoogleSans_700Bold', fontSize:11, color:'#fff' },
});

// ─── DROPDOWN MENU ────────────────────────────────────────────────────────────
const DropdownMenu = ({ visible, activeScreen, pendingCount, onSelect, onClose }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-8)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  {toValue:1, duration:160, useNativeDriver:true}),
        Animated.timing(slideAnim, {toValue:0, duration:160, useNativeDriver:true}),
      ]).start();
    } else { fadeAnim.setValue(0); slideAnim.setValue(-8); }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[dd.menu, {opacity:fadeAnim, transform:[{translateY:slideAnim}]}]}>
      {SUB_SCREENS.map((s,idx)=>(
        <TouchableOpacity key={s.key}
          style={[dd.item, idx<SUB_SCREENS.length-1&&dd.itemBorder, activeScreen===s.key&&dd.itemActive]}
          onPress={()=>onSelect(s.key)}>
          <MaterialIcons name={s.icon} size={17} color={activeScreen===s.key?'#1a3a6b':'rgba(1,31,75,0.55)'}/>
          <Text style={[dd.itemTxt, activeScreen===s.key&&{fontFamily:'GoogleSans_700Bold',color:'#1a3a6b'}]}>{s.label}</Text>
          {s.badge==='LIVE' && pendingCount>0 && (
            <View style={dd.liveBadge}><Text style={dd.liveBadgeTxt}>{pendingCount}</Text></View>
          )}
          {activeScreen===s.key && <MaterialIcons name="check" size={14} color="#1a3a6b"/>}
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
  const admin = route?.params?.admin || {};
  const { width, height } = useWindowDimensions();
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

  const [activeScreen,  setActiveScreen]  = useState('items');
  const [activeCategory,setActiveCategory]= useState('All');
  const [search,        setSearch]        = useState('');
  const [menuOpen,      setMenuOpen]      = useState(false);

  // Re-read AsyncStorage every time this screen comes into focus
  // so orders from CanteenVisitor and stock deductions are always current
  useFocusEffect(
    useCallback(() => {
      reloadFromStorage();
    }, [reloadFromStorage])
  );
  const [editItem,      setEditItem]      = useState(null);
  const [editItemModal, setEditItemModal] = useState(false);
  const [editAd,        setEditAd]        = useState(null);
  const [editAdModal,   setEditAdModal]   = useState(false);
  const [adCurrent,     setAdCurrent]     = useState(0);

  const hdrFade   = useRef(new Animated.Value(0)).current;
  const hdrTrans  = useRef(new Animated.Value(-16)).current;
  const bodyFade  = useRef(new Animated.Value(0)).current;
  const adAnim    = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const adScrollRef = useRef(null);
  const bannerW   = isWide ? Math.min(width*0.55,700) : width - 48;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrFade,  {toValue:1, duration:500, useNativeDriver:true}),
      Animated.timing(hdrTrans, {toValue:0, duration:500, useNativeDriver:true}),
    ]).start();
    Animated.timing(bodyFade, {toValue:1, duration:500, delay:150, useNativeDriver:true}).start();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setAdCurrent(prev => {
        const next = (prev+1) % ads.length;
        adScrollRef.current?.scrollTo({x: next*bannerW, animated:true});
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
  const openEditItem = (item) => { setEditItem({...item, price:String(item.price), stock:String(item.stock)}); setEditItemModal(true); };
  const handleSaveItem = (updated) => { saveItem(updated); setEditItemModal(false); };
  const handleDeleteItem = (id) => {
    Alert.alert('Delete Item','Are you sure?',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive', onPress:()=>deleteItem(id)},
    ]);
  };
  const handleSaveAd = (updated) => { saveAd(updated); setEditAdModal(false); };
  const handleMenuSelect = (key) => { setMenuOpen(false); setActiveScreen(key); };

  const pendingCount = orders.filter(o=>o.status==='pending').length;
  const currentScreenLabel = SUB_SCREENS.find(s=>s.key===activeScreen)?.label || 'Menu Items';

  const MARGIN = isWide ? 80 : 20;
  const GAP_C  = Platform.OS==='web' ? 10 : 5;
  const CAT_W  = isWide ? 170 : 0;
  const AVAIL  = width - CAT_W - MARGIN - (Platform.OS==='web' ? 24 : 12);

  if (!fontsLoaded) return null;

  // ── Non-items screens ─────────────────────────────────────────────────────
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
      <Animated.View style={{opacity:hdrFade, transform:[{translateY:hdrTrans}],
        marginTop: Platform.OS==='web'?16:36, marginHorizontal: isSmall?8:10, zIndex:30}}>
        <View style={[styles.header, {paddingHorizontal:isWide?40:12, paddingVertical:isWide?16:7}]}>
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
              {pendingCount>0 && (
                <View style={styles.notifBadge}><Text style={styles.notifBadgeTxt}>{pendingCount}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={()=>setMenuOpen(v=>!v)}>
              <MaterialIcons name="menu" size={19} color="#fff"/>
            </TouchableOpacity>
            <DropdownMenu visible={menuOpen} activeScreen={activeScreen}
              pendingCount={pendingCount} onSelect={handleMenuSelect} onClose={()=>setMenuOpen(false)}/>
          </View>
        </View>
      </Animated.View>

      {/* BODY */}
      <Animated.View style={[styles.body,{opacity:bodyFade}]}>

        {/* ── NON-ITEMS SCREENS ── */}
        {activeScreen !== 'items' ? (
          <View style={{flex:1, marginHorizontal:isWide?20:10, marginBottom:16,
            backgroundColor:'rgba(255,255,255,0.22)', borderRadius:16,
            borderWidth:1, borderColor:'rgba(255,255,255,0.40)', overflow:'hidden'}}>
            {renderSubScreen()}
          </View>
        ) : (
          /* ── ITEMS SCREEN ── */
          <>
            {/* LEFT categories (web) */}
            {isWide && (
              <View style={styles.catPanel}>
                <Text style={styles.catPanelTitle}>CATEGORIES</Text>
                {categories.map(cat=>(
                  <TouchableOpacity key={cat} style={[styles.catBtn, activeCategory===cat&&styles.catBtnActive]}
                    onPress={()=>setActiveCategory(cat)}>
                    <Text style={[styles.catBtnText, activeCategory===cat&&styles.catBtnTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* CENTER */}
            <View style={styles.centerPanel}>
              {/* Mobile category tabs */}
              {!isWide && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={{flexGrow:0,marginBottom:8}}
                  contentContainerStyle={{paddingHorizontal:4,gap:5,paddingVertical:2}}>
                  {categories.map(cat=>(
                    <TouchableOpacity key={cat} style={[styles.catTab, activeCategory===cat&&styles.catTabActive]}
                      onPress={()=>setActiveCategory(cat)}>
                      <Text style={[styles.catTabText, activeCategory===cat&&styles.catTabTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Web search */}
              {isWide && (
                <View style={[styles.searchBox,{paddingVertical:5,marginBottom:8}]}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput style={styles.searchInput} placeholder="Search menu items..."
                    placeholderTextColor="rgba(1,31,75,0.40)" value={search} onChangeText={handleSearch}/>
                  {search.length>0 && (
                    <TouchableOpacity onPress={()=>{setSearch('');setActiveCategory('All');}} style={{paddingLeft:6}}>
                      <Text style={{color:'rgba(1,31,75,0.45)',fontSize:14,fontWeight:'700'}}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* AD BANNER */}
              <Animated.View style={[{alignSelf:'stretch'}, !isWide && {
                overflow:'hidden',
                height: adAnim.interpolate({inputRange:[0,1],outputRange:[0,128]}),
                opacity: adAnim.interpolate({inputRange:[0,1],outputRange:[0,1]}),
                marginBottom: adAnim.interpolate({inputRange:[0,1],outputRange:[0,8]}),
              }]}>
                <ScrollView ref={adScrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={e=>setAdCurrent(Math.round(e.nativeEvent.contentOffset.x/bannerW))}
                  style={{width:bannerW, alignSelf:'center'}}
                  contentContainerStyle={{width:bannerW*ads.length}}>
                  {ads.map(ad => {
                    const imgSrc = ad.image ? {uri:ad.image} : (ad.imageUrl ? {uri:ad.imageUrl} : null);
                    return (
                      <LinearGradient key={ad.id} colors={ad.bg} start={{x:0,y:0}} end={{x:1,y:1}}
                        style={[styles.adSlide,{width:bannerW}]}>
                        {imgSrc
                          ? <Image source={imgSrc} style={styles.adBgImg} resizeMode="cover"/>
                          : <Text style={styles.adEmoji}>{ad.emoji}</Text>
                        }
                        <View style={{flex:1}}>
                          <Text style={styles.adTitle}>{ad.title}</Text>
                          <Text style={styles.adSub}>{ad.sub}</Text>
                        </View>
                        <View style={styles.adBadge}><Text style={styles.adBadgeTxt}>AD</Text></View>
                        <TouchableOpacity style={styles.adEditBtn}
                          onPress={()=>{setEditAd({...ad});setEditAdModal(true);}}>
                          <MaterialIcons name="edit" size={12} color="#fff"/>
                        </TouchableOpacity>
                        <View style={styles.adDotsInner}>
                          {ads.map((_,i)=>(
                            <TouchableOpacity key={i} onPress={()=>{
                              adScrollRef.current?.scrollTo({x:i*bannerW,animated:true});
                              setAdCurrent(i);
                            }}>
                              <View style={[styles.adDot, adCurrent===i&&styles.adDotActive]}/>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </LinearGradient>
                    );
                  })}
                </ScrollView>
              </Animated.View>

              {/* ITEMS PANEL */}
              <View style={styles.itemsPanel}>
                <View style={{flexDirection:'row',alignItems:'center',marginBottom:6,gap:8}}>
                  <Text style={{fontFamily:'GoogleSans_700Bold',fontSize:12,color:'#011f4b',letterSpacing:2,flexShrink:0}}>
                    {search.trim() ? `RESULTS FOR "${search.toUpperCase()}"` : activeCategory==='All' ? 'ALL ITEMS' : activeCategory.toUpperCase()}
                  </Text>
                  {!isWide && (
                    <View style={styles.searchBoxInline}>
                      <Text style={{fontSize:11,marginRight:4}}>🔍</Text>
                      <TextInput style={styles.searchInputInline} placeholder="Search..."
                        placeholderTextColor="rgba(1,31,75,0.35)" value={search} onChangeText={handleSearch}/>
                      {search.length>0 && (
                        <TouchableOpacity onPress={()=>{setSearch('');setActiveCategory('All');}}>
                          <Text style={{color:'rgba(1,31,75,0.45)',fontSize:12,fontWeight:'700'}}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  <TouchableOpacity style={styles.addItemBtn} onPress={openAddItem}>
                    <MaterialIcons name="add" size={16} color="#fff"/>
                    {isWide && <Text style={styles.addItemTxt}>Add Item</Text>}
                  </TouchableOpacity>
                </View>
                <View style={{height:1,backgroundColor:'rgba(1,31,75,0.10)',marginBottom:8}}/>

                <ScrollView showsVerticalScrollIndicator
                  scrollEventThrottle={16}
                  onScroll={Platform.OS!=='web' ? e=>{
                    const y=e.nativeEvent.contentOffset.y;
                    const goingDown=y>lastScrollY.current;
                    lastScrollY.current=y;
                    Animated.timing(adAnim,{toValue:goingDown&&y>10?0:1,duration:150,useNativeDriver:false}).start();
                  } : undefined}
                  style={Platform.OS==='web' ? {height:height-310} : {flex:1}}
                  contentContainerStyle={{gap:Platform.OS==='web'?10:5,paddingBottom:20}}>
                  {filtered.length===0
                    ? <Text style={styles.emptyText}>No items found.</Text>
                    : Array.from({length:Math.ceil(filtered.length/COLS)},(_,rowIdx)=>(
                      <View key={rowIdx} style={{flexDirection:'row',gap:Platform.OS==='web'?10:5}}>
                        {filtered.slice(rowIdx*COLS,rowIdx*COLS+COLS).map(item=>(
                          <View key={item.id} style={{flex:1}}>
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

      {/* Tap outside to close menu */}
      {menuOpen && (
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
    borderWidth:1, borderColor:'rgba(255,255,255,0.30)', justifyContent:'center', alignItems:'center' },
  backIcon: { color:'#fff', fontSize:16, fontWeight:'600', textAlign:'center', lineHeight:20 },
  headerCenter: { flex:1, alignItems:'center', paddingHorizontal:8 },
  headerH1: { fontFamily:'NotoSerif_700Bold', color:'#fff', textAlign:'center' },
  headerGold: { color:'#c9a84c' },
  visitorTag: { marginTop:2, paddingHorizontal:8, paddingVertical:2, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.18)', borderWidth:1, borderColor:'rgba(255,255,255,0.40)', alignSelf:'center' },
  visitorTagText: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'#fff',
    letterSpacing:1.2, textTransform:'uppercase', lineHeight:13 },
  iconBtn: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.15)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.30)', justifyContent:'center', alignItems:'center' },
  notifBadge: { position:'absolute', top:4, right:4, backgroundColor:'#e74c3c', borderRadius:6,
    minWidth:14, height:14, alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  notifBadgeTxt: { fontFamily:'GoogleSans_700Bold', fontSize:8, color:'#fff' },
  body: { flex:1, flexDirection:'row', marginTop:Platform.OS==='web'?12:6 },
  catPanel: { width:170, backgroundColor:'rgba(255,255,255,0.22)', borderRadius:16,
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
  searchBox: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.72)',
    borderRadius:12, paddingHorizontal:12, borderWidth:1, borderColor:'rgba(255,255,255,0.90)' },
  searchIcon: { fontSize:14, marginRight:6 },
  searchInput: { flex:1, fontFamily:'GoogleSans_400Regular', fontSize:13, color:'#011f4b', paddingVertical:8 },
  searchBoxInline: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.75)',
    borderRadius:8, paddingHorizontal:8, paddingVertical:5, borderWidth:1, borderColor:'rgba(255,255,255,0.90)', flex:1 },
  searchInputInline: { flex:1, fontFamily:'GoogleSans_400Regular', fontSize:11, color:'#011f4b', paddingVertical:0 },
  addItemBtn: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#1a3a6b',
    borderRadius:8, paddingVertical:6, paddingHorizontal:Platform.OS==='web'?12:8 },
  addItemTxt: { fontFamily:'GoogleSans_700Bold', fontSize:12, color:'#fff' },
  adSlide: { height:120, borderRadius:16, flexDirection:'row', alignItems:'center',
    paddingHorizontal:20, paddingBottom:20, gap:16, overflow:'hidden' },
  adBgImg: { position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:16 },
  adEmoji: { fontSize:52 },
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
    borderColor:'rgba(255,255,255,0.40)', padding:Platform.OS==='web'?10:6, overflow:'hidden', flex:1, marginBottom:Platform.OS==='web'?16:8 },
  foodCard: { borderRadius:14, overflow:'hidden', shadowColor:'#011f4b', shadowOpacity:0.10,
    shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:3, flex:1 },
  foodCardInner: { borderRadius:14, padding:Platform.OS==='web'?14:8, borderWidth:1.5,
    borderColor:'rgba(255,255,255,0.75)', alignItems:'center', gap:Platform.OS==='web'?4:3, flex:1, justifyContent:'space-between' },
  cardAdminBtns: { position:'absolute', top:5, right:5, flexDirection:'row', gap:4, zIndex:10 },
  cardEditBtn: { backgroundColor:'rgba(26,58,107,0.12)', borderRadius:6, padding:4, borderWidth:1, borderColor:'rgba(26,58,107,0.20)' },
  cardDeleteBtn: { backgroundColor:'rgba(231,76,60,0.10)', borderRadius:6, padding:4, borderWidth:1, borderColor:'rgba(231,76,60,0.20)' },
  emojiCircle: { width:Platform.OS==='web'?72:52, height:Platform.OS==='web'?72:52,
    borderRadius:Platform.OS==='web'?36:26, backgroundColor:'rgba(240,246,252,0.90)',
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.85)', justifyContent:'center', alignItems:'center',
    marginBottom:Platform.OS==='web'?6:3, overflow:'hidden' },
  emojiText: { fontSize:Platform.OS==='web'?34:24 },
  itemName: { fontFamily:'GoogleSans_700Bold', fontSize:Platform.OS==='web'?11:9, color:'#1a2d4e',
    textAlign:'center', fontWeight:'700', lineHeight:Platform.OS==='web'?15:12, minHeight:Platform.OS==='web'?15:24 },
  itemStock: { fontFamily:'GoogleSans_400Regular', fontSize:Platform.OS==='web'?10:9, color:'rgba(1,31,75,0.45)', letterSpacing:0.2 },
  itemPrice: { fontFamily:'NotoSerif_700Bold', fontSize:Platform.OS==='web'?14:12, color:'#c9a84c', fontWeight:'700', letterSpacing:0.3 },
  addBtn: { backgroundColor:'#1a3a6b', borderRadius:7, paddingVertical:Platform.OS==='web'?8:6,
    paddingHorizontal:4, marginTop:2, alignItems:'center', width:'100%' },
  addBtnText: { fontFamily:'GoogleSans_700Bold', fontSize:Platform.OS==='web'?10:9, color:'#fff', fontWeight:'700', letterSpacing:0.3 },
  emptyText: { fontFamily:'GoogleSans_400Regular', fontSize:13, color:'rgba(1,31,75,0.40)', textAlign:'center', marginTop:30 },
});