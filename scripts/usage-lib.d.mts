// Типы для scripts/usage-lib.mjs (чтобы тесты проходили проверку типов).
export interface UsageRow { key: string; label: string; used: number; limit: number; ratio: number; over: boolean }
export type Usage = Record<"workersRequests" | "d1RowsRead" | "d1RowsWritten" | "durableObjectRequests", number>;
export const FREE_DAILY_LIMITS: Record<keyof Usage, { label: string; limit: number }>;
export const GRAPHQL_ENDPOINT: string;
export const USAGE_QUERY: string;
export const ISSUE_TITLE: string;
export function usageVariables(accountTag: string, now?: Date): { accountTag: string; date: string; start: string; end: string };
export function parseUsage(json: unknown): Usage;
export function evaluateUsage(usage: Partial<Usage>, threshold?: number): UsageRow[];
export function usageTable(rows: UsageRow[]): string;
export function issueBody(rows: UsageRow[], date: string, threshold: number): string;
