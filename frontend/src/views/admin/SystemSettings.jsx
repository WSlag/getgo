import React, { useState } from 'react';
import {
  Settings,
  DollarSign,
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
import { Button } from '@/components/ui/button';

// Setting card component
function SettingCard({ title, description, children, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
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

// Input field component
function SettingInput({ label, value, onChange, type = 'text', suffix, prefix, placeholder }) {
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
          className={cn(
            'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700',
            'bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white',
            'focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none',
            'transition-all duration-200',
            prefix && 'pl-8',
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

// Toggle switch component
function SettingToggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-12 h-6 rounded-full transition-colors duration-200',
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Platform fees settings
  const [platformFeePercent, setPlatformFeePercent] = useState('5');
  const [minFee, setMinFee] = useState('50');
  const [maxFee, setMaxFee] = useState('2000');

  // GCash settings
  const [gcashNumber, setGcashNumber] = useState('09123456789');
  const [gcashName, setGcashName] = useState('GetGo Logistics');

  // Referral commission settings
  const [starterCommission, setStarterCommission] = useState('3');
  const [silverCommission, setSilverCommission] = useState('4');
  const [goldCommission, setGoldCommission] = useState('5');
  const [platinumCommission, setPlatinumCommission] = useState('6');

  // Feature toggles
  const [paymentVerificationEnabled, setPaymentVerificationEnabled] = useState(true);
  const [referralProgramEnabled, setReferralProgramEnabled] = useState(true);
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
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

      {/* Platform Fees */}
      <SettingCard
        title="Platform Fees"
        description="Configure the platform fee structure for transactions"
        icon={DollarSign}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SettingInput
            label="Fee Percentage"
            value={platformFeePercent}
            onChange={setPlatformFeePercent}
            type="number"
            suffix="%"
          />
          <SettingInput
            label="Minimum Fee"
            value={minFee}
            onChange={setMinFee}
            type="number"
            prefix="₱"
          />
          <SettingInput
            label="Maximum Fee"
            value={maxFee}
            onChange={setMaxFee}
            type="number"
            prefix="₱"
          />
        </div>
      </SettingCard>

      {/* GCash Settings */}
      <SettingCard
        title="GCash Account"
        description="Configure the GCash account for receiving payments"
        icon={CreditCard}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingInput
            label="GCash Number"
            value={gcashNumber}
            onChange={setGcashNumber}
            placeholder="09XXXXXXXXX"
          />
          <SettingInput
            label="Account Name"
            value={gcashName}
            onChange={setGcashName}
            placeholder="Account holder name"
          />
        </div>
      </SettingCard>

      {/* Referral Commission Rates */}
      <SettingCard
        title="Referral Commission Rates"
        description="Set commission percentages for each broker tier"
        icon={Percent}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SettingInput
            label="Starter Tier"
            value={starterCommission}
            onChange={setStarterCommission}
            type="number"
            suffix="%"
          />
          <SettingInput
            label="Silver Tier"
            value={silverCommission}
            onChange={setSilverCommission}
            type="number"
            suffix="%"
          />
          <SettingInput
            label="Gold Tier"
            value={goldCommission}
            onChange={setGoldCommission}
            type="number"
            suffix="%"
          />
          <SettingInput
            label="Platinum Tier"
            value={platinumCommission}
            onChange={setPlatinumCommission}
            type="number"
            suffix="%"
          />
        </div>
      </SettingCard>

      {/* Feature Toggles */}
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
          />
          <SettingToggle
            label="Referral Program"
            description="Enable the broker referral program"
            checked={referralProgramEnabled}
            onChange={setReferralProgramEnabled}
          />
          <SettingToggle
            label="Auto-Approve Low Risk Payments"
            description="Automatically approve payments with fraud score below 10"
            checked={autoApproveEnabled}
            onChange={setAutoApproveEnabled}
          />
        </div>
      </SettingCard>

      {/* Security Settings */}
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

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6">
        <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">Danger Zone</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">
          These actions are irreversible. Please proceed with caution.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <RefreshCw className="size-4 mr-2" />
            Clear Cache
          </Button>
          <Button
            variant="outline"
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
