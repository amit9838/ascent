// Minimal typings for papaparse (only what this app uses).
declare module "papaparse" {
  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row?: number;
  }
  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: Record<string, unknown>;
  }
  export interface ParseConfig {
    header?: boolean;
    skipEmptyLines?: boolean | "greedy";
  }
  export function parse<T = Record<string, string>>(
    csv: string,
    config?: ParseConfig
  ): ParseResult<T>;
  const Papa: { parse: typeof parse };
  export default Papa;
}
