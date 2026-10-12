import "dotenv/config";

import express from "express";
import http from "http";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";

import { User, Message, Memory } from "./models.js";
import { authRequired, makeToken } from "./auth.js";

const app = express();
const server = http.createServer(app);

// ==========================================
// SERVER CONFIGURATION
// ==========================================

const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// CORS middleware must run BEFORE static uploads.
app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "100kb" }));

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT"],
  },
});

// ==========================================
// FILE UPLOAD CONFIGURATION
// ==========================================

const uploadsDir = path.join(process.cwd(), "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

app.use(
  "/uploads",
  express.static(uploadsDir, {
    fallthrough: false,
    index: false,
  }),
);

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  "video/mp4",
  "video/webm",
  "video/quicktime",

  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/webm",

  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },

    filename: (_req, file, cb) => {
      const extension = path
        .extname(file.originalname || "")
        .slice(0, 12)
        .replace(/[^.a-zA-Z0-9]/g, "");

      cb(null, `${randomUUID()}${extension}`);
    },
  }),

  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(
        new Error(
          "Unsupported file type. Upload an image, video, audio, PDF, or office document.",
        ),
      );
    }

    cb(null, true);
  },
});

// ==========================================
// RATE LIMITING AND HEALTH CHECK
// ==========================================

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "ChitChat",
  });
});

// ==========================================
// SAFE USER RESPONSE
// ==========================================

const safeUser = (user) => ({
  id: user._id.toString(),
  username: user.username,
  displayName: user.displayName,
  avatarColor: user.avatarColor,
  profilePhoto: user.profilePhoto || "",
  about: user.about || "Hey there! I'm using ChitChat.",
  lastSeen: user.lastSeen,
});

// ==========================================
// PUBLIC MESSAGE RESPONSE
// ==========================================

const publicMessage = (message) => ({
  id: message._id.toString(),
  senderId: message.sender.toString(),
  recipientId: message.recipient.toString(),
  text: message.text || "",

  attachment: message.attachment?.url
    ? {
        url: message.attachment.url,
        originalName: message.attachment.originalName,
        mimeType: message.attachment.mimeType,
        size: message.attachment.size,
      }
    : null,

  createdAt: message.createdAt,
  readAt: message.readAt || null,
  replyTo: message.replyTo ? message.replyTo.toString() : null,
  editedAt: message.editedAt || null,
  deletedAt: message.deletedAt || null,
  reactions: (message.reactions || []).map((r) => ({
    userId: r.user?.toString ? r.user.toString() : String(r.user),
    emoji: r.emoji,
  })),
});

// ==========================================
// REGISTER
// ==========================================

app.post("/api/auth/register", async (req, res) => {
  try {
    let { username, displayName, password } = req.body || {};

    username = String(username || "")
      .trim()
      .toLowerCase();
    displayName = String(displayName || "").trim();
    password = String(password || "");

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return res.status(400).json({
        error:
          "Username must be 3-24 characters using letters, numbers or underscores.",
      });
    }

    if (displayName.length < 1 || displayName.length > 40) {
      return res.status(400).json({
        error: "Enter a display name (max 40 characters).",
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        error: "Password must be between 8 and 128 characters.",
      });
    }

    if (await User.exists({ username })) {
      return res.status(409).json({
        error: "That username is already taken.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const colors = [
      "#0b806b",
      "#3867a8",
      "#9b5a8c",
      "#b46d2d",
      "#4b8061",
      "#e05252",
      "#7546a8",
      "#d49a24",
    ];

    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const user = await User.create({
      username,
      displayName,
      passwordHash,
      avatarColor,
    });

    res.status(201).json({
      token: makeToken(user),
      user: safeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: "That username is already taken.",
      });
    }

    console.error("Registration error:", error.message);

    res.status(500).json({
      error: "Could not create account.",
    });
  }
});

// ==========================================
// LOGIN
// ==========================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();

    const password = String(req.body?.password || "");

    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        error: "Incorrect username or password.",
      });
    }

    res.json({
      token: makeToken(user),
      user: safeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      error: "Could not log in.",
    });
  }
});

// ==========================================
// GET CURRENT USER
// ==========================================

app.get("/api/me", authRequired, (req, res) => {
  res.json({
    user: safeUser(req.user),
  });
});

// ==========================================
// UPDATE PROFILE
// ==========================================

const allowedAvatarColors = [
  "#0b806b",
  "#3867a8",
  "#9b5a8c",
  "#b46d2d",
  "#4b8061",
  "#e05252",
  "#7546a8",
  "#d49a24",
];

