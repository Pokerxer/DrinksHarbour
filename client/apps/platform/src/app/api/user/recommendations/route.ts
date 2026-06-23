import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get('token')?.value || '';
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken();
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '10';

    const response = await fetch(`${API_URL}/api/products/recommendations/personalized?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching personalized recommendations:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
