import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Percent,
  Plus,
  Trash2,
  Edit2,
  X,
  Tag,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import {
  db,
  seedDefaultDiscounts,
  type Discount,
  type DiscountType,
  getDiscountDailyStatus,
} from '../db/db';
import { formatRupiah } from '../utils/formatters';
import { useBackHandler } from '../context/NavigationContext';

interface DiscountManagementProps {
  onBackToCashier?: () => void;
}

export const DiscountManagement: React.FC<DiscountManagementProps> = ({
  onBackToCashier,
}) => {
  const discounts = useLiveQuery(() => db.discounts.toArray(), []) || [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);

  // Navigasi Bertingkat: Tutup modal diskon jika terbuka
  useBackHandler('discount-modal', () => {
    setIsModalOpen(false);
    setEditingDiscount(null);
  }, isModalOpen, 40);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<DiscountType>('PERCENT');
  const [value, setValue] = useState<number>(5);
  const [minPurchase, setMinPurchase] = useState<number>(0);
  const [dailyLimit, setDailyLimit] = useState<number>(0);
  const [maxQtyPerItem, setMaxQtyPerItem] = useState<number>(0);
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
    setDailyLimit(0);
    setMaxQtyPerItem(0);
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
    setDailyLimit(d.dailyLimit || 0);
    setMaxQtyPerItem(d.maxQtyPerItem || 0);
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
          dailyLimit: dailyLimit > 0 ? dailyLimit : undefined,
          maxQtyPerItem: maxQtyPerItem > 0 ? maxQtyPerItem : undefined,
          isActive,
        });
      } else {
        await db.discounts.add({
          name: name.trim(),
          type,
          value,
          minPurchase: minPurchase > 0 ? minPurchase : undefined,
          dailyLimit: dailyLimit > 0 ? dailyLimit : undefined,
          usedToday: 0,
          lastUsedDate: new Date().toISOString().slice(0, 10),
          maxQtyPerItem: maxQtyPerItem > 0 ? maxQtyPerItem : undefined,
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

  const handleResetDailyQuota = async (d: Discount) => {
    if (!d.id) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    await db.discounts.update(d.id, {
      usedToday: 0,
      lastUsedDate: todayStr,
    });
  };

  const activeCount = discounts.filter((d) => d.isActive).length;
  const percentCount = discounts.filter((d) => d.type === 'PERCENT').length;
  const fixedCount = discounts.filter((d) => d.type === 'FIXED').length;

  return (
    <div className="-mx-4 pb-28">
      {/* 1. Header Toolbar Flat (Bersih dengan Lebar Vertikal Nyaman) */}
      <div className="px-4 py-4.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-bold text-slate-900">Kelola Diskon & Promo</h2>
          <p className="text-xs text-slate-500">
            {discounts.length} promo total • {activeCount} aktif
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4 stroke-[2.2]" />
          <span>Tambah Promo</span>
        </button>
      </div>

      {/* 2. Daftar Diskon (Flat List dengan Lebar Vertikal Lega) */}
      <div className="bg-white divide-y divide-slate-100 border-b border-slate-200">
        {discounts.length === 0 ? (
          <div className="py-24 px-4 text-center space-y-3">
            <Tag className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-400">
              Belum ada diskon yang dibuat.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold active:scale-95 transition"
            >
              + Tambah Diskon Baru
            </button>
          </div>
        ) : (
          discounts.map((d) => {
            const dailyStatus = getDiscountDailyStatus(d);

            return (
              <div
                key={d.id}
                className={`px-4 py-4.5 sm:py-5 flex items-center justify-between gap-3.5 transition-colors ${
                  d.isActive ? 'hover:bg-slate-50/60' : 'opacity-60 bg-slate-50/40'
                }`}
              >
                {/* Kiri: Avatar Flat Minimal & Info Diskon */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-1">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-xs bg-slate-100 text-slate-800">
                    {d.type === 'PERCENT' ? `${d.value}%` : <Tag className="w-4.5 h-4.5 text-slate-700" />}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm truncate">
                        {d.name}
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                          d.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {d.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate flex-wrap">
                      <span className="font-bold text-slate-800">
                        {d.type === 'PERCENT'
                          ? `Potongan ${d.value}%`
                          : `Potongan ${formatRupiah(d.value)}`}
                      </span>

                      {d.minPurchase && d.minPurchase > 0 && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 truncate">Min. {formatRupiah(d.minPurchase)}</span>
                        </>
                      )}

                      {d.dailyLimit && d.dailyLimit > 0 && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 truncate">
                            Limit {d.dailyLimit}x/hari (Sisa {dailyStatus.remainingToday})
                          </span>
                        </>
                      )}

                      {d.maxQtyPerItem && d.maxQtyPerItem > 0 && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 truncate">Maks. {d.maxQtyPerItem} unit</span>
                        </>
                      )}
                    </div>

                    {/* Tombol reset kuota jika terpakai */}
                    {d.dailyLimit && dailyStatus.usedToday > 0 && (
                      <button
                        type="button"
                        onClick={() => handleResetDailyQuota(d)}
                        className="text-[11px] font-medium text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset kuota hari ini ({dailyStatus.usedToday}x terpakai)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Kanan: Flat Toggle Switch & Aksi Edit/Delete */}
                <div className="flex items-center gap-2.5 shrink-0">
                  {/* Flat Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(d)}
                    className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                      d.isActive ? 'bg-slate-900' : 'bg-slate-200'
                    }`}
                    title={d.isActive ? 'Nonaktifkan Diskon' : 'Aktifkan Diskon'}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-2xs transition-transform ${
                        d.isActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => openEditModal(d)}
                    className="p-2 text-slate-400 hover:text-slate-700 active:bg-slate-100 rounded-xl transition cursor-pointer"
                    title="Edit Diskon"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => d.id && handleDelete(d.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 active:bg-rose-50 rounded-xl transition cursor-pointer"
                    title="Hapus Diskon"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Modal Tambah / Edit Diskon (Flat Style) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-100">
            {/* Header Modal */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                {editingDiscount ? 'Edit Diskon' : 'Tambah Diskon Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-4 space-y-3.5">
              {error && (
                <div className="p-2.5 bg-rose-50 rounded-lg flex items-center gap-2 text-xs font-medium text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Nama Diskon */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Diskon <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Diskon Pelanggan Setia"
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                />
              </div>

              {/* Tipe Diskon */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Tipe Diskon <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType('PERCENT');
                      if (value > 100) setValue(10);
                    }}
                    className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      type === 'PERCENT'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>Persentase (%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('FIXED')}
                    className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      type === 'FIXED'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Nominal (Rp)</span>
                  </button>
                </div>
              </div>

              {/* Nilai Diskon */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {type === 'PERCENT' ? 'Besaran Diskon (%)' : 'Besaran Diskon (Rp)'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">
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
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Minimal Pembelian (Opsional) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Minimal Pembelian (Opsional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={minPurchase || ''}
                    onChange={(e) => setMinPurchase(Number(e.target.value) || 0)}
                    placeholder="0 = tanpa minimal"
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Limit Pemakaian Harian */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Limit Pemakaian Harian (Opsional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={dailyLimit || ''}
                  onChange={(e) => setDailyLimit(Number(e.target.value) || 0)}
                  placeholder="Misal: 10 (0 = kuota bebas tanpa batas)"
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                />
              </div>

              {/* Limit Kuantitas Unit */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Limit Maks. Unit Per Transaksi (Opsional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={maxQtyPerItem || ''}
                  onChange={(e) => setMaxQtyPerItem(Number(e.target.value) || 0)}
                  placeholder="Misal: 2 (0 = seluruh unit didiskon)"
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                />
              </div>

              {/* Status Aktif */}
              <div className="pt-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Status Diskon Aktif</span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                    isActive ? 'bg-slate-900' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full transition-transform ${
                      isActive ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Tombol Simpan */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg transition cursor-pointer"
                >
                  {editingDiscount ? 'Simpan Perubahan' : 'Buat Diskon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
