import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../lib/firebaseAdmin';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';
import { verifyDepositStatus } from '../../../../lib/paymentService';
import { calculateFirstDepositCredit } from '../../../../lib/depositBonus';

type NormalizedDepositWebhook = {
  paymentId: string;
  gatewayTransactionId: string;
  identifier: string;
  status: string;
  amount?: number;
  email: string;
  paidAt: string | null;
};

type NormalizedWithdrawalWebhook = {
  payoutId: string;
  identifier: string;
  status: string;
  message: string;
};

const PAID_STATUSES = new Set(['approved', 'paid', 'completed', 'complete', 'success', 'succeeded', 'ok', 'confirmed']);
const FAILED_DEPOSIT_STATUSES = new Set(['rejected', 'failed', 'refunded', 'frozen', 'cancelled', 'canceled', 'expired', 'chargeback', 'charged_back']);
const FAILED_WITHDRAWAL_STATUSES = new Set(['canceled', 'cancelled', 'failed', 'rejected', 'refused', 'returned']);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[Webhook VizzionPay] Recebido payload:", JSON.stringify(body));

    const webhookToken = process.env.VIZZIONPAY_WEBHOOK_TOKEN;
    const providedToken =
      req.headers.get('x-webhook-token') ||
      req.headers.get('x-vizzionpay-token') ||
      body.token ||
      body.webhookToken;

    if (webhookToken && providedToken !== webhookToken) {
      console.warn("[Webhook VizzionPay] Tentativa de acesso com token de webhook invalido.");
      return NextResponse.json({ error: 'Token invalido' }, { status: 403 });
    }

    if (isWithdrawalPayload(body)) {
      return await handleWithdrawalWebhook(body);
    }

    return await handleDepositWebhook(body, Boolean(webhookToken));
  } catch (error: any) {
    console.error("[Webhook VizzionPay] Erro interno no processamento:", error);
    return NextResponse.json({ error: 'Erro interno no webhook' }, { status: 500 });
  }
}

function getFirstString(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }

  return '';
}

function normalizeStatus(value: any): string {
  return getFirstString(value).toLowerCase().replace(/^transaction_/, '').replace(/^transfer_/, '');
}

function normalizeAmount(value: any): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return undefined;
  }

  return Number(amount.toFixed(2));
}

function isPaidStatus(status: string): boolean {
  return PAID_STATUSES.has(normalizeStatus(status));
}

function isDepositFailedStatus(status: string): boolean {
  return FAILED_DEPOSIT_STATUSES.has(normalizeStatus(status));
}

function isWithdrawalFailedStatus(status: string): boolean {
  return FAILED_WITHDRAWAL_STATUSES.has(normalizeStatus(status));
}

function isWithdrawalPayload(body: any): boolean {
  const event = normalizeStatus(body.event || body.type);
  return event.startsWith('withdraw') || event.startsWith('transfer') || Boolean(body.withdraw || body.withdrawal || body.transfer);
}

function normalizeDepositPayload(body: any): NormalizedDepositWebhook {
  const transaction = body.transaction || body.payment || body.deposit || body;
  const eventStatus = normalizeStatus(body.event || body.type);

  return {
    paymentId: getFirstString(
      transaction.payment_id,
      body.payment_id,
      transaction.paymentId,
      body.paymentId,
      transaction.id,
      body.id
    ),
    gatewayTransactionId: getFirstString(
      transaction.transaction_id,
      body.transaction_id,
      transaction.transactionId,
      body.transactionId
    ),
    identifier: getFirstString(
      transaction.identifier,
      body.identifier,
      transaction.clientIdentifier,
      body.clientIdentifier,
      transaction.externalId,
      body.externalId
    ),
    status: normalizeStatus(transaction.status || body.status || eventStatus),
    amount: normalizeAmount(transaction.amount ?? body.amount ?? transaction.value ?? body.value),
    email: getFirstString(
      transaction.client?.email,
      body.client?.email,
      transaction.customer?.email,
      body.customer?.email,
      transaction.payer?.email,
      body.payer?.email,
      body.email
    ).toLowerCase(),
    paidAt: getFirstString(transaction.paid_at, body.paid_at, transaction.paidAt, body.paidAt, transaction.payedAt, body.payedAt) || null
  };
}

