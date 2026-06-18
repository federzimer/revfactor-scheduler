// One-off: replace the placeholder seed FAQs with the real set synthesized from call
// transcripts. Run: node --env-file=.env.local scripts/seed-faqs.mjs
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();
const faqs = JSON.parse(readFileSync(new URL('./faqs.json', import.meta.url), 'utf8'));

const removed = await prisma.faq.deleteMany({
  where: { id: { in: ['faq_seed_pricing', 'faq_seed_objection', 'faq_seed_onboarding'] } },
});
console.log(`Removed ${removed.count} placeholder seed(s).`);

const created = await prisma.faq.createMany({
  data: faqs.map((f) => ({
    question: f.question,
    answer: f.answer,
    category: f.category,
    sortOrder: f.sortOrder ?? 0,
  })),
});
console.log(`Inserted ${created.count} FAQ entries.`);

await prisma.$disconnect();
