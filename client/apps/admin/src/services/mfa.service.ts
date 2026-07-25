// services/mfa.service.ts — mid-session MFA step-up
//
// `requireMfa` guards the privileged routes (everything after
// `router.use(requireMfa)` in server/routes/user.routes.js) and wants proof of
// an MFA challenge from the last 10 minutes. Login issues that proof, but it
// expires long before a typical dashboard session does — step-up is how a
// signed-in admin re-proves without signing out.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface StepUpResult {
  success: boolean;
  mfaToken?: string;
  message?: string;
}

/**
 * Re-verify a TOTP or backup code for the signed-in user and get a fresh
 * mfa-verified token. Never throws — the caller is a prompt that needs a
 * message to show.
 */
export async function stepUpMfa(
  code: string,
  accessToken: string | undefined
): Promise<StepUpResult> {
  if (!accessToken) {
    return {
      success: false,
      message: 'Your session has expired. Please sign in again.',
    };
  }

  try {
    const response = await fetch(`${API_URL}/api/users/mfa/step-up`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      // The endpoint verifies against the authenticated user; sending an id
      // here would be ignored, and it must be.
      body: JSON.stringify({ code }),
    });

    const data = (await response.json()) as {
      success?: boolean;
      message?: string;
      data?: { mfaToken?: string };
    };

    if (!response.ok || !data.success || !data.data?.mfaToken) {
      return {
        success: false,
        message: data.message || 'That code was not accepted.',
      };
    }

    return { success: true, mfaToken: data.data.mfaToken };
  } catch (error) {
    console.error('MFA step-up failed:', error);
    return {
      success: false,
      message: 'Unable to reach the server. Please check your connection.',
    };
  }
}
