export const profile = {
  name: "Yuhao Cheng",
  location: "Champaign, IL",
  coords: "40.1106° N · 88.2073° W",
  email: "yuhaoc7@outlook.com",
  site: "https://yuhaoc7.com",
  github: "https://github.com/yuhaoc7",
  linkedin: "https://www.linkedin.com/in/yuhao-cheng-50b473328/",
  resume: "/Yuhao_Cheng_resume.pdf",
  tagline:
    "I build the systems underneath models — the pipelines that train them, serve them, and measure what they can actually do.",
};

export const stats = [
  { value: 3, suffix: "M+", label: "LLM calls orchestrated in one evaluation run" },
  { value: 52, suffix: "d → 21h", label: "Full benchmark run, after load-testing the pipeline" },
  { value: 140, suffix: " img/min", label: "SDXL throughput across 8 GPUs, up from 6" },
  { value: 800, suffix: "+", label: "WebArena tasks for SFT → RL web agents" },
];

export const education = [
  {
    school: "University of Illinois Urbana-Champaign",
    degree: "Master of Computer Science",
    period: "Aug 2025 — Dec 2026",
  },
  {
    school: "University of Illinois Urbana-Champaign",
    degree: "B.S. in Computer Engineering",
    period: "Aug 2021 — May 2025",
  },
];

export type Role = {
  org: string;
  role: string;
  period: string;
  place?: string;
  summary: string;
  points: string[];
  tags: string[];
};

export const research: Role[] = [
  {
    org: "TIMAN Group, UIUC",
    role: "Research Assistant",
    period: "May 2026 — Sep 2026",
    summary: "Auditing large language models at scale.",
    points: [
      "Built a Python evaluation pipeline that executed 3M+ LLM calls across 8 models on a 64-worker pool, with a token-bucket rate limiter and exponential-backoff retries.",
      "Load-tested the model endpoints to their limit, raising throughput from 40 to 2,400 calls/min — a full run went from an estimated 52 days to 21 hours.",
      "Designed BDSU audits of GPT-4o, GPT-4o-mini and o1, decomposing behavior into demographic disparity, prompt sensitivity and generation uncertainty.",
      "Made runs resumable with request-level caching and checkpointing; every generation, score and metric is tracked in Weights & Biases.",
    ],
    tags: ["LLM Evaluation", "Concurrency", "W&B"],
  },
  {
    org: "IBM–Illinois Discovery Accelerator Institute",
    role: "Research Intern",
    period: "Jul 2024 — Dec 2024",
    summary: "Teaching an 8B model to browse the web.",
    points: [
      "Built an SFT-to-RL pipeline for Llama-3.1-8B web agents over 800+ WebArena tasks: browser interaction, trajectory collection and automated evaluation.",
      "Implemented actor-critic RL with dense trajectory rewards — task success, progress, URL similarity, exploration bonuses, state-change penalties.",
      "Scaled full-parameter training across 4 nodes / 16 GPUs with PyTorch, Accelerate and DeepSpeed ZeRO-3; 16 parallel browser workers cut an eval pass from 20 h to 3 h.",
    ],
    tags: ["RL", "LLM Agents", "DeepSpeed", "SLURM"],
  },
];

export const industry: Role[] = [
  {
    org: "visibilityx.ai",
    role: "Frontend Developer Intern",
    period: "Jun 2025 — Aug 2025",
    summary: "Data-heavy dashboards that load fast.",
    points: [
      "Built a Vue 3 + TypeScript SPA with 10+ data-intensive dashboard views; extracted 12 shared components and composables, removing ~2,000 lines of duplicated logic.",
      "Cut median dashboard load from 2.4 s to 1.6 s with parallel REST calls, Pinia response caching and per-route lazy-loading of ECharts.",
      "Wrote 180+ Vitest unit tests (80% line coverage), run in CI on every pull request.",
    ],
    tags: ["Vue 3", "TypeScript", "ECharts", "Vitest"],
  },
  {
    org: "HiABR Lab",
    role: "Backend Developer Intern",
    period: "May 2024 — Aug 2024",
    summary: "Serving Stable Diffusion XL on a GPU cluster.",
    points: [
      "Deployed SDXL as a multi-node inference service — 2 nodes, 8 GPUs, one FastAPI worker per GPU — behind Nginx least-connections routing with health checks.",
      "Traced OOM crashes to overlapping requests on 24 GB GPUs; fixed them with bounded per-GPU job queues, then added dynamic micro-batching (4 prompts / 50 ms window).",
      "Under Locust load, went from failing above 4 concurrent users to 64 with zero errors; throughput scaled from 6 to 140 images/min at 21 s p95.",
      "Built a URL-shortening service on FastAPI, PostgreSQL and Redis with sliding-window rate limiting, idempotency keys and Prometheus metrics.",
    ],
    tags: ["FastAPI", "Multi-GPU", "Nginx", "Redis"],
  },
];

export type Work = {
  title: string;
  full: string;
  venue: string;
  points: string[];
  figures: { n: string; l: string }[];
  links?: { label: string; href: string }[];
};

export const works: Work[] = [
  {
    title: "VGI-Bench",
    full: "Probing Visual Intelligence in Video Generation Models",
    venue: "EMNLP 2026",
    points: [
      "Co-developed a visual-reasoning benchmark across four task domains and seven capability dimensions.",
      "Built pipelines automating inference, collection and analysis for 9 video and 11 image generation models; studied failure modes, input sensitivity and reasoning dynamics.",
    ],
    figures: [
      { n: "27", l: "tasks" },
      { n: "810", l: "instances" },
      { n: "20", l: "models" },
    ],
    links: [
      { label: "Paper", href: "https://arxiv.org/abs/2608.19583" },
      { label: "Project page", href: "https://hexuan21.github.io/VGI-Bench/" },
    ],
  },
  {
    title: "PIR-Arena",
    full: "Proactive Information Recommendation Benchmark",
    venue: "2026 — ongoing",
    points: [
      "A multimodal benchmark for deciding when and what information to surface from continuous user context.",
      "Retrieval pipeline linking LLM query generation with BM25, dense retrieval and cross-encoder reranking over 50k documents at 1.8 s p95; evaluated on precision, recall, relevance and timeliness.",
    ],
    figures: [
      { n: "34", l: "real scenes" },
      { n: "831", l: "minutes" },
      { n: "11", l: "need types" },
    ],
  },
];

export const skills = [
  { group: "Languages", items: ["Python", "TypeScript", "JavaScript", "C / C++", "SQL", "Java", "Bash"] },
  { group: "ML Systems", items: ["PyTorch", "DeepSpeed", "Accelerate", "SLURM", "Weights & Biases"] },
  { group: "Backend & Infra", items: ["FastAPI", "PostgreSQL", "Redis", "Docker", "Nginx", "Prometheus", "Locust", "AWS", "GCP"] },
  { group: "Frontend", items: ["React", "Vue 3", "Node.js", "Express", "ECharts", "Vitest"] },
];

/** Narrative chapters — order matches the DOM sections and the camera shots in world/World.ts. */
export const chapters = [
  { id: "top", label: "Fade in" },
  { id: "prologue", label: "Prologue" },
  { id: "education", label: "UIUC" },
  { id: "timan", label: "TIMAN" },
  { id: "ibm", label: "IBM–Illinois" },
  { id: "visibilityx", label: "visibilityx.ai" },
  { id: "hiabr", label: "HiABR" },
  { id: "vgi", label: "VGI-Bench" },
  { id: "pir", label: "PIR-Arena" },
  { id: "toolkit", label: "Toolkit" },
  { id: "contact", label: "Fade out" },
];
