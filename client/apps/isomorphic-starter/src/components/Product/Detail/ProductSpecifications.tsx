"use client";

import React, { useState, useMemo, useCallback } from "react";
import * as Icon from "react-icons/pi";

// Types
interface SpecificationItem {
  label: string;
  value: string | number | null | undefined;
  icon?: React.ElementType;
}

interface SpecificationCategory {
  category: string;
  icon: React.ElementType;
  items: SpecificationItem[];
  color: string;
  bgColor: string;
}

interface Flavor {
  name: string;
  color?: string;
  category?: string;
  intensity?: string;
  value?: string;
}

interface ProductSpecificationsProps {
  productData: any;
}

// Utility function to format values
const formatValue = (value: any): string => {
  if (value === null || value === undefined || value === "N/A") return "";
  if (typeof value === "string") return value.replace(/_/g, " ");
  return String(value);
};

const ProductSpecifications: React.FC<ProductSpecificationsProps> = ({
  productData,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    "Basic Information",
  ]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }, []);

  const expandAll = useCallback(() => {
    setExpandedCategories(specificationCategories.map((c) => c.category));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedCategories([]);
  }, []);

  // Specification categories configuration
  const specificationCategories: SpecificationCategory[] = useMemo(
    () => [
      {
        category: "Basic Information",
        icon: Icon.PiInfo,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        items: [
          { label: "Product Name", value: productData?.name, icon: Icon.PiTag },
          { label: "SKU", value: productData?.sku, icon: Icon.PiBarcode },
          {
            label: "Barcode",
            value: productData?.barcode,
            icon: Icon.PiBarcode,
          },
          {
            label: "Type",
            value: productData?.type,
            icon: Icon.PiFolder,
          },
          {
            label: "Sub-Type",
            value: productData?.subType,
            icon: Icon.PiFolders,
          },
        ],
      },
      {
        category: "Beverage Details",
        icon: Icon.PiWine,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        items: [
          {
            label: "Alcohol Content",
            value: productData?.abv ? `${productData.abv}% ABV` : null,
            icon: Icon.PiPercent,
          },
          {
            label: "Volume",
            value: productData?.volumeMl ? `${productData.volumeMl}ml` : null,
            icon: Icon.PiDrop,
          },
          {
            label: "Origin",
            value: productData?.originCountry,
            icon: Icon.PiGlobe,
          },
          {
            label: "Region",
            value: productData?.region,
            icon: Icon.PiMapPin,
          },
          {
            label: "Producer",
            value: productData?.producer,
            icon: Icon.PiFactory,
          },
          {
            label: "Production Method",
            value: productData?.productionMethod,
            icon: Icon.PiGear,
          },
        ],
      },
      {
        category: "Brand & Category",
        icon: Icon.PiTrademarkRegistered,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        items: [
          {
            label: "Brand",
            value: productData?.brand?.name,
            icon: Icon.PiCrown,
          },
          {
            label: "Category",
            value: productData?.category?.name,
            icon: Icon.PiFolder,
          },
          {
            label: "Sub-Category",
            value: productData?.subCategory,
            icon: Icon.PiFolders,
          },
        ],
      },
      {
        category: "Physical Attributes",
        icon: Icon.PiCube,
        color: "text-green-600",
        bgColor: "bg-green-50",
        items: [
          {
            label: "Weight",
            value: productData?.weight ? `${productData.weight}g` : null,
            icon: Icon.PiScales,
          },
          {
            label: "Dimensions",
            value: productData?.dimensions,
            icon: Icon.PiRuler,
          },
          {
            label: "Material",
            value: productData?.material,
            icon: Icon.PiHammer,
          },
          {
            label: "Shelf Life",
            value: productData?.shelfLifeDays
              ? `${productData.shelfLifeDays} days`
              : null,
            icon: Icon.PiCalendar,
          },
          {
            label: "Perishable",
            value:
              productData?.isPerishable !== undefined
                ? productData.isPerishable
                  ? "Yes"
                  : "No"
                : null,
            icon: Icon.PiThermometer,
          },
        ],
      },
      {
        category: "Inventory",
        icon: Icon.PiPackage,
        color: "text-red-600",
        bgColor: "bg-red-50",
        items: [
          {
            label: "Status",
            value: productData?.status,
            icon: Icon.PiCircle,
          },
          {
            label: "Available Stock",
            value: productData?.stockInfo?.totalStock,
            icon: Icon.PiStack,
          },
          {
            label: "Total Sold",
            value: productData?.stats?.totalSold,
            icon: Icon.PiChartLineUp,
          },
          {
            label: "Average Rating",
            value: productData?.averageRating
              ? `${productData.averageRating.toFixed(1)}/5`
              : null,
            icon: Icon.PiStar,
          },
          {
            label: "Review Count",
            value: productData?.reviewCount || "0",
            icon: Icon.PiChatCircleText,
          },
        ],
      },
    ],
    [productData]
  );

  // Filter out categories with no valid items
  const filteredCategories = useMemo(
    () =>
      specificationCategories.filter((section) =>
        section.items.some((item) => {
          const formattedValue = formatValue(item.value);
          return formattedValue !== "";
        })
      ),
    [specificationCategories]
  );

  // Render specification card
  const renderSpecificationCard = (section: SpecificationCategory) => {
    const IconComponent = section.icon;
    const isExpanded = expandedCategories.includes(section.category);

    const validItems = section.items.filter((item) => {
      const formattedValue = formatValue(item.value);
      return formattedValue !== "";
    });

    if (validItems.length === 0) return null;

    return (
      <div
        key={section.category}
        className={`bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
          isExpanded ? "ring-2 ring-black ring-offset-2" : ""
        }`}
      >
        {/* Category Header */}
        <button
          onClick={() => toggleCategory(section.category)}
          className={`w-full px-6 py-4 flex items-center justify-between ${section.bgColor} border-b border-gray-100 hover:opacity-90 transition-opacity`}
          aria-expanded={isExpanded}
          aria-controls={`specs-${section.category}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl ${section.bgColor} flex items-center justify-center`}
            >
              <IconComponent size={20} className={section.color} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              {section.category}
            </h3>
            <span className="text-sm text-gray-500 ml-2">
              ({validItems.length} items)
            </span>
          </div>
          <Icon.PiCaretDown
            size={20}
            className={`text-gray-500 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Category Content */}
        <div
          id={`specs-${section.category}`}
          className={`transition-all duration-300 overflow-hidden ${
            isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="divide-y divide-gray-100">
            {validItems.map((item, index) => {
              const ItemIcon = item.icon || Icon.PiInfo;
              const formattedValue = formatValue(item.value);

              return (
                <div
                  key={index}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ItemIcon size={18} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 text-right capitalize">
                    {formattedValue}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render flavor profile section
  const renderFlavorProfile = () => {
    if (!productData?.flavorProfile?.length) return null;

    return (
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 sm:p-8 border border-purple-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-purple-200 rounded-xl flex items-center justify-center">
            <Icon.PiSwatches size={24} className="text-purple-700" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Flavor Profile</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {productData.flavorProfile.map((flavor: string, index: number) => (
            <span
              key={index}
              className="px-4 py-2 bg-white border border-purple-200 text-purple-800 rounded-full text-sm font-semibold hover:bg-purple-100 transition-colors cursor-default"
            >
              {flavor.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Render flavors section
  const renderFlavors = () => {
    if (!productData?.flavors?.length) return null;

    return (
      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-2xl p-6 sm:p-8 border border-orange-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-orange-200 rounded-xl flex items-center justify-center">
            <Icon.PiCookie size={24} className="text-orange-700" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            Flavor Characteristics
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {productData.flavors.map((flavor: Flavor, index: number) => (
            <div
              key={index}
              className="bg-white border border-orange-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                {flavor.color && (
                  <div
                    className="w-4 h-4 rounded-full border border-gray-200 shadow-sm"
                    style={{ backgroundColor: flavor.color }}
                    aria-label={`Color: ${flavor.color}`}
                  />
                )}
                <span className="font-bold text-gray-900">{flavor.name}</span>
              </div>
              <div className="text-sm text-gray-600">
                {flavor.category && (
                  <span className="capitalize">{flavor.category}</span>
                )}
                {flavor.intensity && (
                  <span className="ml-2 text-orange-600">
                    • {flavor.intensity}
                  </span>
                )}
              </div>
              {flavor.value && (
                <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 inline-block">
                  {flavor.value}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render tags section
  const renderTags = () => {
    if (!productData?.tags?.length) return null;

    return (
      <div className="bg-gray-50 rounded-2xl p-6 sm:p-8 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center">
            <Icon.PiHash size={24} className="text-gray-700" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Tags & Attributes</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {productData.tags.map((tag: any, index: number) => {
            // Handle both string tags and object tags
            const tagName = typeof tag === 'string' ? tag : tag?.name || tag?.slug || '';
            const tagColor = typeof tag === 'object' ? tag?.color : null;
            
            if (!tagName) return null;
            
            return (
              <span
                key={index}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-100 hover:border-gray-400 transition-all cursor-default"
                style={tagColor ? { borderColor: tagColor, color: tagColor } : undefined}
              >
                #{tagName}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  // Render control buttons
  const renderControls = () => {
    if (filteredCategories.length === 0) return null;

    return (
      <div className="flex justify-center gap-4 pt-4">
        <button
          onClick={expandAll}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
        >
          <Icon.PiArrowsOutLineVertical size={16} />
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
        >
          <Icon.PiArrowsInLineVertical size={16} />
          Collapse All
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
          Technical Specifications
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Detailed information about this product&apos;s characteristics,
          composition, and properties.
        </p>
      </div>

      {/* Specification Cards */}
      {filteredCategories.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCategories.map(renderSpecificationCard)}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <Icon.PiInfo size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No specifications available for this product.</p>
        </div>
      )}

      {/* Additional Sections */}
      {renderFlavorProfile()}
      {renderFlavors()}
      {renderTags()}

      {/* Controls */}
      {renderControls()}
    </div>
  );
};

export default React.memo(ProductSpecifications);
