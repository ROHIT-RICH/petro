
// src/utils/generateCouponCode.js

/**
 * ✅ Generate a single random coupon code
 * @param {string} prefix - Optional prefix (e.g., "PETRO")
 * @param {number} length - Number of random characters to add
 */
export const generateCoupon = (prefix = "", length = 8) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomPart = "";
  for (let i = 0; i < length; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix ? `${prefix}-${randomPart}` : randomPart;
};

/**
 * ✅ Generate multiple coupon codes at once
 * @param {string} prefix - Optional prefix
 * @param {number} count - Number of codes to generate
 * @param {number} length - Length of random part
 */
export const generateBulk = (prefix = "", count = 10, length = 8) => {
  const coupons = [];
  for (let i = 0; i < count; i++) {
    coupons.push(generateCoupon(prefix, length));
  }
  return coupons;
};

