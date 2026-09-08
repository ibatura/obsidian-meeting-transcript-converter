import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian', () => ({
    moment: (val: any) => ({
        format: (fmt: string) => {
            if (val === 1700000000000 && fmt === "YYYY-MM-DD") return "2023-11-14";
            if (val === 1700000000000 && fmt === "YYYY-MM-DD HH:mm:ss") return "2023-11-14 12:00:00";
            return val ? new Date(val).toISOString() : 'mocked-time';
        }
    })
}));

import { convertTxtToMarkdown, convertVttToMarkdown, extractParticipants, extractDuration, parseVttTimeOffset, parseVttCues, detectVttDialect, convertTeamsVttToMarkdown } from './converters';
describe('extractParticipants', () => {
    it('should return sorted unique names from vtt', () => {
        const input = `WEBVTT

00:00.000 --> 00:05.000
Alice: Hello there

00:05.000 --> 00:10.000
Bob: Hi Alice

00:10.000 --> 00:15.000
Alice: Good morning!

00:15.000 --> 00:20.000
http://example.com: This is a URL.
Note: this is a note
`;
        const result = extractParticipants(input, "vtt");
        expect(result).toEqual(["Alice", "Bob"]);
    });

    it('should return sorted unique names from txt format [Name] HH:mm:ss', () => {
        const input = `
[Yujia Small] 20:30:11
Hello everyone!
[Ivan Kan] 20:30:25
Thanks.
[Kate Kan] 21:15:40
Bye!
`;
        const result = extractParticipants(input, "txt");
        expect(result).toEqual(["Ivan Kan", "Kate Kan", "Yujia Small"]);
    });

    it('should return empty array when no speakers found', () => {
        expect(extractParticipants("Just some text", "txt")).toEqual([]);
        expect(extractParticipants("00:01.000 --> 00:02.000\nNo speakers here", "vtt")).toEqual([]);
    });
});

describe('extractDuration', () => {
    it('should return max vtt end time correctly', () => {
        const input = `WEBVTT
00:00.000 --> 00:30.500
Hello
00:30.500 --> 01:15:20.000
Bye
`;
        const result = extractDuration(input, "vtt");
        expect(result).toBe("01:15:20");
    });

    it('should return difference for txt correctly', () => {
        const input = `
[Alice] 20:30:00
Hello
[Bob] 20:35:10
Hi
[Alice] 21:45:30
Bye
`;
        const result = extractDuration(input, "txt");
        expect(result).toBe("01:15:30"); // 21:45:30 - 20:30:00 = 1h 15m 30s
    });

    it('should handle txt midnight crossing', () => {
        const input = `
[Alice] 23:55:00
Hello
[Bob] 00:05:00
Hi
`;
        const result = extractDuration(input, "txt");
        expect(result).toBe("00:10:00");
    });

    it('should return null if not enough timestamps', () => {
        expect(extractDuration("[Alice] 20:30:00\nHello", "txt")).toBeNull();
        expect(extractDuration("Hello world", "vtt")).toBeNull();
    });
});

describe('convertTxtToMarkdown', () => {
    it('should prepend date to header lines', () => {
        const input = '[Yujia Small] 20:30:11\nHello everyone.';
        const result = convertTxtToMarkdown(input, "", 1700000000000);
        // 1700000000000 is intercepted by our mock above to return 2023-11-14
        expect(result).toBe('[Yujia Small] 2023-11-14 20:30:11\nHello everyone.');
    });

    it('should ignore empty lines and return trimmed content', () => {
        const input = '   \n[Bob] 12:00:00\n   text   \n \t ';
        const result = convertTxtToMarkdown(input, "", 1700000000000);
        expect(result).toBe('[Bob] 2023-11-14 12:00:00\ntext');
    });
});

describe('extractParticipants – vtt long name / URL exclusion', () => {
    it('should ignore names longer than 40 characters', () => {
        const longName = 'A'.repeat(41);
        const input = `WEBVTT\n\n00:00.000 --> 00:05.000\n${longName}: hello\n`;
        expect(extractParticipants(input, "vtt")).toEqual([]);
    });

    it('should ignore lines starting with http or Note', () => {
        const input = `WEBVTT\n\n00:00.000 --> 00:05.000\nhttp://x.com: link\nNote: reminder\nAlice: hello\n`;
        expect(extractParticipants(input, "vtt")).toEqual(["Alice"]);
    });
});