function normalizeWithdrawalPayload(body: any): NormalizedWithdrawalWebhook {
  const withdraw = body.withdraw || body.withdrawal || body.transfer || body;
  const eventStatus = normalizeStatus(body.event || body.type);

  return {
    payoutId: getFirstString(
      withdraw.id,
      body.id,
      withdraw.withdraw_id,
      body.withdraw_id,
      withdraw.transfer_id,
      body.transfer_id
    ),
    identifier: getFirstString(
      withdraw.clientIdentifier,
      body.clientIdentifier,
      withdraw.identifier,
      body.identifier,
      withdraw.externalId,
      body.externalId
    ),
    status: normalizeStatus(withdraw.status || body.status || eventStatus),
    message: getFirstString(withdraw.message, body.message, withdraw.error, body.error)
  };
}

function amountsMatch(localAmount: number, gatewayAmount?: number): boolean {
  if (gatewayAmount === undefined) {
    return true;
  }

  return Math.abs(Number(localAmount) - gatewayAmount) < 0.01;
}

async function hasPreviousApprovedDeposit(uid: string, currentDepositId?: string): Promise<boolean> {
  if (!adminDb) {
    return false;
  }

  const depositsSnap = await adminDb.collection('deposits')
    .where('uid', '==', uid)
    .limit(20)
    .get();

  return depositsSnap.docs.some((doc: any) =>
    doc.id !== currentDepositId &&
    ['approved', 'paid'].includes(doc.data()?.status)
  );
}

function extractVerifiedStatus(data: any): string {
  return normalizeStatus(
    data?.status ||
    data?.transaction?.status ||
    data?.payment?.status ||
    data?.data?.status ||
    data?.data?.transaction?.status
  );
}

async function verifyGatewayPayment(deposit: NormalizedDepositWebhook, hasWebhookToken: boolean): Promise<boolean> {
  const verifyId = deposit.paymentId || deposit.gatewayTransactionId;

  if (!verifyId) {
    return false;
  }

  try {
    const verifiedData = await verifyDepositStatus(verifyId);
    const verifiedStatus = extractVerifiedStatus(verifiedData);

    if (isPaidStatus(verifiedStatus)) {
      return true;
    }

    console.warn(`[Webhook VizzionPay] Verificacao recusou pagamento ${verifyId}. Status consultado: "${verifiedStatus || 'desconhecido'}".`);
    return false;
  } catch (verifyError: any) {
    if (hasWebhookToken) {
      console.warn(`[Webhook VizzionPay] Consulta de status falhou para ${verifyId}, mas o webhook possui token configurado. Prosseguindo.`, verifyError);
      return true;
    }

    console.error(`[Webhook VizzionPay] Consulta de status falhou para ${verifyId} e nenhum token de webhook esta configurado.`, verifyError);
    return false;
  }
}

