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
    let errMsg = data.error || data.message || `Erro no proxy de pagamento (status: ${res.status})`;
    
    // Tratar erro da API legada (Cash-in)
    if (data.errors?.error_code === 'PAYMENT_PROCESSING_ERROR' || errMsg.includes('processar o pagamento')) {
      errMsg = "Erro TriboPay (PAYMENT_PROCESSING_ERROR): A API legada de depósitos falhou. É obrigatório configurar a variável de ambiente TRIBOPAY_OFFER_HASH no seu servidor/Vercel com uma Oferta de Checkout ativa do painel da TriboPay para migrar para a API v1.";
    }
    // Tratar erro da API v1
    else if (url.includes('v1/transactions') && res.status === 500) {
      errMsg = `Erro TriboPay v1 (Status 500): Falha ao gerar transação de checkout. Certifique-se de que o TRIBOPAY_OFFER_HASH (${body?.offer_hash || 'não definido'}) é uma oferta de checkout PIX ativa e válida no seu painel da TriboPay, e que o token da API está correto.`;
    }
    
    throw new Error(errMsg);
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
    // Sanitizar o nome do pagador para conformidade com as regras do gateway (mínimo 2 palavras, sem números)
    let sanitizedName = name.replace(/[0-9]/g, '').trim();
    sanitizedName = sanitizedName.replace(/\s+/g, ' ');
    if (!sanitizedName) {
      sanitizedName = "Jogador Junino";
    } else {
      const parts = sanitizedName.split(' ').filter(Boolean);
      if (parts.length < 2) {
        sanitizedName = `${parts[0] || 'Jogador'} Silva`;
      }
    }

    const offerHash = process.env.TRIBOPAY_OFFER_HASH;

    if (offerHash && offerHash !== 'your_offer_hash_here' && offerHash.trim() !== '') {
      // Usar a API v1 de Checkout/Transactions
      const targetUrl = 'https://api.tribopay.com.br/api/public/v1/transactions';
      const payload = {
        offer_hash: offerHash,
        amount: Math.round(amount * 100), // Converte para centavos (integer)
        payment_method: 'pix',
        customer: {
          name: sanitizedName,
          email: email
        },
        cart: {
          items: {
            title: "Saldo de Jogo",
            quantity: 1,
            price: Math.round(amount * 100)
          }
        },
        postback_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pesca-junina.vercel.app'}/api/webhook/tribopay`,
        postbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pesca-junina.vercel.app'}/api/webhook/tribopay`
      };

      const response = await callProxyForwarder(targetUrl, payload, 'POST');
      const resource = response.data || response;

      const transactionId = resource.transaction_hash || resource.hash || resource.id;
      const qrCodeText = resource.pix?.qrcode || resource.pix?.code || resource.payment_response?.qrcode || '';
      const qrCodeImage = resource.pix?.qrcode_image || resource.pix?.imageBase64 || resource.payment_response?.qrcode_image || '';

      return {
        success: true,
        id: transactionId,
        qrCodeText,
        qrCodeImage: qrCodeImage || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeText)}`,
        amount
      };
    } else {
      // Fallback para a API de depósitos legada (Cash-In)
      const targetUrl = 'https://api.tribopay.com.br/api/public/cash/deposits/pix';
      const payload = {
        amount: Math.round(amount * 100),
        method: 'pix',
        transactionOrigin: 'cashin',
        payer: {
          name: sanitizedName,
          email
        },
        postbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pesca-junina.vercel.app'}/api/webhook/tribopay`
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
    }
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
    // Tenta primeiro no endpoint v1/transactions
    let response;
    try {
      const targetUrl = `https://api.tribopay.com.br/api/public/v1/transactions/${depositId}`;
      response = await callProxyForwarder(targetUrl, null, 'GET');
    } catch (e) {
      // Fallback para o endpoint legado se v1 falhar
      const targetUrl = `https://api.tribopay.com.br/api/public/cash/deposits/${depositId}`;
      response = await callProxyForwarder(targetUrl, null, 'GET');
    }
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

