export type FileNameOrder = "date-first" | "name-first";

export interface TranscriptPluginSettings {
	outputFolder: string;
	watchFolder: string;
	autoConvertEnabled: boolean;
	deleteOriginalAfterConvert: boolean;
	timeFormat: string;
	fileNameOrder: FileNameOrder;
	fileNameDateFormat: string;
}
