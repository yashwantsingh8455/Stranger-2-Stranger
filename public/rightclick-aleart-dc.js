/*
 * ============================================
 *  SECURITY GUARD v3.2 — StrangerToStranger
 *  F12 + Inspect Disable + Discord Alerts
 * ============================================
 */

(function () {
  // ════════════════════════════════════════
  //  CONFIG — SIRF YAHAN BADLAO
  // ════════════════════════════════════════

  const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1506924467555794984/r3wAlADbJ8uFRWdQair7OSLAmps-Wd9REP22JX3C_nFTe5KtZddpWA7cJrkSvbDF5ttO";

  const PROTECTED_PAGES = [
    { path: "/", name: "🏠 Home (index.html)" },
    { path: "/index.html", name: "🏠 Home (index.html)" },
    { path: "/old.html", name: "📄 Old Page" },
    { path: "/public/index.html", name: "🏠 Public Home" },
    { path: "/public/mypage.html", name: "👤 My Page" },
    { path: "/public/admin.html", name: "👑 Admin Panel" },
    { path: "/public/call.html", name: "📞 Call Page" },
    { path: "/public/GeneralChat.html", name: "💬 General Chat" },
    { path: "/public/Group-Chatroom.html", name: "👥 Group Chatroom" },
    { path: "/public/iframe-groupchatroom.html", name: "🖼️ iFrame Group Chatroom" },
    { path: "/public/Rooms/", name: "🚪 Rooms Page" },
    { path: "/public/Contact/", name: "📧 Contact Page" },
    { path: "/mypage.html", name: "👤 My Page" },
    { path: "/admin.html", name: "👑 Admin Panel" },
    { path: "/call.html", name: "📞 Call Page" },
    { path: "/GeneralChat.html", name: "💬 General Chat" },
    { path: "/Group-Chatroom.html", name: "👥 Group Chatroom" },
    { path: "/iframe-groupchatroom.html", name: "🖼️ iFrame Group Chatroom" },
  ];

  const MAX_ALERTS = 5;
  let alertCount = 0;

  // ════════════════════════════════════════
  //  INTERNAL FUNCTIONS
  // ════════════════════════════════════════

  function getCurrentPage() {
    const currentPath = window.location.pathname;
    const found = PROTECTED_PAGES.find((p) => {
      const cp = currentPath.toLowerCase();
      const pp = p.path.toLowerCase();
      return (
        cp === pp ||
        cp === pp.replace(/\/$/, "") ||
        cp.replace(/\/$/, "") === pp ||
        cp.endsWith(pp) ||
        cp.endsWith(pp.replace(/^\/public/, ""))
      );
    });
    return found ? found.name : "📄 " + (currentPath || "/");
  }

  function getDevice() {
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return "📟 Tablet";
    if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return "📱 Mobile";
    return "🖥️ Desktop";
  }

  function getOS() {
    const ua = navigator.userAgent;
    if (/Windows NT 10/i.test(ua)) return "Windows 10/11";
    if (/Windows NT 6.3/i.test(ua)) return "Windows 8.1";
    if (/Windows NT 6.1/i.test(ua)) return "Windows 7";
    if (/Android/i.test(ua)) return "Android " + (ua.match(/Android ([\d.]+)/)?.[1] || "");
    if (/iPhone/i.test(ua)) return "iPhone iOS";
    if (/iPad/i.test(ua)) return "iPad iOS";
    if (/Mac OS X/i.test(ua)) return "macOS";
    if (/Linux/i.test(ua)) return "Linux";
    return "Unknown OS";
  }

  function getBrowser() {
    const ua = navigator.userAgent;
    if (/Edg/i.test(ua)) return "Microsoft Edge";
    if (/OPR|Opera/i.test(ua)) return "Opera";
    if (/Chrome/i.test(ua)) return "Chrome";
    if (/Firefox/i.test(ua)) return "Firefox";
    if (/Safari/i.test(ua)) return "Safari";
    return "Unknown Browser";
  }

  async function sendDiscordAlert(reason) {
    if (alertCount >= MAX_ALERTS) return;
    alertCount++;

    let ip = "Unknown";
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      ip = data.ip;
    } catch (e) {}

    const time = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const page = getCurrentPage();
    const fullURL = window.location.href;
    const device = getDevice();
    const os = getOS();
    const browser = getBrowser();

    let alertColor = 0xff0000;
    let alertLevel = "🔴 HIGH";
    if (reason.includes("Right-click")) {
      alertColor = 0xff8c00;
      alertLevel = "🟠 MEDIUM";
    }
    if (reason.includes("PrintScreen")) {
      alertColor = 0xffd700;
      alertLevel = "🟡 LOW";
    }

    const embed = {
      username: "🚨 Security Guard",
      avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
      embeds: [
        {
          title: "🚨 Suspicious Activity — " + alertLevel,
          color: alertColor,
          fields: [
            { name: "⚡ Action", value: "`" + reason + "`", inline: false },
            { name: "📄 Page", value: page, inline: true },
            { name: "📍 IP Address", value: "`" + ip + "`", inline: true },
            { name: "🕐 Time (IST)", value: time, inline: false },
            { name: device + " Device", value: os, inline: true },
            { name: "🌐 Browser", value: browser, inline: true },
            { name: "🔗 Full URL", value: fullURL, inline: false },
          ],
          footer: { text: "StrangerToStranger Security Guard • Alert " + alertCount + "/" + MAX_ALERTS },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(embed),
      });
    } catch (e) {}
  }

  // ══ 1. KEYBOARD SHORTCUTS BLOCKED ══
  document.addEventListener("keydown", function (e) {
    if (e.key === "F12") {
      e.preventDefault();
      sendDiscordAlert("F12 pressed");
      return false;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i")) {
      e.preventDefault();
      sendDiscordAlert("Ctrl+Shift+I (Inspect Element)");
      return false;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j")) {
      e.preventDefault();
      sendDiscordAlert("Ctrl+Shift+J (Console)");
      return false;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === "C" || e.key === "c")) {
      e.preventDefault();
      sendDiscordAlert("Ctrl+Shift+C (Element Picker)");
      return false;
    }
    if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
      e.preventDefault();
      sendDiscordAlert("Ctrl+U (View Source)");
      return false;
    }
    if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      sendDiscordAlert("Ctrl+S (Save Page)");
      return false;
    }
    if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
      e.preventDefault();
      sendDiscordAlert("Ctrl+P (Print attempted)");
      return false;
    }
    if (e.ctrlKey && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
    }
  }, true);

  // ══ 2. RIGHT CLICK DISABLED (NO POPUP / NO ALERT WINDOW) ══
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    sendDiscordAlert("Right-click on page");
    return false;
  }, true);

  // ══ 3. DEVTOOLS SIZE DETECT ══
  let devToolsOpen = false;
  setInterval(function () {
    const wDiff = window.outerWidth - window.innerWidth;
    const hDiff = window.outerHeight - window.innerHeight;
    if ((wDiff > 160 || hDiff > 160) && !devToolsOpen) {
      devToolsOpen = true;
      sendDiscordAlert("DevTools opened (window resize detected)");
    }
    if (wDiff <= 160 && hDiff <= 160 && devToolsOpen) devToolsOpen = false;
  }, 1000);

  // NOTE: Debugger Trap (Section 4) has been removed because it was causing false-positive "Access Denied" triggers for normal users.

  // ══ 4. DRAG BLOCK ══
  document.addEventListener("dragstart", function (e) {
    e.preventDefault();
    return false;
  });

  // ══ 5. TEXT SELECT DISABLE (SAFE MODE) ══
  function applyTextProtection() {
    if (!document.body) return;
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.body.style.msUserSelect = "none";
    document.body.style.mozUserSelect = "none";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyTextProtection);
  } else {
    applyTextProtection();
  }

  document.addEventListener("selectstart", function (e) {
    e.preventDefault();
    return false;
  });

  // ══ 6. PRINT SCREEN ══
  document.addEventListener("keyup", function (e) {
    if (e.key === "PrintScreen") {
      sendDiscordAlert("PrintScreen pressed (screenshot attempt)");
      document.body.style.visibility = "hidden";
      setTimeout(() => {
        document.body.style.visibility = "visible";
      }, 400);
    }
  });

  console.clear();
})();