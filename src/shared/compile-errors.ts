export function parseTestGenerationCompileFailure(error: unknown): { kind: 'generator' | 'validator'; diagnostics: string } | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/(Generator|Validator) biên dịch lỗi:\s*([\s\S]+)/i);
  if (!match?.[2]?.trim()) return null;
  return { kind: match[1].toLowerCase() as 'generator' | 'validator', diagnostics: match[2].trim() };
}
