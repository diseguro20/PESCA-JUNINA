export const MIN_PIX_WITHDRAWAL_AMOUNT = 5;

export function formatCurrencyBR(amount: number): string {
  return amount.toFixed(2).replace('.', ',');
}

export function getMinPixWithdrawalMessage(): string {
  return `Valor minimo do saque nao atingido. Minimo: R$ ${formatCurrencyBR(MIN_PIX_WITHDRAWAL_AMOUNT)}.`;
}
