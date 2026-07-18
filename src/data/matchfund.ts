export type Sector = "AI" | "Climate" | "Fintech" | "Bio" | "Devtools" | "Robotics" | "Consumer";
export type Stage = "Idea" | "Hackathon" | "Prototype" | "Pre-seed" | "Seed";

export type Founder = {
  id: string;
  name: string;
  headline: string;
  bio: string;
  location: string;
  avatar: string; // dicebear url
  initials: string;
  skills: string[];
  sector: Sector;
  stage: Stage;
  companyId?: string;
  openTo: "opportunities" | "cofounder" | "not-open";
  availableForRelocation?: boolean;
  scores: { fit: number; idea: number; traction: number; trust: number };
  matchReason: string;
  fitBreakdown: {
    domain: number;
    technical: number;
    execution: number;
    market: number;
    team: number;
  };
  signals: { hackathonWins: number; githubActivity: "High" | "Med" | "Low"; priorProjects: number; teamSize: string };
  hackathons: { event: string; date: string; placement: string; project: string }[];
  experience: { years: string; role: string; company: string; logoColor: string }[];
  education: { degree: string; field: string; school: string; abbrev: string }[];
  updates: { text: string; when: string }[];
  team: string[]; // initials
  verified: boolean;
};

export type Company = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  sector: Sector;
  stage: Stage;
  location: string;
  founded: number;
  teamSize: number;
  funding: string;
  signal: "High Signal" | "Medium" | "Emerging";
  scores: { traction: number; trust: number };
  kpis: { pilots: number; arr: string; lois: number; evidenceQuality: number; verification: number };
  deltas: { pilots: string; arr: string; lois: string; evidence: string; verification: string };
  timeline: { month: string; value: number }[];
  evidence: { title: string; type: string; size: string; confidence: "High" | "Medium" }[];
  signals: string[];
  risk: string;
  recommendation: "Shortlist" | "Watch" | "Pass";
  rationale: string;
};

export type Grant = {
  id: string;
  name: string;
  type: "Accelerator" | "Grant" | "Angel" | "Hackathon";
  amount: string;
  deadline: string;
  location: string;
  sectors: Sector[];
  stages: Stage[];
  description: string;
  matchScore: number;
  matchReason: string;
  logoColor: string;
  initials: string;
};

