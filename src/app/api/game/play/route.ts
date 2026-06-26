import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../lib/firebaseAdmin';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';

// Função para sorteio ponderado
function getWeightedMultiplier(multipliers: any[]) {
  const totalWeight = multipliers.reduce((sum, m) => sum + m.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const m of multipliers) {
    if (random < m.weight) {
      return m;
    }
    random -= m.weight;
  }
  return multipliers[0]; // Retorno de segurança
}

// Mapear peixes correspondentes aos multiplicadores
function getFishDetails(multiplierValue: number) {
  if (multiplierValue === 0) return { name: "Nenhum peixe", color: "gray" };
  if (multiplierValue === 0.5) return { name: "Peixe Comum", color: "comum" };
  if (multiplierValue === 1.0) return { name: "Peixe Azul", color: "azul" };
  if (multiplierValue === 1.5) return { name: "Peixe Vermelho", color: "vermelho" };
  if (multiplierValue === 2.0) return { name: "Peixe Verde", color: "verde" };
  if (multiplierValue === 3.0) return { name: "Peixe Roxo", color: "purple" };
  if (multiplierValue === 5.0) return { name: "Peixe Dourado", color: "gold" };
  return { name: "Peixe Lendário de Chapéu de Palha", color: "rainbow" }; // >= 10x
}

