-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'LEADER', 'MEMBER');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

-- DropForeignKey
ALTER TABLE "OrganizationMember" DROP CONSTRAINT IF EXISTS "OrganizationMember_organizationId_fkey";
ALTER TABLE "OrganizationMember" DROP CONSTRAINT IF EXISTS "OrganizationMember_userId_fkey";
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_organizationId_fkey";

-- DropTable
DROP TABLE IF EXISTS "OrganizationMember" CASCADE;
DROP TABLE IF EXISTS "Organization" CASCADE;

-- DropEnum
DROP TYPE IF EXISTS "OrganizationRole";

-- AlterTable Team
ALTER TABLE "Team" DROP COLUMN IF EXISTS "organizationId";

-- AlterTable TeamMember
ALTER TABLE "TeamMember" DROP COLUMN IF EXISTS "role";

-- DropEnum
DROP TYPE IF EXISTS "TeamRole";
