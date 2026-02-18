import React, { useState, useMemo } from 'react';
import BidsView from './BidsView';
import ContractsView from './ContractsView';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function ActivityView({
  currentUser,
  currentRole,
  darkMode,
  onOpenChat,
  onOpenContract,
  unreadBids = 0,
  pendingContractsCount = 0,
}) {
  const [activeSubTab, setActiveSubTab] = useState('bids');
  const isMobile = useMediaQuery('(max-width: 1023px)');

  return (
    <main
      className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto"
      style={{
        padding: isMobile ? '16px' : '24px',
        paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
        <h1 style={{
          fontWeight: 'bold',
          fontSize: isMobile ? '24px' : '28px',
          color: darkMode ? '#fff' : '#111827',
          marginBottom: '8px'
        }}>
          My Activity
        </h1>
        <p style={{
          fontSize: isMobile ? '13px' : '14px',
          color: darkMode ? '#9ca3af' : '#6b7280'
        }}>
          Track your {currentRole === 'trucker' ? 'bids' : 'bookings'} and contracts
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex gap-2 bg-white dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveSubTab('bids')}
            className={`flex-1 py-2.5 px-4 rounded-md font-medium text-sm transition-all relative ${
              activeSubTab === 'bids'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {currentRole === 'trucker' ? 'My Bids' : 'My Bookings'}
            {unreadBids > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 text-xs font-bold rounded-full ${
                activeSubTab === 'bids'
                  ? 'bg-white text-orange-500'
                  : 'bg-orange-500 text-white'
              }`}>
                {unreadBids}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('contracts')}
            className={`flex-1 py-2.5 px-4 rounded-md font-medium text-sm transition-all relative ${
              activeSubTab === 'contracts'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Contracts
            {pendingContractsCount > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 text-xs font-bold rounded-full ${
                activeSubTab === 'contracts'
                  ? 'bg-white text-orange-500'
                  : 'bg-yellow-500 text-white'
              }`}>
                {pendingContractsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeSubTab === 'bids' && (
          <BidsView
            currentUser={currentUser}
            currentRole={currentRole}
            onOpenChat={onOpenChat}
            darkMode={darkMode}
            embedded={true}
          />
        )}

        {activeSubTab === 'contracts' && (
          <ContractsView
            currentUser={currentUser}
            darkMode={darkMode}
            onOpenContract={onOpenContract}
            embedded={true}
          />
        )}
      </div>
    </main>
  );
}
