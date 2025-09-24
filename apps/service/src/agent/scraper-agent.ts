export interface GenerateScriptParams {
  html: string;
  priorScript?: string;
  hints?: readonly string[];
}

export interface GenerateScriptResult {
  script: string;
  reused: boolean;
  notes: string;
}

const DEFAULT_SCRIPT = String.raw`(() => {
  const $ = cheerio.load(html);
  const normalize = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
  const pickText = (selectors) => {
    for (const selector of selectors) {
      if (!selector) continue;
      const node = $(selector).first();
      if (node.length > 0) {
        const text = normalize(node.text());
        if (text) {
          return text;
        }
        const contentAttr = normalize(node.attr('content') || '');
        if (contentAttr) {
          return contentAttr;
        }
      }
    }
    return '';
  };

  const title = pickText([
    '[data-test="product-title"]',
    'meta[property="og:title"]',
    'title',
    'h1'
  ]);

  const readPriceFromContainer = () => {
    const container = $('[data-test="product-price"]').first();
    if (!container || container.length === 0) {
      return '';
    }
    const amount = normalize(container.find('[data-test="price-amount"]').first().text());
    if (!amount) {
      return '';
    }
    const currencySymbol = normalize(container.find('.price__currency').first().text());
    const currencyCode = normalize(container.find('[data-test="price-currency"]').first().text());
    const parts = [];
    if (currencySymbol) {
      parts.push((currencySymbol + amount).trim());
    } else {
      parts.push(amount);
    }
    if (currencyCode) {
      parts.push(currencyCode.toUpperCase());
    }
    return parts.join(' ').trim();
  };

  const readPriceFromMeta = () => {
    const amount = normalize($('meta[property="product:price:amount"]').attr('content') || '');
    if (!amount) {
      return '';
    }
    const currency = normalize($('meta[property="product:price:currency"]').attr('content') || '');
    const parts = [];
    if (currency) {
      if (currency.toUpperCase() === 'USD') {
        parts.push(('$' + amount).trim());
      } else {
        parts.push(amount);
      }
      parts.push(currency.toUpperCase());
    } else {
      parts.push(('$' + amount).trim());
    }
    return parts.join(' ').trim();
  };

  const price = (() => {
    const fromContainer = readPriceFromContainer();
    if (fromContainer) {
      return fromContainer;
    }
    return readPriceFromMeta();
  })();

  return { title, price };
})()`;

export class ScraperAgent {
  generateScript(params: GenerateScriptParams): Promise<GenerateScriptResult> {
    if (params.priorScript) {
      return Promise.resolve({
        script: params.priorScript,
        reused: true,
        notes: 'Reused previously stored script.'
      });
    }

    return Promise.resolve({
      script: DEFAULT_SCRIPT,
      reused: false,
      notes: 'Generated baseline Cheerio extractor script.'
    });
  }
}
