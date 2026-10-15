import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Minus, SlidersHorizontal, PlusCircle, Check, X, Layers, Package } from 'lucide-react';
import { db, seedDefaultProducts, type Product } from '../db/db';
import { type CartItem } from '../db/transactionService';
import { formatRupiah } from '../utils/formatters';

interface CashierCatalogProps {
  searchQuery: string;
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onUpdateCartQuantity: (cartItemId: string, newQty: number) => void;
  onOpenCreateModal: () => void;
  onOpenProductManagement?: () => void;
}

/**
 * Inisial avatar netral (2-3 huruf)
 */
function getProductInitials(product: Product): string {
  const name = product.name.toUpperCase().trim();
  if (name.includes('PLN') || name.includes('TOKEN')) return 'PLN';
  if (name.includes('TELKOMSEL') || name.includes('TSL') || name.includes('DIGIPOS')) return 'TSL';
  if (name.includes('INDOSAT') || name.includes('ISAT')) return 'ISAT';
  if (name.includes('AXIS')) return 'AXS';
  if (name.includes('SMARTFREN')) return 'SMF';
  if (name.includes('DANA')) return 'DANA';
  if (name.includes('BY.U')) return 'BYU';
  if (name.includes('PERDANA')) return 'SIM';
  if (name.includes('WEKIOS')) return 'WKS';

  const words = name.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
}

