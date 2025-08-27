// generate-schema-graph.ts

import * as fs from "fs";
import * as path from "path";
import minimist from "minimist";
import { Digraph, toDot, attribute as _ } from "ts-graphviz";
import { CONFIG } from "./config.js";

// --- Type Definitions ---

interface SchemaField {
  type: string;
  name?: string;
  title?: string;
  fields?: SchemaField[];
  of?: SchemaField[];
  to?: { type: string }[];
}

interface SchemaType {
  name: string;
  type: string;
  title?: string;
  fields?: SchemaField[];
  of?: SchemaField[];
}

interface ParsedSchema {
  types: SchemaType[];
  documentTypes: Set<string>;
  allTypeNames: Set<string>;
}

type InputFormat = "schema.club" | "sanity";

interface ConverterOptions {
  inputFormat: InputFormat;
  schemaPath: string;
  outputPath: string;
  isTestMode: boolean;
}

// --- Base Parser Classes ---

abstract class BaseSchemaParser {
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

// --- Schema.club Parser ---

class SchemaClubParser extends BaseSchemaParser {
  parse(): ParsedSchema {
    const content = this.loadFileContent();
    const rawSchema = this.parseJsonOrJs(content);

    // Validate that it's an array of schema types
    if (!Array.isArray(rawSchema)) {
      throw new Error("Schema.club format expects an array of schema types");
    }

    // Transform schema.club format to our internal format
    const types: SchemaType[] = rawSchema
      .filter((item) => item.name && item.type)
      .map((item) => this.transformSchemaClubType(item));

    return this.createParsedSchema(types, (type) => type.type === "document");
  }

  private transformSchemaClubType(schemaClubType: any): SchemaType {
    const transformed: SchemaType = {
      name: schemaClubType.name,
      type: schemaClubType.type,
      title: schemaClubType.title,
    };

    // Transform fields if they exist
    if (schemaClubType.fields && Array.isArray(schemaClubType.fields)) {
      transformed.fields = schemaClubType.fields
        .map((field: any) => this.transformSchemaClubField(field))
        .filter(Boolean);
    }

    return transformed;
  }

  private transformSchemaClubField(field: any): SchemaField | null {
    if (!field || !field.name || !field.type) {
      return null;
    }

    const transformedField: SchemaField = {
      name: field.name,
      type: field.type,
      title: field.title,
    };

    // Handle references - infer target from field name
    if (field.type === "reference") {
      // Try to infer reference target from field name
      const possibleTarget = this.inferReferenceTarget(field.name, field.title);
      if (possibleTarget) {
        transformedField.to = [{ type: possibleTarget }];
      }
    }

    // Handle arrays
    if (field.type === "array" && field.of) {
      transformedField.of = field.of
        .map((item: any) => this.transformSchemaClubField(item))
        .filter(Boolean);
    }

    // Handle nested fields for objects
    if (field.fields && Array.isArray(field.fields)) {
      transformedField.fields = field.fields
        .map((subField: any) => this.transformSchemaClubField(subField))
        .filter(Boolean);
    }

    return transformedField;
  }

  private inferReferenceTarget(
    fieldName: string,
    fieldTitle?: string
  ): string | null {
    // Common patterns for reference field names
    const patterns = [
      // Remove common suffixes
      fieldName.replace(/ref$|id$|_ref$|_id$/i, ""),
      // Use title if available
      fieldTitle ? fieldTitle.toLowerCase().replace(/\s+/g, "") : null,
      // Use field name as-is
      fieldName,
      // Plural to singular
      fieldName.endsWith("s") ? fieldName.slice(0, -1) : null,
    ].filter(Boolean) as string[];

    // Return the first non-empty pattern
    return patterns.find((pattern) => pattern && pattern.length > 0) || null;
  }
}

// --- Sanity Parser ---

class SanityParser extends BaseSchemaParser {
  parse(): ParsedSchema {
    const content = this.loadFileContent();
    const rawSchema = this.parseJsonOrJs(content);

    // Validate that it's an array of schema types
    if (!Array.isArray(rawSchema)) {
      throw new Error("Sanity format expects an array of schema types");
    }

    // Check if this is the complex Sanity format or simple format
    const sampleItem = rawSchema[0];
    const isComplexFormat =
      sampleItem && sampleItem.attributes && !sampleItem.fields;

    if (isComplexFormat) {
      // Complex Sanity format with nested attributes
      const types: SchemaType[] = rawSchema
        .filter((item) => item.name && item.type)
        .map((item) => this.transformSanityType(item));

      return this.createParsedSchema(types, (type) => type.type === "document");
    } else {
      // Simple format (same as schema.club) - delegate to schema.club logic
      const types: SchemaType[] = rawSchema
        .filter((item) => item.name && item.type)
        .map((item) => this.transformSimpleType(item));

      return this.createParsedSchema(types, (type) => type.type === "document");
    }
  }

