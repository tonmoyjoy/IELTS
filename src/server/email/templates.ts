import { getAppUrl } from "@/server/env";
import type { EmailMessage } from "@/server/email/send-email";

export const PRODUCT_NAME = "IELTS Practice Studio";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<p style="margin:0 0 8px;color:#047857;font-size:13px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase">${PRODUCT_NAME}</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="margin:24px 0 0;color:#71717a;font-size:12px">If you did not request this, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
}

function button(url: string, label: string): string {
  const safe = escapeHtml(url);
  return `<p style="margin:24px 0"><a href="${safe}" style="background:#059669;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">${escapeHtml(label)}</a></p>
<p style="margin:0;color:#71717a;font-size:12px;word-break:break-all">Or paste this link into your browser: ${safe}</p>`;
}

export function verificationEmail(to: string, token: string): EmailMessage {
  const url = `${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: `Verify your ${PRODUCT_NAME} account`,
    html: layout(
      "Confirm your email address",
      `<p style="margin:0;line-height:1.6">Confirm this email address to start practising. The link expires in 24 hours.</p>${button(url, "Verify email")}`
    ),
    text: `Confirm your email address for ${PRODUCT_NAME}: ${url}\n\nThe link expires in 24 hours.`,
  };
}

export function accountExistsEmail(to: string): EmailMessage {
  const loginUrl = `${getAppUrl()}/login`;
  const resetUrl = `${getAppUrl()}/forgot-password`;
  return {
    to,
    subject: `You already have a ${PRODUCT_NAME} account`,
    html: layout(
      "You already have an account",
      `<p style="margin:0;line-height:1.6">Someone tried to register with this email address, but an account already exists. You can sign in, or reset your password if you have forgotten it.</p>${button(loginUrl, "Sign in")}<p style="margin:0;font-size:14px"><a href="${escapeHtml(resetUrl)}" style="color:#047857">Reset your password</a></p>`
    ),
    text: `An account for this email already exists on ${PRODUCT_NAME}.\nSign in: ${loginUrl}\nReset password: ${resetUrl}`,
  };
}

export function passwordResetEmail(to: string, token: string): EmailMessage {
  const url = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: `Reset your ${PRODUCT_NAME} password`,
    html: layout(
      "Reset your password",
      `<p style="margin:0;line-height:1.6">Use the button below to choose a new password. The link expires in 30 minutes and can be used once. Resetting signs you out on every device.</p>${button(url, "Choose a new password")}`
    ),
    text: `Reset your ${PRODUCT_NAME} password: ${url}\n\nThe link expires in 30 minutes.`,
  };
}
