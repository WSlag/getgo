import { useState, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, HelpCircle, MessageCircle, Shield, FileText,
  ChevronRight, ChevronDown, ChevronUp, Mail, Clock, Play, Send, CheckCircle, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { sendSupportMessage } from '@/services/firestoreService';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { LegalPageContent } from '@/components/legal/LegalPageContent';
import {
  PRIVACY_POLICY_META,
  PRIVACY_POLICY_SECTIONS,
} from '@/data/privacyPolicyContent';
import {
  TERMS_OF_SERVICE_META,
  TERMS_OF_SERVICE_SECTIONS,
} from '@/data/termsOfServiceContent';

/* ------------------------------------------------------------------ */
/*  FAQ Data                                                           */
/* ------------------------------------------------------------------ */

const FAQ_CATEGORIES = [
  {
    id: 'general',
    label: 'General',
    questions: [
      {
        q: 'What is GetGo?',
        a: 'GetGo is a trucking backload marketplace that connects shippers who need cargo transported with truckers who have available truck capacity in the Philippines. It helps reduce empty backhauls and lowers freight costs for everyone.',
      },
      {
        q: 'How does GetGo work?',
        a: 'Shippers post cargo listings with route, cargo details, and pricing. Truckers browse listings and submit bids. When a shipper accepts a bid, a contract is formed. Payment is processed via GCash and the shipment can be tracked in real-time.',
      },
      {
        q: 'Is GetGo free to use?',
        a: 'Creating an account and browsing is free. GetGo charges a 5% platform fee on completed transactions.',
      },
      {
        q: 'What areas does GetGo cover?',
        a: 'GetGo operates across the Philippines, connecting shippers and truckers for both local and inter-island freight routes.',
      },
    ],
  },
  {
    id: 'shippers',
    label: 'For Shippers',
    questions: [
      {
        q: 'How do I post a cargo listing?',
        a: 'From the Home tab, tap "Post Cargo" and fill in your route (pickup and delivery locations), cargo details (type, weight, dimensions), schedule, and your asking price. Your listing will be visible to truckers who can then submit bids.',
      },
      {
        q: 'How do I choose a trucker?',
        a: 'When truckers bid on your listing, you can review their profiles, ratings, truck details, and bid prices. You can chat with bidders to negotiate terms before accepting the best offer.',
      },
      {
        q: 'How do I pay for a shipment?',
        a: 'Payments are processed via GCash. After a contract is formed, you send payment through GCash and upload a screenshot for verification. The platform verifies the payment automatically.',
      },
    ],
  },
  {
    id: 'truckers',
    label: 'For Truckers',
    questions: [
      {
        q: 'How do I find cargo to transport?',
        a: 'Browse available cargo listings on the Home tab. You can filter by route, cargo type, and price range to find loads that match your truck capacity and schedule.',
      },
      {
        q: 'How do I submit a bid?',
        a: 'On any cargo listing, tap "Bid" and enter your proposed freight rate. You can also chat with the shipper to discuss details before or after bidding.',
      },
      {
        q: 'When do I get paid?',
        a: 'Payment is arranged between you and the shipper via GCash as specified in the contract. The platform tracks payment verification to ensure both parties are protected.',
      },
    ],
  },
  {
    id: 'payments',
    label: 'Payments & Contracts',
    questions: [
      {
        q: 'What payment methods are supported?',
        a: 'Currently, GetGo supports GCash for payments between shippers and truckers. Payment screenshots are verified automatically through the platform.',
      },
      {
        q: 'What is the platform fee?',
        a: 'GetGo charges a 5% platform fee on completed transactions. This fee helps maintain the platform, provide support, and continue improving the service.',
      },
      {
        q: 'How do contracts work?',
        a: 'When a shipper accepts a trucker\'s bid, a digital contract is generated with the agreed terms — freight rate, cargo details, liability, and payment terms. Both parties must sign the contract before the shipment begins.',
      },
      {
        q: 'What if there\'s a payment dispute?',
        a: 'Users should first attempt to resolve disputes directly through the in-app chat. If needed, contact GetGo support for mediation assistance.',
      },
    ],
  },
  {
    id: 'safety',
    label: 'Safety & Trust',
    questions: [
      {
        q: 'How does GetGo verify users?',
        a: 'All users verify their phone number via OTP during registration. Truckers provide license and vehicle information. The rating and review system helps build trust between users over time.',
      },
      {
        q: 'What happens if cargo is damaged?',
        a: 'Cargo liability is outlined in each contract, including declared value limits. We recommend declaring accurate cargo values and discussing insurance with your counterparty before shipment.',
      },
      {
        q: 'How do ratings work?',
        a: 'After a completed transaction, both shippers and truckers can rate each other. Ratings are based on actual experience and help other users make informed decisions.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Getting Started Steps                                              */
/* ------------------------------------------------------------------ */

const GETTING_STARTED = {
  shipper: [
    { title: 'Create Your Account', desc: 'Sign up with your phone number and complete your shipper profile with business details.' },
    { title: 'Post Your Cargo', desc: 'Create a cargo listing with your route, cargo details, schedule, and asking price.' },
    { title: 'Review Bids & Chat', desc: 'Compare bids from truckers, check their ratings and profiles, and negotiate terms via chat.' },
    { title: 'Sign Contract & Pay', desc: 'Accept the best bid, sign the digital contract, and pay securely via GCash.' },
  ],
  trucker: [
    { title: 'Create Your Account', desc: 'Sign up with your phone number and complete your trucker profile with license and truck details.' },
    { title: 'Find Cargo Listings', desc: 'Browse available cargo that matches your route and truck capacity.' },
    { title: 'Bid & Negotiate', desc: 'Submit competitive bids and chat with shippers to finalize terms.' },
    { title: 'Complete & Earn', desc: 'Sign the contract, deliver the cargo safely, and receive payment via GCash.' },
  ],
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FAQSection({ onBack }) {
  const [openItem, setOpenItem] = useState(null);

  const toggle = (key) => setOpenItem(openItem === key ? null : key);

  return (
    <>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
        style={{ marginBottom: '16px' }}
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
        style={{ padding: '24px', marginBottom: '24px' }}
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Frequently Asked Questions
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400" style={{ marginTop: '2px' }}>
              Find answers to common questions
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {FAQ_CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
            style={{ padding: '20px 24px' }}
          >
            <h2
              className="text-base font-semibold text-gray-900 dark:text-white"
              style={{ marginBottom: '12px' }}
            >
              {cat.label}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {cat.questions.map((item, i) => {
                const key = `${cat.id}-${i}`;
                const isOpen = openItem === key;
                return (
                  <div key={key}>
                    <button
                      onClick={() => toggle(key)}
                      className="w-full flex items-center justify-between text-left rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      style={{ padding: '12px' }}
                    >
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 pr-4">
                        {item.q}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="size-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="size-4 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div
                        className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed"
                        style={{ padding: '0 12px 12px 12px' }}
                      >
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function GettingStartedSection({ onBack, onShowOnboardingGuide }) {
  return (
    <>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
        style={{ marginBottom: '16px' }}
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
        style={{ padding: '24px', marginBottom: '24px' }}
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
            <BookOpen className="size-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Getting Started</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400" style={{ marginTop: '2px' }}>
              Learn how to use GetGo
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Guide Button */}
      {onShowOnboardingGuide && (
        <Button
          variant="gradient"
          onClick={onShowOnboardingGuide}
          className="w-full"
          style={{ marginBottom: '24px', padding: '14px 24px' }}
        >
          <Play className="size-4 mr-2" />
          Launch Interactive Guide
        </Button>
      )}

      {/* Shipper Steps */}
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
        style={{ padding: '20px 24px', marginBottom: '16px' }}
      >
        <h2
          className="text-base font-semibold text-gray-900 dark:text-white"
          style={{ marginBottom: '16px' }}
        >
          For Shippers
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {GETTING_STARTED.shipper.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="size-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 text-xs font-bold text-orange-600">
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{step.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400" style={{ marginTop: '2px' }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trucker Steps */}
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
        style={{ padding: '20px 24px' }}
      >
        <h2
          className="text-base font-semibold text-gray-900 dark:text-white"
          style={{ marginBottom: '16px' }}
        >
          For Truckers
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {GETTING_STARTED.trucker.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="size-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-600">
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{step.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400" style={{ marginTop: '2px' }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ContactSection({ onBack, currentUser }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const MAX_MESSAGE_LENGTH = 2000;

  // Fetch user's support messages
  useEffect(() => {
    if (!currentUser?.uid) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const { getUserSupportMessages } = await import('@/services/firestoreService');
        const userMessages = await getUserSupportMessages(currentUser.uid, 10);
        setMessages(userMessages);
      } catch (err) {
        console.error('Failed to fetch support messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();

    // Refresh messages every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.uid]);

  const handleSendMessage = async () => {
    if (!message.trim() || !currentUser) return;

    setSending(true);
    setSendStatus(null);
    setErrorMessage('');

    try {
      const userName = currentUser.displayName || currentUser.name || 'User';
      const { sendSupportMessage, getUserSupportMessages } = await import('@/services/firestoreService');

      await sendSupportMessage(
        currentUser.uid,
        userName,
        message.trim(),
        'support'
      );

      // Refresh messages after sending
      const userMessages = await getUserSupportMessages(currentUser.uid, 10);
      setMessages(userMessages);

      setSendStatus('success');
      setMessage('');

      setTimeout(() => setSendStatus(null), 5000);
    } catch (err) {
      console.error('Failed to send support message:', err);
      setSendStatus('error');
      setErrorMessage(err.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleSendMessage();
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
        style={{ marginBottom: '16px' }}
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
        style={{ padding: '24px', marginBottom: '24px' }}
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="size-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Contact Support</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400" style={{ marginTop: '2px' }}>
              Get help from our team
            </p>
          </div>
        </div>
      </div>

      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
        style={{ padding: '24px', marginBottom: '24px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Mail className="size-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Email Support</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">support@getgo.ph</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div className="size-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <Clock className="size-5 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Support Hours</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Monday – Friday, 8:00 AM – 6:00 PM (PHT)
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/50" style={{ padding: '16px' }}>
            <p className="text-sm text-orange-800 dark:text-orange-300 font-medium">
              Response Time
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400" style={{ marginTop: '4px' }}>
              We typically respond within 24 hours during business days. For urgent matters related to active shipments, please mention your contract number in your message.
            </p>
          </div>
        </div>
      </div>

      {/* In-App Message Form */}
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
        style={{ padding: '24px' }}
      >
        <div style={{ marginBottom: '16px' }}>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Send us a message
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400" style={{ marginTop: '4px' }}>
            Describe your issue and we&apos;ll get back to you as soon as possible.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            disabled={sending}
            className="min-h-[120px] resize-none"
            maxLength={MAX_MESSAGE_LENGTH}
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || sending || !currentUser}
              className="flex items-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Send Message
                </>
              )}
            </Button>
          </div>

          {sendStatus === 'success' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50">
              <CheckCircle className="size-4 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-300">
                Message sent successfully! We&apos;ll get back to you soon.
              </p>
            </div>
          )}

          {sendStatus === 'error' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50">
              <MessageCircle className="size-4 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-300">
                {errorMessage}
              </p>
            </div>
          )}

          {!currentUser && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
              <MessageCircle className="size-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Please sign in to send a message to support.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Message History */}
      {currentUser && messages.length > 0 && (
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
          style={{ padding: '24px' }}
        >
          <div style={{ marginBottom: '16px' }}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Your Messages
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400" style={{ marginTop: '4px' }}>
              View your conversation history with our support team.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {loadingMessages && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading messages...</span>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
              >
                {/* User Message */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      You
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {msg.message}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      msg.status === 'open'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : msg.status === 'in_progress'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {msg.status === 'open' ? 'Open' : msg.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                    </span>
                  </div>
                </div>

                {/* Admin Replies */}
                {msg.replies && msg.replies.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    {msg.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="p-4 bg-green-50/50 dark:bg-green-950/10 border-l-4 border-green-500"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                            <MessageCircle className="size-3" />
                            {reply.adminName || 'Support Team'}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatDate(reply.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                          {reply.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Menu Cards                                                    */
/* ------------------------------------------------------------------ */

const MENU_ITEMS = [
  {
    id: 'gettingStarted',
    icon: BookOpen,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    title: 'Getting Started',
    desc: 'Learn how to use GetGo',
  },
  {
    id: 'faq',
    icon: HelpCircle,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'FAQ',
    desc: 'Common questions answered',
  },
  {
    id: 'contact',
    icon: MessageCircle,
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    title: 'Contact Support',
    desc: 'Get help from our team',
  },
  {
    id: 'privacy',
    icon: Shield,
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
    title: 'Privacy Policy',
    desc: 'How we handle your data',
  },
  {
    id: 'terms',
    icon: FileText,
    iconBg: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-600 dark:text-gray-400',
    title: 'Terms of Service',
    desc: 'Platform rules and agreements',
  },
];

/* ------------------------------------------------------------------ */
/*  HelpSupportView                                                    */
/* ------------------------------------------------------------------ */

export function HelpSupportView({ onBack, onShowOnboardingGuide, currentUser }) {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [activeSection, setActiveSection] = useState('main');

  const goMain = () => setActiveSection('main');

  /* Sub-section routing */
  if (activeSection === 'faq') {
    return (
      <Wrapper isMobile={isMobile}>
        <FAQSection onBack={goMain} />
      </Wrapper>
    );
  }

  if (activeSection === 'gettingStarted') {
    return (
      <Wrapper isMobile={isMobile}>
        <GettingStartedSection onBack={goMain} onShowOnboardingGuide={onShowOnboardingGuide} />
      </Wrapper>
    );
  }

  if (activeSection === 'contact') {
    return (
      <Wrapper isMobile={isMobile}>
        <ContactSection onBack={goMain} currentUser={currentUser} />
      </Wrapper>
    );
  }

  if (activeSection === 'privacy') {
    return (
      <LegalPageContent
        title={PRIVACY_POLICY_META.title}
        lastUpdated={PRIVACY_POLICY_META.lastUpdated}
        effectiveDate={PRIVACY_POLICY_META.effectiveDate}
        sections={PRIVACY_POLICY_SECTIONS}
        onBack={goMain}
      />
    );
  }

  if (activeSection === 'terms') {
    return (
      <LegalPageContent
        title={TERMS_OF_SERVICE_META.title}
        lastUpdated={TERMS_OF_SERVICE_META.lastUpdated}
        effectiveDate={TERMS_OF_SERVICE_META.effectiveDate}
        sections={TERMS_OF_SERVICE_SECTIONS}
        onBack={goMain}
      />
    );
  }

  /* Main menu */
  return (
    <Wrapper isMobile={isMobile}>
      {/* Back */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
          style={{ marginBottom: '16px' }}
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      )}

      {/* Header */}
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
        style={{ padding: '24px', marginBottom: '24px' }}
      >
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/30">
            <HelpCircle className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Help & Support</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400" style={{ marginTop: '2px' }}>
              How can we help you today?
            </p>
          </div>
        </div>
      </div>

      {/* Menu Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className="w-full flex items-center justify-between bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 group text-left"
              style={{ padding: '16px 20px' }}
            >
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-lg ${item.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  <Icon className={`size-5 ${item.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                </div>
              </div>
              <ChevronRight className="size-5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          );
        })}
      </div>
    </Wrapper>
  );
}

/* Shared page wrapper */
function Wrapper({ isMobile, children }) {
  return (
    <main
      className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto"
      style={{
        padding: isMobile ? '16px' : '24px',
        paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px',
      }}
    >
      <div className="max-w-2xl mx-auto">{children}</div>
    </main>
  );
}

export default HelpSupportView;
