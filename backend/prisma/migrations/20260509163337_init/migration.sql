-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Nueva sesión',
    "model" TEXT,
    "systemPrompt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "inputType" TEXT NOT NULL DEFAULT 'none',
    "outputType" TEXT NOT NULL DEFAULT 'none',
    "audioUrl" TEXT,
    "toolName" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "usageGuidance" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "type" TEXT NOT NULL DEFAULT 'http',
    "method" TEXT NOT NULL DEFAULT 'GET',
    "url" TEXT NOT NULL,
    "headers" TEXT NOT NULL DEFAULT '{}',
    "queryParams" TEXT NOT NULL DEFAULT '{}',
    "bodyTemplate" TEXT NOT NULL DEFAULT '{}',
    "parameters" TEXT NOT NULL DEFAULT '{"type":"object","properties":{}}',
    "parameterPolicy" TEXT NOT NULL DEFAULT '{}',
    "responseMapping" TEXT NOT NULL DEFAULT '{}',
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "maxResponseKb" INTEGER NOT NULL DEFAULT 256,
    "allowedHosts" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "defaultModel" TEXT NOT NULL DEFAULT 'qwen2.5:7b',
    "temperature" REAL NOT NULL DEFAULT 0.3,
    "topP" REAL NOT NULL DEFAULT 0.9,
    "ollamaBaseUrl" TEXT NOT NULL DEFAULT 'http://localhost:11434',
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sttEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Message_sessionId_createdAt_idx" ON "Message"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tool_name_key" ON "Tool"("name");