describe('convertVttToMarkdown', () => {
    it('should handle basic VTT format', () => {
        const input = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello this is the first line
It has a second part

2
00:00:05.000 --> 00:00:10.000
Second cue block here
`;
        const result = convertVttToMarkdown(input, "", 0);

        expect(result).toBe('- Hello this is the first line It has a second part\n- Second cue block here');
    });

    it('should format timestamps using timeFormat and fileCreationTime', () => {
        const input = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello this is the first line
`;
        const result = convertVttToMarkdown(input, "YYYY-MM-DD HH:mm:ss", 1700000000000);
        // Note: The time offset of 1s (1000ms) will be added to fileCreationTime.
        // It uses mock moment which returns "2023-11-14 12:00:00" for 1700000000000 exactly
        // Wait, the mock checks for 1700000000000 exactly. Let's make sure the mock returns something.
        // Let's just expect it contains mocked-time if it falls back to IsISOString or whatever.
        expect(result).toBe('- **[2023-11-14T22:13:21.000Z]** Hello this is the first line');
    });
});

describe('parseVttTimeOffset', () => {
    it('returns 0 for empty parts string', () => {
        expect(parseVttTimeOffset("")).toBe(0);
    });

    it('parses single part string correctly', () => {
        expect(parseVttTimeOffset("30.250")).toBe(30250);
    });

    it('parses mm:ss.ms correctly', () => {
        expect(parseVttTimeOffset("01:30.500")).toBe(90500);
    });

    it('parses hh:mm:ss.ms correctly', () => {
        expect(parseVttTimeOffset("01:15:20.000")).toBe(4520000);
    });
});

