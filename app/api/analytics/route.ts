import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [todayCount, yesterdayCount, activeCount, totalCameras, avgConfidence] = await Promise.all([
      prisma.violation.count({ where: { timestamp: { gte: today } } }),
      prisma.violation.count({ where: { timestamp: { gte: yesterday, lt: today } } }),
      prisma.camera.count({ where: { status: "ACTIVE" } }),
      prisma.camera.count(),
      prisma.violation.aggregate({ _avg: { confidence: true } }),
    ]);

    const trend = yesterdayCount === 0 ? 100 : Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);

    // Mock hourly data for the chart (in real implementation, group by hour and type)
    const hourlyData = [
      { hour: "00:00", ILLEGAL_PARKING: 12, BUSWAY_VIOLATION: 2, BICYCLE_LANE_VIOLATION: 0, BUS_STOP_VIOLATION: 1, WRONG_LANE: 3, total: 18 },
      { hour: "04:00", ILLEGAL_PARKING: 8, BUSWAY_VIOLATION: 1, BICYCLE_LANE_VIOLATION: 0, BUS_STOP_VIOLATION: 0, WRONG_LANE: 2, total: 11 },
      { hour: "08:00", ILLEGAL_PARKING: 45, BUSWAY_VIOLATION: 15, BICYCLE_LANE_VIOLATION: 8, BUS_STOP_VIOLATION: 12, WRONG_LANE: 22, total: 102 },
      { hour: "12:00", ILLEGAL_PARKING: 52, BUSWAY_VIOLATION: 8, BICYCLE_LANE_VIOLATION: 4, BUS_STOP_VIOLATION: 18, WRONG_LANE: 16, total: 98 },
      { hour: "16:00", ILLEGAL_PARKING: 60, BUSWAY_VIOLATION: 20, BICYCLE_LANE_VIOLATION: 10, BUS_STOP_VIOLATION: 25, WRONG_LANE: 30, total: 145 },
      { hour: "20:00", ILLEGAL_PARKING: 35, BUSWAY_VIOLATION: 5, BICYCLE_LANE_VIOLATION: 2, BUS_STOP_VIOLATION: 8, WRONG_LANE: 10, total: 60 },
    ];

    // Mock vehicle data (in real implementation, group by vehicleType)
    const vehicleTypeData = [
      { name: "CAR", value: 125, color: "#3B82F6" },
      { name: "MOTORCYCLE", value: 87, color: "#10B981" },
      { name: "BUS", value: 42, color: "#F59E0B" },
      { name: "TRUCK", value: 24, color: "#EF4444" },
    ];

    return NextResponse.json({
      todayCount,
      activeCount,
      totalCount: totalCameras,
      maintenanceCount: totalCameras - activeCount,
      anprAccuracy: avgConfidence._avg.confidence ? Number((avgConfidence._avg.confidence * 100).toFixed(1)) : 96.8,
      avgResponseTime: 4.2, // mock
      todayTrend: trend,
      anprTrend: 0.3, // mock
      responseTrend: -0.8, // mock
      hourlyData,
      vehicleTypeData,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
