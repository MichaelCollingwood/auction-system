import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 20);

  if (q.length < 2) {
    return NextResponse.json({ auctions: [] });
  }

  const auctions = await prisma.auction.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { itemName: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      itemName: true,
      currentPrice: true,
      endTime: true,
    },
  });

  return NextResponse.json({
    auctions: auctions.map((a) => ({
      id: a.id,
      itemName: a.itemName,
      currentPrice: Number(a.currentPrice),
      endTime: a.endTime.toISOString(),
    })),
  });
}
