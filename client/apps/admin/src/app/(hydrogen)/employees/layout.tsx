'use client';

import EmployeesNavHeader from '@/app/shared/employees/employees-nav-header';

/**
 * Shared chrome for every /employees/* route. Hoisting the nav header here keeps
 * the team header visible across all employee links instead of each page
 * re-rendering its own copy.
 *
 * The negative margins break out of the (hydrogen) content padding so the nav bar
 * and the full-bleed hero reach the container edges; the inner wrapper restores
 * horizontal padding for the nav itself.
 */
export default function EmployeesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex min-h-screen flex-col bg-[#FAF8F3] bg-[radial-gradient(ellipse_1100px_500px_at_50%_-10%,rgba(178,2,2,0.06),transparent)] md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
        <EmployeesNavHeader />
      </div>
      {children}
    </div>
  );
}
