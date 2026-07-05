import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('obsidian', () => {
    class MockTFolder {}
    class MockTFile {}
    return {
        Notice: vi.fn(),
        TFolder: MockTFolder,
        TFile: MockTFile,
        normalizePath: (path: string) => path,
        moment: (val: any) => {
            // Called with an object: moment({ year, month, day, ... })
            if (val !== null && typeof val === 'object' && 'year' in val) {
                const d = new Date(val.year, val.month, val.day, val.hour ?? 0, val.minute ?? 0, val.second ?? 0);
                return {
                    isValid: () => !isNaN(d.getTime()),
                    valueOf: () => d.getTime(),
                    format: (fmt: string) => {
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        if (fmt === "YYYY-MM-DD") return `${y}-${m}-${dd}`;
                        return `${y}-${m}-${dd} mocked-time`;
                    }
                };
            }
            // Called with epoch ms: moment(number)
            // Note: real moment() interprets epoch ms in local time. Our mock
            // must behave the same way as the object-form mock above (which uses
            // new Date(y,m,d,...) — i.e. local time). So we use local getters.
            if (typeof val === 'number') {
                const d = new Date(val);
                return {
                    format: (fmt: string) => {
                        const y = d.getFullYear();
                        const mo = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        const hh = String(d.getHours()).padStart(2, '0');
                        const mm = String(d.getMinutes()).padStart(2, '0');
                        const ss = String(d.getSeconds()).padStart(2, '0');
                        if (fmt === "YYYY-MM-DD") return `${y}-${mo}-${dd}`;
                        if (fmt === "YYYY-MM-DD HH:mm:ss") return `${y}-${mo}-${dd} ${hh}:${mm}:${ss}`;
                        return 'mocked-time';
                    }
                };
            }
            return {
                format: () => 'mocked-time'
            };
        }
    };
});

import { convertTranscript, registerConvertCommand, deriveMeetingName, extractDateFromBasename } from './convertTranscript';
import { TFolder, TFile } from 'obsidian';

describe('convertTranscript', () => {
    let mockVault: any;
    let mockWorkspace: any;
    let mockApp: any;
    let mockPlugin: any;

    beforeEach(() => {
        mockVault = {
            read: vi.fn(),
            getAbstractFileByPath: vi.fn(),
            createFolder: vi.fn(),
            modify: vi.fn(),
            create: vi.fn()
        };

        mockWorkspace = {
            getActiveFile: vi.fn()
        };

        mockApp = {
            vault: mockVault,
            workspace: mockWorkspace
        };

        mockPlugin = {
            app: mockApp,
            addCommand: vi.fn(),
            settings: {
                timeFormat: 'HH:mm:ss',
                outputFolder: 'Transcripts'
            }
        };
    });

    it('registers the convert command correctly', () => {
        registerConvertCommand(mockPlugin);
        expect(mockPlugin.addCommand).toHaveBeenCalled();
        const callArgs = mockPlugin.addCommand.mock.calls[0][0];
        expect(callArgs.id).toBe('convert-transcript-file');
        expect(callArgs.checkCallback).toBeInstanceOf(Function);
        
        // Test checkCallback with wrong file type
        mockWorkspace.getActiveFile.mockReturnValue({ extension: 'md' });
        expect(callArgs.checkCallback(true)).toBe(false);

        // Test checkCallback with correct file type
        mockWorkspace.getActiveFile.mockReturnValue({ extension: 'txt' });
        expect(callArgs.checkCallback(true)).toBe(true);
    });

    it('converts txt transcript to markdown', async () => {
        const mockFile = {
            extension: 'txt',
            basename: '2026-04-05_meeting',
            stat: { ctime: 1700000000000 }
        };
        mockVault.read.mockResolvedValue('[Alice] 12:00:00\nHello');
        mockVault.getAbstractFileByPath.mockReturnValueOnce(undefined); // folder doesn't exist
        
        // Mock TFile and TFolder
        const folderInstance = new TFolder();
        mockVault.getAbstractFileByPath.mockReturnValueOnce(folderInstance); // after createFolder
        mockVault.getAbstractFileByPath.mockReturnValueOnce(null); // targetFile doesn't exist
        
        await convertTranscript(mockFile as any, mockPlugin, false);
        
        expect(mockVault.read).toHaveBeenCalledWith(mockFile);
        expect(mockVault.createFolder).toHaveBeenCalledWith('Transcripts');
        expect(mockVault.create).toHaveBeenCalled();
        const createArgs = mockVault.create.mock.calls[0];
        expect(createArgs[0]).toBe('Transcripts/2026-04-05_meeting.md');
        expect(createArgs[1]).toContain('meeting_name: "Meeting"');
        expect(createArgs[1]).toContain('date: 2026-04-05');
        expect(createArgs[1]).toContain('# Meeting');
        expect(createArgs[1]).toContain('[Alice] 2026-04-05 12:00:00');
    });

    it('modifies existing file if target exists', async () => {
        const mockFile = {
            extension: 'vtt',
            basename: 'meeting_saved_closed_caption',
            stat: { ctime: 1700000000000 }
        };
        mockVault.read.mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nHello');
        
        const folderInstance = new TFolder();
        const fileInstance = new TFile();
        
        mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
            if (path === 'Transcripts') return folderInstance;
            if (path === 'Transcripts/Untitled Meeting mocked-time.md') return fileInstance;
            return null;
        });

        await convertTranscript(mockFile as any, mockPlugin, false);

        expect(mockVault.modify).toHaveBeenCalled();
        const modifyArgs = mockVault.modify.mock.calls[0];
        expect(modifyArgs[0]).toBe(fileInstance);
        expect(modifyArgs[1]).toContain('meeting_name: "Untitled Meeting mocked-time"');
    });

    it('shows notice if output path exists but is not a folder', async () => {
        const mockFile = {
            extension: 'txt',
            basename: 'test',
            stat: { ctime: 1700000000000 }
        };
        mockVault.read.mockResolvedValue('Test');
        
        const fileInstance = new TFile(); // Not a TFolder
        mockVault.getAbstractFileByPath.mockReturnValue(fileInstance);
        
        await convertTranscript(mockFile as any, mockPlugin, false);
        
        // modify/create shouldn't be called because the folder wasn't valid
        expect(mockVault.create).not.toHaveBeenCalled();
        expect(mockVault.modify).not.toHaveBeenCalled();
    });

    it('handles errors gracefully', async () => {
        const mockFile = {
            extension: 'txt',
            basename: 'test',
            stat: { ctime: 1700000000000 }
        };
        mockVault.read.mockRejectedValue(new Error('Read failed'));
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        await convertTranscript(mockFile as any, mockPlugin, false);
        
        expect(consoleSpy).toHaveBeenCalledWith("Transcript conversion failed:", expect.any(Error));
        consoleSpy.mockRestore();
    });
});

