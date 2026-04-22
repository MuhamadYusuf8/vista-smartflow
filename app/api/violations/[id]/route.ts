import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ViolationStatus } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // 1. Ubah tipe menjadi Promise
) {
  try {
    const resolvedParams = await params; // 2. Await params-nya

    const violation = await prisma.violation.findUnique({
      where: { id: resolvedParams.id }, // 3. Gunakan id yang sudah di-await
      include: {
        camera: true,
      },
    });

    if (!violation) {
      return NextResponse.json({ error: "Violation not found" }, { status: 404 });
    }

    return NextResponse.json(violation);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  status: z.nativeEnum(ViolationStatus),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // 1. Ubah tipe menjadi Promise
) {
  try {
    const resolvedParams = await params; // 2. Await params-nya
    const body = await req.json();
    const { status } = updateSchema.parse(body);

    const violation = await prisma.violation.update({
      where: { id: resolvedParams.id }, // 3. Gunakan id yang sudah di-await
      data: { 
        status,
        processedAt: status !== "PENDING" ? new Date() : null,
      },
      include: {
        camera: true
      }
    });

    return NextResponse.json(violation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}