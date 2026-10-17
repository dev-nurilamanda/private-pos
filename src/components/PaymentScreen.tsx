import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Coins,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Copy,
  ChevronDown,
  ChevronUp,
  Delete,
  User,
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

export type PaymentTab = 'TUNAI' | 'TRANSFER' | 'KASBON';

// Helper deteksi badge brand fintech / bank Indonesia
function getWalletFintechBadge(wallet: Wallet) {
  const name = wallet.name.toUpperCase();

  if (name.includes('BCA')) {
    return { badge: 'BCA', bg: 'bg-[#003893]', text: 'text-white', label: 'Bank BCA' };
  }
  if (name.includes('BRI')) {
    return { badge: 'BRI', bg: 'bg-[#00529C]', text: 'text-white', label: 'Bank BRI' };
  }
  if (name.includes('MANDIRI')) {
    return { badge: 'MANDIRI', bg: 'bg-[#003366]', text: 'text-[#F5A623]', label: 'Bank Mandiri' };
  }
  if (name.includes('BNI')) {
    return { badge: 'BNI', bg: 'bg-[#005E6A]', text: 'text-[#F15A24]', label: 'Bank BNI' };
  }
  if (name.includes('BSI')) {
    return { badge: 'BSI', bg: 'bg-[#00A29E]', text: 'text-white', label: 'Bank BSI' };
  }
  if (name.includes('JAGO')) {
    return { badge: 'JAGO', bg: 'bg-[#FF5C00]', text: 'text-white', label: 'Bank Jago' };
  }
  if (name.includes('SEABANK') || name.includes('SEA BANK')) {
    return { badge: 'SEA', bg: 'bg-[#FF5722]', text: 'text-white', label: 'SeaBank' };
  }
  if (name.includes('QRIS')) {
    return { badge: 'QRIS', bg: 'bg-[#EA1D2C]', text: 'text-white', label: 'QRIS Standar' };
  }
  if (name.includes('DANA')) {
    return { badge: 'DANA', bg: 'bg-[#118EEA]', text: 'text-white', label: 'DANA' };
  }
  if (name.includes('GOPAY') || name.includes('GO-PAY')) {
    return { badge: 'GOPAY', bg: 'bg-[#00AED6]', text: 'text-white', label: 'GoPay' };
  }
  if (name.includes('OVO')) {
    return { badge: 'OVO', bg: 'bg-[#4C3494]', text: 'text-white', label: 'OVO' };
  }
  if (name.includes('SHOPEEPAY') || name.includes('SHOPEE')) {
    return { badge: 'SHOPEE', bg: 'bg-[#EE4D2D]', text: 'text-white', label: 'ShopeePay' };
  }

  if (wallet.category === 'BANK') {
    return { badge: 'BANK', bg: 'bg-blue-600', text: 'text-white', label: 'Rekening Bank' };
  }
  if (wallet.category === 'EWALLET') {
    return { badge: 'QRIS', bg: 'bg-emerald-600', text: 'text-white', label: 'E-Wallet' };
  }

  return { badge: 'KAS', bg: 'bg-slate-800', text: 'text-white', label: 'Dompet Toko' };
}

