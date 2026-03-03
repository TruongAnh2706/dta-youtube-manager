import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables. Please check .env.local");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Helpers: Chuyển đổi qua lại giữa Snake_case (PostgreSQL Database) và camelCase (React TypeScript)
export function toCamelCase(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj;

    if (Array.isArray(obj)) {
        return obj.map(v => toCamelCase(v));
    } else if (typeof obj === 'object') {
        const result: Record<string, any> = {};
        for (const key of Object.keys(obj)) {
            const camelKey = key.replace(/_([a-z])/g, (m, letter) => letter.toUpperCase());
            result[camelKey] = toCamelCase(obj[key]);
        }
        return result;
    }
    return obj;
}

export function toSnakeCase(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj;

    if (Array.isArray(obj)) {
        return obj.map(v => toSnakeCase(v));
    } else if (typeof obj === 'object') {
        const result: Record<string, any> = {};
        for (const key of Object.keys(obj)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            result[snakeKey] = toSnakeCase(obj[key]);
        }
        return result;
    }
    return obj;
}
