/**
 * PublicProfileModal.jsx
 * Opens when any user taps "View Profile" or "My Profile" in the app.
 * Handles both viewing other users (read-only) and own profile (with photo upload).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Star, Truck, Package, Award, MapPin, Calendar,
  Camera, Upload, Shield, Pencil,
  Image, Plus, Trash2, CheckCircle2, Loader2, ZoomIn
} from 'lucide-react';
import { Dialog, DialogBottomSheet, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { db, storage } from '@/firebase';
import {
  doc, getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getRatingsForUser, updateUserProfile } from '@/services/firestoreService';

const BADGE_CONFIG = {
  ELITE:    { color: 'from-yellow-400 to-amber-500',  text: 'text-amber-900', icon: '👑', label: 'Elite'    },
  PRO:      { color: 'from-purple-500 to-violet-600', text: 'text-white',     icon: '⚡', label: 'Pro'      },
  VERIFIED: { color: 'from-blue-500 to-cyan-500',     text: 'text-white',     icon: '🛡️', label: 'Verified' },
  ACTIVE:   { color: 'from-green-400 to-emerald-500', text: 'text-white',     icon: '✅', label: 'Active'   },
  STARTER:  { color: 'from-gray-400 to-gray-500',     text: 'text-white',     icon: '🚀', label: 'Starter'  },
};

const MAX_PHOTOS     = 6;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function getUploadErrorMessage(error) {
  if (error?.code === 'storage/unauthorized') {
    return 'Upload failed: permission denied. Please sign in again and retry.';
  }
  if (error?.code === 'storage/canceled') {
    return 'Upload canceled.';
  }
  return 'Upload failed. Please try again.';
}

function formatMemberSince(ts) {
  if (!ts) return 'New member';
  const d      = ts.toDate ? ts.toDate() : new Date(ts);
  const months = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (months < 1)  return 'New member';
  if (months < 12) return `Member for ${months} month${months > 1 ? 's' : ''}`;
  const y = Math.floor(months / 12);
  return `Member for ${y} year${y > 1 ? 's' : ''}`;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function RatingStars({ rating = 0 }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('size-3.5',
          i < Math.round(rating)
            ? 'text-yellow-400 fill-yellow-400'
            : 'text-gray-300 dark:text-gray-600'
        )} />
      ))}
    </div>
  );
}

function AvatarUpload({ src, name, role, isOwner, onUpload, uploading }) {
  const inputRef = useRef(null);
  const gradient = role === 'trucker' ? 'from-orange-400 to-orange-600' : 'from-blue-400 to-blue-600';
  return (
    <div className="relative flex-shrink-0">
      <div
        className={cn('size-20 rounded-2xl overflow-hidden shadow-xl',
          !src && `bg-gradient-to-br ${gradient} flex items-center justify-center`
        )}
        style={{ border: '3px solid white' }}
      >
        {src
          ? <img src={src} alt={name} className="w-full h-full object-cover" />
          : <span className="text-white text-2xl font-bold">{getInitials(name)}</span>
        }
      </div>
      {isOwner && (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1.5 -right-1.5 size-7 rounded-full bg-orange-500 shadow-lg
                       flex items-center justify-center hover:bg-orange-600 transition-colors
                       border-2 border-white dark:border-gray-900 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="size-3 text-white animate-spin" /> : <Camera className="size-3 text-white" />}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f && f.size <= MAX_FILE_BYTES) onUpload(f);
            }}
          />
        </>
      )}
    </div>
  );
}

function PhotoThumb({ src, onRemove }) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <>
      <div className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-sm">
        <img src={src} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={() => setLightbox(true)} className="size-7 rounded-full bg-white/90 flex items-center justify-center shadow">
            <ZoomIn className="size-3.5 text-gray-700" />
          </button>
          {onRemove && (
            <button onClick={onRemove} className="size-7 rounded-full bg-red-500 flex items-center justify-center shadow">
              <Trash2 className="size-3.5 text-white" />
            </button>
          )}
        </div>
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <img src={src} alt="" className="max-w-full max-h-full rounded-xl object-contain shadow-2xl" />
          <button className="absolute top-4 right-4 size-10 rounded-full bg-white/10 flex items-center justify-center">
            <X className="size-5 text-white" />
          </button>
        </div>
      )}
    </>
  );
}

function PhotoUploadZone({ photos, onAdd, onRemove, uploading, isOwner, label, emptyHint }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const handleFiles = files => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= MAX_FILE_BYTES);
    if (valid.length) onAdd(valid);
  };
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((src, i) => (
          <PhotoThumb key={i} src={src} onRemove={isOwner ? () => onRemove(i) : null} />
        ))}
        {isOwner && photos.length < MAX_PHOTOS && (
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
            disabled={uploading}
            className={cn(
              'aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all duration-200 disabled:opacity-50',
              drag ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 scale-105'
                   : 'border-gray-300 dark:border-gray-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10'
            )}
          >
            {uploading ? <Loader2 className="size-5 text-orange-500 animate-spin" /> : (
              <>
                <div className="size-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Plus className="size-4 text-orange-500" />
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center px-1 leading-tight">{emptyHint}</span>
              </>
            )}
          </button>
        )}
        {!isOwner && photos.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-600">
            <Image className="size-8 mb-2 opacity-40" />
            <p className="text-xs">No photos yet</p>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
            {getInitials(review.raterName || 'U')}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{review.raterName || 'Anonymous'}</p>
            <p className="text-[10px] text-gray-400">{formatDate(review.createdAt)}</p>
          </div>
        </div>
        <RatingStars rating={review.score} />
      </div>
      {review.comment && <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">"{review.comment}"</p>}
      {review.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {review.tags.map(tag => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatPill({ icon: Icon, value, label, color = 'orange' }) {
  const colors = {
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-500',
    blue:   'bg-blue-50 dark:bg-blue-900/20 text-blue-500',
    green:  'bg-green-50 dark:bg-green-900/20 text-green-500',
  };
  return (
    <div className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className={cn('size-8 rounded-xl flex items-center justify-center', colors[color])}>
        <Icon className="size-4" />
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{value}</p>
      <p className="text-[10px] text-gray-400 text-center leading-tight">{label}</p>
    </div>
  );
}

export function PublicProfileModal({ open, onClose, userId, currentUserId, onGoToEditProfile }) {
  const isOwner = userId === currentUserId;

  const [profile,         setProfile]         = useState(null);
  const [truckerProfile,  setTruckerProfile]  = useState(null);
  const [reviews,         setReviews]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [activeTab,       setActiveTab]       = useState('about');
  const [truckPhotos,     setTruckPhotos]     = useState([]);
  const [cargoPhotos,     setCargoPhotos]     = useState([]);
  const [avatarSrc,       setAvatarSrc]       = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [saveSuccess,     setSaveSuccess]     = useState(false);
  const [uploadError,     setUploadError]     = useState('');

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    setActiveTab('about');
    setUploadError('');
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        setProfile(data);
        setAvatarSrc(data?.profileImage || null);
        setTruckPhotos(data?.truckPhotos || []);
        setCargoPhotos(data?.cargoPhotos || []);
        const tSnap = await getDoc(doc(db, 'users', userId, 'truckerProfile', 'profile'));
        if (tSnap.exists()) setTruckerProfile(tSnap.data());
        const ratingsResult = await getRatingsForUser(userId);
        const recentReviews = (ratingsResult?.ratings || []).slice(0, 10);
        setReviews(recentReviews);
      } catch (e) {
        console.error('[PublicProfileModal]', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, userId]);

  const handleAvatarUpload = useCallback(async (file) => {
    if (!isOwner || !currentUserId) return;
    setUploadingAvatar(true);
    setUploadError('');
    try {
      const path = `profile-photos/${currentUserId}/${Date.now()}_${file.name}`;
      const snap = await uploadBytes(ref(storage, path), file);
      const url  = await getDownloadURL(snap.ref);
      await updateUserProfile(currentUserId, { profileImage: url });
      setAvatarSrc(url);
    } catch (error) {
      console.error('[PublicProfileModal] avatar upload failed', error);
      setUploadError(getUploadErrorMessage(error));
    } finally { setUploadingAvatar(false); }
  }, [isOwner, currentUserId]);

  const handleAddPhotos = useCallback(async (files, type) => {
    if (!isOwner || !currentUserId) return;
    setUploadingPhotos(true);
    setUploadError('');
    try {
      const urls = await Promise.all(files.map(async file => {
        const path = `profile-gallery/${currentUserId}/${type}/${Date.now()}_${file.name}`;
        const snap = await uploadBytes(ref(storage, path), file);
        return getDownloadURL(snap.ref);
      }));
      if (type === 'truck') {
        const updated = [...truckPhotos, ...urls].slice(0, MAX_PHOTOS);
        setTruckPhotos(updated);
        await updateUserProfile(currentUserId, { truckPhotos: updated });
      } else {
        const updated = [...cargoPhotos, ...urls].slice(0, MAX_PHOTOS);
        setCargoPhotos(updated);
        await updateUserProfile(currentUserId, { cargoPhotos: updated });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (error) {
      console.error('[PublicProfileModal] gallery upload failed', error);
      setUploadError(getUploadErrorMessage(error));
    } finally { setUploadingPhotos(false); }
  }, [isOwner, currentUserId, truckPhotos, cargoPhotos]);

  const handleRemovePhoto = useCallback(async (index, type) => {
    if (!isOwner) return;
    if (type === 'truck') {
      const updated = truckPhotos.filter((_, i) => i !== index);
      setTruckPhotos(updated);
      await updateUserProfile(currentUserId, { truckPhotos: updated });
    } else {
      const updated = cargoPhotos.filter((_, i) => i !== index);
      setCargoPhotos(updated);
      await updateUserProfile(currentUserId, { cargoPhotos: updated });
    }
  }, [isOwner, currentUserId, truckPhotos, cargoPhotos]);

  const role         = profile?.role || 'shipper';
  const isTrucker    = role === 'trucker';
  const badge        = truckerProfile?.badge || 'STARTER';
  const badgeCfg     = BADGE_CONFIG[badge] || BADGE_CONFIG.STARTER;
  const avgRating    = profile?.averageRating || 0;
  const totalRatings = profile?.totalRatings   || 0;
  const totalTrips   = truckerProfile?.totalTrips || profile?.shipperProfile?.totalTransactions || 0;

  const TABS = [
    { id: 'about',   label: 'About',   icon: Shield  },
    { id: 'photos',  label: 'Photos',  icon: Camera  },
    { id: 'reviews', label: 'Reviews', icon: Star    },
  ];

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogBottomSheet className="p-0 overflow-hidden border-0 min-h-[85dvh] lg:min-h-0" hideCloseButton={true}>
          <DialogTitle className="sr-only">User Profile</DialogTitle>
          <div className="animate-pulse">
            <div className="h-28 bg-gradient-to-r from-orange-200 to-orange-100 dark:from-orange-900/40 dark:to-orange-800/20" />
            <div className="px-5 pb-6 -mt-10 space-y-4">
              <div className="flex gap-3 items-end">
                <div className="size-20 rounded-2xl bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2 pb-1">
                  <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
              </div>
            </div>
          </div>
        </DialogBottomSheet>
      </Dialog>
    );
  }

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogBottomSheet className="p-0 overflow-hidden border-0 min-h-[85dvh] lg:min-h-0" hideCloseButton={true}>
        <DialogTitle className="sr-only">User Profile</DialogTitle>
        {/* Hero banner */}
        <div className="relative flex-shrink-0">
          <div className={cn('h-28 w-full',
            isTrucker
              ? 'bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400'
              : 'bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400'
          )}>
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='1.5' fill='%23fff'/%3E%3C/svg%3E")`,
            }} />
          </div>

          {/* Close button */}
          <button onClick={onClose} className="absolute top-3 right-3 size-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center hover:bg-black/40 transition-colors">
            <X className="size-4 text-white" />
          </button>

          {/* Edit Profile button — owner only */}
          {isOwner && (
            <button
              onClick={() => { onClose(); onGoToEditProfile?.(); }}
              className="absolute top-3 right-14 flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white transition-all"
            >
              <Pencil className="size-3" />
              Edit Profile
            </button>
          )}

          <div className="absolute top-3 left-3">
            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white">
              {isTrucker ? '🚛 Trucker' : '📦 Shipper'}
            </span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="px-5 pb-8">

          {/* Identity row */}
          <div className="flex items-end justify-between -mt-10 mb-4">
            <AvatarUpload src={avatarSrc} name={profile.name} role={role} isOwner={isOwner} onUpload={handleAvatarUpload} uploading={uploadingAvatar} />
            {isTrucker && (
              <div className="flex gap-2 pb-1">
                <div className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r shadow-sm', badgeCfg.color, badgeCfg.text)}>
                  <span>{badgeCfg.icon}</span><span>{badgeCfg.label}</span>
                </div>
              </div>
            )}
          </div>

          {/* Name */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{profile.name || 'Unknown User'}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {avgRating > 0 && (
                <div className="flex items-center gap-1.5">
                  <RatingStars rating={avgRating} />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{avgRating.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({totalRatings} reviews)</span>
                </div>
              )}
              {profile.createdAt && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="size-3" />
                  <span>{formatMemberSince(profile.createdAt)}</span>
                </div>
              )}
            </div>
            {profile.businessName && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">🏢 {profile.businessName}</p>}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatPill icon={isTrucker ? Truck : Package} value={totalTrips || 0} label={isTrucker ? 'Trips Done' : 'Cargo Done'} color="orange" />
            <StatPill icon={Star} value={avgRating > 0 ? avgRating.toFixed(1) : '—'} label="Avg. Rating" color="blue" />
            <StatPill icon={Award} value={totalRatings || 0} label="Total Reviews" color="green" />
          </div>

          {/* Save success */}
          {saveSuccess && (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 mb-4 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="size-4 text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">Photo saved successfully!</p>
            </div>
          )}

          {uploadError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 mb-4">
              <X className="size-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">{uploadError}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-2xl p-1 mb-5">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-900 text-orange-600 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}>
                <tab.icon className="size-3.5" />{tab.label}
              </button>
            ))}
          </div>

          {/* About */}
          {activeTab === 'about' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {isTrucker && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Truck Details</p>
                  {[
                    { icon: Truck,   label: 'Truck Type', value: truckerProfile?.vehicleType || profile.vehicleType },
                    { icon: Package, label: 'Capacity',   value: truckerProfile?.capacity ? `${truckerProfile.capacity} tons` : null },
                    { icon: MapPin,  label: 'Home Base',  value: profile.city || null },
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} className="flex items-center gap-3">
                      <div className="size-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                        <row.icon className="size-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">{row.label}</p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {profile.bio && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">About Me</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Verifications</p>
                <div className="space-y-2">
                  {[
                    { label: 'Phone Verified',   done: !!profile.phone },
                    { label: 'Profile Complete', done: !!(profile.name && profile.businessName) },
                    { label: 'License on File',  done: !!truckerProfile?.driverLicenseCopy?.url,   truckerOnly: true },
                    { label: 'LTO Registration', done: !!truckerProfile?.ltoRegistrationCopy?.url, truckerOnly: true },
                  ].filter(v => !v.truckerOnly || isTrucker).map(v => (
                    <div key={v.label} className="flex items-center gap-2">
                      <div className={cn('size-5 rounded-full flex items-center justify-center',
                        v.done ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-200 dark:bg-gray-700')}>
                        {v.done ? <CheckCircle2 className="size-3 text-green-500" /> : <X className="size-3 text-gray-400" />}
                      </div>
                      <span className={cn('text-sm', v.done ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500')}>{v.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Photos */}
          {activeTab === 'photos' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {isOwner && (
                <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl px-4 py-3">
                  <Upload className="size-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700 dark:text-orange-400 leading-relaxed">
                    Add photos so shippers and truckers can trust you more easily. Max {MAX_PHOTOS} photos, 5MB each.
                  </p>
                </div>
              )}
              {isTrucker && (
                <PhotoUploadZone photos={truckPhotos} onAdd={files => handleAddPhotos(files, 'truck')} onRemove={i => handleRemovePhoto(i, 'truck')} uploading={uploadingPhotos} isOwner={isOwner} label="🚛 Truck Photos" emptyHint="Add truck photo" />
              )}
              <PhotoUploadZone photos={cargoPhotos} onAdd={files => handleAddPhotos(files, 'cargo')} onRemove={i => handleRemovePhoto(i, 'cargo')} uploading={uploadingPhotos} isOwner={isOwner} label="📦 Cargo Photos" emptyHint="Add cargo photo" />
              {uploadingPhotos && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="size-4 text-orange-500 animate-spin" />
                  <p className="text-sm text-gray-500">Uploading your photo...</p>
                </div>
              )}
            </div>
          )}

          {/* Reviews */}
          {activeTab === 'reviews' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-600">
                  <Star className="size-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No reviews yet</p>
                  <p className="text-xs mt-1 text-center">Reviews will show up here after completed transactions</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-2">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-gray-900 dark:text-white">{avgRating.toFixed(1)}</p>
                      <RatingStars rating={avgRating} />
                      <p className="text-xs text-gray-400 mt-1">Showing latest {reviews.length} of {totalRatings} reviews</p>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {[5,4,3,2,1].map(star => {
                        const count = reviews.filter(r => Math.round(r.score) === star).length;
                        const pct   = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
                        return (
                          <div key={star} className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-3">{star}</span>
                            <Star className="size-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                            <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div className="h-full bg-yellow-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 w-5 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
                </>
              )}
            </div>
          )}

        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default PublicProfileModal;
