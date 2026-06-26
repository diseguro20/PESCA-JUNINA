import QRCode from 'qrcode';

export interface PixChargeResponse {
  success: boolean;
  id: string;
  identifier: string;
  gatewayId?: string;
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
const VIZZIONPAY_API_BASE_URL = (process.env.VIZZIONPAY_API_BASE_URL || 'https://app.vizzionpay.com.br/api/v1').replace(/\/$/, '');

export const isLivePaymentsConfigured = !!(PROXY_SERVER_URL && PROXY_SECRET_KEY);

/**
 * Encaminha uma requisição segura para o Proxy de IP Estático
 */
async function callProxyForwarder(url: string, body: any, method: 'POST' | 'GET' = 'POST'): Promise<any> {
  if (!isLivePaymentsConfigured) {
    throw new Error("Proxy de pagamento não configurado.");
  }

  const publicKey = process.env.VIZZIONPAY_PUBLIC_KEY;
  const secretKey = process.env.VIZZIONPAY_CLIENT_SECRET;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${PROXY_SECRET_KEY}`
  };

  if (publicKey) {
    headers['x-public-key'] = publicKey;
  }
  if (secretKey) {
    headers['x-secret-key'] = secretKey;
  }

  const res = await fetch(`${PROXY_SERVER_URL}/api/forward`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url,
      method,
      body
    })
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errMsg = data?.error || data?.message || data?.details || `Erro no proxy de pagamento (status: ${res.status})`;
    const error = new Error(errMsg) as Error & { status?: number; data?: any };
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Sanitiza o nome do beneficiário (apenas letras e espaços, sem acentos, máx 100 caracteres)
 */
function sanitizeRecipientName(name: string): string {
  const noAccents = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sanitized = noAccents.replace(/[^a-zA-Z\s]/g, "").replace(/\s+/g, " ").trim().substring(0, 100);
  const parts = sanitized.split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return sanitized;
  }

  if (parts.length === 1) {
    return `${parts[0]} Silva`;
  }

  return "Cliente Pesca";
}

/**
 * Mapeia o tipo de chave Pix do Next.js para os tipos da Vizzion Pay
 */
function mapPixKeyType(type: 'document' | 'email' | 'phone_number' | 'aleatory', key: string): 'cpf' | 'cnpj' | 'phone' | 'email' | 'random' {
  if (type === 'document') {
    const cleanKey = key.replace(/\D/g, '');
    return cleanKey.length === 14 ? 'cnpj' : 'cpf';
  }
  if (type === 'email') return 'email';
  if (type === 'phone_number') return 'phone';
  return 'random';
}

function toMoneyAmount(amount: number): number {
  return Number(amount.toFixed(2));
}

function getConfiguredUrl(envName: string, fallbackPath: string): string {
  const explicitUrl = process.env[envName];
  if (explicitUrl) {
    return explicitUrl;
  }

  return `${VIZZIONPAY_API_BASE_URL}${fallbackPath}`;
}

function getPixDepositUrls(): string[] {
  const explicitUrl = process.env.VIZZIONPAY_PIX_DEPOSIT_URL;
  if (explicitUrl) {
    return [explicitUrl];
  }

  return [
    `${VIZZIONPAY_API_BASE_URL}/gateway/pix/receive`,
    `${VIZZIONPAY_API_BASE_URL}/gateway/pix/deposit`
  ];
}

function getPixStatusUrls(depositId: string): string[] {
  const encodedId = encodeURIComponent(depositId);
  const explicitUrl = process.env.VIZZIONPAY_PIX_STATUS_URL;

  if (explicitUrl) {
    return [explicitUrl.replace('{id}', encodedId)];
  }

  return [
    `${VIZZIONPAY_API_BASE_URL}/gateway/pix/status/${encodedId}`,
    `${VIZZIONPAY_API_BASE_URL}/gateway/transactions/${encodedId}`,
    `${VIZZIONPAY_API_BASE_URL}/gateway/pix/deposit/${encodedId}`
  ];
}

function isEndpointNotFound(error: any): boolean {
  return error?.status === 404 || error?.status === 405;
}

function normalizeQrCodeImage(value: string): string {
  if (!value) {
    return '';
  }

  if (value.startsWith('data:image') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `data:image/png;base64,${value}`;
}

function getFirstString(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }

  return '';
}

function generateCpf(): string {
  const numbers = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const calculateDigit = (base: number[]) => {
    const factorStart = base.length + 1;
    const total = base.reduce((sum, value, index) => sum + value * (factorStart - index), 0);
    const digit = 11 - (total % 11);
    return digit >= 10 ? 0 : digit;
  };

  const firstDigit = calculateDigit(numbers);
  const secondDigit = calculateDigit([...numbers, firstDigit]);

  return [...numbers, firstDigit, secondDigit].join('');
}

function generatePhone(): string {
  const suffix = Math.floor(10000000 + Math.random() * 90000000);
  return `119${suffix}`;
}

/**
 * Gera um código EMV de Pix válido estruturalmente para fins de teste ou produção
 */
function buildPixEMV(key: string, amount: number, merchantName: string = "Pesca Online Junina", city: string = "Sao Paulo"): string {
  const gui = "br.gov.bcb.pix";
  
  // Merchant Account Info (Tag 26)
  const part00 = `0014${gui}`;
  const part01 = `01${key.length.toString().padStart(2, '0')}${key}`;
  const merchantAccountInfo = `26${(part00.length + part01.length).toString().padStart(2, '0')}${part00}${part01}`;
  
  // Category Code (Tag 52)
  const categoryCode = "52040000";
  
  // Currency (Tag 53)
  const currency = "5303986";
  
  // Amount (Tag 54)
  const amountStr = amount.toFixed(2);
  const transactionAmount = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;
  
  // Country Code (Tag 58)
  const countryCode = "5802BR";
  
  // Merchant Name (Tag 59)
  const merchantNamePart = `59${merchantName.length.toString().padStart(2, '0')}${merchantName}`;
  
  // Merchant City (Tag 60)
  const merchantCityPart = `60${city.length.toString().padStart(2, '0')}${city}`;
  
  // Additional Data Field (Tag 62)
  const txId = "***";
  const additionalData = `62${(4 + txId.length).toString().padStart(2, '0')}0503${txId}`;
  
  // Combine all fields except CRC
  const rawEMV = `000201${merchantAccountInfo}${categoryCode}${currency}${transactionAmount}${countryCode}${merchantNamePart}${merchantCityPart}${additionalData}6304`;
  
  // Calculate CRC16 CCITT
  let crc = 0xFFFF;
  for (let i = 0; i < rawEMV.length; i++) {
    const charCode = rawEMV.charCodeAt(i);
    let x = ((crc >> 8) ^ charCode) & 0xFF;
    x ^= x >> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
  }
  const crcStr = crc.toString(16).toUpperCase().padStart(4, '0');
  
  return rawEMV + crcStr;
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
    const mockId = "vp_chg_" + Math.random().toString(36).substring(2, 11);
    
    // Gerar um Pix EMV válido com chave demo estruturada para evitar erros de leitura [QRCD10]
    const mockQrCodeText = buildPixEMV("pix-demo@quermesse.com.br", amount);

    let localQrCodeImage = '';
    try {
      localQrCodeImage = await QRCode.toDataURL(mockQrCodeText);
    } catch (e) {
      localQrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockQrCodeText)}`;
    }

