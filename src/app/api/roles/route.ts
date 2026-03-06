import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/roles - List roles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    
    const roles = await db.role.findMany({
      where: siteId ? { siteId } : undefined,
      include: {
        _count: {
          select: { userRoles: true }
        },
        site: { select: { id: true, name: true, code: true } }
      },
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

// POST /api/roles - Create a new role
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, permissions, description, siteId } = body;
    
    // Check if code already exists
    const existingRole = await db.role.findUnique({
      where: { code }
    });
    
    if (existingRole) {
      return NextResponse.json({ error: 'Role code already exists' }, { status: 400 });
    }
    
    const role = await db.role.create({
      data: {
        name,
        code,
        permissions: permissions || [],
        description,
        siteId: siteId || null,
        isSystem: false
      },
      include: {
        _count: {
          select: { userRoles: true }
        },
        site: { select: { id: true, name: true, code: true } }
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'Role',
        entityId: role.id,
        newValue: { name: role.name, code: role.code, permissions: role.permissions },
        details: { message: `Created role ${role.name}` }
      }
    });
    
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}
