import dotenv from 'dotenv'
dotenv.config()

import { upsertCompanies } from '../src/backend/services/portfolio'
import { db } from '../src/backend/db/client'

/**
 * Scrapes initialized.com for portfolio companies.
 * Falls back to curated seed data if scraping is blocked.
 */

// Full portfolio from initialized.com/companies (as of March 2026)
// keywords: search terms for news APIs. Required for ambiguous company names.
const SEED_COMPANIES = [
  { name: '7 Cups', description: 'Affordable online therapy and emotional support', sector: 'Healthcare', keywords: ['7 Cups therapy', '7cups'] },
  { name: 'AdQuick', description: 'Marketplace to buy and sell outdoor advertising', sector: 'Enterprise' },
  { name: 'Adyton', description: 'Mobile applications for the Department of Defense', sector: 'Enterprise' },
  { name: 'A-Frame Brands', description: 'Talent-led sustainable personal care brands', sector: 'Consumer', keywords: ['A-Frame Brands', 'A-Frame personal care'] },
  { name: 'Albedo', description: 'Highest resolution satellite imagery commercially available', sector: 'Frontier Tech', keywords: ['Albedo satellite', 'Albedo space'] },
  { name: 'Algolia', description: 'Search and recommendation APIs for websites and apps', sector: 'Enterprise' },
  { name: 'Alix', description: 'AI-powered technology to support estate settlement', sector: 'Fintech', keywords: ['Alix estate', 'Alix AI legal'] },
  { name: 'Alliance DAO', description: 'Accelerator for crypto founders', sector: 'Crypto' },
  { name: 'Apero', description: 'Enterprise billing service for medical practices', sector: 'Healthcare' },
  { name: 'Apollo', description: 'GraphQL developer platform for application development', sector: 'Enterprise', keywords: ['Apollo GraphQL'] },
  { name: 'AptDeco', description: 'Furniture resale marketplace handling logistics', sector: 'Consumer' },
  { name: 'Arena AI', description: 'AI translates company data into simulation platform', sector: 'Enterprise', keywords: ['Arena AI simulation'] },
  { name: 'Around', description: 'Video calling designed for hybrid-remote teams', sector: 'Enterprise', keywords: ['Around video', 'Around.co'] },
  { name: 'AstroForge', description: 'Mining asteroids to extract valuable minerals', sector: 'Frontier Tech' },
  { name: 'Athelas', description: 'Medical testing with remote patient monitoring', sector: 'Healthcare' },
  { name: 'Atomic Finance', description: 'Earn yield on Bitcoin without custody loss', sector: 'Crypto' },
  { name: 'Atoms', description: 'Impeccably designed shoes for everyday wear', sector: 'Consumer', keywords: ['Atoms shoes'] },
  { name: 'Automat', description: 'Creating automations as easy as uploading video', sector: 'Enterprise', keywords: ['Automat AI automation'] },
  { name: 'Ava', description: 'Live transcription and conversation services for deaf and hard-of-hearing', sector: 'Enterprise', keywords: ['"Ava" accessibility deaf transcription', '"Ava" hearing startup'] },
  { name: 'Ava Labs', description: 'AVAX cryptocurrency platform using Avalanche consensus', sector: 'Crypto' },
  { name: 'Azura', description: 'Full-stack trading platform for DeFi', sector: 'Crypto', keywords: ['Azura DeFi', 'Azura trading'] },
  { name: 'Basalt', description: 'Brings AI into orbit for business and defense applications', sector: 'Frontier Tech', keywords: ['Basalt space AI'] },
  { name: 'Beeper', description: 'Universal chat app with encrypted messaging across platforms', sector: 'Consumer' },
  { name: 'Bellhops', description: 'Full-service moving company bookable online', sector: 'Consumer' },
  { name: 'Beyond Aero', description: 'Electric business aircraft using hydrogen propulsion', sector: 'Climate' },
  { name: 'Bison Trails', description: 'Secure blockchain infrastructure platform', sector: 'Crypto' },
  { name: 'Bland AI', description: 'AI phone calling platform for enterprises', sector: 'Enterprise', keywords: ['Bland AI', 'Bland phone'] },
  { name: 'Blend', description: 'Cloud banking infrastructure for mortgage and consumer lending', sector: 'Fintech', keywords: ['Blend fintech', 'Blend lending'] },
  { name: 'Bodyport', description: 'Digital therapeutics via biomarker platform devices', sector: 'Healthcare' },
  { name: 'Braid', description: 'Platform for creators to share content centrally', sector: 'Consumer', keywords: ['Braid creator', 'Braid social'] },
  { name: 'Bristle', description: 'Saliva analysis testing for oral microbiome health', sector: 'Healthcare' },
  { name: 'Bruce', description: 'AI relationship intelligence and reputation platform', sector: 'Enterprise', keywords: ['"Bruce AI" reputation intelligence', '"Bruce" startup relationship intelligence'] },
  { name: 'Caliza', description: 'Financial infrastructure removing global commerce borders', sector: 'Fintech' },
  { name: 'Clairity', description: 'Low-cost systems for direct air CO2 capture', sector: 'Climate' },
  { name: 'Clever', description: 'Single sign-on portal for K-12 schools', sector: 'Enterprise', keywords: ['Clever SSO', 'Clever education'] },
  { name: 'Clipboard Health', description: 'Marketplace for healthcare professionals and facilities', sector: 'Healthcare' },
  { name: 'Clone Robotics', description: 'Musculoskeletal intelligent androids for daily tasks', sector: 'Frontier Tech', keywords: ['Clone Robotics', 'Clone android'] },
  { name: 'Cofertility', description: 'Fertility ecosystem enabling free egg freezing via donation', sector: 'Healthcare' },
  { name: 'Coinbase', description: 'World-leading cryptocurrency exchange platform', sector: 'Crypto' },
  { name: 'CoinTracker', description: 'Portfolio and tax manager for cryptocurrency holders', sector: 'Fintech' },
  { name: 'Color Health', description: 'Technology and infrastructure for population health initiatives', sector: 'Healthcare', keywords: ['Color Health', 'Color Genomics'] },
  { name: 'Coordinate', description: 'Software for professional services management', sector: 'Enterprise', keywords: ['CoordinateHQ', 'Coordinate software'] },
  { name: 'Coperniq', description: 'End-to-end workflow software for solar contractors', sector: 'Climate' },
  { name: 'CreatorDAO', description: 'Empowers content creators to invest in peers', sector: 'Crypto' },
  { name: 'Cron', description: 'Next-generation calendar for professionals', sector: 'Consumer', keywords: ['Cron calendar', 'Cron app'] },
  { name: 'Cruise', description: 'Autonomous vehicle operation technology', sector: 'Frontier Tech', keywords: ['Cruise autonomous', 'Cruise self-driving', 'GM Cruise'] },
  { name: 'Culdesac', description: 'Building smart car-free neighborhoods', sector: 'Real Estate' },
  { name: 'Curri', description: 'All-in-one logistics platform for construction distributors', sector: 'Enterprise' },
  { name: 'Data Driven Bioscience', description: 'Tools for genomics diagnosis of blood cancers', sector: 'Healthcare' },
  { name: 'Datasaur', description: 'Customizable AI tool for NLP data labeling', sector: 'Enterprise' },
  { name: 'Deepnight', description: 'Next-gen night vision combining AI and imaging', sector: 'Frontier Tech' },
  { name: 'Depict.ai', description: 'E-commerce product recommendations for retailers', sector: 'Enterprise' },
  { name: 'DevCycle', description: 'Open standards feature management platform', sector: 'Enterprise' },
  { name: 'Digger', description: 'Infrastructure-as-code orchestration for developers', sector: 'Enterprise', keywords: ['Digger IaC', 'Digger infrastructure'] },
  { name: 'Double', description: 'Telepresence robot for remote workers', sector: 'Frontier Tech', keywords: ['"Double Robotics" telepresence', '"Double Robotics" startup funding'] },
  { name: 'Drip Capital', description: 'Trade finance solutions for importers and exporters', sector: 'Fintech' },
  { name: 'EasyPost', description: 'Shipping integration APIs for e-commerce businesses', sector: 'Enterprise' },
  { name: 'Eclipse Foods', description: 'Plant-based dairy products with traditional taste', sector: 'Climate' },
  { name: 'Enable Medicine', description: 'Disease maps enabling biological discovery', sector: 'Healthcare', keywords: ['Enable Medicine', 'Enable bio'] },
  { name: 'Envoy', description: 'Workplace visitor and workspace management platform', sector: 'Enterprise', keywords: ['Envoy workplace', 'Envoy visitor'] },
  { name: 'Feanix', description: 'AI and genomics optimizing livestock management', sector: 'Enterprise' },
  { name: 'Flexport', description: 'Global supply chain logistics platform operating in 80+ countries', sector: 'Enterprise' },
  { name: 'Flock Safety', description: 'License plate and gunshot detection cameras for public safety', sector: 'Enterprise' },
  { name: 'Fly.io', description: 'Platform to run full-stack apps close to users globally', sector: 'Enterprise' },
  { name: 'Formic', description: 'Robotic rental service for automated manufacturing', sector: 'Enterprise' },
  { name: 'Fourthwall', description: 'Custom-branded creator storefronts and shops', sector: 'Consumer' },
  { name: 'Front', description: 'Customer communications hub for team collaboration', sector: 'Enterprise', keywords: ['"Front" customer communications platform', '"FrontApp" OR "Front app" team inbox'] },
  { name: 'Garage', description: 'Online marketplace for essential automotive equipment', sector: 'Consumer', keywords: ['Garage marketplace'] },
  { name: 'Glass Health', description: 'AI-powered platform supporting clinical decision-making', sector: 'Healthcare' },
  { name: 'GOAT', description: 'Global sneaker and modern apparel marketplace', sector: 'Consumer' },
  { name: 'Greptile', description: 'AI expert on codebases for code review and pull requests', sector: 'Enterprise' },
  { name: 'Guide Labs', description: 'Interpretable AI systems humans can understand and trust', sector: 'Enterprise' },
  { name: 'Handoff', description: 'AI-powered construction estimating and automation', sector: 'Real Estate', keywords: ['Handoff construction', 'Handoff AI'] },
  { name: 'Heap', description: 'Digital insights platform combining analytics automatically', sector: 'Enterprise', keywords: ['"Heap" analytics startup funding', '"Heap" digital insights Contentsquare'] },
  { name: 'HER', description: 'Dating and community platform for LGBTQ+ women and queer people', sector: 'Consumer', keywords: ['"HER" dating app LGBTQ', '"HER" queer dating startup'] },
  { name: 'HomeVision', description: 'Collateral underwriting powered by machine intelligence', sector: 'Real Estate' },
  { name: 'Horizon Blockchain Games', description: 'Sequence wallet and Skyweaver blockchain gaming', sector: 'Crypto' },
  { name: 'Hummingbot', description: 'Open source toolbox for crypto market making', sector: 'Crypto' },
  { name: 'Instacart', description: 'Same-day grocery delivery and pickup service', sector: 'Consumer' },
  { name: 'Invisible Universe', description: 'Animation studio for kids and family entertainment', sector: 'Consumer' },
  { name: 'Jinx', description: 'Nutritious dog food made with real ingredients', sector: 'Consumer', keywords: ['Jinx dog food'] },
  { name: 'kapa.ai', description: 'AI assistant powered by technical knowledge bases', sector: 'Enterprise' },
  { name: 'Kayhan Space', description: 'Next-generation automation for satellite operations', sector: 'Frontier Tech' },
  { name: 'Kinlo', description: 'Suncare line designed for melanin-rich skin tones', sector: 'Consumer' },
  { name: 'Kinside', description: 'Marketplace connecting daycares with working parents', sector: 'Consumer', keywords: ['Kinside childcare'] },
  { name: 'Laurel', description: 'AI-powered timekeeping for accounting and legal firms', sector: 'Enterprise', keywords: ['Laurel AI timekeeping'] },
  { name: 'LeadGenius', description: 'B2B contact and account data intelligence', sector: 'Enterprise' },
  { name: 'Lever', description: 'Recruiting software combining ATS and CRM', sector: 'Enterprise', keywords: ['"Lever" recruiting ATS talent', '"Lever" hiring software Employ'] },
  { name: 'Lingo.dev', description: 'AI localization engine for software products', sector: 'Enterprise' },
  { name: 'Lob', description: 'APIs for programmatic direct mail and address verification', sector: 'Enterprise' },
  { name: 'LTSE', description: 'U.S. securities exchange for long-term focused companies', sector: 'Fintech', keywords: ['LTSE exchange', 'Long-Term Stock Exchange'] },
  { name: 'Manifold', description: 'Creative ownership platform for web3 creators', sector: 'Crypto' },
  { name: 'Medivis', description: 'Augmented reality platform for surgical visualization', sector: 'Healthcare' },
  { name: 'Mezmo', description: 'Observability pipeline for log data routing and analysis', sector: 'Enterprise' },
  { name: 'Mindstate Design Labs', description: 'Psychedelic-inspired therapeutics for mental health', sector: 'Healthcare' },
  { name: 'MixerBox', description: 'All-in-one media player aggregating streaming services', sector: 'Consumer' },
  { name: 'Modulo', description: 'Biotech reprogramming the brain immune system for neurological diseases', sector: 'Healthcare', keywords: ['Modulo biotech', 'Modulo neuro'] },
  { name: 'NanoVMs', description: 'Cloud unikernel infrastructure for secure applications', sector: 'Enterprise' },
  { name: 'Nara Organics', description: 'USDA organic certified whole milk infant formula', sector: 'Consumer' },
  { name: 'NoScrubs', description: 'Fast and affordable laundry pickup and delivery', sector: 'Consumer' },
  { name: 'Numero', description: 'Campaign fundraising software for political candidates', sector: 'Enterprise', keywords: ['Numero fundraising', 'Numero political'] },
  { name: 'Opendoor', description: 'Digital platform for buying and selling homes instantly', sector: 'Real Estate' },
  { name: 'Orbio Earth', description: 'Satellite imagery platform detecting methane emissions', sector: 'Climate', keywords: ['Orbio Earth', 'Orbio methane'] },
  { name: 'Orbital Operations', description: 'High-thrust vehicles for rapid orbital mobility', sector: 'Frontier Tech' },
  { name: 'Orderful', description: 'Cloud EDI platform for supply chain data exchange', sector: 'Enterprise' },
  { name: 'OutRival', description: 'Conversational AI agents for higher education enrollment', sector: 'Enterprise' },
  { name: 'Pano AI', description: 'Disaster management platform for wildfire and climate resilience', sector: 'Climate', keywords: ['Pano AI', 'Pano wildfire'] },
  { name: 'Panorama Education', description: 'Data platform for student information and school analytics', sector: 'Enterprise' },
  { name: 'Papa', description: 'Connects members to real people for companionship and support', sector: 'Healthcare', keywords: ['"Papa" health companion care startup', '"Papa" healthcare elderly companionship'] },
  { name: 'Paperspace', description: 'Cloud computing platform for machine learning workloads', sector: 'Enterprise' },
  { name: 'Parcha', description: 'Automates compliance and operations using AI agents', sector: 'Enterprise' },
  { name: 'Partiful', description: 'Social events platform for managing invites and event photos', sector: 'Consumer' },
  { name: 'Patreon', description: 'Platform for creators to build memberships and monetize directly', sector: 'Consumer' },
  { name: 'Pax', description: 'Automates duty drawback for tariff refunds on exports', sector: 'Enterprise', keywords: ['Pax tariff', 'Pax duty drawback'] },
  { name: 'PermitFlow', description: 'Workflow software for construction permitting processes', sector: 'Real Estate' },
  { name: 'Picogrid', description: 'Defense technology connecting fragmented military systems', sector: 'Enterprise' },
  { name: 'PIN', description: 'Community fund setup and legal framework platform', sector: 'Crypto', keywords: ['"PIN" community fund crypto startup', '"PIN" legal framework Initialized'] },
  { name: 'PlanGrid', description: 'Project data access for construction teams in the field', sector: 'Enterprise', keywords: ['PlanGrid construction'] },
  { name: 'PlateIQ', description: 'Accounts payable automation for hospitality industry', sector: 'Enterprise' },
  { name: 'Polychain Capital', description: 'Investment firm managing cryptocurrency and blockchain portfolios', sector: 'Crypto', keywords: ['Polychain Capital', 'Polychain crypto'] },
  { name: 'Proudly', description: 'Baby care products designed for melanated skin', sector: 'Consumer' },
  { name: 'Radial Analytics', description: 'AI solutions for healthcare professionals decision-making', sector: 'Healthcare' },
  { name: 'Rainforest QA', description: 'Automated end-to-end software testing platform', sector: 'Enterprise' },
  { name: 'RankScience', description: 'Data science and NLP automating SEO optimization', sector: 'Enterprise' },
  { name: 'Reddit', description: 'World-leading online forum and community platform', sector: 'Consumer' },
  { name: 'Red Planet Labs', description: 'Programming tool changing software development economics', sector: 'Enterprise' },
  { name: 'Reibus', description: 'Marketplace for industrial metals and commodities', sector: 'Enterprise' },
  { name: 'Repacket', description: 'Cybersecurity platform blocking online threats by default', sector: 'Enterprise' },
  { name: 'Rescale', description: 'Cloud platform for high-performance computing and engineering simulation', sector: 'Enterprise' },
  { name: 'Ridecell', description: 'Fleet management and autonomous mobility platform', sector: 'Enterprise' },
  { name: 'Rippling', description: 'Unified HR, IT, and finance platform for businesses', sector: 'Enterprise' },
  { name: 'Ro', description: 'Telehealth platform with personalized care and prescription delivery', sector: 'Healthcare', keywords: ['"Ro" telehealth startup funding', '"Ro" healthcare prescription delivery'] },
  { name: 'Rosebud', description: 'AI-powered journaling for mental health and self-reflection', sector: 'Consumer', keywords: ['Rosebud journal', 'Rosebud AI'] },
  { name: 'Routefusion', description: 'Cross-border payment infrastructure scaling globally', sector: 'Fintech' },
  { name: 'Runway Financial', description: 'Strategic financial planning platform for tech companies', sector: 'Fintech', keywords: ['Runway Financial', 'Runway planning'] },
  { name: 'Runwise', description: 'Smart building technology monitoring heating and water systems', sector: 'Climate', keywords: ['Runwise building', 'Runwise energy'] },
  { name: 'Seamflow', description: 'AI-native tools for regulatory workflow management', sector: 'Enterprise' },
  { name: 'Sendwave', description: 'International money transfer service across continents', sector: 'Fintech' },
  { name: 'Shelf Engine', description: 'Reduces grocery food waste via AI-powered inventory automation', sector: 'Climate' },
  { name: 'Shogun', description: 'Visual page builder and CMS for e-commerce brands', sector: 'Enterprise' },
  { name: 'Sift', description: 'Machine learning platform to detect and prevent digital fraud', sector: 'Enterprise', keywords: ['"Sift" fraud prevention digital trust', '"Sift Science" OR "Sift" fraud detection'] },
  { name: 'Silo', description: 'Produce enterprise resource planning software for food supply', sector: 'Enterprise', keywords: ['Silo food', 'Silo produce'] },
  { name: 'Simple HealthKit', description: 'Complete diagnostics platform addressing health inequity', sector: 'Healthcare' },
  { name: 'SkySelect', description: 'AI-powered procurement for aviation parts and MRO', sector: 'Enterprise' },
  { name: 'Sol', description: 'Decentralized blockchain infrastructure platform', sector: 'Crypto', keywords: ['"Sol" protocol blockchain startup', '"Sol" crypto infrastructure Initialized'] },
  { name: 'Spaceium', description: 'In-space propulsion and refueling technology', sector: 'Frontier Tech' },
  { name: 'Spate', description: 'Predictive trend analytics for consumer brands', sector: 'Enterprise', keywords: ['Spate trends', 'Spate analytics'] },
  { name: 'Speccheck', description: 'Quality assurance and inspection management platform', sector: 'Enterprise' },
  { name: 'Stacker', description: 'No-code platform for building internal business apps', sector: 'Enterprise', keywords: ['Stacker app', 'Stacker no-code'] },
  { name: 'Standard AI', description: 'Computer vision platform for autonomous retail checkout', sector: 'Enterprise' },
  { name: 'Star Catcher Industries', description: 'Space-based power transmission infrastructure', sector: 'Frontier Tech', keywords: ['Star Catcher Industries', 'Star Catcher space'] },
  { name: 'Stellar', description: 'Open blockchain network for fast cross-border payments', sector: 'Crypto', keywords: ['Stellar blockchain', 'Stellar XLM'] },
  { name: 'Streak', description: 'CRM built directly inside Gmail for workflow management', sector: 'Enterprise', keywords: ['"Streak" CRM Gmail startup', '"Streak" CRM funding revenue'] },
  { name: 'Synquote', description: 'Commercial insurance quoting and binding platform', sector: 'Fintech' },
  { name: 'Talos', description: 'Institutional cryptocurrency trading platform', sector: 'Crypto', keywords: ['Talos crypto', 'Talos trading'] },
  { name: 'Terminal 49', description: 'Container tracking and logistics visibility platform', sector: 'Enterprise' },
  { name: 'Termius', description: 'Cross-platform SSH client and server management tool', sector: 'Enterprise' },
  { name: 'The Movement Project', description: 'Fitness and wellness platform for movement education', sector: 'Consumer', keywords: ['The Movement Project', 'TMP fitness'] },
  { name: 'Theorem LP', description: 'Strategic consulting and software engineering services', sector: 'Enterprise' },
  { name: 'TigerEye', description: 'Revenue planning and territory optimization for sales teams', sector: 'Enterprise' },
  { name: 'Tilt', description: 'Leave of absence management platform for employers', sector: 'Enterprise', keywords: ['Tilt leave', 'Tilt HR'] },
  { name: 'Torch', description: 'Leadership development and executive coaching platform', sector: 'Enterprise', keywords: ['"Torch" leadership coaching startup', '"Torch" executive development funding'] },
  { name: 'Trilo', description: 'Enterprise knowledge management and documentation', sector: 'Enterprise', keywords: ['Trilo knowledge', 'Trilo enterprise'] },
  { name: 'TRM Labs', description: 'Blockchain intelligence for compliance and fraud investigation', sector: 'Crypto' },
  { name: 'True Link Financial', description: 'Financial services and protection for seniors and vulnerable adults', sector: 'Fintech' },
  { name: 'Truepill', description: 'Digital pharmacy and telehealth fulfillment infrastructure', sector: 'Healthcare' },
  { name: 'Upwave', description: 'Brand analytics and marketing measurement platform', sector: 'Enterprise', keywords: ['Upwave brand', 'Upwave analytics'] },
  { name: 'Valar Labs', description: 'AI pathology for cancer diagnosis and treatment', sector: 'Healthcare', keywords: ['Valar Labs', 'Valar pathology'] },
  { name: 'Vetcove', description: 'Procurement and ordering platform for veterinary supplies', sector: 'Enterprise' },
  { name: 'Weave', description: 'Customer engagement and communication platform for SMBs', sector: 'Enterprise', keywords: ['Weave communications', 'Weave SMB'] },
  { name: 'Withco', description: 'Platform helping small businesses own their commercial real estate', sector: 'Real Estate', keywords: ['Withco real estate'] },
  { name: 'WorkRamp', description: 'All-in-one learning and development platform for enterprises', sector: 'Enterprise' },
  { name: 'ZeroEntropy', description: 'Enterprise AI search and retrieval platform', sector: 'Enterprise', keywords: ['ZeroEntropy AI', 'ZeroEntropy search'] },
  { name: 'Poker Skill', description: 'Daily puzzles and lessons for poker improvement', sector: 'Consumer' },
]

