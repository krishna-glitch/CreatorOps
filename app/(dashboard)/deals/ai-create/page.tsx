"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

type Deliverable = {
  platform: "INSTAGRAM" | "YOUTUBE" | "TIKTOK";
  type: "REEL" | "POST" | "STORY" | "SHORT" | "VIDEO";
  quantity: number;
};

type Currency = "USD" | "INR";
type DealStatus = "INBOUND" | "NEGOTIATING" | "AGREED" | "PAID";
type BrandItem = { id: string; name: string };
type ParseMode = "smart" | "ai";
type BrandMatchResult =
  | { kind: "exact"; brand: BrandItem; score: number }
  | { kind: "fuzzy"; brand: BrandItem; score: number }
  | { kind: "none" };

function confidenceClass(confidence: number) {
  if (confidence > 0.8) {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (confidence < 0.6) {
    return "border-yellow-200 bg-yellow-50 text-yellow-700";
  }

  return "dash-border dash-bg-card text-gray-700";
}

function getCreateDealErrorMessage(error: unknown): string {
  const trpcLikeError =
    typeof error === "object" && error !== null ? error : null;
  const trpcMessage =
    trpcLikeError &&
    "message" in trpcLikeError &&
    typeof trpcLikeError.message === "string"
      ? trpcLikeError.message
      : null;
  const zodError =
    trpcLikeError &&
    "data" in trpcLikeError &&
    typeof trpcLikeError.data === "object" &&
    trpcLikeError.data !== null &&
    "zodError" in trpcLikeError.data &&
    typeof trpcLikeError.data.zodError === "object" &&
    trpcLikeError.data.zodError !== null
      ? trpcLikeError.data.zodError
      : null;

  if (
    zodError &&
    "fieldErrors" in zodError &&
    typeof zodError.fieldErrors === "object" &&
    zodError.fieldErrors !== null
  ) {
    const firstFieldError = Object.values(
      zodError.fieldErrors as Record<string, unknown>,
    ).find((value) => Array.isArray(value) && typeof value[0] === "string") as
      | string[]
      | undefined;

    if (firstFieldError?.[0]) {
      return firstFieldError[0];
    }
  }

  if (trpcMessage?.includes("Brand not found")) {
    return "Selected brand was not found. Please refresh and try again.";
  }

  if (trpcMessage?.includes("UNAUTHORIZED")) {
    return "Your session expired. Please sign in again.";
  }

  if (
    trpcMessage?.includes("Failed query:") ||
    trpcMessage?.includes("Could not create deal:")
  ) {
    return "Could not create deal right now. Please try again in a moment.";
  }

  if (trpcMessage && trpcMessage.trim().length > 0) {
    return trpcMessage;
  }

  return "Could not create the deal. Please check your inputs and try again.";
}

function formatAmount(totalValue: number | null, currency: Currency | null) {
  if (totalValue === null || currency === null) {
    return "Not detected";
  }

  return `${currency} ${totalValue}`;
}

function normalizeBrandName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function buildTokenSet(name: string) {
  return new Set(
    normalizeBrandName(name)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 0),
  );
}

function calculateTokenOverlapScore(a: string, b: string) {
  const aTokens = buildTokenSet(a);
  const bTokens = buildTokenSet(b);

  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...aTokens, ...bTokens]).size;
  return union > 0 ? intersection / union : 0;
}

function calculateFuzzyScore(source: string, candidate: string) {
  const sourceNormalized = normalizeBrandName(source);
  const candidateNormalized = normalizeBrandName(candidate);

  if (!sourceNormalized || !candidateNormalized) {
    return 0;
  }

  if (sourceNormalized === candidateNormalized) {
    return 1;
  }

  if (
    sourceNormalized.includes(candidateNormalized) ||
    candidateNormalized.includes(sourceNormalized)
  ) {
    return 0.9;
  }

  return calculateTokenOverlapScore(sourceNormalized, candidateNormalized);
}

