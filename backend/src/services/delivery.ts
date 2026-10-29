import { vndToString } from "@may-flower/shared";
import { prisma } from "../lib/prisma.js";

export async function listZones() {
  const zones = await prisma.deliveryZone.findMany({ where: { active: true } });
  return zones.map((z) => ({
    slug: z.slug,
    name: z.name,
    feeVnd: vndToString(z.feeVnd),
  }));
}

export async function listSlots(zoneSlug: string, dateStr: string) {
  const zone = await prisma.deliveryZone.findFirst({
    where: { slug: zoneSlug, active: true },
  });
  if (!zone) return null;

  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const slots = await prisma.deliverySlot.findMany({
    where: { zoneId: zone.id, date },
    orderBy: { startTime: "asc" },
  });

  return slots.map((s) => ({
    id: s.id,
    date: dateStr,
    startTime: s.startTime,
    endTime: s.endTime,
    available: s.bookedCount < s.capacity,
  }));
}