export async function POST(req: Request) {
  try {
    const { uid, betAmount } = await req.json();

    if (!uid || betAmount === undefined) {
      return NextResponse.json({ error: 'Campos uid e betAmount são obrigatórios' }, { status: 400 });
    }

    if (betAmount <= 0) {
      return NextResponse.json({ error: 'O valor da aposta deve ser maior que zero' }, { status: 400 });
    }

    if (isAdminDemoMode) {
      const dbData = getMockDb();
      
      // Validações
      const user = dbData.users[uid];
      if (!user) {
        return NextResponse.json({ error: 'Usuário não cadastrado' }, { status: 404 });
      }

      if (user.status !== 'active') {
        return NextResponse.json({ error: 'Sua conta está bloqueada ou em análise. Contate o suporte.' }, { status: 403 });
      }

      const wallet = dbData.wallets[uid];
      if (!wallet) {
        return NextResponse.json({ error: 'Carteira não localizada' }, { status: 500 });
      }

      if (betAmount < dbData.settings.minBet || betAmount > dbData.settings.maxBet) {
        return NextResponse.json({ 
          error: `O valor da aposta deve estar entre R$ ${dbData.settings.minBet.toFixed(2)} e R$ ${dbData.settings.maxBet.toFixed(2)}` 
        }, { status: 400 });
      }

      if (wallet.balance < betAmount) {
        return NextResponse.json({ error: 'Saldo insuficiente!' }, { status: 400 });
      }

      // Sorteio do multiplicador
      const chosenMultiplier = getWeightedMultiplier(dbData.multipliers);
      const fish = getFishDetails(chosenMultiplier.value);
      
      const winAmount = Number((betAmount * chosenMultiplier.value).toFixed(2));
      const previousBalance = wallet.balance;
      const newBalance = Number((previousBalance - betAmount + winAmount).toFixed(2));

      // Atualizar dados na carteira
      wallet.balance = newBalance;
      wallet.updatedAt = new Date().toISOString();

      // Registrar rodada
      const roundId = "round-" + Math.random().toString(36).substring(2, 11);
      const round = {
        id: roundId,
        uid,
        userName: user.name,
        betAmount,
        winAmount,
        multiplier: chosenMultiplier.value,
        fishType: fish.name,
        createdAt: new Date().toISOString()
      };
      dbData.gameRounds.push(round);

      // Salvar banco mock
      saveMockDb(dbData);

      return NextResponse.json({
        roundId,
        winAmount,
        multiplier: chosenMultiplier.value,
        fishType: fish.name,
        fishColor: fish.color,
        balance: newBalance,
        previousBalance,
        wallet: {
          balance: newBalance,
          lockedBalance: wallet.lockedBalance || 0,
          updatedAt: wallet.updatedAt
        }
      });
    }

    // --- MODO PRODUÇÃO COM FIREBASE ADMIN (TRANSAÇÃO ATÔMICA NO FIRESTORE) ---
    if (!adminDb) {
      return NextResponse.json({ error: 'Serviço Firebase Admin indisponível' }, { status: 500 });
    }

    const userDocRef = adminDb.collection('users').doc(uid);
    const walletDocRef = adminDb.collection('wallets').doc(uid);
    const settingsDocRef = adminDb.collection('settings').doc('game');
    const rankingDocRef = adminDb.collection('rankings').doc(uid);

    // 1. Buscar multiplicadores cadastrados no Firestore (fora da transação para reduzir contenção e evitar erro de read-after-write)
    const multSnap = await adminDb.collection('multipliers').orderBy('value', 'asc').get();
    let multipliersList = multSnap.docs.map((doc: any) => doc.data());
    
    if (multipliersList.length === 0) {
      multipliersList = [
        { value: 0, label: "0x", weight: 55 },
        { value: 0.5, label: "0.5x", weight: 25 },
        { value: 1, label: "1x", weight: 12 },
        { value: 1.5, label: "1.5x", weight: 5 },
        { value: 2, label: "2x", weight: 2 },
        { value: 3, label: "3x", weight: 0.8 },
        { value: 5, label: "5x", weight: 0.1 },
        { value: 10, label: "10x", weight: 0.1 }
      ];
    }

    const result = await adminDb.runTransaction(async (transaction: any) => {
      // 2. Carregar perfil do usuário
      const userSnap = await transaction.get(userDocRef);
      if (!userSnap.exists) {
        throw new Error('Usuário não cadastrado');
      }
      const user = userSnap.data()!;
      if (user.status !== 'active') {
        throw new Error('Sua conta está bloqueada ou em análise.');
      }

      // 3. Carregar carteira
      const walletSnap = await transaction.get(walletDocRef);
      if (!walletSnap.exists) {
        throw new Error('Carteira não encontrada');
      }
      const wallet = walletSnap.data()!;

      // 4. Carregar configurações
      const settingsSnap = await transaction.get(settingsDocRef);
      const settings = settingsSnap.exists ? settingsSnap.data()! : { minBet: 1.00, maxBet: 500.00 };

      // 5. Carregar ranking (TODAS AS LEITURAS DEVEM OCORRER AQUI ANTES DE QUALQUER ESCRITA)
      const rankingSnap = await transaction.get(rankingDocRef);

      if (betAmount < settings.minBet || betAmount > settings.maxBet) {
        throw new Error(`Aposta deve estar entre R$ ${settings.minBet.toFixed(2)} e R$ ${settings.maxBet.toFixed(2)}`);
      }

      if (wallet.balance < betAmount) {
        throw new Error('Saldo insuficiente!');
      }

      // 6. Sortear
      const chosenMultiplier = getWeightedMultiplier(multipliersList);
      const fish = getFishDetails(chosenMultiplier.value);

      const winAmount = Number((betAmount * chosenMultiplier.value).toFixed(2));
      const previousBalance = wallet.balance;
      const newBalance = Number((previousBalance - betAmount + winAmount).toFixed(2));
      const updatedAt = new Date().toISOString();

      // 7. Atualizar Carteira (Primeiro Write)
      transaction.update(walletDocRef, {
        balance: newBalance,
        updatedAt
      });

      // 8. Criar rodada de jogo (Segundo Write)
      const roundRef = adminDb.collection('gameRounds').doc();
      const roundData = {
        uid,
        userName: user.name,
        betAmount,
        winAmount,
        multiplier: chosenMultiplier.value,
        fishType: fish.name,
        createdAt: new Date().toISOString()
      };
      transaction.set(roundRef, roundData);

      // 9. Atualizar Rankings (Terceiro Write)
      if (rankingSnap.exists) {
        const ranking = rankingSnap.data()!;
        const updates: any = {
          totalRounds: (ranking.totalRounds || 0) + 1,
          totalWins: (ranking.totalWins || 0) + (winAmount > 0 ? 1 : 0)
        };
        if (winAmount > (ranking.biggestWin || 0)) {
          updates.biggestWin = winAmount;
        }
        if (chosenMultiplier.value > (ranking.maxMultiplier || 0)) {
          updates.maxMultiplier = chosenMultiplier.value;
        }
        transaction.update(rankingDocRef, updates);
      } else {
        transaction.set(rankingDocRef, {
          name: user.name,
          totalRounds: 1,
          totalWins: winAmount > 0 ? 1 : 0,
          biggestWin: winAmount,
          maxMultiplier: chosenMultiplier.value
        });
      }

      return {
        roundId: roundRef.id,
        winAmount,
        multiplier: chosenMultiplier.value,
        fishType: fish.name,
        fishColor: fish.color,
        balance: newBalance,
        previousBalance,
        wallet: {
          balance: newBalance,
          lockedBalance: wallet.lockedBalance || 0,
          updatedAt
        }
      };
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Erro ao processar rodada de pesca:", error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
