import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    // Prefer Authorization header (Bearer token stored in localStorage/sessionStorage)
    const authHeader = req.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Fall back to cookie (for SSR or cookie-based flows)
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('token')?.value ?? null;
    }

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Decode JWT payload without full verification (for lightweight client check)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString()
        );

        // Honour expiry
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          return NextResponse.json(
            { success: false, message: 'Token expired' },
            { status: 401 }
          );
        }

        return NextResponse.json({
          success: true,
          user: {
            id:    payload.userId || payload.id || payload.sub,
            email: payload.email,
            role:  payload.role,
          },
        });
      }
    } catch {
      // malformed token — fall through
    }

    return NextResponse.json(
      { success: false, message: 'Invalid token' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
