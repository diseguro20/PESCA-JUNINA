const PROXY_SERVER_URL = "https://pesca-junina-proxy.onrender.com";
const PROXY_SECRET_KEY = "Diego2001*";

async function test() {
  const payload = {
    amount: 5000,
    method: 'pix',
    transactionOrigin: 'cashin',
    payer: {
      name: "Diego Teste",
      email: "diego@test.com"
    },
    postbackUrl: "https://pesca-junina.vercel.app/api/webhook/tribopay"
  };

  try {
    console.log("Chamando proxy...");
    const res = await fetch(`${PROXY_SERVER_URL}/api/forward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PROXY_SECRET_KEY}`
      },
      body: JSON.stringify({
        url: "https://api.tribopay.com.br/api/public/cash/deposits/pix",
        method: "POST",
        body: payload
      })
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (e) {
    console.error("Erro:", e.message);
  }
}

test();
