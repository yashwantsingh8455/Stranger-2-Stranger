# Stranger 2 Stranger — Account + Guest Build

Stranger 2 Stranger is a real-time social chat platform built with Node.js, Express, Socket.IO, MongoDB/Mongoose and optional Firebase Authentication. Users can either sign in/create a normal Firebase account **or continue as a Guest using username + country + date of birth**. It includes global chat, private DMs, persistent profiles, password-protected groups, moderation/admin tools, reports, VIP roles, media/voice messages, Jitsi-based voice/video rooms, optional Discord integration and PWA support.

## Authentication modes

### 1. Guest mode — works without Firebase Admin
Guest registration asks for:
- Username
- Country
- Date of birth

The server validates the details, requires age 13+, creates a random guest ID and returns a high-entropy guest session token. DOB is used only to verify age during registration; the exact DOB is **not stored** in MongoDB and is not returned in profiles, user lists or chat messages. Guest sessions last for `GUEST_SESSION_DAYS` (default 30) and can be resumed in the same browser. Explicit logout deletes the temporary guest identity so the username can be used again.

Guest users can chat, use DMs/groups, edit their guest profile and open calls. Guests can **never become admin**; admin privileges remain Firebase-UID based.

### 2. Firebase account mode — optional
Email/password login and account creation continue to work when Firebase is configured. Firebase Admin is only required for server-side verification of Firebase account tokens. If Firebase Admin is not configured, Guest mode still works.

## Important security note

The original archive contained credentials/webhooks in source code. This build removes them, but removing them from code does not invalidate credentials that were already exposed. Before deployment, rotate the old MongoDB password, Discord webhooks/tokens and any admin password that appeared in the original project.

## Setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. For Guest mode, set at minimum:
   - `MONGO_URI`
   - `PANEL_PASSWORD`
   - `ALLOW_GUEST_AUTH=true`
5. Optional Firebase account login:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`
   - `ADMIN_FIREBASE_UIDS` for in-chat administrators
6. Set `ALLOWED_ORIGIN` to your deployed HTTPS origin.
7. Run `npm start`.

MongoDB is required for secure guest sessions because the guest token is verified against a hashed server-side session record.

## Render deployment

- Root directory: repository root, not `public/`
- Build command: `npm install`
- Start command: `npm start`
- Add values from `.env.example` in Render Environment Variables.
- Do not upload `.env` or `firebase-service-account.json` to GitHub.

### Minimum Render environment for Guest-only mode

```env
MONGO_URI=your_mongodb_connection_string
PANEL_PASSWORD=your_long_random_admin_panel_password
ALLOW_GUEST_AUTH=true
GUEST_SESSION_DAYS=30
ALLOWED_ORIGIN=https://your-domain.example
```

Firebase service-account configuration is not required if you only want Guest mode.

## Main routes

- `/` — dashboard for account or guest users
- `/login.html` — Sign In / Create Account / Guest options
- `/Group-Chatroom.html` — global chat, groups and DMs
- `/call.html` — call interface for verified account or guest sessions
- `/admin` — server-authorized moderation panel
- `/health` — safe live status including Firebase and Guest availability

## Guest API

- `POST /api/guest/register` — create guest session from username, country, DOB
- `GET /api/guest/profile` — fetch guest profile using `X-Guest-Token`
- `PUT /api/guest/profile` — update guest profile using `X-Guest-Token`
- `POST /api/guest/logout` — delete the temporary guest identity

## Security and privacy behavior

- Guest joins require a server-issued token; arbitrary unsigned Socket.IO joins are rejected.
- Guest tokens are stored as SHA-256 hashes in MongoDB, not plaintext.
- Exact DOB is validated and then discarded; only an age-verification timestamp is stored.
- Admin role is only granted through the Firebase UID allowlist.
- Guest users cannot claim admin privileges through their username.
- Message deletion checks ownership/admin permission and uses MongoDB IDs.
- Group passwords are bcrypt-hashed and are never returned in group lists.
- Public session-intelligence endpoints are protected.
- Chat media is size-limited; use object storage for production-scale media.

## Calls and privacy

`call.html` accepts either a valid Firebase account session or valid Guest session. It uses public `meet.jit.si`. Random high-entropy room names are generated for private links, but a public Jitsi room is not equivalent to a self-hosted/JWT-protected meeting. For strict call authorization, deploy JWT-secured/self-hosted Jitsi.

## Validation

```bash
npm test
npm start
```

`npm test` performs server syntax validation. Add automated API/Socket.IO tests before a high-traffic production launch.
