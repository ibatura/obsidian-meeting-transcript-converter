import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import TranscriptToMdPlugin from "../main";
import { FileNameOrder } from "../types";

import { convertTeamsVttToMarkdown, convertTxtToMarkdown, convertVttToMarkdown, detectVttDialect, extractDuration, extractParticipants } from "../utils/converters";
import { typedMoment, MomentLike } from "../utils/momentTyped";

/**
 * Attempts to extract a date (and optional time) from the beginning of a filename.
 * Returns epoch milliseconds if a date prefix is found, or null otherwise.
 *
 * Supported patterns:
 *   2026-04-05_14-30_...   2026-04-05_14.30.29_...   2026-04-05 20.31.29 ...
 *   2026-04-05_...         20260405_1430_...          20260405_...
 *   2026-04-05             20260405
 */
export function extractDateFromBasename(basename: string): number | null {
	const match = basename.match(
		/^(\d{4})-?(\d{2})-?(\d{2})(?:[_\s](\d{2})[-.]?(\d{2})(?:[-.]?(\d{2}))?)?/
	);
	if (!match) return null;

	const year = parseInt(match[1]!, 10);
	const month = parseInt(match[2]!, 10);  // 1-based
	const day = parseInt(match[3]!, 10);
	const hour = match[4] ? parseInt(match[4], 10) : 0;
	const min = match[5] ? parseInt(match[5], 10) : 0;
	const sec = match[6] ? parseInt(match[6], 10) : 0;

	// Basic sanity check
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	if (hour > 23 || min > 59 || sec > 59) return null;

	// Use moment (provided by Obsidian) to build the timestamp in local time
	const m: MomentLike = typedMoment({ year, month: month - 1, day, hour, minute: min, second: sec });
	if (!m.isValid()) return null;

	return m.valueOf();
}

