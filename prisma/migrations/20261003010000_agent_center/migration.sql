CREATE TABLE "AgentConversation" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "entityId" TEXT NOT NULL,
 "capability" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "contextType" TEXT NOT NULL DEFAULT 'page',
 "contextId" TEXT NOT NULL DEFAULT '',
 "planDraft" TEXT NOT NULL DEFAULT '{}',
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "AgentTurn" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "conversationId" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL,
 "question" TEXT NOT NULL,
 "response" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AgentTurn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AgentConversation_userId_entityId_updatedAt_idx" ON "AgentConversation"("userId","entityId","updatedAt");
CREATE UNIQUE INDEX "AgentTurn_conversationId_requestKey_key" ON "AgentTurn"("conversationId","requestKey");
