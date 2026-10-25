// Типы для scripts/backup-lib.mjs (для тестов).
export function parseRecipients(text: string): string[];
export function encryptBackup(data: string | Uint8Array, recipients: string[]): Promise<Uint8Array>;
export function decryptBackup(data: Uint8Array, identity: string): Promise<string>;
export function newKeyPair(): Promise<{ identity: string; recipient: string }>;
export function expectedTables(migrationsDir?: string): string[];
export function checkDump(sql: string, tables: string[]): Record<string, number>;
export function combineExports(schemaSql: string, dataSql: string): string;
export function isInside(path: string, dir: string, platform?: string): boolean;
export function scrubUrls(text: unknown): string;
