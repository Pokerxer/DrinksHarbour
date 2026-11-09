// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { Input, Text, Button, Switch, Badge } from 'rizzui';
import { useTenant } from '@/context/TenantContext';
import { resolveTenantIndustries } from '@/utils/industries';
import { catalogBusiness } from '@/utils/catalog-business';
import VariantImageField from './variant-image-field';
import { availableCustomSize, businessSizeOptions, sizePresetMeasurements } from './business-size-options';
import { SIZE_GROUPS } from '@/utils/retail-product-types';
import SingleItemConfirmation from './components/SingleItemConfirmation';
import RemoveSizeButton from './components/RemoveSizeButton';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  PiPlus,
  PiTrash,
  PiRuler,
  PiPackage,
  PiCaretDown,
  PiCaretUp,
  PiCopy,
  PiArrowsDownUp,
  PiCheck,
  PiWarning,
  PiCheckCircle,
  PiMagnifyingGlass,
  PiFunnel,
  PiGauge,
  PiSparkle,
  PiTrendUp,
  PiStack,
  PiCurrencyNgn,
  PiPercent,
  PiWarehouse,
  PiTimer,
  PiEraser,
  PiInfo,
  PiDotsSixVertical,
  PiCopySimple,
  PiChartLine,
} from 'react-icons/pi';
import {
  fieldStaggerVariants,
  containerVariants,
  toggleVariants,
  itemVariants,
} from './animations';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { useSession } from 'next-auth/react';
import { productService } from '@/services/product.service';
import { isBeverageProductType } from '@/utils/product-types';
import {
  normalizeColorHexInput,
  isCompleteColorHex,
  COLOR_NAME_MAX_LENGTH,
} from './color-variant';

// Enhanced animations
const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
  exit: {
    opacity: 0,
    scale: 0.95,
    x: -100,
    transition: { duration: 0.2 },
  },
  hover: {
    scale: 1.01,
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
    transition: { duration: 0.2 },
  },
};

const expandVariants = {
  hidden: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
  },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      duration: 0.2,
    },
  },
};

const buttonTapVariants = {
  tap: { scale: 0.95 },
  hover: { scale: 1.02 },
};

const shimmerVariants = {
  initial: { x: '-100%' },
  animate: { x: '100%' },
};

const quickAddVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
};

const MARKUP_PRESETS = [10, 15, 20, 25, 30, 35, 50, 75, 100];

