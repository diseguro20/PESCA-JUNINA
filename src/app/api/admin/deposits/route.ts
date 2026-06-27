import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../lib/firebaseAdmin';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';
import { calculateFirstDepositCredit } from '../../../../lib/depositBonus';

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

export async function POST(req: Request) {
  try {
    const { adminUid, depositId, action } = await req.json();

    if (!adminUid || !depositId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Campos adminUid, depositId e action ("approve" ou "reject") são obrigatórios' }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();

    if (isAdminDemoMode) {
      const dbData = getMockDb();
      
      // Validar admin
      const adminUser = dbData.users[adminUid];
      if (!adminUser || adminUser.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso não autorizado!' }, { status: 403 });
      }

      // Localizar depósito
      const depositIndex = dbData.deposits.findIndex(d => d.id === depositId);
      if (depositIndex === -1) {
        return NextResponse.json({ error: 'Depósito não encontrado' }, { status: 404 });
      }
      const deposit = dbData.deposits[depositIndex]!;

      if (deposit.status === 'approved' || deposit.status === 'rejected') {
        return NextResponse.json({ error: 'Este depósito já foi processado' }, { status: 400 });
      }

      let userWallet = dbData.wallets[deposit.uid];
      if (!userWallet) {
        userWallet = {
          uid: deposit.uid,
          balance: 0,
          lockedBalance: 0,
          updatedAt
        };
        dbData.wallets[deposit.uid] = userWallet;
      }

      // Processar
      if (action === 'approve') {
        const hasPreviousApproved = dbData.deposits.some(d =>
          d.uid === deposit.uid &&
          d.id !== deposit.id &&
          (d.status === 'approved' || d.status === 'paid')
        );
        const bonusEligible = !hasPreviousApproved && !(userWallet as any).firstDepositBonusApplied;
        const credit = calculateFirstDepositCredit(deposit.amount, bonusEligible, (dbData.settings as any).bonusRolloverMultiplier || 2);

        deposit.status = 'approved';
        (deposit as any).autoConfirmed = false;
        (deposit as any).confirmedBy = adminUid;
        (deposit as any).bonusAmount = credit.bonusAmount;
        (deposit as any).creditedAmount = credit.creditedAmount;
        (deposit as any).firstDepositBonusApplied = credit.bonusApplied;
        (deposit as any).bonusRolloverRequired = credit.rolloverRequired;
        (userWallet as any).firstDepositBonusApplied = Boolean((userWallet as any).firstDepositBonusApplied || hasPreviousApproved || credit.bonusApplied);
        (userWallet as any).bonusLockedAmount = Number((((userWallet as any).bonusLockedAmount || 0) + credit.bonusAmount).toFixed(2));
        (userWallet as any).bonusRolloverRequired = Number((((userWallet as any).bonusRolloverRequired || 0) + credit.rolloverRequired).toFixed(2));
        (userWallet as any).bonusRolloverProgress = Number(((userWallet as any).bonusRolloverProgress || 0).toFixed(2));
        userWallet.balance = Number((userWallet.balance + credit.creditedAmount).toFixed(2));
        userWallet.updatedAt = updatedAt;
      } else {
        deposit.status = 'rejected';
      }
      
      deposit.updatedAt = updatedAt;

      // Registrar log administrativo
      const logId = "log-" + Math.random().toString(36).substring(2, 11);
      dbData.adminLogs.push({
        id: logId,
        adminUid,
        adminEmail: adminUser.email,
        action: action === 'approve' ? 'APROVAR_DEPOSITO' : 'RECUSAR_DEPOSITO',
        details: `${action === 'approve' ? 'Aprovado' : 'Recusado'} depósito de R$ ${deposit.amount.toFixed(2)} para usuário ${deposit.email} (${deposit.uid})`,
        createdAt: updatedAt
      });

      saveMockDb(dbData);
      return NextResponse.json({ success: true });
    }

    // --- MODO PRODUÇÃO FIRESTORE (TRANSAÇÃO ATÔMICA) ---
    if (!adminDb) {
      return NextResponse.json({ error: 'Serviço Firebase Admin indisponível' }, { status: 500 });
    }

    const adminDocRef = adminDb.collection('users').doc(adminUid);
    const depositDocRef = adminDb.collection('deposits').doc(depositId);

    const depositPreviewSnap = action === 'approve' ? await depositDocRef.get() : null;
    const previousApproved = depositPreviewSnap?.exists
      ? await hasPreviousApprovedDeposit(depositPreviewSnap.data()!.uid, depositId)
      : false;
    const settingsSnap = await adminDb.collection('settings').doc('game').get();
    const rolloverMultiplier = settingsSnap.exists ? (settingsSnap.data()?.bonusRolloverMultiplier || 2) : 2;

    await adminDb.runTransaction(async (transaction: any) => {
      // 1. Validar admin
      const adminSnap = await transaction.get(adminDocRef);
      if (!adminSnap.exists || adminSnap.data()?.role !== 'admin') {
        throw new Error('Acesso não autorizado!');
      }
      const adminData = adminSnap.data()!;

      // 2. Verificar depósito
      const depositSnap = await transaction.get(depositDocRef);
      if (!depositSnap.exists) {
        throw new Error('Depósito não encontrado');
      }
      const depositData = depositSnap.data()!;

      if (depositData.status === 'approved' || depositData.status === 'rejected') {
        throw new Error('Este depósito já foi processado');
      }

      const walletDocRef = adminDb.collection('wallets').doc(depositData.uid);
      const walletSnap = await transaction.get(walletDocRef);

      // 3. Atualizar status e saldo
      if (action === 'approve') {
        const walletData = walletSnap.exists ? walletSnap.data()! : null;
        const bonusEligible = !previousApproved && !walletData?.firstDepositBonusApplied;
        const credit = calculateFirstDepositCredit(depositData.amount, bonusEligible, rolloverMultiplier);

        if (!walletSnap.exists) {
          transaction.set(walletDocRef, {
            uid: depositData.uid,
            balance: credit.creditedAmount,
            lockedBalance: 0,
            firstDepositBonusApplied: credit.bonusApplied || previousApproved,
            bonusLockedAmount: credit.bonusAmount,
            bonusRolloverRequired: credit.rolloverRequired,
            bonusRolloverProgress: 0,
            updatedAt
          });
        } else {
          transaction.update(walletDocRef, {
            balance: Number((walletData.balance + credit.creditedAmount).toFixed(2)),
            firstDepositBonusApplied: Boolean(walletData.firstDepositBonusApplied || previousApproved || credit.bonusApplied),
            bonusLockedAmount: Number(((walletData.bonusLockedAmount || 0) + credit.bonusAmount).toFixed(2)),
            bonusRolloverRequired: Number(((walletData.bonusRolloverRequired || 0) + credit.rolloverRequired).toFixed(2)),
            bonusRolloverProgress: Number((walletData.bonusRolloverProgress || 0).toFixed(2)),
            updatedAt
          });
        }

        transaction.update(depositDocRef, {
          status: 'approved',
          autoConfirmed: false,
          confirmedBy: adminUid,
          bonusAmount: credit.bonusAmount,
          creditedAmount: credit.creditedAmount,
          bonusRolloverRequired: credit.rolloverRequired,
          firstDepositBonusApplied: credit.bonusApplied,
          updatedAt
        });
      } else {
        transaction.update(depositDocRef, {
          status: 'rejected',
          updatedAt
        });
      }

      // 4. Salvar log
      const logRef = adminDb.collection('adminLogs').doc();
      transaction.set(logRef, {
        adminUid,
        adminEmail: adminData.email,
        action: action === 'approve' ? 'APROVAR_DEPOSITO' : 'RECUSAR_DEPOSITO',
        details: `${action === 'approve' ? 'Aprovado' : 'Recusado'} depósito de R$ ${depositData.amount.toFixed(2)} para usuário ${depositData.email} (${depositData.uid})`,
        createdAt: updatedAt
      });
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Erro ao processar depósito por admin:", error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
