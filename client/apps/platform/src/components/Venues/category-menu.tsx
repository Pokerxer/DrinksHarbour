import ServingPicker, { type PublicServing } from './serving-picker';
type Category = {
  id: string;
  sectionId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
};
export default function CategoryMenu({
  section,
  categories,
}: {
  section: { id: string; items: PublicServing[] };
  categories: Category[];
}) {
  const rows = categories
    .filter((row) => row.sectionId === section.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const content = (category: Category) => {
    const items = section.items.filter(
      (item) => item.categoryId === category.id,
    );
    return items.length > 0 ? (
      <ul className="grid gap-4 sm:grid-cols-2">
        {[...new Set(items.map((item) => item.subProductId))].map((id) => (
          <li key={id}>
            <ServingPicker
              items={items.filter((item) => item.subProductId === id)}
            />
          </li>
        ))}
      </ul>
    ) : null;
  };
  return (
    <div className="space-y-6">
      {rows
        .filter((row) => !row.parentId)
        .map((root) => (
          <section className="space-y-4" key={root.id}>
            <h4 className="font-semibold text-stone-700">{root.name}</h4>
            {content(root)}
            {rows
              .filter((child) => child.parentId === root.id)
              .map((child) => (
                <section
                  className="space-y-3 border-l-2 border-stone-200 pl-4"
                  key={child.id}
                >
                  <h5 className="font-medium">{child.name}</h5>
                  {content(child)}
                </section>
              ))}
          </section>
        ))}
    </div>
  );
}
