/**
 * Data Enrichment Service
 * 
 * Enriches telemetry data with full ISA-95 context before storage:
 * - Equipment information (name, type, manufacturer, model)
 * - WorkUnit/WorkCenter/Area/Site hierarchy
 * - Production context (active orders, runs, recipes)
 * - Material and batch information
 */

import { db } from './db';

export interface EnrichmentContext {
  enterprise: string;
  site: string;
  area: string;
  workCenter: string;
  workUnit: string;
  attribute: string;
}

export interface EnrichedTelemetry {
  measurement: string;
  tags: {
    enterprise: string;
    site: string;
    siteCode: string;
    area: string;
    areaCode: string;
    workCenter: string;
    workCenterCode: string;
    workUnit: string;
    workUnitCode: string;
    equipmentId?: string;
    equipmentCode?: string;
    equipmentName?: string;
    equipmentType?: string;
    equipmentManufacturer?: string;
    equipmentModel?: string;
    tagId?: string;
    tagName?: string;
    tagDataType?: string;
    productionOrderId?: string;
    productionOrderNumber?: string;
    productionOrderStatus?: string;
    productId?: string;
    productCode?: string;
    productName?: string;
    recipeId?: string;
    recipeName?: string;
    recipeVersion?: string;
    productionRunId?: string;
    runNumber?: string;
    runStatus?: string;
    runPhase?: string;
    batchId?: string;
  };
  fields: {
    value: number | boolean | string;
    quality: string;
    rawValue?: string;
  };
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface TagEnrichmentInfo {
  tagId: string;
  tagName: string;
  tagDataType: string;
  tagEngUnit?: string;
  equipmentId?: string;
  equipmentCode?: string;
  equipmentName?: string;
  equipmentType?: string;
  equipmentManufacturer?: string;
  equipmentModel?: string;
  workUnitId?: string;
  workUnitCode?: string;
  workUnitName?: string;
  workCenterId?: string;
  workCenterCode?: string;
  workCenterName?: string;
  areaId?: string;
  areaCode?: string;
  areaName?: string;
  siteId?: string;
  siteCode?: string;
  siteName?: string;
  enterpriseId?: string;
  enterpriseCode?: string;
  enterpriseName?: string;
}

export interface ProductionContext {
  orderId?: string;
  orderNumber?: string;
  orderStatus?: string;
  productId?: string;
  productCode?: string;
  productName?: string;
  recipeId?: string;
  recipeName?: string;
  recipeVersion?: string;
  runId?: string;
  runNumber?: string;
  runStatus?: string;
  runPhase?: string;
  batchId?: string;
}

class DataEnrichmentService {
  private tagCache = new Map<string, TagEnrichmentInfo>();
  private productionCache = new Map<string, ProductionContext>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL_MS = 60000;

