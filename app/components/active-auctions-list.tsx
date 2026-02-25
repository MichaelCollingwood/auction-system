"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRealtime } from "@/lib/realtime-client";

type Auction = {
  id: string;
  itemName: string;
  currentPrice: number;
  endTime: string;
};

type Props = {
  initialAuctions: Auction[];
  session: boolean;
};

export function ActiveAuctionsList({ initialAuctions, session }: Props) {
  const [auctions, setAuctions] = useState<Auction[]>(initialAuctions);

  useRealtime({
    channels: ["auctions:list"],
    events: ["auctionsList.auctionEnded"],
    onData: useCallback(({ data: payload }: { event: string; data: unknown }) => {
      const { auctionId } = payload as { auctionId: string };
      setAuctions((prev) => prev.filter((a) => a.id !== auctionId));
    }, []),
    enabled: true,
  });

  if (auctions.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-4 text-zinc-600 dark:text-zinc-400">
          No active auctions yet.
        </p>
        {session ? (
          <Link
            href="/auctions/new"
            className="inline-block rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Create the first auction
          </Link>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Sign in to create an auction.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {auctions.map((auction) => (
        <Link
          key={auction.id}
          href={`/auctions/${auction.id}`}
          className="rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
            {auction.itemName}
          </h2>
          <p className="mt-1 text-lg font-medium text-zinc-700 dark:text-zinc-300">
            ${auction.currentPrice.toFixed(2)}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Ends {new Date(auction.endTime).toLocaleString()}
          </p>
        </Link>
      ))}
    </div>
  );
}
