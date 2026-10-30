/**
 * Ảnh marketing & seed catalog: Pexels (bối cảnh Đà Nẵng) + Unsplash (bó hoa editorial).
 * Mỗi ID đã kiểm tra HTTP 200 trên CDN tương ứng.
 */

export type MediaSource = "pexels" | "unsplash";

export type MediaImageRef = {
  source: MediaSource;
  /** Pexels: số photo id. Unsplash: slug sau `photo-` (vd. `1705058642830-ccec83937fde`). */
  id: number | string;
  alt: string;
  credit?: string;
};

/** @deprecated Dùng {@link MediaImageRef}; giữ alias cho import cũ. */
export type DaNangImageRef = MediaImageRef;

export function pexelsPhoto(id: number, width = 900): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}

export function unsplashPhoto(slug: string, width = 900): string {
  return `https://images.unsplash.com/photo-${slug}?w=${width}&q=85&auto=format&fit=crop`;
}

export function mediaPhoto(ref: Pick<MediaImageRef, "source" | "id">, width = 900): string {
  if (ref.source === "unsplash") return unsplashPhoto(String(ref.id), width);
  return pexelsPhoto(Number(ref.id), width);
}

/** Trang chủ & marketing */
export const DA_NANG_HERO: MediaImageRef = {
  source: "pexels",
  id: 40158746,
  alt: "Cầu Rồng bắc qua sông Hàn, Đà Nẵng",
};

export const DA_NANG_STORY_GALLERY: MediaImageRef[] = [
  {
    source: "pexels",
    id: 40475943,
    alt: "Bãi biển Mỹ Khê, Đà Nẵng — giao hoa dọc bờ biển",
  },
  {
    source: "pexels",
    id: 38806315,
    alt: "Tiệc cưới truyền thống với đèn lồng tại Đà Nẵng",
  },
  {
    source: "unsplash",
    id: "1455659817273-f96807779a8a",
    alt: "Bó hoa pastel — phong cách studio nau.fleur",
  },
];

/** Seed catalog — collections (cảm xúc; Unsplash cho hoa, Pexels khi cần địa danh) */
export const DA_NANG_COLLECTION_IMAGES: Record<string, MediaImageRef> = {
  "nho-ban": {
    source: "unsplash",
    id: "1502672260266-1c1ef2d93688",
    alt: "Bó hoa dịu — Nhớ bạn",
  },
  "cam-on": {
    source: "unsplash",
    id: "1549465220-1a8b9238cd48",
    alt: "Hoa ấm áp — lời cảm ơn",
  },
  "mung-nho": {
    source: "unsplash",
    id: "1705058642830-ccec83937fde",
    alt: "Bó hoa vàng tươi — mừng nhỏ",
  },
  "xin-loi": {
    source: "unsplash",
    id: "1416879595882-3373a0480b5b",
    alt: "Hoa pastel nhẹ — lời xin lỗi chân thành",
  },
  "vi-the-thoi": {
    source: "pexels",
    id: 37829111,
    alt: "Mỹ Khê buổi sáng — vì thế thôi",
  },
  signature: {
    source: "unsplash",
    id: "1526047932273-341f2a7631f9",
    alt: "Bó signature studio",
  },
};

/** Seed catalog — ảnh bìa sản phẩm (Unsplash editorial) */
export const DA_NANG_PRODUCT_IMAGES: Record<string, MediaImageRef> = {
  "binh-minh-ua": {
    source: "unsplash",
    id: "1705058642830-ccec83937fde",
    alt: "Bó vàng ấm — Bình minh dịu",
  },
  "loi-xin-loi-cham": {
    source: "unsplash",
    id: "1578662996442-48f60103fc96",
    alt: "Hồng pastel — Lời xin lỗi chậm",
  },
  "niem-vui-nho": {
    source: "unsplash",
    id: "1723424166641-d770cb1e2060",
    alt: "Tulip tươi — Niềm vui nhỏ",
  },
  "chua-ky-studio": {
    source: "unsplash",
    id: "1586023492125-27b2c045efd7",
    alt: "Hoa signature — Chữ ký Studio",
  },
  "dem-lang": {
    source: "unsplash",
    id: "1558618666-fcd25c85cd64",
    alt: "Tông trầm moody — Đêm lặng",
  },
};

/** Journal listing */
export const DA_NANG_JOURNAL_IMAGES: Record<string, MediaImageRef> = {
  "y-nghia-hoa-hong": {
    source: "unsplash",
    id: "1586023492125-27b2c045efd7",
    alt: "Hoa hồng editorial",
  },
  "cham-hoa-tuoi": {
    source: "unsplash",
    id: "1526047932273-341f2a7631f9",
    alt: "Chăm sóc bó hoa tươi",
  },
};

/** Gợi ý ảnh tiệc / cưới biển Đà Nẵng */
export const DA_NANG_EVENT_IMAGES: MediaImageRef[] = [
  { source: "pexels", id: 7216412, alt: "Cặp đôi cưới bên biển đá, Đà Nẵng" },
  { source: "pexels", id: 38012350, alt: "Áo dài cưới tại chùa Đà Nẵng" },
  { source: "pexels", id: 6434030, alt: "Silhouette cô dâu chú rể lúc hoàng hôn, Đà Nẵng" },
];
