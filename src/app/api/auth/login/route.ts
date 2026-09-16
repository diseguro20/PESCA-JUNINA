import { NextResponse } from 'next/server';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';
import { OWNER_EMAIL, getPrivateAccessError, isOwnerEmail } from '../../../../lib/privateAccess';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 });
    }

    const dbData = getMockDb();
    
    // Procurar por e-mail (case insensitive)
    const normalizedEmail = email.toLowerCase().trim();
    if (!isOwnerEmail(normalizedEmail)) {
      return NextResponse.json({ error: getPrivateAccessError() }, { status: 403 });
    }

    const user = Object.values(dbData.users).find(u => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      const ownerUser = {
        uid: 'owner-demo-id',
        name: 'diseguro20',
        email: OWNER_EMAIL,
        role: 'admin' as const,
        status: 'active' as const,
        createdAt: new Date().toISOString()
      };
      dbData.users[ownerUser.uid] = ownerUser;

      if (!dbData.wallets[ownerUser.uid]) {
        dbData.wallets[ownerUser.uid] = {
          uid: ownerUser.uid,
          balance: 0,
          lockedBalance: 0,
          updatedAt: new Date().toISOString()
        };
      }

      saveMockDb(dbData);
      return NextResponse.json({ success: true, user: ownerUser });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Sua conta está bloqueada ou em análise.' }, { status: 403 });
    }

    if (user.role !== 'admin') {
      user.role = 'admin';
      saveMockDb(dbData);
    }

    return NextResponse.json({ success: true, user });

  } catch (error: any) {
    console.error("Erro no login mock:", error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
