import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  connectTelegramChat,
  connectTenantTelegramGroup,
  findCustomerIdByChatId,
  findTenantIdByChatId,
  parseStartPayload,
  parseTenantStartPayload,
  sendRawTelegramMessage,
} from "@/lib/telegram";

/**
 * Telegram webhook — see .env.example for the setWebhook call that points
 * Telegram here, authenticated via the X-Telegram-Bot-Api-Secret-Token
 * header Telegram echoes back (same scheme My-Biz-Flow uses).
 *
 * Two kinds of chat get linked here, both via the same /start deep-link
 * mechanism, distinguished by payload shape:
 *   /start <customerId>_slot_personal|group  — one Customer's own DM/group
 *     (buildTelegramConnectLink) — shipment updates + /shipments scoped to
 *     just their own orders.
 *   /start tenant_<tenantId>  — a CLIENT tenant's own ops group
 *     (buildTenantTelegramConnectLink, always `startgroup`) — the same
 *     status-change stream as their webhookUrl, plus /shipments and
 *     /documents scoped to ALL of that tenant's orders.
 * A chat is at most one of these; whichever /start payload opened it wins.
 */

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number; type: string; title?: string };
    text?: string;
  };
};

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("[telegram-webhook] TELEGRAM_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 502 });
  }
  const receivedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const message = update?.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  const isGroup = message.chat.type === "group" || message.chat.type === "supergroup";
  const text = message.text.trim();

  const startMatch = text.match(/^\/start(?:@\S+)?(?:\s+(\S+))?/);
  if (startMatch) {
    const rawPayload = startMatch[1] ?? "";

    const tenantPayload = parseTenantStartPayload(rawPayload);
    if (tenantPayload) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantPayload.tenantId } });
      if (!tenant) {
        await sendRawTelegramMessage(chatId, "Account not found — generate a new link from your AN Logistics admin.");
        return NextResponse.json({ ok: true });
      }
      await connectTenantTelegramGroup(tenant.id, chatId, message.chat.title ?? tenant.name);
      await sendRawTelegramMessage(
        chatId,
        `Linked to <b>${tenant.name}</b>'s ops group. You'll get shipment status updates here, and can use /shipments and /documents &lt;tracking code&gt; across all your orders.`,
      );
      return NextResponse.json({ ok: true });
    }

    const payload = parseStartPayload(rawPayload);
    if (!payload) {
      await sendRawTelegramMessage(chatId, "Invalid or expired link — generate a new one from your AN Logistics portal.");
      return NextResponse.json({ ok: true });
    }
    const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
    if (!customer) {
      await sendRawTelegramMessage(chatId, "Account not found — generate a new link from your portal.");
      return NextResponse.json({ ok: true });
    }
    const slot = isGroup ? "group" : "personal";
    await connectTelegramChat(customer.id, chatId, slot, message.chat.title ?? customer.name);
    await sendRawTelegramMessage(
      chatId,
      `Linked to <b>${customer.name}</b>. You'll get shipment updates here, and can use /shipments and /documents &lt;tracking code&gt;.`,
    );
    return NextResponse.json({ ok: true });
  }

  // A tenant's ops group takes precedence if this chat happens to be both
  // (shouldn't normally happen — a group is linked by whichever /start
  // payload it was opened with — but a tenant group scopes to every one of
  // their orders, which is what staff in that group almost always want).
  const tenantId = await findTenantIdByChatId(chatId);
  const customerId = tenantId ? null : await findCustomerIdByChatId(chatId);

  if (!tenantId && !customerId) {
    await sendRawTelegramMessage(
      chatId,
      "This chat isn't linked yet — generate a connect link from your AN Logistics portal/admin and tap it.",
    );
    return NextResponse.json({ ok: true });
  }

  const orderScope = tenantId ? { tenantId } : { customerId: customerId! };

  if (text === "/shipments") {
    const orders = await prisma.order.findMany({
      where: orderScope,
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (orders.length === 0) {
      await sendRawTelegramMessage(chatId, "No shipments found.");
    } else {
      const lines = orders.map((o) => `• <b>${o.trackingCode}</b> — ${o.status}`);
      await sendRawTelegramMessage(chatId, lines.join("\n"));
    }
    return NextResponse.json({ ok: true });
  }

  const docMatch = text.match(/^\/documents(?:@\S+)?\s+(\S+)/);
  if (docMatch) {
    const trackingCode = docMatch[1];
    const order = await prisma.order.findUnique({ where: { trackingCode } });
    const belongsToScope = tenantId ? order?.tenantId === tenantId : order?.customerId === customerId;
    if (!order || !belongsToScope) {
      await sendRawTelegramMessage(chatId, `No shipment found for ${trackingCode} on this account.`);
    } else if (!order.providerLabelUrl) {
      await sendRawTelegramMessage(chatId, `No document available yet for ${trackingCode} (status: ${order.status}).`);
    } else {
      await sendRawTelegramMessage(chatId, `${trackingCode}: ${order.providerLabelUrl}`);
    }
    return NextResponse.json({ ok: true });
  }

  await sendRawTelegramMessage(chatId, "Commands: /shipments, /documents <tracking code>");
  return NextResponse.json({ ok: true });
}
