-- Novos papéis e estados do domínio.
CREATE TYPE "OrganizationRole" AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED');

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationMember" (
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("organizationId","userId")
);

CREATE UNIQUE INDEX "Organization_domain_key" ON "Organization"("domain");
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

ALTER TABLE "User"
    ADD COLUMN "googleSubject" TEXT,
    ADD COLUMN "avatarUrl" TEXT,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

ALTER TABLE "Team"
    ADD COLUMN "organizationId" TEXT,
    ADD COLUMN "description" TEXT,
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Equipes anteriores passam a uma organização de transição. O identificador
-- fixo facilita reconhecer e renomear essa organização após a migração.
INSERT INTO "Organization" ("id", "name")
SELECT '00000000-0000-4000-8000-000000000001', 'Nexo Legacy'
WHERE EXISTS (SELECT 1 FROM "Team");
UPDATE "Team" SET "organizationId" = '00000000-0000-4000-8000-000000000001'
WHERE "organizationId" IS NULL;
ALTER TABLE "Team" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

INSERT INTO "OrganizationMember" ("organizationId", "userId")
SELECT DISTINCT "t"."organizationId", "tm"."userId"
FROM "TeamMember" AS "tm"
JOIN "Team" AS "t" ON "t"."id" = "tm"."teamId";

ALTER TABLE "TeamMember" ADD COLUMN "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

ALTER TABLE "Project"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Project_teamId_idx" ON "Project"("teamId");

ALTER TABLE "ProjectMember"
    ADD COLUMN "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER',
    ADD COLUMN "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

ALTER TABLE "CheckIn" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "CheckIn_projectId_createdAt_idx" ON "CheckIn"("projectId","createdAt");
CREATE INDEX "CheckIn_userId_createdAt_idx" ON "CheckIn"("userId","createdAt");

ALTER TABLE "KnowledgeEntry"
    ADD COLUMN "projectId" TEXT,
    ADD COLUMN "sourceCheckInId" TEXT,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Não há como deduzir com segurança o projeto de uma solução antiga.
-- Se houver entradas, é preciso associá-las manualmente antes de aplicar v2.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "KnowledgeEntry" WHERE "projectId" IS NULL) THEN
        RAISE EXCEPTION 'KnowledgeEntry existente sem projeto: associe cada registro a um Project antes da migration v2';
    END IF;
END $$;
ALTER TABLE "KnowledgeEntry" ALTER COLUMN "projectId" SET NOT NULL;
CREATE INDEX "KnowledgeEntry_projectId_idx" ON "KnowledgeEntry"("projectId");
CREATE INDEX "KnowledgeEntry_sourceCheckInId_idx" ON "KnowledgeEntry"("sourceCheckInId");
CREATE INDEX "KnowledgeEntry_authorId_idx" ON "KnowledgeEntry"("authorId");
CREATE INDEX "KnowledgeEntry_sharingAuthorizedAt_idx" ON "KnowledgeEntry"("sharingAuthorizedAt");

ALTER TABLE "HelpRequest"
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "resolvedAt" TIMESTAMP(3);
CREATE INDEX "HelpRequest_projectId_status_idx" ON "HelpRequest"("projectId","status");
CREATE INDEX "HelpRequest_requesterId_status_idx" ON "HelpRequest"("requesterId","status");
CREATE INDEX "HelpRequest_helperId_idx" ON "HelpRequest"("helperId");

ALTER TABLE "OrganizationMember"
    ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Team"
    ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntry"
    ADD CONSTRAINT "KnowledgeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "KnowledgeEntry_sourceCheckInId_fkey" FOREIGN KEY ("sourceCheckInId") REFERENCES "CheckIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
