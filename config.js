/**
 * Configuration file for Sanity Schema Visualizer
 * Centralizes all visual styling, colors, and layout settings
 */

// Color Palette
export const COLORS = {
  // Relationship Colors
  DIRECT_REFERENCE: "#2563EB", // Blue - solid direct references
  INFERRED_REFERENCE: "#059669", // Green - dashed inferred references
  ARRAY_REFERENCE: "#DC2626", // Red - bold array references
  INFERRED_ARRAY_REFERENCE: "#F59E0B", // Orange - dashed inferred array references
  OBJECT_COMPOSITION: "#0D9488", // Teal - bold object compositions
  ARRAY_COMPOSITION: "#0D9488", // Teal - bold array compositions

  // Node Colors
  DOCUMENT_NODE_BG: "#F8FAFC", // Light gray background for document nodes
  DOCUMENT_NODE_BORDER: "#1E293B", // Dark gray border for document nodes
  OBJECT_NODE_BG: "#FFFFFF", // White background for object nodes
  OBJECT_NODE_BORDER: "#64748B", // Medium gray border for object nodes

  // Field Colors
  FIELD_BG: "#FFFFFF", // White background for fields
  FIELD_TEXT: "#1F2937", // Dark gray text for fields
  FIELD_TYPE_TEXT: "#6B7280", // Medium gray text for field types

  // Default Edge Color
  DEFAULT_EDGE: "#1F2937", // Dark gray for default edges
};

// Line Styles and Thickness
export const LINE_STYLES = {
  // Line Thickness (penwidth)
  DIRECT_REFERENCE: 2.5,
  INFERRED_REFERENCE: 2.0,
  ARRAY_REFERENCE: 2.8,
  INFERRED_ARRAY_REFERENCE: 2.3,
  OBJECT_COMPOSITION: 2.6,
  ARRAY_COMPOSITION: 2.5,
  DEFAULT: 2.0,

  // Line Styles
  SOLID: "solid",
  DASHED: "dashed",
  DOTTED: "dotted",
  BOLD: "bold",
};

// Arrow Styles
export const ARROW_STYLES = {
  // Arrow Head Types
  HEAD_TYPES: {
    NORMAL: "normal",
    DIAMOND: "diamond",
    DOT: "dot",
    NONE: "none",
    VEE: "vee",
    CROW: "crow",
  },

  // Arrow Tail Types (for origin markers)
  TAIL_TYPES: {
    BOX: "box", // Square marker
    DIAMOND: "diamond", // Diamond marker
    DOT: "dot", // Dot marker
    NONE: "none", // No marker
    VEE: "vee", // Triangle marker
  },

  // Arrow Sizes
  SIZES: {
    DIRECT_REFERENCE: 0.7,
    INFERRED_REFERENCE: 0.6,
    ARRAY_REFERENCE: 0.7,
    INFERRED_ARRAY_REFERENCE: 0.6,
    OBJECT_COMPOSITION: 0.8,
    ARRAY_COMPOSITION: 0.8,
    DEFAULT: 0.8,
  },

  // Arrow Directions
  DIRECTIONS: {
    FORWARD: "forward", // Only arrowhead
    BACK: "back", // Only arrowtail
    BOTH: "both", // Both head and tail
    NONE: "none", // Neither
  },
};

// Typography Settings
export const TYPOGRAPHY = {
  // Font Families
  FONTS: {
    PRIMARY: "Arial",
    SECONDARY: "Helvetica",
    MONOSPACE: "Courier",
  },

  // Font Sizes
  SIZES: {
    NODE_TITLE: 14, // Main node titles
    NODE_SUBTITLE: 10, // Node subtitles
    FIELD_NAME: 10, // Field names
    FIELD_TYPE: 9, // Field types
    EDGE_LABEL: 10, // Edge labels
    DEFAULT: 10,
  },

  // Text Alignment
  ALIGNMENT: {
    LEFT: "LEFT",
    CENTER: "CENTER",
    RIGHT: "RIGHT",
  },
};

// Layout Settings
export const LAYOUT = {
  // Graph Direction
  DIRECTION: "TB", // Top to Bottom (vertical layout)

  // Spacing
  NODE_SEPARATION: 1.0, // Minimum space between nodes
  RANK_SEPARATION: 1.5, // Space between ranks/levels

  // Node Shape and Style
  NODE_SHAPE: "plaintext", // Use HTML-like records
  NODE_STYLE: "filled", // Fill node backgrounds

  // Table Settings
  TABLE: {
    BORDER: 1, // Table border width
    CELLPADDING: 2, // Cell padding
    CELLSPACING: 0, // Cell spacing
    BGCOLOR: "#FFFFFF", // Default table background
  },
};

