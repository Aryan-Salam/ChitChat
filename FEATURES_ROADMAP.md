# ChitChat — Feature Scope & Implementation Roadmap

This ZIP contains a **full-stack starter**, not a finished WhatsApp replacement.

## Implemented in the starter
- React + Vite responsive UI
- Register/login API with bcrypt password hashing and JWT
- MongoDB user, message, and memory models
- Socket.IO real-time direct text messaging
- Username search
- Online presence and typing indicator
- Persisted direct-message history
- Text Memories with 24-hour expiry
- Basic validation, CORS and auth rate limiting

## Not implemented yet
Most features in the inventory are planned, not working or verified. Calls, end-to-end encryption, payments, SMS verification, cloud backups, AI, multi-device sync, large media uploads and native camera/biometric features require dedicated services, infrastructure, platform support and security testing.

## Recommended build order
1. Core messaging: conversations from database, unread counters, receipts, edit/delete, reactions, reply/forward, drafts, search, archive/mute/pin.
2. Media: secure object storage, upload limits, previews, image/video/document/voice notes.
3. Groups: memberships, roles, invites, polls, events and group history.
4. Memories: photo/video/voice uploads, audience privacy, viewers, reactions/replies.
5. Privacy: block/report, privacy controls, session management and account recovery.
6. Calls: WebRTC signalling, STUN/TURN and group-call infrastructure.
7. Advanced services: audited encryption protocol, backups, notifications, AI, payments/business APIs, channels and communities.
8. Production readiness: abuse prevention, monitoring, backups, accessibility, privacy policy, terms and load testing.

## Security
Messages are stored in MongoDB and are **not end-to-end encrypted** in this starter. Do not describe it as E2EE or use it for sensitive private communications. Browsers cannot reliably prevent screenshots across platforms. Never expose secrets in frontend code. Configure HTTPS, deployment secrets, MongoDB access controls, backups and rate limits before public launch.

See `FEATURE_INVENTORY.md` and `FEATURE_INVENTORY.json` for the categorized feature checklist. All inventory entries are marked planned until implemented and tested.