export const SIZE_OPTIONS = [
  // Wine & Champagne Bottles
  { value: '10cl', label: '10cl', category: 'Wine & Champagne' },
  { value: '18.7cl', label: '18.7cl', category: 'Wine & Champagne' },
  { value: '20cl', label: '20cl', category: 'Wine & Champagne' },
  { value: '25cl', label: '25cl', category: 'Wine & Champagne' },
  {
    value: '37.5cl',
    label: '37.5cl (Half Bottle)',
    category: 'Wine & Champagne',
  },
  { value: '50cl', label: '50cl', category: 'Wine & Champagne' },
  { value: '75cl', label: '75cl (Standard)', category: 'Wine & Champagne' },
  { value: '100cl', label: '100cl', category: 'Wine & Champagne' },
  { value: '150cl', label: '150cl (Magnum)', category: 'Wine & Champagne' },
  {
    value: '300cl',
    label: '300cl (Double Magnum)',
    category: 'Wine & Champagne',
  },
  { value: '450cl', label: '450cl (Jeroboam)', category: 'Wine & Champagne' },
  { value: '600cl', label: '600cl (Imperial)', category: 'Wine & Champagne' },
  { value: '900cl', label: '900cl (Salmanazar)', category: 'Wine & Champagne' },
  {
    value: '1200cl',
    label: '1200cl (Balthazar)',
    category: 'Wine & Champagne',
  },
  {
    value: '1500cl',
    label: '1500cl (Nebuchadnezzar)',
    category: 'Wine & Champagne',
  },
  { value: '1800cl', label: '1800cl (Melchior)', category: 'Wine & Champagne' },

  // Spirits
  { value: '5cl', label: '5cl (Miniature)', category: 'Spirits' },
  { value: '10cl', label: '10cl', category: 'Spirits' },
  { value: '20cl', label: '20cl', category: 'Spirits' },
  { value: '35cl', label: '35cl', category: 'Spirits' },
  { value: '50ml', label: '50ml (Nip)', category: 'Spirits' },
  { value: '70cl', label: '70cl (Standard)', category: 'Spirits' },
  { value: '1L', label: '1 Liter', category: 'Spirits' },
  { value: '1.5L', label: '1.5 Liter', category: 'Spirits' },
  { value: '1.75L', label: '1.75 Liter', category: 'Spirits' },
  { value: '3L', label: '3 Liter', category: 'Spirits' },

  // Beer & Cider Bottles
  { value: '27.5cl', label: '27.5cl', category: 'Beer & Cider' },
  { value: '33cl', label: '33cl', category: 'Beer & Cider' },
  { value: '35cl', label: '35cl', category: 'Beer & Cider' },
  { value: '44cl', label: '44cl', category: 'Beer & Cider' },
  { value: '50cl', label: '50cl', category: 'Beer & Cider' },
  { value: '56.8cl', label: '56.8cl', category: 'Beer & Cider' },
  { value: '66cl', label: '66cl', category: 'Beer & Cider' },
  { value: 'bottle-275ml', label: 'Bottle 275ml', category: 'Beer & Cider' },
  { value: 'bottle-330ml', label: 'Bottle 330ml', category: 'Beer & Cider' },
  { value: 'bottle-355ml', label: 'Bottle 355ml', category: 'Beer & Cider' },
  { value: 'bottle-500ml', label: 'Bottle 500ml', category: 'Beer & Cider' },
  {
    value: 'bottle-568ml',
    label: 'Bottle 568ml (Pint)',
    category: 'Beer & Cider',
  },
  { value: 'bottle-600ml', label: 'Bottle 600ml', category: 'Beer & Cider' },
  { value: 'bottle-650ml', label: 'Bottle 650ml', category: 'Beer & Cider' },
  { value: 'bottle-750ml', label: 'Bottle 750ml', category: 'Beer & Cider' },

  // Beer Cans
  { value: 'can-200ml', label: 'Can 200ml', category: 'Beer Cans' },
  { value: 'can-250ml', label: 'Can 250ml', category: 'Beer Cans' },
  { value: 'can-330ml', label: 'Can 330ml', category: 'Beer Cans' },
  { value: 'can-355ml', label: 'Can 355ml', category: 'Beer Cans' },
  { value: 'can-440ml', label: 'Can 440ml', category: 'Beer Cans' },
  { value: 'can-473ml', label: 'Can 473ml', category: 'Beer Cans' },
  { value: 'can-500ml', label: 'Can 500ml', category: 'Beer Cans' },
  { value: 'can-568ml', label: 'Can 568ml', category: 'Beer Cans' },

  // Soft Drinks & Water
  { value: '200ml', label: '200ml', category: 'Soft Drinks & Water' },
  { value: '250ml', label: '250ml', category: 'Soft Drinks & Water' },
  { value: '300ml', label: '300ml', category: 'Soft Drinks & Water' },
  { value: '330ml', label: '330ml', category: 'Soft Drinks & Water' },
  { value: '355ml', label: '355ml', category: 'Soft Drinks & Water' },
  { value: '500ml', label: '500ml', category: 'Soft Drinks & Water' },
  { value: '600ml', label: '600ml', category: 'Soft Drinks & Water' },
  { value: '750ml', label: '750ml', category: 'Soft Drinks & Water' },
  { value: '1L', label: '1 Liter', category: 'Soft Drinks & Water' },
  { value: '1.25L', label: '1.25 Liter', category: 'Soft Drinks & Water' },
  { value: '1.5L', label: '1.5 Liter', category: 'Soft Drinks & Water' },
  { value: '2L', label: '2 Liter', category: 'Soft Drinks & Water' },
  { value: '2.5L', label: '2.5 Liter', category: 'Soft Drinks & Water' },
  { value: '3L', label: '3 Liter', category: 'Soft Drinks & Water' },
  { value: '5L', label: '5 Liter', category: 'Soft Drinks & Water' },

  // Multi-Packs
  { value: 'pack-2', label: '2-Pack', category: 'Multi-Packs' },
  { value: 'pack-3', label: '3-Pack', category: 'Multi-Packs' },
  { value: 'pack-5', label: '5-Pack', category: 'Multi-Packs' },
  { value: 'pack-4', label: '4-Pack', category: 'Multi-Packs' },
  { value: 'pack-6', label: '6-Pack', category: 'Multi-Packs' },
  { value: 'pack-8', label: '8-Pack', category: 'Multi-Packs' },
  { value: 'pack-10', label: '10-Pack', category: 'Multi-Packs' },
  { value: 'pack-12', label: '12-Pack', category: 'Multi-Packs' },
  { value: 'pack-18', label: '18-Pack', category: 'Multi-Packs' },
  { value: 'pack-24', label: '24-Pack', category: 'Multi-Packs' },
  { value: 'pack-30', label: '30-Pack', category: 'Multi-Packs' },
  { value: 'pack-36', label: '36-Pack', category: 'Multi-Packs' },
  { value: 'case-6', label: 'Case of 6', category: 'Multi-Packs' },
  { value: 'case-12', label: 'Case of 12', category: 'Multi-Packs' },
  { value: 'case-24', label: 'Case of 24', category: 'Multi-Packs' },

  // Coffee & Tea (Weight-based)
  { value: '50g', label: '50g', category: 'Coffee & Tea' },
  { value: '100g', label: '100g', category: 'Coffee & Tea' },
  { value: '125g', label: '125g', category: 'Coffee & Tea' },
  { value: '200g', label: '200g', category: 'Coffee & Tea' },
  { value: '250g', label: '250g', category: 'Coffee & Tea' },
  { value: '240g', label: '240g', category: 'Snacks' },
  { value: '340g', label: '340g', category: 'Coffee & Tea' },
  { value: '500g', label: '500g', category: 'Coffee & Tea' },
  { value: '1kg', label: '1kg', category: 'Coffee & Tea' },
  { value: '2kg', label: '2kg', category: 'Coffee & Tea' },

  // Procurement weight codes also used by shisha and charcoal.
  { value: 'kg-0.5', label: '0.5 kg', category: 'Procurement Weight' },
  { value: 'kg-1', label: '1 kg', category: 'Procurement Weight' },
  { value: 'kg-2', label: '2 kg', category: 'Procurement Weight' },

  // Tea Bags
  { value: 'teabag-20', label: '20 Tea Bags', category: 'Tea Bags' },
  { value: 'teabag-25', label: '25 Tea Bags', category: 'Tea Bags' },
  { value: 'teabag-40', label: '40 Tea Bags', category: 'Tea Bags' },
  { value: 'teabag-50', label: '50 Tea Bags', category: 'Tea Bags' },
  { value: 'teabag-100', label: '100 Tea Bags', category: 'Tea Bags' },

  // Single Serve
  { value: 'unit-single', label: 'Single Unit', category: 'Single Serve' },
  { value: 'shot-25ml', label: 'Shot 25ml', category: 'Single Serve' },
  { value: 'shot-35ml', label: 'Shot 35ml', category: 'Single Serve' },
  { value: 'shot-50ml', label: 'Shot 50ml', category: 'Single Serve' },

  // Gift Sets
  { value: 'set-2', label: 'Set of 2', category: 'Gift Sets' },
  { value: 'set-3', label: 'Set of 3', category: 'Gift Sets' },
  { value: 'set-4', label: 'Set of 4', category: 'Gift Sets' },
  { value: 'set-6', label: 'Set of 6', category: 'Gift Sets' },
  { value: 'set-12', label: 'Set of 12', category: 'Gift Sets' },
  { value: 'gift-set', label: 'Gift Set', category: 'Gift Sets' },
  { value: 'tasting-set', label: 'Tasting Set', category: 'Gift Sets' },
  { value: 'variety-pack', label: 'Variety Pack', category: 'Gift Sets' },

  // Glassware & Barware
  {
    value: 'piece-single',
    label: 'Single Piece',
    category: 'Glassware & Barware',
  },
  { value: 'pair', label: 'Pair (2)', category: 'Glassware & Barware' },
  { value: 'set-5', label: 'Set of 5', category: 'Glassware & Barware' },
  { value: 'set-8', label: 'Set of 8', category: 'Glassware & Barware' },
  { value: 'set-10', label: 'Set of 10', category: 'Glassware & Barware' },
  { value: 'set-16', label: 'Set of 16', category: 'Glassware & Barware' },
  { value: 'set-24', label: 'Set of 24', category: 'Glassware & Barware' },
  {
    value: 'set-barware',
    label: 'Barware Set',
    category: 'Glassware & Barware',
  },
  { value: 'kit-3', label: '3-Piece Kit', category: 'Glassware & Barware' },
  { value: 'kit-5', label: '5-Piece Kit', category: 'Glassware & Barware' },
  { value: 'kit-8', label: '8-Piece Kit', category: 'Glassware & Barware' },
  { value: 'kit-10', label: '10-Piece Kit', category: 'Glassware & Barware' },

  // Gifts & Lifestyle
  { value: 'box-single', label: 'Single Box', category: 'Gifts & Lifestyle' },
  { value: 'box-5', label: 'Box of 5', category: 'Gifts & Lifestyle' },
  { value: 'box-10', label: 'Box of 10', category: 'Gifts & Lifestyle' },
  { value: 'box-20', label: 'Box of 20', category: 'Gifts & Lifestyle' },
  { value: 'box-24', label: 'Box of 24', category: 'Gifts & Lifestyle' },
  { value: 'box-25', label: 'Box of 25', category: 'Gifts & Lifestyle' },
  { value: 'box-50', label: 'Box of 50', category: 'Gifts & Lifestyle' },

  // Snacks & Confectionery
  {
    value: 'bar-single',
    label: 'Single Bar',
    category: 'Snacks & Confectionery',
  },
  { value: 'bar-2', label: '2-Bar Pack', category: 'Snacks & Confectionery' },
  {
    value: 'bag-100g',
    label: 'Bag 100g',
    category: 'Snacks & Confectionery',
  },
  {
    value: 'bag-200g',
    label: 'Bag 200g',
    category: 'Snacks & Confectionery',
  },
  {
    value: 'bag-250g',
    label: 'Bag 250g',
    category: 'Snacks & Confectionery',
  },
  {
    value: 'bag-500g',
    label: 'Bag 500g',
    category: 'Snacks & Confectionery',
  },
  { value: 'bag-1kg', label: 'Bag 1kg', category: 'Snacks & Confectionery' },
  {
    value: 'tin-single',
    label: 'Single Tin',
    category: 'Snacks & Confectionery',
  },
  {
    value: 'tin-200g',
    label: 'Tin 200g',
    category: 'Snacks & Confectionery',
  },
  {
    value: 'tin-500g',
    label: 'Tin 500g',
    category: 'Snacks & Confectionery',
  },

  // Cigars & Smoking
  {
    value: 'cigar-single',
    label: 'Single Cigar',
    category: 'Cigars & Smoking',
  },
  { value: 'sampler-5', label: 'Sampler of 5', category: 'Cigars & Smoking' },
  { value: 'sampler-6', label: 'Sampler of 6', category: 'Cigars & Smoking' },
  { value: 'box-5', label: 'Box of 5', category: 'Cigars & Smoking' },
  { value: 'box-10', label: 'Box of 10', category: 'Cigars & Smoking' },
  { value: 'box-20', label: 'Box of 20', category: 'Cigars & Smoking' },
  { value: 'box-24', label: 'Box of 24', category: 'Cigars & Smoking' },
  { value: 'box-25', label: 'Box of 25', category: 'Cigars & Smoking' },
  { value: 'box-50', label: 'Box of 50', category: 'Cigars & Smoking' },

  // Vapes & E-liquids
  { value: '10ml', label: '10ml E-liquid', category: 'Vapes & E-liquids' },
  { value: '15ml', label: '15 ml', category: 'Small Containers' },
  { value: '30ml', label: '30ml E-liquid', category: 'Vapes & E-liquids' },
  { value: '60ml', label: '60ml E-liquid', category: 'Vapes & E-liquids' },
  { value: '100ml', label: '100ml E-liquid', category: 'Vapes & E-liquids' },
  { value: '120ml', label: '120ml E-liquid', category: 'Vapes & E-liquids' },
  { value: 'pod-1', label: 'Single Pod', category: 'Vapes & E-liquids' },
  { value: 'pod-2', label: '2 Pods', category: 'Vapes & E-liquids' },
  { value: 'pod-4', label: '4 Pods', category: 'Vapes & E-liquids' },
  {
    value: 'pouch-20',
    label: 'Can of 20 Pouches',
    category: 'Vapes & E-liquids',
  },
  { value: 'puffs-600', label: '600 Puffs', category: 'Vapes & E-liquids' },
  { value: 'puffs-800', label: '800 Puffs', category: 'Vapes & E-liquids' },
  { value: 'puffs-1500', label: '1500 Puffs', category: 'Vapes & E-liquids' },
  { value: 'puffs-2500', label: '2500 Puffs', category: 'Vapes & E-liquids' },
  { value: 'puffs-3500', label: '3500 Puffs', category: 'Vapes & E-liquids' },
  { value: 'puffs-5000', label: '5000 Puffs', category: 'Vapes & E-liquids' },
  { value: 'puffs-6000', label: '6000 Puffs', category: 'Vapes & E-liquids' },
  { value: 'puffs-10000', label: '10000 Puffs', category: 'Vapes & E-liquids' },

  // ── Retail vertical canonical sizes (mirror of server/models/Size.js
  // enum appends; constants/productTypes.js STANDARD_SIZES.APPAREL/SHOES/
  // STORAGE — Apparel includes '6xl' and Shoes include 'us-m-8.5' exactly as
  // the Size enum accepts them) ────────────────────────────────────────────
  // Apparel (fashion_top/dress/bottom/outerwear/innerwear/kids)
  { value: 'xs', label: 'XS', category: 'Apparel' },
  { value: 's', label: 'S', category: 'Apparel' },
  { value: 'm', label: 'M', category: 'Apparel' },
  { value: 'l', label: 'L', category: 'Apparel' },
  { value: 'xl', label: 'XL', category: 'Apparel' },
  { value: '2xl', label: '2XL', category: 'Apparel' },
  { value: '3xl', label: '3XL', category: 'Apparel' },
  { value: '4xl', label: '4XL', category: 'Apparel' },
  { value: '5xl', label: '5XL', category: 'Apparel' },
  { value: '6xl', label: '6XL', category: 'Apparel' },
  { value: 'one_size', label: 'One Size', category: 'Apparel' },

  // Shoes (EU 35–47, US Men's 6–13 incl. 8.5, US Women's 4–12)
  { value: 'eu-35', label: 'EU 35', category: 'Shoes' },
  { value: 'eu-36', label: 'EU 36', category: 'Shoes' },
  { value: 'eu-37', label: 'EU 37', category: 'Shoes' },
  { value: 'eu-38', label: 'EU 38', category: 'Shoes' },
  { value: 'eu-39', label: 'EU 39', category: 'Shoes' },
  { value: 'eu-40', label: 'EU 40', category: 'Shoes' },
  { value: 'eu-41', label: 'EU 41', category: 'Shoes' },
  { value: 'eu-42', label: 'EU 42', category: 'Shoes' },
  { value: 'eu-43', label: 'EU 43', category: 'Shoes' },
  { value: 'eu-44', label: 'EU 44', category: 'Shoes' },
  { value: 'eu-45', label: 'EU 45', category: 'Shoes' },
  { value: 'eu-46', label: 'EU 46', category: 'Shoes' },
  { value: 'eu-47', label: 'EU 47', category: 'Shoes' },
  { value: 'us-m-6', label: "US Men's 6", category: 'Shoes' },
  { value: 'us-m-7', label: "US Men's 7", category: 'Shoes' },
  { value: 'us-m-8', label: "US Men's 8", category: 'Shoes' },
  { value: 'us-m-8.5', label: "US Men's 8.5", category: 'Shoes' },
  { value: 'us-m-9', label: "US Men's 9", category: 'Shoes' },
  { value: 'us-m-10', label: "US Men's 10", category: 'Shoes' },
  { value: 'us-m-11', label: "US Men's 11", category: 'Shoes' },
  { value: 'us-m-12', label: "US Men's 12", category: 'Shoes' },
  { value: 'us-m-13', label: "US Men's 13", category: 'Shoes' },
  { value: 'us-w-4', label: "US Women's 4", category: 'Shoes' },
  { value: 'us-w-5', label: "US Women's 5", category: 'Shoes' },
  { value: 'us-w-6', label: "US Women's 6", category: 'Shoes' },
  { value: 'us-w-7', label: "US Women's 7", category: 'Shoes' },
  { value: 'us-w-8', label: "US Women's 8", category: 'Shoes' },
  { value: 'us-w-9', label: "US Women's 9", category: 'Shoes' },
  { value: 'us-w-10', label: "US Women's 10", category: 'Shoes' },
  { value: 'us-w-11', label: "US Women's 11", category: 'Shoes' },
  { value: 'us-w-12', label: "US Women's 12", category: 'Shoes' },

  // Electronics — device storage tiers (phones/tablets/laptops/gaming)
  {
    value: 'storage-16gb',
    label: '16GB Storage',
    category: 'Device Storage',
  },
  {
    value: 'storage-32gb',
    label: '32GB Storage',
    category: 'Device Storage',
  },
  {
    value: 'storage-64gb',
    label: '64GB Storage',
    category: 'Device Storage',
  },
  {
    value: 'storage-128gb',
    label: '128GB Storage',
    category: 'Device Storage',
  },
  {
    value: 'storage-256gb',
    label: '256GB Storage',
    category: 'Device Storage',
  },
  {
    value: 'storage-512gb',
    label: '512GB Storage',
    category: 'Device Storage',
  },
  { value: 'storage-1tb', label: '1TB Storage', category: 'Device Storage' },
  { value: 'storage-2tb', label: '2TB Storage', category: 'Device Storage' },
  { value: 'storage-4tb', label: '4TB Storage', category: 'Device Storage' },

  // Electronics sizing systems (2026-11-03) — screen inches, RAM, battery
  // capacity; scoped to electronics types via the server size-guidance
  // endpoint (same contract as the fashion groups).
  ...SIZE_GROUPS.portableScreen.values.map((value) => ({
    value,
    label: `${value.slice('screen-'.length)}-inch`,
    category: SIZE_GROUPS.portableScreen.category,
  })),
  { value: 'screen-24', label: '24-inch', category: 'Screen Size' },
  { value: 'screen-32', label: '32-inch', category: 'Screen Size' },
  { value: 'screen-43', label: '43-inch', category: 'Screen Size' },
  { value: 'screen-50', label: '50-inch', category: 'Screen Size' },
  { value: 'screen-55', label: '55-inch', category: 'Screen Size' },
  { value: 'screen-65', label: '65-inch', category: 'Screen Size' },
  { value: 'screen-75', label: '75-inch', category: 'Screen Size' },
  { value: 'screen-85', label: '85-inch', category: 'Screen Size' },
  { value: 'ram-4gb', label: '4GB RAM', category: 'RAM' },
  { value: 'ram-8gb', label: '8GB RAM', category: 'RAM' },
  { value: 'ram-16gb', label: '16GB RAM', category: 'RAM' },
  { value: 'ram-32gb', label: '32GB RAM', category: 'RAM' },
  { value: 'ram-64gb', label: '64GB RAM', category: 'RAM' },
  { value: 'battery-5000mah', label: '5,000mAh', category: 'Battery Capacity' },
  { value: 'battery-10000mah', label: '10,000mAh', category: 'Battery Capacity' },
  { value: 'battery-20000mah', label: '20,000mAh', category: 'Battery Capacity' },
  { value: 'battery-26800mah', label: '26,800mAh', category: 'Battery Capacity' },

  // Custom
  { value: 'custom', label: 'Custom Size', category: 'Other' },
  { value: 'variable', label: 'Variable Size', category: 'Other' },
  { value: 'assorted', label: 'Assorted', category: 'Other' },
];

