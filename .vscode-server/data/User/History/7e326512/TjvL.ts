// This file is now a re-export of the modular blockchain service
// It's maintained for backward compatibility

import { blockchain } from './blockchain/index';
export * from './blockchain/index';

// Export the blockchain service as the default export
export default blockchain;
