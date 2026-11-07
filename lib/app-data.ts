import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { Db } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

const scrypt = promisify(scryptCallback);
const sessionSeconds = 6 * 60 * 60;
const easyDonateApi = "https://api.easydonate.app/api/v1";
const easyDonateCacheSeconds = 10;
const defaults = {
  yt_live: "",
  link_yt: "https://www.youtube.com/",
  link_ezdo: "https://easydonate.app/",
  link_tiktok: "https://www.tiktok.com/",
  link_ig: "https://www.instagram.com/",
  link_fb: "https://www.facebook.com/",
  link_roblox_profile: "https://www.roblox.com/",
  link_roblox_group: "https://www.roblox.com/groups/",
  link_discord: "https://discord.gg/",
};
export type Role = "admin" | "user" | "member";
export type Session = { username: string; role: Role; exp: number };
export type Settings = typeof defaults;
export type ReplayAccess = "free" | "member";
export type Replay = { id: string; title: string; url: string; createdAt: string; access: ReplayAccess };

let easyDonateCache: { result: DonationResult; expiresAt: number } | undefined;
const failedLogins = new Map<string, { count: number; expiresAt: number }>();
let initialization: Promise<Db> | undefined;

type UserDocument = {
  username: string;
  usernameKey: string;
  password: string;
  role: Role;
  createdAt: string;
  email: string;
  avatar: string;
};
type SettingsDocument = { _id: keyof Settings; value: string };
type ReplayDocument = {
  _id: string;
  title: string;
  url: string;
  createdAt: string;
  access?: ReplayAccess;
};
type StoredSession = { _id: string; username: string; role: Role; expiresAt: Date };

type DonationResult = {
  ok: boolean;
  msg?: string;
  data?: { leaderboard: unknown[]; timer: Record<string, unknown> };
  warning?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function collection<T extends object>(db: Db, name: string) {
  return db.collection<T>(name);
}

async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${key.toString("hex")}`;
}

async function passwordMatches(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return stored === password;
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function initializeDatabase() {
  const db = await getDatabase();
  await Promise.all([
    collection<UserDocument>(db, "users").createIndex({ usernameKey: 1 }, { unique: true }),
    collection<StoredSession>(db, "sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
  await collection<SettingsDocument>(db, "settings").bulkWrite(
    (Object.entries(defaults) as [keyof Settings, string][]).map(([key, value]) => ({
      updateOne: {
        filter: { _id: key },
        update: { $setOnInsert: { value } },
        upsert: true,
      },
    })),
  );
  return db;
}

async function getDb() {
  if (!initialization) {
    initialization = initializeDatabase().catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}

export async function initializeData() {
  await getDb();
}

export async function getPublicData() {
  return { settings: await getSettings() };
}

async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const settings: Settings = { ...defaults };
  const rows = await collection<SettingsDocument>(db, "settings").find().toArray();
  for (const { _id, value } of rows) if (_id in settings) settings[_id] = value;
  return settings;
}

function formatDate(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
}

async function getReplays(access?: ReplayAccess): Promise<Replay[]> {
  const db = await getDb();
  const filter = access === "free"
    ? { access: "free" as const }
    : access === "member"
      ? { access: { $ne: "free" as const } }
      : {};
  const rows = await collection<ReplayDocument>(db, "replays")
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return rows.map(({ _id, title, url, createdAt, access: replayAccess }) => ({
    id: _id,
    title,
    url,
    createdAt: formatDate(createdAt),
    access: replayAccess === "free" ? "free" : "member",
  }));
}

function encodeSegment(value: string) {
  return Buffer.from(value).toString("base64url");
}

function sessionSecret() {
  const secret = requiredEnv("SESSION_SECRET");
  if (secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return secret;
}

export function createSession(username: string, role: Role) {
  const session: Session = {
    username,
    role,
    exp: Math.floor(Date.now() / 1000) + sessionSeconds,
  };
  const payload = encodeSegment(JSON.stringify(session));
  const signature = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function getSessionPayload(token: string): Session {
  const [payload] = token.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
}

export async function readSession(token?: string | null): Promise<Session> {
  if (!token) throw new Error("SESSION_EXPIRED");
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("SESSION_EXPIRED");
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    throw new Error("SESSION_EXPIRED");
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("SESSION_EXPIRED");
  }
  let session: Session;
  try {
    session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
  } catch {
    throw new Error("SESSION_EXPIRED");
  }
  if (
    !session.username ||
    !["admin", "user", "member"].includes(session.role) ||
    session.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error("SESSION_EXPIRED");
  }
  const db = await getDb();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [stored, user] = await Promise.all([
    collection<StoredSession>(db, "sessions").findOne({
      _id: tokenHash,
      username: session.username,
      role: session.role,
      expiresAt: { $gt: new Date() },
    }),
    collection<UserDocument>(db, "users").findOne(
      { usernameKey: session.username.toLowerCase() },
      { projection: { role: 1 } },
    ),
  ]);
  if (!stored || user?.role !== session.role) throw new Error("SESSION_EXPIRED");
  return session;
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionSeconds}${secure}`;
}

