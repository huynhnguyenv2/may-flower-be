export function formatVnd(amount: string | number | bigint): string {
  const n = typeof amount === "string" ? BigInt(amount) : BigInt(amount);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

export function vndToString(value: { toString(): string } | number): string {
  return String(value).split(".")[0] ?? "0";
}
