export interface LoanRow {
  amount: number;
  due_date: string; // YYYY-MM-DD
  repaid_at: string | Date | null;
}

export interface Summary {
  total_lent: number;
  total_repaid: number;
  outstanding: number;
  overdue_amount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** `today` is a YYYY-MM-DD string. A loan is overdue if unpaid and due_date < today. */
export function computeSummary(loans: LoanRow[], today: string): Summary {
  let lent = 0, repaid = 0, overdue = 0;
  for (const l of loans) {
    lent += l.amount;
    if (l.repaid_at) repaid += l.amount;
    else if (l.due_date < today) overdue += l.amount;
  }
  return {
    total_lent: round2(lent),
    total_repaid: round2(repaid),
    outstanding: round2(lent - repaid),
    overdue_amount: round2(overdue),
  };
}
