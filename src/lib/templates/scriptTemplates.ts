export type ScriptTemplateCategory =
  | "Product Review"
  | "Unboxing"
  | "Tutorial/How-To"
  | "Brand Collaboration"
  | "Behind the Scenes"
  | "Day in the Life"
  | "Product Comparison"
  | "Tips & Tricks"
  | "Storytelling"
  | "Educational";

export type ScriptTemplatePlatform = "Instagram" | "YouTube" | "TikTok" | "All";

export type ScriptTemplateDuration = "15s" | "30s" | "60s" | "Long";

export interface ScriptTemplatePlaceholder {
  key: string;
  label: string;
  example: string;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  category: ScriptTemplateCategory;
  platform: ScriptTemplatePlatform;
  duration: ScriptTemplateDuration;
  template: string;
  placeholders: ScriptTemplatePlaceholder[];
}

export const scriptTemplates: ScriptTemplate[] = [
  {
    id: "product-review-reel-30",
    name: "Product Review (30s Reel)",
    category: "Product Review",
    platform: "Instagram",
    duration: "30s",
    template: `[HOOK]
I tested {product_name} for {testing_period}, and this is the honest review I wish I had before buying it. If you are {target_user}, stay to the end because one thing surprised me.

[BODY]
First impression: {first_impression}. I used it in {use_case_1}, {use_case_2}, and {use_case_3} so this is not a one-day opinion.
What I liked most:
- {feature_1}
- {feature_2}
- {feature_3}
What needs work: {drawback_1} and {drawback_2}. The quality-to-price ratio felt {value_verdict} compared with {alternative_product}.
If your priority is {buyer_priority}, this product is a {fit_rating}. If your priority is {other_priority}, you may want to skip it.

[CTA]
If you want the full breakdown, comment "{comment_keyword}" and I will drop my detailed notes. If you decide to try it, use code {discount_code} for {discount_amount} off at {store_name}.

[PLATFORM NOTES]
Keep cuts fast every 2-3 seconds, show close-up b-roll during each feature point, and place your key verdict text on screen in the first 4 seconds for reel retention.`,
    placeholders: [
      {
        key: "product_name",
        label: "Product Name",
        example: "Nike Air Max DN",
      },
      { key: "testing_period", label: "Testing Period", example: "21 days" },
      {
        key: "target_user",
        label: "Target Viewer",
        example: "on-your-feet all day",
      },
      {
        key: "first_impression",
        label: "First Impression",
        example: "premium but lighter than expected",
      },
      { key: "use_case_1", label: "Use Case 1", example: "commutes" },
      { key: "use_case_2", label: "Use Case 2", example: "gym sessions" },
      { key: "use_case_3", label: "Use Case 3", example: "weekend travel" },
      {
        key: "feature_1",
        label: "Top Feature 1",
        example: "all-day cushioning",
      },
      { key: "feature_2", label: "Top Feature 2", example: "breathable upper" },
      {
        key: "feature_3",
        label: "Top Feature 3",
        example: "easy-to-clean finish",
      },
      {
        key: "drawback_1",
        label: "Drawback 1",
        example: "runs narrow in the toe box",
      },
      {
        key: "drawback_2",
        label: "Drawback 2",
        example: "limited color options",
      },
      {
        key: "value_verdict",
        label: "Value Verdict",
        example: "fair for the comfort level",
      },
      {
        key: "alternative_product",
        label: "Alternative Product",
        example: "Adidas Ultraboost Light",
      },
      {
        key: "buyer_priority",
        label: "Primary Buyer Priority",
        example: "comfort",
      },
      {
        key: "other_priority",
        label: "Secondary Buyer Priority",
        example: "minimal weight",
      },
      { key: "fit_rating", label: "Fit Rating", example: "strong fit" },
      { key: "comment_keyword", label: "Comment Keyword", example: "REVIEW" },
      { key: "discount_code", label: "Discount Code", example: "CREATOR15" },
      { key: "discount_amount", label: "Discount Amount", example: "15%" },
      { key: "store_name", label: "Store Name", example: "SportHub" },
    ],
  },
  {
    id: "product-review-youtube-short-60",
    name: "Product Review (YouTube Short 60s)",
    category: "Product Review",
    platform: "YouTube",
    duration: "60s",
    template: `[HOOK]
Everyone keeps asking if {product_name} is actually worth {price_point}, so I ran a {testing_period} test to find out.

[BODY]
Here is my setup: {creator_profile}, and I used this product for {task_1}, {task_2}, and {task_3}. Out of the box, the best surprise was {best_surprise}. The biggest concern was {main_concern}, but after day {milestone_day}, it improved because {what_changed}.
Performance breakdown:
- Build quality: {build_quality_score}/10 because {build_quality_reason}
- Ease of use: {usability_score}/10 because {usability_reason}
- Results: {results_score}/10 because {results_reason}
Compared to {competitor_name}, this one wins at {win_category} but loses at {loss_category}.
My final verdict: {final_verdict}. Buy it if you are {ideal_buyer}. Skip it if you are {non_ideal_buyer}.

[CTA]
Comment "{comment_keyword}" if you want the side-by-side chart, and subscribe for my {niche_topic} deep dives every {posting_frequency}.

[PLATFORM NOTES]
Use chapter-like text cards every 10 seconds, pin the verdict in the top comment, and keep pacing conversational with one camera change before the 20-second mark to maintain short-form watch time.`,
    placeholders: [
      { key: "product_name", label: "Product Name", example: "Sony ZV-E10 II" },
      { key: "price_point", label: "Price Point", example: "$899" },
      { key: "testing_period", label: "Testing Period", example: "14-day" },
      {
        key: "creator_profile",
        label: "Creator Profile",
        example: "solo travel vlogger",
      },
      { key: "task_1", label: "Task 1", example: "indoor talking-head videos" },
      { key: "task_2", label: "Task 2", example: "night street footage" },
      { key: "task_3", label: "Task 3", example: "run-and-gun b-roll" },
      {
        key: "best_surprise",
        label: "Best Surprise",
        example: "autofocus locked quickly",
      },
      {
        key: "main_concern",
        label: "Main Concern",
        example: "battery drained fast in 4K",
      },
      { key: "milestone_day", label: "Milestone Day", example: "3" },
      {
        key: "what_changed",
        label: "What Changed",
        example: "I switched to eco mode",
      },
      {
        key: "build_quality_score",
        label: "Build Quality Score",
        example: "8",
      },
      {
        key: "build_quality_reason",
        label: "Build Quality Reason",
        example: "solid body with responsive buttons",
      },
      { key: "usability_score", label: "Usability Score", example: "9" },
      {
        key: "usability_reason",
        label: "Usability Reason",
        example: "intuitive menu and flip screen",
      },
      { key: "results_score", label: "Results Score", example: "8" },
      {
        key: "results_reason",
        label: "Results Reason",
        example: "sharp footage with balanced color",
      },
      {
        key: "competitor_name",
        label: "Competitor Name",
        example: "Canon R50",
      },
      {
        key: "win_category",
        label: "Win Category",
        example: "autofocus speed",
      },
      {
        key: "loss_category",
        label: "Loss Category",
        example: "low-light noise",
      },
      {
        key: "final_verdict",
        label: "Final Verdict",
        example: "worth it for most new creators",
      },
      {
        key: "ideal_buyer",
        label: "Ideal Buyer",
        example: "shooting hybrid content weekly",
      },
      {
        key: "non_ideal_buyer",
        label: "Non-Ideal Buyer",
        example: "needing full-frame low light",
      },
      { key: "comment_keyword", label: "Comment Keyword", example: "CHART" },
      { key: "niche_topic", label: "Niche Topic", example: "camera gear" },
      { key: "posting_frequency", label: "Posting Frequency", example: "week" },
    ],
  },
  {
    id: "unboxing-tiktok-30",
    name: "Unboxing (TikTok 30s)",
    category: "Unboxing",
    platform: "TikTok",
    duration: "30s",
    template: `[HOOK]
POV: your {package_type} from {brand_name} just arrived, and we are opening it together with zero edits on first impressions.

[BODY]
First, the packaging: {packaging_style}. It feels {packaging_feel}, and the detail that stood out immediately was {packaging_detail}.
Inside the box, we have:
- {item_1}
- {item_2}
- {item_3}
Quick quality check: {quality_check_result}. The finish looks {finish_description}, and the scent/material feel is {sensory_note}.
Now for the surprise moment: {surprise_moment}. I expected {expectation} but got {reality}, which honestly makes this unboxing {emotion_word}.
Setup time took {setup_time}, and the first test was {first_test}. Initial verdict before full review: {initial_verdict}.

[CTA]
Should I do a full 7-day test and post part 2? Comment "{comment_keyword}" and tell me what you want me to test first. You can find the exact model at {store_name} under {product_line}.

[PLATFORM NOTES]
Use satisfying audio layers for tape peel and box opening, add rapid text overlays for each item reveal, and place the biggest reaction clip in the first 2 seconds to boost TikTok completion rate.`,
    placeholders: [
      { key: "package_type", label: "Package Type", example: "PR package" },
      { key: "brand_name", label: "Brand Name", example: "GlowLab" },
      {
        key: "packaging_style",
        label: "Packaging Style",
        example: "minimal matte black box",
      },
      {
        key: "packaging_feel",
        label: "Packaging Feel",
        example: "luxury and sturdy",
      },
      {
        key: "packaging_detail",
        label: "Packaging Detail",
        example: "embossed logo and magnetic flap",
      },
      { key: "item_1", label: "Item 1", example: "Vitamin C serum" },
      { key: "item_2", label: "Item 2", example: "hydration cream" },
      { key: "item_3", label: "Item 3", example: "travel-size cleanser" },
      {
        key: "quality_check_result",
        label: "Quality Check",
        example: "no leaks, all seals intact",
      },
      {
        key: "finish_description",
        label: "Finish Description",
        example: "clean and premium",
      },
      {
        key: "sensory_note",
        label: "Sensory Note",
        example: "light citrus scent",
      },
      {
        key: "surprise_moment",
        label: "Surprise Moment",
        example: "a handwritten thank-you card",
      },
      { key: "expectation", label: "Expectation", example: "two products" },
      { key: "reality", label: "Reality", example: "a full starter kit" },
      { key: "emotion_word", label: "Emotion", example: "genuinely exciting" },
      { key: "setup_time", label: "Setup Time", example: "under five minutes" },
      {
        key: "first_test",
        label: "First Test",
        example: "swatch and texture test",
      },
      {
        key: "initial_verdict",
        label: "Initial Verdict",
        example: "promising and giftable",
      },
      { key: "comment_keyword", label: "Comment Keyword", example: "PART2" },
      {
        key: "store_name",
        label: "Store Name",
        example: "GlowLab online store",
      },
      { key: "product_line", label: "Product Line", example: "Radiance Set" },
    ],
  },
  {
    id: "unboxing-youtube-long",
    name: "Unboxing Video (YouTube Long)",
    category: "Unboxing",
    platform: "YouTube",
    duration: "Long",
    template: `[HOOK]
Today we are unboxing the {product_bundle_name} from {brand_name}, and I am checking every detail so you can decide if it is worth your money before you buy.

[BODY]
Let us start with shipping and presentation. The box arrived in {shipping_condition}, and the outer packaging looked {outer_packaging_state}. Opening it up, I immediately notice {first_visual_detail}.
Everything included in this bundle:
- {bundle_item_1}
- {bundle_item_2}
- {bundle_item_3}
- {bundle_item_4}
For each item, I will score design ({design_score}/10), practicality ({practicality_score}/10), and perceived value ({value_score}/10).
Assembly/setup walkthrough: {setup_steps_summary}. Time to fully set up was {setup_time}, and the only confusing part was {setup_challenge}.
First-use test: {first_use_test}. The result was {first_use_result}.
Pros so far: {pro_1}, {pro_2}, {pro_3}. Cons so far: {con_1}, {con_2}.

[CTA]
If you want my 30-day follow-up with durability results, subscribe and comment "{comment_keyword}". I linked timestamps and product links in the description under {description_section_name}.

[PLATFORM NOTES]
Use clear chapter timestamps, keep an overhead unboxing camera plus face-cam reaction, and include mid-roll recap graphics after each item segment so long-form viewers can rejoin context quickly.`,
    placeholders: [
      {
        key: "product_bundle_name",
        label: "Product Bundle Name",
        example: "Creator Desk Setup Kit",
      },
      { key: "brand_name", label: "Brand Name", example: "StudioForge" },
      {
        key: "shipping_condition",
        label: "Shipping Condition",
        example: "two days early with no dents",
      },
      {
        key: "outer_packaging_state",
        label: "Outer Packaging State",
        example: "clean and secure",
      },
      {
        key: "first_visual_detail",
        label: "First Visual Detail",
        example: "foam inserts around every component",
      },
      {
        key: "bundle_item_1",
        label: "Bundle Item 1",
        example: "USB-C microphone",
      },
      {
        key: "bundle_item_2",
        label: "Bundle Item 2",
        example: "adjustable arm stand",
      },
      {
        key: "bundle_item_3",
        label: "Bundle Item 3",
        example: "RGB key light",
      },
      {
        key: "bundle_item_4",
        label: "Bundle Item 4",
        example: "cable organizer pack",
      },
      { key: "design_score", label: "Design Score", example: "8" },
      { key: "practicality_score", label: "Practicality Score", example: "9" },
      { key: "value_score", label: "Value Score", example: "8" },
      {
        key: "setup_steps_summary",
        label: "Setup Steps Summary",
        example: "mount mic, balance arm, pair light",
      },
      { key: "setup_time", label: "Setup Time", example: "18 minutes" },
      {
        key: "setup_challenge",
        label: "Setup Challenge",
        example: "threading the arm cable clip",
      },
      {
        key: "first_use_test",
        label: "First Use Test",
        example: "recording a podcast intro",
      },
      {
        key: "first_use_result",
        label: "First Use Result",
        example: "clean audio with little background noise",
      },
      { key: "pro_1", label: "Pro 1", example: "excellent cable management" },
      { key: "pro_2", label: "Pro 2", example: "premium build for the price" },
      {
        key: "pro_3",
        label: "Pro 3",
        example: "quick setup once instructions are clear",
      },
      { key: "con_1", label: "Con 1", example: "manual is too brief" },
      { key: "con_2", label: "Con 2", example: "light stand base is wide" },
      { key: "comment_keyword", label: "Comment Keyword", example: "FOLLOWUP" },
      {
        key: "description_section_name",
        label: "Description Section",
        example: "Gear Links",
      },
    ],
  },
  {
    id: "tutorial-instagram-60",
    name: "Tutorial/How-To (Instagram 60s)",
    category: "Tutorial/How-To",
    platform: "Instagram",
    duration: "60s",
    template: `[HOOK]
If you are struggling with {problem_statement}, here is the exact {step_count}-step system I use to get {desired_outcome} without wasting hours.

[BODY]
Step 1: {step_1_title}. Start by {step_1_action}. Common mistake: {step_1_mistake}. Quick fix: {step_1_fix}.
Step 2: {step_2_title}. Next, {step_2_action}. You will know it is working when {step_2_success_signal}.
Step 3: {step_3_title}. Then {step_3_action} using {tool_name}. Keep this setting at {important_setting} for consistency.
Step 4: {step_4_title}. Finalize by {step_4_action}, and double-check {quality_check_item} before posting.
Time saved with this workflow: {time_saved}. Cost of tools used: {tool_cost_note}.
Who this is for: {ideal_user}. Who may need a different method: {non_ideal_user}.

[CTA]
Save this reel so you can follow it step-by-step later, and comment "{comment_keyword}" if you want my checklist template for {workflow_name}.

[PLATFORM NOTES]
Use large on-screen step numbers, keep each step under 12 seconds, add a progress bar at the top, and repeat the final result shot at the end for rewatch-driven saves on Instagram.`,
    placeholders: [
      {
        key: "problem_statement",
        label: "Problem Statement",
        example: "inconsistent lighting in reels",
      },
      { key: "step_count", label: "Step Count", example: "4" },
      {
        key: "desired_outcome",
        label: "Desired Outcome",
        example: "clean studio-quality videos",
      },
      {
        key: "step_1_title",
        label: "Step 1 Title",
        example: "Control Window Light",
      },
      {
        key: "step_1_action",
        label: "Step 1 Action",
        example: "face the window at a 45-degree angle",
      },
      {
        key: "step_1_mistake",
        label: "Step 1 Mistake",
        example: "placing window directly behind you",
      },
      {
        key: "step_1_fix",
        label: "Step 1 Fix",
        example: "rotate your desk and add a curtain diffuser",
      },
      {
        key: "step_2_title",
        label: "Step 2 Title",
        example: "Set White Balance",
      },
      {
        key: "step_2_action",
        label: "Step 2 Action",
        example: "lock white balance manually before recording",
      },
      {
        key: "step_2_success_signal",
        label: "Step 2 Success Signal",
        example: "skin tone stays consistent between cuts",
      },
      { key: "step_3_title", label: "Step 3 Title", example: "Dial Exposure" },
      {
        key: "step_3_action",
        label: "Step 3 Action",
        example: "lower exposure until highlights are preserved",
      },
      { key: "tool_name", label: "Tool Name", example: "Filmic Pro" },
      {
        key: "important_setting",
        label: "Important Setting",
        example: "ISO under 200",
      },
      {
        key: "step_4_title",
        label: "Step 4 Title",
        example: "Color Match Clips",
      },
      {
        key: "step_4_action",
        label: "Step 4 Action",
        example: "apply one LUT and adjust intensity to 60%",
      },
      {
        key: "quality_check_item",
        label: "Quality Check Item",
        example: "skin tone and shadow detail",
      },
      {
        key: "time_saved",
        label: "Time Saved",
        example: "30 minutes per shoot",
      },
      {
        key: "tool_cost_note",
        label: "Tool Cost Note",
        example: "all free except optional tripod",
      },
      {
        key: "ideal_user",
        label: "Ideal User",
        example: "solo creators filming at home",
      },
      {
        key: "non_ideal_user",
        label: "Non-Ideal User",
        example: "advanced multicam studio teams",
      },
      {
        key: "comment_keyword",
        label: "Comment Keyword",
        example: "CHECKLIST",
      },
      {
        key: "workflow_name",
        label: "Workflow Name",
        example: "lighting setup",
      },
    ],
  },
  {
    id: "tutorial-youtube-long",
    name: "Tutorial/How-To (YouTube Deep Dive)",
    category: "Tutorial/How-To",
    platform: "YouTube",
    duration: "Long",
    template: `[HOOK]
In this video, I will show you how to {goal_action} from start to finish, even if you are a complete beginner with {starting_point}.

[BODY]
Here is the roadmap: {module_1}, {module_2}, and {module_3}. By the end, you will have {end_result}.
Module 1 - Setup: We begin by {setup_action}. Required tools: {required_tools}. Optional upgrades: {optional_tools}.
Module 2 - Execution: Next, {execution_action}. Watch for this common error: {common_error}. If it happens, fix it by {error_fix}.
Module 3 - Optimization: Then {optimization_action}. Measure success with {metric_name}. A strong benchmark is {benchmark_value}.
My personal shortcut: {personal_shortcut}. It reduces {pain_point} and saves about {time_saved_estimate} each project.
If you are following along live, pause now and complete {checkpoint_task} before moving on.

[CTA]
Download the companion template from {resource_location}, and comment "{comment_keyword}" if you want part 2 on {follow_up_topic}. Subscribe for weekly {content_pillar} tutorials.

[PLATFORM NOTES]
Add clear chapters in the timeline, include zoom-ins during software steps, and restate outcomes every few minutes so long-form viewers stay oriented and keep average view duration high.`,
    placeholders: [
      {
        key: "goal_action",
        label: "Goal Action",
        example: "edit cinematic b-roll on your phone",
      },
      {
        key: "starting_point",
        label: "Starting Point",
        example: "mobile editing apps",
      },
      { key: "module_1", label: "Module 1", example: "project setup" },
      { key: "module_2", label: "Module 2", example: "sequence editing" },
      { key: "module_3", label: "Module 3", example: "color and export" },
      {
        key: "end_result",
        label: "End Result",
        example: "a polished 45-second reel",
      },
      {
        key: "setup_action",
        label: "Setup Action",
        example: "organizing clips into labeled bins",
      },
      {
        key: "required_tools",
        label: "Required Tools",
        example: "CapCut and a phone tripod",
      },
      {
        key: "optional_tools",
        label: "Optional Tools",
        example: "ND filter and external mic",
      },
      {
        key: "execution_action",
        label: "Execution Action",
        example: "syncing clips to beat markers",
      },
      {
        key: "common_error",
        label: "Common Error",
        example: "jump cuts that break continuity",
      },
      {
        key: "error_fix",
        label: "Error Fix",
        example: "insert a 0.3-second transition b-roll clip",
      },
      {
        key: "optimization_action",
        label: "Optimization Action",
        example: "compressing export settings for upload",
      },
      {
        key: "metric_name",
        label: "Metric Name",
        example: "retention at 15 seconds",
      },
      {
        key: "benchmark_value",
        label: "Benchmark Value",
        example: "above 65%",
      },
      {
        key: "personal_shortcut",
        label: "Personal Shortcut",
        example: "reusing a saved color preset",
      },
      {
        key: "pain_point",
        label: "Pain Point",
        example: "manual color correction",
      },
      {
        key: "time_saved_estimate",
        label: "Time Saved Estimate",
        example: "20 minutes",
      },
      {
        key: "checkpoint_task",
        label: "Checkpoint Task",
        example: "assembling your rough cut",
      },
      {
        key: "resource_location",
        label: "Resource Location",
        example: "the first link in description",
      },
      { key: "comment_keyword", label: "Comment Keyword", example: "PART2" },
      {
        key: "follow_up_topic",
        label: "Follow Up Topic",
        example: "advanced transitions",
      },
      {
        key: "content_pillar",
        label: "Content Pillar",
        example: "video editing",
      },
    ],
  },
  {
    id: "brand-collab-instagram-30",
    name: "Brand Collaboration (Instagram Reel 30s)",
    category: "Brand Collaboration",
    platform: "Instagram",
    duration: "30s",
    template: `[HOOK]
Paid partnership with {brand_name}, and I said yes for one reason: {core_reason}. Let me show you exactly how I use {product_name} in my real routine.

[BODY]
Context first: I am {creator_identity}, and my audience asks me about {audience_problem} all the time.
Today I used {product_name} during {routine_moment_1}, {routine_moment_2}, and {routine_moment_3}.
What stood out:
- {benefit_1}
- {benefit_2}
- {benefit_3}
Honest note: {disclosure_note}. Best fit for people who are {ideal_customer_profile}. If you are {non_ideal_profile}, start with {starter_recommendation}.
My favorite result after {use_duration}: {result_statement}. This is why the collab felt aligned with my content values: {values_alignment}.

[CTA]
Check the link in bio for full details, and use code {discount_code} for {discount_amount} off until {expiry_date}. Drop "{comment_keyword}" if you want my full routine breakdown.

[PLATFORM NOTES]
Keep disclosure visible at the top, show lifestyle footage over direct ad shots, and place branded product demo in the middle so the hook feels creator-first and native to Instagram reels.`,
    placeholders: [
      { key: "brand_name", label: "Brand Name", example: "HydraFuel" },
      {
        key: "core_reason",
        label: "Core Reason",
        example: "it solved my afternoon energy crash",
      },
      {
        key: "product_name",
        label: "Product Name",
        example: "HydraFuel Electrolyte Mix",
      },
      {
        key: "creator_identity",
        label: "Creator Identity",
        example: "a fitness coach and busy parent",
      },
      {
        key: "audience_problem",
        label: "Audience Problem",
        example: "staying hydrated during long workdays",
      },
      {
        key: "routine_moment_1",
        label: "Routine Moment 1",
        example: "morning training",
      },
      {
        key: "routine_moment_2",
        label: "Routine Moment 2",
        example: "midday work block",
      },
      {
        key: "routine_moment_3",
        label: "Routine Moment 3",
        example: "evening walk",
      },
      {
        key: "benefit_1",
        label: "Benefit 1",
        example: "mixes quickly with no chalky texture",
      },
      {
        key: "benefit_2",
        label: "Benefit 2",
        example: "balanced flavor without extra sugar",
      },
      {
        key: "benefit_3",
        label: "Benefit 3",
        example: "easy single-serve packets",
      },
      {
        key: "disclosure_note",
        label: "Disclosure Note",
        example: "this is sponsored, but opinions are fully mine",
      },
      {
        key: "ideal_customer_profile",
        label: "Ideal Customer Profile",
        example: "active people who forget to hydrate",
      },
      {
        key: "non_ideal_profile",
        label: "Non-Ideal Profile",
        example: "sensitive to flavored drinks",
      },
      {
        key: "starter_recommendation",
        label: "Starter Recommendation",
        example: "the unflavored sample pack",
      },
      { key: "use_duration", label: "Use Duration", example: "three weeks" },
      {
        key: "result_statement",
        label: "Result Statement",
        example: "fewer afternoon headaches",
      },
      {
        key: "values_alignment",
        label: "Values Alignment",
        example: "transparent ingredients and practical pricing",
      },
      { key: "discount_code", label: "Discount Code", example: "COACH20" },
      { key: "discount_amount", label: "Discount Amount", example: "20%" },
      { key: "expiry_date", label: "Expiry Date", example: "May 31" },
      { key: "comment_keyword", label: "Comment Keyword", example: "ROUTINE" },
    ],
  },
  {
    id: "brand-collab-youtube-short-60",
    name: "Brand Collaboration (YouTube Short 60s)",
    category: "Brand Collaboration",
    platform: "YouTube",
    duration: "60s",
    template: `[HOOK]
This video is sponsored by {brand_name}, but I only accept partnerships when I can show you real before-and-after results. Here is what happened with {product_name}.

[BODY]
My baseline was {baseline_condition}. For {test_duration}, I used the product in {usage_context_1} and {usage_context_2}.
To keep this fair, I tracked outcomes in a simple log and reviewed progress at the same time each day.
Week 1 result: {week_1_result}. Week 2 result: {week_2_result}. Biggest difference by the end: {final_difference}.
What I liked most:
- {top_like_1}
- {top_like_2}
- {top_like_3}
What could be better: {improvement_area}.
Who should consider it: {ideal_audience}. Who should pass: {not_for_audience}.
Why this sponsor made sense for my channel: {channel_alignment_reason}. Transparency note: {transparency_statement}.
If you are evaluating similar tools, compare onboarding time, daily friction, and output consistency before you decide.

[CTA]
If you want my full comparison spreadsheet, comment "{comment_keyword}". You can use code {discount_code} for {discount_amount} off at checkout through {checkout_path}.

[PLATFORM NOTES]
Mention sponsorship in the first 5 seconds, use side-by-side before/after visuals around 20 seconds, and keep one clear takeaway sentence at the end so short-form viewers remember the value proposition.`,
    placeholders: [
      { key: "brand_name", label: "Brand Name", example: "DeskFlow" },
      {
        key: "product_name",
        label: "Product Name",
        example: "DeskFlow Task Planner",
      },
      {
        key: "baseline_condition",
        label: "Baseline Condition",
        example: "missing deadlines twice a week",
      },
      { key: "test_duration", label: "Test Duration", example: "14 days" },
      {
        key: "usage_context_1",
        label: "Usage Context 1",
        example: "content planning",
      },
      {
        key: "usage_context_2",
        label: "Usage Context 2",
        example: "brand deliverable tracking",
      },
      {
        key: "week_1_result",
        label: "Week 1 Result",
        example: "tasks felt more organized",
      },
      {
        key: "week_2_result",
        label: "Week 2 Result",
        example: "zero missed due dates",
      },
      {
        key: "final_difference",
        label: "Final Difference",
        example: "better focus and fewer last-minute edits",
      },
      {
        key: "top_like_1",
        label: "Top Like 1",
        example: "clean weekly dashboard",
      },
      {
        key: "top_like_2",
        label: "Top Like 2",
        example: "easy recurring task setup",
      },
      {
        key: "top_like_3",
        label: "Top Like 3",
        example: "mobile reminders that actually help",
      },
      {
        key: "improvement_area",
        label: "Improvement Area",
        example: "more customization in calendar colors",
      },
      {
        key: "ideal_audience",
        label: "Ideal Audience",
        example: "creators managing multiple clients",
      },
      {
        key: "not_for_audience",
        label: "Not For Audience",
        example: "people who prefer paper systems",
      },
      {
        key: "channel_alignment_reason",
        label: "Channel Alignment",
        example: "my channel teaches sustainable creator workflows",
      },
      {
        key: "transparency_statement",
        label: "Transparency Statement",
        example: "sponsorship approved, script opinions are mine",
      },
      { key: "comment_keyword", label: "Comment Keyword", example: "SHEET" },
      { key: "discount_code", label: "Discount Code", example: "FLOW15" },
      { key: "discount_amount", label: "Discount Amount", example: "15%" },
      {
        key: "checkout_path",
        label: "Checkout Path",
        example: "the pinned comment link",
      },
    ],
  },
  {
    id: "behind-scenes-tiktok-30",
    name: "Behind the Scenes (TikTok 30s)",
    category: "Behind the Scenes",
    platform: "TikTok",
    duration: "30s",
    template: `[HOOK]
You see the final {content_type}, but here is what actually happens behind the scenes in my {production_window} production sprint.

[BODY]
Phase 1 - Planning: I start with {planning_tool} and map {planning_inputs}. This takes {planning_time}.
Phase 2 - Shooting: My setup is {camera_setup}, {lighting_setup}, and {audio_setup}. Biggest challenge today: {shooting_challenge}. Quick fix: {shooting_fix}.
Phase 3 - Editing: I cut in {editing_tool} using this structure: {edit_structure}. The most time-consuming part is {editing_bottleneck}.
Phase 4 - Publish Prep: I write captions with {caption_framework} and schedule at {posting_time} based on {audience_signal}.
Total creation time: {total_time}. Final deliverable count: {deliverable_count}.
Budget note: this setup cost around {budget_note}, and it still works for small creators who are optimizing for consistency over perfection.
The biggest behind-the-scenes lesson today was {bts_lesson}, which I now add to every future shoot checklist.

[CTA]
If you want my exact behind-the-scenes checklist, comment "{comment_keyword}" and I will post a template you can copy for your own shoots.

[PLATFORM NOTES]
Use quick montage clips with punchy transitions, overlay each phase with bold labels, and include one messy real-life moment to increase authenticity and connection on TikTok.`,
    placeholders: [
      { key: "content_type", label: "Content Type", example: "brand reel" },
      {
        key: "production_window",
        label: "Production Window",
        example: "2-hour",
      },
      { key: "planning_tool", label: "Planning Tool", example: "Notion board" },
      {
        key: "planning_inputs",
        label: "Planning Inputs",
        example: "hook, key shots, and CTA",
      },
      { key: "planning_time", label: "Planning Time", example: "15 minutes" },
      {
        key: "camera_setup",
        label: "Camera Setup",
        example: "iPhone 15 Pro on tripod",
      },
      {
        key: "lighting_setup",
        label: "Lighting Setup",
        example: "window light plus softbox",
      },
      { key: "audio_setup", label: "Audio Setup", example: "wireless lav mic" },
      {
        key: "shooting_challenge",
        label: "Shooting Challenge",
        example: "harsh shadows near noon",
      },
      {
        key: "shooting_fix",
        label: "Shooting Fix",
        example: "moved setup and diffused window",
      },
      { key: "editing_tool", label: "Editing Tool", example: "CapCut" },
      {
        key: "edit_structure",
        label: "Edit Structure",
        example: "hook, proof, payoff",
      },
      {
        key: "editing_bottleneck",
        label: "Editing Bottleneck",
        example: "syncing captions manually",
      },
      {
        key: "caption_framework",
        label: "Caption Framework",
        example: "problem, promise, proof",
      },
      { key: "posting_time", label: "Posting Time", example: "7:30 PM" },
      {
        key: "audience_signal",
        label: "Audience Signal",
        example: "peak follower activity",
      },
      { key: "total_time", label: "Total Time", example: "1 hour 52 minutes" },
      {
        key: "deliverable_count",
        label: "Deliverable Count",
        example: "3 short videos",
      },
      {
        key: "budget_note",
        label: "Budget Note",
        example: "$300 total gear setup",
      },
      {
        key: "bts_lesson",
        label: "BTS Lesson",
        example: "pre-lighting saves more time than fast editing",
      },
      { key: "comment_keyword", label: "Comment Keyword", example: "BTS" },
    ],
  },
  {
    id: "day-in-life-instagram-60",
    name: "Day in the Life (Instagram 60s)",
    category: "Day in the Life",
    platform: "Instagram",
    duration: "60s",
    template: `[HOOK]
A realistic day in my life as a {creator_role}, including what I planned, what went wrong, and how I still finished {daily_goal}.

[BODY]
Morning ({morning_time}): I start with {morning_routine_step_1} and {morning_routine_step_2}. Priority for the first block is {morning_priority}.
Midday ({midday_time}): I move into {midday_task_1} and {midday_task_2}. Unexpected issue: {unexpected_issue}. I adjusted by {adjustment_action}.
Afternoon ({afternoon_time}): Focus shifts to {afternoon_task}. Energy check was {energy_state}, so I used {focus_strategy}.
Evening ({evening_time}): I wrap with {evening_task_1} and {evening_task_2}, then prep tomorrow by {prep_action}.
Biggest win: {biggest_win}. Biggest lesson: {biggest_lesson}. Total output today: {output_summary}.
Reality check: I had to say no to {declined_task} so I could protect quality on priority work.
Mood shift moment: {mood_shift_moment}, and that reset helped me finish strong without rushing the final edits.

[CTA]
If you want this as a repeatable time-block template, comment "{comment_keyword}" and I will share my exact day planner format.

[PLATFORM NOTES]
Use timestamp overlays for each day segment, blend voiceover with ambient clips for realism, and keep one candid challenge moment to avoid over-polished vlog energy on Instagram.`,
    placeholders: [
      {
        key: "creator_role",
        label: "Creator Role",
        example: "full-time fashion creator",
      },
      {
        key: "daily_goal",
        label: "Daily Goal",
        example: "two paid posts and one organic reel",
      },
      { key: "morning_time", label: "Morning Time", example: "7:00 AM" },
      {
        key: "morning_routine_step_1",
        label: "Morning Routine Step 1",
        example: "30-minute walk",
      },
      {
        key: "morning_routine_step_2",
        label: "Morning Routine Step 2",
        example: "reviewing campaign brief",
      },
      {
        key: "morning_priority",
        label: "Morning Priority",
        example: "shooting first before meetings",
      },
      { key: "midday_time", label: "Midday Time", example: "12:30 PM" },
      {
        key: "midday_task_1",
        label: "Midday Task 1",
        example: "editing brand clips",
      },
      {
        key: "midday_task_2",
        label: "Midday Task 2",
        example: "client revision call",
      },
      {
        key: "unexpected_issue",
        label: "Unexpected Issue",
        example: "SD card corrupted one take",
      },
      {
        key: "adjustment_action",
        label: "Adjustment Action",
        example: "re-shot with backup camera angle",
      },
      { key: "afternoon_time", label: "Afternoon Time", example: "3:30 PM" },
      {
        key: "afternoon_task",
        label: "Afternoon Task",
        example: "batch filming try-on transitions",
      },
      {
        key: "energy_state",
        label: "Energy State",
        example: "dropping after lunch",
      },
      {
        key: "focus_strategy",
        label: "Focus Strategy",
        example: "25-minute sprint timer",
      },
      { key: "evening_time", label: "Evening Time", example: "7:00 PM" },
      {
        key: "evening_task_1",
        label: "Evening Task 1",
        example: "replying to brand emails",
      },
      {
        key: "evening_task_2",
        label: "Evening Task 2",
        example: "posting and community replies",
      },
      {
        key: "prep_action",
        label: "Prep Action",
        example: "laying out tomorrow's outfits",
      },
      {
        key: "biggest_win",
        label: "Biggest Win",
        example: "finished deliverables before deadline",
      },
      {
        key: "biggest_lesson",
        label: "Biggest Lesson",
        example: "always duplicate footage immediately",
      },
      {
        key: "output_summary",
        label: "Output Summary",
        example: "3 published pieces and 2 drafts",
      },
      {
        key: "declined_task",
        label: "Declined Task",
        example: "an extra same-day collab request",
      },
      {
        key: "mood_shift_moment",
        label: "Mood Shift Moment",
        example: "a quick walk between edits",
      },
      { key: "comment_keyword", label: "Comment Keyword", example: "PLANNER" },
    ],
  },
  {
    id: "product-comparison-youtube-60",
    name: "Product Comparison (YouTube 60s)",
    category: "Product Comparison",
    platform: "YouTube",
    duration: "60s",
    template: `[HOOK]
If you are choosing between {product_a} and {product_b}, this one-minute comparison will save you money and help you pick the right fit for your needs.

[BODY]
I tested both for {test_duration} in {test_environment_1} and {test_environment_2}. Same conditions, same creator workflow.
Category 1 - Performance: {product_a} scored {a_performance_score}/10, while {product_b} scored {b_performance_score}/10 because {performance_reason}.
Category 2 - Ease of Use: {product_a} was {a_usability_note}; {product_b} was {b_usability_note}.
Category 3 - Value: At {price_a} vs {price_b}, the better value is {value_winner} for people who need {value_use_case}.
Final decision by user type:
- Best for beginners: {beginner_pick}
- Best for advanced creators: {advanced_pick}
- Best all-around: {overall_pick}
Deal-breaker note: {deal_breaker_note}.

[CTA]
Comment "{comment_keyword}" if you want the full comparison table with test data and sample footage links.

[PLATFORM NOTES]
Display both products side-by-side for each category, use bold on-screen score cards, and keep your final recommendation in one clean sentence for fast YouTube short-form clarity.`,
    placeholders: [
      { key: "product_a", label: "Product A", example: "DJI Mic 2" },
      { key: "product_b", label: "Product B", example: "Rode Wireless ME" },
      { key: "test_duration", label: "Test Duration", example: "10 days" },
      {
        key: "test_environment_1",
        label: "Test Environment 1",
        example: "indoor studio",
      },
      {
        key: "test_environment_2",
        label: "Test Environment 2",
        example: "busy street",
      },
      {
        key: "a_performance_score",
        label: "A Performance Score",
        example: "9",
      },
      {
        key: "b_performance_score",
        label: "B Performance Score",
        example: "8",
      },
      {
        key: "performance_reason",
        label: "Performance Reason",
        example: "clearer noise handling in traffic",
      },
      {
        key: "a_usability_note",
        label: "A Usability Note",
        example: "easy pairing but more settings",
      },
      {
        key: "b_usability_note",
        label: "B Usability Note",
        example: "simpler setup for beginners",
      },
      { key: "price_a", label: "Price A", example: "$349" },
      { key: "price_b", label: "Price B", example: "$149" },
      {
        key: "value_winner",
        label: "Value Winner",
        example: "Rode Wireless ME",
      },
      {
        key: "value_use_case",
        label: "Value Use Case",
        example: "simple talking-head content",
      },
      {
        key: "beginner_pick",
        label: "Beginner Pick",
        example: "Rode Wireless ME",
      },
      { key: "advanced_pick", label: "Advanced Pick", example: "DJI Mic 2" },
      {
        key: "overall_pick",
        label: "Overall Pick",
        example: "DJI Mic 2 for most prosumers",
      },
      {
        key: "deal_breaker_note",
        label: "Deal Breaker Note",
        example: "check local warranty support first",
      },
      { key: "comment_keyword", label: "Comment Keyword", example: "TABLE" },
    ],
  },
  {
    id: "tips-tricks-tiktok-30",
    name: "Tips & Tricks (TikTok 30s)",
    category: "Tips & Tricks",
    platform: "TikTok",
    duration: "30s",
    template: `[HOOK]
Three fast {topic_area} tips that instantly improve {desired_result}, even if you only have {time_limit} today.

[BODY]
Tip 1 - {tip_1_title}: {tip_1_action}. Why it works: {tip_1_reason}. Most people forget {tip_1_common_miss}.
Tip 2 - {tip_2_title}: {tip_2_action}. This helps when {tip_2_use_case}. Avoid this mistake: {tip_2_mistake}.
Tip 3 - {tip_3_title}: {tip_3_action}. Quick benchmark: aim for {tip_3_benchmark}. If you are below that, change {tip_3_adjustment}.
My own before/after after applying all three: {before_after_result}. Total extra time required: {extra_time_required}.
If you only apply one tip first, start with {priority_tip} because it usually gives the fastest visible improvement.
My testing method was {testing_method}, which helped confirm these tips were repeatable and not one-off luck.

[CTA]
Save this for your next content session, send it to a creator friend, and comment "{comment_keyword}" if you want part 2 with advanced tips.

[PLATFORM NOTES]
Use large numbers on screen for each tip, keep each point under 7 seconds, and end with a quick visual proof clip so viewers trust the tips and complete the video on TikTok.`,
    placeholders: [
      { key: "topic_area", label: "Topic Area", example: "editing" },
      { key: "desired_result", label: "Desired Result", example: "watch time" },
      { key: "time_limit", label: "Time Limit", example: "10 minutes" },
      { key: "tip_1_title", label: "Tip 1 Title", example: "Cut Dead Space" },
      {
        key: "tip_1_action",
        label: "Tip 1 Action",
        example: "remove every pause over 0.4 seconds",
      },
      {
        key: "tip_1_reason",
        label: "Tip 1 Reason",
        example: "keeps pace high from first second",
      },
      {
        key: "tip_1_common_miss",
        label: "Tip 1 Common Miss",
        example: "micro-pauses between captions",
      },
      { key: "tip_2_title", label: "Tip 2 Title", example: "Front-Load Value" },
      {
        key: "tip_2_action",
        label: "Tip 2 Action",
        example: "state the outcome before the process",
      },
      {
        key: "tip_2_use_case",
        label: "Tip 2 Use Case",
        example: "your niche is competitive",
      },
      {
        key: "tip_2_mistake",
        label: "Tip 2 Mistake",
        example: "starting with generic intro lines",
      },
      {
        key: "tip_3_title",
        label: "Tip 3 Title",
        example: "Use Pattern Interrupts",
      },
      {
        key: "tip_3_action",
        label: "Tip 3 Action",
        example: "switch angle or visual every 2-3 seconds",
      },
      {
        key: "tip_3_benchmark",
        label: "Tip 3 Benchmark",
        example: "70% retention at 5 seconds",
      },
      {
        key: "tip_3_adjustment",
        label: "Tip 3 Adjustment",
        example: "hook wording and first cut",
      },
      {
        key: "before_after_result",
        label: "Before/After Result",
        example: "avg watch time rose from 6s to 11s",
      },
      {
        key: "extra_time_required",
        label: "Extra Time Required",
        example: "under 5 minutes",
      },
      { key: "priority_tip", label: "Priority Tip", example: "Cut Dead Space" },
      {
        key: "testing_method",
        label: "Testing Method",
        example: "A/B testing hooks across 6 posts",
      },
      { key: "comment_keyword", label: "Comment Keyword", example: "PART2" },
    ],
  },
  {
    id: "storytelling-all-long",
    name: "Storytelling (All Platforms Long)",
    category: "Storytelling",
    platform: "All",
    duration: "Long",
    template: `[HOOK]
Two years ago, I was {starting_situation}, and today I am {current_situation}. Here is the exact turning point that changed everything.

[BODY]
Chapter 1 - The Struggle: At that time, my biggest challenge was {core_challenge}. I tried {failed_attempt_1} and {failed_attempt_2}, but nothing worked because {failure_reason}.
Chapter 2 - The Turning Point: One day, {turning_point_event} happened. That forced me to {critical_decision}.
Chapter 3 - The Process: I committed to {new_process} for {commitment_period}. Week by week, I tracked {tracking_metric_1} and {tracking_metric_2}.
Chapter 4 - The Result: After {result_timeline}, I achieved {key_result}. The most surprising benefit was {unexpected_benefit}.
Chapter 5 - The Lesson: If you are currently {audience_current_state}, my advice is {core_advice}. Start with {first_action_step} and avoid {major_mistake_to_avoid}.

[CTA]
If this story helped you, share it with someone who needs it and comment "{comment_keyword}" if you want a part 2 with the exact framework I used.

[PLATFORM NOTES]
Use emotional pacing with music rises per chapter, add text chapter titles for clarity, and include authentic archival footage/screenshots to strengthen trust across any platform format.`,
    placeholders: [
      {
        key: "starting_situation",
        label: "Starting Situation",
        example: "working full-time while posting at midnight",
      },
      {
        key: "current_situation",
        label: "Current Situation",
        example: "running my creator business full-time",
      },
      {
        key: "core_challenge",
        label: "Core Challenge",
        example: "burnout and inconsistent income",
      },
      {
        key: "failed_attempt_1",
        label: "Failed Attempt 1",
        example: "posting daily without strategy",
      },
      {
        key: "failed_attempt_2",
        label: "Failed Attempt 2",
        example: "copying trends outside my niche",
      },
      {
        key: "failure_reason",
        label: "Failure Reason",
        example: "I had no repeatable system",
      },
      {
        key: "turning_point_event",
        label: "Turning Point Event",
        example: "a client canceled a major deal",
      },
      {
        key: "critical_decision",
        label: "Critical Decision",
        example: "rebuild from audience problems first",
      },
      {
        key: "new_process",
        label: "New Process",
        example: "weekly content pillars and batch production",
      },
      {
        key: "commitment_period",
        label: "Commitment Period",
        example: "90 days",
      },
      {
        key: "tracking_metric_1",
        label: "Tracking Metric 1",
        example: "save rate",
      },
      {
        key: "tracking_metric_2",
        label: "Tracking Metric 2",
        example: "qualified inbound leads",
      },
      {
        key: "result_timeline",
        label: "Result Timeline",
        example: "four months",
      },
      {
        key: "key_result",
        label: "Key Result",
        example: "tripled monthly brand revenue",
      },
      {
        key: "unexpected_benefit",
        label: "Unexpected Benefit",
        example: "less stress and better creative focus",
      },
      {
        key: "audience_current_state",
        label: "Audience Current State",
        example: "stuck in random posting mode",
      },
      {
        key: "core_advice",
        label: "Core Advice",
        example: "build one system before chasing growth hacks",
      },
      {
        key: "first_action_step",
        label: "First Action Step",
        example: "define one clear weekly content goal",
      },
      {
        key: "major_mistake_to_avoid",
        label: "Mistake To Avoid",
        example: "measuring only vanity metrics",
      },
      {
        key: "comment_keyword",
        label: "Comment Keyword",
        example: "FRAMEWORK",
      },
    ],
  },
  {
    id: "educational-youtube-60",
    name: "Educational Explainer (YouTube 60s)",
    category: "Educational",
    platform: "YouTube",
    duration: "60s",
    template: `[HOOK]
Most creators misunderstand {concept_name}, and that mistake costs them {negative_outcome}. Here is the simple explanation you can apply today.

[BODY]
Definition: {concept_name} means {simple_definition}.
Why it matters: when {context_trigger}, it directly affects {impact_area_1} and {impact_area_2}.
Quick example: Imagine {example_scenario}. If you do {bad_practice}, you get {bad_result}. If you do {good_practice}, you get {good_result}.
Simple framework to remember: {framework_name} - first {framework_step_1}, then {framework_step_2}, and finally {framework_step_3}.
Use this when you are planning content, recording, and reviewing analytics so the concept becomes part of your weekly workflow.
Three rules to remember:
- Rule 1: {rule_1}
- Rule 2: {rule_2}
- Rule 3: {rule_3}
Common myth: {common_myth}. Reality: {myth_reality}.
Action step for today: {today_action_step}. You should see progress in {expected_timeline} if you track {tracking_signal}.

[CTA]
Comment "{comment_keyword}" if you want a downloadable cheat sheet, and subscribe for weekly breakdowns on {education_topic}.

[PLATFORM NOTES]
Use one clear diagram or on-screen visual metaphor, keep language jargon-free, and restate the key takeaway in the final 5 seconds to maximize educational retention in short-form YouTube.`,
    placeholders: [
      {
        key: "concept_name",
        label: "Concept Name",
        example: "audience retention",
      },
      {
        key: "negative_outcome",
        label: "Negative Outcome",
        example: "consistent reach",
      },
      {
        key: "simple_definition",
        label: "Simple Definition",
        example: "how long people keep watching your content",
      },
      {
        key: "context_trigger",
        label: "Context Trigger",
        example: "your first 3 seconds are weak",
      },
      {
        key: "impact_area_1",
        label: "Impact Area 1",
        example: "algorithm distribution",
      },
      {
        key: "impact_area_2",
        label: "Impact Area 2",
        example: "conversion quality",
      },
      {
        key: "example_scenario",
        label: "Example Scenario",
        example: "you start with a long intro",
      },
      {
        key: "bad_practice",
        label: "Bad Practice",
        example: "saving value for the end",
      },
      {
        key: "bad_result",
        label: "Bad Result",
        example: "viewers swipe in under 2 seconds",
      },
      {
        key: "good_practice",
        label: "Good Practice",
        example: "lead with a specific promise",
      },
      {
        key: "good_result",
        label: "Good Result",
        example: "higher watch-through and more saves",
      },
      {
        key: "framework_name",
        label: "Framework Name",
        example: "HPP Framework",
      },
      {
        key: "framework_step_1",
        label: "Framework Step 1",
        example: "hook with a specific promise",
      },
      {
        key: "framework_step_2",
        label: "Framework Step 2",
        example: "prove with one clear example",
      },
      {
        key: "framework_step_3",
        label: "Framework Step 3",
        example: "prompt one focused next step",
      },
      { key: "rule_1", label: "Rule 1", example: "state the payoff early" },
      {
        key: "rule_2",
        label: "Rule 2",
        example: "remove dead space between points",
      },
      { key: "rule_3", label: "Rule 3", example: "use proof before opinion" },
      {
        key: "common_myth",
        label: "Common Myth",
        example: "longer videos always hurt retention",
      },
      {
        key: "myth_reality",
        label: "Myth Reality",
        example: "structure matters more than raw length",
      },
      {
        key: "today_action_step",
        label: "Today Action Step",
        example: "rewrite your next hook with a measurable promise",
      },
      {
        key: "expected_timeline",
        label: "Expected Timeline",
        example: "1-2 weeks",
      },
      {
        key: "tracking_signal",
        label: "Tracking Signal",
        example: "average view duration",
      },
      {
        key: "comment_keyword",
        label: "Comment Keyword",
        example: "CHEATSHEET",
      },
      {
        key: "education_topic",
        label: "Education Topic",
        example: "creator growth strategy",
      },
    ],
  },
  {
    id: "educational-instagram-30",
    name: "Educational Quick Lesson (Instagram 30s)",
    category: "Educational",
    platform: "Instagram",
    duration: "30s",
    template: `[HOOK]
Here is one {topic_name} lesson that can improve your {target_outcome} today, and it only takes {time_needed} to apply.

[BODY]
Core idea: {core_idea}.
Why most people miss it: {common_reason_people_fail}.
Why this matters right now: {urgency_reason}.
Do this instead:
1. {action_1}
2. {action_2}
3. {action_3}
Real example: I used this on {example_context}, changed {specific_change}, and the result was {example_result}.
If your situation is {edge_case_condition}, adjust by {edge_case_adjustment}.
Mistake to avoid: {main_mistake_to_avoid}.
Quick quality check before posting: {quality_check_step}.
If you want to level this up, pair this lesson with {advanced_pairing_tip} and track outcomes for a full week.
Small consistency note: repeat this method across your next three posts so you can compare results with cleaner data.

[CTA]
Save this for your next creation session, and comment "{comment_keyword}" if you want a full breakdown post with examples for beginners.

[PLATFORM NOTES]
Use concise sentence overlays with high contrast, keep one point per shot, and end with a recap card listing the three actions to encourage saves and shares on Instagram.`,
    placeholders: [
      { key: "topic_name", label: "Topic Name", example: "caption writing" },
      {
        key: "target_outcome",
        label: "Target Outcome",
        example: "engagement quality",
      },
      { key: "time_needed", label: "Time Needed", example: "five minutes" },
      {
        key: "core_idea",
        label: "Core Idea",
        example: "lead captions with a specific reader identity",
      },
      {
        key: "common_reason_people_fail",
        label: "Why People Fail",
        example: "they open with generic statements",
      },
      {
        key: "urgency_reason",
        label: "Urgency Reason",
        example: "competition for attention is highest in the first line",
      },
      {
        key: "action_1",
        label: "Action 1",
        example: "name your audience in line one",
      },
      {
        key: "action_2",
        label: "Action 2",
        example: "state a concrete pain point",
      },
      {
        key: "action_3",
        label: "Action 3",
        example: "end with one clear response prompt",
      },
      {
        key: "example_context",
        label: "Example Context",
        example: "a fitness motivation reel",
      },
      {
        key: "specific_change",
        label: "Specific Change",
        example: "replaced a broad intro with athlete-specific language",
      },
      {
        key: "example_result",
        label: "Example Result",
        example: "comment quality improved within 24 hours",
      },
      {
        key: "edge_case_condition",
        label: "Edge Case Condition",
        example: "your niche is highly technical",
      },
      {
        key: "edge_case_adjustment",
        label: "Edge Case Adjustment",
        example: "define one key term before the tip",
      },
      {
        key: "main_mistake_to_avoid",
        label: "Main Mistake",
        example: "asking multiple CTAs in one caption",
      },
      {
        key: "quality_check_step",
        label: "Quality Check Step",
        example: "read the caption out loud in 15 seconds",
      },
      {
        key: "advanced_pairing_tip",
        label: "Advanced Pairing Tip",
        example: "a pinned comment with one clarifying example",
      },
      {
        key: "comment_keyword",
        label: "Comment Keyword",
        example: "BREAKDOWN",
      },
    ],
  },
];
