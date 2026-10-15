import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  Coins,
  Building2,
  CreditCard,
  Clock,
  Smartphone,
  Wallet as WalletIcon,
  AlertCircle,
  CheckCircle2,
  Server,
  FileText,
  User,
  ChevronDown,
  Receipt,
  RotateCcw,
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
  // Navigasi Bertingkat: Jika tombol back fisik / browser ditekan di layar pembayaran, kembali ke keranjang
  useBackHandler('checkout-payment-screen', onBack, true, 35);

  // 1. Metode Pembayaran & Dompet Penerima (inWallet)
  const [method, setMethod] = useState<PaymentMethod>('CASH');

  // Cari dompet default berdasarkan kategori
  const defaultCashWallet = wallets.find((w) => w.category === 'CASH') || wallets[0];
  const defaultBankWallet = wallets.find((w) => w.category === 'BANK') || wallets[0];
  const defaultQrisWallet = wallets.find((w) => w.category === 'EWALLET') || wallets[0];

  const [selectedInWalletId, setSelectedInWalletId] = useState<string>(
    defaultCashWallet?.id || 'cash_main'
  );
  const [isCustomInWalletOpen, setIsCustomInWalletOpen] = useState(false);

  // 2. State Input Uang Tunai Diterima (Khusus Metode CASH)
  const [cashReceived, setCashReceived] = useState<number>(finalTotal);

  // 3. Info Pembeli & Catatan
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
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
    deductedModal: { walletName: string; cost: number; remaining: number }[];
  } | null>(null);

  // Navigasi Bertingkat saat modal struk sukses muncul (priority 50)
  useBackHandler(
    'payment-success-modal',
    () => {
      onClearCart();
      onBackToCashier();
    },
    !!completedSuccessData,
    50
  );

  // Switch dompet penerima saat metode diubah (jika belum di-custom)
  const handleSelectMethod = (newMethod: PaymentMethod) => {
    setMethod(newMethod);
    setErrorMessage(null);
    if (newMethod === 'CASH' && defaultCashWallet) {
      setSelectedInWalletId(defaultCashWallet.id);
    } else if (newMethod === 'TRANSFER' && defaultBankWallet) {
      setSelectedInWalletId(defaultBankWallet.id);
    } else if (newMethod === 'QRIS' && defaultQrisWallet) {
      setSelectedInWalletId(defaultQrisWallet.id);
    } else if (newMethod === 'HUTANG' && defaultCashWallet) {
      setSelectedInWalletId(defaultCashWallet.id);
    }
  };

  // Dompet penerima terpilih saat ini
  const activeInWallet = wallets.find((w) => w.id === selectedInWalletId);

  // Perhitungan Kembalian Uang Tunai
  const changeAmount = Math.max(0, cashReceived - finalTotal);
  const isCashInsufficient = method === 'CASH' && cashReceived < finalTotal;

  // Analisis Saldo Modal & Server Eksekutor (outWallet)
  const modalAnalysis = useMemo(() => {
    const totalCostAll = cart.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
    const estimatedProfit = finalTotal - totalCostAll;

    // Kelompokkan pemotongan modal berdasarkan outWalletId
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

    const hasAnyBalanceWarning = breakdown.some((b) => b.isBalanceLow);

    return {
      totalCostAll,
      estimatedProfit,
      breakdown,
      hasAnyBalanceWarning,
    };
  }, [cart, finalTotal, wallets]);

  // Tombol Cepat Pecahan Uang Tunai
  const quickCashOptions = useMemo(() => {
    const opts = new Set<number>();
    opts.add(finalTotal); // Uang Pas

    // Tambah kelipatan terdekat di atas finalTotal
    const standardDenominations = [
      10000, 20000, 50000, 100000, 150000, 200000, 300000, 500000,
    ];
    standardDenominations.forEach((val) => {
      if (val > finalTotal && opts.size < 4) {
        opts.add(val);
      }
    });

    // Bulatan ke atas 5.000 atau 10.000 terdekat
    const roundTo5k = Math.ceil(finalTotal / 5000) * 5000;
    if (roundTo5k > finalTotal) opts.add(roundTo5k);

    const roundTo10k = Math.ceil(finalTotal / 10000) * 10000;
    if (roundTo10k > finalTotal) opts.add(roundTo10k);

    const roundTo50k = Math.ceil(finalTotal / 50000) * 50000;
    if (roundTo50k > finalTotal) opts.add(roundTo50k);

    return Array.from(opts)
      .sort((a, b) => a - b)
      .slice(0, 5);
  }, [finalTotal]);

  // Eksekusi Konfirmasi Pembayaran
  const handleConfirmPayment = async () => {
    if (cart.length === 0) {
      setErrorMessage('Keranjang belanja kosong.');
      return;
    }

    if (method === 'CASH' && cashReceived < finalTotal) {
      setErrorMessage(
        `Uang tunai yang diterima masih kurang ${formatRupiah(finalTotal - cashReceived)}.`
      );
      return;
    }

    if (method === 'HUTANG' && !customerName.trim()) {
      setErrorMessage(
        'Untuk transaksi kasbon / hutang, Nama Pembeli / Pelanggan wajib diisi.'
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

      await executeCartTransaction({
        items: cart,
        inWalletId,
        paymentStatus: method === 'HUTANG' ? 'UNPAID' : 'PAID',
        paymentMethod: method,
        customerTarget: targetCustomer || undefined,
        cashReceived: method === 'CASH' ? cashReceived : finalTotal,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        discountName: selectedDiscount?.name,
        finalTotal,
        notes: notes.trim() || undefined,
      });

      // Siapkan data struk ringkas berhasil
      const deductedModalData = modalAnalysis.breakdown.map((b) => ({
        walletName: b.walletName,
        cost: b.cost,
        remaining: b.remainingBalance,
      }));

      setCompletedSuccessData({
        inWalletName: activeInWallet?.name || 'Kasir',
        totalPaid: finalTotal,
        cashReceived: method === 'CASH' ? cashReceived : undefined,
        changeAmount: method === 'CASH' ? changeAmount : undefined,
        method,
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

  // ==========================================
  // MODAL STRUK RINGKAS TRANSAKSI BERHASIL
  // ==========================================
  if (completedSuccessData) {
    return (
      <div className="-mx-4 min-h-[85vh] bg-slate-50 flex flex-col justify-between pb-10">
        <div className="bg-white px-4 pt-8 pb-6 border-b border-slate-200 text-center space-y-3">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              {completedSuccessData.method === 'HUTANG'
                ? 'Piutang Berhasil Dicatat!'
                : 'Pembayaran Sukses!'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transaksi kasir telah tersimpan & saldo dompet terupdate
            </p>
          </div>
          <div className="pt-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Pembayaran
            </span>
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {formatRupiah(completedSuccessData.totalPaid)}
            </span>
          </div>
        </div>

        {/* Rincian Struk */}
        <div className="px-4 py-4 space-y-3.5">
          {/* Rincian Uang & Kembalian (Jika Tunai) */}
          {completedSuccessData.method === 'CASH' && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Uang Tunai Diterima:</span>
                <span className="font-bold text-slate-800">
                  {formatRupiah(completedSuccessData.cashReceived || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                <span>Kembalian Kasir:</span>
                <span className="text-base font-black">
                  {formatRupiah(completedSuccessData.changeAmount || 0)}
                </span>
              </div>
            </div>
          )}

          {/* Rincian Akun Penerima (Modul Dompet Masuk) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <WalletIcon className="w-3.5 h-3.5" />
              <span>Akun Penerima (Modul Dompet)</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  {completedSuccessData.inWalletName}
                </span>
                <span className="text-xs text-slate-500">
                  Metode: {completedSuccessData.method}
                </span>
              </div>
              <span className="font-extrabold text-sm text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                +{formatRupiah(completedSuccessData.totalPaid)}
              </span>
            </div>
          </div>

          {/* Rincian Saldo Modal Terpotong */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Server className="w-3.5 h-3.5" />
              <span>Saldo Modal Terpotong</span>
            </div>
            <div className="divide-y divide-slate-100">
              {completedSuccessData.deductedModal.map((dm, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">
                      {dm.walletName}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Sisa saldo: {formatRupiah(dm.remaining)}
                    </span>
                  </div>
                  <span className="font-bold text-rose-600">
                    -{formatRupiah(dm.cost)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tombol Selesai & Kembali ke Kasir */}
        <div className="px-4 pt-2">
          <button
            type="button"
            onClick={() => {
              onSuccess(`Transaksi ${formatRupiah(finalTotal)} berhasil diselesaikan.`);
              onClearCart();
              onBackToCashier();
            }}
            className="w-full h-14 bg-slate-900 hover:bg-black active:scale-[0.99] text-white font-extrabold rounded-2xl shadow-md text-base flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Receipt className="w-5 h-5" />
            <span>Kembali ke Kasir</span>
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // TAMPILAN FULL LAYAR FITUR PEMBAYARAN
  // ==========================================
  return (
    <div className="-mx-4 pb-32 bg-slate-50/60 min-h-screen">
      {/* 1. Header Full Layar Pembayaran dengan Tombol Kembali */}
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
          <div>
            <h1 className="text-base font-extrabold text-slate-900 leading-tight">
              Pilih Pembayaran
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              {cart.length} jenis item • {cart.reduce((a, b) => a + b.quantity, 0)} total unit
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 bg-slate-900 text-white font-black text-xs rounded-xl shadow-2xs">
          {formatRupiah(finalTotal)}
        </span>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mx-4 mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-rose-700 animate-in fade-in duration-100">
          <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* 2. Kartu Ringkasan Tagihan yang Bersih & Proposional */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Ringkasan Tagihan</span>
            {selectedDiscount && (
              <span className="text-rose-600 font-bold normal-case">
                Diskon {selectedDiscount.name} Aktif
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Total Pembayaran</span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {formatRupiah(finalTotal)}
              </span>
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

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-0.5">
            <div>
              <span className="text-slate-400">Total Modal (Cost): </span>
              <strong className="text-slate-800">{formatRupiah(modalAnalysis.totalCostAll)}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Estimasi Laba: </span>
              <strong className="text-emerald-600">
                +{formatRupiah(modalAnalysis.estimatedProfit)}
              </strong>
            </div>
          </div>
        </div>

        {/* 3. METODE PEMBAYARAN & AKUN PENERIMA (MODUL DOMPET) */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <WalletIcon className="w-4 h-4 text-slate-700" />
              <span>Metode & Akun Penerima</span>
            </label>
            <span className="text-[11px] font-semibold text-slate-500">Modul Dompet</span>
          </div>

          {/* Grid 4 Opsi Pembayaran */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Opsi 1: Tunai / Cash */}
            <button
              type="button"
              onClick={() => handleSelectMethod('CASH')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                method === 'CASH'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 active:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Coins
                  className={`w-5 h-5 ${method === 'CASH' ? 'text-amber-300' : 'text-slate-600'}`}
                />
                {method === 'CASH' && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
              <div>
                <span className="font-bold text-sm block">Tunai (Cash)</span>
                <span
                  className={`text-[11px] font-medium ${
                    method === 'CASH' ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  Uang Laci Kasir
                </span>
              </div>
            </button>

            {/* Opsi 2: Transfer Bank */}
            <button
              type="button"
              onClick={() => handleSelectMethod('TRANSFER')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                method === 'TRANSFER'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 active:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Building2
                  className={`w-5 h-5 ${method === 'TRANSFER' ? 'text-blue-300' : 'text-slate-600'}`}
                />
                {method === 'TRANSFER' && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
              <div>
                <span className="font-bold text-sm block">Transfer Bank</span>
                <span
                  className={`text-[11px] font-medium ${
                    method === 'TRANSFER' ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  Rekening Toko
                </span>
              </div>
            </button>

            {/* Opsi 3: QRIS / E-Wallet */}
            <button
              type="button"
              onClick={() => handleSelectMethod('QRIS')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                method === 'QRIS'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 active:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <CreditCard
                  className={`w-5 h-5 ${method === 'QRIS' ? 'text-emerald-300' : 'text-slate-600'}`}
                />
                {method === 'QRIS' && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
              <div>
                <span className="font-bold text-sm block">QRIS / E-Wallet</span>
                <span
                  className={`text-[11px] font-medium ${
                    method === 'QRIS' ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  Kas Digital Toko
                </span>
              </div>
            </button>

            {/* Opsi 4: Kasbon / Hutang */}
            <button
              type="button"
              onClick={() => handleSelectMethod('HUTANG')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                method === 'HUTANG'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 active:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Clock
                  className={`w-5 h-5 ${method === 'HUTANG' ? 'text-white' : 'text-amber-600'}`}
                />
                {method === 'HUTANG' && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
              <div>
                <span className="font-bold text-sm block">Kasbon / Hutang</span>
                <span
                  className={`text-[11px] font-medium ${
                    method === 'HUTANG' ? 'text-amber-100' : 'text-amber-700'
                  }`}
                >
                  Bayar Nanti (Piutang)
                </span>
              </div>
            </button>
          </div>

          {/* Kotak Info Akun Dompet Penerima Terhubung */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {method === 'HUTANG' ? 'Tampungan Pelunasan Nanti:' : 'Uang Masuk ke Kantong:'}
              </span>
              <button
                type="button"
                onClick={() => setIsCustomInWalletOpen(!isCustomInWalletOpen)}
                className="text-xs font-bold text-slate-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ganti Kantong</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                  {activeInWallet?.category === 'BANK' ? (
                    <Building2 className="w-4 h-4" />
                  ) : activeInWallet?.category === 'EWALLET' ? (
                    <CreditCard className="w-4 h-4" />
                  ) : (
                    <Coins className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-xs block">
                    {activeInWallet?.name || 'Kas Tunai'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Saldo saat ini:{' '}
                    <strong className="text-slate-800">
                      {formatRupiah(activeInWallet?.currentBalance || 0)}
                    </strong>
                  </span>
                </div>
              </div>

              {method !== 'HUTANG' && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  +{formatRupiah(finalTotal)}
                </span>
              )}
            </div>

            {/* Dropdown Pemilihan Dompet Kustom */}
            {isCustomInWalletOpen && (
              <div className="pt-2 border-t border-slate-200 space-y-1.5 animate-in fade-in duration-100">
                <span className="text-[11px] font-bold text-slate-500 block">
                  Pilih Dari Daftar Dompet:
                </span>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {wallets.map((w) => (
                    <div
                      key={w.id}
                      onClick={() => {
                        setSelectedInWalletId(w.id);
                        setIsCustomInWalletOpen(false);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition ${
                        w.id === selectedInWalletId
                          ? 'bg-slate-900 text-white font-bold'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span>{w.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            w.id === selectedInWalletId
                              ? 'bg-slate-800 text-slate-300'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {w.category}
                        </span>
                      </div>
                      <span className="font-semibold shrink-0 pl-2">
                        {formatRupiah(w.currentBalance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Pembayaran Tunai (Kalkulator Uang Diterima & Kembalian) */}
          {method === 'CASH' && (
            <div className="space-y-3 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Uang Diterima Konsumen
                </label>
                <button
                  type="button"
                  onClick={() => setCashReceived(finalTotal)}
                  className="text-xs font-bold text-slate-700 hover:text-black flex items-center gap-1 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Uang Pas</span>
                </button>
              </div>

              {/* Input Nominal Diterima */}
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-400 font-black text-xl pointer-events-none">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  value={cashReceived || ''}
                  onChange={(e) => setCashReceived(Number(e.target.value))}
                  placeholder="0"
                  className="w-full h-14 bg-white border border-slate-300 rounded-2xl pl-13 pr-4 text-2xl font-black text-slate-900 focus:outline-none focus:border-slate-900 shadow-2xs"
                />
              </div>

              {/* Tombol Pecahan Cepat */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {quickCashOptions.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCashReceived(amt)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap active:scale-95 shadow-2xs ${
                      cashReceived === amt
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {amt === finalTotal ? 'Uang Pas' : formatRupiah(amt)}
                  </button>
                ))}
              </div>

              {/* Bar Kembalian Kasir */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                  isCashInsufficient
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div>
                  <span className="text-xs font-semibold block">
                    {isCashInsufficient ? 'Uang Pembayaran Kurang:' : 'Kembalian Konsumen:'}
                  </span>
                  <span className="text-xl font-black tracking-tight">
                    {isCashInsufficient
                      ? formatRupiah(finalTotal - cashReceived)
                      : formatRupiah(changeAmount)}
                  </span>
                </div>
                {!isCashInsufficient && (
                  <span className="px-2.5 py-1 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-2xs">
                    ✓ Lunas
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Form Khusus Hutang / Kasbon */}
          {method === 'HUTANG' && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>Transaksi Belum Lunas (Piutang)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Uang masuk belum diterima di kasir. Saldo modal akan tetap terpotong secara otomatis
                dari dompet server/modal yang bersangkutan.
              </p>
            </div>
          )}
        </div>

        {/* 4. HUBUNGAN KE MODUL DOMPET & SALDO MODAL (OUT-WALLET) */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Server className="w-4 h-4 text-slate-700" />
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Rincian Saldo Modal & Server
              </label>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {modalAnalysis.breakdown.length} Dompet Modal
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Transaksi ini memotong saldo modal secara atomik dari kantong dompet server/modal berikut:
          </p>

          {/* Daftar Dompet Modal yang Terpotong */}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {modalAnalysis.breakdown.map((b) => (
              <div key={b.walletId} className="p-3 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">
                        {b.walletName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {b.items.map((it) => `${it.name} (${it.qty}x)`).join(', ')}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-rose-600 text-xs block">
                      -{formatRupiah(b.cost)}
                    </span>
                    <span className="text-[10px] text-slate-400">Modal Terpotong</span>
                  </div>
                </div>

                {/* Perbandingan Saldo Sebelum -> Sesudah */}
                <div className="pt-1 flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                  <span className="text-slate-500">
                    Saldo Saat Ini: <strong>{formatRupiah(b.currentBalance)}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">➔</span>
                    <span
                      className={`font-bold ${
                        b.isBalanceLow ? 'text-amber-700' : 'text-slate-800'
                      }`}
                    >
                      Sisa: {formatRupiah(b.remainingBalance)}
                    </span>
                  </div>
                </div>

                {b.isBalanceLow && (
                  <div className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>Perhatian: Saldo modal di dompet ini kurang dari biaya transaksi.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 5. DATA PELANGGAN & CATATAN OPSIONAL */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <User className="w-4 h-4 text-slate-700" />
            <span>
              Pelanggan & Catatan{' '}
              {method === 'HUTANG' ? (
                <span className="text-rose-600 font-extrabold">*Wajib</span>
              ) : (
                <span className="text-slate-400 font-normal">(Opsional)</span>
              )}
            </span>
          </label>

          <div className="space-y-2.5">
            <div>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={
                  method === 'HUTANG'
                    ? 'Nama Pelanggan / Pengutang (Wajib) *'
                    : 'Nama Pelanggan / ID Target (Opsional)'
                }
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-2xs"
              />
            </div>

            <div>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Nomor HP / WhatsApp (Opsional)"
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-2xs"
              />
            </div>

            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan Transaksi Kasir (Opsional)"
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-2xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 6. FLOATING ACTION BAR: KONFIRMASI PEMBAYARAN */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl">
        <div className="w-full max-w-4xl mx-auto px-4 py-3">
          <button
            type="button"
            disabled={isSubmitting || (method === 'CASH' && isCashInsufficient)}
            onClick={handleConfirmPayment}
            className={`w-full h-14 text-white font-extrabold rounded-2xl shadow-md text-base flex items-center justify-center gap-2.5 transition cursor-pointer active:scale-[0.99] disabled:opacity-40 ${
              method === 'HUTANG'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-slate-900 hover:bg-black'
            }`}
          >
            {isSubmitting ? (
              <span>Memproses Pembayaran...</span>
            ) : method === 'HUTANG' ? (
              <span>Simpan Sebagai Piutang • {formatRupiah(finalTotal)}</span>
            ) : (
              <span>Konfirmasi Pembayaran • {formatRupiah(finalTotal)}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