const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear&backgroundColor=1e3a5f,0f2a44`;

export const founders: Founder[] = [
  {
    id: "alex-chen",
    name: "Alex Chen",
    headline: "Co-founder & CEO @ VectorNav",
    bio: "Building the future of autonomous navigation. Ex-engineer at Tesla Autopilot with a passion for turning complex problems into elegant solutions.",
    location: "San Francisco, CA",
    avatar: avatar("Alex Chen"),
    initials: "AC",
    skills: ["AI / Robotics", "Computer Vision", "Sensors"],
    sector: "Robotics",
    stage: "Seed",
    companyId: "vectornav",
    openTo: "opportunities",
    availableForRelocation: true,
    scores: { fit: 92, idea: 88, traction: 72, trust: 91 },
    matchReason: "Autonomous systems · Technical founder · Ex-Tesla Autopilot",
    fitBreakdown: { domain: 95, technical: 93, execution: 90, market: 88, team: 87 },
    signals: { hackathonWins: 2, githubActivity: "High", priorProjects: 3, teamSize: "3/4" },
    hackathons: [
      { event: "TechCrunch Disrupt 2025", date: "Sep 2025", placement: "Winner", project: "VectorNav v0" },
      { event: "MIT AI Hack", date: "Mar 2025", placement: "Finalist", project: "PathSense" },
    ],
    experience: [
      { years: "2021 – 2023", role: "Senior Software Engineer", company: "Tesla Autopilot", logoColor: "oklch(0.68 0.19 25)" },
      { years: "2019 – 2021", role: "Robotics Engineer", company: "Skydio", logoColor: "oklch(0.6 0.15 220)" },
      { years: "2017 – 2019", role: "Research Assistant", company: "Stanford University", logoColor: "oklch(0.72 0.17 22)" },
    ],
    education: [
      { degree: "MS", field: "Robotics", school: "Carnegie Mellon University", abbrev: "CMU" },
      { degree: "BS", field: "Electrical Engineering", school: "Stanford University", abbrev: "S" },
    ],
    updates: [
      { text: "Closed $2.1M Seed round", when: "2 weeks ago" },
      { text: "Landed pilot with Fortune 500 client", when: "1 month ago" },
      { text: "Team expanded with 2 engineers", when: "2 months ago" },
    ],
    team: ["AC", "MR", "JK"],
    verified: true,
  },
  {
    id: "priya-patel",
    name: "Priya Patel",
    headline: "Solo builder — pre-company",
    bio: "PhD dropout building carbon accounting for small manufacturers. Shipped 3 hackathon MVPs in 6 months, all in production with pilot users.",
    location: "Boston, MA",
    avatar: avatar("Priya Patel"),
    initials: "PP",
    skills: ["Climate Tech", "Data Engineering", "ML"],
    sector: "Climate",
    stage: "Hackathon",
    openTo: "cofounder",
    scores: { fit: 84, idea: 79, traction: 58, trust: 82 },
    matchReason: "Climate technical founder · 3 shipped hackathon projects · Pilot users",
    fitBreakdown: { domain: 88, technical: 91, execution: 82, market: 76, team: 60 },
    signals: { hackathonWins: 3, githubActivity: "High", priorProjects: 5, teamSize: "1/3" },
    hackathons: [
      { event: "ClimateHack Boston", date: "Jun 2026", placement: "Winner", project: "CarbonLedger" },
      { event: "Y Combinator Hacks", date: "Apr 2026", placement: "Category Winner", project: "EmitTrace" },
      { event: "MIT Climate Hack", date: "Feb 2026", placement: "Finalist", project: "GridWatch" },
    ],
    experience: [
      { years: "2023 – 2025", role: "ML Engineer", company: "Watershed", logoColor: "oklch(0.86 0.17 155)" },
      { years: "2021 – 2023", role: "PhD Candidate", company: "MIT Media Lab", logoColor: "oklch(0.68 0.19 25)" },
    ],
    education: [
      { degree: "MS", field: "Computer Science", school: "MIT", abbrev: "MIT" },
      { degree: "BS", field: "Physics", school: "Caltech", abbrev: "CT" },
    ],
    updates: [
      { text: "Third hackathon win in 4 months", when: "1 week ago" },
      { text: "Pilot with 2 SMB manufacturers", when: "3 weeks ago" },
    ],
    team: ["PP"],
    verified: true,
  },
  {
    id: "marcus-okafor",
    name: "Marcus Okafor",
    headline: "Co-founder & CTO @ AeroTerra",
    bio: "Direct air capture platform with modular systems for industrial deployment. Ex-Climeworks engineer with three patents in sorbent chemistry.",
    location: "San Francisco, CA",
    avatar: avatar("Marcus Okafor"),
    initials: "MO",
    skills: ["Climate Tech", "Chemistry", "Hardware"],
    sector: "Climate",
    stage: "Seed",
    companyId: "aeroterra",
    openTo: "opportunities",
    scores: { fit: 89, idea: 87, traction: 72, trust: 91 },
    matchReason: "Carbon removal · Deep-tech founder · Enterprise pilots",
    fitBreakdown: { domain: 94, technical: 92, execution: 86, market: 84, team: 90 },
    signals: { hackathonWins: 1, githubActivity: "Med", priorProjects: 2, teamSize: "4/4" },
    hackathons: [
      { event: "XPRIZE Carbon Removal", date: "Nov 2025", placement: "Milestone Winner", project: "AeroTerra Alpha" },
    ],
    experience: [
      { years: "2020 – 2024", role: "Principal Engineer", company: "Climeworks", logoColor: "oklch(0.86 0.17 155)" },
      { years: "2016 – 2020", role: "Research Scientist", company: "ETH Zurich", logoColor: "oklch(0.6 0.15 220)" },
    ],
    education: [
      { degree: "PhD", field: "Chemical Engineering", school: "ETH Zurich", abbrev: "ETH" },
    ],
    updates: [
      { text: "Signed Heidelberg Cement pilot", when: "10 days ago" },
      { text: "Won TÜV SÜD tech validation", when: "1 month ago" },
    ],
    team: ["MO", "SB", "JT", "AR"],
    verified: true,
  },
  {
    id: "sana-rivera",
    name: "Sana Rivera",
    headline: "Hackathon builder — Devtools",
    bio: "Building an open-source alternative to Retool. 4k GitHub stars in 3 months, growing 40% MoM, no company yet.",
    location: "Remote (LATAM)",
    avatar: avatar("Sana Rivera"),
    initials: "SR",
    skills: ["Devtools", "TypeScript", "Open Source"],
    sector: "Devtools",
    stage: "Prototype",
    openTo: "opportunities",
    availableForRelocation: true,
    scores: { fit: 81, idea: 84, traction: 66, trust: 78 },
    matchReason: "Devtools open source · Strong solo builder · Growing community",
    fitBreakdown: { domain: 86, technical: 92, execution: 84, market: 72, team: 55 },
    signals: { hackathonWins: 2, githubActivity: "High", priorProjects: 6, teamSize: "1/2" },
    hackathons: [
      { event: "Vercel Ship Hack", date: "May 2026", placement: "Winner", project: "Panelforge" },
      { event: "Supabase LW12", date: "Dec 2025", placement: "Finalist", project: "SchemaFlow" },
    ],
    experience: [
      { years: "2022 – 2025", role: "Staff Engineer", company: "Vercel", logoColor: "oklch(0.96 0.01 250)" },
      { years: "2019 – 2022", role: "Senior Engineer", company: "GitHub", logoColor: "oklch(0.6 0.15 220)" },
    ],
    education: [
      { degree: "BS", field: "Computer Science", school: "Universidad de Chile", abbrev: "UC" },
    ],
    updates: [
      { text: "Crossed 4k GitHub stars", when: "5 days ago" },
      { text: "40% MoM active user growth", when: "2 weeks ago" },
    ],
    team: ["SR"],
    verified: true,
  },
  {
    id: "kenji-tanaka",
    name: "Kenji Tanaka",
    headline: "Founder @ Synapse Bio",
    bio: "Protein language models for drug discovery. Ex-DeepMind AlphaFold contributor, now shipping a foundational biotech platform.",
    location: "London, UK",
    avatar: avatar("Kenji Tanaka"),
    initials: "KT",
    skills: ["Bio", "ML", "Protein Design"],
    sector: "Bio",
    stage: "Pre-seed",
    companyId: "synapsebio",
    openTo: "opportunities",
    scores: { fit: 90, idea: 92, traction: 54, trust: 86 },
    matchReason: "AI × Bio · Ex-DeepMind · Frontier model in production",
    fitBreakdown: { domain: 96, technical: 95, execution: 84, market: 82, team: 78 },
    signals: { hackathonWins: 0, githubActivity: "Med", priorProjects: 4, teamSize: "2/4" },
    hackathons: [],
    experience: [
      { years: "2020 – 2025", role: "Research Scientist", company: "DeepMind", logoColor: "oklch(0.6 0.15 220)" },
      { years: "2018 – 2020", role: "Bioinformatics Engineer", company: "Genentech", logoColor: "oklch(0.86 0.17 155)" },
    ],
    education: [
      { degree: "PhD", field: "Computational Biology", school: "Cambridge", abbrev: "CB" },
    ],
    updates: [
      { text: "First pharma design partner signed", when: "1 week ago" },
    ],
    team: ["KT", "HS"],
    verified: true,
  },
  {
    id: "leah-kwon",
    name: "Leah Kwon",
    headline: "Hackathon builder — Consumer AI",
    bio: "18-year-old shipping consumer AI products. Two apps at 50k+ users, both built in hackathons and grown solo since.",
    location: "Seoul, South Korea",
    avatar: avatar("Leah Kwon"),
    initials: "LK",
    skills: ["Consumer", "iOS", "AI Products"],
    sector: "Consumer",
    stage: "Hackathon",
    openTo: "opportunities",
    availableForRelocation: true,
    scores: { fit: 76, idea: 74, traction: 82, trust: 71 },
    matchReason: "Prodigy consumer builder · 50k+ users · Ships fast",
    fitBreakdown: { domain: 72, technical: 88, execution: 92, market: 78, team: 55 },
    signals: { hackathonWins: 4, githubActivity: "High", priorProjects: 7, teamSize: "1/2" },
    hackathons: [
      { event: "Cal Hacks", date: "Oct 2025", placement: "Grand Prize", project: "Moodloop" },
      { event: "HackMIT", date: "Sep 2025", placement: "Winner", project: "Voxel" },
    ],
    experience: [
      { years: "2024 – 2025", role: "Solo builder", company: "Independent", logoColor: "oklch(0.86 0.17 155)" },
    ],
    education: [
      { degree: "Enrolled", field: "Computer Science", school: "Seoul National University", abbrev: "SN" },
    ],
    updates: [
      { text: "Moodloop crossed 50k MAU", when: "3 days ago" },
      { text: "Featured on Product Hunt", when: "2 weeks ago" },
    ],
    team: ["LK"],
    verified: false,
  },
  {
    id: "diego-alvarez",
    name: "Diego Alvarez",
    headline: "Co-founder @ Ledgerly",
    bio: "Compliance automation for LATAM fintechs. Ex-Nubank compliance lead. Sold first pilot in month 2.",
    location: "Mexico City",
    avatar: avatar("Diego Alvarez"),
    initials: "DA",
    skills: ["Fintech", "Compliance", "LATAM"],
    sector: "Fintech",
    stage: "Pre-seed",
    companyId: "ledgerly",
    openTo: "opportunities",
    scores: { fit: 78, idea: 76, traction: 68, trust: 84 },
    matchReason: "Fintech infra · Regulatory expertise · Revenue in month 2",
    fitBreakdown: { domain: 89, technical: 74, execution: 82, market: 84, team: 78 },
    signals: { hackathonWins: 0, githubActivity: "Med", priorProjects: 2, teamSize: "3/3" },
    hackathons: [],
    experience: [
      { years: "2020 – 2025", role: "Head of Compliance", company: "Nubank", logoColor: "oklch(0.65 0.2 300)" },
    ],
    education: [
      { degree: "MBA", field: "Finance", school: "IPADE", abbrev: "IP" },
    ],
    updates: [{ text: "First paid pilot closed", when: "3 weeks ago" }],
    team: ["DA", "RM", "CB"],
    verified: true,
  },
  {
    id: "nadia-ahmed",
    name: "Nadia Ahmed",
    headline: "Idea-stage founder — AI × Legal",
    bio: "Ex-litigator turned technical founder. Currently in stealth building AI tooling for contract disputes.",
    location: "New York, NY",
    avatar: avatar("Nadia Ahmed"),
    initials: "NA",
    skills: ["Legal Tech", "LLMs", "Product"],
    sector: "AI",
    stage: "Idea",
    openTo: "cofounder",
    scores: { fit: 71, idea: 68, traction: 42, trust: 65 },
    matchReason: "Domain-expert founder · Vertical AI thesis · Cofounder seeking",
    fitBreakdown: { domain: 92, technical: 62, execution: 68, market: 80, team: 52 },
    signals: { hackathonWins: 0, githubActivity: "Low", priorProjects: 1, teamSize: "1/2" },
    hackathons: [],
    experience: [
      { years: "2019 – 2025", role: "Senior Associate", company: "Cravath, Swaine & Moore", logoColor: "oklch(0.6 0.15 220)" },
    ],
    education: [
      { degree: "JD", field: "Law", school: "Yale Law School", abbrev: "YL" },
    ],
    updates: [{ text: "Left law firm to build full-time", when: "2 weeks ago" }],
    team: ["NA"],
    verified: false,
  },
];

export const companies: Record<string, Company> = {
  vectornav: {
    id: "vectornav",
    name: "VectorNav",
    tagline: "Autonomous navigation systems",
    description: "Building next-gen perception and navigation systems for autonomous robots.",
    sector: "Robotics",
    stage: "Seed",
    location: "San Francisco, CA",
    founded: 2023,
    teamSize: 3,
    funding: "$2.1M",
    signal: "High Signal",
    scores: { traction: 72, trust: 91 },
    kpis: { pilots: 6, arr: "$1.2M", lois: 14, evidenceQuality: 88, verification: 93 },
    deltas: { pilots: "+20%", arr: "+35%", lois: "+27%", evidence: "High quality", verification: "+8%" },
    timeline: [
      { month: "Jan", value: 22 }, { month: "Feb", value: 28 }, { month: "Mar", value: 35 },
      { month: "Apr", value: 42 }, { month: "May", value: 48 }, { month: "Jun", value: 55 },
      { month: "Jul", value: 62 }, { month: "Aug", value: 60 }, { month: "Sep", value: 68 },
      { month: "Oct", value: 75 }, { month: "Nov", value: 82 }, { month: "Now", value: 91 },
    ],
    evidence: [
      { title: "Pilot results — Heidelberg Cement", type: "Contract", size: "2.4 MB", confidence: "High" },
      { title: "Revenue report — Q3 2025", type: "Financial", size: "1.1 MB", confidence: "High" },
      { title: "Customer LOI — Microsoft", type: "LOI", size: "0.9 MB", confidence: "Medium" },
      { title: "Tech validation — TÜV SÜD", type: "Certification", size: "1.7 MB", confidence: "High" },
    ],
    signals: [
      "Strong pilot execution with enterprise customers",
      "Growing revenue with diversified pipeline",
      "High-quality evidence with third-party verification",
      "Market demand tailwinds and policy support",
    ],
    risk: "Early stage scaling and capital intensity",
    recommendation: "Shortlist",
    rationale: "Strong early traction with validated pilots, growing revenue signals, and high-quality evidence.",
  },
  aeroterra: {
    id: "aeroterra",
    name: "AeroTerra",
    tagline: "Carbon removal technology",
    description: "Direct air capture platform with modular systems for industrial deployment.",
    sector: "Climate",
    stage: "Seed",
    location: "San Francisco, CA",
    founded: 2024,
    teamSize: 4,
    funding: "$3.5M",
    signal: "High Signal",
    scores: { traction: 78, trust: 88 },
    kpis: { pilots: 4, arr: "$800K", lois: 9, evidenceQuality: 84, verification: 90 },
    deltas: { pilots: "+33%", arr: "+42%", lois: "+18%", evidence: "High quality", verification: "+5%" },
    timeline: [
      { month: "Jan", value: 18 }, { month: "Feb", value: 24 }, { month: "Mar", value: 30 },
      { month: "Apr", value: 38 }, { month: "May", value: 46 }, { month: "Jun", value: 52 },
      { month: "Jul", value: 58 }, { month: "Aug", value: 64 }, { month: "Sep", value: 70 },
      { month: "Oct", value: 74 }, { month: "Nov", value: 76 }, { month: "Now", value: 78 },
    ],
    evidence: [
      { title: "XPRIZE milestone verification", type: "Certification", size: "3.1 MB", confidence: "High" },
      { title: "Heidelberg Cement pilot MOU", type: "Contract", size: "1.4 MB", confidence: "High" },
      { title: "TÜV SÜD tech validation", type: "Certification", size: "2.0 MB", confidence: "High" },
    ],
    signals: [
      "XPRIZE milestone winner",
      "Enterprise pilot with Heidelberg Cement",
      "Three patents granted",
      "Policy tailwinds from 45Q credits",
    ],
    risk: "Hardware capex and long sales cycles",
    recommendation: "Shortlist",
    rationale: "Deep-tech team with credentialed IP and enterprise pilot velocity.",
  },
  synapsebio: {
    id: "synapsebio",
    name: "Synapse Bio",
    tagline: "Protein language models for drug discovery",
    description: "Foundation-model platform for de novo protein design, targeting hard therapeutic modalities.",
    sector: "Bio",
    stage: "Pre-seed",
    location: "London, UK",
    founded: 2025,
    teamSize: 2,
    funding: "Pre-seed",
    signal: "Emerging",
    scores: { traction: 54, trust: 82 },
    kpis: { pilots: 1, arr: "$0", lois: 3, evidenceQuality: 76, verification: 82 },
    deltas: { pilots: "New", arr: "—", lois: "+50%", evidence: "Improving", verification: "+3%" },
    timeline: [
      { month: "Jan", value: 8 }, { month: "Feb", value: 12 }, { month: "Mar", value: 18 },
      { month: "Apr", value: 24 }, { month: "May", value: 30 }, { month: "Jun", value: 34 },
      { month: "Jul", value: 40 }, { month: "Aug", value: 44 }, { month: "Sep", value: 48 },
      { month: "Oct", value: 50 }, { month: "Nov", value: 52 }, { month: "Now", value: 54 },
    ],
    evidence: [
      { title: "Pharma design partnership MOU", type: "Contract", size: "1.2 MB", confidence: "Medium" },
      { title: "Model benchmark paper (preprint)", type: "Research", size: "4.8 MB", confidence: "High" },
    ],
    signals: [
      "Ex-DeepMind AlphaFold contributor",
      "First pharma design partner",
      "Benchmark model beats public SOTA on 3 tasks",
    ],
    risk: "Team of two — recruiting risk on wet-lab side",
    recommendation: "Watch",
    rationale: "Extraordinary technical foundation; monitor for team completeness and revenue signals.",
  },
  ledgerly: {
    id: "ledgerly",
    name: "Ledgerly",
    tagline: "Compliance automation for LATAM fintechs",
    description: "Regulatory automation platform tailored to LATAM banking regulators.",
    sector: "Fintech",
    stage: "Pre-seed",
    location: "Mexico City",
    founded: 2025,
    teamSize: 3,
    funding: "Pre-seed",
    signal: "Medium",
    scores: { traction: 62, trust: 79 },
    kpis: { pilots: 2, arr: "$120K", lois: 5, evidenceQuality: 72, verification: 78 },
    deltas: { pilots: "+100%", arr: "New", lois: "+40%", evidence: "Building", verification: "+6%" },
    timeline: [
      { month: "Jan", value: 10 }, { month: "Feb", value: 14 }, { month: "Mar", value: 20 },
      { month: "Apr", value: 26 }, { month: "May", value: 32 }, { month: "Jun", value: 38 },
      { month: "Jul", value: 44 }, { month: "Aug", value: 48 }, { month: "Sep", value: 54 },
      { month: "Oct", value: 58 }, { month: "Nov", value: 60 }, { month: "Now", value: 62 },
    ],
    evidence: [
      { title: "Paid pilot — regional bank", type: "Contract", size: "0.8 MB", confidence: "High" },
      { title: "Compliance framework whitepaper", type: "Research", size: "2.2 MB", confidence: "Medium" },
    ],
    signals: [
      "First paid pilot in month 2",
      "Founder-market fit — ex-Nubank compliance",
      "Regulatory relationships in 3 countries",
    ],
    risk: "Fragmented LATAM regulation increases GTM complexity",
    recommendation: "Watch",
    rationale: "Strong founder-market fit with early revenue; watch for expansion beyond first market.",
  },
};

export const grants: Grant[] = [
  {
    id: "yc-w26",
    name: "Y Combinator W26",
    type: "Accelerator",
    amount: "$500K",
    deadline: "Sep 12",
    location: "Remote / SF",
    sectors: ["AI", "Climate", "Fintech", "Bio", "Devtools", "Robotics", "Consumer"],
    stages: ["Idea", "Hackathon", "Prototype", "Pre-seed"],
    description: "3-month batch program. $500K standard deal for 7% equity.",
    matchScore: 91,
    matchReason: "Strong technical founder · Product traction · Global batch fit",
    logoColor: "oklch(0.72 0.17 22)",
    initials: "YC",
  },
  {
    id: "ef-lon",
    name: "Entrepreneur First",
    type: "Accelerator",
    amount: "£80K",
    deadline: "Rolling",
    location: "London, Berlin, Bangalore, SF",
    sectors: ["AI", "Bio", "Climate", "Devtools", "Robotics"],
    stages: ["Idea", "Hackathon"],
    description: "Talent investor for pre-idea technical founders. Cofounder matching + capital.",
    matchScore: 88,
    matchReason: "Pre-idea technical fit · Cofounder matching",
    logoColor: "oklch(0.86 0.17 155)",
    initials: "EF",
  },
  {
    id: "ondeck-fellow",
    name: "On Deck Founders",
    type: "Accelerator",
    amount: "$125K",
    deadline: "Aug 30",
    location: "Remote",
    sectors: ["AI", "Fintech", "Consumer", "Devtools"],
    stages: ["Idea", "Prototype", "Pre-seed"],
    description: "12-week fellowship with 100+ founder cohort and check.",
    matchScore: 82,
    matchReason: "Consumer / devtools tilt · Community-first",
    logoColor: "oklch(0.65 0.18 300)",
    initials: "OD",
  },
  {
    id: "antler-sea",
    name: "Antler",
    type: "Accelerator",
    amount: "$300K",
    deadline: "Oct 4",
    location: "20+ cities",
    sectors: ["AI", "Fintech", "Climate", "Consumer", "Devtools"],
    stages: ["Idea", "Hackathon"],
    description: "Day-zero investor. Cohort-based cofounder matching + pre-seed check.",
    matchScore: 79,
    matchReason: "Day-zero cofounder matching",
    logoColor: "oklch(0.68 0.19 25)",
    initials: "AN",
  },
  {
    id: "arpa-e",
    name: "ARPA-E OPEN 2026",
    type: "Grant",
    amount: "$1M – $10M",
    deadline: "Nov 20",
    location: "United States",
    sectors: ["Climate", "Robotics"],
    stages: ["Prototype", "Pre-seed", "Seed"],
    description: "US Department of Energy transformative energy research grant.",
    matchScore: 87,
    matchReason: "Climate deep-tech · Prototype-stage technical rigor",
    logoColor: "oklch(0.6 0.15 220)",
    initials: "AE",
  },
  {
    id: "sbir-nsf",
    name: "NSF SBIR Phase I",
    type: "Grant",
    amount: "$275K",
    deadline: "Rolling",
    location: "United States",
    sectors: ["AI", "Bio", "Climate", "Robotics"],
    stages: ["Prototype", "Pre-seed"],
    description: "Non-dilutive R&D funding for deep-tech startups.",
    matchScore: 74,
    matchReason: "Non-dilutive deep-tech capital",
    logoColor: "oklch(0.6 0.15 220)",
    initials: "NSF",
  },
  {
    id: "climate-fellows",
    name: "Climate Fellows",
    type: "Angel",
    amount: "$50K – $250K",
    deadline: "Rolling",
    location: "Global",
    sectors: ["Climate"],
    stages: ["Idea", "Hackathon", "Prototype"],
    description: "Angel collective focused exclusively on climate founders.",
    matchScore: 90,
    matchReason: "Climate-focused angels · Warm intros",
    logoColor: "oklch(0.86 0.17 155)",
    initials: "CF",
  },
  {
    id: "tc-disrupt",
    name: "TechCrunch Disrupt Battlefield",
    type: "Hackathon",
    amount: "$100K prize",
    deadline: "Aug 1",
    location: "San Francisco",
    sectors: ["AI", "Devtools", "Fintech", "Consumer"],
    stages: ["Hackathon", "Prototype", "Pre-seed"],
    description: "Flagship pitch competition with global press exposure.",
    matchScore: 76,
    matchReason: "Press exposure · Investor audience",
    logoColor: "oklch(0.82 0.15 80)",
    initials: "TC",
  },
];

export const founderById = (id: string) => founders.find((f) => f.id === id);
export const companyById = (id: string) => companies[id];

export type DiscoveredSource = {
  kind: "github" | "hackathon" | "arxiv" | "linkedin" | "producthunt" | "press" | "web";
  label: string;
  detail: string;
  url?: string;
};

// Derive "where we found this founder" from existing signals — used on the
// home discovery list and the founder profile page.
export function discoveredSources(f: Founder): DiscoveredSource[] {
  const out: DiscoveredSource[] = [];
  if (f.signals.githubActivity !== "Low") {
    out.push({
      kind: "github",
      label: "GitHub",
      detail: `${f.signals.githubActivity} activity · ${f.signals.priorProjects} shipped projects`,
      url: `https://github.com/${f.name.split(" ")[0].toLowerCase()}`,
    });
  }
  for (const h of f.hackathons.slice(0, 2)) {
    out.push({ kind: "hackathon", label: h.event, detail: `${h.placement} · ${h.date}` });
  }
  if (f.sector === "Bio" || f.sector === "AI" || f.sector === "Robotics") {
    out.push({
      kind: "arxiv",
      label: f.sector === "Bio" ? "Semantic Scholar" : "arXiv",
      detail: `${f.education[0]?.school ?? "Research"} · ${f.skills[0]}`,
    });
  }
  out.push({
    kind: "linkedin",
    label: "LinkedIn",
    detail: f.experience[0] ? `${f.experience[0].role} · ${f.experience[0].company}` : f.location,
  });
  if (f.updates.some((u) => /Product Hunt/i.test(u.text))) {
    out.push({ kind: "producthunt", label: "Product Hunt", detail: "Featured launch" });
  }
  const growth = f.updates.find((u) => /MAU|users|stars/i.test(u.text));
  if (growth) out.push({ kind: "press", label: "Signal feed", detail: growth.text });
  return out;
}