  // Handle simple schema.club-style format
  private transformSimpleType(simpleType: any): SchemaType {
    const transformed: SchemaType = {
      name: simpleType.name,
      type: simpleType.type,
      title: simpleType.title,
    };

    // Transform fields if they exist
    if (simpleType.fields && Array.isArray(simpleType.fields)) {
      transformed.fields = simpleType.fields
        .map((field: any) => this.transformSimpleField(field))
        .filter(Boolean);
    }

    return transformed;
  }

  private transformSimpleField(field: any): SchemaField | null {
    if (!field || !field.name || !field.type) {
      return null;
    }

    const transformedField: SchemaField = {
      name: field.name,
      type: field.type,
      title: field.title,
    };

    // Handle explicit references with 'to' property
    if (field.type === "reference" && field.to && Array.isArray(field.to)) {
      transformedField.to = field.to;
    } else if (field.type === "reference") {
      // Handle references without explicit 'to' - infer from name
      const possibleTarget = this.inferReferenceTarget(field.name, field.title);
      if (possibleTarget) {
        transformedField.to = [{ type: possibleTarget }];
      }
    }

    // Handle arrays
    if (field.type === "array" && field.of) {
      transformedField.of = field.of
        .map((item: any) => this.transformSimpleField(item))
        .filter(Boolean);
    }

    // Handle nested fields for objects
    if (field.fields && Array.isArray(field.fields)) {
      transformedField.fields = field.fields
        .map((subField: any) => this.transformSimpleField(subField))
        .filter(Boolean);
    }

    return transformedField;
  }

  private inferReferenceTarget(
    fieldName: string,
    fieldTitle?: string
  ): string | null {
    // Common patterns for reference field names
    const patterns = [
      // Remove common suffixes
      fieldName.replace(/ref$|id$|_ref$|_id$/i, ""),
      // Use title if available
      fieldTitle ? fieldTitle.toLowerCase().replace(/\s+/g, "") : null,
      // Use field name as-is
      fieldName,
      // Plural to singular
      fieldName.endsWith("s") ? fieldName.slice(0, -1) : null,
    ].filter(Boolean) as string[];

    // Return the first non-empty pattern
    return patterns.find((pattern) => pattern && pattern.length > 0) || null;
  }

  private transformSanityType(sanityType: any): SchemaType {
    // Determine the actual type from Sanity's nested structure
    let actualType = "object"; // default
    if (sanityType.type) {
      if (typeof sanityType.type === "string") {
        actualType = sanityType.type;
      } else if (
        sanityType.type.value &&
        typeof sanityType.type.value === "string"
      ) {
        actualType = sanityType.type.value;
      }
    }

    // For Sanity "type" definitions, look deeper into the value structure
    if (actualType === "type" && sanityType.value && sanityType.value.type) {
      actualType = sanityType.value.type;
    }

    const transformed: SchemaType = {
      name: sanityType.name,
      type: actualType,
      title: sanityType.title,
    };

    // Transform attributes to fields - look in the right place for attributes
    const attributesSource =
      sanityType.attributes ||
      (sanityType.value && sanityType.value.attributes);
    if (attributesSource) {
      transformed.fields = [];

      for (const [fieldName, fieldDef] of Object.entries(attributesSource)) {
        // Skip internal Sanity fields that start with _
        if (fieldName.startsWith("_")) {
          continue;
        }

        const field = this.transformSanityField(fieldName, fieldDef as any);
        if (field) {
          transformed.fields.push(field);
        }
      }
    }

    return transformed;
  }

  private transformSanityField(
    fieldName: string,
    fieldDef: any
  ): SchemaField | null {
    if (!fieldDef || !fieldDef.value) {
      return null;
    }

    const field: SchemaField = {
      name: fieldName,
      type: this.getFieldType(fieldDef.value),
    };

    // Handle references - check both top level and nested in value
    if (fieldDef.dereferencesTo || fieldDef.value.dereferencesTo) {
      field.type = "reference";
      const targetType =
        fieldDef.dereferencesTo || fieldDef.value.dereferencesTo;
      field.to = [{ type: targetType }];
    }

    // Check for deeply nested references in the entire field definition
    const allRefs = this.extractAllReferencesRecursive([fieldDef]);
    if (allRefs.length > 0 && !field.to) {
      field.type = "reference";
      field.to = allRefs.map((ref) => ({ type: ref }));
    }

    // Handle arrays
    if (fieldDef.value.type === "array" && fieldDef.value.of) {
      field.type = "array";
      field.of = this.transformArrayItems(fieldDef.value.of);
    }

    // Handle objects - check if it's a reference object first
    if (fieldDef.value.type === "object") {
      if (fieldDef.value.dereferencesTo) {
        // This is actually a reference disguised as an object
        field.type = "reference";
        field.to = [{ type: fieldDef.value.dereferencesTo }];
      } else if (fieldDef.value.attributes) {
        // This is a regular object with nested fields
        field.type = "object";
        field.fields = [];

        for (const [subFieldName, subFieldDef] of Object.entries(
          fieldDef.value.attributes
        )) {
          if (!subFieldName.startsWith("_")) {
            const subField = this.transformSanityField(
              subFieldName,
              subFieldDef as any
            );
            if (subField) {
              field.fields.push(subField);
            }
          }
        }
      }
    }

    // Debug: log references found for this field
    // if (field.to && field.to.length > 0) {
    //   console.log(`DEBUG: Field '${fieldName}' references:`, field.to.map(t => t.type));
    // }

    return field;
  }

