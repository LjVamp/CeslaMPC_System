// src/components/ChatSystem.js
// CESLA MPC — Floating Chat System
// Features:
//   • Chat with Admin (direct)
//   • Chat with Co-members (DM + Group Chat)
//   • Help & Support (live chat with admin)
// All powered by Firebase Firestore real-time
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Animated, Platform, KeyboardAvoidingView,
  ActivityIndicator, Image, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  serverTimestamp, where, doc, updateDoc, getDocs,
  getDoc, setDoc, arrayUnion, limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── PALETTE (matches CoopScreen) ───────────────────────────────────────────
const C = {
  navy:      '#0f1e35',
  navyMid:   '#1a2d4e',
  navyDeep:  '#243554',
  gold:      '#c9a84c',
  goldLt:    '#e8c87a',
  green:     '#1a8a4a',
  red:       '#c0392b',
  blue:      '#2563b0',
  blueLt:    '#3b7dd8',
  surface:   'rgba(255,255,255,0.50)',
  text:      '#0f1e35',
  textSec:   'rgba(15,30,53,0.65)',
  textMuted: 'rgba(15,30,53,0.42)',
};

const fmtTime = ts => {
  if (!ts) return '';
  const d = ts?.toDate?.() || new Date(ts);
  return d.toLocaleString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const mkInit = name =>
  (name || '?').split(/[\s,]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// ─── AVATAR ──────────────────────────────────────────────────────────────────
const Avatar = ({ member, size = 36, style }) => {
  const r = size / 2;
  if (member?.photoURL) {
    return (
      <Image
        source={{ uri: member.photoURL }}
        style={[{ width: size, height: size, borderRadius: r, borderWidth: 1.5, borderColor: C.gold }, style]}
      />
    );
  }
  return (
    <View style={[{
      width: size, height: size, borderRadius: r,
      backgroundColor: 'rgba(201,168,76,0.25)',
      borderWidth: 1.5, borderColor: C.gold,
      justifyContent: 'center', alignItems: 'center',
    }, style]}>
      <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: size * 0.33, color: C.gold }}>
        {mkInit(member?.name)}
      </Text>
    </View>
  );
};

// ─── FIRESTORE HELPERS ───────────────────────────────────────────────────────

// Get or create a DM room between two members
const getDMRoomId = (uid1, uid2) => [uid1, uid2].sort().join('_');

const ensureDMRoom = async (uid1, uid2, name1, name2) => {
  const roomId = getDMRoomId(uid1, uid2);
  const roomRef = doc(db, 'chatRooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) {
    await setDoc(roomRef, {
      type: 'dm',
      members: [uid1, uid2],
      memberNames: { [uid1]: name1, [uid2]: name2 },
      createdAt: serverTimestamp(),
      lastMessage: null,
      lastAt: serverTimestamp(),
    });
  }
  return roomId;
};

const ensureGroupRoom = async () => {
  const roomRef = doc(db, 'chatRooms', 'group_members');
  const snap = await getDoc(roomRef);
  if (!snap.exists()) {
    await setDoc(roomRef, {
      type: 'group',
      name: 'Members Group Chat',
      createdAt: serverTimestamp(),
      lastMessage: null,
      lastAt: serverTimestamp(),
    });
  }
  return 'group_members';
};

const ensureAdminRoom = async (memberId, memberName) => {
  const roomId = `admin_${memberId}`;
  const roomRef = doc(db, 'chatRooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) {
    await setDoc(roomRef, {
      type: 'admin',
      memberId,
      memberName,
      createdAt: serverTimestamp(),
      lastMessage: null,
      lastAt: serverTimestamp(),
    });
  }
  return roomId;
};

const sendMessage = async (roomId, senderId, senderName, text) => {
  if (!text.trim()) return;
  const msgRef = collection(db, 'chatRooms', roomId, 'messages');
  await addDoc(msgRef, {
    senderId,
    senderName,
    text: text.trim(),
    createdAt: serverTimestamp(),
    readBy: [senderId],
  });
  await updateDoc(doc(db, 'chatRooms', roomId), {
    lastMessage: text.trim(),
    lastAt: serverTimestamp(),
    lastSender: senderName,
  });
};

// ─── CHAT BUBBLE ─────────────────────────────────────────────────────────────
const ChatBubble = ({ msg, isMine, showName }) => (
  <View style={[ch.bubbleWrap, isMine && ch.bubbleWrapMine]}>
    {!isMine && showName && (
      <Text style={ch.bubbleSender}>{msg.senderName}</Text>
    )}
    <View style={[ch.bubble, isMine ? ch.bubbleMine : ch.bubbleOther]}>
      <Text style={[ch.bubbleTxt, isMine && { color: '#fff' }]}>{msg.text}</Text>
    </View>
    <Text style={[ch.bubbleTime, isMine && { textAlign: 'right' }]}>{fmtTime(msg.createdAt)}</Text>
  </View>
);

