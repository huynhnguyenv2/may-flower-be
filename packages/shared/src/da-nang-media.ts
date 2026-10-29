/**
 * Ảnh Pexels gắn địa điểm Đà Nẵng (hoa, biển, cầu, tiệc).
 * Mỗi ID đã kiểm tra HTTP 200 trên CDN.
 */

export function pexelsPhoto(id: number, width = 900): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}

export type DaNangImageRef = {
  id: number;
  alt: string;
  credit?: string;
};

/** Trang chủ & marketing */
export const DA_NANG_HERO: DaNangImageRef = {
  id: 40158746,
  alt: "Cầu Rồng bắc qua sông Hàn, Đà Nẵng",
};

export const DA_NANG_STORY_GALLERY: DaNangImageRef[] = [
  {
    id: 40475943,
    alt: "Bãi biển Mỹ Khê, Đà Nẵng — giao hoa dọc bờ biển",
  },
  {
    id: 38806315,
    alt: "Tiệc cưới truyền thống với đèn lồng tại Đà Nẵng",
  },
  {
    id: 36388273,
    alt: "Hoa cẩm tú cầu tại Đà Nẵng",
  },
];

/** Seed catalog — collections (cảm xúc + bối cảnh ĐN) */
export const DA_NANG_COLLECTION_IMAGES: Record<string, number> = {
  "nho-ban": 36123464, // hoàng hôn Mỹ Khê
  "cam-on": 28411758, // Cầu Sông Hàn lúc hoàng hôn
  "mung-nho": 38806315, // tiệc mừng ĐN
  "xin-loi": 35151100, // bình minh biển — lời chân thành
  "vi-the-thoi": 37829111, // Mỹ Khê buổi sáng
  signature: 37982951, // Ngũ Hành Sơn
};

/** Seed catalog — ảnh bìa sản phẩm (bó hoa khớp story; không dùng cảnh địa danh) */
export const DA_NANG_PRODUCT_IMAGES: Record<string, number> = {
  "binh-minh-ua": 931154, // hướng dương / vàng ấm — Bình minh dịu
  "loi-xin-loi-cham": 1457812, // hồng tím pastel — Lời xin lỗi chậm
  "niem-vui-nho": 1022923, // mix màu tươi — Niềm vui nhỏ
  "chua-ky-studio": 2879824, // rose signature — Chữ ký Studio
  "dem-lang": 1181636, // tông trầm moody — Đêm lặng
};

/** Gợi ý ảnh tiệc / cưới biển Đà Nẵng */
export const DA_NANG_EVENT_IMAGES: DaNangImageRef[] = [
  { id: 7216412, alt: "Cặp đôi cưới bên biển đá, Đà Nẵng" },
  { id: 38012350, alt: "Áo dài cưới tại chùa Đà Nẵng" },
  { id: 6434030, alt: "Silhouette cô dâu chú rể lúc hoàng hôn, Đà Nẵng" },
];
