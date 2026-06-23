import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../../lib/firebaseAdmin';
import { getMockDb, saveMockDb } from '../../../../../lib/mockDb';

export async function POST(req: Request) {
  try {
    const { adminUid, targetUid, amount, type = 'add' } = await req.json();

    if (!adminUid || !targetUid || amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0 || !['add', 'subtract'].includes(type)) {
      return NextResponse.json({ error: 'Campos adminUid, targetUid, um valor positivo para amount e um type válido ("add" ou "subtract") são obrigatórios' }, { status: 400 });
    }

    const valueToChange = Number(Number(amount).toFixed(2));
    const finalChange = type === 'subtract' ? -valueToChange : valueToChange;
    const updatedAt = new Date().toISOString();

    if (isAdminDemoMode) {
      const dbData = getMockDb();
      
      // 1. Validar admin
      const adminUser = dbData.users[adminUid];
      if (!adminUser || adminUser.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso não autorizado!' }, { status: 403 });
      }

      // 2. Localizar carteira do usuário alvo
      const targetWallet = dbData.wallets[targetUid];
      const targetUser = dbData.users[targetUid];
      if (!targetWallet || !targetUser) {
        return NextResponse.json({ error: 'Usuário ou carteira não encontrada' }, { status: 404 });
      }

      // 3. Atualizar saldo
      const oldBalance = targetWallet.balance;
      const newBalanceVal = Number((oldBalance + finalChange).toFixed(2));
      if (type === 'subtract' && newBalanceVal < 0) {
        return NextResponse.json({ error: 'O saldo do jogador não pode ficar negativo.' }, { status: 400 });
      }

      targetWallet.balance = newBalanceVal;
      targetWallet.updatedAt = updatedAt;

      // 4. Registrar log administrativo
      const logId = "log-" + Math.random().toString(36).substring(2, 11);
      dbData.adminLogs.push({
        id: logId,
        adminUid,
        adminEmail: adminUser.email,
        action: type === 'subtract' ? 'REMOVER_SALDO_JOGADOR' : 'ADICIONAR_SALDO_JOGADOR',
        details: `${type === 'subtract' ? 'Removido' : 'Adicionado'} R$ ${valueToChange.toFixed(2)} de saldo para o jogador ${targetUser.email} (${targetUid}). Saldo anterior: R$ ${oldBalance.toFixed(2)} -> Novo saldo: R$ ${newBalanceVal.toFixed(2)}`,
        createdAt: updatedAt
      });

      saveMockDb(dbData);
      return NextResponse.json({ success: true, newBalance: targetWallet.balance });
    }

    // --- MODO PRODUÇÃO FIRESTORE ---
    if (!adminDb) {
      return NextResponse.json({ error: 'Serviço Firebase Admin indisponível' }, { status: 500 });
    }

    const adminDocRef = adminDb.collection('users').doc(adminUid);
    const targetDocRef = adminDb.collection('users').doc(targetUid);
    const targetWalletRef = adminDb.collection('wallets').doc(targetUid);

    let newBalance = 0;

    await adminDb.runTransaction(async (transaction: any) => {
      // 1. Validar admin
      const adminSnap = await transaction.get(adminDocRef);
      if (!adminSnap.exists || adminSnap.data()?.role !== 'admin') {
        throw new Error('Acesso não autorizado!');
      }
      const adminData = adminSnap.data()!;

      // 2. Verificar usuário alvo e sua carteira
      const targetSnap = await transaction.get(targetDocRef);
      const targetWalletSnap = await transaction.get(targetWalletRef);
      if (!targetSnap.exists || !targetWalletSnap.exists) {
        throw new Error('Usuário ou carteira não encontrada');
      }
      const targetData = targetSnap.data()!;
      const targetWalletData = targetWalletSnap.data()!;

      // 3. Atualizar saldo da carteira
      const oldBalance = targetWalletData.balance;
      newBalance = Number((oldBalance + finalChange).toFixed(2));
      
      if (type === 'subtract' && newBalance < 0) {
        throw new Error('O saldo do jogador não pode ficar negativo.');
      }

      transaction.update(targetWalletRef, {
        balance: newBalance,
        updatedAt
      });

      // 4. Salvar log administrativo
      const logRef = adminDb.collection('adminLogs').doc();
      transaction.set(logRef, {
        adminUid,
        adminEmail: adminData.email,
        action: type === 'subtract' ? 'REMOVER_SALDO_JOGADOR' : 'ADICIONAR_SALDO_JOGADOR',
        details: `${type === 'subtract' ? 'Removido' : 'Adicionado'} R$ ${valueToChange.toFixed(2)} de saldo para o jogador ${targetData.email} (${targetUid}). Saldo anterior: R$ ${oldBalance.toFixed(2)} -> Novo saldo: R$ ${newBalance.toFixed(2)}`,
        createdAt: updatedAt
      });
    });

    return NextResponse.json({ success: true, newBalance });

  } catch (error: any) {
    console.error("Erro ao alterar saldo para o usuário:", error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
