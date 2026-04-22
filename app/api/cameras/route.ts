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

    interface CameraWithCount {
      id: string;
      name: string;
      location: string;
      status: string;
      _count: {
        violations: number;
      };
      [key: string]: any;
    }

    const formattedCameras = (cameras as unknown as CameraWithCount[]).map((camera) => ({
      ...camera,
      violationsToday: camera._count.violations,
      uptime: 99.9,
    }));

    return NextResponse.json(formattedCameras);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