async function handleDepositWebhook(body: any, hasWebhookToken: boolean) {
  const deposit = normalizeDepositPayload(body);

  if ((!deposit.paymentId && !deposit.gatewayTransactionId && !deposit.identifier) || !deposit.status) {
    return NextResponse.json({ error: 'Payload de deposito invalido' }, { status: 400 });
  }

  if (!isPaidStatus(deposit.status)) {
    await updateUnpaidDepositStatus(deposit);
    console.log(`[Webhook VizzionPay] Deposito ${deposit.paymentId || deposit.identifier} com status "${deposit.status}". Nenhuma alteracao de saldo.`);
    return NextResponse.json({ success: true, message: 'Status recebido sem alteracao de saldo' });
  }

  const updatedAt = new Date().toISOString();

  if (isAdminDemoMode) {
    const dbData = getMockDb();
    let depositIndex = dbData.deposits.findIndex(d =>
      d.id === deposit.paymentId ||
      d.id === deposit.gatewayTransactionId ||
      d.identifier === deposit.identifier ||
      d.gatewayPaymentId === deposit.paymentId ||
      d.gatewayTransactionId === deposit.gatewayTransactionId
    );

    if (depositIndex === -1) {
      if (!deposit.email) {
        return NextResponse.json({ error: 'Deposito nao encontrado no mock db' }, { status: 404 });
      }

      const userEntry = Object.values(dbData.users).find(u => u.email.toLowerCase() === deposit.email);
      if (!userEntry) {
        return NextResponse.json({ error: 'Usuario nao cadastrado no mock db' }, { status: 404 });
      }

      dbData.deposits.push({
        id: deposit.paymentId || deposit.identifier || deposit.gatewayTransactionId,
        uid: userEntry.uid,
        email: userEntry.email,
        amount: deposit.amount || 0,
        status: 'pending',
        identifier: deposit.identifier,
        gatewayPaymentId: deposit.paymentId,
        gatewayTransactionId: deposit.gatewayTransactionId || null,
        gatewayStatus: deposit.status,
        paidAt: deposit.paidAt,
        createdAt: updatedAt,
        updatedAt
      });
      depositIndex = dbData.deposits.length - 1;
    }

    const depositRecord = dbData.deposits[depositIndex]!;

    if (!amountsMatch(depositRecord.amount, deposit.amount)) {
      return NextResponse.json({ error: 'Valor do deposito nao confere' }, { status: 409 });
    }

    if (depositRecord.status === 'paid' || depositRecord.status === 'approved') {
      return NextResponse.json({ success: true, message: 'Deposito ja estava pago (idempotente)' });
    }

    if (!hasWebhookToken) {
      const isVerifiedPaid = await verifyGatewayPayment(deposit, hasWebhookToken);
      if (!isVerifiedPaid) {
        return NextResponse.json({ error: 'Verificacao de seguranca falhou' }, { status: 403 });
      }
    }

    let wallet = dbData.wallets[depositRecord.uid];
    if (!wallet) {
      wallet = {
        uid: depositRecord.uid,
        balance: 0,
        lockedBalance: 0,
        updatedAt
      };
      dbData.wallets[depositRecord.uid] = wallet;
    }

    depositRecord.status = 'approved';
    (depositRecord as any).autoConfirmed = true;
    (depositRecord as any).confirmedBy = 'vizzionpay_webhook';
    depositRecord.gatewayPaymentId = deposit.paymentId || depositRecord.gatewayPaymentId;
    depositRecord.gatewayTransactionId = deposit.gatewayTransactionId || depositRecord.gatewayTransactionId || null;
    depositRecord.gatewayStatus = deposit.status;
    depositRecord.paidAt = deposit.paidAt || updatedAt;
    depositRecord.updatedAt = updatedAt;
    const hasPreviousApproved = dbData.deposits.some(d =>
      d.uid === depositRecord.uid &&
      d.id !== depositRecord.id &&
      (d.status === 'approved' || d.status === 'paid')
    );
    const bonusEligible = !hasPreviousApproved && !(wallet as any).firstDepositBonusApplied;
    const credit = calculateFirstDepositCredit(depositRecord.amount, bonusEligible, (dbData.settings as any).bonusRolloverMultiplier || 2);

    (depositRecord as any).bonusAmount = credit.bonusAmount;
    (depositRecord as any).creditedAmount = credit.creditedAmount;
    (depositRecord as any).firstDepositBonusApplied = credit.bonusApplied;
    (depositRecord as any).bonusRolloverRequired = credit.rolloverRequired;
    (wallet as any).firstDepositBonusApplied = Boolean((wallet as any).firstDepositBonusApplied || hasPreviousApproved || credit.bonusApplied);
    (wallet as any).bonusLockedAmount = Number((((wallet as any).bonusLockedAmount || 0) + credit.bonusAmount).toFixed(2));
    (wallet as any).bonusRolloverRequired = Number((((wallet as any).bonusRolloverRequired || 0) + credit.rolloverRequired).toFixed(2));
    (wallet as any).bonusRolloverProgress = Number(((wallet as any).bonusRolloverProgress || 0).toFixed(2));
    wallet.balance = Number((wallet.balance + credit.creditedAmount).toFixed(2));
    wallet.updatedAt = updatedAt;

    saveMockDb(dbData);
    console.log(`[Webhook VizzionPay] [DEMO] Deposito ${depositRecord.id} creditado: R$ ${credit.creditedAmount} para ${depositRecord.email}`);
    return NextResponse.json({ success: true, message: 'Deposito creditado com sucesso (Demo)' });
  }

  if (!adminDb) {
    return NextResponse.json({ error: 'Firebase Admin indisponivel' }, { status: 500 });
  }

  const match = await findFirestoreDeposit(deposit);
  if (!match) {
    console.warn(`[Webhook VizzionPay] Deposito ${deposit.paymentId || deposit.identifier} nao encontrado no Firestore.`);
    return NextResponse.json({ error: 'Deposito nao encontrado' }, { status: 404 });
  }

  if (!amountsMatch(match.data.amount, deposit.amount)) {
    return NextResponse.json({ error: 'Valor do deposito nao confere' }, { status: 409 });
  }

  if (!hasWebhookToken) {
    const isVerifiedPaid = await verifyGatewayPayment(deposit, hasWebhookToken);
    if (!isVerifiedPaid) {
      return NextResponse.json({ error: 'Verificacao de seguranca falhou' }, { status: 403 });
    }
  }

  const walletRef = adminDb.collection('wallets').doc(match.data.uid);
  const settingsSnap = await adminDb.collection('settings').doc('game').get();
  const rolloverMultiplier = settingsSnap.exists ? (settingsSnap.data()?.bonusRolloverMultiplier || 2) : 2;
  const hasPreviousApproved = await hasPreviousApprovedDeposit(match.data.uid, match.ref.id);
  let alreadyProcessed = false;

  try {
    await adminDb.runTransaction(async (transaction: any) => {
      const depositSnap = await transaction.get(match.ref);
      if (!depositSnap.exists) {
        throw new Error('Deposito nao encontrado');
      }

      const depositData = depositSnap.data()!;
      if (!amountsMatch(depositData.amount, deposit.amount)) {
        throw new Error('Valor do deposito nao confere');
      }

      if (depositData.status === 'paid' || depositData.status === 'approved') {
        alreadyProcessed = true;
        return;
      }

      const walletSnap = await transaction.get(walletRef);
      const wallet = walletSnap.exists ? walletSnap.data()! : null;
      const bonusEligible = !hasPreviousApproved && !wallet?.firstDepositBonusApplied;
      const credit = calculateFirstDepositCredit(depositData.amount, bonusEligible, rolloverMultiplier);

      if (!walletSnap.exists) {
        transaction.set(walletRef, {
          uid: depositData.uid,
          balance: credit.creditedAmount,
          lockedBalance: 0,
          firstDepositBonusApplied: credit.bonusApplied || hasPreviousApproved,
          bonusLockedAmount: credit.bonusAmount,
          bonusRolloverRequired: credit.rolloverRequired,
          bonusRolloverProgress: 0,
          updatedAt
        });
      } else {
        transaction.update(walletRef, {
          balance: Number((wallet.balance + credit.creditedAmount).toFixed(2)),
          firstDepositBonusApplied: Boolean(wallet.firstDepositBonusApplied || hasPreviousApproved || credit.bonusApplied),
          bonusLockedAmount: Number(((wallet.bonusLockedAmount || 0) + credit.bonusAmount).toFixed(2)),
          bonusRolloverRequired: Number(((wallet.bonusRolloverRequired || 0) + credit.rolloverRequired).toFixed(2)),
          bonusRolloverProgress: Number((wallet.bonusRolloverProgress || 0).toFixed(2)),
          updatedAt
        });
      }

      transaction.update(match.ref, {
        status: 'approved',
        gatewayPaymentId: deposit.paymentId || depositData.gatewayPaymentId || null,
        gatewayTransactionId: deposit.gatewayTransactionId || depositData.gatewayTransactionId || null,
        gatewayStatus: deposit.status,
        autoConfirmed: true,
        confirmedBy: 'vizzionpay_webhook',
        paidAt: deposit.paidAt || updatedAt,
        bonusAmount: credit.bonusAmount,
        creditedAmount: credit.creditedAmount,
        bonusRolloverRequired: credit.rolloverRequired,
        firstDepositBonusApplied: credit.bonusApplied,
        updatedAt
      });
    });

    if (alreadyProcessed) {
      return NextResponse.json({ success: true, message: 'Deposito ja processado anteriormente' });
    }

    console.log(`[Webhook VizzionPay] Deposito ${match.ref.id} creditado com sucesso.`);
    return NextResponse.json({ success: true, message: 'Deposito processado com sucesso' });
  } catch (txError: any) {
    console.error(`[Webhook VizzionPay] Erro de transacao ao processar deposito ${match.ref.id}:`, txError);
    return NextResponse.json({ error: txError.message || 'Erro ao creditar deposito' }, { status: 500 });
  }
}

