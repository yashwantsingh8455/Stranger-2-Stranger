# Stranger 2 Stranger — Repaired Build

Stranger 2 Stranger is an authenticated real-time social chat platform built with Node.js, Express, Socket.IO, MongoDB/Mongoose and Firebase Authentication. It includes a global chat, private DMs, persistent profiles, password-protected groups, moderation/admin tools, reports, VIP roles, media/voice messages, Jitsi-based voice/video rooms, Discord integration and PWA metadata.

## Important security note

The original archive contained credentials/webhooks in source code. This repaired build removes them, but **removing them from code does not invalidate credentials that were already exposed**. Before deployment, rotate the old MongoDB password, Discord webhooks/tokens and any admin password that appeared in the original project.

## Setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set at minimum:
   - `MONGO_URI`
   - `PANEL_PASSWORD`
   - `ADMIN_FIREBASE_UIDS` (comma-separated Firebase UIDs allowed to perform in-chat admin actions)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (Firebase Admin service account JSON on one line)
5. Keep `REQUIRE_FIREBASE_AUTH=true` in production.
6. Set `ALLOWED_ORIGIN` to the deployed HTTPS origin.
7. Run `npm start`.

The frontend Firebase web config remains in `public/index.html` / `public/login.html`. Firebase web API keys are public client identifiers; server privileges still require the Firebase Admin service account.

## Render deployment

- Root directory: repository root (not `public/`)
- Build command: `npm install`
- Start command: `npm start`
- Add the `.env.example` variables as Render Environment Variables.
- Do not upload `.env` or `firebase-service-account.json` to GitHub.

## Main routes

- `/` — authenticated dashboard
- `/login.html` — Firebase login/signup
- `/Group-Chatroom.html` — global chat, groups and DMs
- `/call.html` — authenticated Jitsi call interface
- `/admin` — server-authorized moderation panel
- `/health` — safe live status

## Key repaired areas

- Removed hard-coded MongoDB URI, Discord webhooks and client-side admin password.
- Firebase token verification is mandatory by default before joining chat.
- In-chat admin authorization is based on Firebase UID allowlist, not username.
- Message deletion checks ownership/admin permission and uses MongoDB message IDs.
- Group passwords are bcrypt-hashed and never returned in group lists.
- Group message/typing actions require actual room membership.
- Admin session/intelligence endpoints require admin authorization.
- Dashboard profiles are synchronized to MongoDB across devices.
- Global chat history uses MongoDB as the source of truth instead of browser localStorage.
- Replies/captions are persisted with messages.
- Media payloads are validated and capped at roughly 1.5 MB to prevent unbounded Socket.IO/MongoDB payloads.
- DMs validate input and keep bounded history per conversation.
- Fake online/activity counters were replaced with `/health` data.
- Missing live-announcement API and PWA 512px icon were added.
- Legacy incompatible room pages and duplicate/dead project copies were removed.
- Package dependencies were reduced to direct runtime dependencies.

## Calls and privacy

`call.html` uses the public `meet.jit.si` service. The app requires a valid Stranger 2 Stranger Firebase session to open the call page and generates high-entropy random room names for private links. However, a public Jitsi room is not the same as a self-hosted/JWT-protected meeting: someone who already knows the exact Jitsi room name may be able to join it directly. For strict private-call authorization, deploy a JWT-secured/self-hosted Jitsi instance and configure it separately.

## Media storage

Small chat media is currently sent as data URLs with a strict size limit. For large images/videos or high traffic, move media bytes to object storage (Firebase Storage, S3, Cloudinary or Supabase Storage) and save only URLs in MongoDB.

## Validation commands

```bash
npm test
npm start
```

`npm test` currently performs a server syntax validation. Add integration/socket tests before a high-traffic production launch.
