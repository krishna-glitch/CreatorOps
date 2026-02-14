export type HookCategory =
  | "Surprise"
  | "Problem"
  | "Curiosity"
  | "Relatability"
  | "Question"
  | "Direct"
  | "Emotional"
  | "Storytelling";

export type HookPlatform = "Instagram" | "YouTube" | "TikTok" | "All";

export type HookTone =
  | "Casual"
  | "Professional"
  | "Educational"
  | "Funny"
  | "Serious";

export type HookVariable =
  | "problem"
  | "goal"
  | "product"
  | "number"
  | "timeframe";

export interface HookTemplate {
  id: string;
  text: string;
  category: HookCategory;
  platform: HookPlatform;
  tone: HookTone;
  variables?: HookVariable[];
}

export const hookLibrary: HookTemplate[] = [
  {
    id: "surprise-1",
    text: "I tested this for {timeframe}, and the results shocked me.",
    category: "Surprise",
    platform: "TikTok",
    tone: "Casual",
    variables: ["timeframe"],
  },
  {
    id: "surprise-2",
    text: "Nobody talks about this part of {product}... and they should.",
    category: "Surprise",
    platform: "Instagram",
    tone: "Casual",
    variables: ["product"],
  },
  {
    id: "surprise-3",
    text: "I thought this was a scam until I tried it myself.",
    category: "Surprise",
    platform: "All",
    tone: "Funny",
  },
  {
    id: "surprise-4",
    text: "This tiny tweak gave me {number}% better results overnight.",
    category: "Surprise",
    platform: "All",
    tone: "Educational",
    variables: ["number"],
  },
  {
    id: "surprise-5",
    text: "What happened after {timeframe} of consistency was wild.",
    category: "Surprise",
    platform: "YouTube",
    tone: "Serious",
    variables: ["timeframe"],
  },
  {
    id: "surprise-6",
    text: "I was doing this completely wrong for years.",
    category: "Surprise",
    platform: "All",
    tone: "Casual",
  },
  {
    id: "surprise-7",
    text: "This is the one thing in {product} that changed everything.",
    category: "Surprise",
    platform: "YouTube",
    tone: "Professional",
    variables: ["product"],
  },
  {
    id: "surprise-8",
    text: "I did not expect this to help with {problem}, but it did.",
    category: "Surprise",
    platform: "Instagram",
    tone: "Educational",
    variables: ["problem"],
  },

  {
    id: "problem-1",
    text: "Struggling with {problem}? Start with this simple fix.",
    category: "Problem",
    platform: "All",
    tone: "Educational",
    variables: ["problem"],
  },
  {
    id: "problem-2",
    text: "If your {goal} feels impossible, you are probably missing this step.",
    category: "Problem",
    platform: "YouTube",
    tone: "Professional",
    variables: ["goal"],
  },
  {
    id: "problem-3",
    text: "Here is why most people fail at {goal} in the first {timeframe}.",
    category: "Problem",
    platform: "All",
    tone: "Educational",
    variables: ["goal", "timeframe"],
  },
  {
    id: "problem-4",
    text: "Still stuck on {problem}? Stop doing this first.",
    category: "Problem",
    platform: "TikTok",
    tone: "Serious",
    variables: ["problem"],
  },
  {
    id: "problem-5",
    text: "This is the exact framework I use when {problem} shows up.",
    category: "Problem",
    platform: "Instagram",
    tone: "Professional",
    variables: ["problem"],
  },
  {
    id: "problem-6",
    text: "You do not need more motivation. You need this system for {goal}.",
    category: "Problem",
    platform: "All",
    tone: "Serious",
    variables: ["goal"],
  },
  {
    id: "problem-7",
    text: "Most advice on {problem} is incomplete. Here is what actually works.",
    category: "Problem",
    platform: "YouTube",
    tone: "Educational",
    variables: ["problem"],
  },
  {
    id: "problem-8",
    text: "If {product} is not working for you, try this before quitting.",
    category: "Problem",
    platform: "All",
    tone: "Casual",
    variables: ["product"],
  },

  {
    id: "curiosity-1",
    text: "The secret to {goal} is not what you think.",
    category: "Curiosity",
    platform: "All",
    tone: "Casual",
    variables: ["goal"],
  },
  {
    id: "curiosity-2",
    text: "I wish someone told me this before I used {product}.",
    category: "Curiosity",
    platform: "Instagram",
    tone: "Casual",
    variables: ["product"],
  },
  {
    id: "curiosity-3",
    text: "This one habit made {goal} easier in just {timeframe}.",
    category: "Curiosity",
    platform: "All",
    tone: "Educational",
    variables: ["goal", "timeframe"],
  },
  {
    id: "curiosity-4",
    text: "There is a hidden reason your {problem} keeps coming back.",
    category: "Curiosity",
    platform: "TikTok",
    tone: "Serious",
    variables: ["problem"],
  },
  {
    id: "curiosity-5",
    text: "Most people ignore this, but it is the key to {goal}.",
    category: "Curiosity",
    platform: "YouTube",
    tone: "Professional",
    variables: ["goal"],
  },
  {
    id: "curiosity-6",
    text: "I tracked this for {timeframe}, and the pattern surprised me.",
    category: "Curiosity",
    platform: "All",
    tone: "Educational",
    variables: ["timeframe"],
  },
  {
    id: "curiosity-7",
    text: "Before you buy {product}, watch this first.",
    category: "Curiosity",
    platform: "YouTube",
    tone: "Serious",
    variables: ["product"],
  },
  {
    id: "curiosity-8",
    text: "The weird trick that helped me fix {problem} in {timeframe}.",
    category: "Curiosity",
    platform: "TikTok",
    tone: "Funny",
    variables: ["problem", "timeframe"],
  },

  {
    id: "relatability-1",
    text: "POV: You are trying to fix {problem} at 2 AM again.",
    category: "Relatability",
    platform: "TikTok",
    tone: "Funny",
    variables: ["problem"],
  },
  {
    id: "relatability-2",
    text: "If your goal is {goal} but your routine says chaos, this is for you.",
    category: "Relatability",
    platform: "Instagram",
    tone: "Casual",
    variables: ["goal"],
  },
  {
    id: "relatability-3",
    text: "Me pretending everything is fine while dealing with {problem}.",
    category: "Relatability",
    platform: "TikTok",
    tone: "Funny",
    variables: ["problem"],
  },
  {
    id: "relatability-4",
    text: "You are not lazy. You are just overwhelmed by too many options.",
    category: "Relatability",
    platform: "All",
    tone: "Serious",
  },
  {
    id: "relatability-5",
    text: "That moment when {product} finally starts making sense.",
    category: "Relatability",
    platform: "Instagram",
    tone: "Casual",
    variables: ["product"],
  },
  {
    id: "relatability-6",
    text: "Everyone says stay consistent, but nobody talks about day 3.",
    category: "Relatability",
    platform: "All",
    tone: "Educational",
  },
  {
    id: "relatability-7",
    text: "Trying to hit {goal} while life keeps life-ing.",
    category: "Relatability",
    platform: "TikTok",
    tone: "Casual",
    variables: ["goal"],
  },
  {
    id: "relatability-8",
    text: "If you have restarted this {number} times, welcome to the club.",
    category: "Relatability",
    platform: "All",
    tone: "Funny",
    variables: ["number"],
  },

  {
    id: "question-1",
    text: "Ever wondered why {problem} keeps happening no matter what you try?",
    category: "Question",
    platform: "All",
    tone: "Educational",
    variables: ["problem"],
  },
  {
    id: "question-2",
    text: "What if your {goal} is closer than you think?",
    category: "Question",
    platform: "Instagram",
    tone: "Casual",
    variables: ["goal"],
  },
  {
    id: "question-3",
    text: "Are you making this common mistake with {product}?",
    category: "Question",
    platform: "YouTube",
    tone: "Professional",
    variables: ["product"],
  },
  {
    id: "question-4",
    text: "What would change for you if {problem} was solved today?",
    category: "Question",
    platform: "All",
    tone: "Serious",
    variables: ["problem"],
  },
  {
    id: "question-5",
    text: "Did you know this can cut your timeline to {goal} by {number}%?",
    category: "Question",
    platform: "YouTube",
    tone: "Educational",
    variables: ["goal", "number"],
  },
  {
    id: "question-6",
    text: "Why does nobody mention this part of {product}?",
    category: "Question",
    platform: "TikTok",
    tone: "Casual",
    variables: ["product"],
  },
  {
    id: "question-7",
    text: "What if the real reason you cannot reach {goal} is your process?",
    category: "Question",
    platform: "All",
    tone: "Professional",
    variables: ["goal"],
  },
  {
    id: "question-8",
    text: "How much would your week improve if {problem} took only {timeframe} to solve?",
    category: "Question",
    platform: "Instagram",
    tone: "Educational",
    variables: ["problem", "timeframe"],
  },

  {
    id: "direct-1",
    text: "Here is how to solve {problem} in {timeframe}.",
    category: "Direct",
    platform: "All",
    tone: "Educational",
    variables: ["problem", "timeframe"],
  },
  {
    id: "direct-2",
    text: "Use this 3-step system to hit {goal} faster.",
    category: "Direct",
    platform: "YouTube",
    tone: "Professional",
    variables: ["goal"],
  },
  {
    id: "direct-3",
    text: "Copy this framework if you want better results with {product}.",
    category: "Direct",
    platform: "All",
    tone: "Educational",
    variables: ["product"],
  },
  {
    id: "direct-4",
    text: "Do this before bed for {timeframe} if you want real progress.",
    category: "Direct",
    platform: "TikTok",
    tone: "Casual",
    variables: ["timeframe"],
  },
  {
    id: "direct-5",
    text: "Save this checklist for the next time {problem} shows up.",
    category: "Direct",
    platform: "Instagram",
    tone: "Professional",
    variables: ["problem"],
  },
  {
    id: "direct-6",
    text: "If your target is {goal}, start with this one move today.",
    category: "Direct",
    platform: "All",
    tone: "Serious",
    variables: ["goal"],
  },
  {
    id: "direct-7",
    text: "Steal this exact script to explain {product} in {number} seconds.",
    category: "Direct",
    platform: "TikTok",
    tone: "Funny",
    variables: ["product", "number"],
  },
  {
    id: "direct-8",
    text: "Watch this if you want to avoid beginner mistakes with {product}.",
    category: "Direct",
    platform: "YouTube",
    tone: "Educational",
    variables: ["product"],
  },

  {
    id: "emotional-1",
    text: "This changed my life more than I expected.",
    category: "Emotional",
    platform: "All",
    tone: "Serious",
  },
  {
    id: "emotional-2",
    text: "I almost gave up on {goal}, then this happened.",
    category: "Emotional",
    platform: "Instagram",
    tone: "Casual",
    variables: ["goal"],
  },
  {
    id: "emotional-3",
    text: "I was embarrassed about {problem}, so I never talked about it.",
    category: "Emotional",
    platform: "YouTube",
    tone: "Serious",
    variables: ["problem"],
  },
  {
    id: "emotional-4",
    text: "After {timeframe} of trying, this was the breakthrough moment.",
    category: "Emotional",
    platform: "All",
    tone: "Serious",
    variables: ["timeframe"],
  },
  {
    id: "emotional-5",
    text: "Nobody saw this part of my journey to {goal}.",
    category: "Emotional",
    platform: "Instagram",
    tone: "Casual",
    variables: ["goal"],
  },
  {
    id: "emotional-6",
    text: "I wish I had known this before buying {product}.",
    category: "Emotional",
    platform: "TikTok",
    tone: "Educational",
    variables: ["product"],
  },
  {
    id: "emotional-7",
    text: "This is what rock bottom with {problem} looked like for me.",
    category: "Emotional",
    platform: "YouTube",
    tone: "Serious",
    variables: ["problem"],
  },
  {
    id: "emotional-8",
    text: "I did this for {timeframe}, and I finally felt proud again.",
    category: "Emotional",
    platform: "All",
    tone: "Casual",
    variables: ["timeframe"],
  },

  {
    id: "storytelling-1",
    text: "A year ago I was stuck with {problem}. Here is what changed.",
    category: "Storytelling",
    platform: "All",
    tone: "Serious",
    variables: ["problem"],
  },
  {
    id: "storytelling-2",
    text: "I gave myself {timeframe} to hit {goal}. This is the full story.",
    category: "Storytelling",
    platform: "YouTube",
    tone: "Educational",
    variables: ["timeframe", "goal"],
  },
  {
    id: "storytelling-3",
    text: "At first, {product} felt like a waste of money.",
    category: "Storytelling",
    platform: "Instagram",
    tone: "Casual",
    variables: ["product"],
  },
  {
    id: "storytelling-4",
    text: "Day 1 vs day {number}: this is what consistency looks like.",
    category: "Storytelling",
    platform: "TikTok",
    tone: "Educational",
    variables: ["number"],
  },
  {
    id: "storytelling-5",
    text: "I made every mistake possible with {problem} so you do not have to.",
    category: "Storytelling",
    platform: "All",
    tone: "Funny",
    variables: ["problem"],
  },
  {
    id: "storytelling-6",
    text: "This started as a 5-minute experiment and became my whole strategy.",
    category: "Storytelling",
    platform: "All",
    tone: "Casual",
  },
  {
    id: "storytelling-7",
    text: "I documented every step for {timeframe}. Here is the truth.",
    category: "Storytelling",
    platform: "YouTube",
    tone: "Professional",
    variables: ["timeframe"],
  },
  {
    id: "storytelling-8",
    text: "I was chasing {goal} the wrong way until this one conversation.",
    category: "Storytelling",
    platform: "Instagram",
    tone: "Serious",
    variables: ["goal"],
  },
];

export const hookCategories: HookCategory[] = [
  "Surprise",
  "Problem",
  "Curiosity",
  "Relatability",
  "Question",
  "Direct",
  "Emotional",
  "Storytelling",
];

export const hookPlatforms: HookPlatform[] = [
  "Instagram",
  "YouTube",
  "TikTok",
  "All",
];

export const hookTones: HookTone[] = [
  "Casual",
  "Professional",
  "Educational",
  "Funny",
  "Serious",
];
