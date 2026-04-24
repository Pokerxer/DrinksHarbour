import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export async function GET(
  request: NextRequest,
  { params }: { params: { placement: string } }
) {
  try {
    const { placement } = params;
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.toString();

    const url = `${API_URL}/api/banners/placement/${placement}${query ? `?${query}` : ''}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching banners for placement:', error);
    return NextResponse.json({ success: false, data: [], message: 'Failed to fetch banners' }, { status: 500 });
  }
}

// Track impression
export async function POST(
  request: NextRequest,
  { params }: { params: { placement: string } }
) {
  return NextResponse.json({ success: false, message: 'Method not supported' }, { status: 405 });
}
