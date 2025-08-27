// parsers/index.ts - Parser factory

import { BaseSchemaParser } from "./base-parser.ts";
import { SchemaClubParser } from "./schema-club-parser.ts";
import { SanityParser } from "./sanity-parser.ts";
import { InputFormat } from "../types.ts";

export function createParser(
  format: InputFormat,
  schemaPath: string
): BaseSchemaParser {
  switch (format) {
    case "schema.club":
      return new SchemaClubParser(schemaPath);
    case "sanity":
      return new SanityParser(schemaPath);
    default:
      throw new Error(
        `Unsupported input format: ${format}. Supported formats are: schema.club, sanity`
      );
  }
}

export * from "./base-parser.ts";
export * from "./schema-club-parser.ts";
export * from "./sanity-parser.ts";
