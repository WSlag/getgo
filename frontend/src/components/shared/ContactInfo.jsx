import React from 'react';
import { Phone, Mail, Facebook, Lock, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ContactInfo component - displays contact information with masking support
 * When contact is masked, shows a locked state with explanation
 */
export function ContactInfo({
  phone,
  email,
  facebookUrl,
  contactMasked = false,
  phoneMasked = false,
  emailMasked = false,
  facebookMasked = false,
  onSignContract,
  className,
}) {
  const isMasked = contactMasked || (phoneMasked && emailMasked);

  if (isMasked) {
    return (
      <div className={cn(
        "p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800",
        className
      )}>
        <div className="flex items-start gap-3">
          <Lock className="size-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">
              Contact Information Hidden
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              Contact details will be revealed after the contract is signed by both parties.
            </p>
            {onSignContract && (
              <button
                onClick={onSignContract}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-colors"
              >
                <FileText className="size-3.5" />
                View Contract
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {phone && !phoneMasked && (
        <a
          href={`tel:${phone}`}
          className="flex items-center gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
        >
          <Phone className="size-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-gray-900 dark:text-white">{phone}</span>
        </a>
      )}

      {email && !emailMasked && (
        <a
          href={`mailto:${email}`}
          className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          <Mail className="size-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-gray-900 dark:text-white">{email}</span>
        </a>
      )}

      {facebookUrl && !facebookMasked && (
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
        >
          <Facebook className="size-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm text-gray-900 dark:text-white">Facebook Profile</span>
        </a>
      )}
    </div>
  );
}

export default ContactInfo;
