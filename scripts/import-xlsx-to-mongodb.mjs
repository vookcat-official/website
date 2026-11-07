import { randomBytes } from "node:crypto";
import path from "node:path";
import ExcelJS from "exceljs";
import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI?.trim();
if (!mongoUri) throw new Error("Set MONGODB_URI before importing the workbook.");

const databaseName = process.env.MONGODB_DB?.trim() || "vookcat";
const workbookPath = path.resolve(process.env.EXCEL_FILE_PATH?.trim() || "data/app-data.xlsx");
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(workbookPath);

function readRows(sheetName, requiredHeaders, optionalHeaders = []) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Missing worksheet: ${sheetName}`);
  const headers = sheet.getRow(1).values.slice(1).map((value) => String(value ?? "").trim());
  const allHeaders = [...requiredHeaders, ...optionalHeaders];
  const columns = Object.fromEntries(allHeaders.map((header) => {
    const index = headers.indexOf(header);
    if (index < 0 && requiredHeaders.includes(header)) {
      throw new Error(`Missing ${header} column in ${sheetName}.`);
    }
    return [header, index < 0 ? 0 : index + 1];
  }));
  const rows = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = Object.fromEntries(allHeaders.map((header) => {
      if (!columns[header]) return [header, ""];
      const cell = row.getCell(columns[header]);
      const value = cell.value instanceof Date ? cell.value.toISOString() : cell.text;
      return [header, String(value ?? "").trim()];
    }));
    if (Object.values(values).some(Boolean)) rows.push(values);
  }
  return rows;
}

const users = readRows("Users", ["username", "password", "role", "createdAt"], ["email", "avatar"])
  .map(({ username, password, role, createdAt, email, avatar }) => ({
    username,
    usernameKey: username.toLowerCase(),
    password,
    role: role === "admin" || role === "member" ? role : "user",
    createdAt,
    email,
    avatar,
  }));
const settings = readRows("Settings", ["key", "value"])
  .filter(({ key }) => key)
  .map(({ key, value }) => ({ _id: key, value }));
const replays = readRows("Replays", ["id", "title", "url", "createdAt"])
  .filter(({ title, url }) => title || url)
  .map(({ id, title, url, createdAt }) => ({
    _id: id || randomBytes(16).toString("hex"),
    title,
    url,
    createdAt,
    access: "member",
  }));
const sessions = readRows("Sessions", ["tokenHash", "username", "role", "expiresAt"])
  .map(({ tokenHash, username, role, expiresAt }) => ({
    _id: tokenHash,
    username,
    role: role === "admin" || role === "member" ? role : "user",
    expiresAt: new Date(expiresAt),
  }))
  .filter(({ _id, username, expiresAt }) => _id && username && !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date());

if (users.some(({ username, password }) => !username || !password)) {
  throw new Error("Workbook contains a user without a username or password.");
}
const usernames = users.map(({ usernameKey }) => usernameKey);
if (new Set(usernames).size !== usernames.length) {
  throw new Error("Workbook contains duplicate usernames (case-insensitive); resolve them before importing.");
}

const client = new MongoClient(mongoUri);
try {
  await client.connect();
  const db = client.db(databaseName);
  const names = ["users", "settings", "replays", "sessions"];
  const initialSettings = {
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
  await db.collection("users").createIndex({ usernameKey: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await client.withSession(async (session) => session.withTransaction(async () => {
    const counts = await Promise.all(names.map(async (name) =>
      db.collection(name).countDocuments({}, { session })
    ));
    const existingSettings = counts[1]
      ? await db.collection("settings").find({}, { session }).toArray()
      : [];
    const onlyInitialSettings =
      existingSettings.length === Object.keys(initialSettings).length &&
      existingSettings.every(({ _id, value }) =>
        Object.hasOwn(initialSettings, _id) && initialSettings[_id] === value
      );
    const occupied = names.filter((name, index) =>
      name === "settings"
        ? counts[index] > 0 && !onlyInitialSettings
        : counts[index] > 0
    );
    if (occupied.length) {
      throw new Error(`Import stopped: target collections are not empty (${occupied.join(", ")}).`);
    }

    if (onlyInitialSettings) await db.collection("settings").deleteMany({}, { session });
    for (const [name, documents] of Object.entries({ users, settings, replays, sessions })) {
      if (documents.length) await db.collection(name).insertMany(documents, { session });
    }
  }));
  console.log(`Imported ${users.length} users, ${settings.length} settings, ${replays.length} replays, and ${sessions.length} active sessions into ${databaseName}.`);
} finally {
  await client.close();
}
