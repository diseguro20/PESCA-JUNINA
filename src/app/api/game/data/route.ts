import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../lib/firebaseAdmin';
import { getMockDb } from '../../../../lib/mockDb';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ error: 'Parâmetro uid é obrigatório' }, { status: 400 });
    }

    if (isAdminDemoMode) {
      const dbData = getMockDb();
      
      // Obter usuário para verificar privilégios
      const user = dbData.users[uid];
      if (!user) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      // Filtrar dados do usuário
      const wallet = dbData.wallets[uid] || { uid, balance: 0, lockedBalance: 0, updatedAt: new Date().toISOString() };
      const history = dbData.gameRounds
        .filter(r => r.uid === uid)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const deposits = dbData.deposits
        .filter(d => d.uid === uid)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const withdrawals = dbData.withdrawals
        .filter(w => w.uid === uid)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Rankings ordenados por maior prêmio
      // Gerar a partir das rodadas de jogo
      const rankingsMap: Record<string, { name: string; biggestWin: number; maxMultiplier: number; totalRounds: number }> = {};
      dbData.gameRounds.forEach(r => {
        if (!rankingsMap[r.uid]) {
          rankingsMap[r.uid] = { name: r.userName, biggestWin: 0, maxMultiplier: 0, totalRounds: 0 };
        }
        rankingsMap[r.uid].totalRounds += 1;
        if (r.winAmount > rankingsMap[r.uid].biggestWin) {
          rankingsMap[r.uid].biggestWin = r.winAmount;
        }
        if (r.multiplier > rankingsMap[r.uid].maxMultiplier) {
          rankingsMap[r.uid].maxMultiplier = r.multiplier;
        }
      });
      
      // Adicionar usuários que não jogaram ainda com estatísticas zeradas
      Object.values(dbData.users).forEach(u => {
        if (!rankingsMap[u.uid]) {
          rankingsMap[u.uid] = { name: u.name, biggestWin: 0, maxMultiplier: 0, totalRounds: 0 };
        }
      });

      const rankings = Object.entries(rankingsMap)
        .map(([key, val]) => ({ uid: key, ...val }))
        .sort((a, b) => b.biggestWin - a.biggestWin);

      const response: any = {
        wallet,
        history,
        deposits,
        withdrawals,
        rankings,
        multipliers: dbData.multipliers,
        settings: dbData.settings
      };

      // Se for administrador, adicionar logs e lista completa de usuários
      if (user.role === 'admin') {
        response.adminLogs = dbData.adminLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Mapear usuários com seus respectivos saldos
        response.users = Object.values(dbData.users).map(u => ({
          ...u,
          balance: dbData.wallets[u.uid]?.balance || 0,
          lockedBalance: dbData.wallets[u.uid]?.lockedBalance || 0
        }));

        // Adicionar depósitos e saques de todos os usuários para o painel admin
        response.allDeposits = dbData.deposits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        response.allWithdrawals = dbData.withdrawals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      return NextResponse.json(response);
    }

    // --- FIREBASE ADMIN SDK (MODO PRODUÇÃO) ---
    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin não inicializado' }, { status: 500 });
    }

    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    const userData = userDoc.data()!;

    // Buscar carteira
    const walletDoc = await adminDb.collection('wallets').doc(uid).get();
    const wallet = walletDoc.exists ? walletDoc.data() : { uid, balance: 0, lockedBalance: 0 };

    // Buscar históricos do usuário
    const roundsSnap = await adminDb.collection('gameRounds')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const history = roundsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    const depositsSnap = await adminDb.collection('deposits')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();
    const deposits = depositsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    const withdrawalsSnap = await adminDb.collection('withdrawals')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();
    const withdrawals = withdrawalsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    // Buscar Rankings globais
    const rankingsSnap = await adminDb.collection('rankings')
      .orderBy('biggestWin', 'desc')
      .limit(25)
      .get();
    const rankings = rankingsSnap.docs.map((doc: any) => ({ uid: doc.id, ...doc.data() }));

    // Buscar Multiplicadores e Configurações
    const settingsDoc = await adminDb.collection('settings').doc('game').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : { minBet: 1.00, maxBet: 500.00 };

    const multSnap = await adminDb.collection('multipliers').orderBy('value', 'asc').get();
    const multipliers = multSnap.docs.map((doc: any) => doc.data());

    const response: any = {
      wallet,
      history,
      deposits,
      withdrawals,
      rankings,
      multipliers: multipliers.length > 0 ? multipliers : [
        { value: 0, label: "0x - Nada fisgou!", color: "gray", weight: 35 },
        { value: 0.5, label: "0.5x - Peixinho Comum", color: "blue", weight: 20 },
        { value: 1, label: "1x - Peixe Azul", color: "blue", weight: 15 },
        { value: 1.5, label: "1.5x - Peixe Vermelho", color: "blue", weight: 10 },
        { value: 2, label: "2x - Peixe Verde", color: "green", weight: 8 },
        { value: 3, label: "3x - Peixe Roxo", color: "purple", weight: 6 },
        { value: 5, label: "5x - Peixe Dourado", color: "gold", weight: 4 },
        { value: 10, label: "10x - Peixe Lendário!", color: "rainbow", weight: 2 }
      ],
      settings
    };

    if (userData.role === 'admin') {
      const logsSnap = await adminDb.collection('adminLogs')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      response.adminLogs = logsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      const usersSnap = await adminDb.collection('users').get();
      const usersList = [];
      for (const uDoc of usersSnap.docs) {
        const uData = uDoc.data();
        const wDoc = await adminDb.collection('wallets').doc(uDoc.id).get();
        const wData = wDoc.exists ? wDoc.data() : { balance: 0, lockedBalance: 0 };
        usersList.push({
          uid: uDoc.id,
          ...uData,
          balance: wData.balance || 0,
          lockedBalance: wData.lockedBalance || 0
        });
      }
      response.users = usersList;

      // Adicionar todas as transações para admin
      const allDepSnap = await adminDb.collection('deposits').orderBy('createdAt', 'desc').get();
      response.allDeposits = allDepSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      const allWitSnap = await adminDb.collection('withdrawals').orderBy('createdAt', 'desc').get();
      response.allWithdrawals = allWitSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Erro na API de carregamento de dados:", error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
