import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/recipes/[id] - Get a single recipe
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const recipe = await db.recipe.findUnique({
      where: { id },
      include: {
        product: true,
        recipeMaterials: {
          include: {
            material: {
              select: { id: true, name: true, code: true, unit: true }
            }
          }
        },
        productionRuns: {
          select: { id: true, runNumber: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        orders: {
          select: { id: true, orderNumber: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
    
    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }
    
    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return NextResponse.json({ error: 'Failed to fetch recipe' }, { status: 500 });
  }
}

// PUT /api/recipes/[id] - Update a recipe
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check if recipe exists
    const existingRecipe = await db.recipe.findUnique({
      where: { id }
    });
    
    if (!existingRecipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }
    
    // Extract updatable fields
    const {
      name,
      version,
      description,
      productId,
      productCode,
      status,
      recipeType,
      parameters,
      steps,
      equipmentRequirements,
      materials,
      approvedBy,
      approvedAt
    } = body;
    
    // If changing name+version, check for duplicates
    if ((name && name !== existingRecipe.name) || 
        (version && version !== existingRecipe.version)) {
      const duplicate = await db.recipe.findFirst({
        where: { 
          name: name || existingRecipe.name, 
          version: version || existingRecipe.version,
          NOT: { id }
        }
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Recipe with this name and version already exists' },
          { status: 400 }
        );
      }
    }
    
    // Only allow updates to DRAFT or APPROVED recipes (not ACTIVE)
    if (existingRecipe.status === 'ACTIVE' && status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Cannot modify ACTIVE recipe. Create a new version.' },
        { status: 400 }
      );
    }
    
    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (version !== undefined) updateData.version = version;
    if (description !== undefined) updateData.description = description;
    if (productId !== undefined) updateData.productId = productId;
    if (productCode !== undefined) updateData.productCode = productCode;
    if (status !== undefined) updateData.status = status;
    if (recipeType !== undefined) updateData.recipeType = recipeType;
    if (parameters !== undefined) updateData.parameters = parameters;
    if (steps !== undefined) updateData.steps = steps;
    if (equipmentRequirements !== undefined) updateData.equipmentRequirements = equipmentRequirements;
    if (materials !== undefined) updateData.materials = materials;
    if (approvedBy !== undefined) updateData.approvedBy = approvedBy;
    if (approvedAt !== undefined) updateData.approvedAt = approvedAt ? new Date(approvedAt) : null;
    
    const recipe = await db.recipe.update({
      where: { id },
      data: updateData,
      include: {
        product: true
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'Recipe',
        entityId: recipe.id,
        oldValue: existingRecipe,
        newValue: recipe,
        details: { message: `Updated recipe ${recipe.name} ${recipe.version}` }
      }
    });
    
    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Error updating recipe:', error);
    return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 });
  }
}

// DELETE /api/recipes/[id] - Delete a recipe
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if recipe exists
    const existingRecipe = await db.recipe.findUnique({
      where: { id },
      include: { 
        productionRuns: { where: { status: 'RUNNING' } },
        orders: { where: { status: { in: ['CREATED', 'RELEASED', 'IN_PROGRESS'] } } }
      }
    });
    
    if (!existingRecipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }
    
    // Check if recipe is in use
    if (existingRecipe.productionRuns.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete recipe with running production runs' },
        { status: 400 }
      );
    }
    
    if (existingRecipe.orders.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete recipe with active orders' },
        { status: 400 }
      );
    }
    
    // Delete recipe materials first
    await db.recipeMaterial.deleteMany({
      where: { recipeId: id }
    });
    
    // Delete the recipe
    await db.recipe.delete({
      where: { id }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'Recipe',
        entityId: id,
        oldValue: existingRecipe,
        details: { message: `Deleted recipe ${existingRecipe.name} ${existingRecipe.version}` }
      }
    });
    
    return NextResponse.json({ success: true, message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return NextResponse.json({ error: 'Failed to delete recipe' }, { status: 500 });
  }
}
