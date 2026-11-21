import { NextResponse } from 'next/server';
import { fetchCinemetaDetail } from '@/lib/catalog';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'movie';
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });
  }

  try {
    const detail = await fetchCinemetaDetail(type, id);
    if (!detail) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: detail });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to load detail' },
      { status: 500 }
    );
  }
}
