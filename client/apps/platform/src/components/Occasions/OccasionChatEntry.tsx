import { PiChatCircleDotsBold, PiArrowRightBold } from 'react-icons/pi';

export default function OccasionChatEntry({ onOpen }: { onOpen: () => void }) {
  return <div className="mb-7 flex flex-col gap-4 rounded-2xl border border-rose-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-start gap-3"><PiChatCircleDotsBold aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-[#7c1d1d]" /><div><p className="text-sm font-bold text-[#351014]">Already have a list, or prefer to talk it through?</p><p className="mt-1 text-sm leading-6 text-gray-600">Skip the form and chat with your AI planner. Upload your list or photo, or simply type what you have in mind.</p></div></div>
    <button type="button" onClick={onOpen} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-[#7c1d1d] px-5 py-3 text-sm font-bold text-[#7c1d1d] hover:bg-rose-50">Chat directly with AI<PiArrowRightBold aria-hidden="true" /></button>
  </div>;
}
