import React, { useState, useEffect } from 'react';
import { X, Coins, Copy, Check, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useGame } from '../context/GameContext';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  betAmount: number;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  betAmount
}) => {
  const { createDepositRequest, wallet } = useGame();
  const [depositAmount, setDepositAmount] = useState('5'); // Suggested default deposit
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pixResult, setPixResult] = useState<{ qrCodeText: string; qrCodeImage: string; id: string; amount: number } | null>(null);
  const [previousBalance, setPreviousBalance] = useState(wallet?.balance ?? 0);
  const [paidSuccess, setPaidSuccess] = useState(false);

  // Monitor if user balance increases (deposit paid)
  useEffect(() => {
    if (wallet && wallet.balance > previousBalance) {
      setPaidSuccess(true);
      setPixResult(null);
    }
    if (wallet) {
      setPreviousBalance(wallet.balance);
    }
  }, [wallet?.balance]);

  // Aquecer o servidor proxy de pagamento no Render para evitar latência inicial (cold start)
  useEffect(() => {
    if (isOpen) {
      fetch('https://pesca-junina-proxy.onrender.com/health').catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPixResult(null);

    const val = parseFloat(depositAmount);
    if (isNaN(val) || val < 5) {
      setError("O valor mínimo para depósito é de R$ 5,00.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await createDepositRequest(val);
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
    } catch (err: any) {
      setError(err.message || "Falha ao registrar depósito.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyKey = () => {
    if (pixResult) {
      navigator.clipboard.writeText(pixResult.qrCodeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setPixResult(null);
    setError(null);
    setPaidSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-junina-blue-deep/80 backdrop-blur-md animate-fade-in text-white">
      <div className="relative w-full max-w-md rounded-3xl border border-junina-gold/30 bg-gradient-to-b from-junina-blue-deep via-junina-blue-deep/95 to-black p-6 shadow-2xl transition-all overflow-hidden flex flex-col">
        
        {/* Background Glow */}
        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[50%] bg-radial-gradient from-junina-gold/5 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={handleClose}
          type="button"
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/15 rounded-full transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {paidSuccess ? (
          // SUCCESS: Deposit Received!
          <div className="flex flex-col items-center text-center py-6 animate-fade-in gap-4">
            <div className="w-16 h-16 rounded-full bg-junina-green/10 flex items-center justify-center border border-junina-green animate-bounce">
              <CheckCircle className="w-8 h-8 text-junina-green" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-wider">DEPÓSITO CONFIRMADO!</h2>
            <p className="text-sm text-gray-300 px-4 leading-relaxed">
              Uai! Seu saldo já caiu na carteira caipira. Agora você tem <strong className="text-junina-green">R$ {wallet?.balance.toFixed(2)}</strong> disponível.
            </p>
            <button
              onClick={handleClose}
              type="button"
              className="w-full mt-6 py-3.5 bg-gradient-to-r from-junina-orange to-junina-gold text-junina-wood-dark font-black rounded-2xl shadow-lg hover:brightness-105 active:scale-[0.98] transition-all text-sm uppercase tracking-widest"
            >
              IR PESCAR AGORA!
            </button>
          </div>
        ) : pixResult ? (
          // QR CODE PIX DISPLAY
          <div className="flex flex-col items-center text-center animate-fade-in gap-4">
            <span className="text-[10px] text-junina-gold font-extrabold uppercase tracking-widest">Escaneie o QR Code Pix</span>
            <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-junina-gold to-junina-orange">
              R$ {pixResult.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>

            {pixResult.qrCodeImage && (
              <div className="p-3 bg-white rounded-2xl w-44 h-44 flex items-center justify-center shadow-lg relative">
                <img 
                  src={pixResult.qrCodeImage} 
                  alt="Pix QR Code" 
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="w-full flex flex-col gap-1.5 text-left mt-2">
              <label className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Pix Copia e Cola</label>
              <div className="flex items-center gap-2 bg-junina-blue-deep/60 px-3 py-2.5 rounded-xl border border-white/10">
                <input 
                  type="text" 
                  readOnly 
                  value={pixResult.qrCodeText} 
                  className="text-[10px] font-mono text-gray-300 bg-transparent border-none focus:outline-none w-full truncate select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-junina-gold transition-colors shrink-0"
                  title="Copiar Código"
                >
                  {copied ? <Check className="w-4 h-4 text-junina-green" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
              <Clock className="w-4 h-4 text-junina-gold animate-spin-slow" />
              <span>Aguardando confirmação do pagamento...</span>
            </div>

            <div className="w-full grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={() => setPixResult(null)}
                className="py-3 bg-white/5 hover:bg-white/10 text-[10px] font-black rounded-xl border border-white/10 transition-all text-gray-300 uppercase tracking-widest"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="py-3 bg-junina-red/10 hover:bg-junina-red/15 text-[10px] font-black rounded-xl border border-junina-red/30 transition-all text-junina-red uppercase tracking-widest"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          // DEPOSIT FORM
          <form onSubmit={handleDepositSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 mb-1">
              <Coins className="w-6 h-6 text-junina-gold" />
              <div className="text-left">
                <h3 className="text-lg font-black text-white leading-none">SALDO INSUFICIENTE</h3>
                <p className="text-[10px] text-gray-400 mt-1">Sua aposta é de R$ {betAmount.toFixed(2)}</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-junina-gold/5 border border-junina-gold/10 p-3 rounded-xl text-left">
              Uai sô! Para garantir seu prêmio e começar a pescar no lago caipira, você precisa adicionar créditos de jogo.
            </p>

            {error && (
              <div className="bg-junina-red/10 border border-junina-red/30 p-3 rounded-2xl flex items-start gap-2.5 text-left">
                <AlertCircle className="w-5 h-5 text-junina-red shrink-0 mt-0.5" />
                <span className="text-xs text-red-200 font-semibold">{error}</span>
              </div>
            )}

            {/* Deposit Amount */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Valor do Depósito (Mínimo R$ 5,00)</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="Ex: 20"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full py-3.5 pl-10 pr-4 bg-junina-blue-deep/60 rounded-xl border border-white/10 text-white text-sm focus:border-junina-gold/50 focus:outline-none transition-colors"
                  min="5"
                  step="1"
                  required
                />
                <Coins className="w-4 h-4 text-gray-500 absolute left-3.5 top-4" />
              </div>
            </div>

            {/* Value Suggestions */}
            <div className="grid grid-cols-4 gap-2">
              {['5', '15', '30', '50'].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDepositAmount(val)}
                  className={`py-2 bg-white/5 hover:bg-junina-gold/20 hover:border-junina-gold/30 text-xs font-bold rounded-xl transition-all border ${
                    depositAmount === val ? 'border-junina-gold bg-junina-gold/10 text-junina-gold' : 'border-white/5 text-gray-300'
                  }`}
                >
                  R$ {val}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-junina-orange via-junina-gold to-junina-orange text-junina-wood-dark font-black rounded-2xl hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm mt-2 shadow-lg uppercase tracking-wider"
            >
              {submitting ? 'GERANDO PIX...' : 'GERAR COBRANÇA PIX'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
