import React, { useState, useEffect } from 'react';
import {
  Star,
  Eye,
  Trash2,
  Flag,
  User,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/firebase';

// Star rating display
function StarRating({ score }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'size-4',
            star <= score
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
          )}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-gray-900 dark:text-white">{score}</span>
    </div>
  );
}

export function RatingsManagement() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, average: 0, fiveStars: 0, oneStars: 0 });

  // Fetch ratings
  const fetchRatings = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, 'ratings'), orderBy('createdAt', 'desc')));
      const ratingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Add mock data if empty
      if (ratingsData.length === 0) {
        ratingsData.push(
          { id: '1', raterName: 'Juan Cruz', ratedUserName: 'Pedro Santos', contractNumber: 'CTR-001', score: 5, comment: 'Excellent service! Very professional and on-time delivery.', createdAt: new Date() },
          { id: '2', raterName: 'Maria Garcia', ratedUserName: 'Jose Lopez', contractNumber: 'CTR-002', score: 4, comment: 'Good delivery, minor delay but communicated well.', createdAt: new Date(Date.now() - 86400000) },
          { id: '3', raterName: 'Ana Reyes', ratedUserName: 'Carlos Tan', contractNumber: 'CTR-003', score: 5, comment: 'Perfect! Would definitely recommend.', createdAt: new Date(Date.now() - 172800000) },
          { id: '4', raterName: 'Roberto Cruz', ratedUserName: 'Lisa Garcia', contractNumber: 'CTR-004', score: 2, comment: 'Late delivery and cargo was slightly damaged.', createdAt: new Date(Date.now() - 259200000), flagged: true },
          { id: '5', raterName: 'Teresa Santos', ratedUserName: 'Miguel Reyes', contractNumber: 'CTR-005', score: 5, comment: 'Best trucker I\'ve worked with!', createdAt: new Date(Date.now() - 345600000) },
        );
      }

      setRatings(ratingsData);

      // Calculate stats
      const totalRatings = ratingsData.length;
      const avgScore = totalRatings > 0
        ? ratingsData.reduce((sum, r) => sum + r.score, 0) / totalRatings
        : 0;

      setStats({
        total: totalRatings,
        average: avgScore.toFixed(1),
        fiveStars: ratingsData.filter(r => r.score === 5).length,
        oneStars: ratingsData.filter(r => r.score <= 2).length,
      });
    } catch (error) {
      console.error('Error fetching ratings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRatings();
  }, []);

  // Handle delete rating
  const handleDelete = async (ratingId) => {
    if (!confirm('Are you sure you want to delete this rating?')) return;

    try {
      await deleteDoc(doc(db, 'ratings', ratingId));
      fetchRatings();
    } catch (error) {
      console.error('Error deleting rating:', error);
    }
  };

  // Filter ratings
  const filteredRatings = ratings.filter(rating => {
    // Score filter
    if (scoreFilter !== 'all') {
      const score = parseInt(scoreFilter);
      if (rating.score !== score) return false;
    }

    // Search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      rating.raterName?.toLowerCase().includes(query) ||
      rating.ratedUserName?.toLowerCase().includes(query) ||
      rating.contractNumber?.toLowerCase().includes(query) ||
      rating.comment?.toLowerCase().includes(query)
    );
  });

  // Table columns
  const columns = [
    {
      key: 'rater',
      header: 'From',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <User className="size-4 text-gray-400" />
          <span className="text-sm text-gray-900 dark:text-white">{row.raterName || 'Unknown'}</span>
        </div>
      ),
    },
    {
      key: 'ratedUser',
      header: 'To',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <User className="size-4 text-gray-400" />
          <span className="text-sm text-gray-900 dark:text-white">{row.ratedUserName || 'Unknown'}</span>
        </div>
      ),
    },
    {
      key: 'contract',
      header: 'Contract',
      render: (_, row) => (
        <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
          {row.contractNumber || 'N/A'}
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Rating',
      render: (_, row) => <StarRating score={row.score} />,
    },
    {
      key: 'comment',
      header: 'Comment',
      render: (_, row) => (
        <div className="max-w-xs">
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {row.comment || 'No comment'}
          </p>
          {row.flagged && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs mt-1">
              <Flag className="size-3" />
              Flagged
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (_, row) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(row.createdAt, { year: undefined, hour: undefined, minute: undefined })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost">
            <Eye className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row.id);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '28px' : '20px' }}>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: isDesktop ? '24px' : '12px' }}>
        <StatCard
          title="Total Ratings"
          value={stats.total}
          icon={MessageSquare}
          iconColor="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Average Rating"
          value={stats.average}
          icon={Star}
          iconColor="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
        />
        <StatCard
          title="5-Star Ratings"
          value={stats.fiveStars}
          icon={Star}
          iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
        <StatCard
          title="Low Ratings (1-2)"
          value={stats.oneStars}
          icon={Flag}
          iconColor="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        />
      </div>

      {/* Rating Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm" style={{ padding: isDesktop ? '24px' : '16px' }}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rating Distribution</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratings.filter(r => r.score === star).length;
            const percentage = ratings.length > 0 ? (count / ratings.length) * 100 : 0;

            return (
              <div key={star} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-20">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{star}</span>
                  <Star className="size-4 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 w-16 text-right">
                  {count} ({percentage.toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredRatings}
        loading={loading}
        emptyMessage="No ratings found"
        emptyIcon={Star}
        searchable
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by user, contract, or comment..."
        filters={
          <>
            <FilterButton active={scoreFilter === 'all'} onClick={() => setScoreFilter('all')}>
              All
            </FilterButton>
            <FilterButton active={scoreFilter === '5'} onClick={() => setScoreFilter('5')}>
              5 Stars
            </FilterButton>
            <FilterButton active={scoreFilter === '4'} onClick={() => setScoreFilter('4')}>
              4 Stars
            </FilterButton>
            <FilterButton active={scoreFilter === '3'} onClick={() => setScoreFilter('3')}>
              3 Stars
            </FilterButton>
            <FilterButton active={scoreFilter === '2'} onClick={() => setScoreFilter('2')}>
              1-2 Stars
            </FilterButton>
          </>
        }
      />
    </div>
  );
}

export default RatingsManagement;