async function scrapePortfolio() {
  console.log('Attempting to scrape initialized.com portfolio...')

  // Check robots.txt first
  try {
    const robotsRes = await fetch('https://initialized.com/robots.txt')
    const robotsTxt = await robotsRes.text()
    console.log('robots.txt content:', robotsTxt)

    if (robotsTxt.toLowerCase().includes('disallow: /')) {
      console.log('Scraping disallowed by robots.txt — using seed data')
      return useSeedData()
    }
  } catch {
    console.log('Could not fetch robots.txt — using seed data as fallback')
    return useSeedData()
  }

  // Try to scrape the portfolio page
  try {
    const res = await fetch('https://initialized.com/companies', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PortfolioTracker/1.0; educational project)',
      },
    })

    if (!res.ok) {
      console.log(`Portfolio page returned ${res.status} — using seed data`)
      return useSeedData()
    }

    const html = await res.text()

    // Try to extract company data from the HTML
    // This is fragile and depends on site structure — seed data is the safe fallback
    const companyMatches = extractCompaniesFromHTML(html)

    if (companyMatches.length < 10) {
      console.log(`Only found ${companyMatches.length} companies from HTML — using seed data instead`)
      return useSeedData()
    }

    console.log(`Found ${companyMatches.length} companies from initialized.com`)
    const count = await upsertCompanies(companyMatches)
    console.log(`Upserted ${count} companies`)
    return count
  } catch (err) {
    console.error('Scraping failed:', err)
    return useSeedData()
  }
}

