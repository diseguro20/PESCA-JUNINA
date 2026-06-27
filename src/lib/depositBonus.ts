export const FIRST_DEPOSIT_BONUS_RATE = 1;

export function calculateFirstDepositCredit(amount: number, bonusEligible: boolean) {
  const baseAmount = Number(amount.toFixed(2));
  const bonusAmount = bonusEligible ? Number((baseAmount * FIRST_DEPOSIT_BONUS_RATE).toFixed(2)) : 0;
  const creditedAmount = Number((baseAmount + bonusAmount).toFixed(2));

  return {
    bonusAmount,
    creditedAmount,
    bonusApplied: bonusAmount > 0
  };
}
