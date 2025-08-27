// parsers/base-parser.ts - Base class for schema parsers

import * as fs from "fs";
import { SchemaType, SchemaField, ParsedSchema } from "../types.ts";

export abstract class BaseSchemaParser {
  protected schemaPath: string;

  constructor(schemaPath: string) {
    this.schemaPath = schemaPath;
  }

  abstract parse(): ParsedSchema;

  protected loadFileContent(): string {
    if (!fs.existsSync(this.schemaPath)) {
      throw new Error(`Schema file not found at ${this.schemaPath}`);
    }
    return fs.readFileSync(this.schemaPath, "utf-8");
  }

  protected parseJsonOrJs(content: string): any {
    let parsed;
    try {
      // First try parsing as JSON
      parsed = JSON.parse(content);
    } catch (jsonError) {
      try {
        // If that fails, try evaluating as JavaScript (with some safety checks)
        if (content.trim().startsWith("[") && content.trim().endsWith("]")) {
          parsed = eval(`(${content})`);
        } else {
          throw new Error("Schema file format not recognized");
        }
      } catch (evalError) {
        const errorMsg =
          jsonError instanceof Error
            ? jsonError.message
            : "Unknown JSON parse error";
        throw new Error(`Failed to parse schema file: ${errorMsg}`);
      }
    }
    return parsed;
  }

  protected createParsedSchema(
    types: SchemaType[],
    documentTypeFilter: (type: SchemaType) => boolean = (t) =>
      t.type === "document"
  ): ParsedSchema {
    const documentTypes = new Set(
      types.filter(documentTypeFilter).map((t) => t.name)
    );

    const allTypeNames = new Set(types.map((t) => t.name));

    return {
      types,
      documentTypes,
      allTypeNames,
    };
  }
}
