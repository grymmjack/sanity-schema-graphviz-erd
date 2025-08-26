# Sanity Schema Visualizer

A powerful tool that converts Sanity CMS schema definitions into professional Entity Relationship (ER) diagrams. This visualizer automatically detects relationships between your schema types and generates beautiful, connected diagrams that help you understand your content structure at a glance.

## Features

- 🔗 **Automatic Relationship Detection**: Identifies references between schema types and draws connections
- 🎨 **Professional ER Diagram Styling**: Clean, vertical layout with bold titles and clear typography
- 🌈 **Color-Coded Relationships**: Different colors and styles for various relationship types
- 📊 **Multiple Output Formats**: Generate PDF, PNG, SVG, and DOT files
- 🔍 **Visual Origin Markers**: Square markers show exactly where relationships originate
- 📱 **Responsive Layout**: Vertical stacking prevents overly wide diagrams

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 14 or higher)
- **npm** or **yarn**
- **Graphviz** (required for rendering diagrams)

### Installing Graphviz

#### macOS (using Homebrew)

```bash
brew install graphviz
```

#### Ubuntu/Debian

```bash
sudo apt-get install graphviz
```

#### Windows

Download and install from [Graphviz Official Website](https://graphviz.org/download/)

#### Verify Installation

```bash
dot -V
```

## Installation

1. Clone the repository:

```bash
git clone https://github.com/luxome-rickc/sanity-schema-visualizer.git
cd sanity-schema-visualizer
```

2. Install dependencies:

```bash
npm install
```

## Usage

### Step 1: Prepare Your Schema File

> See https://www.sanity.io/docs/cli-reference/cli-schema#fd5b8db9f9c4 to learn more about sanity CLI.

Using `sanity schema extract` extract your `schema.json` or just manually create a `schema.json` file containing your Sanity schema definition. The schema should be in JavaScript object notation format, like this:

```json
[
  {
    "name": "product",
    "type": "document",
    "title": "Product",
    "fields": [
      {
        "name": "title",
        "type": "string",
        "title": "Title"
      },
      {
        "name": "category",
        "type": "reference",
        "title": "Category",
        "to": [{ "type": "category" }]
      }
    ]
  },
  {
    "name": "category",
    "type": "document",
    "title": "Category",
    "fields": [
      {
        "name": "name",
        "type": "string",
        "title": "Name"
      }
    ]
  }
]
```

### Step 2: Generate the Visualization

Run the schema visualizer:

```bash
npm run generate
```

Or using the direct command:

```bash
npx ts-node generate-schema-graph.ts
```

This will generate a `schema.dot` file containing the Graphviz representation of your schema.

### Step 3: Render to Your Preferred Format

Generate the final visualization in your desired format:

#### Quick Commands (Recommended)

```bash
# Generate PDF directly (runs generate + render)
npm run pdf

# Generate PNG directly (runs generate + render)
npm run png
```

#### Manual Commands

Generate the final visualization in your desired format:

#### PDF (recommended for documentation)

```bash
dot -Tpdf schema.dot -o schema.pdf
```

#### PNG (good for web/presentations)

```bash
dot -Tpng schema.dot -o schema.png
```

#### SVG (scalable vector graphics)

```bash
dot -Tsvg schema.dot -o schema.svg
```

## Understanding the Output

### Node Types

- **Document Types**: Displayed with bold, larger titles (these are your main content types)
- **Object Types**: Shown with regular titles (embedded objects and components)

### Relationship Types

The visualizer identifies and color-codes different types of relationships:

- **🔵 Direct References** (Blue, solid): Explicit `reference` fields pointing to other types
- **🟢 Inferred References** (Green, dashed): References detected from field names and patterns
- **🔴 Array References** (Red, bold): References within arrays (`reference` type with `[]`)
- **🟠 Inferred Array References** (Orange, dashed): Array references detected from naming patterns
- **🟢 Object Compositions** (Teal, bold): Direct object type inclusions
- **🟦 Array Compositions** (Teal, bold): Object types used within arrays

### Visual Elements

- **Square Markers**: Small colored squares show exactly where relationships originate
- **Curved Arrows**: Elegant bezier curves connect related types
- **Field Lists**: All fields are listed with their types for easy reference
- **Left-Aligned Text**: Clean, readable layout with consistent text alignment

## Configuration & Customization

The visualizer uses a centralized configuration system in `config.js` that allows you to easily customize all visual aspects without diving into the main code.

### Configuration File Structure

The `config.js` file contains several configuration objects:

#### Colors (`COLORS`)
Control all colors used in the visualization:

```javascript
// Relationship Colors
DIRECT_REFERENCE: "#2563EB",        // Blue for direct references
INFERRED_REFERENCE: "#059669",      // Green for inferred references  
ARRAY_REFERENCE: "#DC2626",         // Red for array references
// ... and many more
```

#### Arrow Styles (`ARROW_STYLES`)
Configure arrow appearance:

```javascript
// Arrow Head Types
HEAD_TYPES: {
  NORMAL: "normal",
  DIAMOND: "diamond", 
  DOT: "dot",
  // ...
},

// Arrow Sizes
SIZES: {
  DIRECT_REFERENCE: 0.7,
  INFERRED_REFERENCE: 0.6,
  // ...
}
```

#### Typography (`TYPOGRAPHY`)
Control fonts and text sizing:

```javascript
// Font Families
FONTS: {
  PRIMARY: "Arial",
  SECONDARY: "Helvetica", 
  MONOSPACE: "Courier",
},

// Font Sizes
SIZES: {
  NODE_TITLE: 14,        // Main node titles
  FIELD_NAME: 10,        // Field names
  // ...
}
```

#### Relationship Configurations (`RELATIONSHIP_CONFIGS`)
Pre-configured style objects for each relationship type:

```javascript
DIRECT_REFERENCE: {
  color: COLORS.DIRECT_REFERENCE,
  penwidth: LINE_STYLES.DIRECT_REFERENCE,
  style: LINE_STYLES.SOLID,
  arrowhead: ARROW_STYLES.HEAD_TYPES.NORMAL,
  // ... complete configuration
},
```

### Common Customizations

#### Changing the Color Scheme
To change relationship colors, modify the `COLORS` object:

```javascript
// Make all references purple instead of blue
DIRECT_REFERENCE: "#8B5CF6",
INFERRED_REFERENCE: "#A855F7",
```

#### Adjusting Arrow Styles
To make arrows larger or change their appearance:

```javascript
// In ARROW_STYLES.SIZES
DIRECT_REFERENCE: 1.0,  // Larger arrows
INFERRED_REFERENCE: 0.8,

// In ARROW_STYLES.HEAD_TYPES - change arrow heads
NORMAL: "diamond",  // Use diamond instead of normal arrows
```

#### Typography Changes
Customize fonts and sizes:

```javascript
// In TYPOGRAPHY.FONTS
PRIMARY: "Helvetica",  // Use Helvetica instead of Arial

// In TYPOGRAPHY.SIZES  
NODE_TITLE: 16,       // Larger node titles
FIELD_NAME: 12,       // Larger field names
```

#### Layout Adjustments
Modify spacing and layout:

```javascript
// In LAYOUT
NODE_SEPARATION: 1.5,     // More space between nodes
RANK_SEPARATION: 2.0,     // More vertical spacing
DIRECTION: "LR",          // Left-to-right instead of top-to-bottom
```

### Creating Custom Themes

You can create different visual themes by modifying multiple configuration sections:

#### Dark Theme Example
```javascript
// Dark color scheme
COLORS: {
  DOCUMENT_NODE_BG: "#1F2937",
  DOCUMENT_NODE_BORDER: "#374151", 
  FIELD_BG: "#111827",
  FIELD_TEXT: "#F9FAFB",
  // ...
}
```

#### Minimal Theme Example
```javascript
// Simple, minimal styling
COLORS: {
  DIRECT_REFERENCE: "#000000",     // All black
  INFERRED_REFERENCE: "#666666",   // Gray
  // ...
},

ARROW_STYLES: {
  // Remove tail markers for cleaner look
  TAIL_TYPES: {
    BOX: "none",  // No origin markers
  }
}
```

### Advanced Customization

For more complex customizations, you can:

1. **Add new relationship types**: Create new entries in `RELATIONSHIP_CONFIGS`
2. **Modify the detection logic**: Edit `generate-schema-graph.ts` to detect custom patterns
3. **Add new visual elements**: Extend the config with new styling options
4. **Create conditional styling**: Use different configs based on schema properties

### Configuration Tips

- **Test incrementally**: Make small changes and regenerate to see the effects
- **Use consistent color schemes**: Maintain good contrast and accessibility
- **Keep backups**: Save working configurations before major changes
- **Document custom settings**: Comment your changes for future reference

## Project Structure

```
sanity-schema-visualizer/
├── generate-schema-graph.ts    # Main visualizer script
├── config.js                   # Centralized styling and configuration
├── schema.json                 # Your Sanity schema input file
├── schema.dot                  # Generated Graphviz DOT file
├── schema.pdf                  # Generated PDF diagram
├── schema.png                  # Generated PNG diagram
├── schema.svg                  # Generated SVG diagram
├── package.json               # Node.js dependencies
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## Advanced Customization

For advanced users who want to modify the core functionality:

- **Relationship Detection Logic**: Edit `generate-schema-graph.ts` to customize how relationships are detected
- **Node Generation**: Modify the `createNode` method to change how schema types are displayed  
- **Edge Creation**: Customize the `createEdgeIfNotExists` method for different connection styles
- **Schema Parsing**: Enhance the schema parsing logic to handle custom Sanity field types

💡 **Tip**: Most visual customizations can be achieved through `config.js` without touching the main code!

## Troubleshooting

### Common Issues

**Error: "dot command not found"**

- Make sure Graphviz is installed and in your PATH
- Try restarting your terminal after installation

**Error: "Cannot find module 'ts-graphviz'"**

- Run `npm install` to install dependencies
- Make sure you're in the project directory

**Relationships not showing up**

- Check that your `schema.json` file is properly formatted
- Ensure reference fields use the correct `to` property format
- The visualizer looks for both explicit references and inferred relationships based on naming patterns

**Output is too wide**

- The visualizer uses vertical layout, but very complex schemas may still be wide
- Try generating SVG format for better scalability
- Consider breaking large schemas into smaller, focused diagrams

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [ts-graphviz](https://github.com/ts-graphviz/ts-graphviz) for Graphviz integration
- Inspired by Entity Relationship diagram best practices
- Designed for [Sanity CMS](https://www.sanity.io/) schemas
