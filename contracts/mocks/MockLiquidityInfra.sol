// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockLiquidityToken is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockV3Factory {
    mapping(uint24 => int24) public feeAmountTickSpacing;
    mapping(bytes32 => address) private pools;

    function setFeeTier(uint24 fee, int24 spacing) external {
        feeAmountTickSpacing[fee] = spacing;
    }

    function setPool(address tokenA, address tokenB, uint24 fee, address pool) external {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        pools[keccak256(abi.encode(token0, token1, fee))] = pool;
    }

    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return pools[keccak256(abi.encode(token0, token1, fee))];
    }
}

contract MockPositionManager {
    using SafeERC20 for IERC20;

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

    struct PositionData {
        address owner;
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 principal0;
        uint256 principal1;
        uint256 owed0;
        uint256 owed1;
        bool decreased;
    }

    address public immutable factory;
    uint256 public nextTokenId = 1;
    mapping(uint256 => PositionData) public data;

    constructor(address factory_) {
        factory = factory_;
    }

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        require(block.timestamp <= params.deadline, "Expired");
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        if (amount0 > 0) IERC20(params.token0).safeTransferFrom(msg.sender, address(this), amount0);
        if (amount1 > 0) IERC20(params.token1).safeTransferFrom(msg.sender, address(this), amount1);
        require(amount0 >= params.amount0Min && amount1 >= params.amount1Min, "Mint minima");

        tokenId = nextTokenId++;
        uint256 seed = amount0 + amount1;
        liquidity = uint128(seed > type(uint128).max ? type(uint128).max : seed);
        if (liquidity == 0) liquidity = 1;
        data[tokenId] = PositionData({
            owner: params.recipient,
            token0: params.token0,
            token1: params.token1,
            fee: params.fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: liquidity,
            principal0: amount0,
            principal1: amount1,
            owed0: 0,
            owed1: 0,
            decreased: false
        });
    }

    function addFees(uint256 tokenId, uint256 fee0, uint256 fee1) external {
        PositionData storage p = data[tokenId];
        require(p.owner != address(0), "Missing position");
        if (fee0 > 0) MockLiquidityToken(p.token0).mint(address(this), fee0);
        if (fee1 > 0) MockLiquidityToken(p.token1).mint(address(this), fee1);
        p.owed0 += fee0;
        p.owed1 += fee1;
    }

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        PositionData storage p = data[params.tokenId];
        require(msg.sender == p.owner, "Not position owner");
        require(!p.decreased, "Already decreased");
        require(params.liquidity == p.liquidity, "Liquidity mismatch");
        require(block.timestamp <= params.deadline, "Expired");
        amount0 = p.principal0;
        amount1 = p.principal1;
        require(amount0 >= params.amount0Min && amount1 >= params.amount1Min, "Decrease minima");
        p.owed0 += amount0;
        p.owed1 += amount1;
        p.liquidity = 0;
        p.decreased = true;
    }

    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1) {
        PositionData storage p = data[params.tokenId];
        require(msg.sender == p.owner, "Not position owner");
        amount0 = p.owed0 > params.amount0Max ? params.amount0Max : p.owed0;
        amount1 = p.owed1 > params.amount1Max ? params.amount1Max : p.owed1;
        p.owed0 -= amount0;
        p.owed1 -= amount1;
        if (amount0 > 0) IERC20(p.token0).safeTransfer(params.recipient, amount0);
        if (amount1 > 0) IERC20(p.token1).safeTransfer(params.recipient, amount1);
    }

    function burn(uint256 tokenId) external payable {
        PositionData storage p = data[tokenId];
        require(msg.sender == p.owner, "Not position owner");
        require(p.liquidity == 0 && p.owed0 == 0 && p.owed1 == 0, "Position not empty");
        delete data[tokenId];
    }
}
