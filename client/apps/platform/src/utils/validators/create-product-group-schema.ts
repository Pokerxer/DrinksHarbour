import { z } from "zod";
import { messages } from "@/config/messages";
import { fileSchema } from "@/utils/validators/common-rules"; /** * Enumeration for Discount Types. */
const DiscountTypeEnum = z.enum([
  "none",
  "fixed",
  "percentage",
]); /** * Enumeration for Availability Types. */
const AvailabilityEnum = z.enum([
  "available_online",
  "available_offline",
  "available_both",
  "out_of_stock",
  "pre_order",
  "limited_availability",
]); /** * Schema for individual sizes within a product. * (Assuming product group manages products and their sizes elsewhere) */
const SizeSchema = z.object({
  sizeId: z.string().min(1, { message: "Size ID is required" }),
  sizeName: z.string().min(1, { message: "Size name is required" }),
  price: z
    .number({ invalid_type_error: "Size price must be a number" })
    .min(0, { message: "Size price cannot be negative" }),
  stock: z
    .number({ invalid_type_error: "Stock must be a number" })
    .int({ message: "Stock must be an integer" })
    .min(0, { message: "Stock cannot be negative" }), // Note: Availability is managed at the product group level
}); /** * Schema for individual products within the product group. */
const ProductSchema = z.object({
  productId: z.string().min(1, { message: "Product ID is required" }),
  productName: z.string().min(1, { message: "Product name is required" }),
  productImage: z
    .string()
    .url("Invalid product image URL")
    .min(1, { message: "Product image URL is required" }),
  productPrice: z
    .number({ invalid_type_error: "Product price must be a number" })
    .min(0, { message: "Product price cannot be negative" }),
  subProductId: z.string().optional().nullable(),
  subProductName: z.string().optional().nullable(),
  sizes: z
    .array(SizeSchema)
    .min(1, { message: "At least one size is required" }),
}); /** * Schema for images associated with the product group. */
const GroupImageSchema = z.object({
  url: z.string().url("Invalid image URL"),
  active: z.boolean(),
}); /** * Schema for custom fields within the product group. */
const CustomFieldSchema = z.object({
  label: z.string().optional(),
  value: z.string().optional(),
}); /** * Schema for location-based shipping details. */
const LocationShippingSchema = z.object({
  name: z.string().optional(),
  shippingCharge: z.number().or(z.string()).optional(),
}); /** * Comprehensive schema for creating or editing a product group. */
export const productGroupFormSchema = z.object({
  // 1. Basic Details name: z .string() .min(1, { message: messages.nameIsRequired }), slug: z .string() .min(1, { message: messages.slugIsRequired }), description: z.string().optional(),
  sku: z.string().min(1, { message: messages.skuIsRequired }), // 2. Media Management groupImages: z .array(GroupImageSchema) .optional(), // 3. Product Selection;
  products: z.array(ProductSchema).optional(), // 4. Additional Attributes tags: z .array(z.string()) .optional(),
  status: z.enum(["active", "inactive"]).optional(), // 5. Discount Configuration discountType: DiscountTypeEnum .default('none'),
  discountPrice: z
    .number()
    .min(0, { message: messages.discountPriceMin })
    .default(0),
  discountPercentage: z
    .number()
    .min(0, { message: messages.discountPercentageMin })
    .max(100, { message: messages.discountPercentageMax })
    .default(0),
  fixedPrice: z.number().min(0, { message: messages.fixedPriceMin }).default(0),
  taxRate: z
    .number()
    .min(0, { message: messages.taxRateMin })
    .max(100, { message: messages.taxRateMax })
    .default(0), // finalPrice: z // .number() // .min(0, { message: messages.finalPriceMin }) // .default(0), // 7. SEO Configuration pageTitle: z.string().optional(),
  metaKeywords: z.string().optional(),
  metaDescription: z.string().optional(),
  productUrl: z.string().url("Invalid Product URL").optional(), // 8. Availability Status availability: AvailabilityEnum .default('available_online'),
  min_order: z.number().default(0),
  max_order: z.number().default(0), // 9. Shipping Details (Optional);
  freeShipping: z.boolean().optional(),
  shippingPrice: z
    .number()
    .min(0, { message: messages.shippingPriceMin })
    .optional(),
  locationBasedShipping: z.boolean().optional(),
  locationShipping: z.array(LocationShippingSchema).optional(),
  stock: z.number().default(0),
  lowStock: z.number().default(0),
});
export type CreateProductGroupInput = z.infer<typeof productGroupFormSchema>;
