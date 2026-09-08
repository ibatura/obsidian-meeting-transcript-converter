import { typedMoment } from "./momentTyped";

export function extractParticipants(content: string, format: "vtt" | "txt"): string[] {
    const speakers = new Set<string>();
    const lines = content.split(/\r?\n/);

    if (format === "txt") {
        for (const line of lines) {
            const match = line.trim().match(/^\[(.+?)\]\s+\d{2}:\d{2}:\d{2}/);
            if (match && match[1]) {
                speakers.add(match[1].trim());
            }
        }
    } else {
        // Speaker-attributed transcripts (Microsoft Teams) name their speakers in
        // voice tags; trust those and skip the "Name: " heuristic, which would
        // otherwise read ordinary sentences containing a colon as speakers.
        const voiced = parseVttCues(content)
            .map((cue) => cue.speaker)
            .filter((name): name is string => Boolean(name));
        if (voiced.length > 0) {
            return Array.from(new Set(voiced)).sort();
        }

        const ignore = /^(http|https|note|todo)/i;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (/^WEBVTT/i.test(trimmed)) continue;
            if (/^\d+$/.test(trimmed)) continue;
            if (/-->/.test(trimmed)) continue;

            const match = trimmed.match(/^(.+?):\s/);
            if (match && match[1]) {
                const name = match[1].trim();
                if (name.length <= 40 && !ignore.test(name)) {
                    speakers.add(name);
                }
            }
        }
    }

    return Array.from(speakers).sort();
}

