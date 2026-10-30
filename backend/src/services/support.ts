import { vndToString } from "@may-flower/shared";
import { prisma } from "../lib/prisma.js";
import { completeChat, type ChatMessage } from "./llm/openai-client.js";
import * as catalog from "./catalog.js";
import * as orders from "./orders.js";

const ORDER_NUMBER_RE = /\bMF\d{6,}\b/i;

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_HISTORY = 14;

export async function createSession(locale: "vi" | "en" = "vi") {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  return prisma.supportSession.create({
    data: { expiresAt, locale },
  });
}

async function loadSession(sessionId: string) {
  const session = await prisma.supportSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: MAX_HISTORY },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

async function buildSupportContext(locale: "vi" | "en"): Promise<string> {
  const zones = await prisma.deliveryZone.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  const collections = await prisma.collection.findMany({
    where: { active: true },
    take: 8,
    orderBy: { sortOrder: "asc" },
    select: { slug: true, title: true },
  });

  const zoneLines = zones
    .map((z) => `- ${z.name}: phí giao ${vndToString(z.feeVnd)} VND`)
    .join("\n");

  const collectionLines = collections.map((c) => `- ${c.title} (/collections/${c.slug})`).join("\n");

  const featured = await catalog.listFeaturedProducts(6);
  const inStock = featured.filter((p) => p.isAvailable);
  const productLines = inStock
    .map(
      (p) =>
        `- ${p.name}: from ${p.fromPriceVnd} VND (${p.availabilityLabel}) → /products/${p.slug}`,
    )
    .join("\n");

  if (locale === "en") {
    return `May Flower Studio — premium florist in Da Nang, Vietnam.
Website paths: /collections (catalog), /find-your-flowers (AI bouquet wizard), /cart, /journal.
Delivery zones (Da Nang):
${zoneLines || "- See checkout for zones"}
Collections:
${collectionLines || "- Browse /collections"}
Featured in stock (live catalog):
${productLines || "- See /collections"}
Rules: Prices in VND (integers). Do not invent products or prices. For bouquet picks, suggest /find-your-flowers.
If the customer gives an order number (MF…), you may state status and total from the order lookup block when present.
Payment: online checkout; dev sites may skip payment. Be warm, concise, honest.`;
  }

  return `May Flower Studio — studio hoa cao cấp tại Đà Nẵng.
Đường dẫn site: /collections (catalog), /find-your-flowers (tư vấn chọn hoa), /cart, /journal.
Khu vực giao hàng (Đà Nẵng):
${zoneLines || "- Xem khi checkout"}
Bộ sưu tập:
${collectionLines || "- Xem /collections"}
Hoa nổi bật còn tồn (catalog thật):
${productLines || "- Xem /collections"}
Quy tắc: Giá VND (số nguyên). Không bịa sản phẩm hay giá. Gợi ý chọn hoa → /find-your-flowers.
Nếu khách gửi mã đơn MF…, dùng khối tra đơn bên dưới (nếu có) để nói trạng thái và tổng tiền.
Thanh toán: checkout online. Trả lời ấm áp, ngắn gọn, trung thực.`;
}

async function orderLookupBlock(content: string, locale: "vi" | "en"): Promise<string> {
  const match = content.match(ORDER_NUMBER_RE);
  if (!match) return "";
  const order = await orders.getOrderByNumber(match[0].toUpperCase());
  if (!order) {
    return locale === "en"
      ? `\nOrder lookup: ${match[0].toUpperCase()} not found.`
      : `\nTra đơn: không thấy ${match[0].toUpperCase()}.`;
  }
  return locale === "en"
    ? `\nOrder lookup: ${order.orderNumber} status=${order.status}, total=${order.totalVnd} VND, items=${order.items.length}.`
    : `\nTra đơn: ${order.orderNumber} trạng thái=${order.status}, tổng=${order.totalVnd} VND, ${order.items.length} dòng.`;
}

