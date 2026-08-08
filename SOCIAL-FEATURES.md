# Social Discovery Feature Map

## Discover
`public/discover.html` is the main entry point. It loads `/api/social/bootstrap` and opens the `/social` Socket.IO namespace.

## Matchmaking
- Same age band only
- Shared-interest scoring
- Temporary session durations
- Conversation starters
- Server-side expiry
- Match message content cleared on end/expiry
- Recent match metadata + Match Again

## Topic rooms
- `/rooms/coding`
- `/rooms/study`
- `/rooms/gaming`
- `/rooms/movies`
- `/rooms/music`
- `/rooms/anime`
- `/rooms/sports`
- `/rooms/india`
- `/rooms/teen-lounge`
- `/rooms/adult-lounge`

Topic rooms support real-time messages, reactions, polls, presence and shareable SEO landing pages.

## Communities
Communities support:
- Join/create
- Chat
- Reactions
- Pins
- Polls
- Threads/replies
- Events/RSVP
- Voice room creation
- Summary
- Shareable `/community/:slug` page

## Safety
- Server-issued guest sessions
- Same-age matching
- Teen/adult DM boundary
- DM privacy policies
- Block / mute / report
- Spam/rate checks
- Scam-like and abusive-text Smart Safety checks
- Temporary messaging restriction after repeated blocked content
- Voice-room age gate

## Retention
- Daily question
- Daily streak
- Achievements
- Reputation
- Friends
- Notifications
- Trending rooms
- Recent conversations

## Growth / SEO
- Shareable topic pages
- Shareable community pages
- Sitemap
- Robots file
- PWA install shortcuts

## External-service caveats
- Firebase is optional for account mode; Guest mode requires MongoDB.
- Jitsi uses `meet.jit.si`.
- Closed-app push needs a Web Push/FCM provider and VAPID configuration; current build includes the UI, notification center, active-browser alerts and service-worker push receiver only.
- Smart Safety and summaries work locally without a paid AI API.
