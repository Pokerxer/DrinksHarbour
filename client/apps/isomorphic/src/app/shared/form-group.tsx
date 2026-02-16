import cn from '@core/utils/class-names';

interface FormGroupProps {
  title: React.ReactNode;
  className?: string;
  description?: string;
  children?: React.ReactNode;
}

export default function FormGroup({
  title,
  className,
  description,
  children,
}: FormGroupProps) {
  return (
    <div className={cn('grid w-full gap-5 @3xl:grid-cols-[200px_1fr]', className)}>
      <div className="col-span-full w-full @3xl:col-span-1 @3xl:w-[200px]">
        <h4 className="text-base font-medium">{title}</h4>
        {description && <p className="mt-2">{description}</p>}
      </div>
      {children && (
        <div className="col-span-full w-full min-w-0 @3xl:col-span-1">
          {children}
        </div>
      )}
    </div>
  );
}