describe('deriveMeetingName', () => {
    it('returns original name title-cased if no prefix', () => {
        expect(deriveMeetingName('weekly_sync')).toBe('Weekly Sync');
        expect(deriveMeetingName('standup')).toBe('Standup');
    });

    it('strips date-only prefix', () => {
        expect(deriveMeetingName('2026-04-05_weekly_sync')).toBe('Weekly Sync');
        expect(deriveMeetingName('20260405_weekly_sync')).toBe('Weekly Sync');
    });

    it('strips date and time prefix', () => {
        expect(deriveMeetingName('2026-04-05_14-30_weekly_sync')).toBe('Weekly Sync');
        expect(deriveMeetingName('20260405_1430_weekly_sync')).toBe('Weekly Sync');
    });

    it('returns Untitled Meeting if entirely a date', () => {
        expect(deriveMeetingName('2026-04-05')).toBe('Untitled Meeting');
        expect(deriveMeetingName('20260405')).toBe('Untitled Meeting');
        expect(deriveMeetingName('2026-04-05_')).toBe('Untitled Meeting');
    });

    it('returns Untitled Meeting for default caption file', () => {
        expect(deriveMeetingName('meeting_saved_closed_caption')).toBe('Untitled Meeting');
        expect(deriveMeetingName('meeting_SAVED_closed_caption')).toBe('Untitled Meeting');
    });

    it('returns Untitled Meeting for pure underscores/whitespace remainders', () => {
        expect(deriveMeetingName('2026-04-05___')).toBe('Untitled Meeting');
        expect(deriveMeetingName('2026-04-05_ _')).toBe('Untitled Meeting');
    });

    it('processes compact date+time with already-cased name correctly', () => {
        expect(deriveMeetingName('20260405_1430_Weekly_Sync')).toBe('Weekly Sync');
    });

    it('processes dates spaced with dots correctly', () => {
        expect(deriveMeetingName('2026-04-01 20.31.29 My Meeting')).toBe('My Meeting');
        expect(deriveMeetingName('2026-04-01 20.31.29')).toBe('Untitled Meeting');
    });
});

