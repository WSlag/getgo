import React, { useEffect, useState } from 'react';
import {
  Settings,
  Percent,
  CreditCard,
  Save,
  RefreshCw,
  Shield,
  Bell,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PesoIcon } from '@/components/ui/PesoIcon';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

function SettingCard({ title, description, children, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm" style={{ padding: '24px' }}>
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="size-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
            <Icon className="size-6 text-orange-600 dark:text-orange-400" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{description}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

function SettingInput({ label, value, onChange, type = 'text', suffix, prefix, placeholder, disabled = false }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700',
            'bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white',
            'focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none',
            'transition-all duration-200',
            disabled && 'opacity-70 cursor-not-allowed',
            prefix && 'pl-14',
            suffix && 'pr-16'
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function SettingToggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-12 h-6 rounded-full transition-colors duration-200',
          disabled && 'opacity-60 cursor-not-allowed',
          checked ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
        )}
      >
        <span
          className={cn(
            'absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200',
            checked && 'translate-x-6'
          )}
        />
      </button>
    </div>
  );
}

export function SystemSettings() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [platformFeePercent, setPlatformFeePercent] = useState('5');
  const [minFee, setMinFee] = useState('50');
  const [maxFee, setMaxFee] = useState('2000');

  const [gcashNumber, setGcashNumber] = useState('09123456789');
  const [gcashName, setGcashName] = useState('GetGo Logistics');

  const [starterCommission, setStarterCommission] = useState('3');
  const [silverCommission, setSilverCommission] = useState('4');
  const [goldCommission, setGoldCommission] = useState('5');
  const [platinumCommission, setPlatinumCommission] = useState('6');

  const [paymentVerificationEnabled, setPaymentVerificationEnabled] = useState(true);
  const [referralProgramEnabled, setReferralProgramEnabled] = useState(true);
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const applySettings = (settings = {}) => {
    setPlatformFeePercent(String(settings?.platformFee?.percentage ?? 5));
    setMinFee(String(settings?.platformFee?.minimumFee ?? 50));
    setMaxFee(String(settings?.platformFee?.maximumFee ?? 2000));

    setGcashNumber(String(settings?.gcash?.accountNumber ?? '09123456789'));
    setGcashName(String(settings?.gcash?.accountName ?? 'GetGo Logistics'));

    setStarterCommission(String(settings?.referralCommission?.STARTER ?? 3));
    setSilverCommission(String(settings?.referralCommission?.SILVER ?? 4));
    setGoldCommission(String(settings?.referralCommission?.GOLD ?? 5));
    setPlatinumCommission(String(settings?.referralCommission?.PLATINUM ?? 6));

    setPaymentVerificationEnabled(settings?.features?.paymentVerificationEnabled !== false);
    setReferralProgramEnabled(settings?.features?.referralProgramEnabled !== false);
    setAutoApproveEnabled(Boolean(settings?.features?.autoApproveLowRiskPayments));
    setMaintenanceMode(Boolean(settings?.maintenance?.enabled));
  };

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.admin.getSystemSettings();
      applySettings(response?.settings || {});
    } catch (loadError) {
      setError(loadError?.message || 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseNumber = (value, fieldName) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${fieldName} must be a valid number`);
    }
    return parsed;
  };

  const handleSave = async () => {
    setError('');

    let percentage;
    let minimumFee;
    let maximumFee;
    let starter;
    let silver;
    let gold;
    let platinum;

    try {
      percentage = parseNumber(platformFeePercent, 'Fee Percentage');
      minimumFee = parseNumber(minFee, 'Minimum Fee');
      maximumFee = parseNumber(maxFee, 'Maximum Fee');
      starter = parseNumber(starterCommission, 'Starter Tier');
      silver = parseNumber(silverCommission, 'Silver Tier');
      gold = parseNumber(goldCommission, 'Gold Tier');
      platinum = parseNumber(platinumCommission, 'Platinum Tier');

      if (percentage < 0 || percentage > 100) {
        throw new Error('Fee Percentage must be between 0 and 100');
      }
      if (minimumFee < 0) {
        throw new Error('Minimum Fee cannot be negative');
      }
      if (maximumFee < minimumFee) {
        throw new Error('Maximum Fee must be greater than or equal to Minimum Fee');
      }
      if (![starter, silver, gold, platinum].every((rate) => rate >= 0 && rate <= 100)) {
        throw new Error('Commission rates must be between 0 and 100');
      }
      if (!String(gcashNumber || '').trim()) {
        throw new Error('GCash Number is required');
      }
      if (!String(gcashName || '').trim()) {
        throw new Error('GCash Account Name is required');
      }
    } catch (validationError) {
      setError(validationError.message || 'Validation failed');
      return;
    }

    setSaving(true);
    try {
      const response = await api.admin.updateSystemSettings({
        platformFee: {
          percentage,
          minimumFee,
          maximumFee,
        },
        gcash: {
          accountNumber: String(gcashNumber).trim(),
          accountName: String(gcashName).trim(),
        },
        referralCommission: {
          STARTER: starter,
          SILVER: silver,
          GOLD: gold,
          PLATINUM: platinum,
        },
        features: {
          paymentVerificationEnabled,
          referralProgramEnabled,
          autoApproveLowRiskPayments: autoApproveEnabled,
        },
        maintenance: {
          enabled: maintenanceMode,
        },
      });

      applySettings(response?.settings || {});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save system settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '28px' : '20px' }}>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 px-4 py-2 text-sm">
            {error}
          </div>
        ) : <div />}
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={loading || saving} onClick={loadSettings}>
            <RefreshCw className={cn('size-4 mr-2', loading && 'animate-spin')} />
            Reload
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : saved ? (
              <CheckCircle2 className="size-4 mr-2" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <SettingCard
        title="Platform Fees"
        description="Configure the platform fee structure for transactions"
        icon={PesoIcon}
      >
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '16px' }}>
          <SettingInput
            label="Fee Percentage"
            value={platformFeePercent}
            onChange={setPlatformFeePercent}
            type="number"
            suffix="%"
            disabled={loading || saving}
          />
          <SettingInput
            label="Minimum Fee"
            value={minFee}
            onChange={setMinFee}
            type="number"
            prefix="PHP"
            disabled={loading || saving}
          />
          <SettingInput
            label="Maximum Fee"
            value={maxFee}
            onChange={setMaxFee}
            type="number"
            prefix="PHP"
            disabled={loading || saving}
          />
        </div>
      </SettingCard>

      <SettingCard
        title="GCash Account"
        description="Configure the GCash account for receiving payments"
        icon={CreditCard}
      >
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '16px' }}>
          <SettingInput
            label="GCash Number"
            value={gcashNumber}
            onChange={setGcashNumber}
            placeholder="09XXXXXXXXX"
            disabled={loading || saving}
          />
          <SettingInput
            label="Account Name"
            value={gcashName}
            onChange={setGcashName}
            placeholder="Account holder name"
            disabled={loading || saving}
          />
        </div>
      </SettingCard>

      <SettingCard
        title="Referral Commission Rates"
        description="Set commission percentages for each broker tier"
        icon={Percent}
      >
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: '16px' }}>
          <SettingInput
            label="Starter Tier"
            value={starterCommission}
            onChange={setStarterCommission}
            type="number"
            suffix="%"
            disabled={loading || saving}
          />
          <SettingInput
            label="Silver Tier"
            value={silverCommission}
            onChange={setSilverCommission}
            type="number"
            suffix="%"
            disabled={loading || saving}
          />
          <SettingInput
            label="Gold Tier"
            value={goldCommission}
            onChange={setGoldCommission}
            type="number"
            suffix="%"
            disabled={loading || saving}
          />
          <SettingInput
            label="Platinum Tier"
            value={platinumCommission}
            onChange={setPlatinumCommission}
            type="number"
            suffix="%"
            disabled={loading || saving}
          />
        </div>
      </SettingCard>

      <SettingCard
        title="Feature Toggles"
        description="Enable or disable platform features"
        icon={Settings}
      >
        <div className="space-y-0">
          <SettingToggle
            label="Payment Verification"
            description="Enable GCash payment screenshot verification"
            checked={paymentVerificationEnabled}
            onChange={setPaymentVerificationEnabled}
            disabled={loading || saving}
          />
          <SettingToggle
            label="Referral Program"
            description="Enable the broker referral program"
            checked={referralProgramEnabled}
            onChange={setReferralProgramEnabled}
            disabled={loading || saving}
          />
          <SettingToggle
            label="Auto-Approve Low Risk Payments"
            description="Automatically approve payments with fraud score below 10"
            checked={autoApproveEnabled}
            onChange={setAutoApproveEnabled}
            disabled={loading || saving}
          />
        </div>
      </SettingCard>

      <SettingCard
        title="Security & Maintenance"
        description="Platform security and maintenance settings"
        icon={Shield}
      >
        <div className="space-y-0">
          <SettingToggle
            label="Maintenance Mode"
            description="Put the platform in maintenance mode (users cannot access)"
            checked={maintenanceMode}
            onChange={setMaintenanceMode}
            disabled={loading || saving}
          />
        </div>
        {maintenanceMode && (
          <div className="mt-4 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Warning: Maintenance mode is enabled. Regular users cannot access the platform.
            </p>
          </div>
        )}
      </SettingCard>

      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800" style={{ padding: '24px' }}>
        <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">Danger Zone</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">
          These actions are irreversible. Please proceed with caution.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled
            className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <RefreshCw className="size-4 mr-2" />
            Clear Cache
          </Button>
          <Button
            variant="outline"
            disabled
            className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Bell className="size-4 mr-2" />
            Send System Alert
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SystemSettings;
