import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, MapPin, Package, Truck, User, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/useChat';
import { sendChatMessage } from '@/services/firestoreService';
import socketService from '@/services/socketService';

export function ChatModal({
  open,
  onClose,
  data,
  currentUser,
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Extract data from modal props
  const listing = data?.listing;
  const listingType = data?.type || 'cargo';
  const bidId = data?.bidId;

  // Get chat messages via hook
  const { messages, loading: messagesLoading } = useChat(bidId);

  // Determine the other party's info
  const isCargo = listingType === 'cargo';
  const otherPartyName = isCargo
    ? (listing?.shipper || listing?.userName || 'Shipper')
    : (listing?.trucker || listing?.userName || 'Trucker');
  const otherPartyId = listing?.userId;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const formatPrice = (price) => {
    if (!price) return '---';
    return `₱${Number(price).toLocaleString()}`;
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

  const handleSend = async () => {
    if (!message.trim() || !bidId || !currentUser) return;

    setSending(true);
    setError(null);

    try {
      const recipientId = otherPartyId;
      const senderName = currentUser.displayName || currentUser.name || 'User';

      // Send via Firestore
      await sendChatMessage(
        bidId,
        currentUser.uid,
        senderName,
        message.trim(),
        recipientId
      );

      // Also emit via Socket.io for real-time notification
      socketService.emitChatMessage({
        bidId,
        senderId: currentUser.uid,
        senderName,
        message: message.trim(),
        recipientId,
        preview: message.trim().substring(0, 50),
      });

      setMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    setMessage('');
    setError(null);
    onClose?.();
  };

  if (!listing) return null;

  // Show a message if no bid ID is available (can't chat without a bid context)
  if (!bidId) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md backdrop-blur-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <MessageSquare className="size-6 text-white" />
              </div>
              <div>
                <DialogTitle>Start a Conversation</DialogTitle>
                <DialogDescription>
                  {listing.origin} → {listing.destination}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-8 text-center">
            <div className="size-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <MessageSquare className="size-8 text-gray-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              To start a conversation, please place a bid first.
            </p>
            <p className="text-sm text-gray-500">
              Messaging is available after you've shown interest in this listing.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col backdrop-blur-sm p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <MessageSquare className="size-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg truncate">
                Chat with {otherPartyName}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-1 text-sm">
                <MapPin className="size-3 text-green-500 flex-shrink-0" />
                <span className="truncate">{listing.origin}</span>
                <span className="text-gray-400 mx-1">→</span>
                <MapPin className="size-3 text-red-500 flex-shrink-0" />
                <span className="truncate">{listing.destination}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Listing Summary */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "size-8 rounded-lg flex items-center justify-center",
                isCargo
                  ? "bg-gradient-to-br from-orange-400 to-orange-600"
                  : "bg-gradient-to-br from-blue-400 to-blue-600"
              )}>
                {isCargo ? (
                  <Package className="size-4 text-white" />
                ) : (
                  <Truck className="size-4 text-white" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {isCargo ? listing.cargoType || 'Cargo' : listing.vehicleType || 'Truck'}
                </p>
                <p className="text-xs text-gray-500">
                  {isCargo ? `${listing.weight || '---'} ${listing.weightUnit || 'tons'}` : `${listing.capacity || '---'} ${listing.capacityUnit || 'tons'}`}
                </p>
              </div>
            </div>
            <Badge variant="gradient-orange" className="text-sm font-bold px-3 py-1">
              {formatPrice(listing.askingPrice || listing.price)}
            </Badge>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[200px] max-h-[400px]">
          {messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-6 text-blue-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="size-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <MessageSquare className="size-8 text-blue-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                Start the conversation!
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Send a message to {otherPartyName}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isSent = msg.senderId === currentUser?.uid;
                return (
                  <div
                    key={msg.id}
                    className={cn("flex", isSent ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] px-4 py-2 shadow-sm",
                        isSent
                          ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-sm"
                          : "bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm"
                      )}
                    >
                      {!isSent && (
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                          {msg.senderName}
                        </p>
                      )}
                      <p className={cn(
                        "text-sm whitespace-pre-wrap break-words",
                        isSent ? "text-white" : "text-gray-900 dark:text-white"
                      )}>
                        {msg.message}
                      </p>
                      <p className={cn(
                        "text-xs mt-1",
                        isSent ? "text-blue-100 text-right" : "text-gray-500"
                      )}>
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

        {/* Error Message */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Input Section */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 min-h-[44px] max-h-[120px] resize-none"
              disabled={sending}
            />
            <Button
              variant="gradient"
              size="icon"
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="size-11 flex-shrink-0"
            >
              {sending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Send className="size-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ChatModal;
