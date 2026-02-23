import { ArrowLeft } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export function LegalPageContent({ title, lastUpdated, effectiveDate, sections, onBack }) {
  const isMobile = useMediaQuery('(max-width: 1023px)');

  return (
    <main
      className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto"
      style={{
        padding: isMobile ? '16px' : '24px',
        paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px',
      }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            style={{ marginBottom: '16px' }}
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
        )}

        {/* Header */}
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
          style={{ padding: '24px', marginBottom: '24px' }}
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ marginTop: '8px' }}>
            {lastUpdated && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last Updated: {lastUpdated}
              </p>
            )}
            {effectiveDate && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Effective: {effectiveDate}
              </p>
            )}
          </div>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sections.map((section) => (
            <div
              key={section.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
              style={{ padding: '20px 24px' }}
            >
              <h2
                className="text-base font-semibold text-gray-900 dark:text-white"
                style={{ marginBottom: '12px' }}
              >
                {section.title}
              </h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default LegalPageContent;
