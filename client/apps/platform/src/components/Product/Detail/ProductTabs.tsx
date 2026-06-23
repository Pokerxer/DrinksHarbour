"use client";
import React, { useState, useCallback } from "react";
import Image from "next/image";
import * as Icon from "react-icons/pi";
import Rate from "@/components/Other/Rate";
import ProductSpecifications from "./ProductSpecifications";
interface Review {
  _id?: string;
  user?: {
    firstName?: string;
    lastName?: string;
    avatar?: {
      url: string;
    };
  };
  rating: number;
  title?: string;
  comment: string;
  createdAt?: string;
  helpful?: number;
  verified?: boolean;
}
interface ProductTabsProps {
  productData: {
    description?: string;
    shortDescription?: string;
    productionMethod?: string;
    foodPairings?: string[];
    servingSuggestions?: {
      temperature?: string;
      glassware?: string;
      garnish?: string[];
    };
    tastingNotes?: {
      aroma?: string[] | string;
      palate?: string[] | string;
      finish?: string[] | string;
      appearance?: string;
      mouthfeel?: string[] | string;
      color?: string;
    };
    flavorProfile?: string[];
    awards?: Array<{
      title: string;
      organization: string;
      year: number;
      medal?: string;
    }>;
    certifications?: Array<{
      name: string;
      issuedBy: string;
      year?: number;
    }>;
    isDietary?: Record<string, boolean>;
    ingredients?: string[];
    averageRating?: number;
    reviewCount?: number;
    reviews?: {
      preview?: Review[];
      summary?: {
        distribution?: Record<string, number>;
        recommendationRate?: number;
      };
    };
  };
};
const TABS = [
  { id: "description", label: "Description", icon: Icon.PiTextAlignLeft },
  { id: "specifications", label: "Specifications", icon: Icon.PiInfo },
  { id: "reviews", label: "Reviews", icon: Icon.PiStar },
] as const;

