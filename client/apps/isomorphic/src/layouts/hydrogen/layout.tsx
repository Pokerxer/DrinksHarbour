import Header from '@/layouts/hydrogen/header';
import Sidebar from '@/layouts/hydrogen/sidebar';
import { useHydrogenSidebar } from '@/layouts/hydrogen/hydrogen-sidebar-utils';

export default function HydrogenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { expanded, setExpanded } = useHydrogenSidebar();

  return (
    <main className="flex min-h-screen flex-grow">
      <Sidebar 
        className="fixed hidden dark:bg-gray-50 xl:block" 
        isExpanded={expanded}
        onToggle={() => setExpanded(false)}
      />
      <div 
        className={
          expanded 
            ? 'flex w-full flex-col xl:ms-[270px] xl:w-[calc(100%-270px)] 2xl:ms-72 2xl:w-[calc(100%-288px)]'
            : 'flex w-full flex-col xl:ms-0 xl:w-full'
        }
      >
        <Header />
        <div className="flex flex-grow flex-col px-4 pb-6 pt-2 md:px-5 lg:px-6 lg:pb-8 3xl:px-8 3xl:pt-4 4xl:px-10 4xl:pb-9">
          {children}
        </div>
      </div>
    </main>
  );
}
