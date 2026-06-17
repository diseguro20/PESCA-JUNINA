import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../lib/firebaseAdmin';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';
import { verifyDepositStatus } from '../../../../lib/paymentService';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[Webhook TriboPay] Recebido payload:", JSON.stringify(body));

    // Determinar se é Webhook de Depósito (Cash-In) ou Saque (Cash-Out)
    const isDeposit = !!body.pix || body.hasOwnProperty('payer') || body.id?.startsWith('dep_');

    if (isDeposit) {
      return await handleDepositWebhook(body);
    } else {
      return await handleWithdrawalWebhook(body);
    }
  } catch (error: any) {
    console.error("[Webhook TriboPay] Erro interno no processamento:", error);
    return NextResponse.json({ error: 'Erro interno no webhook' }, { status: 500 });
  }
}

/**
 * Trata notificações de Depósito (Cash-In)
 */
async function handleDepositWebhook(body: any) {
  const depositId = body.id;
  const status = body.status; // 'paid', 'expired', 'refunded', etc.

  if (!depositId || !status) {
    return NextResponse.json({ error: 'Payload de depósito inválido' }, { status: 400 });
  }

  // Apenas processa depósitos com status "paid"
  if (status !== 'paid') {
    console.log(`[Webhook TriboPay] Depósito ${depositId} com status "${status}". Nenhuma ação necessária.`);
    return NextResponse.json({ success: true, message: 'Status recebido sem alteração de saldo' });
  }

  // --- 🔐 SEGURANÇA ATIVA: Consultar API oficial da TriboPay para confirmar o pagamento ---
  try {
    const verifiedData = await verifyDepositStatus(depositId);
    if (verifiedData.status !== 'paid') {
      console.warn(`[Webhook TriboPay] ⚠️ FRAUDE DETECTADA: Webhook reportou "paid" para o depósito ${depositId}, mas a consulta direta à API retornou "${verifiedData.status}".`);
      return NextResponse.json({ error: 'Verificação de segurança falhou' }, { status: 403 });
    }
  } catch (verifyError: any) {
    console.error(`[Webhook TriboPay] Erro ao verificar depósito ${depositId} na API TriboPay. Abortando.`, verifyError);
    return NextResponse.json({ error: 'Erro de comunicação para verificação de segurança' }, { status: 500 });
  }

  const updatedAt = new Date().toISOString();

  // --- MODO DEMO (MOCK DB) ---
  if (isAdminDemoMode) {
    const dbData = getMockDb();
    const depositIndex = dbData.deposits.findIndex(d => d.id === depositId);

    if (depositIndex === -1) {
      return NextResponse.json({ error: 'Depósito não encontrado no mock db' }, { status: 404 });
    }

    const deposit = dbData.deposits[depositIndex]!;
    if (deposit.status === 'paid') {
      return NextResponse.json({ success: true, message: 'Depósito já estava pago (idempotente)' });
    }

    const wallet = dbData.wallets[deposit.uid];
    if (!wallet) {
      return NextResponse.json({ error: 'Carteira do usuário não encontrada no mock db' }, { status: 404 });
    }

    // Atualiza status e creditar saldo
    deposit.status = 'paid';
    deposit.updatedAt = updatedAt;
    wallet.balance = Number((wallet.balance + deposit.amount).toFixed(2));
    wallet.updatedAt = updatedAt;

    saveMockDb(dbData);
    console.log(`[Webhook TriboPay] [DEMO] Depósito ${depositId} creditado: R$ ${deposit.amount} para ${deposit.email}`);
    return NextResponse.json({ success: true, message: 'Depósito creditado com sucesso (Demo)' });
  }

  // --- MODO PRODUÇÃO (FIRESTORE COM TRANSAÇÃO) ---
  if (!adminDb) {
    return NextResponse.json({ error: 'Firebase Admin indisponível' }, { status: 500 });
  }

  const depositRef = adminDb.collection('deposits').doc(depositId);
  const depositSnap = await depositRef.get();

  if (!depositSnap.exists) {
    return NextResponse.json({ error: 'Depósito não encontrado' }, { status: 404 });
  }

  const depositData = depositSnap.data()!;
  if (depositData.status === 'paid') {
    return NextResponse.json({ success: true, message: 'Depósito já processado anteriormente' });
  }

  const walletRef = adminDb.collection('wallets').doc(depositData.uid);

  try {
    await adminDb.runTransaction(async (transaction: any) => {
      const walletSnap = await transaction.get(walletRef);
      if (!walletSnap.exists) {
        throw new Error('Carteira do usuário não encontrada');
      }
      const wallet = walletSnap.data()!;

      // Atualiza depósito
      transaction.update(depositRef, {
        status: 'paid',
        updatedAt
      });

      // Credita saldo
      transaction.update(walletRef, {
        balance: Number((wallet.balance + depositData.amount).toFixed(2)),
        updatedAt
      });
    });

    console.log(`[Webhook TriboPay] Depósito ${depositId} creditado com sucesso: R$ ${depositData.amount} para uid: ${depositData.uid}`);
    return NextResponse.json({ success: true, message: 'Depósito processado com sucesso' });
  } catch (txError: any) {
    console.error(`[Webhook TriboPay] Erro de transação ao processar depósito ${depositId}:`, txError);
    return NextResponse.json({ error: txError.message || 'Erro ao creditar depósito' }, { status: 500 });
  }
}

/**
 * Trata notificações de Saque (Cash-Out)
 */
