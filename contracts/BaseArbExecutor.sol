// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWETH9 is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

interface IUniswapV3SwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IAerodromeRouter {
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

/// @title BaseArbExecutor
/// @notice Owner-only atomic WETH/USDC arbitrage executor for Base.
/// @dev Capital enters as native ETH for a single call, is wrapped to WETH, routed
///      across Uniswap V3 and Aerodrome, and is returned as native ETH only if the
///      final WETH balance exceeds the starting capital by `minProfitWei`.
///      If either swap, slippage floor, or profit floor fails, the whole transaction
///      reverts atomically. The only unavoidable loss on a reverted attempt is gas.
contract BaseArbExecutor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BASE_CHAIN_ID = 8453;
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant UNISWAP_SWAP_ROUTER_02 = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address public constant AERODROME_ROUTER = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    address public constant AERODROME_FACTORY = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da;

    uint256 public constant MAX_DEADLINE_WINDOW = 5 minutes;
    uint256 public constant MAX_CAPITAL_PER_CALL = 25 ether;

    event ArbitrageExecuted(
        bytes32 indexed route,
        uint256 capitalWei,
        uint256 finalWei,
        uint256 grossProfitWei,
        uint256 minProfitWei
    );
    event DustSwept(address indexed token, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {
        require(block.chainid == BASE_CHAIN_ID, "Base only");
        require(initialOwner != address(0), "Owner required");

        IERC20(WETH).forceApprove(UNISWAP_SWAP_ROUTER_02, type(uint256).max);
        IERC20(USDC).forceApprove(UNISWAP_SWAP_ROUTER_02, type(uint256).max);
        IERC20(WETH).forceApprove(AERODROME_ROUTER, type(uint256).max);
        IERC20(USDC).forceApprove(AERODROME_ROUTER, type(uint256).max);
    }

    /// @notice Uniswap WETH->USDC, then Aerodrome USDC->WETH.
    function executeUniThenAero(
        uint24 uniFee,
        bool aeroStable,
        uint256 minUsdcOut,
        uint256 minWethOut,
        uint256 minProfitWei,
        uint256 deadline
    ) external payable onlyOwner nonReentrant returns (uint256 grossProfitWei) {
        uint256 capitalWei = _start(deadline);
        IWETH9(WETH).deposit{value: capitalWei}();

        uint256 usdcOut = IUniswapV3SwapRouter02(UNISWAP_SWAP_ROUTER_02).exactInputSingle(
            IUniswapV3SwapRouter02.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: uniFee,
                recipient: address(this),
                amountIn: capitalWei,
                amountOutMinimum: minUsdcOut,
                sqrtPriceLimitX96: 0
            })
        );
        require(usdcOut >= minUsdcOut, "First leg slippage");

        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({
            from: USDC,
            to: WETH,
            stable: aeroStable,
            factory: AERODROME_FACTORY
        });
        IAerodromeRouter(AERODROME_ROUTER).swapExactTokensForTokens(
            usdcOut,
            minWethOut,
            routes,
            address(this),
            deadline
        );

        grossProfitWei = _finish(capitalWei, minProfitWei, keccak256("UNI_TO_AERO"));
    }

    /// @notice Aerodrome WETH->USDC, then Uniswap USDC->WETH.
    function executeAeroThenUni(
        uint24 uniFee,
        bool aeroStable,
        uint256 minUsdcOut,
        uint256 minWethOut,
        uint256 minProfitWei,
        uint256 deadline
    ) external payable onlyOwner nonReentrant returns (uint256 grossProfitWei) {
        uint256 capitalWei = _start(deadline);
        IWETH9(WETH).deposit{value: capitalWei}();

        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({
            from: WETH,
            to: USDC,
            stable: aeroStable,
            factory: AERODROME_FACTORY
        });
        uint256[] memory amounts = IAerodromeRouter(AERODROME_ROUTER).swapExactTokensForTokens(
            capitalWei,
            minUsdcOut,
            routes,
            address(this),
            deadline
        );
        uint256 usdcOut = amounts[amounts.length - 1];
        require(usdcOut >= minUsdcOut, "First leg slippage");

        uint256 wethOut = IUniswapV3SwapRouter02(UNISWAP_SWAP_ROUTER_02).exactInputSingle(
            IUniswapV3SwapRouter02.ExactInputSingleParams({
                tokenIn: USDC,
                tokenOut: WETH,
                fee: uniFee,
                recipient: address(this),
                amountIn: usdcOut,
                amountOutMinimum: minWethOut,
                sqrtPriceLimitX96: 0
            })
        );
        require(wethOut >= minWethOut, "Second leg slippage");

        grossProfitWei = _finish(capitalWei, minProfitWei, keccak256("AERO_TO_UNI"));
    }

    function _start(uint256 deadline) internal view returns (uint256 capitalWei) {
        capitalWei = msg.value;
        require(capitalWei > 0, "Capital required");
        require(capitalWei <= MAX_CAPITAL_PER_CALL, "Capital limit");
        require(deadline >= block.timestamp, "Expired");
        require(deadline <= block.timestamp + MAX_DEADLINE_WINDOW, "Deadline too far");
        require(IERC20(WETH).balanceOf(address(this)) == 0, "WETH dust present");
        require(IERC20(USDC).balanceOf(address(this)) == 0, "USDC dust present");
    }

    function _finish(uint256 capitalWei, uint256 minProfitWei, bytes32 route)
        internal
        returns (uint256 grossProfitWei)
    {
        uint256 finalWeth = IERC20(WETH).balanceOf(address(this));
        require(finalWeth >= capitalWei + minProfitWei, "Profit floor not met");
        require(IERC20(USDC).balanceOf(address(this)) == 0, "USDC dust after trade");

        grossProfitWei = finalWeth - capitalWei;
        IWETH9(WETH).withdraw(finalWeth);
        (bool sent,) = payable(owner()).call{value: finalWeth}("");
        require(sent, "ETH return failed");

        emit ArbitrageExecuted(route, capitalWei, finalWeth, grossProfitWei, minProfitWei);
    }

    /// @notice Owner recovery for unexpected token dust. Never used in the normal trade path.
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
