-- Custom SQL migration file, check you created this file in the correct directory.
-- Based on the user request and schema analysis.

CREATE OR REPLACE VIEW "calendar_events" AS
-- Deliverables
SELECT 
  'deliverable'::text as event_type,
  d.id as source_id,
  d.deal_id,
  d.scheduled_at as event_date,
  d.posted_at as completed_at,
  CONCAT(b.name, ' - ', d.platform, ' ', d.type) as title,
  d.status,
  deals.total_value as related_amount,
  'blue'::text as color
FROM deliverables d
JOIN deals ON d.deal_id = deals.id
JOIN brands b ON deals.brand_id = b.id
WHERE d.scheduled_at IS NOT NULL

UNION ALL

-- Payments
SELECT 
  'payment'::text as event_type,
  p.id as source_id,
  p.deal_id,
  p.expected_date as event_date,
  p.paid_at as completed_at,
  CONCAT(b.name, ' - Payment $', p.amount) as title,
  p.status,
  p.amount as related_amount,
  CASE 
    WHEN p.status = 'PAID' THEN 'green'::text
    WHEN p.status = 'OVERDUE' THEN 'red'::text
    ELSE 'yellow'::text
  END as color
FROM payments p
JOIN deals ON p.deal_id = deals.id
JOIN brands b ON deals.brand_id = b.id
WHERE p.expected_date IS NOT NULL

UNION ALL

-- Reminders
SELECT 
  'reminder'::text as event_type,
  r.id as source_id,
  r.deal_id,
  r.due_at as event_date,
  NULL::timestamp as completed_at,
  r.reason as title,
  r.status::text,
  NULL::numeric as related_amount,
  CASE r.priority
    WHEN 'CRITICAL' THEN 'red'::text
    WHEN 'HIGH' THEN 'orange'::text
    ELSE 'gray'::text
  END as color
FROM reminders r
JOIN deals ON r.deal_id = deals.id -- Join deals mostly for user filtering later if needed
WHERE r.status = 'OPEN';
