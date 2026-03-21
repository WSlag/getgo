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

function normalizeTrimmedText(value) {
  return typeof value === 'string' ? value.trim() : '';
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
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeTitle, setWelcomeTitle] = useState('Welcome to GetGo');
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Welcome to GetGo. We are glad to have you onboard. You can check Help & Support anytime for tips and assistance.'
  );

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
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
    setWelcomeEnabled(welcome?.enabled !== false);
    setWelcomeTitle(String(welcome?.title || 'Welcome to GetGo'));
    setWelcomeMessage(String(welcome?.message || 'Welcome to GetGo.'));
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
      const response = await api.admin.queueBroadcastMessage({ title, message });
      const jobId = response?.jobId;
      if (!jobId) {
        throw new Error('Broadcast queue request did not return a job ID');
      }

      setActiveJob({
        id: jobId,
        status: response?.status || 'queued',
        title,
        message,
        progress: {
          totalUsers: 0,
          processedUsers: 0,
          deliveredUsers: 0,
          skippedUsers: 0,
          failedUsers: 0,
        },
      });
      setBroadcastMessage('');
      setBroadcastSuccess('Broadcast queued. Delivery is now processing in the background.');
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
              Send one message to all active users. Delivery runs asynchronously to avoid blocking the dashboard.
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
                placeholder="Example: Welcome to GetGo"
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
