# Stranger 2 Stranger — Social V3 UX Update

## Message interactions

- A small `⋮` button is attached to every standard chat message.
- The old always/hover-visible reaction/action strip has been removed.
- The action menu is vertical and mobile-safe: Reply, React, Save, Forward, Pin/Unpin, Edit (own text), DM, Block/Unblock, and Delete when allowed.
- Double-click on desktop or double-tap on touch/Android opens the reaction picker.
- Supported quick reactions: ❤️ 😂 👍 😮 😢 🔥.
- Existing reaction counts stay visible as small chips under the message.

## Online Users

- Your own row displays `You`.
- Your own row is non-clickable and cannot open a DM.
- Other online rows have a Block/Unblock action.
- Blocked users are marked and cannot be opened in the legacy DM panel.

## Blocking

- Blocks are stored against Firebase UIDs.
- Blocking removes any accepted connection and existing backend DM access is refused while either account blocks the other.
- Smart Match already excludes blocked pairs.
- Mention/notification delivery now respects block relationships when `fromUid` is available.
- Optional `Hide blocked messages` setting hides their global/group message rows.
- `GET /api/social/blocks` returns current blocked accounts and the latest 100 block/unblock history entries.
- Every real block/unblock transition is recorded in the MongoDB `BlockHistory` collection.

## Settings center

The in-chat Settings drawer now has working controls for:

- Username and bio
- Presence: Online / Away / Busy / Invisible
- Custom status
- Chat theme
- Last-seen privacy
- Discoverability
- Enter-to-send
- Message timestamps
- Compact message mode
- Notification sound
- Desktop/browser notifications
- Hide blocked messages
- DM / connection / mention / group-invite notification preferences
- Larger text / reduced motion / high contrast
- Blocked Accounts with Unblock button
- Blocked Account History
- Export My Data
- Clear Local Drafts
- Revoke All Sessions

The new per-account chat preferences are persisted in `UserProfile.chatSettings`.
