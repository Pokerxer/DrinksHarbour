import type { DocumentModel } from '@/utils/print/doc-model';
import { PiPrinter } from 'react-icons/pi';
export default function MovementDocumentPreview({
  document,
  print,
}: {
  document: DocumentModel;
  print: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
      <article
        aria-label="Movement document preview"
        className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <header className="border-b-2 border-[#b20202] pb-3">
          <h2 className="text-sm font-bold text-gray-900">{document.docTitle}</h2>
          <p className="mt-1 break-words text-xs text-gray-500">{document.number}</p>
          {document.watermark && (
            <p className="mt-2 text-xs font-bold text-amber-700">
              {document.watermark} · Not posted
            </p>
          )}
        </header>
        {document.parties.map((party, index) => (
          <div key={index} className="mt-3 text-xs">
            <p className="font-semibold text-gray-500">{party.heading}</p>
            <p className="break-words text-gray-800">{party.name}</p>
            {party.lines?.map((line, i) => (
              <p key={i} className="break-words text-gray-500">
                {line}
              </p>
            ))}
          </div>
        ))}
        <dl className="mt-3 text-xs">
          {document.meta.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-gray-50 py-1.5">
              <dt className="shrink-0 font-semibold text-gray-500">{label}</dt>
              <dd className="min-w-0 break-words text-right text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[360px] text-[11px]">
            <caption className="sr-only">Recorded product and cost</caption>
            <thead>
              <tr>
                {document.table.columns.map((column, index) => (
                  <th
                    key={index}
                    className="border-b border-gray-200 p-2 text-left font-semibold text-gray-500"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {document.table.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, i) => (
                    <td key={i} className="border-b border-gray-100 p-2 align-top">
                      <p className={`break-words ${cell.strong ? 'font-bold' : ''}`}>{cell.text}</p>
                      {cell.sub && <p className="break-words text-gray-500">{cell.sub}</p>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs">
          {document.totals.map((total, index) => (
            <div key={index} className="flex justify-between gap-3 py-1 font-bold">
              <span>{total.label}</span>
              <span className="text-[#b20202]">{total.value}</span>
            </div>
          ))}
        </div>
        {document.sections?.map((section, index) => (
          <section key={index} className="mt-3 text-xs">
            <h3 className="mb-1 font-semibold text-gray-500">{section.title}</h3>
            <p className="whitespace-pre-wrap break-words text-gray-600">{section.body}</p>
          </section>
        ))}
        <button
          type="button"
          onClick={print}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#b20202] py-2 text-xs font-bold text-white hover:bg-[#9a0101]"
        >
          <PiPrinter className="h-3.5 w-3.5" />
          Print / PDF
        </button>
      </article>
    </div>
  );
}
