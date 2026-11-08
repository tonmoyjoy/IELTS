#!/usr/bin/env node
/**
 * Tiny stand-in for the SSLCommerz gateway, used by the E2E tests.
 * Implements session initiation, a hosted payment page and the validation API.
 *   PORT=4600 node tests/support/fake-sslcommerz.mjs
 */
import http from "node:http";

const PORT = Number(process.env.PORT ?? 4600);
const sessions = new Map(); // tran_id -> session

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(new URLSearchParams(data)));
  });
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "POST" && url.pathname === "/gwprocess/v4/api.php") {
    const form = await readBody(req);
    const required = ["store_id", "store_passwd", "total_amount", "currency", "tran_id", "success_url", "fail_url", "cancel_url", "cus_name", "cus_email", "cus_phone", "product_profile"];
    const missing = required.filter((key) => !form.get(key));
    if (missing.length) return json(res, 200, { status: "FAILED", failedreason: `Missing: ${missing.join(", ")}` });
    const tranId = form.get("tran_id");
    sessions.set(tranId, {
      tranId,
      amount: form.get("total_amount"),
      currency: form.get("currency"),
      success: form.get("success_url"),
      fail: form.get("fail_url"),
      cancel: form.get("cancel_url"),
    });
    return json(res, 200, {
      status: "SUCCESS",
      sessionkey: `SESSION-${tranId}`,
      GatewayPageURL: `http://localhost:${PORT}/pay/${encodeURIComponent(tranId)}`,
    });
  }

  if (req.method === "GET" && url.pathname.startsWith("/pay/")) {
    const session = sessions.get(decodeURIComponent(url.pathname.slice(5)));
    if (!session) {
      res.writeHead(404);
      return res.end("Unknown session");
    }
    const hidden = (fields) =>
      Object.entries(fields)
        .map(([k, v]) => `<input type="hidden" name="${escape(k)}" value="${escape(v)}">`)
        .join("");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><html><body>
<h1>Fake SSLCommerz</h1><p>Amount: ${escape(session.amount)} ${escape(session.currency)}</p>
<form method="post" action="${escape(session.success)}">${hidden({ tran_id: session.tranId, val_id: `VAL-${session.tranId}`, amount: session.amount, status: "VALID", card_type: "BKASH-BKash" })}<button type="submit">Pay with bKash</button></form>
<form method="post" action="${escape(session.cancel)}">${hidden({ tran_id: session.tranId, status: "CANCELLED" })}<button type="submit">Cancel payment</button></form>
</body></html>`);
  }

  if (req.method === "GET" && url.pathname === "/validator/api/validationserverAPI.php") {
    const valId = url.searchParams.get("val_id") ?? "";
    const session = sessions.get(valId.replace(/^VAL-/, ""));
    if (!session) return json(res, 200, { status: "INVALID_TRANSACTION" });
    return json(res, 200, {
      status: "VALID",
      tran_id: session.tranId,
      val_id: valId,
      amount: session.amount,
      currency: "BDT",
      currency_type: session.currency,
      card_type: "BKASH-BKash",
      bank_tran_id: `BANK-${session.tranId}`,
      risk_level: "0",
    });
  }

  if (url.pathname === "/health") return json(res, 200, { ok: true });
  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => console.log(`fake SSLCommerz on http://localhost:${PORT}`));