app.put("/api/me", authRequired, async (req, res) => {
  try {
    const displayName = String(req.body?.displayName ?? "").trim();

    const username = String(req.body?.username ?? "")
      .trim()
      .toLowerCase();

    const avatarColor = String(req.body?.avatarColor ?? "");

    const about = String(
      req.body?.about ?? "Hey there! I'm using ChitChat.",
    ).trim();

    const profilePhoto = String(req.body?.profilePhoto ?? "").trim();

    if (about.length > 150) {
      return res.status(400).json({
        error: "About must be 150 characters or fewer.",
      });
    }

    if (profilePhoto.length > 2048) {
      return res.status(400).json({
        error: "Profile photo URL is too long.",
      });
    }

    if (
      profilePhoto &&
      !/^https?:\/\//i.test(profilePhoto) &&
      !profilePhoto.startsWith("/uploads/")
    ) {
      return res.status(400).json({
        error: "Profile photo must be an HTTP(S) URL or an uploaded file URL.",
      });
    }

    if (displayName.length < 1 || displayName.length > 40) {
      return res.status(400).json({
        error: "Display name must contain 1-40 characters.",
      });
    }

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return res.status(400).json({
        error:
          "Username must be 3-24 characters using letters, numbers or underscores.",
      });
    }

    if (!allowedAvatarColors.includes(avatarColor)) {
      return res.status(400).json({
        error: "Please select a valid avatar colour.",
      });
    }

    const existingUser = await User.findOne({
      username,
      _id: { $ne: req.user._id },
    }).select("_id");

    if (existingUser) {
      return res.status(409).json({
        error: "This username is already taken.",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          displayName,
          username,
          avatarColor,
          about,
          profilePhoto,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedUser) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    res.json({
      message: "Profile updated successfully!",
      user: safeUser(updatedUser),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: "This username is already taken.",
      });
    }

    console.error("Profile update error:", error.message);

    res.status(500).json({
      error: "Could not update profile.",
    });
  }
});

// Upload profile photo (image only, max 5 MB)
app.post("/api/me/photo", authRequired, (req, res) => {
  const photoUpload = upload.single("file");
  photoUpload(req, res, async (error) => {
    if (error)
      return res
        .status(400)
        .json({ error: error.message || "Could not upload profile photo." });
    if (!req.file) return res.status(400).json({ error: "Choose an image." });
    if (!req.file.mimetype.startsWith("image/")) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Profile photo must be an image." });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      fs.unlink(req.file.path, () => {});
      return res
        .status(400)
        .json({ error: "Profile photo must be 5 MB or smaller." });
    }
    try {
      const profilePhoto = `/uploads/${path.basename(req.file.filename)}`;
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { profilePhoto } },
        { new: true },
      );
      return res.json({ user: safeUser(user), profilePhoto });
    } catch {
      fs.unlink(req.file.path, () => {});
      return res.status(500).json({ error: "Could not save profile photo." });
    }
  });
});

// ==========================================
// SEARCH USERS
// ==========================================

app.get("/api/users", authRequired, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (!q) {
      return res.json({ users: [] });
    }

    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const users = await User.find({
      _id: { $ne: req.user._id },

      $or: [
        {
          username: {
            $regex: escapedQuery,
            $options: "i",
          },
        },
        {
          displayName: {
            $regex: escapedQuery,
            $options: "i",
          },
        },
      ],
    })
      .select("username displayName avatarColor profilePhoto about lastSeen")
      .limit(20);

    res.json({
      users: users.map(safeUser),
    });
  } catch (error) {
    console.error("User search error:", error.message);

    res.status(500).json({
      error: "Could not search users.",
    });
  }
});

// ==========================================
// GET CHAT MESSAGES
// ==========================================

