// Proxy for the mobile scan upload. The mobile page is served from the same
// origin (admin.drinksharbour.com) so calling this route avoids CORS and
// mixed-content blocks that would occur if the phone hit the Express server
// directly. We forward the multipart/form-data unchanged.

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  try {
    const formData = await req.formData();

    const upstream = await fetch(`${API_URL}/api/scan/upload-mobile/${code}`, {
      method: 'POST',
      body: formData,
    });

    const body = await upstream.json().catch(() => ({}));
    return NextResponse.json(body, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
