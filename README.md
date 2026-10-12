# ChitChat — full-stack real-time chat starter

A WhatsApp-inspired chat app named **ChitChat** with **Memories** instead of Status.

## Included
- Register/login with JWT and bcrypt password hashing
- User search by username
- Real-time direct messages with Socket.IO
- Persisted message history in MongoDB
- Online indicators and typing status
- Edit and soft-delete your own messages
- Reply-to-message references
- Emoji reactions (❤️ 😂 👍 😮 😢 🔥)
- Sent/read receipts via Socket.IO and message history
- Light/dark theme toggle (saved in the browser)
- Emoji picker and in-browser voice-message recording
- Profile-photo upload and profile/about editing
- Image, video, audio and document attachment uploads/downloads
- Create and view text Memories (24-hour expiry)
- Responsive React interface
- Basic API rate limiting and validation

## Requirements
- Node.js 20+ recommended
- A MongoDB database (MongoDB Atlas is fine)

## Setup
1. Install Node.js.
2. Create a MongoDB Atlas cluster/database and obtain its connection string.
3. Copy `server/.env.example` to `server/.env`.
4. Set `MONGO_URI` and a long random `JWT_SECRET` in `server/.env`.
5. In the project root run:
   ```bash
   npm install
   npm --prefix server install
   npm --prefix client install
   npm run dev
   ```
6. Open the Vite URL shown in the terminal (normally http://localhost:5173).

## Environment variables
`server/.env`
- `PORT=5000`
- `MONGO_URI=your_mongodb_connection_string`
- `JWT_SECRET=use_a_long_random_secret`
- `CLIENT_ORIGIN=http://localhost:5173`

## Deploying online
- Deploy `server` as a Node web service (for example on Render) with `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` environment variables.
- Deploy `client` as a static site (for example on Netlify) with `VITE_API_URL` set to the deployed backend URL, e.g. `https://your-api.example.com`.
- Set `CLIENT_ORIGIN` on the backend to your deployed frontend URL.
- In `client/src/lib.js`, the Socket.IO client uses the same API URL as REST calls.

## Feature notes
- Voice recording requires microphone permission and a secure context (localhost or HTTPS).
- Profile photos are saved in the server's local `uploads` directory; use persistent storage when deploying.
- Message deletion is a soft-delete that replaces the message content with a deleted notice for both participants.
- These updates have been integrated into the project source, but you should run `npm run build` and exercise two separate accounts before deploying.

## Important
This is a functional starter, not an audited production messaging service. Before public use, add email/phone verification, account recovery, abuse reporting/blocking, secure file uploads, stronger privacy controls, monitoring, backups, and end-to-end encryption if required. Messages are stored in MongoDB and are **not end-to-end encrypted** in this starter. Do not put secrets in frontend files or commit `.env`.
