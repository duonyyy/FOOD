import { Promotion } from 'src/entities/promotion.entity';

export interface PromotionRuleCheckResult {
  valid: boolean;
  reason?: string;
}

export function checkPromotionRules(
  promotion: Promotion,
  orderValue?: number,
): PromotionRuleCheckResult {
  const now = new Date();

  if (promotion.startDate && promotion.startDate > now) {
    return { valid: false, reason: 'Promotion has not started yet' };
  }

  if (promotion.endDate && promotion.endDate < now) {
    return { valid: false, reason: 'Promotion has expired' };
  }

  if (promotion.maxUsage && promotion.numberOfUsed >= promotion.maxUsage) {
    return { valid: false, reason: 'Promotion usage limit reached' };
  }

  if (promotion.minOrderValue && orderValue && orderValue < Number(promotion.minOrderValue)) {
    return {
      valid: false,
      reason: `Minimum order value of ${promotion.minOrderValue} required`,
    };
  }

  return { valid: true };
}

export function calculatePromotionDiscount(promotion: Promotion, orderAmount: number): number {
  const amount = Number(orderAmount) || 0;
  let discount = 0;

  if (promotion.discountPercent && Number(promotion.discountPercent) > 0) {
    discount = (amount * Number(promotion.discountPercent)) / 100;

    if (promotion.maxDiscountAmount && Number(promotion.maxDiscountAmount) > 0) {
      discount = Math.min(discount, Number(promotion.maxDiscountAmount));
    }
  } else if (promotion.discountAmount && Number(promotion.discountAmount) > 0) {
    discount = Number(promotion.discountAmount);
  }

  if (!Number.isFinite(discount) || discount < 0) {
    return 0;
  }

  return Math.min(discount, amount);
}
