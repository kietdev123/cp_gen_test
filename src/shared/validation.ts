import { z } from 'zod';
import type { GeneratorMode, Project, TestPlan } from './types';

export const generatorModes = ['random', 'boundary', 'constructive', 'stress'] as const satisfies readonly GeneratorMode[];
export const GeneratorModeSchema = z.enum(generatorModes);

const parameterKey = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,31}$/, 'Tên tham số không hợp lệ.');
const parameterValue = z.string().max(256, 'Giá trị tham số tối đa 256 ký tự.').refine((value) => !/[\r\n\0]/.test(value), 'Giá trị tham số không được chứa dòng mới.');
const ParameterSchema = z.record(parameterKey, parameterValue).refine((params) => Object.keys(params).length <= 24, 'Mỗi nhóm tối đa 24 tham số.');

export const ProblemSpecSchema = z.object({
  summary: z.string().max(3000),
  inputFormat: z.string().max(3000),
  outputFormat: z.string().max(3000),
  constraints: z.array(z.string().max(500)).max(40),
  statementVersion: z.string().max(64),
}).strict();

export const TestGroupSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500),
  mode: GeneratorModeSchema,
  count: z.number().int().min(1).max(500),
  params: ParameterSchema,
}).strict();

export const TestPlanSchema = z.object({
  problemSpec: ProblemSpecSchema,
  groups: z.array(TestGroupSchema).min(1).max(30),
  updatedAt: z.string().min(1).max(64),
}).strict().superRefine((plan, context) => {
  const total = plan.groups.reduce((sum, group) => sum + group.count, 0);
  if (total > 500) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Tổng số testcase trong Test Plan không được vượt quá 500.', path: ['groups'] });
});

export const AiTestPlanSchema = z.object({
  problemSpec: z.object({
    summary: z.string().max(3000),
    inputFormat: z.string().max(3000),
    outputFormat: z.string().max(3000),
    constraints: z.array(z.string().max(500)).max(40),
  }).strict(),
  groups: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(500),
    mode: GeneratorModeSchema,
    count: z.number().int().min(1).max(500),
    params: ParameterSchema,
  }).strict()).min(1).max(30),
}).strict().superRefine((plan, context) => {
  const total = plan.groups.reduce((sum, group) => sum + group.count, 0);
  if (total > 500) context.addIssue({ code: z.ZodIssueCode.custom, message: 'AI đề xuất tổng số testcase vượt quá 500.', path: ['groups'] });
});

export const AiQuickResultSchema = z.object({
  testPlan: AiTestPlanSchema,
  generator: z.string().min(1).max(100_000),
}).strict();

export const AiStatementDraftSchema = z.object({
  statement: z.string().min(1).max(100_000),
  themisInputFile: z.string().trim().min(1).max(128),
  themisOutputFile: z.string().trim().min(1).max(128),
}).strict();

const TestCaseSchema = z.object({
  id: z.string(), name: z.string(), input: z.string(), output: z.string(),
  status: z.enum(['pending', 'running', 'generated', 'verified', 'duplicate', 'failed', 'timeout', 'invalid', 'error', 'passed']),
  stderr: z.string().optional(), runtimeMs: z.number().nonnegative().optional(),
  groupId: z.string().optional(), groupName: z.string().optional(), testIndex: z.number().int().optional(), seed: z.number().int().optional(),
  mode: GeneratorModeSchema.optional(), params: ParameterSchema.optional(), sha256: z.string().optional(),
  statementVersion: z.string().optional(), generatorVersion: z.string().optional(), solutionVersion: z.string().optional(),
  inputStale: z.boolean().optional(), outputStale: z.boolean().optional(),
}).passthrough();

const TestGenerationLogSchema = z.object({
  id: z.string(), createdAt: z.string(), requested: z.number().int().nonnegative(), generated: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(), invalid: z.number().int().nonnegative(), errors: z.number().int().nonnegative(),
  retries: z.number().int().nonnegative(), warnings: z.array(z.string()),
}).passthrough();

const AiCachedResultSchema = z.object({
  provider: z.enum(['openai', 'gemini']), model: z.string(), promptVersion: z.string(),
  response: z.object({ text: z.string(), usage: z.object({ inputTokens: z.number().optional(), outputTokens: z.number().optional(), totalTokens: z.number().optional() }).optional(), cached: z.boolean().optional() }),
  savedAt: z.string(),
}).passthrough();

export const ProjectStorageSchema = z.object({
  id: z.string(), name: z.string(), createdAt: z.string(), updatedAt: z.string(),
  statement: z.string().default(''), generator: z.string().default(''), solution: z.string().default(''), solutionGuide: z.string().default(''), validator: z.string().default(''),
  images: z.array(z.object({ id: z.string(), name: z.string(), mimeType: z.string(), addedAt: z.string() })).default([]),
  tests: z.array(TestCaseSchema).default([]), testPlan: TestPlanSchema.optional(),
  generationLogs: z.array(TestGenerationLogSchema).default([]), aiCache: z.record(z.string(), AiCachedResultSchema).default({}),
  generatorMode: GeneratorModeSchema.default('random'), seed: z.number().int().default(2026), timeLimitMs: z.number().int().positive().default(2000),
  oracleSolution: z.string().optional(),
}).passthrough();

export function statementVersion(statement: string): string {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(statement)) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createDefaultTestPlan(statement = ''): TestPlan {
  return {
    problemSpec: { summary: '', inputFormat: '', outputFormat: '', constraints: [], statementVersion: statementVersion(statement) },
    groups: [{ id: 'group-random', name: 'Ngẫu nhiên', description: 'Dữ liệu tổng quát trong giới hạn đề bài.', mode: 'random', count: 10, params: {} }],
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeProjectJson(value: unknown): Project {
  const parsed = ProjectStorageSchema.parse(value);
  return {
    ...(parsed as Project),
    testPlan: parsed.testPlan ?? createDefaultTestPlan(parsed.statement),
    generationLogs: parsed.generationLogs,
    aiCache: parsed.aiCache,
  };
}
