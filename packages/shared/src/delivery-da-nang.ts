/** May Flower — giao hoa nội thành Đà Nẵng (MVP). */

export const DA_NANG_CITY = "Đà Nẵng";

export const DEFAULT_DELIVERY_ZONE_SLUG = "dn-hai-chau";

/** Khu vực giao (slug → phí ship). Seed backend phải khớp danh sách này. */
export const DA_NANG_DELIVERY_ZONES = [
  { slug: "dn-hai-chau", name: "Quận Hải Châu — trung tâm", feeVnd: 35_000 },
  { slug: "dn-son-tra", name: "Quận Sơn Trà — biển & resort", feeVnd: 40_000 },
  { slug: "dn-ngu-hanh-son", name: "Quận Ngũ Hành Sơn", feeVnd: 40_000 },
  { slug: "dn-thanh-khe", name: "Quận Thanh Khê", feeVnd: 40_000 },
  { slug: "dn-cam-le", name: "Quận Cẩm Lệ", feeVnd: 45_000 },
  { slug: "dn-lien-chieu", name: "Quận Liên Chiểu", feeVnd: 45_000 },
  { slug: "dn-hoa-vang", name: "Huyện Hòa Vang — ngoại thành", feeVnd: 65_000 },
] as const;

/** Quận/huyện — chọn khi nhập địa chỉ người nhận. */
export const DA_NANG_DISTRICTS = [
  "Quận Hải Châu",
  "Quận Sơn Trà",
  "Quận Ngũ Hành Sơn",
  "Quận Thanh Khê",
  "Quận Cẩm Lệ",
  "Quận Liên Chiểu",
  "Huyện Hòa Vang",
] as const;

/** Gợi ý địa điểm quen thuộc (placeholder / copy). */
export const DA_NANG_LANDMARK_HINTS = [
  "Cầu Rồng, Hải Châu",
  "Chợ Hàn / Chợ Cồn",
  "Bãi biển Mỹ Khê, Sơn Trà",
  "Bán đảo Sơn Trà — Linh Ứng",
  "Ngũ Hành Sơn",
  "Cầu Sông Hàn — đêm cuối tuần",
  "Sân bay Đà Nẵng",
  "Khu du lịch Bà Nà Hills (Hòa Vang)",
  "Đại học Đà Nẵng — Khu A (Thanh Khê)",
  "Vincom Plaza / Lotte Mart Hải Châu",
] as const;

export const DA_NANG_ADDRESS_PLACEHOLDER =
  "Số nhà, đường — VD: 123 Bạch Đằng, gần Cầu Rồng";
