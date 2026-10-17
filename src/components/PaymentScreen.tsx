import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Coins,
  Building2,
  CreditCard,
  Clock,
  Wallet as WalletIcon,
  AlertCircle,
  CheckCircle2,
  Server,
  ChevronRight,
  Receipt,
  Delete,
  Copy,
  ChevronDown,
  ChevronUp,
  Share2,
} from 'lucide-react';
import { type Wallet, type Discount } from '../db/db';
import { executeCartTransaction, type CartItem } from '../db/transactionService';
import { formatRupiah } from '../utils/formatters';
import { useBackHandler } from '../context/NavigationContext';

export interface PaymentScreenProps {
  cart: CartItem[];
  totalSelling: number;
  discountAmount: number;
  selectedDiscount: Discount | null;
  finalTotal: number;
  wallets: Wallet[];
  onBack: () => void;
  onSuccess: (summary: string) => void;
  onClearCart: () => void;
  onBackToCashier: () => void;
}

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS' | 'HUTANG';
export type PaymentStep = 'CHOOSE_METHOD' | 'PAY_CASH' | 'PAY_TRANSFER' | 'PAY_KASBON';

// Helper deteksi brand bank / e-wallet gaya fintech Indonesia
function getWalletBrand(wallet: Wallet) {
  const name = wallet.name.toUpperCase();
  if (name.includes('BCA')) {
    return { name: 'Bank BCA', badge: 'BCA', bg: 'bg-[#003893]', text: 'text-white', border: 'border-[#003893]' };
  }
  if (name.includes('BRI')) {
    return { name: 'Bank BRI', badge: 'BRI', bg: 'bg-[#00529C]', text: 'text-white', border: 'border-[#00529C]' };
  }
  if (name.includes('MANDIRI')) {
    return { name: 'Bank Mandiri', badge: 'MANDIRI', bg: 'bg-[#003366]', text: 'text-[#F5A623]', border: 'border-[#003366]' };
  }
  if (name.includes('BNI')) {
    return { name: 'Bank BNI', badge: 'BNI', bg: 'bg-[#005E6A]', text: 'text-[#F15A24]', border: 'border-[#005E6A]' };
  }
  if (name.includes('JAGO')) {
    return { name: 'Bank Jago', badge: 'JAGO', bg: 'bg-[#FF5C00]', text: 'text-white', border: 'border-[#FF5C00]' };
  }
  if (name.includes('QRIS')) {
    return { name: 'QRIS Digital', badge: 'QRIS', bg: 'bg-[#EA1D2C]', text: 'text-white', border: 'border-[#EA1D2C]' };
  }
  if (name.includes('DANA')) {
    return { name: 'DANA E-Wallet', badge: 'DANA', bg: 'bg-[#118EEA]', text: 'text-white', border: 'border-[#118EEA]' };
  }
  if (name.includes('GOPAY')) {
    return { name: 'GoPay', badge: 'GOPAY', bg: 'bg-[#00AED6]', text: 'text-white', border: 'border-[#00AED6]' };
  }
  if (name.includes('OVO')) {
    return { name: 'OVO', badge: 'OVO', bg: 'bg-[#4C3494]', text: 'text-white', border: 'border-[#4C3494]' };
  }
  if (wallet.category === 'BANK') {
    return { name: 'Transfer Bank', badge: 'BANK', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-600' };
  }
  if (wallet.category === 'EWALLET') {
    return { name: 'E-Wallet / QRIS', badge: 'QRIS', bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-600' };
  }
  return { name: 'Kasir Tunai', badge: 'KAS', bg: 'bg-slate-800', text: 'text-white', border: 'border-slate-800' };
}

// Helper evaluasi kalkulator matematika aman
function evaluateCalculator(expr: string): number {
  try {
    const sanitized = expr.replace(/[^0-9+\-]/g, '');
    if (!sanitized) return 0;
    const tokens = sanitized.match(/(\d+|[+\-])/g);
    if (!tokens) return 0;
    let total = 0;
    let currentOp = '+';
    for (const token of tokens) {
      if (token === '+' || token === '-') {
        currentOp = token;
      } else {
        const val = parseInt(token, 10);
        if (!isNaN(val)) {
          if (currentOp === '+') total += val;
          else if (currentOp === '-') total -= val;
        }
      }
    }
    return Math.max(0, total);
  } catch {
    return 0;
  }
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  cart,
  totalSelling,
  discountAmount,
  selectedDiscount,
  finalTotal,
  wallets,
  onBack,
  onSuccess,
  onClearCart,
  onBackToCashier,
}) => {
  // Step Layar Pembayaran (Terpisah Bersih: Pilih Metode | Tunai | Transfer | Kasbon)
  const [step, setStep] = useState<PaymentStep>('CHOOSE_METHOD');
  const [transferFilter, setTransferFilter] = useState<'ALL' | 'BANK' | 'EWALLET'>('ALL');
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Navigasi Bertingkat:
  useBackHandler(
    'payment-step-detail',
    () => {
      setStep('CHOOSE_METHOD');
      setErrorMessage(null);
    },
    step !== 'CHOOSE_METHOD',
    40
  );

  useBackHandler('checkout-payment-screen', onBack, step === 'CHOOSE_METHOD', 35);

  // 1. Metode Pembayaran & Dompet Penerima
  const [method, setMethod] = useState<PaymentMethod>('CASH');

  const defaultCashWallet = wallets.find((w) => w.category === 'CASH') || wallets[0];
  const defaultBankWallet = wallets.find((w) => w.category === 'BANK') || wallets[0];
  const defaultQrisWallet = wallets.find((w) => w.category === 'EWALLET') || wallets[0];

  const [selectedInWalletId, setSelectedInWalletId] = useState<string>(
    defaultCashWallet?.id || 'cash_main'
  );

  // Navigasi ke sub-layar
  const handleGoToCash = () => {
    setMethod('CASH');
    if (defaultCashWallet) {
      setSelectedInWalletId(defaultCashWallet.id);
    }
    setStep('PAY_CASH');
    setErrorMessage(null);
  };

  const handleGoToTransfer = () => {
    if (defaultBankWallet) {
      setSelectedInWalletId(defaultBankWallet.id);
      setMethod('TRANSFER');
    } else if (defaultQrisWallet) {
      setSelectedInWalletId(defaultQrisWallet.id);
      setMethod('QRIS');
    } else {
      setMethod('TRANSFER');
    }
    setStep('PAY_TRANSFER');
    setErrorMessage(null);
  };

  const handleGoToKasbon = () => {
    setMethod('HUTANG');
    if (defaultCashWallet) {
      setSelectedInWalletId(defaultCashWallet.id);
    }
    setStep('PAY_KASBON');
    setErrorMessage(null);
  };

  // 2. Kalkulator Fintech Numpad (Khusus Layar Tunai)
  const [calcExpression, setCalcExpression] = useState<string>(String(finalTotal));
  const [cashReceived, setCashReceived] = useState<number>(finalTotal);

  useEffect(() => {
    setCalcExpression(String(finalTotal));
    setCashReceived(finalTotal);
  }, [finalTotal]);

  const handleKeypadPress = (key: string) => {
    if (key === 'CLEAR') {
      setCalcExpression('0');
      setCashReceived(0);
      return;
    }

    if (key === 'UANG_PAS') {
      setCalcExpression(String(finalTotal));
      setCashReceived(finalTotal);
      return;
    }

    if (key === 'EQUAL') {
      const evalVal = evaluateCalculator(calcExpression);
      setCalcExpression(String(evalVal));
      setCashReceived(evalVal);
      return;
    }

    if (key === 'BACKSPACE') {
      setCalcExpression((prev) => {
        const trimmed = prev.trim();
        if (trimmed.length <= 1) {
          setCashReceived(0);
          return '0';
        }
        let nextStr = trimmed;
        if (nextStr.endsWith('+') || nextStr.endsWith('-')) {
          nextStr = nextStr.slice(0, -1).trim();
        } else {
          nextStr = nextStr.slice(0, -1).trim();
        }
        const evalVal = evaluateCalculator(nextStr);
        setCashReceived(evalVal);
        return nextStr || '0';
      });
      return;
    }

    if (key === '+' || key === '-') {
      setCalcExpression((prev) => {
        const trimmed = prev.trim();
        if (trimmed.endsWith('+') || trimmed.endsWith('-')) {
          return `${trimmed.slice(0, -1)} ${key} `;
        }
        return `${trimmed} ${key} `;
      });
      return;
    }

    if (key === '000') {
      setCalcExpression((prev) => {
        if (prev === '0' || prev === '') return '0';
        const parts = prev.split(' ');
        const lastPart = parts[parts.length - 1];
        if (lastPart === '+' || lastPart === '-' || lastPart === '0') return prev;
        parts[parts.length - 1] = `${lastPart}000`;
        const nextExpr = parts.join(' ');
        const evalVal = evaluateCalculator(nextExpr);
        setCashReceived(evalVal);
        return nextExpr;
      });
      return;
    }

    // Tambah pecahan cepat: +10rb, +20rb, +50rb, +100rb
    if (key.startsWith('ADD_')) {
      const addAmount = parseInt(key.replace('ADD_', ''), 10) || 0;
      setCalcExpression((prev) => {
        const currentVal = evaluateCalculator(prev);
        const nextVal = currentVal + addAmount;
        setCashReceived(nextVal);
        return String(nextVal);
      });
      return;
    }

    // Digit angka 0 - 9
    setCalcExpression((prev) => {
      let nextExpr = '';
      if (prev === '0') {
        nextExpr = key;
      } else {
        nextExpr = `${prev}${key}`;
      }
      const evalVal = evaluateCalculator(nextExpr);
      setCashReceived(evalVal);
      return nextExpr;
    });
  };

  // 3. Info Pembeli & Kasbon
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tempoDays, setTempoDays] = useState<number>(7);
  const [notes, setNotes] = useState('');

  // 4. Submission & Modal Struk Sukses
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedSuccessData, setCompletedSuccessData] = useState<{
    inWalletName: string;
    totalPaid: number;
    cashReceived?: number;
    changeAmount?: number;
    method: PaymentMethod;
    trxId: string;
    dateStr: string;
    deductedModal: { walletName: string; cost: number; remaining: number }[];
  } | null>(null);

  useBackHandler(
    'payment-success-modal',
    () => {
      onClearCart();
      onBackToCashier();
    },
    !!completedSuccessData,
    50
  );

  const activeInWallet = wallets.find((w) => w.id === selectedInWalletId);
  const changeAmount = Math.max(0, cashReceived - finalTotal);
  const isCashInsufficient = method === 'CASH' && cashReceived < finalTotal;

  // Analisis Saldo Modal Server
  const modalAnalysis = useMemo(() => {
    const totalCostAll = cart.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
    const estimatedProfit = finalTotal - totalCostAll;

    const breakdownMap: Record<
      string,
      {
        wallet: Wallet | undefined;
        cost: number;
        items: { name: string; qty: number; cost: number }[];
      }
    > = {};

    cart.forEach((item) => {
      const wId = item.outWalletId || 'cash_main';
      if (!breakdownMap[wId]) {
        breakdownMap[wId] = {
          wallet: wallets.find((w) => w.id === wId),
          cost: 0,
          items: [],
        };
      }
      const itemTotalCost = item.costPrice * item.quantity;
      breakdownMap[wId].cost += itemTotalCost;
      breakdownMap[wId].items.push({
        name: item.productName,
        qty: item.quantity,
        cost: itemTotalCost,
      });
    });

    const breakdown = Object.entries(breakdownMap).map(([walletId, data]) => {
      const currentBalance = data.wallet ? data.wallet.currentBalance : 0;
      const remainingBalance = currentBalance - data.cost;
      const isBalanceLow = currentBalance < data.cost;
      return {
        walletId,
        walletName: data.wallet?.name || `Dompet (${walletId})`,
        category: data.wallet?.category || 'SERVER',
        currentBalance,
        cost: data.cost,
        remainingBalance,
        isBalanceLow,
        items: data.items,
      };
    });

    return {
      totalCostAll,
      estimatedProfit,
      breakdown,
    };
  }, [cart, finalTotal, wallets]);

  // Eksekusi Konfirmasi Pembayaran
  const handleConfirmPayment = async () => {
    if (cart.length === 0) return;

    if (method === 'CASH' && cashReceived < finalTotal) {
      setErrorMessage(
        `Nominal uang diterima (${formatRupiah(cashReceived)}) masih kurang dari total tagihan (${formatRupiah(finalTotal)}).`
      );
      return;
    }

    if (method === 'HUTANG' && !customerName.trim()) {
      setErrorMessage(
        'Untuk transaksi kasbon / hutang, Nama Pembeli wajib diisi.'
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const inWalletId = selectedInWalletId || 'cash_main';
      const targetCustomer = [customerName.trim(), customerPhone.trim()]
        .filter(Boolean)
        .join(' - ');

      const tempoNote = method === 'HUTANG' ? `[Jatuh Tempo: ${tempoDays} hari]` : '';
      const fullNotes = [notes.trim(), tempoNote].filter(Boolean).join(' ');

      await executeCartTransaction({
        items: cart,
        inWalletId,
        paymentStatus: method === 'HUTANG' ? 'UNPAID' : 'PAID',
        paymentMethod: method,
        customerTarget: targetCustomer || undefined,
        cashReceived: method === 'CASH' ? cashReceived : finalTotal,
        discountId: selectedDiscount?.id,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        discountName: selectedDiscount?.name,
        finalTotal,
        notes: fullNotes || undefined,
      });

      const deductedModalData = modalAnalysis.breakdown.map((b) => ({
        walletName: b.walletName,
        cost: b.cost,
        remaining: b.remainingBalance,
      }));

      const randomTrx = `TRX-${Date.now().toString().slice(-6)}`;
      const now = new Date();
      const dateStr = now.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      setCompletedSuccessData({
        inWalletName: activeInWallet?.name || 'Kasir Toko',
        totalPaid: finalTotal,
        cashReceived: method === 'CASH' ? cashReceived : undefined,
        changeAmount: method === 'CASH' ? changeAmount : undefined,
        method,
        trxId: randomTrx,
        dateStr,
        deductedModal: deductedModalData,
      });
    } catch (err: unknown) {
      console.error('Payment processing error:', err);
      const msg = err instanceof Error ? err.message : 'Gagal memproses pembayaran transaksi.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopyFeedback(`${label} berhasil disalin`);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // ==========================================
  // STRUK DIGITAL FINTECH SUKSES
  // ==========================================
  if (completedSuccessData) {
    return (
      <div className="-mx-4 pb-28 min-h-screen bg-slate-50 flex flex-col justify-between animate-in fade-in duration-150">
        <div className="space-y-3">
          {/* Header Kartu Struk Fintech */}
          <div className="bg-white border-b border-slate-200/80 px-4 pt-9 pb-7 text-center space-y-3.5">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200/80 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9 stroke-[2.4]" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                {completedSuccessData.method === 'HUTANG' ? 'Piutang Berhasil Dicatat' : 'Transaksi Berhasil'}
              </span>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                {formatRupiah(completedSuccessData.totalPaid)}
              </h2>
              <p className="text-xs text-slate-400">
                {completedSuccessData.dateStr} • {completedSuccessData.trxId}
              </p>
            </div>
          </div>

          {/* Toast Salin Info */}
          {copyFeedback && (
            <div className="mx-4 p-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl text-center shadow-lg">
              {copyFeedback}
            </div>
          )}

          {/* Rincian Finansial Transaksi */}
          <div className="bg-white border-y border-slate-200/80 px-4 py-4 space-y-3 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px] block">
              Rincian Pembayaran
            </span>

            <div className="space-y-2.5 text-slate-600 font-medium">
              <div className="flex items-center justify-between">
                <span>Metode Pembayaran</span>
                <span className="font-bold text-slate-900">
                  {completedSuccessData.method === 'CASH'
                    ? 'Uang Tunai (Cash)'
                    : completedSuccessData.method === 'TRANSFER'
                    ? 'Transfer Bank'
                    : completedSuccessData.method === 'QRIS'
                    ? 'QRIS & E-Wallet'
                    : 'Kasbon / PayLater'}
                </span>
              </div>

              {completedSuccessData.method === 'CASH' && (
                <>
                  <div className="flex items-center justify-between">
                    <span>Uang Diterima</span>
                    <span className="font-bold text-slate-900">
                      {formatRupiah(completedSuccessData.cashReceived || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 font-bold text-emerald-600">
                    <span>Kembalian</span>
                    <span className="text-sm font-black">
                      {formatRupiah(completedSuccessData.changeAmount || 0)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span>Tujuan Laci / Rekening</span>
                <span className="font-bold text-slate-900">
                  {completedSuccessData.inWalletName}
                </span>
              </div>
            </div>
          </div>

          {/* Rincian Pemotongan Modal Server */}
          <div className="bg-white border-y border-slate-200/80 px-4 py-4 space-y-2.5 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px] block">
              Pemotongan Saldo Modal Server
            </span>

            <div className="divide-y divide-slate-100">
              {completedSuccessData.deductedModal.map((dm, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">{dm.walletName}</span>
                    <span className="text-slate-400 text-[11px]">Sisa: {formatRupiah(dm.remaining)}</span>
                  </div>
                  <span className="font-bold text-rose-600">-{formatRupiah(dm.cost)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating Action Tombol Selesai */}
        <div className="p-4 bg-white border-t border-slate-200">
          <button
            type="button"
            onClick={() => {
              onSuccess(`Transaksi ${formatRupiah(finalTotal)} berhasil diselesaikan.`);
              onClearCart();
              onBackToCashier();
            }}
            className="w-full h-13 bg-slate-900 hover:bg-black active:scale-[0.99] text-white font-extrabold rounded-2xl shadow-md text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>Selesai & Transaksi Baru</span>
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // ALUR PEMBAYARAN FINTECH (CLEAN & TERPISAH)
  // ==========================================
  return (
    <div className="-mx-4 pb-32 bg-slate-50 min-h-screen">
      {/* ========================================================= */}
      {/* 1. LAYAR UTAMA: PILIH METODE (FINTECH CHECKOUT MENU)      */}
      {/* ========================================================= */}
      {step === 'CHOOSE_METHOD' && (
        <div className="space-y-3">
          {/* Header Fintech */}
          <div className="sticky top-0 z-30 px-4 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 -ml-1 text-slate-700 hover:text-black active:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Kembali ke Keranjang"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                Metode Pembayaran
              </h1>
            </div>

            <span className="text-xs text-slate-500 font-medium shrink-0">
              {cart.length} item • {cart.reduce((a, b) => a + b.quantity, 0)} unit
            </span>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mx-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-rose-700">
              <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Hero Banner Tagihan ala Fintech */}
          <div className="bg-white border-y border-slate-200/90 px-4 py-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Tagihan
                </span>
                <div className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                  {formatRupiah(finalTotal)}
                </div>
              </div>

              {discountAmount > 0 && (
                <div className="text-right">
                  <span className="text-xs text-slate-400 line-through block">
                    {formatRupiah(totalSelling)}
                  </span>
                  <span className="text-xs font-bold text-rose-600">
                    Hemat {formatRupiah(discountAmount)}
                  </span>
                </div>
              )}
            </div>

            {/* Accordion Rincian Ringkas Tagihan */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDetailExpanded(!isDetailExpanded)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer py-0.5"
              >
                <span>Lihat Rincian Biaya</span>
                {isDetailExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {isDetailExpanded && (
                <div className="pt-2.5 space-y-1.5 text-xs text-slate-600 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between">
                    <span>Subtotal Barang ({cart.length} item)</span>
                    <span className="font-semibold text-slate-900">{formatRupiah(totalSelling)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex items-center justify-between text-rose-600 font-semibold">
                      <span>Potongan Diskon ({selectedDiscount?.name || 'Promo'})</span>
                      <span>-{formatRupiah(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-100">
                    <span>Total Saldo Modal Terpotong</span>
                    <span>{formatRupiah(modalAnalysis.totalCostAll)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-emerald-600 font-semibold">
                    <span>Estimasi Laba Bersih</span>
                    <span>+{formatRupiah(modalAnalysis.estimatedProfit)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Daftar Kategori Metode Pembayaran Fintech */}
          <div className="bg-white border-y border-slate-200/90">
            <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Pilih Pembayaran
            </div>

            <div className="divide-y divide-slate-100">
              {/* Opsi 1: Uang Tunai / Cash (Dilengkapi Numpad Kalkulator) */}
              <div
                onClick={handleGoToCash}
                className="px-4 py-4.5 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Coins className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">Tunai (Cash)</h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        Kalkulator POS
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      Hitung uang diterima konsumen & kembalian otomatis
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-800 transition shrink-0" />
              </div>

              {/* Opsi 2: Transfer Bank & E-Wallet / QRIS */}
              <div
                onClick={handleGoToTransfer}
                className="px-4 py-4.5 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">Transfer Bank & E-Wallet</h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        BCA, Mandiri, QRIS
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      Pilih rekening penerima atau QRIS digital kasir
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-800 transition shrink-0" />
              </div>

              {/* Opsi 3: Kasbon / PayLater (Tempo) */}
              <div
                onClick={handleGoToKasbon}
                className="px-4 py-4.5 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">Kasbon (PayLater Toko)</h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Tempo
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      Catat piutang dengan nama pembeli & tanggal jatuh tempo
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-800 transition shrink-0" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. LAYAR TUNAI: KALKULATOR FINTECH NUMPAD                 */}
      {/* ========================================================= */}
      {step === 'PAY_CASH' && (
        <div className="space-y-3">
          {/* Header Tunai */}
          <div className="sticky top-0 z-30 px-4 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStep('CHOOSE_METHOD')}
                className="p-1.5 -ml-1 text-slate-700 hover:text-black active:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Ganti Metode"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                  Pembayaran Tunai
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Tagihan: <strong className="text-slate-900 font-bold">{formatRupiah(finalTotal)}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleKeypadPress('UANG_PAS')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl active:scale-95 transition cursor-pointer shadow-2xs"
            >
              Uang Pas
            </button>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mx-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-rose-700">
              <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Display Card Fintech: Uang Diterima & Kembalian Real-time */}
          <div className="bg-white border-y border-slate-200/90 px-4 py-4 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Uang Diterima Konsumen
              </span>
              {cashReceived > 0 && (
                <button
                  type="button"
                  onClick={() => handleKeypadPress('CLEAR')}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 active:scale-95 cursor-pointer"
                >
                  Reset (C)
                </button>
              )}
            </div>

            {/* Ekspresi hitungan aktif */}
            {(calcExpression.includes('+') || calcExpression.includes('-')) && (
              <div className="text-xs font-bold text-slate-400 font-mono tracking-wide">
                Hitungan: {calcExpression}
              </div>
            )}

            {/* Nominal Besar Fintech */}
            <div className="text-3xl font-black text-slate-900 tracking-tight flex items-baseline gap-1 select-none">
              <span className="text-xl text-slate-400 font-bold">Rp</span>
              <span>{cashReceived > 0 ? formatRupiah(cashReceived).replace('Rp', '').trim() : '0'}</span>
            </div>

            {/* Status Kembalian Banner */}
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">
                {isCashInsufficient ? 'Kekurangan Uang:' : 'Kembalian Kasir:'}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={
                    isCashInsufficient ? 'text-rose-600 text-sm font-black' : 'text-emerald-600 text-base font-black'
                  }
                >
                  {isCashInsufficient
                    ? formatRupiah(finalTotal - cashReceived)
                    : formatRupiah(changeAmount)}
                </span>
                {!isCashInsufficient && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black border border-emerald-200">
                    LUNAS
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Baris Tombol Pecahan Cepat Fintech */}
          <div className="bg-white border-y border-slate-200/90 px-4 py-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => handleKeypadPress('UANG_PAS')}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 shrink-0 active:scale-95 transition cursor-pointer"
              >
                Pas ({formatRupiah(finalTotal)})
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('ADD_10000')}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 shrink-0 active:scale-95 transition cursor-pointer"
              >
                +10rb
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('ADD_20000')}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 shrink-0 active:scale-95 transition cursor-pointer"
              >
                +20rb
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('ADD_50000')}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 shrink-0 active:scale-95 transition cursor-pointer"
              >
                +50rb
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('ADD_100000')}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 shrink-0 active:scale-95 transition cursor-pointer"
              >
                +100rb
              </button>
            </div>
          </div>

          {/* FINTECH CALCULATOR NUMPAD (4 Kolom Ergonomis & Tactile) */}
          <div className="bg-white border-y border-slate-200/90 px-4 py-4 select-none">
            <div className="grid grid-cols-4 gap-2">
              {/* Row 1: 1, 2, 3, + */}
              {['1', '2', '3'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-14 bg-white active:bg-slate-100 border border-slate-200/90 rounded-2xl font-bold text-2xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-2xs"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleKeypadPress('+')}
                className="h-14 bg-blue-50 active:bg-blue-100 border border-blue-200 rounded-2xl font-black text-2xl text-blue-700 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-2xs"
                title="Tambah Uang"
              >
                +
              </button>

              {/* Row 2: 4, 5, 6, - */}
              {['4', '5', '6'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-14 bg-white active:bg-slate-100 border border-slate-200/90 rounded-2xl font-bold text-2xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-2xs"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleKeypadPress('-')}
                className="h-14 bg-blue-50 active:bg-blue-100 border border-blue-200 rounded-2xl font-black text-2xl text-blue-700 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-2xs"
                title="Kurang Uang"
              >
                -
              </button>

              {/* Row 3: 7, 8, 9, Backspace */}
              {['7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-14 bg-white active:bg-slate-100 border border-slate-200/90 rounded-2xl font-bold text-2xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-2xs"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleKeypadPress('BACKSPACE')}
                className="h-14 bg-slate-100 active:bg-slate-200 border border-slate-200/90 rounded-2xl font-bold text-slate-700 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-2xs"
                title="Hapus Digit"
              >
                <Delete className="w-5 h-5" />
              </button>

              {/* Row 4: 000, 0, C (Reset), = (Hitung) */}
              <button
                type="button"
                onClick={() => handleKeypadPress('000')}
                className="h-14 bg-white active:bg-slate-100 border border-slate-200/90 rounded-2xl font-bold text-base text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-2xs tracking-tight"
              >
                000
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-14 bg-white active:bg-slate-100 border border-slate-200/90 rounded-2xl font-bold text-2xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('CLEAR')}
                className="h-14 bg-rose-50 active:bg-rose-100 border border-rose-200 rounded-2xl font-black text-lg text-rose-600 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-2xs"
                title="Reset Total"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('EQUAL')}
                className="h-14 bg-slate-900 active:bg-black rounded-2xl font-black text-2xl text-white active:scale-95 transition cursor-pointer flex items-center justify-center shadow-md"
                title="Hitung Total"
              >
                =
              </button>
            </div>
          </div>

          {/* Laci Kasir & Catatan Transaksi */}
          <div className="bg-white border-y border-slate-200/90 px-4 py-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Masuk ke Laci:</span>
              <span className="font-bold text-slate-900">
                {activeInWallet?.name || 'Kas Tunai'} ({formatRupiah(activeInWallet?.currentBalance || 0)})
              </span>
            </div>

            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan transaksi (Opsional)"
              className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition"
            />
          </div>

          {/* Floating Action Bar Tunai */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 py-3 px-4 shadow-lg">
            <div className="w-full max-w-4xl mx-auto">
              <button
                type="button"
                disabled={isSubmitting || isCashInsufficient}
                onClick={handleConfirmPayment}
                className="w-full h-13 bg-slate-900 hover:bg-black active:scale-[0.99] disabled:opacity-40 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
              >
                {isSubmitting ? (
                  <span>Memproses Pembayaran...</span>
                ) : isCashInsufficient ? (
                  <span>Uang Kurang {formatRupiah(finalTotal - cashReceived)}</span>
                ) : (
                  <span>
                    Selesaikan Pembayaran Tunai • Kembalian {formatRupiah(changeAmount)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. LAYAR TRANSFER BANK & E-WALLET / QRIS                   */}
      {/* ========================================================= */}
      {step === 'PAY_TRANSFER' && (
        <div className="space-y-3">
          {/* Header Transfer */}
          <div className="sticky top-0 z-30 px-4 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStep('CHOOSE_METHOD')}
                className="p-1.5 -ml-1 text-slate-700 hover:text-black active:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Ganti Metode"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                  Transfer Bank & E-Wallet
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Tagihan: <strong className="text-slate-900 font-bold">{formatRupiah(finalTotal)}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mx-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-rose-700">
              <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Toast Salin Rekening */}
          {copyFeedback && (
            <div className="mx-4 p-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl text-center shadow-lg animate-in fade-in duration-100">
              {copyFeedback}
            </div>
          )}

          {/* Segmented Filter Kategori Fintech */}
          <div className="bg-white border-y border-slate-200/90 px-4 py-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {(['ALL', 'BANK', 'EWALLET'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTransferFilter(cat)}
                  className={`flex-1 py-2 rounded-lg transition cursor-pointer text-center ${
                    transferFilter === cat
                      ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {cat === 'ALL' ? 'Semua Rekening' : cat === 'BANK' ? 'Transfer Bank' : 'QRIS & E-Wallet'}
                </button>
              ))}
            </div>
          </div>

          {/* Daftar Rekening Bank & E-Wallet Penerima ala Fintech */}
          <div className="bg-white border-y border-slate-200/90">
            <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Pilih Rekening Penerima
            </div>

            <div className="divide-y divide-slate-100">
              {wallets
                .filter((w) => {
                  if (transferFilter === 'BANK') return w.category === 'BANK';
                  if (transferFilter === 'EWALLET') return w.category === 'EWALLET';
                  return w.category === 'BANK' || w.category === 'EWALLET';
                })
                .map((w) => {
                  const isSelected = selectedInWalletId === w.id;
                  const brand = getWalletBrand(w);

                  return (
                    <div
                      key={w.id}
                      onClick={() => {
                        setSelectedInWalletId(w.id);
                        setMethod(w.category === 'EWALLET' ? 'QRIS' : 'TRANSFER');
                      }}
                      className={`px-4 py-4 transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-blue-50/40 font-bold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Brand Badge Fintech */}
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 tracking-wider shadow-2xs ${brand.bg} ${brand.text}`}
                        >
                          {brand.badge}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm truncate">
                              {w.name}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {w.category === 'BANK' ? 'Bank' : 'QRIS'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <span>Saldo: {formatRupiah(w.currentBalance)}</span>
                            <span aria-hidden="true">·</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(w.name, w.name);
                              }}
                              className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Salin</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Radio Indicator Bulat Fintech */}
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Form Keterangan & Catatan Transfer */}
          <div className="bg-white border-y border-slate-200/90 px-4 py-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Keterangan Transfer (Opsional)
            </span>

            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama Pengirim / Pelanggan (Opsional)"
              className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition"
            />

            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nomor referensi transfer / catatan (Opsional)"
              className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition"
            />
          </div>

          {/* Floating Action Bar Transfer */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 py-3 px-4 shadow-lg">
            <div className="w-full max-w-4xl mx-auto">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmPayment}
                className="w-full h-13 bg-slate-900 hover:bg-black active:scale-[0.99] disabled:opacity-40 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
              >
                {isSubmitting ? (
                  <span>Memproses Pembayaran...</span>
                ) : (
                  <span>
                    Konfirmasi Transfer • {formatRupiah(finalTotal)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. LAYAR KASBON (PAYLATER TOKO FINTECH STYLE)              */}
      {/* ========================================================= */}
      {step === 'PAY_KASBON' && (
        <div className="space-y-3">
          {/* Header Kasbon */}
          <div className="sticky top-0 z-30 px-4 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStep('CHOOSE_METHOD')}
                className="p-1.5 -ml-1 text-slate-700 hover:text-black active:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Ganti Metode"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                  Kasbon / PayLater Toko
                </h1>
                <p className="text-xs text-indigo-700 font-semibold">
                  Total Tagihan: <strong>{formatRupiah(finalTotal)}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mx-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-rose-700">
              <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Banner Edukasi Kasbon */}
          <div className="bg-indigo-50 border-y border-indigo-200/80 px-4 py-3.5 space-y-1">
            <div className="flex items-center gap-2 font-bold text-indigo-900 text-xs">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Transaksi Dicatat Sebagai Piutang Toko</span>
            </div>
            <p className="text-indigo-800 leading-relaxed text-xs">
              Pembayaran ditunda oleh pembeli. Saldo modal tetap akan dipotong otomatis dari dompet modal server terkait.
            </p>
          </div>

          {/* Pilihan Cepat Jatuh Tempo */}
          <div className="bg-white border-y border-slate-200/90 px-4 py-3.5 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Pilih Jangka Waktu Jatuh Tempo
            </span>

            <div className="flex items-center gap-2">
              {[3, 7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTempoDays(days)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    tempoDays === days
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {days} Hari
                </button>
              ))}
            </div>
          </div>

          {/* Form Identitas Pelanggan Kasbon */}
          <div className="bg-white border-y border-slate-200/90 px-4 py-4.5 space-y-3.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Data Pembeli / Pelanggan
            </span>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nama Pelanggan <span className="text-rose-600">*Wajib</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama pembeli / penghutang"
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nomor WhatsApp / HP <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08xxxx untuk follow-up nota & penagihan"
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Catatan Janji Bayar <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Janji bayar tgl 25 / tetangga depan"
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>
            </div>
          </div>

          {/* Rincian Pemotongan Modal Server */}
          <div className="bg-white border-y border-slate-200/90 px-4 py-4 space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Pemotongan Saldo Modal Server
            </span>
            <div className="divide-y divide-slate-100">
              {modalAnalysis.breakdown.map((b) => (
                <div key={b.walletId} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block text-sm">{b.walletName}</span>
                    <span className="text-slate-400 text-[11px]">Sisa saldo: {formatRupiah(b.remainingBalance)}</span>
                  </div>
                  <span className="font-bold text-rose-600 text-sm">-{formatRupiah(b.cost)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Floating Action Bar Kasbon */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 py-3 px-4 shadow-lg">
            <div className="w-full max-w-4xl mx-auto">
              <button
                type="button"
                disabled={isSubmitting || !customerName.trim()}
                onClick={handleConfirmPayment}
                className="w-full h-13 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-40 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
              >
                {isSubmitting ? (
                  <span>Menyimpan Piutang...</span>
                ) : (
                  <span>Catat Sebagai Kasbon • {formatRupiah(finalTotal)}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
