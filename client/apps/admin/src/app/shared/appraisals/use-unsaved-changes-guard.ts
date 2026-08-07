'use client';

import { useEffect } from 'react';

/**
 * Warn before unsaved work is thrown away.
 *
 * Three exits have to be covered, and only one of them is `beforeunload`:
 *
 *  1. Closing the tab or a hard reload — the browser dialog, armed only while
 *     something is genuinely unwritten. An unconditional handler trains people
 *     to click through it.
 *  2. A Next.js client-side navigation. This is the one that actually bites in
 *     this app: the appraisals section nav header, the "All review forms" back
 *     link and the sidebar are all `<Link>`s, and a client navigation never
 *     fires `beforeunload`. The App Router exposes no cancellable route-change
 *     event, so this intercepts the click on the way to the router in the
 *     capture phase — early enough to stop Next's own handler from ever
 *     seeing it.
 *  3. The browser Back button, which fires neither of the above. `popstate`
 *     only arrives once the navigation has already been committed, so there
 *     is nothing left to cancel by then — the only way to hold the page is to
 *     have somewhere harmless to land. While the form is dirty this pushes a
 *     sentinel history entry at the SAME url, so the first Back press pops
 *     that instead of leaving; if the user declines to leave, the sentinel is
 *     pushed again so the next press is caught too.
 *
 *     The cost of that trick is a junk history entry, which is why the cleanup
 *     consumes it: a form that gets saved must not leave the user with a Back
 *     press that appears to do nothing. Because the sentinel shares the
 *     current url, consuming it is invisible.
 *
 * Anchors that leave the app entirely (target=_blank, a download, a different
 * origin, a modifier-click the browser turns into a new tab) are left alone:
 * they do not discard the page's state, so a confirm there is pure friction.
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  message = 'You have unsaved changes. Leave without saving?'
) {
  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy assignment: Chrome still requires a truthy returnValue.
      e.returnValue = '';
    };

    const onClickCapture = (e: MouseEvent) => {
      // Anything the browser will handle itself rather than routing.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.(
        'a[href]'
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page, different hash — not a navigation away from this form.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      // eslint-disable-next-line no-alert
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // `armed` also marks whether OUR sentinel is still the current entry, so
    // cleanup knows whether there is one to consume.
    let armed = true;
    window.history.pushState({ __unsavedGuard: true }, '');

    const onPopState = () => {
      if (!armed) return;
      // eslint-disable-next-line no-alert
      if (window.confirm(message)) {
        // The sentinel was consumed by the pop that got us here, so one more
        // step back is what actually leaves the page.
        armed = false;
        window.history.back();
        return;
      }
      window.history.pushState({ __unsavedGuard: true }, '');
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClickCapture, true);
      // Saved, or unmounted: drop the sentinel rather than leave a Back press
      // that silently does nothing. The listener is already detached, so the
      // popstate this fires is ignored, and the url is unchanged either way.
      if (
        armed &&
        (window.history.state as { __unsavedGuard?: boolean } | null)
          ?.__unsavedGuard
      ) {
        armed = false;
        window.history.back();
      }
    };
  }, [isDirty, message]);
}
