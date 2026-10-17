import PeerEmployeePage from '@/app/shared/appraisals/peer-rating/employee-page';
export default async function Page({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;
  return <PeerEmployeePage id={cycleId} />;
}
