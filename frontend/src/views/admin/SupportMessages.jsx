import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, Search, Filter, Clock, CheckCircle, AlertCircle, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getAllSupportMessages, addAdminReply, updateSupportMessageStatus } from '@/services/firestoreService';
import { useAuth } from '@/contexts/AuthContext';

export function SupportMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const data = await getAllSupportMessages(50);
      setMessages(data);
    } catch (err) {
      console.error('Error fetching support messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedMessage || !user) return;

    setSendingReply(true);
    try {
      const adminName = user.displayName || user.email || 'Admin';
      await addAdminReply(selectedMessage.id, user.uid, adminName, replyText.trim());
      
      // Refresh messages
      await fetchMessages();
      
      // Update selected message with new reply
      const updatedMessages = await getAllSupportMessages(50);
      const updated = updatedMessages.find(m => m.id === selectedMessage.id);
      if (updated) {
        setSelectedMessage(updated);
      }
      
      setReplyText('');
    } catch (err) {
      console.error('Error sending reply:', err);
      alert('Failed to send reply: ' + err.message);
    } finally {
      setSendingReply(false);
    }
  };

  const handleStatusChange = async (messageId, newStatus) => {
    try {
      await updateSupportMessageStatus(messageId, newStatus);
      await fetchMessages();
      
      // Update selected message
      const updatedMessages = await getAllSupportMessages(50);
      const updated = updatedMessages.find(m => m.id === messageId);
      if (updated) {
        setSelectedMessage(updated);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status: ' + err.message);
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

  const filteredMessages = messages.filter(msg => {
    // Apply status filter
    if (filter !== 'all' && msg.status !== filter) return false;
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        msg.userName.toLowerCase().includes(search) ||
        msg.message.toLowerCase().includes(search) ||
        (msg.userId && msg.userId.toLowerCase().includes(search))
      );
    }
    
    return true;
  });

  const statusCounts = {
    all: messages.length,
    open: messages.filter(m => m.status === 'open').length,
    in_progress: messages.filter(m => m.status === 'in_progress').length,
    resolved: messages.filter(m => m.status === 'resolved').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-orange-500" />
        <span className="ml-2 text-gray-500">Loading support messages...</span>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Message List */}
      <div className="w-1/2 flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Support Messages
          </h2>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            />
          </div>
          
          {/* Filter Tabs */}
          <div className="flex gap-2">
            {['all', 'open', 'in_progress', 'resolved'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filter === status
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {status === 'all' ? 'All' : status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status]})
              </button>
            ))}
          </div>
        </div>
        
        {/* Message List */}
        <div className="flex-1 overflow-y-auto">
          {filteredMessages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="size-12 mx-auto mb-2 opacity-50" />
              <p>No messages found</p>
            </div>
          ) : (
            filteredMessages.map(msg => (
              <button
                key={msg.id}
                onClick={() => setSelectedMessage(msg)}
                className={`w-full p-4 text-left border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  selectedMessage?.id === msg.id ? 'bg-orange-50 dark:bg-orange-950/20' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                    {msg.userName}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    msg.status === 'open' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                    msg.status === 'in_progress' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  }`}>
                    {msg.status === 'open' ? 'Open' : msg.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {msg.message}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(msg.createdAt)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
      
      {/* Message Detail */}
      <div className="w-1/2 flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        {selectedMessage ? (
          <>
            {/* Message Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="size-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <User className="size-5 text-gray-500" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {selectedMessage.userName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {formatDate(selectedMessage.createdAt)}
                  </p>
                </div>
              </div>
              
              {/* Status Dropdown */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm text-gray-500">Status:</span>
                <select
                  value={selectedMessage.status}
                  onChange={(e) => handleStatusChange(selectedMessage.id, e.target.value)}
                  className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
            
            {/* Message Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Original Message */}
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {selectedMessage.message}
                </p>
              </div>
              
              {/* Replies */}
              {selectedMessage.replies && selectedMessage.replies.length > 0 && (
                <div className="space-y-3 mb-4">
                  {selectedMessage.replies.map((reply, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-r-xl"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">
                          {reply.adminName || 'Support Team'}
                        </span>
                        <span className="text-xs text-gray-400">
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
            
            {/* Reply Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                className="min-h-[100px] mb-3"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {replyText.length}/2000 characters
                </span>
                <Button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || sendingReply}
                  className="flex items-center gap-2"
                >
                  {sendingReply ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="size-12 mx-auto mb-2 opacity-50" />
              <p>Select a message to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SupportMessages;
