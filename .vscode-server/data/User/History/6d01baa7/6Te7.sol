// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

// ReentrancyGuard.sol
contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

// Pausable.sol
abstract contract Pausable {
    event Paused(address account);
    event Unpaused(address account);

    bool private _paused;

    constructor() {
        _paused = false;
    }

    function paused() public view virtual returns (bool) {
        return _paused;
    }

    modifier whenNotPaused() {
        require(!paused(), "Pausable: paused");
        _;
    }

    modifier whenPaused() {
        require(paused(), "Pausable: not paused");
        _;
    }

    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }
}

// Ownable.sol
abstract contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        _transferOwnership(msg.sender);
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(owner() == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// IERC20.sol
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// ERC20SafeFixed.sol
abstract contract ERC20SafeFixed {
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        // bytes4(keccak256(bytes('transfer(address,uint256)')));
        (bool success, bytes memory data) = address(token).call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ERC20SafeFixed: transfer failed");
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        // bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));
        (bool success, bytes memory data) = address(token).call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ERC20SafeFixed: transferFrom failed");
    }

    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        // bytes4(keccak256(bytes('approve(address,uint256)')));
        (bool success, bytes memory data) = address(token).call(abi.encodeWithSelector(0x095ea7b3, spender, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ERC20SafeFixed: approve failed");
    }
}

/**
 * @title StudioPresale
 * @dev Contract for the Studio token presale
 * Modified to use ERC20SafeFixed for compatibility with non-standard ERC20 tokens like USDT
 * Features:
 * - Accept USDT deposits for STO tokens
 * - Dynamic pricing based on total raised
 * - Top 10 contributors get 1.5x tokens
 * - Vesting schedule: 20% immediate, 20% monthly for 4 months
 * - Emergency withdrawal with 20% penalty
 * - Refund capability if presale is canceled
 */
contract StudioPresale is ReentrancyGuard, Pausable, Ownable, ERC20SafeFixed {
    // USDT token address
    IERC20 public usdtToken;
    
    // Base token price in USDT (6 decimals)
    // 0.06 USDT per STO token = 60000 (with 6 decimals)
    uint256 public baseTokenPrice;
    
    // Final token price (calculated when presale is finalized)
    uint256 public finalTokenPrice;
    
    // Minimum purchase amount in USDT (6 decimals)
    // $50 = 50000000 (with 6 decimals)
    uint256 public minPurchaseAmount;
    
    // Target raise amount in USDT (6 decimals)
    // $1.2M = 1200000000000 (with 6 decimals)
    uint256 public targetRaiseAmount;
    
    // Total tokens allocated for presale (18 decimals)
    // 20M tokens = 20000000000000000000000000 (with 18 decimals)
    uint256 public totalTokensAllocated;
    
    // Presale status
    enum PresaleStatus { Active, FilledSuccessfully, Canceled }
    PresaleStatus public presaleStatus;
    
    // Total USDT raised (6 decimals)
    uint256 public totalRaised;
    
    // Number of unique contributors
    uint256 public contributorsCount;
    
    // Running total of base tokens needed (for gas optimization)
    uint256 public totalBaseTokensNeeded;
    
    // Vesting configuration
    uint256 public immediateClaim; // Percentage available immediately (20%)
    uint256 public vestingPeriods; // Number of vesting periods (4)
    uint256 public vestingDuration; // Duration of each vesting period in seconds (30 days)
    uint256 public presaleEndTime; // Timestamp when presale was marked filled/canceled
    
    // Leaderboard bonus multiplier (150 = 1.5x)
    uint256 public leaderboardBonusMultiplier = 150;
    
    // Number of top contributors for leaderboard
    uint256 public constant LEADERBOARD_SIZE = 10;
    
    // Gas limit for leaderboard updates
    uint256 private constant GAS_LIMIT_LEADERBOARD = 3000000;
    
    // STO balance tracking
    uint256 public stoBalance;
    
    // Contributor data
    struct Contributor {
        uint256 usdtContributed; // Amount of USDT contributed
        uint256 tokensWithdrawn; // Tokens already withdrawn
        uint256 lastClaimTime; // Last time tokens were claimed
        bool hasWithdrawn; // Whether the contributor has withdrawn in case of cancellation
        uint256 leaderboardPosition; // Position in leaderboard (0 if not in top 10)
    }
    
    // Mapping of contributor address to contributor data
    mapping(address => Contributor) public contributors;
    
    // Mapping to track unique contributors
    mapping(address => bool) public isContributor;
    
    // Array of all contributor addresses
    address[] public contributorsList;
    
    // Array of top contributors (sorted by contribution amount)
    address[LEADERBOARD_SIZE] public topContributors;
    
    // Events
    event Contribution(address indexed contributor, uint256 usdtAmount);
    event TokensClaimed(address indexed contributor, uint256 amount);
    event EmergencyWithdrawal(address indexed contributor, uint256 usdtAmount, uint256 penaltyAmount);
    event PresaleStatusChanged(PresaleStatus newStatus);
    event VestingParametersUpdated(uint256 immediateClaim, uint256 vestingPeriods, uint256 vestingDuration);
    event RefundClaimed(address indexed contributor, uint256 usdtAmount);
    event LeaderboardUpdated(address indexed contributor, uint256 position);
    event FundsWithdrawn(uint256 amount);
    event STODeposited(uint256 amount);
    event TokensRecovered(address token, uint256 amount);
    event NativeSTORecovered(uint256 amount);
    
    /**
     * @dev Constructor
     * @param _usdtToken USDT token address
     * @param _baseTokenPrice Base token price in USDT (6 decimals)
     * @param _minPurchaseAmount Minimum purchase amount in USDT (6 decimals)
     * @param _targetRaiseAmount Target raise amount in USDT (6 decimals)
     * @param _totalTokensAllocated Total tokens allocated for presale (18 decimals)
     */
    constructor(
        address _usdtToken,
        uint256 _baseTokenPrice,
        uint256 _minPurchaseAmount,
        uint256 _targetRaiseAmount,
        uint256 _totalTokensAllocated
    ) {
        usdtToken = IERC20(_usdtToken);
        baseTokenPrice = _baseTokenPrice;
        finalTokenPrice = _baseTokenPrice; // Initialize with base price
        minPurchaseAmount = _minPurchaseAmount;
        targetRaiseAmount = _targetRaiseAmount;
        totalTokensAllocated = _totalTokensAllocated;
        
        // Default vesting parameters
        immediateClaim = 20; // 20%
        vestingPeriods = 4; // 4 months
        vestingDuration = 30 days; // 30 days per period
        
        presaleStatus = PresaleStatus.Active;
    }
    
    /**
     * @dev Deposit STO tokens to the contract
     */
    function depositSTO() external payable onlyOwner {
        require(stoBalance + msg.value <= totalTokensAllocated, "Exceeds allocation");
        stoBalance += msg.value;
        emit STODeposited(msg.value);
    }
    
    /**
     * @dev Contribute USDT to the presale
     * @param usdtAmount Amount of USDT to contribute (6 decimals)
     */
    function contribute(uint256 usdtAmount) external nonReentrant whenNotPaused {
        // Validations
        require(presaleStatus == PresaleStatus.Active, "Presale is not active");
        require(usdtAmount >= minPurchaseAmount, "Contribution below minimum");
        
        // Calculate tokens at base price for cap check
        uint256 newTokenAmount = (usdtAmount * 1e18) / baseTokenPrice;
        uint256 newTotalBaseTokens = totalBaseTokensNeeded + newTokenAmount;
        
        // Calculate worst-case bonus tokens (if all top contributors get 1.5x)
        // Using most conservative approach: assume all tokens could get the bonus
        uint256 maxPossibleBonusTokens = (newTotalBaseTokens * LEADERBOARD_SIZE * 50) / 100;
        
        // Ensure we don't exceed total allocation
        require(newTotalBaseTokens + maxPossibleBonusTokens <= totalTokensAllocated, 
                "Exceeds token cap");
        
        // Update contributor data
        Contributor storage contributor = contributors[msg.sender];
        
        // If first time contributor, add to list
        if (!isContributor[msg.sender]) {
            contributorsList.push(msg.sender);
            contributorsCount++;
            isContributor[msg.sender] = true;
        }
        
        // Update contribution amounts
        contributor.usdtContributed += usdtAmount;
        
        // Update presale data
        totalRaised += usdtAmount;
        totalBaseTokensNeeded += newTokenAmount;
        
        // Always update leaderboard for accuracy
        updateLeaderboard(msg.sender, contributor.usdtContributed);
        
        // Transfer USDT from contributor to contract
        safeTransferFrom(usdtToken, msg.sender, address(this), usdtAmount);
        
        emit Contribution(msg.sender, usdtAmount);
    }
    
    /**
     * @dev Claim vested tokens
     */
    function claimTokens() external nonReentrant {
        require(presaleStatus == PresaleStatus.FilledSuccessfully, "Presale not successfully filled");
        
        Contributor storage contributor = contributors[msg.sender];
        require(contributor.usdtContributed > 0, "No contribution found");
        
        uint256 claimableAmount = getClaimableTokens(msg.sender);
        require(claimableAmount > 0, "No tokens available to claim");
        require(stoBalance >= claimableAmount, "Insufficient STO balance");
        
        contributor.tokensWithdrawn += claimableAmount;
        contributor.lastClaimTime = block.timestamp;
        
        // Update STO balance
        stoBalance -= claimableAmount;
        
        // Transfer native STO tokens to contributor
        (bool success, ) = msg.sender.call{value: claimableAmount}("");
        require(success, "Native token transfer failed");
        
        emit TokensClaimed(msg.sender, claimableAmount);
    }
    
    /**
     * @dev Safe multiplication followed by division to prevent intermediate overflow
     * @param x First multiplication operand
     * @param y Second multiplication operand
     * @param denominator Division operand
     * @return result (x * y) / denominator with 512-bit precision in the intermediate steps
     */
    function mulDiv(
        uint256 x,
        uint256 y,
        uint256 denominator
    ) internal pure returns (uint256 result) {
        unchecked {
            // 512-bit multiply [prod1 prod0] = x * y
            // prod1 is the high 256 bits, prod0 is the low 256 bits
            uint256 prod0; // low 256 bits
            uint256 prod1; // high 256 bits
            assembly {
                let mm := mulmod(x, y, not(0))
                prod0 := mul(x, y)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }

            // Handle non-overflow cases, 256-bit division
            if (prod1 == 0) {
                require(denominator > 0, "denominator=0");
                assembly {
                    result := div(prod0, denominator)
                }
                return result;
            }

            // Make sure the result is less than 2^256.
            // Also prevents denominator == 0
            require(denominator > prod1, "overflow");

            ///////////////////////////////////////////////
            // 512 by 256 division.
            ///////////////////////////////////////////////

            // Make division exact by subtracting the remainder from [prod1 prod0].
            uint256 remainder;
            assembly {
                remainder := mulmod(x, y, denominator)
            }
            assembly {
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }

            // Factor powers of two out of denominator
            // Compute largest power of two divisor of denominator (always >= 1)
            uint256 twos = denominator & (~denominator + 1);
            assembly {
                denominator := div(denominator, twos)
                prod0 := div(prod0, twos)
                twos := add(div(sub(0, twos), twos), 1)
            }
            prod0 |= prod1 * twos;

            // Invert denominator mod 2^256
