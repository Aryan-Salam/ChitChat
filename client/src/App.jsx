import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  Search,
  Plus,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Phone,
  Video,
  Users,
  Archive,
  Settings,
  LogOut,
  ArrowLeft,
  CheckCheck,
  CircleUserRound,
  Camera,
  X,
  Sparkles,
  ShieldCheck,
  Zap,
  LoaderCircle,
  Mic,
  Moon,
  Sun,
  Reply,
  Pencil,
  Trash2,
} from "lucide-react";
import { API, api, connectSocket, initials, time } from "./lib.js";

const avatarClass = (color) => ({ background: color || "#0b806b" });
function Avatar({ user, size = "md", ring = false }) {
  return (
    <div
      className={`avatar ${size} ${ring ? "ring" : ""}`}
      style={avatarClass(user?.avatarColor)}
    >
      {user?.profilePhoto ? (
        <img
          src={
            /^https?:\/\//i.test(user.profilePhoto)
              ? user.profilePhoto
              : `${API}${user.profilePhoto}`
          }
          alt=""
        />
      ) : (
        initials(user?.displayName || user?.username)
      )}
    </div>
  );
}
function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api(`/api/auth/${mode}`, null, {
        method: "POST",
        body: JSON.stringify({ username, password, displayName }),
      });
      onAuth(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <div className="auth-brand">
        <div className="brand-icon">
          <MessageCircle size={27} fill="currentColor" />
        </div>
        <span>
          Chit<span>Chat</span>
        </span>
      </div>
      <section className="auth-card">
        <div className="auth-eyebrow">
          <Sparkles size={15} /> YOUR PEOPLE, YOUR SPACE
        </div>
        <h1>
          {mode === "login" ? "Good to see you." : "Let's get connected."}
        </h1>
        <p className="muted">
          {mode === "login"
            ? "Sign in and pick up where your conversations left off."
            : "Create your account and start a conversation."}
        </p>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label>
              Your name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Aryan Salam"
                maxLength="40"
                required
              />
            </label>
          )}
          <label>
            Username
            <div className="username-field">
              <span>@</span>
              <input
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  )
                }
                placeholder="your_username"
                minLength="3"
                maxLength="24"
                required
              />
            </div>
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength="8"
              required
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn auth-submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : null}
            {mode === "login" ? "Log in" : "Create account"} <span>→</span>
          </button>
        </form>
        <div className="auth-switch">
          {mode === "login" ? "New to ChitChat?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create account" : "Log in"}
          </button>
        </div>
        <div className="secure-note">
          <ShieldCheck size={15} /> Your password is securely hashed before
          storage.
        </div>
      </section>
      <p className="auth-footer">
        A little closer, even when you're far apart.
      </p>
    </main>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("chitchat-auth") || "null");
    } catch {
      return null;
    }
  });
  const [me, setMe] = useState(auth?.user || null);
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("chitchat-dark") === "true",
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [openMessageMenu, setOpenMessageMenu] = useState(null);
  const [openReactionPicker, setOpenReactionPicker] = useState(null);
  const [recording, setRecording] = useState(false);
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const profilePhotoInputRef = useRef(null);
  const [online, setOnline] = useState({});
  const [typing, setTyping] = useState({});
  const [tab, setTab] = useState("chats");
  const [memories, setMemories] = useState([]);
  const [memoryText, setMemoryText] = useState("");
  const [showMemory, setShowMemory] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    displayName: "",
    username: "",
    avatarColor: "#0b806b",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimer = useRef(null);
  const [call, setCall] = useState(null);
  const callRef = useRef(null);
  callRef.current = call;
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callMuted, setCallMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const pendingIceRef = useRef([]);

  const token = auth?.token;
  const notify = (msg) => {
    setToast(msg);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(""), 2600);
  };
  function logout() {
    if (socket) socket.disconnect();
    localStorage.removeItem("chitchat-auth");
    setAuth(null);
    setMe(null);
    setSocket(null);
    setActive(null);
    setMessages([]);
  }
  function acceptAuth(data) {
    localStorage.setItem("chitchat-auth", JSON.stringify(data));
    setAuth(data);
    setMe(data.user);
  }

  function openProfileSettings() {
    setProfileDraft({
      displayName: me?.displayName || "",
      username: me?.username || "",
      avatarColor: me?.avatarColor || "#0b806b",
      profilePhoto: me?.profilePhoto || "",
      about: me?.about || "Hey there! I'm using ChitChat.",
    });
    setProfileError("");
    setShowSettings(true);
  }

  async function saveProfile(e) {
    e.preventDefault();
    setProfileError("");
    setSavingProfile(true);
    try {
      const data = await api("/api/me", token, {
        method: "PUT",
        body: JSON.stringify(profileDraft),
      });
      const updatedUser = data.user;
      const updatedAuth = { ...auth, user: updatedUser };
      localStorage.setItem("chitchat-auth", JSON.stringify(updatedAuth));
      setAuth(updatedAuth);
      setMe(updatedUser);
      setMemories((prev) =>
        prev.map((memory) =>
          memory.user?.id === updatedUser.id
            ? { ...memory, user: { ...memory.user, ...updatedUser } }
            : memory,
        ),
      );
      setShowSettings(false);
      notify(data.message || "Profile updated successfully!");
    } catch (error) {
      setProfileError(error.message || "Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  function cleanupCall(notifyPeer = false) {
    const current = call;
    if (notifyPeer && current && socket) {
      socket.emit("call:end", {
        recipientId: current.peer.id,
        callId: current.callId,
      });
    }
    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCall(null);
    setCallMuted(false);
    setCameraOff(false);
    setCallSeconds(0);
    pendingIceRef.current = [];
  }

  async function getCallMedia(type) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Calls require HTTPS or localhost and a supported browser.",
      );
    }
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video" ? { facingMode: "user" } : false,
    });
  }

  function makePeer(peerUser, callId, type) {
    if (peerRef.current) return peerRef.current;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    peerRef.current = pc;
    const stream = localStreamRef.current;
    stream?.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      const incoming = event.streams?.[0];
      if (incoming) setRemoteStream(incoming);
    };
    pc.onicecandidate = (event) => {
      if (event.candidate)
        socket?.emit("call:ice", {
          recipientId: peerUser.id,
          callId,
          candidate: event.candidate.toJSON(),
        });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) {
        setCall((prev) =>
          prev ? { ...prev, status: "connection-lost" } : prev,
        );
      } else if (pc.connectionState === "connected") {
        setCall((prev) =>
          prev
            ? {
                ...prev,
                status: "active",
                startedAt: prev.startedAt || Date.now(),
              }
            : prev,
        );
      }
    };
    return pc;
  }

  async function startCall(type) {
    if (!active || !socket || call) return;
    const callId =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const stream = await getCallMedia(type);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCall({
        callId,
        type,
        peer: active,
        status: "ringing",
        direction: "outgoing",
        startedAt: null,
      });
      socket.emit(
        "call:invite",
        { recipientId: active.id, callId, type },
        (result) => {
          if (!result?.ok) {
            notify(result?.error || "Could not start call.");
            cleanupCall(false);
          }
        },
      );
    } catch (error) {
      notify(
        error?.name === "NotAllowedError"
          ? "Allow microphone/camera access to make a call."
          : error.message || "Could not access microphone/camera.",
      );
    }
  }

  async function acceptCall() {
    if (!call || call.direction !== "incoming" || !socket) return;
    try {
      const stream = await getCallMedia(call.type);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCall((prev) => (prev ? { ...prev, status: "connecting" } : prev));
      socket.emit("call:accept", {
        recipientId: call.peer.id,
        callId: call.callId,
      });
    } catch (error) {
      notify(
        error?.name === "NotAllowedError"
          ? "Allow microphone/camera access to answer."
          : error.message || "Could not access microphone/camera.",
      );
      socket.emit("call:reject", {
        recipientId: call.peer.id,
        callId: call.callId,
      });
      cleanupCall(false);
    }
  }

  async function handleCallAccepted(event) {
    const currentCall = callRef.current;
    if (
      !currentCall ||
      event.callId !== currentCall.callId ||
      currentCall.direction !== "outgoing"
    )
      return;
    try {
      setCall((prev) => (prev ? { ...prev, status: "connecting" } : prev));
      const pc = makePeer(
        currentCall.peer,
        currentCall.callId,
        currentCall.type,
      );
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit("call:offer", {
        recipientId: currentCall.peer.id,
        callId: currentCall.callId,
        description: pc.localDescription,
      });
    } catch (error) {
      notify("Could not establish call connection.");
      cleanupCall(true);
    }
  }

  async function handleCallOffer(event) {
    const currentCall = callRef.current;
    if (
      !currentCall ||
      event.callId !== currentCall.callId ||
      currentCall.direction !== "incoming"
    )
      return;
    try {
      const pc = makePeer(
        currentCall.peer,
        currentCall.callId,
        currentCall.type,
      );
      await pc.setRemoteDescription(
        new RTCSessionDescription(event.description),
      );
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await Promise.all(
        pendingIceRef.current
          .splice(0)
          .map((candidate) =>
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {}),
          ),
      );
      socket?.emit("call:answer", {
        recipientId: call.peer.id,
        callId: call.callId,
        description: pc.localDescription,
      });
      setCall((prev) => (prev ? { ...prev, status: "connecting" } : prev));
    } catch (error) {
      notify("Could not answer the call connection.");
      cleanupCall(true);
    }
  }

  function toggleCallMute() {
    const next = !callMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCallMuted(next);
  }

  function toggleCallCamera() {
    const next = !cameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCameraOff(next);
  }

  useEffect(() => {
    if (localVideoRef.current)
      localVideoRef.current.srcObject = localStream || null;
  }, [localStream, call]);
  useEffect(() => {
    if (remoteVideoRef.current)
      remoteVideoRef.current.srcObject = remoteStream || null;
  }, [remoteStream, call]);
  useEffect(() => {
    if (!call || call.status !== "active") return;
    const timer = window.setInterval(() => {
      if (call.startedAt)
        setCallSeconds(Math.floor((Date.now() - call.startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [call?.status, call?.startedAt]);

  useEffect(() => {
    if (!token) return;
    let s;
    api("/api/me", token)
      .then((data) => setMe(data.user))
      .catch(() => logout());
    s = connectSocket(token);
    setSocket(s);
    s.on("connect_error", () =>
      notify("Can't connect to chat server. Check backend and API URL."),
    );
    s.on("message:new", (message) => {
      const otherId =
        message.senderId === me?.id ? message.recipientId : message.senderId;
      setUsers((prev) => {
        const exists = prev.some((u) => u.id === otherId);
        if (exists) return prev;
        return prev;
      });
      setMessages((prev) => {
        if (
          active &&
          (message.senderId === active.id || message.recipientId === active.id)
        ) {
          if (prev.some((m) => m.id === message.id)) return prev;
          if (message.senderId !== me?.id && s) {
            s.emit("messages:markRead", { userId: message.senderId });
          }
          return [...prev, message];
        }
        return prev;
      });
      if (
        !active ||
        (message.senderId !== active.id && message.recipientId !== active.id)
      )
        notify("New message received");
    });
    s.on("message:updated", (message) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? message : m)),
      );
    });
    s.on("messages:read", (event) => {
      setMessages((prev) =>
        prev.map((m) =>
          event.messageIds?.includes(m.id) ? { ...m, readAt: event.readAt } : m,
        ),
      );
    });
    s.on("presence:update", (event) =>
      setOnline((prev) => ({ ...prev, [event.userId]: event.online })),
    );
    s.on("typing:update", (event) =>
      setTyping((prev) => ({ ...prev, [event.userId]: event.typing })),
    );
    s.on("call:incoming", (event) => {
      setCall((current) => {
        if (current) {
          s.emit("call:reject", {
            recipientId: event.senderId,
            callId: event.callId,
          });
          return current;
        }
        const peer = {
          id: event.sender?.id || event.senderId,
          ...(event.sender || {}),
        };
        notify(`${peer.displayName || "Someone"} is calling…`);
        return {
          callId: event.callId,
          type: event.type === "video" ? "video" : "audio",
          peer,
          status: "incoming",
          direction: "incoming",
          startedAt: null,
        };
      });
    });
    s.on("call:accepted", (event) => {
      handleCallAccepted(event);
    });
    s.on("call:rejected", (event) => {
      setCall((current) => {
        if (current?.callId === event.callId) {
          notify("Call was declined.");
          window.setTimeout(() => cleanupCall(false), 0);
          return { ...current, status: "declined" };
        }
        return current;
      });
    });
    s.on("call:offer", (event) => {
      handleCallOffer(event);
    });
    s.on("call:answer", async (event) => {
      const currentCall = callRef.current;
      if (
        !currentCall ||
        event.callId !== currentCall.callId ||
        !peerRef.current
      )
        return;
      try {
        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(event.description),
        );
        await Promise.all(
          pendingIceRef.current
            .splice(0)
            .map((candidate) =>
              peerRef.current
                .addIceCandidate(new RTCIceCandidate(candidate))
                .catch(() => {}),
            ),
        );
      } catch {
        notify("Could not complete call connection.");
      }
    });
    s.on("call:ice", async (event) => {
      const currentCall = callRef.current;
      if (
        !currentCall ||
        event.callId !== currentCall.callId ||
        !event.candidate
      )
        return;
      if (!peerRef.current?.remoteDescription)
        pendingIceRef.current.push(event.candidate);
      else
        await peerRef.current
          .addIceCandidate(new RTCIceCandidate(event.candidate))
          .catch(() => {});
    });
    s.on("call:ended", (event) => {
      setCall((current) => {
        if (current?.callId === event.callId) {
          notify("Call ended.");
          window.setTimeout(() => cleanupCall(false), 0);
          return { ...current, status: "ended" };
        }
        return current;
      });
    });
    s.on("memory:new", (memory) =>
      setMemories((prev) =>
        prev.some((m) => m.id === memory.id) ? prev : [memory, ...prev],
      ),
    );
    return () => s.disconnect();
  }, [token, me?.id, active?.id]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("chitchat-dark", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (!token) return;
    api("/api/memories", token)
      .then((data) => setMemories(data.memories))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, active]);

  useEffect(() => {
    if (!token || query.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(
      () =>
        api(`/api/users?q=${encodeURIComponent(query.trim())}`, token)
          .then((d) => setSearchResults(d.users))
          .catch(() => setSearchResults([])),
      250,
    );
    return () => clearTimeout(timer);
  }, [query, token]);

  async function openChat(user) {
    setActive(user);
    setTab("chats");
    setShowNew(false);
    setQuery("");
    setSearchResults([]);
    setLoading(true);
    try {
      const data = await api(`/api/messages/${user.id}`, token);
      setMessages(data.messages);
      socket?.emit("messages:markRead", { userId: user.id });
      setUsers((prev) =>
        prev.some((u) => u.id === user.id) ? prev : [user, ...prev],
      );
    } catch (e) {
      notify(e.message);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }
  function sendMessage(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !active || !socket) return;

    if (editingMessage) {
      socket.emit(
        "message:edit",
        { messageId: editingMessage.id, text: body },
        (result) => {
          if (!result?.ok)
            return notify(result?.error || "Could not edit message.");
          setMessages((prev) =>
            prev.map((m) => (m.id === result.message.id ? result.message : m)),
          );
          setEditingMessage(null);
          setText("");
          notify("Message edited.");
        },
      );
      return;
    }

    setText("");
    socket.emit(
      "message:send",
      { recipientId: active.id, text: body, replyTo: replyTo?.id || null },
      (result) => {
        if (!result?.ok) {
          setText(body);
          notify(result?.error || "Message failed.");
        } else {
          setMessages((prev) =>
            prev.some((m) => m.id === result.message.id)
              ? prev
              : [...prev, result.message],
          );
          setReplyTo(null);
        }
      },
    );
    socket.emit("typing:set", { recipientId: active.id, typing: false });
  }

  function deleteMessage(message) {
    if (!socket || !window.confirm("Delete this message for both people?"))
      return;
    socket.emit("message:delete", { messageId: message.id }, (result) => {
      if (!result?.ok) notify(result?.error || "Could not delete message.");
      else notify("Message deleted.");
    });
  }

  function reactToMessage(message, emoji) {
    socket?.emit(
      "message:react",
      { messageId: message.id, emoji },
      (result) => {
        if (!result?.ok) notify(result?.error || "Could not react.");
      },
    );
  }

  async function uploadProfilePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return setProfileError("Choose an image file.");
    if (file.size > 5 * 1024 * 1024)
      return setProfileError("Photo must be 5 MB or smaller.");
    const form = new FormData();
    form.append("file", file);
    setProfilePhotoBusy(true);
    setProfileError("");
    try {
      const response = await fetch(`${API}/api/me/photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Photo upload failed.");
      const updatedAuth = { ...auth, user: data.user };
      localStorage.setItem("chitchat-auth", JSON.stringify(updatedAuth));
      setAuth(updatedAuth);
      setMe(data.user);
      setProfileDraft((prev) => ({
        ...prev,
        profilePhoto: data.user.profilePhoto,
      }));
      notify("Profile photo updated.");
    } catch (error) {
      setProfileError(error.message || "Photo upload failed.");
    } finally {
      setProfilePhotoBusy(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      notify("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (!blob.size) return;
        const voiceType = (recorder.mimeType || "").startsWith("audio/mp4")
          ? "audio/mp4"
          : "audio/webm";
        const extension = voiceType === "audio/mp4" ? "m4a" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${extension}`, {
          type: voiceType,
        });
        const form = new FormData();
        form.append("file", file);
        setUploading(true);
        try {
          const response = await fetch(
            `${API}/api/messages/${active.id}/attachment`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: form,
            },
          );
          const data = await response.json().catch(() => ({}));
          if (!response.ok)
            throw new Error(data.error || "Voice message failed.");
          setMessages((prev) =>
            prev.some((m) => m.id === data.message.id)
              ? prev
              : [...prev, data.message],
          );
          notify("Voice message sent.");
        } catch (error) {
          notify(error.message || "Voice message failed.");
        } finally {
          setUploading(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      notify("Recording voice message… tap the mic again to send.");
    } catch {
      notify("Microphone permission was denied.");
    }
  }
  async function downloadAttachment(fileUrl, filename) {
    try {
      // Fetch as a Blob so the browser downloads the image instead of opening it.
      const response = await fetch(fileUrl, { method: "GET", mode: "cors" });

      if (!response.ok) {
        throw new Error(`Download failed (${response.status}).`);
      }

      const blob = await response.blob();
      if (!blob.size) throw new Error("The downloaded file is empty.");

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename || "chitchat-attachment";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Let the browser start the download before releasing the object URL.
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 3000);
      notify("Download started!");
    } catch (error) {
      console.error("Attachment download error:", error);
      notify(
        "Download failed. Check that the backend is running and try again.",
      );
    }
  }

  async function uploadAttachment(e) {
    const file = e.target.files?.[0];
    // Let the same file be selected again after an upload.
    e.target.value = "";

    if (!file || !active || !token) return;

    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      notify("File is too large. Maximum size is 15 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);

    try {
      const response = await fetch(
        `${API.replace(/\/$/, "")}/api/messages/${active.id}/attachment`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not upload file.");
      }

      if (data.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id)
            ? prev
            : [...prev, data.message],
        );
      }
      notify("File sent successfully!");
    } catch (error) {
      notify(error.message || "Could not upload file.");
    } finally {
      setUploading(false);
    }
  }

  function onTyping(value) {
    setText(value);
    if (!active || !socket) return;
    socket.emit("typing:set", {
      recipientId: active.id,
      typing: value.length > 0,
    });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () =>
        socket.emit("typing:set", { recipientId: active.id, typing: false }),
      1000,
    );
  }
  async function createMemory(e) {
    e.preventDefault();
    try {
      await api("/api/memories", token, {
        method: "POST",
        body: JSON.stringify({ text: memoryText }),
      });
      setMemoryText("");
      setShowMemory(false);
      notify("Memory shared for 24 hours.");
    } catch (e) {
      notify(e.message);
    }
  }
  const visibleUsers = useMemo(
    () =>
      users.filter((u) =>
        `${u.displayName} ${u.username}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [users, query],
  );
  if (!auth || !me) return <Auth onAuth={acceptAuth} />;

  const chatUserIds = new Set(users.map((u) => u.id));
  const activeMessages = messages.filter(
    (m) => active && (m.senderId === active.id || m.recipientId === active.id),
  );
  const myMemories = memories.filter((m) => m.user?.id === me.id);

  return (
    <main className={`app-shell ${darkMode ? "theme-dark" : ""}`}>
      <aside className="nav-rail">
        <div className="rail-logo">
          <MessageCircle size={25} fill="currentColor" />
        </div>
        <button
          className={`rail-btn ${tab === "chats" ? "selected" : ""}`}
          onClick={() => setTab("chats")}
          title="Chats"
        >
          <MessageCircle />
        </button>
        <button
          className={`rail-btn ${tab === "memories" ? "selected" : ""}`}
          onClick={() => setTab("memories")}
          title="Memories"
        >
          <Camera />
        </button>
        <button
          className={`rail-btn ${tab === "communities" ? "selected" : ""}`}
          onClick={() => notify("Communities are planned for a future update.")}
          title="Communities"
        >
          <Users />
        </button>
        <div className="rail-bottom">
          <button
            className="rail-btn"
            onClick={openProfileSettings}
            title="Profile settings"
          >
            <Settings />
          </button>
          <button className="rail-profile" onClick={logout} title="Log out">
            <Avatar user={me} />
          </button>
        </div>
      </aside>

      <section className={`sidebar ${active ? "mobile-hidden" : ""}`}>
        <header className="sidebar-top">
          <div>
            <div className="eyebrow">YOUR SPACE</div>
            <h1>
              {tab === "memories"
                ? "Memories"
                : tab === "chats"
                  ? "Messages"
                  : "ChitChat"}
            </h1>
          </div>
          <button
            className="icon-btn filled"
            onClick={() =>
              tab === "memories" ? setShowMemory(true) : setShowNew(true)
            }
            title={tab === "memories" ? "Add memory" : "New chat"}
          >
            <Plus size={19} />
          </button>
        </header>
        {tab === "chats" ? (
          <>
            <div className="searchbox">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats or people"
              />
              <kbd>⌘ K</kbd>
            </div>
            {query && searchResults.length > 0 && (
              <div className="search-results">
                <div className="section-label">PEOPLE</div>
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    className="search-result"
                    onClick={() => openChat(u)}
                  >
                    <Avatar user={u} />
                    <span>
                      <b>{u.displayName}</b>
                      <small>@{u.username}</small>
                    </span>
                    <ArrowLeft size={15} />
                  </button>
                ))}
              </div>
            )}
            <div className="filter-row">
              <button className="filter active">All chats</button>
              <button
                className="filter"
                onClick={() => notify("Unread filter coming soon.")}
              >
                Unread
              </button>
              <button
                className="filter"
                onClick={() => notify("Groups coming soon.")}
              >
                Groups
              </button>
            </div>
            <div className="chat-list">
              {users.length === 0 ? (
                <div className="empty-sidebar">
                  <div className="empty-illustration">
                    <MessageCircle size={28} />
                  </div>
                  <h3>Your conversations start here</h3>
                  <p>
                    Search for a username to find your people and say hello.
                  </p>
                  <button className="text-btn" onClick={() => setShowNew(true)}>
                    Find someone <span>→</span>
                  </button>
                </div>
              ) : (
                visibleUsers.map((user) => {
                  const last = [...messages]
                    .reverse()
                    .find(
                      (m) =>
                        m.senderId === user.id || m.recipientId === user.id,
                    );
                  return (
                    <button
                      key={user.id}
                      className={`chat-row ${active?.id === user.id ? "active" : ""}`}
                      onClick={() => openChat(user)}
                    >
                      <div className="avatar-wrap">
                        <Avatar user={user} size="lg" />
                        {online[user.id] && <i className="online-dot" />}
                      </div>
                      <span className="chat-row-content">
                        <span className="chat-row-top">
                          <b>{user.displayName}</b>
                          <small>{last ? time(last.createdAt) : ""}</small>
                        </span>
                        <span className="chat-preview">
                          {last
                            ? last.text ||
                              (last.attachment?.originalName
                                ? `📎 ${last.attachment.originalName}`
                                : "Attachment")
                            : `@${user.username}`}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="sidebar-footer">
              <span className="status-dot" /> Connected as <b>@{me.username}</b>
              <button onClick={logout} title="Log out">
                <LogOut size={15} />
              </button>
            </div>
          </>
        ) : tab === "memories" ? (
          <div className="memories-list">
            <div className="memory-intro">
              <div className="memory-icon">
                <Camera />
              </div>
              <div>
                <b>A little moment, saved.</b>
                <p>Memories disappear after 24 hours.</p>
              </div>
            </div>
            <button
              className="primary-btn full"
              onClick={() => setShowMemory(true)}
            >
              <Plus size={17} /> Share a memory
            </button>
            {memories.map((m) => (
              <div className="memory-card" key={m.id}>
                <div className="memory-person">
                  <Avatar user={m.user} />
                  <span>
                    <b>{m.user.displayName}</b>
                    <small>
                      @{m.user.username} · {time(m.createdAt)}
                    </small>
                  </span>
                </div>
                <p>{m.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-sidebar">
            <Users />
            <h3>Communities are coming</h3>
            <p>Group conversations will be part of a future update.</p>
          </div>
        )}
      </section>

      <section className={`conversation ${!active ? "mobile-hidden" : ""}`}>
        {active ? (
          <>
            <header className="conversation-header">
              <button
                className="icon-btn back-btn"
                onClick={() => setActive(null)}
              >
                <ArrowLeft />
              </button>
              <Avatar user={active} size="lg" />
              <div className="conversation-person">
                <b>{active.displayName}</b>
                <small>
                  {typing[active.id]
                    ? "typing…"
                    : online[active.id]
                      ? "online now"
                      : `@${active.username}`}
                </small>
              </div>
              <div className="header-actions">
                <button
                  className="icon-btn"
                  onClick={() => startCall("audio")}
                  title="Voice call"
                >
                  <Phone />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => startCall("video")}
                  title="Video call"
                >
                  <Video />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setDarkMode((v) => !v)}
                  title={
                    darkMode ? "Switch to light mode" : "Switch to dark mode"
                  }
                >
                  {darkMode ? <Sun /> : <Moon />}
                </button>
              </div>
            </header>
            <div className="chat-background">
              <div className="encryption-note">
                <ShieldCheck size={14} /> Messages are stored securely in this
                app's database. This is not end-to-end encrypted.
              </div>
              {loading ? (
                <div className="loading-state">
                  <LoaderCircle className="spin" /> Loading conversation…
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="conversation-empty">
                  <div className="wave-icon">
                    <MessageCircle size={30} />
                  </div>
                  <h2>Say hello to {active.displayName.split(" ")[0]}.</h2>
                  <p>Every great conversation starts somewhere.</p>
                  <span>
                    Messages you send here are real and saved to the database.
                  </span>
                </div>
              ) : (
                <div className="messages">
                  {activeMessages.map((m) => {
                    const mine = m.senderId === me.id;
                    return (
                      <div
                        className={`message-row ${mine ? "mine" : ""}`}
                        key={m.id}
                      >
                        <div className="bubble">
                          {m.replyTo && (
                            <div className="reply-reference">
                              ↪{" "}
                              {activeMessages.find(
                                (item) => item.id === m.replyTo,
                              )?.text || "Replied to a message"}
                            </div>
                          )}
                          {m.deletedAt ? (
                            <div className="message-text deleted-message">
                              This message was deleted
                            </div>
                          ) : m.text ? (
                            <div className="message-text">{m.text}</div>
                          ) : null}
                          {!m.deletedAt &&
                            m.attachment?.url &&
                            (() => {
                              const fileUrl = /^https?:\/\//i.test(
                                m.attachment.url,
                              )
                                ? m.attachment.url
                                : `${API.replace(/\/$/, "")}${m.attachment.url.startsWith("/") ? "" : "/"}${m.attachment.url}`;
                              const mime = m.attachment.mimeType || "";
                              if (mime.startsWith("image/")) {
                                return (
                                  <div className="attachment-image-container">
                                    <a
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="attachment-link"
                                    >
                                      <img
                                        src={fileUrl}
                                        alt={
                                          m.attachment.originalName ||
                                          "Shared image"
                                        }
                                        className="attachment-image"
                                        loading="lazy"
                                      />
                                    </a>
                                    <button
                                      type="button"
                                      className="attachment-download"
                                      onClick={() =>
                                        downloadAttachment(
                                          fileUrl,
                                          m.attachment.originalName ||
                                            "chitchat-image",
                                        )
                                      }
                                      title="Download image"
                                    >
                                      📥 Download image
                                    </button>
                                  </div>
                                );
                              }
                              if (mime.startsWith("video/")) {
                                return (
                                  <video
                                    className="attachment-video"
                                    src={fileUrl}
                                    controls
                                    preload="metadata"
                                  />
                                );
                              }
                              if (mime.startsWith("audio/")) {
                                return (
                                  <audio
                                    className="attachment-audio"
                                    src={fileUrl}
                                    controls
                                    preload="metadata"
                                  />
                                );
                              }
                              return (
                                <a
                                  className="attachment-file"
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  download={m.attachment.originalName || true}
                                >
                                  <Paperclip size={17} />
                                  <span>
                                    {m.attachment.originalName ||
                                      "Download attachment"}
                                    <small>
                                      {(
                                        m.attachment.size /
                                        (1024 * 1024)
                                      ).toFixed(2)}{" "}
                                      MB · Open/download
                                    </small>
                                  </span>
                                </a>
                              );
                            })()}
                          {m.reactions?.length > 0 && (
                            <div className="reaction-list">
                              {["❤️", "😂", "👍", "😮", "😢", "🔥"].map(
                                (emoji) => {
                                  const count = m.reactions.filter(
                                    (r) => r.emoji === emoji,
                                  ).length;
                                  return count ? (
                                    <button
                                      type="button"
                                      key={emoji}
                                      onClick={() => reactToMessage(m, emoji)}
                                    >
                                      {emoji} {count}
                                    </button>
                                  ) : null;
                                },
                              )}
                            </div>
                          )}
                          <div className="message-menu-wrap">
                            <button
                              type="button"
                              className="message-menu-trigger"
                              title="Message options"
                              aria-label="Message options"
                              aria-expanded={openMessageMenu === m.id}
                              onClick={() => {
                                setOpenMessageMenu((current) =>
                                  current === m.id ? null : m.id,
                                );
                                setOpenReactionPicker(null);
                              }}
                            >
                              <MoreVertical size={16} />
                            </button>
                            {openMessageMenu === m.id && (
                              <div className="message-dropdown" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setReplyTo(m);
                                    setEditingMessage(null);
                                    setOpenMessageMenu(null);
                                  }}
                                >
                                  <Reply size={15} /> Reply
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenReactionPicker((current) =>
                                      current === m.id ? null : m.id,
                                    );
                                    setOpenMessageMenu(null);
                                  }}
                                >
                                  <Smile size={15} /> React with emoji
                                </button>
                                {mine && !m.deletedAt && m.text && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setEditingMessage(m);
                                      setReplyTo(null);
                                      setText(m.text);
                                      setOpenMessageMenu(null);
                                    }}
                                  >
                                    <Pencil size={15} /> Edit message
                                  </button>
                                )}
                                {mine && !m.deletedAt && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="danger"
                                    onClick={() => {
                                      setOpenMessageMenu(null);
                                      deleteMessage(m);
                                    }}
                                  >
                                    <Trash2 size={15} /> Delete message
                                  </button>
                                )}
                              </div>
                            )}
                            {openReactionPicker === m.id && (
                              <div
                                className="message-reaction-picker"
                                aria-label="Choose a reaction"
                              >
                                {[
                                  "❤️",
                                  "😂",
                                  "👍",
                                  "😮",
                                  "😢",
                                  "🔥",
                                  "🥹",
                                  "😍",
                                  "🎉",
                                  "👏",
                                  "🙏",
                                  "💯",
                                ].map((emoji) => (
                                  <button
                                    type="button"
                                    key={emoji}
                                    title={`React ${emoji}`}
                                    onClick={() => {
                                      reactToMessage(m, emoji);
                                      setOpenReactionPicker(null);
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="bubble-meta">
                            {m.editedAt && <span>edited · </span>}
                            <time>{time(m.createdAt)}</time>
                            {mine && (
                              <CheckCheck
                                size={14}
                                color={m.readAt ? "#2089df" : "currentColor"}
                                title={m.readAt ? "Read" : "Sent"}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
              {typing[active.id] && (
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span /> {active.displayName} is typing
                </div>
              )}
            </div>
            {(replyTo || editingMessage) && (
              <div className="composer-context">
                <span>
                  {editingMessage
                    ? "Editing message"
                    : `Replying to ${replyTo.senderId === me.id ? "yourself" : active.displayName}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setEditingMessage(null);
                    setText("");
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <form className="composer" onSubmit={sendMessage}>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={uploadAttachment}
              />
              <button
                type="button"
                className="composer-icon"
                onClick={() => fileInputRef.current?.click()}
                title={uploading ? "Uploading file…" : "Attach file"}
                disabled={uploading}
              >
                {uploading ? <LoaderCircle className="spin" /> : <Paperclip />}
              </button>
              <input
                value={text}
                onChange={(e) => onTyping(e.target.value)}
                placeholder={`Message ${active.displayName.split(" ")[0]}…`}
                maxLength="4000"
              />
              <div className="emoji-control">
                <button
                  type="button"
                  className="composer-icon"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  title="Add emoji"
                >
                  <Smile />
                </button>
                {showEmojiPicker && (
                  <div className="emoji-picker">
                    {[
                      "😀",
                      "😂",
                      "🥹",
                      "😍",
                      "🥰",
                      "😊",
                      "😉",
                      "😎",
                      "😭",
                      "🔥",
                      "❤️",
                      "👍",
                      "🙏",
                      "🎉",
                      "✨",
                      "💯",
                    ].map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => {
                          setText((v) => v + emoji);
                          setShowEmojiPicker(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`composer-icon ${recording ? "recording" : ""}`}
                onClick={toggleRecording}
                title={
                  recording
                    ? "Stop and send voice message"
                    : "Record voice message"
                }
                disabled={uploading}
              >
                <Mic />
              </button>
              <button
                className="send-btn"
                disabled={!text.trim()}
                title="Send message"
              >
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div className="welcome-panel">
            <div className="welcome-orbit">
              <div className="welcome-chat">
                <MessageCircle size={47} fill="currentColor" />
              </div>
              <span className="orbit-dot dot-one" />
              <span className="orbit-dot dot-two" />
              <span className="orbit-dot dot-three" />
            </div>
            <div className="welcome-eyebrow">
              <Zap size={14} /> GOOD CONVERSATIONS START HERE
            </div>
            <h2>
              Make space for
              <br />
              <em>your people.</em>
            </h2>
            <p>
              Pick a conversation or find someone new. The best things are
              better when shared.
            </p>
            <button className="primary-btn" onClick={() => setShowNew(true)}>
              <Plus size={18} /> Start a conversation
            </button>
            <div className="welcome-foot">
              <span>
                <i /> Private by account
              </span>
              <span>
                <i /> Real-time messages
              </span>
              <span>
                <i /> Made for your people
              </span>
            </div>
          </div>
        )}
      </section>

      {showNew && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowNew(false);
          }}
        >
          <section className="modal">
            <header>
              <div>
                <span className="eyebrow">FIND YOUR PEOPLE</span>
                <h2>New conversation</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowNew(false)}>
                <X />
              </button>
            </header>
            <p className="muted">
              Search a person's display name or exact username.
            </p>
            <div className="searchbox modal-search">
              <Search />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search usernames…"
              />
            </div>
            <div className="modal-results">
              {searchResults.length ? (
                searchResults.map((u) => (
                  <button
                    key={u.id}
                    className="search-result"
                    onClick={() => openChat(u)}
                  >
                    <Avatar user={u} />
                    <span>
                      <b>{u.displayName}</b>
                      <small>@{u.username}</small>
                    </span>
                    <span className="start-arrow">Message →</span>
                  </button>
                ))
              ) : (
                <div className="modal-empty">
                  Type at least one character to search users.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {showSettings && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <section className="modal profile-modal">
            <header>
              <div>
                <span className="eyebrow">YOUR ACCOUNT</span>
                <h2>Profile settings</h2>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
              >
                <X />
              </button>
            </header>
            <div className="profile-preview">
              <div
                className="profile-preview-avatar"
                style={{ background: profileDraft.avatarColor }}
              >
                {profileDraft.profilePhoto ? (
                  <img
                    src={
                      /^https?:\/\//i.test(profileDraft.profilePhoto)
                        ? profileDraft.profilePhoto
                        : `${API}${profileDraft.profilePhoto}`
                    }
                    alt=""
                  />
                ) : (
                  initials(
                    profileDraft.displayName || profileDraft.username || "U",
                  )
                )}
              </div>
              <div>
                <b>{profileDraft.displayName || "Your name"}</b>
                <small>@{profileDraft.username || "username"}</small>
              </div>
            </div>
            <form className="profile-form" onSubmit={saveProfile}>
              <input
                ref={profilePhotoInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={uploadProfilePhoto}
              />
              <button
                type="button"
                className="secondary-btn"
                onClick={() => profilePhotoInputRef.current?.click()}
                disabled={profilePhotoBusy}
              >
                <Camera size={16} />{" "}
                {profilePhotoBusy ? "Uploading photo…" : "Upload profile photo"}
              </button>
              <label>
                Display name
                <input
                  value={profileDraft.displayName}
                  onChange={(e) =>
                    setProfileDraft((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                    }))
                  }
                  maxLength={40}
                  minLength={1}
                  required
                  placeholder="Your display name"
                />
              </label>
              <label>
                Username
                <div className="username-field">
                  <span>@</span>
                  <input
                    value={profileDraft.username}
                    onChange={(e) =>
                      setProfileDraft((prev) => ({
                        ...prev,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, ""),
                      }))
                    }
                    minLength={3}
                    maxLength={24}
                    required
                    placeholder="your_username"
                  />
                </div>
                <small>
                  3–24 characters: lowercase letters, numbers and underscores.
                </small>
              </label>
              <div className="profile-color-field">
                <span>Avatar colour</span>
                <div className="profile-color-options">
                  {[
                    "#0b806b",
                    "#3867a8",
                    "#9b5a8c",
                    "#b46d2d",
                    "#4b8061",
                    "#e05252",
                    "#7546a8",
                    "#d49a24",
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`profile-color-swatch ${profileDraft.avatarColor === color ? "selected" : ""}`}
                      style={{ background: color }}
                      onClick={() =>
                        setProfileDraft((prev) => ({
                          ...prev,
                          avatarColor: color,
                        }))
                      }
                      aria-label={`Select ${color}`}
                      aria-pressed={profileDraft.avatarColor === color}
                    />
                  ))}
                </div>
              </div>
              <label>
                About
                <input
                  value={profileDraft.about || ""}
                  onChange={(e) =>
                    setProfileDraft((prev) => ({
                      ...prev,
                      about: e.target.value,
                    }))
                  }
                  maxLength={150}
                  placeholder="Hey there! I'm using ChitChat."
                />
              </label>
              {profileError && <div className="error-box">{profileError}</div>}
              <div className="profile-form-actions">
                <button
                  type="button"
                  className="icon-btn profile-cancel"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : null}
                  {savingProfile ? "Saving…" : "Save profile"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {showMemory && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowMemory(false);
          }}
        >
          <section className="modal memory-modal">
            <header>
              <div>
                <span className="eyebrow">LITTLE MOMENTS</span>
                <h2>Share a Memory</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowMemory(false)}>
                <X />
              </button>
            </header>
            <p className="muted">
              Share a thought with everyone on ChitChat. It disappears in 24
              hours.
            </p>
            <form onSubmit={createMemory}>
              <textarea
                value={memoryText}
                onChange={(e) => setMemoryText(e.target.value)}
                maxLength="500"
                rows="4"
                placeholder="What's happening in your world?"
                required
              />
              <div className="form-bottom">
                <small>{memoryText.length}/500</small>
                <button className="primary-btn" disabled={!memoryText.trim()}>
                  <Camera size={16} /> Share memory
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {call && (
        <div
          className={`call-screen ${call.type === "video" ? "call-video-mode" : "call-audio-mode"}`}
          role="dialog"
          aria-modal="true"
          aria-label={`${call.type} call`}
        >
          <div className="call-screen-top">
            <span className="call-brand">
              <MessageCircle size={18} /> ChitChat
            </span>
            <span className="call-secure-label">Private call</span>
          </div>
          <div className="call-stage">
            {call.type === "video" && remoteStream ? (
              <video
                ref={remoteVideoRef}
                className="call-remote-video"
                autoPlay
                playsInline
              />
            ) : null}
            <div
              className={`call-person-card ${remoteStream && call.type === "video" ? "call-person-overlay" : ""}`}
            >
              {call.type !== "video" || !remoteStream ? (
                <Avatar user={call.peer} size="call-avatar" />
              ) : null}
              <h2>{call.peer?.displayName || "ChitChat user"}</h2>
              <p>
                {call.status === "incoming"
                  ? "Incoming call…"
                  : call.status === "ringing"
                    ? "Calling…"
                    : call.status === "connecting"
                      ? "Connecting…"
                      : call.status === "active"
                        ? `${Math.floor(callSeconds / 60)
                            .toString()
                            .padStart(
                              2,
                              "0",
                            )}:${(callSeconds % 60).toString().padStart(2, "0")}`
                        : call.status === "declined"
                          ? "Call declined"
                          : call.status === "ended"
                            ? "Call ended"
                            : "Connection interrupted"}
              </p>
            </div>
            {call.type === "video" && localStream && !cameraOff && (
              <video
                ref={localVideoRef}
                className="call-local-video"
                autoPlay
                playsInline
                muted
              />
            )}
            {call.type === "video" && localStream && cameraOff && (
              <div className="call-camera-off">Camera off</div>
            )}
          </div>
          <div className="call-controls">
            {call.status === "incoming" ? (
              <>
                <button
                  className="call-control decline"
                  onClick={() => {
                    socket?.emit("call:reject", {
                      recipientId: call.peer.id,
                      callId: call.callId,
                    });
                    cleanupCall(false);
                  }}
                >
                  <X /> <span>Reject</span>
                </button>
                <button className="call-control accept" onClick={acceptCall}>
                  <Phone /> <span>Accept</span>
                </button>
              </>
            ) : call.status === "declined" || call.status === "ended" ? (
              <button
                className="call-control decline"
                onClick={() => cleanupCall(false)}
              >
                <X /> <span>Close</span>
              </button>
            ) : (
              <>
                <button
                  className={`call-control ${callMuted ? "control-active" : ""}`}
                  onClick={toggleCallMute}
                  title={callMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  <Mic /> <span>{callMuted ? "Unmute" : "Mute"}</span>
                </button>
                {call.type === "video" && (
                  <button
                    className={`call-control ${cameraOff ? "control-active" : ""}`}
                    onClick={toggleCallCamera}
                    title={cameraOff ? "Turn camera on" : "Turn camera off"}
                  >
                    <Camera />{" "}
                    <span>{cameraOff ? "Camera on" : "Camera off"}</span>
                  </button>
                )}
                <button
                  className="call-control decline"
                  onClick={() => cleanupCall(true)}
                  title="End call"
                >
                  <Phone /> <span>End call</span>
                </button>
              </>
            )}
          </div>
          <div className="call-screen-bottom">
            Use headphones for the best experience
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
