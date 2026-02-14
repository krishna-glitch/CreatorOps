type RevenueByCategoryPoint = {
  category: string;
  revenue: number;
};

type PaymentDelayByBrandPoint = {
  brandName: string;
  averageDelayDays: number;
  latePaymentRate: number;
  totalPayments: number;
};

type WonDealValueByWeekdayPoint = {
  weekday: number;
  averageValue: number;
  closedDeals: number;
};

export type InsightsGeneratorInput = {
  revenueByCategory: RevenueByCategoryPoint[];
  paymentDelaysByBrand: PaymentDelayByBrandPoint[];
  wonDealValueByWeekday: WonDealValueByWeekdayPoint[];
  currentQuarterAverageDealSize: number;
  previousQuarterAverageDealSize: number;
  currentQuarterClosedDeals: number;
  previousQuarterClosedDeals: number;
};

type InsightCandidate = {
  score: number;
  text: string;
};

const SIGNIFICANCE_THRESHOLD = 0.2;
const MAX_INSIGHTS = 5;

const WEEKDAY_LABEL: Record<number, string> = {
  0: "Sundays",
  1: "Mondays",
  2: "Tuesdays",
  3: "Wednesdays",
  4: "Thursdays",
  5: "Fridays",
  6: "Saturdays",
};

function asPercent(value: number) {
  return Math.round(value * 100);
}

export function generateInsights(input: InsightsGeneratorInput): string[] {
  const candidates: InsightCandidate[] = [];

  const categoryInsight = getCategoryRevenueOutperformanceInsight(
    input.revenueByCategory,
  );
  if (categoryInsight) {
    candidates.push(categoryInsight);
  }

  const weekdayInsight = getWeekdayCloseValueInsight(
    input.wonDealValueByWeekday,
  );
  if (weekdayInsight) {
    candidates.push(weekdayInsight);
  }

  const paymentDelayInsight = getPaymentDelayInsight(
    input.paymentDelaysByBrand,
  );
  if (paymentDelayInsight) {
    candidates.push(paymentDelayInsight);
  }

  const quarterGrowthInsight = getQuarterGrowthInsight({
    currentQuarterAverageDealSize: input.currentQuarterAverageDealSize,
    previousQuarterAverageDealSize: input.previousQuarterAverageDealSize,
    currentQuarterClosedDeals: input.currentQuarterClosedDeals,
    previousQuarterClosedDeals: input.previousQuarterClosedDeals,
  });
  if (quarterGrowthInsight) {
    candidates.push(quarterGrowthInsight);
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_INSIGHTS)
    .map((candidate) => candidate.text);
}

function getCategoryRevenueOutperformanceInsight(
  points: RevenueByCategoryPoint[],
): InsightCandidate | null {
  if (points.length < 2) {
    return null;
  }

  const normalized = points
    .filter((point) => point.revenue > 0)
    .map((point) => ({
      ...point,
      normalizedCategory: point.category.toLowerCase(),
    }));
  if (normalized.length < 2) {
    return null;
  }

  const techCategory = normalized.find((point) =>
    point.normalizedCategory.includes("tech"),
  );
  if (!techCategory) {
    return null;
  }

  const otherCategories = normalized.filter((point) => point !== techCategory);
  if (otherCategories.length === 0) {
    return null;
  }

  const baseline =
    otherCategories.reduce((sum, point) => sum + point.revenue, 0) /
    otherCategories.length;
  if (baseline <= 0) {
    return null;
  }

  const uplift = (techCategory.revenue - baseline) / baseline;
  if (uplift < SIGNIFICANCE_THRESHOLD) {
    return null;
  }

  return {
    score: uplift,
    text: `Your ${techCategory.category} category revenue is ${asPercent(uplift)}% higher than your other category average.`,
  };
}

function getWeekdayCloseValueInsight(
  points: WonDealValueByWeekdayPoint[],
): InsightCandidate | null {
  const eligible = points.filter(
    (point) => point.closedDeals >= 2 && point.averageValue > 0,
  );
  if (eligible.length < 2) {
    return null;
  }

  const bestDay = eligible.reduce((best, point) =>
    point.averageValue > best.averageValue ? point : best,
  );
  const comparisonPool = eligible.filter(
    (point) => point.weekday !== bestDay.weekday,
  );
  const comparisonWeight = comparisonPool.reduce(
    (sum, point) => sum + point.closedDeals,
    0,
  );
  if (comparisonWeight <= 0) {
    return null;
  }

  const comparisonAverage =
    comparisonPool.reduce(
      (sum, point) => sum + point.averageValue * point.closedDeals,
      0,
    ) / comparisonWeight;
  if (comparisonAverage <= 0) {
    return null;
  }

  const uplift = (bestDay.averageValue - comparisonAverage) / comparisonAverage;
  if (uplift < SIGNIFICANCE_THRESHOLD) {
    return null;
  }

  const dayLabel = WEEKDAY_LABEL[bestDay.weekday] ?? "that weekday";
  return {
    score: uplift,
    text: `Deals closed on ${dayLabel} average ${asPercent(uplift)}% higher value than other weekdays.`,
  };
}

function getPaymentDelayInsight(
  points: PaymentDelayByBrandPoint[],
): InsightCandidate | null {
  const eligible = points.filter((point) => point.totalPayments >= 2);
  if (eligible.length === 0) {
    return null;
  }

  const worstBrand = eligible.reduce((worst, point) =>
    point.averageDelayDays > worst.averageDelayDays ? point : worst,
  );

  if (worstBrand.averageDelayDays < 1 || worstBrand.latePaymentRate < 0.8) {
    return null;
  }

  return {
    score: worstBrand.latePaymentRate + worstBrand.averageDelayDays / 30,
    text: `${worstBrand.brandName} usually pays late by about ${worstBrand.averageDelayDays.toFixed(1)} days (${asPercent(worstBrand.latePaymentRate)}% of payments).`,
  };
}

function getQuarterGrowthInsight(input: {
  currentQuarterAverageDealSize: number;
  previousQuarterAverageDealSize: number;
  currentQuarterClosedDeals: number;
  previousQuarterClosedDeals: number;
}): InsightCandidate | null {
  if (
    input.currentQuarterClosedDeals < 2 ||
    input.previousQuarterClosedDeals < 2 ||
    input.previousQuarterAverageDealSize <= 0
  ) {
    return null;
  }

  const growth =
    (input.currentQuarterAverageDealSize -
      input.previousQuarterAverageDealSize) /
    input.previousQuarterAverageDealSize;
  if (growth < SIGNIFICANCE_THRESHOLD) {
    return null;
  }

  return {
    score: growth,
    text: `Your average deal size increased ${asPercent(growth)}% this quarter.`,
  };
}
