import { NextRequest, NextResponse } from 'next/server';
import { getLastValues } from '@/lib/influxdb';

/**
 * GET /api/timeseries/last?tagIds=id1,id2
 * Returns latest value, quality, timestamp from InfluxDB for each tagId.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tagIdsParam = searchParams.get('tagIds');
    if (!tagIdsParam) {
      return NextResponse.json(
        { error: 'Missing tagIds query parameter (comma-separated)' },
        { status: 400 }
      );
    }
    const tagIds = tagIdsParam.split(',').map((s) => s.trim()).filter(Boolean);
    if (tagIds.length === 0) {
      return NextResponse.json({ data: [] });
    }
    const data = await getLastValues(tagIds);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[API] timeseries/last error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch last values' },
      { status: 500 }
    );
  }
}
