import { PrismaClient, CollectionKind } from "@prisma/client";
import {
  DA_NANG_COLLECTION_IMAGES,
  DA_NANG_DELIVERY_ZONES,
  DA_NANG_PRODUCT_IMAGES,
  pexelsPhoto,
} from "@may-flower/shared";
import { ensureSeedOwner } from "../src/services/auth.js";

const prisma = new PrismaClient();

const pexels = (id: number) => pexelsPhoto(id, 900);

const emotionalCollections = [
  {
    slug: "nho-ban",
    title: "Nhớ bạn",
    story: "Khoảng cách không làm phai một lời nhớ — gửi điều dịu dàng nhất.",
    mood: "nhớ nhung",
    palette: "#C4A484",
    imageUrl: pexels(DA_NANG_COLLECTION_IMAGES["nho-ban"]!),
    kind: CollectionKind.emotional,
  },
  {
    slug: "cam-on",
    title: "Cảm ơn vì đã ở đó",
    story: "Một lời cảm ơn chân thành, gói trong sắc hoa ấm áp.",
    mood: "tri ân",
    palette: "#E8B4B8",
    imageUrl: pexels(DA_NANG_COLLECTION_IMAGES["cam-on"]!),
    kind: CollectionKind.emotional,
  },
  {
    slug: "mung-nho",
    title: "Một chút mừng",
    story: "Niềm vui nhỏ cũng đáng được tôn vinh.",
    mood: "vui tươi",
    palette: "#F4A261",
    imageUrl: pexels(DA_NANG_COLLECTION_IMAGES["mung-nho"]!),
    kind: CollectionKind.emotional,
  },
  {
    slug: "xin-loi",
    title: "Xin lỗi",
    story: "Hoa không nói thay lời bạn — nhưng giúp lời xin lỗi chân thành hơn.",
    mood: "chân thành",
    palette: "#9B8BAA",
    imageUrl: pexels(DA_NANG_COLLECTION_IMAGES["xin-loi"]!),
    kind: CollectionKind.emotional,
  },
  {
    slug: "vi-the-thoi",
    title: "Vì thế thôi",
    story: "Không cần dịp — chỉ cần muốn làm ai đó mỉm cười.",
    mood: "nhẹ nhàng",
    palette: "#A7C4A0",
    imageUrl: pexels(DA_NANG_COLLECTION_IMAGES["vi-the-thoi"]!),
    kind: CollectionKind.emotional,
  },
];

const tags = [
  { slug: "nho-ban", label: "Nhớ bạn" },
  { slug: "cam-on", label: "Cảm ơn" },
  { slug: "mung", label: "Mừng" },
  { slug: "xin-loi", label: "Xin lỗi" },
  { slug: "vi-thuong", label: "Vì thương" },
];

