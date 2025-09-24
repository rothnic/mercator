import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface RuntimePaths {
	runtimeRoot: string;
	domainKnowledgeDir: string;
	historyDir: string;
	historyFile: string;
}

const serviceDir = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultRuntimeRoot = join(serviceDir, ".runtime");

export const getDefaultRuntimeRoot = () => defaultRuntimeRoot;

export const resolveRuntimePaths = (runtimeRoot?: string): RuntimePaths => {
	const root = runtimeRoot ?? defaultRuntimeRoot;
	const domainKnowledgeDir = join(root, "domain-knowledge");
	const historyDir = join(root, "history");
	const historyFile = join(historyDir, "history.jsonl");
	return {
		runtimeRoot: root,
		domainKnowledgeDir,
		historyDir,
		historyFile,
	};
};

export const ensureRuntimePaths = async (paths: RuntimePaths) => {
	await mkdir(paths.runtimeRoot, { recursive: true });
	await mkdir(paths.domainKnowledgeDir, { recursive: true });
	await mkdir(paths.historyDir, { recursive: true });
};
