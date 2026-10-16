import { type Discount, getDiscountDailyStatus } from '../db/db';
import { type CartItem } from '../db/transactionService';

export interface DiscountCalculationResult {
  amount: number;
  isValid: boolean;
  reason?: string;
  unitLimitInfo?: string;
}

/**
 * Menghitung nominal diskon secara akurat dengan mempertimbangkan:
 * 1. Status aktif diskon
 * 2. Kuota batas harian (daily limit) dengan auto-reset per hari
 * 3. Minimal total transaksi belanja (min purchase)
 * 4. Batas maksimal kuantitas unit produk yang didiskon (maxQtyPerItem)
 */
export function calculateDiscount(
  discount: Discount,
  cart: CartItem[],
  totalSelling: number
): DiscountCalculationResult {
  // 1. Cek status aktif
  if (!discount.isActive) {
    return {
      amount: 0,
      isValid: false,
      reason: 'Diskon sedang dinonaktifkan.',
    };
  }

  // 2. Cek limit harian (daily quota)
  const dailyStatus = getDiscountDailyStatus(discount);
  if (dailyStatus.isLimitReached) {
    return {
      amount: 0,
      isValid: false,
      reason: `Kuota harian (${discount.dailyLimit}x) sudah habis hari ini.`,
    };
  }

  // 3. Cek minimal belanja
  if (discount.minPurchase && discount.minPurchase > 0 && totalSelling < discount.minPurchase) {
    const diff = discount.minPurchase - totalSelling;
    return {
      amount: 0,
      isValid: false,
      reason: `Min. belanja Rp ${discount.minPurchase.toLocaleString('id-ID')} (kurang Rp ${diff.toLocaleString('id-ID')}).`,
    };
  }

  // 4. Hitung kuantitas unit barang di keranjang
  const totalUnits = cart.reduce((acc, item) => acc + (item.quantity > 0 ? item.quantity : 1), 0);
  if (totalUnits <= 0) {
    return { amount: 0, isValid: true };
  }

  let finalDiscountAmount = 0;
  let unitLimitInfo: string | undefined;

  // 5. Perhitungan dengan limit kuantitas per unit jika ada
  if (discount.maxQtyPerItem && discount.maxQtyPerItem > 0) {
    const applicableUnits = Math.min(totalUnits, discount.maxQtyPerItem);
    unitLimitInfo = `Dibatasi maks. ${discount.maxQtyPerItem} unit produk (terpakai ${applicableUnits} unit)`;

    if (discount.type === 'PERCENT') {
      // Diskon persentase dihitung proporsional terhadap harga rata-rata unit yang memenuhi syarat
      const avgPricePerUnit = totalSelling / totalUnits;
      const applicableSelling = avgPricePerUnit * applicableUnits;
      finalDiscountAmount = Math.round((applicableSelling * discount.value) / 100);
    } else {
      // Diskon nominal tetap: dikalikan unit yang berlaku (misal Rp 2.000 per unit, maks X unit)
      finalDiscountAmount = discount.value * applicableUnits;
    }
  } else {
    // Diskon standar berlaku untuk seluruh keranjang
    if (discount.type === 'PERCENT') {
      finalDiscountAmount = Math.round((totalSelling * discount.value) / 100);
    } else {
      finalDiscountAmount = discount.value;
    }
  }

  // Batasi agar diskon tidak melebihi total penjualan
  finalDiscountAmount = Math.min(totalSelling, Math.max(0, finalDiscountAmount));

  return {
    amount: finalDiscountAmount,
    isValid: true,
    unitLimitInfo,
  };
}
