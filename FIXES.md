/* Stranger 2 Stranger — White + Sky Blue product UI
   Central visual layer. Functional JS and IDs are intentionally untouched. */

:root,
html[data-theme="dark"],
html[data-theme="light"],
html[data-theme="amoled"],
html[data-theme="ocean"],
html[data-theme="forest"] {
  --sky-50: #f0f9ff;
  --sky-100: #e0f2fe;
  --sky-200: #bae6fd;
  --sky-300: #7dd3fc;
  --sky-400: #38bdf8;
  --sky-500: #0ea5e9;
  --sky-600: #0284c7;
  --sky-700: #0369a1;
  --ink: #0f172a;
  --ink-2: #334155;
  --muted-ui: #64748b;
  --line: #dbe7f0;
  --line-strong: #c7d7e4;
  --canvas: #f7fbfe;
  --surface-ui: #ffffff;
  --soft: #f3f8fc;
  --danger-ui: #dc2626;
  --success-ui: #16a34a;
  --warning-ui: #d97706;

  /* Existing app token compatibility */
  --bg: #f7fbfe !important;
  --surface: #ffffff !important;
  --surface2: #f3f8fc !important;
  --surface3: #eaf5fb !important;
  --card: #ffffff !important;
  --navbar: rgba(255,255,255,.96) !important;
  --sidebar: #ffffff !important;
  --panel: #ffffff !important;
  --input: #f8fbfd !important;
  --input-bg: #f8fbfd !important;
  --border: #dbe7f0 !important;
  --border2: #c7d7e4 !important;
  --accent: #0ea5e9 !important;
  --accent2: #0284c7 !important;
  --accent3: #22c55e !important;
  --primary: #0ea5e9 !important;
  --primary-h: #0284c7 !important;
  --green: #22c55e !important;
  --danger: #dc2626 !important;
  --warn: #d97706 !important;
  --purple: #6366f1 !important;
  --success: #16a34a !important;
  --text: #0f172a !important;
  --text-2: #475569 !important;
  --text-3: #64748b !important;
  --text-muted: #64748b !important;
  --muted: #64748b !important;
  --me-bg: #e0f2fe !important;
  --me-bdr: #7dd3fc !important;
  --other-bg: #ffffff !important;
  --other-bdr: #dbe7f0 !important;
  --glow: rgba(14,165,233,.14) !important;
  --overlay: rgba(15,23,42,.34) !important;
  --shadow: 0 10px 28px rgba(15,23,42,.09) !important;
  --shadow-lg: 0 22px 55px rgba(15,23,42,.12) !important;
}

* { -webkit-tap-highlight-color: transparent; }
html { background: var(--canvas) !important; }
body {
  background: var(--canvas) !important;
  color: var(--ink) !important;
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}
body::before,
body::after { filter: none !important; }
::selection { background: var(--sky-200); color: var(--ink); }

