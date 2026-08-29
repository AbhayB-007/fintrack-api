/**
 * Transaction domain types and DTOs.
 * Monetary values are always integer cents inside the domain.
 */

/** Allowed transaction directions. */
export type TransactionType = 'debit' | 'credit';

/** A persisted transaction as returned by the repository. */
export interface Transaction {
    id: string;
    userId: string;
    description: string;
    amountCents: number;
    type: TransactionType;
    createdAt: Date;
}

/** Data required to create a transaction (already validated & authorized). */
export interface CreateTransactionInput {
    userId: string;
    description: string;
    amountCents: number;
    type: TransactionType;
}
