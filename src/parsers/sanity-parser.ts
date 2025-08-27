// parsers/sanity-parser.ts - Parser for Sanity schema format (placeholder for future implementation)

import { BaseSchemaParser } from "./base-parser.ts";
import { SchemaType, ParsedSchema } from "../types.ts";

export class SanityParser extends BaseSchemaParser {
  parse(): ParsedSchema {
    // TODO: Implement Sanity schema parsing
    // This will be different from schema.club format
    throw new Error("Sanity format parser not yet implemented. Coming soon!");
  }
}
