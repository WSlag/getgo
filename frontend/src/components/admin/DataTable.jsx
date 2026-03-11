import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

const DEFAULT_SKELETON_ROWS = 6;
const MIN_SKELETON_ROWS = 3;
const MAX_SKELETON_ROWS = 10;

function clampSkeletonRows(count) {
  if (!Number.isFinite(count)) return DEFAULT_SKELETON_ROWS;
  return Math.min(MAX_SKELETON_ROWS, Math.max(MIN_SKELETON_ROWS, Math.round(count)));
}

function DataTableComponent({
  columns,
  data,
  loading,
  emptyMessage = 'No data found',
  emptyIcon: EmptyIcon,
  onRowClick,
  searchable,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  pagination,
  className,
}) {
  const sectionPadding = 'p-4 lg:px-6 lg:py-5';
  const cellPadding = 'px-4 py-3 lg:px-6 lg:py-3.5';
  const footerPadding = 'px-4 py-3 lg:px-6 lg:py-3.5';
  const safeColumns = useMemo(
    () => (Array.isArray(columns) ? columns : []),
    [columns]
  );
  const safeData = useMemo(
    () => (Array.isArray(data) ? data : []),
    [data]
  );
  const safeColSpan = Math.max(safeColumns.length, 1);

  const [lastStableRowCount, setLastStableRowCount] = useState(DEFAULT_SKELETON_ROWS);

  useEffect(() => {
    if (!loading && safeData.length > 0) {
      const next = clampSkeletonRows(safeData.length);
      setLastStableRowCount((prev) => (prev === next ? prev : next));
    }
  }, [loading, safeData]);

  const skeletonRowCount = useMemo(
    () => clampSkeletonRows(lastStableRowCount),
    [lastStableRowCount]
  );

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[14px] border border-slate-200 bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]',
        'dark:border-slate-800 dark:bg-slate-900 dark:text-white',
        className
      )}
    >
      {/* Header with search and filters */}
      {(searchable || filters) && (
        <div className={cn('border-b border-slate-200 dark:border-slate-800', sectionPadding)}>
          <div className="flex flex-col sm:flex-row gap-3">
            {searchable && (
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <AppInput
                  type="text"
                  value={searchQuery ?? ''}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full"
                  inputClassName="pl-10"
                />
              </div>
            )}
            {filters && <div className="flex flex-wrap gap-2">{filters}</div>}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
              {safeColumns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={cn(
                    'text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400',
                    cellPadding,
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.className
                  )}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              Array.from({ length: skeletonRowCount }).map((_, rowIdx) => (
                <tr key={`loading-row-${rowIdx}`} className="animate-pulse">
                  {(safeColumns.length > 0 ? safeColumns : [{ key: 'skeleton' }]).map((col, colIdx) => (
                    <td
                      key={`loading-cell-${rowIdx}-${col.key || colIdx}`}
                      className={cn(
                        'text-sm',
                        cellPadding,
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right',
                        col.cellClassName
                      )}
                    >
                      <div
                        className={cn(
                          'h-4 rounded bg-slate-200/90 dark:bg-slate-700/80',
                          col.align === 'right' && 'ml-auto',
                          col.align === 'center' && 'mx-auto',
                          colIdx === 0 ? 'w-32' : 'w-20',
                          colIdx === safeColumns.length - 1 && 'w-16'
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : safeData.length === 0 ? (
              <tr>
                <td colSpan={safeColSpan} className="py-12">
                  <div className="flex flex-col items-center justify-center">
                    {EmptyIcon && (
                      <div className="mb-3 flex size-12 items-center justify-center rounded-[14px] bg-slate-100 dark:bg-slate-800">
                        <EmptyIcon className="size-6 text-slate-500 dark:text-slate-400" />
                      </div>
                    )}
                    <p className="text-slate-500 dark:text-slate-400">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              safeData.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {safeColumns.map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      className={cn(
                        'text-sm',
                        cellPadding,
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right',
                        col.cellClassName
                      )}
                    >
                      {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className={cn('flex flex-col items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 sm:flex-row', footerPadding)}>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {pagination.from} to {pagination.to} of {pagination.total} results
          </p>
          <div className="flex items-center gap-1">
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => pagination.onPageChange(1)}
              disabled={pagination.page === 1}
              className="h-9 min-w-9 px-2"
            >
              <ChevronsLeft className="size-4 text-slate-500 dark:text-slate-400" />
            </AppButton>
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="h-9 min-w-9 px-2"
            >
              <ChevronLeft className="size-4 text-slate-500 dark:text-slate-400" />
            </AppButton>
            <span className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-white">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="h-9 min-w-9 px-2"
            >
              <ChevronRight className="size-4 text-slate-500 dark:text-slate-400" />
            </AppButton>
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.totalPages)}
              disabled={pagination.page === pagination.totalPages}
              className="h-9 min-w-9 px-2"
            >
              <ChevronsRight className="size-4 text-slate-500 dark:text-slate-400" />
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
}

export const DataTable = React.memo(DataTableComponent);
DataTable.displayName = 'DataTable';

// Filter button component
function FilterButtonComponent({ active, onClick, children, className }) {
  return (
    <AppButton
      type="button"
      onClick={onClick}
      variant={active ? 'primary' : 'secondary'}
      size="sm"
      className={cn(
        'h-9 whitespace-nowrap px-4 py-2 text-sm font-medium',
        className
      )}
    >
      {children}
    </AppButton>
  );
}

export const FilterButton = React.memo(FilterButtonComponent);
FilterButton.displayName = 'FilterButton';

export default DataTable;
