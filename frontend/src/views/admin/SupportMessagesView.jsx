import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  User,
  Loader2,
  ChevronLeft,
  X,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  sendSupportMessage,
  getAllConversations,
  getConversationMessages,
  subscribeToAllConversations,
  subscribeToMessages,
  markConversationAsRead,
  updateConversationStatus,
  SUPPORT_CATEGORIES,
  CONVERSATION_STATUS,
} from '@/services/supportMessageService';
import { useAuth } from '@/contexts/AuthContext';

/* ------------------------------------------------------------------ */
/*  Status Badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }) {
  const config = {
    open: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: AlertCircle },
    pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', icon: Clock },
    resolved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: CheckCircle2 },
    closed: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', icon: CheckCircle2 },
  };

  const { bg, text, icon: Icon } = config[status] || config.open;
  const label = status?.charAt(0).toUpperCase() + status?.slice(1) || 'Open';

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Role Badge                                                         */
/* ------------------------------------------------------------------ */

function RoleBadge({ role }) {
  const config = {
    shipper: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
    trucker: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
    broker: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
  };

  const { bg, text } = config[role] || config.shipper;
  const label = role?.charAt(0).toUpperCase() + role?.slice(1) || 'User';

  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', bg, text)}>
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

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
  const [resolveNote, setResolveNote] = useState('');
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);

  // Load conversations
  useEffect(() => {
    if (!authUser?.uid) {
      setLoading(false);
      return;
    }

    const status = statusFilter === 'all' ? null : statusFilter;
    const unsubscribe = subscribeToAllConversations(
      status,
      (convs) => {
        setConversations(convs);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.error('Error loading admin conversations:', snapshotError);
        setLoading(false);
        setError(snapshotError?.code === 'unauthenticated'
          ? 'Your session is not ready. Please sign in again.'
          : 'Failed to load support conversations.');
      }
    );

    return () => unsubscribe();
  }, [statusFilter, authUser?.uid]);

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
      (snapshotError) => {
        console.error('Error loading support messages:', snapshotError);
        setError(snapshotError?.code === 'unauthenticated'
          ? 'Your session expired. Please sign in again.'
          : 'Failed to load support messages.');
      }
    );

    // Mark as read
    markConversationAsRead(selectedConversation.id, authUser.uid).catch((readError) => {
      console.error('Failed to mark admin conversation as read:', readError);
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
        'GetGo Support',
        'admin',
        newMessage.trim()
      );
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      if (error?.code === 'unauthenticated') {
        setError('Your session is not ready. Please sign in again.');
      } else {
        setError('Failed to send support reply.');
      }
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
      setResolveNote('');
      // Refresh selected conversation
      const updated = conversations.find(c => c.id === selectedConversation.id);
      if (updated) setSelectedConversation(updated);
    } catch (error) {
      console.error('Failed to resolve:', error);
      if (error?.code === 'unauthenticated') {
        setError('Your session is not ready. Please sign in again.');
      } else {
        setError('Failed to resolve conversation.');
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

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.userName?.toLowerCase().includes(query) ||
      conv.subject?.toLowerCase().includes(query) ||
      conv.id.toLowerCase().includes(query)
    );
  });

  // Calculate stats
  const stats = {
    total: conversations.length,
    open: conversations.filter(c => c.status === 'open').length,
    pending: conversations.filter(c => c.status === 'pending').length,
    resolved: conversations.filter(c => c.status === 'resolved').length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <MessageSquare className="size-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Support Messages</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage user support conversations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.open}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Open</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Resolved</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="flex h-full">
          {/* Conversations list */}
          <div className={cn(
            "border-r border-gray-200 dark:border-gray-800 flex flex-col",
            selectedConversation ? (isMobile ? 'hidden' : 'w-80') : 'w-full'
          )}>
            {/* Filters */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by user or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'open', 'pending', 'resolved'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                      statusFilter === status
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    )}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="size-6 text-orange-500 animate-spin" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="size-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No conversations found
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                        selectedConversation?.id === conv.id && "bg-orange-50 dark:bg-orange-900/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {conv.userName}
                            </p>
                            {conv.adminUnreadCount > 0 && (
                              <span className="px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                                {conv.adminUnreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {SUPPORT_CATEGORIES.find(c => c.id === conv.subject)?.label || conv.subject}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge status={conv.status} />
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatTimeAgo(conv.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {conv.lastMessage}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chat panel */}
          {selectedConversation ? (
            <div className={cn(
              "flex-1 flex flex-col",
              !selectedConversation && 'hidden lg:flex'
            )}>
              {/* Chat header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isMobile && (
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="p-1 -ml-1"
                    >
                      <ChevronLeft className="size-5 text-gray-500" />
                    </button>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {selectedConversation.userName}
                      </p>
                      <RoleBadge role={selectedConversation.userRole} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {SUPPORT_CATEGORIES.find(c => c.id === selectedConversation.subject)?.label || selectedConversation.subject}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedConversation.status} />
                  {selectedConversation.status !== 'resolved' && selectedConversation.status !== 'closed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowResolveModal(true)}
                    >
                      <CheckCircle2 className="size-4 mr-1" />
                      Resolve
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {error && (
                  <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageSquare className="size-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No messages yet
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAdmin = msg.senderRole === 'admin';
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex", isAdmin ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-3",
                            isAdmin
                              ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                          )}
                        >
                          {!isAdmin && (
                            <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">
                              {msg.senderName}
                            </p>
                          )}
                          {isAdmin && (
                            <p className="text-xs font-medium text-purple-200 mb-1">
                              GetGo Support
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <p className={cn(
                            "text-xs mt-1",
                            isAdmin ? "text-purple-200" : "text-gray-400"
                          )}>
                            {formatTimeAgo(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply form */}
              {selectedConversation.status !== 'resolved' && selectedConversation.status !== 'closed' ? (
                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex gap-2">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your reply..."
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                      rows={2}
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
              ) : (
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    This conversation has been {selectedConversation.status}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden lg:flex flex-1 items-center justify-center">
              <div className="text-center">
                <MessageSquare className="size-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  Select a conversation to view messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resolve Modal */}
      <Dialog open={showResolveModal} onOpenChange={setShowResolveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to resolve this conversation? The user will be notified.
            </p>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Add a resolution note (optional)..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowResolveModal(false)}>
                Cancel
              </Button>
              <Button variant="gradient" onClick={handleResolve} disabled={sending}>
                {sending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
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
