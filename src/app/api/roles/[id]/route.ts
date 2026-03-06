import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/roles/[id] - Get a single role
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const role = await db.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userRoles: true }
        },
        site: { select: { id: true, name: true, code: true } },
        userRoles: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          },
          take: 10
        }
      }
    });
    
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }
    
    return NextResponse.json(role);
  } catch (error) {
    console.error('Error fetching role:', error);
    return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
  }
}

// PUT /api/roles/[id] - Update a role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check if role exists
    const existingRole = await db.role.findUnique({
      where: { id }
    });
    
    if (!existingRole) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }
    
    // Extract updatable fields
    const {
      name,
      code,
      permissions,
      description,
      siteId
    } = body;
    
    // If changing code, check for duplicates
    if (code && code !== existingRole.code) {
      const duplicate = await db.role.findUnique({
        where: { code }
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Role code already exists' },
          { status: 400 }
        );
      }
    }
    
    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (description !== undefined) updateData.description = description;
    if (siteId !== undefined) updateData.siteId = siteId || null;
    
    const role = await db.role.update({
      where: { id },
      data: updateData,
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
        action: 'UPDATE',
        entityType: 'Role',
        entityId: role.id,
        oldValue: { name: existingRole.name, code: existingRole.code, permissions: existingRole.permissions },
        newValue: { name: role.name, code: role.code, permissions: role.permissions },
        details: { message: `Updated role ${role.name}` }
      }
    });
    
    return NextResponse.json(role);
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

// DELETE /api/roles/[id] - Delete a role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if role exists
    const existingRole = await db.role.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true } } }
    });
    
    if (!existingRole) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }
    
    // Check if role is a system role
    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system role' },
        { status: 400 }
      );
    }
    
    // Check if role has users assigned
    if (existingRole._count.userRoles > 0) {
      return NextResponse.json(
        { error: `Cannot delete role with ${existingRole._count.userRoles} user(s) assigned` },
        { status: 400 }
      );
    }
    
    // Delete the role
    await db.role.delete({
      where: { id }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'Role',
        entityId: id,
        oldValue: { name: existingRole.name, code: existingRole.code },
        details: { message: `Deleted role ${existingRole.name}` }
      }
    });
    
    return NextResponse.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
}
