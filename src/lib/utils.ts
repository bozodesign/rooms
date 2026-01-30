import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + '.-';
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

export function getPaymentStatusColor(status: 'pending' | 'paid' | 'overdue'): string {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'overdue':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function getPaymentStatusLabel(status: 'pending' | 'paid' | 'overdue'): string {
  switch (status) {
    case 'paid':
      return 'ชำระแล้ว';
    case 'overdue':
      return 'เกินกำหนด';
    case 'pending':
      return 'รอชำระ';
    default:
      return status;
  }
}
