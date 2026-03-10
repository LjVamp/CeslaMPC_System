// src/screens/localAuthService.js
// CESLA MPC — Local Auth Service (AsyncStorage only)
// Walay Firebase, walay backend server.
// Tanan member data i-store sa device AsyncStorage.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const MEMBERS_KEY = "@ceslampc_members";
const SESSION_KEY = "@ceslampc_session";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Simple password hash (NOT for production — para demo/prototype lang)
const hashPassword = (pw) => {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    hash = (hash << 5) - hash + pw.charCodeAt(i);
    hash |= 0;
  }
  return "h_" + Math.abs(hash).toString(36) + pw.length;
};

const checkPassword = (pw, hash) => hashPassword(pw) === hash;

// Get all members from AsyncStorage
const getMembers = async () => {
  try {
    const raw = await AsyncStorage.getItem(MEMBERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Save all members back to AsyncStorage
const saveMembers = async (members) => {
  await AsyncStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE NEXT USER ID
// ─────────────────────────────────────────────────────────────────────────────
export const generateNextUserId = async () => {
  const year = new Date().getFullYear();
  const members = await getMembers();
  const prefix = `CESLA-${year}-`;

  // Find highest number this year
  const nums = members
    .map((m) => m.userId)
    .filter((uid) => uid && uid.startsWith(prefix))
    .map((uid) => parseInt(uid.replace(prefix, ""), 10))
    .filter((n) => !isNaN(n));

  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────────────────────
export const registerMember = async ({
  lastName,
  firstName,
  middleName,
  password,
}) => {
  const members = await getMembers();

  // Generate unique User ID
  const userId = await generateNextUserId();

  // Build display name: "Dela Cruz, Juan M."
  const middleInitial = middleName?.trim()
    ? " " + middleName.trim().charAt(0).toUpperCase() + "."
    : "";
  const fullName = `${lastName.trim()}, ${firstName.trim()}${middleInitial}`;

  const newMember = {
    uid: userId, // use userId as unique key
    userId,
    name: fullName,
    lastName: lastName.trim(),
    firstName: firstName.trim(),
    middleName: middleName?.trim() || "",
    passwordHash: hashPassword(password),
    role: "member",
    status: "Pending", // admin must approve
    shares: 0,
    savings: 0,
    loan: 0,
    loanBalance: 0,
    creditBalance: 0,
    contact: "",
    address: "",
    appForm: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  members.push(newMember);
  await saveMembers(members);

  // Return member without password hash
  const { passwordHash, ...memberSafe } = newMember;
  return memberSafe;
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
export const loginByUserId = async (userId, password) => {
  const members = await getMembers();
  const member = members.find((m) => m.userId === userId.trim());

  if (!member) throw new Error("User ID not found. Please check your ID.");

  if (!checkPassword(password, member.passwordHash))
    throw new Error("Incorrect password. Please try again.");

  if (member.status === "Pending")
    throw new Error("Your account is pending admin approval. Please wait.");

  if (member.status === "Inactive" || member.status === "Suspended")
    throw new Error(
      `Your account is ${member.status.toLowerCase()}. Contact admin.`,
    );

  // Save session
  const { passwordHash, ...memberSafe } = member;
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(memberSafe));
  return memberSafe;
};

// ─────────────────────────────────────────────────────────────────────────────
// SESSION
// ─────────────────────────────────────────────────────────────────────────────
export const getStoredMember = async () => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const logoutUser = async () => {
  await AsyncStorage.removeItem(SESSION_KEY);
};

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD (for dashboard use)
// ─────────────────────────────────────────────────────────────────────────────
export const changePassword = async (userId, oldPassword, newPassword) => {
  const members = await getMembers();
  const idx = members.findIndex((m) => m.userId === userId);
  if (idx === -1) throw new Error("Member not found.");

  if (!checkPassword(oldPassword, members[idx].passwordHash))
    throw new Error("Current password is incorrect.");

  members[idx].passwordHash = hashPassword(newPassword);
  members[idx].updatedAt = new Date().toISOString();
  await saveMembers(members);
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROFILE (for dashboard use)
// ─────────────────────────────────────────────────────────────────────────────
export const updateMemberProfile = async (userId, updates) => {
  const members = await getMembers();
  const idx = members.findIndex((m) => m.userId === userId);
  if (idx === -1) throw new Error("Member not found.");

  members[idx] = {
    ...members[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await saveMembers(members);

  const { passwordHash, ...memberSafe } = members[idx];

  // Update session too
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(memberSafe));
  return memberSafe;
};
