"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { TelegramNotificationEvent } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") {
    throw new Error("Only admins can manage Telegram notification settings");
  }
  return session;
}

const saveChannelSchema = z.object({
  event: z.nativeEnum(TelegramNotificationEvent),
  groupChatId: z.string().trim().min(1, "Group chat id is required"),
  isActive: z.string().transform((v) => v === "true"),
});

export async function saveTelegramNotificationChannelAction(formData: FormData) {
  await requireAdmin();
  const parsed = saveChannelSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const { event, groupChatId, isActive } = parsed.data;

  await prisma.telegramNotificationChannel.upsert({
    where: { event },
    create: { event, groupChatId, isActive },
    update: { groupChatId, isActive },
  });

  revalidatePath("/settings/telegram-notifications");
}

/**
 * Sends a one-off test message to a candidate group chat id, straight
 * through Telegram's API (not notifyOpsTelegram, since there may be no
 * saved channel yet) — lets an admin confirm the bot can actually reach
 * that chat before saving it. Telegram's own error text ("chat not found",
 * "bot was kicked", "not enough rights to send text messages") is
 * surfaced directly since it already says exactly what's wrong.
 */
export async function testTelegramChatAction(groupChatId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured on the server" };
  if (!groupChatId.trim()) return { ok: false, error: "Enter a group chat id first" };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: groupChatId.trim(),
        text: "✅ AN Logistics test notification — this group is correctly connected.",
      }),
    });
    const data = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!response.ok || !data?.ok) {
      return { ok: false, error: data?.description ?? `Telegram returned ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
  }
}

/**
 * Lists group/supergroup chats the bot has recently seen a message in (via
 * Telegram's getUpdates) — lets an admin pick a chat id by name instead of
 * having to dig it out of @userinfobot or raw webhook logs. Only sees
 * chats from the last ~24h/100 updates Telegram still has buffered;
 * doesn't affect the webhook (getUpdates and setWebhook can coexist —
 * Telegram just also hands back whatever's queued).
 */
export async function discoverTelegramChatsAction(): Promise<
  { ok: true; chats: { id: string; title: string }[] } | { ok: false; error: string }
> {
  await requireAdmin();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured on the server" };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`);
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
      result?: { message?: { chat: { id: number; type: string; title?: string } } }[];
    } | null;
    if (!response.ok || !data?.ok) {
      return { ok: false, error: data?.description ?? `Telegram returned ${response.status}` };
    }

    const seen = new Map<string, string>();
    for (const update of data.result ?? []) {
      const chat = update.message?.chat;
      if (!chat || (chat.type !== "group" && chat.type !== "supergroup")) continue;
      seen.set(String(chat.id), chat.title ?? String(chat.id));
    }
    return { ok: true, chats: Array.from(seen, ([id, title]) => ({ id, title })) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
  }
}

export async function removeTelegramNotificationChannelAction(formData: FormData) {
  await requireAdmin();
  const event = formData.get("event");
  const parsed = z.nativeEnum(TelegramNotificationEvent).safeParse(event);
  if (!parsed.success) throw new Error("Invalid event");

  await prisma.telegramNotificationChannel.deleteMany({ where: { event: parsed.data } });
  revalidatePath("/settings/telegram-notifications");
}
