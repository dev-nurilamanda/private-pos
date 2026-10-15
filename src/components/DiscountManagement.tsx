import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Percent,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Tag,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { db, seedDefaultDiscounts, type Discount, type DiscountType } from '../db/db';
import { formatRupiah } from '../utils/formatters';

interface DiscountManagementProps {
  onBackToCashier?: () => void;
}

export const DiscountManagement: React.FC<DiscountManagementProps> = ({
  onBackToCashier,
}) => {
  const discounts = useLiveQuery(() => db.discounts.toArray(), []) || [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<DiscountType>('PERCENT');
  const [value, setValue] = useState<number>(5);
  const [minPurchase, setMinPurchase] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    seedDefaultDiscounts().catch(console.error);
  }, []);

  const openCreateModal = () => {
    setEditingDiscount(null);
    setName('');
    setType('PERCENT');
    setValue(5);
    setMinPurchase(0);
    setIsActive(true);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (d: Discount) => {
    setEditingDiscount(d);
    setName(d.name);
    setType(d.type);
    setValue(d.value);
    setMinPurchase(d.minPurchase || 0);
    setIsActive(d.isActive);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama diskon wajib diisi.');
      return;
    }
    if (value <= 0) {
      setError('Nilai diskon harus lebih dari 0.');
      return;
    }
    if (type === 'PERCENT' && value > 100) {
      setError('Diskon persentase maksimal 100%.');
      return;
    }

    try {
      if (editingDiscount?.id) {
        await db.discounts.update(editingDiscount.id, {
          name: name.trim(),
          type,
          value,
          minPurchase: minPurchase > 0 ? minPurchase : undefined,
          isActive,
        });
      } else {
        await db.discounts.add({
          name: name.trim(),
          type,
          value,
          minPurchase: minPurchase > 0 ? minPurchase : undefined,
          isActive,
          createdAt: new Date().toISOString(),
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      setError('Gagal menyimpan diskon.');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Hapus diskon ini?')) {
      await db.discounts.delete(id);
    }
  };

  const handleToggleActive = async (d: Discount) => {
    if (!d.id) return;
    await db.discounts.update(d.id, { isActive: !d.isActive });
  };

  return (
    <div className="-mx-4 pb-28">
      {/* 1. Header Toolbar (Edge-to-Edge Bar) */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onBackToCashier && (
            <button
              onClick={onBackToCashier}
              className="p-1.5 -ml-1 text-slate-700 hover:text-black active:bg-slate-100 rounded-lg transition"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-base font-extrabold text-slate-900 leading-tight">
              Daftar Diskon
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {discounts.length} promo & diskon tersedia
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="px-3.5 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Tambah Diskon</span>
        </button>
      </div>

      {/* 2. Daftar Diskon (Flat List, Tanpa Container Box) */}
      <div className="bg-white divide-y divide-slate-100 border-b border-slate-200">
        {discounts.length === 0 ? (
          <div className="py-20 px-4 text-center space-y-3">
            <Tag className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-500 font-medium">
              Belum ada diskon yang dibuat.
            </p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition"
            >
              + Tambah Diskon Baru
            </button>
          </div>
        ) : (
          discounts.map((d) => (
            <div
              key={d.id}
              className={`px-4 py-4 sm:py-5 flex items-center justify-between gap-3 transition-colors ${
                d.isActive ? 'hover:bg-slate-50/70' : 'bg-slate-50/50 opacity-60'
              }`}
            >
              {/* Kiri: Avatar Ikon & Info Diskon */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-sm shadow-2xs border ${
                    d.type === 'PERCENT'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}
                >
                  {d.type === 'PERCENT' ? `${d.value}%` : <Tag className="w-5 h-5" />}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-900 text-base leading-snug">
                      {d.name}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        d.isActive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {d.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">
                      {d.type === 'PERCENT'
                        ? `Potongan ${d.value}%`
                        : `Potongan ${formatRupiah(d.value)}`}
                    </span>
                    {d.minPurchase && d.minPurchase > 0 && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>Min. Belanja {formatRupiah(d.minPurchase)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Kanan: Aksi Toggle Aktif, Edit & Hapus */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleActive(d)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    d.isActive
                      ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                  }`}
                  title={d.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                >
                  {d.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </button>

                <button
                  type="button"
                  onClick={() => openEditModal(d)}
                  className="p-2 text-slate-600 hover:text-black active:bg-slate-100 rounded-lg transition cursor-pointer"
                  title="Edit Diskon"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => d.id && handleDelete(d.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 active:bg-rose-50 rounded-lg transition cursor-pointer"
                  title="Hapus Diskon"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Modal Tambah / Edit Diskon */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingDiscount ? 'Edit Diskon' : 'Tambah Diskon Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Nama Diskon */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Nama Diskon <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Diskon Pelanggan Setia"
                  className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                />
              </div>

              {/* Tipe Diskon: Persentase (%) atau Nominal Tetap (Rp) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Tipe Diskon <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType('PERCENT');
                      if (value > 100) setValue(10);
                    }}
                    className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      type === 'PERCENT'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Percent className="w-4 h-4" />
                    <span>Persentase (%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('FIXED')}
                    className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      type === 'FIXED'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                    <span>Nominal (Rp)</span>
                  </button>
                </div>
              </div>

              {/* Nilai Diskon */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {type === 'PERCENT' ? 'Besaran Diskon (%)' : 'Besaran Diskon (Rp)'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">
                    {type === 'PERCENT' ? '%' : 'Rp'}
                  </span>
                  <input
                    type="number"
                    required
                    min="1"
                    max={type === 'PERCENT' ? 100 : undefined}
                    value={value || ''}
                    onChange={(e) => setValue(Number(e.target.value) || 0)}
                    placeholder={type === 'PERCENT' ? '10' : '5000'}
                    className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 text-sm font-extrabold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Minimal Pembelian (Opsional) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Minimal Pembelian (Opsional)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">
                    Rp
                  </span>
                  <input
                    type="number"
                    value={minPurchase || ''}
                    onChange={(e) => setMinPurchase(Number(e.target.value) || 0)}
                    placeholder="0 (Tanpa Minimal)"
                    className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 text-sm font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Toggle Status Aktif */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-700">Status Langsung Aktif</span>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 accent-slate-900 rounded cursor-pointer"
                />
              </div>

              {/* Tombol Simpan */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
                >
                  {editingDiscount ? 'Perbarui Diskon' : 'Simpan Diskon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
