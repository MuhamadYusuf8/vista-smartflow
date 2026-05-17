import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const days = parseInt(searchParams.get("days") ?? "7");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    let query = supabase
      .from("violations")
      .select("lat, lng, type")
      .gte("timestamp", startDate.toISOString())
      .not("lat", "is", null)
      .not("lng", "is", null);

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query;
    if (error) throw error;

    const points = (data ?? []).map((v) => ({
      lat: v.lat,
      lng: v.lng,
      intensity: 0.5 + Math.random() * 0.5,
    }));

    return NextResponse.json({ points, total: points.length });
  } catch (error) {
    console.error("[Heatmap Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
