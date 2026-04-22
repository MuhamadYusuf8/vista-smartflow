import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const days = parseInt(searchParams.get("days") || "7");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: Prisma.ViolationWhereInput = {
      timestamp: { gte: startDate }
    };

    if (type) {
      where.type = type as any; // Cast safely for query param
    }

    const violations = await prisma.violation.findMany({
      where,
      select: {
        lat: true,
        lng: true,
      }
    });

    // Explicitly typing the map parameter 'v' to avoid implicit any
    const points = violations.map((v: { lat: number; lng: number }) => ({
      lat: v.lat,
      lng: v.lng,
      intensity: Math.random() * 0.5 + 0.5 // Random intensity 0.5-1.0
    }));

    return NextResponse.json({ points });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
