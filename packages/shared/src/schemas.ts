import { z } from "zod";

export const moneyVndSchema = z.string().regex(/^\d+$/);

export const collectionSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  story: z.string(),
  kind: z.enum(["emotional", "signature", "seasonal"]),
  mood: z.string(),
  palette: z.string(),
  imageUrl: z.string().nullable().optional(),
  productCount: z.number().optional(),
});

export const productSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  story: z.string(),
  imageUrl: z.string().nullable(),
  fromPriceVnd: moneyVndSchema,
  isAvailable: z.boolean(),
  availabilityLabel: z.enum(["available", "limited", "unavailable"]),
});

export const productVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  sizeLabel: z.string(),
  priceVnd: moneyVndSchema,
  availableQuantity: z.number(),
  isAvailable: z.boolean(),
});

export const productDetailSchema = productSummarySchema.extend({
  description: z.string(),
  variants: z.array(productVariantSchema),
  emotionalTags: z.array(z.string()),
});

export const collectionDetailSchema = collectionSummarySchema.extend({
  products: z.array(productSummarySchema),
});

export const conciergeAnswersSchema = z.object({
  recipient: z.string().min(1),
  occasion: z.string().min(1),
  feeling: z.string().min(1),
  budgetVnd: moneyVndSchema,
  colors: z.string().optional(),
  deliveryDate: z.string().optional(),
});

export const recommendationTierSchema = z.object({
  tier: z.enum(["safe", "signature", "unexpected"]),
  tierLabel: z.string(),
  product: productSummarySchema,
  variantId: z.string(),
  priceVnd: moneyVndSchema,
});

export const deliveryZoneSchema = z.object({
  slug: z.string(),
  name: z.string(),
  feeVnd: moneyVndSchema,
});

export const deliverySlotSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  available: z.boolean(),
});

export const createOrderItemSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().min(1),
});

export const createOrderRequestSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(8),
  }),
  recipient: z.object({
    name: z.string().min(1),
    phone: z.string().min(8),
    addressLine1: z.string().min(1),
    district: z.string().min(1),
    city: z.string().min(1),
    note: z.string().optional(),
  }),
  items: z.array(createOrderItemSchema).min(1),
  messageCard: z.string().optional(),
  deliveryZoneSlug: z.string(),
  deliverySlotId: z.string(),
});

export const orderResponseSchema = z.object({
  orderNumber: z.string(),
  status: z.string(),
  subtotalVnd: moneyVndSchema,
  deliveryFeeVnd: moneyVndSchema,
  totalVnd: moneyVndSchema,
  deliverySlot: deliverySlotSchema,
});

export type CollectionSummary = z.infer<typeof collectionSummarySchema>;
export type ProductSummary = z.infer<typeof productSummarySchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type RecommendationTier = z.infer<typeof recommendationTierSchema>;
export type ConciergeAnswers = z.infer<typeof conciergeAnswersSchema>;