export function extractDuration(content: string, format: "vtt" | "txt"): string | null {
    const lines = content.split(/\r?\n/);

    if (format === "txt") {
        const times: number[] = [];
        for (const line of lines) {
            const match = line.trim().match(/^\[.+?\]\s+(\d{2}):(\d{2}):(\d{2})/);
            if (match && match[1] && match[2] && match[3]) {
                const secs = parseInt(match[1], 10) * 3600
                           + parseInt(match[2], 10) * 60
                           + parseInt(match[3], 10);
                times.push(secs);
            }
        }
        if (times.length < 2) return null;

        const first = times[0] as number;
        const last  = times[times.length - 1] as number;
        let diff = last - first;
        if (diff < 0) diff += 24 * 3600;

        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    let maxMs = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        const timeMatch = trimmed.match(
            /-->\s*(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/
        );
        if (timeMatch && timeMatch[1]) {
            const ms = parseVttTimeOffset(timeMatch[1]);
            if (ms > maxMs) maxMs = ms;
        }
    }

    if (maxMs === 0) return null;

    const totalSeconds = Math.floor(maxMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Note: _timeFormat is accepted to match the VTT converter signature but not used —
// TXT timestamps are wall-clock times, so only the date (from fileCreationTime) is prepended.
export function convertTxtToMarkdown(content: string, _timeFormat: string, fileCreationTime: number): string {
    const lines = content.split(/\r?\n/);
    const mdLines: string[] = [];
    const datePrefix: string = typedMoment(fileCreationTime).format("YYYY-MM-DD");

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "") continue;

        const headerMatch = trimmed.match(/^\[(.+?)\]\s+(\d{2}:\d{2}:\d{2})/);
        if (headerMatch) {
            const speaker = headerMatch[1];
            const time = headerMatch[2];
            mdLines.push(`[${speaker}] ${datePrefix} ${time}`);
        } else {
            mdLines.push(trimmed);
        }
    }

    return mdLines.join("\n");
}

export function parseVttTimeOffset(vttTime: string): number {
    const parts = vttTime.split(":");
    let seconds = 0;
    
    if (parts.length === 3) {
        seconds += parseInt(parts[0] || "0", 10) * 3600;
        seconds += parseInt(parts[1] || "0", 10) * 60;
        seconds += parseFloat(parts[2] || "0");
    } else if (parts.length === 2) {
        seconds += parseInt(parts[0] || "0", 10) * 60;
        seconds += parseFloat(parts[1] || "0");
    } else if (parts.length === 1 && parts[0] !== "") {
        seconds += parseFloat(parts[0] || "0");
    }
    
    return seconds * 1000;
}

/** A single parsed VTT cue: its start offset, the speaker naming it (if any), and its plain text. */
export interface VttCue {
    offsetMs?: number;
    speaker?: string;
    text: string;
}

const VTT_TIMESTAMP_LINE = /^(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->/;
const VTT_VOICE_TAG = /^<v(?:\.[^\s>]+)*(?:\s+([^>]*))?>/i;

/** Removes voice tags, cue spans and karaoke timestamps, leaving readable text. */
function stripVttMarkup(text: string): string {
    return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * A line is a cue identifier when it opens a cue block and the next non-empty
 * line is a timestamp. This covers plain sequence numbers as well as the
 * `{guid}/{n}-{n}` identifiers Microsoft Teams emits.
 */
function isCueIdentifierLine(lines: string[], index: number): boolean {
    for (let i = index + 1; i < lines.length; i++) {
        const next = (lines[i] ?? "").trim();
        if (!next) continue;
        return VTT_TIMESTAMP_LINE.test(next);
    }
    return false;
}

/**
 * Parses WebVTT content into cues, discarding the header, NOTE blocks and cue
 * identifiers. Multi-line cue text is joined with spaces; a leading `<v Name>`
 * voice tag becomes the cue's speaker.
 */
export function parseVttCues(content: string): VttCue[] {
    const lines = content.split(/\r?\n/);
    const cues: VttCue[] = [];
    let current: { offsetMs?: number; text: string[] } | null = null;
    let inNote = false;

    const flush = () => {
        if (!current) return;
        const raw = current.text.join(" ").trim();
        const text = stripVttMarkup(raw);
        if (text) {
            const cue: VttCue = { text };
            if (current.offsetMs !== undefined) cue.offsetMs = current.offsetMs;
            const speaker = raw.match(VTT_VOICE_TAG)?.[1]?.trim();
            if (speaker) cue.speaker = speaker;
            cues.push(cue);
        }
        current = null;
    };

    for (let i = 0; i < lines.length; i++) {
        const trimmed = (lines[i] ?? "").trim();

        if (!trimmed) {
            inNote = false;
            flush();
            continue;
        }
        if (inNote) continue;
        if (/^WEBVTT/i.test(trimmed)) continue;
        if (/^NOTE(\s|$)/.test(trimmed)) {
            inNote = true;
            continue;
        }

        const timeMatch = trimmed.match(VTT_TIMESTAMP_LINE);
        if (timeMatch && timeMatch[1]) {
            flush();
            current = { offsetMs: parseVttTimeOffset(timeMatch[1]), text: [] };
            continue;
        }

        if (!current) {
            if (isCueIdentifierLine(lines, i)) continue;
            current = { text: [] };
        }

        current.text.push(trimmed);
    }

    flush();

    return cues;
}

/**
 * Reports whether a VTT transcript names its speakers ("speaker", e.g. Microsoft
 * Teams) or carries plain captions ("plain", e.g. Zoom and most caption tools).
 */
export function detectVttDialect(content: string): "speaker" | "plain" {
    return parseVttCues(content).some((cue) => cue.speaker) ? "speaker" : "plain";
}

export function convertVttToMarkdown(content: string, timeFormat: string, fileCreationTime: number): string {
    const mdLines: string[] = [];

    for (const cue of parseVttCues(content)) {
        if (cue.offsetMs !== undefined && timeFormat) {
            const blockTime: string = typedMoment(fileCreationTime + cue.offsetMs).format(timeFormat);
            mdLines.push(`- **[${blockTime}]** ${cue.text}`);
        } else {
            mdLines.push(`- ${cue.text}`);
        }
    }

    return mdLines.join("\n");
}

/** Speaker lines always carry a full date and time, matching convertTxtToMarkdown. */
const SPEAKER_LINE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

/**
 * Converts a speaker-attributed VTT transcript (Microsoft Teams) into the same
 * layout the plugin produces for Zoom TXT transcripts: a `[Speaker] {time}` line
 * followed by the spoken text. Consecutive cues from one speaker form one turn,
 * stamped at the moment that turn began.
 *
 * Note: _timeFormat is accepted to match the VTT converter signature but not used.
 * Like convertTxtToMarkdown, this layout always stamps `YYYY-MM-DD HH:mm:ss`, so
 * Teams and Zoom notes read identically whatever the time-format setting holds.
 */
export function convertTeamsVttToMarkdown(content: string, _timeFormat: string, fileCreationTime: number): string {
    const turns: { offsetMs?: number; speaker?: string; text: string[] }[] = [];

    for (const cue of parseVttCues(content)) {
        const last = turns[turns.length - 1];
        if (last && cue.speaker && last.speaker === cue.speaker) {
            last.text.push(cue.text);
            continue;
        }
        const turn: { offsetMs?: number; speaker?: string; text: string[] } = { text: [cue.text] };
        if (cue.offsetMs !== undefined) turn.offsetMs = cue.offsetMs;
        if (cue.speaker) turn.speaker = cue.speaker;
        turns.push(turn);
    }

    const mdLines: string[] = [];
    for (const turn of turns) {
        if (turn.speaker) {
            if (turn.offsetMs !== undefined) {
                const turnTime: string = typedMoment(fileCreationTime + turn.offsetMs).format(SPEAKER_LINE_TIME_FORMAT);
                mdLines.push(`[${turn.speaker}] ${turnTime}`);
            } else {
                mdLines.push(`[${turn.speaker}]`);
            }
        }
        mdLines.push(turn.text.join(" "));
    }

    return mdLines.join("\n");
}
