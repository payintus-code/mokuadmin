export const COMMISSION_TIERS = [
  { label: "0 - 30,000 บาท", cap: 30_000, rate: 0.03 },
  { label: "30,001 - 60,000 บาท", cap: 60_000, rate: 0.05 },
  { label: "60,001 - 100,000 บาท", cap: 100_000, rate: 0.08 },
  { label: "ส่วนที่เกิน 100,000 บาท", cap: Number.POSITIVE_INFINITY, rate: 0.1 }
] as const;

export function calculateStaffCommission(serviceIncomeTotal: number) {
  let previousCap = 0;
  let totalCommission = 0;
  const breakdown = COMMISSION_TIERS.map((tier) => {
    const tierAmount = Math.max(0, Math.min(serviceIncomeTotal, tier.cap) - previousCap);
    const commission = tierAmount * tier.rate;
    totalCommission += commission;

    if (Number.isFinite(tier.cap)) {
      previousCap = tier.cap;
    }

    return { ...tier, tierAmount, commission };
  });

  return { totalCommission, breakdown };
}

export function calculateStaffCommissionWithSharedIncome(
  assignedServiceIncome: number,
  unassignedServiceIncome: number,
  receivesUnassignedIncome: boolean
) {
  const serviceIncomeTotal = assignedServiceIncome + (receivesUnassignedIncome ? unassignedServiceIncome : 0);

  return {
    serviceIncomeTotal,
    ...calculateStaffCommission(serviceIncomeTotal)
  };
}
