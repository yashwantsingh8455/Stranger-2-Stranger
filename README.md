# Stranger 2 Stranger — Social V3

Stranger 2 Stranger is an authenticated real-time social discovery and community chat platform built with **Node.js, Express, Socket.IO, MongoDB/Mongoose, Firebase Authentication and Jitsi Meet**. Social V3 keeps the repaired Social V2 foundation and adds a cleaner message interaction model, double-tap reactions, self-aware online users, persistent blocking/unblocking history, and a much richer in-chat settings center while retaining smart matching, connections, communities, moderation, calls, analytics and PWA support.

## Important security note

The original archive contained credentials/webhooks in source code. Social V2 does **not** include those secrets. Removing an exposed secret from source code does not invalidate it, so rotate any old MongoDB password, Discord webhook/token and admin credential that appeared in the original archive before deployment.

## Setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set at minimum `MONGO_URI`, `PANEL_PASSWORD`, `ADMIN_FIREBASE_UIDS` and `FIREBASE_SERVICE_ACCOUNT_JSON`.
5. Keep `REQUIRE_FIREBASE_AUTH=true` and `REQUIRE_EMAIL_VERIFIED=true` in production.
6. Set `ALLOWED_ORIGIN` to the deployed HTTPS origin.
7. Run `npm start`.
8. Open `/social.html` for the new Social Hub.

The Firebase web config remains a client-side Firebase configuration. Server privileges still require the Firebase Admin service account and server-side authorization.

## Main pages

- `/` — authenticated dashboard
- `/login.html` — Firebase signup/login + email verification
- `/social.html` — Social Hub: matching, connections, rooms, tools, profile, safety
- `/Group-Chatroom.html` — global/group chat with enhanced messages
- `/call.html` — Jitsi voice/video rooms
- `/admin` — moderation panel
- `/analytics.html` — admin analytics, report/appeal queues and audit logs
- `/health` — safe server status

## Social V3 chat UX & privacy updates

- Every normal chat message has a compact always-available three-dot menu instead of the old wide hover action bar.
- Message menu includes Reply, React, Save, Forward, Pin/Unpin, Edit (own text), Direct Message (other user), Block/Unblock, and Delete when authorized.
- Reaction picker opens on desktop double-click and Android/touch double-tap. Applied reaction counts remain as compact chips.
- The signed-in account is labelled **You** in Online Users and cannot open a DM with itself.
- Online users expose Block/Unblock controls; blocked users cannot use the DM path and their messages can be hidden locally.
- Block/unblock actions are stored in MongoDB BlockHistory and can be reviewed from Settings.
- Settings now includes profile/presence, chat theme, privacy, chat behaviour, browser notifications, notification preferences, accessibility, blocked accounts/history, data export, draft cleanup and session revocation.
- Chat behaviour preferences are persisted to MongoDB per Firebase account.

## Social V2 highlights

- Interest/language/topic/country/timezone profiles and smart-match filters.
- Random temporary 1-to-1 matching with compatibility scoring, skip/next and connection requests.
- Connection/friend system, received/sent requests, permanent connection DMs, block and mute.
- Reputation, XP, levels, badges, account-age information, presence, custom status and last-seen privacy.
- Message reactions, edit, pin, save/star, search, read receipts, forwarding, temporary messages, per-room drafts and media gallery.
- Image compression/preview, voice-note waveform and bounded file sharing.
- Public/private communities with roles, approval queue, expiring invite links, rules, slow mode, announcements-only mode, polls, events, notes and branding fields.
- Safety Center, warning history, categorized reports, moderator queue, appeals, heuristic AI-assisted moderation flags, link protection and rate limits.
- Conversation starters, language detection, summary helper and optional translation-provider hook.
- Topic-room discovery/trending, daily discussion prompt, streak/XP/badges, helpfulness-oriented leaderboard, RPS/quiz/Tic-Tac-Toe and Pomodoro study utility.
- Call lobby, mic/camera/screen controls, device selectors, raise hand, participant limit and moderator host controls where the Jitsi room grants moderator permission.
- In-app notifications, notification preferences, PWA install/offline read cache, responsive mobile navigation and accessibility options.
- Premium-ready themes, animated avatar frames, creator/community rooms and higher saved-message quota with server-side entitlement checks.
- Admin analytics for activity, growth, rooms, reports, moderation and server health plus audit logs.
- Account export/delete, recent sessions, revoke-all sessions, email verification and username-change cooldown.

See `FEATURES-V2.md` for the full implementation matrix and provider-dependent limitations.

## Render deployment

- Root directory: repository root, **not** `public/`
- Build command: `npm install`
- Start command: `npm start`
- Add `.env.example` values as Render Environment Variables.
- Never commit `.env` or Firebase service-account JSON.

## Provider-dependent features

Some requested features require infrastructure that cannot be safely faked inside a ZIP:

- **AI translation:** `/api/social/ai/translate` is implemented as a provider hook. Configure `TRANSLATION_API_URL` and optionally `TRANSLATION_API_KEY`.
- **Paid checkout:** premium entitlements and admin grant/status APIs exist, but no fake payment gateway is included. Connect your chosen real billing provider before taking payments.
- **Browser push while the site is fully closed:** current notifications are in-app/realtime. True Web Push requires push credentials/subscriptions and a delivery service.
- **Large media storage:** current data/file messages are intentionally bounded. Use object storage for production-scale files/video and store URLs in MongoDB.
- **Strict private Jitsi authorization:** the UI and app auth protect the Stranger 2 Stranger entry flow, but strict meeting-level authorization requires an appropriately configured Jitsi deployment/JWT setup.

## Validation

Run:

```bash
npm test
npm start
```

`npm test` runs the bundled validator for server/social/service-worker JavaScript syntax, manifest validity, active-page inline JavaScript, duplicate static HTML IDs, required files, auth defaults and known leaked-secret patterns.
