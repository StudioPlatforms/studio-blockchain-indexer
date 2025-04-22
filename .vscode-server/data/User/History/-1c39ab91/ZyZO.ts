import { blockchainCore } from './core';
import { tokenService } from './tokens';
import * as types from './types';

// Re-export everything from the blockchain service
export * from './types';
export * from './abis';

// Create a combined blockchain service that includes both core and token functionality
class BlockchainService {
    // Core blockchain methods
    getLatestBlockNumber = blockchainCore.getLatestBlockNumber.bind(blockchainCore);
    getBlock = blockchainCore.getBlock.bind(blockchainCore);
    getBlockWithTransactions = blockchainCore.getBlockWithTransactions.bind(blockchainCore);
    getTransaction = blockchainCore.getTransaction.bind(blockchainCore);
    getTransactionReceipt = blockchainCore.getTransactionReceipt.bind(blockchainCore);
    getCode = blockchainCore.getCode.bind(blockchainCore);
    getBalance = blockchainCore.getBalance.bind(blockchainCore);
    isContract = blockchainCore.isContract.bind(blockchainCore);
    getContractCreationInfo = blockchainCore.getContractCreationInfo.bind(blockchainCore);
    getLogs = blockchainCore.getLogs.bind(blockchainCore);
    getPendingTransactions = blockchainCore.getPendingTransactions.bind(blockchainCore);
    callContractMethod = blockchainCore.callContractMethod.bind(blockchainCore);
    getProvider = blockchainCore.getProvider.bind(blockchainCore);
    shutdown = blockchainCore.shutdown.bind(blockchainCore);

    // Token methods
    getTokenTransfersFromReceipt = tokenService.getTokenTransfersFromReceipt.bind(tokenService);
    getTokenType = tokenService.getTokenType.bind(tokenService);
    getTokenName = tokenService.getTokenName.bind(tokenService);
    getTokenSymbol = tokenService.getTokenSymbol.bind(tokenService);
    getTokenDecimals = tokenService.getTokenDecimals.bind(tokenService);
    getTokenTotalSupply = tokenService.getTokenTotalSupply.bind(tokenService);
    getTokenURI = tokenService.getTokenURI.bind(tokenService);
    getTokenMetadata = tokenService.getTokenMetadata.bind(tokenService);
    getTokenBalance = tokenService.getTokenBalance.bind(tokenService);
    getTokenHolders = tokenService.getTokenHolders.bind(tokenService);
    getContractOwner = tokenService.getContractOwner.bind(tokenService);
    detectNewContracts = tokenService.detectNewContracts.bind(tokenService);
    getAddressTokenBalances = tokenService.getAddressTokenBalances.bind(tokenService);
    getKnownTokenAddresses = tokenService.getKnownTokenAddresses.bind(tokenService);
    updateTokenBalancesForAddress = tokenService.updateTokenBalancesForAddress.bind(tokenService);
}

export const blockchain = new BlockchainService();
