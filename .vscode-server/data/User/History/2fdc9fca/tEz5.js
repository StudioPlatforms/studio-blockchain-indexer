const fs = require('fs');
const path = require('path');

// Paths
const flattenedDir = path.join(__dirname, '../flattened');
const fixedDir = path.join(__dirname, '../fixed');

// Create the fixed directory if it doesn't exist
if (!fs.existsSync(fixedDir)) {
  fs.mkdirSync(fixedDir, { recursive: true });
}

// Read the flattened file
const flattenedPath = path.join(flattenedDir, 'SwapRouter_flattened.sol');
const flattenedContent = fs.readFileSync(flattenedPath, 'utf8');

// Split the file into sections
const sections = flattenedContent.split('// File:');

// Extract the license and pragma statements
const licenseAndPragma = sections[0];

// Extract the contract sections
const contractSections = sections.slice(1);

// Sort the contract sections so that base contracts come before derived contracts
const sortedSections = [];

// First, add all interface and library sections
const interfaceAndLibrarySections = contractSections.filter(section => {
  return section.includes('interface ') || section.includes('library ');
});
sortedSections.push(...interfaceAndLibrarySections);

// Then, add all abstract contract sections
const abstractContractSections = contractSections.filter(section => {
  return section.includes('abstract contract ') && !section.includes('contract SwapRouter');
});
sortedSections.push(...abstractContractSections);

// Finally, add the SwapRouter contract section
const swapRouterSection = contractSections.find(section => {
  return section.includes('contract SwapRouter');
});
sortedSections.push(swapRouterSection);

// Combine the sections
const fixedContent = licenseAndPragma + '// File:' + sortedSections.join('// File:');

// Write the fixed file
const fixedPath = path.join(fixedDir, 'SwapRouter_fixed.sol');
fs.writeFileSync(fixedPath, fixedContent);

console.log(`Fixed flattened file written to ${fixedPath}`);
