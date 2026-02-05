import React, { useState } from 'react';
import { Star, User, MapPin, ThumbsUp, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const RATING_TAGS = {
  positive: [
    { id: 'professional', label: 'Professional' },
    { id: 'punctual', label: 'Punctual' },
    { id: 'good_communication', label: 'Good Communication' },
    { id: 'careful_handling', label: 'Careful Handling' },
    { id: 'friendly', label: 'Friendly' },
    { id: 'fair_pricing', label: 'Fair Pricing' },
  ],
  negative: [
    { id: 'late', label: 'Late Delivery' },
    { id: 'poor_communication', label: 'Poor Communication' },
    { id: 'damaged_goods', label: 'Damaged Goods' },
    { id: 'unprofessional', label: 'Unprofessional' },
  ],
};

export function RatingModal({
  open,
  onClose,
  contract,
  userToRate,
  onSubmit,
  loading = false,
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState('');

  if (!contract || !userToRate) return null;

  const bid = contract.Bid || contract.bid;
  const listing = bid?.CargoListing || bid?.TruckListing || bid?.cargoListing || bid?.truckListing;

  const toggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = () => {
    if (rating === 0) return;

    onSubmit?.({
      contractId: contract.id,
      score: rating,
      tags: selectedTags,
      comment: comment.trim() || undefined,
    });
  };

  const handleClose = () => {
    setRating(0);
    setHoverRating(0);
    setSelectedTags([]);
    setComment('');
    onClose?.();
  };

  const displayRating = hoverRating || rating;

  const getRatingLabel = (score) => {
    if (score >= 5) return 'Excellent!';
    if (score >= 4) return 'Great';
    if (score >= 3) return 'Good';
    if (score >= 2) return 'Fair';
    if (score >= 1) return 'Poor';
    return 'Tap to rate';
  };

  const availableTags = rating >= 3 ? RATING_TAGS.positive : rating > 0 ? [...RATING_TAGS.positive, ...RATING_TAGS.negative] : RATING_TAGS.positive;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md backdrop-blur-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Star className="size-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Rate Your Experience</DialogTitle>
              <DialogDescription>
                Contract #{contract.contractNumber}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* User to Rate */}
        <div className="py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-gray-800/60">
            <div className="size-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
              {userToRate.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{userToRate.name}</p>
              {listing && (
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="size-3" />
                  <span>{listing.origin} → {listing.destination}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Star Rating */}
        <div className="py-6">
          <div className="flex justify-center gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={cn(
                    'size-10 transition-colors',
                    star <= displayRating
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300 dark:text-gray-600'
                  )}
                />
              </button>
            ))}
          </div>
          <p
            className={cn(
              'text-center font-medium transition-colors',
              displayRating >= 4
                ? 'text-green-600 dark:text-green-400'
                : displayRating >= 3
                ? 'text-yellow-600 dark:text-yellow-400'
                : displayRating >= 1
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {getRatingLabel(displayRating)}
          </p>
        </div>

        {/* Tags */}
        {rating > 0 && (
          <div className="py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="size-4 text-gray-500" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                What went well? (Optional)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                    selectedTags.includes(tag.id)
                      ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Comment */}
        {rating > 0 && (
          <div className="py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="size-4 text-gray-500" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Add a comment (Optional)
              </p>
            </div>
            <Textarea
              placeholder="Share your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Skip for Now
          </Button>
          <Button
            variant="gradient"
            onClick={handleSubmit}
            disabled={rating === 0 || loading}
          >
            {loading ? 'Submitting...' : 'Submit Rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RatingModal;
