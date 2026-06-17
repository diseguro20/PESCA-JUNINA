import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../lib/firebaseAdmin';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';

export async function POST(req: Request) {
  try {
    const { uid, amount, pixKey, pixKeyType, recipientName, recipientDocument } = await req.json();

    if (!uid || amount === undefined || !pixKey || !pixKeyType || !recipientName || !recipientDocument) {
      return NextResponse.json({ error: 'Campos uid, amount, pixKey, pixKeyType, recipientName e recipientDocument são obrigatórios' }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'O valor do saque deve ser maior que zero' }, { status: 400 });
    }

    const createdAt = new Date().toISOString();

    if (isAdminDemoMode) {
      const dbData = getMockDb();
      const user = dbData.users[uid];
      if (!user) {
        return NextResponse.json({ error: 'Usuário não cadastrado' }, { status: 404 });
      }

      if (user.status !== 'active') {
        return NextResponse.json({ error: 'Sua conta está bloqueada ou em análise. Contate o suporte.' }, { status: 403 });
      }

      const wallet = dbData.wallets[uid];
      if (!wallet || wallet.balance < amount) {
        return NextResponse.json({ error: 'Saldo disponível insuficiente!' }, { status: 400 });
      }

      // Bloquear o saldo
      wallet.balance = Number((wallet.balance - amount).toFixed(2));
      wallet.lockedBalance = Number((wallet.lockedBalance + amount).toFixed(2));
      wallet.updatedAt = createdAt;

      const withdrawalId = "wit-" + Math.random().toString(36).substring(2, 11);
      const newWithdrawal = {
        id: withdrawalId,
        uid,
        email: user.email,
        amount,
        status: 'pending' as const,
        pixKey,
        pixKeyType,
        recipientName,
        recipientDocument,
        createdAt,
        updatedAt: createdAt
      };

      dbData.withdrawals.push(newWithdrawal);
      saveMockDb(dbData);

      return NextResponse.json({ success: true, withdrawal: newWithdrawal });
    }

    // --- MODO PRODUÇÃO FIRESTORE (TRANSAÇÃO ATÔMICA) ---
    if (!adminDb) {
      return NextResponse.json({ error: 'Serviço Firebase Admin indisponível' }, { status: 500 });
    }

    const userDocRef = adminDb.collection('users').doc(uid);
    const walletDocRef = adminDb.collection('wallets').doc(uid);
    const withdrawalDocRef = adminDb.collection('withdrawals').doc();

    await adminDb.runTransaction(async (transaction: any) => {
      // 1. Verificar usuário
      const userSnap = await transaction.get(userDocRef);
      if (!userSnap.exists) {
        throw new Error('Usuário não cadastrado');
      }
      const user = userSnap.data()!;
      if (user.status !== 'active') {
        throw new Error('Sua conta está bloqueada ou em análise.');
      }

      // 2. Verificar carteira
      const walletSnap = await transaction.get(walletDocRef);
      if (!walletSnap.exists) {
        throw new Error('Carteira não encontrada');
      }
      const wallet = walletSnap.data()!;

      if (wallet.balance < amount) {
        throw new Error('Saldo disponível insuficiente!');
      }

      // 3. Atualizar carteira (bloqueando saldo do saque)
      transaction.update(walletDocRef, {
        balance: Number((wallet.balance - amount).toFixed(2)),
        lockedBalance: Number((wallet.lockedBalance + amount).toFixed(2)),
        updatedAt: createdAt
      });

      // 4. Criar solicitação de saque com todos os dados do beneficiário
      transaction.set(withdrawalDocRef, {
        uid,
        email: user.email,
        amount,
        status: 'pending',
        pixKey,
        pixKeyType,
        recipientName,
        recipientDocument,
        createdAt,
        updatedAt: createdAt
      });
    });

    return NextResponse.json({ success: true, id: withdrawalDocRef.id });

  } catch (error: any) {
    console.error("Erro ao solicitar saque:", error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
