type EmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(input: EmailInput): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!key || !from) {
    console.log(`[email:dev] ${input.subject} -> ${input.to}\n${input.html}`);
    return { sent: false, reason: "Email provider not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!res.ok) {
    console.error("[email] send failed", await res.text().catch(() => ""));
    return { sent: false, reason: "Email provider rejected the message" };
  }

  return { sent: true };
}
