ALTER TABLE deals
  ADD COLUMN compensation_model text NOT NULL DEFAULT 'FIXED',
  ADD COLUMN cash_percent integer NOT NULL DEFAULT 100,
  ADD COLUMN affiliate_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN guaranteed_cash_value numeric(12, 2),
  ADD COLUMN expected_affiliate_value numeric(12, 2);

ALTER TABLE deals
  ADD CONSTRAINT deals_cash_percent_range_check
    CHECK (cash_percent >= 0 AND cash_percent <= 100),
  ADD CONSTRAINT deals_affiliate_percent_range_check
    CHECK (affiliate_percent >= 0 AND affiliate_percent <= 100),
  ADD CONSTRAINT deals_compensation_percent_total_check
    CHECK (cash_percent + affiliate_percent = 100),
  ADD CONSTRAINT deals_compensation_model_check
    CHECK (compensation_model IN ('FIXED', 'AFFILIATE', 'HYBRID')),
  ADD CONSTRAINT deals_compensation_model_percent_check
    CHECK (
      (compensation_model = 'FIXED' AND cash_percent = 100 AND affiliate_percent = 0)
      OR (compensation_model = 'AFFILIATE' AND cash_percent = 0 AND affiliate_percent = 100)
      OR (compensation_model = 'HYBRID' AND cash_percent > 0 AND affiliate_percent > 0)
    );