// ─── CHAT ROOM VIEW ───────────────────────────────────────────────────────────
const ChatRoomView = ({ roomId, currentMember, roomTitle, roomType, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, 'chatRooms', roomId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [roomId]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(roomId, currentMember.uid, currentMember.name, text);
      setText('');
    } catch (e) { console.warn(e); }
    finally { setSending(false); }
  };

  return (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      {/* Header */}
      <View style={ch.roomHeader}>
        <TouchableOpacity onPress={onBack} style={ch.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: C.gold, fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={ch.roomTitle} numberOfLines={1}>{roomTitle}</Text>
          <Text style={ch.roomSub}>
            {roomType === 'admin' ? 'Admin · Support' :
             roomType === 'group' ? 'Group · All Members' : 'Direct Message'}
          </Text>
        </View>
        {roomType === 'admin' && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(26,138,74,0.25)', borderWidth: 1, borderColor: 'rgba(26,138,74,0.50)' }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 9, color: C.green }}>● Live</Text>
          </View>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: 'rgba(152,186,213,0.15)' }}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>
              {roomType === 'admin' ? '🛡️' : roomType === 'group' ? '👥' : '💬'}
            </Text>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textMuted, textAlign: 'center', lineHeight: 18 }}>
              {roomType === 'admin'
                ? 'Chat with Admin. Ask anything about\nyour account, loans, or savings.'
                : roomType === 'group'
                ? 'Welcome to the Members Group Chat!\nSay hello to your co-members.'
                : 'Start your conversation here.'}
            </Text>
          </View>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.senderId === currentMember.uid;
          const prevMsg = messages[i - 1];
          const showName = !isMine && msg.senderId !== prevMsg?.senderId;
          return (
            <ChatBubble key={msg.id} msg={msg} isMine={isMine}
              showName={roomType !== 'dm' && showName} />
          );
        })}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={ch.inputRow}>
          <TextInput
            style={ch.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={500}
            onSubmitEditing={Platform.OS === 'web' ? send : undefined}
          />
          <TouchableOpacity
            style={[ch.sendBtn, (!text.trim() || sending) && { opacity: 0.45 }]}
            onPress={send}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: '#fff', fontSize: 16 }}>➤</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── MEMBERS LIST (for DM) ───────────────────────────────────────────────────
const MembersList = ({ currentMember, onSelectMember, onBack }) => {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'members'),
      where('status', '==', 'Active'),
      orderBy('name', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setMembers(
        snap.docs
          .map(d => ({ id: d.id, uid: d.id, ...d.data() }))
          .filter(m => m.id !== currentMember.uid)
      );
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [currentMember.uid]);

  const filtered = members.filter(m =>
    (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.userId || '').includes(search)
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={ch.roomHeader}>
        <TouchableOpacity onPress={onBack} style={ch.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: C.gold, fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={ch.roomTitle}>Select a Member</Text>
      </View>
      <View style={ch.searchBox}>
        <Text style={{ color: C.textMuted, marginRight: 6 }}>🔍</Text>
        <TextInput
          style={{ flex: 1, fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.navy }}
          value={search} onChangeText={setSearch}
          placeholder="Search name or ID..."
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
        />
      </View>
      {loading
        ? <ActivityIndicator color={C.gold} style={{ marginTop: 24 }} />
        : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {filtered.map(m => (
              <TouchableOpacity key={m.id} style={ch.memberRow} onPress={() => onSelectMember(m)} activeOpacity={0.8}>
                <Avatar member={m} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy }}>{m.name}</Text>
                  <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 10, color: C.textMuted }}>{m.userId}</Text>
                </View>
                <Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && (
              <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 32 }}>
                No members found.
              </Text>
            )}
          </ScrollView>
        )
      }
    </View>
  );
};

