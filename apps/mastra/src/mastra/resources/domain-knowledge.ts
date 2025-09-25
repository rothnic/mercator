import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runtimeRoot = path.join(
	fileURLToPath(new URL("../../..", import.meta.url)),
	".runtime",
	"domains",
);

export interface ExtractorScriptEntry {
	pathPattern: string;
	script: string;
	notes?: string;
	updatedAt: string;
	lastRunAt?: string;
	runCount: number;
}

export interface DomainKnowledge {
	domain: string;
	entries: ExtractorScriptEntry[];
}

async function ensureDomainDir(): Promise<void> {
	await fs.mkdir(runtimeRoot, { recursive: true });
}

function resolveDomainPath(domain: string): string {
	return path.join(runtimeRoot, `${domain}.json`);
}

export async function loadDomainKnowledge(
	domain: string,
): Promise<DomainKnowledge> {
	await ensureDomainDir();
	const domainPath = resolveDomainPath(domain);
	try {
		const raw = await fs.readFile(domainPath, "utf8");
		const parsed = JSON.parse(raw) as DomainKnowledge;
		return {
			domain,
			entries: parsed.entries ?? [],
		};
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { domain, entries: [] };
		}
		throw error;
	}
}

async function persistDomainKnowledge(
	domain: string,
	knowledge: DomainKnowledge,
): Promise<void> {
	await ensureDomainDir();
	const domainPath = resolveDomainPath(domain);
	await fs.writeFile(domainPath, JSON.stringify(knowledge, null, 2), "utf8");
}

export function findExtractorForPath(
	knowledge: DomainKnowledge,
	pathname: string,
): ExtractorScriptEntry | undefined {
	const exactMatch = knowledge.entries.find(
		(entry) => entry.pathPattern === pathname,
	);
	if (exactMatch) {
		return exactMatch;
	}

	const fallback = knowledge.entries.find((entry) => {
		try {
			const regex = new RegExp(entry.pathPattern);
			return regex.test(pathname);
		} catch {
			return false;
		}
	});

	return fallback;
}

export async function saveExtractorScript({
	domain,
	entry,
}: {
	domain: string;
	entry: Omit<ExtractorScriptEntry, "runCount"> & { runCount?: number };
}): Promise<ExtractorScriptEntry> {
	const knowledge = await loadDomainKnowledge(domain);
	const existingIndex = knowledge.entries.findIndex(
		(candidate) => candidate.pathPattern === entry.pathPattern,
	);
	const nextEntry: ExtractorScriptEntry = {
		pathPattern: entry.pathPattern,
		script: entry.script,
		notes: entry.notes,
		updatedAt: entry.updatedAt,
		lastRunAt: entry.lastRunAt,
		runCount: entry.runCount ?? 0,
	};

	if (existingIndex >= 0) {
		knowledge.entries[existingIndex] = nextEntry;
	} else {
		knowledge.entries.push(nextEntry);
	}

	await persistDomainKnowledge(domain, knowledge);
	return nextEntry;
}

export async function recordExtractorRun({
	domain,
	pathPattern,
	runAt,
}: {
	domain: string;
	pathPattern: string;
	runAt: string;
}): Promise<void> {
	const knowledge = await loadDomainKnowledge(domain);
	const entry = knowledge.entries.find(
		(candidate) => candidate.pathPattern === pathPattern,
	);
	if (!entry) {
		return;
	}
	entry.lastRunAt = runAt;
	entry.runCount = (entry.runCount ?? 0) + 1;
	await persistDomainKnowledge(domain, knowledge);
}
