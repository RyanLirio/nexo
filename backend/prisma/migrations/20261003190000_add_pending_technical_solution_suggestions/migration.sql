CREATE TYPE "TechnicalSolutionSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "PendingTechnicalSolutionSuggestion" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "technicalProblemId" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "status" "TechnicalSolutionSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingTechnicalSolutionSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_solution_context_key"
    ON "PendingTechnicalSolutionSuggestion"("userId", "conversationId", "projectId");
CREATE INDEX "pending_solution_user_conversation_status_idx"
    ON "PendingTechnicalSolutionSuggestion"("userId", "conversationId", "status");
CREATE INDEX "PendingTechnicalSolutionSuggestion_conversationId_idx" ON "PendingTechnicalSolutionSuggestion"("conversationId");
CREATE INDEX "PendingTechnicalSolutionSuggestion_projectId_idx" ON "PendingTechnicalSolutionSuggestion"("projectId");
CREATE INDEX "PendingTechnicalSolutionSuggestion_technicalProblemId_idx" ON "PendingTechnicalSolutionSuggestion"("technicalProblemId");

ALTER TABLE "PendingTechnicalSolutionSuggestion" ADD CONSTRAINT "PendingTechnicalSolutionSuggestion_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingTechnicalSolutionSuggestion" ADD CONSTRAINT "PendingTechnicalSolutionSuggestion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingTechnicalSolutionSuggestion" ADD CONSTRAINT "PendingTechnicalSolutionSuggestion_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingTechnicalSolutionSuggestion" ADD CONSTRAINT "PendingTechnicalSolutionSuggestion_technicalProblemId_fkey"
    FOREIGN KEY ("technicalProblemId") REFERENCES "TechnicalProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
