import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Inbox,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  sendSupportMessage,
  subscribeToAllConversations,
  subscribeToMessages,
  markConversationAsRead,
  updateConversationStatus,
  SUPPORT_CATEGORIES,
  CONVERSATION_STATUS,
} from '@/services/supportMessageService';

const STATUS_FILTERS = ['all', 'open', 'pending', 'resolved'];

const STATUS_CONFIG = {
  open: {
    icon: AlertCircle,
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    statText: 'text-blue-600 dark:text-blue-400',
  },
  pending: {
    icon: Clock,
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    statText: 'text-amber-600 dark:text-amber-400',
  },
  resolved: {
    icon: CheckCircle2,
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    statText: 'text-emerald-600 dark:text-emerald-400',
  },
  closed: {
    icon: CheckCircle2,
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    statText: 'text-gray-600 dark:text-gray-300',
  },
};

const ROLE_CONFIG = {
  shipper: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  trucker: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  broker: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

function toSafeDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate();
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTimeAgo(timestamp) {
  const date = toSafeDate(timestamp);
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function getCategoryLabel(subject) {
  return SUPPORT_CATEGORIES.find((category) => category.id === subject)?.label || subject || 'General';
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  const Icon = config.icon;
  const label = status?.charAt(0)?.toUpperCase() + status?.slice(1) || 'Open';

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-[3px] px-2.5 py-1 text-xs font-semibold', config.badge)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

function RoleBadge({ role }) {
  const normalizedRole = typeof role === 'string' ? role.toLowerCase() : '';
  const badgeClass = ROLE_CONFIG[normalizedRole] || ROLE_CONFIG.shipper;
  const label = normalizedRole ? normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1) : 'User';

  return (
    <span className={cn('inline-flex items-center rounded-[3px] px-2.5 py-1 text-xs font-semibold', badgeClass)}>
      {label}
    </span>
  );
}

function StatTile({ label, value, icon: Icon, toneClass, accentClass }) {
  return (
    <div className="rounded-sm border border-gray-200/80 bg-white/85 px-3 py-2.5 shadow-sm dark:border-gray-800 dark:bg-gray-900/75">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <span className={cn('inline-flex size-6 items-center justify-center rounded-[3px]', accentClass)}>
          <Icon className="size-3.5 text-white" />
        </span>
      </div>
      <p className={cn('text-xl font-bold leading-none', toneClass)}>{value}</p>
    </div>
  );
}

export function SupportMessagesView() {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const { authUser } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const selectedConversationId = selectedConversation?.id || null;
  const selectedConversationUpdatedAt = selectedConversation?.updatedAt || null;
  const selectedConversationStatus = selectedConversation?.status || null;
  const selectedConversationLastMessage = selectedConversation?.lastMessage || null;
  const selectedConversationAdminUnread = selectedConversation?.adminUnreadCount || 0;

  useEffect(() => {
    if (!authUser?.uid) {
      setLoading(false);
      return;
    }

    const status = statusFilter === 'all' ? null : statusFilter;
    const unsubscribe = subscribeToAllConversations(
      status,
      (nextConversations) => {
        setConversations(nextConversations);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.error('Error loading admin conversations:', snapshotError);
        setLoading(false);
        setError(
          snapshotError?.code === 'unauthenticated'
            ? 'Your session is not ready. Please sign in again.'
            : 'Failed to load support conversations.'
        );
      }
    );

    return () => unsubscribe();
  }, [statusFilter, authUser?.uid]);

  useEffect(() => {
    if (!selectedConversationId || !authUser?.uid) {
      setMessages([]);
      return;
    }

    const unsubscribe = subscribeToMessages(
      selectedConversationId,
      (nextMessages) => {
        setMessages(nextMessages);
        setError(null);
      },
      (snapshotError) => {
        console.error('Error loading support messages:', snapshotError);
        setError(
          snapshotError?.code === 'unauthenticated'
            ? 'Your session expired. Please sign in again.'
            : 'Failed to load support messages.'
        );
      }
    );

    markConversationAsRead(selectedConversationId, authUser.uid).catch((readError) => {
      console.error('Failed to mark admin conversation as read:', readError);
    });

    return () => unsubscribe();
  }, [selectedConversationId, authUser?.uid]);

  useEffect(() => {
    if (!selectedConversationId) return;

    const nextConversation = conversations.find((conversation) => conversation.id === selectedConversationId);
    if (!nextConversation) {
      setSelectedConversation(null);
      setMessages([]);
      return;
    }

    const previousUpdatedAt = toSafeDate(selectedConversationUpdatedAt)?.getTime() || 0;
    const nextUpdatedAt = toSafeDate(nextConversation.updatedAt)?.getTime() || 0;
    const conversationChanged = (
      previousUpdatedAt !== nextUpdatedAt
      || selectedConversationStatus !== nextConversation.status
      || selectedConversationLastMessage !== nextConversation.lastMessage
      || selectedConversationAdminUnread !== nextConversation.adminUnreadCount
    );

    if (conversationChanged) {
      setSelectedConversation(nextConversation);
    }
  }, [
    conversations,
    selectedConversationId,
    selectedConversationUpdatedAt,
    selectedConversationStatus,
    selectedConversationLastMessage,
    selectedConversationAdminUnread,
  ]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter((conversation) => (
      conversation.userName?.toLowerCase().includes(query)
      || conversation.subject?.toLowerCase().includes(query)
      || conversation.id?.toLowerCase().includes(query)
      || conversation.lastMessage?.toLowerCase().includes(query)
    ));
  }, [conversations, searchQuery]);

  const stats = useMemo(() => ({
    total: conversations.length,
    open: conversations.filter((conversation) => conversation.status === 'open').length,
    pending: conversations.filter((conversation) => conversation.status === 'pending').length,
    resolved: conversations.filter((conversation) => conversation.status === 'resolved').length,
  }), [conversations]);

  const workspaceHeight = isMobile ? 'calc(100dvh - 178px)' : 'calc(100vh - 232px)';
  const showConversationRail = !isMobile || !selectedConversation;
  const showChatPanel = !isMobile || Boolean(selectedConversation);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setError(null);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending || !authUser?.uid) return;

    setSending(true);
    setError(null);
    try {
      await sendSupportMessage(
        selectedConversation.id,
        authUser.uid,
        'GetGo Support',
        'admin',
        newMessage.trim()
      );
      setNewMessage('');
    } catch (sendError) {
      console.error('Failed to send message:', sendError);
      setError(
        sendError?.code === 'unauthenticated'
          ? 'Your session is not ready. Please sign in again.'
          : 'Failed to send support reply.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedConversation || sending || !authUser?.uid) return;

    setSending(true);
    setError(null);
    try {
      await updateConversationStatus(
        selectedConversation.id,
        CONVERSATION_STATUS.RESOLVED,
        authUser.uid
      );
      setShowResolveModal(false);
    } catch (resolveError) {
      console.error('Failed to resolve conversation:', resolveError);
      setError(
        resolveError?.code === 'unauthenticated'
          ? 'Your session is not ready. Please sign in again.'
          : 'Failed to resolve conversation.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-sm border border-gray-200/80 bg-white/90 p-4 shadow-sm dark:border-gray-800/80 dark:bg-gray-900/80 lg:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-[3px] bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/30">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">
                Inbox Overview
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Monitor conversations, prioritize urgent threads, and keep response times fast.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <StatTile
              label="Total"
              value={stats.total}
              icon={Inbox}
              toneClass="text-gray-900 dark:text-white"
              accentClass="bg-gradient-to-br from-slate-500 to-slate-600"
            />
            <StatTile
              label="Open"
              value={stats.open}
              icon={AlertCircle}
              toneClass={STATUS_CONFIG.open.statText}
              accentClass="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatTile
              label="Pending"
              value={stats.pending}
              icon={Clock}
              toneClass={STATUS_CONFIG.pending.statText}
              accentClass="bg-gradient-to-br from-amber-500 to-amber-600"
            />
            <StatTile
              label="Resolved"
              value={stats.resolved}
              icon={CheckCircle2}
              toneClass={STATUS_CONFIG.resolved.statText}
              accentClass="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
          </div>
        </div>
      </section>

      <section
        className="overflow-hidden rounded-sm border border-gray-200/80 bg-white/95 shadow-sm dark:border-gray-800 dark:bg-gray-950/75"
        style={{ height: workspaceHeight, minHeight: isMobile ? 520 : 560, maxHeight: 860 }}
      >
        <div className="flex h-full min-h-0">
          {showConversationRail && (
            <aside className={cn(
              'flex min-h-0 flex-col bg-white/95 dark:bg-gray-950/80',
              isMobile ? 'w-full' : 'w-[360px] border-r border-gray-200 dark:border-gray-800'
            )}>
              <div className="border-b border-gray-200 bg-gradient-to-r from-orange-50/70 via-white to-white px-4 py-4 dark:border-gray-800 dark:from-orange-950/20 dark:via-gray-950 dark:to-gray-950 lg:px-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Conversation Queue</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {filteredConversations.length} visible thread{filteredConversations.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search user, category, or message..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-10 rounded-[3px] border-gray-200 bg-white/90 pl-10 text-sm dark:border-gray-700 dark:bg-gray-900/80"
                  />
                </div>

                <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {STATUS_FILTERS.map((status) => {
                    const isActive = statusFilter === status;
                    const label = status.charAt(0).toUpperCase() + status.slice(1);

                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={cn(
                          'whitespace-nowrap rounded-[3px] px-3.5 py-1.5 text-xs font-semibold transition-all duration-200',
                          isActive
                            ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                            : 'border border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:text-orange-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-orange-700 dark:hover:text-orange-300'
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!selectedConversation && error && (
                <div className="mx-4 mt-4 rounded-[3px] border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                  <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-3 lg:p-4">
                {loading ? (
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                    <Loader2 className="mb-3 size-7 animate-spin text-orange-500" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading conversations...</p>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-sm border border-dashed border-gray-300 bg-gray-50/70 p-6 text-center dark:border-gray-700 dark:bg-gray-900/60">
                    <Inbox className="mb-3 size-9 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No conversations found</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Try adjusting the search or status filter.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredConversations.map((conversation) => {
                      const isSelected = selectedConversation?.id === conversation.id;
                      const unreadCount = Number(conversation.adminUnreadCount || 0);
                      const userInitial = conversation.userName?.trim()?.charAt(0)?.toUpperCase() || 'U';

                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => handleSelectConversation(conversation)}
                          className={cn(
                            'w-full rounded-sm border p-3.5 text-left transition-all duration-200',
                            'hover:-translate-y-0.5 hover:shadow-md',
                            isSelected
                              ? 'border-orange-300 bg-orange-50/80 shadow-lg shadow-orange-500/10 dark:border-orange-700 dark:bg-orange-900/20'
                              : 'border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/75'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[3px] text-sm font-bold',
                              isSelected
                                ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                            )}>
                              {userInitial}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                      {conversation.userName || 'User'}
                                    </p>
                                    {unreadCount > 0 && (
                                      <span className="inline-flex min-w-5 items-center justify-center rounded-[3px] bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                        {unreadCount}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                                    {getCategoryLabel(conversation.subject)}
                                  </p>
                                </div>
                                <span className="shrink-0 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                                  {formatTimeAgo(conversation.updatedAt)}
                                </span>
                              </div>

                              <p className="mt-2 truncate text-xs text-gray-600 dark:text-gray-300">
                                {conversation.lastMessage || 'No message yet'}
                              </p>

                              <div className="mt-3 flex items-center justify-between gap-2">
                                <StatusBadge status={conversation.status} />
                                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                  #{conversation.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          )}

          {showChatPanel && (
            <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-white via-white to-orange-50/20 dark:from-gray-950 dark:via-gray-950 dark:to-orange-950/10">
              {selectedConversation ? (
                <>
                  <div className="border-b border-gray-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 lg:px-6 lg:py-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        {isMobile && (
                          <button
                            type="button"
                            onClick={() => setSelectedConversation(null)}
                            className="mt-0.5 rounded-[3px] border border-gray-200 bg-white p-2 text-gray-500 transition-colors hover:border-orange-300 hover:text-orange-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-orange-700 dark:hover:text-orange-300"
                            aria-label="Back to conversations"
                          >
                            <ChevronLeft className="size-4" />
                          </button>
                        )}

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-gray-900 dark:text-white">
                              {selectedConversation.userName || 'User'}
                            </p>
                            <RoleBadge role={selectedConversation.userRole} />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{getCategoryLabel(selectedConversation.subject)}</span>
                            <span className="text-gray-300 dark:text-gray-600">•</span>
                            <span>Updated {formatTimeAgo(selectedConversation.updatedAt)}</span>
                            <span className="text-gray-300 dark:text-gray-600">•</span>
                            <span>#{selectedConversation.id.slice(0, 10)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusBadge status={selectedConversation.status} />
                        {selectedConversation.status !== 'resolved' && selectedConversation.status !== 'closed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-[3px]"
                            onClick={() => setShowResolveModal(true)}
                          >
                            <CheckCircle2 className="mr-1 size-4" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="px-4 pt-3 lg:px-6">
                      <div className="rounded-[3px] border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
                    {messages.length === 0 ? (
                      <div className="flex h-full min-h-[220px] items-center justify-center">
                        <div className="rounded-sm border border-dashed border-gray-300 bg-white/80 p-8 text-center dark:border-gray-700 dark:bg-gray-900/70">
                          <MessageSquare className="mx-auto mb-3 size-10 text-gray-300 dark:text-gray-600" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No messages yet</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Start the conversation by sending a reply below.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message) => {
                          const isAdmin = message.senderRole === 'admin';
                          return (
                            <div
                              key={message.id}
                              className={cn('flex', isAdmin ? 'justify-end' : 'justify-start')}
                            >
                              <div
                                className={cn(
                                  'max-w-[88%] rounded-[3px] px-4 py-3 shadow-sm sm:max-w-[75%] break-words [overflow-wrap:anywhere]',
                                  isAdmin
                                    ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-orange-500/20'
                                    : 'border border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
                                )}
                              >
                                <p className={cn(
                                  'mb-1 text-xs font-semibold',
                                  isAdmin ? 'text-orange-100' : 'text-orange-600 dark:text-orange-400'
                                )}>
                                  {isAdmin ? 'GetGo Support' : message.senderName || 'User'}
                                </p>
                                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed">{message.message}</p>
                                <p className={cn(
                                  'mt-1.5 text-xs',
                                  isAdmin ? 'text-orange-100/90' : 'text-gray-400 dark:text-gray-500'
                                )}>
                                  {formatTimeAgo(message.createdAt)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {selectedConversation.status !== 'resolved' && selectedConversation.status !== 'closed' ? (
                    <div
                      className="border-t border-gray-200 bg-white/95 px-3 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 lg:px-5 lg:py-4"
                      style={{ paddingBottom: isMobile ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : undefined }}
                    >
                      <div className="rounded-sm border border-gray-200 bg-gray-50/80 p-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-900/80 lg:p-3">
                        <div className="flex items-end gap-2">
                          <Textarea
                            value={newMessage}
                            onChange={(event) => setNewMessage(event.target.value)}
                            placeholder="Type your reply..."
                            rows={2}
                            className="min-h-[78px] flex-1 rounded-[3px] border-gray-200 bg-white text-sm dark:border-gray-700 dark:bg-gray-950"
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                handleSendMessage();
                              }
                            }}
                          />
                          <Button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() || sending}
                            variant="gradient"
                            size="icon"
                            className="size-11 shrink-0 rounded-[3px]"
                            aria-label="Send reply"
                          >
                            {sending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Send className="size-4" />
                            )}
                          </Button>
                        </div>
                        <p className="mt-2 px-1 text-[11px] text-gray-500 dark:text-gray-400">
                          Press Enter to send, Shift + Enter for a new line.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border-t border-gray-200 bg-gray-50/90 px-4 py-4 dark:border-gray-800 dark:bg-gray-900/70 lg:px-6"
                      style={{ paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : undefined }}
                    >
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-300">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        This conversation has been {selectedConversation.status}.
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="hidden h-full flex-1 items-center justify-center lg:flex">
                  <div className="max-w-sm rounded-sm border border-dashed border-gray-300 bg-white/80 p-8 text-center dark:border-gray-700 dark:bg-gray-900/70">
                    <MessageSquare className="mx-auto mb-3 size-11 text-gray-300 dark:text-gray-600" />
                    <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
                      Select a conversation
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Choose a thread from the queue to read messages and reply.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <Dialog open={showResolveModal} onOpenChange={setShowResolveModal}>
        <DialogContent className="rounded-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Conversation</DialogTitle>
            <DialogDescription className="sr-only">Confirm conversation resolution</DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Mark this conversation as resolved? The user will see the updated status.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-[3px]" onClick={() => setShowResolveModal(false)} disabled={sending}>
                Cancel
              </Button>
              <Button variant="gradient" className="rounded-[3px]" onClick={handleResolve} disabled={sending}>
                {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Resolve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SupportMessagesView;

