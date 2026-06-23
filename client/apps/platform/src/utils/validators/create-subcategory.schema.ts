import { z } from "zod";
import { messages } from "@/config/messages";
import { fileSchema } from "@/utils/validators/common-rules"; // form zod validation schema
export const subcategoryFormSchema = z.object({
  name: z.string().min(1, { message: messages.catNameIsRequired }),
  slug: z.string().optional(),
  type: z.string().optional(),
  parentCategory: z.string().optional(),
  description: z.string().optional(),
  images: z.array(fileSchema).optional(),
}); // generate form types from zod validation schema
export type SubCategoryFormInput = z.infer<typeof subcategoryFormSchema>;
