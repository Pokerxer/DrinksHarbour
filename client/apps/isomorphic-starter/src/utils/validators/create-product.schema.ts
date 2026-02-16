import { z } from "zod";
import { messages } from "@/config/messages";
import { fileSchema } from "@/utils/validators/common-rules";
export const productFormSchema = z.object({
  name: z.string().min(1, { message: messages.productNameIsRequired }),
  flavor: z
    .string()
    .min(1, { message: messages.flavourIsRequired })
    .default("standard"),
  slug: z.string().min(1, { message: messages.slugIsRequired }),
  sku: z.string().min(1, { message: messages.skuIsRequired }),
  type: z
    .string({ required_error: messages.productTypeIsRequired })
    .min(1, { message: messages.productTypeIsRequired }),
  categories: z
    .string()
    .min(1, { message: messages.productCategoryIsRequired }),
  subcategories: z
    .string()
    .min(1, { message: messages.productSubCategoryIsRequired }),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  productImages: z.array(fileSchema).optional(),
  inventoryTracking: z.string().optional(),
  currentStock: z.number().or(z.string()),
  lowStock: z.number().or(z.string()),
  productAvailability: z.string().default("available_both").optional(),
  tradeNumber: z.number().or(z.string()).optional(),
  manufacturerNumber: z.number().or(z.string()).optional(),
  brand: z.string().optional(),
  country: z.string().optional(),
  pageTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.string().optional(),
  productUrl: z.string().optional(),
  isPurchaseSpecifyDate: z.boolean().optional(),
  isLimitDate: z.boolean().optional(),
  dateFieldName: z.string().optional(),
  availableDate: z.date().optional(),
  endDate: z.date().optional(),
  productVariants: z
    .array(
      z.object({ name: z.string().optional(), value: z.string().optional() }),
    )
    .optional(),
  sizes: z
    .array(
      z.object({
        size: z
          .string({ required_error: messages.sizeIsRequired })
          .min(1, { message: messages.sizeIsRequired }),
        sku: z.coerce.string(),
        price: z.coerce.number().optional(),
        admin_cost_price: z.coerce.number().optional(),
        selling_price: z.coerce
          .number()
          .min(1, { message: messages.sellingPriceIsRequired }),
        cost_price: z.coerce
          .number()
          .min(1, { message: messages.costPriceIsRequired }),
        price_type: z.string().optional().default("fixed"),
        percentage_on_cost: z.coerce.number().optional(),
        barcode: z.string().optional(),
        min_order: z.coerce.number().optional(),
        max_order: z.coerce.number().optional(),
        discount: z.coerce.number().optional(),
        discount_type: z.string().optional().default("fixed"),
        discount_price: z.coerce.number().optional(),
        discount_start_date: z.date().optional(),
        discount_end_date: z.date().optional(),
        image: z.array(fileSchema).optional(),
        freeShipping: z
          .string()
          .optional()
          .transform((value) => (value === "true" ? true : false)),
        shippingPrice: z.coerce.number().optional(),
        locationBasedShipping: z
          .string()
          .optional()
          .transform((value) => (value === "true" ? true : false)),
        locationShipping: z
          .array(
            z.object({
              location: z.string().optional(),
              shippingPrice: z.coerce.number().optional(),
            }),
          )
          .optional(),
        weight: z.coerce.number().optional(),
        stock: z.number().or(z.string()).optional(),
        lowStock: z.number().or(z.string()).optional(),
        productAvailability: z.string().optional(),
        productImages: z.array(fileSchema).optional(),
        manufacturingDateFieldName: z.string().optional(),
        isManufacturingDateRequired: z.boolean().optional(),
        manufacturingDate: z.date().optional(),
        availability: z.string().optional(),
        expiryDate: z.date().optional(),
        isExpiryDateRequired: z.boolean().optional(),
        inventoryTracking: z.string().optional(),
      }),
    )
    .optional(),
});
export type CreateProductInput = z.infer<typeof productFormSchema>;
