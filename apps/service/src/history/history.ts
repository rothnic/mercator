import { appendFile } from "node:fs/promises";

import type { RuntimePaths } from "../runtime/environment";

export interface HistoryLine {
	t: string;
	runId: string;
	step: number;
	actor: string;
	action: string;
	outcome: string;
	resourceId: string;
}

export const appendHistoryLine = async (
	paths: RuntimePaths,
	line: HistoryLine,
) => {
	const payload = `${JSON.stringify(line)}\n`;
	await appendFile(paths.historyFile, payload, "utf8");
};
