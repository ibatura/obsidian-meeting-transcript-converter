import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared by the moment stub and by tests that need to state an expected
// timestamp, so expectations never depend on the machine's timezone.
const { formatAt } = vi.hoisted(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatAt = (d: Date, fmt: string): string => fmt
        .replace(/YYYY/g, String(d.getFullYear()))
        .replace(/MM/g, pad(d.getMonth() + 1))
        .replace(/DD/g, pad(d.getDate()))
        .replace(/HH/g, pad(d.getHours()))
        .replace(/mm/g, pad(d.getMinutes()))
        .replace(/ss/g, pad(d.getSeconds()));
    return { formatAt };
});

vi.mock('obsidian', () => {
    class MockTFolder { }
    class MockTFile { }
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
                    format: (fmt: string) => formatAt(d, fmt)
                };
            }
            // Called with epoch ms: moment(number). Real moment() interprets
            // epoch ms in local time, so the local getters in formatAt match.
            if (typeof val === 'number') {
                return { format: (fmt: string) => formatAt(new Date(val), fmt) };
            }
            return {
                format: () => 'mocked-time'
            };
        }
    };
});

import { convertTranscript, registerConvertCommand, deriveMeetingName, extractDateFromBasename, buildNoteFileName } from './convertTranscript';
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
                outputFolder: 'Transcripts',
                fileNameOrder: 'date-first',
                fileNameDateFormat: 'YYYY-MM-DD'
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
            path: 'Inbox/2026-04-05_meeting.txt',
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
        expect(createArgs[0]).toBe('Transcripts/2026-04-05 Meeting.md');
        expect(createArgs[1]).toContain('source: "Inbox/2026-04-05_meeting.txt"');
        expect(createArgs[1]).toContain('meeting_name: "Meeting"');
        expect(createArgs[1]).toContain('date: 2026-04-05');
        expect(createArgs[1]).toContain('# Meeting');
        expect(createArgs[1]).toContain('[Alice] 2026-04-05 12:00:00');
    });

    it('overwrites the note it wrote before when the same transcript is converted again', async () => {
        const mockFile = {
            extension: 'txt',
            basename: '2026-04-05_standup',
            path: 'Inbox/2026-04-05_standup.txt',
            stat: { ctime: 1700000000000 }
        };
        const existingNote = new TFile();
        mockVault.read.mockImplementation((f: any) => Promise.resolve(
            f === mockFile
                ? '[Alice] 12:00:00\nHello'
                : '---\nmeeting_name: "Standup"\ndate: 2026-04-05\nsource: "Inbox/2026-04-05_standup.txt"\n---\n\n# Standup\n'
        ));
        mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
            if (path === 'Transcripts') return new TFolder();
            if (path === 'Transcripts/2026-04-05 Standup.md') return existingNote;
            return null;
        });

        await convertTranscript(mockFile as any, mockPlugin, false);

        expect(mockVault.create).not.toHaveBeenCalled();
        expect(mockVault.modify.mock.calls[0][0]).toBe(existingNote);
    });

    it('writes a separate note when the name is taken by a different transcript', async () => {
        const mockFile = {
            extension: 'txt',
            basename: '2026-04-05_standup',
            path: 'Inbox/2026-04-05_standup.txt',
            stat: { ctime: 1700000000000 }
        };
        mockVault.read.mockImplementation((f: any) => Promise.resolve(
            f === mockFile
                ? '[Alice] 12:00:00\nHello'
                : '---\nmeeting_name: "Standup"\ndate: 2026-04-05\nsource: "Inbox/another_standup.txt"\n---\n\n# Standup\n'
        ));
        mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
            if (path === 'Transcripts') return new TFolder();
            if (path === 'Transcripts/2026-04-05 Standup.md') return new TFile();
            return null;
        });

        await convertTranscript(mockFile as any, mockPlugin, false);

        expect(mockVault.modify).not.toHaveBeenCalled();
        expect(mockVault.create.mock.calls[0][0]).toBe('Transcripts/2026-04-05 Standup 00-00-00.md');
    });

    it('leaves a note that carries no source property alone', async () => {
        const mockFile = {
            extension: 'txt',
            basename: '2026-04-05_standup',
            path: 'Inbox/2026-04-05_standup.txt',
            stat: { ctime: 1700000000000 }
        };
        mockVault.read.mockImplementation((f: any) => Promise.resolve(
            f === mockFile ? '[Alice] 12:00:00\nHello' : '# Notes I wrote by hand\n'
        ));
        mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
            if (path === 'Transcripts') return new TFolder();
            if (path === 'Transcripts/2026-04-05 Standup.md') return new TFile();
            return null;
        });

        await convertTranscript(mockFile as any, mockPlugin, false);

        expect(mockVault.modify).not.toHaveBeenCalled();
        expect(mockVault.create.mock.calls[0][0]).toBe('Transcripts/2026-04-05 Standup 00-00-00.md');
    });

    it('names an untitled meeting without a timestamp', async () => {
        const ctime = 1700000000000;
        const mockFile = {
            extension: 'vtt',
            basename: 'meeting_saved_closed_caption',
            path: 'Inbox/meeting_saved_closed_caption.vtt',
            stat: { ctime }
        };
        mockVault.read.mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nHello');
        mockVault.getAbstractFileByPath.mockImplementation((path: string) =>
            path === 'Transcripts' ? new TFolder() : null
        );

        await convertTranscript(mockFile as any, mockPlugin, false);

        const expectedDate = formatAt(new Date(ctime), 'YYYY-MM-DD');
        const createArgs = mockVault.create.mock.calls[0];
        expect(createArgs[0]).toBe(`Transcripts/${expectedDate} Untitled Meeting.md`);
        expect(createArgs[1]).toContain('meeting_name: "Untitled Meeting"\n');
        expect(createArgs[1]).toContain('# Untitled Meeting\n');
    });

    it('shows notice if output path exists but is not a folder', async () => {
        const mockFile = {
            extension: 'txt',
            basename: 'test',
            path: 'Inbox/test.txt',
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
            path: 'Inbox/test.txt',
            stat: { ctime: 1700000000000 }
        };
        mockVault.read.mockRejectedValue(new Error('Read failed'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

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
            settings: { timeFormat: 'HH:mm:ss', outputFolder: 'Transcripts', fileNameOrder: 'date-first', fileNameDateFormat: 'YYYY-MM-DD' }
        };
    });

    it('uses ctime fallback when filename has no date prefix', async () => {
        const ctime = 1700000000000;
        const mockFile = {
            extension: 'txt',
            basename: 'weekly_sync',
            path: 'Inbox/weekly_sync.txt',
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
        const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const createArgs = mockVault.create.mock.calls[0];
        expect(createArgs[1]).toContain(`date: ${expected}`);
    });

    it('uses filename date when present, ignoring ctime', async () => {
        const mockFile = {
            extension: 'txt',
            basename: '2025-01-15_standup',
            path: 'Inbox/2025-01-15_standup.txt',
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

describe('convertTranscript vtt dialect routing', () => {
    let mockVault: any;
    let mockPlugin: any;

    beforeEach(() => {
        mockVault = {
            read: vi.fn(),
            getAbstractFileByPath: vi.fn(),
            createFolder: vi.fn(),
            modify: vi.fn(),
            create: vi.fn()
        };
        mockPlugin = {
            app: { vault: mockVault, workspace: { getActiveFile: vi.fn() } },
            addCommand: vi.fn(),
            settings: { timeFormat: 'YYYY-MM-DD HH:mm:ss', outputFolder: 'Transcripts', fileNameOrder: 'date-first', fileNameDateFormat: 'YYYY-MM-DD' }
        };
        mockVault.getAbstractFileByPath.mockReturnValueOnce(new TFolder()); // output folder
        mockVault.getAbstractFileByPath.mockReturnValueOnce(null);          // target file
    });

    it('converts a voice-tagged (Teams) vtt into speaker lines with participants', async () => {
        const mockFile = {
            extension: 'vtt',
            basename: '2026-07-31_valuation',
            path: 'Inbox/2026-07-31_valuation.vtt',
            stat: { ctime: 1700000000000 }
        };
        mockVault.read.mockResolvedValue(`WEBVTT

2eb325bb-1b35-4dac-b37b-c7a00c2a68d3/10-0
00:00:01.000 --> 00:00:03.000
<v Kate Kan>Hey!</v>

2eb325bb-1b35-4dac-b37b-c7a00c2a68d3/14-0
00:00:04.000 --> 00:00:06.000
<v Ivan Kan>Yeah, I was mute.</v>
`);

        await convertTranscript(mockFile as any, mockPlugin, false);

        const content = mockVault.create.mock.calls[0][1];
        expect(content).toContain('participants:\n  - "Ivan Kan"\n  - "Kate Kan"');
        expect(content).toContain('[Kate Kan] 2026-07-31 00:00:01\nHey!');
        expect(content).toContain('[Ivan Kan] 2026-07-31 00:00:04\nYeah, I was mute.');
        expect(content).not.toContain('2eb325bb');
        expect(content).not.toContain('<v ');
    });

    it('keeps bulleted output for a vtt without voice tags', async () => {
        const mockFile = {
            extension: 'vtt',
            basename: '2026-07-31_standup',
            path: 'Inbox/2026-07-31_standup.vtt',
            stat: { ctime: 1700000000000 }
        };
        mockVault.read.mockResolvedValue(`WEBVTT

1
00:00:01.000 --> 00:00:03.000
Alice: Hello there
`);

        await convertTranscript(mockFile as any, mockPlugin, false);

        const content = mockVault.create.mock.calls[0][1];
        expect(content).toContain('- **[2026-07-31 00:00:01]** Alice: Hello there');
    });
});

describe('buildNoteFileName', () => {
    // 2026-04-05 16:05:00 local time, built from components so the expected
    // strings below hold in any timezone.
    const meetingTime = new Date(2026, 3, 5, 16, 5, 0).getTime();

    it('puts the date before the meeting name by default', () => {
        expect(buildNoteFileName('Sprint Planning', meetingTime, 'date-first', 'YYYY-MM-DD'))
            .toBe('2026-04-05 Sprint Planning');
    });

    it('puts the meeting name before the date when configured', () => {
        expect(buildNoteFileName('Sprint Planning', meetingTime, 'name-first', 'YYYY-MM-DD'))
            .toBe('Sprint Planning 2026-04-05');
    });

    it('formats the date with the configured format', () => {
        expect(buildNoteFileName('Sprint Planning', meetingTime, 'date-first', 'DD.MM.YYYY'))
            .toBe('05.04.2026 Sprint Planning');
    });

    it('returns the meeting name alone when the date format is empty', () => {
        expect(buildNoteFileName('Sprint Planning', meetingTime, 'date-first', ''))
            .toBe('Sprint Planning');
        expect(buildNoteFileName('Sprint Planning', meetingTime, 'name-first', '   '))
            .toBe('Sprint Planning');
    });

    it('replaces path separators produced by the date format', () => {
        expect(buildNoteFileName('Sprint Planning', meetingTime, 'date-first', 'YYYY/MM/DD'))
            .toBe('2026-04-05 Sprint Planning');
    });

    it('replaces every character that cannot appear in a file name', () => {
        expect(buildNoteFileName('a/b\\c:d*e?f"g<h>i|j', meetingTime, 'date-first', ''))
            .toBe('a-b-c-d-e-f-g-h-i-j');
    });
});