  private transformArrayItems(arrayOf: any): SchemaField[] {
    // Handle case where 'of' is a single object (Sanity format)
    if (!Array.isArray(arrayOf)) {
      arrayOf = [arrayOf];
    }

    return arrayOf
      .map((item: any, index: number) => {
        // Direct reference case
        if (item.dereferencesTo) {
          return {
            type: "reference",
            to: [{ type: item.dereferencesTo }],
          };
        }

        // Union type case - check all union options
        if (item.type === "union" && item.of && Array.isArray(item.of)) {
          const references = this.extractAllReferencesRecursive(item.of);
          if (references.length > 0) {
            return {
              type: "reference",
              to: references.map((ref) => ({ type: ref })),
            };
          }
        }

        // Object with nested references
        if (item.type === "object") {
          const nestedRefs = this.extractAllReferencesRecursive([item]);
          if (nestedRefs.length > 0) {
            return {
              type: "reference",
              to: nestedRefs.map((ref) => ({ type: ref })),
            };
          }
        }

        if (item.type) {
          return {
            type: item.type,
          };
        }

        if (item.value) {
          return {
            type: this.getFieldType(item.value),
          };
        }

        return null;
      })
      .filter(Boolean) as SchemaField[];
  }

  private extractAllReferencesRecursive(nodes: any[]): string[] {
    const references: string[] = [];

    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;

      // Direct reference
      if (node.dereferencesTo) {
        references.push(node.dereferencesTo);
      }

      // Inline type reference
      if (node.type === "inline" && node.name) {
        references.push(node.name);
      }

      // Check nested value
      if (node.value) {
        references.push(...this.extractAllReferencesRecursive([node.value]));
      }

      // Check union 'of' arrays
      if (node.of && Array.isArray(node.of)) {
        references.push(...this.extractAllReferencesRecursive(node.of));
      }

      // Check object attributes
      if (node.attributes) {
        for (const [key, attr] of Object.entries(node.attributes)) {
          references.push(...this.extractAllReferencesRecursive([attr]));
        }
      }
    }

    return [...new Set(references)]; // Remove duplicates
  }

  private getFieldType(value: any): string {
    if (!value || !value.type) {
      return "unknown";
    }

    // Handle basic types
    if (typeof value.type === "string") {
      return value.type;
    }

    return "unknown";
  }
}

// --- Parser Factory ---

