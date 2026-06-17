import { NextResponse } from 'next/server';
import { getMockDb, saveMockDb } from '../../../../lib/mockDb';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 });
    }

    const dbData = getMockDb();
    
    // Procurar por e-mail (case insensitive)
    const normalizedEmail = email.toLowerCase().trim();
    const user = Object.values(dbData.users).find(u => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      // Criação rápida de usuários padrão se não existirem
      if (normalizedEmail === 'chico@pesca.com') {
        const defaultUser = {
          uid: 'user-demo-id',
          name: 'Chico Bento',
          email: 'chico@pesca.com',
          role: 'user' as const,
          status: 'active' as const,
          createdAt: new Date().toISOString()
        };
        dbData.users[defaultUser.uid] = defaultUser;
        
        if (!dbData.wallets[defaultUser.uid]) {
          dbData.wallets[defaultUser.uid] = {
            uid: defaultUser.uid,
            balance: 150.00,
            lockedBalance: 0,
            updatedAt: new Date().toISOString()
          };
        }
        saveMockDb(dbData);
        return NextResponse.json({ success: true, user: defaultUser });
      }

      if (normalizedEmail === 'admin@pesca.com') {
        const defaultAdmin = {
          uid: 'admin-demo-id',
          name: 'Administrador Caipira',
          email: 'admin@pesca.com',
          role: 'admin' as const,
          status: 'active' as const,
          createdAt: new Date().toISOString()
        };
        dbData.users[defaultAdmin.uid] = defaultAdmin;
        
        if (!dbData.wallets[defaultAdmin.uid]) {
          dbData.wallets[defaultAdmin.uid] = {
            uid: defaultAdmin.uid,
            balance: 1000.00,
            lockedBalance: 0,
            updatedAt: new Date().toISOString()
          };
        }
        saveMockDb(dbData);
        return NextResponse.json({ success: true, user: defaultAdmin });
      }

      return NextResponse.json({ error: 'E-mail não cadastrado. Cadastre-se na quermesse!' }, { status: 404 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Sua conta está bloqueada ou em análise.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, user });

  } catch (error: any) {
    console.error("Erro no login mock:", error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
