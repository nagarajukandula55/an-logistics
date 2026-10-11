/**
 * Thin wrapper over Resend's HTTP API (no SDK dependency — same plain-fetch
 * pattern as wallet.ts/accounting-sync.ts). Used to send signed-agreement
 * copies and renewal reminders. No-ops (logs and returns) if RESEND_API_KEY
 * isn't set, so local/dev environments don't need it configured.
 */

type EmailAttachment = {
  filename: string;
  content: Buffer;
};

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error("[email] RESEND_API_KEY/EMAIL_FROM not set — skipped email:", params.subject);
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString("base64"),
        })),
      }),
    });
    if (!response.ok) {
      console.error(`[email] Send failed: ${response.status} ${await response.text().catch(() => "")}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Send request failed:", error);
    return false;
  }
}
