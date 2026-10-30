import { z } from "zod";
import { vndToString } from "@may-flower/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { recordAudit } from "./audit.js";

const flowerBodySchema = z.object({
  slug: z.string().min(2).max(80),
  name: z.string().min(1).max(120),
  unit: z.string().min(1).max(40),
  unitPriceVnd: z.number().int().min(0),
  colorTags: z.array(z.string()).optional(),
  seasonalFrom: z.number().int().min(1).max(12).nullable().optional(),
  seasonalTo: z.number().int().min(1).max(12).nullable().optional(),
  shelfLifeDays: z.number().int().min(1).nullable().optional(),
  active: z.boolean().optional(),
});

export async function listAdminFlowers() {
  const rows = await prisma.flower.findMany({ orderBy: { name: "asc" } });
  return rows.map(mapFlower);
}

export async function getAdminFlower(id: string) {
  const row = await prisma.flower.findUnique({ where: { id } });
  if (!row) throw new AppError("NOT_FOUND", "Không tìm thấy hoa", 404);
  return mapFlower(row);
}

export async function createAdminFlower(body: unknown, actorId: string) {
  const parsed = flowerBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Dữ liệu hoa không hợp lệ", 400);
  }
  const data = parsed.data;
  const created = await prisma.flower.create({
    data: {
      slug: data.slug,
      name: data.name,
      unit: data.unit,
      unitPriceVnd: data.unitPriceVnd,
      colorTags: data.colorTags ?? [],
      seasonalFrom: data.seasonalFrom ?? undefined,
      seasonalTo: data.seasonalTo ?? undefined,
      shelfLifeDays: data.shelfLifeDays ?? undefined,
      active: data.active ?? true,
    },
  });
  await recordAudit({
    actorId,
    action: "flower.create",
    entityType: "Flower",
    entityId: created.id,
    payload: { slug: created.slug },
  });
  return mapFlower(created);
}

export async function updateAdminFlower(id: string, body: unknown, actorId: string) {
  const parsed = flowerBodySchema.partial().safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Dữ liệu hoa không hợp lệ", 400);
  }
  const existing = await prisma.flower.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Không tìm thấy hoa", 404);

  const updated = await prisma.flower.update({
    where: { id },
    data: parsed.data,
  });
  await recordAudit({
    actorId,
    action: "flower.update",
    entityType: "Flower",
    entityId: id,
    payload: parsed.data,
  });
  return mapFlower(updated);
}

function mapFlower(row: {
  id: string;
  slug: string;
  name: string;
  unit: string;
  unitPriceVnd: number;
  colorTags: string[];
  seasonalFrom: number | null;
  seasonalTo: number | null;
  shelfLifeDays: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    unit: row.unit,
    unitPriceVnd: vndToString(row.unitPriceVnd),
    colorTags: row.colorTags,
    seasonalFrom: row.seasonalFrom,
    seasonalTo: row.seasonalTo,
    shelfLifeDays: row.shelfLifeDays,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
