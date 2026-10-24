import { describe, it, expect } from 'vitest';
import { computeSummary } from '../src/summary';
import { loanBodySchema } from '../src/loans';

const today = '2026-10-24';

describe('computeSummary', () => {
  it('handles empty list', () => {
    expect(computeSummary([], today)).toEqual({
      total_lent: 0, total_repaid: 0, outstanding: 0, overdue_amount: 0,
    });
  });

  it('computes lent, repaid, overdue', () => {
    const s = computeSummary(
      [
        { amount: 1000, due_date: '2026-10-01', repaid_at: null },             // overdue
        { amount: 500, due_date: '2026-10-01', repaid_at: '2026-10-05' },      // repaid
        { amount: 250.5, due_date: '2026-11-01', repaid_at: null },            // not due yet
      ],
      today
    );
    expect(s).toEqual({
      total_lent: 1750.5, total_repaid: 500, outstanding: 1250.5, overdue_amount: 1000,
    });
  });

  it('does not treat a loan due today as overdue', () => {
    const s = computeSummary([{ amount: 100, due_date: today, repaid_at: null }], today);
    expect(s.overdue_amount).toBe(0);
  });
});

describe('loanBodySchema', () => {
  it('accepts valid input and coerces amount', () => {
    const r = loanBodySchema.safeParse({ friend_name: 'Riya', amount: '200', due_date: '2026-12-01' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(200);
  });
  it('rejects bad input', () => {
    expect(loanBodySchema.safeParse({ friend_name: '', amount: 10, due_date: '2026-12-01' }).success).toBe(false);
    expect(loanBodySchema.safeParse({ friend_name: 'A', amount: -5, due_date: '2026-12-01' }).success).toBe(false);
    expect(loanBodySchema.safeParse({ friend_name: 'A', amount: 5, due_date: '01-12-2026' }).success).toBe(false);
  });
});
