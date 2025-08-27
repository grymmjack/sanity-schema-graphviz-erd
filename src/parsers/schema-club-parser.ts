// parsers/schema-club-parser.ts - Parser for schema.club format

import { BaseSchemaParser } from "./base-parser.ts";
import { SchemaType, ParsedSchema } from "../types.ts";

export class SchemaClubParser extends BaseSchemaParser {
  parse(): ParsedSchema {
    const content = this.loadFileContent();
    const rawSchema = this.parseJsonOrJs(content);

    // Validate that it's an array of schema types
    if (!Array.isArray(rawSchema)) {
      throw new Error("Schema.club format expects an array of schema types");
    }

    // The current schema appears to follow the Sanity schema structure
    // so we can use it as-is
    const types: SchemaType[] = rawSchema;

    return this.createParsedSchema(types, (type) => type.type === "document");
  }
}
