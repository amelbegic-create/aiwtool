-- IdeaStatus + Admin-Antwort / Status für Einreicher
CREATE TYPE "IdeaStatus" AS ENUM ('SENT', 'IN_PROGRESS', 'DONE');

ALTER TABLE "Idea" ADD COLUMN "status" "IdeaStatus" NOT NULL DEFAULT 'SENT';
ALTER TABLE "Idea" ADD COLUMN "adminReply" TEXT;
ALTER TABLE "Idea" ADD COLUMN "repliedAt" TIMESTAMP(3);
ALTER TABLE "Idea" ADD COLUMN "repliedById" TEXT;

ALTER TABLE "Idea" ADD CONSTRAINT "Idea_repliedById_fkey" FOREIGN KEY ("repliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Idea_status_idx" ON "Idea"("status");
