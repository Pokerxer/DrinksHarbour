import { z } from "zod";
export const vendorDetailsSchema = z.object({
  storeName: z.string().min(1, "Store name is required"),
  businessCategory: z.string().min(1, "Business category is required"),
  businessDescription: z
    .string()
    .min(10, "Description should be at least 10 characters"),
});
export type VendorDetailsSchema = z.infer<typeof vendorDetailsSchema>;
