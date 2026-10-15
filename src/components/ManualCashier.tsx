import React, { useState } from 'react';
import { ArrowRight, RotateCcw, ShoppingBag, Plus } from 'lucide-react';
import { formatRupiah } from '../utils/formatters';

interface ManualCashierProps {
  onAddToCart: (item: {
    name: string;
    costPrice: number;
    sellingPrice: number;
    category: string;
  }) => void;
  onProceedDirect: (item: {
    name: string;
    costPrice: number;
    sellingPrice: number;
    category: string;
  }) => void;
}

export const ManualCashier: React.FC<ManualCashierProps> = ({
  onAddToCart,
  onProceedDirect,
}) => {
  const [name, setName] = useState('Transaksi Bebas');
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [category] = useState<string>('Transaksi Bebas');
  const [addedFeedback, setAddedFeedback] = useState(false);

  const addSelling = (amount: number) => {
    setSellingPrice((prev) => prev + amount);
  };

  const handleQuickPreset = (presetName: string, sell: number, cost: number) => {
    setName(presetName);
    setSellingPrice(sell);
    setCostPrice(cost);
  };

  const handleAddToCart = () => {
    if (sellingPrice <= 0) {
      alert('Masukkan harga jual terlebih dahulu.');
      return;
    }
    onAddToCart({
      name: name.trim() || 'Transaksi Bebas',
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice),
      category,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
    // Reset form for next item
    setName('Transaksi Bebas');
    setSellingPrice(0);
    setCostPrice(0);
  };

  const handlePayNow = (e: React.FormEvent) => {
    e.preventDefault();
    if (sellingPrice <= 0) {
      alert('Masukkan harga jual terlebih dahulu.');
      return;
    }
    onProceedDirect({
      name: name.trim() || 'Transaksi Bebas',
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice),
      category,
    });
  };

  const profit = Math.max(0, sellingPrice - costPrice);

  return (
    <div className="space-y-6 pt-2 pb-24">
      {/* Preset Cepat - Edge-to-Edge Scrollable */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { label: 'Tarik Tunai', sell: 105000, cost: 100000 },
          { label: 'Transfer Bank', sell: 55000, cost: 50000 },
          { label: 'Jasa Cetak / Foto', sell: 5000, cost: 1000 },
          { label: 'Pulsa Bebas', sell: 12000, cost: 10300 },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => handleQuickPreset(item.label, item.sell, item.cost)}
            className="px-4 py-2 bg-white border border-slate-300 active:bg-slate-100 rounded-xl text-slate-800 font-semibold text-xs whitespace-nowrap shadow-2xs cursor-pointer active:scale-95 transition"
          >
            {item.label}
          </button>
        ))}
      </div>

      {addedFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold text-center animate-in fade-in duration-100">
          ✓ Item manual berhasil ditambahkan ke keranjang!
        </div>
      )}

      {/* Form Tanpa Outer Card */}
      <form onSubmit={handlePayNow} className="space-y-5">
        {/* 1. Nama Transaksi */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Nama Transaksi / Item
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Transfer Bank, Jasa Cetak, Token Bebas"
            className="w-full h-13 bg-white border border-slate-300 rounded-2xl px-4 text-base font-semibold text-slate-900 focus:outline-none focus:border-slate-900 shadow-2xs placeholder:text-slate-400 placeholder:font-normal"
          />
        </div>

        {/* 2. Harga Jual Konsumen */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Harga Jual (Konsumen Bayar) <span className="text-rose-500">*</span>
            </label>
            {sellingPrice > 0 && (
              <button
                type="button"
                onClick={() => setSellingPrice(0)}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1 active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="relative">
            <span className="absolute left-4 top-3.5 text-slate-400 font-black text-xl pointer-events-none">
              Rp
            </span>
            <input
              type="number"
              min="1"
              required
              value={sellingPrice || ''}
              onChange={(e) => setSellingPrice(Number(e.target.value))}
              placeholder="0"
              className="w-full h-15 bg-white border border-slate-300 rounded-2xl pl-13 pr-4 text-2xl font-black text-slate-900 focus:outline-none focus:border-slate-900 shadow-2xs"
            />
          </div>

          {/* Tombol Cepat Tambah Nominal */}
          <div className="grid grid-cols-4 gap-2 mt-2.5">
            {[5000, 10000, 20000, 50000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => addSelling(amt)}
                className="h-11 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 active:scale-95 border border-slate-200/80 rounded-xl text-slate-800 text-sm font-bold transition cursor-pointer shadow-2xs flex items-center justify-center"
              >
                +{amt >= 1000 ? `${amt / 1000}k` : amt}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Harga Modal Terpotong */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Harga Modal (Terpotong dari Dompet Tunai)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-slate-400 font-black text-xl pointer-events-none">
              Rp
            </span>
            <input
              type="number"
              min="0"
              value={costPrice || ''}
              onChange={(e) => setCostPrice(Number(e.target.value))}
              placeholder="0"
              className="w-full h-15 bg-white border border-slate-300 rounded-2xl pl-13 pr-4 text-2xl font-black text-slate-800 focus:outline-none focus:border-slate-900 shadow-2xs"
            />
          </div>
        </div>

        {/* Estimasi Laba Bersih Banner */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-2xs">
          <span className="text-sm font-medium text-slate-600">Estimasi Laba Bersih:</span>
          <span className="text-lg font-black text-slate-900">
            +{formatRupiah(profit)}
          </span>
        </div>

        {/* Tombol Aksi Kasir: "+ Masukkan ke Keranjang" & "Bayar Langsung" */}
        <div className="pt-2 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={sellingPrice <= 0}
            onClick={handleAddToCart}
            className="h-14 bg-white border-2 border-slate-900 active:bg-slate-100 disabled:opacity-40 text-slate-900 font-bold rounded-2xl shadow-xs text-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Ke Keranjang</span>
          </button>

          <button
            type="submit"
            disabled={sellingPrice <= 0}
            className="h-14 bg-slate-900 hover:bg-black active:scale-[0.98] disabled:opacity-40 text-white font-bold rounded-2xl shadow-md text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>Bayar Langsung</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </form>
    </div>
  );
};
