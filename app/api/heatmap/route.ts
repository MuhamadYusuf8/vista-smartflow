import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const days = parseInt(searchParams.get("days") || "7");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: any = {
      timestamp: { gte: startDate }
    };

    if (type) {
      where.type = type;
    }

    const violations = await prisma.violation.findMany({
      where,
      select: {
        lat: true,
        lng: true,
      }
    });

    // Reduce points that are exactly the same (mocking heat intensity)
    // In a real scenario, Leaflet Heat handles overlapping points automatically
    const points = violations.map(v => ({
      lat: v.lat,
      lng: v.lng,
      intensity: Math.random() * 0.5 + 0.5 // Random intensity 0.5-1.0
    }));

    return NextResponse.json({ points });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
