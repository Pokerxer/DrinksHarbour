'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { isBrowserOffline, OFFLINE_MESSAGE } from '@/utils/network';

// Mounts once in the root layout and reports connectivity transitions.
// The point of this component is timing: without it, the offline state only
// becomes visible when some action fails — at which point the user is told
// "check your connection" by whichever poor component caught the error.
// Announcing the transition here means the offline state is a known context,
// not a surprise buried in an action's error toast. A page loaded while
// already offline toasts nothing here — the action guards surface it on
// demand, and repeating it at every reload would be noise, not signal.

export default function ConnectionStatusWatcher() {
  useEffect(() => {
    const handleChange = () => {
      if (isBrowserOffline()) {
        toast.error(OFFLINE_MESSAGE, { id: 'connection', duration: 6000 });
      } else {
        toast.dismiss('connection');
        toast.success('Back online.', { duration: 3000 });
      }
    };

    window.addEventListener('offline', handleChange);
    window.addEventListener('online', handleChange);
    return () => {
      window.removeEventListener('offline', handleChange);
      window.removeEventListener('online', handleChange);
    };
  }, []);

  return null;
}