export function clearedSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export async function revokeSession(token?: string | null) {
  if (!token) return;
  const db = await getDb();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await collection<StoredSession>(db, "sessions").deleteOne({ _id: tokenHash });
}

function requireAdmin(session: Session) {
  if (session.role !== "admin") throw new Error("ต้องเป็นแอดมินเท่านั้น");
}

export async function login(usernameValue: unknown, passwordValue: unknown) {
  const db = await getDb();
  const username = String(usernameValue ?? "").trim();
  const password = String(passwordValue ?? "");
  const key = username.toLowerCase();
  const failed = failedLogins.get(key);
  if (failed && failed.expiresAt > Date.now() && failed.count >= 5) {
    return { ok: false as const, msg: "ลองผิดหลายครั้ง กรุณารอ 5 นาที" };
  }

  const users = collection<UserDocument>(db, "users");
  const user = await users.findOne({ usernameKey: key });
  if (!user) {
    return { ok: false as const, msg: "ยังไม่มีบัญชีผู้ใช้ในฐานข้อมูล MongoDB" };
  }
  if (!(await passwordMatches(password, user.password))) {
    failedLogins.set(key, {
      count: failed && failed.expiresAt > Date.now() ? failed.count + 1 : 1,
      expiresAt: failed && failed.expiresAt > Date.now() ? failed.expiresAt : Date.now() + 300_000,
    });
    return { ok: false as const, msg: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }
  failedLogins.delete(key);
  if (!user.password.startsWith("scrypt$")) {
    await users.updateOne({ _id: user._id }, { $set: { password: await passwordHash(password) } });
  }
  const role = user.role === "admin" || user.role === "member" ? user.role : "user";
  const token = createSession(user.username, role);
  const session = getSessionPayload(token);
  await collection<StoredSession>(db, "sessions").insertOne({
    _id: createHash("sha256").update(token).digest("hex"),
    username: user.username,
    role,
    expiresAt: new Date(session.exp * 1000),
  });
  return {
    ok: true as const,
    token,
  };
}

export async function getHome(session: Session) {
  const db = await getDb();
  const user = await collection<UserDocument>(db, "users").findOne({
    usernameKey: session.username.toLowerCase(),
  });
  const canViewMemberContent = session.role === "admin" || session.role === "member";
  return {
    username: session.username,
    role: session.role,
    canViewMemberContent,
    email: user?.email ?? "",
    avatar: user?.avatar ?? "",
    settings: await getSettings(),
    replays: await getReplays("free"),
    memberReplays: canViewMemberContent ? await getReplays("member") : [],
    adminReplays: session.role === "admin" ? await getReplays() : [],
  };
}

export async function saveUserProfile(session: Session, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, msg: "ข้อมูลโปรไฟล์ไม่ถูกต้อง" };
  }
  const profile = value as Record<string, unknown>;
  const email = String(profile.email ?? "").trim();
  const avatar = String(profile.avatar ?? "");
  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { ok: false, msg: "กรุณากรอกอีเมลให้ถูกต้อง" };
  }
  if (
    avatar.length > 32_000 ||
    (avatar && !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar))
  ) {
    return { ok: false, msg: "รูปโปรไฟล์ไม่ถูกต้องหรือมีขนาดใหญ่เกินไป" };
  }
  const db = await getDb();
  const result = await collection<UserDocument>(db, "users").updateOne(
    { usernameKey: session.username.toLowerCase() },
    { $set: { email, avatar } },
  );
  if (!result.matchedCount) throw new Error("ไม่พบบัญชีผู้ใช้");
  return { ok: true };
}