async function handleWithdrawalWebhook(body: any) {
  const payoutId = body.id;
  const status = body.status; // 'transferred', 'failed', 'refused', 'returned', 'cancelled', etc.

  if (!payoutId || !status) {
    return NextResponse.json({ error: 'Payload de saque inválido' }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();

  // --- MODO DEMO (MOCK DB) ---
  if (isAdminDemoMode) {
    const dbData = getMockDb();
    const withdrawalIndex = dbData.withdrawals.findIndex(w => w.payoutId === payoutId);

    if (withdrawalIndex === -1) {
      return NextResponse.json({ error: 'Saque não localizado no mock db' }, { status: 404 });
    }

    const withdrawal = dbData.withdrawals[withdrawalIndex]!;
    const wallet = dbData.wallets[withdrawal.uid];
    if (!wallet) {
      return NextResponse.json({ error: 'Carteira do usuário não encontrada no mock db' }, { status: 404 });
    }

    // Se falhou ou foi devolvido/recusado, estorna o valor bloqueado de volta ao saldo
    if (['failed', 'refused', 'returned', 'cancelled'].includes(status)) {
      if (withdrawal.status === 'pending' || withdrawal.status === 'approved') {
        withdrawal.status = 'rejected'; // marcar localmente como rejeitado/falhou
        wallet.lockedBalance = Number((wallet.lockedBalance - withdrawal.amount).toFixed(2));
        wallet.balance = Number((wallet.balance + withdrawal.amount).toFixed(2));
        withdrawal.updatedAt = updatedAt;
        wallet.updatedAt = updatedAt;

        saveMockDb(dbData);
        console.log(`[Webhook TriboPay] [DEMO] Saque ${withdrawal.id} falhou. Estornado R$ ${withdrawal.amount} para ${withdrawal.email}`);
        return NextResponse.json({ success: true, message: 'Saque falhou e saldo estornado com sucesso (Demo)' });
      }
    } else if (status === 'transferred') {
      if (withdrawal.status === 'pending' || withdrawal.status === 'approved') {
        withdrawal.status = 'approved'; // confirmação de transferência
        withdrawal.updatedAt = updatedAt;
        // lockedBalance já foi deduzido no fluxo de aprovação anterior
        saveMockDb(dbData);
        console.log(`[Webhook TriboPay] [DEMO] Saque ${withdrawal.id} concluído com sucesso`);
        return NextResponse.json({ success: true, message: 'Saque concluído com sucesso (Demo)' });
      }
    }

    return NextResponse.json({ success: true, message: 'Status recebido sem alteração de saldo' });
  }

  // --- MODO PRODUÇÃO (FIRESTORE COM TRANSAÇÃO) ---
  if (!adminDb) {
    return NextResponse.json({ error: 'Firebase Admin indisponível' }, { status: 500 });
  }

  // Buscar documento de saque pelo payoutId
  const querySnap = await adminDb.collection('withdrawals').where('payoutId', '==', payoutId).get();
  if (querySnap.empty) {
    return NextResponse.json({ error: 'Saque não localizado no banco de dados' }, { status: 404 });
  }

  const withdrawalDoc = querySnap.docs[0]!;
  const withdrawalRef = withdrawalDoc.ref;
  const withdrawalData = withdrawalDoc.data();

  // Se o status indica falha, devolve os fundos bloqueados
  if (['failed', 'refused', 'returned', 'cancelled'].includes(status)) {
    if (withdrawalData.status === 'pending' || withdrawalData.status === 'approved') {
      const walletRef = adminDb.collection('wallets').doc(withdrawalData.uid);

      try {
        await adminDb.runTransaction(async (transaction: any) => {
          const walletSnap = await transaction.get(walletRef);
          if (!walletSnap.exists) {
            throw new Error('Carteira do usuário não encontrada');
          }
          const wallet = walletSnap.data()!;

          // Atualizar o status do saque para o status de erro recebido
          transaction.update(withdrawalRef, {
            status: 'rejected',
            gatewayStatus: status,
            updatedAt
          });

          // Estornar fundos
          transaction.update(walletRef, {
            lockedBalance: Number((wallet.lockedBalance - withdrawalData.amount).toFixed(2)),
            balance: Number((wallet.balance + withdrawalData.amount).toFixed(2)),
            updatedAt
          });
        });

        console.log(`[Webhook TriboPay] Saque ${withdrawalDoc.id} FALHOU (${status}). R$ ${withdrawalData.amount} estornados.`);
        return NextResponse.json({ success: true, message: 'Saque falhou, valor estornado' });
      } catch (txError: any) {
        console.error(`[Webhook TriboPay] Erro ao estornar saque ${withdrawalDoc.id}:`, txError);
        return NextResponse.json({ error: txError.message || 'Erro ao processar estorno de saque' }, { status: 500 });
      }
    }
  } else if (status === 'transferred') {
    // Apenas atualizar para finalizado
    try {
      await withdrawalRef.update({
        status: 'approved',
        gatewayStatus: 'transferred',
        updatedAt
      });
      console.log(`[Webhook TriboPay] Saque ${withdrawalDoc.id} CONCLUÍDO com sucesso.`);
      return NextResponse.json({ success: true, message: 'Saque finalizado com sucesso' });
    } catch (updateError: any) {
      console.error(`[Webhook TriboPay] Erro ao atualizar saque ${withdrawalDoc.id} para finalizado:`, updateError);
      return NextResponse.json({ error: 'Erro ao atualizar saque' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, message: 'Webhook processado' });
}
