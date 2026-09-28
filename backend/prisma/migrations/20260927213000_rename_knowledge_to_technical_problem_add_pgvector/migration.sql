-- Habilita o tipo vetorial usado pelo embedding do texto do problema.
CREATE EXTENSION IF NOT EXISTS vector;

-- Preserva os registros existentes: a entidade é renomeada em vez de recriada.
ALTER TABLE "KnowledgeEntry" RENAME TO "TechnicalProblem";

-- Mantém os nomes das estruturas alinhados ao novo nome da entidade.
ALTER TABLE "TechnicalProblem" RENAME CONSTRAINT "KnowledgeEntry_pkey" TO "TechnicalProblem_pkey";
ALTER TABLE "TechnicalProblem" RENAME CONSTRAINT "KnowledgeEntry_authorId_fkey" TO "TechnicalProblem_authorId_fkey";
ALTER TABLE "TechnicalProblem" RENAME CONSTRAINT "KnowledgeEntry_projectId_fkey" TO "TechnicalProblem_projectId_fkey";
ALTER TABLE "TechnicalProblem" RENAME CONSTRAINT "KnowledgeEntry_sourceCheckInId_fkey" TO "TechnicalProblem_sourceCheckInId_fkey";
ALTER TABLE "TechnicalProblem" RENAME CONSTRAINT "KnowledgeEntry_sourceHelpRequestId_fkey" TO "TechnicalProblem_sourceHelpRequestId_fkey";
ALTER TABLE "TechnicalProblem" RENAME CONSTRAINT "KnowledgeEntry_sharingAuthorizedBy_fkey" TO "TechnicalProblem_sharingAuthorizedBy_fkey";
ALTER TABLE "TechnicalProblem" RENAME CONSTRAINT "chk_knowledge_entry_single_source" TO "chk_technical_problem_single_source";
ALTER TABLE "TechnicalProblem" RENAME CONSTRAINT "chk_knowledge_entry_authorization_sync" TO "chk_technical_problem_authorization_sync";

ALTER INDEX "KnowledgeEntry_projectId_idx" RENAME TO "TechnicalProblem_projectId_idx";
ALTER INDEX "KnowledgeEntry_sourceCheckInId_idx" RENAME TO "TechnicalProblem_sourceCheckInId_idx";
ALTER INDEX "KnowledgeEntry_sourceHelpRequestId_idx" RENAME TO "TechnicalProblem_sourceHelpRequestId_idx";
ALTER INDEX "KnowledgeEntry_authorId_idx" RENAME TO "TechnicalProblem_authorId_idx";
ALTER INDEX "KnowledgeEntry_sharingAuthorizedBy_idx" RENAME TO "TechnicalProblem_sharingAuthorizedBy_idx";
ALTER INDEX "KnowledgeEntry_sharingAuthorizedAt_idx" RENAME TO "TechnicalProblem_sharingAuthorizedAt_idx";

-- Opcional: problemas continuam válidos antes da geração do embedding.
ALTER TABLE "TechnicalProblem" ADD COLUMN "problemEmbedding" vector(1536);
