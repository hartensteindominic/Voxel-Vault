// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal Aave V3-compatible flash-loan surface.
/// @dev The pool address is never hard-coded. The owner must explicitly allow a pool first.
interface IAaveV3FlashPoolLike {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

/// @notice Owner-controlled execution vault for solo VoxelForge automation.
/// @dev There is no public/customer trading entry point. A cold owner controls all permissions
///      and withdrawals. An optional hot operator can run only profit-guarded flash plans against
///      a stricter operator-target allowlist, so the owner key does not need to live on a server.
contract SoloForgeVault is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_BATCH_CALLS = 64;

    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    mapping(address => bool) public allowedTargets;
    mapping(address => bool) public allowedOperatorTargets;
    mapping(address => bool) public allowedFlashPools;
    mapping(address => uint256) public operatorMinProfitByAsset;

    address public operator;

    bool private _flashActive;
    bool private _flashOperatorMode;
    address private _flashPool;
    address private _flashAsset;
    uint256 private _flashAmount;
    uint256 private _flashBaseline;
    uint256 private _flashEthBaseline;
    uint256 private _flashMinProfit;
    uint256 private _flashPremium;

    error InvalidAddress();
    error InvalidBatchSize(uint256 size);
    error TargetNotAllowed(address target);
    error OperatorTargetNotAllowed(address target);
    error FlashPoolNotAllowed(address pool);
    error FlashAlreadyActive();
    error InvalidFlashCallback();
    error InvalidFlashLoan();
    error UnauthorizedExecutor(address caller);
    error OperatorProfitFloorTooLow(uint256 requested, uint256 required);
    error CallFailed(uint256 index, address target, bytes reason);
    error EndingBalanceTooLow(uint256 actual, uint256 minimum);
    error FlashProfitTooLow(uint256 actual, uint256 required);
    error NativeBalanceDecreased(uint256 actual, uint256 minimum);
    error EthTransferFailed();

    event AllowedTargetUpdated(address indexed target, bool allowed);
    event AllowedOperatorTargetUpdated(address indexed target, bool allowed);
    event AllowedFlashPoolUpdated(address indexed pool, bool allowed);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event OperatorMinProfitUpdated(address indexed asset, uint256 minimumProfit);
    event BatchExecuted(uint256 indexed callCount, uint256 startingEthWei, uint256 endingEthWei);
    event FlashExecuted(
        address indexed pool,
        address indexed asset,
        uint256 amount,
        uint256 premium,
        uint256 profit,
        address executor
    );
    event EthWithdrawn(address indexed recipient, uint256 amount);
    event ERC20Withdrawn(address indexed token, address indexed recipient, uint256 amount);
    event ERC721Withdrawn(address indexed collection, address indexed recipient, uint256 tokenId);

    constructor(address initialOwner) Ownable(initialOwner) {}

    receive() external payable {}

    function setOperator(address newOperator) external onlyOwner {
        address previous = operator;
        operator = newOperator;
        emit OperatorUpdated(previous, newOperator);
    }

    function setOperatorMinProfit(address asset, uint256 minimumProfit) external onlyOwner {
        if (asset == address(0)) revert InvalidAddress();
        operatorMinProfitByAsset[asset] = minimumProfit;
        emit OperatorMinProfitUpdated(asset, minimumProfit);
    }

    function setAllowedTarget(address target, bool allowed) external onlyOwner {
        _validateTarget(target);
        allowedTargets[target] = allowed;
        if (!allowed && allowedOperatorTargets[target]) {
            allowedOperatorTargets[target] = false;
            emit AllowedOperatorTargetUpdated(target, false);
        }
        emit AllowedTargetUpdated(target, allowed);
    }

    function setAllowedTargets(address[] calldata targets, bool allowed) external onlyOwner {
        uint256 length = targets.length;
        for (uint256 i = 0; i < length; ++i) {
            address target = targets[i];
            _validateTarget(target);
            allowedTargets[target] = allowed;
            if (!allowed && allowedOperatorTargets[target]) {
                allowedOperatorTargets[target] = false;
                emit AllowedOperatorTargetUpdated(target, false);
            }
            emit AllowedTargetUpdated(target, allowed);
        }
    }

    /// @notice Give the hot operator access to a strict subset of owner-approved targets.
    function setAllowedOperatorTarget(address target, bool allowed) external onlyOwner {
        _validateTarget(target);
        if (allowed && !allowedTargets[target]) revert TargetNotAllowed(target);
        allowedOperatorTargets[target] = allowed;
        emit AllowedOperatorTargetUpdated(target, allowed);
    }

    function setAllowedFlashPool(address pool, bool allowed) external onlyOwner {
        _validateTarget(pool);
        allowedFlashPools[pool] = allowed;
        emit AllowedFlashPoolUpdated(pool, allowed);
    }

    /// @notice Execute an owner-approved batch using ETH already held by the vault.
    /// @dev Deliberately owner-only: the hot operator cannot use this unrestricted value path.
    function executeBatch(Call[] calldata calls, uint256 minEndingEthWei)
        external
        onlyOwner
        nonReentrant
        returns (bytes[] memory results)
    {
        _validateBatchSize(calls.length);
        uint256 startingBalance = address(this).balance;
        results = _executeCalls(calls, false);
        uint256 endingBalance = address(this).balance;
        if (endingBalance < minEndingEthWei) {
            revert EndingBalanceTooLow(endingBalance, minEndingEthWei);
        }
        emit BatchExecuted(calls.length, startingBalance, endingBalance);
    }

