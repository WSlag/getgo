import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../lib/utils';

export function ContractVerificationView() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const runVerification = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // Get recent approved payments
      const paymentsQuery = query(
        collection(db, 'paymentSubmissions'),
        where('status', '==', 'approved'),
        orderBy('resolvedAt', 'desc'),
        limit(5)
      );

      const paymentsSnapshot = await getDocs(paymentsQuery);

      if (paymentsSnapshot.empty) {
        setResults({
          payments: [],
          stats: { total: 0, platformFee: 0, contractsCreated: 0, contractsFailed: 0 }
        });
        setLoading(false);
        return;
      }

      let platformFeeCount = 0;
      let contractsCreated = 0;
      let contractsFailed = 0;
      const paymentDetails = [];

      // Check each payment
      for (const paymentDoc of paymentsSnapshot.docs) {
        const payment = paymentDoc.data();
        const paymentId = paymentDoc.id;

        const detail = {
          id: paymentId,
          payment,
          order: null,
          contract: null,
          platformFee: null,
          bid: null,
          listing: null,
          issues: []
        };

        // Get order
        if (payment.orderId) {
          const orderDoc = await getDoc(doc(db, 'orders', payment.orderId));
          if (orderDoc.exists()) {
            detail.order = { id: orderDoc.id, ...orderDoc.data() };

            if (detail.order.type === 'platform_fee') {
              platformFeeCount++;

              // Check platform fee record
              const platformFeeQuery = query(
                collection(db, 'platformFees'),
                where('submissionId', '==', paymentId)
              );
              const platformFeeSnapshot = await getDocs(platformFeeQuery);
              if (!platformFeeSnapshot.empty) {
                detail.platformFee = { id: platformFeeSnapshot.docs[0].id, ...platformFeeSnapshot.docs[0].data() };
              } else {
                detail.issues.push('Platform fee not recorded');
              }

              // Check contract
              if (detail.order.bidId) {
                const contractsQuery = query(
                  collection(db, 'contracts'),
                  where('bidId', '==', detail.order.bidId)
                );
                const contractsSnapshot = await getDocs(contractsQuery);

                if (!contractsSnapshot.empty) {
                  contractsCreated++;
                  detail.contract = { id: contractsSnapshot.docs[0].id, ...contractsSnapshot.docs[0].data() };
                } else {
                  contractsFailed++;
                  detail.issues.push('Contract not created');

                  // Check bid status
                  const bidDoc = await getDoc(doc(db, 'bids', detail.order.bidId));
                  if (bidDoc.exists()) {
                    detail.bid = { id: bidDoc.id, ...bidDoc.data() };

                    if (detail.bid.status !== 'accepted' && detail.bid.status !== 'contracted') {
                      detail.issues.push(`Bid status is "${detail.bid.status}" (should be "accepted" or "contracted")`);
                    }

                    // Check listing
                    const listingId = detail.bid.cargoListingId || detail.bid.truckListingId;
                    const listingCollection = detail.bid.cargoListingId ? 'cargoListings' : 'truckListings';

                    if (listingId) {
                      const listingDoc = await getDoc(doc(db, listingCollection, listingId));
                      if (listingDoc.exists()) {
                        detail.listing = { id: listingDoc.id, ...listingDoc.data(), collection: listingCollection };

                        if (detail.listing.userId !== payment.userId) {
                          detail.issues.push('User ID mismatch (payer ≠ listing owner)');
                        }
                      } else {
                        detail.issues.push('Listing not found');
                      }
                    }
                  } else {
                    detail.issues.push('Bid not found');
                  }
                }
              } else {
                detail.issues.push('No bidId in order');
              }
            }
          } else {
            detail.issues.push('Order not found');
          }
        } else {
          detail.issues.push('No orderId in payment');
        }

        paymentDetails.push(detail);
      }

      setResults({
        payments: paymentDetails,
        stats: {
          total: paymentsSnapshot.size,
          platformFee: platformFeeCount,
          contractsCreated,
          contractsFailed
        }
      });

    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🔍 Contract Creation Verification
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Verify that contracts are being automatically created after admin payment approval
          </p>
        </div>

        {/* Run Button */}
        <Button
          onClick={runVerification}
          disabled={loading}
          size="lg"
          className="mb-6"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          {loading ? 'Checking...' : 'Run Verification Check'}
        </Button>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">Error</h3>
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {results.stats.total}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Approved Payments
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {results.stats.platformFee}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Platform Fee Payments
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 text-center">
                <div className={cn(
                  "text-3xl font-bold",
                  results.stats.contractsCreated > 0 ? "text-green-600 dark:text-green-400" : "text-gray-400"
                )}>
                  {results.stats.contractsCreated}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Contracts Created ✅
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 text-center">
                <div className={cn(
                  "text-3xl font-bold",
                  results.stats.contractsFailed > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"
                )}>
                  {results.stats.contractsFailed}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Contracts Failed ❌
                </div>
              </div>
            </div>

            {/* Empty State */}
            {results.payments.length === 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">No Approved Payments</h3>
                    <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                      There are no approved payments in the system yet.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Details */}
            {results.payments.map((detail) => (
              <div
                key={detail.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  💳 Payment: {detail.id.substring(0, 12)}...
                </h3>

                {/* Order Info */}
                {detail.order && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-blue-900 dark:text-blue-100 mb-2">Order Details</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-blue-700 dark:text-blue-300">Type:</span>
                            <span className={cn(
                              "ml-2 px-2 py-1 rounded text-xs font-medium",
                              detail.order.type === 'platform_fee'
                                ? "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100"
                                : "bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100"
                            )}>
                              {detail.order.type}
                            </span>
                          </div>
                          <div>
                            <span className="text-blue-700 dark:text-blue-300">Amount:</span>
                            <span className="ml-2 text-blue-900 dark:text-blue-100 font-semibold">
                              PHP {detail.order.amount?.toLocaleString()}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-blue-700 dark:text-blue-300">Resolved:</span>
                            <span className="ml-2 text-blue-900 dark:text-blue-100">
                              {formatDate(detail.payment.resolvedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Not Platform Fee */}
                {detail.order && detail.order.type !== 'platform_fee' && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-800 dark:text-yellow-200">
                        This is a <strong>{detail.order.type}</strong> payment. Contracts are only created for <strong>platform_fee</strong> payments.
                      </div>
                    </div>
                  </div>
                )}

                {/* Platform Fee Recorded */}
                {detail.platformFee && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-green-800 dark:text-green-200">
                        ✅ Platform fee recorded
                      </div>
                    </div>
                  </div>
                )}

                {/* Contract Status */}
                {detail.order?.type === 'platform_fee' && (
                  <>
                    {detail.contract ? (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-semibold text-green-900 dark:text-green-100 mb-2">
                              ✅ CONTRACT CREATED SUCCESSFULLY!
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-green-800 dark:text-green-200">
                              <div>
                                <span className="font-medium">Contract Number:</span>
                                <code className="ml-2 bg-green-100 dark:bg-green-800 px-2 py-1 rounded">
                                  {detail.contract.contractNumber}
                                </code>
                              </div>
                              <div>
                                <span className="font-medium">Status:</span>
                                <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded text-xs font-medium">
                                  {detail.contract.status}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium">Agreed Price:</span>
                                <span className="ml-2">PHP {detail.contract.agreedPrice?.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="font-medium">Platform Fee:</span>
                                <span className="ml-2">PHP {detail.contract.platformFee?.toLocaleString()}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="font-medium">Created:</span>
                                <span className="ml-2">{formatDate(detail.contract.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-semibold text-red-900 dark:text-red-100 mb-2">
                              ❌ CONTRACT NOT CREATED
                            </div>
                            {detail.order.bidId && (
                              <div className="text-sm text-red-800 dark:text-red-200 mb-2">
                                Bid ID: <code className="bg-red-100 dark:bg-red-800 px-2 py-1 rounded">{detail.order.bidId}</code>
                              </div>
                            )}
                            {detail.bid && (
                              <div className="text-sm text-red-800 dark:text-red-200 mb-2">
                                Bid Status: <span className={cn(
                                  "ml-2 px-2 py-1 rounded text-xs font-medium",
                                  (detail.bid.status === 'accepted' || detail.bid.status === 'contracted')
                                    ? "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100"
                                    : "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100"
                                )}>
                                  {detail.bid.status}
                                </span>
                              </div>
                            )}
                            {detail.issues.length > 0 && (
                              <div className="mt-2">
                                <div className="font-medium text-red-900 dark:text-red-100 mb-1">Issues Found:</div>
                                <ul className="list-disc list-inside text-sm text-red-800 dark:text-red-200 space-y-1">
                                  {detail.issues.map((issue, idx) => (
                                    <li key={idx}>{issue}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
