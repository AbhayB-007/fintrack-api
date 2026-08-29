/**
 * Expense-splitting domain types and DTOs.
 * All monetary values are integer cents.
 */

/** How a shared expense is divided among participants. */
export type SplitType = 'equal' | 'custom';

/** A participant's requested share (used for custom splits). */
export interface ParticipantInput {
    userId: string;
    /** Required only for custom splits; ignored for equal splits. */
    shareCents?: number;
}

/** Validated, authorized input for creating a shared expense. */
export interface CreateSharedExpenseInput {
    creatorId: string;
    description: string;
    totalCents: number;
    splitType: SplitType;
    participants: ParticipantInput[];
}

/** A computed participant share. */
export interface ParticipantShare {
    userId: string;
    shareCents: number;
}

/** A persisted shared expense. */
export interface SharedExpense {
    id: string;
    creatorId: string;
    description: string;
    totalCents: number;
    splitType: SplitType;
    participants: ParticipantShare[];
    createdAt: Date;
}

/** Net balance between the querying user and one counterparty. */
export interface NetBalance {
    /** The other user. */
    counterpartyId: string;
    /**
     * Positive => counterparty owes the querying user.
     * Negative => the querying user owes the counterparty.
     */
    netCents: number;
}

/** Summary of all pending balances for a user. */
export interface BalanceSummary {
    userId: string;
    /** People who owe the user money (netCents > 0). */
    owedToUser: NetBalance[];
    /** People the user owes money to (netCents < 0). */
    userOwes: NetBalance[];
}
