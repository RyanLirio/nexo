-- Criação de enums adicionais do modelo v1
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- Alterações na tabela Project (liderança, responsabilidade e criador)
ALTER TABLE "Project"
    ADD COLUMN "leaderId" TEXT,
    ADD COLUMN "responsibleUserId" TEXT,
    ADD COLUMN "createdBy" TEXT;

CREATE INDEX "Project_leaderId_idx" ON "Project"("leaderId");
CREATE INDEX "Project_responsibleUserId_idx" ON "Project"("responsibleUserId");

-- Criação da tabela de conversas privadas do colaborador
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- Relação N:N entre conversas e projetos
CREATE TABLE "ConversationProject" (
    "conversationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationProject_pkey" PRIMARY KEY ("conversationId","projectId")
);
CREATE INDEX "ConversationProject_projectId_idx" ON "ConversationProject"("projectId");

-- Mensagens individuais da conversa
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "role" "MessageRole" NOT NULL DEFAULT 'USER',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId","createdAt");

-- Relação N:N entre CheckIn e mensagens de origem
CREATE TABLE "CheckInMessage" (
    "checkInId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckInMessage_pkey" PRIMARY KEY ("checkInId","messageId")
);
CREATE INDEX "CheckInMessage_messageId_idx" ON "CheckInMessage"("messageId");

-- Histórico de transição de status do projeto
CREATE TABLE "ProjectStatusHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "previousStatus" "ProjectStatus" NOT NULL,
    "newStatus" "ProjectStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectStatusHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectStatusHistory_projectId_createdAt_idx" ON "ProjectStatusHistory"("projectId","createdAt");

-- Mensagens de pedidos de ajuda
CREATE TABLE "HelpRequestMessage" (
    "id" TEXT NOT NULL,
    "helpRequestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HelpRequestMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HelpRequestMessage_helpRequestId_createdAt_idx" ON "HelpRequestMessage"("helpRequestId","createdAt");

-- Alterações na tabela HelpRequest
ALTER TABLE "HelpRequest"
    ADD COLUMN "resolutionMessageId" TEXT,
    ADD COLUMN "confirmationMessageId" TEXT;

CREATE INDEX "HelpRequest_resolutionMessageId_idx" ON "HelpRequest"("resolutionMessageId");

-- Alterações na tabela KnowledgeEntry
ALTER TABLE "KnowledgeEntry"
    ADD COLUMN "sourceHelpRequestId" TEXT,
    ADD COLUMN "sharingAuthorizedBy" TEXT;

CREATE INDEX "KnowledgeEntry_sourceHelpRequestId_idx" ON "KnowledgeEntry"("sourceHelpRequestId");
CREATE INDEX "KnowledgeEntry_sharingAuthorizedBy_idx" ON "KnowledgeEntry"("sharingAuthorizedBy");

-- Foreign Keys
ALTER TABLE "Project"
    ADD CONSTRAINT "Project_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Project_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Project_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Conversation"
    ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConversationProject"
    ADD CONSTRAINT "ConversationProject_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ConversationProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
    ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CheckInMessage"
    ADD CONSTRAINT "CheckInMessage_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "CheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "CheckInMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectStatusHistory"
    ADD CONSTRAINT "ProjectStatusHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ProjectStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HelpRequestMessage"
    ADD CONSTRAINT "HelpRequestMessage_helpRequestId_fkey" FOREIGN KEY ("helpRequestId") REFERENCES "HelpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "HelpRequestMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HelpRequest"
    ADD CONSTRAINT "HelpRequest_resolutionMessageId_fkey" FOREIGN KEY ("resolutionMessageId") REFERENCES "HelpRequestMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "HelpRequest_confirmationMessageId_fkey" FOREIGN KEY ("confirmationMessageId") REFERENCES "HelpRequestMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeEntry"
    ADD CONSTRAINT "KnowledgeEntry_sourceHelpRequestId_fkey" FOREIGN KEY ("sourceHelpRequestId") REFERENCES "HelpRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "KnowledgeEntry_sharingAuthorizedBy_fkey" FOREIGN KEY ("sharingAuthorizedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Regras de integridade no PostgreSQL (Gustavo)
-- 3.1 Origem única para KnowledgeEntry
ALTER TABLE "KnowledgeEntry"
    ADD CONSTRAINT "chk_knowledge_entry_single_source"
    CHECK (
        "sourceCheckInId" IS NULL
        OR "sourceHelpRequestId" IS NULL
    );

-- 3.2 Consistência síncrona na autorização de KnowledgeEntry
ALTER TABLE "KnowledgeEntry"
    ADD CONSTRAINT "chk_knowledge_entry_authorization_sync"
    CHECK (
        ("sharingAuthorizedBy" IS NULL AND "sharingAuthorizedAt" IS NULL)
        OR ("sharingAuthorizedBy" IS NOT NULL AND "sharingAuthorizedAt" IS NOT NULL)
    );

-- 3.3 Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'updatedAt'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS set_updated_at ON %I;
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t);
    END LOOP;
END $$;
