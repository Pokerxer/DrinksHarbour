import { Title } from 'rizzui/typography';
import cn from '@core/utils/class-names';
import Breadcrumb from '@core/ui/breadcrumb';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';

export type PageHeaderTypes = {
  title: string;
  breadcrumb: { name: string; href?: string }[];
  className?: string;
};

export default function PageHeader({
  title,
  breadcrumb,
  children,
  className,
}: React.PropsWithChildren<PageHeaderTypes>) {
  return (
    <header className={cn('mb-6 @container xs:-mt-2 lg:mb-7', className)}>
      <div className="flex flex-col @lg:flex-row @lg:items-center @lg:justify-between">
        <div className="flex items-start gap-3">
          {/* Opens the full-screen app launcher (replaces the old sidebar/header nav) */}
          <LauncherButton className="mt-0.5" />
          <div>
            <Title
              as="h2"
              className="mb-2 text-[22px] lg:text-2xl 4xl:text-[26px]"
            >
              {title}
            </Title>

            <Breadcrumb
              separator=""
              separatorVariant="circle"
              className="flex-wrap"
            >
              {breadcrumb.map((item) => (
                <Breadcrumb.Item
                  key={item.name}
                  {...(item?.href && { href: item?.href })}
                >
                  {item.name}
                </Breadcrumb.Item>
              ))}
            </Breadcrumb>
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}
