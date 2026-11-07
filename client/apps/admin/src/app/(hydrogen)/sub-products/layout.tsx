import SubProductsNavGate from './sub-products-nav-gate';

/**
 * Shared chrome for every /sub-products/* route — the POS-style shell:
 * full-bleed wrapper, module nav header, padded content canvas.
 *
 * SubProductsNavGate hides its ModuleNavHeader on ?from=pos, where the page
 * and its deep links render the full POSNavHeader instead (never both).
 */
export default function SubProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <SubProductsNavGate />
      </div>
      <div className="flex-1 px-4 pb-10 pt-6 md:px-10 lg:px-14">{children}</div>
    </div>
  );
}
