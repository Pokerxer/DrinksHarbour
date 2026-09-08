/** A nested tab takes precedence over its parent tab. */
export function activeModuleHref(pathname: string | null, hrefs: string[]) {
  return hrefs
    .filter(href => pathname === href || pathname?.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
