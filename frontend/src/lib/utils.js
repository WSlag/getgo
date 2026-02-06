import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge
 * This ensures Tailwind classes are properly merged without conflicts
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as currency (PHP)
 */
export function formatCurrency(amount, currency = 'PHP') {
  if (amount == null) return '';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get fraud score risk level styling
 * @param {number} score - Fraud score (0-100)
 * @returns {object} { color, bg, label }
 */
export function getFraudScoreStyle(score) {
  if (score > 70) {
    return {
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
      label: 'High Risk'
    };
  }
  if (score > 10) {
    return {
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      label: 'Medium Risk'
    };
  }
  return {
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    label: 'Low Risk'
  };
}

/**
 * Format a date for display
 */
export function formatDate(date, options = {}) {
  if (!date) return 'N/A';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  });
}

/**
 * Format a price number with commas
 */
export function formatPrice(price) {
  if (price === null || price === undefined) return '0';
  return Number(price).toLocaleString();
}
