import React from 'react';
import { MessageSquare, MapPin, Package, Truck, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Badge } from '@/components/ui/badge';
import { useConversations } from '@/hooks/useConversations';
import { sanitizeMessage } from '@/utils/messageUtils';

export function ChatView({
  currentUser,
  onOpenChat,
  darkMode = false,
}) {
  const { conversations, loading } = useConversations(currentUser?.uid);
  const isMobile = useMediaQuery('(max-width: 1023px)');

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

  const formatPrice = (price) => {
    if (!price) return '---';
    return `₱${Number(price).toLocaleString()}`;
  };

  const handleConversationClick = (conversation) => {
    // Reconstruct the listing object from bid data
    const listing = {
      id: conversation.cargoListingId || conversation.truckListingId,
      userId: conversation.listingOwnerId,
      userName: conversation.listingOwnerName,
      origin: conversation.origin,
      destination: conversation.destination,
      // Add cargo-specific fields
      cargoType: conversation.cargoType,
      weight: conversation.cargoWeight,
      weightUnit: conversation.cargoWeightUnit,
      // Add truck-specific fields
      vehicleType: conversation.vehicleType,
      capacity: conversation.cargoWeight,
      capacityUnit: conversation.cargoWeightUnit,
      // Price
      askingPrice: conversation.listingPrice || conversation.price,
      price: conversation.listingPrice || conversation.price,
    };

    // Add shipper/trucker field based on listing type
    if (conversation.listingType === 'cargo') {
      listing.shipper = conversation.listingOwnerName;
    } else {
      listing.trucker = conversation.listingOwnerName;
    }

    const bid = {
      id: conversation.id,
      bidderId: conversation.bidderId,
      bidderName: conversation.bidderName,
      message: conversation.message,
      price: conversation.price,
      createdAt: conversation.createdAt,
    };

    onOpenChat?.(bid, listing, conversation.listingType);
  };

  return (
    <main className={cn("flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto")} style={{ padding: isMobile ? '20px' : '24px', paddingBottom: isMobile ? '100px' : '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '16px' : '24px' }}>
        <h2 style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 'bold', color: darkMode ? '#fff' : '#111827', marginBottom: '8px' }}>
          Messages
        </h2>
        <p style={{ fontSize: isMobile ? '13px' : '14px', color: '#6b7280' }}>
          View your conversations here
        </p>
      </div>

      {/* Conversations List */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ paddingTop: '48px', paddingBottom: '48px' }}>
          <Loader2 className="size-8 animate-spin text-orange-500" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center" style={{ paddingTop: '48px', paddingBottom: '48px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: darkMode ? '#1f2937' : '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <MessageSquare className="size-8 text-gray-400" />
          </div>
          <p style={{ fontSize: isMobile ? '15px' : '16px', fontWeight: '500', color: darkMode ? '#d1d5db' : '#4b5563', marginBottom: '4px' }}>
            No conversations yet
          </p>
          <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#6b7280' }}>
            Your conversations will appear here
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
          {conversations.map((conversation) => {
            const Icon = conversation.listingType === 'cargo' ? Package : Truck;
            const isCargo = conversation.listingType === 'cargo';
            const hasUnread = conversation.unreadCount > 0;

            return (
              <button
                key={conversation.id}
                onClick={() => handleConversationClick(conversation)}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-all text-left w-full hover:border-orange-300 dark:hover:border-orange-700"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800" style={{ padding: isMobile ? '12px 16px' : '16px 20px' }}>
                  <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px' }}>
                    <div style={{
                      width: isMobile ? '40px' : '48px',
                      height: isMobile ? '40px' : '48px',
                      borderRadius: '50%',
                      background: isCargo
                        ? 'linear-gradient(to bottom right, #fb923c, #ea580c)'
                        : 'linear-gradient(to bottom right, #3b82f6, #2563eb)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', color: '#fff' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: hasUnread ? '700' : '600', color: darkMode ? '#fff' : '#111827' }}>
                        {conversation.otherPartyName}
                      </p>
                      <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>
                        <Clock style={{ width: '12px', height: '12px', display: 'inline', marginRight: '4px' }} />
                        {formatTimeAgo(conversation.lastActivityAt)}
                      </p>
                    </div>
                  </div>
                  {hasUnread && (
                    <Badge className="bg-orange-500 text-white border-none" style={{ padding: '4px 8px', fontSize: '11px' }}>
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding: isMobile ? '12px 16px' : '16px 20px' }}>
                  {/* Route */}
                  <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px', marginBottom: isMobile ? '10px' : '12px' }}>
                    <div className="flex items-center" style={{ gap: '6px', flex: 1, minWidth: 0 }}>
                      <MapPin style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#10b981', flexShrink: 0 }} />
                      <span style={{ fontSize: isMobile ? '13px' : '14px', color: darkMode ? '#d1d5db' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conversation.origin || '---'}
                      </span>
                    </div>
                    <span className="text-orange-500" style={{ fontSize: isMobile ? '14px' : '16px', flexShrink: 0 }}>→</span>
                    <div className="flex items-center" style={{ gap: '6px', flex: 1, minWidth: 0 }}>
                      <MapPin style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px', color: '#ef4444', flexShrink: 0 }} />
                      <span style={{ fontSize: isMobile ? '13px' : '14px', color: darkMode ? '#d1d5db' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conversation.destination || '---'}
                      </span>
                    </div>
                  </div>

                  {/* Last Message Preview */}
                  {conversation.lastMessage ? (
                    <div className="flex items-start gap-2" style={{ marginBottom: isMobile ? '10px' : '12px' }}>
                      <MessageSquare style={{ width: '14px', height: '14px', color: '#9ca3af', flexShrink: 0, marginTop: '2px' }} />
                      <p style={{
                        fontSize: isMobile ? '12px' : '13px',
                        color: hasUnread ? (darkMode ? '#d1d5db' : '#374151') : '#9ca3af',
                        fontWeight: hasUnread ? '500' : '400',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}>
                        {conversation.lastMessage.senderId === currentUser?.uid ? 'You: ' : ''}
                        {sanitizeMessage(conversation.lastMessage.message)}
                      </p>
                    </div>
                  ) : conversation.message ? (
                    <div className="flex items-start gap-2" style={{ marginBottom: isMobile ? '10px' : '12px' }}>
                      <MessageSquare style={{ width: '14px', height: '14px', color: '#9ca3af', flexShrink: 0, marginTop: '2px' }} />
                      <p style={{
                        fontSize: isMobile ? '12px' : '13px',
                        color: '#9ca3af',
                        fontStyle: 'italic',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}>
                        Initial bid: "{sanitizeMessage(conversation.message)}"
                      </p>
                    </div>
                  ) : null}

                  {/* Details and Price */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151' }}>
                        {isCargo ? conversation.cargoType || 'Cargo' : conversation.vehicleType || 'Truck'}
                      </p>
                      {conversation.cargoWeight && (
                        <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>
                          {conversation.cargoWeight} {conversation.cargoWeightUnit || 'tons'}
                        </p>
                      )}
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'linear-gradient(to right, #fb923c, #ea580c)',
                      color: 'white',
                      fontWeight: '700',
                      fontSize: isMobile ? '13px' : '14px'
                    }}>
                      {formatPrice(conversation.price)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default ChatView;