input, textarea, select, button { font: inherit; }
input, textarea, select {
  background: #fff !important;
  color: var(--ink) !important;
  border-color: var(--line) !important;
  box-shadow: none !important;
}
input::placeholder, textarea::placeholder { color: #94a3b8 !important; opacity: 1 !important; }
input:focus, textarea:focus, select:focus {
  outline: none !important;
  border-color: var(--sky-400) !important;
  box-shadow: 0 0 0 3px rgba(14,165,233,.12) !important;
}
a { color: var(--sky-600); }

/* =========================================================
   HOME / DASHBOARD
   ========================================================= */
body.s2s-home {
  background:
    radial-gradient(circle at 90% 0%, rgba(125,211,252,.22), transparent 34rem),
    linear-gradient(#ffffff 0 18rem, #f7fbfe 38rem) !important;
  min-height: 100vh;
}
.s2s-home #loading-screen { background:#fff !important; }
.s2s-home .load-spinner { border-color:var(--sky-100) !important; border-top-color:var(--sky-500) !important; box-shadow:none !important; }
.s2s-home .logo-text-load,
.s2s-home .logo-text,
.s2s-home .brand-name { color:var(--ink) !important; font-family:inherit !important; -webkit-text-fill-color:initial !important; background:none !important; }
.s2s-home .logo-text span,
.s2s-home .logo-text-load span { color:var(--sky-500) !important; }
.s2s-home .navbar {
  height: 68px !important;
  background: rgba(255,255,255,.94) !important;
  border-bottom:1px solid rgba(203,213,225,.7) !important;
  box-shadow:0 1px 12px rgba(15,23,42,.04) !important;
  backdrop-filter: blur(12px) !important;
}
.s2s-home .logo-icon {
  background:var(--sky-50) !important;
  color:var(--sky-600) !important;
  border:1px solid var(--sky-200) !important;
  box-shadow:none !important;
  border-radius:12px !important;
}
.s2s-home .nav-links a,
.s2s-home .nav-dropdown-btn { color:var(--ink-2) !important; background:transparent !important; }
.s2s-home .nav-links a:hover,
.s2s-home .nav-links a.active,
.s2s-home .nav-dropdown-btn:hover { color:var(--sky-700) !important; background:var(--sky-50) !important; }
.s2s-home .nav-dropdown-menu,
.s2s-home .profile-dropdown {
  background:#fff !important;
  border:1px solid var(--line) !important;
  box-shadow:0 18px 45px rgba(15,23,42,.12) !important;
  border-radius:14px !important;
}
.s2s-home .notif-btn,
.s2s-home .profile-btn,
.s2s-home .hamburger {
  background:#fff !important;
  border:1px solid var(--line) !important;
  color:var(--ink-2) !important;
  box-shadow:none !important;
}
.s2s-home .notif-btn:hover,
.s2s-home .profile-btn:hover,
.s2s-home .hamburger:hover { border-color:var(--sky-300) !important; background:var(--sky-50) !important; }
.s2s-home .profile-avatar,
.s2s-home .profile-big-avatar,
.s2s-home .activity-avatar { background:var(--sky-100) !important; color:var(--sky-700) !important; border-color:var(--sky-200) !important; }
.s2s-home .mobile-sidebar {
  background:#fff !important;
  border-right:1px solid var(--line) !important;
  box-shadow:20px 0 50px rgba(15,23,42,.10) !important;
}
.s2s-home .mobile-sidebar a { color:var(--ink-2) !important; }
.s2s-home .mobile-sidebar a:hover { background:var(--sky-50) !important; color:var(--sky-700) !important; }
.s2s-home .main-wrap { max-width:1120px !important; padding-top:58px !important; }
.s2s-home .hero { max-width:780px !important; margin:0 auto 38px !important; text-align:center !important; }
.s2s-home .hero h1 {
  font-family:inherit !important;
  color:var(--ink) !important;
  font-size:clamp(2.35rem,5vw,4.25rem) !important;
  line-height:1.04 !important;
  letter-spacing:-.055em !important;
  font-weight:800 !important;
  text-shadow:none !important;
}
.s2s-home .gradient-text {
  color:var(--sky-600) !important;
  background:none !important;
  -webkit-background-clip:initial !important;
  -webkit-text-fill-color:initial !important;
}
.s2s-home .hero p { color:var(--muted-ui) !important; font-size:1.02rem !important; line-height:1.7 !important; max-width:630px !important; margin:20px auto 0 !important; }
.s2s-home .stats-bar {
  background:#fff !important;
  border:1px solid var(--line) !important;
  border-radius:18px !important;
  box-shadow:0 8px 28px rgba(15,23,42,.06) !important;
  overflow:hidden !important;
}
.s2s-home .stat-item { border-color:#edf2f7 !important; }
.s2s-home .stat-item .num { color:var(--ink) !important; font-weight:750 !important; }
.s2s-home .stat-item .lbl { color:var(--muted-ui) !important; }
.s2s-home .status-dot { background:#22c55e !important; box-shadow:0 0 0 3px rgba(34,197,94,.12) !important; }
.s2s-home .live-ticker {
  background:#fff !important;
  border:1px solid var(--line) !important;
  border-radius:14px !important;
  box-shadow:none !important;
}
.s2s-home .ticker-label { background:var(--sky-50) !important; color:var(--sky-700) !important; border-right:1px solid var(--sky-100) !important; }
.s2s-home .ticker-item { color:var(--ink-2) !important; }
.s2s-home .section-title { color:var(--ink) !important; font-family:inherit !important; font-weight:750 !important; letter-spacing:-.02em !important; }
.s2s-home .rooms-grid { gap:16px !important; }
.s2s-home .room-card {
  background:#fff !important;
  border:1px solid var(--line) !important;
  border-radius:18px !important;
  box-shadow:0 6px 22px rgba(15,23,42,.045) !important;
  transform:none !important;
}
.s2s-home .room-card:hover { border-color:var(--sky-300) !important; box-shadow:0 14px 30px rgba(14,165,233,.10) !important; transform:translateY(-2px) !important; }
.s2s-home .room-card::before { display:none !important; }
.s2s-home .room-icon-wrap { background:var(--sky-50) !important; color:var(--sky-600) !important; border:1px solid var(--sky-100) !important; box-shadow:none !important; }
.s2s-home .room-name { color:var(--ink) !important; }
.s2s-home .room-desc,
.s2s-home .room-users { color:var(--muted-ui) !important; }
.s2s-home .room-status { background:var(--sky-50) !important; color:var(--sky-700) !important; border-color:var(--sky-200) !important; }
.s2s-home .badge.live { background:#ecfdf5 !important; color:#15803d !important; border:1px solid #bbf7d0 !important; }
.s2s-home .badge.soon { background:#f8fafc !important; color:#64748b !important; border:1px solid var(--line) !important; }
.s2s-home .activity-feed,
.s2s-home .modal,
.s2s-home .photo-preview,
.s2s-home .theme-card {
  background:#fff !important;
  border-color:var(--line) !important;
  box-shadow:0 16px 42px rgba(15,23,42,.09) !important;
}
.s2s-home .activity-item { border-color:#edf2f7 !important; }
.s2s-home .activity-text { color:var(--ink-2) !important; }
.s2s-home .activity-time { color:#94a3b8 !important; }
.s2s-home .modal-overlay { background:rgba(15,23,42,.28) !important; backdrop-filter:blur(4px) !important; }
.s2s-home .modal-header { border-color:var(--line) !important; color:var(--ink) !important; }
.s2s-home .modal-close { background:#f8fafc !important; color:var(--muted-ui) !important; border:1px solid var(--line) !important; }
.s2s-home .modal-save-btn,
.s2s-home .photo-btn { background:var(--sky-500) !important; color:#fff !important; border:none !important; box-shadow:none !important; }
.s2s-home .modal-save-btn:hover,
.s2s-home .photo-btn:hover { background:var(--sky-600) !important; }
.s2s-home .pd-item:hover { background:var(--sky-50) !important; }
.s2s-home .pd-item-icon { background:var(--sky-50) !important; color:var(--sky-600) !important; }
.s2s-home .user-badge-tag { background:var(--sky-50) !important; color:var(--sky-700) !important; border:1px solid var(--sky-200) !important; }
.s2s-home .theme-grid { grid-template-columns:1fr !important; }
.s2s-home .theme-card { display:none !important; }
.s2s-home #tc-light { display:block !important; border-color:var(--sky-300) !important; }
.s2s-home .toast { background:#fff !important; color:var(--ink) !important; border:1px solid var(--line) !important; box-shadow:0 12px 30px rgba(15,23,42,.12) !important; }

/* =========================================================
   LOGIN / REGISTER / GUEST
   ========================================================= */
body.s2s-login {
  min-height:100vh !important;
  background:
    radial-gradient(circle at 15% 12%, rgba(186,230,253,.62), transparent 25rem),
    radial-gradient(circle at 92% 90%, rgba(224,242,254,.75), transparent 30rem),
    #f8fcff !important;
}
.s2s-login .wrapper { max-width:430px !important; }
.s2s-login .brand { margin-bottom:22px !important; }
.s2s-login .brand-icon {
  width:52px !important; height:52px !important;
  border-radius:14px !important;
  background:#fff !important;
  color:var(--sky-600) !important;
  border:1px solid var(--sky-200) !important;
  box-shadow:0 8px 20px rgba(14,165,233,.10) !important;
}
.s2s-login .brand-name {
  font-family:inherit !important;
  color:var(--ink) !important;
  font-size:21px !important;
  letter-spacing:-.03em !important;
}
.s2s-login .brand-name span { color:var(--sky-500) !important; }
.s2s-login .brand-sub { color:var(--muted-ui) !important; }
.s2s-login .card {
  background:#fff !important;
  border:1px solid var(--line) !important;
  border-radius:18px !important;
  padding:28px !important;
  box-shadow:0 20px 50px rgba(15,23,42,.09) !important;
}
.s2s-login .tabs { background:#f1f7fb !important; border:1px solid #e4eef5 !important; border-radius:12px !important; padding:4px !important; }
.s2s-login .tab { color:var(--muted-ui) !important; border-radius:9px !important; }
.s2s-login .tab.active { background:#fff !important; color:var(--sky-700) !important; box-shadow:0 2px 9px rgba(15,23,42,.07) !important; border:1px solid #dce9f1 !important; }
.s2s-login .field label { color:#475569 !important; text-transform:none !important; letter-spacing:0 !important; font-size:12.5px !important; }
.s2s-login .input-wrap input,
.s2s-login .input-wrap select {
  background:#fff !important;
  border:1px solid var(--line) !important;
  border-radius:10px !important;
  padding-top:12px !important; padding-bottom:12px !important;
}
.s2s-login .input-wrap input[type="date"] { color-scheme:light !important; }
.s2s-login .input-wrap .fi,
.s2s-login .eye-btn { color:#94a3b8 !important; }
.s2s-login .btn {
  background:var(--sky-500) !important;
  color:#fff !important;
  border:none !important;
  border-radius:10px !important;
  box-shadow:0 7px 16px rgba(14,165,233,.18) !important;
}
.s2s-login .btn:hover { background:var(--sky-600) !important; transform:translateY(-1px) !important; }
.s2s-login .forgot,
.s2s-login .back-link,
.s2s-login .resend-link { color:var(--sky-600) !important; }
.s2s-login .guest-note { background:var(--sky-50) !important; border:1px solid var(--sky-100) !important; color:#475569 !important; }
.s2s-login .guest-note strong { color:var(--ink) !important; }
.s2s-login .divider::before,
.s2s-login .divider::after { background:var(--line) !important; }
.s2s-login .alert.show-error { background:#fff1f2 !important; color:#b91c1c !important; border-color:#fecdd3 !important; }
.s2s-login .alert.show-success { background:#f0fdf4 !important; color:#15803d !important; border-color:#bbf7d0 !important; }
.s2s-login .email-sent-icon { background:var(--sky-50) !important; color:var(--sky-600) !important; box-shadow:none !important; }

/* =========================================================
   MAIN CHAT
   ========================================================= */
body.s2s-chat { background:#f4f9fc !important; }
.s2s-chat #loginOverlay { background:rgba(247,251,254,.98) !important; }
.s2s-chat .login-card { background:#fff !important; border:1px solid var(--line) !important; box-shadow:0 18px 45px rgba(15,23,42,.10) !important; }
.s2s-chat .login-logo { background:none !important; -webkit-text-fill-color:var(--sky-600) !important; color:var(--sky-600) !important; font-family:inherit !important; }
.s2s-chat .topbar {
  height:58px !important;
  background:#fff !important;
  border-bottom:1px solid var(--line) !important;
  box-shadow:0 1px 10px rgba(15,23,42,.04) !important;
  padding:0 18px !important;
}
.s2s-chat .topbar-logo { color:var(--ink) !important; font-family:inherit !important; -webkit-text-fill-color:initial !important; background:none !important; font-weight:800 !important; letter-spacing:-.025em !important; }
.s2s-chat .topbar-room { color:var(--muted-ui) !important; }
.s2s-chat .icon-btn,
.s2s-chat .mob-btn,
.s2s-chat .logout-btn-top {
  background:#fff !important;
  border:1px solid var(--line) !important;
  color:#475569 !important;
  box-shadow:none !important;
  border-radius:10px !important;
}
.s2s-chat .icon-btn:hover,
.s2s-chat .mob-btn:hover { background:var(--sky-50) !important; color:var(--sky-700) !important; border-color:var(--sky-200) !important; }
.s2s-chat .main { background:#f4f9fc !important; }
.s2s-chat .sidebar,
.s2s-chat .dm-sidebar {
  background:#fff !important;
  border-color:var(--line) !important;
}
.s2s-chat .sidebar-header,
.s2s-chat .dm-sidebar-header { border-color:var(--line) !important; }
.s2s-chat .count-chip,
.s2s-chat .online-badge { background:#ecfdf5 !important; color:#15803d !important; border:1px solid #bbf7d0 !important; }
.s2s-chat .user-item,
.s2s-chat .dm-user-item { border-color:transparent !important; border-radius:11px !important; }
.s2s-chat .user-item:hover,
.s2s-chat .dm-user-item:hover,
.s2s-chat .dm-user-item.active { background:var(--sky-50) !important; }
.s2s-chat .user-avatar,
.s2s-chat .dm-user-avatar,
.s2s-chat .msg-avatar { background:var(--sky-100) !important; color:var(--sky-700) !important; border:1px solid var(--sky-200) !important; }
.s2s-chat .user-name,
.s2s-chat .dm-user-name,
.s2s-chat .dm-chat-header-name { color:var(--ink) !important; }
.s2s-chat .user-bio,
.s2s-chat .dm-user-preview,
.s2s-chat .dm-chat-header-status { color:var(--muted-ui) !important; }
.s2s-chat .chat-area,
.s2s-chat .dm-chat-area { background:#f8fbfd !important; }
.s2s-chat .chat-window,
.s2s-chat .dm-messages { background:#f8fbfd !important; }
.s2s-chat .msg-row { margin-bottom:4px !important; }
.s2s-chat .msg-bubble {
  background:#fff !important;
  border:1px solid var(--line) !important;
  color:var(--ink) !important;
  box-shadow:0 2px 8px rgba(15,23,42,.035) !important;
  border-radius:4px 14px 14px 14px !important;
}
.s2s-chat .msg-row.me .msg-bubble,
.s2s-chat .me .msg-bubble {
  background:var(--sky-100) !important;
  border-color:var(--sky-200) !important;
  color:#0c4a6e !important;
  border-radius:14px 4px 14px 14px !important;
}
.s2s-chat .msg-sender { color:var(--sky-700) !important; }
.s2s-chat .msg-time { color:#94a3b8 !important; }
.s2s-chat .msg-actions { background:#fff !important; border:1px solid var(--line) !important; box-shadow:0 8px 20px rgba(15,23,42,.08) !important; }
.s2s-chat .msg-action-btn { color:#64748b !important; }
.s2s-chat .msg-action-btn:hover { background:var(--sky-50) !important; color:var(--sky-700) !important; }
.s2s-chat .reply-block { background:#f1f7fb !important; border-left:3px solid var(--sky-400) !important; color:#475569 !important; }
.s2s-chat .history-divider { color:#94a3b8 !important; }
.s2s-chat .history-divider::before,
.s2s-chat .history-divider::after { background:var(--line) !important; }
.s2s-chat .input-area,
.s2s-chat .dm-input-area { background:#fff !important; border-top:1px solid var(--line) !important; box-shadow:0 -2px 10px rgba(15,23,42,.025) !important; }
.s2s-chat .input-box,
.s2s-chat .dm-input-box { background:#f8fbfd !important; border:1px solid var(--line) !important; border-radius:14px !important; }
.s2s-chat .input-box:focus-within,
.s2s-chat .dm-input-box:focus-within { border-color:var(--sky-400) !important; box-shadow:0 0 0 3px rgba(14,165,233,.10) !important; }
.s2s-chat .input-icon-btn,
.s2s-chat .emoji-btn { color:#64748b !important; }
.s2s-chat .input-icon-btn:hover,
.s2s-chat .emoji-btn:hover { background:var(--sky-50) !important; color:var(--sky-700) !important; }
.s2s-chat .send-btn,
.s2s-chat .send { background:var(--sky-500) !important; color:#fff !important; box-shadow:none !important; }
.s2s-chat .send-btn:hover,
.s2s-chat .send:hover { background:var(--sky-600) !important; }
.s2s-chat .emoji-grid,
.s2s-chat .gif-grid,
.s2s-chat .drawer-body,
.s2s-chat .modal,
.s2s-chat .page-content { background:#fff !important; border-color:var(--line) !important; color:var(--ink) !important; box-shadow:0 18px 45px rgba(15,23,42,.12) !important; }
.s2s-chat .emoji-tabs,
.s2s-chat .drawer-header,
.s2s-chat .page-header { border-color:var(--line) !important; background:#fff !important; }
.s2s-chat .emoji-tab.active { color:var(--sky-700) !important; border-color:var(--sky-400) !important; }
.s2s-chat .gif-search-bar { background:#fff !important; }
.s2s-chat .gif-search-btn,
.s2s-chat .drawer-save,
.s2s-chat .submit-report-btn,
.s2s-chat .modal-btn.send { background:var(--sky-500) !important; color:#fff !important; }
.s2s-chat .drawer-input { background:#fff !important; }
.s2s-chat .drawer-label { color:#475569 !important; }
.s2s-chat .modal-overlay,
.s2s-chat .sidebar-backdrop { background:rgba(15,23,42,.28) !important; backdrop-filter:blur(3px) !important; }
.s2s-chat .dm-chat-header { background:#fff !important; border-color:var(--line) !important; }
.s2s-chat .dm-chat-placeholder { color:#94a3b8 !important; }
.s2s-chat .sys-msg { color:#64748b !important; background:transparent !important; }
.s2s-chat .mention-hint { background:#fff !important; border:1px solid var(--line) !important; box-shadow:0 12px 28px rgba(15,23,42,.10) !important; }
.s2s-chat .mention-item:hover { background:var(--sky-50) !important; }

/* =========================================================
   ADMIN PANEL
   ========================================================= */
body.s2s-admin {
  background:#f5fafe !important;
  font-family:Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}
.s2s-admin::after { display:none !important; }
.s2s-admin #loginScreen { background:#f5fafe !important; }
.s2s-admin .login-box {
  background:#fff !important;
  border:1px solid var(--line) !important;
  border-radius:16px !important;
  box-shadow:0 18px 45px rgba(15,23,42,.10) !important;
}
.s2s-admin .login-box h1 { color:var(--ink) !important; font-family:inherit !important; letter-spacing:-.02em !important; }
.s2s-admin .login-box p { color:var(--muted-ui) !important; }
.s2s-admin .login-box button { background:var(--sky-500) !important; color:#fff !important; border-radius:10px !important; }
.s2s-admin .topbar {
  background:#fff !important;
  border-bottom:1px solid var(--line) !important;
  box-shadow:0 1px 10px rgba(15,23,42,.04) !important;
}
.s2s-admin .logo { color:var(--ink) !important; font-family:inherit !important; letter-spacing:-.01em !important; font-weight:800 !important; }
.s2s-admin .logo span { color:var(--muted-ui) !important; }
.s2s-admin .pill { border-radius:999px !important; font-family:inherit !important; font-weight:650 !important; }
.s2s-admin .pill.green { color:#15803d !important; border-color:#bbf7d0 !important; background:#f0fdf4 !important; }
.s2s-admin .pill.blue { color:var(--sky-700) !important; border-color:var(--sky-200) !important; background:var(--sky-50) !important; }
.s2s-admin .pill.red { color:#b91c1c !important; border-color:#fecdd3 !important; background:#fff1f2 !important; }
.s2s-admin .online-count { color:var(--sky-700) !important; font-family:inherit !important; }
.s2s-admin .refresh-btn { background:#fff !important; border-color:var(--line) !important; color:#475569 !important; border-radius:9px !important; }
.s2s-admin .sidebar { background:#fff !important; border-right:1px solid var(--line) !important; }
.s2s-admin .nav-item { color:#475569 !important; border-radius:10px !important; font-family:inherit !important; }
.s2s-admin .nav-item:hover { background:var(--sky-50) !important; color:var(--sky-700) !important; }
.s2s-admin .nav-item.active { background:var(--sky-50) !important; color:var(--sky-700) !important; border-left-color:var(--sky-500) !important; }
.s2s-admin .nav-badge { background:#e2e8f0 !important; color:#475569 !important; }
.s2s-admin .main,
.s2s-admin .content { background:#f5fafe !important; }
.s2s-admin .section-title { color:var(--ink) !important; font-family:inherit !important; letter-spacing:-.015em !important; }
.s2s-admin .section-title span { color:var(--sky-500) !important; }
.s2s-admin .stat-card {
  background:#fff !important;
  border:1px solid var(--line) !important;
  border-radius:14px !important;
  box-shadow:0 5px 18px rgba(15,23,42,.04) !important;
}
.s2s-admin .stat-card::before { background:var(--sky-400) !important; }
.s2s-admin .stat-value { color:var(--ink) !important; font-family:inherit !important; }
.s2s-admin .stat-label,
.s2s-admin .stat-sub { color:var(--muted-ui) !important; }
.s2s-admin .quick-actions,
.s2s-admin .table-wrap,
.s2s-admin .intel-section,
.s2s-admin .announce-box,
.s2s-admin .modal {
  background:#fff !important;
  border:1px solid var(--line) !important;
  box-shadow:0 7px 22px rgba(15,23,42,.05) !important;
  border-radius:14px !important;
}
.s2s-admin table,
.s2s-admin th,
.s2s-admin td { border-color:#edf2f7 !important; }
.s2s-admin th { background:#f8fbfd !important; color:#64748b !important; font-family:inherit !important; }
.s2s-admin td { color:#334155 !important; }
.s2s-admin tr:hover td { background:var(--sky-50) !important; }
.s2s-admin .search-bar input,
.s2s-admin .form-input { background:#fff !important; border-color:var(--line) !important; color:var(--ink) !important; border-radius:9px !important; }
.s2s-admin .btn { border-radius:9px !important; font-family:inherit !important; box-shadow:none !important; }
.s2s-admin .btn-info,
.s2s-admin .btn-success { background:var(--sky-500) !important; color:#fff !important; border-color:var(--sky-500) !important; }
.s2s-admin .btn-ghost { background:#fff !important; color:#475569 !important; border-color:var(--line) !important; }
.s2s-admin .btn-purple { background:#6366f1 !important; color:#fff !important; }
.s2s-admin .modal-overlay { background:rgba(15,23,42,.30) !important; backdrop-filter:blur(4px) !important; }
.s2s-admin .modal-head { border-color:var(--line) !important; color:var(--ink) !important; }
.s2s-admin .modal-close { color:#64748b !important; }
.s2s-admin .mobile-nav { background:#fff !important; border-top:1px solid var(--line) !important; box-shadow:0 -5px 20px rgba(15,23,42,.06) !important; }
.s2s-admin .mob-nav-item { color:#64748b !important; }
.s2s-admin .mob-nav-item.active { color:var(--sky-600) !important; }
.s2s-admin .toast { background:#fff !important; color:var(--ink) !important; border-color:var(--line) !important; box-shadow:0 12px 28px rgba(15,23,42,.12) !important; }

/* =========================================================
   CALL / VIDEO ROOM
   ========================================================= */
body.s2s-call { background:#f5fafe !important; }
.s2s-call #lobby { background:linear-gradient(135deg,#f7fcff,#eef8fd) !important; }
.s2s-call .lobby-wrap {
  background:#fff !important;
  border:1px solid var(--line) !important;
  border-radius:20px !important;
  box-shadow:0 22px 55px rgba(15,23,42,.10) !important;
  overflow:hidden !important;
}
.s2s-call .lobby-deco {
  background:linear-gradient(160deg,#0284c7,#38bdf8) !important;
  color:#fff !important;
}
.s2s-call .lobby-deco::before,
.s2s-call .lobby-deco::after { opacity:.18 !important; filter:none !important; }
.s2s-call .deco-logo { color:#fff !important; font-family:inherit !important; }
.s2s-call .deco-headline { color:#fff !important; }
.s2s-call .deco-headline span { color:#e0f2fe !important; }
.s2s-call .deco-feat { color:#eaf7ff !important; }
.s2s-call .deco-feat-icon { background:rgba(255,255,255,.14) !important; border:1px solid rgba(255,255,255,.20) !important; }
.s2s-call .lobby-form { background:#fff !important; }
.s2s-call .form-title { color:var(--ink) !important; font-family:inherit !important; }
.s2s-call .form-sub { color:var(--muted-ui) !important; }
.s2s-call .guest-banner { background:var(--sky-50) !important; color:#0c4a6e !important; border:1px solid var(--sky-100) !important; }
.s2s-call .field label { color:#475569 !important; }
.s2s-call .field input { background:#fff !important; border-color:var(--line) !important; }
.s2s-call .gen-btn,
.s2s-call .quick-room { background:#fff !important; border:1px solid var(--line) !important; color:#475569 !important; }
.s2s-call .gen-btn:hover,
.s2s-call .quick-room:hover { background:var(--sky-50) !important; border-color:var(--sky-200) !important; color:var(--sky-700) !important; }
.s2s-call .join-btn { background:var(--sky-500) !important; color:#fff !important; box-shadow:0 8px 18px rgba(14,165,233,.18) !important; }
.s2s-call .join-btn:hover { background:var(--sky-600) !important; }
.s2s-call #callScreen { background:#eef6fb !important; }
.s2s-call .topbar { background:#fff !important; border-bottom:1px solid var(--line) !important; box-shadow:0 1px 10px rgba(15,23,42,.04) !important; }
.s2s-call .topbar-logo { color:var(--sky-600) !important; background:var(--sky-50) !important; border:1px solid var(--sky-100) !important; }
.s2s-call .topbar-room { color:#475569 !important; }
.s2s-call .call-timer { color:#64748b !important; }
.s2s-call .live-badge { background:#f0fdf4 !important; color:#15803d !important; border:1px solid #bbf7d0 !important; }
.s2s-call .controls { background:#fff !important; border-top:1px solid var(--line) !important; box-shadow:0 -4px 18px rgba(15,23,42,.06) !important; }
.s2s-call .ctrl-btn { background:#f8fbfd !important; border:1px solid var(--line) !important; color:#475569 !important; box-shadow:none !important; }
.s2s-call .ctrl-btn:hover { background:var(--sky-50) !important; border-color:var(--sky-200) !important; color:var(--sky-700) !important; }
.s2s-call .ctrl-btn.active { background:var(--sky-100) !important; color:var(--sky-700) !important; border-color:var(--sky-300) !important; }
.s2s-call .ctrl-btn.end-call { background:#fff1f2 !important; color:#dc2626 !important; border-color:#fecdd3 !important; }
.s2s-call .side-panel,
.s2s-call .chat-panel,
.s2s-call .settings-sheet { background:#fff !important; border-color:var(--line) !important; box-shadow:0 18px 45px rgba(15,23,42,.12) !important; }
.s2s-call .panel-header,
.s2s-call .chat-panel-header,
.s2s-call .chat-input-row,
.s2s-call .settings-title,
.s2s-call .settings-group { border-color:var(--line) !important; }
.s2s-call .participant-item:hover { background:var(--sky-50) !important; }
.s2s-call .participant-name { color:var(--ink) !important; }
.s2s-call .participant-status { color:#64748b !important; }
.s2s-call .dm-btn { background:var(--sky-50) !important; color:var(--sky-700) !important; }
.s2s-call .chat-msg .body .txt { background:#f8fbfd !important; color:var(--ink) !important; border-color:var(--line) !important; }
.s2s-call .chat-msg.me .body .txt { background:var(--sky-500) !important; color:#fff !important; }
.s2s-call .chat-tab.active { color:var(--sky-700) !important; border-bottom-color:var(--sky-500) !important; }
.s2s-call .chat-input { background:#f8fbfd !important; border-color:var(--line) !important; }
.s2s-call .chat-send,
.s2s-call .copy-btn,
.s2s-call .pw-copy-btn { background:var(--sky-500) !important; color:#fff !important; }
.s2s-call .reactions-bar { background:#fff !important; border-color:var(--line) !important; box-shadow:0 12px 30px rgba(15,23,42,.10) !important; }
.s2s-call .settings-panel { background:rgba(15,23,42,.28) !important; backdrop-filter:blur(4px) !important; }
.s2s-call .setting-row label { color:var(--ink) !important; }
.s2s-call .toggle { background:#e2e8f0 !important; border-color:#cbd5e1 !important; }
.s2s-call .toggle.on { background:var(--sky-500) !important; border-color:var(--sky-500) !important; }
.s2s-call .quality-chip { background:#fff !important; border-color:var(--line) !important; color:#475569 !important; }
.s2s-call .quality-chip.active { background:var(--sky-50) !important; border-color:var(--sky-300) !important; color:var(--sky-700) !important; }
.s2s-call .invite-box,
.s2s-call .room-pw-badge { background:#f8fbfd !important; border-color:var(--line) !important; }
.s2s-call .toast { background:#fff !important; color:var(--ink) !important; border-color:var(--line) !important; box-shadow:0 12px 30px rgba(15,23,42,.12) !important; }

/* =========================================================
   IFRAME WRAPPER / FAQ
   ========================================================= */
body.s2s-iframe { background:#f5fafe !important; }
.s2s-iframe .top-navbar-div {
  background:#fff !important;
  border-bottom:1px solid var(--line) !important;
  box-shadow:0 1px 10px rgba(15,23,42,.04) !important;
}
.s2s-iframe .logo-text { color:var(--ink) !important; font-family:inherit !important; }
.s2s-iframe .back-home-btn,
.s2s-iframe .vip-mail-btn { background:#fff !important; border:1px solid var(--line) !important; color:#475569 !important; box-shadow:none !important; }
.s2s-iframe .back-home-btn:hover,
.s2s-iframe .vip-mail-btn:hover { background:var(--sky-50) !important; border-color:var(--sky-200) !important; color:var(--sky-700) !important; }
.s2s-iframe .top-marquee-bar { background:var(--sky-600) !important; color:#fff !important; }
.s2s-iframe .chat-iframe { background:#fff !important; }
.s2s-iframe .faq-block { background:#fff !important; border:1px solid var(--line) !important; border-radius:14px !important; box-shadow:0 5px 18px rgba(15,23,42,.04) !important; }
.s2s-iframe .faq-question { color:var(--ink) !important; }
.s2s-iframe .faq-answer { color:#475569 !important; }

/* =========================================================
   CONTACT PAGE
   ========================================================= */
body.s2s-contact {
  background:linear-gradient(135deg,#f8fcff,#edf8fd) !important;
  color:var(--ink) !important;
}
.s2s-contact .form-container {
  background:#fff !important;
  border:1px solid var(--line) !important;
  border-radius:18px !important;
  box-shadow:0 22px 55px rgba(15,23,42,.10) !important;
}
.s2s-contact .separator-line { background:var(--line) !important; }
.s2s-contact .info-block { color:#475569 !important; }
.s2s-contact .close-btn { background:#f8fafc !important; color:#64748b !important; border:1px solid var(--line) !important; border-radius:10px !important; }
.s2s-contact .form-group label { color:#475569 !important; }
.s2s-contact .form-group input,
.s2s-contact .form-group textarea { background:#fff !important; border:1px solid var(--line) !important; border-radius:10px !important; }
.s2s-contact button[type="submit"] { background:var(--sky-500) !important; color:#fff !important; border:none !important; border-radius:10px !important; }

/* Universal scrollbars */
* { scrollbar-color:#cbdde8 transparent; }
*::-webkit-scrollbar { width:8px; height:8px; }
*::-webkit-scrollbar-thumb { background:#cbdde8; border-radius:999px; border:2px solid transparent; background-clip:padding-box; }
*::-webkit-scrollbar-track { background:transparent; }

/* Responsive refinements */
@media (max-width: 760px) {
  .s2s-home .navbar { height:62px !important; }
  .s2s-home .main-wrap { padding:34px 16px 30px !important; }
  .s2s-home .hero { margin-bottom:26px !important; }
  .s2s-home .hero h1 { font-size:2.45rem !important; }
  .s2s-home .stats-bar { border-radius:14px !important; }
  .s2s-login .card { padding:22px 18px !important; border-radius:16px !important; }
  .s2s-chat .topbar { height:54px !important; padding:0 10px !important; }
  .s2s-call .lobby-wrap { border-radius:16px !important; }
}
