import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { notifyOpsTelegram } from "@/lib/telegram";
import { AgreementStatus, TelegramNotificationEvent } from "@prisma/client";

// Daily reminder for Agreements coming up for renewal — scheduled via
// vercel.json's crons entry, same Authorization: Bearer $CRON_SECRET check
// as sync-tracking. Notifies AGREEMENTS_NOTIFY_EMAIL and the
// AGREEMENT_RENEWAL_DUE Telegram group (Settings -> Telegram notifications)
// once per agreement (renewalReminderSentAt guards against re-sending every
// run) for any SIGNED agreement whose renewalDate falls within the next 30
// days. Both channels are independently best-effort — reminderSentAt is set
// after attempting both regardless of whether either is configured, so a
// misconfigured channel doesn't cause daily re-attempts forever.
const REMINDER_WINDOW_DAYS = 30;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const dueAgreements = await prisma.agreement.findMany({
    where: {
      status: AgreementStatus.SIGNED,
      renewalDate: { not: null, lte: windowEnd },
      renewalReminderSentAt: null,
    },
    include: { customer: true },
    take: 100,
  });

  const internalEmail = process.env.AGREEMENTS_NOTIFY_EMAIL;
  let notified = 0;

  for (const agreement of dueAgreements) {
    if (internalEmail) {
      await sendEmail({
        to: internalEmail,
        subject: `Agreement renewal due — ${agreement.customer.name}`,
        html: `<p>The ${agreement.kind} agreement with <b>${agreement.customer.name}</b> is due for renewal on ${agreement.renewalDate!.toDateString()}. Reach out to arrange a new agreement/e-sign.</p>`,
      });
    }
    await notifyOpsTelegram(
      TelegramNotificationEvent.AGREEMENT_RENEWAL_DUE,
      `Agreement renewal due — <b>${agreement.customer.name}</b> (${agreement.kind}), due ${agreement.renewalDate!.toDateString()}.`,
    );
    await prisma.agreement.update({
      where: { id: agreement.id },
      data: { renewalReminderSentAt: new Date() },
    });
    notified++;
  }

  return NextResponse.json({ checked: dueAgreements.length, notified });
}
