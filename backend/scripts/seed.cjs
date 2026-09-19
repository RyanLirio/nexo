require('dotenv/config');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Configure DATABASE_URL antes de executar o seed.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const demoDate = new Date('2026-09-19T12:00:00.000Z');

async function seed() {
  await prisma.$transaction(async (db) => {
    await db.organization.upsert({
      where: { id: 'demo-organization' },
      update: { name: 'Nexo Demo' },
      create: { id: 'demo-organization', name: 'Nexo Demo' },
    });

    const users = [
      { id: 'demo-ryan', name: 'Ryan Demo', email: 'ryan.demo@example.invalid' },
      { id: 'demo-marina', name: 'Marina Demo', email: 'marina.demo@example.invalid' },
      { id: 'demo-carlos', name: 'Carlos Demo', email: 'carlos.demo@example.invalid' },
    ];
    for (const user of users) {
      await db.user.upsert({ where: { id: user.id }, update: user, create: user });
      await db.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: 'demo-organization', userId: user.id } },
        update: { role: user.id === 'demo-ryan' ? 'ADMIN' : 'MEMBER' },
        create: { organizationId: 'demo-organization', userId: user.id, role: user.id === 'demo-ryan' ? 'ADMIN' : 'MEMBER' },
      });
    }

    await db.team.upsert({
      where: { id: 'demo-team' },
      update: { name: 'Automação', description: 'Equipe fictícia de desenvolvimento.' },
      create: { id: 'demo-team', organizationId: 'demo-organization', name: 'Automação', description: 'Equipe fictícia de desenvolvimento.' },
    });
    for (const user of users) {
      await db.teamMember.upsert({
        where: { teamId_userId: { teamId: 'demo-team', userId: user.id } },
        update: { role: user.id === 'demo-ryan' ? 'LEADER' : 'MEMBER' },
        create: { teamId: 'demo-team', userId: user.id, role: user.id === 'demo-ryan' ? 'LEADER' : 'MEMBER' },
      });
    }

    const projects = [
      { id: 'demo-financeiro', name: 'Integração Financeira', ownerId: 'demo-marina', status: 'ACTIVE' },
      { id: 'demo-pedidos', name: 'Automação de Pedidos', ownerId: 'demo-carlos', status: 'ACTIVE' },
      { id: 'demo-relatorio', name: 'Relatório Operacional', ownerId: 'demo-ryan', status: 'PLANNING' },
    ];
    for (const project of projects) {
      await db.project.upsert({
        where: { id: project.id },
        update: { name: project.name, status: project.status },
        create: { id: project.id, teamId: 'demo-team', name: project.name, status: project.status },
      });
      await db.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: project.ownerId } },
        update: { role: 'OWNER' },
        create: { projectId: project.id, userId: project.ownerId, role: 'OWNER' },
      });
    }

    await db.checkIn.upsert({
      where: { id: 'demo-checkin-financeiro' },
      update: { summary: 'Integração inicial concluída.', difficulties: 'Retorno inconsistente em uma validação.', nextSteps: 'Revisar tratamento de erros.' },
      create: { id: 'demo-checkin-financeiro', projectId: 'demo-financeiro', userId: 'demo-marina', summary: 'Integração inicial concluída.', difficulties: 'Retorno inconsistente em uma validação.', nextSteps: 'Revisar tratamento de erros.', createdAt: demoDate },
    });
    await db.checkIn.upsert({
      where: { id: 'demo-checkin-pedidos' },
      update: { summary: 'Fluxo de pedidos mapeado.', nextSteps: 'Implementar testes de duplicidade.' },
      create: { id: 'demo-checkin-pedidos', projectId: 'demo-pedidos', userId: 'demo-carlos', summary: 'Fluxo de pedidos mapeado.', nextSteps: 'Implementar testes de duplicidade.', createdAt: demoDate },
    });

    await db.knowledgeEntry.upsert({
      where: { id: 'demo-knowledge-authorized' },
      update: { title: 'Corrigir porta da integração', sharingAuthorizedAt: demoDate },
      create: { id: 'demo-knowledge-authorized', projectId: 'demo-financeiro', sourceCheckInId: 'demo-checkin-financeiro', authorId: 'demo-marina', title: 'Corrigir porta da integração', problem: 'Falha de comunicação com serviço externo.', technology: 'Integração HTTP', solution: 'Conferir a porta configurada e reiniciar o serviço.', sharingAuthorizedAt: demoDate },
    });
    await db.knowledgeEntry.upsert({
      where: { id: 'demo-knowledge-private' },
      update: { title: 'Tratamento de pedidos duplicados', sharingAuthorizedAt: null },
      create: { id: 'demo-knowledge-private', projectId: 'demo-pedidos', authorId: 'demo-carlos', title: 'Tratamento de pedidos duplicados', problem: 'Pedidos repetidos na importação.', technology: 'API', solution: 'Validar identificadores antes de persistir.', sharingAuthorizedAt: null },
    });
    await db.helpRequest.upsert({
      where: { id: 'demo-help-open' },
      update: { problem: 'Preciso de apoio na validação do retorno da integração.', status: 'OPEN', resolvedAt: null },
      create: { id: 'demo-help-open', projectId: 'demo-financeiro', requesterId: 'demo-marina', problem: 'Preciso de apoio na validação do retorno da integração.', status: 'OPEN' },
    });
  });
  console.log('Dados fictícios do Nexo criados ou atualizados.');
}

seed()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
