import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { User, Message, Memory } from "./models.js";
import { authRequired, makeToken } from "./auth.js";

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const io = new Server(server, { cors: { origin: allowedOrigin, methods: ["GET", "POST"] } });
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "100kb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 40 }));
app.get("/api/health", (_req, res) => res.json({ ok: true, app: "ChitChat" }));

const safeUser = u => ({ id: u._id.toString(), username: u.username, displayName: u.displayName, avatarColor: u.avatarColor, lastSeen: u.lastSeen });

app.post("/api/auth/register", async (req, res) => {
  try {
    let { username, displayName, password } = req.body || {};
    username = String(username || "").trim().toLowerCase();
    displayName = String(displayName || "").trim();
    password = String(password || "");
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: "Username must be 3–24 characters (letters, numbers, underscores)." });
    if (displayName.length < 1 || displayName.length > 40) return res.status(400).json({ error: "Enter a display name (max 40 characters)." });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (await User.exists({ username })) return res.status(409).json({ error: "That username is already taken." });
    const passwordHash = await bcrypt.hash(password, 12);
    const avatarColor = ["#0b806b", "#3867a8", "#9b5a8c", "#b46d2d", "#4b8061"][Math.floor(Math.random() * 5)];
    const user = await User.create({ username, displayName, passwordHash, avatarColor });
    res.status(201).json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) { res.status(500).json({ error: "Could not create account." }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Incorrect username or password." });
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch { res.status(500).json({ error: "Could not log in." }); }
});

app.get("/api/me", authRequired, (req, res) => res.json({ user: safeUser(req.user) }));

app.get("/api/users", authRequired, async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (q.length < 1) return res.json({ users: [] });
  const users = await User.find({ _id: { $ne: req.user._id }, $or: [
    { username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
    { displayName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
  ] }).select("username displayName avatarColor lastSeen").limit(20);
  res.json({ users: users.map(safeUser) });
});

app.get("/api/messages/:userId", authRequired, async (req, res) => {
  const otherId = req.params.userId;
  if (!mongoose.isValidObjectId(otherId)) return res.status(400).json({ error: "Invalid user." });
  const other = await User.findById(otherId).select("_id");
  if (!other) return res.status(404).json({ error: "User not found." });
  const messages = await Message.find({ $or: [
    { sender: req.user._id, recipient: other._id },
    { sender: other._id, recipient: req.user._id }
  ] }).sort({ createdAt: 1 }).limit(500);
  await Message.updateMany({ sender: other._id, recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ messages: messages.map(m => ({ id: m._id.toString(), senderId: m.sender.toString(), recipientId: m.recipient.toString(), text: m.text, createdAt: m.createdAt, readAt: m.readAt })) });
});

app.get("/api/memories", authRequired, async (_req, res) => {
  const memories = await Memory.find({ expiresAt: { $gt: new Date() } }).populate("user", "username displayName avatarColor").sort({ createdAt: -1 }).limit(100);
  res.json({ memories: memories.map(m => ({ id: m._id.toString(), text: m.text, createdAt: m.createdAt, expiresAt: m.expiresAt, user: safeUser(m.user) })) });
});
app.post("/api/memories", authRequired, async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text || text.length > 500) return res.status(400).json({ error: "Memory must be 1–500 characters." });
  const memory = await Memory.create({ user: req.user._id, text, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  const populated = await memory.populate("user", "username displayName avatarColor");
  const result = { id: populated._id.toString(), text: populated.text, createdAt: populated.createdAt, expiresAt: populated.expiresAt, user: safeUser(populated.user) };
  io.emit("memory:new", result);
  res.status(201).json({ memory: result });
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select("_id username displayName avatarColor");
    if (!user) return next(new Error("Unauthorized"));
    socket.user = user;
    next();
  } catch { next(new Error("Unauthorized")); }
});

const online = new Map(); // userId -> Set(socketId)
io.on("connection", socket => {
  const uid = socket.user._id.toString();
  if (!online.has(uid)) online.set(uid, new Set());
  online.get(uid).add(socket.id);
  socket.join(`user:${uid}`);
  io.emit("presence:update", { userId: uid, online: true });

  socket.on("message:send", async (payload, ack) => {
    try {
      const recipientId = String(payload?.recipientId || "");
      const text = String(payload?.text || "").trim();
      if (!mongoose.isValidObjectId(recipientId) || text.length < 1 || text.length > 4000) {
        if (typeof ack === "function") ack({ ok: false, error: "Invalid recipient or message." });
        return;
      }
      const recipient = await User.findById(recipientId).select("_id");
      if (!recipient || recipientId === uid) {
        if (typeof ack === "function") ack({ ok: false, error: "Recipient not found." });
        return;
      }
      const doc = await Message.create({ sender: socket.user._id, recipient: recipient._id, text });
      const message = { id: doc._id.toString(), senderId: uid, recipientId, text: doc.text, createdAt: doc.createdAt, readAt: null };
      io.to(`user:${uid}`).to(`user:${recipientId}`).emit("message:new", message);
      if (typeof ack === "function") ack({ ok: true, message });
    } catch {
      if (typeof ack === "function") ack({ ok: false, error: "Message could not be sent." });
    }
  });

  socket.on("typing:set", ({ recipientId, typing }) => {
    if (mongoose.isValidObjectId(String(recipientId || ""))) {
      io.to(`user:${recipientId}`).emit("typing:update", { userId: uid, typing: Boolean(typing) });
    }
  });

  socket.on("disconnect", async () => {
    const sockets = online.get(uid);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        online.delete(uid);
        await User.findByIdAndUpdate(uid, { lastSeen: new Date() }).catch(() => {});
        io.emit("presence:update", { userId: uid, online: false, lastSeen: new Date() });
      }
    }
  });
});

const port = Number(process.env.PORT || 5000);
try {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) throw new Error("Set MONGO_URI and JWT_SECRET in server/.env");
  await mongoose.connect(process.env.MONGO_URI);
  server.listen(port, () => console.log(`ChitChat API running on http://localhost:${port}`));
} catch (e) {
  console.error("Startup failed:", e.message);
  process.exit(1);
}
