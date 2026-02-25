import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const schema = z.object({
  itemName: z.string().min(1).max(200).trim(),
  startingPrice: z.number().positive(),
  durationSeconds: z.number().int().min(10).max(86400), // 10s to 24h
  description: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { itemName, startingPrice, durationSeconds, description } =
      parsed.data;

    const endTime = new Date(Date.now() + durationSeconds * 1000);

    const auction = await prisma.auction.create({
      data: {
        itemName,
        description: description ?? null,
        startingPrice,
        currentPrice: startingPrice,
        endTime,
        creatorId: session.user.id,
      },
    });

    await prisma.auctionSubscription.create({
      data: {
        userId: session.user.id,
        auctionId: auction.id,
      },
    });

    return NextResponse.json({
      id: auction.id,
      endTime: endTime.toISOString(),
    });
  } catch (error) {
    console.error("Create auction error:", error);
    return NextResponse.json(
      { error: "Failed to create auction" },
      { status: 500 }
    );
  }
}
