import RequestDetail from '@/app/shared/occasion-requests/request-detail';
export default async function OccasionRequestPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <RequestDetail key={id} id={id} />; }
