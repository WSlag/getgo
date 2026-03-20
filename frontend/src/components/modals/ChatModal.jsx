import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Send, MapPin, Package, Truck, Loader2, FileText, Check, X } from 'lucide-react';
import { CallButton } from '@/components/call/CallButton';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Dialog,
  DialogBottomSheet,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChat } from '@/hooks/useChat';
import { sendChatMessage, markMessagesRead } from '@/services/firestoreService';
import { sanitizeMessage } from '@/utils/messageUtils';
import { isClosedBidStatus, normalizeBidStatus } from '@/utils/bidStatus';
import api from '@/services/api';
import { db } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function ChatModal({
  open,
  onClose,
  data,
  currentUser,
  onOpenContract,
  onInitiateCall,
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [contractId, setContractId] = useState(null);
  const [contractStatus, setContractStatus] = useState(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [liveBid, setLiveBid] = useState(null);
  const [agreedPriceInput, setAgreedPriceInput] = useState('');
  const [editingAgreedPrice, setEditingAgreedPrice] = useState(false);
  const [savingAgreedPrice, setSavingAgreedPrice] = useState(false);
  const [agreedPriceError, setAgreedPriceError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const agreedPriceInputRef = useRef(null);
  const isMobile = useMediaQuery('(max-width: 1023px)');

  // Extract data from modal props
  const listing = data?.listing;
  const listingType = data?.type || 'cargo';
  const bid = data?.bid;
  const bidId = data?.bidId || bid?.id;
  const resolvedBid = liveBid || bid || null;
  const currentUserId = currentUser?.uid || currentUser?.id || null;
  const bidderId = typeof resolvedBid?.bidderId === 'string' ? resolvedBid.bidderId.trim() : '';
  const bidStatus = normalizeBidStatus(resolvedBid?.status);
  const isClosedBid = isClosedBidStatus(bidStatus);
  const isCancelledContract = normalizeBidStatus(contractStatus) === 'cancelled';
  const chatReadOnlyReason = useMemo(() => {
    if (!open || !bidId) return null;
    if (isClosedBid) {
      return `This bid is ${bidStatus || 'closed'}. Chat is read-only.`;
    }
    if (isCancelledContract) {
      return 'This contract is cancelled. Chat is read-only.';
    }
    return null;
  }, [open, bidId, isClosedBid, bidStatus, isCancelledContract]);
  const canSendMessage = !chatReadOnlyReason;
  const showContractCta = Boolean(contractId && onOpenContract && !isCancelledContract);
  // Call button is shown when chat is active (not read-only) and we have a valid other party
  const canCall = Boolean(
    onInitiateCall && currentUserId && !chatReadOnlyReason
  );
  const editableBidStatuses = new Set(['pending', 'accepted']);
  const isBidder = Boolean(currentUserId && bidderId && currentUserId === bidderId);
  const isEditableBidStatus = editableBidStatuses.has(bidStatus);
  const agreedPriceDisabledReason = useMemo(() => {
    if (!open || !bidId) return 'Agreed price is unavailable for this chat.';
    if (loadingContract) return 'Checking contract status...';
    if (contractId) return 'Agreed price can no longer be updated because a contract already exists.';
    if (!isEditableBidStatus) return 'Agreed price can only be updated while bid is pending or accepted.';
    if (!isBidder) return 'Only the bidder can update agreed price.';
    return null;
  }, [open, bidId, loadingContract, contractId, isEditableBidStatus, isBidder]);
  const canEditAgreedPrice = Boolean(
    !agreedPriceDisabledReason
  );

  // Get chat messages via hook
  const { messages: fetchedMessages, loading: messagesLoading } = useChat(bidId);

  // Combine initial bid message with chat messages
  const messages = useMemo(() => {
    const allMessages = [];

    // Add initial bid message if it exists
    if (resolvedBid?.message) {
      allMessages.push({
        id: 'bid-initial',
        senderId: resolvedBid.bidderId,
        senderName: resolvedBid.bidderName || 'Bidder',
        message: resolvedBid.message,
        createdAt: resolvedBid.createdAt,
        isInitialBid: true,
      });
    }

    // Add fetched messages
    allMessages.push(...fetchedMessages);

    return allMessages;
  }, [resolvedBid, fetchedMessages]);

  // Determine the other party's info
  const isCargo = listingType === 'cargo';
  const participantContext = useMemo(() => {
    const bidderId = resolvedBid?.bidderId || null;
    const listingOwnerId = resolvedBid?.listingOwnerId || listing?.userId || null;
    const defaultName = isCargo
      ? (listing?.shipper || listing?.userName || 'Shipper')
      : (listing?.trucker || listing?.userName || 'Trucker');

    if (!currentUserId) {
      return { otherPartyId: listingOwnerId || bidderId, otherPartyName: defaultName };
    }

    if (currentUserId === bidderId) {
      return {
        otherPartyId: listingOwnerId,
        otherPartyName: resolvedBid?.listingOwnerName || defaultName,
      };
    }

    if (currentUserId === listingOwnerId) {
      return {
        otherPartyId: bidderId,
        otherPartyName: resolvedBid?.bidderName || 'Bidder',
      };
    }

    return {
      otherPartyId: listingOwnerId || bidderId,
      otherPartyName: defaultName,
    };
  }, [resolvedBid, currentUserId, isCargo, listing?.shipper, listing?.trucker, listing?.userId, listing?.userName]);
  const otherPartyName = participantContext.otherPartyName;

  // Keep bid data fresh while chat is open so price/status updates are reflected live.
  useEffect(() => {
    if (!open || !bidId) {
      setLiveBid(null);
      return;
    }

    const bidRef = doc(db, 'bids', bidId);
    const unsubscribe = onSnapshot(
      bidRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setLiveBid({ id: snapshot.id, ...snapshot.data() });
        } else {
          setLiveBid(null);
        }
      },
      (err) => {
        console.warn('Error subscribing to bid updates:', err);
      }
    );

    return () => unsubscribe();
  }, [open, bidId]);

  // Fetch contract for this bid when modal opens
  useEffect(() => {
    const fetchContract = async () => {
      if (!bidId || !open) {
        setContractId(null);
        setContractStatus(null);
        return;
      }

      try {
        setLoadingContract(true);
        const response = await api.contracts.getByBid(bidId);
        if (response?.contract) {
          setContractId(response.contract.id);
          setContractStatus(normalizeBidStatus(response.contract.status));
        } else {
          setContractId(null);
          setContractStatus(null);
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
        setContractStatus(null);
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

  useEffect(() => {
    if (!open) {
      setEditingAgreedPrice(false);
      setAgreedPriceInput('');
      setAgreedPriceError(null);
      setSavingAgreedPrice(false);
    }
  }, [open, bidId]);

  const formatPrice = (price) => {
    if (!price) return '---';
    return `PHP ${Number(price).toLocaleString()}`;
  };

  const parseAgreedPriceInput = (rawValue) => {
    if (typeof rawValue !== 'string') return null;
    const normalized = rawValue.replace(/[^\d.]/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed * 100) / 100;
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
    if (!canSendMessage) {
      setError(chatReadOnlyReason || 'This chat is read-only.');
      return;
    }
    if (!message.trim() || !bidId || !currentUser) return;

    setSending(true);
    setError(null);

    try {
      const senderName = currentUser.displayName || currentUser.name || 'User';

      // Send message doc only; notification fan-out is server-side.
      await sendChatMessage(
        bidId,
        currentUser.uid,
        senderName,
        message.trim()
      );

      setMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
      if (err?.code === 'permission-denied') {
        setError('You can only message participants in this bid.');
      } else if (err?.code === 'not-found') {
        setError('This chat is no longer available.');
      } else if (err?.code === 'failed-precondition') {
        setError(chatReadOnlyReason || 'This chat is read-only.');
      } else {
        setError('Failed to send message. Please try again.');
      }
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
    setEditingAgreedPrice(false);
    setAgreedPriceInput('');
    setAgreedPriceError(null);
    onClose?.();
  };

  const beginAgreedPriceEdit = () => {
    if (savingAgreedPrice) return;
    if (!canEditAgreedPrice) {
      setAgreedPriceError(agreedPriceDisabledReason || 'Agreed price is currently unavailable.');
      return;
    }
    setAgreedPriceError(null);
    setEditingAgreedPrice(true);
    setAgreedPriceInput('');
    setTimeout(() => {
      agreedPriceInputRef.current?.focus();
    }, 0);
  };

  const cancelAgreedPriceEdit = () => {
    if (savingAgreedPrice) return;
    setEditingAgreedPrice(false);
    setAgreedPriceInput('');
    setAgreedPriceError(null);
  };

  const submitAgreedPrice = async () => {
    if (!canEditAgreedPrice || savingAgreedPrice || !bidId) return;

    const parsedAmount = parseAgreedPriceInput(agreedPriceInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setAgreedPriceError('Enter a valid amount greater than 0.');
      return;
    }

    setSavingAgreedPrice(true);
    setAgreedPriceError(null);

    try {
      await api.bids.updateAgreedPrice(bidId, parsedAmount);
      setEditingAgreedPrice(false);
      setAgreedPriceInput('');
    } catch (err) {
      console.error('Failed to update agreed price:', err);
      const errorCode = String(err?.code || '').toLowerCase();
      const errorMessage = String(err?.message || '').toLowerCase();
      if (errorCode.includes('permission-denied')) {
        setAgreedPriceError('Only the bidder can update agreed price.');
      } else if (errorCode.includes('failed-precondition') && errorMessage.includes('pending')) {
        setAgreedPriceError('Agreed price can only be updated while bid is pending or accepted.');
      } else if (errorCode.includes('failed-precondition') && errorMessage.includes('contract')) {
        setAgreedPriceError('Agreed price can no longer be updated because contract already exists.');
      } else if (errorCode.includes('invalid-argument')) {
        setAgreedPriceError('Please enter a valid agreed price.');
      } else {
        setAgreedPriceError('Failed to update agreed price. Please try again.');
      }
    } finally {
      setSavingAgreedPrice(false);
    }
  };

  const handleAgreedInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitAgreedPrice();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelAgreedPriceEdit();
    }
  };

  const handleAgreedInputChange = (event) => {
    const nextRawValue = event.target.value;
    if (!/^[0-9]*\.?[0-9]{0,2}$/.test(nextRawValue)) {
      return;
    }
    setAgreedPriceInput(nextRawValue);
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
      <DialogBottomSheet className="max-w-md backdrop-blur-sm">
        <div style={{ padding: isMobile ? '16px' : '28px', paddingBottom: 0 }}>
        <DialogHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                minWidth: 0,
                paddingRight: isMobile ? '52px' : 0, // Keep distance from the modal close button hit-area.
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                flexShrink: 0,
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
              <div style={{ minWidth: 0 }}>
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
            {!isMobile && canCall && (
              <CallButton
                onCall={() => onInitiateCall({
                  calleeId: participantContext.otherPartyId,
                  calleeName: participantContext.otherPartyName,
                  callType: 'negotiation',
                  contextId: bidId,
                })}
                title={`Call ${participantContext.otherPartyName}`}
              />
            )}
          </div>
          {isMobile && canCall && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '10px',
                paddingRight: '52px', // Preserve clear separation from the top-right close button.
              }}
            >
              <CallButton
                onCall={() => onInitiateCall({
                  calleeId: participantContext.otherPartyId,
                  calleeName: participantContext.otherPartyName,
                  callType: 'negotiation',
                  contextId: bidId,
                })}
                title={`Call ${participantContext.otherPartyName}`}
                className="w-10 h-10 rounded-2xl"
              />
            </div>
          )}
        </DialogHeader>

        {/* Listing Summary */}
        <div style={{
          padding: '16px',
          background: 'linear-gradient(to bottom right, #f9fafb, #f3f4f6)',
          borderRadius: '12px'
        }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) auto',
              gap: '12px',
              alignItems: 'start',
              marginBottom: showContractCta ? '12px' : '0',
            }}
          >
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

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: isMobile ? 'stretch' : 'flex-end',
                width: isMobile ? '100%' : 'auto',
                minWidth: isMobile ? '100%' : '220px',
              }}
            >
              <div
                style={{
                  padding: '8px 16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(to right, #fb923c, #ea580c)',
                  color: '#FFFFFF',
                  fontWeight: '700',
                  fontSize: '16px',
                  textAlign: 'center',
                  minHeight: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {resolvedBid?.price ? `Bid: ${formatPrice(resolvedBid.price)}` : formatPrice(listing.askingPrice || listing.price)}
              </div>

              {editingAgreedPrice ? (
                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: '12px',
                    background: '#ffedd5',
                    color: '#9a3412',
                    border: '1px solid #fdba74',
                    fontWeight: '700',
                    fontSize: '16px',
                    minHeight: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                  }}
                >
                  <input
                    ref={agreedPriceInputRef}
                    value={agreedPriceInput}
                    onChange={handleAgreedInputChange}
                    onKeyDown={handleAgreedInputKeyDown}
                    onBlur={() => {
                      if (!savingAgreedPrice) {
                        cancelAgreedPriceEdit();
                      }
                    }}
                    inputMode="decimal"
                    placeholder="Enter New Agreed Price"
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: '#9a3412',
                      fontWeight: '700',
                      fontSize: '16px',
                      minWidth: 0,
                    }}
                    disabled={savingAgreedPrice}
                  />
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={submitAgreedPrice}
                    disabled={savingAgreedPrice}
                    aria-label="Confirm agreed price"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#16a34a',
                      cursor: savingAgreedPrice ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    {savingAgreedPrice ? (
                      <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Check style={{ width: '16px', height: '16px' }} />
                    )}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={cancelAgreedPriceEdit}
                    disabled={savingAgreedPrice}
                    aria-label="Cancel agreed price edit"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#dc2626',
                      cursor: savingAgreedPrice ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    <X style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={beginAgreedPriceEdit}
                  aria-disabled={!canEditAgreedPrice}
                  title={canEditAgreedPrice ? 'Enter agreed price' : agreedPriceDisabledReason || 'Agreed price unavailable'}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    background: '#ffedd5',
                    color: '#9a3412',
                    border: '1px solid #fdba74',
                    fontWeight: '700',
                    fontSize: '16px',
                    minHeight: '42px',
                    width: '100%',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    cursor: canEditAgreedPrice ? 'pointer' : 'not-allowed',
                    opacity: canEditAgreedPrice ? 1 : 0.9,
                  }}
                >
                  Enter New Agreed Price
                </button>
              )}
            </div>
          </div>

          {agreedPriceError && (
            <p style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626' }}>
              {agreedPriceError}
            </p>
          )}

          {/* View Contract Button */}
          {showContractCta && (
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
          maxHeight: isMobile ? '320px' : '480px'
        }}>
          <div style={{
            height: '100%',
            overflowY: 'auto',
            padding: '16px',
            minHeight: '220px',
            maxHeight: isMobile ? '320px' : '480px'
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
        </div>

        {/* Input Section — pinned above keyboard on mobile */}
        <div
          className="dialog-fixed-footer"
          style={{ padding: isMobile ? '12px 16px 16px' : '12px 28px 28px', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <Textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={canSendMessage ? 'Type a message...' : (chatReadOnlyReason || 'This chat is read-only.')}
              style={{ flex: 1, minHeight: '48px', maxHeight: '100px', resize: 'none' }}
              disabled={sending || !canSendMessage}
            />
            <Button
              variant="gradient"
              onClick={handleSend}
              disabled={!canSendMessage || !message.trim() || sending}
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
          {!canSendMessage && (
            <p style={{ fontSize: '12px', color: '#9a3412', textAlign: 'center' }}>
              {chatReadOnlyReason}
            </p>
          )}
          <p style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default ChatModal;
