"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import * as Icon from "react-icons/pi";
import Rate from "@/components/Other/Rate";
import ReviewImageUpload from "./ReviewImageUpload";

// Review Image Interface
interface ReviewImage {
  url: string;
  publicId?: string;
  alt?: string;
  file?: File;
  preview?: string;
  isUploading?: boolean;
}

// User Interface
interface ReviewUser {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  email?: string;
}

// Review Interface matching Mongoose model
interface Review {
  _id: string;
  user: ReviewUser | string;
  product: string;
  subproduct?: string;
  order?: string;
  rating: number;
  title?: string;
  comment: string;
  sentimentScore?: number;
  images?: ReviewImage[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  reportedCount: number;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  moderatedBy?: string;
  moderatedAt?: string;
  moderationNote?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductReviewsProps {
  reviews?: Review[];
  averageRating?: number;
  totalReviews?: number;
  productName?: string;
  productId?: string;
}

const ProductReviews: React.FC<ProductReviewsProps> = ({
  reviews = [],
  averageRating = 0,
  totalReviews = 0,
  productName = "Product",
  productId,
}) => {
  const [activeFilter, setActiveFilter] = useState<number | null>(null);
  const [helpfulReviews, setHelpfulReviews] = useState<string[]>([]);
  const [expandedImage, setExpandedImage] = useState<ReviewImage | null>(null);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [newReview, setNewReview] = useState<{
    rating: number;
    title: string;
    comment: string;
    images: ReviewImage[];
  }>({
    rating: 0,
    title: '',
    comment: '',
    images: [],
  });

  // Ensure reviews is always an array and filter approved reviews only
  const safeReviews = useMemo(() => {
    if (!Array.isArray(reviews)) return [];
    return reviews.filter((review) => review?.status === 'approved');
  }, [reviews]);

  // Get user display name
  const getUserName = (user: ReviewUser | string): string => {
    if (typeof user === 'string') return 'Anonymous';
    if (!user) return 'Anonymous';
    
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.name) return user.name;
    if (user.email) return user.email.split('@')[0];
    return 'Anonymous';
  };

  // Get user avatar
  const getUserAvatar = (user: ReviewUser | string): string | null => {
    if (typeof user === 'string') return null;
    return user?.avatar || null;
  };

  // Calculate rating distribution
  const ratingDistribution = useMemo(() => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    safeReviews.forEach((review) => {
      const rating = Math.floor(review?.rating || 0);
      if (rating >= 1 && rating <= 5) {
        distribution[rating as keyof typeof distribution]++;
      }
    });
    return distribution;
  }, [safeReviews]);

  // Filter reviews
  const filteredReviews = useMemo(() => {
    if (!activeFilter) return safeReviews;
    return safeReviews.filter((review) => Math.floor(review?.rating || 0) === activeFilter);
  }, [safeReviews, activeFilter]);

