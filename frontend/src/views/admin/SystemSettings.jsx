import { useEffect, useState, useRef } from 'react';
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
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { Switch } from '@/components/ui/switch';
import api from '@/services/api';

function SettingCard({ title, description, children, icon: Icon }) {
  return (
    <AppCard className="p-4 lg:p-6">
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-orange-100 dark:bg-orange-900/30">
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
    </AppCard>
  );
}

function SettingInput({ label, value, onChange, type = 'text', suffix, prefix, placeholder, disabled = false }) {
  return (
    <div className="mb-4">
      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
            {prefix}
          </span>
        )}
        <AppInput
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="mb-0"
          inputClassName={cn(
            prefix && 'pl-14',
            suffix && 'pr-16'
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SettingToggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 dark:border-gray-700 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={() => onChange(!checked)}
        className={cn(
          'h-6 w-11 border-0 shadow-none',
          'data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600',
          disabled && 'opacity-60'
        )}
      />
    </div>
  );
}

export function SystemSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [platformFeePercent, setPlatformFeePercent] = useState('5');
  const [minFee, setMinFee] = useState('50');
  const [maxFee, setMaxFee] = useState('2000');

  const [gcashNumber, setGcashNumber] = useState('09272241557');
  const [gcashName, setGcashName] = useState('GetGo Logistics');

  const [starterCommission, setStarterCommission] = useState('3');
  const [silverCommission, setSilverCommission] = useState('4');
  const [goldCommission, setGoldCommission] = useState('5');
  const [platinumCommission, setPlatinumCommission] = useState('6');

  const [paymentVerificationEnabled, setPaymentVerificationEnabled] = useState(true);
  const [referralProgramEnabled, setReferralProgramEnabled] = useState(true);
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const savedTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const applySettings = (settings = {}) => {
    setPlatformFeePercent(String(settings?.platformFee?.percentage ?? 5));
    setMinFee(String(settings?.platformFee?.minimumFee ?? 50));
    setMaxFee(String(settings?.platformFee?.maximumFee ?? 2000));

    setGcashNumber(String(settings?.gcash?.accountNumber ?? '09272241557'));
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
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        savedTimerRef.current = null;
        setSaved(false);
      }, 3000);
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save system settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 lg:gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {error ? (
          <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        ) : <div />}
        <div className="flex items-center gap-2">
          <AppButton variant="outline" size="md" disabled={loading || saving} onClick={loadSettings}>
            <RefreshCw className={cn('size-4 mr-2', loading && 'animate-spin')} />
            Reload
          </AppButton>
          <AppButton
            onClick={handleSave}
            disabled={saving || loading}
            variant={saved ? 'success' : 'primary'}
            size="md"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : saved ? (
              <CheckCircle2 className="size-4 mr-2" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            {saved ? 'Saved!' : 'Save Changes'}
          </AppButton>
        </div>
      </div>

      <SettingCard
        title="Platform Fees"
        description="Configure the platform fee structure for transactions"
        icon={PesoIcon}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
          <div className="mt-4 rounded-[14px] border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Warning: Maintenance mode is enabled. Regular users cannot access the platform.
            </p>
          </div>
        )}
      </SettingCard>

      <AppCard className="border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20 lg:p-6">
        <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">Danger Zone</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">
          These actions are irreversible. Please proceed with caution.
        </p>
        <div className="flex flex-wrap gap-3">
          <AppButton
            variant="danger"
            size="md"
            disabled
          >
            <RefreshCw className="size-4 mr-2" />
            Clear Cache
          </AppButton>
          <AppButton
            variant="danger"
            size="md"
            disabled
          >
            <Bell className="size-4 mr-2" />
            Send System Alert
          </AppButton>
        </div>
      </AppCard>
    </div>
  );
}

export default SystemSettings;
