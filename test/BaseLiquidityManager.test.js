const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('BaseLiquidityManager', function () {
  async function deploy() {
    const [owner, operator, treasuryOwner, stranger, recipient] = await ethers.getSigners();

    const Token = await ethers.getContractFactory('MockLiquidityToken');
    const tokenA = await Token.deploy('Token A', 'TKA', 18);
    const tokenB = await Token.deploy('Token B', 'TKB', 6);
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();

    const a = await tokenA.getAddress();
    const b = await tokenB.getAddress();
    const [token0, token1] = BigInt(a) < BigInt(b) ? [tokenA, tokenB] : [tokenB, tokenA];

    const Factory = await ethers.getContractFactory('MockV3Factory');
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.setFeeTier(3000, 60);
    await factory.setPool(await token0.getAddress(), await token1.getAddress(), 3000, stranger.address);

    const PositionManager = await ethers.getContractFactory('MockPositionManager');
    const positionManager = await PositionManager.deploy(await factory.getAddress());
    await positionManager.waitForDeployment();

    const Treasury = await ethers.getContractFactory('BaseLiquidityTreasury');
    const treasury = await Treasury.deploy(
      treasuryOwner.address,
      await token0.getAddress(),
      await token1.getAddress()
    );
    await treasury.waitForDeployment();

    const Manager = await ethers.getContractFactory('BaseLiquidityManager');
    const manager = await Manager.deploy(
      owner.address,
      operator.address,
      await treasury.getAddress(),
      await positionManager.getAddress(),
      await factory.getAddress(),
      await token0.getAddress(),
      await token1.getAddress(),
      200,
      300,
      500,
      700,
      3
    );
    await manager.waitForDeployment();

    await token0.mint(owner.address, 2_000);
    await token1.mint(owner.address, 2_000);
    await token0.connect(owner).approve(await manager.getAddress(), 1_000);
    await token1.connect(owner).approve(await manager.getAddress(), 1_000);
    await manager.connect(owner).depositCapital(await token0.getAddress(), 1_000);
    await manager.connect(owner).depositCapital(await token1.getAddress(), 1_000);

    return { owner, operator, treasuryOwner, stranger, recipient, token0, token1, factory, positionManager, treasury, manager };
  }

  async function openDefault(ctx, overrides = {}) {
    const latest = await ethers.provider.getBlock('latest');
    const values = {
      fee: 3000,
      tickLower: -600,
      tickUpper: 600,
      amount0Desired: 100,
      amount1Desired: 200,
      amount0Min: 90,
      amount1Min: 180,
      durationSeconds: 60,
      deadline: latest.timestamp + 120,
      ...overrides,
    };
    await ctx.manager.connect(ctx.operator).openPosition(
      values.fee,
      values.tickLower,
      values.tickUpper,
      values.amount0Desired,
      values.amount1Desired,
      values.amount0Min,
      values.amount1Min,
      values.durationSeconds,
      values.deadline
    );
    return values;
  }

  it('opens from pre-funded inventory and routes principal plus fees to treasury on close', async function () {
    const ctx = await deploy();
    await expect(openDefault(ctx)).to.emit(ctx.manager, 'PositionOpened');

    const p = await ctx.manager.positions(1);
    expect(p.active).to.equal(true);
    expect(p.principal0).to.equal(100);
    expect(p.principal1).to.equal(200);
    expect(await ctx.manager.allocatedToken0()).to.equal(100);
    expect(await ctx.manager.allocatedToken1()).to.equal(200);

    await ctx.positionManager.addFees(p.tokenId, 11, 17);
    const latest = await ethers.provider.getBlock('latest');
    await expect(ctx.manager.connect(ctx.operator).closePosition(1, 90, 180, latest.timestamp + 120))
      .to.emit(ctx.manager, 'PositionClosed');

    expect(await ctx.token0.balanceOf(await ctx.treasury.getAddress())).to.equal(111);
    expect(await ctx.token1.balanceOf(await ctx.treasury.getAddress())).to.equal(217);
    expect(await ctx.manager.allocatedToken0()).to.equal(0);
    expect(await ctx.manager.allocatedToken1()).to.equal(0);
    expect(await ctx.manager.activePositions()).to.equal(0);
  });

  it('lets the operator close but never withdraw treasury assets', async function () {
    const ctx = await deploy();
    await openDefault(ctx);
    const p = await ctx.manager.positions(1);
    await ctx.positionManager.addFees(p.tokenId, 5, 7);
    await ctx.manager.connect(ctx.operator).emergencyClose(1);

    await expect(
      ctx.treasury.connect(ctx.operator).withdrawToken(await ctx.token0.getAddress(), 1, ctx.operator.address)
    ).to.be.revertedWithCustomError(ctx.treasury, 'OwnableUnauthorizedAccount').withArgs(ctx.operator.address);

    await ctx.treasury.connect(ctx.treasuryOwner).withdrawToken(
      await ctx.token0.getAddress(),
      105,
      ctx.recipient.address
    );
    expect(await ctx.token0.balanceOf(ctx.recipient.address)).to.equal(105);
  });

  it('enforces position, allocation, active-count, and tick-alignment caps', async function () {
    const ctx = await deploy();
    const latest = await ethers.provider.getBlock('latest');

    await expect(ctx.manager.connect(ctx.operator).openPosition(
      3000, -600, 600, 201, 1, 0, 0, 60, latest.timestamp + 120
    )).to.be.revertedWith('Per-position cap');

    await expect(ctx.manager.connect(ctx.operator).openPosition(
      3000, -601, 600, 100, 100, 0, 0, 60, latest.timestamp + 120
    )).to.be.revertedWith('Ticks not aligned');

    await openDefault(ctx, { amount0Desired: 200, amount1Desired: 200 });
    await openDefault(ctx, { amount0Desired: 200, amount1Desired: 200 });
    await expect(openDefault(ctx, { amount0Desired: 200, amount1Desired: 200 }))
      .to.be.rejectedWith('Token0 allocation cap');
  });

  it('pauses new exposure while preserving emergency exit', async function () {
    const ctx = await deploy();
    await openDefault(ctx);
    await ctx.manager.connect(ctx.owner).pause();

    await expect(openDefault(ctx)).to.be.revertedWithCustomError(ctx.manager, 'EnforcedPause');
    await expect(ctx.manager.connect(ctx.operator).emergencyClose(1)).to.emit(ctx.manager, 'PositionClosed');
  });

  it('allows permissionless expiry cleanup but still routes all proceeds to treasury', async function () {
    const ctx = await deploy();
    await openDefault(ctx, { durationSeconds: 5 });
    const p = await ctx.manager.positions(1);
    await ctx.positionManager.addFees(p.tokenId, 3, 4);

    await expect(ctx.manager.connect(ctx.stranger).closeExpired(1)).to.be.revertedWith('Position not expired');
    await ethers.provider.send('evm_increaseTime', [6]);
    await ethers.provider.send('evm_mine', []);

    await ctx.manager.connect(ctx.stranger).closeExpired(1);
    expect(await ctx.token0.balanceOf(await ctx.treasury.getAddress())).to.equal(103);
    expect(await ctx.token1.balanceOf(await ctx.treasury.getAddress())).to.equal(204);
  });
});
