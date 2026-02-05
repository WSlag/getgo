import { useState } from 'react';
import {
  User, Phone, Mail, Facebook, Building2, MapPin,
  Truck, Star, Award, Wallet, LogOut, Package,
  FileText, Calendar, Edit3
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function ProfilePage() {
  const {
    userProfile,
    shipperProfile,
    truckerProfile,
    wallet,
    currentRole,
    switchRole,
    logout
  } = useAuth();

  const handleRoleSwitch = async (newRole) => {
    if (newRole !== currentRole) {
      await switchRole(newRole);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const getInitial = () => {
    return userProfile?.name?.charAt(0)?.toUpperCase() || 'U';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getMembershipColor = (tier) => {
    const colors = {
      'NEW': 'bg-purple-100 text-purple-700',
      'REGULAR': 'bg-blue-100 text-blue-700',
      'PREMIUM': 'bg-purple-100 text-purple-700',
      'VIP': 'bg-amber-100 text-amber-700',
    };
    return colors[tier] || colors['NEW'];
  };

  const getBadgeColor = (badge) => {
    const colors = {
      'STARTER': 'bg-gray-100 text-gray-700',
      'VERIFIED': 'bg-blue-100 text-blue-700',
      'TRUSTED': 'bg-green-100 text-green-700',
      'ELITE': 'bg-purple-100 text-purple-700',
    };
    return colors[badge] || colors['STARTER'];
  };

  return (
    <main className="flex-1 p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Profile Header */}
      <div className="flex items-start gap-4 mb-6">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="size-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-orange-500/25">
            {userProfile?.profileImage ? (
              <img
                src={userProfile.profileImage}
                alt={userProfile.name}
                className="size-full rounded-full object-cover"
              />
            ) : (
              getInitial()
            )}
          </div>
          <button className="absolute -bottom-1 -right-1 size-7 rounded-full bg-white dark:bg-gray-800 shadow-md flex items-center justify-center hover:scale-105 transition-transform border border-gray-200 dark:border-gray-700">
            <Edit3 className="size-3.5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Name and Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {userProfile?.name || 'User'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {userProfile?.phone || 'No phone number'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Member since {formatDate(userProfile?.createdAt)}
          </p>

          {/* Role Switcher */}
          <div className="mt-3 inline-flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800">
            <button
              onClick={() => handleRoleSwitch('shipper')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all duration-200",
                currentRole === 'shipper'
                  ? "bg-white dark:bg-gray-700 text-orange-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <Package className="size-3.5" />
              Shipper
            </button>
            <button
              onClick={() => handleRoleSwitch('trucker')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all duration-200",
                currentRole === 'trucker'
                  ? "bg-white dark:bg-gray-700 text-orange-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <Truck className="size-3.5" />
              Trucker
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {currentRole === 'shipper' ? (
          <>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border border-blue-200/50 dark:border-blue-800/50">
              <div className="size-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <Package className="size-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-blue-600 leading-tight">{shipperProfile?.totalTransactions || 0}</p>
                <p className="text-[11px] text-blue-600/70">Transactions</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200/50 dark:border-purple-800/50">
              <div className="size-9 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                <Award className="size-4 text-purple-600" />
              </div>
              <div className="min-w-0">
                <Badge className={cn("text-[10px] px-1.5 py-0.5 font-semibold", getMembershipColor(shipperProfile?.membershipTier))}>
                  {shipperProfile?.membershipTier || 'NEW'}
                </Badge>
                <p className="text-[11px] text-purple-600/70 mt-0.5">Membership</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border border-amber-200/50 dark:border-amber-800/50">
              <div className="size-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Star className="size-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-amber-600 leading-tight">
                  {truckerProfile?.rating?.toFixed(1) || '0.0'}
                </p>
                <p className="text-[11px] text-amber-600/70">Rating</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border border-blue-200/50 dark:border-blue-800/50">
              <div className="size-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <Truck className="size-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-blue-600 leading-tight">{truckerProfile?.totalTrips || 0}</p>
                <p className="text-[11px] text-blue-600/70">Total Trips</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200/50 dark:border-purple-800/50">
              <div className="size-9 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                <Award className="size-4 text-purple-600" />
              </div>
              <div className="min-w-0">
                <Badge className={cn("text-[10px] px-1.5 py-0.5 font-semibold", getBadgeColor(truckerProfile?.badge))}>
                  {truckerProfile?.badge || 'STARTER'}
                </Badge>
                <p className="text-[11px] text-purple-600/70 mt-0.5">Badge</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border border-green-200/50 dark:border-green-800/50">
              <div className="size-9 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
                <Wallet className="size-4 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-green-600 leading-tight">₱{wallet?.balance?.toLocaleString() || '0'}</p>
                <p className="text-[11px] text-green-600/70">Wallet</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Contact Information */}
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
          <User className="size-4 text-orange-500" />
          Contact Information
        </h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Phone className="size-4 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">Phone Number</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userProfile?.phone || 'Not set'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div className="size-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <Mail className="size-4 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">Email Address</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userProfile?.email || 'Not set'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div className="size-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
              <Facebook className="size-4 text-indigo-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">Facebook</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {userProfile?.facebookUrl || 'Not linked'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Business Information */}
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
          <Building2 className="size-4 text-orange-500" />
          Business Information
        </h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div className="size-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <Building2 className="size-4 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">Business Name</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {currentRole === 'shipper'
                  ? shipperProfile?.businessName || 'Not set'
                  : truckerProfile?.businessName || 'Not set'
                }
              </p>
            </div>
          </div>

          {currentRole === 'shipper' && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="size-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <MapPin className="size-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">Business Address</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {shipperProfile?.businessAddress || 'Not set'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="size-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <Package className="size-4 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">Business Type</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {shipperProfile?.businessType || 'Not set'}
                  </p>
                </div>
              </div>
            </>
          )}

          {currentRole === 'trucker' && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="size-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">License Number</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {truckerProfile?.licenseNumber || 'Not set'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="size-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Calendar className="size-4 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">License Expiry</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {truckerProfile?.licenseExpiry
                      ? formatDate(truckerProfile.licenseExpiry)
                      : 'Not set'
                    }
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-200 text-red-600 font-medium text-sm hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors"
      >
        <LogOut className="size-4" />
        Sign Out
      </button>
    </main>
  );
}

export default ProfilePage;
