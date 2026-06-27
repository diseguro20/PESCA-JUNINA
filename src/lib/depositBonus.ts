export const FIRST_DEPOSIT_BONUS_RATE = 1;
export const DEFAULT_BONUS_ROLLOVER_MULTIPLIER = 2;

export function calculateFirstDepositCredit(amount: number, bonusEligible: boolean, rolloverMultiplier = DEFAULT_BONUS_ROLLOVER_MULTIPLIER) {
  const baseAmount = Number(amount.toFixed(2));
  const bonusAmount = bonusEligible ? Number((baseAmount * FIRST_DEPOSIT_BONUS_RATE).toFixed(2)) : 0;
  const creditedAmount = Number((baseAmount + bonusAmount).toFixed(2));
  const rolloverRequired = bonusAmount > 0 ? Number((bonusAmount * rolloverMultiplier).toFixed(2)) : 0;

  return {
    bonusAmount,
    creditedAmount,
    rolloverRequired,
    bonusApplied: bonusAmount > 0
  };
}
