export interface ExtractionResult {
	title: string;
	price: string;
}

export interface ValidationResult {
	ok: boolean;
	issues: string[];
	value?: ExtractionResult;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === "object" && value !== null && !Array.isArray(value);
};

const normalize = (value: string) => value.trim();

export function validateExtraction(raw: unknown): ValidationResult {
	if (!isRecord(raw)) {
		return {
			ok: false,
			issues: ["Extractor must return an object with title and price strings."],
		};
	}

	const issues: string[] = [];
	const titleValue = typeof raw.title === "string" ? normalize(raw.title) : "";
	const priceValue = typeof raw.price === "string" ? normalize(raw.price) : "";

	if (!titleValue) {
		issues.push("Missing product title.");
	}

	if (!priceValue) {
		issues.push("Missing product price.");
	}

	if (issues.length > 0) {
		return { ok: false, issues };
	}

	return {
		ok: true,
		issues: [],
		value: {
			title: titleValue,
			price: priceValue,
		},
	};
}
