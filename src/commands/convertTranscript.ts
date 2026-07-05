import { Notice, TFile, TFolder, normalizePath, moment } from "obsidian";
import TranscriptToMdPlugin from "../main";
import { convertTxtToMarkdown, convertVttToMarkdown, extractDuration, extractParticipants } from "../utils/converters";

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
	const m = moment({ year, month: month - 1, day, hour, minute: min, second: sec });
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

export async function convertTranscript(file: TFile, plugin: TranscriptToMdPlugin, showNotice: boolean = true) {
	try {
		const content = await plugin.app.vault.read(file);
		let mdContent = "";

		const timeFormat = plugin.settings.timeFormat;
		const fileCreationTime = extractDateFromBasename(file.basename) ?? file.stat.ctime;

		if (file.extension === 'txt') {
			mdContent = convertTxtToMarkdown(content, timeFormat, fileCreationTime);
		} else if (file.extension === 'vtt') {
			mdContent = convertVttToMarkdown(content, timeFormat, fileCreationTime);
		}

		// Build frontmatter
		const format = file.extension === "vtt" ? "vtt" : "txt";
		let meetingName = deriveMeetingName(file.basename);
		if (meetingName === "Untitled Meeting") {
			const timestamp = moment(fileCreationTime).format("YYYY-MM-DD_HH-mm-ss");
			meetingName = `Untitled Meeting ${timestamp}`;
		}
		const dateStr = moment(fileCreationTime).format("YYYY-MM-DD");

		let frontmatter = `---\nmeeting_name: "${meetingName}"\ndate: ${dateStr}\n`;

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

		// Use timestamped meeting name as filename for untitled meetings to avoid collisions
		const outputBaseName = meetingName.startsWith("Untitled Meeting") ? meetingName : file.basename;
		const newFilePath = normalizePath(`${folderPath}/${outputBaseName}.md`);

		const targetFile = plugin.app.vault.getAbstractFileByPath(newFilePath);
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
