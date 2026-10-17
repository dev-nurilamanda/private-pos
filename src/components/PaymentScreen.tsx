import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Delete,
  CheckCircle2,
  Receipt,
  Coins,
  Building2,
  QrCode,
  Clock,
  Copy,
  User,
  Check,
} from 'lucide-react';
import { db, type Wallet, type Discount } from '../db/db';
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

export type PaymentTab = 'TUNAI' | 'TRANSFER' | 'QRIS' | 'KASBON';

// Helper deteksi badge brand perbankan / fintech
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
    return { badge: 'E-WAL', bg: 'bg-emerald-600', text: 'text-white', label: 'E-Wallet' };
  }

  return { badge: 'KAS', bg: 'bg-slate-800', text: 'text-white', label: 'Kas Toko' };
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
  discountAmount,
  selectedDiscount,
  finalTotal,
  wallets,
  onBack,
  onSuccess,
  onClearCart,
  onBackToCashier,
}) => {
  // 1. STATE METODE PEMBAYARAN AKTIF: Tunai | Transfer | QRIS | Kasbon
  const [activeTab, setActiveTab] = useState<PaymentTab>('TUNAI');

  // Ambil daftar pelanggan dari Dexie untuk autocomplete kasbon
  const existingCustomers = useLiveQuery(() => db.customers.toArray()) || [];

  // Dompet default terfilter
  const cashWallets = wallets.filter((w) => w.category === 'CASH');
  const bankWallets = wallets.filter(
    (w) =>
      w.category === 'BANK' ||
      w.name.toUpperCase().includes('BANK') ||
      w.name.toUpperCase().includes('BCA') ||
      w.name.toUpperCase().includes('BRI') ||
      w.name.toUpperCase().includes('MANDIRI') ||
      w.name.toUpperCase().includes('BNI') ||
      w.name.toUpperCase().includes('BSI')
  );
  const qrisWallets = wallets.filter(
    (w) =>
      w.category === 'EWALLET' ||
      w.name.toUpperCase().includes('QRIS') ||
      w.name.toUpperCase().includes('DANA') ||
      w.name.toUpperCase().includes('GOPAY') ||
      w.name.toUpperCase().includes('OVO') ||
      w.name.toUpperCase().includes('SHOPEE')
  );

  const defaultCashId = cashWallets[0]?.id || wallets[0]?.id || 'cash_main';
  const defaultBankId = bankWallets[0]?.id || wallets[0]?.id || 'cash_main';
  const defaultQrisId = qrisWallets[0]?.id || wallets[0]?.id || 'cash_main';

  const [selectedWalletId, setSelectedWalletId] = useState<string>(defaultCashId);

  // 2. STATE LOGIKA KONTEN & KALKULATOR
  const [calcExpression, setCalcExpression] = useState<string>(String(finalTotal));
  const [cashReceived, setCashReceived] = useState<number>(finalTotal);

  // Accordion Detail Produk di kontainer Total Tagihan
  const [isDetailExpanded, setIsDetailExpanded] = useState<boolean>(false);

  // Form Transfer, QRIS & Kasbon
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [tempoDays, setTempoDays] = useState<number>(7);
  const [notes, setNotes] = useState<string>('');
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Status proses transaksi
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
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
  } | null>(null);

  // Sinkronisasi saat activeTab atau finalTotal berubah
  useEffect(() => {
    setErrorMessage(null);
    if (activeTab === 'TUNAI') {
      setCalcExpression(String(finalTotal));
      setCashReceived(finalTotal);
      setSelectedWalletId(defaultCashId);
    } else if (activeTab === 'TRANSFER') {
      setCalcExpression(String(finalTotal));
      setCashReceived(finalTotal); // Nilai otomatis terkunci PAS
      setSelectedWalletId(defaultBankId);
    } else if (activeTab === 'QRIS') {
      setCalcExpression(String(finalTotal));
      setCashReceived(finalTotal); // Nilai otomatis terkunci PAS
      setSelectedWalletId(defaultQrisId);
    } else if (activeTab === 'KASBON') {
      setCalcExpression('0');
      setCashReceived(0);
      setSelectedWalletId(defaultCashId);
    }
  }, [activeTab, finalTotal, defaultCashId, defaultBankId, defaultQrisId]);

  // Dukungan tombol Back ponsel / browser
  useBackHandler('checkout-payment-screen', onBack, !successReceipt, 35);
  useBackHandler(
    'payment-success-receipt',
    () => {
      onClearCart();
      onBackToCashier();
    },
    !!successReceipt,
    50
  );

  // Status Kembalian Tunai
  const changeAmount = Math.max(0, cashReceived - finalTotal);
  const isCashInsufficient = activeTab === 'TUNAI' && cashReceived < finalTotal;

  // Keypad Handlers
  const handleKeypadPress = (key: string) => {
    setErrorMessage(null);

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

    // Input digit angka 0-9
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

  // Salin Nomor Rekening / ID
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopyToast(`${label} disalin!`);
    setTimeout(() => setCopyToast(null), 2000);
  };

  // Eksekusi Konfirmasi Pembayaran
  const handleConfirmPayment = async () => {
    if (cart.length === 0) return;

    if (activeTab === 'TUNAI' && cashReceived < finalTotal) {
      setErrorMessage(`Uang diterima kurang ${formatRupiah(finalTotal - cashReceived)}`);
      return;
    }

    if (activeTab === 'KASBON' && !customerName.trim()) {
      setErrorMessage('Nama Pelanggan wajib diisi untuk transaksi Kasbon.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const inWalletId = selectedWalletId || defaultCashId;
      const targetCustomer = [customerName.trim(), customerPhone.trim()].filter(Boolean).join(' - ');
      const tempoNote = activeTab === 'KASBON' ? `[Jatuh Tempo: ${tempoDays} hari]` : '';
      const fullNotes = [notes.trim(), tempoNote].filter(Boolean).join(' ');

      let paymentMethodCode = 'CASH';
      let paymentStatusCode: 'PAID' | 'UNPAID' = 'PAID';

      if (activeTab === 'TRANSFER') {
        paymentMethodCode = 'TRANSFER';
        paymentStatusCode = 'PAID';
      } else if (activeTab === 'QRIS') {
        paymentMethodCode = 'QRIS';
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
            : activeTab === 'QRIS'
            ? `QRIS (${activeWalletObj?.name || 'E-Wallet'})`
            : 'Kasbon (Piutang)',
        inWalletName: activeWalletObj?.name || 'Kasir',
        cashReceived: activeTab === 'TUNAI' ? cashReceived : undefined,
        changeAmount: activeTab === 'TUNAI' ? changeAmount : undefined,
        customerTarget: targetCustomer || undefined,
        trxId: `TRX-${Date.now().toString().slice(-6)}`,
        dateStr,
      });
    } catch (err: unknown) {
      console.error('Payment error:', err);
      const msg = err instanceof Error ? err.message : 'Gagal mencatat transaksi kasir.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dompet terpilih saat ini untuk Transfer atau QRIS
  const currentSelectedWallet = wallets.find((w) => w.id === selectedWalletId);
  const currentBadge = currentSelectedWallet ? getWalletFintechBadge(currentSelectedWallet) : null;
  const currentAccountNo = currentSelectedWallet?.notes || '102-00-1928374-1';

  // =========================================================
  // STRUK SUKSES PASCA PEMBAYARAN
  // =========================================================
  if (successReceipt) {
    return (
      <div className="-mx-4 h-[100dvh] flex flex-col justify-between overflow-hidden bg-slate-50 animate-in fade-in duration-100">
        <div className="flex-1 overflow-y-auto px-4 pt-8 pb-4 space-y-4 max-w-md mx-auto w-full">
          <div className="bg-white rounded-xl p-5 text-center space-y-2 border border-slate-200">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 stroke-[2.4]" />
            </div>

            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">
              {activeTab === 'KASBON' ? 'Piutang Berhasil Dicatat' : 'Pembayaran Berhasil'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatRupiah(successReceipt.totalPaid)}
            </h2>
            <p className="text-xs font-mono text-slate-500">
              {successReceipt.dateStr} • {successReceipt.trxId}
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 space-y-2.5 text-xs text-slate-600 font-medium border border-slate-200">
            <div className="flex items-center justify-between">
              <span>Metode Pembayaran</span>
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
              <div className="flex items-center justify-between text-emerald-700 font-bold border-t border-slate-100 pt-2">
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

        <div className="w-full bg-white border-t border-slate-100 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
          <button
            type="button"
            onClick={() => {
              onSuccess(`Transaksi ${formatRupiah(finalTotal)} berhasil dicatat.`);
              onClearCart();
              onBackToCashier();
            }}
            className="w-full h-11 bg-slate-900 hover:bg-black active:bg-slate-800 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>Selesai & Transaksi Baru</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // TAMPILAN UTAMA FULL VIEWPORT PAS 1 LAYAR PENUH MOBILE
  // =========================================================
  return (
    <div className="-mx-4 h-[100dvh] flex flex-col justify-between overflow-hidden bg-slate-50">
      {/* Toast Salin Notifikasi */}
      {copyToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold animate-in fade-in duration-100 shadow-md">
          {copyToast}
        </div>
      )}

      {/* 0. HEADER NAVBAR RAMBING */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-1 -ml-1 text-slate-700 hover:text-black active:bg-slate-100 rounded-lg transition cursor-pointer"
            title="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-slate-900">Pilih Pembayaran</h1>
        </div>

        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
          {cart.reduce((a, b) => a + b.quantity, 0)} item
        </span>
      </div>

      {/* 1. AREA ATAS: OVERFLOW AUTO DENGAN SPACE-Y-2.5 */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 space-y-2.5">
        {/* Error Alert jika ada */}
        {errorMessage && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* 2.A. BAR NAVIGASI METODE BAYAR (4 CHIP HORIZONTAL) */}
        <div className="grid grid-cols-4 gap-1.5 select-none">
          {(
            [
              { id: 'TUNAI', label: 'Tunai', icon: Coins },
              { id: 'TRANSFER', label: 'Transfer', icon: Building2 },
              { id: 'QRIS', label: 'QRIS', icon: QrCode },
              { id: 'KASBON', label: 'Kasbon', icon: Clock },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`h-9 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1 cursor-pointer select-none border ${
                  isActive
                    ? 'bg-slate-900 text-white font-medium border-slate-900 shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 2.B. CONTAINER "TOTAL TAGIHAN" YANG LEBIH RAMPING (SLIM VERTIKAL) */}
        <div className="bg-white rounded-xl border border-slate-200/80 py-2 px-3.5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Total Tagihan:</span>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                {formatRupiah(finalTotal)}
              </span>
            </div>

            {/* Accordion Toggle Minimalis */}
            <button
              type="button"
              onClick={() => setIsDetailExpanded(!isDetailExpanded)}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Detail Produk</span>
              {isDetailExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>

          {/* Isi Accordion Detail Produk saat Terbuka */}
          {isDetailExpanded && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs animate-in fade-in duration-100">
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 pr-1">
                {cart.map((item) => (
                  <div key={item.id} className="py-1.5 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 text-[11px] truncate">
                        {item.productName}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {item.quantity} x {formatRupiah(item.sellingPrice)}
                      </p>
                    </div>
                    <span className="font-semibold text-slate-900 text-[11px] shrink-0">
                      {formatRupiah(item.quantity * item.sellingPrice)}
                    </span>
                  </div>
                ))}
              </div>

              {discountAmount > 0 && (
                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-rose-600 font-semibold">
                  <span>Diskon</span>
                  <span>-{formatRupiah(discountAmount)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. LOGIKA KONTEN DINAMIS BERDASARKAN METODE YANG DIPILIH */}

        {/* METODE 1: TUNAI -> BOX "UANG DITERIMA" YANG RAMPING */}
        {activeTab === 'TUNAI' && (
          <div className="bg-white rounded-xl border border-slate-200/80 py-2 px-3.5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Uang Diterima</span>
              {cashReceived > 0 && (
                <button
                  type="button"
                  onClick={() => handleKeypadPress('CLEAR')}
                  className="text-rose-600 font-bold hover:underline cursor-pointer"
                >
                  C (Reset)
                </button>
              )}
            </div>

            {(calcExpression.includes('+') || calcExpression.includes('-')) && (
              <div className="text-[11px] font-mono font-semibold text-slate-500 truncate">
                Hitungan: {calcExpression}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {formatRupiah(cashReceived)}
              </div>

              {/* Status Lunas / Kembalian Real-time */}
              <div
                className={`py-1 px-2.5 rounded-lg text-xs font-bold border shrink-0 ${
                  isCashInsufficient
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {isCashInsufficient
                  ? `Kurang: ${formatRupiah(finalTotal - cashReceived)}`
                  : `Kembalian: ${formatRupiah(changeAmount)} • Lunas`}
              </div>
            </div>
          </div>
        )}

        {/* METODE 2: TRANSFER -> DROPDOWN + KARTU REKENING TUJUAN + CATATAN */}
        {activeTab === 'TRANSFER' && (
          <div className="bg-white rounded-xl border border-slate-200/80 p-3 space-y-2.5 shadow-2xs">
            {/* Dropdown Rekening Tujuan */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Pilih Rekening Tujuan Transfer
              </label>
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
              >
                {bankWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.notes ? `(${w.notes})` : ''}
                  </option>
                ))}
                {bankWallets.length === 0 && (
                  <option value={defaultCashId}>Kasir Utama Toko</option>
                )}
              </select>
            </div>

            {/* Kartu Ringkas Akun Terpilih */}
            {currentSelectedWallet && (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${currentBadge?.bg} ${currentBadge?.text}`}
                  >
                    {currentBadge?.badge || 'BANK'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate">
                      {currentSelectedWallet.name}
                    </p>
                    <p className="font-mono text-xs text-slate-600 truncate">{currentAccountNo}</p>
                    <p className="text-[10px] text-slate-400">a.n. Kasir / Toko</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(currentAccountNo, 'No. Rekening')}
                  className="px-2 py-1 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 rounded text-xs font-bold text-blue-600 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin</span>
                </button>
              </div>
            )}

            {/* Input Teks Ringkas (Opsional) */}
            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nama Pengirim / Catatan Referensi (Opsional)"
                className="w-full h-8.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>
        )}

        {/* METODE 3: QRIS -> DROPDOWN AKUN PENERIMA + KARTU INFO QRIS */}
        {activeTab === 'QRIS' && (
          <div className="bg-white rounded-xl border border-slate-200/80 p-3 space-y-2.5 shadow-2xs">
            {/* Dropdown Akun QRIS */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Pilih Akun Penerima QRIS / E-Wallet
              </label>
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
              >
                {qrisWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.notes ? `(${w.notes})` : ''}
                  </option>
                ))}
                {qrisWallets.length === 0 && (
                  <option value={defaultCashId}>QRIS Toko Standar</option>
                )}
              </select>
            </div>

            {/* Kartu Ringkas Info Akun QRIS */}
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${currentBadge?.bg || 'bg-red-600'} text-white`}
                >
                  {currentBadge?.badge || 'QRIS'}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 truncate">
                    {currentSelectedWallet?.name || 'QRIS Pembayaran'}
                  </p>
                  <p className="text-[11px] text-slate-500">Scan QRIS Statis / Barcode Toko</p>
                </div>
              </div>

              {currentSelectedWallet?.notes && (
                <button
                  type="button"
                  onClick={() => handleCopy(currentSelectedWallet.notes || '', 'ID QRIS')}
                  className="px-2 py-1 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 rounded text-xs font-bold text-blue-600 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin ID</span>
                </button>
              )}
            </div>

            {/* Input Teks Ringkas (Opsional) */}
            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan transaksi / Nomor referensi e-wallet (Opsional)"
                className="w-full h-8.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>
        )}

        {/* METODE 4: KASBON -> FORM WAJIB PENCATATAN PIUTANG */}
        {activeTab === 'KASBON' && (
          <div className="bg-white rounded-xl border border-slate-200/80 p-3 space-y-2.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Pembayaran Ditunda • Dicatat Piutang</span>
            </div>

            {/* Input/Pilih Nama Pelanggan (Wajib) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Pilih / Masukkan Nama Pelanggan <span className="text-rose-600">*Wajib</span>
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  list="customer-suggestions"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ketik atau pilih nama pembeli"
                  className="w-full h-8.5 bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                />
                <datalist id="customer-suggestions">
                  {existingCustomers.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Nomor WhatsApp / HP (Opsional) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Nomor WhatsApp / HP <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="08xxxx untuk penagihan / nota digital"
                className="w-full h-8.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
              />
            </div>

            {/* Pilihan Jatuh Tempo */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Jatuh Tempo (Opsional)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[3, 7, 14, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setTempoDays(days)}
                    className={`h-7.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      tempoDays === days
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {days} Hari
                  </button>
                ))}
              </div>
            </div>

            {/* Catatan Perjanjian */}
            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan perjanjian bayar (Opsional)"
                className="w-full h-8.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. AREA BAWAH (KEYPAD DOCK & STICKY BUTTON) */}
      <div className="w-full bg-white border-t border-slate-100 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0 mt-auto shadow-[0_-4px_12px_rgba(0,0,0,0.03)] select-none">
        {/* KEYPAD KALKULATOR HANYA MUNCUL DI METODE TUNAI */}
        {activeTab === 'TUNAI' && (
          <div className="space-y-1.5 mb-2">
            {/* 3 Shortcut Cepat: Uang Pas, 50.000, 100.000 */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleKeypadPress('UANG_PAS')}
                className="h-8.5 bg-slate-900 hover:bg-black active:bg-slate-800 text-white rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center"
              >
                Uang Pas
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('50000')}
                className="h-8.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-800 rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center"
              >
                50.000
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('100000')}
                className="h-8.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-800 rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center"
              >
                100.000
              </button>
            </div>

            {/* 4x4 Numeric Calculator Grid */}
            <div className="grid grid-cols-4 gap-1">
              {/* Baris 1: 1, 2, 3, + */}
              <button
                type="button"
                onClick={() => handleKeypadPress('1')}
                className="h-10 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg font-bold text-base text-slate-900 transition cursor-pointer flex items-center justify-center"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('2')}
                className="h-10 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg font-bold text-base text-slate-900 transition cursor-pointer flex items-center justify-center"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('3')}
                className="h-10 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg font-bold text-base text-slate-900 transition cursor-pointer flex items-center justify-center"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('+')}
                className="h-10 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg font-black text-lg transition cursor-pointer flex items-center justify-center"
                title="Tambah"
              >
                +
              </button>

              {/* Baris 2: 4, 5, 6, - */}
              <button
                type="button"
                onClick={() => handleKeypadPress('4')}
                className="h-10 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg font-bold text-base text-slate-900 transition cursor-pointer flex items-center justify-center"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('5')}
                className="h-10 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg font-bold text-base text-slate-900 transition cursor-pointer flex items-center justify-center"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('6')}
                className="h-10 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg font-bold text-base text-slate-900 transition cursor-pointer flex items-center justify-center"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('-')}
                className="h-10 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg font-black text-lg transition cursor-pointer flex items-center justify-center"
                title="Kurang"
              >
                -
              </button>

              {/* Baris 3: 7, 8, 9, Backspace */}
              <button
                type="button"
                onClick={() => handleKeypadPress('7')}
                className="h-10 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg font-bold text-base text-slate-900 transition cursor-pointer flex items-center justify-center"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('8')}
                className="h-10 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg font-bold text-base text-slate-900 transition cursor-pointer flex items-center justify-center"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('9')}
                className="h-10 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg font-bold text-base text-slate-900 transition cursor-pointer flex items-center justify-center"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('BACKSPACE')}
                className="h-10 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg font-bold text-slate-700 transition cursor-pointer flex items-center justify-center"
                title="Hapus Digit"
              >
                <Delete className="w-4 h-4" />
              </button>

              {/* Baris 4: 000, 0, C, = */}
              <button
                type="button"
                onClick={() => handleKeypadPress('000')}
                className="h-10 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg font-bold text-xs text-slate-900 transition cursor-pointer flex items-center justify-center"
              >
                000
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-10 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg font-bold text-base text-slate-900 transition cursor-pointer flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('CLEAR')}
                className="h-10 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg font-black text-sm transition cursor-pointer flex items-center justify-center"
                title="Reset"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('EQUAL')}
                className="h-10 bg-slate-900 hover:bg-black active:bg-slate-800 text-white rounded-lg font-black text-lg transition cursor-pointer flex items-center justify-center"
                title="Hitung"
              >
                =
              </button>
            </div>
          </div>
        )}

        {/* TOMBOL EKSEKUSI UTAMA (STICKY BOTTOM TEPAT DI BAWAH KEYPAD) */}
        <button
          type="button"
          disabled={
            isSubmitting ||
            (activeTab === 'TUNAI' && isCashInsufficient) ||
            (activeTab === 'KASBON' && !customerName.trim())
          }
          onClick={handleConfirmPayment}
          className="w-full h-11 bg-slate-900 hover:bg-black active:bg-slate-800 disabled:opacity-40 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
        >
          {isSubmitting ? (
            <span>Mencatat Transaksi...</span>
          ) : activeTab === 'TUNAI' && isCashInsufficient ? (
            <span>Uang Kurang {formatRupiah(finalTotal - cashReceived)}</span>
          ) : activeTab === 'KASBON' && !customerName.trim() ? (
            <span>Masukkan Nama Pelanggan</span>
          ) : (
            <span>Catat Transaksi • {formatRupiah(finalTotal)}</span>
          )}
        </button>
      </div>
    </div>
  );
};
