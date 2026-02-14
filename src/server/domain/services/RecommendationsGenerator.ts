type StalledBrandFollowUp = {
  brandName: string;
  stalledDays: number;
  openDeals: number;
};

export type RecommendationsGeneratorInput = {
  insights: string[];
  onTimeDeliveryRate: number;
  paymentDelaysByBrand: Array<{
    brandName: string;
    averageDelayDays: number;
    latePaymentRate: number;
    totalPayments: number;
  }>;
  stalledBrandFollowUps: StalledBrandFollowUp[];
};

type RecommendationCandidate = {
  score: number;
  text: string;
};

const MAX_RECOMMENDATIONS = 5;

export function generateRecommendations(
  input: RecommendationsGeneratorInput,
): string[] {
  const candidates: RecommendationCandidate[] = [];

  if (
    input.insights.some((insight) => insight.toLowerCase().includes("tech"))
  ) {
    candidates.push({
      score: 1.4,
      text: "Increase rates for Tech category by 15% on new deals.",
    });
  }

  const stalled = input.stalledBrandFollowUps[0];
  if (stalled && stalled.stalledDays >= 7) {
    candidates.push({
      score: 1.2 + stalled.stalledDays / 30,
      text: `Follow up with ${stalled.brandName} - no response in ${stalled.stalledDays} days.`,
    });
  }

  if (input.onTimeDeliveryRate < 0.8) {
    candidates.push({
      score: 1.35,
      text: `Your on-time rate dropped to ${Math.round(input.onTimeDeliveryRate * 100)}% - consider padding deadlines by 1-2 days.`,
    });
  }

  const mostDelayedBrand = input.paymentDelaysByBrand
    .filter((item) => item.totalPayments >= 2)
    .sort((a, b) => b.averageDelayDays - a.averageDelayDays)[0];
  if (
    mostDelayedBrand &&
    mostDelayedBrand.averageDelayDays >= 3 &&
    mostDelayedBrand.latePaymentRate >= 0.5
  ) {
    candidates.push({
      score: 1 + mostDelayedBrand.averageDelayDays / 10,
      text: `For ${mostDelayedBrand.brandName}, send invoices earlier and set a stricter payment follow-up cadence.`,
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      score: 0.1,
      text: "Performance is stable. Keep monitoring trends and re-run analytics next week.",
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECOMMENDATIONS)
    .map((item) => item.text);
}
