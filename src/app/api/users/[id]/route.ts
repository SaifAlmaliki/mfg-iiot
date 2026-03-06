import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/users/[id] - Get a single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const user = await db.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: { select: { id: true, name: true, code: true, permissions: true } }
          }
        },
        site: { select: { id: true, name: true, code: true } }
      }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Transform response
    const response = {
      ...user,
      roles: user.userRoles.map(ur => ur.role),
      userRoles: undefined
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PUT /api/users/[id] - Update a user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id },
      include: { userRoles: true }
    });
    
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Extract updatable fields
    const {
      name,
      email,
      password,
      siteId,
      roleIds,
      isActive
    } = body;
    
    // If changing email, check for duplicates
    if (email && email !== existingUser.email) {
      const duplicate = await db.user.findUnique({
        where: { email }
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
    }
    
    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (password !== undefined && password) {
      updateData.passwordHash = Buffer.from(password).toString('base64');
    }
    if (siteId !== undefined) updateData.siteId = siteId || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Update user
    const user = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        userRoles: {
          include: {
            role: true
          }
        },
        site: { select: { id: true, name: true, code: true } }
      }
    });
    
    // Update roles if provided
    if (roleIds !== undefined) {
      // Delete existing roles
      await db.userRole.deleteMany({
        where: { userId: id }
      });
      
      // Create new roles
      if (roleIds.length > 0) {
        await db.userRole.createMany({
          data: roleIds.map((roleId: string) => ({ userId: id, roleId }))
        });
      }
    }
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'User',
        entityId: user.id,
        oldValue: { name: existingUser.name, email: existingUser.email },
        newValue: { name: user.name, email: user.email, siteId: user.siteId },
        details: { message: `Updated user ${user.name}` }
      }
    });
    
    // Transform response
    const response = {
      ...user,
      roles: user.userRoles.map(ur => ur.role),
      userRoles: undefined
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id }
    });
    
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Delete user roles first
    await db.userRole.deleteMany({
      where: { userId: id }
    });
    
    // Delete sessions
    await db.session.deleteMany({
      where: { userId: id }
    });
    
    // Delete the user
    await db.user.delete({
      where: { id }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'User',
        entityId: id,
        oldValue: { name: existingUser.name, email: existingUser.email },
        details: { message: `Deleted user ${existingUser.name}` }
      }
    });
    
    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
