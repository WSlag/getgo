import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Send, MapPin, Package, Truck, Loader2, FileText } from 'lucide-react';
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
import { sendChatMessage, markMessagesRead } from '@/services/firestoreService';
import socketService from '@/services/socketService';
import { sanitizeMessage } from '@/utils/messageUtils';
import api from '@/services/api';

export function ChatModal({
  open,
  onClose,
  data,
  currentUser,
  onOpenContract,
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [contractId, setContractId] = useState(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Extract data from modal props
  const listing = data?.listing;
  const listingType = data?.type || 'cargo';
  const bid = data?.bid;
  const bidId = data?.bidId || bid?.id;

  // Get chat messages via hook
  const { messages: fetchedMessages, loading: messagesLoading } = useChat(bidId);

  // Combine initial bid message with chat messages
  const messages = useMemo(() => {
    const allMessages = [];

    // Add initial bid message if it exists
    if (bid?.message) {
      allMessages.push({
        id: 'bid-initial',
        senderId: bid.bidderId,
        senderName: bid.bidderName || 'Bidder',
        message: bid.message,
        createdAt: bid.createdAt,
        isInitialBid: true,
      });
    }

    // Add fetched messages
    allMessages.push(...fetchedMessages);

    return allMessages;
  }, [bid, fetchedMessages]);

  // Determine the other party's info
  const isCargo = listingType === 'cargo';
  const otherPartyName = isCargo
    ? (listing?.shipper || listing?.userName || 'Shipper')
    : (listing?.trucker || listing?.userName || 'Trucker');
  const otherPartyId = listing?.userId;

  // Fetch contract for this bid when modal opens
  useEffect(() => {
    const fetchContract = async () => {
      if (!bidId || !open) {
        setContractId(null);
        return;
      }

      try {
        setLoadingContract(true);
        const response = await api.contracts.getByBid(bidId);
        if (response?.contract) {
          setContractId(response.contract.id);
        } else {
          setContractId(null);
        }
      } catch (error) {
        // Contract doesn't exist yet - this is normal for bids without contracts
        const isExpectedError = error.code === 'not-found' ||
                               (error.message && error.message.includes('Contract not found'));

        // Only warn about unexpected errors
        if (!isExpectedError) {
          console.warn('Error fetching contract:', error.message || error);
        }
        setContractId(null);
      } finally {
        setLoadingContract(false);
      }
    };

    fetchContract();
  }, [bidId, open]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Mark incoming messages as read whenever chat is open
  useEffect(() => {
    if (!open || !bidId || !currentUser?.uid) {
      return;
    }

    markMessagesRead(bidId, currentUser.uid).catch((err) => {
      console.error('Failed to mark messages read:', err);
    });
  }, [open, bidId, currentUser?.uid, messages.length]);

  // Focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const formatPrice = (price) => {
    if (!price) return '---';
    return `PHP ${Number(price).toLocaleString()}`;
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(to bottom right, #60a5fa, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
              }}>
                <MessageSquare style={{ width: '24px', height: '24px', color: 'white' }} />
              </div>
              <div>
                <DialogTitle>Start a Conversation</DialogTitle>
                <DialogDescription>
                  {listing.origin} {'->'} {listing.destination}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 16px',
              borderRadius: '50%',
              backgroundColor: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MessageSquare style={{ width: '32px', height: '32px', color: '#9ca3af' }} />
            </div>
            <p style={{ color: '#4b5563', marginBottom: '8px' }}>
              To start a conversation, please place a bid first.
            </p>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              Messaging is available after you've shown interest in this listing.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
      <DialogContent className="max-w-md backdrop-blur-sm">
        <DialogHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: isCargo
                ? 'linear-gradient(to bottom right, #fb923c, #ea580c)'
                : 'linear-gradient(to bottom right, #a78bfa, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isCargo
                ? '0 10px 15px -3px rgba(249, 115, 22, 0.3)'
                : '0 10px 15px -3px rgba(139, 92, 246, 0.3)'
            }}>
              {isCargo ? (
                <Package style={{ width: '24px', height: '24px', color: 'white' }} />
              ) : (
                <Truck style={{ width: '24px', height: '24px', color: 'white' }} />
              )}
            </div>
            <div>
              <DialogTitle>Chat with {otherPartyName}</DialogTitle>
              <DialogDescription style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin style={{ width: '12px', height: '12px', color: '#22c55e' }} />
                <span>{listing.origin}</span>
                <span style={{ color: '#9ca3af', margin: '0 4px' }}>{'->'}</span>
                <MapPin style={{ width: '12px', height: '12px', color: '#ef4444' }} />
                <span>{listing.destination}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Listing Summary */}
        <div style={{
          padding: '16px',
          background: 'linear-gradient(to bottom right, #f9fafb, #f3f4f6)',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: contractId ? '12px' : '0' }}>
            <div>
              <p style={{ fontWeight: '600', color: '#111827' }}>
                {isCargo ? listing.cargoType || 'Cargo' : listing.vehicleType || 'Truck'}
              </p>
              <p style={{ fontSize: '14px', color: '#4b5563' }}>
                {isCargo
                  ? `${listing.weight || '---'} ${listing.weightUnit || 'tons'}`
                  : `${listing.capacity || '---'} ${listing.capacityUnit || 'tons'}`
                }
              </p>
            </div>
            <div style={{
              padding: '8px 16px',
              borderRadius: '12px',
              background: 'linear-gradient(to right, #fb923c, #ea580c)',
              color: 'white',
              fontWeight: '700',
              fontSize: '16px'
            }}>
              {bid?.price ? `Bid: ${formatPrice(bid.price)}` : formatPrice(listing.askingPrice || listing.price)}
            </div>
          </div>

          {/* View Contract Button */}
          {contractId && onOpenContract && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onOpenContract(contractId);
              }}
              className="w-full gap-2 border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            >
              <FileText className="size-4" />
              View Contract
            </Button>
          )}

          {/* Loading state */}
          {loadingContract && !contractId && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '8px' }}>
              <Loader2 style={{ width: '16px', height: '16px', color: '#9ca3af', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '6px' }}>Checking for contract...</span>
            </div>
          )}
        </div>

        {/* Messages Container */}
        <div style={{
          borderRadius: '12px',
          backgroundColor: '#f9fafb',
          overflow: 'hidden',
          minHeight: '220px',
          maxHeight: '320px'
        }}>
          <div style={{
            height: '100%',
            overflowY: 'auto',
            padding: '16px',
            minHeight: '220px',
            maxHeight: '320px'
          }}>
            {messagesLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader2 style={{ width: '24px', height: '24px', color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : messages.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                padding: '32px 0'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px'
                }}>
                  <MessageSquare style={{ width: '28px', height: '28px', color: '#3b82f6' }} />
                </div>
                <p style={{ color: '#4b5563', fontWeight: '500' }}>
                  Start the conversation!
                </p>
                <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                  Send a message to {otherPartyName}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.map((msg) => {
                  const isSent = msg.senderId === currentUser?.uid;
                  const isInitialBid = msg.isInitialBid;

                  // Special styling for initial bid message
                  if (isInitialBid) {
                    return (
                      <div key={msg.id}>
                        <div style={{
                          padding: '12px',
                          background: 'linear-gradient(to bottom right, #fffbeb, #fff7ed)',
                          border: '1px solid #fde68a',
                          borderRadius: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <FileText style={{ width: '16px', height: '16px', color: '#d97706' }} />
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#b45309',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              Initial Bid Message
                            </span>
                          </div>
                          <p style={{ fontSize: '12px', fontWeight: '500', color: '#b45309', marginBottom: '4px' }}>
                            {msg.senderName}
                          </p>
                          <p style={{
                            fontSize: '14px',
                            color: '#1f2937',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>
                            "{sanitizeMessage(msg.message)}"
                          </p>
                          <p style={{ fontSize: '12px', color: '#d97706', marginTop: '8px' }}>
                            {formatTimeAgo(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: isSent ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{
                        maxWidth: '75%',
                        padding: '10px 16px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        background: isSent
                          ? 'linear-gradient(to bottom right, #fb923c, #ea580c)'
                          : 'white',
                        color: isSent ? 'white' : '#111827',
                        borderRadius: isSent ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        border: isSent ? 'none' : '1px solid #e5e7eb'
                      }}>
                        {!isSent && (
                          <p style={{ fontSize: '12px', fontWeight: '500', color: '#ea580c', marginBottom: '4px' }}>
                            {msg.senderName}
                          </p>
                        )}
                        <p style={{
                          fontSize: '14px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {sanitizeMessage(msg.message)}
                        </p>
                        <p style={{
                          fontSize: '11px',
                          marginTop: '6px',
                          color: isSent ? 'rgba(255,255,255,0.8)' : '#6b7280',
                          textAlign: isSent ? 'right' : 'left'
                        }}>
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
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px'
          }}>
            <p style={{ fontSize: '14px', color: '#dc2626' }}>{error}</p>
          </div>
        )}

        {/* Input Section */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <Textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            style={{ flex: 1, minHeight: '48px', maxHeight: '100px', resize: 'none' }}
            disabled={sending}
          />
          <Button
            variant="gradient"
            onClick={handleSend}
            disabled={!message.trim() || sending}
            style={{
              width: '48px',
              height: '48px',
              flexShrink: 0,
              borderRadius: '12px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {sending ? (
              <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Send style={{ width: '20px', height: '20px' }} />
            )}
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
          Press Enter to send, Shift+Enter for new line
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default ChatModal;
