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
if (!PROXY_SECRET_KEY || !TRIBOPAY_TOKEN) {
  console.error("❌ ERRO: PROXY_SECRET_KEY e TRIBOPAY_TOKEN são obrigatórios no arquivo .env");
  process.exit(1);
}

// Rota de Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Proxy operacional.' });
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

    let finalBody = body;
    if (finalBody && typeof finalBody === 'object' && method.toUpperCase() !== 'GET') {
      if (!finalBody.api_token) {
        finalBody.api_token = TRIBOPAY_TOKEN;
      }
      if (!finalBody.access_token) {
        finalBody.access_token = TRIBOPAY_TOKEN;
      }
    }

    console.log(`[Proxy] Encaminhando requisição ${method} para: ${url}`);

    // 2. Fazer requisição à TriboPay usando o IP estático deste servidor
    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TRIBOPAY_TOKEN}` // Anexa o Token real da TriboPay com segurança
      },
      body: finalBody ? JSON.stringify(finalBody) : undefined
    });

    const data = await response.json().catch(() => null);

    console.log(`[Proxy] Resposta recebida da TriboPay. Status: ${response.status}`);
    
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