app.get("/api/messages/:userId", authRequired, async (req, res) => {
  try {
    const otherId = req.params.userId;

    if (!mongoose.isValidObjectId(otherId)) {
      return res.status(400).json({
        error: "Invalid user.",
      });
    }

    const other = await User.findById(otherId).select("_id");

    if (!other) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    const messages = await Message.find({
      $or: [
        {
          sender: req.user._id,
          recipient: other._id,
        },
        {
          sender: other._id,
          recipient: req.user._id,
        },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(500);

    const unreadIds = messages
      .filter((m) => m.sender.toString() === other._id.toString() && !m.readAt)
      .map((m) => m._id.toString());
    await Message.updateMany(
      {
        sender: other._id,
        recipient: req.user._id,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      },
    );
    if (unreadIds.length) {
      io.to(`user:${other._id.toString()}`).emit("messages:read", {
        readerId: req.user._id.toString(),
        messageIds: unreadIds,
        readAt: new Date(),
      });
    }

    res.json({
      messages: messages.map(publicMessage),
    });
  } catch (error) {
    console.error("Message history error:", error.message);

    res.status(500).json({
      error: "Could not load messages.",
    });
  }
});

// ==========================================
// UPLOAD CHAT ATTACHMENT
// ==========================================

app.post("/api/messages/:userId/attachment", authRequired, (req, res) => {
  upload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({
        error: uploadError.message || "Could not upload file.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Choose a file to upload.",
      });
    }

    const savedFilePath = req.file.path;

    try {
      const recipientId = String(req.params.userId || "");

      if (!mongoose.isValidObjectId(recipientId)) {
        fs.unlink(savedFilePath, () => {});

        return res.status(400).json({
          error: "Invalid recipient.",
        });
      }

      const recipient = await User.findById(recipientId).select("_id");

      if (!recipient || recipientId === req.user._id.toString()) {
        fs.unlink(savedFilePath, () => {});

        return res.status(404).json({
          error: "Recipient not found.",
        });
      }

      const originalName = path
        .basename(req.file.originalname || "attachment")
        .slice(0, 255);

      const doc = await Message.create({
        sender: req.user._id,
        recipient: recipient._id,
        text: "",

        attachment: {
          url: `/uploads/${path.basename(req.file.filename)}`,
          originalName,
          mimeType: req.file.mimetype,
          size: req.file.size,
        },
      });

      const message = publicMessage(doc);

      io.to(`user:${req.user._id.toString()}`)
        .to(`user:${recipientId}`)
        .emit("message:new", message);

      return res.status(201).json({
        message,
      });
    } catch (error) {
      fs.unlink(savedFilePath, () => {});

      console.error("Attachment upload error:", error.message);

      return res.status(500).json({
        error: "Could not save attachment.",
      });
    }
  });
});

// ==========================================
// GET MEMORIES
// ==========================================

app.get("/api/memories", authRequired, async (_req, res) => {
  try {
    const memories = await Memory.find({
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "username displayName avatarColor")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      memories: memories.map((memory) => ({
        id: memory._id.toString(),
        text: memory.text,
        createdAt: memory.createdAt,
        expiresAt: memory.expiresAt,
        user: safeUser(memory.user),
      })),
    });
  } catch (error) {
    console.error("Memories error:", error.message);

    res.status(500).json({
      error: "Could not load memories.",
    });
  }
});

// ==========================================
// CREATE MEMORY
// ==========================================

app.post("/api/memories", authRequired, async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();

    if (!text || text.length > 500) {
      return res.status(400).json({
        error: "Memory must contain 1-500 characters.",
      });
    }

    const memory = await Memory.create({
      user: req.user._id,
      text,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const populated = await memory.populate(
      "user",
      "username displayName avatarColor",
    );

    const result = {
      id: populated._id.toString(),
      text: populated.text,
      createdAt: populated.createdAt,
      expiresAt: populated.expiresAt,
      user: safeUser(populated.user),
    };

    io.emit("memory:new", result);

    res.status(201).json({
      memory: result,
    });
  } catch (error) {
    console.error("Create memory error:", error.message);

    res.status(500).json({
      error: "Could not create memory.",
    });
  }
});

// ==========================================
// SOCKET AUTHENTICATION
// ==========================================

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.id).select(
      "_id username displayName avatarColor",
    );

    if (!user) {
      return next(new Error("Unauthorized"));
    }

    socket.user = user;

    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

// ==========================================
// REAL-TIME CHAT AND PRESENCE
// ==========================================

const online = new Map();

