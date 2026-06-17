import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../lib/firebaseAdmin';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';
import { executePixPayout } from '../../../../lib/paymentService';

export async function POST(req: Request) {
  try {
    const { adminUid, withdrawalId, action } = await req.json();

    if (!adminUid || !withdrawalId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Campos adminUid, withdrawalId e action ("approve" ou "reject") são obrigatórios' }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();

    if (isAdminDemoMode) {
      const dbData = getMockDb();
      
      // Validar admin
      const adminUser = dbData.users[adminUid];
      if (!adminUser || adminUser.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso não autorizado!' }, { status: 403 });
      }

      // Localizar saque
      const withdrawalIndex = dbData.withdrawals.findIndex(w => w.id === withdrawalId);
      if (withdrawalIndex === -1) {
        return NextResponse.json({ error: 'Solicitação de saque não encontrada' }, { status: 404 });
      }
      const withdrawal = dbData.withdrawals[withdrawalIndex]!;

      if (withdrawal.status !== 'pending') {
        return NextResponse.json({ error: 'Este saque já foi processado' }, { status: 400 });
      }

      const userWallet = dbData.wallets[withdrawal.uid];
      if (!userWallet) {
        return NextResponse.json({ error: 'Carteira do usuário não encontrada' }, { status: 404 });
      }

      // Processar saque com simulação
      if (action === 'approve') {
        const payoutRes = await executePixPayout(withdrawal.amount, withdrawal.pixKey || '');
        if (!payoutRes.success) {
          return NextResponse.json({ error: 'A transferência Pix foi rejeitada pela simulação do gateway.' }, { status: 500 });
        }
        withdrawal.status = 'approved';
        userWallet.lockedBalance = Number((userWallet.lockedBalance - withdrawal.amount).toFixed(2));
      } else {
        withdrawal.status = 'rejected';
        userWallet.lockedBalance = Number((userWallet.lockedBalance - withdrawal.amount).toFixed(2));
        userWallet.balance = Number((userWallet.balance + withdrawal.amount).toFixed(2));
      }
      
      withdrawal.updatedAt = updatedAt;
      userWallet.updatedAt = updatedAt;

      // Registrar log administrativo
      const logId = "log-" + Math.random().toString(36).substring(2, 11);
      dbData.adminLogs.push({
        id: logId,
        adminUid,
        adminEmail: adminUser.email,
        action: action === 'approve' ? 'APROVAR_SAQUE' : 'RECUSAR_SAQUE',
        details: `${action === 'approve' ? 'Aprovado' : 'Recusado'} saque de R$ ${withdrawal.amount.toFixed(2)} para usuário ${withdrawal.email} (${withdrawal.uid})`,
        createdAt: updatedAt
      });

      saveMockDb(dbData);
      return NextResponse.json({ success: true });
    }

    // --- MODO PRODUÇÃO FIRESTORE (TRANSAÇÃO ATÔMICA + PAYOUT SEGURO) ---
    if (!adminDb) {
      return NextResponse.json({ error: 'Serviço Firebase Admin indisponível' }, { status: 500 });
    }

    const adminDoc = await adminDb.collection('users').doc(adminUid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso não autorizado!' }, { status: 403 });
    }
    const adminData = adminDoc.data()!;

    const withdrawalDocRef = adminDb.collection('withdrawals').doc(withdrawalId);
    const withdrawalSnap = await withdrawalDocRef.get();
    if (!withdrawalSnap.exists) {
      return NextResponse.json({ error: 'Solicitação de saque não encontrada' }, { status: 404 });
    }
    const withdrawalData = withdrawalSnap.data()!;

    if (withdrawalData.status !== 'pending') {
      return NextResponse.json({ error: 'Este saque já foi processado' }, { status: 400 });
    }

    // 1. Se for aprovação, executa o payout externo PRIMEIRAMENTE antes de alterar o banco de dados
    if (action === 'approve') {
      try {
        const payoutRes = await executePixPayout(withdrawalData.amount, withdrawalData.pixKey || '');
        if (!payoutRes.success) {
          return NextResponse.json({ error: 'A transferência Pix foi rejeitada pela TriboPay.' }, { status: 500 });
        }
      } catch (payoutError: any) {
        return NextResponse.json({ error: `Falha na transferência Pix: ${payoutError.message || 'Erro de comunicação com a TriboPay'}` }, { status: 500 });
      }
    }

    // 2. Com a aprovação concluída (ou em caso de rejeição), atualiza a carteira e status no Firestore
    const walletDocRef = adminDb.collection('wallets').doc(withdrawalData.uid);

    await adminDb.runTransaction(async (transaction: any) => {
      const walletSnap = await transaction.get(walletDocRef);
      if (!walletSnap.exists) {
        throw new Error('Carteira do usuário não encontrada');
      }
      const walletData = walletSnap.data()!;

      if (action === 'approve') {
        transaction.update(withdrawalDocRef, {
          status: 'approved',
          updatedAt
        });

        transaction.update(walletDocRef, {
          lockedBalance: Number((walletData.lockedBalance - withdrawalData.amount).toFixed(2)),
          updatedAt
        });
      } else {
        transaction.update(withdrawalDocRef, {
          status: 'rejected',
          updatedAt
        });

        transaction.update(walletDocRef, {
          lockedBalance: Number((walletData.lockedBalance - withdrawalData.amount).toFixed(2)),
          balance: Number((walletData.balance + withdrawalData.amount).toFixed(2)),
          updatedAt
        });
      }

      // Salvar log
      const logRef = adminDb.collection('adminLogs').doc();
      transaction.set(logRef, {
        adminUid,
        adminEmail: adminData.email,
        action: action === 'approve' ? 'APROVAR_SAQUE' : 'RECUSAR_SAQUE',
        details: `${action === 'approve' ? 'Aprovado' : 'Recusado'} saque de R$ ${withdrawalData.amount.toFixed(2)} para usuário ${withdrawalData.email} (${withdrawalData.uid})`,
        createdAt: updatedAt
      });
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Erro ao processar saque por admin:", error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
