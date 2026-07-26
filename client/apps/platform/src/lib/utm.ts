'use client';

export function readUTMParams(): { source: string; medium: string; campaign: string } {
  if (typeof window === 'undefined') return { source: '', medium: '', campaign: '' };
  const p = new URLSearchParams(window.location.search);
  const source = p.get('utm_source') || sessionStorage.getItem('dh_utm_source') || '';
  const medium = p.get('utm_medium') || sessionStorage.getItem('dh_utm_medium') || '';
  const campaign = p.get('utm_campaign') || sessionStorage.getItem('dh_utm_campaign') || '';
  if (source) sessionStorage.setItem('dh_utm_source', source);
  if (medium) sessionStorage.setItem('dh_utm_medium', medium);
  if (campaign) sessionStorage.setItem('dh_utm_campaign', campaign);
  return { source, medium, campaign };
}
