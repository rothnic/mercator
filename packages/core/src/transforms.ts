import { z } from 'zod';

import { CurrencyCodeSchema, MoneySchema } from './schemas.js';

/**
 * Built-in transforms must remain deterministic across environments and
 * refrain from relying on host locale settings. All parsing assumes
 * `en-US` number formatting (period decimal separator, optional comma
 * thousands separators) and normalizes URLs using the WHATWG URL API.
 */

export const TransformNameSchema = z.enum(['text.collapse', 'money.parse', 'url.resolve']);

export type TransformName = z.infer<typeof TransformNameSchema>;

const TextCollapseOptionsSchema = z
  .object({
    collapseWhitespace: z.boolean().default(true),
    trim: z.boolean().default(true),
    preserveNewlines: z.boolean().default(false)
  })
  .strict();

const MoneyParseOptionsSchema = z
  .object({
    currencyCode: CurrencyCodeSchema.default('USD'),
    locale: z.literal('en-US').default('en-US'),
    fallbackPrecision: z.number().int().min(0).max(4).default(2)
  })
  .strict();

const UrlResolveOptionsSchema = z
  .object({
    baseUrl: z.string().url().optional(),
    enforceHttps: z.boolean().default(false)
  })
  .strict();

export type TextCollapseOptions = z.infer<typeof TextCollapseOptionsSchema>;
export type MoneyParseOptions = z.infer<typeof MoneyParseOptionsSchema>;
export type UrlResolveOptions = z.infer<typeof UrlResolveOptionsSchema>;

interface TransformOptionsByName {
  'text.collapse': TextCollapseOptions;
  'money.parse': MoneyParseOptions;
  'url.resolve': UrlResolveOptions;
}

const DEFAULT_TRANSFORM_OPTIONS: { [Name in TransformName]: TransformOptionsByName[Name] } = {
  'text.collapse': TextCollapseOptionsSchema.parse({}),
  'money.parse': MoneyParseOptionsSchema.parse({}),
  'url.resolve': UrlResolveOptionsSchema.parse({})
};

export type TransformOptionsInput<Name extends TransformName> = Partial<TransformOptionsByName[Name]>;

export interface TransformInvocation<Name extends TransformName = TransformName> {
  name: Name;
  options?: TransformOptionsInput<Name>;
}

const TextCollapseInvocationSchema = z
  .object({
    name: z.literal('text.collapse'),
    options: TextCollapseOptionsSchema.partial().optional()
  })
  .strict();

const MoneyParseInvocationSchema = z
  .object({
    name: z.literal('money.parse'),
    options: MoneyParseOptionsSchema.partial().optional()
  })
  .strict();

const UrlResolveInvocationSchema = z
  .object({
    name: z.literal('url.resolve'),
    options: UrlResolveOptionsSchema.partial().optional()
  })
  .strict();

export const TransformInvocationSchema = z.discriminatedUnion('name', [
  TextCollapseInvocationSchema,
  MoneyParseInvocationSchema,
  UrlResolveInvocationSchema
]);

type NormalizedOptions<Name extends TransformName> = TransformOptionsByName[Name];

export function resolveTransformOptions<Name extends TransformName>(
  name: Name,
  options?: TransformOptionsInput<Name>
): NormalizedOptions<Name> {
  const defaults = DEFAULT_TRANSFORM_OPTIONS[name];
  if (!options) {
    return { ...defaults };
  }

  return { ...defaults, ...options };
}

function applyTextCollapse(value: unknown, options: TextCollapseOptions): string {
  if (typeof value !== 'string') {
    throw new TypeError('text.collapse expects a string input');
  }

  const trimmed = options.trim ? value.trim() : value;

  if (!options.collapseWhitespace) {
    return trimmed;
  }

  if (options.preserveNewlines) {
    return trimmed
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .join('\n');
  }

  return trimmed.replace(/\s+/g, ' ');
}

function applyMoneyParse(value: unknown, options: MoneyParseOptions) {
  if (typeof value !== 'string') {
    throw new TypeError('money.parse expects a string input');
  }

  const raw = value.trim();
  const sanitized = raw.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  const amount = Number.parseFloat(sanitized);

  if (Number.isNaN(amount)) {
    throw new Error(`Unable to parse monetary value from "${value}"`);
  }

  const decimal = sanitized.split('.')[1] ?? '';
  const precision = decimal.length > 0 ? Math.min(decimal.length, 4) : options.fallbackPrecision;

  const result = MoneySchema.parse({
    amount,
    currencyCode: CurrencyCodeSchema.parse(options.currencyCode),
    precision,
    raw
  });

  return result;
}

function applyUrlResolve(value: unknown, options: UrlResolveOptions): string {
  if (typeof value !== 'string') {
    throw new TypeError('url.resolve expects a string input');
  }

  const raw = value.trim();
  if (!raw) {
    throw new Error('url.resolve cannot operate on an empty string');
  }

  let resolved: URL;

  if (options.baseUrl) {
    resolved = new URL(raw, options.baseUrl);
  } else {
    resolved = new URL(raw);
  }

  if (options.enforceHttps && resolved.protocol === 'http:') {
    resolved = new URL(resolved.toString().replace(/^http:/, 'https:'));
  }

  return resolved.toString();
}

export function applyTransform<Name extends TransformName>(
  name: Name,
  value: unknown,
  options?: TransformOptionsInput<Name>
) {
  const normalized = resolveTransformOptions(name, options);

  switch (name) {
    case 'text.collapse':
      return applyTextCollapse(value, normalized as TextCollapseOptions);
    case 'money.parse':
      return applyMoneyParse(value, normalized as MoneyParseOptions);
    case 'url.resolve':
      return applyUrlResolve(value, normalized as UrlResolveOptions);
    default: {
      const exhaustiveCheck: never = name;
      return exhaustiveCheck;
    }
  }
}

export function getDefaultTransformOptions<Name extends TransformName>(name: Name): NormalizedOptions<Name> {
  return { ...DEFAULT_TRANSFORM_OPTIONS[name] };
}

