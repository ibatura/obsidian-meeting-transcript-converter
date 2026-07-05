import { moment } from "obsidian";

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
    const datePrefix: string = moment(fileCreationTime).format("YYYY-MM-DD");

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

export function convertVttToMarkdown(content: string, timeFormat: string, fileCreationTime: number): string {
    const lines = content.split(/\r?\n/);

    const blocks: { timeOffset?: number; text: string[] }[] = [];
    let current: { timeOffset?: number; text: string[] } | null = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (/^WEBVTT/i.test(trimmed)) continue;
        if (/^\d+$/.test(trimmed)) continue; // ignore sequence numbers
        
        // Match timestamp line: "00:01:23.456 --> 00:01:25.000" or "01:23.456 --> 01:25.000"
        const timeMatch = trimmed.match(/^(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s-->/);
        if (timeMatch && timeMatch[1]) {
            if (current && current.text.length > 0) blocks.push(current);
            const offsetMs = parseVttTimeOffset(timeMatch[1]);
            current = { timeOffset: offsetMs, text: [] };
            continue;
        }

        if (!current) {
            current = { text: [] };
        }

        current.text.push(trimmed);
    }

    if (current && current.text.length > 0) blocks.push(current);

    const mdLines: string[] = [];
    for (const block of blocks) {
        if (block.text.length === 0) continue;
        const text = block.text.join(" ");
        if (block.timeOffset !== undefined && timeFormat) {
            const blockTime: string = moment(fileCreationTime + block.timeOffset).format(timeFormat);
            mdLines.push(`- **[${blockTime}]** ${text}`);
        } else {
            mdLines.push(`- ${text}`);
        }
    }

    return mdLines.join("\n");
}
