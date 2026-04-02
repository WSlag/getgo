import { useCallback, useEffect, useRef, useState } from 'react';
import { Megaphone, Send, Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import api from '@/services/api';

const BROADCAST_TITLE_MAX_LENGTH = 120;
const BROADCAST_MESSAGE_MAX_LENGTH = 2000;
const SMS_AUDIENCE_MODE_ALL = 'all';
const SMS_AUDIENCE_MODE_PHONE_ALLOWLIST = 'phone_allowlist';
const SMS_ALLOWLIST_MAX_COUNT = 50;

function normalizeTrimmedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePhoneAllowlistInput(value) {
  if (typeof value !== 'string') return [];
  const entries = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(entries)];
}

function toCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'Unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function statusBadgeClass(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
  if (normalized === 'failed') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300';
  }
  if (normalized === 'processing' || normalized === 'queued') {
    return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  }
  return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

export function AnnouncementsView() {
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const [broadcastEnabled, setBroadcastEnabled] = useState(true);
  const [smsBroadcastEnabled, setSmsBroadcastEnabled] = useState(false);
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeTitle, setWelcomeTitle] = useState('Welcome to GetgoPh');
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Welcome to GetgoPh. We are glad to have you onboard. You can check Help & Support anytime for tips and assistance.'
  );

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendSmsToo, setSendSmsToo] = useState(false);
  const [filterSmsRecipients, setFilterSmsRecipients] = useState(false);
  const [smsPhoneAllowlistInput, setSmsPhoneAllowlistInput] = useState('');
  const [queuingBroadcast, setQueuingBroadcast] = useState(false);
  const [broadcastError, setBroadcastError] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState('');
  const [activeJob, setActiveJob] = useState(null);
  const [refreshingJob, setRefreshingJob] = useState(false);

  const pollTimerRef = useRef(null);
  const savedTimerRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
    };
  }, [stopPolling]);

  const applySettings = useCallback((settings = {}) => {
    const communications = settings?.communications || {};
    const welcome = communications?.welcome || {};
    setBroadcastEnabled(communications?.broadcastEnabled !== false);
    setSmsBroadcastEnabled(communications?.smsBroadcastEnabled === true);
    setWelcomeEnabled(welcome?.enabled !== false);
    setWelcomeTitle(String(welcome?.title || 'Welcome to GetgoPh'));
    setWelcomeMessage(String(welcome?.message || 'Welcome to GetgoPh. We are glad to have you onboard. You can check Help & Support anytime for tips and assistance.'));
    if (communications?.smsBroadcastEnabled !== true) {
      setSendSmsToo(false);
      setFilterSmsRecipients(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    setSettingsError('');
    try {
      const response = await api.admin.getSystemSettings();
      applySettings(response?.settings || {});
    } catch (error) {
      setSettingsError(error?.message || 'Failed to load communication settings');
    } finally {
      setLoadingSettings(false);
    }
  }, [applySettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const fetchJobStatus = useCallback(async (jobId, { silent = false } = {}) => {
    if (!jobId) return null;
    if (!silent) setRefreshingJob(true);
    try {
      const response = await api.admin.getBroadcastJobStatus(jobId);
      const job = response?.job || null;
      if (job) {
        setActiveJob(job);
        const status = String(job.status || '').toLowerCase();
        if (status === 'completed' || status === 'failed') {
          stopPolling();
        }
      }
      return job;
    } catch (error) {
      setBroadcastError(error?.message || 'Failed to refresh broadcast job status');
      stopPolling();
      return null;
    } finally {
      if (!silent) setRefreshingJob(false);
    }
  }, [stopPolling]);

  const startPollingJob = useCallback((jobId) => {
    if (!jobId) return;
    stopPolling();
    fetchJobStatus(jobId, { silent: true });
    pollTimerRef.current = setInterval(() => {
      fetchJobStatus(jobId, { silent: true });
    }, 3000);
  }, [fetchJobStatus, stopPolling]);

  const handleQueueBroadcast = async () => {
    const title = normalizeTrimmedText(broadcastTitle);
    const message = normalizeTrimmedText(broadcastMessage);
    const smsPhoneAllowlist = parsePhoneAllowlistInput(smsPhoneAllowlistInput);
    const smsFilterEnabled = sendSmsToo && filterSmsRecipients;

    setBroadcastError('');
    setBroadcastSuccess('');

    if (!broadcastEnabled) {
      setBroadcastError('Broadcast messaging is disabled. Enable it in Communication Settings first.');
      return;
    }
    if (!title) {
      setBroadcastError('Broadcast title is required.');
      return;
    }
    if (!message) {
      setBroadcastError('Broadcast message is required.');
      return;
    }
    if (sendSmsToo && !smsBroadcastEnabled) {
      setBroadcastError('SMS broadcast is disabled. Enable it in Communication Settings first.');
      return;
    }
    if (smsFilterEnabled && smsPhoneAllowlist.length === 0) {
      setBroadcastError('Add at least one phone number when SMS recipient filter is enabled.');
      return;
    }
    if (smsFilterEnabled && smsPhoneAllowlist.length > SMS_ALLOWLIST_MAX_COUNT) {
      setBroadcastError(`SMS recipient filter supports up to ${SMS_ALLOWLIST_MAX_COUNT} phone numbers per broadcast.`);
      return;
    }
    if (title.length > BROADCAST_TITLE_MAX_LENGTH) {
      setBroadcastError(`Title must be ${BROADCAST_TITLE_MAX_LENGTH} characters or less.`);
      return;
    }
    if (message.length > BROADCAST_MESSAGE_MAX_LENGTH) {
      setBroadcastError(`Message must be ${BROADCAST_MESSAGE_MAX_LENGTH} characters or less.`);
      return;
    }

    setQueuingBroadcast(true);
    try {
      const channels = {
        inApp: true,
        sms: sendSmsToo,
      };
      const smsAudience = sendSmsToo
        ? (smsFilterEnabled
          ? {
            mode: SMS_AUDIENCE_MODE_PHONE_ALLOWLIST,
            phoneAllowlist: smsPhoneAllowlist,
          }
          : { mode: SMS_AUDIENCE_MODE_ALL })
        : undefined;
      const response = await api.admin.queueBroadcastMessage({ title, message, channels, smsAudience });
      const jobId = response?.jobId;
      if (!jobId) {
        throw new Error('Broadcast queue request did not return a job ID');
      }
      const responseSmsAudience = response?.smsAudience || null;
      const activeSmsAudience = sendSmsToo
        ? {
          mode: String(
            responseSmsAudience?.mode
            || smsAudience?.mode
            || SMS_AUDIENCE_MODE_ALL
          ),
          phoneAllowlistCount: Number(
            responseSmsAudience?.phoneAllowlistCount
            || (smsFilterEnabled ? smsPhoneAllowlist.length : 0)
          ),
        }
        : {
          mode: SMS_AUDIENCE_MODE_ALL,
          phoneAllowlistCount: 0,
        };

      setActiveJob({
        id: jobId,
        status: response?.status || 'queued',
        title,
        message,
        channels: response?.channels || channels,
        smsAudience: activeSmsAudience,
        smsStatus: sendSmsToo ? 'queued' : 'disabled',
        progress: {
          totalUsers: 0,
          processedUsers: 0,
          deliveredUsers: 0,
          skippedUsers: 0,
          failedUsers: 0,
        },
        smsProgress: {
          totalUsers: 0,
          queuedUsers: 0,
          processedUsers: 0,
          sentUsers: 0,
          failedUsers: 0,
          noPhoneUsers: 0,
          retryAttempts: 0,
          filteredOutUsers: 0,
          unmatchedAllowlistPhones: 0,
        },
      });
      setBroadcastMessage('');
      setBroadcastSuccess(
        sendSmsToo && smsFilterEnabled
          ? `Broadcast queued. SMS will target up to ${smsPhoneAllowlist.length} filtered recipients while in-app delivery continues normally.`
          : sendSmsToo
            ? 'Broadcast queued. In-app and SMS delivery are now processing in the background.'
          : 'Broadcast queued. Delivery is now processing in the background.'
      );
      startPollingJob(jobId);
    } catch (error) {
      setBroadcastError(error?.message || 'Failed to queue broadcast');
    } finally {
      setQueuingBroadcast(false);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsError('');

    const trimmedTitle = normalizeTrimmedText(welcomeTitle);
    const trimmedMessage = normalizeTrimmedText(welcomeMessage);
    if (!trimmedTitle) {
      setSettingsError('Welcome title is required.');
      return;
    }
    if (!trimmedMessage) {
      setSettingsError('Welcome message is required.');
      return;
    }
    if (trimmedTitle.length > BROADCAST_TITLE_MAX_LENGTH) {
      setSettingsError(`Welcome title must be ${BROADCAST_TITLE_MAX_LENGTH} characters or less.`);
      return;
    }
    if (trimmedMessage.length > BROADCAST_MESSAGE_MAX_LENGTH) {
      setSettingsError(`Welcome message must be ${BROADCAST_MESSAGE_MAX_LENGTH} characters or less.`);
      return;
    }

    setSavingSettings(true);
    try {
      const response = await api.admin.updateSystemSettings({
        communications: {
          broadcastEnabled,
          smsBroadcastEnabled,
          welcome: {
            enabled: welcomeEnabled,
            title: trimmedTitle,
            message: trimmedMessage,
          },
        },
      });
      applySettings(response?.settings || {});
      setSettingsSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        savedTimerRef.current = null;
        setSettingsSaved(false);
      }, 3000);
    } catch (error) {
      setSettingsError(error?.message || 'Failed to save communication settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const jobProgress = activeJob?.progress || {};
  const totalUsers = toCount(jobProgress.totalUsers ?? activeJob?.totalUsers);
  const processedUsers = toCount(jobProgress.processedUsers ?? activeJob?.processedUsers);
  const deliveredUsers = toCount(jobProgress.deliveredUsers ?? activeJob?.deliveredUsers);
  const skippedUsers = toCount(jobProgress.skippedUsers ?? activeJob?.skippedUsers);
  const failedUsers = toCount(jobProgress.failedUsers ?? activeJob?.failedUsers);
  const smsProgress = activeJob?.smsProgress || {};
  const smsTotalUsers = toCount(smsProgress.totalUsers);
  const smsQueuedUsers = toCount(smsProgress.queuedUsers);
  const smsProcessedUsers = toCount(smsProgress.processedUsers);
  const smsSentUsers = toCount(smsProgress.sentUsers);
  const smsFailedUsers = toCount(smsProgress.failedUsers);
  const smsNoPhoneUsers = toCount(smsProgress.noPhoneUsers);
  const smsRetryAttempts = toCount(smsProgress.retryAttempts);
  const smsFilteredOutUsers = toCount(smsProgress.filteredOutUsers);
  const smsUnmatchedAllowlistPhones = toCount(smsProgress.unmatchedAllowlistPhones);
  const smsAllowlistPreviewCount = parsePhoneAllowlistInput(smsPhoneAllowlistInput).length;
  const smsEnabledForJob = activeJob?.channels?.sms === true || activeJob?.smsStatus === 'processing' || activeJob?.smsStatus === 'completed';
  const jobSmsAudience = activeJob?.smsAudience || {};
  const jobSmsAudienceMode = String(jobSmsAudience?.mode || SMS_AUDIENCE_MODE_ALL).trim().toLowerCase();
  const jobSmsAudienceAllowlistCount = toCount(
    jobSmsAudience?.phoneAllowlistCount
      ?? (Array.isArray(jobSmsAudience?.phoneAllowlist) ? jobSmsAudience.phoneAllowlist.length : 0)
  );

  return (
    <div className="flex flex-col gap-5 lg:gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1">
          {settingsError ? (
            <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {settingsError}
            </div>
          ) : (
            <div />
          )}
        </div>
        <div className="flex items-center gap-2">
          <AppButton variant="outline" size="md" onClick={loadSettings} disabled={loadingSettings || savingSettings}>
            <RefreshCw className={cn('size-4 mr-2', loadingSettings && 'animate-spin')} />
            Reload
          </AppButton>
          <AppButton
            size="md"
            onClick={handleSaveSettings}
            disabled={loadingSettings || savingSettings}
            variant={settingsSaved ? 'success' : 'primary'}
          >
            {savingSettings ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : settingsSaved ? (
              <CheckCircle2 className="size-4 mr-2" />
            ) : (
              <Megaphone className="size-4 mr-2" />
            )}
            {settingsSaved ? 'Saved!' : 'Save Settings'}
          </AppButton>
        </div>
      </div>

      <AppCard className="p-4 lg:p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-orange-100 dark:bg-orange-900/30">
            <Megaphone className="size-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Broadcast Message</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Send one message to all active users. Optional SMS extends delivery to authenticated users with phone numbers.
            </p>

            {!broadcastEnabled && (
              <div className="mb-4 rounded-[12px] border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                Broadcast messaging is currently disabled.
              </div>
            )}

            {broadcastError && (
              <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {broadcastError}
              </div>
            )}
            {broadcastSuccess && (
              <div className="mb-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                {broadcastSuccess}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Title
              </label>
              <AppInput
                value={broadcastTitle}
                onChange={(event) => setBroadcastTitle(event.target.value)}
                placeholder="Example: Welcome to GetgoPh"
                disabled={queuingBroadcast || loadingSettings}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {broadcastTitle.length}/{BROADCAST_TITLE_MAX_LENGTH}
              </p>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Message
              </label>
              <Textarea
                value={broadcastMessage}
                onChange={(event) => setBroadcastMessage(event.target.value)}
                placeholder="Write the message that all users should receive."
                disabled={queuingBroadcast || loadingSettings}
                rows={5}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {broadcastMessage.length}/{BROADCAST_MESSAGE_MAX_LENGTH}
              </p>
            </div>

            <div className="mb-4 rounded-[12px] border border-gray-200 px-4 py-3 dark:border-gray-700">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Send SMS too</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Uses SMSGate + your phone SIM. Recipients will see your mobile number.
                  </p>
                </div>
                <Switch
                  checked={sendSmsToo}
                  onCheckedChange={(checked) => {
                    const enabled = Boolean(checked);
                    setSendSmsToo(enabled);
                    if (!enabled) {
                      setFilterSmsRecipients(false);
                    }
                  }}
                  disabled={queuingBroadcast || loadingSettings || !smsBroadcastEnabled}
                  className={cn(
                    'h-6 w-11 border-0 shadow-none',
                    'data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600'
                  )}
                />
              </div>
              {!smsBroadcastEnabled && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Enable SMS Broadcast in Communication Settings first.
                </p>
              )}
            </div>

            {sendSmsToo && (
              <div className="mb-4 rounded-[12px] border border-gray-200 px-4 py-3 dark:border-gray-700">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Filter SMS recipients</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      One-time list for this broadcast only. Max {SMS_ALLOWLIST_MAX_COUNT} numbers.
                    </p>
                  </div>
                  <Switch
                    checked={filterSmsRecipients}
                    onCheckedChange={(checked) => setFilterSmsRecipients(Boolean(checked))}
                    disabled={queuingBroadcast || loadingSettings || !sendSmsToo}
                    className={cn(
                      'h-6 w-11 border-0 shadow-none',
                      'data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600'
                    )}
                  />
                </div>
                {filterSmsRecipients && (
                  <div className="mt-3">
                    <Textarea
                      value={smsPhoneAllowlistInput}
                      onChange={(event) => setSmsPhoneAllowlistInput(event.target.value)}
                      placeholder="Paste phone numbers separated by comma or new line"
                      rows={4}
                      disabled={queuingBroadcast || loadingSettings}
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Current entries: {smsAllowlistPreviewCount}/{SMS_ALLOWLIST_MAX_COUNT}
                    </p>
                  </div>
                )}
              </div>
            )}

            {sendSmsToo && (
              <div className="mb-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                SMS recipients will receive this from your configured SIM sender. Your personal number may be visible.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <AppButton
                size="md"
                onClick={handleQueueBroadcast}
                disabled={queuingBroadcast || loadingSettings}
              >
                {queuingBroadcast ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Send className="size-4 mr-2" />
                )}
                Queue Broadcast
              </AppButton>
              {activeJob?.id && (
                <AppButton
                  size="md"
                  variant="outline"
                  onClick={() => fetchJobStatus(activeJob.id)}
                  disabled={refreshingJob}
                >
                  {refreshingJob ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4 mr-2" />
                  )}
                  Refresh Status
                </AppButton>
              )}
            </div>
          </div>
        </div>
      </AppCard>

      {activeJob?.id && (
        <AppCard className="p-4 lg:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Latest Broadcast Job</h3>
            <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusBadgeClass(activeJob.status))}>
              {statusLabel(activeJob.status)}
            </span>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-[12px] border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{totalUsers}</p>
            </div>
            <div className="rounded-[12px] border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
              <p className="text-xs text-gray-500 dark:text-gray-400">Processed</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{processedUsers}</p>
            </div>
            <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Delivered</p>
              <p className="text-base font-semibold text-emerald-800 dark:text-emerald-200">{deliveredUsers}</p>
            </div>
            <div className="rounded-[12px] border border-yellow-200 bg-yellow-50 px-3 py-2 dark:border-yellow-800 dark:bg-yellow-900/20">
              <p className="text-xs text-yellow-700 dark:text-yellow-300">Skipped</p>
              <p className="text-base font-semibold text-yellow-800 dark:text-yellow-200">{skippedUsers}</p>
            </div>
            <div className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-xs text-red-700 dark:text-red-300">Failed</p>
              <p className="text-base font-semibold text-red-800 dark:text-red-200">{failedUsers}</p>
            </div>
          </div>

          {activeJob?.error && (
            <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {activeJob.error}
            </div>
          )}

          {smsEnabledForJob && (
            <div className="mt-4 rounded-[12px] border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-800 dark:bg-orange-900/20">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">SMS Delivery</p>
                <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusBadgeClass(activeJob?.smsStatus || 'processing'))}>
                  {statusLabel(activeJob?.smsStatus || 'processing')}
                </span>
              </div>
              <p className="mb-3 text-xs text-orange-700 dark:text-orange-300">
                Audience mode:{' '}
                {jobSmsAudienceMode === SMS_AUDIENCE_MODE_PHONE_ALLOWLIST
                  ? `Phone allowlist (${jobSmsAudienceAllowlistCount})`
                  : 'All authenticated users'}
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-[12px] border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900/70">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Audience</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{smsTotalUsers}</p>
                </div>
                <div className="rounded-[12px] border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900/70">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Queued</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{smsQueuedUsers}</p>
                </div>
                <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/20">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">Sent</p>
                  <p className="text-base font-semibold text-emerald-800 dark:text-emerald-200">{smsSentUsers}</p>
                </div>
                <div className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-900/20">
                  <p className="text-xs text-red-700 dark:text-red-300">Failed</p>
                  <p className="text-base font-semibold text-red-800 dark:text-red-200">{smsFailedUsers}</p>
                </div>
                <div className="rounded-[12px] border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900/70">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Processed</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{smsProcessedUsers}</p>
                </div>
                <div className="rounded-[12px] border border-yellow-200 bg-yellow-50 px-3 py-2 dark:border-yellow-800 dark:bg-yellow-900/20">
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">No Phone</p>
                  <p className="text-base font-semibold text-yellow-800 dark:text-yellow-200">{smsNoPhoneUsers}</p>
                </div>
                <div className="rounded-[12px] border border-orange-200 bg-orange-50 px-3 py-2 dark:border-orange-800 dark:bg-orange-900/20">
                  <p className="text-xs text-orange-700 dark:text-orange-300">Retries</p>
                  <p className="text-base font-semibold text-orange-800 dark:text-orange-200">{smsRetryAttempts}</p>
                </div>
                <div className="rounded-[12px] border border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-800 dark:bg-sky-900/20">
                  <p className="text-xs text-sky-700 dark:text-sky-300">Filtered Out</p>
                  <p className="text-base font-semibold text-sky-800 dark:text-sky-200">{smsFilteredOutUsers}</p>
                </div>
                <div className="rounded-[12px] border border-indigo-200 bg-indigo-50 px-3 py-2 dark:border-indigo-800 dark:bg-indigo-900/20">
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">Unmatched Phones</p>
                  <p className="text-base font-semibold text-indigo-800 dark:text-indigo-200">{smsUnmatchedAllowlistPhones}</p>
                </div>
              </div>
            </div>
          )}
        </AppCard>
      )}

      <AppCard className="p-4 lg:p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Communication Settings</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure broadcast availability and the automatic welcome message for new users.
          </p>
        </div>

        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between rounded-[12px] border border-gray-200 px-4 py-3 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Broadcast Messaging</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Allow admins to send app-wide announcements.</p>
            </div>
            <Switch
              checked={broadcastEnabled}
              onCheckedChange={setBroadcastEnabled}
              disabled={loadingSettings || savingSettings}
              className={cn(
                'h-6 w-11 border-0 shadow-none',
                'data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600'
              )}
            />
          </div>

          <div className="flex items-center justify-between rounded-[12px] border border-gray-200 px-4 py-3 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">SMS Broadcast</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Allow admins to append SMS delivery to announcements.</p>
            </div>
            <Switch
              checked={smsBroadcastEnabled}
              onCheckedChange={(checked) => {
                const enabled = Boolean(checked);
                setSmsBroadcastEnabled(enabled);
                if (!enabled) setSendSmsToo(false);
              }}
              disabled={loadingSettings || savingSettings}
              className={cn(
                'h-6 w-11 border-0 shadow-none',
                'data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600'
              )}
            />
          </div>

          <div className="flex items-center justify-between rounded-[12px] border border-gray-200 px-4 py-3 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Welcome Message</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Send the template below when a new user account is created.</p>
            </div>
            <Switch
              checked={welcomeEnabled}
              onCheckedChange={setWelcomeEnabled}
              disabled={loadingSettings || savingSettings}
              className={cn(
                'h-6 w-11 border-0 shadow-none',
                'data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600'
              )}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Welcome Title
          </label>
          <AppInput
            value={welcomeTitle}
            onChange={(event) => setWelcomeTitle(event.target.value)}
            disabled={loadingSettings || savingSettings}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {welcomeTitle.length}/{BROADCAST_TITLE_MAX_LENGTH}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Welcome Message
          </label>
          <Textarea
            value={welcomeMessage}
            onChange={(event) => setWelcomeMessage(event.target.value)}
            rows={5}
            disabled={loadingSettings || savingSettings}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {welcomeMessage.length}/{BROADCAST_MESSAGE_MAX_LENGTH}
          </p>
        </div>

        {welcomeEnabled && !normalizeTrimmedText(welcomeMessage) && (
          <div className="mt-4 flex items-center gap-2 rounded-[12px] border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
            <AlertCircle className="size-4" />
            Welcome message is enabled but empty.
          </div>
        )}
      </AppCard>
    </div>
  );
}

export default AnnouncementsView;