  async enrichTelemetry(
    topic: string,
    value: unknown,
    quality: string,
    timestamp: Date,
    context: EnrichmentContext
  ): Promise<EnrichedTelemetry> {
    const tagInfo = await this.getTagInfo(topic);
    const productionContext = await this.getProductionContext(context.workCenter, context.workUnit);

    const tags: EnrichedTelemetry['tags'] = {
      enterprise: context.enterprise,
      site: tagInfo?.siteName || context.site,
      siteCode: tagInfo?.siteCode || context.site,
      area: tagInfo?.areaName || context.area,
      areaCode: tagInfo?.areaCode || context.area,
      workCenter: tagInfo?.workCenterName || context.workCenter,
      workCenterCode: tagInfo?.workCenterCode || context.workCenter,
      workUnit: tagInfo?.workUnitName || context.workUnit,
      workUnitCode: tagInfo?.workUnitCode || context.workUnit,
    };

    if (tagInfo) {
      tags.tagId = tagInfo.tagId;
      tags.tagName = tagInfo.tagName;
      tags.tagDataType = tagInfo.tagDataType;

      if (tagInfo.equipmentId) {
        tags.equipmentId = tagInfo.equipmentId;
        tags.equipmentCode = tagInfo.equipmentCode;
        tags.equipmentName = tagInfo.equipmentName;
        tags.equipmentType = tagInfo.equipmentType;
        tags.equipmentManufacturer = tagInfo.equipmentManufacturer;
        tags.equipmentModel = tagInfo.equipmentModel;
      }
    }

    if (productionContext) {
      tags.productionOrderId = productionContext.orderId;
      tags.productionOrderNumber = productionContext.orderNumber;
      tags.productionOrderStatus = productionContext.orderStatus;
      tags.productId = productionContext.productId;
      tags.productCode = productionContext.productCode;
      tags.productName = productionContext.productName;
      tags.recipeId = productionContext.recipeId;
      tags.recipeName = productionContext.recipeName;
      tags.recipeVersion = productionContext.recipeVersion;
      tags.productionRunId = productionContext.runId;
      tags.runNumber = productionContext.runNumber;
      tags.runStatus = productionContext.runStatus;
      tags.runPhase = productionContext.runPhase;
      tags.batchId = productionContext.batchId;
    }

    const fields: EnrichedTelemetry['fields'] = {
      value: this.coerceValue(value),
      quality,
      rawValue: String(value),
    };

    const metadata: Record<string, unknown> = {};
    if (tagInfo?.tagEngUnit) {
      metadata.engUnit = tagInfo.tagEngUnit;
    }

    return {
      measurement: 'telemetry',
      tags,
      fields,
      timestamp,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  private async getTagInfo(topic: string): Promise<TagEnrichmentInfo | null> {
    const cacheKey = `tag:${topic}`;
    const cached = this.checkCache(cacheKey);
    if (cached) {
      return this.tagCache.get(cacheKey) || null;
    }

    try {
      const tag = await db.tag.findFirst({
        where: {
          OR: [
            { mqttTopic: topic },
            { mqttTopic: { contains: topic.replace(/\/value$/, '').replace(/\/setpoint$/, '') } },
          ],
        },
        include: {
          equipment: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              manufacturer: true,
              model: true,
            },
          },
          workUnit: {
            include: {
              workCenter: {
                include: {
                  area: {
                    include: {
                      site: {
                        include: {
                          enterprise: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!tag) {
        this.setCacheExpiry(cacheKey, 300000);
        return null;
      }

      const info: TagEnrichmentInfo = {
        tagId: tag.id,
        tagName: tag.name,
        tagDataType: tag.dataType,
        tagEngUnit: tag.engUnit || undefined,
      };

      if (tag.equipment) {
        info.equipmentId = tag.equipment.id;
        info.equipmentCode = tag.equipment.code;
        info.equipmentName = tag.equipment.name;
        info.equipmentType = tag.equipment.type;
        info.equipmentManufacturer = tag.equipment.manufacturer || undefined;
        info.equipmentModel = tag.equipment.model || undefined;
      }

      if (tag.workUnit) {
        info.workUnitId = tag.workUnit.id;
        info.workUnitCode = tag.workUnit.code;
        info.workUnitName = tag.workUnit.name;

        if (tag.workUnit.workCenter) {
          info.workCenterId = tag.workUnit.workCenter.id;
          info.workCenterCode = tag.workUnit.workCenter.code;
          info.workCenterName = tag.workUnit.workCenter.name;

          if (tag.workUnit.workCenter.area) {
            info.areaId = tag.workUnit.workCenter.area.id;
            info.areaCode = tag.workUnit.workCenter.area.code;
            info.areaName = tag.workUnit.workCenter.area.name;

            if (tag.workUnit.workCenter.area.site) {
              info.siteId = tag.workUnit.workCenter.area.site.id;
              info.siteCode = tag.workUnit.workCenter.area.site.code;
              info.siteName = tag.workUnit.workCenter.area.site.name;

              if (tag.workUnit.workCenter.area.site.enterprise) {
                info.enterpriseId = tag.workUnit.workCenter.area.site.enterprise.id;
                info.enterpriseCode = tag.workUnit.workCenter.area.site.enterprise.code;
                info.enterpriseName = tag.workUnit.workCenter.area.site.enterprise.name;
              }
            }
          }
        }
      }

      this.tagCache.set(cacheKey, info);
      this.setCacheExpiry(cacheKey);
      return info;
    } catch (error) {
      console.error('[Enrichment] Error fetching tag info:', error);
      return null;
    }
  }

  private async getProductionContext(workCenterCode: string, workUnitCode: string): Promise<ProductionContext | null> {
    const cacheKey = `prod:${workCenterCode}:${workUnitCode}`;
    const cached = this.checkCache(cacheKey);
    if (cached) {
      return this.productionCache.get(cacheKey) || null;
    }

    try {
      const workCenter = await db.workCenter.findFirst({
        where: { code: workCenterCode },
        include: {
          productionRuns: {
            where: { status: 'RUNNING' },
            take: 1,
            include: {
              order: {
                include: {
                  recipe: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!workCenter || workCenter.productionRuns.length === 0) {
        this.setCacheExpiry(cacheKey, 30000);
        return null;
      }

      const run = workCenter.productionRuns[0];
      const order = run.order;
      const recipe = order?.recipe;
      const product = recipe?.product;

      const context: ProductionContext = {
        runId: run.id,
        runNumber: run.runNumber,
        runStatus: run.status,
        runPhase: run.phase || undefined,
        batchId: run.runNumber,
      };

      if (order) {
        context.orderId = order.id;
        context.orderNumber = order.orderNumber;
        context.orderStatus = order.status;
      }

      if (recipe) {
        context.recipeId = recipe.id;
        context.recipeName = recipe.name;
        context.recipeVersion = recipe.version;
      }

      if (product) {
        context.productId = product.id;
        context.productCode = product.code;
        context.productName = product.name;
      }

      this.productionCache.set(cacheKey, context);
      this.setCacheExpiry(cacheKey, 30000);
      return context;
    } catch (error) {
      console.error('[Enrichment] Error fetching production context:', error);
      return null;
    }
  }

  private checkCache(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry) return false;
    
    if (Date.now() > expiry) {
      this.cacheExpiry.delete(key);
      this.tagCache.delete(key);
      this.productionCache.delete(key);
      return false;
    }
    
    return true;
  }

  private setCacheExpiry(key: string, ttlMs: number = this.CACHE_TTL_MS): void {
    this.cacheExpiry.set(key, Date.now() + ttlMs);
  }

  private coerceValue(value: unknown): number | boolean | string {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num) && isFinite(num)) return num;
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
      return value;
    }
    return String(value);
  }

  clearCache(): void {
    this.tagCache.clear();
    this.productionCache.clear();
    this.cacheExpiry.clear();
  }

  getCacheStats(): { tagCacheSize: number; productionCacheSize: number } {
    return {
      tagCacheSize: this.tagCache.size,
      productionCacheSize: this.productionCache.size,
    };
  }
}

export const dataEnrichmentService = new DataEnrichmentService();

export async function enrichTelemetry(
  topic: string,
  value: unknown,
  quality: string,
  timestamp: Date,
  context: EnrichmentContext
): Promise<EnrichedTelemetry> {
  return dataEnrichmentService.enrichTelemetry(topic, value, quality, timestamp, context);
}