export const CashierCatalog: React.FC<CashierCatalogProps> = ({
  searchQuery,
  cart,
  onAddToCart,
  onUpdateCartQuantity,
  onOpenCreateModal,
  onOpenProductManagement,
}) => {
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  React.useEffect(() => {
    seedDefaultProducts().catch(console.error);
  }, []);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedDefaultProducts();
    } finally {
      setIsSeeding(false);
    }
  };

  // Daftar channel unik untuk filter
  const channels = Array.from(
    new Set(
      products.map((p) => (p.serverChannel || p.category || 'Toko Fisik').trim()).filter(Boolean)
    )
  ).sort();

  // Filter produk berdasarkan Channel dan Search
  const filteredProducts = products.filter((p) => {
    const channelName = p.serverChannel || p.category || 'Toko Fisik';
    const matchesChannel = selectedChannel === 'ALL' || channelName === selectedChannel;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChannel && matchesSearch;
  });

  return (
    <div className={`space-y-4 pt-3 ${cart.length > 0 ? 'pb-32' : 'pb-24'}`}>
      {/* Filter Bar Sederhana: Dropdown Server Eksekutor & Total Counter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsFilterSheetOpen(true)}
          className="flex-1 h-11 px-4 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-between active:bg-slate-50 transition cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-2 truncate">
            <Layers className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate">
              Server: {selectedChannel === 'ALL' ? 'Semua Server / Toko' : selectedChannel}
            </span>
          </div>
          <span className="text-slate-400 text-xs ml-2">Ganti ▼</span>
        </button>

        <button
          onClick={() => setIsFilterSheetOpen(true)}
          className="p-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:text-slate-900 active:bg-slate-100 active:scale-95 transition cursor-pointer shadow-2xs"
          title="Filter Server / Eksekutor"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* List Produk Lega */}
      {filteredProducts.length === 0 ? (
        <div className="py-16 px-6 text-center space-y-3.5">
          <p className="text-sm text-slate-500">
            {searchQuery
              ? `Tidak ada produk dengan kata kunci "${searchQuery}"`
              : `Belum ada produk di server "${selectedChannel}".`}
          </p>
          <div className="flex justify-center gap-2">
            {selectedChannel !== 'ALL' && (
              <button
                onClick={() => setSelectedChannel('ALL')}
                className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
              >
                Tampilkan Semua Server
              </button>
            )}
            {products.length === 0 && (
              <button
                onClick={handleSeed}
                disabled={isSeeding}
                className="px-5 py-2.5 bg-slate-900 active:bg-slate-800 text-white rounded-xl text-sm font-bold cursor-pointer transition shadow-xs"
              >
                Muat Katalog Bawaan (Server Pulsa, Token, Perdana)
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white divide-y divide-slate-100">
          {filteredProducts.map((product) => {
            const initials = getProductInitials(product);
            const isPhysical = Boolean(product.isPhysical ?? product.trackStock);
            const isOutOfStock = isPhysical && product.stock <= 0;
            const server = product.serverChannel || product.category;
            const category = product.category;

            // Cek apakah item ini sudah ada di keranjang
            const cartItem = cart.find((item) => item.productId === product.id);
            const inCart = Boolean(cartItem);
            const isMaxStock = (isPhysical && cartItem && cartItem.quantity >= product.stock) || (!isPhysical && inCart);

            return (
              <div
                key={product.id}
                onClick={() => {
                  if (isOutOfStock) return;
                  if (cartItem) {
                    if (!isMaxStock) {
                      onUpdateCartQuantity(cartItem.id, cartItem.quantity + 1);
                    }
                  } else {
                    onAddToCart(product);
                  }
                }}
                className={`flex items-center justify-between px-4 py-4.5 sm:py-5 transition-colors duration-75 cursor-pointer touch-manipulation border-b border-slate-100 last:border-b-0 ${
                  inCart ? 'bg-slate-50/90 border-l-4 border-l-slate-900 pl-3' : 'bg-white hover:bg-slate-50 active:bg-slate-100/90'
                }`}
              >
                {/* Kiri: Kotak Avatar Inisial 56x56px */}
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200/90 text-slate-700 font-bold text-base flex items-center justify-center shrink-0 tracking-wider shadow-2xs">
                    {initials}
                  </div>

                  {/* Tengah: Nama Produk & Subteks Server & Kategori */}
                  <div className="min-w-0 space-y-1">
                    <h4 className="font-semibold text-slate-900 text-base truncate leading-snug">
                      {product.name}
                    </h4>

                    {/* Subteks: Harga Jual • Server • Kategori • Info Stok */}
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-black text-slate-900 tracking-tight text-base">
                        {formatRupiah(product.sellingPrice)}
                      </span>
                      <span className="text-slate-300">•</span>
                      <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[11px] border border-slate-200">
                          {server}
                        </span>
                        {category && category !== server && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 font-medium text-[11px] border border-slate-200">
                            {category}
                          </span>
                        )}
                        {isPhysical ? (
                          <span
                            className={
                              isOutOfStock
                                ? 'text-rose-600 font-bold text-xs'
                                : 'text-slate-500 font-medium text-xs'
                            }
                          >
                            • {isOutOfStock ? 'Stok Habis' : `Stok: ${product.stock}`}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal text-xs">
                            • Modal {formatRupiah(product.costPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kanan: Kontrol Keranjang (Stepper jika ada di keranjang, (+) jika belum) */}
                <div className="shrink-0 pl-1" onClick={(e) => e.stopPropagation()}>
                  {isOutOfStock ? (
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-xl border border-rose-200">
                      Habis
                    </span>
                  ) : inCart && cartItem ? (
                    <div className="flex items-center bg-slate-900 text-white rounded-full p-1 shadow-xs">
                      <button
                        type="button"
                        onClick={() => onUpdateCartQuantity(cartItem.id, cartItem.quantity - 1)}
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-90 flex items-center justify-center transition cursor-pointer"
                        title="Kurangi Qty"
                      >
                        <Minus className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                      </button>

                      <span className="w-7 text-center font-black text-xs text-white select-none">
                        {cartItem.quantity}
                      </span>

                      <button
                        type="button"
                        disabled={isMaxStock}
                        onClick={() => onUpdateCartQuantity(cartItem.id, cartItem.quantity + 1)}
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-90 disabled:opacity-30 flex items-center justify-center transition cursor-pointer"
                        title={isMaxStock ? (!isPhysical ? 'Produk server/digital max 1' : 'Batas stok tercapai') : 'Tambah Qty'}
                      >
                        <Plus className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddToCart(product)}
                      className="w-11 h-11 rounded-full bg-white border border-slate-300 text-slate-800 flex items-center justify-center active:bg-slate-100 active:scale-95 transition-all duration-75 cursor-pointer shadow-2xs hover:border-slate-400"
                      title="Tambah ke Keranjang"
                    >
                      <Plus className="w-5 h-5 stroke-[2.4]" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tombol Aksi Bawah: "+ Buat Produk Baru" & "Kelola Produk" */}
      <div className="px-4 pt-5 grid grid-cols-2 gap-2.5">
        <button
          onClick={onOpenCreateModal}
          className="h-12 bg-white border border-slate-300 hover:border-slate-400 active:bg-slate-100 text-slate-900 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          <PlusCircle className="w-4 h-4 text-slate-700" />
          <span>+ Buat Produk</span>
        </button>

        {onOpenProductManagement && (
          <button
            onClick={onOpenProductManagement}
            className="h-12 bg-slate-900 hover:bg-black active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <Package className="w-4 h-4 text-white" />
            <span>Manajemen Produk</span>
          </button>
        )}
      </div>

      {/* Bottom Sheet Filter Channel / Sumber Eksekusi */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-6 duration-150 flex flex-col max-h-[85vh]">
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Pilih Server / Eksekutor</h4>
                <p className="text-xs text-slate-500 font-medium">Saring produk berdasarkan jalur transaksi</p>
              </div>
              <button
                onClick={() => setIsFilterSheetOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 active:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-1.5 max-h-96">
              <button
                onClick={() => {
                  setSelectedChannel('ALL');
                  setIsFilterSheetOpen(false);
                }}
                className={`w-full px-4 py-3 rounded-xl text-left text-sm font-bold transition flex items-center justify-between cursor-pointer ${
                  selectedChannel === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>Semua Server / Toko</span>
                {selectedChannel === 'ALL' && <Check className="w-4 h-4" />}
              </button>

              {channels.map((chan) => (
                <button
                  key={chan}
                  onClick={() => {
                    setSelectedChannel(chan);
                    setIsFilterSheetOpen(false);
                  }}
                  className={`w-full px-4 py-3 rounded-xl text-left text-sm font-bold transition flex items-center justify-between cursor-pointer ${
                    selectedChannel === chan
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate">{chan}</span>
                  {selectedChannel === chan && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
