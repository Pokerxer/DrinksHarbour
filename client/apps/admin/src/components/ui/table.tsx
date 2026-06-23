import { clsx, type ClassValue } from 'clsx';

function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

interface HeaderCellProps {
  title: React.ReactNode;
  className?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function HeaderCell({
  title,
  className,
  sortable,
  align = 'left',
}: HeaderCellProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1',
        sortable && 'cursor-pointer select-none hover:bg-gray-100',
        align === 'center' && 'justify-center',
        align === 'right' && 'justify-end',
        className
      )}
    >
      {title}
    </div>
  );
}