io.on("connection", (socket) => {
  const uid = socket.user._id.toString();

  if (!online.has(uid)) {
    online.set(uid, new Set());
  }

  online.get(uid).add(socket.id);

  socket.join(`user:${uid}`);

  io.emit("presence:update", {
    userId: uid,
    online: true,
  });

  // SEND TEXT MESSAGE
  socket.on("message:send", async (payload, ack) => {
    try {
      const recipientId = String(payload?.recipientId || "");
      const text = String(payload?.text || "").trim();
      const replyToId = String(payload?.replyTo || "");

      if (
        !mongoose.isValidObjectId(recipientId) ||
        text.length < 1 ||
        text.length > 4000 ||
        (replyToId && !mongoose.isValidObjectId(replyToId))
      ) {
        if (typeof ack === "function") {
          ack({
            ok: false,
            error: "Invalid recipient or message.",
          });
        }

        return;
      }

      const recipient = await User.findById(recipientId).select("_id");

      if (!recipient || recipientId === uid) {
        if (typeof ack === "function") {
          ack({
            ok: false,
            error: "Recipient not found.",
          });
        }

        return;
      }

      let replyTo = null;
      if (replyToId) {
        replyTo = await Message.findOne({
          _id: replyToId,
          $or: [
            { sender: socket.user._id, recipient: recipient._id },
            { sender: recipient._id, recipient: socket.user._id },
          ],
        }).select("_id");
        if (!replyTo) {
          if (typeof ack === "function")
            ack({ ok: false, error: "Reply target not found." });
          return;
        }
      }

      const doc = await Message.create({
        sender: socket.user._id,
        recipient: recipient._id,
        text,
        replyTo: replyTo?._id || null,
      });

      const message = publicMessage(doc);

      io.to(`user:${uid}`)
        .to(`user:${recipientId}`)
        .emit("message:new", message);

      if (typeof ack === "function") {
        ack({
          ok: true,
          message,
        });
      }
    } catch (error) {
      console.error("Send message error:", error.message);

      if (typeof ack === "function") {
        ack({
          ok: false,
          error: "Message could not be sent.",
        });
      }
    }
  });

  // Mark incoming messages as read when chat is open
  socket.on("messages:markRead", async (payload = {}) => {
    const otherId = String(payload.userId || "");
    if (!mongoose.isValidObjectId(otherId)) return;
    const unread = await Message.find({
      sender: otherId,
      recipient: uid,
      readAt: null,
    }).select("_id");
    if (!unread.length) return;
    const readAt = new Date();
    await Message.updateMany(
      { _id: { $in: unread.map((m) => m._id) } },
      { $set: { readAt } },
    );
    io.to(`user:${otherId}`).emit("messages:read", {
      readerId: uid,
      messageIds: unread.map((m) => m._id.toString()),
      readAt,
    });
  });

  // EDIT A MESSAGE (sender only)
  socket.on("message:edit", async (payload = {}, ack) => {
    try {
      const messageId = String(payload.messageId || "");
      const text = String(payload.text || "").trim();
      if (!mongoose.isValidObjectId(messageId) || !text || text.length > 4000) {
        if (typeof ack === "function")
          ack({ ok: false, error: "Enter a valid message." });
        return;
      }
      const doc = await Message.findOne({
        _id: messageId,
        sender: socket.user._id,
        deletedAt: null,
      });
      if (!doc) {
        if (typeof ack === "function")
          ack({ ok: false, error: "Message not found or cannot be edited." });
        return;
      }
      doc.text = text;
      doc.editedAt = new Date();
      await doc.save();
      const message = publicMessage(doc);
      io.to(`user:${doc.sender}`)
        .to(`user:${doc.recipient}`)
        .emit("message:updated", message);
      if (typeof ack === "function") ack({ ok: true, message });
    } catch {
      if (typeof ack === "function")
        ack({ ok: false, error: "Could not edit message." });
    }
  });

  // DELETE A MESSAGE (sender only; soft-delete keeps chat history stable)
  socket.on("message:delete", async (payload = {}, ack) => {
    try {
      const messageId = String(payload.messageId || "");
      if (!mongoose.isValidObjectId(messageId)) {
        if (typeof ack === "function")
          ack({ ok: false, error: "Invalid message." });
        return;
      }
      const doc = await Message.findOne({
        _id: messageId,
        sender: socket.user._id,
      });
      if (!doc) {
        if (typeof ack === "function")
          ack({ ok: false, error: "Message not found or cannot be deleted." });
        return;
      }
      doc.text = "";
      doc.attachment = { url: "", originalName: "", mimeType: "", size: 0 };
      doc.deletedAt = new Date();
      await doc.save();
      const message = publicMessage(doc);
      io.to(`user:${doc.sender}`)
        .to(`user:${doc.recipient}`)
        .emit("message:updated", message);
      if (typeof ack === "function") ack({ ok: true, message });
    } catch {
      if (typeof ack === "function")
        ack({ ok: false, error: "Could not delete message." });
    }
  });

  // ADD/REMOVE A REACTION
  socket.on("message:react", async (payload = {}, ack) => {
    try {
      const messageId = String(payload.messageId || "");
      const emoji = String(payload.emoji || "");
      if (
        !mongoose.isValidObjectId(messageId) ||
        !["❤️", "😂", "👍", "😮", "😢", "🔥"].includes(emoji)
      ) {
        if (typeof ack === "function")
          ack({ ok: false, error: "Invalid reaction." });
        return;
      }
      const doc = await Message.findOne({
        _id: messageId,
        $or: [{ sender: socket.user._id }, { recipient: socket.user._id }],
      });
      if (!doc || doc.deletedAt) {
        if (typeof ack === "function")
          ack({ ok: false, error: "Message not found." });
        return;
      }
      const existing = doc.reactions.findIndex(
        (r) => r.user.toString() === uid && r.emoji === emoji,
      );
      if (existing >= 0) doc.reactions.splice(existing, 1);
      else doc.reactions.push({ user: socket.user._id, emoji });
      await doc.save();
      const message = publicMessage(doc);
      io.to(`user:${doc.sender}`)
        .to(`user:${doc.recipient}`)
        .emit("message:updated", message);
      if (typeof ack === "function") ack({ ok: true, message });
    } catch {
      if (typeof ack === "function")
        ack({ ok: false, error: "Could not update reaction." });
    }
  });

  // WEBRTC CALL SIGNALING (media stays peer-to-peer; server relays setup signals only)
  const relayCallSignal = (eventName, payload = {}) => {
    const recipientId = String(payload.recipientId || "");
    if (!mongoose.isValidObjectId(recipientId) || recipientId === uid) return;
    io.to(`user:${recipientId}`).emit(eventName, {
      ...payload,
      recipientId: uid,
      senderId: uid,
      sender: {
        id: uid,
        username: socket.user.username,
        displayName: socket.user.displayName,
        avatarColor: socket.user.avatarColor,
      },
    });
  };

  socket.on("call:invite", async (payload = {}, ack) => {
    try {
      const recipientId = String(payload.recipientId || "");
      const callId = String(payload.callId || "");
      const type = payload.type === "video" ? "video" : "audio";
      if (
        !mongoose.isValidObjectId(recipientId) ||
        recipientId === uid ||
        !/^[a-zA-Z0-9-]{8,100}$/.test(callId)
      ) {
        if (typeof ack === "function")
          ack({ ok: false, error: "Invalid call recipient." });
        return;
      }
      const recipient = await User.findById(recipientId).select("_id");
      if (!recipient) {
        if (typeof ack === "function")
          ack({ ok: false, error: "User not found." });
        return;
      }
      io.to(`user:${recipientId}`).emit("call:incoming", {
        callId,
        type,
        recipientId: uid,
        senderId: uid,
        sender: {
          id: uid,
          username: socket.user.username,
          displayName: socket.user.displayName,
          avatarColor: socket.user.avatarColor,
        },
      });
      if (typeof ack === "function") ack({ ok: true });
    } catch {
      if (typeof ack === "function")
        ack({ ok: false, error: "Could not start call." });
    }
  });

  socket.on("call:accept", (payload = {}) =>
    relayCallSignal("call:accepted", payload),
  );
  socket.on("call:reject", (payload = {}) =>
    relayCallSignal("call:rejected", payload),
  );
  socket.on("call:offer", (payload = {}) =>
    relayCallSignal("call:offer", payload),
  );
  socket.on("call:answer", (payload = {}) =>
    relayCallSignal("call:answer", payload),
  );
  socket.on("call:ice", (payload = {}) => relayCallSignal("call:ice", payload));
  socket.on("call:end", (payload = {}) =>
    relayCallSignal("call:ended", payload),
  );

  // TYPING INDICATOR
  socket.on("typing:set", (payload = {}) => {
    const recipientId = String(payload.recipientId || "");

    if (mongoose.isValidObjectId(recipientId)) {
      io.to(`user:${recipientId}`).emit("typing:update", {
        userId: uid,
        typing: Boolean(payload.typing),
      });
    }
  });

  // DISCONNECT AND LAST SEEN
  socket.on("disconnect", async () => {
    const sockets = online.get(uid);

    if (!sockets) return;

    sockets.delete(socket.id);

    if (sockets.size === 0) {
      online.delete(uid);

      const lastSeen = new Date();

      await User.findByIdAndUpdate(uid, {
        lastSeen,
      }).catch(() => {});

      io.emit("presence:update", {
        userId: uid,
        online: false,
        lastSeen,
      });
    }
  });
});

// ==========================================
// START SERVER
// ==========================================

const port = Number(process.env.PORT || 5000);

try {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    throw new Error("Set MONGO_URI and JWT_SECRET in server/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  server.listen(port, () => {
    console.log(`ChitChat API running on http://localhost:${port}`);
  });
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exit(1);
}