async function updateUnpaidDepositStatus(deposit: NormalizedDepositWebhook) {
  if (!isDepositFailedStatus(deposit.status)) {
    return;
  }

  const updatedAt = new Date().toISOString();
  const localStatus = deposit.status === 'expired' ? 'expired' : deposit.status === 'refunded' ? 'refunded' : 'rejected';

  if (isAdminDemoMode) {
    const dbData = getMockDb();
    const depositRecord = dbData.deposits.find(d =>
      d.id === deposit.paymentId ||
      d.id === deposit.gatewayTransactionId ||
      d.identifier === deposit.identifier ||
      d.gatewayPaymentId === deposit.paymentId ||
      d.gatewayTransactionId === deposit.gatewayTransactionId
    );

    if (depositRecord && depositRecord.status === 'pending') {
      depositRecord.status = localStatus;
      depositRecord.gatewayStatus = deposit.status;
      depositRecord.updatedAt = updatedAt;
      saveMockDb(dbData);
    }
    return;
  }

  if (!adminDb) {
    return;
  }

  const match = await findFirestoreDeposit(deposit);
  if (match && match.data.status === 'pending') {
    await match.ref.update({
      status: localStatus,
      gatewayStatus: deposit.status,
      gatewayPaymentId: deposit.paymentId || match.data.gatewayPaymentId || null,
      gatewayTransactionId: deposit.gatewayTransactionId || match.data.gatewayTransactionId || null,
      updatedAt
    });
  }
}

