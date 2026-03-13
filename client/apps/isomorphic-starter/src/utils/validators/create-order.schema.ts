import { z } from 'zod';
import { messages } from '@/config/messages';

export const orderFormSchema = z.object({
  shippingAddress: z.string().optional(),
  note: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  paymentMethod: z.string().optional(),
  shippingMethod: z.string().optional(),
  shippingSpeed: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof orderFormSchema>;