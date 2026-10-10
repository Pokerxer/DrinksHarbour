const endpoints = [
  ['POST', '/customers/register', 'Create an independent store customer account'],
  ['POST', '/customers/login', 'Sign in with this store’s email and password'],
  ['GET', '/customers/me', 'Read the signed-in customer’s current profile'],
  ['POST', '/customers/refresh-token', 'Rotate the refresh token once'],
  ['POST', '/customers/logout', 'Revoke the customer session'],
  ['POST', '/customers/verify-email', 'Verify this store’s six-digit email code'],
  ['POST', '/customers/resend-verification', 'Request another verification code'],
  ['POST', '/customers/forgot-password', 'Request a store-bound reset link'],
  ['POST', '/customers/reset-password/:token', 'Set a new password in this store'],
  ['POST', '/customers/mfa/verify', 'Complete a store-bound MFA challenge'],
];
export default function ApiCustomerReference() {
  return (
    <section id="customers" className="scroll-mt-24 space-y-4 rounded-2xl border border-muted bg-white p-5 dark:bg-gray-50 sm:p-6">
      <h2 className="text-lg font-semibold">Customer accounts</h2>
      <p className="text-sm leading-7 text-gray-600">
        Customer accounts belong only to the tenant selected by your private API key.
        The same email can have different passwords at different stores. Platform
        accounts and staff credentials cannot sign in here. Every request requires
        storefront:read and Authorization: Bearer &lt;key&gt; on your website server.
        Never send a tenant ID or role from a visitor.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th className="p-2">Method</th><th className="p-2">Path</th><th className="p-2">Purpose</th></tr></thead>
          <tbody>{endpoints.map(([method, path, purpose]) => <tr key={path} className="border-t border-muted"><td className="p-2">{method}</td><td className="p-2 font-mono text-xs">{path}</td><td className="p-2">{purpose}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="text-sm leading-7 text-gray-600">
        Register with firstName, lastName, email, password and optional phoneNumber.
        Login uses email and password. Successful login returns data.user, data.token
        and data.refreshToken; keep tokens in encrypted HttpOnly website sessions.
        Send X-Customer-Token with the access token for /customers/me. Refresh and
        logout accept refreshToken. Refresh returns token and refreshToken; fetch
        /customers/me again to validate the customer profile.
      </p>
      <p className="text-sm leading-7 text-gray-600">
        Verification accepts email and code. Recovery accepts email and optional
        returnOrigin, which must be explicitly allowed for that tenant on the backend.
        Reset accepts newPassword. MFA login returns mfaRequired, pendingMfaToken
        and tenantId; complete it with pendingMfaToken and code within five minutes.
        Codes, reset links and sessions cannot be used at another store.
        Guest checkout remains available; matching an email does not grant order access.
      </p>
    </section>
  );
}