async function findFirestoreDeposit(deposit: NormalizedDepositWebhook): Promise<{ ref: any; data: any } | null> {
  const depositsRef = adminDb.collection('deposits');
  const docIds = Array.from(new Set([deposit.paymentId, deposit.gatewayTransactionId].filter(Boolean)));

  for (const id of docIds) {
    const snap = await depositsRef.doc(id).get();
    if (snap.exists) {
      return { ref: snap.ref, data: snap.data() };
    }
  }

  const lookups: Array<[string, string]> = [
    ['gatewayPaymentId', deposit.paymentId],
    ['gatewayTransactionId', deposit.gatewayTransactionId],
    ['identifier', deposit.identifier]
  ];

  for (const [field, value] of lookups) {
    if (!value) {
      continue;
    }

    const q = await depositsRef.where(field, '==', value).limit(1).get();
    if (!q.empty) {
      const snap = q.docs[0]!;
      return { ref: snap.ref, data: snap.data() };
    }
  }

  return null;
}

async function handleWithdrawalWebhook(body: any) {
  const withdraw = normalizeWithdrawalPayload(body);

  if ((!withdraw.payoutId && !withdraw.identifier) || !withdraw.status) {
    return NextResponse.json({ error: 'Payload de saque invalido' }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();

  if (isAdminDemoMode) {
    const dbData = getMockDb();
    const withdrawalIndex = dbData.withdrawals.findIndex(w => w.id === withdraw.identifier || w.payoutId === withdraw.payoutId);

    if (withdrawalIndex === -1) {
      return NextResponse.json({ error: 'Saque nao localizado no mock db' }, { status: 404 });
    }

    const withdrawal = dbData.withdrawals[withdrawalIndex]!;
    const wallet = dbData.wallets[withdrawal.uid];
    if (!wallet) {
      return NextResponse.json({ error: 'Carteira do usuario nao encontrada no mock db' }, { status: 404 });
    }

    if (isWithdrawalFailedStatus(withdraw.status)) {
      if (withdrawal.status === 'pending' || withdrawal.status === 'approved') {
        withdrawal.status = 'rejected';
        wallet.lockedBalance = Number((wallet.lockedBalance - withdrawal.amount).toFixed(2));
        wallet.balance = Number((wallet.balance + withdrawal.amount).toFixed(2));
        withdrawal.updatedAt = updatedAt;
        wallet.updatedAt = updatedAt;

        saveMockDb(dbData);
        return NextResponse.json({ success: true, message: 'Saque falhou e saldo estornado com sucesso (Demo)' });
      }
    } else if (isPaidStatus(withdraw.status)) {
      if (withdrawal.status === 'pending' || withdrawal.status === 'approved') {
        withdrawal.status = 'approved';
        withdrawal.payoutId = withdraw.payoutId || withdrawal.payoutId;
        withdrawal.updatedAt = updatedAt;
        saveMockDb(dbData);
        return NextResponse.json({ success: true, message: 'Saque concluido com sucesso (Demo)' });
      }
    }

    return NextResponse.json({ success: true, message: 'Status recebido sem alteracao de saldo' });
  }

  if (!adminDb) {
    return NextResponse.json({ error: 'Firebase Admin indisponivel' }, { status: 500 });
  }

  let withdrawalRef = withdraw.identifier ? adminDb.collection('withdrawals').doc(withdraw.identifier) : null;
  let withdrawalSnap = withdrawalRef ? await withdrawalRef.get() : null;

  if (!withdrawalSnap?.exists && withdraw.payoutId) {
    const querySnap = await adminDb.collection('withdrawals').where('payoutId', '==', withdraw.payoutId).limit(1).get();
    if (querySnap.empty) {
      return NextResponse.json({ error: 'Saque nao localizado no banco de dados' }, { status: 404 });
    }
    withdrawalSnap = querySnap.docs[0]!;
    withdrawalRef = withdrawalSnap.ref;
  }

  if (!withdrawalRef || !withdrawalSnap?.exists) {
    return NextResponse.json({ error: 'Saque nao localizado no banco de dados' }, { status: 404 });
  }

  const withdrawalData = withdrawalSnap.data()!;

  if (isWithdrawalFailedStatus(withdraw.status)) {
    if (withdrawalData.status === 'pending' || withdrawalData.status === 'approved') {
      const walletRef = adminDb.collection('wallets').doc(withdrawalData.uid);

      try {
        await adminDb.runTransaction(async (transaction: any) => {
          const walletSnap = await transaction.get(walletRef);
          if (!walletSnap.exists) {
            throw new Error('Carteira do usuario nao encontrada');
          }
          const wallet = walletSnap.data()!;

          transaction.update(withdrawalRef, {
            status: 'rejected',
            gatewayStatus: withdraw.status,
            rejectedReason: withdraw.message || 'Cancelado pelo gateway',
            updatedAt
          });

          transaction.update(walletRef, {
            lockedBalance: Number((wallet.lockedBalance - withdrawalData.amount).toFixed(2)),
            balance: Number((wallet.balance + withdrawalData.amount).toFixed(2)),
            updatedAt
          });
        });

        return NextResponse.json({ success: true, message: 'Saque falhou, valor estornado' });
      } catch (txError: any) {
        console.error(`[Webhook VizzionPay] Erro ao estornar saque ${withdrawalSnap.id}:`, txError);
        return NextResponse.json({ error: txError.message || 'Erro ao processar estorno de saque' }, { status: 500 });
      }
    }
  } else if (isPaidStatus(withdraw.status)) {
    try {
      await withdrawalRef.update({
        status: 'approved',
        payoutId: withdraw.payoutId || withdrawalData.payoutId || null,
        gatewayStatus: withdraw.status,
        updatedAt
      });
      return NextResponse.json({ success: true, message: 'Saque finalizado com sucesso' });
    } catch (updateError: any) {
      console.error(`[Webhook VizzionPay] Erro ao atualizar saque ${withdrawalSnap.id} para finalizado:`, updateError);
      return NextResponse.json({ error: 'Erro ao atualizar saque' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, message: 'Webhook processado' });
}
