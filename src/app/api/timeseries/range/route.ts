import { NextRequest, NextResponse } from 'next/server';
import { getTagValuesInRange } from '@/lib/influxdb';

/**
 * GET /api/timeseries/range?tagId=xxx&start=ISO8601&end=ISO8601&interval=1m
 * Returns points for tagId in the time range from InfluxDB. Optional interval for downsampling.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('tagId');
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');
    const interval = searchParams.get('interval') ?? undefined;

    if (!tagId) {
      return NextResponse.json(
        { error: 'Missing tagId query parameter' },
        { status: 400 }
      );
    }
    if (!startStr || !endStr) {
      return NextResponse.json(
        { error: 'Missing start and end query parameters (ISO8601)' },
        { status: 400 }
      );
    }

    const start = new Date(startStr);
    const end = new Date(endStr);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid start or end date' },
        { status: 400 }
      );
    }

    const data = await getTagValuesInRange(tagId, start, end, interval);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[API] timeseries/range error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch range' },
      { status: 500 }
    );
  }
}