// Helper evaluasi kalkulator matematika aman (angka, +, -)
function evaluateCalculatorString(expr: string): number {
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
  // 1. METODE PEMBAYARAN AKTIF: CHIP TABS HORIZONTAL (Tunai | Transfer | Kasbon)
  const [activeTab, setActiveTab] = useState<PaymentTab>('TUNAI');

  // Dompet default
  const defaultCashWallet = wallets.find((w) => w.category === 'CASH') || wallets[0];
  const defaultBankWallet =
    wallets.find((w) => w.category === 'BANK' || w.category === 'EWALLET') || wallets[0];

  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    defaultCashWallet?.id || 'cash_main'
  );

  // 2. STATE LOGIKA KONTEN & KALKULATOR
  const [calcExpression, setCalcExpression] = useState<string>(String(finalTotal));
  const [cashReceived, setCashReceived] = useState<number>(finalTotal);

  // Sinkronisasi saat finalTotal atau tab berubah
  useEffect(() => {
    if (activeTab === 'TUNAI') {
      setCalcExpression(String(finalTotal));
      setCashReceived(finalTotal);
      if (defaultCashWallet) setSelectedWalletId(defaultCashWallet.id);
    } else if (activeTab === 'TRANSFER') {
      setCalcExpression(String(finalTotal));
      setCashReceived(finalTotal); // Terkunci PAS
      if (defaultBankWallet) setSelectedWalletId(defaultBankWallet.id);
    } else if (activeTab === 'KASBON') {
      setCalcExpression('0');
      setCashReceived(0);
      if (defaultCashWallet) setSelectedWalletId(defaultCashWallet.id);
    }
  }, [activeTab, finalTotal]);

  // Transfer & Kasbon info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tempoDays, setTempoDays] = useState<number>(7);
  const [notes, setNotes] = useState('');
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Submission & Struk
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<{
    totalPaid: number;
    methodLabel: string;
    inWalletName: string;
    cashReceived?: number;
    changeAmount?: number;
    customerTarget?: string;
    trxId: string;
    dateStr: string;
    deductedModal: { walletName: string; cost: number; remaining: number }[];
  } | null>(null);

  // Navigasi Bertingkat: Tombol Back
  useBackHandler('checkout-payment-screen', onBack, !successReceipt, 35);
  useBackHandler(
    'payment-success-modal',
    () => {
      onClearCart();
      onBackToCashier();
    },
    !!successReceipt,
    50
  );

  // Status Kembalian Real-time
  const changeAmount = Math.max(0, cashReceived - finalTotal);
  const isCashInsufficient = activeTab === 'TUNAI' && cashReceived < finalTotal;

  // Keypad Handlers dengan Logika Matematika
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

    if (key === '50000') {
      setCalcExpression('50000');
      setCashReceived(50000);
      return;
    }

    if (key === '100000') {
      setCalcExpression('100000');
      setCashReceived(100000);
      return;
    }

    if (key === 'EQUAL') {
      const evalVal = evaluateCalculatorString(calcExpression);
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
        const evalVal = evaluateCalculatorString(nextStr);
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
        const evalVal = evaluateCalculatorString(nextExpr);
        setCashReceived(evalVal);
        return nextExpr;
      });
      return;
    }

    // Input digit angka (0-9)
    setCalcExpression((prev) => {
      let nextExpr = '';
      if (prev === '0') {
        nextExpr = key;
      } else {
        nextExpr = `${prev}${key}`;
      }
      const evalVal = evaluateCalculatorString(nextExpr);
      setCashReceived(evalVal);
      return nextExpr;
    });
  };

  // Salin Nomor Rekening
  const handleCopyAccount = (textToCopy: string, bankLabel: string) => {
    navigator.clipboard?.writeText(textToCopy);
    setCopyToast(`${bankLabel} berhasil disalin!`);
    setTimeout(() => setCopyToast(null), 2000);
  };

  // Analisis Saldo Modal Server
  const modalAnalysis = useMemo(() => {
    const totalCostAll = cart.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
    const breakdownMap: Record<string, { wallet: Wallet | undefined; cost: number }> = {};

    cart.forEach((item) => {
      const wId = item.outWalletId || 'cash_main';
      if (!breakdownMap[wId]) {
        breakdownMap[wId] = {
          wallet: wallets.find((w) => w.id === wId),
          cost: 0,
        };
      }
      breakdownMap[wId].cost += item.costPrice * item.quantity;
    });

    const breakdown = Object.entries(breakdownMap).map(([walletId, data]) => {
      const currentBalance = data.wallet ? data.wallet.currentBalance : 0;
      return {
        walletId,
        walletName: data.wallet?.name || `Dompet (${walletId})`,
        cost: data.cost,
        remainingBalance: currentBalance - data.cost,
      };
    });

    return { totalCostAll, breakdown };
  }, [cart, wallets]);

  // Eksekusi Konfirmasi Pembayaran
  const handleConfirmPayment = async () => {
    if (cart.length === 0) return;

    if (activeTab === 'TUNAI' && cashReceived < finalTotal) {
      setErrorMessage(
        `Uang diterima (${formatRupiah(cashReceived)}) kurang dari tagihan (${formatRupiah(finalTotal)}).`
      );
      return;
    }

    if (activeTab === 'KASBON' && !customerName.trim()) {
      setErrorMessage('Untuk transaksi Kasbon, Nama Pelanggan wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const inWalletId = selectedWalletId || 'cash_main';
      const targetCustomer = [customerName.trim(), customerPhone.trim()]
        .filter(Boolean)
        .join(' - ');

      const tempoNote = activeTab === 'KASBON' ? `[Jatuh Tempo: ${tempoDays} hari]` : '';
      const fullNotes = [notes.trim(), tempoNote].filter(Boolean).join(' ');

      let paymentMethodCode = 'CASH';
      let paymentStatusCode: 'PAID' | 'UNPAID' = 'PAID';

      if (activeTab === 'TRANSFER') {
        const w = wallets.find((wal) => wal.id === inWalletId);
        paymentMethodCode = w?.category === 'EWALLET' ? 'QRIS' : 'TRANSFER';
        paymentStatusCode = 'PAID';
      } else if (activeTab === 'KASBON') {
        paymentMethodCode = 'HUTANG';
        paymentStatusCode = 'UNPAID';
      } else {
        paymentMethodCode = 'CASH';
        paymentStatusCode = 'PAID';
      }

      await executeCartTransaction({
        items: cart,
        inWalletId,
        paymentStatus: paymentStatusCode,
        paymentMethod: paymentMethodCode,
        customerTarget: targetCustomer || undefined,
        cashReceived: activeTab === 'TUNAI' ? cashReceived : finalTotal,
        discountId: selectedDiscount?.id,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        discountName: selectedDiscount?.name,
        finalTotal,
        notes: fullNotes || undefined,
      });

      const activeWalletObj = wallets.find((w) => w.id === inWalletId);
      const now = new Date();
      const dateStr = now.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      setSuccessReceipt({
        totalPaid: finalTotal,
        methodLabel:
          activeTab === 'TUNAI'
            ? 'Tunai (Cash)'
            : activeTab === 'TRANSFER'
            ? `Transfer (${activeWalletObj?.name || 'Bank'})`
            : 'Kasbon (Piutang)',
        inWalletName: activeWalletObj?.name || 'Kasir',
        cashReceived: activeTab === 'TUNAI' ? cashReceived : undefined,
        changeAmount: activeTab === 'TUNAI' ? changeAmount : undefined,
        customerTarget: targetCustomer || undefined,
        trxId: `TRX-${Date.now().toString().slice(-6)}`,
        dateStr,
        deductedModal: modalAnalysis.breakdown.map((b) => ({
          walletName: b.walletName,
          cost: b.cost,
          remaining: b.remainingBalance,
        })),
      });
    } catch (err: unknown) {
      console.error('Payment error:', err);
      const msg = err instanceof Error ? err.message : 'Gagal memproses transaksi kasir.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // TAMPILAN STRUK DIGITAL SUKSES (FINTECH RECEIPT)
  // =========================================================
  if (successReceipt) {
    return (
      <div className="-mx-4 pb-28 min-h-screen bg-slate-50 flex flex-col justify-between animate-in fade-in duration-150">
        <div className="space-y-3">
          <div className="bg-white border-b border-slate-200/90 px-4 pt-9 pb-7 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-9 h-9 stroke-[2.4]" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                {activeTab === 'KASBON' ? 'Piutang Berhasil Dicatat' : 'Pembayaran Berhasil'}
              </span>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                {formatRupiah(successReceipt.totalPaid)}
              </h2>
              <p className="text-xs text-slate-400">
                {successReceipt.dateStr} • {successReceipt.trxId}
              </p>
            </div>
          </div>

          <div className="bg-white border-y border-slate-200/90 px-4 py-4 space-y-2.5 text-xs text-slate-600 font-medium">
            <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px] block">
              Rincian Transaksi
            </span>

            <div className="flex items-center justify-between">
              <span>Metode</span>
              <span className="font-bold text-slate-900">{successReceipt.methodLabel}</span>
            </div>

            {successReceipt.customerTarget && (
              <div className="flex items-center justify-between">
                <span>Pelanggan</span>
                <span className="font-bold text-slate-900">{successReceipt.customerTarget}</span>
              </div>
            )}

            {successReceipt.cashReceived !== undefined && (
              <div className="flex items-center justify-between">
                <span>Uang Diterima</span>
                <span className="font-bold text-slate-900">{formatRupiah(successReceipt.cashReceived)}</span>
              </div>
            )}

            {successReceipt.changeAmount !== undefined && (
              <div className="flex items-center justify-between text-emerald-600 font-bold border-t border-slate-100 pt-2">
                <span>Kembalian</span>
                <span className="text-sm font-black">{formatRupiah(successReceipt.changeAmount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <span>Akun Penampung</span>
              <span className="font-bold text-slate-900">{successReceipt.inWalletName}</span>
            </div>
          </div>
        </div>

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

  // =========================================================
  // ANTARMUKA CHECKOUT ULTRA-LEAN RESPONSIF MOBILE-NATIVE
  // =========================================================
  return (
    <div className="-mx-4 bg-slate-50 min-h-[calc(100dvh-3.5rem)] flex flex-col justify-between">
      {/* BAGIAN ATAS: NAVBAR, TABS, DAN KONTEN DINAMIS */}
      <div className="flex-1 flex flex-col">
        {/* 1. Header Minimalis: "Pilih pembayaran" */}
        <div className="sticky top-0 z-30 px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 -ml-1 text-slate-700 hover:text-black active:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                Pilih pembayaran
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Tagihan: <strong className="text-slate-900 font-bold">{formatRupiah(finalTotal)}</strong>
                {discountAmount > 0 && (
                  <span className="text-rose-600 font-semibold ml-1">
                    (Diskon -{formatRupiah(discountAmount)})
                  </span>
                )}
              </p>
            </div>
          </div>

          <span className="text-xs text-slate-500 font-bold shrink-0">
            {cart.reduce((a, b) => a + b.quantity, 0)} item
          </span>
        </div>

        {/* Toast Notifikasi Salin */}
        {copyToast && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 text-white rounded-xl shadow-xl text-xs font-bold animate-in fade-in duration-100">
            {copyToast}
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-4 mt-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 2. METODE PEMBAYARAN: CHIP TABS HORIZONTAL (Solid Dark Navy vs Outline Halus) */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'TUNAI', label: 'Tunai', icon: Coins },
                { id: 'TRANSFER', label: 'Transfer', icon: Building2 },
                { id: 'KASBON', label: 'Kasbon', icon: Clock },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setErrorMessage(null);
                  }}
                  className={`h-11 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {isActive ? (
                    <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-400" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 stroke-[2]" />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. LOGIKA KONTEN SESUAI METODE AKTIF */}
        <div className="px-4 py-2 flex-1 flex flex-col space-y-3">
          {/* ========================================================= */}
          {/* A. JIKA METODE "TUNAI": DISPLAY BESAR + ACCORDION + KEYPAD */}
          {/* ========================================================= */}
          {activeTab === 'TUNAI' && (
            <div className="flex-1 flex flex-col justify-between">
              {/* BAGIAN ATAS KONTEN TUNAI */}
              <div className="space-y-2.5">
                {/* Display Besar Uang Diterima & Status Kembalian (Lebar Vertikal Lebih Proporsional) */}
                <div className="bg-white border border-slate-200/90 rounded-2xl px-4 py-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                    <span>Uang Diterima</span>
                    {cashReceived > 0 && (
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('CLEAR')}
                        className="text-rose-600 hover:text-rose-700 active:scale-95 font-bold text-xs cursor-pointer px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-100"
                        title="Reset"
                      >
                        C
                      </button>
                    )}
                  </div>

                  {/* Rumus hitungan matematika jika ada operasi + atau - */}
                  {(calcExpression.includes('+') || calcExpression.includes('-')) && (
                    <div className="text-xs font-mono font-bold text-slate-500 tracking-wide truncate">
                      Hitungan: {calcExpression}
                    </div>
                  )}

                  {/* Display Format Ribuan Otomatis Besar & Proporsional */}
                  <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight select-none">
                    {formatRupiah(cashReceived)}
                  </div>

                  {/* Status Kembalian Real-time */}
                  <div
                    className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                      isCashInsufficient
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    <span>
                      {isCashInsufficient ? 'Status: Uang Kurang' : 'Status: Lunas'}
                    </span>
                    <span className="font-black text-sm">
                      {isCashInsufficient
                        ? `Kurang: ${formatRupiah(finalTotal - cashReceived)}`
                        : `Kembalian: ${formatRupiah(changeAmount)}`}
                    </span>
                  </div>
                </div>

                {/* Accordion Pelanggan & Catatan (Ultra-Lean) */}
                <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>+ Tambah Pelanggan & Catatan</span>
                      {(customerName || notes) && (
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                      )}
                    </div>
                    {isAccordionOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {isAccordionOpen && (
                    <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-slate-100 animate-in fade-in duration-100">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nama Pelanggan (Opsional)"
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition"
                      />

                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Catatan transaksi / referensi (Opsional)"
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* KEYPAD MENEMPEL KE BAWAH (STICKY BOTTOM DOCKED) */}
              <div className="mt-auto pt-2.5 pb-1">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-2 select-none shadow-2xs">
                  {/* 3 Tombol Pintas Cepat: Uang Pas, 50.000, 100.000 */}
                  <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('UANG_PAS')}
                      className="h-10 bg-slate-900 active:bg-black text-white rounded-xl font-bold text-xs active:scale-95 transition cursor-pointer flex items-center justify-center shadow-xs"
                    >
                      Uang Pas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('50000')}
                      className="h-10 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 text-blue-800 rounded-xl font-bold text-xs active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      50.000
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('100000')}
                      className="h-10 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 text-blue-800 rounded-xl font-bold text-xs active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      100.000
                    </button>
                  </div>

                  {/* 4x4 Calculator Keypad dengan Logika Matematika (+, -, =) dan Tombol "C" */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {/* Baris 1: 1, 2, 3, + */}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('1')}
                      className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('2')}
                      className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('3')}
                      className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      3
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('+')}
                      className="h-11 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 text-blue-700 rounded-xl font-black text-2xl active:scale-95 transition cursor-pointer flex items-center justify-center"
                      title="Tambah Uang"
                    >
                      +
                    </button>

                    {/* Baris 2: 4, 5, 6, - */}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('4')}
                      className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      4
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('5')}
                      className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      5
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('6')}
                      className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      6
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('-')}
                      className="h-11 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 text-blue-700 rounded-xl font-black text-2xl active:scale-95 transition cursor-pointer flex items-center justify-center"
                      title="Kurang Uang"
                    >
                      -
                    </button>

                    {/* Baris 3: 7, 8, 9, Backspace */}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('7')}
                      className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      7
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('8')}
                      className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      8
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('9')}
                      className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      9
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('BACKSPACE')}
                      className="h-11 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200/80 rounded-xl font-bold text-slate-700 active:scale-95 transition cursor-pointer flex items-center justify-center"
                      title="Hapus Digit"
                    >
                      <Delete className="w-5 h-5" />
                    </button>

                    {/* Baris 4: 000, 0, C, = */}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('000')}
                      className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-sm text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center tracking-tight"
                    >
                      000
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('0')}
                      className="h-11 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl font-bold text-xl text-slate-900 active:scale-95 transition cursor-pointer flex items-center justify-center"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('CLEAR')}
                      className="h-11 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 text-rose-600 rounded-xl font-black text-lg active:scale-95 transition cursor-pointer flex items-center justify-center"
                      title="Reset"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('EQUAL')}
                      className="h-11 bg-slate-900 active:bg-black text-white rounded-xl font-black text-xl active:scale-95 transition cursor-pointer flex items-center justify-center shadow-xs"
                      title="Hitung Total"
                    >
                      =
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* B. JIKA METODE "TRANSFER": KARTU REKENING DINAMIS (WALLETS)*/}
          {/* ========================================================= */}
          {activeTab === 'TRANSFER' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
                <span>Pilih Rekening Tujuan Transfer</span>
                <span className="text-emerald-600 font-bold">Terkunci Pas: {formatRupiah(finalTotal)}</span>
              </div>

              <div className="space-y-2">
                {wallets
                  .filter((w) => w.category === 'BANK' || w.category === 'EWALLET')
                  .map((w) => {
                    const isSelected = selectedWalletId === w.id;
                    const badge = getWalletFintechBadge(w);
                    const accountNumber = w.notes || '102-00-1928374-1';

                    return (
                      <div
                        key={w.id}
                        onClick={() => setSelectedWalletId(w.id)}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-50/50 border-blue-500 shadow-2xs'
                            : 'bg-white border-slate-200/90 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar Badge Brand Inisial */}
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 tracking-wider shadow-2xs ${badge.bg} ${badge.text}`}
                          >
                            {badge.badge}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-900 text-sm truncate">
                                {w.name}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                {badge.label}
                              </span>
                            </div>

                            {/* Nomor Akun & Tombol Salin Cepat */}
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <span className="font-mono text-slate-700 font-semibold truncate max-w-[150px]">
                                {accountNumber}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyAccount(accountNumber, w.name);
                                }}
                                className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Salin</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Radio Indikator Bulat */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}

                {wallets.filter((w) => w.category === 'BANK' || w.category === 'EWALLET').length === 0 && (
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
                    Belum ada rekening bank atau e-wallet di menu Dompet. Silakan tambah rekening terlebih dahulu.
                  </div>
                )}
              </div>

              {/* Accordion Pelanggan & Catatan Transfer */}
              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs mt-2">
                <button
                  type="button"
                  onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>+ Tambah Pelanggan & Catatan Transfer</span>
                    {(customerName || notes) && (
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  {isAccordionOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {isAccordionOpen && (
                  <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-slate-100 animate-in fade-in duration-100">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nama Pengirim / Pelanggan (Opsional)"
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition"
                    />

                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Nomor referensi / catatan transfer (Opsional)"
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* C. JIKA METODE "KASBON": FORM WAJIB PELANGGAN & TEMPO     */}
          {/* ========================================================= */}
          {activeTab === 'KASBON' && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Data Piutang / Kasbon
                </span>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Belum Lunas
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Pilih / Masukkan Nama Pelanggan <span className="text-rose-600">*Wajib</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ketik nama pelanggan / pembeli"
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Nomor WhatsApp / HP <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="08xxxx untuk follow-up nota & penagihan"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Jatuh Tempo (Opsional)
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[3, 7, 14, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setTempoDays(days)}
                        className={`h-9 rounded-xl text-xs font-bold transition cursor-pointer ${
                          tempoDays === days
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {days} Hari
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Catatan Janji Bayar <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Misal: Janji bayar akhir bulan"
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. TOMBOL UTAMA (STICKY BOTTOM TANPA TERDORONG KELUAR)   */}
      {/* ========================================================= */}
      <div className="sticky bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 px-4 shadow-lg shrink-0">
        <div className="w-full max-w-4xl mx-auto">
          <button
            type="button"
            disabled={
              isSubmitting ||
              (activeTab === 'TUNAI' && isCashInsufficient) ||
              (activeTab === 'KASBON' && !customerName.trim())
            }
            onClick={handleConfirmPayment}
            className="w-full h-13 bg-slate-900 hover:bg-black active:scale-[0.99] disabled:opacity-40 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
          >
            {isSubmitting ? (
              <span>Memproses Transaksi...</span>
            ) : activeTab === 'TUNAI' && isCashInsufficient ? (
              <span>Uang Kurang {formatRupiah(finalTotal - cashReceived)}</span>
            ) : activeTab === 'KASBON' && !customerName.trim() ? (
              <span>Masukkan Nama Pelanggan Kasbon</span>
            ) : (
              <span>
                Konfirmasi Pembayaran • {formatRupiah(finalTotal)}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
