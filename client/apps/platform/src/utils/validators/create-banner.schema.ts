import { z } from "zod";
import { messages } from "@/config/messages";
import { fileSchema } from "@/utils/validators/common-rules"; // Form zod validation schema for creating or updating a banner
export const bannerFormSchema = z.object({
  title: z.string().min(1, { message: messages.bannerTitleIsRequired }),
  image: fileSchema, // Assuming this is a single image and fileSchema is validated separately;
  type: z.enum(
    [
      "top_banner",
      "middle_banner",
      "bottom_banner",
      "left_banner",
      "right_banner",
      "footer_banner",
      "popup_banner",
      "main_banner",
    ],
    { message: messages.bannerTypeIsRequired },
  ),
  status: z.enum(["active", "inactive"], {
    message: messages.statusIsRequired,
  }),
  default_link: z
    .string()
    .url({ message: messages.invalidUrl })
    .min(1, { message: messages.bannerUrlIsRequired }),
  featured: z.boolean().optional(),
  details: z.string().optional(),
  promotionType: z.enum(
    [
      "percentage_discount",
      "buy_one_get_one",
      "free_shipping",
      "flash_sale",
      "limited_time",
      "clearance_sale",
      "new_arrival",
      "seasonal_sale",
      "holiday_sale",
      "exclusive_offer",
      "daily_deal",
      "member_exclusive",
      "bundle_deal",
      "early_bird",
      "mega_sale",
    ],
    { message: messages.promotionTypeIsRequired },
  ),
  linkType: z.enum(["category", "sales", "product", "brand"], {
    message: messages.linkTypeIsRequired,
  }),
  linkTo: z.string().min(1, { message: messages.linkToIsRequired }), // Assuming the linkTo value is required and must be a valid string
}); // Generate form types from Zod validation schema
export type CreateBannerInput = z.infer<typeof bannerFormSchema>;
