"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRealtime } from "@/lib/realtime-client";

type AuctionData = {
  id: string;
  itemName: string;
  description: string | null;
  startingPrice: number;
  currentPrice: number;
  endTime: string;
  status: string;
  creator: { id: string; name: string | null; email: string };
  highBidder: { id: string; name: string | null; email: string } | null;
  bidHistory: {
    id: string;
    amount: number;
    bidderId: string;
    bidderName: string;
    createdAt: string;
  }[];
};

type Props = {
  auctionId: string;
  initialData: AuctionData;
};

export function LiveAuctionView({ auctionId, initialData }: Props) {
  const { data: session, status: sessionStatus } = useSession();
  const [data, setData] = useState<AuctionData>(initialData);
  const [bidAmount, setBidAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [outbidBanner, setOutbidBanner] = useState(false);

  const isActive = data.status === "ACTIVE";

  useRealtime({
    channels: [`auctions:${auctionId}`],
    events: ["auction.bid", "auction.ended"],
    onData: useCallback(({ event, data: payload }: { event: string; data: unknown }) => {
      if (event === "auction.bid") {
        const { amount, bidderId, bidderName, timestamp } = payload as {
          amount: number;
          bidderId: string;
          bidderName: string;
          timestamp: string;
        };
        setData((prev) => {
          const prevHighBidderId = prev.highBidder?.id;
          const wasOutbid = prevHighBidderId === session?.user?.id && bidderId !== session?.user?.id;
          if (wasOutbid) setOutbidBanner(true);

          return {
            ...prev,
            currentPrice: amount,
            highBidder: { id: bidderId, name: bidderName, email: "" },
            bidHistory: [
              {
                id: crypto.randomUUID(),
                amount,
                bidderId,
                bidderName,
                createdAt: timestamp,
              },
              ...prev.bidHistory,
            ].slice(0, 50),
          };
        });
      } else if (event === "auction.ended") {
        const { winnerId, winnerName, finalPrice } = payload as {
          winnerId: string;
          winnerName: string;
          finalPrice: number;
        };
        setData((prev) => ({
          ...prev,
          status: "ENDED",
          currentPrice: finalPrice,
          highBidder: prev.highBidder ?? { id: winnerId, name: winnerName, email: "" },
        }));
      }
    }, [session?.user?.id]),
    enabled: true,
  });

  useEffect(() => {
    if (outbidBanner) {
      const t = setTimeout(() => setOutbidBanner(false), 6000);
      return () => clearTimeout(t);
    }
  }, [outbidBanner]);

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (data.status !== "ACTIVE") {
      setTimeLeft(0);
      return;
    }

    const end = new Date(data.endTime).getTime();

    const update = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((end - now) / 1000));
      setTimeLeft(remaining);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [data.endTime, data.status]);

  // Refetch when countdown hits 0 to get ENDED status (server ends expired auctions)
  useEffect(() => {
    if (timeLeft === 0 && data.status === "ACTIVE") {
      fetch(`/api/auctions/${auctionId}`)
        .then((r) => r.json())
        .then((updated) => {
          setData((prev) => ({ ...prev, ...updated }));
        })
        .catch(() => {});
    }
  }, [timeLeft, data.status, auctionId]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  async function handleBid(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= data.currentPrice) {
      setError(`Bid must be higher than $${data.currentPrice.toFixed(2)}`);
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/auctions/${auctionId}/bid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });

    const result = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(result.error ?? "Failed to place bid");
      return;
    }

    setBidAmount("");
    setError("");
    if (result.currentState) {
      setData((prev) => ({
        ...prev,
        currentPrice: result.currentState.currentPrice,
        highBidder: prev.highBidder
          ? { ...prev.highBidder, id: result.currentState.highBidderId, name: result.currentState.highBidderName }
          : { id: result.currentState.highBidderId, name: result.currentState.highBidderName, email: "" },
        bidHistory: result.currentState.bidHistory ?? prev.bidHistory,
        status: result.currentState.status ?? prev.status,
        endTime: result.currentState.endTime ?? prev.endTime,
      }));
    }
  }

  const minBid = data.currentPrice + 0.01;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        ← Back to auctions
      </Link>

      {outbidBanner && (
        <div className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          You&apos;ve been outbid!
        </div>
      )}

      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {data.itemName}
      </h1>
      {data.description && (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{data.description}</p>
      )}

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Current bid
          </span>
          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            ${data.currentPrice.toFixed(2)}
          </span>
        </div>
        {data.highBidder && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            High bidder: {data.highBidder.name ?? data.highBidder.email}
          </p>
        )}

        {isActive && (
          <div className="mt-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Time left:{" "}
            </span>
            <span
              className={`font-mono font-semibold ${
                timeLeft !== null && timeLeft <= 30
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {timeLeft !== null ? formatTime(timeLeft) : "—"}
            </span>
          </div>
        )}

        {isActive && sessionStatus === "authenticated" && (
          <form onSubmit={handleBid} className="mt-6">
            {error && (
              <p className="mb-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min={minBid}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`Min $${minBid.toFixed(2)}`}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loading ? "Bidding..." : "Place Bid"}
              </button>
            </div>
          </form>
        )}

        {isActive && sessionStatus !== "authenticated" && (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-50 hover:underline">
              Sign in
            </Link>{" "}
            to place a bid.
          </p>
        )}

        {data.status === "ENDED" && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <p className="font-semibold text-green-800 dark:text-green-200">
              Auction ended
            </p>
            {data.highBidder ? (
              <p className="mt-1 text-green-700 dark:text-green-300">
                Winner: {data.highBidder.name ?? data.highBidder.email} — $
                {data.currentPrice.toFixed(2)}
              </p>
            ) : (
              <p className="mt-1 text-green-700 dark:text-green-300">
                No bids placed. Final price: ${data.currentPrice.toFixed(2)}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
          Bid history
        </h2>
        {data.bidHistory.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No bids yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.bidHistory.map((bid) => (
              <li
                key={bid.id}
                className="flex justify-between rounded border border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="text-zinc-700 dark:text-zinc-300">
                  {bid.bidderName} — ${bid.amount.toFixed(2)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(bid.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
