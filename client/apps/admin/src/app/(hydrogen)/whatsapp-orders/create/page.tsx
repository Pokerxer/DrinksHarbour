import OrderBuilder from '@/app/shared/whatsapp-orders/order-builder';

// The (hydrogen)/whatsapp-orders/layout.tsx renders the module nav header
// (brand "WhatsApp orders", tabs "Intake" + "New order") and the content
// canvas — this page only mounts the builder inside it.
export default function CreateWhatsAppOrderPage() {
  return <OrderBuilder />;
}
