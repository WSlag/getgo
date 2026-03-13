import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, BookOpen, HelpCircle, MessageCircle, Shield, FileText,
  ChevronRight, ChevronDown, ChevronUp, Mail, Clock, Play, Send, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuth } from '@/contexts/AuthContext';
import { LegalPageContent } from '@/components/legal/LegalPageContent';
import {
  PRIVACY_POLICY_META,
  PRIVACY_POLICY_SECTIONS,
} from '@/data/privacyPolicyContent';
import {
  TERMS_OF_SERVICE_META,
  TERMS_OF_SERVICE_SECTIONS,
} from '@/data/termsOfServiceContent';
import {
  createSupportConversation,
  sendSupportMessage,
  getUserConversations,
  getConversationMessages,
  subscribeToUserConversations,
  subscribeToMessages,
  markConversationAsRead,
  SUPPORT_CATEGORIES,
  CONVERSATION_STATUS,
} from '@/services/supportMessageService';

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

function ContactSection({ onBack }) {
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
        style={{ padding: '24px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Mail className="size-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Email Support</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">support@getgoph.com</p>
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
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Chat Admin Section                                                */
/* ------------------------------------------------------------------ */

function ChatAdminSection({ onBack }) {
  const { userProfile, authUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('account');
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Load conversations on mount
  useEffect(() => {
    if (!authUser?.uid) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToUserConversations(
      authUser.uid,
      (convs) => {
        setConversations(convs);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error loading conversations:', error);
        setLoading(false);
        if (error?.code === 'unauthenticated') {
          setError('Your session is not ready yet. Please wait a moment and try again.');
        }
      }
    );

    return () => unsubscribe();
  }, [authUser?.uid]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation || !authUser?.uid) {
      setMessages([]);
      return;
    }

    const unsubscribe = subscribeToMessages(
      selectedConversation.id,
      (msgs) => {
        setMessages(msgs);
        setError(null);
      },
      (error) => {
        console.error('Error loading messages:', error);
        if (error?.code === 'unauthenticated') {
          setError('Your session expired. Please log in again.');
        }
      }
    );

    // Mark as read
    markConversationAsRead(selectedConversation.id, authUser.uid).catch((error) => {
      console.error('Failed to mark conversation as read:', error);
    });

    return () => unsubscribe();
  }, [selectedConversation?.id, authUser?.uid]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending || !authUser?.uid) return;

    setSending(true);
    setError(null);
    try {
      await sendSupportMessage(
        selectedConversation.id,
        authUser.uid,
        userProfile?.name || 'User',
        'user',
        newMessage.trim()
      );
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      if (error.code === 'permission-denied' || error.message?.includes('permission-denied')) {
        setError('Unable to send message. Please try logging out and back in.');
      } else if (error.code === 'unauthenticated') {
        setError('Your session is not ready yet. Please wait a moment and try again.');
      } else {
        setError('Failed to send message. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!newMessage.trim() || !authUser?.uid) return;

    setSending(true);
    setError(null);
    try {
      const result = await createSupportConversation(
        authUser.uid,
        userProfile?.name || 'User',
        userProfile?.role || 'shipper',
        newSubject,
        newMessage.trim()
      );
      setShowNewForm(false);
      setNewMessage('');
      // Select the new conversation
      const conv = conversations.find(c => c.id === result.id);
      if (conv) setSelectedConversation(conv);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      // Check if it's a permission error and provide helpful message
      if (error.code === 'permission-denied' || error.message?.includes('permission-denied')) {
        setError('Unable to connect to support. Please try logging out and back in, then refresh the page.');
      } else if (error.code === 'unauthenticated') {
        setError('Your session is not ready yet. Please wait a moment and try again.');
      } else if (error.code === 'invalid-argument') {
        setError(error.message);
      } else {
        setError('Failed to create conversation. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = Date.now();
    const time = timestamp instanceof Date ? timestamp.getTime() : timestamp;
    const diff = now - time;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      open: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', label: 'Open' },
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', label: 'Pending' },
      resolved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', label: 'Resolved' },
      closed: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', label: 'Closed' },
    };
    const config = statusConfig[status] || statusConfig.open;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  // New conversation form
  if (showNewForm) {
    return (
      <>
        <button
          onClick={() => setShowNewForm(false)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
          style={{ marginBottom: '16px' }}
        >
          <ArrowLeft className="size-4" />
          Back to Conversations
        </button>

        <div
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
          style={{ padding: '24px', marginBottom: '24px' }}
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="size-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">New Message</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400" style={{ marginTop: '2px' }}>
                Start a conversation with support
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
          style={{ padding: '24px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Category
              </label>
              <select
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {SUPPORT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Message
              </label>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Describe your issue or question..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                rows={6}
                maxLength={5000}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                {newMessage.length}/5000
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button
              onClick={handleCreateConversation}
              disabled={!newMessage.trim() || sending}
              className="w-full"
              variant="gradient"
            >
              {sending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Conversation detail view
  if (selectedConversation) {
    return (
      <>
        <button
          onClick={() => setSelectedConversation(null)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
          style={{ marginBottom: '16px' }}
        >
          <ArrowLeft className="size-4" />
          Back to Conversations
        </button>

        <div
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
          style={{ padding: '16px', marginBottom: '16px' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {SUPPORT_CATEGORIES.find(c => c.id === selectedConversation.subject)?.label || selectedConversation.subject}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(selectedConversation.status)}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTimeAgo(selectedConversation.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
          style={{ padding: '16px', marginBottom: '16px', maxHeight: '400px', overflowY: 'auto' }}
        >
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="size-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.map((msg) => {
                const isUser = msg.senderRole === 'user';
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '80%',
                        padding: '12px 16px',
                        borderRadius: '16px',
                        background: isUser
                          ? 'linear-gradient(to bottom right, #fb923c, #ea580c)'
                          : '#f3f4f6 dark:bg-gray-800',
                        color: isUser ? 'white' : '#111827',
                      }}
                    >
                      {!isUser && (
                        <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">
                          GetGo Support
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className="text-xs mt-1" style={{ color: isUser ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>
                        {formatTimeAgo(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Reply form */}
        {selectedConversation.status !== 'resolved' && selectedConversation.status !== 'closed' && (
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
            style={{ padding: '16px' }}
          >
            {/* Error message */}
            {error && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                rows={2}
                maxLength={5000}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sending}
                variant="gradient"
                className="self-end"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Conversations list
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="size-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Chat Admin</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400" style={{ marginTop: '2px' }}>
                Message our support team
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowNewForm(true)}
            variant="gradient"
            size="sm"
          >
            <MessageCircle className="size-4 mr-2" />
            New
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-8 text-center">
            <Loader2 className="size-6 text-orange-500 animate-spin mx-auto" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-8 text-center">
            <MessageCircle className="size-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No conversations yet. Start a new chat with support!
            </p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all text-left"
              style={{ padding: '16px' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {SUPPORT_CATEGORIES.find(c => c.id === conv.subject)?.label || conv.subject}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {conv.lastMessage}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getStatusBadge(conv.status)}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatTimeAgo(conv.updatedAt)}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
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
    id: 'chatAdmin',
    icon: MessageCircle,
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
    title: 'Chat Admin',
    desc: 'Message our support team',
  },
  {
    id: 'contact',
    icon: Mail,
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    title: 'Email Support',
    desc: 'Contact via email',
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

export function HelpSupportView({ onBack, onShowOnboardingGuide }) {
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

  if (activeSection === 'chatAdmin') {
    return (
      <Wrapper isMobile={isMobile}>
        <ChatAdminSection onBack={goMain} />
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
        <ContactSection onBack={goMain} />
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
