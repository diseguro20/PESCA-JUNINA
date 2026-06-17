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
async function callProxyForwarder(url: string, body: any): Promise<any> {
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
      method: 'POST',
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
  const amountInCents = Math.round(amount * 100);

  if (!isLivePaymentsConfigured) {
    // Modo Simulação/Demo
    console.log(`[PaymentService] Simulando cobrança Pix de R$ ${amount.toFixed(2)}`);
    const mockId = "tp_chg_" + Math.random().toString(36).substring(2, 11);
    
    // QR Code PIX estático de teste
    const mockQrCodeText = `00020101021126580014br.gov.bcb.pix0136pix-demo@quermesse.com.br520400005303986540${amountInCents}5802BR5925Pesca Online Junina6009Sao Paulo62070503***6304CA12`;

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
    // Endpoint padrão da TriboPay para criar cobrança (Exemplo baseado em documentações REST de Pix)
    const targetUrl = 'https://api.tribopay.com.br/v1/pix/charge';
    const payload = {
      amount: amountInCents,
      customer: {
        name,
        email
      },
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://sua-plataforma.vercel.app'}/api/webhook/tribopay`
    };

    const response = await callProxyForwarder(targetUrl, payload);

    return {
      success: true,
      id: response.id || response.txid,
      qrCodeText: response.pix_copia_e_cola || response.qr_code,
      qrCodeImage: response.qr_code_image || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(response.pix_copia_e_cola || response.qr_code)}`,
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
  pixKey: string
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
    // Endpoint padrão da TriboPay para efetuar saque/transferência Pix
    const targetUrl = 'https://api.tribopay.com.br/v1/pix/payout';
    const payload = {
      amount: amountInCents,
      pix_key: pixKey,
      pix_key_type: determinePixKeyType(pixKey)
    };

    const response = await callProxyForwarder(targetUrl, payload);

    return {
      success: true,
      id: response.id || response.payout_id,
      amount,
      status: response.status === 'success' || response.status === 'approved' ? 'approved' : 'pending'
    };
  } catch (error: any) {
    console.error("Erro ao efetuar transferência Pix na TriboPay:", error);
    throw error;
  }
}

/**
 * Função utilitária para tentar inferir o tipo de chave Pix
 */
function determinePixKeyType(key: string): 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' {
  const cleanKey = key.replace(/\D/g, '');
  
  if (cleanKey.length === 11) {
    return 'CPF';
  }
  if (cleanKey.length === 14) {
    return 'CNPJ';
  }
  if (key.includes('@')) {
    return 'EMAIL';
  }
  if (cleanKey.length >= 10 && cleanKey.length <= 13) {
    return 'PHONE';
  }
  return 'EVP'; // Chave aleatória
}
