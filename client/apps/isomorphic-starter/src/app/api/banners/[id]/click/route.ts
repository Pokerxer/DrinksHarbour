import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await fetch(`${API_URL}/api/banners/${params.id}/click`, { method: 'POST' });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