// ─── CHAT HOME (tab list) ─────────────────────────────────────────────────────
const ChatHome = ({ currentMember, onSelectRoom, onSelectDM }) => {
  const [adminRoomId, setAdminRoomId] = useState(null);
  const [groupRoomId, setGroupRoomId] = useState(null);
  const [adminLast, setAdminLast] = useState(null);
  const [groupLast, setGroupLast] = useState(null);
  const [dmRooms, setDmRooms] = useState([]);

  // Ensure admin + group rooms exist
  useEffect(() => {
    ensureAdminRoom(currentMember.uid, currentMember.name).then(id => {
      setAdminRoomId(id);
      const unsub = onSnapshot(doc(db, 'chatRooms', id), snap => {
        if (snap.exists()) setAdminLast(snap.data());
      });
      return unsub;
    });
    ensureGroupRoom().then(id => {
      setGroupRoomId(id);
      const unsub = onSnapshot(doc(db, 'chatRooms', id), snap => {
        if (snap.exists()) setGroupLast(snap.data());
      });
      return unsub;
    });
  }, [currentMember.uid]);

  // Listen for DM rooms involving this member
  useEffect(() => {
    const q = query(
      collection(db, 'chatRooms'),
      where('type', '==', 'dm'),
      where('members', 'array-contains', currentMember.uid)
    );
    const unsub = onSnapshot(q, snap => {
      setDmRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [currentMember.uid]);

  const RoomRow = ({ icon, title, sub, lastMsg, lastAt, color, onPress, badge }) => (
    <TouchableOpacity style={ch.roomRow} onPress={onPress} activeOpacity={0.8}>
      <View style={[ch.roomIcon, { backgroundColor: color + '22' }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 13, color: C.navy }}>{title}</Text>
        <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textMuted, marginTop: 1 }}>{sub}</Text>
        {lastMsg ? (
          <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 11, color: C.textSec, marginTop: 2 }} numberOfLines={1}>
            {lastMsg}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {lastAt ? <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 9, color: C.textMuted }}>{fmtTime(lastAt)}</Text> : null}
        <Text style={{ color: C.textMuted, fontSize: 16 }}>›</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#1a2d4e', '#243554']} style={ch.homeHeader}>
        <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 11, color: C.gold, letterSpacing: 1.5 }}>CESLA MPC</Text>
        <Text style={{ fontFamily: 'NotoSerif_700Bold', fontSize: 17, color: '#fff', marginTop: 2 }}>Messages</Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* Admin / Support */}
        <Text style={ch.sectionLabel}>SUPPORT</Text>
        <RoomRow
          icon="🛡️" title="Admin / Support" color={C.green}
          sub="Chat with the cooperative admin"
          lastMsg={adminLast?.lastMessage ? `${adminLast.lastSender || 'Admin'}: ${adminLast.lastMessage}` : 'Start a conversation'}
          lastAt={adminLast?.lastAt}
          onPress={() => adminRoomId && onSelectRoom(adminRoomId, 'Admin / Support', 'admin')}
        />

        {/* Group Chat */}
        <Text style={ch.sectionLabel}>COMMUNITY</Text>
        <RoomRow
          icon="👥" title="Members Group Chat" color={C.blue}
          sub="Chat with all approved members"
          lastMsg={groupLast?.lastMessage ? `${groupLast.lastSender || 'Member'}: ${groupLast.lastMessage}` : 'Say hello!'}
          lastAt={groupLast?.lastAt}
          onPress={() => groupRoomId && onSelectRoom(groupRoomId, 'Members Group Chat', 'group')}
        />

        {/* Direct Messages */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 }}>
          <Text style={[ch.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>DIRECT MESSAGES</Text>
          <TouchableOpacity onPress={onSelectDM} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(37,99,176,0.15)', borderWidth: 1, borderColor: 'rgba(37,99,176,0.35)' }}>
            <Text style={{ fontFamily: 'GoogleSans_700Bold', fontSize: 10, color: C.blue }}>+ New DM</Text>
          </TouchableOpacity>
        </View>
        {dmRooms.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text style={{ fontFamily: 'GoogleSans_400Regular', fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
              No direct messages yet.{'\n'}Tap "+ New DM" to start chatting!
            </Text>
          </View>
        )}
        {dmRooms.map(room => {
          const otherId = room.members?.find(id => id !== currentMember.uid);
          const otherName = room.memberNames?.[otherId] || 'Member';
          return (
            <RoomRow
              key={room.id}
              icon="💬" title={otherName} color={C.gold}
              sub="Direct Message"
              lastMsg={room.lastMessage || 'No messages yet'}
              lastAt={room.lastAt}
              onPress={() => onSelectRoom(room.id, otherName, 'dm')}
            />
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
};

// ─── MAIN CHAT SYSTEM ─────────────────────────────────────────────────────────
// screen: 'home' | 'room' | 'members'
export default function ChatSystem({ currentMember }) {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState('home');
  const [activeRoom, setActiveRoom] = useState(null); // { id, title, type }
  const [unreadCount, setUnreadCount] = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for FAB when unread
  useEffect(() => {
    if (unreadCount > 0 && !open) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1.00, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [unreadCount, open]);

  // Slide panel in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: open ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [open]);

  // Count unread messages across all rooms
  useEffect(() => {
    if (!currentMember?.uid) return;
    // Listen for admin room unread
    const adminRoomId = `admin_${currentMember.uid}`;
    const q = query(
      collection(db, 'chatRooms', adminRoomId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      const unread = snap.docs.filter(d => {
        const readBy = d.data().readBy || [];
        return !readBy.includes(currentMember.uid) && d.data().senderId !== currentMember.uid;
      }).length;
      setUnreadCount(unread);
    }, () => {});
    return unsub;
  }, [currentMember?.uid]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  });
  const opacity = slideAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  const openRoom = (id, title, type) => {
    setActiveRoom({ id, title, type });
    setScreen('room');
  };

  const goHome = () => {
    setScreen('home');
    setActiveRoom(null);
  };

  const selectDMTarget = async (targetMember) => {
    const roomId = await ensureDMRoom(
      currentMember.uid, targetMember.uid || targetMember.id,
      currentMember.name, targetMember.name
    );
    openRoom(roomId, targetMember.name, 'dm');
  };

  if (!currentMember) return null;

  return (
    <>
      {/* ── CHAT PANEL ── */}
      {open && (
        <Animated.View style={[ch.panel, { transform: [{ translateY }], opacity }]}>
          <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#f0f5fa' }}>
            {screen === 'home' && (
              <ChatHome
                currentMember={currentMember}
                onSelectRoom={openRoom}
                onSelectDM={() => setScreen('members')}
              />
            )}
            {screen === 'members' && (
              <MembersList
                currentMember={currentMember}
                onSelectMember={selectDMTarget}
                onBack={goHome}
              />
            )}
            {screen === 'room' && activeRoom && (
              <ChatRoomView
                roomId={activeRoom.id}
                roomTitle={activeRoom.title}
                roomType={activeRoom.type}
                currentMember={currentMember}
                onBack={goHome}
              />
            )}
            {/* Close button */}
            <TouchableOpacity
              style={ch.closeBtn}
              onPress={() => { setOpen(false); goHome(); }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={{ color: C.textMuted, fontSize: 14, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── FAB (Floating Action Button) ── */}
      <Animated.View style={[ch.fabWrap, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          style={ch.fab}
          onPress={() => setOpen(v => !v)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={open ? ['#243554', '#1a2d4e'] : ['#c9a84c', '#e8c87a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={ch.fabGrad}
          >
            <Text style={{ fontSize: 22 }}>{open ? '✕' : '💬'}</Text>
          </LinearGradient>
        </TouchableOpacity>
        {/* Unread badge */}
        {unreadCount > 0 && !open && (
          <View style={ch.fabBadge}>
            <Text style={ch.fabBadgeTxt}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </Animated.View>
    </>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const ch = StyleSheet.create({
  // Panel
  panel: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 340,
    height: 520,
    borderRadius: 20,
    shadowColor: '#0f1e35',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
    zIndex: 9998,
    ...(Platform.OS === 'web' ? { maxHeight: '75vh' } : {}),
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.70)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // FAB
  fabWrap: {
    position: 'absolute',
    bottom: 22,
    right: 18,
    zIndex: 9999,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    shadowColor: '#0f1e35',
    shadowOpacity: 0.30,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  fabGrad: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.red,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  fabBadgeTxt: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 9,
    color: '#fff',
  },

  // Home
  homeHeader: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },
  sectionLabel: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 9,
    color: C.textMuted,
    letterSpacing: 2,
    paddingHorizontal: 14,
    marginTop: 14,
    marginBottom: 4,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(15,30,53,0.07)',
    backgroundColor: 'rgba(255,255,255,0.50)',
  },
  roomIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  // Room header
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a2d4e',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  roomTitle: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 14,
    color: '#fff',
  },
  roomSub: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },

  // Bubbles
  bubbleWrap: {
    marginBottom: 8,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  bubbleWrapMine: {
    alignSelf: 'flex-end',
  },
  bubbleSender: {
    fontFamily: 'GoogleSans_700Bold',
    fontSize: 10,
    color: C.textMuted,
    marginBottom: 3,
    paddingLeft: 2,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleOther: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#0f1e35',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  bubbleMine: {
    backgroundColor: '#1a2d4e',
    borderBottomRightRadius: 4,
  },
  bubbleTxt: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 13,
    color: C.navy,
    lineHeight: 19,
  },
  bubbleTime: {
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 9,
    color: C.textMuted,
    marginTop: 3,
    paddingHorizontal: 2,
  },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: 'rgba(15,30,53,0.10)',
  },
  input: {
    flex: 1,
    fontFamily: 'GoogleSans_400Regular',
    fontSize: 13,
    color: C.navy,
    backgroundColor: 'rgba(240,246,252,0.90)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(200,218,235,0.75)',
    maxHeight: 90,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1a2d4e',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  // Members list
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(200,218,235,0.75)',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(15,30,53,0.07)',
  },
});
