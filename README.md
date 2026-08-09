# Stranger 2 Stranger — Social Discovery Edition

Stranger 2 Stranger is a real-time social discovery and chat platform built with **Node.js, Express, Socket.IO, MongoDB/Mongoose, optional Firebase Authentication, Jitsi Meet and optional Discord integration**. Users can sign in with a Firebase account or continue as a Guest using username + country + DOB.

This edition keeps the White + Sky Blue UI and adds a new `/discover.html` product hub for interest-based matching, topic rooms, communities, friends, reputation and safety controls.

## New social features

- Interest profile and language preferences
- Instant stranger matching by shared interests
- **Strict same-age-band matching:** 13–17 only matches 13–17; 18+ only matches 18+
- 10 / 15 / 20 / 30 / 60 minute temporary conversations
- Temporary match message content is cleared when the conversation ends/expires
- Match-again invitations for recent conversations when both users are online
- Friend requests and accepted-friend list
- Positive reputation: Helpful, Friendly, Respectful
- Daily streaks and achievement badges
- Block, mute and report safety controls
- DM policy: Everyone / Friends only / Nobody
- Legacy private DMs also honor block, mute, teen/adult boundaries and DM policy
- Smart Safety fallback for spam-like, abusive and scam-like text plus rate limiting
- Topic rooms: Coding, Study, Gaming, Movies, Music, Anime, Sports, India and age-separated lounges
- Real-time topic messages, reactions, presence and polls
- Daily Question with community answers
- Public communities with member lists/counts
- Community chat, reactions and pinned messages
- Community threads + replies
- Community events + RSVP
- Community polls
- Community conversation summary (built-in extractive summary; no paid AI API required)
- Short-lived voice rooms with server-side age-band access verification
- Shareable SEO landing pages for topics and communities
- Dynamic `/sitemap.xml` and `/robots.txt`
- Real trending-room ranking from online presence + recent message activity
- In-app notifications and browser/PWA notification alerts while the app is active
- PWA install prompt and app shortcuts
- English / Hinglish UI toggle hooks
- Conversation starters based on shared interests

## Authentication modes

### Guest mode
Guest registration asks for:
- Username
- Country
- Date of birth

The exact DOB is used to validate age and is **not stored**. The server stores only the derived age band (`teen` = 13–17, `adult` = 18+) plus an age-verification timestamp. Guest sessions use a high-entropy token whose SHA-256 hash is stored in MongoDB.

### Firebase account mode
Firebase email/password accounts remain optional. A Firebase account that wants to use Discover/matching verifies DOB once inside Discover; only the derived age band is stored, not the exact DOB.

## Safety model

The social-discovery features are designed to avoid adult/minor 1-to-1 matching:

- Teen and adult users cannot be matched together.
- Teen/adult private DMs are blocked.
- Teen private messaging requires configured Discover safety profiles.
- Voice rooms are age-band restricted and re-check access inside `call.html`.
- Guests can never become admin.
- Block rules are enforced server-side for matching and private DMs.
- Mute suppresses real-time DM delivery and hides muted users in Discover room rendering.
- Smart Safety applies duplicate-spam, message-rate, abusive-language, unsafe-request and scam-like checks to Discover conversations.
- Repeated blocked messages can trigger a short temporary messaging restriction.
- Reports are stored for admin review and merged into the existing admin reports endpoint.

No safety filter is perfect. A real public launch should still have human moderation, clear community rules, abuse escalation, and appropriate legal/privacy review.

## Setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `MONGO_URI`.
5. Set `PANEL_PASSWORD`.
6. For Guest mode keep `ALLOW_GUEST_AUTH=true`.
7. Optional Firebase account login: add `FIREBASE_SERVICE_ACCOUNT_JSON` and `ADMIN_FIREBASE_UIDS`.
8. Set `ALLOWED_ORIGIN` to your deployed HTTPS origin.
9. Run `npm start`.

### Minimum Render environment

```env
MONGO_URI=your_mongodb_connection_string
PANEL_PASSWORD=your_long_random_admin_panel_password
ALLOW_GUEST_AUTH=true
GUEST_SESSION_DAYS=30
ALLOWED_ORIGIN=https://your-domain.example
```

## Main routes

- `/` — homepage/dashboard
- `/login.html` — Sign In / Create Account / Guest
- `/discover.html` — social discovery hub
- `/discover.html#match` — instant matching
- `/discover.html#topics` — topic rooms
- `/discover.html#communities` — communities
- `/Group-Chatroom.html` — existing global chat, groups and DMs
- `/call.html` — Jitsi call interface
- `/rooms/:slug` — SEO topic landing pages
- `/community/:slug` — SEO community landing pages
- `/voice/:roomKey` — age-gated temporary voice room entry
- `/admin` — moderation console
- `/health` — server status
- `/sitemap.xml` — dynamic SEO sitemap
- `/robots.txt` — crawler rules

## Important notification note

This build includes the notification center, real-time Socket.IO notifications, browser notifications and a service-worker `push` handler. **True closed-app server push delivery still requires a Web Push/FCM provider plus VAPID/push-subscription delivery configuration.** The project does not hard-code a third-party push private key.

## Smart Safety / AI note

The project includes a built-in Smart Safety fallback and extractive community summaries so it works without a paid AI API. It is intentionally not marketed in code as a guaranteed AI moderator. If you later connect an LLM moderation provider, keep the existing server-side rules as a fallback and never send private credentials to the browser.

## Deployment security

- Never commit `.env`.
- Never commit `firebase-service-account.json`.
- Rotate any MongoDB/Discord/admin secrets that were previously exposed.
- Use a restricted MongoDB Atlas user and production network controls.
- Keep `ALLOWED_ORIGIN` on your actual HTTPS domain instead of `*` for production.
- `meet.jit.si` is a public Jitsi deployment. For strict enterprise-grade call authorization, use a self-hosted/JWT-secured Jitsi setup.

## Validation

```bash
npm test
npm start
```

`npm test` currently performs syntax validation. Add automated API, Socket.IO and browser integration tests before a large public launch.

## UI

The base visual system is in `public/white-sky-ui.css`. Discover-specific White + Sky Blue components are in `public/social.css`.

## Admin registered email registry

Open `/mail.html` and authenticate with the same `PANEL_PASSWORD` used by the admin console. The page reads registered Firebase Authentication email accounts through the admin-only `/api/admin/emails` endpoint. If Firebase Admin is unavailable, it falls back to email addresses already synced to MongoDB `UserProfile` documents. Guest accounts never expose or require an email address.

## Visitor analytics

The public landing page records a privacy-preserving browser-level unique visitor in MongoDB and shows the live total beside Notifications. `public/analytics.html` provides date/week/month/year analytics. The backend routes are registered from `visitor-analytics.js` beside `server.js`; do not move that file into `public/`.

Routes:
- `POST /api/analytics/visit`
- `GET /api/analytics/summary`
- `GET /api/analytics/years`
- `GET /api/analytics/series`
