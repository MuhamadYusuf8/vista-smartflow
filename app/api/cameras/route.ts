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

    // KODE BARU
    const formattedCameras = cameras.map((camera: { _count: { violations: number }; [key: string]: any }) => ({
      ...camera,
      violationsToday: camera._count.violations,
      uptime: 99.9,
    }));

    return NextResponse.json(formattedCameras);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
