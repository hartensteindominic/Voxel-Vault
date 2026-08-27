// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMultiWETH9 is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

interface IMultiUniswapV3SwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

interface IMultiAerodromeRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/// @title BaseMultiArbExecutor
/// @notice Owner-only atomic Base arbitrage across a fixed allowlist of liquid quote assets.
/// @dev Every trade starts and ends in WETH. The whole transaction reverts unless final WETH
///      covers the starting capital plus `minProfitWei`. Reverted attempts still cost gas.
contract BaseMultiArbExecutor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BASE_CHAIN_ID = 8453;
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant CBBTC = 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf;
    address public constant CBETH = 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22;
    address public constant AERO = 0x940181a94A35A4569E4529A3CDfB74e38FD98631;

    address public constant UNISWAP_SWAP_ROUTER_02 = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address public constant AERODROME_ROUTER = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    address public constant AERODROME_FACTORY = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da;

    uint256 public constant MAX_DEADLINE_WINDOW = 5 minutes;
    uint256 public constant MAX_CAPITAL_PER_CALL = 1 ether;

    event MultiArbitrageExecuted(
        bytes32 indexed route,
        address indexed quoteToken,
        uint256 capitalWei,
        uint256 finalWei,
        uint256 grossProfitWei,
        uint256 minProfitWei
    );
    event DustSwept(address indexed token, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {
        require(block.chainid == BASE_CHAIN_ID, "Base only");
        require(initialOwner != address(0), "Owner required");

        _approveToken(WETH);
        _approveToken(USDC);
        _approveToken(CBBTC);
        _approveToken(CBETH);
        _approveToken(AERO);
    }

    function isSupportedQuoteToken(address token) public pure returns (bool) {
        return token == USDC || token == CBBTC || token == CBETH || token == AERO;
    }

    /// @notice Uniswap WETH -> quote token, then Aerodrome quote token -> WETH.
    function executeUniThenAero(
        address quoteToken,
        uint24 uniFee,
        bool aeroStable,
        uint256 minQuoteOut,
        uint256 minWethOut,
        uint256 minProfitWei,
        uint256 deadline
    ) external payable onlyOwner nonReentrant returns (uint256 grossProfitWei) {
        uint256 capitalWei = _start(quoteToken, deadline);
        IMultiWETH9(WETH).deposit{value: capitalWei}();

        uint256 quoteOut = IMultiUniswapV3SwapRouter02(UNISWAP_SWAP_ROUTER_02).exactInputSingle(
            IMultiUniswapV3SwapRouter02.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: quoteToken,
                fee: uniFee,
                recipient: address(this),
                amountIn: capitalWei,
                amountOutMinimum: minQuoteOut,
                sqrtPriceLimitX96: 0
            })
        );
        require(quoteOut >= minQuoteOut, "First leg slippage");

        IMultiAerodromeRouter.Route[] memory routes = new IMultiAerodromeRouter.Route[](1);
        routes[0] = IMultiAerodromeRouter.Route({
            from: quoteToken,
            to: WETH,
            stable: aeroStable,
            factory: AERODROME_FACTORY
        });
        IMultiAerodromeRouter(AERODROME_ROUTER).swapExactTokensForTokens(
            quoteOut,
            minWethOut,
            routes,
            address(this),
            deadline
        );

        grossProfitWei = _finish(
            quoteToken,
            capitalWei,
            minProfitWei,
            keccak256("MULTI_UNI_TO_AERO")
        );
    }

    /// @notice Aerodrome WETH -> quote token, then Uniswap quote token -> WETH.
    function executeAeroThenUni(
        address quoteToken,
        uint24 uniFee,
        bool aeroStable,
        uint256 minQuoteOut,
        uint256 minWethOut,
        uint256 minProfitWei,
        uint256 deadline
    ) external payable onlyOwner nonReentrant returns (uint256 grossProfitWei) {
        uint256 capitalWei = _start(quoteToken, deadline);
        IMultiWETH9(WETH).deposit{value: capitalWei}();

        IMultiAerodromeRouter.Route[] memory routes = new IMultiAerodromeRouter.Route[](1);
        routes[0] = IMultiAerodromeRouter.Route({
            from: WETH,
            to: quoteToken,
            stable: aeroStable,
            factory: AERODROME_FACTORY
        });
        uint256[] memory amounts = IMultiAerodromeRouter(AERODROME_ROUTER).swapExactTokensForTokens(
            capitalWei,
            minQuoteOut,
            routes,
            address(this),
            deadline
        );
        uint256 quoteOut = amounts[amounts.length - 1];
        require(quoteOut >= minQuoteOut, "First leg slippage");

        uint256 wethOut = IMultiUniswapV3SwapRouter02(UNISWAP_SWAP_ROUTER_02).exactInputSingle(
            IMultiUniswapV3SwapRouter02.ExactInputSingleParams({
                tokenIn: quoteToken,
                tokenOut: WETH,
                fee: uniFee,
                recipient: address(this),
                amountIn: quoteOut,
                amountOutMinimum: minWethOut,
                sqrtPriceLimitX96: 0
            })
        );
        require(wethOut >= minWethOut, "Second leg slippage");

        grossProfitWei = _finish(
            quoteToken,
            capitalWei,
            minProfitWei,
            keccak256("MULTI_AERO_TO_UNI")
        );
    }

    function _approveToken(address token) internal {
        IERC20(token).forceApprove(UNISWAP_SWAP_ROUTER_02, type(uint256).max);
        IERC20(token).forceApprove(AERODROME_ROUTER, type(uint256).max);
    }

    function _start(address quoteToken, uint256 deadline) internal view returns (uint256 capitalWei) {
        require(isSupportedQuoteToken(quoteToken), "Unsupported quote token");
        capitalWei = msg.value;
        require(capitalWei > 0, "Capital required");
        require(capitalWei <= MAX_CAPITAL_PER_CALL, "Capital limit");
        require(deadline >= block.timestamp, "Expired");
        require(deadline <= block.timestamp + MAX_DEADLINE_WINDOW, "Deadline too far");
        require(IERC20(WETH).balanceOf(address(this)) == 0, "WETH dust present");
        require(IERC20(quoteToken).balanceOf(address(this)) == 0, "Quote dust present");
    }

    function _finish(
        address quoteToken,
        uint256 capitalWei,
        uint256 minProfitWei,
        bytes32 route
    ) internal returns (uint256 grossProfitWei) {
        uint256 finalWeth = IERC20(WETH).balanceOf(address(this));
        require(finalWeth >= capitalWei + minProfitWei, "Profit floor not met");
        require(IERC20(quoteToken).balanceOf(address(this)) == 0, "Quote dust after trade");

        grossProfitWei = finalWeth - capitalWei;
        IMultiWETH9(WETH).withdraw(finalWeth);
        (bool sent,) = payable(owner()).call{value: finalWeth}("");
        require(sent, "ETH return failed");

        emit MultiArbitrageExecuted(
            route,
            quoteToken,
            capitalWei,
            finalWeth,
            grossProfitWei,
            minProfitWei
        );
    }

    function sweepToken(address token) external onlyOwner nonReentrant {
        uint256 amount = IERC20(token).balanceOf(address(this));
        require(amount > 0, "No token balance");
        IERC20(token).safeTransfer(owner(), amount);
        emit DustSwept(token, amount);
    }

    function sweepETH() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        require(amount > 0, "No ETH balance");
        (bool sent,) = payable(owner()).call{value: amount}("");
        require(sent, "ETH sweep failed");
        emit DustSwept(address(0), amount);
    }

    receive() external payable {
        require(msg.sender == WETH, "Only WETH unwrap");
    }
}
