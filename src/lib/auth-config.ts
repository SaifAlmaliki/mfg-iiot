import bcrypt from 'bcrypt';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'uns-platform-secret-key-change-in-production';
const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT utilities
export async function createToken(payload: Record<string, unknown>): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Session utilities
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  siteId?: string | null;
  roles: Array<{
    id: string;
    name: string;
    code: string;
    permissions: string[];
  }>;
}

export async function createSession(userId: string): Promise<{ token: string; refreshToken: string }> {
  const token = await createToken({ userId, type: 'access' });
  const refreshToken = await createToken({ userId, type: 'refresh' });
  
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY);
  
  await db.session.create({
    data: {
      userId,
      token,
      refreshToken,
      expiresAt,
    },
  });
  
  // Update last login
  await db.user.update({
    where: { id: userId },
    data: { lastLogin: new Date() },
  });
  
  return { token, refreshToken };
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    if (!token) return null;
    
    const payload = await verifyToken(token);
    if (!payload || !payload.userId) return null;
    
    // Check if session exists and is valid
    const session = await db.session.findFirst({
      where: {
        token,
        expiresAt: { gte: new Date() },
      },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });
    
    if (!session || !session.user.isActive) return null;
    
    const user = session.user;
    const roles = user.userRoles.map(ur => ({
      id: ur.role.id,
      name: ur.role.name,
      code: ur.role.code,
      permissions: Array.isArray(ur.role.permissions) 
        ? ur.role.permissions as string[] 
        : [],
    }));
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      siteId: user.siteId,
      roles,
    };
  } catch (error) {
    console.error('getSession error:', error);
    return null;
  }
}

export async function deleteSession(token?: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    const sessionToken = token || cookieStore.get('auth-token')?.value;
    
    if (sessionToken) {
      await db.session.deleteMany({
        where: { token: sessionToken },
      });
    }
  } catch (error) {
    console.error('deleteSession error:', error);
  }
}

// Permission utilities
export function hasPermission(user: SessionUser, permission: string): boolean {
  // Check if any role has the permission
  return user.roles.some(role => {
    const permissions = role.permissions;
    // Check for wildcard permission (e.g., "*" or "hierarchy:*")
    if (permissions.includes('*')) return true;
    if (permissions.some(p => p.endsWith(':*') && permission.startsWith(p.replace(':*', '')))) return true;
    return permissions.includes(permission);
  });
}

export function hasAnyPermission(user: SessionUser, permissions: string[]): boolean {
  return permissions.some(p => hasPermission(user, p));
}

export function hasAllPermissions(user: SessionUser, permissions: string[]): boolean {
  return permissions.every(p => hasPermission(user, p));
}

// Site access utilities
export function canAccessSite(user: SessionUser, siteId: string): boolean {
  // If user has siteId, they can only access that site
  if (user.siteId) {
    return user.siteId === siteId;
  }
  // If user has no siteId, they can access all sites (admin)
  return true;
}

// Cookie utilities
export async function setAuthCookie(token: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  });
  
  cookieStore.set('refresh-token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.delete('auth-token');
  cookieStore.delete('refresh-token');
}
