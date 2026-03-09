import React, { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, 
  MessageCircle, 
  Send, 
  Clock, 
  CheckCircle, 
  Circle, 
  User, 
  Bot, 
  Search, 
  Filter, 
  X,
  ChevronRight,
  Calendar,
  Reply
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSupportMessages, sendSupportMessage } from '@/services/firestoreService';

const statusConfig = {
  open: { label: 'Open', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }
};

const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

function MessageBubble({ message, isUser, isLastInGroup, isFirstInGroup }) {
  const isAdmin = !isUser;
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${isUser ? 'order-2' : 'order-1'}`}>
        <div className={`px-3 py-2 rounded-2xl ${
          isUser 
            ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {isAdmin && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Bot className="size-3 text-blue-500" />
                <span>Admin</span>
              </div>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(message.createdAt)}</span>
          </div>
          <p className="text-sm leading-relaxed">{message.message}</p>
        </div>
      </div>
      {!isUser && (
        <div className="order-1 flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mr-2 shadow-lg shadow-blue-500/30">
          <Bot className="size-4 text-white" />
        </div>
      )}
    </div>
  );
}

function ConversationItem({ conversation, onSelect, isSelected }) {
  const latestMessage = conversation.replies?.length > 0 
    ? conversation.replies[conversation.replies.length - 1] 
    : conversation;
  
  const status = statusConfig[conversation.status] || statusConfig.open;
  
  return (
    <button
      onClick={() => onSelect(conversation)}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
        isSelected
          ? 'border-orange-200 dark:border-orange-800/60 bg-orange-50 dark:bg-orange-900/20 shadow-md'
          : 'border-gray-100 dark:border-gray-700/60 hover:border-orange-200 dark:hover:border-orange-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                Support: {conversation.category || 'General'}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${status.color}`}>
              {status.label}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
            {conversation.message}
          </p>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>Latest: {formatDate(latestMessage.createdAt)}</span>
            {conversation.replies?.length > 0 && (
              <span className="flex items-center gap-1">
                <Reply className="size-3" />
                {conversation.replies.length} reply{conversation.replies.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          <ChevronRight className={`size-4 text-gray-400 ${isSelected ? 'text-orange-500' : ''}`} />
        </div>
      </div>
    </button>
  );
}

function NewMessageForm({ onSendMessage, isLoading }) {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    await onSendMessage(message, category);
    setMessage('');
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 rounded-b-2xl">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          disabled={isLoading}
        >
          <option value="general">General</option>
          <option value="technical">Technical</option>
          <option value="billing">Billing</option>
          <option value="account">Account</option>
        </select>
        <button
          type="submit"
          disabled={!message.trim() || isLoading}
          className="px-4 py-3 rounded-xl bg-gradient-to-r from-orange-400 to-orange-600 text-white font-semibold shadow-lg shadow-orange-500/30 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
    </form>
  );
}

export default function MessagesView() {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [newMessageLoading, setNewMessageLoading] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      loadConversations();
    }
  }, [currentUser]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const messages = await getUserSupportMessages(currentUser.uid, 100);
      setConversations(messages);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (message, category) => {
    try {
      setNewMessageLoading(true);
      await sendSupportMessage(currentUser.uid, currentUser.name, message, category);
      await loadConversations();
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setNewMessageLoading(false);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      const matchesSearch = conv.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           conv.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      const aLatest = a.replies?.length > 0 ? a.replies[a.replies.length - 1].createdAt : a.createdAt;
      const bLatest = b.replies?.length > 0 ? b.replies[b.replies.length - 1].createdAt : b.createdAt;
      return new Date(bLatest) - new Date(aLatest);
    });
  }, [conversations, searchTerm, statusFilter]);

  const statusFilters = [
    { id: 'all', label: 'All', icon: MessageCircle },
    { id: 'open', label: 'Open', icon: Clock },
    { id: 'in_progress', label: 'In Progress', icon: Circle },
    { id: 'resolved', label: 'Resolved', icon: CheckCircle }
  ];

  if (loading) {
    return (
      <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded-lg mb-6" />
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-300 dark:bg-gray-700 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Messages</h1>
          <p className="text-gray-600 dark:text-gray-400">Chat with our support team</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversations List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900 dark:text-white">Conversations</h2>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {conversations.length} total
                  </div>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="size-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by status</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusFilters.map((filter) => {
                    const Icon = filter.icon;
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setStatusFilter(filter.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          statusFilter === filter.id
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <Icon className="size-3" />
                        {filter.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conversations List */}
              <div className="p-4">
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {conversations.length === 0 
                      ? "No conversations yet. Start a chat with support!"
                      : "No conversations match your filters."
                    }
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredConversations.map((conversation) => (
                      <ConversationItem
                        key={conversation.id}
                        conversation={conversation}
                        onSelect={handleSelectConversation}
                        isSelected={selectedConversation?.id === conversation.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Conversation View */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm h-[600px] flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Conversation Header */}
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                          <Bot className="size-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            Support Team
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {selectedConversation.category || 'General'} • {statusConfig[selectedConversation.status]?.label}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="size-3" />
                        Started: {formatDate(selectedConversation.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(100% - 200px)' }}>
                    {/* User's initial message */}
                    <MessageBubble
                      message={selectedConversation}
                      isUser={true}
                      isFirstInGroup={true}
                      isLastInGroup={selectedConversation.replies?.length === 0}
                    />

                    {/* Admin replies */}
                    {selectedConversation.replies?.map((reply, index) => (
                      <MessageBubble
                        key={reply.id}
                        message={reply}
                        isUser={false}
                        isFirstInGroup={index === 0}
                        isLastInGroup={index === selectedConversation.replies.length - 1}
                      />
                    ))}
                  </div>

                  {/* New Message Form */}
                  <NewMessageForm
                    onSendMessage={handleSendMessage}
                    isLoading={newMessageLoading}
                  />
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mb-4 shadow-lg shadow-orange-500/30">
                    <MessageCircle className="size-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Select a conversation
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm">
                    Choose a conversation from the list to view messages and reply to admin responses.
                  </p>
                  
                  {conversations.length === 0 && (
                    <div className="w-full max-w-md">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4 mb-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Start a new conversation</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Need help? Send us a message and our support team will get back to you.
                        </p>
                      </div>
                      <NewMessageForm
                        onSendMessage={handleSendMessage}
                        isLoading={newMessageLoading}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}