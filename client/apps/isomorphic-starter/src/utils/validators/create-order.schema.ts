import { z } from 'zod';
import { messages } from '@/config/messages'; // const addressSchema = z.object({
// firstName: z.string().min(1, { message: messages.firstNameRequired }),
// lastName: z.string().min(1, { message: messages.lastNameRequired }),
// phoneNumber: z
// .string({
// required_error: messages.phoneNumberIsRequired,
// })
// .min(2, { message: messages.phoneNumberIsRequired }),
// country: z.string().min(1, { message: messages.countryIsRequired }),
// state: z.string().min(1, { message: messages.stateIsRequired }),
// city: z.string().min(1, { message: messages.cityIsRequired }),
// zip: z.string().min(1, { message: messages.zipCodeRequired }),
// apartment: z.string().min(1, { message: messages.apartmentIsRequired }),
// street: z.string().min(1, { message: messages.streetIsRequired }),
// }); export const orderFormSchema = z.object({ // billingAddress: addressSchema, //;
shippingAddress: addressSchema.optional(), note: z.string().optional(),
expectedDeliveryDate: z.string().optional(), paymentMethod: z.string().optional(),
shippingMethod: z.string().optional(), shippingSpeed: z.string().optional(),
}); export type CreateOrderInput = z.infer<typeof orderFormSchema>;
