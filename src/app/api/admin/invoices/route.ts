import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import Room from '@/models/Room';
import User from '@/models/User';

// POST - Create new invoice(s)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    await connectDB();

    const body = await request.json();
    const { roomIds, month, year, dueDate } = body;

    if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
      return NextResponse.json({ error: 'Room IDs are required' }, { status: 400 });
    }

    if (!month || !year || !dueDate) {
      return NextResponse.json({ error: 'Month, year, and due date are required' }, { status: 400 });
    }

    // Fetch all required data in parallel (3 queries instead of N*2 queries)
    const [adminUser, rooms, existingInvoices] = await Promise.all([
      // Find admin user for tracking
      User.findOne({ lineUserId: admin, role: 'admin' }).lean(),
      // Get all requested rooms with tenants in one query
      Room.find({ _id: { $in: roomIds } })
        .populate('tenantId', '_id')
        .lean(),
      // Check all existing invoices for this period in one query
      Invoice.find({ roomId: { $in: roomIds }, month, year })
        .select('roomId')
        .lean(),
    ]);

    // Create lookup maps for O(1) access
    const roomMap = new Map(rooms.map((room: any) => [room._id.toString(), room]));
    const existingInvoiceRoomIds = new Set(
      existingInvoices.map((inv: any) => inv.roomId.toString())
    );

    const results: any[] = [];
    const errors: any[] = [];
    const invoicesToCreate: any[] = [];

    // Process all rooms and prepare invoices (no DB queries in loop)
    for (const roomId of roomIds) {
      const roomIdStr = roomId.toString();
      const room = roomMap.get(roomIdStr) as any;

      if (!room) {
        errors.push({ roomId, error: 'Room not found' });
        continue;
      }

      if (!room.tenantId) {
        errors.push({ roomId, error: 'Room has no tenant' });
        continue;
      }

      if (existingInvoiceRoomIds.has(roomIdStr)) {
        errors.push({ roomId, error: 'Invoice already exists for this period' });
        continue;
      }

      // Get meter readings from Room model
      const waterReadings = room.waterMeterReadings || [];
      const electricityReadings = room.electricityMeterReadings || [];

      // Sort readings by date (newest first) - pre-compute timestamps for efficiency
      const sortedWaterReadings = [...waterReadings]
        .map((r: any) => ({ ...r, _ts: new Date(r.recordedAt).getTime() }))
        .sort((a, b) => b._ts - a._ts);
      const sortedElectricityReadings = [...electricityReadings]
        .map((r: any) => ({ ...r, _ts: new Date(r.recordedAt).getTime() }))
        .sort((a, b) => b._ts - a._ts);

      // Get current and previous readings
      const currentWaterReading = sortedWaterReadings[0]?.value || 0;
      const previousWaterReading = sortedWaterReadings[1]?.value || 0;
      const currentElectricityReading = sortedElectricityReadings[0]?.value || 0;
      const previousElectricityReading = sortedElectricityReadings[1]?.value || 0;

      // Calculate units used
      const waterUnits = Math.max(0, currentWaterReading - previousWaterReading);
      const electricityUnits = Math.max(0, currentElectricityReading - previousElectricityReading);

      // Calculate charges
      const rentAmount = room.baseRentPrice || 0;
      const waterAmount = waterUnits * (room.waterRate || 18);
      const electricityAmount = electricityUnits * (room.electricityRate || 8);

      // Build other charges array (for motorcycle parking, etc.)
      const otherCharges: { description: string; amount: number }[] = [];

      // Add motorcycle parking if enabled
      if (room.hasMotorcycleParking) {
        otherCharges.push({
          description: 'ค่าที่จอดมอเตอร์ไซค์',
          amount: room.motorcycleParkingRate || 200,
        });
      }

      const otherChargesTotal = otherCharges.reduce((sum, item) => sum + item.amount, 0);
      const totalAmount = rentAmount + waterAmount + electricityAmount + otherChargesTotal;

      // Prepare invoice document for bulk insert
      const tenantId = typeof room.tenantId === 'object' ? room.tenantId._id : room.tenantId;
      invoicesToCreate.push({
        roomId: room._id,
        tenantId,
        month,
        year,
        waterUnits,
        electricityUnits,
        previousWaterReading,
        previousElectricityReading,
        currentWaterReading,
        currentElectricityReading,
        rentAmount,
        waterAmount,
        electricityAmount,
        otherCharges,
        totalAmount,
        paymentStatus: 'pending',
        dueDate: new Date(dueDate),
        generatedBy: adminUser?._id,
        // Store room info for response
        _roomNumber: room.roomNumber,
      });
    }

    // Bulk insert all invoices in one operation
    if (invoicesToCreate.length > 0) {
      const createdInvoices = await Invoice.insertMany(
        invoicesToCreate.map(({ _roomNumber, ...doc }) => doc),
        { ordered: false }
      );

      // Build results from created invoices
      createdInvoices.forEach((invoice: any, index: number) => {
        results.push({
          roomId: invoice.roomId,
          roomNumber: invoicesToCreate[index]._roomNumber,
          invoiceId: invoice._id,
          totalAmount: invoice.totalAmount,
        });
      });
    }

    return NextResponse.json({
      success: true,
      created: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Create invoices error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// GET - List invoices with filters
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    await connectDB();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const roomId = searchParams.get('roomId');

    const query: any = {};

    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query.paymentStatus = status;
    if (roomId) query.roomId = roomId;

    const invoices = await Invoice.find(query)
      .populate('roomId', 'roomNumber floor')
      .populate('tenantId', 'displayName fullName phone pictureUrl')
      .sort({ year: -1, month: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({ invoices });
  } catch (error: any) {
    console.error('Get invoices error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
