import { OCCASION_LABELS, prepareOccasionBrief, type OccasionBriefInput, type BriefErrors } from './occasionBrief.ts';

export function prepareOccasionAiBrief(input: OccasionBriefInput, today: string, requirePlanningNumbers = false): { ok: true; context: string } | { ok: false; errors: BriefErrors } {
  // Missing city is a question for the planner; supplied fields still use the
  // existing form's validation, including dates, guest counts and NGN budgets.
  const result = prepareOccasionBrief({ ...input, city: input.city.trim() || 'Not supplied yet' }, today);
  if (!result.ok) return result;
  if (requirePlanningNumbers) {
    const errors: BriefErrors = {};
    if (!input.guests.trim()) errors.guests = 'Enter the number of guests so the AI can plan your list.';
    if (!input.budget.trim()) errors.budget = 'Enter your total drinks budget in naira.';
    if (Number(input.guests) > 1000000) errors.guests = 'Enter up to 1,000,000 guests.';
    if (Number(input.budget) > 10000000000) errors.budget = 'Enter a budget up to NGN 10,000,000,000.';
    if (Object.keys(errors).length) return { ok: false, errors };
  }
  const context = [
    `Occasion: ${OCCASION_LABELS[result.occasion]}`,
    `Delivery city: ${input.city.trim() || 'Not supplied yet'}`,
    input.date ? `Preferred date: ${input.date}` : '',
    input.guests.trim() ? `Guests: ${Number(input.guests).toLocaleString('en-NG')}` : '',
    input.budget.trim() ? `Budget: NGN ${Number(input.budget).toLocaleString('en-NG', { maximumFractionDigits: 2 })}` : '',
    input.notes.trim() ? `Customer notes: ${input.notes.trim()}` : '',
  ].filter(Boolean).join('\n');
  return { ok: true, context };
}
