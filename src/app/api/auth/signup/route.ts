import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    const viewerRole = await db.role.findUnique({
      where: { code: 'VIEWER' },
    });

    if (!viewerRole) {
      return NextResponse.json(
        { error: 'Signup is not configured. Please contact an administrator.' },
        { status: 503 }
      );
    }

    const passwordHash = await hashPassword(password);
    const displayName = typeof name === 'string' && name.trim() ? name.trim() : normalizedEmail;

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: displayName,
        passwordHash,
        isActive: true,
        userRoles: {
          create: [{ roleId: viewerRole.id }],
        },
      },
      include: {
        userRoles: {
          include: {
            role: { select: { id: true, name: true, code: true, permissions: true } },
          },
        },
        site: { select: { id: true, name: true, code: true } },
      },
    });

    const roles = user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      code: ur.role.code,
      permissions: Array.isArray(ur.role.permissions) ? (ur.role.permissions as string[]) : [],
    }));

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          siteId: user.siteId,
          site: user.site,
          roles,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An error occurred during sign up' },
      { status: 500 }
    );
  }
}
