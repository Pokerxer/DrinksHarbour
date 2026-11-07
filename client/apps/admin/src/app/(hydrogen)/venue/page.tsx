import VenueWorkspace from '@/app/shared/venue/workspace/workspace';
import { resolveVenueTool } from '@/app/shared/venue/workspace/tool-search';

export default async function VenuePage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>;
}) {
  const { tool } = await searchParams;
  // Validate the deep link server-side; unknown values fall back to the
  // overview tool inside the workspace.
  return <VenueWorkspace initialTool={resolveVenueTool(tool)} />;
}
