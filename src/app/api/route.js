import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'IDLIX Stream Next.js API v4',
    upstream: process.env.IDLIX_BASE_URL || 'https://z3.idlixku.com',
  });
}
