const fs = require('fs');
const path = require('path');

// Path to the flattened contract
const flattenedPath = path.join(__dirname, '../flattened/SwapRouter_flattened.sol');

// Read the flattened contract
const flattenedContent = fs.readFileSync(flattenedPath, 'utf8');

// Remove empty semicolons
const fixedContent = flattenedContent.replace(/^;\s*$/gm, '');

// Write the fixed content back to the file
fs.writeFileSync(flattenedPath, fixedContent);

console.log('Fixed flattened contract');