const ProductTabs: React.FC<ProductTabsProps> = React.memo(
  ({ productData }) => {
const [activeTab, setActiveTab] = useState<string>("description");
    const [showAllReviews, setShowAllReviews] = useState(false);

    const handleTabChange = useCallback((tabId: string) => {
      setActiveTab(tabId);
    }, []);

    const renderDescription = () => (
      <div className="space-y-8 animate-fadeIn">
        {/* Main Description */}
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Icon.PiTextAlignLeft size={24} className="text-orange-500" />
              About This Product
            </h3>
            <p className="text-gray-600 leading-relaxed">
              {productData.description ||
                productData.shortDescription ||
                "No description available."}
            </p>

            {productData.productionMethod && (
              <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <h4 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                  <Icon.PiGear size={16} />
                  Production Method
                </h4>
                <p className="text-sm text-amber-800 capitalize">
                  {productData.productionMethod.replace(/_/g, " ")}
                </p>
              </div>
            )}
          </div>

          {/* Quick Info */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Icon.PiStar size={24} className="text-orange-500" />
              Product Highlights
            </h3>

            <div className="space-y-4">
              {productData.foodPairings &&
                productData.foodPairings.length > 0 && (
                  <div className="flex gap-3">
                    <Icon.PiForkKnife
                      size={20}
                      className="text-green-600 flex-shrink-0 mt-1"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        Perfect Pairings
                      </p>
                      <p className="text-sm text-gray-600">
                        {productData.foodPairings.join(", ")}
                      </p>
                    </div>
                  </div>
                )}

              {productData.servingSuggestions?.temperature && (
                <div className="flex gap-3">
                  <Icon.PiThermometer
                    size={20}
                    className="text-blue-600 flex-shrink-0 mt-1"
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      Serving Temperature
                    </p>
                    <p className="text-sm text-gray-600">
                      {productData.servingSuggestions.temperature}
                    </p>
                  </div>
                </div>
              )}

              {productData.servingSuggestions?.glassware && (
                <div className="flex gap-3">
                  <Icon.PiWine
                    size={20}
                    className="text-purple-600 flex-shrink-0 mt-1"
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      Recommended Glassware
                    </p>
                    <p className="text-sm text-gray-600">
                      {productData.servingSuggestions.glassware}
                    </p>
                  </div>
                </div>
              )}

              {productData.servingSuggestions?.garnish &&
                productData.servingSuggestions.garnish.length > 0 && (
                  <div className="flex gap-3">
                    <Icon.PiLeaf
                      size={20}
                      className="text-green-600 flex-shrink-0 mt-1"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        Garnish Suggestions
                      </p>
                      <p className="text-sm text-gray-600">
                        {productData.servingSuggestions.garnish.join(", ")}
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Tasting Notes */}
        {productData.tastingNotes && (
          <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Icon.PiNote size={24} className="text-orange-500" />
              Tasting Notes
            </h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
              {productData.tastingNotes.aroma && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon.PiNote size={18} className="text-stone-600" />
                    <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                      Aroma
                    </h4>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {Array.isArray(productData.tastingNotes.aroma)
                      ? productData.tastingNotes.aroma.join(", ")
                      : productData.tastingNotes.aroma}
                  </p>
                </div>
              )}

              {productData.tastingNotes.palate && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon.PiCoffee size={18} className="text-stone-600" />
                    <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                      Palate
                    </h4>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {Array.isArray(productData.tastingNotes.palate)
                      ? productData.tastingNotes.palate.join(", ")
                      : productData.tastingNotes.palate}
                  </p>
                </div>
              )}

              {productData.tastingNotes.finish && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon.PiCheckCircle size={18} className="text-stone-600" />
                    <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                      Finish
                    </h4>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {Array.isArray(productData.tastingNotes.finish)
                      ? productData.tastingNotes.finish.join(", ")
                      : productData.tastingNotes.finish}
                  </p>
                </div>
              )}

              {productData.tastingNotes.appearance && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon.PiEye size={18} className="text-stone-600" />
                    <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                      Appearance
                    </h4>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {productData.tastingNotes.appearance}
                  </p>
                </div>
              )}

              {productData.tastingNotes.mouthfeel && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon.PiDrop size={18} className="text-stone-600" />
                    <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                      Mouthfeel
                    </h4>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {Array.isArray(productData.tastingNotes.mouthfeel)
                      ? productData.tastingNotes.mouthfeel.join(", ")
                      : productData.tastingNotes.mouthfeel}
                  </p>
                </div>
              )}

              {productData.tastingNotes.color && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon.PiPalette size={18} className="text-stone-600" />
                    <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                      Color
                    </h4>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {productData.tastingNotes.color}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Flavor Profile */}
        {productData.flavorProfile && productData.flavorProfile.length > 0 && (
          <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Icon.PiPalette size={24} className="text-purple-600" />
              Flavor Profile
            </h3>
            <div className="flex flex-wrap gap-2">
              {productData.flavorProfile.map((flavor, i) => (
                <span
                  key={i}
                  className="px-4 py-2 bg-white border border-purple-200 rounded-full text-sm font-medium text-purple-900 shadow-sm hover:shadow-md transition-shadow"
                >
                  {flavor.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Awards & Certifications */}
        {(productData.awards && productData.awards.length > 0) ||
        (productData.certifications &&
          productData.certifications.length > 0) ? (
          <div className="grid md:grid-cols-2 gap-6">
            {productData.awards && productData.awards.length > 0 && (
              <div className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Icon.PiTrophy size={24} className="text-amber-600" />
                  Awards & Recognition
                </h3>
                <div className="space-y-3">
                  {productData.awards.slice(0, 5).map((award, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-white rounded-lg"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          award.medal === "gold"
                            ? "bg-amber-500"
                            : award.medal === "silver"
                              ? "bg-gray-400"
                              : award.medal === "bronze"
                                ? "bg-orange-600"
                                : "bg-purple-500"
                        }`}
                      >
                        <Icon.PiMedal size={20} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">
                          {award.title}
                        </p>
                        <p className="text-xs text-gray-600">
                          {award.organization} • {award.year}
                          {award.medal && ` • ${award.medal.toUpperCase()}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {productData.certifications &&
              productData.certifications.length > 0 && (
                <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Icon.PiCertificate size={24} className="text-green-600" />
                    Certifications
                  </h3>
                  <div className="space-y-3">
                    {productData.certifications.map((cert, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 bg-white rounded-lg"
                      >
                        <Icon.PiSeal
                          size={20}
                          className="text-green-600 flex-shrink-0"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900">
                            {cert.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {cert.issuedBy} {cert.year && `• ${cert.year}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        ) : null}

        {/* Dietary Info */}
        {productData.isDietary &&
          Object.values(productData.isDietary).some((v) => v === true) && (
            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Icon.PiLeaf size={24} className="text-blue-600" />
                Dietary Information
              </h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(productData.isDietary)
                  .filter(([_, value]) => value === true)
                  .map(([key], i) => (
                    <span
                      key={i}
                      className="px-4 py-2 bg-white border border-blue-200 rounded-full text-sm font-medium text-blue-900 flex items-center gap-2"
                    >
                      <Icon.PiCheckCircle size={16} className="text-blue-600" />
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                  ))}
              </div>
            </div>
          )}

        {/* Ingredients */}
        {productData.ingredients && productData.ingredients.length > 0 && (
          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Icon.PiListDashes size={24} className="text-gray-700" />
              Ingredients
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {productData.ingredients.join(", ")}
            </p>
          </div>
        )}
      </div>
    );

    const renderReviews = () => {;
const reviews = productData.reviews?.preview || [];
      const totalReviews = productData.reviewCount || 0;
      const averageRating = productData.averageRating || 0;
      const distribution = productData.reviews?.summary?.distribution || {};
      return (
<div className="space-y-8 animate-fadeIn">
          {/* Review Summary */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 bg-gray-50 rounded-2xl">
            <div className="text-center md:text-left">
              <div className="text-5xl font-bold text-gray-900 mb-2">
                {averageRating.toFixed(1)}
              </div>
              <Rate currentRate={averageRating} size={24} />
              <p className="text-gray-600 mt-2">
                Based on {totalReviews} reviews
              </p>
            </div>

            {Object.keys(distribution).length > 0 && (
              <div className="flex-1 w-full max-w-md space-y-2">
                {Object.entries(distribution)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([stars, count]) => {
const percentage =
                      totalReviews > 0
                        ? Math.round((count / totalReviews) * 100)
                        : 0;
                    return (
<div key={stars} className="flex items-center gap-3">
                        <span className="text-sm font-medium w-8">
                          {stars}★
                        </span>
                        <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-black rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">
                          {percentage}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}

            <button className="px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors whitespace-nowrap">
              Write a Review
            </button>
          </div>

          {/* Reviews List */}
          {reviews.length > 0 ? (
            <div className="space-y-6">
              {(showAllReviews ? reviews : reviews.slice(0, 3)).map(
                (review, index) => (
                  <div
                    key={review._id || index}
                    className="p-6 bg-white rounded-2xl border border-gray-200"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        {review.user?.avatar?.url ? (
                          <Image
                            src={review.user.avatar.url}
                            alt={`${review.user.firstName} ${review.user.lastName}`}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <Icon.PiUser size={24} className="text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-900">
                            {review.user?.firstName && review.user?.lastName
                              ? `${review.user.firstName} ${review.user.lastName}`
                              : "Anonymous"}
                          </span>
                          {review.verified && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              Verified Purchase
                            </span>
                          )}
                          <Rate currentRate={review.rating} size={14} />
                        </div>

                        {review.title && (
                          <h4 className="font-bold text-gray-900 mb-2">
                            {review.title}
                          </h4>
                        )}

                        <p className="text-gray-600 leading-relaxed mb-3">
                          {review.comment}
                        </p>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>
                            {review.createdAt
                              ? new Date(review.createdAt).toLocaleDateString()
                              : ""}
                          </span>
                          <button className="flex items-center gap-1 hover:text-gray-900 transition-colors">
                            <Icon.PiThumbsUp size={14} />
                            Helpful ({review.helpful || 0})
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              )}

              {reviews.length > 3 && !showAllReviews && (
                <button
                  onClick={() => setShowAllReviews(true)}
                  className="w-full py-3 border-2 border-gray-200 rounded-xl font-semibold hover:border-black hover:bg-gray-50 transition-all"
                >
                  Show All {reviews.length} Reviews
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <Icon.PiStar size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                No Reviews Yet
              </h3>
              <p className="text-gray-600">
                Be the first to review this product!
              </p>
            </div>
          )}
        </div>
      );
    };
    return (
<section className="py-12 lg:py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {TABS.map((tab) => {
const IconComponent = tab.icon;
              return (
<button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                  flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all duration-200
                  ${
                    activeTab === tab.id
                      ? "bg-black text-white shadow-lg"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }
                `}
                >
                  <IconComponent size={18} />
                  {tab.label}
                  {tab.id === "reviews" && productData.reviewCount && (
                    <span
                      className={`
                    ml-1 px-2 py-0.5 rounded-full text-xs
                    ${activeTab === tab.id ? "bg-white/20" : "bg-gray-200"}
                  `}
                    >
                      {productData.reviewCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="max-w-5xl mx-auto">
            {activeTab === "description" && renderDescription()}
            {activeTab === "specifications" && (
              <ProductSpecifications productData={productData} />
            )}
            {activeTab === "reviews" && renderReviews()}
          </div>
        </div>
      </section>
    );
  },
);
ProductTabs.displayName = "ProductTabs";
export default ProductTabs;
