require('dotenv/config');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Configure DATABASE_URL antes de executar o seed.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const demoDate = new Date('2026-09-21T12:00:00.000Z');
const memberEmail = process.env.SEED_MEMBER_EMAIL?.trim().toLowerCase() || 'ryanlirio2@gmail.com';
const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || 'gustavokfelicetti@gmail.com';

async function seed() {
  await prisma.$transaction(async (db) => {
    // 1. Usuários (Gustavo ADMIN, Marina LEADER, Ryan MEMBER, João MEMBER)
    const users = [
      { id: 'demo-gustavo', name: 'Gustavo Felicetti', email: adminEmail, role: 'ADMIN', isActive: true },
      { id: 'demo-marina', name: 'Marina Demo', email: 'marina@example.invalid', role: 'LEADER', isActive: true },
      { id: 'demo-ryan', name: 'Ryan Lirio', email: memberEmail, role: 'MEMBER', isActive: true },
      { id: 'demo-joao', name: 'João Demo', email: 'joao@example.invalid', role: 'MEMBER', isActive: true },
    ];

    for (const user of users) {
      await db.user.upsert({ where: { id: user.id }, update: user, create: user });
    }

    // 2. Time (Equipe RPA)
    await db.team.upsert({
      where: { id: 'demo-team-rpa' },
      update: { name: 'Equipe RPA', description: 'Equipe de automações e inteligência do Nexo.' },
      create: { id: 'demo-team-rpa', name: 'Equipe RPA', description: 'Equipe de automações e inteligência do Nexo.' },
    });

    // 3. Membros do time
    for (const user of users) {
      await db.teamMember.upsert({
        where: { teamId_userId: { teamId: 'demo-team-rpa', userId: user.id } },
        update: {},
        create: { teamId: 'demo-team-rpa', userId: user.id },
      });
    }

    // 4. Projetos com Líder e Responsável
    const projects = [
      {
        id: 'demo-proj-financeiro',
        name: 'Automação Financeira',
        description: 'Integração e automação de fluxos bancários.',
        leaderId: 'demo-gustavo',
        responsibleUserId: 'demo-ryan',
        status: 'ACTIVE',
        priority: 90,
        estimatedCompletionAt: new Date('2026-11-30T18:00:00.000Z'),
      },
      {
        id: 'demo-proj-portal',
        name: 'Portal de Notas',
        description: 'Portal de captura e conciliação fiscal.',
        leaderId: 'demo-marina',
        responsibleUserId: 'demo-joao',
        status: 'PLANNING',
        priority: 50,
        estimatedCompletionAt: new Date('2026-12-15T18:00:00.000Z'),
      },
    ];

    for (const proj of projects) {
      await db.project.upsert({
        where: { id: proj.id },
        update: {
          name: proj.name,
          description: proj.description,
          leaderId: proj.leaderId,
          responsibleUserId: proj.responsibleUserId,
          status: proj.status,
          priority: proj.priority,
          estimatedCompletionAt: proj.estimatedCompletionAt,
        },
        create: {
          id: proj.id,
          teamId: 'demo-team-rpa',
          name: proj.name,
          description: proj.description,
          leaderId: proj.leaderId,
          responsibleUserId: proj.responsibleUserId,
          status: proj.status,
          priority: proj.priority,
          estimatedCompletionAt: proj.estimatedCompletionAt,
        },
      });


      // Membros dos projetos
      await db.projectMember.upsert({
        where: { projectId_userId: { projectId: proj.id, userId: proj.leaderId } },
        update: { role: 'OWNER' },
        create: { projectId: proj.id, userId: proj.leaderId, role: 'OWNER' },
      });

      await db.projectMember.upsert({
        where: { projectId_userId: { projectId: proj.id, userId: proj.responsibleUserId } },
        update: { role: 'MEMBER' },
        create: { projectId: proj.id, userId: proj.responsibleUserId, role: 'MEMBER' },
      });
    }

    // 5. Conversa privada e Mensagens (Ryan com Nexo)
    await db.conversation.upsert({
      where: { id: 'demo-conv-ryan' },
      update: { userId: 'demo-ryan' },
      create: { id: 'demo-conv-ryan', userId: 'demo-ryan', createdAt: demoDate },
    });

    await db.conversationProject.upsert({
      where: { conversationId_projectId: { conversationId: 'demo-conv-ryan', projectId: 'demo-proj-financeiro' } },
      update: {},
      create: { conversationId: 'demo-conv-ryan', projectId: 'demo-proj-financeiro' },
    });

    const messages = [
      { id: 'demo-msg-1', senderId: 'demo-ryan', role: 'USER', content: 'Estou com problema ao conectar no gateway financeiro. Erro 401.' },
      { id: 'demo-msg-2', senderId: null, role: 'ASSISTANT', content: 'O erro 401 indica falha de autenticação. O token de homologação foi renovado recentemente?' },
      { id: 'demo-msg-3', senderId: 'demo-ryan', role: 'USER', content: 'Renovei o token no .env e a comunicação funcionou, mas agora o certificado SSL expirou.' },
    ];

    for (const msg of messages) {
      await db.message.upsert({
        where: { id: msg.id },
        update: { content: msg.content },
        create: {
          id: msg.id,
          conversationId: 'demo-conv-ryan',
          senderId: msg.senderId,
          role: msg.role,
          content: msg.content,
          createdAt: demoDate,
        },
      });
    }

    // 6. CheckIn vinculado às mensagens da conversa
    await db.checkIn.upsert({
      where: { id: 'demo-checkin-financeiro' },
      update: {
        summary: 'Configuração do gateway financeiro e renovação de token.',
        difficulties: 'Certificado SSL de homologação expirado.',
        nextSteps: 'Instalar novo certificado SSL e rodar bateria de testes.',
      },
      create: {
        id: 'demo-checkin-financeiro',
        projectId: 'demo-proj-financeiro',
        userId: 'demo-ryan',
        summary: 'Configuração do gateway financeiro e renovação de token.',
        difficulties: 'Certificado SSL de homologação expirado.',
        nextSteps: 'Instalar novo certificado SSL e rodar bateria de testes.',
        createdAt: demoDate,
      },
    });

    for (const msg of messages) {
      await db.checkInMessage.upsert({
        where: { checkInId_messageId: { checkInId: 'demo-checkin-financeiro', messageId: msg.id } },
        update: {},
        create: { checkInId: 'demo-checkin-financeiro', messageId: msg.id },
      });
    }

    // 7. Histórico de Status
    await db.projectStatusHistory.upsert({
      where: { id: 'demo-status-history-1' },
      update: {},
      create: {
        id: 'demo-status-history-1',
        projectId: 'demo-proj-financeiro',
        previousStatus: 'PLANNING',
        newStatus: 'ACTIVE',
        changedById: 'demo-gustavo',
        reason: 'Equipe técnica alocada e kickoff realizado.',
        createdAt: demoDate,
      },
    });

    // 8. HelpRequest (Estrutura mínima de suporte/dificuldade no projeto)
    await db.helpRequest.upsert({
      where: { id: 'demo-help-ssl' },
      update: {
        problem: 'Certificado SSL expirado impede testes no gateway de homologação.',
        status: 'RESOLVED',
        resolvedAt: demoDate,
      },
      create: {
        id: 'demo-help-ssl',
        projectId: 'demo-proj-financeiro',
        requesterId: 'demo-ryan',
        helperId: 'demo-gustavo',
        problem: 'Certificado SSL expirado impede testes no gateway de homologação.',
        status: 'RESOLVED',
        resolvedAt: demoDate,
        createdAt: demoDate,
      },
    });

    // 9. TechnicalProblem: autorizado e não autorizado (rascunho)
    await db.technicalProblem.upsert({
      where: { id: 'demo-know-ssl' },
      update: {
        title: 'Renovação forçada de certificado SSL homologação',
        sharingAuthorizedBy: 'demo-ryan',
        sharingAuthorizedAt: demoDate,
      },
      create: {
        id: 'demo-know-ssl',
        projectId: 'demo-proj-financeiro',
        authorId: 'demo-ryan',
        sourceHelpRequestId: 'demo-help-ssl',
        title: 'Renovação forçada de certificado SSL homologação',
        problem: 'Erro de SSL no gateway financeiro devido a certificado expirado.',
        technology: 'SSL/TLS',
        solution: 'Executar certbot renew --force-renewal e reiniciar o proxy/servidor web.',
        sharingAuthorizedBy: 'demo-ryan',
        sharingAuthorizedAt: demoDate,
        createdAt: demoDate,
      },
    });

    await db.technicalProblem.upsert({
      where: { id: 'demo-know-draft' },
      update: {
        title: 'Rascunho de tratamento de timeout na API',
        sharingAuthorizedBy: null,
        sharingAuthorizedAt: null,
      },
      create: {
        id: 'demo-know-draft',
        projectId: 'demo-proj-financeiro',
        authorId: 'demo-ryan',
        sourceCheckInId: 'demo-checkin-financeiro',
        title: 'Rascunho de tratamento de timeout na API',
        problem: 'Timeout ocasional no endpoint de consulta de boletos.',
        technology: 'Node.js',
        solution: 'Aumentar timeout no client HTTP para 15000ms e adicionar retry.',
        sharingAuthorizedBy: null,
        sharingAuthorizedAt: null,
        createdAt: demoDate,
      },
    });

    const previousDate = new Date('2026-09-20T12:00:00.000Z');
    await db.checkIn.upsert({
      where: { id: 'demo-checkin-financeiro-anterior' },
      update: {
        summary: 'Kickoff técnico da integração bancária e análise da API.',
        difficulties: 'Aguardando documentação do sandbox financeiro.',
        nextSteps: 'Configurar credenciais e testar autenticação no gateway.',
      },
      create: {
        id: 'demo-checkin-financeiro-anterior',
        projectId: 'demo-proj-financeiro',
        userId: 'demo-ryan',
        summary: 'Kickoff técnico da integração bancária e análise da API.',
        difficulties: 'Aguardando documentação do sandbox financeiro.',
        nextSteps: 'Configurar credenciais e testar autenticação no gateway.',
        createdAt: previousDate,
      },
    });

    await db.technicalProblem.upsert({
      where: { id: 'demo-know-open' },
      update: {
        title: 'Vazamento de conexões de pool no PostgreSQL',
        problem: 'Conexões não estão sendo liberadas após queries com timeout no adapter-pg.',
        technology: 'PostgreSQL',
        solution: null,
        sharingAuthorizedBy: null,
        sharingAuthorizedAt: null,
      },
      create: {
        id: 'demo-know-open',
        projectId: 'demo-proj-financeiro',
        authorId: 'demo-ryan',
        title: 'Vazamento de conexões de pool no PostgreSQL',
        problem: 'Conexões não estão sendo liberadas após queries com timeout no adapter-pg.',
        technology: 'PostgreSQL',
        solution: null,
        sharingAuthorizedBy: null,
        sharingAuthorizedAt: null,
        createdAt: demoDate,
      },
    });
  });

  console.log('Seed completo do Nexo executado com sucesso: entidades populadas e enriquecidas com IA tools.');
}


seed()
  .catch((error) => {
    console.error('Erro ao executar seed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
