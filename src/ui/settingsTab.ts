import { App, PluginSettingTab, Setting } from "obsidian";
import TranscriptToMdPlugin from "../main";

export class TranscriptSettingTab extends PluginSettingTab {
	plugin: TranscriptToMdPlugin;

	constructor(app: App, plugin: TranscriptToMdPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Output Folder")
			.setDesc("The vault folder where converted markdown files will be saved.")
			.addText(text => text
				.setPlaceholder("Transcripts")
				.setValue(this.plugin.settings.outputFolder)
				.onChange(async (value) => {
					this.plugin.settings.outputFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Watch folder")
			.setDesc("Folder to watch for new .txt/.vtt files (empty = whole vault)")
			.addText(text => text
				.setPlaceholder("Transcripts")
				.setValue(this.plugin.settings.watchFolder)
				.onChange(async (value) => {
					this.plugin.settings.watchFolder = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Auto-convert new transcripts")
			.setDesc("Automatically convert new .txt/.vtt files in the watched folder")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoConvertEnabled)
				.onChange(async (value) => {
					this.plugin.settings.autoConvertEnabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Delete original file after convert")
			.setDesc("Remove the source .txt/.vtt file after the .md file is created")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.deleteOriginalAfterConvert)
				.onChange(async (value) => {
					this.plugin.settings.deleteOriginalAfterConvert = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Time format")
			.setDesc("Timestamp format for dialog lines (moment.js). Default: YYYY-MM-DD HH:mm:ss")
			.addText(text => text
				.setPlaceholder("YYYY-MM-DD HH:mm:ss")
				.setValue(this.plugin.settings.timeFormat)
				.onChange(async (value) => {
					this.plugin.settings.timeFormat = value;
					await this.plugin.saveSettings();
				}));
	}
}
