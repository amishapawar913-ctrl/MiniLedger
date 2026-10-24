import * as SecureStore from 'expo-secure-store';
import { File } from 'expo-file-system';

// Android emulator -> host machine is 10.0.2.2. For a real phone, set EXPO_PUBLIC_API_URL
// to your computer's LAN IP, e.g. http://192.168.1.5:4000
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

export type Loan = {
  id: number;
  friend_name: string;
  amount: number;
  due_date: string; // YYYY-MM-DD
  repaid_at: string | null;
  receipt_url: string | null;
};

export type Summary = {
  total_lent: number;
  total_repaid: number;
  outstanding: number;
  overdue_amount: number;
};

const TOKEN_KEY = 'miniledger_token';
let token: string | null = null;

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}
export async function saveToken(t: string | null) {
  token = t;
  if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as any) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  const res = await fetch(API_URL + path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.error || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  requestOtp: (phone: string) =>
    request('/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, otp: string) =>
    request<{ token: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    }),
  loans: () => request<Loan[]>('/loans'),
  summary: () => request<Summary>('/summary'),
  markRepaid: (id: number) => request<Loan>(`/loans/${id}/repaid`, { method: 'PATCH' }),
  addLoan: (f: { friend_name: string; amount: string; due_date: string; receiptUri?: string }) => {
    const body = new FormData();
    body.append('friend_name', f.friend_name);
    body.append('amount', f.amount);
    body.append('due_date', f.due_date);
    if (f.receiptUri) {
      // Expo SDK 58 needs a real File object (not a { uri, name, type } object)
      body.append('receipt', new File(f.receiptUri) as any);
    }
    return request<Loan>('/loans', { method: 'POST', body });
  },
};