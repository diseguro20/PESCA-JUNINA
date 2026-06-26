require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const PROXY_SECRET_KEY = process.env.PROXY_SECRET_KEY;
const TRIBOPAY_TOKEN = process.env.TRIBOPAY_TOKEN;

// Validação de inicialização
if (!PROXY_SECRET_KEY) {
  console.error("❌ ERRO: PROXY_SECRET_KEY é obrigatório no arquivo .env");
  process.exit(1);
}

if (!TRIBOPAY_TOKEN) {
  console.warn("⚠️ AVISO: TRIBOPAY_TOKEN não configurado. Endpoints da TriboPay não funcionarão por padrão.");
}

// Rota de Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Proxy operacional.' });
});

// Rota protegida para descobrir o IP publico usado em chamadas de saida.
app.get('/outbound-ip', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${PROXY_SECRET_KEY}`) {
      return res.status(401).json({ error: 'Acesso Nao Autorizado. Chave do proxy invalida.' });
    }

    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Falha ao consultar IP de saida.' });
    }

    const data = await response.json();
    return res.status(200).json({
      ip: data.ip,
      message: 'Autorize este IP na Vizzion Pay para as transferencias Pix.'
    });
  } catch (error) {
    console.error('[Proxy] Erro ao consultar IP de saida:', error);
    return res.status(500).json({ error: 'Erro ao consultar IP de saida', details: error.message });
  }
});

// Rota Genérica de Encaminhamento (Forwarder)
app.post('/api/forward', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    // 1. Validar chave secreta do proxy para evitar chamadas de terceiros
    if (!authHeader || authHeader !== `Bearer ${PROXY_SECRET_KEY}`) {
      return res.status(401).json({ error: 'Acesso Não Autorizado. Chave do proxy inválida.' });
    }

    const { url, method = 'POST', body } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'O campo "url" é obrigatório no corpo da requisição.' });
    }

    const target = new URL(url);
    const allowedHosts = (process.env.PROXY_ALLOWED_HOSTS || 'app.vizzionpay.com.br,api.tribopay.com.br')
      .split(',')
      .map(host => host.trim().toLowerCase())
      .filter(Boolean);

    if (!allowedHosts.includes(target.hostname.toLowerCase())) {
      return res.status(403).json({ error: `Host externo não permitido pelo proxy: ${target.hostname}` });
    }

    const isVizzionPay = target.hostname.toLowerCase().endsWith('vizzionpay.com.br');
    const isTriboPay = target.hostname.toLowerCase().includes('tribopay');

    // Obter credenciais Vizzion Pay das requisições recebidas ou das variáveis locais
    const vizzionPublicKey = req.headers['x-public-key'] || process.env.VIZZIONPAY_PUBLIC_KEY;
    const vizzionSecretKey = req.headers['x-secret-key'] || process.env.VIZZIONPAY_CLIENT_SECRET;

    // Obter token TriboPay se aplicável
    const tribopayToken = req.headers['x-tribopay-token'] || TRIBOPAY_TOKEN;

    let finalBody = body;
    // Injeta tokens TriboPay apenas se a URL for explicitamente para a TriboPay
    if (isTriboPay && finalBody && typeof finalBody === 'object' && method.toUpperCase() !== 'GET') {
      if (!finalBody.api_token) {
        finalBody.api_token = tribopayToken;
      }
      if (!finalBody.access_token) {
        finalBody.access_token = tribopayToken;
      }
    }

    console.log(`[Proxy] Encaminhando requisição ${method} para: ${url}`);

    // Configurar headers de saída
    const outHeaders = {
      'Content-Type': 'application/json'
    };

    if (isVizzionPay && vizzionPublicKey) {
      outHeaders['X-Public-Key'] = vizzionPublicKey;
    }
    if (isVizzionPay && vizzionSecretKey) {
      outHeaders['X-Secret-Key'] = vizzionSecretKey;
    }
    if (isTriboPay && tribopayToken) {
      outHeaders['Authorization'] = `Bearer ${tribopayToken}`;
    }

    // 2. Fazer requisição usando o IP estático deste servidor
    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: outHeaders,
      body: finalBody ? JSON.stringify(finalBody) : undefined
    });

    const rawResponse = await response.text();
    let data = null;
    try {
      data = rawResponse ? JSON.parse(rawResponse) : null;
    } catch (_) {
      data = rawResponse ? { message: rawResponse } : null;
    }

    console.log(`[Proxy] Resposta recebida da API externa. Status: ${response.status}`);
    
    return res.status(response.status).json(data || { status: response.status, message: 'Sem resposta JSON' });

  } catch (error) {
    console.error('[Proxy] Erro ao encaminhar requisição:', error);
    return res.status(500).json({ error: 'Erro interno no proxy do servidor', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Proxy rodando na porta ${PORT}`);
  console.log(`🔒 IPs Permitidos devem conter o IP público de saída deste servidor.`);
});
