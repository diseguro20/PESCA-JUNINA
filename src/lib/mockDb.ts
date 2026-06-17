import fs from 'fs';
import path from 'path';

// Estrutura do Banco de Dados Mock
export interface MockDbData {
  users: Record<string, {
    uid: string;
    name: string;
    email: string;
    role: 'user' | 'admin';
    status: 'active' | 'blocked' | 'review';
    createdAt: string;
  }>;
  wallets: Record<string, {
    uid: string;
    balance: number;
    lockedBalance: number;
    updatedAt: string;
  }>;
  deposits: Array<{
    id: string;
    uid: string;
    email: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'paid' | 'expired' | 'refunded';
    receiptUrl?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  withdrawals: Array<{
    id: string;
    uid: string;
    email: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected';
    pixKey?: string;
    pixKeyType?: 'document' | 'email' | 'phone_number' | 'aleatory';
    recipientName?: string;
    recipientDocument?: string;
    payoutId?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  gameRounds: Array<{
    id: string;
    uid: string;
    userName: string;
    betAmount: number;
    winAmount: number;
    multiplier: number;
    fishType: string;
    createdAt: string;
  }>;
  adminLogs: Array<{
    id: string;
    adminUid: string;
    adminEmail: string;
    action: string;
    details: string;
    createdAt: string;
  }>;
  settings: {
    minBet: number;
    maxBet: number;
    houseEdge: number;
  };
  multipliers: Array<{
    value: number;
    label: string;
    color: string;
    weight: number;
  }>;
}

const DEFAULT_DB: MockDbData = {
  users: {
    "admin-demo-id": {
      uid: "admin-demo-id",
      name: "Administrador Caipira",
      email: "admin@pesca.com",
      role: "admin",
      status: "active",
      createdAt: new Date().toISOString()
    },
    "user-demo-id": {
      uid: "user-demo-id",
      name: "Chico Bento",
      email: "chico@pesca.com",
      role: "user",
      status: "active",
      createdAt: new Date().toISOString()
    }
  },
  wallets: {
    "admin-demo-id": {
      uid: "admin-demo-id",
      balance: 1000.00,
      lockedBalance: 0,
      updatedAt: new Date().toISOString()
    },
    "user-demo-id": {
      uid: "user-demo-id",
      balance: 150.00,
      lockedBalance: 0,
      updatedAt: new Date().toISOString()
    }
  },
  deposits: [
    {
      id: "dep-1",
      uid: "user-demo-id",
      email: "chico@pesca.com",
      amount: 100.00,
      status: "approved",
      receiptUrl: "https://example.com/comprovante1.png",
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 24).toISOString()
    },
    {
      id: "dep-2",
      uid: "user-demo-id",
      email: "chico@pesca.com",
      amount: 50.00,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  withdrawals: [
    {
      id: "wit-1",
      uid: "user-demo-id",
      email: "chico@pesca.com",
      amount: 25.00,
      status: "approved",
      pixKey: "chico@pesca.com",
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 12).toISOString()
    }
  ],
  gameRounds: [
    {
      id: "round-1",
      uid: "user-demo-id",
      userName: "Chico Bento",
      betAmount: 10.00,
      winAmount: 20.00,
      multiplier: 2,
      fishType: "Peixe Verde",
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
      id: "round-2",
      uid: "user-demo-id",
      userName: "Chico Bento",
      betAmount: 5.00,
      winAmount: 0.00,
      multiplier: 0,
      fishType: "Nenhum Peixe",
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
    }
  ],
  adminLogs: [
    {
      id: "log-1",
      adminUid: "admin-demo-id",
      adminEmail: "admin@pesca.com",
      action: "INICIALIZACAO",
      details: "Banco de dados de simulação criado",
      createdAt: new Date().toISOString()
    }
  ],
  settings: {
    minBet: 1.00,
    maxBet: 500.00,
    houseEdge: 0.05
  },
  multipliers: [
    { value: 0, label: "0x - Nada fisgou!", color: "gray", weight: 35 },
    { value: 0.5, label: "0.5x - Peixinho Comum", color: "blue", weight: 20 },
    { value: 1, label: "1x - Peixe Azul", color: "blue", weight: 15 },
    { value: 1.5, label: "1.5x - Peixe Vermelho", color: "blue", weight: 10 },
    { value: 2, label: "2x - Peixe Verde", color: "green", weight: 8 },
    { value: 3, label: "3x - Peixe Roxo", color: "purple", weight: 6 },
    { value: 5, label: "5x - Peixe Dourado", color: "gold", weight: 4 },
    { value: 10, label: "10x - Peixe Lendário de Chapéu de Palha!", color: "rainbow", weight: 2 }
  ]
};

const DB_PATH = path.join(process.cwd(), 'src', 'lib', 'mock_db_store.json');

export function getMockDb(): MockDbData {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // Criar diretório se não existir
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
      return DEFAULT_DB;
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Erro ao ler banco de dados mock:", error);
    return DEFAULT_DB;
  }
}

export function saveMockDb(data: MockDbData): void {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error("Erro ao salvar banco de dados mock:", error);
  }
}
