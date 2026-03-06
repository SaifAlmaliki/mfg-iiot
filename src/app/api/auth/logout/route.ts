import { NextResponse } from 'next/server';
import { deleteSession, clearAuthCookies } from '@/lib/auth-config';

export async function POST() {
  try {
    await deleteSession();
    await clearAuthCookies();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: true });
  }
}
