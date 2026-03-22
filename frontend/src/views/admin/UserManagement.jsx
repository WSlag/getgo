import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Shield,
  ShieldOff,
  Eye,
  Ban,
  CheckCircle2,
  XCircle,
  Truck,
  Package,
  Mail,
  Phone,
  Calendar,
  Loader2,
  UserCheck,
  UserX,
  RefreshCw,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import api from '@/services/api';

// Role badge component
function RoleBadge({ role }) {
  const config = {
    shipper: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: Package },
    trucker: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', icon: Truck },
    admin: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', icon: Shield },
  };

  const { bg, text, icon: Icon } = config[role] || config.shipper;
  const label = role?.charAt(0).toUpperCase() + role?.slice(1) || 'User';

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

// Status badge
function StatusBadge({ isActive, isVerified }) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
        <Ban className="size-3" />
        Suspended
      </span>
    );
  }
  if (isVerified) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="size-3" />
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      <XCircle className="size-3" />
      Unverified
    </span>
  );
}

// User detail modal
function UserDetailModal({
  open,
  onClose,
  user,
  onSuspend,
  onActivate,
  onVerify,
  onToggleAdmin,
  onResetCancellationBlock,
  loading,
  cancellationStatus,
  cancellationStatusLoading,
  cancellationStatusError,
}) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-bold">
              {user.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <DialogTitle className="text-xl">{user.name || 'Unknown User'}</DialogTitle>
              <DialogDescription className="sr-only">User account details and management actions</DialogDescription>
              <div className="flex items-center gap-2 mt-1">
                <RoleBadge role={user.role} />
                <StatusBadge isActive={user.isActive !== false} isVerified={user.isVerified} />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Contact Info */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Contact Information</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Phone className="size-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">{user.phone || 'Not provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="size-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">{user.email || 'Not provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="size-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">Joined {formatDate(user.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Admin Info */}
          {user.isAdmin && (
            <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
              <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2 flex items-center gap-2">
                <Shield className="size-4" />
                Administrator
              </h4>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                Granted on {formatDate(user.adminGrantedAt)}
                {user.adminGrantedBy && ` by ${user.adminGrantedBy}`}
              </p>
            </div>
          )}

          {user.role === 'trucker' && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3 flex items-center gap-2">
                <RefreshCw className={cn('size-4', cancellationStatusLoading ? 'animate-spin' : '')} />
                Cancellation Abuse Status
              </h4>
              {cancellationStatusError && (
                <p className="text-sm text-red-600 dark:text-red-400">{cancellationStatusError}</p>
              )}
              {!cancellationStatusError && cancellationStatus && (
                <div className="space-y-1.5 text-sm">
                  <p className="text-amber-900 dark:text-amber-100">
                    In-window count: <strong>{cancellationStatus.cancellationCountInWindow}</strong> / {cancellationStatus.threshold}
                    {' '}({cancellationStatus.windowDays} days)
                  </p>
                  <p className="text-amber-800 dark:text-amber-200">
                    Baseline start: {formatDate(cancellationStatus.baselineStart)}
                  </p>
                  <p className="text-amber-800 dark:text-amber-200">
                    Block status: {cancellationStatus.isBlocked ? 'Blocked' : 'Not blocked'}
                    {cancellationStatus.blockUntil ? ` until ${formatDate(cancellationStatus.blockUntil)}` : ''}
                  </p>
                  {cancellationStatus.blockReason && (
                    <p className="text-amber-800 dark:text-amber-200">
                      Block reason: {cancellationStatus.blockReason}
                    </p>
                  )}
                  <p className="text-amber-800 dark:text-amber-200">
                    Reset at: {cancellationStatus.resetAt ? formatDate(cancellationStatus.resetAt) : 'Not reset'}
                  </p>
                </div>
              )}
              {!cancellationStatusError && !cancellationStatus && !cancellationStatusLoading && (
                <p className="text-sm text-amber-800 dark:text-amber-200">No cancellation status data available.</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            {!user.isVerified && (
              <Button
                onClick={() => onVerify(user.id)}
                disabled={loading}
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
                Verify User
              </Button>
            )}

            {user.isActive !== false ? (
              <Button
                onClick={() => onSuspend(user.id)}
                disabled={loading}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <UserX className="size-4 mr-2" />}
                Suspend User
              </Button>
            ) : (
              <Button
                onClick={() => onActivate(user.id)}
                disabled={loading}
                variant="outline"
                className="border-green-300 text-green-600 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <UserCheck className="size-4 mr-2" />}
                Activate User
              </Button>
            )}

            {user.isAdmin && (
              <Button
                onClick={() => onToggleAdmin(user.id, false)}
                disabled={loading}
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <ShieldOff className="size-4 mr-2" />}
                Revoke Admin
              </Button>
            )}

            {user.role === 'trucker' && (
              <Button
                onClick={() => onResetCancellationBlock(user.id)}
                disabled={loading}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300"
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <RefreshCw className="size-4 mr-2" />}
                Reset Cancellation Block
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UserManagement() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'suspend'|'activate', userId }
  const [resetTargetUserId, setResetTargetUserId] = useState(null);
  const [resetReason, setResetReason] = useState('');
  const [cancellationStatus, setCancellationStatus] = useState(null);
  const [cancellationStatusLoading, setCancellationStatusLoading] = useState(false);
  const [cancellationStatusError, setCancellationStatusError] = useState('');
  const selectedUserId = selectedUser?.id || '';
  const selectedUserRole = selectedUser?.role || '';

  // Review queue state
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewQueueLoading, setReviewQueueLoading] = useState(false);
  const [reviewQueueError, setReviewQueueError] = useState('');
  const [clearingReviewUid, setClearingReviewUid] = useState(null);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const allUsers = [];
      let cursor = null;

      do {
        const response = await api.admin.getUsers({ limit: 500, cursor });
        const pageUsers = response?.users || [];
        allUsers.push(...pageUsers);
        cursor = response?.nextCursor || null;
      } while (cursor && allUsers.length < 5000);

      setUsers(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch review queue
  const fetchReviewQueue = async () => {
    setReviewQueueLoading(true);
    setReviewQueueError('');
    try {
      const response = await api.admin.getReviewQueue({ pageSize: 50 });
      setReviewQueue(response?.items || []);
    } catch (error) {
      console.error('Error fetching review queue:', error);
      setReviewQueueError('Could not load review queue.');
    } finally {
      setReviewQueueLoading(false);
    }
  };

  const handleClearReview = async (uid) => {
    setClearingReviewUid(uid);
    try {
      await api.admin.clearTruckerReview(uid, '');
      setReviewQueue(prev => prev.filter(item => item.uid !== uid));
    } catch (error) {
      console.error('Error clearing review:', error);
    } finally {
      setClearingReviewUid(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'review') {
      fetchReviewQueue();
    }
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    const loadCancellationStatus = async () => {
      if (!showDetailModal || !selectedUserId || selectedUserRole !== 'trucker') {
        setCancellationStatus(null);
        setCancellationStatusLoading(false);
        setCancellationStatusError('');
        return;
      }

      setCancellationStatusLoading(true);
      setCancellationStatusError('');
      try {
        const response = await api.admin.getTruckerCancellationStatus(selectedUserId);
        if (cancelled) return;
        setCancellationStatus(response || null);
      } catch (error) {
        if (cancelled) return;
        console.error('Error loading trucker cancellation status:', error);
        setCancellationStatus(null);
        setCancellationStatusError('Could not load cancellation status.');
      } finally {
        if (!cancelled) {
          setCancellationStatusLoading(false);
        }
      }
    };

    void loadCancellationStatus();
    return () => {
      cancelled = true;
    };
  }, [showDetailModal, selectedUserId, selectedUserRole]);

  // Handle suspend user
  const handleSuspend = async (userId) => {
    setActionLoading(true);
    try {
      await api.admin.suspendUser(userId, { reason: 'Suspended via admin dashboard' });
      await fetchUsers();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error suspending user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle activate user
  const handleActivate = async (userId) => {
    setActionLoading(true);
    try {
      await api.admin.activateUser(userId);
      await fetchUsers();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error activating user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle verify user
  const handleVerify = async (userId) => {
    setActionLoading(true);
    try {
      await api.admin.verifyUser(userId);
      await fetchUsers();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error verifying user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle toggle admin
  const handleToggleAdmin = async (userId, grantAdmin) => {
    setActionLoading(true);
    try {
      await api.admin.toggleAdmin(userId, grantAdmin);
      await fetchUsers();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error toggling admin:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetCancellationBlock = async (userId, reason) => {
    setActionLoading(true);
    try {
      await api.admin.unblockTruckerCancellationBlock(userId, reason);
      await fetchUsers();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error resetting trucker cancellation block:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    // Role filter
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;

    // Search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.phone?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  // Table columns
  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
            {row.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{row.name || 'Unknown'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{row.phone || 'No phone'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (_, row) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.email || 'N/A'}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (_, row) => <RoleBadge role={row.role} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge isActive={row.isActive !== false} isVerified={row.isVerified} />,
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (_, row) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(row.createdAt, { year: undefined, hour: undefined, minute: undefined })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedUser(row);
            setShowDetailModal(true);
          }}
        >
          <Eye className="size-4 mr-1" />
          View
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '28px' : '20px' }}>
      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 pb-0">
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'users'
              ? 'border-orange-500 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          )}
        >
          <Users className="size-4" />
          All Users
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'review'
              ? 'border-orange-500 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          )}
        >
          <AlertTriangle className="size-4" />
          Review Queue
          {reviewQueue.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
              {reviewQueue.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'review' ? (
        <div>
          {reviewQueueLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-gray-400" />
            </div>
          ) : reviewQueueError ? (
            <div className="text-center py-12 text-red-500 text-sm">{reviewQueueError}</div>
          ) : reviewQueue.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm flex flex-col items-center gap-2">
              <CheckCircle2 className="size-8 text-green-400" />
              No accounts pending review
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {reviewQueue.map(item => (
                <div
                  key={item.uid}
                  className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.displayName || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.phone || item.email || item.uid}</p>
                      {item.reviewReason && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="size-3 shrink-0" />
                          {item.reviewReason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSuspend(item.uid)}
                        disabled={!!clearingReviewUid || actionLoading}
                        className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                      >
                        {actionLoading ? <Loader2 className="size-3 animate-spin" /> : <Ban className="size-3 mr-1" />}
                        Suspend
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleClearReview(item.uid)}
                        disabled={clearingReviewUid === item.uid || actionLoading}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {clearingReviewUid === item.uid
                          ? <Loader2 className="size-3 animate-spin mr-1" />
                          : <CheckCircle2 className="size-3 mr-1" />}
                        Clear Review
                      </Button>
                    </div>
                  </div>
                  {item.truckerProfile && (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs border-t border-amber-200 dark:border-amber-800 pt-3">
                      {item.truckerProfile.licenseNumber && (
                        <div>
                          <span className="text-gray-500">License:</span>{' '}
                          <span className="font-mono text-gray-800 dark:text-gray-200">{item.truckerProfile.licenseNumber}</span>
                        </div>
                      )}
                      {item.truckerProfile.plateNumber && (
                        <div>
                          <span className="text-gray-500">Plate (OCR):</span>{' '}
                          <span className="font-mono text-gray-800 dark:text-gray-200">{item.truckerProfile.plateNumber}</span>
                        </div>
                      )}
                      {item.truckerProfile.driverLicenseCopy && (
                        <div className="col-span-2 flex gap-3 pt-1">
                          <a
                            href={typeof item.truckerProfile.driverLicenseCopy === 'string'
                              ? item.truckerProfile.driverLicenseCopy
                              : item.truckerProfile.driverLicenseCopy?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <FileText className="size-3" />
                            Driver&apos;s License
                          </a>
                          {item.truckerProfile.ltoRegistrationCopy && (
                            <a
                              href={typeof item.truckerProfile.ltoRegistrationCopy === 'string'
                                ? item.truckerProfile.ltoRegistrationCopy
                                : item.truckerProfile.ltoRegistrationCopy?.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <FileText className="size-3" />
                              LTO Registration
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filteredUsers}
            loading={loading}
            emptyMessage="No users found"
            emptyIcon={Users}
            onRowClick={(row) => {
              setSelectedUser(row);
              setShowDetailModal(true);
            }}
            searchable
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by name, phone, or email..."
            filters={
              <>
                <FilterButton active={roleFilter === 'all'} onClick={() => setRoleFilter('all')}>
                  All
                </FilterButton>
                <FilterButton active={roleFilter === 'shipper'} onClick={() => setRoleFilter('shipper')}>
                  Shippers
                </FilterButton>
                <FilterButton active={roleFilter === 'trucker'} onClick={() => setRoleFilter('trucker')}>
                  Truckers
                </FilterButton>
                <FilterButton active={roleFilter === 'admin'} onClick={() => setRoleFilter('admin')}>
                  Admins
                </FilterButton>
              </>
            }
          />

          <UserDetailModal
            open={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedUser(null);
              setCancellationStatus(null);
              setCancellationStatusLoading(false);
              setCancellationStatusError('');
            }}
            user={selectedUser}
            onSuspend={(userId) => setConfirmAction({ type: 'suspend', userId })}
            onActivate={(userId) => setConfirmAction({ type: 'activate', userId })}
            onVerify={handleVerify}
            onToggleAdmin={handleToggleAdmin}
            onResetCancellationBlock={(userId) => {
              setResetTargetUserId(userId);
              setResetReason('');
            }}
            loading={actionLoading}
            cancellationStatus={cancellationStatus}
            cancellationStatusLoading={cancellationStatusLoading}
            cancellationStatusError={cancellationStatusError}
          />
        </>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.type === 'suspend' ? 'Suspend this user?' : 'Activate this user?'}
        description={
          confirmAction?.type === 'suspend'
            ? 'This user will be suspended and unable to access the platform until reactivated.'
            : 'This user will be reactivated and regain full access to the platform.'
        }
        confirmLabel={confirmAction?.type === 'suspend' ? 'Suspend User' : 'Activate User'}
        variant={confirmAction?.type === 'suspend' ? 'destructive' : 'default'}
        loading={actionLoading}
        onConfirm={async () => {
          if (!confirmAction) return;
          const { type, userId } = confirmAction;
          if (type === 'suspend') {
            await handleSuspend(userId);
          } else {
            await handleActivate(userId);
          }
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <Dialog
        open={!!resetTargetUserId}
        onOpenChange={(open) => {
          if (!open && !actionLoading) {
            setResetTargetUserId(null);
            setResetReason('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Trucker Cancellation Block</DialogTitle>
            <DialogDescription className="sr-only">Confirm cancellation block reset</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              This clears the active cancellation signing block and resets the baseline for future threshold checks.
            </p>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Reason</label>
              <textarea
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                rows={3}
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                placeholder="Admin reset reason"
                disabled={actionLoading}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setResetTargetUserId(null);
                  setResetReason('');
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  if (!resetTargetUserId) return;
                  await handleResetCancellationBlock(resetTargetUserId, resetReason.trim() || 'Reset via admin dashboard');
                  setResetTargetUserId(null);
                  setResetReason('');
                }}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : <RefreshCw className="size-4 mr-2" />}
                Reset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UserManagement;