    return {
      success: true,
      id: mockId,
      identifier: mockId,
      qrCodeText: mockQrCodeText,
      qrCodeImage: localQrCodeImage,
      amount
    };
  }

  // --- INTEGRAÇÃO REAL VIA PROXY (VIZZION PAY) ---
  try {
    const localId = "dep_" + Math.random().toString(36).substring(2, 15);
    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pesca-junina.vercel.app'}/api/webhook/vizzionpay`;

    const payload = {
      identifier: localId,
      amount: toMoneyAmount(amount),
      callbackUrl,
      client: {
        name: sanitizeRecipientName(name),
        email,
        document: generateCpf(),
        phone: generatePhone()
      },
      products: [
        {
          id: "saldo-pesca-online",
          name: "Saldo Pesca Online",
          price: toMoneyAmount(amount),
          quantity: 1
        }
      ]
    };

    let response: any = null;
    let lastError: any = null;

    for (const targetUrl of getPixDepositUrls()) {
      try {
        response = await callProxyForwarder(targetUrl, payload, 'POST');
        lastError = null;
        break;
      } catch (error: any) {
        lastError = error;

        if (!isEndpointNotFound(error)) {
          throw error;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    const resource = response.data || response;
    const transactionId = getFirstString(
      resource.payment_id,
      resource.id,
      resource.transaction_id,
      resource.transactionId,
      resource.transaction?.id,
      resource.transaction?.payment_id
    ) || localId;
    const gatewayId = getFirstString(
      resource.transaction_id,
      resource.transactionId,
      resource.transaction?.id,
      resource.hash
    );
    const qrCodeText = getFirstString(
      resource.pix?.copy_paste,
      resource.pix?.copyPaste,
      resource.pix?.qr_code_text,
      resource.pix?.qrCodeText,
      resource.pix?.code,
      resource.pix?.qrcode,
      resource.pix?.qrCode,
      resource.copy_paste,
      resource.qrCodeText,
      resource.brcode
    );
    let qrCodeImage = normalizeQrCodeImage(getFirstString(
      resource.pix?.qr_code,
      resource.pix?.qrCodeImage,
      resource.pix?.qrcode_image,
      resource.pix?.image,
      resource.qrCodeImage,
      resource.qrcode_image
    ));

    if (!qrCodeText) {
      throw new Error("A Vizzion Pay nao retornou o codigo Pix copia e cola.");
    }

    // Se o gateway não retornou imagem do QR Code, geramos localmente
    if (!qrCodeImage) {
      try {
        qrCodeImage = await QRCode.toDataURL(qrCodeText);
      } catch (qrErr) {
        console.error("Erro ao gerar QR Code localmente:", qrErr);
        qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeText)}`;
      }
    }

    return {
      success: true,
      id: transactionId,
      identifier: localId,
      gatewayId,
      qrCodeText,
      qrCodeImage,
      amount
    };
  } catch (error: any) {
    console.error("Erro ao criar cobrança Pix na Vizzion Pay:", error);
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
  withdrawalId: string,
  ip: string = '179.241.195.127'
): Promise<PixPayoutResponse> {
  if (!isLivePaymentsConfigured) {
    // Modo Simulação/Demo
    console.log(`[PaymentService] Simulando transferência Pix de R$ ${amount.toFixed(2)} para ${pixKey}`);
    return {
      success: true,
      id: "vp_pay_" + Math.random().toString(36).substring(2, 11),
      amount,
      status: 'approved'
    };
  }

  // --- INTEGRAÇÃO REAL VIA PROXY (VIZZION PAY) ---
  try {
    const targetUrl = getConfiguredUrl('VIZZIONPAY_PIX_TRANSFER_URL', '/gateway/transfers');
    const cleanDoc = recipientDocument.replace(/\D/g, '');
    const docType = cleanDoc.length === 14 ? 'cnpj' : 'cpf';
    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pesca-junina.vercel.app'}/api/webhook/vizzionpay`;

    const payload = {
      identifier: withdrawalId,
      amount,
      discountFeeOfReceiver: false,
      pix: {
        type: mapPixKeyType(pixKeyType, pixKey),
        key: pixKey
      },
      owner: {
        ip: ip,
        name: sanitizeRecipientName(recipientName),
        document: {
          type: docType,
          number: cleanDoc
        }
      },
      callbackUrl
    };

    const response = await callProxyForwarder(targetUrl, payload, 'POST');
    const resource = response.data || response;
    const withdraw = resource.withdraw || resource.transfer || resource;
    const gatewayStatus = getFirstString(withdraw?.status, resource.status).toUpperCase();
    const payoutId = getFirstString(
      withdraw?.id,
      resource.id,
      resource.withdraw_id,
      resource.transfer_id,
      resource.transaction_id,
      resource.webhookToken,
      withdrawalId
    );

    const statusMap: Record<string, 'pending' | 'approved' | 'rejected'> = {
      'PENDING': 'pending',
      'PROCESSING': 'pending',
      'TRANSFERRING': 'pending',
      'APPROVED': 'approved',
      'PAID': 'approved',
      'COMPLETED': 'approved',
      'SUCCESS': 'approved',
      'CANCELED': 'rejected',
      'CANCELLED': 'rejected',
      'FAILED': 'rejected',
      'REJECTED': 'rejected'
    };

    return {
      success: true,
      id: payoutId,
      amount,
      status: statusMap[gatewayStatus] || 'pending'
    };
  } catch (error: any) {
    console.error("Erro ao efetuar transferência Pix na Vizzion Pay:", error);
    throw error;
  }
}

/**
 * Consulta o status de um depósito na Vizzion Pay para checagem ativa de segurança
 */
export async function verifyDepositStatus(depositId: string): Promise<any> {
  if (!isLivePaymentsConfigured) {
    return { status: 'approved' };
  }

  let lastError: any = null;

  try {
    for (const targetUrl of getPixStatusUrls(depositId)) {
      try {
        const response = await callProxyForwarder(targetUrl, null, 'GET');
        return response.data || response;
      } catch (error: any) {
        lastError = error;

        if (!isEndpointNotFound(error)) {
          throw error;
        }
      }
    }

    throw lastError;
  } catch (error) {
    console.error(`Erro ao consultar status do depósito ${depositId} na Vizzion Pay:`, error);
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