function extractCompaniesFromHTML(html: string): Array<{
  name: string
  description?: string
  website?: string
  sector?: string
}> {
  const companies: Array<{
    name: string
    description?: string
    website?: string
    sector?: string
  }> = []

  // Try multiple common patterns for portfolio company listings
  // Pattern 1: JSON-LD structured data
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  if (jsonLdMatch) {
    for (const match of jsonLdMatch) {
      try {
        const content = match.replace(/<\/?script[^>]*>/gi, '')
        const data = JSON.parse(content)
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.name) {
              companies.push({
                name: item.name,
                description: item.description,
                website: item.url,
              })
            }
          }
        }
      } catch {
        // JSON parse failed, continue
      }
    }
  }

  // Pattern 2: Next.js __NEXT_DATA__ (common for React sites)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1])
      const props = data?.props?.pageProps
      if (props?.companies && Array.isArray(props.companies)) {
        for (const c of props.companies) {
          companies.push({
            name: c.name || c.title,
            description: c.description || c.oneLiner,
            website: c.website || c.url,
            sector: c.sector || c.category,
          })
        }
      }
    } catch {
      // JSON parse failed
    }
  }

  return companies
}

async function useSeedData(): Promise<number> {
  console.log(`Using ${SEED_COMPANIES.length} curated seed companies`)
  const count = await upsertCompanies(SEED_COMPANIES)
  console.log(`Upserted ${count} companies from seed data`)
  return count
}

scrapePortfolio()
  .then(() => {
    console.log('Portfolio scrape complete')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
