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
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
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
function UserDetailModal({ open, onClose, user, onSuspend, onActivate, onVerify, onToggleAdmin, loading }) {
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

            {user.isAdmin ? (
              <Button
                onClick={() => onToggleAdmin(user.id, false)}
                disabled={loading}
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <ShieldOff className="size-4 mr-2" />}
                Revoke Admin
              </Button>
            ) : (
              <Button
                onClick={() => onToggleAdmin(user.id, true)}
                disabled={loading}
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Shield className="size-4 mr-2" />}
                Grant Admin
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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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

  useEffect(() => {
    fetchUsers();
  }, []);

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
        }}
        user={selectedUser}
        onSuspend={handleSuspend}
        onActivate={handleActivate}
        onVerify={handleVerify}
        onToggleAdmin={handleToggleAdmin}
        loading={actionLoading}
      />
    </div>
  );
}

export default UserManagement;
