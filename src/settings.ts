import { TranscriptPluginSettings } from "./types";

export const DEFAULT_SETTINGS: TranscriptPluginSettings = {
	outputFolder: "Transcripts",
	watchFolder: "Transcripts",
	autoConvertEnabled: false,
	deleteOriginalAfterConvert: false,
	timeFormat: "YYYY-MM-DD HH:mm:ss"
};