  // Calculate percentages
  const getPercentage = (count: number) => {
    const total = safeReviews.length || totalReviews;
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  const handleHelpful = (reviewId: string) => {
    setHelpfulReviews((prev) =>
      prev.includes(reviewId)
        ? prev.filter((id) => id !== reviewId)
        : [...prev, reviewId]
    );
    // TODO: API call to update helpfulCount
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Upload images first
    const uploadedImages: ReviewImage[] = [];
    for (const image of newReview.images) {
      if (image.file) {
        // TODO: Upload to your cloud storage (Cloudinary, S3, etc.)
        // const formData = new FormData();
        // formData.append('file', image.file);
        // const response = await fetch('/api/upload', { method: 'POST', body: formData });
        // const data = await response.json();
        
        uploadedImages.push({
          url: image.preview || image.url,
          publicId: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          alt: image.alt,
        });
      } else {
        uploadedImages.push(image);
      }
    }
    
    // Clean up object URLs
    newReview.images.forEach(image => {
      if (image.preview) {
        URL.revokeObjectURL(image.preview);
      }
    });
    
    // TODO: Implement API call to submit review
    const reviewData = {
      rating: newReview.rating,
      title: newReview.title,
      comment: newReview.comment,
      images: uploadedImages,
    };
    console.log('Submitting review:', reviewData);
    
    setShowWriteReview(false);
    setNewReview({ rating: 0, title: '', comment: '', images: [] });
  };

  const renderStars = (rating: number, interactive = false, onRate?: (rating: number) => void) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? "button" : undefined}
            onClick={interactive && onRate ? () => onRate(star) : undefined}
            className={`text-2xl transition-colors ${
              interactive ? "cursor-pointer hover:scale-110" : "cursor-default"
            } ${
              star <= rating
                ? "text-yellow-400"
                : "text-gray-200"
            }`}
          >
            <Icon.PiStarFill />
          </button>
        ))}
      </div>
    );
  };

  if (safeReviews.length === 0 && !showWriteReview) {
    return (
      <div className="text-center py-12">
        <Icon.PiStar size={64} className="mx-auto text-gray-200 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          No Reviews Yet
        </h3>
        <p className="text-gray-500 mb-6">
          Be the first to review this {productName}
        </p>
        <button
          onClick={() => setShowWriteReview(true)}
          className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
        >
          Write a Review
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Rating Summary */}
      <div className="bg-gray-50 rounded-2xl p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Overall Rating */}
          <div className="text-center md:text-left">
            <div className="text-5xl font-bold text-gray-900 mb-2">
              {averageRating.toFixed(1)}
            </div>
            <div className="flex items-center justify-center md:justify-start gap-1 mb-2">
              <Rate currentRate={averageRating} size={20} />
            </div>
            <p className="text-gray-500">Based on {totalReviews || safeReviews.length} reviews</p>
          </div>

          {/* Rating Distribution */}
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Rating Breakdown
            </h3>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = ratingDistribution[rating as keyof typeof ratingDistribution];
                const percentage = getPercentage(count);
                const isActive = activeFilter === rating;

                return (
                  <button
                    key={rating}
                    onClick={() => setActiveFilter(isActive ? null : rating)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      isActive ? "bg-white shadow-sm" : "hover:bg-white/50"
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-700 w-12">
                      {rating} star
                    </span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-900 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-12 text-right">
                      {percentage}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Write Review Button */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900">
                Share your thoughts
              </h3>
              <p className="text-sm text-gray-500">
                If you've used this product, share your thoughts with other customers
              </p>
            </div>
            <button
              onClick={() => setShowWriteReview(!showWriteReview)}
              className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors whitespace-nowrap"
            >
              {showWriteReview ? "Cancel Review" : "Write a Review"}
            </button>
          </div>
        </div>
      </div>

      {/* Write Review Form */}
      {showWriteReview && (
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 md:p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            Write a Review
          </h3>
          <form onSubmit={handleSubmitReview} className="space-y-6">
            {/* Rating Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Overall Rating *
              </label>
              {renderStars(newReview.rating, true, (rating) => 
                setNewReview({ ...newReview, rating })
              )}
            </div>

            {/* Review Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Review Title
              </label>
              <input
                type="text"
                value={newReview.title}
                onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
                placeholder="Summarize your experience"
                maxLength={120}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {newReview.title.length}/120
              </p>
            </div>

            {/* Review Content */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Your Review *
              </label>
              <textarea
                rows={4}
                value={newReview.comment}
                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                placeholder="What did you like or dislike? How was the quality?"
                maxLength={1200}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-colors resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {newReview.comment.length}/1200
              </p>
            </div>

            {/* Photo Upload */}
            <ReviewImageUpload
              images={newReview.images}
              onImagesChange={(images) => setNewReview({ ...newReview, images })}
              maxImages={5}
              maxFileSize={5}
            />

            {/* Submit Buttons */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={!newReview.rating || !newReview.comment}
                className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Submit Review
              </button>
              <button
                type="button"
                onClick={() => {
                  // Clean up object URLs before closing
                  newReview.images.forEach(image => {
                    if (image.preview) {
                      URL.revokeObjectURL(image.preview);
                    }
                  });
                  setShowWriteReview(false);
                  setNewReview({ rating: 0, title: '', comment: '', images: [] });
                }}
                className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tags */}
      {activeFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Filtered by:</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-900 text-white text-sm rounded-full">
            {activeFilter} Stars
            <button
              onClick={() => setActiveFilter(null)}
              className="hover:text-gray-300"
            >
              <Icon.PiX size={14} />
            </button>
          </span>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-6">
        {filteredReviews.map((review) => {
          const userName = getUserName(review.user);
          const userAvatar = getUserAvatar(review.user);
          const displayHelpfulCount = (review.helpfulCount || 0) + 
            (helpfulReviews.includes(review._id) ? 1 : 0);

          return (
            <div
              key={review._id}
              className="bg-white border border-gray-200 rounded-2xl p-6"
            >
              {/* Review Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {userAvatar ? (
                    <Image
                      src={userAvatar}
                      alt={userName}
                      width={48}
                      height={48}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <Icon.PiUser size={24} className="text-gray-500" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {userName}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {review.isVerifiedPurchase && (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <Icon.PiCheckCircle size={14} />
                          Verified Purchase
                        </span>
                      )}
                      <span>•</span>
                      <span>{formatDate(review.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Rate currentRate={review.rating} size={14} />
                </div>
              </div>

              {/* Review Title */}
              {review.title && (
                <h5 className="font-semibold text-gray-900 mb-2">{review.title}</h5>
              )}

              {/* Review Comment */}
              <p className="text-gray-600 leading-relaxed mb-4">
                {review.comment}
              </p>

              {/* Review Images */}
              {review.images && review.images.length > 0 && (
                <div className="flex gap-2 mb-4">
                  {review.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setExpandedImage(image)}
                      className="relative w-20 h-20 rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                    >
                      <Image
                        src={image.url}
                        alt={image.alt || `Review image ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Review Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleHelpful(review._id)}
                  className={`flex items-center gap-2 text-sm transition-colors ${
                    helpfulReviews.includes(review._id)
                      ? "text-gray-900 font-medium"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <Icon.PiThumbsUp
                    size={18}
                    className={helpfulReviews.includes(review._id) ? "fill-current" : ""}
                  />
                  Helpful ({displayHelpfulCount})
                </button>

                {/* Report button */}
                <button className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  Report
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More */}
      {filteredReviews.length > 0 && filteredReviews.length < (totalReviews || safeReviews.length) && (
        <div className="text-center">
          <button className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
            Load More Reviews
          </button>
        </div>
      )}

      {/* Image Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <button
            onClick={() => setExpandedImage(null)}
            className="absolute top-4 right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center z-10 hover:bg-gray-100 transition-colors"
          >
            <Icon.PiX size={24} />
          </button>
          <div className="relative max-w-4xl max-h-[80vh] w-full aspect-square">
            <Image
              src={expandedImage.url}
              alt={expandedImage.alt || "Review image"}
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductReviews;
