import { Text } from 'react-native';
import { splitHighlight } from '../../lib/search-highlight.ts';

/**
 * The RN stand-in for the web's `<Highlight>` (`ModalSearch.tsx:206-223`).
 *
 * React Native has no `<mark>`, so the matched runs become nested `<Text>` with
 * the brand tint. Nesting is what lets the highlight inherit the parent's font
 * size and still take part in `numberOfLines` truncation — a sibling row of
 * <Text> would not wrap correctly.
 *
 * All the logic is in `lib/search-highlight.ts`; this is presentation only.
 */
export function HighlightedText({
  text,
  query,
  className,
  numberOfLines,
}: {
  text: string;
  query: string;
  className?: string;
  numberOfLines?: number;
}) {
  const segments = splitHighlight(text, query);

  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {segments.map((segment, i) =>
        segment.matched ? (
          // #b20202 is the search modal's deep red, written literally because
          // there is no `brand` token in either tailwind config and red-700
          // (#b91c1c) is a visibly different colour.
          <Text key={i} className="font-semibold text-[#b20202]">
            {segment.text}
          </Text>
        ) : (
          segment.text
        )
      )}
    </Text>
  );
}
