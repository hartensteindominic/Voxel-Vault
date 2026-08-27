// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IUniswapV3FactoryLike {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
    function feeAmountTickSpacing(uint24 fee) external view returns (int24 spacing);
}

interface INonfungiblePositionManagerLike {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function factory() external view returns (address);
    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);
    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);
    function burn(uint256 tokenId) external payable;
}

/// @title BaseLiquidityManager
/// @notice Bounded Uniswap V3 concentrated-liquidity manager intended for Base.
/// @dev This contract does not discover pools, predict profits, swap inventory, borrow,
///      or sign autonomously. A configured operator may only deploy already-deposited
///      capital within owner-defined caps and close existing positions. All recovered
///      principal and fees are routed directly to the treasury in their native tokens.
contract BaseLiquidityManager is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_DEADLINE_WINDOW = 5 minutes;
    uint256 public constant MAX_POSITION_DURATION = 30 minutes;
    uint256 public constant MIN_POSITION_DURATION = 5 seconds;
    uint256 public constant MAX_TICK_SPACING_MULTIPLIER = 100;
    uint256 public constant MAX_ACTIVE_POSITIONS_HARD = 16;

    struct Position {
        uint256 tokenId;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint64 openedAt;
        uint64 expiresAt;
        uint256 principal0;
        uint256 principal1;
        bool active;
    }

    address public operator;
    address public treasury;
    address public immutable token0;
    address public immutable token1;
    INonfungiblePositionManagerLike public immutable positionManager;
    IUniswapV3FactoryLike public immutable factory;

    uint256 public maxToken0PerPosition;
    uint256 public maxToken1PerPosition;
    uint256 public maxToken0Allocated;
    uint256 public maxToken1Allocated;
    uint256 public maxActivePositions;

    uint256 public allocatedToken0;
    uint256 public allocatedToken1;
    uint256 public activePositions;
    uint256 public nextPositionId = 1;

    mapping(uint256 => Position) public positions;

    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event LimitsUpdated(
        uint256 maxToken0PerPosition,
        uint256 maxToken1PerPosition,
        uint256 maxToken0Allocated,
        uint256 maxToken1Allocated,
        uint256 maxActivePositions
    );
    event CapitalDeposited(address indexed token, uint256 amount);
    event IdleCapitalWithdrawn(address indexed token, uint256 amount, address indexed recipient);
    event PositionOpened(
        uint256 indexed positionId,
        uint256 indexed tokenId,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 principal0,
        uint256 principal1,
        uint64 expiresAt
    );
    event PositionClosed(
        uint256 indexed positionId,
        uint256 indexed tokenId,
        uint256 amount0ToTreasury,
        uint256 amount1ToTreasury,
        bool emergency
    );

    modifier onlyOperatorOrOwner() {
        require(msg.sender == operator || msg.sender == owner(), "Operator or owner only");
        _;
    }

    constructor(
        address initialOwner,
        address initialOperator,
        address initialTreasury,
        address positionManager_,
        address factory_,
        address token0_,
        address token1_,
        uint256 maxToken0PerPosition_,
        uint256 maxToken1PerPosition_,
        uint256 maxToken0Allocated_,
        uint256 maxToken1Allocated_,
        uint256 maxActivePositions_
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "Owner required");
        require(initialTreasury != address(0), "Treasury required");
        require(positionManager_ != address(0) && factory_ != address(0), "Uniswap config required");
        require(token0_ != address(0) && token1_ != address(0) && token0_ < token1_, "Sorted tokens required");
        require(INonfungiblePositionManagerLike(positionManager_).factory() == factory_, "Factory mismatch");

        operator = initialOperator;
        treasury = initialTreasury;
        positionManager = INonfungiblePositionManagerLike(positionManager_);
        factory = IUniswapV3FactoryLike(factory_);
        token0 = token0_;
        token1 = token1_;
        _setLimits(
            maxToken0PerPosition_,
            maxToken1PerPosition_,
            maxToken0Allocated_,
            maxToken1Allocated_,
            maxActivePositions_
        );

        IERC20(token0_).forceApprove(positionManager_, type(uint256).max);
        IERC20(token1_).forceApprove(positionManager_, type(uint256).max);
    }

    function setOperator(address newOperator) external onlyOwner {
        address old = operator;
        operator = newOperator;
        emit OperatorUpdated(old, newOperator);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury required");
        address old = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(old, newTreasury);
    }

    function setLimits(
        uint256 maxToken0PerPosition_,
        uint256 maxToken1PerPosition_,
        uint256 maxToken0Allocated_,
        uint256 maxToken1Allocated_,
        uint256 maxActivePositions_
    ) external onlyOwner {
        _setLimits(
            maxToken0PerPosition_,
            maxToken1PerPosition_,
            maxToken0Allocated_,
            maxToken1Allocated_,
            maxActivePositions_
        );
    }

    function _setLimits(
        uint256 maxToken0PerPosition_,
        uint256 maxToken1PerPosition_,
        uint256 maxToken0Allocated_,
        uint256 maxToken1Allocated_,
        uint256 maxActivePositions_
    ) internal {
        require(maxToken0PerPosition_ > 0 && maxToken1PerPosition_ > 0, "Per-position caps required");
        require(maxToken0Allocated_ >= maxToken0PerPosition_, "Token0 total cap too low");
        require(maxToken1Allocated_ >= maxToken1PerPosition_, "Token1 total cap too low");
        require(maxActivePositions_ > 0 && maxActivePositions_ <= MAX_ACTIVE_POSITIONS_HARD, "Active-position cap invalid");
        require(maxToken0Allocated_ >= allocatedToken0 && maxToken1Allocated_ >= allocatedToken1, "Below current allocation");
        require(maxActivePositions_ >= activePositions, "Below active positions");

        maxToken0PerPosition = maxToken0PerPosition_;
        maxToken1PerPosition = maxToken1PerPosition_;
        maxToken0Allocated = maxToken0Allocated_;
        maxToken1Allocated = maxToken1Allocated_;
        maxActivePositions = maxActivePositions_;
        emit LimitsUpdated(
            maxToken0PerPosition_,
            maxToken1PerPosition_,
            maxToken0Allocated_,
            maxToken1Allocated_,
            maxActivePositions_
        );
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Pre-fund bounded capital. The operator never receives token custody.
    function depositCapital(address token, uint256 amount) external onlyOwner nonReentrant {
        require(token == token0 || token == token1, "Unsupported token");
        require(amount > 0, "Amount required");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit CapitalDeposited(token, amount);
    }

    /// @notice Owner recovery for idle, unallocated inventory only.
    function withdrawIdleCapital(address token, uint256 amount, address recipient) external onlyOwner nonReentrant {
        require(token == token0 || token == token1, "Unsupported token");
        require(recipient != address(0), "Recipient required");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(amount <= balance, "Insufficient idle balance");
        IERC20(token).safeTransfer(recipient, amount);
        emit IdleCapitalWithdrawn(token, amount, recipient);
    }

    /// @notice Opens one bounded WETH/USDC-style V3 position using already-deposited inventory.
    function openPosition(
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 durationSeconds,
        uint256 deadline
    ) external onlyOperatorOrOwner whenNotPaused nonReentrant returns (uint256 positionId) {
        require(amount0Desired > 0 || amount1Desired > 0, "Capital required");
        require(amount0Desired <= maxToken0PerPosition && amount1Desired <= maxToken1PerPosition, "Per-position cap");
        require(activePositions < maxActivePositions, "Active-position cap");
        require(durationSeconds >= MIN_POSITION_DURATION && durationSeconds <= MAX_POSITION_DURATION, "Duration invalid");
        _checkDeadline(deadline);

        int24 spacing = factory.feeAmountTickSpacing(fee);
        require(spacing > 0, "Unsupported fee tier");
        require(factory.getPool(token0, token1, fee) != address(0), "Pool not deployed");
        require(tickLower < tickUpper, "Tick order invalid");
        require(tickLower % spacing == 0 && tickUpper % spacing == 0, "Ticks not aligned");
        require(uint256(uint24(tickUpper - tickLower)) <= uint256(uint24(spacing)) * MAX_TICK_SPACING_MULTIPLIER, "Range too wide");
        require(allocatedToken0 + amount0Desired <= maxToken0Allocated, "Token0 allocation cap");
        require(allocatedToken1 + amount1Desired <= maxToken1Allocated, "Token1 allocation cap");
        require(IERC20(token0).balanceOf(address(this)) >= amount0Desired, "Token0 inventory low");
        require(IERC20(token1).balanceOf(address(this)) >= amount1Desired, "Token1 inventory low");

        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = positionManager.mint(
            INonfungiblePositionManagerLike.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                recipient: address(this),
                deadline: deadline
            })
        );
        require(liquidity > 0, "No liquidity minted");
        require(amount0 <= amount0Desired && amount1 <= amount1Desired, "Unexpected mint amounts");

        allocatedToken0 += amount0;
        allocatedToken1 += amount1;
        activePositions += 1;
        positionId = nextPositionId++;
        uint64 expiresAt = uint64(block.timestamp + durationSeconds);
        positions[positionId] = Position({
            tokenId: tokenId,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            openedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            principal0: amount0,
            principal1: amount1,
            active: true
        });

        emit PositionOpened(
            positionId,
            tokenId,
            fee,
            tickLower,
            tickUpper,
            liquidity,
            amount0,
            amount1,
            expiresAt
        );
    }

    function closePosition(
        uint256 positionId,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    ) external onlyOperatorOrOwner nonReentrant returns (uint256 amount0, uint256 amount1) {
        _checkDeadline(deadline);
        return _close(positionId, amount0Min, amount1Min, deadline, false);
    }

    /// @notice Fast exit with zero token minima. Useful when the range is breached.
    /// @dev Liquidity removal is not a token swap; proceeds are delivered as token0/token1.
    function emergencyClose(uint256 positionId) external onlyOperatorOrOwner nonReentrant returns (uint256 amount0, uint256 amount1) {
        return _close(positionId, 0, 0, block.timestamp, true);
    }

    /// @notice Anyone may unwind an expired position; all proceeds still go to treasury.
    function closeExpired(uint256 positionId) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        Position memory p = positions[positionId];
        require(p.active, "Position inactive");
        require(block.timestamp >= p.expiresAt, "Position not expired");
        return _close(positionId, 0, 0, block.timestamp, true);
    }

    function _close(
        uint256 positionId,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline,
        bool emergency
    ) internal returns (uint256 amount0, uint256 amount1) {
        Position storage p = positions[positionId];
        require(p.active, "Position inactive");

        positionManager.decreaseLiquidity(
            INonfungiblePositionManagerLike.DecreaseLiquidityParams({
                tokenId: p.tokenId,
                liquidity: p.liquidity,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: deadline
            })
        );

        (amount0, amount1) = positionManager.collect(
            INonfungiblePositionManagerLike.CollectParams({
                tokenId: p.tokenId,
                recipient: treasury,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        positionManager.burn(p.tokenId);

        allocatedToken0 -= p.principal0;
        allocatedToken1 -= p.principal1;
        activePositions -= 1;
        p.active = false;

        emit PositionClosed(positionId, p.tokenId, amount0, amount1, emergency);
    }

    function _checkDeadline(uint256 deadline) internal view {
        require(deadline >= block.timestamp, "Expired");
        require(deadline <= block.timestamp + MAX_DEADLINE_WINDOW, "Deadline too far");
    }
}
