-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tool" (
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
    "secrets" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Tool" ("allowedHosts", "bodyTemplate", "createdAt", "description", "displayName", "enabled", "headers", "id", "maxResponseKb", "method", "name", "parameterPolicy", "parameters", "queryParams", "responseMapping", "timeoutMs", "type", "updatedAt", "url", "usageGuidance") SELECT "allowedHosts", "bodyTemplate", "createdAt", "description", "displayName", "enabled", "headers", "id", "maxResponseKb", "method", "name", "parameterPolicy", "parameters", "queryParams", "responseMapping", "timeoutMs", "type", "updatedAt", "url", "usageGuidance" FROM "Tool";
DROP TABLE "Tool";
ALTER TABLE "new_Tool" RENAME TO "Tool";
CREATE UNIQUE INDEX "Tool_name_key" ON "Tool"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
