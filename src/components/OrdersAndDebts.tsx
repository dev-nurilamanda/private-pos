import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, Receipt, X, ArrowRight } from 'lucide-react';
import { db, type Transaction } from '../db/db';
import { settleUnpaidTransaction } from '../db/transactionService';
import { formatRupiah, formatDateTime } from '../utils/formatters';

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

  return (
    <div className="-mx-4 pb-20">
      {/* Piutang Warning Banner (Lega & Edge-to-Edge jika ada) */}
      {unpaidCount > 0 && (
        <div className="px-4 py-3.5 bg-amber-50/80 border-b border-amber-200/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <span className="text-xs font-bold text-amber-950 block">
                {unpaidCount} Tagihan Belum Lunas
              </span>
              <span className="text-xs text-amber-800">
                Total piutang: <strong>{formatRupiah(totalUnpaidNominal)}</strong>
              </span>
            </div>
          </div>
          <button
            onClick={() => setFilter('UNPAID')}
            className="px-3 py-1.5 bg-slate-900 active:bg-black text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
          >
            Lihat
          </button>
        </div>
      )}

      {/* Filter Tabs - Clean Horizontal Bar (Edge-to-Edge dengan px-4) */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-200'
          }`}
        >
          Semua ({transactions.length})
        </button>

        <button
          onClick={() => setFilter('UNPAID')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${
            filter === 'UNPAID'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-200'
          }`}
        >
          <span>Piutang</span>
          {unpaidCount > 0 && (
            <span
              className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                filter === 'UNPAID' ? 'bg-white text-slate-900' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {unpaidCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setFilter('PAID')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
            filter === 'PAID'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-200'
          }`}
        >
          Lunas
        </button>
      </div>

      {/* Transaction List (Edge-to-Edge) OR Clean Empty State */}
      {filtered.length === 0 ? (
        <div className="py-24 px-6 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Receipt className="w-7 h-7 stroke-[1.5]" />
          </div>
          <p className="text-sm font-medium text-slate-500">
            Belum ada transaksi hari ini
          </p>
        </div>
      ) : (
        <div className="bg-white divide-y divide-slate-100 border-t border-b border-slate-100">
          {filtered.map((t) => {
            const isUnpaid = t.paymentStatus === 'UNPAID';

            return (
              <div
                key={t.id}
                className="px-4 py-4.5 sm:py-5 hover:bg-slate-50 active:bg-slate-100/80 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                        isUnpaid
                          ? 'bg-slate-100 text-slate-900 border border-slate-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isUnpaid ? 'BELUM LUNAS' : 'LUNAS'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {formatDateTime(t.date)}
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-900 text-base truncate flex items-center gap-1.5">
                    <span className="truncate">{t.productName}</span>
                    {t.quantity && t.quantity > 1 ? (
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                        {t.quantity}x
                      </span>
                    ) : null}
                  </h4>

                  {t.customerTarget && (
                    <p className="text-sm text-slate-600 font-medium truncate">
                      Tujuan: <span className="font-semibold text-slate-800">{t.customerTarget}</span>
                    </p>
                  )}

                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>Modal: {formatRupiah(t.costPrice)}</span>
                    <span>•</span>
                    <span className="text-slate-800 font-medium">Laba: +{formatRupiah(t.profit)}</span>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-2">
                  <div className="text-base font-bold text-slate-900 tracking-tight">
                    {formatRupiah(t.sellingPrice)}
                  </div>

                  {isUnpaid ? (
                    <button
                      onClick={() => handleOpenSettle(t)}
                      className="px-4 py-1.5 bg-slate-900 active:bg-black text-white font-bold rounded-xl text-xs shadow-2xs cursor-pointer transition active:scale-95"
                    >
                      Lunasi
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium block">
                      {t.paymentMethod}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
