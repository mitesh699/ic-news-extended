import { db } from '../src/backend/db/client'

async function main() {
  const names = ['Blend','Front','Sift','Atoms','Cron','Lever','Streak','Torch','Garage','Pax','Sol','PIN','Ro','Papa','Heap','Double','Ava','Bruce','HER']
  for (const name of names) {
    const c = await db.company.findFirst({ where: { name }, include: { articles: { select: { title: true }, take: 3 } } })
    if (!c || c.articles.length === 0) continue
    console.log(c.name + ' (' + c.sector + '):')
    c.articles.forEach(a => console.log('  ' + a.title.slice(0, 90)))
    console.log('')
  }
  await db.$disconnect()
}
main()
