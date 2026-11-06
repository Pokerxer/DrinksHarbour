import Link from 'next/link';

type LinkRef = { href: string; label: string };

/**
 * Descriptive in-copy anchors to an occasion's own subpages, rendered as one
 * readable sentence appended to a body paragraph ("the a and the b"). Keeps the
 * internal-link pattern identical across the occasion planning bodies.
 */
export default function SubpageInCopyLinks({ links, lead = 'Dedicated guides:' }: { links: LinkRef[]; lead?: string }) {
  if (!links.length) return null;
  return <>{lead} {links.map((link, index) => {
    const gap = index === 0 ? 'the ' : index === links.length - 1 ? ' and the ' : ', the ';
    return <span key={link.href}>{gap}<Link href={link.href} className="font-semibold text-[#7c1d1d] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">{link.label}</Link></span>;
  })}.</>;
}
