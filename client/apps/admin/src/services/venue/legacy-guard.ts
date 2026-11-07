export function assertLegacyCheckout(payload: Record<string, unknown>) {
  if (payload.serviceSessionId || payload.venueIdentityVersion === 1 || payload.canonicalVenueLocation === true)
    throw new Error('Use the online venue bill checkout for this visit.');
}
