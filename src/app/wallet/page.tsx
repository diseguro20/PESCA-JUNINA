"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { JuninaBackground } from '../../components/JuninaBackground';
import { HeaderHUD } from '../../components/HeaderHUD';
import { 
  Wallet as WalletIcon, 
  Coins, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Lock, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Copy, 
  QrCode, 
  Check,
  AlertCircle
} from 'lucide-react';

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth();
  const { wallet, deposits, withdrawals, createDepositRequest, createWithdrawalRequest, refreshAllData } = useGame();
  const router = useRouter();

  // Estados dos Formulários
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientDocument, setRecipientDocument] = useState('');
  const [pixKeyType, setPixKeyType] = useState<'document' | 'email' | 'phone_number' | 'aleatory'>('document');
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pixResult, setPixResult] = useState<{ qrCodeText: string; qrCodeImage: string; id: string; amount: number } | null>(null);

  // Redirecionamento se deslogado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Forçar recarga ao entrar
  useEffect(() => {
    if (user) {
      refreshAllData();
    }
  }, [user]);

  if (authLoading || !user) return null;

  const displayBalance = wallet?.balance ?? 0;
  const lockedBalance = wallet?.lockedBalance ?? 0;

  // PIX Estático para Simulação
  const mockPixKey = "pix@pescaonlinejunina.com.br";
  const mockQrCodeText = "00020101021126580014br.gov.bcb.pix0136pix@pescaonlinejunina.com.br5204000053039865802BR5925Pesca Online Junina6009Sao Paulo62070503***6304CA12";

  const handleCopyKey = () => {
    navigator.clipboard.writeText(mockPixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDepositSuccess(false);
    setPixResult(null);

    const val = parseFloat(depositAmount);
    if (isNaN(val) || val < 5) {
      setError("O valor mínimo para depósito é de R$ 5,00.");
      return;
    }

    setSubmitting(true);
    try {
      // Solicita criação do depósito (que agora gera o PIX dinâmico)
      const response = await createDepositRequest(val, "https://example.com/comprovantes/recibo_" + Math.floor(Math.random() * 10000) + ".png");
      
      if (response && response.deposit) {
        setPixResult({
          id: response.deposit.id,
          amount: response.deposit.amount,
          qrCodeText: response.deposit.qrCodeText || '',
          qrCodeImage: response.deposit.qrCodeImage || ''
        });
      } else if (response && response.qrCodeText) {
        setPixResult({
          id: response.id,
          amount: val,
          qrCodeText: response.qrCodeText,
          qrCodeImage: response.qrCodeImage
        });
      }

      setDepositSuccess(true);
      setDepositAmount('');
      refreshAllData();
    } catch (err: any) {
      setError(err.message || "Falha ao registrar depósito.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWithdrawSuccess(false);

    const val = parseFloat(withdrawAmount);
    if (isNaN(val) || val <= 0) {
      setError("Por favor, insira um valor válido de saque.");
      return;
    }

    if (!pixKey || !recipientName || !recipientDocument) {
      setError("Por favor, preencha todos os campos do beneficiário.");
      return;
    }

    if (val > displayBalance) {
      setError("Saldo disponível insuficiente!");
      return;
    }

    setSubmitting(true);
    try {
      await createWithdrawalRequest(val, pixKey, pixKeyType, recipientName, recipientDocument);
      setWithdrawSuccess(true);
      setWithdrawAmount('');
      setPixKey('');
      setRecipientName('');
      setRecipientDocument('');
      setPixKeyType('document');
      refreshAllData();
    } catch (err: any) {
      setError(err.message || "Falha ao registrar saque.");
    } finally {
      setSubmitting(false);
    }
  };

  // Combinar e ordenar depósitos e saques para exibição unificada
  const transactions = [
    ...deposits.map(d => ({ ...d, type: 'deposit' as const })),
    ...withdrawals.map(w => ({ ...w, type: 'withdraw' as const }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <JuninaBackground>
      <HeaderHUD />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 md:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start relative z-20">
        
        {/* COLUNA 1: EXIBIÇÃO DE SALDOS E TABS */}
        <div className="lg:col-span-1 flex flex-col gap-6 w-full">
          
          {/* Card Principal de Saldos */}
          <div className="glass-premium p-6 rounded-3xl flex flex-col relative overflow-hidden">
            <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-radial-gradient from-junina-gold/10 to-transparent rounded-full pointer-events-none" />
            
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <WalletIcon className="w-4 h-4 text-junina-gold" /> Saldo da Carteira
            </span>

            {/* Saldo Disponível */}
            <div className="flex flex-col mb-4">
              <span className="text-xs text-gray-300">Saldo Disponível</span>
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-junina-gold via-junina-orange to-junina-red mt-1">
                R$ {displayBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="w-full h-px bg-white/5 my-2" />

            {/* Saldo Bloqueado */}
            <div className="flex justify-between items-center text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Saldo Bloqueado
              </span>
              <span className="font-extrabold text-gray-200">
                R$ {lockedBalance.toFixed(2)}
              </span>
            </div>

            {/* Rodapé explicativo */}
            {lockedBalance > 0 && (
              <span className="text-[10px] text-gray-500 italic mt-3 leading-relaxed">
                *O saldo bloqueado representa saques pendentes de aprovação administrativa.
              </span>
            )}
          </div>

          {/* Seletor Deposit / Withdraw */}
          <div className="flex bg-junina-blue-deep/60 rounded-2xl border border-white/10 p-1">
            <button
              onClick={() => { setActiveTab('deposit'); setError(null); }}
              className={`flex-1 py-3 text-center text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'deposit' 
                  ? 'bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" /> DEPOSITAR (PIX)
            </button>
            <button
              onClick={() => { setActiveTab('withdraw'); setError(null); }}
              className={`flex-1 py-3 text-center text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'withdraw' 
                  ? 'bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" /> SACAR (PIX)
            </button>
          </div>

        </div>

        {/* COLUNA 2: FORMULÁRIOS DE DEPÓSITO OU SAQUE (CENTRO) */}
        <div className="lg:col-span-1 flex flex-col gap-6 w-full">
          
          {/* Card Formulário Ativo */}
          <div className="glass-premium p-6 rounded-3xl flex flex-col">
            
            {/* 1. ABA DE DEPÓSITO */}
            {activeTab === 'deposit' && (
              <div className="flex flex-col">
                <h3 className="text-lg font-black text-white mb-1">REALIZAR DEPÓSITO</h3>
                <p className="text-xs text-gray-400 mb-6">Transfira saldo virtual instantaneamente via PIX</p>

                {error && (
                  <div className="bg-junina-red/10 border border-junina-red/30 p-3 rounded-2xl flex items-start gap-2.5 mb-5 text-left">
                    <AlertCircle className="w-5 h-5 text-junina-red shrink-0 mt-0.5" />
                    <span className="text-xs text-red-200 font-semibold">{error}</span>
                  </div>
                )}

                {pixResult ? (
                  // EXIBIÇÃO DE QR CODE DINÂMICO GERADO PELO GATEWAY
                  <div className="flex flex-col items-center text-center animate-fade-in gap-4 bg-junina-blue-deep/40 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Escaneie o QR Code Pix</span>
                    <span className="text-2xl font-black text-junina-gold">R$ {pixResult.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    
                    {pixResult.qrCodeImage && (
                      <div className="p-3.5 bg-white rounded-2xl w-48 h-48 flex items-center justify-center shadow-lg relative group">
                        <img 
                          src={pixResult.qrCodeImage} 
                          alt="Pix QR Code" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}

                    <div className="w-full flex flex-col gap-2 text-left mt-2">
                      <label className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Pix Copia e Cola</label>
                      <div className="flex items-center gap-2 bg-junina-blue-deep/60 px-3 py-2.5 rounded-xl border border-white/10">
                        <input 
                          type="text" 
                          readOnly 
                          value={pixResult.qrCodeText} 
                          className="text-[10px] font-mono text-gray-300 bg-transparent border-none focus:outline-none w-full truncate select-all"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(pixResult.qrCodeText);
                            alert("Código Pix Copiado!");
                          }}
                          className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-junina-gold transition-colors shrink-0"
                          title="Copiar Código"
                        >
                          <Copy className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setPixResult(null);
                        setDepositSuccess(false);
                      }}
                      className="w-full mt-2 py-3 bg-white/5 hover:bg-white/10 text-[10px] font-black rounded-xl border border-white/10 transition-all text-gray-300 uppercase tracking-widest"
                    >
                      GERAR NOVO DEPÓSITO
                    </button>
                  </div>
                ) : (
                  // FORMULÁRIO DE SELEÇÃO DE VALOR
                  <>
                    {depositSuccess && (
                      <div className="bg-junina-green/10 border border-junina-green/30 p-3.5 rounded-2xl flex items-start gap-2.5 mb-5 text-left">
                        <CheckCircle className="w-5 h-5 text-junina-green shrink-0 mt-0.5" />
                        <span className="text-xs text-green-200 font-semibold">
                          Solicitação registrada! Pague o Pix para liberar seu saldo na quermesse.
                        </span>
                      </div>
                    )}

                    {/* Chave Copia e Cola Padrão de Fallback */}
                    <div className="bg-junina-blue-deep/60 p-4 rounded-2xl border border-white/5 mb-5 flex flex-col gap-2">
                      <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Chave PIX Rápida (E-mail)</span>
                      <div className="flex items-center gap-2 justify-between">
                        <span className="text-xs font-mono font-bold text-junina-gold truncate">{mockPixKey}</span>
                        <button 
                          type="button"
                          onClick={handleCopyKey}
                          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all shrink-0"
                          title="Copiar Chave PIX"
                        >
                          {copied ? <Check className="w-4 h-4 text-junina-green" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleDepositSubmit} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5 text-left">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Valor do Depósito (R$)</label>
                        <div className="relative">
                          <input
                            type="number"
                            placeholder="Ex: 5,00 (Mínimo)"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            className="w-full py-3 pl-10 pr-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                            min="5"
                            step="0.01"
                            required
                          />
                          <Coins className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark font-black rounded-xl hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm mt-2"
                      >
                        {submitting ? 'GERANDO PIX...' : 'GERAR QR CODE PIX'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}

            {/* 2. ABA DE SAQUE */}
            {activeTab === 'withdraw' && (
              <div className="flex flex-col">
                <h3 className="text-lg font-black text-white mb-1">SOLICITAR SAQUE</h3>
                <p className="text-xs text-gray-400 mb-6">Retire seu saldo virtual disponível via PIX</p>

                {error && (
                  <div className="bg-junina-red/10 border border-junina-red/30 p-3 rounded-2xl flex items-start gap-2.5 mb-5 text-left">
                    <AlertCircle className="w-5 h-5 text-junina-red shrink-0 mt-0.5" />
                    <span className="text-xs text-red-200 font-semibold">{error}</span>
                  </div>
                )}

                {withdrawSuccess && (
                  <div className="bg-junina-green/10 border border-junina-green/30 p-3.5 rounded-2xl flex items-start gap-2.5 mb-5 text-left">
                    <CheckCircle className="w-5 h-5 text-junina-green shrink-0 mt-0.5" />
                    <span className="text-xs text-green-200 font-semibold">
                      Solicitação enviada para análise! O saldo solicitado foi bloqueado provisoriamente até a aprovação.
                    </span>
                  </div>
                )}

                <form onSubmit={handleWithdrawSubmit} className="flex flex-col gap-4">
                  {/* Valor */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Valor do Saque (R$)</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Ex: 25,00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full py-3 pl-10 pr-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                        min="1"
                        step="0.01"
                        required
                      />
                      <Coins className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Nome do Beneficiário */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Nome do Beneficiário</label>
                    <input
                      type="text"
                      placeholder="Nome completo do titular da conta"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full py-3 px-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                      required
                    />
                  </div>

                  {/* CPF/CNPJ do Beneficiário */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">CPF/CNPJ do Beneficiário</label>
                    <input
                      type="text"
                      placeholder="Apenas números"
                      value={recipientDocument}
                      onChange={(e) => setRecipientDocument(e.target.value)}
                      className="w-full py-3 px-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                      required
                    />
                  </div>

                  {/* Tipo de Chave PIX */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo de Chave PIX</label>
                    <select
                      value={pixKeyType}
                      onChange={(e) => setPixKeyType(e.target.value as any)}
                      className="w-full py-3 px-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                      required
                    >
                      <option value="document" className="bg-junina-blue-deep text-white">CPF / CNPJ</option>
                      <option value="email" className="bg-junina-blue-deep text-white">E-mail</option>
                      <option value="phone_number" className="bg-junina-blue-deep text-white">Celular</option>
                      <option value="aleatory" className="bg-junina-blue-deep text-white">Chave Aleatória (EVP)</option>
                    </select>
                  </div>

                  {/* Chave PIX */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Chave PIX</label>
                    <input
                      type="text"
                      placeholder="Digite a chave PIX correspondente"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      className="w-full py-3 px-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark font-black rounded-xl hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm mt-2"
                  >
                    {submitting ? 'ENVIANDO...' : 'SOLICITAR SAQUE'}
                  </button>
                </form>
              </div>
            )}

          </div>

        </div>

        {/* COLUNA 3: HISTÓRICO DE TRANSAÇÕES (DIREITA) */}
        <div className="lg:col-span-1 w-full flex flex-col gap-6">
          
          {/* Card Tabela Histórico */}
          <div className="glass-premium p-6 rounded-3xl flex flex-col max-h-[480px]">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-junina-gold" /> Histórico Financeiro
            </span>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 no-scrollbar">
              {transactions.length === 0 ? (
                <span className="text-xs text-gray-500 italic py-8 text-center">Nenhuma transação financeira registrada.</span>
              ) : (
                transactions.map((tx, idx) => {
                  const isDeposit = tx.type === 'deposit';
                  const isPending = tx.status === 'pending';
                  const isApproved = tx.status === 'approved';

                  return (
                    <div 
                      key={idx} 
                      className="bg-junina-blue-deep/55 border border-white/5 p-3 rounded-2xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        {isDeposit ? (
                          <div className="p-2 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20">
                            <ArrowUpCircle className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                            <ArrowDownCircle className="w-4 h-4" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-extrabold text-white">{isDeposit ? 'Depósito' : 'Saque'}</span>
                          <span className="text-[9px] text-gray-500">{new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span className="font-black text-white">
                          R$ {tx.amount.toFixed(2)}
                        </span>
                        
                        {/* Badges de Status */}
                        {isPending && (
                          <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 text-[8px] font-black uppercase tracking-wider">
                            Pendente
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/25 text-[8px] font-black uppercase tracking-wider">
                            Aprovado
                          </span>
                        )}
                        {tx.status === 'rejected' && (
                          <span className="px-2 py-0.5 rounded-full bg-junina-red/10 text-junina-red border border-junina-red/25 text-[8px] font-black uppercase tracking-wider">
                            Recusado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </JuninaBackground>
  );
}
