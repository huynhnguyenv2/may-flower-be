import { vndToString } from "@may-flower/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export async function listAdminCustomers(filters: { q?: string; limit?: number }) {
  const take = Math.min(filters.limit ?? 50, 100);
  const q = filters.q?.trim();

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            ...(q.includes("@") ? [{ email: { contains: q } }] : []),
          ],
        }
      : undefined,
    orderBy: { id: "desc" },
    take,
    include: {
      _count: { select: { orders: true, customOrderRequests: true } },
    },
  });

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    orderCount: c._count.orders,
    customRequestCount: c._count.customOrderRequests,
  }));
}

export async function getAdminCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
      customOrderRequests: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!customer) throw new AppError("NOT_FOUND", "Không tìm thấy khách hàng", 404);

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    orders: customer.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      channel: o.channel,
      totalVnd: vndToString(o.totalVnd),
      createdAt: o.createdAt.toISOString(),
    })),
    customOrderRequests: customer.customOrderRequests.map((r) => ({
      id: r.id,
      requestNumber: r.requestNumber,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
