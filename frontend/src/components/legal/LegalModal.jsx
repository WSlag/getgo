import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Shield, FileText } from 'lucide-react';
import {
  PRIVACY_POLICY_META,
  PRIVACY_POLICY_SECTIONS,
} from '@/data/privacyPolicyContent';
import {
  TERMS_OF_SERVICE_META,
  TERMS_OF_SERVICE_SECTIONS,
} from '@/data/termsOfServiceContent';

const CONFIG = {
  privacy: {
    meta: PRIVACY_POLICY_META,
    sections: PRIVACY_POLICY_SECTIONS,
    icon: Shield,
    iconBg: 'from-purple-400 to-purple-600',
    iconShadow: 'shadow-purple-500/30',
  },
  terms: {
    meta: TERMS_OF_SERVICE_META,
    sections: TERMS_OF_SERVICE_SECTIONS,
    icon: FileText,
    iconBg: 'from-orange-400 to-orange-600',
    iconShadow: 'shadow-orange-500/30',
  },
};

export function LegalModal({ open, onClose, type }) {
  const config = CONFIG[type];
  if (!config) return null;

  const { meta, sections, icon: Icon, iconBg, iconShadow } = config;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col backdrop-blur-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`size-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br ${iconBg} ${iconShadow}`}
            >
              <Icon className="size-5 text-white" />
            </div>
            <div>
              <DialogTitle>{meta.title}</DialogTitle>
              <DialogDescription>Last Updated: {meta.lastUpdated}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div
          className="flex-1 overflow-y-auto -mx-6 px-6"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px', paddingBottom: '16px' }}
        >
          {sections.map((section) => (
            <div key={section.id}>
              <h3
                className="text-sm font-semibold text-gray-900 dark:text-white"
                style={{ marginBottom: '8px' }}
              >
                {section.title}
              </h3>
              <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LegalModal;
