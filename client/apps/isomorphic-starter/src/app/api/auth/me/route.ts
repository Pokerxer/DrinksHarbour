import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Simple base64 decode for JWT payload (without verification for this simple check)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return NextResponse.json({
          success: true,
          user: {
            id: payload.userId || payload.id,
            email: payload.email,
          },
        });
      }
    } catch (e) {
      console.error('Token decode error:', e);
    }
    
    return NextResponse.json(
      { success: false, message: 'Invalid token' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
