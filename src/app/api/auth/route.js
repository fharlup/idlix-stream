import crypto from 'crypto';
import { NextResponse } from 'next/server';
import {
  getCloudUser,
  hashPassword,
  isCloudDbEnabled,
  sanitizeUser,
  saveCloudUser,
  signSessionToken,
  verifySessionToken,
} from '@/lib/cloudDb';

const SESSION_COOKIE = 'idlix_session';
const AVATAR_COLORS = ['#e50914', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

export async function GET(request) {
  const cloudEnabled = isCloudDbEnabled();
  if (!cloudEnabled) {
    return NextResponse.json({ success: true, cloudEnabled: false, account: null });
  }

  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const username = verifySessionToken(token);
    if (!username) {
      return NextResponse.json({ success: true, cloudEnabled: true, account: null });
    }
    const user = await getCloudUser(username);
    return NextResponse.json({
      success: true,
      cloudEnabled: true,
      account: sanitizeUser(user),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, cloudEnabled: true, message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!isCloudDbEnabled()) {
    return NextResponse.json(
      { success: false, cloudEnabled: false, message: 'Cloud DB belum dikonfigurasi' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { action, username, password } = body || {};

    if (action === 'logout') {
      const res = NextResponse.json({ success: true, cloudEnabled: true });
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }

    const cleanName = String(username || '').trim().toLowerCase();
    if (cleanName.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Username minimal 2 karakter.' },
        { status: 400 }
      );
    }

    if (action === 'register') {
      const existing = await getCloudUser(cleanName);
      if (existing) {
        return NextResponse.json(
          { success: false, message: 'Username sudah terdaftar. Silakan masuk.' },
          { status: 409 }
        );
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = password ? hashPassword(password, salt) : '';
      const color = AVATAR_COLORS[cleanName.charCodeAt(0) % AVATAR_COLORS.length];

      const user = {
        username: cleanName,
        displayName: String(username).trim(),
        salt,
        passwordHash,
        avatarColor: color,
        createdAt: Date.now(),
        history: [],
        watchlist: [],
      };

      await saveCloudUser(user);
      const token = signSessionToken(cleanName);
      const res = NextResponse.json({
        success: true,
        cloudEnabled: true,
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

    if (action === 'login') {
      const user = await getCloudUser(cleanName);
      if (!user) {
        return NextResponse.json(
          { success: false, message: 'Akun tidak ditemukan.' },
          { status: 404 }
        );
      }
      if (user.passwordHash && hashPassword(password || '', user.salt) !== user.passwordHash) {
        return NextResponse.json(
          { success: false, message: 'Password / PIN salah.' },
          { status: 401 }
        );
      }

      const token = signSessionToken(cleanName);
      const res = NextResponse.json({
        success: true,
        cloudEnabled: true,
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

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || 'Auth error' },
      { status: 500 }
    );
  }
}
