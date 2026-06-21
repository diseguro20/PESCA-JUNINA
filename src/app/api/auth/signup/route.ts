import { NextResponse } from 'next/server';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Campos nome, email e senha são obrigatórios' }, { status: 400 });
    }

    const dbData = getMockDb();
    
    // Verificar se e-mail existe
    const normalizedEmail = email.toLowerCase().trim();
    const emailExists = Object.values(dbData.users).some(u => u.email.toLowerCase() === normalizedEmail);

    if (emailExists) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado!' }, { status: 400 });
    }

    // Criar ID único
    const uid = "user-" + Math.random().toString(36).substring(2, 11);
    
    const newUser = {
      uid,
      name,
      email: normalizedEmail,
      role: (normalizedEmail.includes('admin') ? 'admin' : 'user') as 'admin' | 'user', // Facilitar virar admin para testes
      status: 'active' as const,
      createdAt: new Date().toISOString()
    };

    // Criar carteira com R$ 0,00 inicial
    const newWallet = {
      uid,
      balance: 0.00,
      lockedBalance: 0.00,
      updatedAt: new Date().toISOString()
    };

    dbData.users[uid] = newUser;
    dbData.wallets[uid] = newWallet;
    
    saveMockDb(dbData);

    return NextResponse.json({ success: true, user: newUser });

  } catch (error: any) {
    console.error("Erro no cadastro mock:", error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
