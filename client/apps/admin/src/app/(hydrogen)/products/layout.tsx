import ProductsNavGate from './products-nav-gate';

/**
 * POS-style module chrome for every /products/* route (list, pending queue,
 * create, detail, edit): nav header + content canvas. Responsive rules
 * (brand text hiding / mobile Menu button) live in ModuleNavHeader.
 *
 * ProductsNavGate filters the tabs by role — the Pending Approvals queue is
 * only offered to super-admins — and hides the header on ?from=pos (page
 * owns its POS chrome, never two headers).
 */
export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <ProductsNavGate />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
