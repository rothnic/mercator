# Product Simple Fixture

The **product-simple** fixture represents a deterministic kettle product detail page used across the MVP loop.
It provides matching HTML, markdown, and screenshot assets so that tools, agents, and services can operate on
repeatable inputs without reaching out to the network.

## Assets

| Asset | Path | Notes |
| --- | --- | --- |
| HTML | `fixtures/product-simple.html` | Annotated with `data-fixture-chunk` attributes for section targeting. |
| Markdown | `fixtures/product-simple.md` | Mirrors the hero copy and supplemental details for deterministic markdown search. |
| Screenshot | `fixtures/product-simple.png.base64` | Base64-encoded 1×1 PNG used for OCR pipeline and reviewer UI stubs. |

> **Note:** The screenshot asset is stored as base64 text so it can live in source control without binary diffs. Loader utilities
> decode the file into a `Buffer`, and external tooling can run `base64 --decode` to write out a `.png` when needed.

## Expected Product Data

The fixture encodes the following canonical values which align with the `ProductSchema` in `@mercator/core`:

- **Title:** `"Precision Pour-Over Kettle"`
- **Canonical URL:** `https://demo.mercator.sh/products/precision-pour-over-kettle`
- **Price:** USD $149.00 (`amount: 149`, `precision: 2`)
- **Images:**
  1. `https://cdn.mercator.sh/assets/kettle/precision-pour-over-kettle.jpg`
  2. `https://cdn.mercator.sh/assets/kettle/precision-pour-over-kettle-angle.jpg`
- **Thumbnail:** first gallery image
- **Aggregate Rating:** 4.6/5 with 128 reviews
- **Breadcrumbs:** Home → Kitchen → Coffee & Tea → Precision Pour-Over Kettle (final crumb has no link)
- **Brand:** Brimstone Labs
- **SKU:** BR-PPK-08

These values are exposed through the fixture loader so tests can validate recipe outputs without duplicating constants.

## HTML Chunk Map

Each major section of the HTML file is tagged with a `data-fixture-chunk` attribute to support chunked queries:

| Chunk ID | Selector | Description |
| --- | --- | --- |
| `breadcrumbs` | `[data-fixture-chunk="breadcrumbs"]` | Global breadcrumb navigation list. |
| `hero` | `[data-fixture-chunk="hero"]` | Title, pricing, gallery images, and CTAs. |
| `details` | `[data-fixture-chunk="details"]` | Product description, specifications, and highlights. |
| `qa` | `[data-fixture-chunk="qa"]` | FAQ accordion with deterministic answers. |

Tools can scope selector searches to these chunks for determinism and to simulate pagination across large documents.

## Markdown Structure

The markdown file mirrors the HTML narrative so markdown search tools can pull deterministic snippets:

1. `# Precision Pour-Over Kettle`
2. Overview paragraph describing heat-up time and stability
3. "What's Included" bullet list
4. Step-by-step brewing guide
5. Care instructions list
6. Warranty paragraph with support contact

## OCR Transcript

The screenshot placeholder intentionally renders to a solid color while the fixture loader exposes a deterministic
OCR transcript summarizing the hero section. This allows the vision tool stub to return text without performing
image processing.

## Usage

Import the loader in tests or tools to obtain strongly typed accessors:

```ts
import { loadProductSimpleFixture } from '@mercator/fixtures';

const fixture = loadProductSimpleFixture();
console.log(fixture.expected.product.title);
```

The loader memoizes file reads so repeated calls are inexpensive.
