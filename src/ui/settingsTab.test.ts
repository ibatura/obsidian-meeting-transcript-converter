import { describe, it, expect, vi, beforeEach } from 'vitest';

// Records every Setting the tab builds, so tests can look one up by its label
// and drive the control's onChange the way a user would.
const { built } = vi.hoisted(() => ({ built: [] as any[] }));

vi.mock('obsidian', () => {
    class Control {
        options: Record<string, string> = {};
        value = '';
        placeholder = '';
        changed: ((v: any) => unknown) | null = null;
        addOption(key: string, label: string) { this.options[key] = label; return this; }
        setPlaceholder(p: string) { this.placeholder = p; return this; }
        setValue(v: any) { this.value = v; return this; }
        onChange(fn: (v: any) => unknown) { this.changed = fn; return this; }
    }
    class Setting {
        name = '';
        desc = '';
        control = new Control();
        constructor(_containerEl: unknown) { built.push(this); }
        setName(n: string) { this.name = n; return this; }
        setDesc(d: string) { this.desc = d; return this; }
        private add(cb: (c: Control) => unknown) { cb(this.control); return this; }
        addText(cb: (c: Control) => unknown) { return this.add(cb); }
        addToggle(cb: (c: Control) => unknown) { return this.add(cb); }
        addDropdown(cb: (c: Control) => unknown) { return this.add(cb); }
    }
    return { Setting, PluginSettingTab: class { }, App: class { } };
});

import { TranscriptSettingTab } from './settingsTab';

describe('TranscriptSettingTab note name settings', () => {
    let plugin: any;
    let tab: any;

    const settingNamed = (name: string) => built.find((s) => s.name === name);

    beforeEach(() => {
        built.length = 0;
        plugin = {
            settings: {
                outputFolder: 'Transcripts',
                watchFolder: 'Transcripts',
                autoConvertEnabled: false,
                deleteOriginalAfterConvert: false,
                timeFormat: 'YYYY-MM-DD HH:mm:ss',
                fileNameOrder: 'date-first',
                fileNameDateFormat: 'YYYY-MM-DD'
            },
            saveSettings: vi.fn()
        };
        tab = new TranscriptSettingTab({} as any, plugin);
        tab.containerEl = { empty: vi.fn() };
        tab.display();
    });

    it('offers both note name orders and shows the saved one', () => {
        const control = settingNamed('Note name order').control;
        expect(control.options).toEqual({
            'date-first': 'Date, then meeting name',
            'name-first': 'Meeting name, then date'
        });
        expect(control.value).toBe('date-first');
    });

    it('saves a changed note name order', async () => {
        await settingNamed('Note name order').control.changed('name-first');
        expect(plugin.settings.fileNameOrder).toBe('name-first');
        expect(plugin.saveSettings).toHaveBeenCalled();
    });

    it('saves a changed note name date format', async () => {
        const control = settingNamed('Note name date format').control;
        expect(control.value).toBe('YYYY-MM-DD');
        await control.changed('DD.MM.YYYY');
        expect(plugin.settings.fileNameDateFormat).toBe('DD.MM.YYYY');
        expect(plugin.saveSettings).toHaveBeenCalled();
    });
});
