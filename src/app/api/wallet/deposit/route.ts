import { NextResponse } from 'next/server';
import { isAdminDemoMode, adminDb } from '../../../../lib/firebaseAdmin';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';
import { createPixCharge } from '../../../../lib/paymentService';

export async function POST(req: Request) {
  try {
    const { uid, amount, receiptUrl } = await req.json();

    if (!uid || amount === undefined) {
      return NextResponse.json({ error: 'Campos uid e amount são obrigatórios' }, { status: 400 });
    }

    if (amount < 5) {
      return NextResponse.json({ error: 'O valor mínimo do depósito é de R$ 5,00' }, { status: 400 });
    }

    const createdAt = new Date().toISOString();

    if (isAdminDemoMode) {
      const dbData = getMockDb();
      const user = dbData.users[uid];
      if (!user) {
        return NextResponse.json({ error: 'Usuário não cadastrado' }, { status: 404 });
      }

      // Gerar cobrança Pix (Simulada no Modo Demo)
      const pixData = await createPixCharge(amount, user.name, user.email);

      const depositId = pixData.id;
      const newDeposit = {
        id: depositId,
        uid,
        email: user.email,
        amount,
        status: 'pending' as const,
        receiptUrl,
        qrCodeText: pixData.qrCodeText,
        qrCodeImage: pixData.qrCodeImage,
        createdAt,
        updatedAt: createdAt
      };

      dbData.deposits.push(newDeposit);
      saveMockDb(dbData);

      return NextResponse.json({ success: true, deposit: newDeposit });
    }

    // --- MODO PRODUÇÃO FIRESTORE ---
    if (!adminDb) {
      return NextResponse.json({ error: 'Serviço Firebase Admin indisponível' }, { status: 500 });
    }

    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Usuário não cadastrado' }, { status: 404 });
    }
    const user = userSnap.data()!;

    // Gerar cobrança Pix (Real via Proxy ou simulada se variáveis não estiverem setadas)
    const pixData = await createPixCharge(amount, user.name, user.email);

    const depositRef = adminDb.collection('deposits').doc(pixData.id);
    const depositData = {
      uid,
      email: user.email,
      amount,
      status: 'pending',
      receiptUrl: receiptUrl || null,
      qrCodeText: pixData.qrCodeText,
      qrCodeImage: pixData.qrCodeImage,
      createdAt,
      updatedAt: createdAt
    };

    await depositRef.set(depositData);

    return NextResponse.json({ 
      success: true, 
      id: depositRef.id,
      qrCodeText: pixData.qrCodeText,
      qrCodeImage: pixData.qrCodeImage
    });

  } catch (error: any) {
    console.error("Erro ao solicitar depósito:", error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}

