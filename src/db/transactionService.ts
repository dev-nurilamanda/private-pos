import { db, type Transaction, type Product, type PaymentStatus } from './db';

export interface CreateTransactionPayload {
  productId?: number;
  productName: string;
  category?: string;
  customerTarget?: string;
  customerId?: number | null;
  costPrice: number;
  sellingPrice: number;
  outWalletId: string;
  inWalletId: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  notes?: string;
  quantity?: number;
}

/**
 * Eksekusi transaksi kasir secara ATOMIK menggunakan db.transaction
 */
export async function executeCashierTransaction(
  payload: CreateTransactionPayload
): Promise<Transaction> {
  const qty = payload.quantity && payload.quantity > 0 ? payload.quantity : 1;
  const totalCost = payload.costPrice * qty;
  const totalSelling = payload.sellingPrice * qty;
  const profit = totalSelling - totalCost;

  const txnId = `TRX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const transactionRecord: Transaction = {
    id: txnId,
    date: new Date().toISOString(),
    productId: payload.productId || 0,
    productName: payload.productName,
    customerId: payload.customerId || null,
    customerTarget: payload.customerTarget?.trim() || undefined,
    costPrice: totalCost,
    sellingPrice: totalSelling,
    profit,
    outWalletId: payload.outWalletId,
    inWalletId: payload.inWalletId,
    paymentStatus: payload.paymentStatus,
    paymentMethod: payload.paymentMethod,
    notes: payload.notes?.trim() || undefined,
    quantity: qty,
  };

  await db.transaction('rw', [db.wallets, db.products, db.transactions, db.customers], async () => {
    // 1. Ambil dompet modal (outWalletId)
    const outWallet = await db.wallets.get(payload.outWalletId);
    if (!outWallet) {
      throw new Error(`Kantong modal sumber (${payload.outWalletId}) tidak ditemukan.`);
    }

    // 2. Potong saldo modal di outWalletId sebesar totalCost
    await db.wallets.update(payload.outWalletId, {
      currentBalance: outWallet.currentBalance - totalCost,
      updatedAt: new Date().toISOString(),
    });

    // 3. Jika status PAID, tambah saldo inWalletId sebesar totalSelling
    if (payload.paymentStatus === 'PAID') {
      const inWallet = await db.wallets.get(payload.inWalletId);
      if (!inWallet) {
        throw new Error(`Kantong tampungan (${payload.inWalletId}) tidak ditemukan.`);
      }
      await db.wallets.update(payload.inWalletId, {
        currentBalance: inWallet.currentBalance + totalSelling,
        updatedAt: new Date().toISOString(),
      });
    }
    // Jika UNPAID: saldo inWalletId TIDAK bertambah

    // 4. Jika produk mengelola stok fisik, kurangi stok barang
    if (payload.productId && payload.productId > 0) {
      const product = await db.products.get(payload.productId);
      if (product && (product.isPhysical || product.trackStock)) {
        const newStock = Math.max(0, product.stock - qty);
        await db.products.update(payload.productId, {
          stock: newStock,
        });
      }
    }

    // 5. Simpan catatan transaksi
    await db.transactions.add(transactionRecord);
  });

  return transactionRecord;
}

/**
 * Melunasi piutang (UNPAID -> PAID):
 * Menambah saldo inWalletId sebesar sellingPrice transaksi
 */
export async function settleUnpaidTransaction(
  transactionId: string,
  settleInWalletId: string,
  settlePaymentMethod: string
): Promise<void> {
  await db.transaction('rw', [db.wallets, db.transactions], async () => {
    const txn = await db.transactions.get(transactionId);
    if (!txn) throw new Error('Data transaksi tidak ditemukan.');
    if (txn.paymentStatus === 'PAID') throw new Error('Transaksi ini sudah lunas.');

    const inWallet = await db.wallets.get(settleInWalletId);
    if (!inWallet) throw new Error('Kantong penerima pelunasan tidak ditemukan.');

    // Tambah saldo penerima
    await db.wallets.update(settleInWalletId, {
      currentBalance: inWallet.currentBalance + txn.sellingPrice,
      updatedAt: new Date().toISOString(),
    });

    // Perbarui status transaksi
    await db.transactions.update(transactionId, {
      paymentStatus: 'PAID',
      inWalletId: settleInWalletId,
      paymentMethod: settlePaymentMethod,
      notes: txn.notes ? `${txn.notes} (Dilunasi ${new Date().toLocaleDateString('id-ID')})` : `Dilunasi ${new Date().toLocaleDateString('id-ID')}`,
    });
  });
}

export interface CartItem {
  id: string; // unique item id in cart
  productId?: number;
  productName: string;
  serverChannel: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  isPhysical: boolean;
  stock: number;
  outWalletId: string;
  notes?: string;
  product?: Product;
}

export interface CartCheckoutPayload {
  items: CartItem[];
  inWalletId: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  customerTarget?: string; // Nama pembeli/pengutang
  cashReceived?: number;
  notes?: string;
}

/**
 * Eksekusi checkout keranjang belanja (mendukung banyak item sekaligus)
 * Berjalan secara ATOMIK dalam satu db.transaction
 */
export async function executeCartTransaction(
  payload: CartCheckoutPayload
): Promise<Transaction[]> {
  if (!payload.items || payload.items.length === 0) {
    throw new Error('Keranjang belanja masih kosong.');
  }

  const createdTransactions: Transaction[] = [];
  const batchId = `ORD-${Date.now().toString(36).toUpperCase()}`;

  await db.transaction('rw', [db.wallets, db.products, db.transactions, db.customers], async () => {
    const costPerWallet: Record<string, number> = {};
    let totalSellingAll = 0;

    for (const item of payload.items) {
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const totalCost = item.costPrice * qty;
      const totalSelling = item.sellingPrice * qty;
      const profit = totalSelling - totalCost;
      totalSellingAll += totalSelling;

      const outWallet = item.outWalletId || 'cash_main';
      costPerWallet[outWallet] = (costPerWallet[outWallet] || 0) + totalCost;

      // Kurangi stok barang fisik jika ada
      if (item.productId && item.productId > 0 && item.isPhysical) {
        const prod = await db.products.get(item.productId);
        if (prod && (prod.isPhysical || prod.trackStock)) {
          const newStock = Math.max(0, prod.stock - qty);
          await db.products.update(item.productId, { stock: newStock });
        }
      }

      const txnId = `TRX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const record: Transaction = {
        id: txnId,
        date: new Date().toISOString(),
        productId: item.productId || 0,
        productName: item.productName,
        customerId: null,
        customerTarget: payload.customerTarget?.trim() || undefined,
        costPrice: totalCost,
        sellingPrice: totalSelling,
        profit,
        outWalletId: outWallet,
        inWalletId: payload.inWalletId,
        paymentStatus: payload.paymentStatus,
        paymentMethod: payload.paymentMethod,
        notes: payload.notes?.trim()
          ? `${payload.notes} (${batchId})`
          : payload.items.length > 1
          ? `Pesanan ${batchId}`
          : undefined,
        quantity: qty,
      };

      await db.transactions.add(record);
      createdTransactions.push(record);
    }

    // 1. Potong saldo modal dari masing-masing outWallet
    for (const [walletId, totalCost] of Object.entries(costPerWallet)) {
      const wallet = await db.wallets.get(walletId);
      if (wallet) {
        await db.wallets.update(walletId, {
          currentBalance: wallet.currentBalance - totalCost,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // 2. Tambah saldo penerima (inWalletId) jika status lunas (PAID)
    if (payload.paymentStatus === 'PAID') {
      const inWallet = await db.wallets.get(payload.inWalletId);
      if (inWallet) {
        await db.wallets.update(payload.inWalletId, {
          currentBalance: inWallet.currentBalance + totalSellingAll,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  });

  return createdTransactions;
}
