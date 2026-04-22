import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cameras = await prisma.camera.findMany({
      include: {
        _count: {
          select: {
            violations: {
              where: {
                timestamp: {
                  gte: today,
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const formattedCameras = cameras.map((camera) => ({
      ...camera,
      violationsToday: camera._count.violations,
      uptime: 99.9, // Mock value, in real app would track ping/status logs
    }));

    return NextResponse.json(formattedCameras);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
