import ConversationPage from '@/components/CustomerChat/ConversationPage';
export default async function CustomerConversationPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ConversationPage key={id} id={id} />; }
