import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/recipes - List all recipes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const productId = searchParams.get('productId');
    
    const recipes = await db.recipe.findMany({
      where: {
        ...(status && { status }),
        ...(productId && { productId })
      },
      include: {
        product: {
          select: { id: true, name: true, code: true, productType: true }
        },
        recipeMaterials: {
          include: {
            material: {
              select: { id: true, name: true, code: true, unit: true }
            }
          }
        },
        _count: {
          select: { productionRuns: true, orders: true }
        }
      },
      orderBy: [
        { name: 'asc' },
        { version: 'desc' }
      ]
    });
    
    return NextResponse.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  }
}

// POST /api/recipes - Create a new recipe
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      version, 
      description, 
      productId,
      productCode,
      status,
      parameters, 
      steps,
      equipmentRequirements,
      materials 
    } = body;
    
    // Validate required fields
    if (!name || !version) {
      return NextResponse.json(
        { error: 'Recipe name and version are required' },
        { status: 400 }
      );
    }
    
    // Check for duplicate name+version
    const existingRecipe = await db.recipe.findFirst({
      where: { name, version }
    });
    
    if (existingRecipe) {
      return NextResponse.json(
        { error: 'Recipe with this name and version already exists' },
        { status: 400 }
      );
    }
    
    const recipe = await db.recipe.create({
      data: {
        name,
        version,
        description: description || null,
        productId: productId || null,
        productCode: productCode || null,
        status: status || 'DRAFT',
        recipeType: 'PRODUCTION',
        parameters: parameters || {},
        steps: steps || [],
        equipmentRequirements: equipmentRequirements || null,
        materials: materials || null,
        createdBy: 'system' // TODO: Get from auth context
      },
      include: {
        product: true
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'Recipe',
        entityId: recipe.id,
        newValue: recipe,
        details: { message: `Created recipe ${name} ${version}` }
      }
    });
    
    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return NextResponse.json({ error: 'Failed to create recipe' }, { status: 500 });
  }
}
