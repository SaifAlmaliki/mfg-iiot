import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth-config';

// GET /api/users - List users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    
    const users = await db.user.findMany({
      where: siteId ? { siteId } : undefined,
      include: {
        userRoles: {
          include: {
            role: { select: { id: true, name: true, code: true, permissions: true } }
          }
        },
        site: { select: { id: true, name: true, code: true } }
      },
      orderBy: { name: 'asc' }
    });
    
    // Transform the response to include roles directly
    const transformedUsers = users.map(user => ({
      ...user,
      roles: user.userRoles.map(ur => ur.role),
      userRoles: undefined
    }));
    
    return NextResponse.json(transformedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, siteId, roleIds, isActive } = body;
    
    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: (email || '').toString().trim().toLowerCase() },
    });
    
    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    const passwordHash = password ? await hashPassword(password) : '';
    
    const user = await db.user.create({
      data: {
        name,
        email: (email || '').toString().trim().toLowerCase(),
        passwordHash,
        siteId: siteId || null,
        isActive: isActive ?? true,
        userRoles: roleIds && roleIds.length > 0 ? {
          create: roleIds.map((roleId: string) => ({ roleId }))
        } : undefined
      },
      include: {
        userRoles: {
          include: {
            role: true
          }
        },
        site: { select: { id: true, name: true, code: true } }
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'User',
        entityId: user.id,
        newValue: { name: user.name, email: user.email, siteId: user.siteId },
        details: { message: `Created user ${user.name}` }
      }
    });
    
    // Transform response
    const response = {
      ...user,
      roles: user.userRoles.map(ur => ur.role),
      userRoles: undefined
    };
    
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
