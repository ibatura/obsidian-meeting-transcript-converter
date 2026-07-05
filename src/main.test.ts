import { describe, it, expect, vi, beforeEach } from 'vitest';
import TranscriptToMdPlugin from './main';
import { DEFAULT_SETTINGS } from './settings';
import { TFile, TFolder } from 'obsidian';
import { convertTranscript } from './commands/convertTranscript';

vi.mock('obsidian', () => {
    class MockTFolder {}
    class MockTFile {
        path: string = "test.txt";
    }
    class MockPlugin {
        app: any;
        constructor(app: any, manifest: any) {
            this.app = app;
        }
        loadData = vi.fn();
        saveData = vi.fn();
        addSettingTab = vi.fn();
        registerEvent = vi.fn();
    }
    return {
        Plugin: MockPlugin,
        PluginSettingTab: class PluginSettingTab {},
        Notice: vi.fn(),
        TFolder: MockTFolder,
        TFile: MockTFile,
        normalizePath: (path: string) => path
    };
});

vi.mock('./commands/convertTranscript', () => ({
    registerConvertCommand: vi.fn(),
    convertTranscript: vi.fn()
}));

const mockConvertTranscript = vi.mocked(convertTranscript);

describe('TranscriptToMdPlugin', () => {
    let appMock: any;
    let plugin: any;

    beforeEach(() => {
        appMock = {
            vault: {
                on: vi.fn(),
                delete: vi.fn()
            },
            fileManager: {
                trashFile: vi.fn()
            },
            workspace: {}
        };
        plugin = new TranscriptToMdPlugin(appMock, {} as any);
        plugin.loadData.mockResolvedValue({ watchFolder: 'CustomFolder' });
        
        mockConvertTranscript.mockClear();
    });

    it('loadSettings merges defaults with loaded data', async () => {
        await plugin.loadSettings();
        expect(plugin.settings.autoConvertEnabled).toBe(DEFAULT_SETTINGS.autoConvertEnabled); // Assuming default is true/false
        expect(plugin.settings.watchFolder).toBe('CustomFolder');
    });
    
    it('saveSettings saves data', async () => {
        plugin.settings = { ...DEFAULT_SETTINGS, watchFolder: 'SaveTest' };
        await plugin.saveSettings();
        expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
    });

    describe('handleFileCreate', () => {
        beforeEach(async () => {
            await plugin.loadSettings();
        });

        it('ignores if autoConvertEnabled is false', async () => {
            plugin.settings.autoConvertEnabled = false;
            const file = new TFile() as any;
            file.path = "test.txt";
            await plugin.handleFileCreate(file);
            expect(mockConvertTranscript).not.toHaveBeenCalled();
        });

        it('ignores if not TFile', async () => {
            plugin.settings.autoConvertEnabled = true;
            await plugin.handleFileCreate(new TFolder() as any);
            expect(mockConvertTranscript).not.toHaveBeenCalled();
        });

        it('ignores if wrong extension', async () => {
            plugin.settings.autoConvertEnabled = true;
            const file = new TFile() as any;
            file.path = "test.md";
            await plugin.handleFileCreate(file);
            expect(mockConvertTranscript).not.toHaveBeenCalled();
        });

        it('ignores if outside watchFolder', async () => {
            plugin.settings.autoConvertEnabled = true;
            plugin.settings.watchFolder = 'Transcripts';
            const file = new TFile() as any;
            file.path = "OtherFolder/test.txt";
            await plugin.handleFileCreate(file);
            expect(mockConvertTranscript).not.toHaveBeenCalled();
        });

        it('converts correctly and does not delete if deleteOriginal is false', async () => {
            plugin.settings.autoConvertEnabled = true;
            plugin.settings.watchFolder = 'Transcripts';
            plugin.settings.deleteOriginalAfterConvert = false;
            
            const file = new TFile() as any;
            file.path = "Transcripts/test.txt";
            await plugin.handleFileCreate(file);
            
            expect(mockConvertTranscript).toHaveBeenCalledWith(file, plugin, false);
            expect(appMock.fileManager.trashFile).not.toHaveBeenCalled();
        });

        it('converts correctly and deletes if deleteOriginal is true', async () => {
            plugin.settings.autoConvertEnabled = true;
            plugin.settings.watchFolder = 'Transcripts';
            plugin.settings.deleteOriginalAfterConvert = true;
            
            const file = new TFile() as any;
            file.path = "Transcripts/test.txt";
            await plugin.handleFileCreate(file);
            
            expect(mockConvertTranscript).toHaveBeenCalledWith(file, plugin, false);
            expect(appMock.fileManager.trashFile).toHaveBeenCalledWith(file);
        });
    });
});