export function deriveMeetingName(basename: string): string {
	if (basename.toLowerCase() === "meeting_saved_closed_caption") {
		return "Untitled Meeting";
	}

	let stripped = basename.replace(
		/^\d{4}-?\d{2}-?\d{2}(?:[_\s]\d{2}[-.]?\d{2}(?:[-.]?\d{2})?)?[_\s]?/,
		""
	);

	if (!stripped || /^[\s_]*$/.test(stripped)) {
		return "Untitled Meeting";
	}

	return stripped
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Composes the note's file name from the meeting name and the meeting's date,
 * in the order the user configured. Returns a base name, without extension.
 *
 * An empty date format yields the meeting name on its own. Characters that
 * cannot appear in a file name are replaced with a hyphen, so a date format
 * such as `YYYY/MM/DD` produces a name rather than a folder path.
 */
export function buildNoteFileName(
	meetingName: string,
	meetingTime: number,
	order: FileNameOrder,
	dateFormat: string
): string {
	const trimmedFormat = dateFormat.trim();
	const datePart = trimmedFormat ? typedMoment(meetingTime).format(trimmedFormat) : "";

	const parts = order === "name-first" ? [meetingName, datePart] : [datePart, meetingName];
	const name = parts.filter((part) => part !== "").join(" ");

	return name.replace(/[/\\:*?"<>|]/g, "-").trim();
}

export function registerConvertCommand(plugin: TranscriptToMdPlugin) {
	plugin.addCommand({
		id: "convert-transcript-file",
		name: "Convert transcript file (txt/vtt) to Markdown",
		checkCallback: (checking: boolean) => {
			const file = plugin.app.workspace.getActiveFile();
			if (file && (file.extension === 'txt' || file.extension === 'vtt')) {
				if (!checking) {
					void convertTranscript(file, plugin);
				}
				return true;
			}
			return false;
		}
	});
}

/**
 * Whether an existing note was converted from this transcript, judged by the
 * `source` property the plugin writes. A note that cannot be read, or that
 * carries no `source`, counts as someone else's — the safe answer, since it
 * leads to writing a new note rather than replacing one.
 */
async function noteCameFrom(
	plugin: TranscriptToMdPlugin,
	note: TFile,
	sourcePath: string
): Promise<boolean> {
	try {
		const content = await plugin.app.vault.read(note);
		const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		if (!frontmatter) return false;

		const source = frontmatter[1]!.match(/^source:\s*"(.*)"\s*$/m);
		return source?.[1] === sourcePath;
	} catch {
		return false;
	}
}

export async function convertTranscript(file: TFile, plugin: TranscriptToMdPlugin, showNotice: boolean = true) {
	try {
		const content = await plugin.app.vault.read(file);
		let mdContent = "";

		const timeFormat = plugin.settings.timeFormat;
		const fileCreationTime = extractDateFromBasename(file.basename) ?? file.stat.ctime;

		if (file.extension === 'txt') {
			mdContent = convertTxtToMarkdown(content, timeFormat, fileCreationTime);
		} else if (file.extension === "vtt") {
			// Teams transcripts name their speakers in voice tags and read best in the
			// same speaker-per-turn layout as Zoom TXT; other VTT stays bulleted.
			mdContent = detectVttDialect(content) === "speaker"
				? convertTeamsVttToMarkdown(content, timeFormat, fileCreationTime)
				: convertVttToMarkdown(content, timeFormat, fileCreationTime);
		}

		// Build frontmatter
		const format = file.extension === "vtt" ? "vtt" : "txt";
		const meetingName = deriveMeetingName(file.basename);
		const dateStr: string = typedMoment(fileCreationTime).format("YYYY-MM-DD");

		// `source` is the note's identity: it tells a later conversion which
		// transcript this note came from.
		let frontmatter = `---\nmeeting_name: "${meetingName}"\ndate: ${dateStr}\nsource: "${file.path}"\n`;

		const duration = extractDuration(content, format);
		if (duration) {
			frontmatter += `duration: "${duration}"\n`;
		}

		const participants = extractParticipants(content, format);
		if (participants.length > 0) {
			frontmatter += `participants:\n`;
			for (const p of participants) {
				frontmatter += `  - "${p}"\n`;
			}
		}

		frontmatter += `---\n\n`;

		// Add title (reuse meeting_name so heading matches frontmatter)
		mdContent = `${frontmatter}# ${meetingName}\n\n${mdContent}`;

		const folderPath = normalizePath(plugin.settings.outputFolder);
		let folder = plugin.app.vault.getAbstractFileByPath(folderPath);

		if (!folder) {
			await plugin.app.vault.createFolder(folderPath);
			folder = plugin.app.vault.getAbstractFileByPath(folderPath);
		}

		if (!(folder instanceof TFolder)) {
			new Notice(`Output path "${folderPath}" exists but is not a folder.`);
			return;
		}

		const outputBaseName = buildNoteFileName(
			meetingName,
			fileCreationTime,
			plugin.settings.fileNameOrder,
			plugin.settings.fileNameDateFormat
		);

		let newFilePath = normalizePath(`${folderPath}/${outputBaseName}.md`);
		let targetFile = plugin.app.vault.getAbstractFileByPath(newFilePath);

		// A note already at that name belongs to a different meeting unless it
		// names this transcript as its source. Rather than replace it, fall back
		// to a name carrying this meeting's time.
		if (targetFile instanceof TFile && !(await noteCameFrom(plugin, targetFile, file.path))) {
			const timeSuffix: string = typedMoment(fileCreationTime).format("HH-mm-ss");
			newFilePath = normalizePath(`${folderPath}/${outputBaseName} ${timeSuffix}.md`);
			targetFile = plugin.app.vault.getAbstractFileByPath(newFilePath);
		}

		if (targetFile instanceof TFile) {
			await plugin.app.vault.modify(targetFile, mdContent);
			if (showNotice) new Notice(`Updated ${newFilePath}`);
		} else {
			await plugin.app.vault.create(newFilePath, mdContent);
			if (showNotice) new Notice(`Created ${newFilePath}`);
		}
	} catch (e) {
		console.error("Transcript conversion failed:", e);
		new Notice("Failed to convert transcript. See console for details.");
	}
}
