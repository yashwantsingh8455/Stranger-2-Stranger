# Stranger 2 Stranger — Social V2 Feature Matrix

## ✅ Implemented in this build

### Matching & discovery
- Smart Match compatibility scoring using interests, languages, selected topics, country and timezone.
- Configurable match filters: language, interest, same-country and timezone.
- Random temporary 1-to-1 match queue.
- Skip / Next Stranger.
- Match-session temporary chat and typing.
- Interest/language/topic tags and discoverability controls.

### Connections & privacy
- Connection/friend request, accept/decline/remove.
- Received/sent pending requests.
- Permanent connection-only DMs.
- Block and mute controls.
- Reputation score, XP, levels, streak and badges.
- Verified state derived from verified account identity.
- Account-age information in public profile data.
- Online / away / busy / invisible presence.
- Custom status.
- Everyone / Connections / Nobody last-seen privacy.

### Messaging
- Emoji reactions.
- Limited-time message editing enforced server-side.
- Pin/unpin with permissions.
- Save/star personal messages with free/premium quotas.
- Permission-aware message search.
- Unread DM/notification counters.
- Delivered/read metadata and read receipts.
- Safe forwarding metadata.
- Temporary-message expiry metadata and cleanup.
- Per-room local drafts.
- Voice-note waveform UI.
- Image preview/compression before upload.
- Permission-aware media gallery.
- Bounded image/video/audio/PDF/TXT/Office-file sharing with MIME allowlist.
- Outbound-link confirmation.

### Groups / communities
- Owner, Admin, Moderator and Member roles.
- Expiring invite links.
- Public/private groups.
- Join-approval queue with approve/decline UI.
- Description, category and rules.
- Poll creation, voting and result counts.
- Scheduled group events.
- Announcements-only mode.
- Slow mode.
- Collaborative notes.
- Creator/community flag.
- Branding fields (accent/banner) with management UI.
- Member role management by owner.
- Trending/discovery ranking using online/member activity.

### Safety & moderation
- Spam/duplicate/rate-limit protections.
- Heuristic suspicious-link/excessive-mention/repetition moderation flags.
- Categorized reports.
- Central moderator review queue.
- Appeal submission and admin review.
- Warning history.
- Safety Center.
- Moderator/admin audit logs.
- Private-group/message permission checks.
- Email verification required by default.
- Firebase UID-based privileged authorization.

### AI/helper tools
- Conversation-starter generator.
- Message language detection.
- Conversation summary helper.
- Moderation scoring/flag explanations.
- Translation endpoint/provider hook.

### Engagement & productivity
- Daily question/discussion prompt.
- XP/activity points.
- Profile levels and badges.
- Daily streak.
- Leaderboard based on XP/reputation rather than raw spam count.
- Rock Paper Scissors.
- Quiz.
- Tic-Tac-Toe.
- Pomodoro/study timer.

### Calls
- Authenticated call page/lobby.
- Mic/camera/screen-share controls.
- Device selection for microphone/camera/output where supported.
- Raise hand.
- Participant limit guard.
- Moderator host actions such as mute-all/end conference where permission exists.
- Group call chat and call-DM features retained from the repaired build.

### UX / PWA / profile
- In-app realtime notifications + preferences.
- PWA install prompt.
- Offline read cache/static app shell; API/socket responses are never service-worker cached.
- Responsive mobile bottom navigation.
- Profile banner/color, chat themes and avatar frames.
- Premium animated avatar frames.
- Accessibility: larger text, reduced motion and high contrast.

### Admin / account
- Admin analytics dashboard: online, 24h active users, users, messages, reports, groups, connections, appeals, growth and server health.
- Moderation analytics/report categories/AI-flag view.
- User growth/activity charts.
- Report/appeal actions.
- Account data export/delete.
- Session list and revoke-all sessions.
- Username-change cooldown.
- Firebase account recovery/password-reset flow retained.
- Premium/creator entitlement state and admin grant endpoint.
- Higher premium saved-message quota.
- No advertising code is included in this build.

## ⚙️ Infrastructure/provider dependent

These are wired safely but need real external infrastructure before they can be called fully production-complete:

- **AI Translation:** set `TRANSLATION_API_URL` and optional `TRANSLATION_API_KEY`. Without a provider the API returns a clear configuration error rather than pretending to translate.
- **Premium billing/checkout:** entitlement enforcement exists; payment collection/webhooks are intentionally not fabricated. Connect a real billing provider and update entitlements only after verified server-side payment events.
- **Push notifications while the web app is completely closed:** needs Web Push subscription/keys/delivery infrastructure. Current build provides realtime in-app notifications and preferences.
- **Large media / extra media-storage tiers:** current messages use strict bounded payloads. Add object storage and retain only URLs/metadata in MongoDB for production scale.
- **Strict meeting-level private Jitsi access:** needs your own appropriately secured/JWT-enabled Jitsi deployment. The current app still requires a verified Stranger 2 Stranger session to enter its call UI.

## Security note

Rotate every credential that was present in the original source archive. This V2 ZIP intentionally contains placeholders only and should be configured through environment variables.