// Relationship Type Configurations
export const RELATIONSHIP_CONFIGS = {
  DIRECT_REFERENCE: {
    color: COLORS.DIRECT_REFERENCE,
    penwidth: LINE_STYLES.DIRECT_REFERENCE,
    style: LINE_STYLES.SOLID,
    arrowhead: ARROW_STYLES.HEAD_TYPES.NORMAL,
    arrowtail: ARROW_STYLES.TAIL_TYPES.BOX,
    arrowsize: ARROW_STYLES.SIZES.DIRECT_REFERENCE,
    dir: ARROW_STYLES.DIRECTIONS.BOTH,
  },

  INFERRED_REFERENCE: {
    color: COLORS.INFERRED_REFERENCE,
    penwidth: LINE_STYLES.INFERRED_REFERENCE,
    style: LINE_STYLES.DASHED,
    arrowhead: ARROW_STYLES.HEAD_TYPES.NORMAL,
    arrowtail: ARROW_STYLES.TAIL_TYPES.BOX,
    arrowsize: ARROW_STYLES.SIZES.INFERRED_REFERENCE,
    dir: ARROW_STYLES.DIRECTIONS.BOTH,
  },

  ARRAY_REFERENCE: {
    color: COLORS.ARRAY_REFERENCE,
    penwidth: LINE_STYLES.ARRAY_REFERENCE,
    style: LINE_STYLES.BOLD,
    arrowhead: ARROW_STYLES.HEAD_TYPES.NORMAL,
    arrowtail: ARROW_STYLES.TAIL_TYPES.BOX,
    arrowsize: ARROW_STYLES.SIZES.ARRAY_REFERENCE,
    dir: ARROW_STYLES.DIRECTIONS.BOTH,
  },

  INFERRED_ARRAY_REFERENCE: {
    color: COLORS.INFERRED_ARRAY_REFERENCE,
    penwidth: LINE_STYLES.INFERRED_ARRAY_REFERENCE,
    style: LINE_STYLES.DASHED,
    arrowhead: ARROW_STYLES.HEAD_TYPES.NORMAL,
    arrowtail: ARROW_STYLES.TAIL_TYPES.BOX,
    arrowsize: ARROW_STYLES.SIZES.INFERRED_ARRAY_REFERENCE,
    dir: ARROW_STYLES.DIRECTIONS.BOTH,
  },

  OBJECT_COMPOSITION: {
    color: COLORS.OBJECT_COMPOSITION,
    penwidth: LINE_STYLES.OBJECT_COMPOSITION,
    style: LINE_STYLES.BOLD,
    arrowhead: ARROW_STYLES.HEAD_TYPES.NORMAL,
    arrowtail: ARROW_STYLES.TAIL_TYPES.BOX,
    arrowsize: ARROW_STYLES.SIZES.OBJECT_COMPOSITION,
    dir: ARROW_STYLES.DIRECTIONS.BOTH,
  },

  ARRAY_COMPOSITION: {
    color: COLORS.ARRAY_COMPOSITION,
    penwidth: LINE_STYLES.ARRAY_COMPOSITION,
    style: LINE_STYLES.BOLD,
    arrowhead: ARROW_STYLES.HEAD_TYPES.NORMAL,
    arrowtail: ARROW_STYLES.TAIL_TYPES.BOX,
    arrowsize: ARROW_STYLES.SIZES.ARRAY_COMPOSITION,
    dir: ARROW_STYLES.DIRECTIONS.BOTH,
  },
};

// Graph-wide Settings
export const GRAPH_CONFIG = {
  // Global graph attributes
  splines: "curved", // Use curved edges (bezier)
  overlap: "false", // Prevent node overlaps
  rankdir: LAYOUT.DIRECTION, // Graph direction
  nodesep: LAYOUT.NODE_SEPARATION,
  ranksep: LAYOUT.RANK_SEPARATION,

  // Default node attributes
  node: {
    fontname: TYPOGRAPHY.FONTS.PRIMARY,
    fontsize: TYPOGRAPHY.SIZES.DEFAULT,
    shape: LAYOUT.NODE_SHAPE,
    style: LAYOUT.NODE_STYLE,
  },

  // Default edge attributes
  edge: {
    fontname: TYPOGRAPHY.FONTS.PRIMARY,
    fontsize: TYPOGRAPHY.SIZES.EDGE_LABEL,
    penwidth: LINE_STYLES.DEFAULT,
    color: COLORS.DEFAULT_EDGE,
    arrowsize: ARROW_STYLES.SIZES.DEFAULT,
    arrowhead: ARROW_STYLES.HEAD_TYPES.NORMAL,
  },
};

// Icons and Symbols (for potential future use)
export const ICONS = {
  DOCUMENT: "📄 ",
  OBJECT: "🏗️ ",
  ARRAY: "📋 ",
  REFERENCE: "🔗 ",
  STRING: "📝 ",
  NUMBER: "🔢 ",
  BOOLEAN: "✅ ",
  DATE: "📅 ",
  IMAGE: "🖼️ ",
};

// Export all configurations as a single object for easy importing
export const CONFIG = {
  COLORS,
  LINE_STYLES,
  ARROW_STYLES,
  TYPOGRAPHY,
  LAYOUT,
  RELATIONSHIP_CONFIGS,
  GRAPH_CONFIG,
  ICONS,
};

export default CONFIG;