function createParser(
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

// --- Graph Converter ---

class GraphConverter {
  private schema: ParsedSchema;
  private graph!: Digraph; // Using definite assignment assertion since it's initialized in constructor
  private createdEdges: Set<string>; // Track created edges to avoid duplicates

  constructor(schema: ParsedSchema) {
    this.schema = schema;
    this.createdEdges = new Set();
    this.initializeGraph();
  }

  private initializeGraph(): void {
    // Initialize the directed graph with better layout settings for complex diagrams
    this.graph = new Digraph("SchemaGraph", {
      [_.rankdir]: "TB" as any,
      [_.splines]: "curved" as any,
      [_.nodesep]: 0.8,
      [_.ranksep]: 1.5,
      [_.fontname]: CONFIG.TYPOGRAPHY.FONTS.PRIMARY,
      [_.fontsize]: CONFIG.TYPOGRAPHY.SIZES.DEFAULT,
      [_.concentrate]: true, // Merge parallel edges
      [_.overlap]: "scale" as any,
      [_.pack]: true,
      [_.packmode]: "node" as any,
      [_.maxiter]: 500,
      [_.ordering]: "out" as any,
      [_.compound]: false,
      [_.bgcolor]: "white" as any,
      [_.pad]: 0.5, // Add padding around the graph
      [_.dpi]: 96, // Set DPI for better quality
    });

    // Set default styles for all nodes and edges.
    this.graph.node({
      [_.shape]: "plaintext" as any,
      [_.style]: "filled" as any,
      [_.fillcolor]: CONFIG.COLORS.OBJECT_NODE_BG,
      [_.color]: CONFIG.COLORS.OBJECT_NODE_BORDER,
      [_.fontname]: CONFIG.GRAPH_CONFIG.node.fontname,
      [_.fontsize]: 9, // Slightly smaller font for better fit
      [_.penwidth]: 1.2,
      [_.margin]: "0.1,0.05" as any,
    });
    this.graph.edge({
      [_.fontname]: CONFIG.GRAPH_CONFIG.edge.fontname,
      [_.fontsize]: 8, // Smaller edge labels
      [_.penwidth]: 1.2, // Thinner edges for less visual clutter
      [_.color]: "#66666680" as any, // Semi-transparent gray (80 = ~50% opacity)
      [_.arrowsize]: 0.7, // Smaller arrows
      [_.arrowhead]: "normal" as any,
      [_.len]: 2.0,
      [_.labeldistance]: 2.0, // Distance of edge labels from edges
      [_.labelangle]: 0, // Angle of edge labels
    });
  }

  public convert(): string {
    // Process each schema type to create nodes first
    this.schema.types.forEach((type: SchemaType) => {
      // Create nodes for documents and objects
      if (type.type === "document" || type.type === "object") {
        this.createNode(type);
      }
    });

    // Then create edges after all nodes exist
    this.schema.types.forEach((type: SchemaType) => {
      if (type.type === "document" || type.type === "object") {
        this.createEdges(type);
      }
    });

    // Serialize the graph object to a DOT string.
    return toDot(this.graph);
  }

  private addRankConstraints(): void {
    // Group document types at the top
    const documentTypeNames = Array.from(this.schema.documentTypes);
    if (documentTypeNames.length > 0) {
      const sourceSubgraph = this.graph.subgraph("", {
        [_.rank]: "source" as any,
      });
      documentTypeNames.forEach((name) => sourceSubgraph.node(name));
    }

    // Group core content types in the middle
    const coreTypes = ["product", "collection", "page", "home"];
    const existingCoreTypes = coreTypes.filter((name) =>
      this.schema.allTypeNames.has(name)
    );
    if (existingCoreTypes.length > 0) {
      const coreSubgraph = this.graph.subgraph("", {
        [_.rank]: "same" as any,
      });
      existingCoreTypes.forEach((name) => coreSubgraph.node(name));
    }

    // Group utility types towards the bottom
    const utilityTypes = ["slug", "color", "seo", "menu", "colorTheme"];
    const existingUtilityTypes = utilityTypes.filter((name) =>
      this.schema.allTypeNames.has(name)
    );
    if (existingUtilityTypes.length > 0) {
      const utilitySubgraph = this.graph.subgraph("", {
        [_.rank]: "sink" as any,
      });
      existingUtilityTypes.forEach((name) => utilitySubgraph.node(name));
    }
  }

  private createClusters(): void {
    // Create subgraphs for different type categories to improve layout
    const documentTypes = this.schema.types.filter(
      (type) => type.type === "document"
    );
    const coreTypes = this.schema.types.filter(
      (type) =>
        type.type === "object" &&
        [
          "product",
          "collection",
          "page",
          "home",
          "colorTheme",
          "seo",
          "menu",
        ].includes(type.name)
    );
    const contentTypes = this.schema.types.filter(
      (type) =>
        type.type === "object" &&
        ["blockModule", "blocks", "hero", "testimonial", "gridItem"].includes(
          type.name
        )
    );
    const utilityTypes = this.schema.types.filter(
      (type) =>
        type.type === "object" &&
        ["slug", "color", "priceRange", "inventory"].includes(type.name)
    );

    if (documentTypes.length > 0) {
      const docCluster = this.graph.subgraph(`cluster_documents`, {
        [_.label]: "Documents",
        [_.style]: "filled" as any,
        [_.fillcolor]: "#f0f9ff" as any,
        [_.pencolor]: "#0369a1" as any,
        [_.rank]: "same" as any,
      });
    }

    if (coreTypes.length > 0) {
      const coreCluster = this.graph.subgraph(`cluster_core`, {
        [_.label]: "Core Types",
        [_.style]: "filled" as any,
        [_.fillcolor]: "#f0fdf4" as any,
        [_.pencolor]: "#15803d" as any,
      });
    }

    if (contentTypes.length > 0) {
      const contentCluster = this.graph.subgraph(`cluster_content`, {
        [_.label]: "Content Types",
        [_.style]: "filled" as any,
        [_.fillcolor]: "#fefce8" as any,
        [_.pencolor]: "#ca8a04" as any,
      });
    }

    if (utilityTypes.length > 0) {
      const utilityCluster = this.graph.subgraph(`cluster_utility`, {
        [_.label]: "Utility Types",
        [_.style]: "filled" as any,
        [_.fillcolor]: "#fdf2f8" as any,
        [_.pencolor]: "#be185d" as any,
      });
    }
  }

  private createNode(type: SchemaType): void {
    // Create a Graphviz node using HTML-like table format for better control
    const fields = type.fields
      ? type.fields
          .filter((field: SchemaField) => !field.name?.startsWith("_")) // Filter out internal fields
          .map((field: SchemaField) => {
            const fieldName = field.name || "unnamed";
            const fieldType = this.getFieldTypeLabel(field);
            return { name: fieldName, type: fieldType };
          })
      : [];

    // Create HTML-like table format with left-aligned text and proper styling
    const typeIcon = this.schema.documentTypes.has(type.name)
      ? CONFIG.ICONS.DOCUMENT
      : CONFIG.ICONS.OBJECT;
    let nodeLabel = "";

    if (fields.length > 0) {
      // Use HTML-like table format with minimal padding for precise arrow positioning
      nodeLabel = `<
        <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="${
          CONFIG.LAYOUT.TABLE.CELLPADDING
        }">
          <TR>
            <TD COLSPAN="2" BGCOLOR="${
              this.schema.documentTypes.has(type.name)
                ? CONFIG.COLORS.DOCUMENT_NODE_BORDER
                : CONFIG.COLORS.OBJECT_NODE_BORDER
            }" PORT="title">
              <FONT COLOR="white" POINT-SIZE="${
                CONFIG.TYPOGRAPHY.SIZES.NODE_TITLE
              }"><B>${typeIcon} ${type.name}</B></FONT>
            </TD>
          </TR>`;

      // Add field rows with white background and left/right ports for better arrow positioning
      fields.forEach((field) => {
        nodeLabel += `
          <TR>
            <TD ALIGN="LEFT" BGCOLOR="${CONFIG.COLORS.FIELD_BG}" PORT="${field.name}_left"><FONT POINT-SIZE="${CONFIG.TYPOGRAPHY.SIZES.FIELD_NAME}"><B>${field.name}</B></FONT></TD>
            <TD ALIGN="LEFT" BGCOLOR="${CONFIG.COLORS.FIELD_BG}" PORT="${field.name}_right"><FONT POINT-SIZE="${CONFIG.TYPOGRAPHY.SIZES.FIELD_TYPE}"><I>${field.type}</I></FONT></TD>
          </TR>`;
      });

      nodeLabel += `
        </TABLE>
      >`;
    } else {
      // Simple header-only table for types without fields
      nodeLabel = `<
        <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="${
          CONFIG.LAYOUT.TABLE.CELLPADDING
        }">
          <TR>
            <TD BGCOLOR="${
              this.schema.documentTypes.has(type.name)
                ? CONFIG.COLORS.DOCUMENT_NODE_BORDER
                : CONFIG.COLORS.OBJECT_NODE_BORDER
            }" PORT="title">
              <FONT COLOR="white" POINT-SIZE="${
                CONFIG.TYPOGRAPHY.SIZES.NODE_TITLE
              }"><B>${typeIcon} ${type.name}</B></FONT>
            </TD>
          </TR>
        </TABLE>
      >`;
    }

    this.graph.node(type.name, {
      [_.label]: nodeLabel,
      [_.shape]: "plaintext", // Use plaintext for HTML-like labels
      [_.penwidth]: 1.8,
      [_.fontname]: "Arial",
    });
  }

  private createEdges(sourceType: SchemaType): void {
    // Analyze fields to create edges for references and embedded objects.
    if (!sourceType.fields) return;

    for (const field of sourceType.fields) {
      if (!field.name) continue;

      this.processFieldForEdges(sourceType.name, field.name, field);
    }
  }

  private createEdgeIfNotExists(
    source: string,
    target: string,
    label: string,
    style: any,
    sourcePort?: string
  ): void {
    const edgeKey = `${source}->${target}:${label}`;
    if (!this.createdEdges.has(edgeKey)) {
      this.createdEdges.add(edgeKey);
      // Use port-based connection for record shapes
      const sourceNode = sourcePort
        ? `${source}:${sourcePort}`
        : `${source}:title`;
      const targetNode = `${target}:title`; // Connect to the title port of target
      this.graph.edge([sourceNode, targetNode], style);
    }
  }

  private processFieldForEdges(
    sourceNodeId: string,
    sourceFieldId: string,
    field: SchemaField
  ): void {
    // Handle direct references - try different approaches
    if (field.type === "reference") {
      if (field.to && field.to.length > 0) {
        // Standard approach: explicit 'to' targets
        field.to.forEach((target: { type: string }) => {
          // console.log(`DEBUG: Processing reference from ${sourceNodeId}.${sourceFieldId} -> ${target.type}`);
          if (this.schema.allTypeNames.has(target.type)) {
            const targetSchema = this.schema.types.find(
              (t) => t.name === target.type
            );
            if (
              targetSchema &&
              (targetSchema.type === "document" ||
                targetSchema.type === "object")
            ) {
              // console.log(`DEBUG: Creating edge ${sourceNodeId} -> ${target.type}`);
              this.createEdgeIfNotExists(
                sourceNodeId,
                target.type,
                sourceFieldId,
                {
                  [_.arrowhead]:
                    CONFIG.RELATIONSHIP_CONFIGS.DIRECT_REFERENCE.arrowhead,
                  [_.arrowtail]:
                    CONFIG.RELATIONSHIP_CONFIGS.DIRECT_REFERENCE.arrowtail,
                  [_.dir]: CONFIG.RELATIONSHIP_CONFIGS.DIRECT_REFERENCE.dir,
                  [_.style]: CONFIG.RELATIONSHIP_CONFIGS.DIRECT_REFERENCE.style,
                  [_.xlabel]: `${sourceFieldId}`,
                  [_.color]: CONFIG.RELATIONSHIP_CONFIGS.DIRECT_REFERENCE.color,
                  [_.penwidth]:
                    CONFIG.RELATIONSHIP_CONFIGS.DIRECT_REFERENCE.penwidth,
                  [_.arrowsize]:
                    CONFIG.RELATIONSHIP_CONFIGS.DIRECT_REFERENCE.arrowsize,
                },
                `${sourceFieldId}_left:w` // Use west (left) side of the field cell
              );
            } else {
              // console.log(`DEBUG: Target ${target.type} not found or not document/object type`);
            }
          } else {
            // console.log(`DEBUG: Target type ${target.type} not in allTypeNames set`);
          }
        });
      } else {
        // Fallback: Try to match by field name or title
        const possibleTargets = this.findPossibleReferenceTargets(
          sourceFieldId,
          field.title
        );
        possibleTargets.forEach((targetType) => {
          this.createEdgeIfNotExists(
            sourceNodeId,
            targetType,
            sourceFieldId + "?",
            {
              [_.arrowhead]:
                CONFIG.RELATIONSHIP_CONFIGS.INFERRED_REFERENCE.arrowhead,
              [_.arrowtail]:
                CONFIG.RELATIONSHIP_CONFIGS.INFERRED_REFERENCE.arrowtail,
              [_.dir]: CONFIG.RELATIONSHIP_CONFIGS.INFERRED_REFERENCE.dir,
              [_.style]: CONFIG.RELATIONSHIP_CONFIGS.INFERRED_REFERENCE.style,
              [_.xlabel]: `${sourceFieldId}?`,
              [_.color]: CONFIG.RELATIONSHIP_CONFIGS.INFERRED_REFERENCE.color,
              [_.penwidth]:
                CONFIG.RELATIONSHIP_CONFIGS.INFERRED_REFERENCE.penwidth,
              [_.arrowsize]:
                CONFIG.RELATIONSHIP_CONFIGS.INFERRED_REFERENCE.arrowsize,
            },
            `${sourceFieldId}_left:w` // Use west (left) side of the field cell
          );
        });
      }
    }

    // Handle direct object embeddings
    if (field.type === "object" && field.name) {
      // Check if there's an object type with this name
      const objectType = this.schema.types.find(
        (t) => t.name === field.name && t.type === "object"
      );
      if (objectType) {
        this.createEdgeIfNotExists(
          sourceNodeId,
          objectType.name,
          sourceFieldId,
          {
            [_.arrowhead]:
              CONFIG.RELATIONSHIP_CONFIGS.OBJECT_COMPOSITION.arrowhead,
            [_.arrowtail]:
              CONFIG.RELATIONSHIP_CONFIGS.OBJECT_COMPOSITION.arrowtail,
            [_.dir]: CONFIG.RELATIONSHIP_CONFIGS.OBJECT_COMPOSITION.dir,
            [_.style]: CONFIG.RELATIONSHIP_CONFIGS.OBJECT_COMPOSITION.style,
            [_.xlabel]: `${sourceFieldId}`,
            [_.color]: CONFIG.RELATIONSHIP_CONFIGS.OBJECT_COMPOSITION.color,
            [_.penwidth]:
              CONFIG.RELATIONSHIP_CONFIGS.OBJECT_COMPOSITION.penwidth,
            [_.arrowsize]:
              CONFIG.RELATIONSHIP_CONFIGS.OBJECT_COMPOSITION.arrowsize,
          },
          `${sourceFieldId}_left:w` // Use west (left) side of the field cell
        );
      }
    }

    // Handle arrays of types
    if (field.type === "array" && field.of) {
      field.of.forEach((itemType: SchemaField) => {
        // Recurse for nested objects or handle references within arrays
        this.processArrayItemForEdges(sourceNodeId, sourceFieldId, itemType);
      });
    }
  }

  private findPossibleReferenceTargets(
    fieldName: string,
    fieldTitle?: string
  ): string[] {
    const targets: string[] = [];

    // Try exact name matches
    if (this.schema.allTypeNames.has(fieldName)) {
      const schema = this.schema.types.find((t) => t.name === fieldName);
      if (schema && (schema.type === "document" || schema.type === "object")) {
        targets.push(fieldName);
      }
    }

    // Try title matches
    if (fieldTitle && this.schema.allTypeNames.has(fieldTitle.toLowerCase())) {
      const schema = this.schema.types.find(
        (t) => t.name === fieldTitle.toLowerCase()
      );
      if (schema && (schema.type === "document" || schema.type === "object")) {
        targets.push(fieldTitle.toLowerCase());
      }
    }

    // Try common patterns (remove 'ref', 'id', etc.)
    const cleanName = fieldName.replace(/ref$|id$|_ref$|_id$/i, "");
    if (cleanName !== fieldName && this.schema.allTypeNames.has(cleanName)) {
      const schema = this.schema.types.find((t) => t.name === cleanName);
      if (schema && (schema.type === "document" || schema.type === "object")) {
        targets.push(cleanName);
      }
    }

    return targets;
  }

  private processArrayItemForEdges(
    sourceNodeId: string,
    sourceFieldId: string,
    itemType: SchemaField
  ): void {
    if (itemType.type === "reference") {
      if (itemType.to && itemType.to.length > 0) {
        itemType.to.forEach((target: { type: string }) => {
          if (this.schema.allTypeNames.has(target.type)) {
            const targetSchema = this.schema.types.find(
              (t) => t.name === target.type
            );
            if (
              targetSchema &&
              (targetSchema.type === "document" ||
                targetSchema.type === "object")
            ) {
              this.createEdgeIfNotExists(
                sourceNodeId,
                target.type,
                sourceFieldId + "[]",
                {
                  [_.arrowhead]:
                    CONFIG.RELATIONSHIP_CONFIGS.ARRAY_REFERENCE.arrowhead,
                  [_.arrowtail]:
                    CONFIG.RELATIONSHIP_CONFIGS.ARRAY_REFERENCE.arrowtail,
                  [_.dir]: CONFIG.RELATIONSHIP_CONFIGS.ARRAY_REFERENCE.dir,
                  [_.style]: CONFIG.RELATIONSHIP_CONFIGS.ARRAY_REFERENCE.style,
                  [_.xlabel]: `${sourceFieldId}[]`,
                  [_.color]: CONFIG.RELATIONSHIP_CONFIGS.ARRAY_REFERENCE.color,
                  [_.penwidth]:
                    CONFIG.RELATIONSHIP_CONFIGS.ARRAY_REFERENCE.penwidth,
                  [_.arrowsize]:
                    CONFIG.RELATIONSHIP_CONFIGS.ARRAY_REFERENCE.arrowsize,
                },
                `${sourceFieldId}_left:w` // Use west (left) side of the field cell
              );
            }
          }
        });
      } else {
        // Try to infer targets for array references too
        const possibleTargets = this.findPossibleReferenceTargets(
          sourceFieldId,
          itemType.title
        );
        possibleTargets.forEach((targetType) => {
          this.createEdgeIfNotExists(
            sourceNodeId,
            targetType,
            sourceFieldId + "[]?",
            {
              [_.arrowhead]:
                CONFIG.RELATIONSHIP_CONFIGS.INFERRED_ARRAY_REFERENCE.arrowhead,
              [_.arrowtail]:
                CONFIG.RELATIONSHIP_CONFIGS.INFERRED_ARRAY_REFERENCE.arrowtail,
              [_.dir]: CONFIG.RELATIONSHIP_CONFIGS.INFERRED_ARRAY_REFERENCE.dir,
              [_.style]:
                CONFIG.RELATIONSHIP_CONFIGS.INFERRED_ARRAY_REFERENCE.style,
              [_.xlabel]: `${sourceFieldId}[]?`,
              [_.color]:
                CONFIG.RELATIONSHIP_CONFIGS.INFERRED_ARRAY_REFERENCE.color,
              [_.penwidth]:
                CONFIG.RELATIONSHIP_CONFIGS.INFERRED_ARRAY_REFERENCE.penwidth,
              [_.arrowsize]:
                CONFIG.RELATIONSHIP_CONFIGS.INFERRED_ARRAY_REFERENCE.arrowsize,
            },
            `${sourceFieldId}_left:w` // Use west (left) side of the field cell
          );
        });
      }
    }

    // Handle array of objects
    if (itemType.type === "object" && itemType.name) {
      const objectType = this.schema.types.find(
        (t) => t.name === itemType.name && t.type === "object"
      );
      if (objectType) {
        this.createEdgeIfNotExists(
          sourceNodeId,
          objectType.name,
          sourceFieldId + "[]",
          {
            [_.arrowhead]:
              CONFIG.RELATIONSHIP_CONFIGS.ARRAY_COMPOSITION.arrowhead,
            [_.arrowtail]:
              CONFIG.RELATIONSHIP_CONFIGS.ARRAY_COMPOSITION.arrowtail,
            [_.dir]: CONFIG.RELATIONSHIP_CONFIGS.ARRAY_COMPOSITION.dir,
            [_.style]: CONFIG.RELATIONSHIP_CONFIGS.ARRAY_COMPOSITION.style,
            [_.xlabel]: `${sourceFieldId}[]`,
            [_.color]: CONFIG.RELATIONSHIP_CONFIGS.ARRAY_COMPOSITION.color,
            [_.penwidth]:
              CONFIG.RELATIONSHIP_CONFIGS.ARRAY_COMPOSITION.penwidth,
            [_.arrowsize]:
              CONFIG.RELATIONSHIP_CONFIGS.ARRAY_COMPOSITION.arrowsize,
          },
          `${sourceFieldId}_left:w` // Use west (left) side of the field cell
        );
      }
    }
  }

  private getFieldTypeLabel(field: SchemaField): string {
    if (field.type === "array" && field.of) {
      const itemTypes = field.of
        .map((item: SchemaField) => this.getFieldTypeLabel(item))
        .join(" | ");
      return `Array&lt;${itemTypes}&gt;`;
    }
    if (field.type === "reference" && field.to) {
      return `Ref&lt;${field.to
        .map((t: { type: string }) => t.type)
        .join(" | ")}&gt;`;
    }
    return field.type;
  }
}

// --- Argument Parsing ---

function parseArguments(): ConverterOptions {
  const args = minimist(process.argv.slice(2), {
    string: ["input-format"],
    boolean: ["test"],
    default: {
      "input-format": "sanity", // Current schema.json is in Sanity format
      test: false,
    },
    alias: {
      f: "input-format",
      t: "test",
    },
  });

  const inputFormat = args["input-format"] as InputFormat;
  const isTestMode = args["test"] as boolean;
  const supportedFormats: InputFormat[] = ["schema.club", "sanity"];

  if (!supportedFormats.includes(inputFormat)) {
    console.error(
      `Error: Unsupported input format '${inputFormat}'. Supported formats are: ${supportedFormats.join(
        ", "
      )}`
    );
    process.exit(1);
  }

  // Smart schema file detection
  let schemaPath: string;
  let outputPath: string;

  if (isTestMode) {
    // Test mode: use format-specific files and outputs
    const formatSpecificFiles = {
      sanity: "schema-sanity.json",
      "schema.club": "schema-schema.club.json",
    };

    const specificFile = formatSpecificFiles[inputFormat];
    const specificPath = path.join(process.cwd(), specificFile);

    if (fs.existsSync(specificPath)) {
      schemaPath = specificPath;
      outputPath = path.join(
        process.cwd(),
        `schema-${inputFormat.replace(".", "")}.dot`
      );
    } else {
      // Fallback to default file in test mode
      schemaPath = path.join(process.cwd(), "schema.json");
      outputPath = path.join(
        process.cwd(),
        `schema-${inputFormat.replace(".", "")}.dot`
      );
    }
  } else {
    // Normal mode: use format-specific files if available, otherwise default
    const formatSpecificFiles = {
      sanity: "schema-sanity.json",
      "schema.club": "schema-schema.club.json",
    };

    const specificFile = formatSpecificFiles[inputFormat];
    const specificPath = path.join(process.cwd(), specificFile);

    if (fs.existsSync(specificPath)) {
      schemaPath = specificPath;
    } else {
      schemaPath = path.join(process.cwd(), "schema.json");
    }

    outputPath = path.join(process.cwd(), "schema.dot");
  }

  return {
    inputFormat,
    schemaPath,
    outputPath,
    isTestMode,
  };
}

function showHelp(): void {
  console.log(`
Usage: npm run generate [-- --input-format=FORMAT] [--test]

Options:
  --input-format, -f   Input schema format (default: sanity)
                       Supported formats: sanity, schema.club
  --test, -t          Test mode with format-specific output files

File Detection:
  Normal mode:
    - Looks for schema-sanity.json for sanity format
    - Looks for schema-schema.club.json for schema.club format  
    - Falls back to schema.json if format-specific file not found
    
  Test mode:
    - Same file detection as normal mode
    - Outputs to schema-sanity.dot or schema-schemaclub.dot

Examples:
  npm run generate                                 # Uses sanity format, schema.json
  npm run generate -- --input-format=sanity       # Explicit sanity format
  npm run generate -- --input-format=schema.club  # Uses schema.club format  
  npm run generate -- --test --input-format=sanity # Test mode with sanity format
  npm test                                         # Runs comprehensive test of both formats

Description:
  Generates a Graphviz DOT file from your schema definition.
  The output file can be converted to PDF or PNG using:
  
  npm run pdf    # Converts to schema.pdf
  npm run png    # Converts to schema.png
  npm test       # Tests both formats and generates all variants
`);
}

// --- Main Execution ---

function main() {
  // Check for help flag
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    showHelp();
    return;
  }

  const options = parseArguments();

  if (!fs.existsSync(options.schemaPath)) {
    console.error(`Error: schema.json not found at ${options.schemaPath}`);

    if (options.inputFormat === "sanity") {
      console.error(
        'For Sanity format, please run "npx sanity@latest schema extract" in your Sanity Studio directory first.'
      );
    } else {
      console.error(
        "Please ensure your schema.json file exists in the current directory."
      );
    }

    process.exit(1);
  }

  try {
    console.log(`🔍 Processing schema using ${options.inputFormat} format...`);
    console.log(`📁 Schema file: ${path.basename(options.schemaPath)}`);
    console.log(`📤 Output file: ${path.basename(options.outputPath)}`);
    if (options.isTestMode) {
      console.log(`🧪 Test mode enabled`);
    }

    // Parse the schema using the appropriate parser
    const parser = createParser(options.inputFormat, options.schemaPath);
    const parsedSchema = parser.parse();

    console.log(
      `📊 Found ${parsedSchema.types.length} schema types (${
        parsedSchema.documentTypes.size
      } documents, ${
        parsedSchema.types.length - parsedSchema.documentTypes.size
      } objects)`
    );

    // Convert to graph
    const converter = new GraphConverter(parsedSchema);
    const dotString = converter.convert();

    // Write output
    fs.writeFileSync(options.outputPath, dotString);

    console.log(
      `✅ Successfully generated Graphviz DOT file at: ${options.outputPath}`
    );
    console.log(`📄 To generate PDF: npm run pdf`);
    console.log(`🖼️  To generate PNG: npm run png`);
  } catch (error) {
    console.error("❌ An error occurred during conversion:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
