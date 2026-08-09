# Repair Summary

This build was cleaned from the supplied Stranger-2-Stranger archive.

## Critical fixes
- Removed embedded MongoDB credentials.
- Removed embedded Discord webhook URLs.
- Removed the hard-coded admin password from browser JavaScript.
- Made Firebase authentication mandatory by default for chat joins.
- Replaced username-based admin trust with Firebase UID allowlisting.
- Protected message deletion with owner/admin authorization.
- Sanitized group-list responses and bcrypt-hashed group passwords.
- Protected group messaging/deletion by membership/ownership.
- Protected session lookup/admin APIs.

## Consistency fixes
- Added MongoDB-backed profile GET/PUT APIs.
- Added missing live-announcement endpoint.
- Fixed announcement object rendering.
- Fixed admin single-message delete endpoint mismatch.
- Fixed iframe group-chat route filename.
- Removed duplicate Socket.IO handlers and duplicate report form IDs.
- Added group UI wiring, group typing and owner/admin delete control.
- Replaced fabricated homepage activity and online count with real health data.
- Moved service worker to the served public directory.
- Generated valid 192x192 and 512x512 PWA icons.
- Removed incompatible legacy rooms/copies and unused scripts.
- Reduced package.json to direct runtime dependencies.

## Data safety changes
- Global message IDs now come from MongoDB before broadcast.
- Reply/caption fields are persisted.
- Media payloads are type/size validated.
- DM history is bounded to prevent unlimited single-document growth.

See README.md for deployment configuration and remaining production-scale recommendations.
