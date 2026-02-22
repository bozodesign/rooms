import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';

interface MeterReading {
  roomId: string;
  meterType: 'water' | 'electricity';
  value: number;
  notes?: string;
}

// POST - Batch record meter readings
export async function POST(request: NextRequest) {
  try {
    const lineUserId = await requireAuth(request);

    // Check if user is admin
    const userIsAdmin = await isAdmin(lineUserId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const body = await request.json();
    const { readings } = body as { readings: MeterReading[] };

    if (!readings || !Array.isArray(readings) || readings.length === 0) {
      return NextResponse.json(
        { error: 'Readings array is required' },
        { status: 400 }
      );
    }

    // Validate all readings
    for (const reading of readings) {
      if (!reading.roomId) {
        return NextResponse.json(
          { error: 'Room ID is required for all readings' },
          { status: 400 }
        );
      }
      if (!reading.meterType || !['water', 'electricity'].includes(reading.meterType)) {
        return NextResponse.json(
          { error: 'Invalid meter type. Must be "water" or "electricity"' },
          { status: 400 }
        );
      }
      if (reading.value === undefined || reading.value === null || isNaN(Number(reading.value))) {
        return NextResponse.json(
          { error: 'Meter value is required and must be a number' },
          { status: 400 }
        );
      }
    }

    const results: { roomId: string; meterType: string; success: boolean; error?: string }[] = [];
    let successCount = 0;

    // Batch fetch all rooms in one query instead of N queries
    const roomIds = [...new Set(readings.map((r) => r.roomId))];
    const rooms = await Room.find({ _id: { $in: roomIds } });
    const roomMap = new Map(rooms.map((room) => [room._id.toString(), room]));

    // Pre-compute latest readings for each room (avoid repeated sorting)
    const getLatestReading = (roomReadings: { value: number; recordedAt: Date }[]) => {
      if (!roomReadings || roomReadings.length === 0) return null;
      let latest = roomReadings[0];
      let latestTime = new Date(latest.recordedAt).getTime();
      for (let i = 1; i < roomReadings.length; i++) {
        const time = new Date(roomReadings[i].recordedAt).getTime();
        if (time > latestTime) {
          latest = roomReadings[i];
          latestTime = time;
        }
      }
      return latest;
    };

    // Group readings by room for batch saving
    const roomUpdates = new Map<string, { room: any; readings: MeterReading[] }>();

    // Process each reading (validation only, no DB queries)
    for (const reading of readings) {
      const room = roomMap.get(reading.roomId);
      if (!room) {
        results.push({
          roomId: reading.roomId,
          meterType: reading.meterType,
          success: false,
          error: 'Room not found',
        });
        continue;
      }

      const newValue = Number(reading.value);

      // Validate that new value is not less than the latest reading
      if (reading.meterType === 'water') {
        const latestReading = getLatestReading(room.waterMeterReadings);
        if (latestReading && newValue < latestReading.value) {
          results.push({
            roomId: reading.roomId,
            meterType: reading.meterType,
            success: false,
            error: `ค่ามิเตอร์น้ำ (${newValue}) น้อยกว่าค่าเดิม (${latestReading.value})`,
          });
          continue;
        }
      } else {
        const latestReading = getLatestReading(room.electricityMeterReadings);
        if (latestReading && newValue < latestReading.value) {
          results.push({
            roomId: reading.roomId,
            meterType: reading.meterType,
            success: false,
            error: `ค่ามิเตอร์ไฟ (${newValue}) น้อยกว่าค่าเดิม (${latestReading.value})`,
          });
          continue;
        }
      }

      // Queue the reading for this room
      if (!roomUpdates.has(reading.roomId)) {
        roomUpdates.set(reading.roomId, { room, readings: [] });
      }
      roomUpdates.get(reading.roomId)!.readings.push(reading);
    }

    // Apply all readings and save rooms in parallel
    const savePromises = Array.from(roomUpdates.entries()).map(async ([roomId, { room, readings: roomReadings }]) => {
      try {
        for (const reading of roomReadings) {
          const newReading = {
            value: Number(reading.value),
            recordedAt: new Date(),
            recordedBy: lineUserId,
            notes: reading.notes || undefined,
          };

          if (reading.meterType === 'water') {
            room.waterMeterReadings.push(newReading);
          } else {
            room.electricityMeterReadings.push(newReading);
          }
        }

        await room.save();

        // Mark all readings for this room as successful
        for (const reading of roomReadings) {
          successCount++;
          results.push({
            roomId: reading.roomId,
            meterType: reading.meterType,
            success: true,
          });
        }
      } catch (err: any) {
        // Mark all readings for this room as failed
        for (const reading of roomReadings) {
          results.push({
            roomId: reading.roomId,
            meterType: reading.meterType,
            success: false,
            error: err.message,
          });
        }
      }
    });

    await Promise.all(savePromises);

    return NextResponse.json({
      success: true,
      message: `Recorded ${successCount} out of ${readings.length} meter readings`,
      successCount,
      totalCount: readings.length,
      results,
    });
  } catch (error: any) {
    console.error('Batch record meter reading error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
