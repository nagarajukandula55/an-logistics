import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { TelegramNotificationEvent } from "@prisma/client";
import { TelegramNotificationsPanel } from "./TelegramNotificationsPanel";

const EVENT_LABELS: Record<TelegramNotificationEvent, string> = {
  PARTNER_APPLICATION: "New partner application",
  ORDER_STATUS_CHANGE: "Order status change",
  AGREEMENT_SENT: "Agreement sent for e-sign",
  AGREEMENT_SIGNED: "Agreement signed",
  AGREEMENT_RENEWAL_DUE: "Agreement renewal due",
};

const EVENT_DESCRIPTIONS: Record<TelegramNotificationEvent, string> = {
  PARTNER_APPLICATION: "A public signup is ready for your review and follow-up.",
  ORDER_STATUS_CHANGE: "Every time an order's status changes, across all tenants.",
  AGREEMENT_SENT: "A customer agreement goes out to Zoho Sign for signature.",
  AGREEMENT_SIGNED: "A customer agreement comes back fully signed.",
  AGREEMENT_RENEWAL_DUE: "A signed agreement's renewal date is within 30 days (or past).",
};

// Internal ops notifications — our own Telegram group(s), one per event
// type, separate from a Customer's own TelegramLink or a CLIENT tenant's
// connected group (see tenants/[id] -> Telegram notifications panel).
export default async function TelegramNotificationsSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/orders");

  const channels = await prisma.telegramNotificationChannel.findMany();
  const channelByEvent = new Map(channels.map((c) => [c.event, c]));

  const rows = Object.values(TelegramNotificationEvent).map((event) => ({
    event,
    label: EVENT_LABELS[event],
    description: EVENT_DESCRIPTIONS[event],
    groupChatId: channelByEvent.get(event)?.groupChatId ?? "",
    isActive: channelByEvent.get(event)?.isActive ?? false,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Settings"
        title="Telegram notifications"
        description="Route each kind of platform event to its own ops Telegram group. Add the bot to a group, get its chat id, and paste it below — toggle off to pause without losing the setting."
      />
      <Card>
        <CardBody>
          <TelegramNotificationsPanel rows={rows} />
        </CardBody>
      </Card>
    </div>
  );
}
