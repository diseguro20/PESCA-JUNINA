import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../lib/firebaseAdmin';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';

export async function POST(req: Request) {
  try {
    const { adminUid, targetUid, status } = await req.json();

    if (!adminUid || !targetUid || !status || !['active', 'blocked', 'review'].includes(status)) {
      return NextResponse.json({ error: 'Campos adminUid, targetUid e status ("active", "blocked", "review") são obrigatórios' }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();

    if (isAdminDemoMode) {
      const dbData = getMockDb();
      
      // Validar admin
      const adminUser = dbData.users[adminUid];
      if (!adminUser || adminUser.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso não autorizado!' }, { status: 403 });
      }

      // Localizar usuário alvo
      const targetUser = dbData.users[targetUid];
      if (!targetUser) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      const previousStatus = targetUser.status;
      targetUser.status = status;

      // Registrar log administrativo
      const logId = "log-" + Math.random().toString(36).substring(2, 11);
      dbData.adminLogs.push({
        id: logId,
        adminUid,
        adminEmail: adminUser.email,
        action: 'ALTERAR_STATUS_USUARIO',
        details: `Alterado status do usuário ${targetUser.email} (${targetUser.uid}) de "${previousStatus}" para "${status}"`,
        createdAt: updatedAt
      });

      saveMockDb(dbData);
      return NextResponse.json({ success: true });
    }

    // --- MODO PRODUÇÃO FIRESTORE ---
    if (!adminDb) {
      return NextResponse.json({ error: 'Serviço Firebase Admin indisponível' }, { status: 500 });
    }

    const adminDocRef = adminDb.collection('users').doc(adminUid);
    const targetDocRef = adminDb.collection('users').doc(targetUid);

    await adminDb.runTransaction(async (transaction: any) => {
      // 1. Validar admin
      const adminSnap = await transaction.get(adminDocRef);
      if (!adminSnap.exists || adminSnap.data()?.role !== 'admin') {
        throw new Error('Acesso não autorizado!');
      }
      const adminData = adminSnap.data()!;

      // 2. Verificar usuário alvo
      const targetSnap = await transaction.get(targetDocRef);
      if (!targetSnap.exists) {
        throw new Error('Usuário não encontrado');
      }
      const targetData = targetSnap.data()!;

      // 3. Atualizar status do usuário
      transaction.update(targetDocRef, {
        status,
        updatedAt
      });

      // 4. Salvar log
      const logRef = adminDb.collection('adminLogs').doc();
      transaction.set(logRef, {
        adminUid,
        adminEmail: adminData.email,
        action: 'ALTERAR_STATUS_USUARIO',
        details: `Alterado status do usuário ${targetData.email} (${targetUid}) de "${targetData.status}" para "${status}"`,
        createdAt: updatedAt
      });
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Erro ao alterar status do usuário por admin:", error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}

// Handler de edição de dados (como nome do usuário)
export async function PUT(req: Request) {
  try {
    const { uid, name } = await req.json();

    if (!uid || !name) {
      return NextResponse.json({ error: 'Campos uid e name são obrigatórios' }, { status: 400 });
    }

    if (isAdminDemoMode) {
      const dbData = getMockDb();
      const user = dbData.users[uid];
      if (!user) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }
      user.name = name;
      saveMockDb(dbData);
      return NextResponse.json({ success: true });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Serviço Firebase Admin indisponível' }, { status: 500 });
    }

    await adminDb.collection('users').doc(uid).update({
      name,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
