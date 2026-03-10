import { db } from '../db/client'

interface CompanyData {
  name: string
  description?: string
  website?: string
  sector?: string
  logoUrl?: string
  keywords?: string[]
}

export async function upsertCompanies(companies: CompanyData[]): Promise<number> {
  let upserted = 0

  for (const company of companies) {
    const keywordsJson = company.keywords ? JSON.stringify(company.keywords) : null
    await db.company.upsert({
      where: { name: company.name },
      update: {
        description: company.description,
        website: company.website,
        sector: company.sector,
        logoUrl: company.logoUrl,
        keywords: keywordsJson,
        scrapedAt: new Date(),
      },
      create: {
        name: company.name,
        description: company.description,
        website: company.website,
        sector: company.sector,
        logoUrl: company.logoUrl,
        keywords: keywordsJson,
      },
    })
    upserted++
  }

  return upserted
}

export async function getCompanyCount(): Promise<number> {
  return db.company.count()
}