    /// @notice Execute an Aave V3-compatible flash loan with atomic repayment and profit guards.
    /// @dev Owner may execute directly. The optional operator can execute without the owner key,
    ///      but only against operator-approved targets and only at or above the owner's per-asset
    ///      profit floor. A listing alone cannot satisfy the guard because a listing is not proceeds.
    function executeAaveFlash(
        address pool,
        address asset,
        uint256 amount,
        Call[] calldata calls,
        uint256 minProfit
    ) external nonReentrant returns (uint256 profit) {
        if (_flashActive) revert FlashAlreadyActive();
        if (asset == address(0) || amount == 0) revert InvalidFlashLoan();
        if (!allowedFlashPools[pool]) revert FlashPoolNotAllowed(pool);
        _validateBatchSize(calls.length);

        bool operatorMode = msg.sender != owner();
        if (operatorMode) {
            if (msg.sender == address(0) || msg.sender != operator) revert UnauthorizedExecutor(msg.sender);
            uint256 requiredProfit = operatorMinProfitByAsset[asset];
            if (minProfit < requiredProfit) {
                revert OperatorProfitFloorTooLow(minProfit, requiredProfit);
            }
        }

        IERC20 token = IERC20(asset);
        uint256 baseline = token.balanceOf(address(this));
        uint256 ethBaseline = address(this).balance;

        _flashActive = true;
        _flashOperatorMode = operatorMode;
        _flashPool = pool;
        _flashAsset = asset;
        _flashAmount = amount;
        _flashBaseline = baseline;
        _flashEthBaseline = ethBaseline;
        _flashMinProfit = minProfit;
        _flashPremium = 0;

        IAaveV3FlashPoolLike(pool).flashLoanSimple(
            address(this),
            asset,
            amount,
            abi.encode(calls),
            0
        );

        uint256 finalBalance = token.balanceOf(address(this));
        uint256 requiredFinal = baseline + minProfit;
        if (finalBalance < requiredFinal) {
            revert FlashProfitTooLow(finalBalance, requiredFinal);
        }
        if (address(this).balance < ethBaseline) {
            revert NativeBalanceDecreased(address(this).balance, ethBaseline);
        }

        uint256 premium = _flashPremium;
        address executor = msg.sender;
        token.forceApprove(pool, 0);
        _clearFlashState();

        profit = finalBalance - baseline;
        emit FlashExecuted(pool, asset, amount, premium, profit, executor);
    }

    /// @notice Aave V3 simple-flash callback.
    /// @dev Only the active pool can enter this path and only for the exact initiated loan.
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        if (!_flashActive || msg.sender != _flashPool) revert InvalidFlashCallback();
        if (initiator != address(this) || asset != _flashAsset || amount != _flashAmount) {
            revert InvalidFlashLoan();
        }

        Call[] memory calls = abi.decode(params, (Call[]));
        _validateBatchSize(calls.length);
        _executeCalls(calls, _flashOperatorMode);

        uint256 repayment = amount + premium;
        uint256 requiredBeforeRepayment = _flashBaseline + repayment + _flashMinProfit;
        uint256 actualBalance = IERC20(asset).balanceOf(address(this));
        if (actualBalance < requiredBeforeRepayment) {
            revert FlashProfitTooLow(actualBalance, requiredBeforeRepayment);
        }
        if (address(this).balance < _flashEthBaseline) {
            revert NativeBalanceDecreased(address(this).balance, _flashEthBaseline);
        }

        _flashPremium = premium;
        IERC20(asset).forceApprove(msg.sender, repayment);
        return true;
    }

    function withdrawETH(address payable recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        (bool sent,) = recipient.call{value: amount}("");
        if (!sent) revert EthTransferFailed();
        emit EthWithdrawn(recipient, amount);
    }

    function withdrawERC20(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(0) || recipient == address(0)) revert InvalidAddress();
        IERC20(token).safeTransfer(recipient, amount);
        emit ERC20Withdrawn(token, recipient, amount);
    }

    function withdrawERC721(address collection, address recipient, uint256 tokenId) external onlyOwner nonReentrant {
        if (collection == address(0) || recipient == address(0)) revert InvalidAddress();
        IERC721(collection).safeTransferFrom(address(this), recipient, tokenId);
        emit ERC721Withdrawn(collection, recipient, tokenId);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function _executeCalls(Call[] memory calls, bool operatorMode) internal returns (bytes[] memory results) {
        uint256 length = calls.length;
        results = new bytes[](length);
        for (uint256 i = 0; i < length; ++i) {
            Call memory item = calls[i];
            if (!allowedTargets[item.target]) revert TargetNotAllowed(item.target);
            if (operatorMode && !allowedOperatorTargets[item.target]) {
                revert OperatorTargetNotAllowed(item.target);
            }
            (bool success, bytes memory result) = item.target.call{value: item.value}(item.data);
            if (!success) revert CallFailed(i, item.target, result);
            results[i] = result;
        }
    }

    function _validateBatchSize(uint256 size) internal pure {
        if (size == 0 || size > MAX_BATCH_CALLS) revert InvalidBatchSize(size);
    }

    function _validateTarget(address target) internal view {
        if (target == address(0) || target == address(this)) revert InvalidAddress();
    }

    function _clearFlashState() internal {
        _flashActive = false;
        _flashOperatorMode = false;
        _flashPool = address(0);
        _flashAsset = address(0);
        _flashAmount = 0;
        _flashBaseline = 0;
        _flashEthBaseline = 0;
        _flashMinProfit = 0;
        _flashPremium = 0;
    }
}
