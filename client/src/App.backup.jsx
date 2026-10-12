import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Search, Plus, Send, Paperclip, Smile, MoreVertical, Phone, Video, Users, Archive, Settings, LogOut, ArrowLeft, CheckCheck, CircleUserRound, Camera, X, Sparkles, ShieldCheck, Zap, LoaderCircle } from "lucide-react";
import { API, api, connectSocket, initials, time } from "./lib.js";

const avatarClass = (color) => ({ background: color || "#0b806b" });
function Avatar({ user, size = "md", ring = false }) {
  return <div className={`avatar ${size} ${ring ? "ring" : ""}`} style={avatarClass(user?.avatarColor)}>{initials(user?.displayName || user?.username)}</div>;
}
function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const data = await api(`/api/auth/${mode}`, null, { method: "POST", body: JSON.stringify({ username, password, displayName }) });
      onAuth(data);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="auth-shell">
    <div className="auth-brand"><div className="brand-icon"><MessageCircle size={27} fill="currentColor" /></div><span>Chit<span>Chat</span></span></div>
    <section className="auth-card">
      <div className="auth-eyebrow"><Sparkles size={15}/> YOUR PEOPLE, YOUR SPACE</div>
      <h1>{mode === "login" ? "Good to see you." : "Let's get connected."}</h1>
      <p className="muted">{mode === "login" ? "Sign in and pick up where your conversations left off." : "Create your account and start a conversation."}</p>
      <form onSubmit={submit} className="auth-form">
        {mode === "register" && <label>Your name<input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Aryan Salam" maxLength="40" required /></label>}
        <label>Username<div className="username-field"><span>@</span><input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="your_username" minLength="3" maxLength="24" required /></div></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" minLength="8" required /></label>
        {error && <div className="error-box">{error}</div>}
        <button className="primary-btn auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : null}{mode === "login" ? "Log in" : "Create account"} <span>→</span></button>
      </form>
      <div className="auth-switch">{mode === "login" ? "New to ChitChat?" : "Already have an account?"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create account" : "Log in"}</button></div>
      <div className="secure-note"><ShieldCheck size={15}/> Your password is securely hashed before storage.</div>
    </section>
    <p className="auth-footer">A little closer, even when you're far apart.</p>
  </main>;
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chitchat-auth") || "null"); } catch { return null; }
  });
  const [me, setMe] = useState(auth?.user || null);
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [text, setText] = useState("");
  const [online, setOnline] = useState({});
  const [typing, setTyping] = useState({});
  const [tab, setTab] = useState("chats");
  const [memories, setMemories] = useState([]);
  const [memoryText, setMemoryText] = useState("");
  const [showMemory, setShowMemory] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);

  const token = auth?.token;
  const notify = msg => { setToast(msg); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setToast(""), 2600); };
  function logout() { if (socket) socket.disconnect(); localStorage.removeItem("chitchat-auth"); setAuth(null); setMe(null); setSocket(null); setActive(null); setMessages([]); }
  function acceptAuth(data) { localStorage.setItem("chitchat-auth", JSON.stringify(data)); setAuth(data); setMe(data.user); }

  useEffect(() => {
    if (!token) return;
    let s;
    api("/api/me", token).then(data => setMe(data.user)).catch(() => logout());
    s = connectSocket(token); setSocket(s);
    s.on("connect_error", () => notify("Can't connect to chat server. Check backend and API URL."));
    s.on("message:new", message => {
      const otherId = message.senderId === me?.id ? message.recipientId : message.senderId;
      setUsers(prev => {
        const exists = prev.some(u => u.id === otherId);
        if (exists) return prev;
        return prev;
      });
      setMessages(prev => {
        if (active && (message.senderId === active.id || message.recipientId === active.id)) {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        }
        return prev;
      });
      if (!active || (message.senderId !== active.id && message.recipientId !== active.id)) notify("New message received");
    });
    s.on("presence:update", event => setOnline(prev => ({ ...prev, [event.userId]: event.online })));
    s.on("typing:update", event => setTyping(prev => ({ ...prev, [event.userId]: event.typing })));
    s.on("memory:new", memory => setMemories(prev => prev.some(m => m.id === memory.id) ? prev : [memory, ...prev]));
    return () => s.disconnect();
  }, [token, me?.id, active?.id]);

  useEffect(() => {
    if (!token) return;
    api("/api/memories", token).then(data => setMemories(data.memories)).catch(() => {});
  }, [token]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, active]);

  useEffect(() => {
    if (!token || query.trim().length < 1) { setSearchResults([]); return; }
    const timer = setTimeout(() => api(`/api/users?q=${encodeURIComponent(query.trim())}`, token).then(d => setSearchResults(d.users)).catch(() => setSearchResults([])), 250);
    return () => clearTimeout(timer);
  }, [query, token]);

  async function openChat(user) {
    setActive(user); setTab("chats"); setShowNew(false); setQuery(""); setSearchResults([]); setLoading(true);
    try {
      const data = await api(`/api/messages/${user.id}`, token);
      setMessages(data.messages);
      setUsers(prev => prev.some(u => u.id === user.id) ? prev : [user, ...prev]);
    } catch (e) { notify(e.message); setMessages([]); }
    finally { setLoading(false); }
  }
  function sendMessage(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !active || !socket) return;
    setText("");
    socket.emit("message:send", { recipientId: active.id, text: body }, result => {
      if (!result?.ok) { setText(body); notify(result?.error || "Message failed."); }
      else setMessages(prev => prev.some(m => m.id === result.message.id) ? prev : [...prev, result.message]);
    });
    socket.emit("typing:set", { recipientId: active.id, typing: false });
  }
  function onTyping(value) {
    setText(value);
    if (!active || !socket) return;
    socket.emit("typing:set", { recipientId: active.id, typing: value.length > 0 });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("typing:set", { recipientId: active.id, typing: false }), 1000);
  }
  async function createMemory(e) {
    e.preventDefault();
    try { await api("/api/memories", token, { method: "POST", body: JSON.stringify({ text: memoryText }) }); setMemoryText(""); setShowMemory(false); notify("Memory shared for 24 hours."); }
    catch (e) { notify(e.message); }
  }
  const visibleUsers = useMemo(() => users.filter(u => `${u.displayName} ${u.username}`.toLowerCase().includes(query.toLowerCase())), [users, query]);
  if (!auth || !me) return <Auth onAuth={acceptAuth}/>;

  const chatUserIds = new Set(users.map(u => u.id));
  const activeMessages = messages.filter(m => active && (m.senderId === active.id || m.recipientId === active.id));
  const myMemories = memories.filter(m => m.user?.id === me.id);

  return <main className="app-shell">
    <aside className="nav-rail">
      <div className="rail-logo"><MessageCircle size={25} fill="currentColor"/></div>
      <button className={`rail-btn ${tab === "chats" ? "selected" : ""}`} onClick={() => setTab("chats")} title="Chats"><MessageCircle/></button>
      <button className={`rail-btn ${tab === "memories" ? "selected" : ""}`} onClick={() => setTab("memories")} title="Memories"><Camera/></button>
      <button className={`rail-btn ${tab === "communities" ? "selected" : ""}`} onClick={() => notify("Communities are planned for a future update.")} title="Communities"><Users/></button>
      <div className="rail-bottom"><button className="rail-btn" onClick={() => notify("Settings will be added in a future update.")} title="Settings"><Settings/></button><button className="rail-profile" onClick={logout} title="Log out"><Avatar user={me}/></button></div>
    </aside>

    <section className={`sidebar ${active ? "mobile-hidden" : ""}`}>
      <header className="sidebar-top"><div><div className="eyebrow">YOUR SPACE</div><h1>{tab === "memories" ? "Memories" : tab === "chats" ? "Messages" : "ChitChat"}</h1></div><button className="icon-btn filled" onClick={() => tab === "memories" ? setShowMemory(true) : setShowNew(true)} title={tab === "memories" ? "Add memory" : "New chat"}><Plus size={19}/></button></header>
      {tab === "chats" ? <>
        <div className="searchbox"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search chats or people"/><kbd>⌘ K</kbd></div>
        {query && searchResults.length > 0 && <div className="search-results"><div className="section-label">PEOPLE</div>{searchResults.map(u => <button key={u.id} className="search-result" onClick={() => openChat(u)}><Avatar user={u}/><span><b>{u.displayName}</b><small>@{u.username}</small></span><ArrowLeft size={15}/></button>)}</div>}
        <div className="filter-row"><button className="filter active">All chats</button><button className="filter" onClick={() => notify("Unread filter coming soon.")}>Unread</button><button className="filter" onClick={() => notify("Groups coming soon.")}>Groups</button></div>
        <div className="chat-list">
          {users.length === 0 ? <div className="empty-sidebar"><div className="empty-illustration"><MessageCircle size={28}/></div><h3>Your conversations start here</h3><p>Search for a username to find your people and say hello.</p><button className="text-btn" onClick={() => setShowNew(true)}>Find someone <span>→</span></button></div> :
            visibleUsers.map(user => {
              const last = [...messages].reverse().find(m => m.senderId === user.id || m.recipientId === user.id);
              return <button key={user.id} className={`chat-row ${active?.id === user.id ? "active" : ""}`} onClick={() => openChat(user)}>
                <div className="avatar-wrap"><Avatar user={user} size="lg"/>{online[user.id] && <i className="online-dot"/>}</div>
                <span className="chat-row-content"><span className="chat-row-top"><b>{user.displayName}</b><small>{last ? time(last.createdAt) : ""}</small></span><span className="chat-preview">{last ? last.text : `@${user.username}`}</span></span>
              </button>;
            })}
        </div>
        <div className="sidebar-footer"><span className="status-dot"/> Connected as <b>@{me.username}</b><button onClick={logout} title="Log out"><LogOut size={15}/></button></div>
      </> : tab === "memories" ? <div className="memories-list"><div className="memory-intro"><div className="memory-icon"><Camera/></div><div><b>A little moment, saved.</b><p>Memories disappear after 24 hours.</p></div></div><button className="primary-btn full" onClick={() => setShowMemory(true)}><Plus size={17}/> Share a memory</button>{memories.map(m => <div className="memory-card" key={m.id}><div className="memory-person"><Avatar user={m.user}/><span><b>{m.user.displayName}</b><small>@{m.user.username} · {time(m.createdAt)}</small></span></div><p>{m.text}</p></div>)}</div> : <div className="empty-sidebar"><Users/><h3>Communities are coming</h3><p>Group conversations will be part of a future update.</p></div>}
    </section>

    <section className={`conversation ${!active ? "mobile-hidden" : ""}`}>
      {active ? <>
        <header className="conversation-header"><button className="icon-btn back-btn" onClick={() => setActive(null)}><ArrowLeft/></button><Avatar user={active} size="lg"/><div className="conversation-person"><b>{active.displayName}</b><small>{typing[active.id] ? "typing…" : online[active.id] ? "online now" : `@${active.username}`}</small></div><div className="header-actions"><button className="icon-btn" onClick={() => notify("Voice calls are not configured yet.")} title="Voice call"><Phone/></button><button className="icon-btn" onClick={() => notify("Video calls are not configured yet.")} title="Video call"><Video/></button><button className="icon-btn" onClick={() => notify("More options coming soon.")} title="More"><MoreVertical/></button></div></header>
        <div className="chat-background"><div className="encryption-note"><ShieldCheck size={14}/> Messages are stored securely in this app's database. This is not end-to-end encrypted.</div>
          {loading ? <div className="loading-state"><LoaderCircle className="spin"/> Loading conversation…</div> : activeMessages.length === 0 ? <div className="conversation-empty"><div className="wave-icon"><MessageCircle size={30}/></div><h2>Say hello to {active.displayName.split(" ")[0]}.</h2><p>Every great conversation starts somewhere.</p><span>Messages you send here are real and saved to the database.</span></div> :
            <div className="messages">{activeMessages.map(m => { const mine = m.senderId === me.id; return <div className={`message-row ${mine ? "mine" : ""}`} key={m.id}><div className="bubble">{m.text}<div className="bubble-meta"><time>{time(m.createdAt)}</time>{mine && <CheckCheck size={14}/>}</div></div></div>; })}<div ref={bottomRef}/></div>}
          {typing[active.id] && <div className="typing-indicator"><span/><span/><span/> {active.displayName} is typing</div>}
        </div>
        <form className="composer" onSubmit={sendMessage}><button type="button" className="composer-icon" onClick={() => notify("File sharing is not configured yet.")} title="Attach file"><Paperclip/></button><input value={text} onChange={e => onTyping(e.target.value)} placeholder={`Message ${active.displayName.split(" ")[0]}…`} maxLength="4000"/><button type="button" className="composer-icon" onClick={() => setText(v => v + " 😊")} title="Add emoji"><Smile/></button><button className="send-btn" disabled={!text.trim()} title="Send message"><Send size={18}/></button></form>
      </> : <div className="welcome-panel"><div className="welcome-orbit"><div className="welcome-chat"><MessageCircle size={47} fill="currentColor"/></div><span className="orbit-dot dot-one"/><span className="orbit-dot dot-two"/><span className="orbit-dot dot-three"/></div><div className="welcome-eyebrow"><Zap size={14}/> GOOD CONVERSATIONS START HERE</div><h2>Make space for<br/><em>your people.</em></h2><p>Pick a conversation or find someone new. The best things are better when shared.</p><button className="primary-btn" onClick={() => setShowNew(true)}><Plus size={18}/> Start a conversation</button><div className="welcome-foot"><span><i/> Private by account</span><span><i/> Real-time messages</span><span><i/> Made for your people</span></div></div>}
    </section>

    {showNew && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowNew(false); }}><section className="modal"><header><div><span className="eyebrow">FIND YOUR PEOPLE</span><h2>New conversation</h2></div><button className="icon-btn" onClick={() => setShowNew(false)}><X/></button></header><p className="muted">Search a person's display name or exact username.</p><div className="searchbox modal-search"><Search/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search usernames…"/></div><div className="modal-results">{searchResults.length ? searchResults.map(u => <button key={u.id} className="search-result" onClick={() => openChat(u)}><Avatar user={u}/><span><b>{u.displayName}</b><small>@{u.username}</small></span><span className="start-arrow">Message →</span></button>) : <div className="modal-empty">Type at least one character to search users.</div>}</div></section></div>}
    {showMemory && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowMemory(false); }}><section className="modal memory-modal"><header><div><span className="eyebrow">LITTLE MOMENTS</span><h2>Share a Memory</h2></div><button className="icon-btn" onClick={() => setShowMemory(false)}><X/></button></header><p className="muted">Share a thought with everyone on ChitChat. It disappears in 24 hours.</p><form onSubmit={createMemory}><textarea value={memoryText} onChange={e => setMemoryText(e.target.value)} maxLength="500" rows="4" placeholder="What's happening in your world?" required/><div className="form-bottom"><small>{memoryText.length}/500</small><button className="primary-btn" disabled={!memoryText.trim()}><Camera size={16}/> Share memory</button></div></form></section></div>}
    {toast && <div className="toast">{toast}</div>}
  </main>;
}
