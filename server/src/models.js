import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
      lowercase: true,
      match: /^[a-z0-9_]+$/,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    avatarColor: {
      type: String,
      default: "#0b806b",
    },

    profilePhoto: {
      type: String,
      default: "",
      maxlength: 2048,
    },

    about: {
      type: String,
      default: "Hey there! I'm using ChitChat.",
      trim: true,
      maxlength: 150,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  // Text message
  text: {
    type: String,
    default: "",
    trim: true,
    maxlength: 4000,
  },

  // File attachment
  attachment: {
    url: {
      type: String,
      default: "",
    },

    originalName: {
      type: String,
      default: "",
    },

    mimeType: {
      type: String,
      default: "",
    },

    size: {
      type: Number,
      default: 0,
    },
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },

  readAt: {
    type: Date,
    default: null,
  },

  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null,
  },

  editedAt: {
    type: Date,
    default: null,
  },

  deletedAt: {
    type: Date,
    default: null,
  },

  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, maxlength: 16 },
  }],
});

const memorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
export const Message = mongoose.model("Message", messageSchema);
export const Memory = mongoose.model("Memory", memorySchema);