export async function getEasyDonate() {
  const key = (process.env.EASYDONATE_API_KEY ?? "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!key) {
    return {
      ok: false as const,
      msg: "กรุณาตั้งค่า EASYDONATE_API_KEY ใน environment variables",
    };
  }
  if (!key.startsWith("ezdn_v1_")) {
    return {
      ok: false as const,
      msg: "API key ต้องขึ้นต้นด้วย ezdn_v1_ กรุณาตรวจสอบว่าก๊อปมาถูกต้อง",
    };
  }
  if (easyDonateCache && easyDonateCache.expiresAt > Date.now()) {
    return easyDonateCache.result;
  }

  const warnings: string[] = [];
  let leaderboard: unknown[] = [];
  let timer: Record<string, unknown> = {};
  const fetchWidget = async (path: string) => {
    const response = await fetch(`${easyDonateApi}${path}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const error = body.error;
      let detail: unknown =
        typeof error === "string"
          ? error
          : (error as { message?: unknown } | undefined)?.message;
      if (Array.isArray(detail)) detail = detail.join(", ");
      if (typeof detail !== "string") detail = undefined;
      throw new Error(
        response.status === 401
          ? "API key ไม่ถูกต้องหรือหมดอายุ (HTTP 401)"
          : response.status === 403
            ? `API key นี้ไม่มี scope read:widgets (HTTP 403) → สร้างคีย์ใหม่ใน EasyDonate โดยติ๊ก read:widgets แล้วอัปเดต EASYDONATE_API_KEY${detail ? ` [${detail}]` : ""}`
            : response.status === 429
              ? "เรียก API บ่อยเกินไป (HTTP 429) กรุณารอสักครู่แล้วลองใหม่"
              : `HTTP ${response.status} ที่ ${path}${detail ? `: ${detail}` : ""}`,
      );
    }
    return Object.hasOwn(body, "data") ? body.data : body;
  };
  try {
    const value = await fetchWidget("/widgets/leaderboard");
    const root = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const list = Array.isArray(value)
      ? value
      : [root.leaderboard, root.items, root.data].find(Array.isArray);
    leaderboard = (list as unknown[] | undefined) ?? [];
  } catch (error) {
    warnings.push(`โหลด Leaderboard ไม่สำเร็จ: ${error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}`);
  }
  try {
    const value = await fetchWidget("/widgets/timer");
    const root = value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
    const nested = root.timer ?? root.data ?? root;
    timer = nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : {};
  } catch (error) {
    warnings.push(`โหลด Donate Timer ไม่สำเร็จ: ${error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}`);
  }
  const result = { ok: true as const, data: { leaderboard, timer }, warning: warnings.join(" ") };
  if (!warnings.length) {
    easyDonateCache = { result, expiresAt: Date.now() + easyDonateCacheSeconds * 1000 };
  }
  return result;
}

export async function listUsers(session: Session) {
  requireAdmin(session);
  const db = await getDb();
  const users = await collection<UserDocument>(db, "users")
    .find({}, { projection: { username: 1, role: 1, createdAt: 1 } })
    .sort({ usernameKey: 1 })
    .toArray();
  return users.map(({ username, role, createdAt }) => ({
    username,
    role: role === "admin" || role === "member" ? role : "user",
    createdAt: formatDate(createdAt),
  }));
}

export async function addUser(session: Session, body: Record<string, unknown>) {
  requireAdmin(session);
  const db = await getDb();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const role = body.role;
  if (role !== "admin" && role !== "user" && role !== "member") {
    return { ok: false, msg: "Role ไม่ถูกต้อง" };
  }
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
    return { ok: false, msg: "ชื่อผู้ใช้ 3-30 ตัว (A-Z, 0-9, _ . -)" };
  }
  if (password.length < 6 || password.length > 128) {
    return { ok: false, msg: "รหัสผ่านต้องมี 6-128 ตัว" };
  }
  try {
    await collection<UserDocument>(db, "users").insertOne({
      username,
      usernameKey: username.toLowerCase(),
      password: await passwordHash(password),
      role,
      createdAt: new Date().toISOString(),
      email: "",
      avatar: "",
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return { ok: false, msg: "มีชื่อผู้ใช้นี้แล้ว" };
    }
    throw error;
  }
  return { ok: true };
}

export async function registerUser(body: Record<string, unknown>) {
  const db = await getDb();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
    return { ok: false, msg: "ชื่อผู้ใช้ 3-30 ตัว (A-Z, 0-9, _ . -)" };
  }
  if (password.length < 6 || password.length > 128) {
    return { ok: false, msg: "รหัสผ่านต้องมี 6-128 ตัว" };
  }
  try {
    await collection<UserDocument>(db, "users").insertOne({
      username,
      usernameKey: username.toLowerCase(),
      password: await passwordHash(password),
      role: "user",
      createdAt: new Date().toISOString(),
      email: "",
      avatar: "",
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return { ok: false, msg: "มีชื่อผู้ใช้นี้แล้ว" };
    }
    throw error;
  }
  return { ok: true };
}

export async function updateUserRole(
  session: Session,
  usernameValue: unknown,
  roleValue: unknown,
) {
  requireAdmin(session);
  const username = String(usernameValue ?? "").trim();
  if (username.toLowerCase() === session.username.toLowerCase()) {
    return { ok: false, msg: "เปลี่ยน Role ของบัญชีที่กำลังใช้อยู่ไม่ได้" };
  }
  if (roleValue !== "admin" && roleValue !== "user" && roleValue !== "member") {
    return { ok: false, msg: "Role ไม่ถูกต้อง" };
  }

  const db = await getDb();
  const users = collection<UserDocument>(db, "users");
  const target = await users.findOne({ usernameKey: username.toLowerCase() });
  if (!target) return { ok: false, msg: "ไม่พบผู้ใช้" };
  if (target.role === "admin" && roleValue !== "admin") {
    const adminCount = await users.countDocuments({ role: "admin" });
    if (adminCount <= 1) return { ok: false, msg: "ต้องมีแอดมินอย่างน้อย 1 บัญชี" };
  }
  if (target.role !== roleValue) {
    await users.updateOne({ _id: target._id }, { $set: { role: roleValue } });
    await collection<StoredSession>(db, "sessions").deleteMany({ username: target.username });
  }
  return { ok: true };
}

export async function deleteUser(session: Session, usernameValue: unknown) {
  requireAdmin(session);
  const db = await getDb();
  const username = String(usernameValue ?? "");
  if (username.toLowerCase() === session.username.toLowerCase()) {
    return { ok: false, msg: "ลบบัญชีที่กำลังใช้อยู่ไม่ได้" };
  }
  const users = collection<UserDocument>(db, "users");
  const target = await users.findOne({ usernameKey: username.toLowerCase() });
  if (!target) return { ok: false, msg: "ไม่พบผู้ใช้" };
  await users.deleteOne({ _id: target._id });
  await collection<StoredSession>(db, "sessions").deleteMany({ username: target.username });
  return { ok: true };
}

export async function resetPassword(session: Session, body: Record<string, unknown>) {
  requireAdmin(session);
  const db = await getDb();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  if (password.length < 6 || password.length > 128) {
    return { ok: false, msg: "รหัสผ่านต้องมี 6-128 ตัว" };
  }
  const result = await collection<UserDocument>(db, "users").updateOne(
    { usernameKey: username.toLowerCase() },
    { $set: { password: await passwordHash(password) } },
  );
  if (!result.matchedCount) return { ok: false, msg: "ไม่พบผู้ใช้" };
  return { ok: true };
}

export async function saveSettings(session: Session, value: unknown) {
  requireAdmin(session);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, msg: "ข้อมูลการตั้งค่าไม่ถูกต้อง" };
  }
  const input = value as Record<string, unknown>;
  const knownKeys = Object.keys(defaults) as (keyof Settings)[];
  const updates: { key: keyof Settings; value: string }[] = [];
  for (const key of knownKeys) {
    if (!(key in input)) continue;
    const url = String(input[key] ?? "").trim();
    if (url && !/^https?:\/\//i.test(url)) {
      return { ok: false, msg: "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://" };
    }
    updates.push({ key, value: url });
  }
  if (updates.length) {
    const db = await getDb();
    await collection<SettingsDocument>(db, "settings").bulkWrite(
      updates.map(({ key, value }) => ({
        updateOne: { filter: { _id: key }, update: { $set: { value } }, upsert: true },
      })),
    );
  }
  return { ok: true };
}

export async function addReplay(session: Session, body: Record<string, unknown>) {
  requireAdmin(session);
  const db = await getDb();
  const title = String(body.title ?? "").trim();
  const url = String(body.url ?? "").trim();
  const access = body.access;
  if (!title || title.length > 120) {
    return { ok: false, msg: "กรุณาใส่ชื่อคลิปไม่เกิน 120 ตัวอักษร" };
  }
  if (access !== "free" && access !== "member") {
    return { ok: false, msg: "กรุณาเลือกประเภทคลิป" };
  }
  if (
    !/^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url) ||
    !/(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)[A-Za-z0-9_-]{11}/i.test(url)
  ) {
    return { ok: false, msg: "กรุณาใส่ลิงก์คลิป YouTube ที่ถูกต้อง" };
  }
  await collection<ReplayDocument>(db, "replays").insertOne({
    _id: randomBytes(16).toString("hex"),
    title,
    url,
    createdAt: new Date().toISOString(),
    access,
  });
  return { ok: true, msg: "เพิ่มคลิปแล้ว" };
}

export async function deleteReplay(session: Session, idValue: unknown) {
  requireAdmin(session);
  const db = await getDb();
  const id = String(idValue ?? "");
  const result = await collection<ReplayDocument>(db, "replays").deleteOne({ _id: id });
  if (!result.deletedCount) return { ok: false, msg: "ไม่พบคลิป" };
  return { ok: true };
}