const products = [
  {
    slug: "binh-minh-ua",
    name: "Bình minh dịu",
    story: "Hướng dương và cúc họa mi — ấm áp như ánh sáng đầu ngày.",
    description: "Bó hoa tươi với hướng dương, cúc họa mi và lá eucalyptus. Phù hợp gửi lời nhớ hoặc cảm ơn.",
    imageUrl: pexels(DA_NANG_PRODUCT_IMAGES["binh-minh-ua"]!),
    featured: true,
    tagSlugs: ["nho-ban", "cam-on"],
    collectionSlugs: ["nho-ban", "cam-on"],
    variants: [
      { sku: "BM-S", sizeLabel: "Nhỏ", priceVnd: 650000, qty: 8 },
      { sku: "BM-M", sizeLabel: "Vừa", priceVnd: 850000, qty: 5 },
      { sku: "BM-L", sizeLabel: "Lớn", priceVnd: 1100000, qty: 2 },
    ],
  },
  {
    slug: "loi-xin-loi-cham",
    name: "Lời xin lỗi chậm",
    story: "Tím lavender và hồng pastel — dịu và thành thật.",
    description: "Sắc tím nhẹ và hồng phấn, gói giấy kraft cao cấp.",
    imageUrl: pexels(DA_NANG_PRODUCT_IMAGES["loi-xin-loi-cham"]!),
    featured: true,
    tagSlugs: ["xin-loi"],
    collectionSlugs: ["xin-loi"],
    variants: [
      { sku: "XL-S", sizeLabel: "Nhỏ", priceVnd: 720000, qty: 6 },
      { sku: "XL-M", sizeLabel: "Vừa", priceVnd: 920000, qty: 4 },
    ],
  },
  {
    slug: "niem-vui-nho",
    name: "Niềm vui nhỏ",
    story: "Mix màu tươi — như tiếng cười bất chợt.",
    description: "Hoa mùa mix, phong cách tự nhiên, ribbon satin.",
    imageUrl: pexels(DA_NANG_PRODUCT_IMAGES["niem-vui-nho"]!),
    featured: true,
    tagSlugs: ["mung", "vi-thuong"],
    collectionSlugs: ["mung-nho", "vi-the-thoi"],
    variants: [
      { sku: "NV-S", sizeLabel: "Nhỏ", priceVnd: 580000, qty: 10 },
      { sku: "NV-M", sizeLabel: "Vừa", priceVnd: 780000, qty: 7 },
    ],
  },
  {
    slug: "chua-ky-studio",
    name: "Chữ ký Studio",
    story: "Composition độc quyền của May Flower — hoa nhập và hoa Việt.",
    description: "Bó signature với rose Ecuador, cỏ vẩn và wrapping editorial.",
    imageUrl: pexels(DA_NANG_PRODUCT_IMAGES["chua-ky-studio"]!),
    featured: true,
    tagSlugs: ["cam-on", "mung"],
    collectionSlugs: ["cam-on", "mung-nho"],
    variants: [
      { sku: "CK-M", sizeLabel: "Vừa", priceVnd: 1250000, qty: 3 },
      { sku: "CK-L", sizeLabel: "Lớn", priceVnd: 1650000, qty: 2 },
    ],
  },
  {
    slug: "dem-lang",
    name: "Đêm lặng",
    story: "Tông trầm bất ngờ — dành cho ai thích khác biệt tinh tế.",
    description: "Hoa tối màu, lá xám-xanh, phong cách moody editorial.",
    imageUrl: pexels(DA_NANG_PRODUCT_IMAGES["dem-lang"]!),
    featured: false,
    tagSlugs: ["nho-ban", "vi-thuong"],
    collectionSlugs: ["nho-ban", "vi-the-thoi"],
    variants: [
      { sku: "DL-M", sizeLabel: "Vừa", priceVnd: 990000, qty: 4 },
    ],
  },
];

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.deliverySlot.deleteMany();
  await prisma.productEmotionalTag.deleteMany();
  await prisma.productCollection.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.emotionalTag.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.conciergeSession.deleteMany();

  for (const t of tags) {
    await prisma.emotionalTag.create({ data: t });
  }

  for (let i = 0; i < emotionalCollections.length; i++) {
    const c = emotionalCollections[i]!;
    await prisma.collection.create({
      data: { ...c, sortOrder: i },
    });
  }

  await prisma.collection.create({
    data: {
      slug: "signature",
      title: "Chữ ký May Flower",
      story: "Những thiết kế đặc trưng của studio.",
      mood: "editorial",
      palette: "#5C4033",
      imageUrl: pexels(DA_NANG_COLLECTION_IMAGES.signature!),
      kind: CollectionKind.signature,
      sortOrder: 10,
    },
  });

  const tagMap = Object.fromEntries(
    (await prisma.emotionalTag.findMany()).map((t) => [t.slug, t.id]),
  );
  const collMap = Object.fromEntries(
    (await prisma.collection.findMany()).map((c) => [c.slug, c.id]),
  );

  for (const p of products) {
    const product = await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        story: p.story,
        description: p.description,
        imageUrl: p.imageUrl,
        featured: p.featured,
        variants: {
          create: p.variants.map((v) => ({
            sku: v.sku,
            sizeLabel: v.sizeLabel,
            priceVnd: v.priceVnd,
            availableQuantity: v.qty,
          })),
        },
      },
    });

    for (const slug of p.tagSlugs) {
      await prisma.productEmotionalTag.create({
        data: { productId: product.id, tagId: tagMap[slug]! },
      });
    }
    for (const slug of p.collectionSlugs) {
      await prisma.productCollection.create({
        data: { productId: product.id, collectionId: collMap[slug]! },
      });
    }
  }

  const slotTemplates = [
    { start: "09:00", end: "12:00", cap: 20 },
    { start: "13:00", end: "17:00", cap: 25 },
    { start: "17:00", end: "20:00", cap: 15 },
  ];
  const today = new Date();

  for (const z of DA_NANG_DELIVERY_ZONES) {
    const zone = await prisma.deliveryZone.create({
      data: {
        slug: z.slug,
        name: z.name,
        feeVnd: z.feeVnd,
      },
    });

    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() + d);
      date.setUTCHours(0, 0, 0, 0);
      for (const slot of slotTemplates) {
        await prisma.deliverySlot.create({
          data: {
            zoneId: zone.id,
            date,
            startTime: slot.start,
            endTime: slot.end,
            capacity: slot.cap,
          },
        });
      }
    }
  }

  await ensureSeedOwner();
  console.log("Seed completed (catalog + staff owner).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
