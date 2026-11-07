import { getEmailTransport, getEnv } from "@/server/env";
import { log } from "@/server/log";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

/**
 * Sends a transactional email. With the console transport (local dev, CI)
 * the message is written to the server log and never returned to the
 * client, so links cannot leak through API responses.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (getEmailTransport() === "console") {
    log.info("email.console", { to: message.to, subject: message.subject, text: message.text });
    return;
  }

  const env = getEnv();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new EmailDeliveryError(`Resend responded ${res.status}: ${detail.slice(0, 300)}`);
  }
}
