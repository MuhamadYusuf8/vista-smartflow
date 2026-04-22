import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ViolationType, ViolationStatus } from "@prisma/client";

const querySchema = z.object({
  page: z.string().optional().transform(val => (val ? parseInt(val) : 1)),
  limit: z.string().optional().transform(val => (val ? parseInt(val) : 20)),
  type: z.nativeEnum(ViolationType).optional(),
  status: z.nativeEnum(ViolationStatus).optional(),
  cameraId: z.string().optional(),
  search: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));

    const skip = (query.page - 1) * query.limit;

    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.cameraId) where.cameraId = query.cameraId;
    
    if (query.search) {
      where.OR = [
        { licensePlate: { contains: query.search, mode: "insensitive" } },
        { location: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [violations, total] = await Promise.all([
      prisma.violation.findMany({
        where,
        include: {
          camera: {
            select: { name: true, location: true }
          }
        },
        orderBy: { timestamp: "desc" },
        skip,
        take: query.limit,
      }),
      prisma.violation.count({ where }),
    ]);

    return NextResponse.json({
      violations,
      total,
      page: query.page,
      totalPages: Math.ceil(total / query.limit),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
