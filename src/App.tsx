/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Menu,
  Search,
  X,
  CheckCircle2,
  WifiOff,
  Plus,
  ShoppingCart,
  ArrowRight,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDefaultWallets, seedDefaultProducts, seedDefaultDiscounts, type Product } from './db/db';
import { type CartItem } from './db/transactionService';
import { CashierCatalog } from './components/CashierCatalog';
import { ManualCashier } from './components/ManualCashier';
import { OrdersAndDebts } from './components/OrdersAndDebts';
import { CheckoutBottomSheet } from './components/CheckoutBottomSheet';
import { CreateProductModal } from './components/CreateProductModal';
import { DrawerMenu } from './components/DrawerMenu';
import { WalletList } from './components/WalletList';
import { ProductManagement } from './components/ProductManagement';
import { DiscountManagement } from './components/DiscountManagement';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { formatRupiah } from './utils/formatters';

export default function App() {
  const [activeView, setActiveView] = useState<'cashier' | 'checkout' | 'wallets' | 'debts' | 'products' | 'discounts'>('cashier');
  const [subTab, setSubTab] = useState<'katalog' | 'manual' | 'pesanan'>('katalog');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Cart State (Keranjang Belanja POS)
  const [cart, setCart] = useState<CartItem[]>([]);

  // Create Product Modal state
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);

  // Success Notification Toast
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Offline / Online state
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Unpaid count for badge
  const unpaidCount = useLiveQuery(
    () => db.transactions.where('paymentStatus').equals('UNPAID').count(),
    []
  ) || 0;

  useEffect(() => {
    seedDefaultWallets().catch(console.error);
    seedDefaultProducts().catch(console.error);
    seedDefaultDiscounts().catch(console.error);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handler Tambah Produk ke Keranjang
  const handleAddToCart = (product: Product) => {
    const isPhysical = Boolean(product.isPhysical ?? product.trackStock);

    if (isPhysical && product.stock <= 0) {
      setSuccessToast(`Stok ${product.name} telah habis.`);
      setTimeout(() => setSuccessToast(null), 2500);
      return;
    }

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((item) => item.productId === product.id);

      if (existingIdx >= 0) {
        const existing = prevCart[existingIdx];
        if (!isPhysical) {
          setSuccessToast(`Produk server/digital "${product.name}" dibatasi 1 per transaksi.`);
          setTimeout(() => setSuccessToast(null), 2500);
          return prevCart;
        }

        if (isPhysical && existing.quantity >= product.stock) {
          setSuccessToast(`Batas stok ${product.name} tercapai (${product.stock} unit).`);
          setTimeout(() => setSuccessToast(null), 2500);
          return prevCart;
        }

        const updated = [...prevCart];
        updated[existingIdx] = {
          ...existing,
          quantity: existing.quantity + 1,
        };
        return updated;
      }

      // Tentukan outWalletId bawaan produk
      let outWallet = product.defaultWalletId;
      if (!outWallet) {
        outWallet = isPhysical ? 'cash_main' : 'server_digipos';
      }

      const newItem: CartItem = {
        id: `cart-${product.id}-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        serverChannel: product.serverChannel || product.category || 'Toko Fisik',
        category: product.category,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        quantity: 1,
        isPhysical,
        stock: product.stock,
        outWalletId: outWallet,
        product,
      };

      return [...prevCart, newItem];
    });
  };

  // Handler Update Qty di Keranjang
  const handleUpdateCartQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(cartItemId);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id !== cartItemId) return item;
        if (!item.isPhysical && newQty > 1) {
          setSuccessToast(`Produk server/digital dibatasi 1 per transaksi.`);
          setTimeout(() => setSuccessToast(null), 2500);
          return { ...item, quantity: 1 };
        }
        const maxQty = item.isPhysical ? item.stock : 1;
        return {
          ...item,
          quantity: Math.min(newQty, maxQty),
        };
      })
    );
  };

  // Handler Hapus 1 Item dari Keranjang
  const handleRemoveFromCart = (cartItemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== cartItemId));
  };

  // Handler Kosongkan Keranjang
  const handleClearCart = () => {
    setCart([]);
  };

  // Handler Tambah Transaksi Manual ke Keranjang
  const handleManualAddToCart = (item: {
    name: string;
    costPrice: number;
    sellingPrice: number;
    category?: string;
  }) => {
    const newItem: CartItem = {
      id: `cart-manual-${Date.now()}`,
      productName: item.name,
      serverChannel: 'Manual',
      category: item.category || 'Transaksi Bebas',
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
      quantity: 1,
      isPhysical: false,
      stock: 9999,
      outWalletId: 'cash_main',
    };

    setCart((prev) => [...prev, newItem]);
    setSuccessToast(`"${item.name}" berhasil masuk keranjang.`);
    setTimeout(() => setSuccessToast(null), 2500);
  };

  // Handler Transaksi Manual Bayar Langsung
  const handleManualProceedDirect = (item: {
    name: string;
    costPrice: number;
    sellingPrice: number;
    category?: string;
  }) => {
    const newItem: CartItem = {
      id: `cart-manual-${Date.now()}`,
      productName: item.name,
      serverChannel: 'Manual',
      category: item.category || 'Transaksi Bebas',
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
      quantity: 1,
      isPhysical: false,
      stock: 9999,
      outWalletId: 'cash_main',
    };

    setCart((prev) => [...prev, newItem]);
    setActiveView('checkout');
  };

  // Handler Transaksi Selesai
  const handleCheckoutSuccess = (summary: string) => {
    setSuccessToast(summary);
    setActiveView('cashier');
    setTimeout(() => {
      setSuccessToast(null);
    }, 3500);
  };

  // Total Finansial Keranjang untuk Floating Bar
  const totalCartQty = cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalCartCost = cart.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
  const totalCartSelling = cart.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);
  const totalCartProfit = totalCartSelling - totalCartCost;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      {/* PWA Install Notification Bar */}
      <PWAInstallBanner />

      {/* 1. HEADER ATAS (Putih Bersih Monokrom - Lebar & Padding Standar Identik di Seluruh Layar) */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="w-full max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          {/* Kiri: Hamburger Menu Garis Tiga atau Tombol Back jika di Checkout / Diskon */}
          <div className="flex items-center gap-2.5">
            {activeView === 'checkout' || activeView === 'discounts' ? (
              <button
                onClick={() => setActiveView('cashier')}
                className="p-2 -ml-1 text-slate-800 hover:text-black active:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Kembali ke Kasir"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
              </button>
            ) : (
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="p-2 -ml-1 text-slate-800 hover:text-black active:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Menu Navigasi"
              >
                <Menu className="w-5 h-5 stroke-[2.2]" />
              </button>
            )}
            <h1 className="font-extrabold text-lg tracking-tight text-slate-900">
              {activeView === 'cashier'
                ? 'Kasir'
                : activeView === 'checkout'
                ? 'Keranjang Belanja'
                : activeView === 'wallets'
                ? 'Dompet Modal'
                : activeView === 'products'
                ? 'Manajemen Produk'
                : activeView === 'discounts'
                ? 'Diskon & Promo'
                : 'Riwayat & Piutang'}
            </h1>
          </div>

          {/* Kanan: Action Buttons & Offline Indicator */}
          <div className="flex items-center gap-1.5">
            {activeView === 'checkout' && cart.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 active:scale-95 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Kosongkan Keranjang"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kosongkan</span>
              </button>
            )}

            {activeView === 'products' && (
              <button
                onClick={() => setIsCreateProductOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer shrink-0"
                title="Tambah Produk Baru"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Tambah</span>
              </button>
            )}

            {activeView === 'cashier' && cart.length > 0 && (
              <button
                onClick={() => setActiveView('checkout')}
                className="relative p-2 text-slate-800 hover:text-black active:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Buka Keranjang Belanja"
              >
                <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
                <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {cart.length}
                </span>
              </button>
            )}

            {activeView === 'cashier' && subTab === 'katalog' && (
              <button
                onClick={() => setIsSearchActive(!isSearchActive)}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  isSearchActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-700 hover:text-black active:bg-slate-100'
                }`}
                title="Cari Produk"
              >
                {isSearchActive ? <X className="w-5 h-5" /> : <Search className="w-5 h-5 stroke-[2.2]" />}
              </button>
            )}

            {!isOnline && (
              <span
                className="p-1.5 rounded-lg text-amber-600 bg-amber-50"
                title="Mode Offline"
              >
                <WifiOff className="w-4 h-4" />
              </span>
            )}
          </div>
        </div>

        {/* Expandable Search Input Bar */}
        {isSearchActive && activeView === 'cashier' && (
          <div className="w-full max-w-4xl mx-auto px-4 pb-3.5 animate-in fade-in slide-in-from-top-1 duration-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Cari nama produk / token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 text-slate-900 placeholder:text-slate-400 pl-10 pr-9 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. SUB-TAB SEDERHANA: KATALOG | MANUAL | PESANAN */}
        {activeView === 'cashier' && (
          <div className="border-t border-slate-100 bg-white">
            <div className="w-full max-w-4xl mx-auto flex items-center px-4">
              <button
                onClick={() => setSubTab('katalog')}
                className={`flex-1 py-3 text-sm font-semibold text-center transition cursor-pointer border-b-2 ${
                  subTab === 'katalog'
                    ? 'border-slate-900 text-slate-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Katalog
              </button>

              <button
                onClick={() => setSubTab('manual')}
                className={`flex-1 py-3 text-sm font-semibold text-center transition cursor-pointer border-b-2 ${
                  subTab === 'manual'
                    ? 'border-slate-900 text-slate-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Manual
              </button>

              <button
                onClick={() => setSubTab('pesanan')}
                className={`flex-1 py-3 text-sm font-semibold text-center transition cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
                  subTab === 'pesanan'
                    ? 'border-slate-900 text-slate-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Pesanan</span>
                {unpaidCount > 0 && (
                  <span className="px-2 py-0.5 bg-slate-900 text-white text-[11px] font-bold rounded-full">
                    {unpaidCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Floating Success Toast */}
      {successToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm p-3 bg-slate-900 text-white rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-100">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{successToast}</span>
        </div>
      )}

      {/* 3. MAIN CONTENT CONTAINER */}
      <main className="flex-1 w-full overflow-x-hidden max-w-4xl mx-auto px-4 py-0">
        {activeView === 'checkout' ? (
          <CheckoutBottomSheet
            cart={cart}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveFromCart}
            onClearCart={handleClearCart}
            onSuccess={handleCheckoutSuccess}
            onBackToCashier={() => setActiveView('cashier')}
            onNavigateToDiscounts={() => setActiveView('discounts')}
          />
        ) : activeView === 'cashier' ? (
          <>
            {subTab === 'katalog' && (
              <CashierCatalog
                searchQuery={searchQuery}
                cart={cart}
                onAddToCart={handleAddToCart}
                onUpdateCartQuantity={handleUpdateCartQuantity}
                onOpenCreateModal={() => setIsCreateProductOpen(true)}
                onOpenProductManagement={() => setActiveView('products')}
              />
            )}

            {subTab === 'manual' && (
              <div className="py-3">
                <ManualCashier
                  onAddToCart={handleManualAddToCart}
                  onProceedDirect={handleManualProceedDirect}
                />
              </div>
            )}

            {subTab === 'pesanan' && (
              <div className="py-3">
                <OrdersAndDebts />
              </div>
            )}
          </>
        ) : activeView === 'products' ? (
          <ProductManagement onBackToCashier={() => setActiveView('cashier')} />
        ) : activeView === 'discounts' ? (
          <DiscountManagement onBackToCashier={() => setActiveView('cashier')} />
        ) : activeView === 'wallets' ? (
          <WalletList />
        ) : (
          <OrdersAndDebts />
        )}
      </main>

      {/* 4. FLOATING BOTTOM CART BAR (Sisi Kiri: Total Tagihan, Sisi Kanan: Kapsul Detail Pesanan) */}
      {activeView === 'cashier' && cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl animate-in slide-in-from-bottom duration-150">
          <div className="w-full max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            {/* Sisi Kiri: Total Tagihan Simpel */}
            <div
              onClick={() => setActiveView('checkout')}
              className="cursor-pointer space-y-0.5 select-none min-w-0"
            >
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Tagihan
              </span>
              <div className="font-black text-slate-900 text-xl tracking-tight leading-tight truncate">
                {formatRupiah(totalCartSelling)}
              </div>
            </div>

            {/* Sisi Kanan: Kapsul Detail Pesanan dengan Ikon Bulat Jumlah Pesanan */}
            <button
              type="button"
              onClick={() => setActiveView('checkout')}
              className="h-12 pl-4 pr-3 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold text-sm rounded-full flex items-center gap-2.5 shadow-md transition cursor-pointer select-none shrink-0"
            >
              <span>Detail Pesanan</span>
              <span className="w-6 h-6 rounded-full bg-white text-slate-900 font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {totalCartQty}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Tambah Produk Baru */}
      <CreateProductModal
        isOpen={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
      />

      {/* Drawer Menu Kiri (Hamburger) */}
      <DrawerMenu
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeView={activeView}
        onSelectView={(view) => {
          setActiveView(view);
          if (view === 'cashier') setSubTab('katalog');
        }}
      />
    </div>
  );
}
