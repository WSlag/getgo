import React from 'react';
import { MessageSquare, MapPin, Package, Truck, Loader2, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConversations } from '@/hooks/useConversations';
import { sanitizeMessage } from '@/utils/messageUtils';
import { sortEntitiesNewestFirst } from '@/utils/activitySorting';
import { inferConversationPerspectiveRole, getWorkspaceLabel, resolveBidListingType } from '@/utils/workspace';

export function ChatView({
  currentUser,
  workspaceRole = 'shipper',
  conversations: conversationsProp,
  conversationsLoading = false,
  onOpenChat,
  onBrowseMarketplace,
  onCreateListing,
  darkMode = false,
}) {
  const { conversations: hookConversations, loading: hookLoading } = useConversations(currentUser?.uid);
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const activeWorkspace = workspaceRole || 'shipper';
  const baseConversations = conversationsProp || hookConversations;
  const loading = conversationsProp ? conversationsLoading : hookLoading;
  const scopedConversations = React.useMemo(() => {
    if (!currentUser?.uid) return [];
    if (activeWorkspace === 'broker') return [];
    return sortEntitiesNewestFirst(
      baseConversations.filter(
        (conversation) => inferConversationPerspectiveRole(conversation, currentUser.uid) === activeWorkspace
      ),
      { fallbackKeys: ['lastActivityAt'] }
    );
  }, [baseConversations, currentUser?.uid, activeWorkspace]);

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
    return `PHP ${Number(price).toLocaleString()}`;
  };

  const formatDate = (date) => {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date?.seconds ? date.seconds * 1000 : date);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const statusConfig = {
    pending:    { label: 'Pending',    bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    accepted:   { label: 'Accepted',   bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
    contracted: { label: 'Contracted', bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
    rejected:   { label: 'Rejected',   bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
    withdrawn:  { label: 'Withdrawn',  bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
  };

  const handleConversationClick = (conversation) => {
    const listingType = resolveBidListingType(conversation) || 'cargo';
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
    if (listingType === 'cargo') {
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

    onOpenChat?.(bid, listing, listingType);
  };

  return (
    <main className={cn("flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto")} style={{ padding: isMobile ? '16px' : '24px', paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '16px' : '24px' }}>
        <h2 style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 'bold', color: darkMode ? '#fff' : '#111827', marginBottom: '8px' }}>
          Messages
        </h2>
        <p style={{ fontSize: isMobile ? '13px' : '14px', color: '#6b7280' }}>
          {activeWorkspace === 'broker'
            ? 'Broker workspace does not include direct bid chat threads'
            : `View your ${getWorkspaceLabel(activeWorkspace)} workspace conversations`}
        </p>
      </div>

      {/* Conversations List */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ paddingTop: '48px', paddingBottom: '48px' }}>
          <Loader2 className="size-8 animate-spin text-orange-500" />
        </div>
      ) : scopedConversations.length === 0 ? (
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
            No conversations in {getWorkspaceLabel(activeWorkspace)} workspace
          </p>
          <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#6b7280' }}>
            Your conversations will appear here
          </p>
          <div className="flex flex-col sm:flex-row gap-2" style={{ marginTop: '16px' }}>
            <Button
              onClick={onBrowseMarketplace}
              variant="outline"
              size={isMobile ? "sm" : "default"}
            >
              Browse Listings
            </Button>
            <Button
              onClick={onCreateListing}
              size={isMobile ? "sm" : "default"}
            >
              Post Listing
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
          {scopedConversations.map((conversation) => {
            const listingType = resolveBidListingType(conversation) || 'cargo';
            const Icon = listingType === 'cargo' ? Package : Truck;
            const isCargo = listingType === 'cargo';
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
                      <div className="flex items-center flex-wrap" style={{ gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock style={{ width: '12px', height: '12px' }} />
                          {formatTimeAgo(conversation.lastActivityAt)}
                        </span>
                        {conversation.status && statusConfig[conversation.status] && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '600',
                            padding: '1px 7px',
                            borderRadius: '999px',
                            background: statusConfig[conversation.status].bg,
                            color: statusConfig[conversation.status].color,
                            border: `1px solid ${statusConfig[conversation.status].border}`,
                            letterSpacing: '0.02em',
                          }}>
                            {statusConfig[conversation.status].label}
                          </span>
                        )}
                      </div>
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
                    <span className="text-orange-500" style={{ fontSize: isMobile ? '14px' : '16px', flexShrink: 0 }}>{'->'}</span>
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
                  <div className="flex items-end justify-between" style={{ gap: '12px' }}>
                    {/* Left: type, weight/capacity, date */}
                    <div>
                      <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '600', color: darkMode ? '#d1d5db' : '#374151' }}>
                        {isCargo ? conversation.cargoType || 'Cargo' : conversation.vehicleType || 'Truck'}
                      </p>
                      {isCargo
                        ? conversation.cargoWeight && (
                          <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>
                            {conversation.cargoWeight} {conversation.cargoWeightUnit || 'tons'}
                          </p>
                        )
                        : conversation.capacity && (
                          <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280' }}>
                            {conversation.capacity} {conversation.capacityUnit || 'tons'}
                          </p>
                        )
                      }
                      {formatDate(isCargo ? conversation.pickupDate : conversation.availableDate) && (
                        <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Calendar style={{ width: '11px', height: '11px', flexShrink: 0 }} />
                          {formatDate(isCargo ? conversation.pickupDate : conversation.availableDate)}
                        </p>
                      )}
                    </div>

                    {/* Right: stacked prices */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {conversation.listingPrice && (
                        <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#9ca3af', marginBottom: '3px', whiteSpace: 'nowrap' }}>
                          Asking: {formatPrice(conversation.listingPrice)}
                        </p>
                      )}
                      {conversation.price && (
                        <div style={{
                          display: 'inline-block',
                          padding: isMobile ? '5px 10px' : '6px 12px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)',
                          boxShadow: '0 2px 6px rgba(249,115,22,0.3)',
                          color: 'white',
                          fontWeight: '700',
                          fontSize: isMobile ? '12px' : '13px',
                          fontFamily: 'Outfit, sans-serif',
                          whiteSpace: 'nowrap',
                        }}>
                          {conversation.listingPrice ? 'Agreed: ' : ''}{formatPrice(conversation.price)}
                        </div>
                      )}
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
