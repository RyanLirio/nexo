-- Allow a technical problem to be recorded before its solution is known.
ALTER TABLE "KnowledgeEntry" ALTER COLUMN "solution" DROP NOT NULL;
