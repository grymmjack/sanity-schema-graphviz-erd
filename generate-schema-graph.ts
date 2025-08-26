// generate-schema-graph.ts

import * as fs from "fs";
import * as path from "path";
import { Digraph, toDot, attribute as _ } from "ts-graphviz";
import { CONFIG } from "./config.js";

// --- Type Definitions for Sanity Schema JSON ---
// These interfaces model the structure of the schema.json file.
// A more robust implementation could use zod or a similar library for validation.

interface SchemaType {
  name: string;
  type: string;
  title?: string;
  fields?: SchemaField[];
  of?: SchemaField[];
}

interface SchemaField {
  type: string;
  name?: string;
  title?: string;
  fields?: SchemaField[];
  of?: SchemaField[];
  to?: { type: string }[];
}

// --- Main Conversion Logic ---

class SanitySchemaConverter {
  private schema: SchemaType[];
  private graph: Digraph;
  private documentTypes: Set<string>;
  private allSchemaTypeNames: Set<string>;
  private createdEdges: Set<string>; // Track created edges to avoid duplicates

  constructor(schemaPath: string) {
    // 1. Load and parse the schema.json file.
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");

    // Handle both JSON and JavaScript object notation
    let parsedSchema;
    try {
      // First try parsing as JSON
      parsedSchema = JSON.parse(schemaContent);
    } catch (jsonError) {
      try {
        // If that fails, try evaluating as JavaScript (with some safety checks)
        if (
          schemaContent.trim().startsWith("[") &&
          schemaContent.trim().endsWith("]")
        ) {
          parsedSchema = eval(`(${schemaContent})`);
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

    this.schema = parsedSchema;

    // 2. Initialize the directed graph with some global attributes for better layout.
    this.graph = new Digraph("SanitySchema", {
      [_.rankdir]: CONFIG.GRAPH_CONFIG.rankdir,
      [_.splines]: CONFIG.GRAPH_CONFIG.splines,
      [_.nodesep]: CONFIG.GRAPH_CONFIG.nodesep,
      [_.ranksep]: CONFIG.GRAPH_CONFIG.ranksep,
      [_.fontname]: CONFIG.TYPOGRAPHY.FONTS.PRIMARY,
      [_.fontsize]: CONFIG.TYPOGRAPHY.SIZES.DEFAULT,
      [_.concentrate]: true, // Merge edges when possible
      [_.overlap]: CONFIG.GRAPH_CONFIG.overlap,
      [_.pack]: true, // Pack nodes more tightly
    });

    // Set default styles for all nodes and edges.
    this.graph.node({
      [_.shape]: CONFIG.LAYOUT.NODE_SHAPE,
      [_.style]: CONFIG.LAYOUT.NODE_STYLE,
      [_.fillcolor]: CONFIG.COLORS.OBJECT_NODE_BG,
      [_.color]: CONFIG.COLORS.OBJECT_NODE_BORDER,
      [_.fontname]: CONFIG.GRAPH_CONFIG.node.fontname,
      [_.fontsize]: CONFIG.GRAPH_CONFIG.node.fontsize,
      [_.penwidth]: 1.2,
    });
    this.graph.edge({
      [_.fontname]: CONFIG.GRAPH_CONFIG.edge.fontname,
      [_.fontsize]: CONFIG.GRAPH_CONFIG.edge.fontsize,
      [_.penwidth]: CONFIG.GRAPH_CONFIG.edge.penwidth,
      [_.color]: CONFIG.GRAPH_CONFIG.edge.color,
      [_.arrowsize]: CONFIG.GRAPH_CONFIG.edge.arrowsize,
      [_.arrowhead]: CONFIG.GRAPH_CONFIG.edge.arrowhead,
    });

    // Keep track of which types are top-level documents for styling.
    this.documentTypes = new Set(
      this.schema
        .filter((t: SchemaType) => t.type === "document")
        .map((t: SchemaType) => t.name)
    );

    // Keep track of all schema type names for validation
    this.allSchemaTypeNames = new Set(
      this.schema.map((t: SchemaType) => t.name)
    );

    // Track created edges to avoid duplicates
    this.createdEdges = new Set();
  }

  public convert(): string {
    // 3. Process each schema type to create nodes first
    this.schema.forEach((type: SchemaType) => {
      // Create nodes for documents and objects
      if (type.type === "document" || type.type === "object") {
        this.createNode(type);
      }
    });

    // 4. Then create edges after all nodes exist
    this.schema.forEach((type: SchemaType) => {
      if (type.type === "document" || type.type === "object") {
        this.createEdges(type);
      }
    });

    // 6. Serialize the graph object to a DOT string.
    return toDot(this.graph);
  }

  private createNode(type: SchemaType): void {
    // 4. Create a Graphviz node using HTML-like table format for better control
    const fields = type.fields
      ? type.fields
          .filter((field: SchemaField) => !field.name?.startsWith("_")) // Filter out internal Sanity fields
          .map((field: SchemaField) => {
            const fieldName = field.name || "unnamed";
            const fieldType = this.getFieldTypeLabel(field);
            return { name: fieldName, type: fieldType };
          })
      : [];

    // Create HTML-like table format with left-aligned text and proper styling
    const typeIcon = this.documentTypes.has(type.name)
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
              this.documentTypes.has(type.name)
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
              this.documentTypes.has(type.name)
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
    // 5. Analyze fields to create edges for references and embedded objects.
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
          if (this.allSchemaTypeNames.has(target.type)) {
            const targetSchema = this.schema.find(
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
            }
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
      const objectType = this.schema.find(
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
    if (this.allSchemaTypeNames.has(fieldName)) {
      const schema = this.schema.find((t) => t.name === fieldName);
      if (schema && (schema.type === "document" || schema.type === "object")) {
        targets.push(fieldName);
      }
    }

    // Try title matches
    if (fieldTitle && this.allSchemaTypeNames.has(fieldTitle.toLowerCase())) {
      const schema = this.schema.find(
        (t) => t.name === fieldTitle.toLowerCase()
      );
      if (schema && (schema.type === "document" || schema.type === "object")) {
        targets.push(fieldTitle.toLowerCase());
      }
    }

    // Try common patterns (remove 'ref', 'id', etc.)
    const cleanName = fieldName.replace(/ref$|id$|_ref$|_id$/i, "");
    if (cleanName !== fieldName && this.allSchemaTypeNames.has(cleanName)) {
      const schema = this.schema.find((t) => t.name === cleanName);
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
          if (this.allSchemaTypeNames.has(target.type)) {
            const targetSchema = this.schema.find(
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
      const objectType = this.schema.find(
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

// --- Execution ---

function main() {
  const schemaJsonPath = path.join(process.cwd(), "schema.json");
  const outputDotPath = path.join(process.cwd(), "schema.dot");

  if (!fs.existsSync(schemaJsonPath)) {
    console.error(`Error: schema.json not found at ${schemaJsonPath}`);
    console.error(
      'Please run "npx sanity@latest schema extract" in your Sanity Studio directory first.'
    );
    process.exit(1);
  }

  try {
    const converter = new SanitySchemaConverter(schemaJsonPath);
    const dotString = converter.convert();
    fs.writeFileSync(outputDotPath, dotString);
    console.log(
      `✅ Successfully generated Graphviz DOT file at: ${outputDotPath}`
    );
  } catch (error) {
    console.error("An error occurred during conversion:", error);
    process.exit(1);
  }
}

main();
