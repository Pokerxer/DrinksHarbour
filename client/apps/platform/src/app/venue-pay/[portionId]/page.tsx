import PayerCheckout from '@/components/Venues/payer-checkout';
export const metadata={title:'Pay your bill portion',robots:{index:false,follow:false},referrer:'no-referrer'};
export const dynamic='force-dynamic';
export default async function PayerPage({params,searchParams}:{params:Promise<{portionId:string}>;searchParams:Promise<{token?:string}>}){
 return <main className="min-h-dvh bg-stone-50 px-4 py-10 text-stone-900 sm:px-6"><div className="mx-auto max-w-xl"><PayerCheckout portionId={(await params).portionId} token={(await searchParams).token||''}/></div></main>;
}
