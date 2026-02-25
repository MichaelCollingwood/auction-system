import { Realtime, InferRealtimeEvents } from "@upstash/realtime";
import { redis } from "./redis";
import { z } from "zod";

const schema = {
  auction: {
    bid: z.object({
      amount: z.number(),
      bidderId: z.string(),
      bidderName: z.string().optional(),
      timestamp: z.string(),
      endTime: z.string().optional(),
    }),
    ended: z.object({
      winnerId: z.string().optional(),
      winnerName: z.string().optional(),
      finalPrice: z.number(),
    }),
  },
  notification: {
    alert: z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      message: z.string(),
      link: z.string().optional(),
    }),
  },
  auctionsList: {
    auctionEnded: z.object({ auctionId: z.string() }),
  },
};

export const realtime = new Realtime({ schema, redis });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
