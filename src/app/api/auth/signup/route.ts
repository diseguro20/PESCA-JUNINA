import { NextResponse } from 'next/server';
import { getPrivateAccessError } from '../../../../lib/privateAccess';

export async function POST(req: Request) {
  try {
    return NextResponse.json({ error: getPrivateAccessError() }, { status: 403 });

  } catch (error: any) {
    console.error("Erro no cadastro mock:", error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
