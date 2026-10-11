import { prisma } from "@/lib/prisma";
import { TelegramNotificationEvent } from "@prisma/client";

/**
 * Per-Customer Telegram linking, mirroring My-Biz-Flow's TelegramSettings
 * pattern: a deep link (`t.me/<bot>?start=<customerId>_slot_personal` or
 * `_slot_group`) that Telegram turns into a `/start <payload>` command the
 * moment the user taps it — no manually-typed code needed. The webhook
 * route (src/app/api/telegram/webhook/route.ts) parses that payload and
 * calls connectTelegramChat below.
 *
 * Works the same for a BUSINESS's group and an INDIVIDUAL's personal DM —
 * both are just "slot_group" vs "slot_personal" on the same TelegramLink
 * row.
 */

type TelegramSlot = "personal" | "group";

export function buildTelegramConnectLink(customerId: string, slot: TelegramSlot): string {
  const username = process.env.TELEGRAM_BOT_USERNAME;
  if (!username) throw new Error("TELEGRAM_BOT_USERNAME is not set");
  const payload = `${customerId}_slot_${slot}`;
  return slot === "group"
    ? `https://t.me/${username}?startgroup=${payload}`
    : `https://t.me/${username}?start=${payload}`;
}

export function parseStartPayload(raw: string): { customerId: string; slot: TelegramSlot } | null {
  const match = raw.match(/^(.+)_slot_(personal|group)$/);
  if (!match) return null;
  return { customerId: match[1], slot: match[2] as TelegramSlot };
}

/**
 * Same deep-link mechanism as buildTelegramConnectLink, but for a CLIENT
 * tenant's own ops group rather than one Customer — distinguished by a
 * "tenant_" payload prefix so the webhook route can tell the two apart.
 * Always group-only (a business's ops channel, not a personal DM) — uses
 * Telegram's `startgroup` deep link, which prompts "choose a group to add
 * this bot to" rather than opening a DM.
 */
export function buildTenantTelegramConnectLink(tenantId: string): string {
  const username = process.env.TELEGRAM_BOT_USERNAME;
  if (!username) throw new Error("TELEGRAM_BOT_USERNAME is not set");
  return `https://t.me/${username}?startgroup=tenant_${tenantId}`;
}

export function parseTenantStartPayload(raw: string): { tenantId: string } | null {
  const match = raw.match(/^tenant_(.+)$/);
  if (!match) return null;
  return { tenantId: match[1] };
}

export async function connectTenantTelegramGroup(tenantId: string, chatId: string, chatTitle?: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { telegramGroupChatId: chatId, telegramGroupTitle: chatTitle, telegramEnabled: true },
  });
}

export async function findTenantIdByChatId(chatId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findFirst({ where: { telegramGroupChatId: chatId }, select: { id: true } });
  return tenant?.id ?? null;
}

export async function connectTelegramChat(
  customerId: string,
  chatId: string,
  slot: TelegramSlot,
  chatTitle?: string,
): Promise<void> {
  const data =
    slot === "group" ? { groupChatId: chatId, groupChatTitle: chatTitle } : { chatId, chatTitle };

  await prisma.telegramLink.upsert({
    where: { customerId },
    create: { customerId, ...data },
    update: data,
  });
}

export async function findCustomerIdByChatId(chatId: string): Promise<string | null> {
  const link = await prisma.telegramLink.findFirst({
    where: { OR: [{ chatId }, { groupChatId: chatId }] },
  });
  return link?.customerId ?? null;
}

/**
 * Sends a text message to a Telegram chat. No-ops (logged) if
 * TELEGRAM_BOT_TOKEN isn't set, same graceful-degradation pattern as the
 * rest of this app's external integrations (accounting-sync.ts, wallet.ts).
 */
export async function sendRawTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error(`[telegram] TELEGRAM_BOT_TOKEN not set — skipped message to ${chatId}`);
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[telegram] sendMessage failed for chat ${chatId}: ${response.status} ${body}`);
    }
  } catch (error) {
    console.error(`[telegram] sendMessage request failed for chat ${chatId}:`, error);
  }
}

/**
 * Notifies a Customer's linked chat(s) — personal DM and/or group, both if
 * both are linked — of a shipment update. Called from wherever OrderStatus
 * changes (see OrderStatusEvent creation sites); a Customer with no
 * TelegramLink is silently skipped, not an error.
 */
export async function notifyCustomerTelegram(customerId: string, text: string): Promise<void> {
  const link = await prisma.telegramLink.findUnique({ where: { customerId } });
  if (!link) return;
  if (link.chatId) await sendRawTelegramMessage(link.chatId, text);
  if (link.groupChatId) await sendRawTelegramMessage(link.groupChatId, text);
}

/**
 * Notifies a CLIENT tenant's own ops group, if they've connected one and
 * left it enabled (Tenant.telegramEnabled) — the Telegram-side counterpart
 * to Tenant.webhookUrl, for tenants who'd rather watch a Telegram group
 * than run their own webhook receiver.
 */
export async function notifyTenantTelegram(tenantId: string, text: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { telegramGroupChatId: true, telegramEnabled: true },
  });
  if (!tenant?.telegramEnabled || !tenant.telegramGroupChatId) return;
  await sendRawTelegramMessage(tenant.telegramGroupChatId, text);
}

/**
 * Internal ops notification — sends to whichever group chat staff
 * configured for this event type (Settings -> Telegram notifications, see
 * TelegramNotificationChannel). Unlike notifyCustomerTelegram, this isn't
 * about a specific Customer's own shipment — it's "tell the ops group an
 * agreement got signed" etc. No-ops silently if nothing's configured for
 * the event, or it's been toggled off.
 */
export async function notifyOpsTelegram(event: TelegramNotificationEvent, text: string): Promise<void> {
  const channel = await prisma.telegramNotificationChannel.findUnique({ where: { event } });
  if (!channel?.isActive) return;
  await sendRawTelegramMessage(channel.groupChatId, text);
}
