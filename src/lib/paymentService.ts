export interface PixChargeResponse {
  success: boolean;
  id: string;
  qrCodeText: string;
  qrCodeImage?: string;
  amount: number;
}

export interface PixPayoutResponse {
  success: boolean;
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
}

const PROXY_SERVER_URL = process.env.PROXY_SERVER_URL;
const PROXY_SECRET_KEY = process.env.PROXY_SECRET_KEY;

export const isLivePaymentsConfigured = !!(PROXY_SERVER_URL && PROXY_SECRET_KEY);

/**
 * Encaminha uma requisição segura para o Proxy de IP Estático
 */
async function callProxyForwarder(url: string, body: any, method: 'POST' | 'GET' = 'POST'): Promise<any> {
  if (!isLivePaymentsConfigured) {
    throw new Error("Proxy de pagamento não configurado.");
  }

  const res = await fetch(`${PROXY_SERVER_URL}/api/forward`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PROXY_SECRET_KEY}`
    },
    body: JSON.stringify({
      url,
      method,
      body
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Erro no proxy de pagamento (status: ${res.status})`);
  }

  return data;
}

/**
 * Cria uma cobrança Pix (Cash-In)
 */
export async function createPixCharge(
  amount: number,
  name: string,
  email: string
): Promise<PixChargeResponse> {
  if (!isLivePaymentsConfigured) {
    // Modo Simulação/Demo
    console.log(`[PaymentService] Simulando cobrança Pix de R$ ${amount.toFixed(2)}`);
    const mockId = "tp_chg_" + Math.random().toString(36).substring(2, 11);
    
    // QR Code PIX estático de teste
    const mockQrCodeText = `00020101021126580014br.gov.bcb.pix0136pix-demo@quermesse.com.br520400005303986540${Math.round(amount * 100)}5802BR5925Pesca Online Junina6009Sao Paulo62070503***6304CA12`;

    return {
      success: true,
      id: mockId,
      qrCodeText: mockQrCodeText,
      qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockQrCodeText)}`,
      amount
    };
  }

  // --- INTEGRAÇÃO REAL VIA PROXY ---
  try {
    const targetUrl = 'https://api.tribopay.com.br/api/public/cash/deposits/pix';
    const payload = {
      amount: amount, // Envia o valor em float/reais diretamente de acordo com o schema (DepositRequest)
      method: 'pix',
      transactionOrigin: 'cashin',
      payer: {
        name,
        email
      },
      postbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://sua-plataforma.vercel.app'}/api/webhook/tribopay`
    };

    const response = await callProxyForwarder(targetUrl, payload, 'POST');
    const resource = response.data || response;

    return {
      success: true,
      id: resource.id,
      qrCodeText: resource.pix?.code || '',
      qrCodeImage: resource.pix?.imageBase64 || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(resource.pix?.code || '')}`,
      amount
    };
  } catch (error: any) {
    console.error("Erro ao criar cobrança Pix na TriboPay:", error);
    throw error;
  }
}

/**
 * Executa uma transferência Pix (Cash-Out / Saque)
 */
export async function executePixPayout(
  amount: number,
  pixKey: string,
  recipientName: string,
  recipientDocument: string,
  pixKeyType: 'document' | 'email' | 'phone_number' | 'aleatory',
  withdrawalId: string
): Promise<PixPayoutResponse> {
  const amountInCents = Math.round(amount * 100);

  if (!isLivePaymentsConfigured) {
    // Modo Simulação/Demo
    console.log(`[PaymentService] Simulando transferência Pix de R$ ${amount.toFixed(2)} para ${pixKey}`);
    return {
      success: true,
      id: "tp_pay_" + Math.random().toString(36).substring(2, 11),
      amount,
      status: 'approved'
    };
  }

  // --- INTEGRAÇÃO REAL VIA PROXY ---
  try {
    const targetUrl = 'https://api.tribopay.com.br/api/public/cash/withdrawals';
    const payload = {
      amount: amountInCents, // Saques exigem o valor em centavos (integer)
      type: 'pix',
      externalId: withdrawalId,
      postbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://sua-plataforma.vercel.app'}/api/webhook/tribopay`,
      recipient: {
        name: recipientName,
        document: recipientDocument.replace(/\D/g, ''),
        pixKeyType,
        pixKey
      }
    };

    const response = await callProxyForwarder(targetUrl, payload, 'POST');
    const resource = response.data || response;

    return {
      success: true,
      id: resource.id,
      amount,
      status: resource.status === 'transferred' || resource.status === 'completed' ? 'approved' : 'pending'
    };
  } catch (error: any) {
    console.error("Erro ao efetuar transferência Pix na TriboPay:", error);
    throw error;
  }
}

/**
 * Consulta o status de um depósito na TriboPay para checagem ativa de segurança
 */
export async function verifyDepositStatus(depositId: string): Promise<any> {
  if (!isLivePaymentsConfigured) {
    return { status: 'paid' };
  }
  try {
    const targetUrl = `https://api.tribopay.com.br/api/public/cash/deposits/${depositId}`;
    const response = await callProxyForwarder(targetUrl, null, 'GET');
    return response.data || response;
  } catch (error) {
    console.error(`Erro ao consultar status do depósito ${depositId}:`, error);
    throw error;
  }
}

/**
 * Função utilitária para tentar inferir o tipo de chave Pix
 */
export function determinePixKeyType(key: string): 'document' | 'email' | 'phone_number' | 'aleatory' {
  const cleanKey = key.replace(/\D/g, '');
  
  if (cleanKey.length === 11 || cleanKey.length === 14) {
    return 'document';
  }
  if (key.includes('@')) {
    return 'email';
  }
  if (cleanKey.length >= 10 && cleanKey.length <= 13) {
    return 'phone_number';
  }
  return 'aleatory'; // Chave aleatória / EVP
}

