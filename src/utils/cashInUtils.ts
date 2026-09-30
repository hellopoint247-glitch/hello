import { CashInAccount, CashInTransaction } from '../types';

/**
 * Checks if a transaction is an own-number-to-own-number transfer.
 * If true, this transaction is excluded from commission (১৫৳ প্রতি ১০০০ টাকা) calculation.
 */
export const isTxOwnNumberTransfer = (
  tx?: Partial<CashInTransaction> | null,
  accounts: CashInAccount[] = []
): boolean => {
  if (!tx) return false;
  if (tx.category === 'own') return true;
  if (tx.isOwnNumberTransfer === true) return true;

  const targetPhone = (tx.customerPhone || '').replace(/\D/g, '');
  if (!targetPhone || targetPhone.length < 4) return false;

  // 1. Target phone matches sender account number
  const senderNumber = (tx.accountNumber || '').replace(/\D/g, '');
  if (senderNumber && (targetPhone === senderNumber || (targetPhone.length >= 10 && senderNumber.endsWith(targetPhone)))) {
    return true;
  }

  // 2. Target phone matches any of the registered accounts in the shop
  return accounts.some(acc => {
    const cleanAcc = (acc.accountNumber || '').replace(/\D/g, '');
    if (!cleanAcc) return false;
    if (targetPhone === cleanAcc) return true;
    if (targetPhone.length >= 10 && cleanAcc.length >= 10 && targetPhone.slice(-10) === cleanAcc.slice(-10)) {
      return true;
    }
    return false;
  });
};

/**
 * Checks if a destination phone matches any of the user's shop SIM accounts
 */
export const isPhoneOwnAccount = (
  phone: string,
  accounts: CashInAccount[] = []
): boolean => {
  return Boolean(findOwnAccountByPhone(phone, accounts));
};

/**
 * Finds which registered shop SIM account matches the destination phone number.
 */
export const findOwnAccountByPhone = (
  phone: string,
  accounts: CashInAccount[] = []
): CashInAccount | undefined => {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 4) return undefined;

  return accounts.find(acc => {
    const cleanAcc = (acc.accountNumber || '').replace(/\D/g, '');
    if (!cleanAcc) return false;
    if (cleanPhone === cleanAcc) return true;
    if (cleanPhone.length >= 10 && cleanAcc.length >= 10 && cleanPhone.slice(-10) === cleanAcc.slice(-10)) {
      return true;
    }
    return false;
  });
};

/**
 * Calculate commission for a cash-in transaction (15 Tk per 1000 Tk, i.e. 1.5%)
 * Returns 0 if it is an own-number-to-own-number transfer.
 */
export const getTransactionCommission = (
  tx: CashInTransaction,
  accounts: CashInAccount[] = []
): number => {
  if (isTxOwnNumberTransfer(tx, accounts)) {
    return 0;
  }
  const amt = Number(tx.amount) || 0;
  return (amt / 1000) * 15;
};
