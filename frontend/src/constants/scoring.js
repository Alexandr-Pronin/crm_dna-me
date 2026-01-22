/**
 * Lead Scoring Configuration
 * As defined in FRONTEND_PLAN.md
 */

export const SCORE_THRESHOLDS = {
  COLD: { min: 0, max: 40, label: 'Cold', color: '#64748B', action: 'Nurture with content' },
  WARM: { min: 41, max: 80, label: 'Warm', color: '#F59E0B', action: 'BDR outreach' },
  HOT: { min: 81, max: 120, label: 'Hot', color: '#EF4444', action: 'AE demo call' },
  VERY_HOT: { min: 121, max: 999, label: 'Very Hot', color: '#DC2626', action: 'AE immediate contact' },
};

export const DEMOGRAPHIC_RULES = [
  { id: 'industry_biotech', condition: 'industry === "biotech" || industry === "pharma"', points: 20, description: 'Industry: Biotech/Pharma' },
  { id: 'company_size', condition: 'employee_count >= 50 && employee_count <= 500', points: 10, description: 'Company size: 50-500 employees' },
  { id: 'job_title_decision_maker', condition: 'title.includes("Director") || title.includes("Manager")', points: 10, description: 'Decision maker title' },
];

export const ENGAGEMENT_RULES = [
  { id: 'website_visit', event: 'page_view', points: 2, description: 'Website visit' },
  { id: 'pricing_page', event: 'page_view', condition: 'page === "/pricing"', points: 5, description: 'Pricing page view' },
  { id: 'roi_calculator', event: 'roi_calculator_submitted', points: 15, description: 'ROI calculator submitted' },
  { id: 'whitepaper_download', event: 'document_downloaded', points: 10, description: 'Whitepaper download' },
  { id: 'demo_request', event: 'demo_requested', points: 20, description: 'Demo requested' },
  { id: 'linkedin_profile_view', event: 'linkedin_profile_viewed', points: 3, description: 'LinkedIn profile viewed' },
  { id: 'linkedin_post_like', event: 'linkedin_post_liked', points: 2, description: 'LinkedIn post liked' },
  { id: 'linkedin_post_comment', event: 'linkedin_post_commented', points: 5, description: 'LinkedIn post commented' },
  { id: 'email_opened', event: 'email_opened', points: 1, description: 'Email opened' },
  { id: 'email_clicked', event: 'email_clicked', points: 3, description: 'Email link clicked' },
  { id: 'email_replied', event: 'email_replied', points: 10, description: 'Email replied' },
];

export const BEHAVIOR_RULES = [
  { id: 'multiple_visits', condition: 'visits_7_days >= 3', points: 10, description: '3+ visits in 7 days' },
  { id: 'pricing_and_case_study', condition: 'viewed_pricing && viewed_case_study', points: 15, description: 'Viewed pricing + case study' },
  { id: 'linkedin_engagement', condition: 'linkedin_interactions >= 3', points: 10, description: '3+ LinkedIn interactions' },
  { id: 'cold_email_reply', condition: 'replied_to_cold_email', points: 20, description: 'Cold email reply' },
  { id: 'webinar_attended', event: 'webinar_attended', points: 15, description: 'Webinar attended' },
  { id: 'sample_report_requested', event: 'sample_report_requested', points: 20, description: 'Sample report requested' },
  { id: 'order_placed', event: 'order_placed', points: 100, description: 'Order placed (auto-convert)' },
];

export const SCORE_DECAY = {
  decayStartDays: 14, // Start decay after 14 days of inactivity
  decayRatePerWeek: 0.1, // 10% decay per week
  maxDecayDays: 30, // Points expire after 30 days
};

/**
 * Get score threshold config based on score value
 */
export const getScoreThreshold = (score) => {
  if (score >= SCORE_THRESHOLDS.VERY_HOT.min) return SCORE_THRESHOLDS.VERY_HOT;
  if (score >= SCORE_THRESHOLDS.HOT.min) return SCORE_THRESHOLDS.HOT;
  if (score >= SCORE_THRESHOLDS.WARM.min) return SCORE_THRESHOLDS.WARM;
  return SCORE_THRESHOLDS.COLD;
};

export default SCORE_THRESHOLDS;