describe('parseVttCues', () => {
    it('discards numeric and GUID-style cue identifiers', () => {
        const input = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Plain caption line

2eb325bb-1b35-4dac-b37b-c7a00c2a68d3/154-0
00:00:05.000 --> 00:00:07.000
Teams caption line
`;
        expect(parseVttCues(input)).toEqual([
            { offsetMs: 1000, text: "Plain caption line" },
            { offsetMs: 5000, text: "Teams caption line" }
        ]);
    });

    it('lifts the speaker out of a voice tag and joins multi-line cue text', () => {
        const input = `WEBVTT

2eb325bb-1b35-4dac-b37b-c7a00c2a68d3/94-0
00:01:12.760 --> 00:01:16.520
<v Antonio Lano>Ladno, raz ty zapytala,
korotshe.</v>
`;
        expect(parseVttCues(input)).toEqual([
            { offsetMs: 72760, speaker: "Antonio Lano", text: "Ladno, raz ty zapytala, korotshe." }
        ]);
    });

    it('strips inline markup from a cue with no voice tag', () => {
        const input = `WEBVTT

00:00:01.000 --> 00:00:02.000
<c.yellow>Hello</c> <i>there</i><00:00:01.500>friend
`;
        expect(parseVttCues(input)).toEqual([
            { offsetMs: 1000, text: "Hello there friend" }
        ]);
    });

    it('skips NOTE blocks', () => {
        const input = `WEBVTT

NOTE
This transcript was generated automatically.

00:00:01.000 --> 00:00:02.000
Real content
`;
        expect(parseVttCues(input)).toEqual([
            { offsetMs: 1000, text: "Real content" }
        ]);
    });

    it('keeps text that appears before any timestamp', () => {
        const input = `WEBVTT

Loose line without a cue
`;
        expect(parseVttCues(input)).toEqual([{ text: "Loose line without a cue" }]);
    });
});

describe('detectVttDialect', () => {
    it('returns "speaker" when a voice tag is present', () => {
        const input = `WEBVTT

00:00:01.000 --> 00:00:02.000
<v Olesya Kots>Pryvit.</v>
`;
        expect(detectVttDialect(input)).toBe("speaker");
    });

    it('returns "plain" for a transcript without voice tags', () => {
        const input = `WEBVTT

1
00:00:01.000 --> 00:00:02.000
Alice: Hello there
`;
        expect(detectVttDialect(input)).toBe("plain");
    });
});

describe('convertTeamsVttToMarkdown', () => {
    // The obsidian mock formats any value other than 1700000000000 as an ISO string.
    const base = 1700000000000;
    const at = (offsetMs: number) => new Date(base + offsetMs).toISOString();
    const fmt = "YYYY-MM-DD HH:mm:ss";

    it('renders alternating speakers as speaker/text line pairs', () => {
        const input = `WEBVTT

guid/1-0
00:00:01.000 --> 00:00:03.000
<v Kate Kan>Hey!</v>

guid/2-0
00:00:04.000 --> 00:00:06.000
<v Antonio Lano>Yeah, yeah, I was mute.</v>
`;
        expect(convertTeamsVttToMarkdown(input, fmt, base)).toBe(
            `[Kate Kan] ${at(1000)}\nHey!\n` +
            `[Antonio Lano] ${at(4000)}\nYeah, yeah, I was mute.`
        );
    });

    it('merges consecutive cues from one speaker, stamped at the first cue', () => {
        const input = `WEBVTT

guid/154-0
00:00:10.000 --> 00:00:12.000
<v Antonio Lano>One,</v>

guid/154-1
00:00:12.000 --> 00:00:14.000
<v Antonio Lano>two,</v>

guid/154-2
00:00:14.000 --> 00:00:16.000
<v Antonio Lano>three,</v>

guid/154-3
00:00:16.000 --> 00:00:18.000
<v Antonio Lano>four,</v>

guid/154-4
00:00:18.000 --> 00:00:20.000
<v Antonio Lano>five.</v>
`;
        expect(convertTeamsVttToMarkdown(input, fmt, base)).toBe(
            `[Antonio Lano] ${at(10000)}\nOne, two, three, four, five.`
        );
    });

    it('starts a new turn when the same speaker resumes after an interjection', () => {
        const input = `WEBVTT

00:00:01.000 --> 00:00:02.000
<v Antonio Lano>Before.</v>

00:00:02.000 --> 00:00:03.000
<v Kate Kan>Wait.</v>

00:00:03.000 --> 00:00:04.000
<v Antonio Lano>After.</v>
`;
        expect(convertTeamsVttToMarkdown(input, fmt, base)).toBe(
            `[Antonio Lano] ${at(1000)}\nBefore.\n` +
            `[Kate Kan] ${at(2000)}\nWait.\n` +
            `[Antonio Lano] ${at(3000)}\nAfter.`
        );
    });

    it('always stamps YYYY-MM-DD HH:mm:ss, whatever timeFormat says', () => {
        const input = `WEBVTT

00:00:00.000 --> 00:00:02.000
<v Olya Bezmeta>Pryvit.</v>
`;
        // The obsidian mock only returns "2023-11-14 12:00:00" when the converter
        // asks for "YYYY-MM-DD HH:mm:ss", so this pins the format the converter uses.
        expect(convertTeamsVttToMarkdown(input, "HH:mm:ss DD:MM:YYYY", base))
            .toBe('[Olya Bezmeta] 2023-11-14 12:00:00\nPryvit.');
        expect(convertTeamsVttToMarkdown(input, "", base))
            .toBe('[Olya Bezmeta] 2023-11-14 12:00:00\nPryvit.');
    });

    it('emits text alone for a cue that names no speaker', () => {
        const input = `WEBVTT

00:00:01.000 --> 00:00:02.000
Announcement without a speaker

00:00:02.000 --> 00:00:03.000
<v Olya Bezmeta>Pryvit.</v>
`;
        expect(convertTeamsVttToMarkdown(input, fmt, base)).toBe(
            `Announcement without a speaker\n[Olya Bezmeta] ${at(2000)}\nPryvit.`
        );
    });
});

describe('extractParticipants – voice-tagged vtt', () => {
    it('lists each distinct voice-tag speaker once, sorted', () => {
        const input = `WEBVTT

guid/10-0
00:00:12.010 --> 00:00:12.690
<v Ira Petrovna>Pryvit.</v>

guid/14-0
00:00:12.440 --> 00:00:14.080
<v Olya Bezmeta>Pryvit, pryvit.</v>

guid/20-0
00:00:17.370 --> 00:00:18.610
<v Ira Petrovna>Sohodni.</v>
`;
        expect(extractParticipants(input, "vtt")).toEqual(["Ira Petrovna", "Olya Bezmeta"]);
    });

    it('does not read a colon inside cue text as a speaker', () => {
        const input = `WEBVTT

00:00:01.000 --> 00:00:02.000
<v Olya Bezmeta>Note to self: check the dashboard</v>
`;
        expect(extractParticipants(input, "vtt")).toEqual(["Olya Bezmeta"]);
    });
});
