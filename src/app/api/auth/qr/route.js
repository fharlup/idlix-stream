import crypto from 'crypto';
import { NextResponse } from 'next/server';
import {
  deleteTempValue,
  getCloudUser,
  getTempValue,
  isCloudDbEnabled,
  sanitizeUser,
  setTempValue,
  signSessionToken,
  verifySessionToken,
} from '@/lib/cloudDb';

const SESSION_COOKIE = 'idlix_session';

export async function GET(request) {
  if (!isCloudDbEnabled()) {
    return NextResponse.json({ success: false, message: 'Cloud DB belum aktif' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ success: false, message: 'Kode QR tidak valid' }, { status: 400 });
  }

  try {
    const key = `idlix:qr:${code}`;
    const record = await getTempValue(key);
    if (!record) {
      return NextResponse.json({ success: true, status: 'expired' });
    }

    if (record.status === 'pending') {
      return NextResponse.json({ success: true, status: 'pending' });
    }

    if (record.status === 'approved' && record.username) {
      await deleteTempValue(key);
      const user = await getCloudUser(record.username);
      if (!user) {
        return NextResponse.json({ success: true, status: 'expired' });
      }

      const token = signSessionToken(user.username);
      const res = NextResponse.json({
        success: true,
        status: 'approved',
        account: sanitizeUser(user),
      });
      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });
      return res;
    }

    return NextResponse.json({ success: true, status: 'expired' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isCloudDbEnabled()) {
    return NextResponse.json({ success: false, message: 'Cloud DB belum aktif' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { action, code } = body || {};

    if (action === 'create') {
      const randomCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      await setTempValue(`idlix:qr:${randomCode}`, { status: 'pending', createdAt: Date.now() }, 300);
      return NextResponse.json({ success: true, code: randomCode, expiresIn: 300 });
    }

    if (action === 'approve') {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      const username = verifySessionToken(token);
      if (!username) {
        return NextResponse.json(
          { success: false, message: 'Silakan login terlebih dahulu di HP Anda.' },
          { status: 401 }
        );
      }

      const cleanCode = String(code || '').trim().toUpperCase();
      if (!cleanCode) {
        return NextResponse.json({ success: false, message: 'Kode QR tidak valid.' }, { status: 400 });
      }

      const key = `idlix:qr:${cleanCode}`;
      const record = await getTempValue(key);
      if (!record || record.status !== 'pending') {
        return NextResponse.json(
          { success: false, message: 'Kode QR sudah kedaluwarsa atau sudah digunakan.' },
          { status: 410 }
        );
      }

      await setTempValue(key, { status: 'approved', username, approvedAt: Date.now() }, 120);
      return NextResponse.json({ success: true, approvedFor: username });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
