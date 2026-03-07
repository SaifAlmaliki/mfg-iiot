/**
 * UNS Manufacturing Platform - Database Seed
 * Comprehensive seed script with modular, variant data
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client/client'

// Normalize SSL mode to avoid pg-connection-string deprecation warning (prefer/require/verify-ca → verify-full)
let databaseUrl = (process.env.DATABASE_URL ?? '').replace(/sslmode=(prefer|require|verify-ca)/gi, 'sslmode=verify-full')
const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  enterprise: {
    name: 'Acme Manufacturing Corporation',
    code: 'ACME',
    description: 'Global leader in specialty chemicals and advanced materials',
  },
  sites: [
    {
      name: 'Houston Manufacturing Plant',
      code: 'HOUSTON',
      city: 'Houston',
      state: 'Texas',
      country: 'USA',
      timezone: 'America/Chicago',
      siteType: 'MANUFACTURING',
      capacity: 5000,
    },
    {
      name: 'Berlin Production Facility',
      code: 'BERLIN',
      city: 'Berlin',
      state: 'Berlin',
      country: 'Germany',
      timezone: 'Europe/Berlin',
      siteType: 'MANUFACTURING',
      capacity: 3500,
    },
    {
      name: 'Shanghai Operations Center',
      code: 'SHANGHAI',
      city: 'Shanghai',
      state: 'Shanghai',
      country: 'China',
      timezone: 'Asia/Shanghai',
      siteType: 'MIXED_USE',
      capacity: 8000,
    },
  ],
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateCode(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

// ============================================
// SEED FUNCTIONS
// ============================================

async function seedEnterprise() {
  console.log('🏢 Seeding Enterprise...');
  
  const enterprise = await prisma.enterprise.upsert({
    where: { code: CONFIG.enterprise.code },
    update: {},
    create: {
      name: CONFIG.enterprise.name,
      code: CONFIG.enterprise.code,
      description: CONFIG.enterprise.description,
      address: '1000 Corporate Plaza',
      city: 'Wilmington',
      state: 'Delaware',
      country: 'USA',
      postalCode: '19801',
      phone: '+1-302-555-0100',
      email: 'info@acme-mfg.com',
      website: 'https://www.acme-mfg.com',
      industry: 'Chemical Manufacturing',
      registrationNumber: 'US-DE-12345678',
      isActive: true,
      isSetup: true,
    },
  });

  console.log(`   ✓ Enterprise: ${enterprise.name}`);
  return enterprise;
}

async function seedSites(enterpriseId: string) {
  console.log('🏭 Seeding Sites...');
  
  const sites = [];
  
  for (const siteData of CONFIG.sites) {
    const site = await prisma.site.upsert({
      where: { code: siteData.code },
      update: {},
      create: {
        name: siteData.name,
        code: siteData.code,
        description: `${siteData.name} - ${siteData.siteType} facility`,
        siteType: siteData.siteType,
        primaryFunction: 'Chemical Processing',
        address: `${randomInt(100, 999)} Industrial Boulevard`,
        city: siteData.city,
        state: siteData.state,
        country: siteData.country,
        timezone: siteData.timezone,
        capacity: siteData.capacity,
        areaSqm: randomInt(50000, 150000),
        certifications: ['ISO 9001:2015', 'ISO 14001:2018', 'GMP'],
        siteManager: randomElement(['John Smith', 'Maria Garcia', 'Hans Mueller', 'Li Wei']),
        email: `operations@${siteData.code.toLowerCase()}.acme-mfg.com`,
        enterpriseId,
      },
    });
    sites.push(site);
    console.log(`   ✓ Site: ${site.name}`);
  }
  
  return sites;
}

async function seedAreas(sites: { id: string; code: string }[]) {
  console.log('📍 Seeding Areas...');
  
  const areas = [];
  const areaTypes = [
    { type: 'PRODUCTION', prefix: 'PROD', count: 3 },
    { type: 'WAREHOUSE', prefix: 'WH', count: 2 },
    { type: 'QUALITY_LAB', prefix: 'QC', count: 1 },
    { type: 'MAINTENANCE', prefix: 'MAINT', count: 1 },
    { type: 'SHIPPING', prefix: 'SHIP', count: 1 },
    { type: 'UTILITY', prefix: 'UTIL', count: 1 },
  ];

  for (const site of sites) {
    for (const areaConfig of areaTypes) {
      for (let i = 1; i <= areaConfig.count; i++) {
        const code = `${site.code}-${areaConfig.prefix}-${i}`;
        const area = await prisma.area.upsert({
          where: { siteId_code: { siteId: site.id, code } },
          update: {},
          create: {
            name: `${areaConfig.type.charAt(0) + areaConfig.type.slice(1).toLowerCase()} Area ${i}`,
            code,
            description: `${areaConfig.type} area at ${site.code}`,
            areaType: areaConfig.type,
            building: `Building ${String.fromCharCode(64 + i)}`,
            floor: `${randomInt(1, 3)}`,
            zone: `Zone ${String.fromCharCode(64 + randomInt(1, 4))}`,
            floorAreaSqm: randomInt(2000, 10000),
            maxPersonnel: randomInt(10, 50),
            supervisor: randomElement(['Alice Johnson', 'Bob Chen', 'Carol Williams', 'David Kim']),
            temperatureMin: areaConfig.type === 'WAREHOUSE' ? 15 : 20,
            temperatureMax: areaConfig.type === 'WAREHOUSE' ? 25 : 30,
            humidityMin: 40,
            humidityMax: 60,
            safetyRequirements: ['PPE Required', 'Safety Training', 'Emergency Procedures'],
            siteId: site.id,
          },
        });
        areas.push(area);
      }
    }
  }

  console.log(`   ✓ Created ${areas.length} areas`);
  return areas;
}

async function seedWorkCenters(areas: { id: string; code: string }[]) {
  console.log('⚙️ Seeding Work Centers...');
  
  const workCenters = [];
  const workCenterTypes = [
    { type: 'PRODUCTION_LINE', prefix: 'LINE', count: 2 },
    { type: 'BATCH_PROCESS', prefix: 'BATCH', count: 2 },
    { type: 'CONTINUOUS_PROCESS', prefix: 'CONT', count: 1 },
    { type: 'ASSEMBLY_CELL', prefix: 'ASSY', count: 1 },
    { type: 'PACKAGING_LINE', prefix: 'PKG', count: 1 },
  ];

  const productionAreas = areas.filter(a => a.code.includes('PROD'));

  for (const area of productionAreas) {
    for (const wcConfig of workCenterTypes) {
      for (let i = 1; i <= wcConfig.count; i++) {
        const code = `${area.code}-${wcConfig.prefix}-${i}`;
        const workCenter = await prisma.workCenter.upsert({
          where: { areaId_code: { areaId: area.id, code } },
          update: {},
          create: {
            name: `${wcConfig.type.replace(/_/g, ' ')} ${i} - ${area.code}`,
            code,
            description: `${wcConfig.type} work center in ${area.code}`,
            type: wcConfig.type,
            capacity: randomInt(100, 1000),
            capacityUnit: randomElement(['units/h', 'kg/h', 'L/h', 'batches/day']),
            efficiency: randomFloat(80, 98),
            processType: randomElement(['Batch', 'Continuous', 'Discrete']),
            changeoverTime: randomInt(15, 120),
            minBatchSize: randomInt(50, 200),
            maxBatchSize: randomInt(500, 2000),
            personnelRequired: randomInt(2, 8),
            shiftPattern: randomElement(['SINGLE', 'DOUBLE', 'TRIPLE', 'CONTINUOUS']),
            targetOEE: randomFloat(75, 90),
            status: randomElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'UNDER_MAINTENANCE']),
            areaId: area.id,
          },
        });
        workCenters.push(workCenter);
      }
    }
  }

  console.log(`   ✓ Created ${workCenters.length} work centers`);
  return workCenters;
}

async function seedWorkUnits(workCenters: { id: string; code: string }[]) {
  console.log('🔧 Seeding Work Units...');
  
  const workUnits = [];
  const workUnitTypes = [
    { type: 'REACTOR', prefix: 'R', operations: ['HEAT', 'MIX', 'COOL', 'HOLD'] },
    { type: 'MIXER', prefix: 'M', operations: ['MIX', 'BLEND', 'DISPERSE'] },
    { type: 'TANK', prefix: 'T', operations: ['STORE', 'TRANSFER'] },
    { type: 'PUMP', prefix: 'P', operations: ['TRANSFER', 'CIRCULATE'] },
    { type: 'HEAT_EXCHANGER', prefix: 'HE', operations: ['HEAT', 'COOL'] },
    { type: 'CENTRIFUGE', prefix: 'CEN', operations: ['SEPARATE', 'FILTER'] },
    { type: 'DRYER', prefix: 'DRY', operations: ['DRY', 'DEHUMIDIFY'] },
    { type: 'FILTER', prefix: 'FLT', operations: ['FILTER', 'SEPARATE'] },
  ];

  for (const wc of workCenters) {
    const numUnits = randomInt(3, 6);
    for (let i = 1; i <= numUnits; i++) {
      const unitType = workUnitTypes[i % workUnitTypes.length]!;
      const code = `${wc.code}-${unitType.prefix}${i}`;
      
      const workUnit = await prisma.workUnit.upsert({
        where: { workCenterId_code: { workCenterId: wc.id, code } },
        update: {},
        create: {
          name: `${unitType.type} ${unitType.prefix}${i} at ${wc.code}`,
          code,
          description: `${unitType.type} unit for ${wc.code}`,
          type: unitType.type,
          sequenceNumber: i,
          operations: unitType.operations,
          standardCycleTime: randomFloat(30, 180),
          volume: randomFloat(500, 5000),
          volumeUnit: 'L',
          throughput: randomFloat(100, 500),
          throughputUnit: randomElement(['kg/h', 'L/min', 'units/min']),
          minTemperature: randomInt(20, 50),
          maxTemperature: randomInt(150, 250),
          minPressure: randomFloat(0.5, 2),
          maxPressure: randomFloat(5, 15),
          status: randomElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'STANDBY']),
          workCenterId: wc.id,
        },
      });
      workUnits.push(workUnit);
    }
  }

  console.log(`   ✓ Created ${workUnits.length} work units`);
  return workUnits;
}

async function seedEquipment(workCenters: { id: string }[], workUnits: { id: string }[]) {
  console.log('🔩 Seeding Equipment...');
  
  const equipment = [];
  const equipmentTypes = [
    { type: 'PUMP', manufacturers: ['Grundfos', 'KSB', 'Flowserve', 'Sulzer'] },
    { type: 'MOTOR', manufacturers: ['Siemens', 'ABB', 'WEG', 'Nidec'] },
    { type: 'VFD', manufacturers: ['ABB', 'Siemens', 'Danfoss', 'Yaskawa'] },
    { type: 'PLC', manufacturers: ['Siemens', 'Allen-Bradley', 'Mitsubishi', 'Schneider'] },
    { type: 'SENSOR', manufacturers: ['Endress+Hauser', 'Emerson', 'Siemens', 'ABB'] },
    { type: 'VALVE', manufacturers: ['Fisher', 'Samson', 'Flowserve', 'Koso'] },
    { type: 'INSTRUMENT', manufacturers: ['Emerson', 'Yokogawa', 'Honeywell', 'ABB'] },
  ];

  let equipmentIndex = 1;

  for (const wc of workCenters) {
    const numEquipment = randomInt(5, 10);
    for (let i = 0; i < numEquipment; i++) {
      const eqType = randomElement(equipmentTypes);
      const code = `EQ-${String(equipmentIndex++).padStart(4, '0')}`;
      
      const eq = await prisma.equipment.upsert({
        where: { code },
        update: {},
        create: {
          name: `${eqType!.type} ${code}`,
          code,
          type: eqType!.type,
          manufacturer: randomElement(eqType!.manufacturers),
          model: `Model-${randomInt(100, 999)}`,
          serialNumber: `SN-${Date.now()}-${randomInt(1000, 9999)}`,
          firmwareVersion: `v${randomInt(1, 5)}.${randomInt(0, 9)}.${randomInt(0, 9)}`,
          installDate: randomDate(new Date('2018-01-01'), new Date('2024-01-01')),
          description: `${eqType!.type} equipment for production`,
          workCenterId: wc.id,
          workUnitId: randomElement(workUnits).id,
        },
      });
      equipment.push(eq);
    }
  }

  console.log(`   ✓ Created ${equipment.length} equipment`);
  return equipment;
}

async function seedTags(workUnits: { id: string; code: string }[], equipment: { id: string }[]) {
  console.log('📊 Seeding Tags...');
  
  const tags = [];
  const tagTemplates = [
    { name: 'Temperature', suffix: 'temp', dataType: 'FLOAT64', unit: '°C', min: 0, max: 300 },
    { name: 'Pressure', suffix: 'pressure', dataType: 'FLOAT64', unit: 'bar', min: 0, max: 20 },
    { name: 'Level', suffix: 'level', dataType: 'FLOAT64', unit: '%', min: 0, max: 100 },
    { name: 'Flow Rate', suffix: 'flow', dataType: 'FLOAT64', unit: 'L/min', min: 0, max: 1000 },
    { name: 'Speed', suffix: 'speed', dataType: 'FLOAT64', unit: 'RPM', min: 0, max: 3000 },
    { name: 'Current', suffix: 'current', dataType: 'FLOAT64', unit: 'A', min: 0, max: 100 },
    { name: 'Voltage', suffix: 'voltage', dataType: 'FLOAT64', unit: 'V', min: 0, max: 600 },
    { name: 'Power', suffix: 'power', dataType: 'FLOAT64', unit: 'kW', min: 0, max: 500 },
    { name: 'pH', suffix: 'ph', dataType: 'FLOAT64', unit: 'pH', min: 0, max: 14 },
    { name: 'Conductivity', suffix: 'cond', dataType: 'FLOAT64', unit: 'µS/cm', min: 0, max: 10000 },
    { name: 'Running Status', suffix: 'running', dataType: 'BOOL', unit: '', min: 0, max: 1 },
    { name: 'Fault Status', suffix: 'fault', dataType: 'BOOL', unit: '', min: 0, max: 1 },
    { name: 'Mode', suffix: 'mode', dataType: 'INT16', unit: '', min: 0, max: 10 },
    { name: 'Setpoint', suffix: 'setpoint', dataType: 'FLOAT64', unit: '', min: 0, max: 200 },
  ];

  for (const wu of workUnits) {
    // Parse the work unit code to build ISA-95 topic
    // Format: SITE-AREA-WC-WU
    const codeParts = wu.code.split('-');
    const siteCode = codeParts[0] || 'ACME';
    const areaCode = codeParts[1] || 'AREA';
    const wcCode = codeParts[2] || 'WC';
    const unitCode = codeParts[3] || wu.code;

    const numTags = randomInt(5, 10);
    const selectedTags = [...tagTemplates].sort(() => Math.random() - 0.5).slice(0, numTags);

    for (const template of selectedTags) {
      const topic = `${CONFIG.enterprise.code}/${siteCode}/${areaCode}/${wcCode}/${unitCode}/${template.suffix}`;
      
      try {
        const tag = await prisma.tag.upsert({
          where: { mqttTopic: topic },
          update: {},
          create: {
            name: `${template.name} - ${wu.code}`,
            mqttTopic: topic,
            dataType: template.dataType,
            engUnit: template.unit,
            description: `${template.name} measurement for ${wu.code}`,
            scanRate: randomElement([500, 1000, 2000, 5000]),
            minVal: template.min,
            maxVal: template.max,
            deadband: randomFloat(0.1, 2),
            isWritable: template.suffix.includes('setpoint'),
            workUnitId: wu.id,
            equipmentId: randomElement(equipment).id,
            tags: [template.suffix, wu.code, siteCode],
          },
        });
        tags.push(tag);
      } catch (error) {
        // Skip duplicate topics
      }
    }
  }

  console.log(`   ✓ Created ${tags.length} tags`);
  return tags;
}

async function seedAlarms(tags: { id: string; name: string }[]) {
  console.log('⚠️ Seeding Alarm Definitions...');
  
  const alarms = [];
  const alarmTypes = [
    { type: 'HIGH_HIGH', priority: 1 },
    { type: 'HIGH', priority: 2 },
    { type: 'LOW', priority: 3 },
    { type: 'LOW_LOW', priority: 1 },
    { type: 'DEVIATION', priority: 2 },
    { type: 'RATE', priority: 3 },
    { type: 'BOOL_TRUE', priority: 2 },
  ];

  // Select tags that are numeric (not BOOL) for analog alarms
  const numericTags = tags.filter(t => !t.name.includes('Status') && !t.name.includes('Fault'));

  for (const tag of numericTags.slice(0, 50)) { // Limit to 50 alarm definitions
    const alarmType = randomElement(alarmTypes);
    
    try {
      const alarm = await prisma.alarmDefinition.create({
        data: {
          name: `${alarmType!.type} Alarm - ${tag.name}`,
          type: alarmType!.type,
          setpoint: randomFloat(20, 80),
          deadband: randomFloat(1, 5),
          delay: randomInt(0, 10),
          priority: alarmType!.priority,
          message: `${alarmType!.type} condition detected on ${tag.name}`,
          onDelay: randomInt(0, 5),
          offDelay: randomInt(0, 3),
          tagId: tag.id,
        },
      });
      alarms.push(alarm);
    } catch (error) {
      // Skip if already exists
    }
  }

  console.log(`   ✓ Created ${alarms.length} alarm definitions`);
  return alarms;
}

async function seedProducts() {
  console.log('📦 Seeding Products...');
  
  const products = [];
  const productTypes = [
    { type: 'RAW_MATERIAL', products: [
      { name: 'Chemical Alpha', code: 'RAW-ALPHA', unit: 'kg' },
      { name: 'Chemical Beta', code: 'RAW-BETA', unit: 'kg' },
      { name: 'Solvent Gamma', code: 'RAW-GAMMA', unit: 'L' },
      { name: 'Catalyst Delta', code: 'RAW-DELTA', unit: 'kg' },
      { name: 'Additive Epsilon', code: 'RAW-EPS', unit: 'kg' },
    ]},
    { type: 'INTERMEDIATE', products: [
      { name: 'Intermediate Mix A', code: 'INT-MIX-A', unit: 'kg' },
      { name: 'Intermediate Mix B', code: 'INT-MIX-B', unit: 'kg' },
      { name: 'Pre-Compound C', code: 'INT-COMP-C', unit: 'kg' },
    ]},
    { type: 'FINISHED_GOOD', products: [
      { name: 'Product Gamma Premium', code: 'PROD-GAMMA-PRE', unit: 'kg' },
      { name: 'Product Gamma Standard', code: 'PROD-GAMMA-STD', unit: 'kg' },
      { name: 'Product Delta Pro', code: 'PROD-DELTA-PRO', unit: 'kg' },
      { name: 'Product Epsilon Basic', code: 'PROD-EPS-BAS', unit: 'kg' },
    ]},
    { type: 'CONSUMABLE', products: [
      { name: 'Cleaning Solution A', code: 'CONS-CLEAN-A', unit: 'L' },
      { name: 'Packaging Material', code: 'CONS-PKG', unit: 'units' },
    ]},
  ];

  for (const category of productTypes) {
    for (const prod of category.products) {
      const product = await prisma.productDefinition.upsert({
        where: { code: prod.code },
        update: {},
        create: {
          name: prod.name,
          code: prod.code,
          description: `${category.type.replace(/_/g, ' ')} - ${prod.name}`,
          productType: category.type,
          unit: prod.unit,
        },
      });
      products.push(product);
    }
  }

  console.log(`   ✓ Created ${products.length} products`);
  return products;
}

async function seedRecipes(products: { id: string; productType: string }[]) {
  console.log('📋 Seeding Recipes...');
  
  const recipes = [];
  const finishedGoods = products.filter(p => p.productType === 'FINISHED_GOOD');
  const intermediates = products.filter(p => p.productType === 'INTERMEDIATE');
  const rawMaterials = products.filter(p => p.productType === 'RAW_MATERIAL');

  const recipeTemplates = [
    {
      name: 'Gamma Premium Production',
      version: '3.2',
      parameters: { temperature: 95, pressure: 4.5, reactionTime: 150, agitationSpeed: 850 },
      steps: [
        { step: 1, name: 'Pre-Check', duration: 10, description: 'Verify equipment readiness' },
        { step: 2, name: 'Charge Materials', duration: 20, description: 'Load raw materials' },
        { step: 3, name: 'Initial Heat', duration: 25, description: 'Heat to reaction temperature' },
        { step: 4, name: 'Primary Reaction', duration: 60, description: 'Main reaction phase' },
        { step: 5, name: 'Secondary Reaction', duration: 45, description: 'Secondary processing' },
        { step: 6, name: 'Quality Check', duration: 15, description: 'In-process quality verification' },
        { step: 7, name: 'Cooling', duration: 30, description: 'Cool to discharge temperature' },
        { step: 8, name: 'Discharge', duration: 20, description: 'Transfer to storage' },
      ],
    },
    {
      name: 'Gamma Standard Production',
      version: '2.5',
      parameters: { temperature: 85, pressure: 3.5, reactionTime: 120, agitationSpeed: 750 },
      steps: [
        { step: 1, name: 'Setup', duration: 10, description: 'Equipment setup' },
        { step: 2, name: 'Material Loading', duration: 15, description: 'Load materials' },
        { step: 3, name: 'Reaction', duration: 90, description: 'Main reaction' },
        { step: 4, name: 'Cooling', duration: 25, description: 'Cool down' },
        { step: 5, name: 'Discharge', duration: 15, description: 'Transfer product' },
      ],
    },
  ];

  let recipeIndex = 0;
  for (const template of recipeTemplates) {
    const product = finishedGoods[recipeIndex % finishedGoods.length];
    
    const recipe = await prisma.recipe.upsert({
      where: { name_version: { name: template.name, version: template.version } },
      update: {},
      create: {
        name: template.name,
        version: template.version,
        description: `Production recipe for ${template.name}`,
        productCode: product?.code || 'UNKNOWN',
        status: 'ACTIVE',
        recipeType: 'PRODUCTION',
        parameters: template.parameters,
        steps: template.steps,
        equipmentRequirements: {
          reactor: 'R-101',
          mixer: 'M-101',
          pump: 'P-101',
        },
        materials: {
          rawMaterials: rawMaterials.slice(0, 3).map(r => ({
            code: r.code,
            quantity: randomInt(100, 500),
            unit: 'kg',
          })),
        },
        productId: product?.id,
        createdBy: 'admin@acme-mfg.com',
        approvedBy: 'engineer@acme-mfg.com',
        approvedAt: new Date(),
      },
    });
    recipes.push(recipe);

    // Create recipe materials
    for (const raw of rawMaterials.slice(0, 3)) {
      await prisma.recipeMaterial.upsert({
        where: { recipeId_materialId: { recipeId: recipe.id, materialId: raw.id } },
        update: {},
        create: {
          recipeId: recipe.id,
          materialId: raw.id,
          quantity: randomInt(100, 500),
          unit: 'kg',
          phase: randomElement(['Charge', 'Reaction', 'Finishing']),
          stepIndex: randomInt(0, 3),
        },
      });
    }

    recipeIndex++;
  }

  console.log(`   ✓ Created ${recipes.length} recipes`);
  return recipes;
}

async function seedProductionOrders(
  recipes: { id: string; name: string }[],
  workCenters: { id: string; code: string }[]
) {
  console.log('📝 Seeding Production Orders...');
  
  const orders = [];
  const statuses = ['CREATED', 'RELEASED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED'];
  const now = new Date();

  for (let i = 1; i <= 20; i++) {
    const status = randomElement(statuses);
    const recipe = randomElement(recipes);
    const workCenter = randomElement(workCenters);
    const orderNumber = `PO-${now.getFullYear()}-${String(i).padStart(4, '0')}`;
    
    const plannedStart = randomDate(now, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
    const plannedEnd = new Date(plannedStart.getTime() + randomInt(4, 24) * 60 * 60 * 1000);
    
    const order = await prisma.productionOrder.upsert({
      where: { orderNumber },
      update: {},
      create: {
        orderNumber,
        externalId: `ERP-${randomInt(10000, 99999)}`,
        status,
        quantity: randomInt(500, 2000),
        producedQty: status === 'COMPLETED' ? randomInt(500, 2000) : randomInt(0, 500),
        scrapQty: status === 'COMPLETED' ? randomInt(0, 50) : 0,
        plannedStart,
        plannedEnd,
        actualStart: ['IN_PROGRESS', 'COMPLETED'].includes(status) ? plannedStart : null,
        actualEnd: status === 'COMPLETED' ? plannedEnd : null,
        priority: randomInt(1, 5),
        notes: `Production order for ${recipe?.name || 'product'}`,
        workCenterId: workCenter?.id,
        recipeId: recipe?.id,
      },
    });
    orders.push(order);
  }

  console.log(`   ✓ Created ${orders.length} production orders`);
  return orders;
}

async function seedProductionRuns(
  orders: { id: string; orderNumber: string; status: string }[],
  workCenters: { id: string }[]
) {
  console.log('🏃 Seeding Production Runs...');
  
  const runs = [];
  const activeOrders = orders.filter(o => ['IN_PROGRESS', 'COMPLETED'].includes(o.status));

  for (const order of activeOrders) {
    const runNumber = `${order.orderNumber.replace('PO-', 'RUN-')}-001`;
    const isRunning = order.status === 'IN_PROGRESS';
    
    const run = await prisma.productionRun.upsert({
      where: { runNumber },
      update: {},
      create: {
        runNumber,
        status: isRunning ? 'RUNNING' : 'COMPLETE',
        state: isRunning ? 'RUNNING' : 'COMPLETE',
        phase: isRunning ? randomElement(['Reaction', 'Cooling', 'Discharge']) : 'Complete',
        step: isRunning ? String(randomInt(3, 6)) : '8',
        quantity: randomInt(200, 800),
        progress: isRunning ? randomFloat(30, 80) : 100,
        parameters: {
          batchId: `BATCH-${randomInt(1000, 9999)}`,
          operator: randomElement(['John Doe', 'Jane Smith', 'Bob Wilson']),
        },
        startedAt: randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()),
        endedAt: isRunning ? null : new Date(),
        workCenterId: randomElement(workCenters).id,
        orderId: order.id,
        recipeId: null,
      },
    });
    runs.push(run);
  }

  console.log(`   ✓ Created ${runs.length} production runs`);
  return runs;
}

async function seedMaterialLots(products: { id: string; productType: string }[]) {
  console.log('📦 Seeding Material Lots...');
  
  const lots = [];
  const statuses = ['AVAILABLE', 'RESERVED', 'IN_USE', 'CONSUMED', 'QUARANTINE'];
  const suppliers = ['ChemSupply Inc', 'GlobalChem Ltd', 'MaterialCorp', 'Industrial Partners'];

  for (let i = 1; i <= 30; i++) {
    const product = randomElement(products);
    const status = randomElement(statuses);
    const quantity = randomFloat(100, 2000);
    
    const lot = await prisma.materialLot.upsert({
      where: { lotNumber: `LOT-${String(i).padStart(5, '0')}` },
      update: {},
      create: {
        lotNumber: `LOT-${String(i).padStart(5, '0')}`,
        externalLot: `SUPP-${randomInt(10000, 99999)}`,
        quantity,
        remainingQty: status === 'CONSUMED' ? 0 : randomFloat(0, quantity),
        status,
        expiryDate: new Date(Date.now() + randomInt(30, 365) * 24 * 60 * 60 * 1000),
        receivedDate: randomDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date()),
        supplierName: randomElement(suppliers),
        supplierCode: `SUPP-${randomInt(10, 99)}`,
        location: `Warehouse ${randomElement(['A', 'B', 'C'])}-${randomInt(1, 20)}`,
        productId: product.id,
      },
    });
    lots.push(lot);
  }

  console.log(`   ✓ Created ${lots.length} material lots`);
  return lots;
}

async function seedCustomers() {
  console.log('👥 Seeding Customers...');
  
  const customers = [];
  const customerData = [
    { name: 'Global Chemicals Inc', code: 'GCI', city: 'Chicago', country: 'USA' },
    { name: 'EuroChem GmbH', code: 'EURO', city: 'Frankfurt', country: 'Germany' },
    { name: 'Asia Pacific Trading', code: 'APT', city: 'Singapore', country: 'Singapore' },
    { name: 'Industrial Solutions Ltd', code: 'ISL', city: 'London', country: 'UK' },
    { name: 'American Manufacturing Co', code: 'AMC', city: 'Detroit', country: 'USA' },
  ];

  for (const data of customerData) {
    const customer = await prisma.customer.upsert({
      where: { code: data.code },
      update: {},
      create: {
        name: data.name,
        code: data.code,
        contactName: `Contact - ${data.name}`,
        contactEmail: `sales@${data.code.toLowerCase()}.com`,
        contactPhone: `+1-555-${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
        address: `${randomInt(100, 999)} Business Ave`,
      },
    });
    customers.push(customer);
  }

  console.log(`   ✓ Created ${customers.length} customers`);
  return customers;
}

async function seedShipments(
  customers: { id: string }[],
  lots: { id: string }[]
) {
  console.log('🚚 Seeding Shipments...');
  
  const shipments = [];
  const statuses = ['PENDING', 'PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED'];

  for (let i = 1; i <= 15; i++) {
    const shipmentNumber = `SHP-${new Date().getFullYear()}-${String(i).padStart(4, '0')}`;
    const status = randomElement(statuses);
    
    const shipment = await prisma.shipment.upsert({
      where: { shipmentNumber },
      update: {},
      create: {
        shipmentNumber,
        status,
        shippedAt: ['SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(status) ? new Date() : null,
        deliveredAt: status === 'DELIVERED' ? new Date() : null,
        customerId: randomElement(customers).id,
      },
    });
    shipments.push(shipment);

    // Add lots to shipment
    const numLots = randomInt(1, 3);
    for (let j = 0; j < numLots; j++) {
      try {
        await prisma.shipmentLot.create({
          data: {
            shipmentId: shipment.id,
            lotId: randomElement(lots).id,
            quantity: randomFloat(50, 200),
          },
        });
      } catch (error) {
        // Skip duplicates
      }
    }
  }

  console.log(`   ✓ Created ${shipments.length} shipments`);
  return shipments;
}

async function seedUsers(sites: { id: string }[]) {
  console.log('👤 Seeding Users & Roles...');
  
  // Known password for seeded admin (demo only): "admin123"
  const bcrypt = await import('bcrypt');
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  // Create roles
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: {
        name: 'Administrator',
        code: 'ADMIN',
        permissions: ['*'],
        description: 'Full system access',
        isSystem: true,
      },
    }),
    prisma.role.upsert({
      where: { code: 'ENGINEER' },
      update: {},
      create: {
        name: 'Process Engineer',
        code: 'ENGINEER',
        permissions: ['dashboard.view', 'scada.view', 'scada.control', 'scada.edit', 'mes.view', 'mes.edit', 'recipes.view', 'recipes.edit', 'tags.view', 'tags.edit'],
        description: 'Engineering configuration and control',
      },
    }),
    prisma.role.upsert({
      where: { code: 'OPERATOR' },
      update: {},
      create: {
        name: 'Operator',
        code: 'OPERATOR',
        permissions: ['dashboard.view', 'scada.view', 'mes.view', 'batches.view', 'batches.control'],
        description: 'Production operations',
      },
    }),
    prisma.role.upsert({
      where: { code: 'VIEWER' },
      update: {},
      create: {
        name: 'Viewer',
        code: 'VIEWER',
        permissions: ['dashboard.view', 'scada.view', 'mes.view'],
        description: 'Read-only access',
      },
    }),
  ]);

  // Create users
  const userData = [
    { email: 'admin@acme-mfg.com', name: 'System Administrator', roleCode: 'ADMIN' },
    { email: 'engineer1@acme-mfg.com', name: 'John Engineer', roleCode: 'ENGINEER' },
    { email: 'engineer2@acme-mfg.com', name: 'Sarah Chen', roleCode: 'ENGINEER' },
    { email: 'operator1@acme-mfg.com', name: 'Mike Wilson', roleCode: 'OPERATOR' },
    { email: 'operator2@acme-mfg.com', name: 'Lisa Park', roleCode: 'OPERATOR' },
    { email: 'operator3@acme-mfg.com', name: 'David Kim', roleCode: 'OPERATOR' },
    { email: 'viewer@acme-mfg.com', name: 'Guest User', roleCode: 'VIEWER' },
  ];

  const users = [];
  for (const data of userData) {
    const isAdmin = data.roleCode === 'ADMIN';
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: isAdmin ? { passwordHash: adminPasswordHash } : {},
      create: {
        email: data.email,
        name: data.name,
        passwordHash: isAdmin ? adminPasswordHash : '$2b$10$demo.hash.not.for.production.use.only',
        siteId: randomElement(sites).id,
      },
    });
    users.push(user);

    // Assign role
    const role = roles.find(r => r.code === data.roleCode);
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }
  }

  console.log(`   ✓ Created ${users.length} users with ${roles.length} roles`);
  console.log('   ✓ Admin login (demo): admin@acme-mfg.com / admin123');
  return { users, roles };
}

async function seedEdgeConnectors(sites: { id: string }[]) {
  console.log('🔌 Seeding Edge Connectors...');
  
  const connectors = [];
  const connectorTypes = [
    { type: 'OPC_UA', protocol: 'OPC_UA', prefix: 'OPCUA' },
    { type: 'MODBUS_TCP', protocol: 'MODBUS_TCP', prefix: 'MODBUS' },
    { type: 'S7', protocol: 'S7', prefix: 'S7' },
    { type: 'MQTT', protocol: 'MQTT', prefix: 'MQTT' },
  ];

  for (const site of sites) {
    for (const connType of connectorTypes) {
      const code = `${site.code.substring(0, 2)}-${connType.prefix}-01`;
      
      const connector = await prisma.edgeConnector.upsert({
        where: { code },
        update: {},
        create: {
          name: `${connType.type} Gateway - ${site.code}`,
          code,
          type: connType.type,
          protocol: connType.protocol,
          endpoint: connType.type === 'OPC_UA' 
            ? 'opc.tcp://192.168.1.100:4840'
            : connType.type === 'MODBUS_TCP'
            ? 'tcp://192.168.1.101:502'
            : connType.type === 'S7'
            ? 'tcp://192.168.1.10:102'
            : 'mqtt://localhost:1883',
          config: {
            securityMode: 'None',
            keepAliveInterval: 5000,
          },
          status: randomElement(['ONLINE', 'ONLINE', 'ONLINE', 'OFFLINE']),
          lastSeen: new Date(Date.now() - randomInt(0, 3600) * 1000),
          version: `${randomInt(1, 3)}.${randomInt(0, 9)}.${randomInt(0, 9)}`,
          heartbeatRate: 30,
          siteId: site.id,
        },
      });
      connectors.push(connector);
    }
  }

  console.log(`   ✓ Created ${connectors.length} edge connectors`);
  return connectors;
}

async function seedAssetHealth(equipment: { id: string }[]) {
  console.log('💚 Seeding Asset Health Records...');
  
  let count = 0;
  for (const eq of equipment.slice(0, 30)) {
    await prisma.assetHealth.create({
      data: {
        healthScore: randomFloat(60, 100),
        status: randomElement(['NORMAL', 'NORMAL', 'NORMAL', 'WARNING', 'CRITICAL']),
        metrics: {
          vibration: { rms: randomFloat(1, 5), peak: randomFloat(3, 10), unit: 'mm/s' },
          temperature: { bearing: randomInt(40, 80), winding: randomInt(50, 100), unit: '°C' },
          current: { average: randomFloat(10, 40), peak: randomFloat(15, 50), unit: 'A' },
        },
        anomalies: [],
        predictions: {
          nextMaintenance: new Date(Date.now() + randomInt(7, 90) * 24 * 60 * 60 * 1000).toISOString(),
          remainingLife: randomInt(30, 365),
          confidence: randomFloat(0.7, 0.98),
        },
        recommendations: ['Monitor vibration levels', 'Schedule inspection'],
        equipmentId: eq.id,
      },
    });
    count++;
  }

  console.log(`   ✓ Created ${count} asset health records`);
}

async function seedMaintenanceLogs(equipment: { id: string }[]) {
  console.log('🔧 Seeding Maintenance Logs...');
  
  const types = ['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY'];
  let count = 0;

  for (const eq of equipment.slice(0, 20)) {
    const numLogs = randomInt(1, 3);
    for (let i = 0; i < numLogs; i++) {
      await prisma.maintenanceLog.create({
        data: {
          type: randomElement(types),
          workOrder: `WO-${new Date().getFullYear()}-${String(randomInt(1, 999)).padStart(4, '0')}`,
          description: `${randomElement(['Bearing inspection', 'Motor overhaul', 'Calibration', 'Filter replacement', 'General maintenance'])}`,
          performedBy: randomElement(['John Tech', 'Mike Mechanic', 'Sarah Service']),
          performedAt: randomDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date()),
          nextDueDate: new Date(Date.now() + randomInt(30, 180) * 24 * 60 * 60 * 1000),
          cost: randomFloat(100, 2000),
          laborHours: randomFloat(1, 8),
          downtimeHours: randomFloat(0.5, 4),
          parts: [{ name: 'Replacement Part', quantity: randomInt(1, 3), unit: 'pcs' }],
          equipmentId: eq.id,
        },
      });
      count++;
    }
  }

  console.log(`   ✓ Created ${count} maintenance logs`);
}

async function seedOEERecords(workCenters: { id: string }[]) {
  console.log('📈 Seeding OEE Records...');
  
  let count = 0;
  for (const wc of workCenters) {
    // Create records for last 7 days
    for (let i = 0; i < 7; i++) {
      const availability = randomFloat(85, 98);
      const performance = randomFloat(80, 95);
      const quality = randomFloat(95, 99.9);
      const oee = (availability * performance * quality) / 10000;

      await prisma.oEERecord.create({
        data: {
          availability,
          performance,
          quality,
          oee,
          runTime: randomInt(400, 480),
          plannedTime: 480,
          downtime: randomInt(10, 80),
          downtimeReasons: [
            { reason: 'Equipment Failure', duration: randomInt(5, 30) },
            { reason: 'Material Shortage', duration: randomInt(5, 20) },
          ],
          goodUnits: randomInt(400, 500),
          totalUnits: randomInt(420, 520),
          scrapUnits: randomInt(5, 20),
          idealCycleTime: randomFloat(0.8, 1.5),
          workCenterId: wc.id,
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        },
      });
      count++;
    }
  }

  console.log(`   ✓ Created ${count} OEE records`);
}

// Predefined HMI symbols with data-binding convention: data-binding="value" for displayed value, data-binding="fill" for state/color
const PREDEFINED_SYMBOLS = [
  {
    name: 'Pump',
    category: 'pump',
    svg: `<g data-symbol="pump"><ellipse cx="50" cy="30" rx="25" ry="12" fill="none" stroke="currentColor" stroke-width="2" data-binding="fill"/>
<path d="M25 30 L75 30 M50 30 L50 55 M35 55 L65 55" stroke="currentColor" stroke-width="2" fill="none"/>
<text x="50" y="75" text-anchor="middle" font-size="12" data-binding="value">--</text></g>`,
  },
  {
    name: 'Valve',
    category: 'valve',
    svg: `<g data-symbol="valve"><circle cx="50" cy="35" r="20" fill="none" stroke="currentColor" stroke-width="2" data-binding="fill"/>
<path d="M50 15 L50 55 M30 35 L70 35" stroke="currentColor" stroke-width="2"/>
<text x="50" y="80" text-anchor="middle" font-size="12" data-binding="value">--</text></g>`,
  },
  {
    name: 'Tank',
    category: 'tank',
    svg: `<g data-symbol="tank"><rect x="20" y="10" width="60" height="70" rx="4" fill="none" stroke="currentColor" stroke-width="2" data-binding="fill"/>
<rect x="24" y="14" width="52" height="62" rx="2" fill="currentColor" opacity="0.2" data-binding="fill"/>
<text x="50" y="95" text-anchor="middle" font-size="12" data-binding="value">--</text></g>`,
  },
  {
    name: 'Pipe',
    category: 'pipe',
    svg: `<g data-symbol="pipe"><rect x="10" y="40" width="80" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="2" data-binding="fill"/>
<text x="50" y="95" text-anchor="middle" font-size="12" data-binding="value">--</text></g>`,
  },
  {
    name: 'Motor',
    category: 'motor',
    svg: `<g data-symbol="motor"><circle cx="50" cy="45" r="30" fill="none" stroke="currentColor" stroke-width="2" data-binding="fill"/>
<circle cx="50" cy="45" r="8" fill="currentColor"/>
<text x="50" y="95" text-anchor="middle" font-size="12" data-binding="value">--</text></g>`,
  },
];

async function seedHmiSymbols() {
  console.log('🎨 Seeding HMI symbols (predefined)...');
  await prisma.hmiSymbol.deleteMany({ where: { isPredefined: true } });
  for (const s of PREDEFINED_SYMBOLS) {
    await prisma.hmiSymbol.create({
      data: {
        name: s.name,
        category: s.category,
        svg: s.svg,
        isPredefined: true,
      },
    });
  }
  console.log(`   ✓ Created ${PREDEFINED_SYMBOLS.length} predefined symbols (binding: data-binding="value", data-binding="fill")`);
}

async function seedHmiGraphics() {
  console.log('🖼️ Seeding HMI graphics (default)...');
  const existing = await prisma.hmiGraphic.findFirst({ where: { name: 'Process Overview' } });
  if (existing) {
    console.log('   ✓ Process Overview already exists');
    return;
  }
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('   ⚠ Skipping HMI graphic: no user found');
    return;
  }
  const tagRows = await prisma.tag.findMany({ take: 4, select: { id: true } });
  const tagIds = tagRows.map((t) => t.id);
  if (tagIds.length === 0) {
    console.log('   ⚠ Skipping HMI graphic: no tags found');
    return;
  }
  const symbols = await prisma.hmiSymbol.findMany({
    where: { isPredefined: true },
    take: 4,
    select: { id: true },
    orderBy: { name: 'asc' },
  });
  if (symbols.length === 0) {
    console.log('   ⚠ Skipping HMI graphic: no symbols found');
    return;
  }
  const graphic = await prisma.hmiGraphic.create({
    data: {
      name: 'Process Overview',
      description: 'Default process graphic',
      width: 800,
      height: 600,
      createdById: user.id,
      elements: {
        create: symbols.map((sym, i) => ({
          symbolId: sym.id,
          x: 80 + i * 180,
          y: 120,
          width: 100,
          height: 100,
          rotation: 0,
          zIndex: i,
          props: {
            bindings: [{ tagId: tagIds[i % tagIds.length], property: 'value' }],
          },
        })),
      },
    },
  });
  console.log(`   ✓ Created HMI graphic "${graphic.name}" with ${symbols.length} elements`);
}

async function seedSystemConfig() {
  console.log('⚙️ Seeding System Configuration...');
  
  const configs = [
    { key: 'mqtt.broker.url', value: 'mqtt://emqx:1883', description: 'MQTT broker URL', category: 'mqtt' },
    { key: 'mqtt.client.id', value: 'uns-platform-app', description: 'MQTT client ID', category: 'mqtt' },
    { key: 'mqtt.broker.ws', value: 'ws://localhost:8083/mqtt', description: 'MQTT WebSocket URL', category: 'mqtt' },
    { key: 'influxdb.url', value: 'http://influxdb:8086', description: 'InfluxDB URL', category: 'influxdb' },
    { key: 'influxdb.token', value: 'uns-platform-super-secret-token', description: 'InfluxDB token', category: 'influxdb' },
    { key: 'influxdb.org', value: 'uns-platform', description: 'InfluxDB organization', category: 'influxdb' },
    { key: 'influxdb.bucket', value: 'manufacturing', description: 'InfluxDB bucket', category: 'influxdb' },
    { key: 'platform.name', value: 'UNS Manufacturing Platform', description: 'Platform name', category: 'general' },
    { key: 'platform.version', value: '1.0.0', description: 'Platform version', category: 'general' },
    { key: 'retention.raw.days', value: '30', description: 'Raw data retention days', category: 'retention' },
    { key: 'retention.archive.days', value: '365', description: 'Archive retention days', category: 'retention' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }

  console.log(`   ✓ Created ${configs.length} system configurations`);
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log('\n========================================');
  console.log('🌱 UNS Platform Database Seeding');
  console.log('========================================\n');

  try {
    // Core hierarchy
    const enterprise = await seedEnterprise();
    const sites = await seedSites(enterprise.id);
    const areas = await seedAreas(sites);
    const workCenters = await seedWorkCenters(areas);
    const workUnits = await seedWorkUnits(workCenters);

    // Equipment & Tags
    const equipment = await seedEquipment(workCenters, workUnits);
    const tags = await seedTags(workUnits, equipment);
    await seedAlarms(tags);

    // Products & Recipes
    const products = await seedProducts();
    const recipes = await seedRecipes(products);

    // Production
    const orders = await seedProductionOrders(recipes, workCenters);
    await seedProductionRuns(orders, workCenters);

    // Materials & Traceability
    const lots = await seedMaterialLots(products);
    const customers = await seedCustomers();
    await seedShipments(customers, lots);

    // Users & Security
    await seedUsers(sites);

    // Edge & Monitoring
    await seedEdgeConnectors(sites);
    await seedAssetHealth(equipment);
    await seedMaintenanceLogs(equipment);
    await seedOEERecords(workCenters);

    // HMI graphics (predefined symbols + default graphic)
    await seedHmiSymbols();
    await seedHmiGraphics();

    // System
    await seedSystemConfig();

    console.log('\n========================================');
    console.log('✅ Database Seeding Complete!');
    console.log('========================================\n');
    console.log('Summary:');
    console.log(`  - Enterprise: 1`);
    console.log(`  - Sites: ${sites.length}`);
    console.log(`  - Areas: ${areas.length}`);
    console.log(`  - Work Centers: ${workCenters.length}`);
    console.log(`  - Work Units: ${workUnits.length}`);
    console.log(`  - Equipment: ${equipment.length}`);
    console.log(`  - Tags: ${tags.length}`);
    console.log(`  - Products: ${products.length}`);
    console.log(`  - Recipes: ${recipes.length}`);
    console.log(`  - Orders: ${orders.length}`);
    console.log(`\nAccess the platform at: http://localhost:3000\n`);

  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
