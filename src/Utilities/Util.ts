/* eslint-disable no-multi-assign */
import fs from "node:fs";

/* eslint-disable @typescript-eslint/no-extraneous-class */
export class Util {
    public static formatDate(dateFormat: Intl.DateTimeFormat, date: Date | number = new Date()): string {
        const data = dateFormat.formatToParts(date);
        return "<year>-<month>-<day>"
            .replace(/<year>/g, data.find(d => d.type === "year")!.value)
            .replace(/<month>/g, data.find(d => d.type === "month")!.value)
            .replace(/<day>/g, data.find(d => d.type === "day")!.value);
    }

    public static loadJSON<T>(path: string): T {
        return JSON.parse(fs.readFileSync(new URL(path, import.meta.url)) as unknown as string) as T;
    }

    public static optionalEnv<T>(key: string, defaultValue: unknown): T {
        const value = process.env[key] ??= defaultValue as string;
        try {
            return JSON.parse(value) as T;
        } catch {
            return value as unknown as T;
        }
    }
}
