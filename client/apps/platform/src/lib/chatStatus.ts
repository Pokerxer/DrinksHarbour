/** Shared customer-facing copy for the occasion-request status payload
 * (server model: pending / draft / sending / sent / delivery_failed). A staff
 * reply always outranks the request status. Copy stays honest: what failed,
 * what happens now, no countdowns, no guaranteed timers. */
export type ChatStatusSurface = 'modal' | 'closed' | 'page';

export function chatStatusCopy(status: string, replied: boolean, surface: ChatStatusSurface): { lead: string; detail: string } {
  if (replied) {
    return { lead: 'A human replied — open your conversation.', detail: 'Our team responded to your request; continue here or in your profile chat.' };
  }
  switch (status) {
    case 'draft':
      return {
        lead: 'Our team has prepared your reviewed plan.',
        detail: surface === 'modal'
          ? 'It will appear here as soon as it is sent.'
          : 'It will appear in this conversation as soon as it is sent.',
      };
    case 'sending':
      return {
        lead: 'Your reviewed plan is being sent now.',
        detail: surface === 'modal'
          ? 'You can keep the conversation going here; if the send fails, this band will say so.'
          : 'Open the conversation to keep talking; if the send fails, your chat will say so.',
      };
    case 'sent':
      return { lead: 'Your reviewed plan was sent.', detail: 'Open the conversation to keep talking with our team.' };
    case 'delivery_failed':
      return {
        lead: 'We could not deliver your reviewed plan.',
        detail: 'The plan stays saved in this conversation. Our team will retry the send or reach you by email or WhatsApp, as you chose.',
      };
    default: // pending, or a status the UI does not yet know about — keep the plain waiting copy
      return {
        lead: 'Your request is with our team.',
        detail: surface === 'modal'
          ? 'A human replies in about 30 minutes; it may take longer when busy.'
          : surface === 'page'
            ? 'We aim to reply in about 30 minutes; busy periods may take longer.'
            : 'We aim to reply in about 30 minutes; it may take longer during busy periods.',
      };
  }
}

/** Established platform sign-in redirect convention (/login?redirect=…).
 * After signing in the customer lands back on the canonical conversation. */
export function chatSignInHref(conversationId: string): string {
  return `/login?redirect=${encodeURIComponent(`/my-account/chat/${conversationId}`)}&reason=expired`;
}
