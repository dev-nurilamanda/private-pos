import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, Receipt, X, ArrowRight } from 'lucide-react';
import { db, type Transaction } from '../db/db';
import { settleUnpaidTransaction } from '../db/transactionService';
import { formatRupiah, formatDateTime } from '../utils/formatters';
import { useBackHandler } from '../context/NavigationContext';

export const OrdersAndDebts: React.FC = () => {
  const transactions = useLiveQuery(
    () => db.transactions.reverse().sortBy('date'),
    []
  ) || [];

  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || [];
  const [filter, setFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');

  // Settle modal state
  const [settleTxn, setSettleTxn] = useState<Transaction | null>(null);
  const [settleWalletId, setSettleWalletId] = useState('');
  const [settleMethod, setSettleMethod] = useState('CASH');
  const [isSettling, setIsSettling] = useState(false);

  // Navigasi Bertingkat: Tutup modal pelunasan piutang jika terbuka
  useBackHandler('orders-settle-modal', () => {
    setSettleTxn(null);
  }, !!settleTxn, 40);

  const unpaidCount = transactions.filter((t) => t.paymentStatus === 'UNPAID').length;
  const totalUnpaidNominal = transactions
    .filter((t) => t.paymentStatus === 'UNPAID')
    .reduce((sum, t) => sum + t.sellingPrice, 0);

  const filtered = transactions.filter((t) => {
    if (filter === 'UNPAID') return t.paymentStatus === 'UNPAID';
    if (filter === 'PAID') return t.paymentStatus === 'PAID';
    return true;
  });

  const handleOpenSettle = (txn: Transaction) => {
    setSettleTxn(txn);
    const defaultWallet = wallets.find((w) => w.category === 'CASH') || wallets[0];
    if (defaultWallet) setSettleWalletId(defaultWallet.id);
  };

  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTxn || !settleWalletId) return;

    setIsSettling(true);
    try {
      await settleUnpaidTransaction(settleTxn.id, settleWalletId, settleMethod);
      setSettleTxn(null);
    } catch (err) {
      console.error(err);
      alert('Gagal melunasi piutang.');
    } finally {
      setIsSettling(false);
    }
  };

  const totalSelling = transactions.reduce((sum, t) => sum + t.sellingPrice, 0);
  const totalProfit = transactions.reduce((sum, t) => sum + t.profit, 0);

  return (
    <div className="-mx-4 pb-20">
      {/* Kasbon Warning Banner jika ada kasbon aktif */}
      {unpaidCount > 0 && (
        <div className="px-4 py-3 bg-amber-50/90 border-b border-amber-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <div className="text-xs truncate">
              <span className="font-bold text-amber-900">
                {unpaidCount} Kasbon Belum Lunas
              </span>
              <span className="text-amber-700 font-semibold ml-1.5">
                • {formatRupiah(totalUnpaidNominal)}
              </span>
            </div>
          </div>
          {filter !== 'UNPAID' && (
            <button
              onClick={() => setFilter('UNPAID')}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-md text-[11px] font-bold cursor-pointer transition shrink-0"
            >
              Lihat Kasbon
            </button>
          )}
        </div>
      )}

      {/* 2. Filter Tabs (FLAT EDGE-TO-EDGE DENGAN LEBAR VERTIKAL NYAMAN) */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2.5">
        <button
          onClick={() => setFilter('ALL')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          Semua ({transactions.length})
        </button>

        <button
          onClick={() => setFilter('UNPAID')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
            filter === 'UNPAID'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Kasbon</span>
          {unpaidCount > 0 && (
            <span
              className={`px-1.5 py-0.5 text-[10px] rounded-full font-black ${
                filter === 'UNPAID' ? 'bg-white text-slate-900' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {unpaidCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setFilter('PAID')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
            filter === 'PAID'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          Lunas
        </button>
      </div>

      {/* 3. Transaction List (FLAT EDGE-TO-EDGE, LEBAR VERTIKAL LEGA) */}
      <div className="bg-white divide-y divide-slate-100 border-b border-slate-200">
        {filtered.length === 0 ? (
          <div className="py-24 px-4 text-center space-y-2">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-400">
              Tidak ada transaksi pada filter ini.
            </p>
          </div>
        ) : (
          filtered.map((t) => {
            const isUnpaid = t.paymentStatus === 'UNPAID';

            return (
              <div
                key={t.id}
                className="px-4 py-4.5 sm:py-5 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isUnpaid
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {isUnpaid ? 'Kasbon' : 'Lunas'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {formatDateTime(t.date)}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                    <span className="truncate">{t.productName}</span>
                    {t.quantity && t.quantity > 1 ? (
                      <span className="text-[10px] font-bold text-slate-500 shrink-0">
                        ({t.quantity}x)
                      </span>
                    ) : null}
                  </h4>

                  {t.customerTarget && (
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      Tujuan: <span className="font-semibold text-slate-700">{t.customerTarget}</span>
                    </p>
                  )}

                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>Modal: {formatRupiah(t.costPrice)}</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-semibold">Laba: +{formatRupiah(t.profit)}</span>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-2">
                  <div className="text-base font-extrabold text-slate-900 tracking-tight">
                    {formatRupiah(t.sellingPrice)}
                  </div>

                  {isUnpaid ? (
                    <button
                      onClick={() => handleOpenSettle(t)}
                      className="px-3.5 py-1.5 bg-slate-900 active:bg-black text-white font-bold rounded-lg text-xs cursor-pointer transition active:scale-95 shadow-2xs"
                    >
                      Lunasi
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium block">
                      {t.paymentMethod}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pelunasan Piutang Modal */}
      {settleTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Pelunasan Piutang</h3>
              <button
                onClick={() => setSettleTxn(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettle} className="p-5 space-y-4 text-xs text-slate-800">
              <div className="p-4 bg-slate-50 rounded-2xl space-y-1 border border-slate-200">
                <p className="text-slate-500 text-xs">Tagihan Barang:</p>
                <p className="font-bold text-slate-900 text-sm">{settleTxn.productName}</p>
                {settleTxn.customerTarget && (
                  <p className="text-slate-600 text-xs">Tujuan: {settleTxn.customerTarget}</p>
                )}
                <p className="text-lg font-black text-slate-900 pt-1">
                  {formatRupiah(settleTxn.sellingPrice)}
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                  Uang Masuk ke Kantong:
                </label>
                <select
                  value={settleWalletId}
                  onChange={(e) => setSettleWalletId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-medium text-xs cursor-pointer focus:border-slate-900"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRupiah(w.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                  Metode Penerimaan:
                </label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-medium text-xs cursor-pointer focus:border-slate-900"
                >
                  <option value="CASH">Uang Tunai</option>
                  <option value="TRANSFER">Transfer Bank</option>
                  <option value="QRIS">QRIS / E-Wallet</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettleTxn(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSettling}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black active:scale-95 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                >
                  {isSettling ? 'Memproses...' : 'Tandai Lunas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
