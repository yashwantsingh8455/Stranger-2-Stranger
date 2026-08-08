# Repair + Guest Authentication Summary

## Guest authentication added
- Firebase login is now optional.
- Added Guest tab to login screen.
- Guest creation uses username + country + DOB.
- Added server-side age validation (13+).
- Added MongoDB-backed GuestUser records.
- Added random guest ID + high-entropy session token.
- Guest token is stored only as a SHA-256 hash server-side.
- Exact DOB is validated but not persisted; only an age-verification timestamp is stored.
- Added guest session resume, guest profile GET/PUT and explicit guest logout.
- Explicit guest logout deletes the temporary identity so its username can be reused.
- Global chat and Jitsi call page now accept Firebase or Guest sessions.
- Guests can never become admins; admin privileges remain Firebase UID based.

## Previous critical repairs retained
- Removed embedded MongoDB credentials and Discord webhook URLs.
- Removed hard-coded client-side admin password.
- Replaced username-based admin trust with Firebase UID allowlisting.
- Protected message deletion with owner/admin authorization.
- Sanitized group-list responses and bcrypt-hashed group passwords.
- Protected group messaging/deletion by membership/ownership.
- Protected session lookup/admin APIs.
- Added MongoDB-backed Firebase profiles.
- Added missing live-announcement endpoint.
- Replaced fabricated homepage activity/online counts with real health data.
- Fixed PWA assets/service worker and removed incompatible legacy room copies.

## White + Sky Blue UI redesign
- Added a shared `public/white-sky-ui.css` product theme.
- Reworked Home, Login/Register/Guest, Group Chat, Admin, Call, iframe/FAQ and Contact surfaces.
- Replaced dark/neon/glow-heavy presentation with white surfaces, sky-blue actions, subtle borders and restrained shadows.
- Standardized typography to a system UI stack for a more natural production-app feel.
- Kept functional element IDs and JavaScript flows unchanged.
- Locked the visible appearance to the White Sky design even if an older theme value exists in local storage.
