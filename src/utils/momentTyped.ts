import { moment } from "obsidian";

/** Minimal surface of a moment instance used by this plugin. */
export interface MomentLike {
	format(fmt: string): string;
	isValid(): boolean;
	valueOf(): number;
}

export type MomentInput =
	| number
	| { year: number; month: number; day: number; hour: number; minute: number; second: number };

// Obsidian re-exports moment, but its types come from the `moment` package,
// which external lint environments (e.g. the Obsidian plugin validator) may
// not resolve — making every direct call site "unsafe". Assert the narrow
// shape once here so downstream code stays typed.
export const typedMoment = moment as unknown as (input?: MomentInput) => MomentLike;
