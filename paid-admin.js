"use strict";

/**
 * StrangerToStranger — ₹25 / 30-day Community Admin Pass (Cashfree PG)
 *
 * Security model:
 * - Cashfree secrets stay server-side.
 * - Only verified Firebase accounts can buy the role (guest identities are temporary).
 * - Payment is verified server-side before entitlement activation.
 * - Webhook signatures are verified from Cashfree's raw request body.
 * - Paid Community Admin is NOT Master Admin.
 */

const crypto = require("crypto");

module.exports = function registerPaidAdmin({
  app,
  mongoose,
  verifyFirebaseToken,
  firebaseAdminReady,
  mongoReady,
}) {
  if (!app || !mongoose || typeof verifyFirebaseToken !== "function") {
    throw new Error("paid-admin.js requires app, mongoose and verifyFirebaseToken");
  }

  const PRICE = 25;
  const DURATION_DAYS = 30;

  // Reuse the existing Cashfree Payment Gateway credential pair.
  const CASHFREE_CLIENT_ID =
    process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID || "";
  const CASHFREE_CLIENT_SECRET =
    process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY || "";

  const CASHFREE_ENV =
    String(process.env.CASHFREE_ENV || "production").toLowerCase() === "sandbox"
      ? "sandbox"
      : "production";

  const CASHFREE_BASE =
    CASHFREE_ENV === "sandbox"
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg";

  // Current Cashfree PG docs default to 2026-01-01.
  const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2026-01-01";

  const PUBLIC_BASE_URL = String(
    process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || ""
  ).replace(/\/+$/, "");

  const SubscriptionSchema = new mongoose.Schema(
    {
      firebaseUid: { type: String, required: true, unique: true, index: true },
      email: { type: String, default: "" },
      plan: { type: String, default: "community_admin_monthly" },
      amount: { type: Number, default: PRICE },
      activeUntil: { type: Date, required: true, index: true },
      lastOrderId: { type: String, default: "" },
      activatedAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    { versionKey: false }
  );

  const OrderSchema = new mongoose.Schema(
    {
      orderId: { type: String, required: true, unique: true, index: true },
      cfOrderId: { type: String, default: "" },
      firebaseUid: { type: String, required: true, index: true },
      email: { type: String, default: "" },
      amount: { type: Number, default: PRICE },
      currency: { type: String, default: "INR" },
      purpose: { type: String, default: "community_admin_monthly" },
      status: {
        type: String,
        enum: ["CREATED", "PAID", "FAILED", "EXPIRED"],
        default: "CREATED",
        index: true,
      },
      paidAt: Date,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    { versionKey: false }
  );

  const PaidAdminSubscription =
    mongoose.models.PaidAdminSubscription ||
    mongoose.model("PaidAdminSubscription", SubscriptionSchema);

  const PaidAdminOrder =
    mongoose.models.PaidAdminOrder || mongoose.model("PaidAdminOrder", OrderSchema);

  function dbAvailable() {
    return typeof mongoReady === "function"
      ? !!mongoReady()
      : mongoose.connection.readyState === 1;
  }

  function cashfreeConfigured() {
    return !!(CASHFREE_CLIENT_ID && CASHFREE_CLIENT_SECRET);
  }

  async function requireFirebase(req, res, next) {
    if (typeof firebaseAdminReady === "function" && !firebaseAdminReady()) {
      return res.status(503).json({ error: "Account authentication is not configured" });
    }

    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Registered account required" });

    const decoded = await verifyFirebaseToken(token);
    if (!decoded) return res.status(401).json({ error: "Invalid or expired account session" });

    req.paidAdminUser = decoded;
    next();
  }

  async function cashfreeRequest(endpoint, options = {}) {
    if (!cashfreeConfigured()) {
      const err = new Error("Cashfree Payment Gateway credentials are not configured");
      err.status = 503;
      throw err;
    }

    const response = await fetch(CASHFREE_BASE + endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": CASHFREE_CLIENT_ID,
        "x-client-secret": CASHFREE_CLIENT_SECRET,
        "x-request-id": crypto.randomUUID(),
        ...(options.headers || {}),
      },
    });

    const raw = await response.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: raw.slice(0, 500) }; }

    if (!response.ok) {
      const err = new Error(
        body?.message || body?.error || `Cashfree request failed (${response.status})`
      );
      err.status = response.status;
      err.cashfree = body;
      throw err;
    }
    return body;
  }

  async function hasActive(firebaseUid) {
    if (!firebaseUid || !dbAvailable()) return false;
    return !!(await PaidAdminSubscription.exists({
      firebaseUid,
      activeUntil: { $gt: new Date() },
    }));
  }

  async function getStatus(firebaseUid) {
    if (!firebaseUid || !dbAvailable()) return { active: false, expiresAt: null, plan: null };
    const doc = await PaidAdminSubscription.findOne({ firebaseUid }).lean();
    const active = !!(doc?.activeUntil && new Date(doc.activeUntil) > new Date());
    return { active, expiresAt: doc?.activeUntil || null, plan: doc?.plan || null };
  }

  async function activateFromPaidOrder(localOrder, remoteOrder) {
    if (!localOrder || !remoteOrder) throw new Error("Payment order could not be verified");
    if (remoteOrder.order_status !== "PAID") {
      return { active: false, status: remoteOrder.order_status || "UNKNOWN" };
    }

    if (
      Number(remoteOrder.order_amount) !== PRICE ||
      String(remoteOrder.order_currency || "").toUpperCase() !== "INR"
    ) {
      throw new Error("Payment amount or currency does not match the Admin Pass");
    }

    // Idempotency: the same successful order can activate only once.
    if (localOrder.status === "PAID" && localOrder.paidAt) {
      return getStatus(localOrder.firebaseUid);
    }

    const now = new Date();
    const existing = await PaidAdminSubscription.findOne({ firebaseUid: localOrder.firebaseUid });
    const base = existing?.activeUntil && existing.activeUntil > now
      ? new Date(existing.activeUntil)
      : now;
    const activeUntil = new Date(base.getTime() + DURATION_DAYS * 24 * 60 * 60 * 1000);

    await PaidAdminSubscription.findOneAndUpdate(
      { firebaseUid: localOrder.firebaseUid },
      {
        $set: {
          email: localOrder.email || "",
          plan: "community_admin_monthly",
          amount: PRICE,
          activeUntil,
          lastOrderId: localOrder.orderId,
          updatedAt: now,
        },
        $setOnInsert: { activatedAt: now },
      },
      { upsert: true, returnDocument: "after" }
    );

    localOrder.status = "PAID";
    localOrder.paidAt = now;
    localOrder.updatedAt = now;
    localOrder.cfOrderId = String(remoteOrder.cf_order_id || localOrder.cfOrderId || "");
    await localOrder.save();

    return { active: true, expiresAt: activeUntil, status: "PAID" };
  }

  function verifyWebhookSignature(req) {
    if (!cashfreeConfigured()) return false;
    const rawBody = typeof req.rawBody === "string" ? req.rawBody : "";
    const timestamp = String(req.headers["x-webhook-timestamp"] || "");
    const received = String(req.headers["x-webhook-signature"] || "");
    if (!rawBody || !timestamp || !received) return false;

    const expected = crypto
      .createHmac("sha256", CASHFREE_CLIENT_SECRET)
      .update(timestamp + rawBody)
      .digest("base64");

    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  app.get("/api/paid-admin/status", requireFirebase, async (req, res) => {
    try {
      if (!dbAvailable()) return res.status(503).json({ error: "Database is unavailable" });
      const status = await getStatus(req.paidAdminUser.uid);
      res.set("Cache-Control", "no-store");
      res.json({ ok: true, ...status, price: PRICE, durationDays: DURATION_DAYS });
    } catch (err) {
      console.error("Paid admin status error:", err);
      res.status(500).json({ error: "Could not load Admin Pass status" });
    }
  });

  app.post("/api/paid-admin/create-order", requireFirebase, async (req, res) => {
    try {
      if (!dbAvailable()) return res.status(503).json({ error: "Database is unavailable" });
      if (!cashfreeConfigured()) return res.status(503).json({ error: "Cashfree is not configured on the server" });
      if (!PUBLIC_BASE_URL) return res.status(503).json({ error: "PUBLIC_BASE_URL is not configured" });

      const decoded = req.paidAdminUser;
      const phone = String(req.body?.phone || "").replace(/\D/g, "");
      if (!/^[6-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ error: "Valid 10-digit Indian mobile number required" });
      }

      const orderId = `s2s_admin_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
        .replace(/[^A-Za-z0-9_-]/g, "")
        .slice(0, 45);
      const email = String(decoded.email || "").slice(0, 120);
      const displayName = String(decoded.name || email.split("@")[0] || "User").slice(0, 80);

      // Save a local order BEFORE the external request so retries/audit remain traceable.
      const localOrder = await PaidAdminOrder.create({
        orderId,
        firebaseUid: decoded.uid,
        email,
        amount: PRICE,
        currency: "INR",
        purpose: "community_admin_monthly",
        status: "CREATED",
      });

      try {
        const payload = {
          order_id: orderId,
          order_amount: PRICE,
          order_currency: "INR",
          customer_details: {
            customer_id: String(decoded.uid).slice(0, 50),
            customer_name: displayName,
            customer_phone: phone,
          },
          order_meta: {
            return_url: `${PUBLIC_BASE_URL}/Group-Chatroom?admin_payment=return&order_id={order_id}`,
          },
          order_note: "Stranger to Stranger - Community Admin - 30 Days",
          order_tags: {
            feature: "community_admin",
            plan: "monthly_25",
            brand: "Stranger_to_Stranger",
          },
        };
        if (email) payload.customer_details.customer_email = email;

        const remote = await cashfreeRequest("/orders", {
          method: "POST",
          headers: { "x-idempotency-key": crypto.randomUUID() },
          body: JSON.stringify(payload),
        });

        localOrder.cfOrderId = String(remote.cf_order_id || "");
        localOrder.updatedAt = new Date();
        await localOrder.save();

        return res.status(201).json({
          ok: true,
          orderId,
          paymentSessionId: remote.payment_session_id,
          amount: PRICE,
          currency: "INR",
          mode: CASHFREE_ENV,
        });
      } catch (err) {
        localOrder.status = "FAILED";
        localOrder.updatedAt = new Date();
        await localOrder.save().catch(() => {});
        throw err;
      }
    } catch (err) {
      console.error("Paid admin create order error:", err.cashfree || err);
      res.status(err.status >= 400 && err.status < 600 ? err.status : 500).json({
        error: err.message || "Could not create payment order",
      });
    }
  });

  app.post("/api/paid-admin/verify", requireFirebase, async (req, res) => {
    try {
      if (!dbAvailable()) return res.status(503).json({ error: "Database is unavailable" });
      const orderId = String(req.body?.orderId || "").trim();
      if (!/^[A-Za-z0-9_-]{3,45}$/.test(orderId)) return res.status(400).json({ error: "Invalid order id" });

      const localOrder = await PaidAdminOrder.findOne({
        orderId,
        firebaseUid: req.paidAdminUser.uid,
      });
      if (!localOrder) return res.status(404).json({ error: "Payment order not found for this account" });

      const remote = await cashfreeRequest(`/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
      const result = await activateFromPaidOrder(localOrder, remote);
      if (!result.active) {
        return res.status(402).json({ error: `Payment status: ${result.status || "NOT_PAID"}`, active: false });
      }
      res.json({ ok: true, active: true, expiresAt: result.expiresAt });
    } catch (err) {
      console.error("Paid admin verify error:", err.cashfree || err);
      res.status(err.status >= 400 && err.status < 600 ? err.status : 500).json({
        error: err.message || "Payment verification failed",
      });
    }
  });

  // Recommended production fallback: Cashfree can activate the entitlement even
  // if the user closes the tab before the return URL verification runs.
  app.post("/api/paid-admin/webhook", async (req, res) => {
    try {
      if (!verifyWebhookSignature(req)) return res.status(401).json({ error: "Invalid webhook signature" });
      // Return quickly for events unrelated to this feature.
      const event = req.body && typeof req.body === "object" ? req.body : {};
      const orderId = String(event?.data?.order?.order_id || "");
      const paymentStatus = String(event?.data?.payment?.payment_status || "");
      const eventType = String(event?.type || "");

      if (!orderId.startsWith("s2s_admin_")) return res.json({ ok: true, ignored: true });
      if (eventType !== "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus !== "SUCCESS") {
        return res.json({ ok: true, ignored: true });
      }
      if (!dbAvailable()) return res.status(503).json({ error: "Database is unavailable" });

      const localOrder = await PaidAdminOrder.findOne({ orderId });
      if (!localOrder) return res.json({ ok: true, ignored: true });

      // Fetch the Cashfree order as the final source of truth before fulfilment.
      const remote = await cashfreeRequest(`/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
      await activateFromPaidOrder(localOrder, remote);
      return res.json({ ok: true });
    } catch (err) {
      console.error("Paid admin webhook error:", err.cashfree || err);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  return {
    PaidAdminSubscription,
    PaidAdminOrder,
    hasActive,
    getStatus,
    price: PRICE,
    durationDays: DURATION_DAYS,
    configured: cashfreeConfigured,
  };
};
