import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../lib/firebaseAdmin';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';

export async function POST(req: Request) {
  try {
    const { adminUid, minBet, maxBet, multipliers } = await req.json();

    if (!adminUid || minBet === undefined || maxBet === undefined || !multipliers || !Array.isArray(multipliers)) {
      return NextResponse.json({ error: 'Campos adminUid, minBet, maxBet e multipliers (array) são obrigatórios' }, { status: 400 });
    }

    if (minBet <= 0 || maxBet <= minBet) {
      return NextResponse.json({ error: 'Limites de aposta inválidos' }, { status: 400 });
    }

    // Verificar soma dos pesos (weights)
    const totalWeight = multipliers.reduce((sum, m) => sum + (m.weight || 0), 0);
    if (totalWeight <= 0) {
      return NextResponse.json({ error: 'A soma dos pesos dos multiplicadores deve ser maior que zero' }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();

    if (isAdminDemoMode) {
      const dbData = getMockDb();
      
      // Validar admin
      const adminUser = dbData.users[adminUid];
      if (!adminUser || adminUser.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso não autorizado!' }, { status: 403 });
      }

      // Atualizar configurações
      dbData.settings.minBet = minBet;
      dbData.settings.maxBet = maxBet;
      dbData.multipliers = multipliers.map(m => ({
        value: Number(m.value),
        label: m.label || `${m.value}x`,
        color: m.color || 'blue',
        weight: Number(m.weight)
      }));

      // Registrar log administrativo
      const logId = "log-" + Math.random().toString(36).substring(2, 11);
      dbData.adminLogs.push({
        id: logId,
        adminUid,
        adminEmail: adminUser.email,
        action: 'ATUALIZAR_CONFIGURACOES',
        details: `Atualizadas apostas min/max (R$ ${minBet} - R$ ${maxBet}) e pesos de ${multipliers.length} multiplicadores`,
        createdAt: updatedAt
      });

      saveMockDb(dbData);
      return NextResponse.json({ success: true });
    }

    // --- MODO PRODUÇÃO FIRESTORE (TRANSAÇÃO) ---
    if (!adminDb) {
      return NextResponse.json({ error: 'Serviço Firebase Admin indisponível' }, { status: 500 });
    }

    const adminDocRef = adminDb.collection('users').doc(adminUid);
    const settingsDocRef = adminDb.collection('settings').doc('game');

    await adminDb.runTransaction(async (transaction: any) => {
      // 1. Validar admin
      const adminSnap = await transaction.get(adminDocRef);
      if (!adminSnap.exists || adminSnap.data()?.role !== 'admin') {
        throw new Error('Acesso não autorizado!');
      }
      const adminData = adminSnap.data()!;

      // 2. Atualizar configurações básicas
      transaction.set(settingsDocRef, {
        minBet,
        maxBet,
        updatedAt
      }, { merge: true });

      // 3. Atualizar multiplicadores (removendo e adicionando)
      // Como transações Firestore não podem deletar coleções inteiras facilmente em uma linha,
      // nós podemos apagar no lote de gravação subsequente ou usar loops.
      // Em Next.js API, podemos gerenciar atualizando cada documento na coleção.
      // Para fazer isso de forma limpa, primeiro escrevemos no settings,
      // e depois da transação nós reescrevemos a coleção de multiplicadores.
    });

    // Sobrescrever multiplicadores
    const multColRef = adminDb.collection('multipliers');
    const existingMults = await multColRef.get();
    
    const batch = adminDb.batch();
    // Excluir multiplicadores antigos
    existingMults.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    // Criar novos
    multipliers.forEach((m: any) => {
      const docRef = multColRef.doc(String(m.value).replace('.', '_'));
      batch.set(docRef, {
        value: Number(m.value),
        label: m.label || `${m.value}x`,
        color: m.color || 'blue',
        weight: Number(m.weight)
      });
    });

    // Salvar log
    const logRef = adminDb.collection('adminLogs').doc();
    batch.set(logRef, {
      adminUid,
      adminEmail: (await adminDocRef.get()).data()?.email,
      action: 'ATUALIZAR_CONFIGURACOES',
      details: `Atualizadas apostas min/max (R$ ${minBet} - R$ ${maxBet}) e pesos de ${multipliers.length} multiplicadores`,
      createdAt: updatedAt
    });

    await batch.commit();

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Erro ao atualizar configurações:", error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
