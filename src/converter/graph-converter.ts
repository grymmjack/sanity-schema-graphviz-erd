// converter/graph-converter.ts - Main graph conversion logic

import { Digraph, toDot, attribute as _ } from "ts-graphviz";
import { ParsedSchema, SchemaType, SchemaField } from "../types.ts";
import { CONFIG } from "../../config.js";

export class GraphConverter {
  private schema: ParsedSchema;
  private graph!: Digraph; // Using definite assignment assertion since it's initialized in constructor
  private createdEdges: Set<string>; // Track created edges to avoid duplicates

  constructor(schema: ParsedSchema) {
    this.schema = schema;
    this.createdEdges = new Set();
    this.initializeGraph();
  }

  private initializeGraph(): void {
    // Initialize the directed graph with some global attributes for better layout.
    this.graph = new Digraph("SchemaGraph", {
      [_.rankdir]: "TB" as any,
      [_.splines]: "curved" as any,
      [_.nodesep]: CONFIG.GRAPH_CONFIG.nodesep,
      [_.ranksep]: CONFIG.GRAPH_CONFIG.ranksep,
      [_.fontname]: CONFIG.TYPOGRAPHY.FONTS.PRIMARY,
      [_.fontsize]: CONFIG.TYPOGRAPHY.SIZES.DEFAULT,
      [_.concentrate]: true, // Merge edges when possible
      [_.overlap]: "false" as any,
      [_.pack]: true, // Pack nodes more tightly
    });

    // Set default styles for all nodes and edges.
    this.graph.node({
      [_.shape]: "plaintext" as any,
      [_.style]: "filled" as any,
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
      [_.arrowhead]: "normal" as any,
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
