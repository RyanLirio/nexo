require('dotenv/config');
require('reflect-metadata');
const { PrismaService } = require('../dist/prisma.service');
const { OpenAIService } = require('../dist/ai/openai.service');
const { TechnicalProblemService } = require('../dist/technical-problems/technical-problem.service');
const { PrismaTechnicalProblemRepository } = require('../dist/technical-problems/prisma-technical-problem.repository');
const { PrismaAccessControlService } = require('../dist/common/auth/access-control.service');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (process.argv.slice(2).some((argument) => argument !== '--dry-run')) {
    throw new Error('Use somente --dry-run ou nenhum argumento.');
  }
  if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL para executar o backfill.');
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const repository = new PrismaTechnicalProblemRepository(prisma);
    const pending = await repository.listWithoutEmbedding();
    console.log(`TechnicalProblems sem embedding: ${pending.length}`);
    if (dryRun || pending.length === 0) return;
    if (!process.env.OPENAI_API_KEY) throw new Error('Configure OPENAI_API_KEY para executar o backfill.');
    const service = new TechnicalProblemService(repository, new OpenAIService(), new PrismaAccessControlService(prisma));
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    for (const [index, item] of pending.entries()) {
      try {
        const updated = await service.ensureProblemEmbedding(item.id, item.problem);
        if (updated) succeeded += 1;
        else skipped += 1;
        console.log(`[${index + 1}/${pending.length}] ${item.id}: ${updated ? 'gravado (1536 dimensões)' : 'já preenchido'}`);
      } catch {
        failed += 1;
        // Do not log provider errors or problem content.
        console.warn(`[${index + 1}/${pending.length}] ${item.id}: falha; tentar novamente depois.`);
      }
    }
    console.log(`Sucessos: ${succeeded}; falhas: ${failed}; ignorados: ${skipped}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error('Backfill indisponível: confira DATABASE_URL, PostgreSQL e OPENAI_API_KEY.');
  process.exitCode = 1;
});