async function fallbackReply(content: string, locale: "vi" | "en"): Promise<string> {
  const text = content.toLowerCase();

  const has = (...words: string[]) => words.some((w) => text.includes(w));

  if (locale === "en") {
    if (has("delivery", "ship", "zone", "fee"))
      return "We deliver across Da Nang districts. Fees appear at checkout by zone. Need a specific time? Choose a slot when placing your order.";
    if (has("price", "cost", "vnd", "how much"))
      return "Every bouquet shows VND prices from our live catalog. Open Collections or use Find your flowers for suggestions within your budget.";
    if (has("order", "track", "status"))
      return "Share your order number and phone — our team will confirm status. For new orders, use Cart → Checkout.";
    if (has("flower", "bouquet", "recommend", "gift"))
      return "Try our Find your flowers wizard (/find-your-flowers) — it suggests real in-stock bouquets by feeling and budget.";
    return "Thanks for reaching out! I'm May Flower's assistant. Ask about delivery in Da Nang, pricing, or choosing a bouquet — or visit /find-your-flowers for personalized picks.";
  }

  if (has("giao", "ship", "khu vực", "quận", "phí"))
    return "Studio giao tại các quận Đà Nẵng — phí giao hiện khi checkout theo khu vực. Bạn chọn khung giờ giao lúc đặt hàng nhé.";
  if (has("giá", "bao nhiêu", "vnd", "tiền"))
    return "Giá từng bó nằm trên catalog (VND, minh bạch). Vào Bộ sưu tập hoặc Tìm hoa cho bạn để gợi ý theo ngân sách.";
  if (has("đơn", "order", "mã", "trạng thái")) {
    const match = content.match(ORDER_NUMBER_RE);
    if (match) {
      const order = await orders.getOrderByNumber(match[0].toUpperCase());
      if (order) {
        return `Đơn ${order.orderNumber}: trạng thái ${order.status}, tổng ${order.totalVnd} VND. Cần đổi giờ giao? Nhắn SĐT đặt hàng để team hỗ trợ.`;
      }
    }
    return "Bạn gửi mã đơn (MF…) — mình tra trạng thái ngay. Đặt mới: thêm giỏ → Checkout.";
  }
  if (has("hoa", "bó", "tặng", "gợi ý", "chọn"))
    return "Bạn thử Tìm hoa cho bạn (/find-your-flowers): vài câu hỏi — gợi ý từ hoa thật còn tồn kho.";
  return "Chào bạn! Mình hỗ trợ May Flower Đà Nẵng — hỏi về giao hàng, giá, chọn hoa, hoặc vào /find-your-flowers để được gợi ý nhé.";
}

export async function sendMessage(sessionId: string, content: string) {
  const session = await loadSession(sessionId);
  if (!session) return null;

  const locale = session.locale === "en" ? "en" : "vi";
  const trimmed = content.trim().slice(0, 2000);
  if (!trimmed) {
    return { source: "rules" as const, message: await fallbackReply("help", locale) };
  }

  await prisma.supportMessage.create({
    data: { sessionId, role: "user", content: trimmed },
  });

  const history: ChatMessage[] = session.messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
  history.push({ role: "user", content: trimmed });

  const system = await buildSupportContext(locale);
  const orderBlock = await orderLookupBlock(trimmed, locale);
  const llmMessages: ChatMessage[] = [
    {
      role: "system",
      content: `${system}${orderBlock}\nReply in ${locale === "en" ? "English" : "Vietnamese"}. Plain text only, no markdown links — mention paths like /find-your-flowers.`,
    },
    ...history.slice(-MAX_HISTORY),
  ];

  let reply = await completeChat(llmMessages, { temperature: 0.55, maxTokens: 450 });
  let source: "openai" | "rules" = "openai";

  if (!reply) {
    source = "rules";
    reply = await fallbackReply(trimmed, locale);
  }

  await prisma.supportMessage.create({
    data: { sessionId, role: "assistant", content: reply },
  });

  return { source, message: reply };
}
