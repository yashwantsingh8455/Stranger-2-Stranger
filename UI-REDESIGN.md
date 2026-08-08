# White + Sky Blue UI Redesign

This build keeps the existing authentication, guest, chat, group, DM, moderation and call behavior while replacing the old dark/neon presentation with a cleaner production-style visual system.

## Visual system
- White primary surfaces
- Sky blue primary actions (`#0EA5E9`)
- Soft blue supporting backgrounds
- Neutral slate typography
- 1px subtle borders
- Low-intensity shadows
- Consistent form focus states
- Cleaner mobile layouts and touch targets
- System UI typography for a more natural app feel

## Updated surfaces
- Home/dashboard
- Login / account creation / guest access
- Group chat
- DM and member panels
- Admin console
- Voice/video call lobby and controls
- Group chat iframe/FAQ page
- Contact form
- PWA theme/background colors

The shared visual layer lives in `public/white-sky-ui.css` and is loaded after legacy page styles to preserve the JavaScript and element IDs used by the application.