export default function SubProductSizes() {
  const methods = useFormContext();
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const setError = methods?.setError;
  const clearErrors = methods?.clearErrors;
  const getValues = methods?.getValues;
  const formState = methods?.formState;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'subProductData.sizes',
  });

  const sellWithoutSizeVariants = watch?.(
    'subProductData.sellWithoutSizeVariants'
  );
  const [confirmSingleItem, setConfirmSingleItem] = useState(false);
  const defaultMarkup = watch?.('subProductData.markupPercentage') ?? 25;
  const defaultRoundUp = watch?.('subProductData.roundUp') ?? '100';
  const defaultCostPrice = watch?.('subProductData.costPrice');
  const defaultDiscount = watch?.('subProductData.saleDiscountPercentage') ?? 0;
  const defaultCurrency = watch?.('subProductData.currency') ?? 'NGN';

  // ── Non-beverage color variants (industry Size rows) ──────────────────────
  // The Color inputs only exist for non-beverage products: resolve the parent
  // product's type from whichever signal the form currently carries —
  // `createNewProduct` carries the type inline; a linked catalogue product is
  // read (once, aborted on change) like Basic Info does.
  const { data: sessionData } = useSession();
  const { tenant } = useTenant();
  const tenantIndustries = resolveTenantIndustries(tenant);
  const parentProductId = watch?.('subProductData.product') || '';
  const createNewProduct = watch?.('subProductData.createNewProduct');
  const newProductType =
    watch?.('subProductData.newProductData.type') || '';
  const [linkedProduct, setLinkedProduct] = useState<{ id: string; type: string }>();

  useEffect(() => {
    setLinkedProduct(undefined);
    if (!parentProductId || createNewProduct) return;
    const controller = new AbortController();
    let stale = false;
    productService
      .getProductById(
        parentProductId,
        sessionData?.user?.token || '',
        true,
        controller.signal
      )
      .then((response) => {
        if (!stale) setLinkedProduct({ id: parentProductId, type: response?.data?.product?.type || '' });
      })
      .catch(() => {
        if (!stale) setLinkedProduct(undefined);
      });
    return () => {
      stale = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentProductId, createNewProduct, sessionData?.user?.token]);

  const resolvedProductType = createNewProduct
    ? newProductType
    : linkedProduct?.id === parentProductId ? linkedProduct.type : '';
  const isBeverage = !!resolvedProductType && isBeverageProductType(resolvedProductType);
  const business = resolvedProductType
    ? catalogBusiness(resolvedProductType)
    : tenantIndustries?.length === 1 ? tenantIndustries[0] : 'all';
  const optionLabel = ({
    beauty: 'Scent or finish',
    home: 'Finish or material',
    electronics: 'Configuration',
    'food-service': 'Pack format or grade',
    hospitality: 'Format or finish',
    beverage: 'Bottle, pack or serving format',
  } as Record<string, string>)[business];
  const showColorInputs = ['fashion', 'beauty', 'home', 'electronics', 'hospitality'].includes(business)
    || (business === 'all' && !!resolvedProductType && !isBeverage);
  const allowsOptions = showColorInputs || !!optionLabel;


  const [guidance, setGuidance] = useState<{ type: string; sizes: string[] }>();
  useEffect(() => {
    const type = resolvedProductType;
    setGuidance(undefined);
    if (!type || !sessionData?.user?.token) return;
    const controller = new AbortController();
    productService
      .getSizeGuidance(sessionData.user.token, type, controller.signal)
      .then(sizes => {
        if (!controller.signal.aborted) setGuidance({ type, sizes });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [resolvedProductType, sessionData?.user?.token]);

  const allowedOptions = businessSizeOptions(
    SIZE_OPTIONS,
    resolvedProductType,
    guidance?.type === resolvedProductType ? guidance?.sizes : undefined,
    tenantIndustries
  );
  const quickAddOptions = allowedOptions.filter(({ value }) => value !== 'custom' && value !== 'variable').slice(0, 12);

  const calculateBasePrice = (
    variantCostPrice: number,
    variantMarkup: number,
    variantRoundUp: string
  ) => {
    if (!variantCostPrice || variantCostPrice <= 0) return 0;
    let calculatedPrice = variantCostPrice * (1 + variantMarkup / 100);

    if (variantRoundUp === '100') {
      calculatedPrice = Math.ceil(calculatedPrice / 100) * 100;
    } else if (variantRoundUp === '1000') {
      calculatedPrice = Math.ceil(calculatedPrice / 1000) * 1000;
    }

    return Number(calculatedPrice.toFixed(2));
  };

  const calculateSalePrice = (
    variantBasePrice: number,
    discountPercentage: number
  ) => {
    if (!variantBasePrice || variantBasePrice <= 0 || !discountPercentage)
      return null;
    const salePrice = variantBasePrice * (1 - discountPercentage / 100);
    return Number(salePrice.toFixed(2));
  };

  const addSize = (preset?: { value: string; label: string }) => {
    if (!allowsOptions && preset && fields.some((_, i) => watch(`subProductData.sizes.${i}.size`) === preset.value)) {
      toast.error(`${preset.label} already exists`);
      return;
    }
    const baseSellingPrice = defaultCostPrice
      ? calculateBasePrice(defaultCostPrice, defaultMarkup, defaultRoundUp)
      : null;
    const salePrice =
      baseSellingPrice && defaultDiscount > 0
        ? calculateSalePrice(baseSellingPrice, defaultDiscount)
        : null;

    append({
      size: preset?.value || '',
      displayName: preset?.label || '',
      sizeCategory: 'standard',
      ...sizePresetMeasurements(preset?.value || ''),
      servingsPerUnit: null,
      basePrice: baseSellingPrice,
      compareAtPrice: null,
      costPrice: defaultCostPrice ?? null,
      wholesalePrice: null,
      currency: defaultCurrency,
      stock: 0,
      reservedStock: 0,
      availableStock: 0,
      lowStockThreshold: 10,
      reorderPoint: 5,
      reorderQuantity: 50,
      sku: '',
      barcode: '',
      markupPercentage: defaultMarkup,
      roundUp: defaultRoundUp,
      saleDiscountPercentage: defaultDiscount,
      salePrice: salePrice,
      isDefault: fields.length === 0,
      isOnSale: false,
      rank: fields.length + 1,
    });
    toast.success('Size variant added');
  };

  const duplicateSize = (index: number) => {
    if (fields.length >= 20) return;
    const variants = getValues('subProductData.sizes');
    const current = variants[index];
    const size = allowsOptions ? current?.size : availableCustomSize(variants.flatMap(variant => variant.size ? [variant.size] : []));
    if (!current || !size) return;
    append({
      ...current,
      _id: undefined,
      size,
      colorName: allowsOptions ? '' : current.colorName,
      optionName: allowsOptions ? '' : current.optionName,
      image: allowsOptions ? null : current.image,
      imageScope: allowsOptions ? undefined : current.imageScope,
      colorHexCode: allowsOptions ? undefined : current.colorHexCode,
      displayName: `${current.displayName || current.size || 'Custom size'} (Copy)`,
      sku: '',
      barcode: '',
      stock: 0,
      reservedStock: 0,
      availableStock: 0,
      isDefault: false,
      rank: fields.length + 1,
    });
    toast.success('Size variant duplicated');
  };

  const clearAllSizes = () => {
    if (getValues('subProductData.sizes').some((size) => size._id)) {
      toast.error('Remove saved sizes individually so their history can be checked.');
      return;
    }
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
    toast.success('All sizes cleared');
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Enhanced Header */}
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <div className="relative overflow-hidden rounded-xl border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-4">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-100/50" />
          <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-indigo-100/50" />

          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
              >
                <PiPackage className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <Text className="font-semibold text-gray-900">
                  Sizes & Variants
                </Text>
                <Text className="text-xs text-gray-500">
                  Configure product size variants for inventory management
                </Text>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {fields.length > 0 && (
                <>
                  <Badge variant="flat" color="primary" className="font-medium">
                    {fields.length} Variant{fields.length !== 1 ? 's' : ''}
                  </Badge>
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    onClick={clearAllSizes}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <PiEraser className="mr-1 h-4 w-4" />
                    Clear All
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sell Without Variants Toggle */}
      <motion.div
        variants={fieldStaggerVariants}
        custom={1}
        className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
            <PiRuler className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <Text className="font-semibold text-gray-800">
              Sell Without Size Variants
            </Text>
            <Text className="text-sm text-gray-500">
              Offer this product as a single item without size options
            </Text>
          </div>
        </div>
        <Controller
          name="subProductData.sellWithoutSizeVariants"
          control={control}
          render={({ field }) => (
            <Switch
              checked={field.value ?? false}
              onChange={(event) => {
                // rizzui Switch forwards the native checkbox change event —
                // read the checked boolean (like every other switch here),
                // never persist the event itself.
                const checked = event?.target?.checked ?? false;
                // Safety gate: turning ON while sizes are configured asks
                // first, so a seller can't silently lose their variants.
                // Rows stay hidden (not deleted) — toggling back restores them.
                if (checked && fields.length > 0) {
                  setConfirmSingleItem(true);
                  return;
                }
                field.onChange(checked);
                setValue('subProductData.sellWithoutSizeVariants', checked);
              }}
            />
          )}
        />
      </motion.div>

      {sellWithoutSizeVariants && (
        <motion.div
          variants={fieldStaggerVariants}
          custom={2}
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <PiInfo className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <Text className="text-sm font-medium text-gray-800">
                Selling as a single item
              </Text>
              <Text className="mt-0.5 text-sm text-gray-500">
                One price &amp; one stock. Price lives in{' '}
                <span className="font-semibold text-gray-700">Pricing</span>,
                stock lives in{' '}
                <span className="font-semibold text-gray-700">Inventory</span>.
              </Text>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {!sellWithoutSizeVariants && (
          <motion.div
            key="sizes-section"
            variants={toggleVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-4"
          >
            {/* Summary Header */}
            {fields.length > 0 && (
              <motion.div
                variants={fieldStaggerVariants}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                    <PiStack className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <Text className="font-semibold text-gray-800">
                      {fields.length} Size Variant
                      {fields.length !== 1 ? 's' : ''} Configured
                    </Text>
                    <div className="mt-1 flex items-center gap-3">
                      <Text className="text-sm text-gray-500">
                        Total stock:{' '}
                        <span className="font-medium text-blue-600">
                          {fields.reduce((sum, _, i) => {
                            const stock =
                              watch(`subProductData.sizes.${i}.stock`) || 0;
                            return sum + stock;
                          }, 0)}
                        </span>{' '}
                        units
                      </Text>
                      <div className="h-3 w-px bg-gray-300" />
                      <Text className="text-sm text-gray-500">
                        Avg Price:{' '}
                        <span className="font-medium text-green-600">
                          {fields.filter((_, i) =>
                            watch(`subProductData.sizes.${i}.basePrice`)
                          ).length > 0
                            ? `${defaultCurrency} ${(
                                fields.reduce((sum, _, i) => {
                                  const price =
                                    watch(
                                      `subProductData.sizes.${i}.basePrice`
                                    ) || 0;
                                  return sum + price;
                                }, 0) /
                                fields.filter((_, i) =>
                                  watch(`subProductData.sizes.${i}.basePrice`)
                                ).length
                              ).toFixed(2)}`
                            : '-'}
                        </span>
                      </Text>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {fields.filter((_, i) =>
                    watch(`subProductData.sizes.${i}.isDefault`)
                  ).length > 0 ? (
                    <Badge color="success" variant="flat" className="gap-1">
                      <PiCheckCircle className="h-3 w-3" />
                      Default Set
                    </Badge>
                  ) : (
                    <Badge color="warning" variant="flat" className="gap-1">
                      <PiWarning className="h-3 w-3" />
                      No Default
                    </Badge>
                  )}
                </div>
              </motion.div>
            )}

            {fields.length < 20 && quickAddOptions.length > 0 && (
              <motion.div
                variants={quickAddVariants}
                initial="hidden"
                animate="visible"
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <Text className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <PiSparkle className="h-4 w-4 text-amber-500" />
                  Quick Add Common Sizes
                </Text>
                <div className="flex flex-wrap gap-2">
                  {quickAddOptions.map(size => (
                    <button key={size.value} type="button" onClick={() => addSize(size)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                      + {size.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
            {!resolvedProductType && quickAddOptions.length === 0 && (
              <Text className="text-sm text-gray-500">Select a product or product type to see its size presets.</Text>
            )}

            {/* Size Variants */}
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {fields.map((field, index) => (
                  <motion.div
                    key={field.id}
                    custom={index}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    whileHover="hover"
                    layout
                  >
                    <SizeVariantRow
                      index={index}
                      setValue={setValue}
                      watch={watch}
                      control={control}
                      setError={setError}
                      clearErrors={clearErrors}
                      getValues={getValues}
                      remove={remove}
                      onDuplicate={() => duplicateSize(index)}
                      totalSizes={fields.length}
                      calculateBasePrice={calculateBasePrice}
                      calculateSalePrice={calculateSalePrice}
                      showColorInputs={showColorInputs}
                      colorLabel={business === 'beauty' ? 'Shade' : 'Colour'}
                      optionLabel={optionLabel}
                      allowedOptions={allowedOptions}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Add Button */}
            <motion.div
              variants={fieldStaggerVariants}
              custom={fields.length + 2}
            >
              <motion.button
                type="button"
                whileHover="hover"
                whileTap="tap"
                variants={buttonTapVariants}
                onClick={() => addSize()}
                className="group flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-6 py-4 font-medium text-gray-600 transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <PiPlus className="h-5 w-5" />
                </motion.div>
                <span>Add Size Variant</span>
                <Text className="text-xs text-gray-400 group-hover:text-blue-400">
                  (Max 20 variants)
                </Text>
              </motion.button>
            </motion.div>

            {/* Empty State */}
            {fields.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border-2 border-dashed border-gray-200 px-6 py-12 text-center"
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
                  <PiRuler className="h-8 w-8 text-gray-400" />
                </div>
                <Text className="mb-2 text-lg font-medium text-gray-600">
                  No Size Variants Yet
                </Text>
                <Text className="mb-4 text-sm text-gray-500">
                  Add size variants to manage different product sizes and their
                  stock levels
                </Text>
                <Button type="button" onClick={() => addSize()} className="mx-auto">
                  <PiPlus className="mr-2 h-4 w-4" />
                  Add Your First Size
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <SingleItemConfirmation
        open={confirmSingleItem}
        count={fields.length}
        onClose={() => setConfirmSingleItem(false)}
        onConfirm={() => {
          setValue('subProductData.sellWithoutSizeVariants', true);
          setConfirmSingleItem(false);
        }}
      />
    </motion.div>
  );
}

function SizeVariantRow({
  index,
  setValue,
  watch,
  control,
  setError,
  clearErrors,
  getValues,
  remove,
  onDuplicate,
  totalSizes,
  calculateBasePrice,
  calculateSalePrice,
  showColorInputs = false,
  colorLabel,
  optionLabel,
  allowedOptions,
}: {
  index: number;
  setValue: any;
  watch: any;
  control: any;
  setError: any;
  clearErrors: any;
  getValues: any;
  remove: (index: number) => void;
  onDuplicate: () => void;
  totalSizes: number;
  calculateBasePrice: (
    costPrice: number,
    markup: number,
    roundUp: string
  ) => number;
  calculateSalePrice: (basePrice: number, discount: number) => number | null;
  showColorInputs?: boolean;
  colorLabel: string;
  optionLabel?: string;
  allowedOptions: typeof SIZE_OPTIONS;
}) {
  const variantCostPrice = watch(`subProductData.sizes.${index}.costPrice`);
  const variantMarkup =
    watch(`subProductData.sizes.${index}.markupPercentage`) ?? 25;
  const variantRoundUp =
    watch(`subProductData.sizes.${index}.roundUp`) ?? '100';
  const variantBasePrice = watch(`subProductData.sizes.${index}.basePrice`);
  const variantDiscount =
    watch(`subProductData.sizes.${index}.saleDiscountPercentage`) ?? 0;

  const [localMarkup, setLocalMarkup] = useState(variantMarkup);
  const [localDiscount, setLocalDiscount] = useState(variantDiscount);
  const [expanded, setExpanded] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setLocalMarkup(variantMarkup);
  }, [variantMarkup]);

  useEffect(() => {
    setLocalDiscount(variantDiscount);
  }, [variantDiscount]);

  // Initialize once on mount.
  // A stored Markup % is the admin's own input — keep it verbatim (a rounded
  // selling price can't be reversed into it: 25.07% on a price rounded to the
  // nearest 100 reads back as a different number).
  // Only when none is stored (legacy sizes) do we derive it from the loaded
  // cost/selling pair — and never overwrite the stored selling price.
  // Auto-calculate a selling price only when none exists yet.
  useEffect(() => {
    if (initialized) return;
    const cost = Number(variantCostPrice) || 0;
    const selling = Number(variantBasePrice) || 0;
    const stored = watch(`subProductData.sizes.${index}.markupPercentage`);
    if (stored !== null && stored !== undefined && stored !== '') {
      setLocalMarkup(Number(stored));
      setInitialized(true);
    } else if (cost > 0 && selling > 0) {
      const eff = Number(((selling / cost - 1) * 100).toFixed(2));
      setLocalMarkup(eff);
      setValue(`subProductData.sizes.${index}.markupPercentage`, eff);
      setInitialized(true);
    } else if (cost > 0) {
      const calculatedPrice = calculateBasePrice(
        cost,
        localMarkup,
        variantRoundUp
      );
      setValue(`subProductData.sizes.${index}.basePrice`, calculatedPrice);
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle cost price change — the Markup % is the admin's input, so it is held
  // constant and the selling price is recomputed from it. (For a legacy size with
  // no stored markup, localMarkup already holds the effective markup derived from
  // the loaded cost/selling pair on mount, so the price stays proportional.)
  const handleCostPriceChange = (value: number | null) => {
    if (value && value > 0) {
      const calculatedPrice = calculateBasePrice(
        value,
        localMarkup,
        variantRoundUp
      );
      setValue(`subProductData.sizes.${index}.costPrice`, value);
      setValue(`subProductData.sizes.${index}.basePrice`, calculatedPrice);

      // Keep any active sale price in step with the new selling price
      if (localDiscount > 0) {
        const calculatedSalePrice = calculateSalePrice(
          calculatedPrice,
          localDiscount
        );
        setValue(
          `subProductData.sizes.${index}.salePrice`,
          calculatedSalePrice
        );
      }
    } else {
      setValue(`subProductData.sizes.${index}.costPrice`, value);
    }
  };

  const handleMarkupChange = (value: number) => {
    setLocalMarkup(value);
    setValue(`subProductData.sizes.${index}.markupPercentage`, value);
    if (variantCostPrice && variantCostPrice > 0) {
      const calculatedPrice = calculateBasePrice(
        variantCostPrice,
        value,
        variantRoundUp
      );
      setValue(`subProductData.sizes.${index}.basePrice`, calculatedPrice);
    }
  };

  const handleRoundUpChange = (value: string) => {
    setValue(`subProductData.sizes.${index}.roundUp`, value);
    if (variantCostPrice && variantCostPrice > 0) {
      const calculatedPrice = calculateBasePrice(
        variantCostPrice,
        localMarkup,
        value
      );
      setValue(`subProductData.sizes.${index}.basePrice`, calculatedPrice);
    }
  };

  const handleDiscountChange = (value: number) => {
    setLocalDiscount(value);
    setValue(`subProductData.sizes.${index}.saleDiscountPercentage`, value);
    if (variantBasePrice && variantBasePrice > 0 && value > 0) {
      const calculatedSalePrice = calculateSalePrice(variantBasePrice, value);
      setValue(`subProductData.sizes.${index}.salePrice`, calculatedSalePrice);
    } else if (value === 0) {
      setValue(`subProductData.sizes.${index}.salePrice`, null);
    }
  };

  const handleBasePriceChange = (value: number | null) => {
    setValue(`subProductData.sizes.${index}.basePrice`, value);
    // Keep the Markup % field in sync with a manually entered selling price
    const cost = Number(variantCostPrice) || 0;
    if (value && value > 0 && cost > 0) {
      const m = Number(((value / cost - 1) * 100).toFixed(2));
      setLocalMarkup(m);
      setValue(`subProductData.sizes.${index}.markupPercentage`, m);
    }
    if (value && value > 0 && localDiscount > 0) {
      const calculatedSalePrice = calculateSalePrice(value, localDiscount);
      setValue(`subProductData.sizes.${index}.salePrice`, calculatedSalePrice);
    } else if (localDiscount === 0) {
      setValue(`subProductData.sizes.${index}.salePrice`, null);
    }
  };

  const currentSize = watch(`subProductData.sizes.${index}.size`) || '';
  const variants: { size?: string }[] = watch('subProductData.sizes') || [];
  const otherSizes = variants.flatMap((variant, row) =>
    row === index || !variant.size ? [] : [variant.size]
  );
  const customCode = /^custom(?:-\d+)?$/.test(currentSize)
    ? currentSize
    : availableCustomSize(otherSizes);
  const rowOptions = allowedOptions.filter(option => option.value !== 'custom');
  if (customCode) rowOptions.push({ value: customCode, label: 'Custom Size', category: 'Other' });

  const handleSizeChange = (sizeValue: string) => {
    // Clear previous size error for this field
    clearErrors?.(`subProductData.sizes.${index}.size`);

    if (!sizeValue) {
      setValue(`subProductData.sizes.${index}.size`, '', { shouldDirty: true, shouldValidate: true });
      return;
    }

    // Check for duplicate size value across all rows (excluding current)
    if (!showColorInputs && !optionLabel) {
      const allSizes = getValues?.('subProductData.sizes') || [];
      const duplicate = allSizes.findIndex(
        (s: any, i: number) =>
          i !== index && s?.size?.toLowerCase() === sizeValue.toLowerCase()
      );
      if (duplicate >= 0) {
        setError?.(`subProductData.sizes.${index}.size`, {
          type: 'manual',
          message: `Size "${sizeValue}" is already used in row ${duplicate + 1}`,
        });
        return;
      }
    }

    const selectedOption = rowOptions.find((opt) => opt.value === sizeValue);
    if (selectedOption) {
      setValue(`subProductData.sizes.${index}.size`, sizeValue, { shouldDirty: true, shouldValidate: true });
      setValue(
        `subProductData.sizes.${index}.displayName`,
        selectedOption.label
      );
      if (!/^custom(?:-\d+)?$/.test(sizeValue) && sizeValue !== 'variable') {
        for (const [field, value] of Object.entries(sizePresetMeasurements(sizeValue))) {
          setValue(`subProductData.sizes.${index}.${field}`, value);
        }
      }
    }
  };

  const roundUpOptions = [
    { value: 'none', label: 'None' },
    { value: '100', label: 'Nearest 100' },
    { value: '1000', label: 'Nearest 1,000' },
  ];

  const sizeCategoryOptions = [
    { value: 'miniature', label: 'Miniature' },
    { value: 'single_serve', label: 'Single Serve' },
    { value: 'standard', label: 'Standard' },
    { value: 'large', label: 'Large' },
    { value: 'extra_large', label: 'Extra Large' },
    { value: 'multi_pack', label: 'Multi-Pack' },
    { value: 'bulk', label: 'Bulk' },
    { value: 'gift_set', label: 'Gift Set' },
    { value: 'variety_pack', label: 'Variety Pack' },
    { value: 'keg', label: 'Keg' },
    { value: 'accessory', label: 'Accessory' },
    { value: 'glassware', label: 'Glassware' },
    { value: 'barware', label: 'Barware' },
    // Non-beverage industry categories (mirror of server/models/Size.js)
    { value: 'apparel', label: 'Apparel' },
    { value: 'shoes', label: 'Shoes' },
    { value: 'electronics', label: 'Electronics' },
  ];

  const packagingOptions = [
    { value: 'pack-6', label: '6-Pack' },
    { value: 'pack-12', label: '12-Pack' },
    { value: 'bottle', label: 'Bottle' },
    { value: 'can', label: 'Can' },
    { value: 'glass_bottle', label: 'Glass Bottle' },
    { value: 'plastic_bottle', label: 'Plastic Bottle' },
    { value: 'tetra_pak', label: 'Tetra Pak' },
    { value: 'keg', label: 'Keg' },
    { value: 'barrel', label: 'Barrel' },
    { value: 'box', label: 'Box' },
    { value: 'bag', label: 'Bag' },
    { value: 'pouch', label: 'Pouch' },
    { value: 'carton', label: 'Carton' },
    { value: 'jar', label: 'Jar' },
    { value: 'tin', label: 'Tin' },
    { value: 'tub', label: 'Tub' },
  ];

  for (const { value, label } of allowedOptions) {
    if (/^(pack|case)-/.test(value) && !packagingOptions.some(option => option.value === value)) {
      packagingOptions.push({ value, label });
    }
  }

  const availabilityOptions = [
    { value: 'available', label: 'Available' },
    { value: 'low_stock', label: 'Low Stock' },
    { value: 'out_of_stock', label: 'Out of Stock' },
    { value: 'pre_order', label: 'Pre-Order' },
    { value: 'coming_soon', label: 'Coming Soon' },
    { value: 'discontinued', label: 'Discontinued' },
    { value: 'backorder', label: 'Backorder' },
    { value: 'limited_stock', label: 'Limited Stock' },
  ];

  // Group sizes by category
  const groupedOptions = rowOptions.reduce(
    (acc, option) => {
      if (!acc[option.category]) {
        acc[option.category] = [];
      }
      acc[option.category].push(option);
      return acc;
    },
    {} as Record<string, typeof SIZE_OPTIONS>
  );

  return (
    <div className="@container/size-variant rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Text className="font-medium">Size Variant #{index + 1}</Text>
          <Controller
            name={`subProductData.sizes.${index}.isDefault`}
            control={control}
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                <input
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(e) => {
                    field.onChange(e.target.checked);
                    setValue(
                      `subProductData.sizes.${index}.isDefault`,
                      e.target.checked
                    );
                  }}
                  className="rounded border-gray-300"
                />
                Default
              </label>
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-gray-600"
          >
            {expanded ? (
              <PiCaretUp className="h-4 w-4" />
            ) : (
              <PiCaretDown className="h-4 w-4" />
            )}
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDuplicate}
            disabled={totalSizes >= 20}
            className="text-blue-600 hover:bg-blue-50"
          >
            <PiCopySimple className="h-4 w-4" />
          </Button>
          <RemoveSizeButton
            productId={watch('subProductData._id')}
            sizeId={watch(`subProductData.sizes.${index}._id`)}
            label={watch(`subProductData.sizes.${index}.displayName`) || watch(`subProductData.sizes.${index}.size`) || 'variant'}
            onRemove={() => {
              remove(index);
              toast.success('Size deleted from product');
            }}
          />
        </div>
      </div>

      {/* Basic Info - Always Visible */}
      <div className="grid gap-4 @[480px]/size-variant:grid-cols-3">
        {/* Size Dropdown */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Size <span className="text-red-500">*</span>
          </label>
          <Controller
            name={`subProductData.sizes.${index}.size`}
            control={control}
            defaultValue=""
            render={({ field, fieldState: { error } }) => (
              <>
                <select
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => {
                    handleSizeChange(e.target.value);
                  }}
                  className={`block w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                >
                  <option value="">Select size...</option>
                  {field.value && !rowOptions.some((option) => option.value === field.value) && (
                    <option value={field.value} hidden>
                      {SIZE_OPTIONS.find((option) => option.value === field.value)?.label || field.value}
                    </option>
                  )}
                  {Object.entries(groupedOptions).map(([category, options]) => (
                    <optgroup key={category} label={category}>
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {error && (
                  <p className="mt-1 text-xs text-red-500">{error.message}</p>
                )}
              </>
            )}
          />
        </div>

        {/* Display Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Display Name
          </label>
          <Controller
            name={`subProductData.sizes.${index}.displayName`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                placeholder="e.g., Large Bottle"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Unit Type */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Unit Type
          </label>
          <Controller
            name={`subProductData.sizes.${index}.unitType`}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="volume_ml">Volume (ml)</option>
                <option value="volume_cl">Volume (cl)</option>
                <option value="volume_l">Volume (L)</option>
                <option value="volume_oz">Volume (oz)</option>
                <option value="weight_g">Weight (g)</option>
                <option value="weight_kg">Weight (kg)</option>
                <option value="count_unit">Count (unit)</option>
                <option value="count_pack">Count (pack)</option>
                <option value="count_case">Count (case)</option>
                <option value="set">Set</option>
                <option value="pair">Pair</option>
                <option value="kit">Kit</option>
                <option value="piece">Piece</option>
                <option value="box">Box</option>
                <option value="bundle">Bundle</option>
                <option value="pod">Pod</option>
                <option value="pouch">Pouch</option>
                <option value="puff">Puff (disposable vape)</option>
              </select>
            )}
          />
        </div>

        {/* Volume/Weight */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Volume/Weight (ml/g)
          </label>
          <Controller
            name={`subProductData.sizes.${index}.volumeMl`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                min="0"
                placeholder="0"
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(
                    e.target.value ? parseFloat(e.target.value) : null
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Weight (grams) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Weight (grams)
          </label>
          <Controller
            name={`subProductData.sizes.${index}.weightGrams`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                min="0"
                placeholder="0"
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(
                    e.target.value ? parseFloat(e.target.value) : null
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Servings Per Unit */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Servings Per Unit
          </label>
          <Controller
            name={`subProductData.sizes.${index}.servingsPerUnit`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                min="1"
                placeholder="1"
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Cost Price */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Cost Price
          </label>
          <Controller
            name={`subProductData.sizes.${index}.costPrice`}
            control={control}
            defaultValue={null}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={field.value ?? ''}
                onChange={(e) =>
                  handleCostPriceChange(
                    e.target.value ? parseFloat(e.target.value) : null
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Markup */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Markup (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="500"
            placeholder="25"
            value={localMarkup}
            onChange={(e) =>
              handleMarkupChange(parseFloat(e.target.value) || 0)
            }
            className="mb-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {/* Quick Markup Presets */}
          <div className="flex flex-wrap gap-1">
            {MARKUP_PRESETS.slice(0, 6).map((markup) => (
              <button
                key={markup}
                type="button"
                onClick={() => handleMarkupChange(markup)}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  localMarkup === markup
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {markup}%
              </button>
            ))}
          </div>
        </div>

        {/* Round Up */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Round Up To
          </label>
          <Controller
            name={`subProductData.sizes.${index}.roundUp`}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                value={field.value ?? 'none'}
                onChange={(e) => handleRoundUpChange(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {roundUpOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          />
        </div>

        {/* Base Price (Auto-calculated) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Selling Price <span className="text-xs text-gray-400">(Auto)</span>
          </label>
          <Controller
            name={`subProductData.sizes.${index}.basePrice`}
            control={control}
            defaultValue={null}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="Auto-calculated"
                value={field.value ?? ''}
                onChange={(e) =>
                  handleBasePriceChange(
                    e.target.value ? parseFloat(e.target.value) : null
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Compare At Price (MSRP) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Compare at Price (MSRP)
          </label>
          <Controller
            name={`subProductData.sizes.${index}.compareAtPrice`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(
                    e.target.value ? parseFloat(e.target.value) : null
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Discount Percentage */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Discount (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="0"
            value={localDiscount}
            onChange={(e) =>
              handleDiscountChange(parseFloat(e.target.value) || 0)
            }
            className="mb-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {/* Quick Discount Presets */}
          <div className="flex flex-wrap gap-1">
            {[5, 10, 15, 20, 25, 50].map((discount) => (
              <button
                key={discount}
                type="button"
                onClick={() => handleDiscountChange(discount)}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  localDiscount === discount
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {discount}%
              </button>
            ))}
          </div>
        </div>

        {/* Sale Price (Read-only - Auto-calculated) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Sale Price <span className="text-xs text-gray-400">(Auto)</span>
          </label>
          <Controller
            name={`subProductData.sizes.${index}.salePrice`}
            control={control}
            defaultValue={null}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="Auto-calculated"
                value={field.value ?? ''}
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Wholesale Price */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Wholesale Price
          </label>
          <Controller
            name={`subProductData.sizes.${index}.wholesalePrice`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(
                    e.target.value ? parseFloat(e.target.value) : null
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Stock */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Stock
          </label>
          <Controller
            name={`subProductData.sizes.${index}.stock`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                min="0"
                placeholder="0"
                value={field.value ?? 0}
                onChange={(e) =>
                  field.onChange(parseInt(e.target.value, 10) || 0)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Sellable count. Warehouse on-hand is managed in the Inventory →
            Locations tab.
          </p>
        </div>

        {/* SKU */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Size SKU
          </label>
          <Controller
            name={`subProductData.sizes.${index}.sku`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                placeholder="SKU for this size"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Barcode */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Barcode
          </label>
          <Controller
            name={`subProductData.sizes.${index}.barcode`}
            control={control}
            render={({ field, fieldState: { error } }) => (
              <>
                <input
                  {...field}
                  type="text"
                  placeholder="Barcode"
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    // Clear barcode error on change
                    clearErrors?.(`subProductData.sizes.${index}.barcode`);
                    // Check for local barcode duplicates
                    if (e.target.value) {
                      const allSizes =
                        getValues?.('subProductData.sizes') || [];
                      const duplicate = allSizes.findIndex(
                        (s: any, i: number) =>
                          i !== index &&
                          s?.barcode?.trim().toLowerCase() ===
                            e.target.value.trim().toLowerCase()
                      );
                      if (duplicate >= 0) {
                        setError?.(`subProductData.sizes.${index}.barcode`, {
                          type: 'manual',
                          message:
                            'Barcode already used in row ' + (duplicate + 1),
                        });
                      }
                    }
                  }}
                  className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                />
                {error && (
                  <p className="mt-1 text-xs text-red-500">{error.message}</p>
                )}
              </>
            )}
          />
        </div>

        <VariantImageField index={index} colorLabel={colorLabel} optionLabel={optionLabel} />
        {optionLabel && (
          <label className="block text-sm font-medium text-gray-700">
            {optionLabel} <span className="font-normal text-gray-500">(optional)</span>
            <Controller
              name={`subProductData.sizes.${index}.optionName`}
              control={control}
              render={({ field }) => (
                <input {...field} value={field.value ?? ''} maxLength={100}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm" />
              )}
            />
          </label>
        )}

        {/* Color Name — non-beverage variant dimension (server Size.colorName) */}
        {(showColorInputs || watch(`subProductData.sizes.${index}.colorName`)) && (
          <div>
            <label
              htmlFor={`size-color-name-${index}`}
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              {colorLabel}{' '}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <Controller
              name={`subProductData.sizes.${index}.colorName`}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id={`size-color-name-${index}`}
                  type="text"
                  maxLength={COLOR_NAME_MAX_LENGTH}
                  value={field.value ?? ''}
                  placeholder="e.g., Amber"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Optional — named after the label, e.g. Amber. Saved exactly as you
              type it (no automatic casing), up to {COLOR_NAME_MAX_LENGTH}{' '}
              characters.
            </p>
          </div>
        )}

        {/* Color — swatch + hex (server Size.colorHexCode, #RRGGBB) */}
        {(showColorInputs || watch(`subProductData.sizes.${index}.colorName`)) && (
          <div>
            <label
              htmlFor={`size-color-swatch-${index}`}
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Color Swatch{' '}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <Controller
              name={`subProductData.sizes.${index}.colorHexCode`}
              control={control}
              render={({ field }) => {
                const complete = isCompleteColorHex(field.value);
                // An incomplete typed value is a visible validation state with
                // cause + fix below the field (never a blocker — see
                // ./color-variant.ts: it saves as unset).
                const incomplete = typeof field.value === 'string' && field.value.length > 0 && !complete;
                return (
                  <>
                    <div className="flex items-center gap-2">
                      {/* The picker only emits complete #rrggbb values, so the
                          swatch mirrors the typed hex live while valid. */}
                      <input
                        type="color"
                        aria-label="Pick color"
                        value={complete ? field.value : '#000000'}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                        className="h-9 w-9 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-0"
                      />
                      <input
                        {...field}
                        id={`size-color-swatch-${index}`}
                        type="text"
                        value={field.value ?? ''}
                        maxLength={7}
                        placeholder="#RRGGBB"
                        aria-invalid={incomplete || undefined}
                        aria-describedby={
                          incomplete ? `size-color-hex-error-${index}` : undefined
                        }
                        onChange={(e) =>
                          field.onChange(normalizeColorHexInput(e.target.value))
                        }
                        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${
                          incomplete
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                        }`}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">
                      6-digit hex (e.g. #1F2A44). A half-typed value is saved as
                      unset.
                    </p>
                    {incomplete && (
                      <p
                        id={`size-color-hex-error-${index}`}
                        className="mt-0.5 text-[11px] text-red-500"
                      >
                        {field.value} is incomplete — enter all 6 digits after
                        the # (e.g. #1F2A44), or clear it to leave the color
                        unset.
                      </p>
                    )}
                  </>
                );
              }}
            />
          </div>
        )}
      </div>

      {/* Expandable Fields */}
      {expanded && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <Text className="mb-4 font-medium text-gray-700">
            Additional Details
          </Text>

          <div className="grid gap-4 @[480px]/size-variant:grid-cols-3">
            {/* Size Category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Size Category
              </label>
              <Controller
                name={`subProductData.sizes.${index}.sizeCategory`}
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select category...</option>
                    {sizeCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Units Per Pack */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Units Per Pack
              </label>
              <Controller
                name={`subProductData.sizes.${index}.unitsPerPack`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    placeholder="1"
                    value={field.value ?? 1}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value, 10) || 1)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Low Stock Threshold */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Low Stock Threshold
              </label>
              <Controller
                name={`subProductData.sizes.${index}.lowStockThreshold`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="0"
                    placeholder="10"
                    value={field.value ?? 10}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Reorder Point */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Reorder Point
              </label>
              <Controller
                name={`subProductData.sizes.${index}.reorderPoint`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="0"
                    placeholder="5"
                    value={field.value ?? 5}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Reorder Quantity */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Reorder Quantity
              </label>
              <Controller
                name={`subProductData.sizes.${index}.reorderQuantity`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    placeholder="50"
                    value={field.value ?? 50}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value, 10) || 1)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Rank */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Display Rank
              </label>
              <Controller
                name={`subProductData.sizes.${index}.rank`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    placeholder={String(index + 1)}
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? parseInt(e.target.value, 10) : null
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Packaging */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Packaging
              </label>
              <Controller
                name={`subProductData.sizes.${index}.packaging`}
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select packaging...</option>
                    {packagingOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Availability */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Availability
              </label>
              <Controller
                name={`subProductData.sizes.${index}.availability`}
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {availabilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Min Order Quantity */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Min Order Quantity
              </label>
              <Controller
                name={`subProductData.sizes.${index}.minOrderQuantity`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    placeholder="1"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? parseInt(e.target.value, 10) : null
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Max Order Quantity */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Max Order Quantity
              </label>
              <Controller
                name={`subProductData.sizes.${index}.maxOrderQuantity`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    min="1"
                    placeholder="No limit"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? parseInt(e.target.value, 10) : null
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              />
            </div>

            {/* Requires Age Verification */}
            <div className="flex items-center pt-5">
              <Controller
                name={`subProductData.sizes.${index}.requiresAgeVerification`}
                control={control}
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.value ?? false}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                        setValue(
                          `subProductData.sizes.${index}.requiresAgeVerification`,
                          e.target.checked
                        );
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      Requires Age Verification
                    </span>
                  </label>
                )}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
