import { Plugin, TAbstractFile, TFile, normalizePath, Notice } from "obsidian";
import { DEFAULT_SETTINGS } from "./settings";
import { TranscriptPluginSettings } from "./types";
import { TranscriptSettingTab } from "./ui/settingsTab";
import { registerConvertCommand, convertTranscript } from "./commands/convertTranscript";

export default class TranscriptToMdPlugin extends Plugin {
	settings: TranscriptPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new TranscriptSettingTab(this.app, this));

		registerConvertCommand(this);

		this.registerEvent(
			this.app.vault.on("create", async (abstractFile) => {
				await this.handleFileCreate(abstractFile);
			})
		);
	}

	onunload() {
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<TranscriptPluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async handleFileCreate(abstractFile: TAbstractFile) {
		if (!this.settings.autoConvertEnabled) return;

		if (!(abstractFile instanceof TFile)) return;

		const file = abstractFile;

		if (!file.path.endsWith(".txt") && !file.path.endsWith(".vtt")) return;

		const watch = this.settings.watchFolder?.trim();
		if (watch) {
			const normalizedWatch = normalizePath(watch) + "/";
			const normalizedPath = normalizePath(file.path);
			if (!normalizedPath.startsWith(normalizedWatch)) {
				return;
			}
		}

		await convertTranscript(file, this, false);

		if (this.settings.deleteOriginalAfterConvert) {
			try {
				await this.app.fileManager.trashFile(file);
			} catch (e) {
				console.error(e);
				new Notice("Failed to delete original transcript file");
			}
		}
	}
}
