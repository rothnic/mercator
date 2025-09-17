import { z } from 'zod';

const ISO_4217_CURRENCY_CODE = /^[A-Z]{3}$/;

const nonEmptyString = z.string().trim().min(1, 'Value must not be empty');
const urlSchema = z.string().url();

export const CurrencyCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => ISO_4217_CURRENCY_CODE.test(value), {
    message: 'Currency code must be a valid ISO 4217 alpha code'
  });

export const MoneySchema = z
  .object({
    amount: z
      .number({ required_error: 'Amount is required' })
      .finite()
      .min(0, { message: 'Amount cannot be negative' }),
    currencyCode: CurrencyCodeSchema,
    precision: z
      .number()
      .int({ message: 'Precision must be an integer' })
      .min(0, { message: 'Precision cannot be negative' })
      .max(4, { message: 'Precision must be 4 or fewer decimal places' })
      .default(2),
    raw: z.string().trim().min(1).optional()
  })
  .strict();

export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;
export type Money = z.infer<typeof MoneySchema>;

export const BreadcrumbSchema = z
  .object({
    label: nonEmptyString,
    url: urlSchema.optional(),
    position: z
      .number()
      .int({ message: 'Position must be an integer' })
      .min(1, { message: 'Position must start at 1' })
      .optional()
  })
  .strict();

export type Breadcrumb = z.infer<typeof BreadcrumbSchema>;

export const AggregateRatingSchema = z
  .object({
    ratingValue: z
      .number({ required_error: 'ratingValue is required' })
      .finite()
      .min(0, { message: 'ratingValue cannot be negative' })
      .max(5, { message: 'ratingValue cannot be greater than 5' }),
    reviewCount: z
      .number()
      .int({ message: 'reviewCount must be an integer' })
      .min(0, { message: 'reviewCount cannot be negative' })
      .optional(),
    bestRating: z
      .number()
      .finite()
      .min(0, { message: 'bestRating cannot be negative' })
      .optional(),
    worstRating: z
      .number()
      .finite()
      .min(0, { message: 'worstRating cannot be negative' })
      .optional(),
    url: urlSchema.optional()
  })
  .strict()
  .refine(
    (value) =>
      value.bestRating === undefined ||
      value.worstRating === undefined ||
      value.bestRating > value.worstRating,
    {
      message: 'bestRating must be greater than worstRating'
    }
  )
  .refine(
    (value) => value.bestRating === undefined || value.ratingValue <= value.bestRating,
    {
      message: 'ratingValue must be less than or equal to bestRating'
    }
  )
  .refine(
    (value) => value.worstRating === undefined || value.ratingValue >= value.worstRating,
    {
      message: 'ratingValue must be greater than or equal to worstRating'
    }
  );

export type AggregateRating = z.infer<typeof AggregateRatingSchema>;

export const ProductSchema = z
  .object({
    id: nonEmptyString.optional(),
    title: nonEmptyString,
    canonicalUrl: urlSchema,
    description: z.string().trim().optional(),
    price: MoneySchema,
    images: z.array(urlSchema).min(1, { message: 'At least one product image is required' }).readonly(),
    thumbnail: urlSchema.optional(),
    aggregateRating: AggregateRatingSchema.optional(),
    breadcrumbs: z
      .array(BreadcrumbSchema)
      .min(1, { message: 'Provide at least one breadcrumb when breadcrumbs are supplied' })
      .readonly()
      .optional(),
    brand: nonEmptyString.optional(),
    sku: nonEmptyString.optional()
  })
  .strict();

export type Product = z.infer<typeof ProductSchema>;
