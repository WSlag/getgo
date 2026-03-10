import { useCallback, useEffect, useState } from 'react';
import {
  User, Phone, Mail, Facebook, Building2, MapPin,
  Truck, Star, Award, Wallet, LogOut, Package,
  FileText, Edit3, Save, KeyRound, RefreshCw,
  ClipboardList, ChevronRight, Upload, Download
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { uploadTruckerComplianceDocument } from '@/services/firestoreService';

export function ProfilePage({ onNavigateToActivity, onInstallApp }) {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const {
    userProfile,
    shipperProfile,
    truckerProfile,
    wallet,
    currentRole,
    switchRole,
    logout,
    updateProfile,
    startEmailLinking,
    disableEmailFallback,
    emailMagicLinkEnabled,
    emailAuthStatus,
    getRecoveryStatus,
    generateRecoveryCodes
  } = useAuth();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    facebookUrl: '',
    businessName: '',
    businessAddress: '',
    businessType: ''
  });
  const [recoveryStatus, setRecoveryStatus] = useState({
    enabled: false,
    activeCodes: 0,
    usedCodes: 0,
    lastGeneratedAt: null,
    lastUsedAt: null,
  });
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [generatedRecoveryCodes, setGeneratedRecoveryCodes] = useState([]);
  const [emailAuthInput, setEmailAuthInput] = useState('');
  const [emailAuthLoading, setEmailAuthLoading] = useState(false);
  const [emailAuthMessage, setEmailAuthMessage] = useState('');
  const [emailAuthError, setEmailAuthError] = useState('');

  const openEditModal = () => {
    setEditForm({
      name: userProfile?.name || '',
      email: userProfile?.email || '',
      facebookUrl: userProfile?.facebookUrl || '',
      businessName: currentRole === 'shipper'
        ? shipperProfile?.businessName || ''
        : truckerProfile?.businessName || '',
      businessAddress: shipperProfile?.businessAddress || '',
      businessType: shipperProfile?.businessType || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      if (updateProfile) {
        await updateProfile(editForm);
      }
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setEditLoading(false);
    }
  };

  const handleRoleSwitch = async (newRole) => {
    if (newRole !== currentRole) {
      await switchRole(newRole);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleUploadTruckerDoc = async (docType, event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    try {
      setUploadingDocType(docType);
      await uploadTruckerComplianceDocument(docType, file);
    } catch (error) {
      console.error('Error uploading trucker document:', error);
    } finally {
      setUploadingDocType('');
      if (event?.target) {
        event.target.value = '';
      }
    }
  };

  const getInitial = () => {
    return userProfile?.name?.charAt(0)?.toUpperCase() || 'U';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (typeof timestamp.seconds === 'number') {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp._seconds === 'number') {
      date = new Date(timestamp._seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const loadRecoveryStatus = useCallback(async () => {
    if (!getRecoveryStatus) return;
    setRecoveryLoading(true);
    setRecoveryError('');

    const result = await getRecoveryStatus();

    if (result.success) {
      setRecoveryStatus({
        enabled: !!result.enabled,
        activeCodes: Number(result.activeCodes || 0),
        usedCodes: Number(result.usedCodes || 0),
        lastGeneratedAt: result.lastGeneratedAt || null,
        lastUsedAt: result.lastUsedAt || null,
      });
    } else {
      setRecoveryError(result.error || 'Failed to load recovery status');
    }

    setRecoveryLoading(false);
  }, [getRecoveryStatus]);

  useEffect(() => {
    if (!userProfile || !getRecoveryStatus) return;
    loadRecoveryStatus();
  }, [userProfile, getRecoveryStatus, loadRecoveryStatus]);

  useEffect(() => {
    setEmailAuthInput(userProfile?.email || '');
  }, [userProfile?.email]);

  const handleSendEmailMagicLink = async () => {
    if (!startEmailLinking) return;
    if (!emailMagicLinkEnabled) {
      setEmailAuthError('Email backup login is currently unavailable.');
      return;
    }

    setEmailAuthLoading(true);
    setEmailAuthError('');
    setEmailAuthMessage('');

    const result = await startEmailLinking(emailAuthInput);
    if (!result.success) {
      setEmailAuthError(result.error || 'Unable to send email link.');
    } else {
      setEmailAuthMessage(result.message || 'Check your email for the magic link.');
    }
    setEmailAuthLoading(false);
  };

  const handleDisableEmailMagicLink = async () => {
    if (!disableEmailFallback) return;
    setEmailAuthLoading(true);
    setEmailAuthError('');
    setEmailAuthMessage('');

    const result = await disableEmailFallback();
    if (!result.success) {
      setEmailAuthError(result.error || 'Unable to disable email backup login.');
    } else {
      setEmailAuthMessage('Email backup login has been disabled.');
    }
    setEmailAuthLoading(false);
  };

  const handleGenerateRecoveryCodes = async () => {
    if (!generateRecoveryCodes) return;
    setRecoveryLoading(true);
    setRecoveryError('');

    const result = await generateRecoveryCodes();

    if (!result.success) {
      setRecoveryError(result.error || 'Failed to generate recovery codes');
      setRecoveryLoading(false);
      return;
    }

    setGeneratedRecoveryCodes(result.codes || []);
    setShowRecoveryModal(true);
    await loadRecoveryStatus();
    setRecoveryLoading(false);
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

  const backupEmailEnabled = emailAuthStatus?.enabled === true && emailAuthStatus?.verified === true;
  const backupEmailConfigured = Boolean(emailAuthStatus?.email);
  const backupEmailStatusLabel = backupEmailEnabled
    ? 'Enabled'
    : (backupEmailConfigured ? 'Pending' : 'Not configured');
  const backupEmailStatusClass = backupEmailEnabled
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : (backupEmailConfigured
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300');

  return (
    <main
      data-testid="profile-page"
      className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto"
      style={{
        padding: isMobile ? '16px' : '24px',
        paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px',
      }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Profile Header Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
          <div className="flex items-start" style={{ gap: '20px' }}>
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="size-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-orange-500/25">
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
              <button
                onClick={openEditModal}
                className="absolute -bottom-1 -right-1 size-8 rounded-full bg-white dark:bg-gray-800 shadow-md flex items-center justify-center hover:scale-105 transition-transform border border-gray-200 dark:border-gray-700"
              >
                <Edit3 className="size-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Name and Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                {userProfile?.name || 'User'}
              </h1>
              <p className="text-base text-gray-500 dark:text-gray-400" style={{ marginTop: '4px' }}>
                {userProfile?.phone || 'No phone number'}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500" style={{ marginTop: '4px' }}>
                Member since {formatDate(userProfile?.createdAt)}
              </p>

              {/* Role Switcher */}
              <div style={{ marginTop: '16px' }} className="inline-flex items-center p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
                <button
                  onClick={() => handleRoleSwitch('shipper')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200",
                    currentRole === 'shipper'
                      ? "bg-white dark:bg-gray-700 text-orange-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  )}
                >
                  <Package className="size-4" />
                  Shipper
                </button>
                <button
                  onClick={() => handleRoleSwitch('trucker')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200",
                    currentRole === 'trucker'
                      ? "bg-white dark:bg-gray-700 text-orange-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  )}
                >
                  <Truck className="size-4" />
                  Trucker
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2" style={{ gap: '16px', marginBottom: '24px' }}>
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
                <Badge className={cn("text-[11px] px-1.5 py-0.5 font-semibold", getMembershipColor(shipperProfile?.membershipTier))}>
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
                <Badge className={cn("text-[11px] px-1.5 py-0.5 font-semibold", getBadgeColor(truckerProfile?.badge))}>
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
                <p className="text-lg font-bold text-green-600 leading-tight">PHP {wallet?.balance?.toLocaleString() || '0'}</p>
                <p className="text-[11px] text-green-600/70">Wallet</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Install App Button */}
      <button
        onClick={onInstallApp}
        className="w-full flex items-center justify-between rounded-2xl border border-orange-400/30 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm hover:shadow-md hover:brightness-105 transition-all duration-200 group"
        style={{ padding: '14px 18px', marginBottom: '12px' }}
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:bg-white/25 transition-colors">
            <Download className="size-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Install App</p>
            <p className="text-xs text-white/85">Add GetGo to your home screen</p>
          </div>
        </div>
        <ChevronRight className="size-5 text-white/90 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* My Activity Button */}
        {onNavigateToActivity && (
          <button
            onClick={onNavigateToActivity}
            className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800/50 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-200 group"
            style={{ padding: '16px 20px', marginBottom: '24px' }}
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/25 transition-colors">
                <ClipboardList className="size-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">My Activity</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Bookings, Contracts &amp; Tracking</p>
              </div>
            </div>
            <ChevronRight className="size-5 text-orange-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}

      {/* Contact Information Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white" style={{ marginBottom: '16px' }}>
            <User className="size-5 text-orange-500" />
            Contact Information
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Phone className="size-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Phone Number</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userProfile?.phone || 'Not set'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Mail className="size-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Email Address</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userProfile?.email || 'Not set'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div className="size-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                <Facebook className="size-5 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Facebook</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {userProfile?.facebookUrl || 'Not linked'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Business Information Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white" style={{ marginBottom: '16px' }}>
            <Building2 className="size-5 text-orange-500" />
            Business Information
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div className="size-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                <Building2 className="size-5 text-orange-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Business Name</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {currentRole === 'shipper'
                    ? shipperProfile?.businessName || userProfile?.name || 'Not set'
                    : truckerProfile?.businessName || userProfile?.name || 'Not set'
                  }
                </p>
              </div>
            </div>

            {currentRole === 'shipper' && (
              <>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="size-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <MapPin className="size-5 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Business Address</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {shipperProfile?.businessAddress || 'Not set'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="size-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                    <Package className="size-5 text-purple-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Business Type</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {shipperProfile?.businessType || 'Not set'}
                    </p>
                  </div>
                </div>
              </>
            )}

            {currentRole === 'trucker' && (
              <>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <FileText className="size-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">License Number</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {truckerProfile?.licenseNumber || 'Not set'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="size-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                    <FileText className="size-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Driver License Copy</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {truckerProfile?.driverLicenseCopy?.url ? 'Uploaded' : 'Not set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {truckerProfile?.driverLicenseCopy?.url && (
                      <a
                        href={truckerProfile.driverLicenseCopy.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline"
                      >
                        View
                      </a>
                    )}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(event) => handleUploadTruckerDoc('driver_license', event)}
                        disabled={uploadingDocType === 'driver_license'}
                      />
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs text-white">
                        <Upload className="size-3" />
                        {uploadingDocType === 'driver_license'
                          ? 'Uploading...'
                          : (truckerProfile?.driverLicenseCopy?.url ? 'Replace' : 'Upload')}
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <FileText className="size-5 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">LTO Certificate of Registration Copy</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {truckerProfile?.ltoRegistrationCopy?.url ? 'Uploaded' : 'Not set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {truckerProfile?.ltoRegistrationCopy?.url && (
                      <a
                        href={truckerProfile.ltoRegistrationCopy.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline"
                      >
                        View
                      </a>
                    )}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(event) => handleUploadTruckerDoc('lto_registration', event)}
                        disabled={uploadingDocType === 'lto_registration'}
                      />
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs text-white">
                        <Upload className="size-3" />
                        {uploadingDocType === 'lto_registration'
                          ? 'Uploading...'
                          : (truckerProfile?.ltoRegistrationCopy?.url ? 'Replace' : 'Upload')}
                      </span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Security & Recovery Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white" style={{ marginBottom: '16px' }}>
            <KeyRound className="size-5 text-orange-500" />
            Security & Recovery
          </h2>
          <div
            data-testid="backup-email-card"
            className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
            style={{ padding: '16px', marginBottom: '14px' }}
          >
            <div className="flex items-center justify-between" style={{ gap: '10px' }}>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Backup Email Login
              </p>
              <span className={cn('text-xs font-medium px-2 py-1 rounded-full', backupEmailStatusClass)}>
                {backupEmailStatusLabel}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400" style={{ marginTop: '4px' }}>
              Keep phone OTP as primary and use magic link as fallback.
            </p>
            <div style={{ marginTop: '12px' }}>
              <label className="text-xs text-gray-500 dark:text-gray-400">Email for backup login</label>
              <Input
                type="email"
                value={emailAuthInput}
                onChange={(e) => {
                  setEmailAuthInput(e.target.value);
                  setEmailAuthError('');
                  setEmailAuthMessage('');
                }}
                placeholder="you@example.com"
                disabled={emailAuthLoading || !emailMagicLinkEnabled}
                className="mt-1"
              />
            </div>
            {!emailMagicLinkEnabled && (
              <p className="text-xs text-gray-500 dark:text-gray-400" style={{ marginTop: '8px' }}>
                Email backup login is disabled for this environment.
              </p>
            )}

            {emailAuthError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" style={{ padding: '10px 12px', marginTop: '10px' }}>
                <p className="text-xs text-red-600 dark:text-red-400">{emailAuthError}</p>
              </div>
            )}

            {emailAuthMessage && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg" style={{ padding: '10px 12px', marginTop: '10px' }}>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">{emailAuthMessage}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row" style={{ gap: '8px', marginTop: '12px' }}>
              <Button
                type="button"
                variant="gradient"
                onClick={handleSendEmailMagicLink}
                disabled={emailAuthLoading || !emailMagicLinkEnabled || !emailAuthInput.trim()}
                className="flex-1"
              >
                <Mail className="size-4 mr-2" />
                {backupEmailEnabled ? 'Resend Magic Link' : 'Send Magic Link'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleDisableEmailMagicLink}
                disabled={emailAuthLoading || !backupEmailConfigured}
                className="flex-1"
              >
                Disable Email Backup
              </Button>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700" style={{ padding: '16px', marginBottom: '14px' }}>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Recovery Codes
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400" style={{ marginTop: '4px' }}>
              Save offline codes to sign in if you lose SIM access.
            </p>
            <div className="text-xs text-gray-600 dark:text-gray-300" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span>Active codes: {recoveryStatus.activeCodes}</span>
              <span>Used codes: {recoveryStatus.usedCodes}</span>
              <span>Last generated: {recoveryStatus.lastGeneratedAt ? formatDate(recoveryStatus.lastGeneratedAt) : 'Never'}</span>
            </div>
          </div>

          {recoveryError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" style={{ padding: '10px 12px', marginBottom: '12px' }}>
              <p className="text-xs text-red-600 dark:text-red-400">{recoveryError}</p>
            </div>
          )}

          <Button
            type="button"
            variant="gradient"
            onClick={handleGenerateRecoveryCodes}
            disabled={recoveryLoading}
            className="w-full"
          >
            <RefreshCw className={cn('size-4 mr-2', recoveryLoading ? 'animate-spin' : '')} />
            {recoveryStatus.enabled ? 'Regenerate Recovery Codes' : 'Generate Recovery Codes'}
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400" style={{ marginTop: '10px' }}>
            Regenerating invalidates all previous recovery codes.
          </p>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 text-red-600 font-medium text-sm hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors bg-white dark:bg-gray-900"
          style={{ padding: '16px 24px' }}
        >
          <LogOut className="size-5" />
          Sign Out
        </button>
      </div>

      {/* Recovery Codes Modal */}
      <Dialog open={showRecoveryModal} onOpenChange={setShowRecoveryModal}>
        <DialogContent className="max-w-md backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>Your Recovery Codes</DialogTitle>
            <DialogDescription>
              Save these codes now. Each code works only once and will not be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50" style={{ padding: '12px', maxHeight: '240px', overflowY: 'auto' }}>
            {generatedRecoveryCodes.length > 0 ? (
              generatedRecoveryCodes.map((code) => (
                <div key={code} className="font-mono text-sm text-gray-900 dark:text-gray-100 tracking-wide" style={{ padding: '6px 4px' }}>
                  {code}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No codes available.</p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                if (typeof navigator !== 'undefined' && navigator.clipboard && generatedRecoveryCodes.length > 0) {
                  await navigator.clipboard.writeText(generatedRecoveryCodes.join('\n'));
                }
              }}
            >
              Copy Codes
            </Button>
            <Button
              type="button"
              variant="gradient"
              onClick={() => {
                setShowRecoveryModal(false);
                setGeneratedRecoveryCodes([]);
              }}
            >
              I Saved Them
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md backdrop-blur-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/30">
                <Edit3 className="size-6 text-white" />
              </div>
              <div>
                <DialogTitle>Edit Profile</DialogTitle>
                <DialogDescription>
                  Update your profile information
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px', paddingBottom: '8px' }}>
            {/* Name */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Name
              </label>
              <Input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Your name"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Email Address (Profile Only)
              </label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="your@email.com"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                Backup email login is managed in Security &amp; Recovery.
              </p>
            </div>

            {/* Facebook */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Facebook URL
              </label>
              <Input
                type="url"
                value={editForm.facebookUrl}
                onChange={(e) => setEditForm({ ...editForm, facebookUrl: e.target.value })}
                placeholder="https://facebook.com/yourprofile"
              />
            </div>

            {/* Business Name */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Business Name
              </label>
              <Input
                type="text"
                value={editForm.businessName}
                onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                placeholder="Your business name"
              />
            </div>

            {currentRole === 'shipper' && (
              <>
                {/* Business Address */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Business Address
                  </label>
                  <Input
                    type="text"
                    value={editForm.businessAddress}
                    onChange={(e) => setEditForm({ ...editForm, businessAddress: e.target.value })}
                    placeholder="Your business address"
                  />
                </div>

                {/* Business Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Business Type
                  </label>
                  <Input
                    type="text"
                    value={editForm.businessType}
                    onChange={(e) => setEditForm({ ...editForm, businessType: e.target.value })}
                    placeholder="e.g., Retailer, Manufacturer"
                  />
                </div>
              </>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button
                variant="gradient"
                type="submit"
                disabled={editLoading}
                style={{ paddingLeft: '28px', paddingRight: '28px' }}
              >
                <Save className="size-4 mr-2" />
                {editLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default ProfilePage;
