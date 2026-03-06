import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/products - List all product definitions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productType = searchParams.get('productType');
    
    const products = await db.productDefinition.findMany({
      where: {
        isActive: true,
        ...(productType && { productType })
      },
      include: {
        _count: {
          select: { 
            materialLots: true, 
            recipes: true 
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST /api/products - Create a new product definition
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, description, productType, unit } = body;
    
    // Validate required fields
    if (!name || !code || !productType) {
      return NextResponse.json(
        { error: 'Name, code, and product type are required' },
        { status: 400 }
      );
    }
    
    // Check for duplicate code
    const existing = await db.productDefinition.findUnique({
      where: { code }
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'Product code already exists' },
        { status: 400 }
      );
    }
    
    const product = await db.productDefinition.create({
      data: {
        name,
        code,
        description: description || null,
        productType,
        unit: unit || null
      }
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'ProductDefinition',
        entityId: product.id,
        newValue: product,
        details: { message: `Created product ${name} (${code})` }
      }
    });
    
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
