const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to the contract to flatten
const contractPath = path.join(__dirname, '../contracts/SwapRouter.sol');
const outputPath = path.join(__dirname, '../flattened/SwapRouter_hardhat.sol');

// Create the flattened directory if it doesn't exist
const flattenedDir = path.join(__dirname, '../flattened');
if (!fs.existsSync(flattenedDir)) {
  fs.mkdirSync(flattenedDir);
}

// Command to run Hardhat's flattener
const command = `cd ${path.join(__dirname, '..')} && npx hardhat flatten ${contractPath} > ${outputPath}`;

console.log(`Running command: ${command}`);

// Execute the command
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
    return;
  }
  console.log(`Flattened contract written to: ${outputPath}`);
  
  // Fix license identifiers (Hardhat flattener adds multiple SPDX license identifiers)
  const content = fs.readFileSync(outputPath, 'utf8');
  const fixedContent = content.replace(/\/\/ SPDX-License-Identifier: .+\n/g, '');
  fs.writeFileSync(outputPath, '// SPDX-License-Identifier: GPL-2.0-or-later\n\n' + fixedContent);
  
  console.log('Fixed license identifiers');
});
