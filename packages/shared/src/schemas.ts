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

export const supportLocaleSchema = z.enum(["vi", "en"]);

export const supportCreateSessionSchema = z.object({
  locale: supportLocaleSchema.optional(),
});

export const supportSendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const supportReplySchema = z.object({
  message: z.string(),
  source: z.enum(["openai", "rules"]),
});

export const recommendationTierSchema = z.object({
  tier: z.enum(["safe", "signature", "unexpected"]),
  tierLabel: z.string(),
  product: productSummarySchema,
  variantId: z.string(),
  priceVnd: moneyVndSchema,
  /** Short Vietnamese note from ChatGPT when AI concierge is enabled */
  rationale: z.string().optional(),
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
export type SupportSendMessage = z.infer<typeof supportSendMessageSchema>;
export type SupportReply = z.infer<typeof supportReplySchema>;

// --- AI Florist ---

export const floristLocaleSchema = supportLocaleSchema;

export const floristCreateSessionSchema = z.object({
  locale: floristLocaleSchema.optional(),
});

export const floristSendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const floristSizeTierSchema = z.enum(["petite", "classic", "grand"]);

export const floristStemLineSchema = z.object({
  flowerId: z.string(),
  quantity: z.number().int().min(1),
});

export const floristMaterialLineSchema = z.object({
  materialId: z.string(),
  quantity: z.number().int().min(1),
});

export const floristAddonLineSchema = z.object({
  addonId: z.string(),
  quantity: z.number().int().min(1),
});

export const floristDesignConfigurationSchema = z.object({
  sizeTier: floristSizeTierSchema.default("classic"),
  stems: z.array(floristStemLineSchema),
  materials: z.array(floristMaterialLineSchema),
  laborFeeVnd: z.number().int().min(0).optional(),
  conceptId: z.string().optional(),
  designName: z.string().optional(),
});

export const floristPreferencesSchema = z.object({
  recipient: z.string().optional(),
  occasion: z.string().optional(),
  budgetVnd: moneyVndSchema.optional(),
  colors: z.string().optional(),
  preferredFlowers: z.string().optional(),
  style: z.string().optional(),
  sizeHint: z.string().optional(),
  deliveryDate: z.string().optional(),
  messageCard: z.string().optional(),
  notes: z.string().optional(),
});

export const floristPriceLineSchema = z.object({
  label: z.string(),
  amountVnd: moneyVndSchema,
});

export const floristPriceBreakdownSchema = z.object({
  lines: z.array(floristPriceLineSchema),
  subtotalVnd: moneyVndSchema,
  deliveryFeeVnd: moneyVndSchema.optional(),
  totalVnd: moneyVndSchema,
  warnings: z.array(z.string()).optional(),
});

export const floristConceptImageSchema = z.object({
  url: z.string(),
  illustrative: z.boolean(),
  disclaimer: z.string(),
});

export const floristConceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  descriptionVi: z.string(),
  palette: z.string(),
  style: z.string(),
  sizeHint: z.string(),
  estimatedSubtotalVnd: moneyVndSchema,
  status: z.enum(["draft", "offered", "selected", "rejected"]),
  composition: z.record(z.unknown()),
  image: floristConceptImageSchema.nullable().optional(),
});

export const floristAddonSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  priceVnd: moneyVndSchema,
  imageUrl: z.string().nullable().optional(),
});

export const floristSessionSummarySchema = z.object({
  sessionId: z.string(),
  status: z.string(),
  locale: floristLocaleSchema,
  preferences: floristPreferencesSchema,
  configuration: floristDesignConfigurationSchema.nullable(),
  selectedAddons: z.array(floristAddonLineSchema),
  priceBreakdown: floristPriceBreakdownSchema.nullable(),
  selectedConcept: floristConceptSchema.nullable().optional(),
  messageCard: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  deliveryZoneSlug: z.string().nullable().optional(),
  deliverySlotId: z.string().nullable().optional(),
});

export const floristMessageEffectsSchema = z.object({
  concepts: z.array(floristConceptSchema).optional(),
  summary: floristSessionSummarySchema.optional(),
  status: z.string().optional(),
});

export const floristMessageReplySchema = z.object({
  message: z.string(),
  source: z.enum(["openai", "rules"]),
  effects: floristMessageEffectsSchema.optional(),
});

export const floristUpdateConfigurationSchema = floristDesignConfigurationSchema.partial();

export const floristUpdateSessionSchema = z.object({
  addons: z.array(floristAddonLineSchema).optional(),
  messageCard: z.string().optional(),
  instructions: z.string().optional(),
  deliveryZoneSlug: z.string().optional(),
  deliverySlotId: z.string().optional(),
});

export const submitCustomOrderRequestSchema = z.object({
  confirm: z.literal(true),
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
  deliveryZoneSlug: z.string(),
  deliverySlotId: z.string(),
  messageCard: z.string().optional(),
  instructions: z.string().optional(),
});

export const customOrderRequestResponseSchema = z.object({
  requestNumber: z.string(),
  status: z.enum(["pending_review", "approved", "declined", "cancelled", "converted"]),
  totalVnd: moneyVndSchema,
  pricing: floristPriceBreakdownSchema,
});

export type FloristPreferences = z.infer<typeof floristPreferencesSchema>;
export type FloristDesignConfiguration = z.infer<typeof floristDesignConfigurationSchema>;
export type FloristAddonLine = z.infer<typeof floristAddonLineSchema>;
export type FloristPriceBreakdown = z.infer<typeof floristPriceBreakdownSchema>;
export type FloristConcept = z.infer<typeof floristConceptSchema>;
export type FloristSessionSummary = z.infer<typeof floristSessionSummarySchema>;
export type SubmitCustomOrderRequest = z.infer<typeof submitCustomOrderRequestSchema>;
