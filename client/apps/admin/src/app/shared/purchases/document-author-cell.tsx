interface DocumentAuthor {
  _id: string;
  name?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export default function DocumentAuthorCell({
  creator,
}: {
  creator?: DocumentAuthor | string | null;
}) {
  const user = creator && typeof creator === 'object' ? creator : null;
  const fullName = [user?.firstName?.trim(), user?.lastName?.trim()].filter(Boolean).join(' ');
  const name =
    user?.name?.trim() || user?.displayName?.trim() || fullName || user?.email || 'Unknown user';
  const initials =
    name === 'Unknown user'
      ? '?'
      : name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
          .toUpperCase();

  return (
    <div className="flex max-w-[220px] items-center gap-2">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600"
      >
        {initials}
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-gray-700" title={name}>
          {name}
        </div>
        {user?.email && user.email !== name && (
          <div className="truncate text-[11px] text-gray-500" title={user.email}>
            {user.email}
          </div>
        )}
      </div>
    </div>
  );
}
