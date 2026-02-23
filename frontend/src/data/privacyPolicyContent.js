export const PRIVACY_POLICY_META = {
  title: 'Privacy Policy',
  lastUpdated: 'February 11, 2026',
  effectiveDate: 'February 11, 2026',
};

export const PRIVACY_POLICY_SECTIONS = [
  {
    id: 'introduction',
    title: '1. Introduction',
    content:
      'GetGo ("GetGo," "we," "us," or "our") is a trucking backload marketplace that connects shippers and truckers in the Philippines. This Privacy Policy explains how we collect, use, share, store, and protect personal data when you use our website, mobile web app, and related services (the "Services").\n\nBy using GetGo, you acknowledge that your personal data will be processed as described in this Privacy Policy.',
  },
  {
    id: 'scope',
    title: '2. Scope',
    content:
      'This Privacy Policy applies to personal data processed through:\n\n• User registration and authentication\n• Profile management\n• Cargo and truck listing features\n• Bidding, contracts, chat, ratings, and notifications\n• Shipment tracking features\n• GCash screenshot-based payment verification features\n• Customer support and operational security workflows',
  },
  {
    id: 'information-we-collect',
    title: '3. Information We Collect',
    content:
      'We collect information you provide directly, information generated through your use of the Services, and information from integrated service providers.\n\nA. Account and Profile Information\n• Phone number (used for OTP authentication)\n• Name\n• Email address (if provided)\n• Role and profile details (shipper/trucker/broker)\n• Business-related profile details you provide (for example, business name)\n• Optional profile fields (for example, Facebook URL and profile image)\n\nB. Marketplace and Transaction Information\n• Cargo and truck listing details (for example, route, cargo/truck specs, photos, asking price, schedule)\n• Bids, prices, contract details, and ratings\n• Wallet/order/payment records used by the platform\n\nC. Communication and Notification Data\n• Chat messages exchanged between authorized parties in a bid\n• In-app notifications and message read/unread status\n\nD. Shipment and Location Data\n• Shipment details and tracking identifiers\n• Location updates submitted for shipment tracking (including coordinates and derived place labels)\n• Shipment status progression and delivery timestamps\n\nE. Payment Verification Data\nFor GCash screenshot verification workflows, we may process:\n• Payment screenshot image files you upload\n• Screenshot URL and metadata\n• OCR-extracted receipt fields (for example, reference number, amount, sender/receiver names, timestamp, raw text excerpt)\n• Image-analysis metadata (for example, image hash, dimensions, EXIF indicators)\n• Fraud-detection outcomes, validation results, and audit logs\n\nF. Technical and Usage Data\n• Firebase Authentication and security tokens\n• Basic API and system logs necessary for security and operations\n• Analytics events and usage signals (via Firebase Analytics, where enabled)\n• Local browser storage data used for app functionality (for example, saved theme preference and offline Firestore cache)',
  },
  {
    id: 'how-we-use',
    title: '4. How We Use Personal Data',
    content:
      'We use personal data to:\n\n• Create and manage user accounts\n• Authenticate users and prevent unauthorized access\n• Operate marketplace features (listings, bids, contracts, chat, ratings, and notifications)\n• Enable shipment tracking and related updates\n• Process and verify payment submissions (including OCR and anti-fraud checks)\n• Enforce platform rules, prevent fraud, and investigate abuse\n• Maintain security, monitor performance, and troubleshoot issues\n• Improve product functionality and user experience\n• Comply with legal obligations and respond to lawful requests',
  },
  {
    id: 'legal-bases',
    title: '5. Legal Bases and Compliance',
    content:
      'Where applicable, we process personal data based on one or more of the following:\n\n• Performance of a contract with you\n• Legitimate interests (for example, service security, fraud prevention, and product improvement)\n• Your consent (where required)\n• Compliance with legal obligations\n\nGetGo is intended to operate in alignment with applicable Philippine privacy requirements, including the Data Privacy Act of 2012 (Republic Act No. 10173), where applicable.',
  },
  {
    id: 'sharing',
    title: '6. How We Share Personal Data',
    content:
      'We do not sell personal data. We may share personal data in the following cases:\n\nA. With Other Users\nLimited profile and transaction-relevant data may be shared with counterparties (for example, shippers and truckers involved in listings, bids, contracts, and shipments).\n\nB. With Service Providers and Infrastructure Partners\n• Google Firebase / Google Cloud (Authentication, Firestore, Storage, Cloud Functions, Analytics)\n• Google Cloud Vision API (OCR for payment screenshot verification)\n• OpenRouteService (route, geocoding, and related mapping support where enabled)\n\nThese providers process data as needed to deliver platform functionality.\n\nC. For Legal and Safety Reasons\nWe may disclose data when required by law, regulation, legal process, or to protect rights, safety, security, and platform integrity.\n\nD. Business Transfers\nIf we undergo a merger, acquisition, restructuring, or asset transfer, data may be transferred as part of that transaction, subject to applicable law.',
  },
  {
    id: 'international-transfers',
    title: '7. International Data Transfers',
    content:
      'Because our infrastructure providers may process data in multiple regions, your information may be transferred to or processed in jurisdictions outside your location. We take reasonable steps to ensure appropriate safeguards for such transfers.',
  },
  {
    id: 'data-retention',
    title: '8. Data Retention',
    content:
      'We retain personal data only as long as necessary for legitimate business purposes, contractual obligations, security/fraud prevention, and legal compliance. Retention periods may vary by data type:\n\n• Account and profile data: retained while account remains active and as required for compliance\n• Transaction and audit records: retained for operational, fraud, and legal purposes\n• Payment verification artifacts (including logs): retained based on risk, audit, and compliance needs\n\nWhen data is no longer needed, we delete or de-identify it where reasonably practicable.',
  },
  {
    id: 'data-security',
    title: '9. Data Security',
    content:
      'We implement administrative, technical, and organizational safeguards designed to protect personal data, including access controls, authenticated access flows, and backend-restricted operations for sensitive actions. No system is completely secure, and we cannot guarantee absolute security.',
  },
  {
    id: 'your-rights',
    title: '10. Your Rights and Choices',
    content:
      'Subject to applicable law, you may have rights to:\n\n• Access personal data we hold about you\n• Correct inaccurate or incomplete information\n• Request deletion or restriction in certain circumstances\n• Object to certain processing\n• Withdraw consent where processing is based on consent\n\nTo submit a request, contact us using the details in Section 13.',
  },
  {
    id: 'childrens-privacy',
    title: "11. Children's Privacy",
    content:
      'GetGo is not intended for children. We do not knowingly collect personal data from children in violation of applicable law. If you believe a child has provided personal data, contact us so we can take appropriate action.',
  },
  {
    id: 'changes',
    title: '12. Changes to This Privacy Policy',
    content:
      'We may update this Privacy Policy from time to time. When we do, we will revise the "Last Updated" date and, where required, provide additional notice.',
  },
  {
    id: 'contact',
    title: '13. Contact Us',
    content:
      'For privacy questions, requests, or complaints, contact:\n\n• Company/Entity Name: GetGo\n• Email: support@getgo.ph\n\nIf required under applicable law, you may also contact the National Privacy Commission (Philippines) regarding data privacy concerns.',
  },
];
