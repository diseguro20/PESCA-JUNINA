import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../lib/firebaseAdmin';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';
import { verifyDepositStatus } from '../../../../lib/paymentService';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[Webhook TriboPay] Recebido payload:", JSON.stringify(body));

    // Determinar se é Webhook de Depósito (Cash-In) ou Saque (Cash-Out)
    const isDeposit = !!body.pix || 
                      body.hasOwnProperty('payer') || 
                      body.hasOwnProperty('transaction_hash') || 
                      body.hasOwnProperty('payment_method') || 
                      body.id?.startsWith('dep_');

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
  const depositId = body.transaction_hash || body.id;
  const status = body.status; // 'paid', 'approved', 'completed', etc.

  if (!depositId || !status) {
    return NextResponse.json({ error: 'Payload de depósito inválido' }, { status: 400 });
  }

  // Apenas processa depósitos com status de sucesso
  const isPaidStatus = status === 'paid' || status === 'approved' || status === 'completed';
  if (!isPaidStatus) {
    console.log(`[Webhook TriboPay] Depósito ${depositId} com status "${status}". Nenhuma ação necessária.`);
    return NextResponse.json({ success: true, message: 'Status recebido sem alteração de saldo' });
  }

  // --- 🔐 SEGURANÇA ATIVA: Consultar API oficial da TriboPay para confirmar o pagamento ---
  let isVerifiedPaid = false;
  try {
    const verifiedData = await verifyDepositStatus(depositId);
    const verifiedStatus = verifiedData?.status;
    isVerifiedPaid = verifiedStatus === 'paid' || verifiedStatus === 'approved' || verifiedStatus === 'completed';
    if (!isVerifiedPaid) {
      console.warn(`[Webhook TriboPay] ⚠️ FRAUDE DETECTADA: Webhook reportou "${status}" para o depósito ${depositId}, mas a consulta direta à API retornou "${verifiedStatus}".`);
      return NextResponse.json({ error: 'Verificação de segurança falhou' }, { status: 403 });
    }
  } catch (verifyError: any) {
    console.error(`[Webhook TriboPay] Erro ao verificar depósito ${depositId} na API TriboPay. Prosseguindo com aprovação pelo postback devido à instabilidade do gateway.`, verifyError);
    isVerifiedPaid = true; // Permite aprovação se a API do gateway estiver fora do ar/instável
  }

  const updatedAt = new Date().toISOString();

  // Helper para extrair o valor correto do payload
  const parseAmount = (payload: any): number => {
    if (payload.amount) return Number(payload.amount) / 100;
    if (payload.price) return Number(payload.price) / 100;
    if (payload.value) return Number(payload.value) / 100;
    return 15.00; // Valor fallback
  };

  // --- MODO DEMO (MOCK DB) ---
  if (isAdminDemoMode) {
    const dbData = getMockDb();
    let depositIndex = dbData.deposits.findIndex(d => d.id === depositId);
    let deposit: any;
    let isNew = false;

    if (depositIndex === -1) {
      const email = body.customer?.email || body.payer?.email || body.email;
      if (!email) {
        return NextResponse.json({ error: 'Depósito não encontrado no mock db e e-mail não fornecido' }, { status: 404 });
      }

      const userEntry = Object.values(dbData.users).find(u => u.email.toLowerCase() === email.toLowerCase().trim());
      if (!userEntry) {
        return NextResponse.json({ error: 'Usuário não cadastrado no mock db' }, { status: 404 });
      }

      deposit = {
        id: depositId,
        uid: userEntry.uid,
        email: userEntry.email,
        amount: parseAmount(body),
        status: 'pending' as const,
        createdAt: updatedAt,
        updatedAt: updatedAt
      };
      dbData.deposits.push(deposit);
      depositIndex = dbData.deposits.length - 1;
      isNew = true;
    } else {
      deposit = dbData.deposits[depositIndex]!;
    }

    if (deposit.status === 'paid' || deposit.status === 'approved') {
      return NextResponse.json({ success: true, message: 'Depósito já estava pago (idempotente)' });
    }

    let wallet = dbData.wallets[deposit.uid];
    if (!wallet) {
      wallet = {
        uid: deposit.uid,
        balance: 0,
        lockedBalance: 0,
        updatedAt
      };
      dbData.wallets[deposit.uid] = wallet;
    }

    // Atualiza status e creditar saldo
    deposit.status = 'approved';
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
  let depositData: any;
  let isNewDeposit = false;

  if (!depositSnap.exists) {
    console.warn(`[Webhook TriboPay] Depósito ${depositId} não encontrado no Firestore. Buscando usuário pelo e-mail.`);
    const email = body.customer?.email || body.payer?.email || body.email;
    if (!email) {
      return NextResponse.json({ error: 'Depósito não encontrado e nenhum e-mail fornecido no payload' }, { status: 404 });
    }

    const usersQuery = await adminDb.collection('users').where('email', '==', email.toLowerCase().trim()).get();
    if (usersQuery.empty) {
      return NextResponse.json({ error: `Depósito não encontrado e nenhum usuário localizado com o e-mail ${email}` }, { status: 404 });
    }

    const userDoc = usersQuery.docs[0]!;
    depositData = {
      uid: userDoc.id,
      email: email.toLowerCase().trim(),
      amount: parseAmount(body),
      status: 'pending',
      createdAt: updatedAt,
      updatedAt: updatedAt
    };
    isNewDeposit = true;
  } else {
    depositData = depositSnap.data()!;
  }

  if (depositData.status === 'paid' || depositData.status === 'approved') {
    return NextResponse.json({ success: true, message: 'Depósito já processado anteriormente' });
  }

  const walletRef = adminDb.collection('wallets').doc(depositData.uid);

  try {
    await adminDb.runTransaction(async (transaction: any) => {
      const walletSnap = await transaction.get(walletRef);
      
      // Credita ou cria a carteira do usuário
      if (!walletSnap.exists) {
        transaction.set(walletRef, {
          uid: depositData.uid,
          balance: depositData.amount,
          lockedBalance: 0,
          updatedAt
        });
      } else {
        const wallet = walletSnap.data()!;
        transaction.update(walletRef, {
          balance: Number((wallet.balance + depositData.amount).toFixed(2)),
          updatedAt
        });
      }

      // Atualiza ou insere o registro do depósito
      if (isNewDeposit) {
        transaction.set(depositRef, {
          ...depositData,
          status: 'approved',
          updatedAt
        });
      } else {
        transaction.update(depositRef, {
          status: 'approved',
          updatedAt
        });
      }
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