describe('extractDateFromBasename', () => {
    it('extracts date from dashed date prefix (YYYY-MM-DD)', () => {
        const result = extractDateFromBasename('2026-04-05_weekly_sync');
        expect(result).not.toBeNull();
        // Verify it's a reasonable timestamp for 2026-04-05
        const d = new Date(result!);
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(3); // 0-indexed: April = 3
        expect(d.getDate()).toBe(5);
    });

    it('extracts date+time from dashed prefix (YYYY-MM-DD_HH-mm)', () => {
        const result = extractDateFromBasename('2026-04-05_14-30_weekly_sync');
        expect(result).not.toBeNull();
        const d = new Date(result!);
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(3);
        expect(d.getDate()).toBe(5);
        expect(d.getHours()).toBe(14);
        expect(d.getMinutes()).toBe(30);
    });

    it('extracts date+time with seconds (YYYY-MM-DD HH.mm.ss)', () => {
        const result = extractDateFromBasename('2026-04-01 20.31.29 My Meeting');
        expect(result).not.toBeNull();
        const d = new Date(result!);
        expect(d.getFullYear()).toBe(2026);
        expect(d.getHours()).toBe(20);
        expect(d.getMinutes()).toBe(31);
        expect(d.getSeconds()).toBe(29);
    });

    it('extracts date from compact prefix (YYYYMMDD)', () => {
        const result = extractDateFromBasename('20260405_weekly_sync');
        expect(result).not.toBeNull();
        const d = new Date(result!);
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(3);
        expect(d.getDate()).toBe(5);
    });

    it('extracts date+time from compact prefix (YYYYMMDD_HHmm)', () => {
        const result = extractDateFromBasename('20260405_1430_weekly_sync');
        expect(result).not.toBeNull();
        const d = new Date(result!);
        expect(d.getHours()).toBe(14);
        expect(d.getMinutes()).toBe(30);
    });

    it('extracts date from standalone date basename', () => {
        const result = extractDateFromBasename('2026-04-05');
        expect(result).not.toBeNull();
    });

    it('returns null for filenames without a date prefix', () => {
        expect(extractDateFromBasename('weekly_sync')).toBeNull();
        expect(extractDateFromBasename('standup')).toBeNull();
        expect(extractDateFromBasename('meeting_saved_closed_caption')).toBeNull();
    });

    it('returns null for invalid dates', () => {
        expect(extractDateFromBasename('2026-13-05_meeting')).toBeNull(); // month 13
        expect(extractDateFromBasename('2026-04-32_meeting')).toBeNull(); // day 32
    });

    it('defaults time to midnight when only date is present', () => {
        const result = extractDateFromBasename('2026-04-05_weekly_sync');
        expect(result).not.toBeNull();
        const d = new Date(result!);
        expect(d.getHours()).toBe(0);
        expect(d.getMinutes()).toBe(0);
        expect(d.getSeconds()).toBe(0);
    });
});

describe('convertTranscript date source priority', () => {
    let mockVault: any;
    let mockApp: any;
    let mockPlugin: any;

    beforeEach(() => {
        mockVault = {
            read: vi.fn(),
            getAbstractFileByPath: vi.fn(),
            createFolder: vi.fn(),
            modify: vi.fn(),
            create: vi.fn()
        };
        mockApp = {
            vault: mockVault,
            workspace: { getActiveFile: vi.fn() }
        };
        mockPlugin = {
            app: mockApp,
            addCommand: vi.fn(),
            settings: { timeFormat: 'HH:mm:ss', outputFolder: 'Transcripts' }
        };
    });

    it('uses ctime fallback when filename has no date prefix', async () => {
        const ctime = 1700000000000;
        const mockFile = {
            extension: 'txt',
            basename: 'weekly_sync',
            stat: { ctime }
        };
        mockVault.read.mockResolvedValue('[Alice] 12:00:00\nHello');

        const { TFolder } = await import('obsidian');
        const folderInstance = new TFolder();
        mockVault.getAbstractFileByPath.mockReturnValueOnce(folderInstance);
        mockVault.getAbstractFileByPath.mockReturnValueOnce(null);

        await convertTranscript(mockFile as any, mockPlugin, false);

        // Build expected date string from the same epoch (local tz, same as mock)
        const d = new Date(ctime);
        const expected = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

        const createArgs = mockVault.create.mock.calls[0];
        expect(createArgs[1]).toContain(`date: ${expected}`);
    });

    it('uses filename date when present, ignoring ctime', async () => {
        const mockFile = {
            extension: 'txt',
            basename: '2025-01-15_standup',
            stat: { ctime: 1700000000000 }  // 2023-11-14 — should be ignored
        };
        mockVault.read.mockResolvedValue('[Bob] 09:00:00\nGood morning');

        const { TFolder } = await import('obsidian');
        const folderInstance = new TFolder();
        mockVault.getAbstractFileByPath.mockReturnValueOnce(folderInstance);
        mockVault.getAbstractFileByPath.mockReturnValueOnce(null);

        await convertTranscript(mockFile as any, mockPlugin, false);

        const createArgs = mockVault.create.mock.calls[0];
        // Date should come from filename (2025-01-15), NOT ctime
        expect(createArgs[1]).toContain('date: 2025-01-15');
        expect(createArgs[1]).not.toContain('date: 2023-11-14');
    });
});
