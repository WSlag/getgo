import React from 'react';
import { cn } from '@/lib/utils';

export function PesoIcon({ size, className, ...props }) {
  const sizeValue = size || 24;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={sizeValue}
      height={sizeValue}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      {...props}
    >
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="16"
        fontWeight="bold"
        fill="currentColor"
        stroke="none"
      >
        ₱
      </text>
    </svg>
  );
}

export default PesoIcon;
