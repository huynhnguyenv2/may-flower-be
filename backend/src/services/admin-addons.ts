import { z } from "zod";
import { vndToString } from "@may-flower/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { recordAudit } from "./audit.js";

const addonBodySchema = z.object({
  slug: z.string().min(2).max(80),
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  priceVnd: z.number().int().min(0),
  imageUrl: z.string().url().nullable().optional(),
  occasionTags: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export async function listAdminAddons() {
  const rows = await prisma.addon.findMany({ orderBy: { name: "asc" } });
  return rows.map(mapAddon);
}

export async function getAdminAddon(id: string) {
  const row = await prisma.addon.findUnique({ where: { id } });
  if (!row) throw new AppError("NOT_FOUND", "Không tìm thấy add-on", 404);
  return mapAddon(row);
}

export async function createAdminAddon(body: unknown, actorId: string) {
  const parsed = addonBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Dữ liệu add-on không hợp lệ", 400);
  }
  const data = parsed.data;
  const created = await prisma.addon.create({
    data: {
      slug: data.slug,
      name: data.name,
      category: data.category,
      priceVnd: data.priceVnd,
      imageUrl: data.imageUrl ?? undefined,
      occasionTags: data.occasionTags ?? [],
      active: data.active ?? true,
    },
  });
  await recordAudit({
    actorId,
    action: "addon.create",
    entityType: "Addon",
    entityId: created.id,
    payload: { slug: created.slug },
  });
  return mapAddon(created);
}

export async function updateAdminAddon(id: string, body: unknown, actorId: string) {
  const parsed = addonBodySchema.partial().safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Dữ liệu add-on không hợp lệ", 400);
  }
  const existing = await prisma.addon.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Không tìm thấy add-on", 404);

  const updated = await prisma.addon.update({
    where: { id },
    data: parsed.data,
  });
  await recordAudit({
    actorId,
    action: "addon.update",
    entityType: "Addon",
    entityId: id,
    payload: parsed.data,
  });
  return mapAddon(updated);
}

function mapAddon(row: {
  id: string;
  slug: string;
  name: string;
  category: string;
  priceVnd: number;
  imageUrl: string | null;
  occasionTags: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    priceVnd: vndToString(row.priceVnd),
    imageUrl: row.imageUrl,
    occasionTags: row.occasionTags,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
