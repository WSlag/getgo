import React from 'react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';

export function DataTable({
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
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const sectionPadding = isDesktop ? 'px-6 py-5' : 'p-4';
  const cellPadding = isDesktop ? 'px-6 py-3.5' : 'px-4 py-3';
  const footerPadding = isDesktop ? 'px-6 py-3.5' : 'px-4 py-3';

  return (
    <div className={cn('bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden', className)}>
      {/* Header with search and filters */}
      {(searchable || filters) && (
        <div className={cn('border-b border-border', sectionPadding)}>
          <div className="flex flex-col sm:flex-row gap-3">
            {searchable && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={cn(
                    'w-full pl-10 pr-4 py-2 rounded-lg',
                    'bg-muted/60',
                    'border border-border',
                    'text-foreground placeholder:text-muted-foreground',
                    'focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none',
                    'transition-all duration-200'
                  )}
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
            <tr className="bg-muted/50 border-b border-border">
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={cn(
                    'text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
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
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="size-8 text-orange-500 animate-spin mb-2" />
                    <p className="text-muted-foreground text-sm">Loading...</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <div className="flex flex-col items-center justify-center">
                    {EmptyIcon && (
                      <div className="size-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                        <EmptyIcon className="size-6 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-muted-foreground">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'hover:bg-muted/40 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col, colIdx) => (
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
        <div className={cn('border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3', footerPadding)}>
          <p className="text-sm text-muted-foreground">
            Showing {pagination.from} to {pagination.to} of {pagination.total} results
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onPageChange(1)}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="size-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="size-4 text-muted-foreground" />
            </button>
            <span className="px-4 py-2 text-sm font-medium text-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.totalPages)}
              disabled={pagination.page === pagination.totalPages}
              className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="size-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Filter button component
export function FilterButton({ active, onClick, children, className }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
        active
          ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
        className
      )}
    >
      {children}
    </button>
  );
}

export default DataTable;
