import { z } from "zod";
import * as q from "./data-queries.js";

export type StaffToolContext = {
  staff: { name: string; roles: string[] };
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: unknown, ctx: StaffToolContext) => Promise<unknown>;
};

const emptySchema = z.object({});

const searchProductsSchema = z.object({
  query: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(15).optional(),
});

const listOrdersSchema = z.object({
  status: z
    .enum([
      "pending_payment",
      "confirmed",
      "in_production",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ])
    .optional(),
  limit: z.number().int().min(1).max(30).optional(),
});

const getOrderSchema = z.object({
  orderNumber: z.string().min(6).max(32),
});

const lowStockSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

export const STAFF_READ_TOOLS: ToolDefinition[] = [
  {
    name: "get_operations_snapshot",
    description:
      "Live KPIs: orders today, pending payment, in production, low-stock variant count, open customer chat sessions, revenue today (VND).",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => q.getOperationsSnapshot(),
  },
  {
    name: "search_products",
    description: "Search catalog products by name or slug; returns variants with ATP and VND prices.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Product name or slug fragment" },
        limit: { type: "integer", minimum: 1, maximum: 15 },
      },
      required: ["query"],
      additionalProperties: false,
    },
    execute: async (args) => {
      const parsed = searchProductsSchema.parse(args);
      return q.searchProductsForStaff(parsed.query, parsed.limit ?? 8);
    },
  },
  {
    name: "list_orders",
    description: "Recent orders for staff inbox, optional status filter.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [
            "pending_payment",
            "confirmed",
            "in_production",
            "out_for_delivery",
            "delivered",
            "cancelled",
          ],
        },
        limit: { type: "integer", minimum: 1, maximum: 30 },
      },
      additionalProperties: false,
    },
    execute: async (args) => {
      const parsed = listOrdersSchema.parse(args);
      return q.listOrdersForStaff({ status: parsed.status, limit: parsed.limit ?? 10 });
    },
  },
  {
    name: "get_order",
    description: "Look up one order by order number (e.g. MF2601301234).",
    parameters: {
      type: "object",
      properties: {
        orderNumber: { type: "string" },
      },
      required: ["orderNumber"],
      additionalProperties: false,
    },
    execute: async (args) => {
      const parsed = getOrderSchema.parse(args);
      const order = await q.getOrderForStaff(parsed.orderNumber);
      return order ?? { notFound: true, orderNumber: parsed.orderNumber };
    },
  },
  {
    name: "list_low_stock",
    description: "Variants with available quantity 0–3 (limited/unavailable storefront signal).",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    execute: async (args) => {
      const parsed = lowStockSchema.parse(args);
      return q.listLowStockVariants(parsed.limit ?? 15);
    },
  },
];

export async function executeStaffTool(
  name: string,
  args: unknown,
  ctx: StaffToolContext,
): Promise<unknown> {
  const tool = STAFF_READ_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  if (name === "get_operations_snapshot") {
    emptySchema.parse(args ?? {});
  }
  return tool.execute(args ?? {}, ctx);
}

export function openAiToolSpecs() {
  return STAFF_READ_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