function findBrandMatch(
  extractedBrandName: string,
  brands: BrandItem[],
): BrandMatchResult {
  const normalizedExtracted = normalizeBrandName(extractedBrandName);
  if (!normalizedExtracted || brands.length === 0) {
    return { kind: "none" };
  }

  const exactMatch = brands.find(
    (brand) => normalizeBrandName(brand.name) === normalizedExtracted,
  );

  if (exactMatch) {
    return { kind: "exact", brand: exactMatch, score: 1 };
  }

  let bestBrand: BrandItem | null = null;
  let bestScore = 0;

  for (const brand of brands) {
    const score = calculateFuzzyScore(extractedBrandName, brand.name);
    if (score > bestScore) {
      bestScore = score;
      bestBrand = brand;
    }
  }

  if (bestBrand && bestScore >= 0.45) {
    return { kind: "fuzzy", brand: bestBrand, score: bestScore };
  }

  return { kind: "none" };
}

export default function AICreateDealPage() {
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const hasRedirectedForQuotaRef = useRef(false);

  const { data: brands, isLoading: isLoadingBrands } =
    trpc.brands.list.useQuery({ limit: 100 });
  const aiAvailabilityQuery = trpc.ai.extractionAvailability.useQuery(
    undefined,
    {
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
    },
  );

  const parseMessageMutation = trpc.deals.parseMessage.useMutation();
  const smartParseMutation = trpc.deals.smartParse.useMutation();
  const createDealMutation = trpc.deals.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.deals.list.invalidate(),
        trpcUtils.analytics.getDashboardStats.invalidate(),
      ]);
      toast.success("Deal created successfully.", { duration: 3000 });
      router.push("/deals");
    },
    onError: (error) => {
      toast.error(getCreateDealErrorMessage(error), { duration: 3000 });
    },
  });

  const [parseMode, setParseMode] = useState<ParseMode>("smart");
  const [message, setMessage] = useState("");
  const [detectedBrandName, setDetectedBrandName] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [brandId, setBrandId] = useState("");
  const [title, setTitle] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [currency, setCurrency] = useState<Currency | "">("");
  const [status, setStatus] = useState<DealStatus>("INBOUND");
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [hasExtraction, setHasExtraction] = useState(false);
  const [isBrandSelectionManual, setIsBrandSelectionManual] = useState(false);

  const brandItems: BrandItem[] = brands?.items ?? [];
  const hasBrands = brandItems.length > 0;
  const isAIExtractionDisabled = aiAvailabilityQuery.data?.enabled === false;

  const confidenceStyles = useMemo(() => {
    if (confidence === null) {
      return "dash-border dash-bg-card text-gray-700";
    }

    return confidenceClass(confidence);
  }, [confidence]);

  const brandMatch = useMemo(() => {
    if (!hasExtraction || !detectedBrandName.trim()) {
      return { kind: "none" } as const;
    }

    return findBrandMatch(detectedBrandName, brandItems);
  }, [hasExtraction, detectedBrandName, brandItems]);

  useEffect(() => {
    if (!hasExtraction || isBrandSelectionManual) {
      return;
    }

    if (brandMatch.kind === "exact") {
      setBrandId(brandMatch.brand.id);
    }
  }, [brandMatch, hasExtraction, isBrandSelectionManual]);

  useEffect(() => {
    if (!isAIExtractionDisabled || hasRedirectedForQuotaRef.current) {
      return;
    }

    hasRedirectedForQuotaRef.current = true;
    // Auto-switch to smart parse instead of navigating away
    if (parseMode === "ai") {
      setParseMode("smart");
      toast.info(
        "AI extraction is temporarily disabled due to quota. Switched to Smart Parse.",
        { duration: 3000 },
      );
    }
  }, [isAIExtractionDisabled, parseMode]);

  const handleExtract = () => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      toast.error("Please paste a message before extracting.", {
        duration: 3000,
      });
      return;
    }

    const onExtractionSuccess = (result: {
      brand_name: string | null;
      total_value: number | null;
      currency: "USD" | "INR" | null;
      deliverables: Deliverable[];
      status: "INBOUND" | "NEGOTIATING" | "AGREED";
      confidence: number;
    }) => {
      setHasExtraction(true);
      setBrandId("");
      setIsBrandSelectionManual(false);
      setDetectedBrandName(result.brand_name ?? "");
      setConfidence(result.confidence);
      setDeliverables(result.deliverables);
      setTotalValue(result.total_value?.toString() ?? "");
      setCurrency(result.currency ?? "");
      setStatus(result.status);

      if (result.total_value !== null && result.currency === null) {
        toast.info(
          "Amount found but currency was not detected. Please select it.",
          {
            duration: 3000,
          },
        );
      }

      setTitle((previous) => {
        if (previous.trim().length > 0) {
          return previous;
        }

        if (result.brand_name) {
          return `${result.brand_name} Deal`;
        }

        return "New Deal";
      });
    };

    if (parseMode === "smart") {
      smartParseMutation.mutate(
        { message: normalizedMessage },
        {
          onSuccess: onExtractionSuccess,
          onError: (error) => {
            if (!isAIExtractionDisabled) {
              toast.info("Smart Parse failed. Falling back to AI Parse.", {
                duration: 3000,
              });
              setParseMode("ai");
              parseMessageMutation.mutate(
                { message: normalizedMessage },
                {
                  onSuccess: onExtractionSuccess,
                  onError: () => {
                    toast.error("Both Smart Parse and AI Parse failed.", {
                      duration: 3000,
                    });
                  },
                },
              );
              return;
            }

            toast.error("Smart parse failed. Please edit fields manually.", {
              duration: 3000,
            });
            console.warn("deals.smartParse failed", error);
          },
        },
      );
    } else {
      if (isAIExtractionDisabled) {
        toast.error(
          "AI extraction is disabled due to quota. Switching to Smart Parse.",
          { duration: 3000 },
        );
        setParseMode("smart");
        return;
      }

      parseMessageMutation.mutate(
        { message: normalizedMessage },
        {
          onSuccess: onExtractionSuccess,
          onError: (error) => {
            toast.error("AI unavailable right now. Switching to Smart Parse.", {
              duration: 3000,
            });
            console.warn("deals.parseMessage failed", error);
            setParseMode("smart");
          },
        },
      );
    }
  };

  const handleConfirmCreate = () => {
    if (!brandId) {
      toast.error("Please select a brand before creating the deal.", {
        duration: 3000,
      });
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a deal title.", { duration: 3000 });
      return;
    }

    const parsedTotalValue = Number(totalValue);
    if (!Number.isFinite(parsedTotalValue) || parsedTotalValue <= 0) {
      toast.error("Please enter a valid total value greater than 0.", {
        duration: 3000,
      });
      return;
    }

    if (!currency) {
      toast.error("Please select a currency before creating the deal.", {
        duration: 3000,
      });
      return;
    }

    const validCurrency: Currency = currency;

    createDealMutation.mutate({
      brand_id: brandId,
      title: title.trim(),
      total_value: parsedTotalValue,
      currency: validCurrency,
      status,
    });
  };

  const updateDeliverable = (
    index: number,
    key: keyof Deliverable,
    value: string | number,
  ) => {
    setDeliverables((previous) =>
      previous.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (key === "quantity") {
          return {
            ...item,
            quantity: typeof value === "number" ? value : Number(value),
          };
        }

        return {
          ...item,
          [key]: value,
        } as Deliverable;
      }),
    );
  };

  const addDeliverable = () => {
    setDeliverables((previous) => [
      ...previous,
      {
        platform: "INSTAGRAM",
        type: "REEL",
        quantity: 1,
      },
    ]);
  };

  const removeDeliverable = (index: number) => {
    setDeliverables((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const isExtracting =
    parseMessageMutation.isPending || smartParseMutation.isPending;
  const isCreating = createDealMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border dash-border dash-bg-card shadow-sm dash-border dash-bg-panel">
        <div className="border-b dash-border px-5 py-5 sm:px-8 dash-border">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Smart Deal Intake
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Create Deal From Message
            </h1>
            <Button asChild variant="outline" size="sm">
              <Link href="/deals/new">Create Manually</Link>
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Parse messages instantly with Smart Parse, or use AI for complex
            messages.
          </p>
        </div>

        <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
          <div className="rounded-xl border dash-border p-4 sm:p-5 dash-border">
            <div className="mb-4 flex rounded-lg border dash-border p-1 dash-border">
              <button
                type="button"
                onClick={() => setParseMode("smart")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  parseMode === "smart"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⚡ Smart Parse
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isAIExtractionDisabled) {
                    toast.error(
                      "AI extraction is temporarily disabled due to quota.",
                      { duration: 3000 },
                    );
                    return;
                  }
                  setParseMode("ai");
                }}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  parseMode === "ai"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : isAIExtractionDisabled
                      ? "cursor-not-allowed text-muted-foreground/50"
                      : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🤖 AI Parse{isAIExtractionDisabled ? " (Quota)" : ""}
              </button>
            </div>

            <label
              htmlFor="deal-message"
              className="text-sm font-medium text-foreground"
            >
              Message
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              {parseMode === "smart"
                ? "Instant extraction using pattern matching — no API quota used."
                : "Uses Groq AI for complex or ambiguous messages."}
            </p>
            {hasExtraction &&
            (confidence === null || confidence < 0.6 || !detectedBrandName) ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Low-confidence parse. Review brand, amount, currency, and status
                before creating.
              </p>
            ) : null}
            <textarea
              id="deal-message"
              placeholder="Paste the message here..."
              className="mt-3 flex min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-emerald-500 focus-visible:ring-[3px] focus-visible:ring-emerald-500/30"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                onClick={handleExtract}
                disabled={isExtracting}
              >
                {isExtracting
                  ? "Extracting..."
                  : parseMode === "smart"
                    ? "⚡ Smart Parse"
                    : "🤖 AI Parse"}
              </Button>
            </div>
          </div>

          {hasExtraction ? (
            <>
              <div className="rounded-xl border dash-border p-4 sm:p-5 dash-border">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium">Extraction Preview</p>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${confidenceStyles}`}
                  >
                    Confidence:{" "}
                    {typeof confidence === "number"
                      ? confidence.toFixed(2)
                      : "N/A"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <p>
                    <span className="font-medium">Brand:</span>{" "}
                    {detectedBrandName || "Not detected"}
                  </p>
                  <p>
                    <span className="font-medium">Amount:</span>{" "}
                    {formatAmount(
                      totalValue ? Number(totalValue) : null,
                      currency || null,
                    )}
                  </p>
                  <div className="sm:col-span-2">
                    <p className="font-medium">Deliverables:</p>
                    {deliverables.length === 0 ? (
                      <p className="mt-1 text-muted-foreground">
                        None detected
                      </p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-muted-foreground">
                        {deliverables.map((item, index) => (
                          <li key={`${item.platform}-${item.type}-${index}`}>
                            {item.quantity}x {item.platform} {item.type}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    {detectedBrandName ? (
                      brandMatch.kind === "exact" ? (
                        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                          Exact brand match found:{" "}
                          <strong>{brandMatch.brand.name}</strong>
                        </p>
                      ) : brandMatch.kind === "fuzzy" ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2">
                          <p className="text-xs text-yellow-700">
                            Suggested brand match:{" "}
                            <strong>{brandMatch.brand.name}</strong> (
                            {(brandMatch.score * 100).toFixed(0)}% similarity)
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setBrandId(brandMatch.brand.id);
                              setIsBrandSelectionManual(true);
                            }}
                          >
                            Use Suggested Match
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border dash-border dash-bg-card px-3 py-2">
                          <p className="text-xs text-gray-700">
                            No existing brand match found for "
                            {detectedBrandName}".
                          </p>
                          <Button asChild size="sm" variant="outline">
                            <Link href="/brands/new">Create New Brand</Link>
                          </Button>
                        </div>
                      )
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Brand was not detected from this message.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border dash-border p-4 sm:p-5 dash-border">
                <p className="text-sm font-medium">Edit Before Creating</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fix any extracted fields before confirming.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Brand</label>
                    <Select
                      value={brandId}
                      onValueChange={(value) => {
                        setBrandId(value);
                        setIsBrandSelectionManual(true);
                      }}
                    >
                      <SelectTrigger className="focus:ring-emerald-500/30 focus:ring-offset-0">
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingBrands ? (
                          <SelectItem value="loading" disabled>
                            Loading brands...
                          </SelectItem>
                        ) : hasBrands ? (
                          brandItems.map((brand) => (
                            <SelectItem key={brand.id} value={brand.id}>
                              {brand.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No brands found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Campaign title"
                      className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalValue}
                      onChange={(event) => setTotalValue(event.target.value)}
                      placeholder="0.00"
                      className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Currency</label>
                    <Select
                      value={currency}
                      onValueChange={(value) => setCurrency(value as Currency)}
                    >
                      <SelectTrigger className="focus:ring-emerald-500/30 focus:ring-offset-0">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="INR">INR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select
                      value={status}
                      onValueChange={(value) => setStatus(value as DealStatus)}
                    >
                      <SelectTrigger className="focus:ring-emerald-500/30 focus:ring-offset-0">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INBOUND">INBOUND</SelectItem>
                        <SelectItem value="NEGOTIATING">NEGOTIATING</SelectItem>
                        <SelectItem value="AGREED">AGREED</SelectItem>
                        <SelectItem value="PAID">PAID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-6 rounded-lg border border-dashed dash-border p-4 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Deliverables</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addDeliverable}
                    >
                      Add Deliverable
                    </Button>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Editable for review. These are not persisted to deal records
                    yet.
                  </p>

                  <div className="mt-3 space-y-3">
                    {deliverables.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No deliverables added.
                      </p>
                    ) : (
                      deliverables.map((item, index) => (
                        <div
                          key={`${item.platform}-${item.type}-${index}`}
                          className="grid grid-cols-1 gap-3 rounded-md border dash-border p-3 sm:grid-cols-4 dash-border"
                        >
                          <Select
                            value={item.platform}
                            onValueChange={(value) =>
                              updateDeliverable(index, "platform", value)
                            }
                          >
                            <SelectTrigger className="focus:ring-emerald-500/30 focus:ring-offset-0">
                              <SelectValue placeholder="Platform" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="INSTAGRAM">
                                INSTAGRAM
                              </SelectItem>
                              <SelectItem value="YOUTUBE">YOUTUBE</SelectItem>
                              <SelectItem value="TIKTOK">TIKTOK</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={item.type}
                            onValueChange={(value) =>
                              updateDeliverable(index, "type", value)
                            }
                          >
                            <SelectTrigger className="focus:ring-emerald-500/30 focus:ring-offset-0">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="REEL">REEL</SelectItem>
                              <SelectItem value="POST">POST</SelectItem>
                              <SelectItem value="STORY">STORY</SelectItem>
                              <SelectItem value="SHORT">SHORT</SelectItem>
                              <SelectItem value="VIDEO">VIDEO</SelectItem>
                            </SelectContent>
                          </Select>

                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(event) =>
                              updateDeliverable(
                                index,
                                "quantity",
                                Math.max(1, Number(event.target.value || 1)),
                              )
                            }
                            className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                          />

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => removeDeliverable(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t dash-border pt-5 sm:flex-row sm:items-center sm:justify-end dash-border">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => router.push("/deals")}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCreate}
              disabled={
                !hasExtraction || isCreating || isExtracting || !hasBrands
              }
              className="w-full sm:w-auto sm:min-w-48"
            >
              {isCreating ? "Creating deal..." : "Confirm & Create Deal"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
