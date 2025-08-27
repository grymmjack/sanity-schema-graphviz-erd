// types.ts - Common type definitions for schema formats

export interface SchemaField {
  type: string;
  name?: string;
  title?: string;
  fields?: SchemaField[];
  of?: SchemaField[];
  to?: { type: string }[];
}

export interface SchemaType {
  name: string;
  type: string;
  title?: string;
  fields?: SchemaField[];
  of?: SchemaField[];
}

export interface ParsedSchema {
  types: SchemaType[];
  documentTypes: Set<string>;
  allTypeNames: Set<string>;
}

export type InputFormat = "schema.club" | "sanity";

export interface ConverterOptions {
  inputFormat: InputFormat;
  schemaPath: string;
  outputPath: string;
}
