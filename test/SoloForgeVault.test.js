const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('SoloForgeVault', function () {
  let owner;
  let operator;
  let other;
  let asset;
  let pool;
  let revenue;
  let vault;

  const flashAmount = ethers.parseEther('100');
  const premiumBps = 10n; // 0.10%
  const premium = (flashAmount * premiumBps) / 10_000n;
  const minProfit = ethers.parseEther('1');

  beforeEach(async function () {
    [owner, operator, other] = await ethers.getSigners();

    const Asset = await ethers.getContractFactory('MockFlashAsset');
    asset = await Asset.deploy();
    await asset.waitForDeployment();

    const Pool = await ethers.getContractFactory('MockAaveV3FlashPool');
    pool = await Pool.deploy(premiumBps);
    await pool.waitForDeployment();

    const Revenue = await ethers.getContractFactory('MockVaultRevenueTarget');
    revenue = await Revenue.deploy();
    await revenue.waitForDeployment();

    const Vault = await ethers.getContractFactory('SoloForgeVault');
    vault = await Vault.deploy(owner.address);
    await vault.waitForDeployment();

    await asset.mint(await pool.getAddress(), ethers.parseEther('1000'));
    await asset.mint(await revenue.getAddress(), ethers.parseEther('50'));

    await vault.setAllowedFlashPool(await pool.getAddress(), true);
    await vault.setAllowedTarget(await revenue.getAddress(), true);
    await vault.setOperator(operator.address);
    await vault.setOperatorMinProfit(await asset.getAddress(), minProfit);
    await vault.setAllowedOperatorTarget(await revenue.getAddress(), true);
  });

  function revenueCall(amount) {
    return {
      target: revenue.target,
      value: 0n,
      data: revenue.interface.encodeFunctionData('payToken', [asset.target, vault.target, amount]),
    };
  }

  it('executes an owner flash plan only when repayment plus minimum profit exists', async function () {
    const settlementAmount = premium + minProfit;
    const poolBefore = await asset.balanceOf(pool.target);
    const revenueBefore = await asset.balanceOf(revenue.target);

    await expect(
      vault.executeAaveFlash(pool.target, asset.target, flashAmount, [revenueCall(settlementAmount)], minProfit)
    )
      .to.emit(vault, 'FlashExecuted')
      .withArgs(pool.target, asset.target, flashAmount, premium, minProfit, owner.address);

    expect(await asset.balanceOf(vault.target)).to.equal(minProfit);
    expect(await asset.balanceOf(pool.target)).to.equal(poolBefore + premium);
    expect(await asset.balanceOf(revenue.target)).to.equal(revenueBefore - settlementAmount);
    expect(await asset.allowance(vault.target, pool.target)).to.equal(0n);
  });

  it('lets the limited operator execute a profitable pre-approved flash plan', async function () {
    const settlementAmount = premium + minProfit;

    await expect(
      vault
        .connect(operator)
        .executeAaveFlash(pool.target, asset.target, flashAmount, [revenueCall(settlementAmount)], minProfit)
    )
      .to.emit(vault, 'FlashExecuted')
      .withArgs(pool.target, asset.target, flashAmount, premium, minProfit, operator.address);

    expect(await asset.balanceOf(vault.target)).to.equal(minProfit);
  });

  it('reverts the entire flash plan when real settlement is below the profit floor', async function () {
    const insufficientSettlement = premium + minProfit - 1n;
    const poolBefore = await asset.balanceOf(pool.target);
    const revenueBefore = await asset.balanceOf(revenue.target);

    await expect(
      vault.executeAaveFlash(
        pool.target,
        asset.target,
        flashAmount,
        [revenueCall(insufficientSettlement)],
        minProfit
      )
    ).to.be.revertedWithCustomError(vault, 'FlashProfitTooLow');

    expect(await asset.balanceOf(vault.target)).to.equal(0n);
    expect(await asset.balanceOf(pool.target)).to.equal(poolBefore);
    expect(await asset.balanceOf(revenue.target)).to.equal(revenueBefore);
  });

  it('does not let the operator lower the owner-configured profit floor', async function () {
    await expect(
      vault
        .connect(operator)
        .executeAaveFlash(
          pool.target,
          asset.target,
          flashAmount,
          [revenueCall(premium + minProfit)],
          minProfit - 1n
        )
    )
      .to.be.revertedWithCustomError(vault, 'OperatorProfitFloorTooLow')
      .withArgs(minProfit - 1n, minProfit);
  });

  it('requires a stricter operator target allowlist even when the owner target is allowed', async function () {
    await vault.setAllowedOperatorTarget(revenue.target, false);

    await expect(
      vault
        .connect(operator)
        .executeAaveFlash(
          pool.target,
          asset.target,
          flashAmount,
          [revenueCall(premium + minProfit)],
          minProfit
        )
    ).to.be.revertedWithCustomError(vault, 'OperatorTargetNotAllowed').withArgs(revenue.target);

    await expect(
      vault.executeAaveFlash(
        pool.target,
        asset.target,
        flashAmount,
        [revenueCall(premium + minProfit)],
        minProfit
      )
    ).to.emit(vault, 'FlashExecuted');
  });

  it('rejects an unapproved owner execution target before any external call is made', async function () {
    await vault.setAllowedTarget(revenue.target, false);

    await expect(
      vault.executeAaveFlash(
        pool.target,
        asset.target,
        flashAmount,
        [revenueCall(premium + minProfit)],
        minProfit
      )
    ).to.be.revertedWithCustomError(vault, 'TargetNotAllowed').withArgs(revenue.target);
  });

  it('rejects a flash pool unless the owner has explicitly allowlisted it', async function () {
    await vault.setAllowedFlashPool(pool.target, false);

    await expect(
      vault.executeAaveFlash(
        pool.target,
        asset.target,
        flashAmount,
        [revenueCall(premium + minProfit)],
        minProfit
      )
    ).to.be.revertedWithCustomError(vault, 'FlashPoolNotAllowed').withArgs(pool.target);
  });

  it('prevents any account other than owner or configured operator from running flash plans', async function () {
    await expect(
      vault
        .connect(other)
        .executeAaveFlash(
          pool.target,
          asset.target,
          flashAmount,
          [revenueCall(premium + minProfit)],
          minProfit
        )
    ).to.be.revertedWithCustomError(vault, 'UnauthorizedExecutor').withArgs(other.address);
  });

  it('keeps unrestricted batch execution and all withdrawals owner-only', async function () {
    await owner.sendTransaction({ to: vault.target, value: ethers.parseEther('2') });
    await owner.sendTransaction({ to: revenue.target, value: ethers.parseEther('1') });

    const payBack = ethers.parseEther('0.25');
    const call = {
      target: revenue.target,
      value: 0n,
      data: revenue.interface.encodeFunctionData('payEth', [vault.target, payBack]),
    };

    await expect(vault.connect(operator).executeBatch([call], 0n))
      .to.be.revertedWithCustomError(vault, 'OwnableUnauthorizedAccount')
      .withArgs(operator.address);

    await expect(vault.connect(operator).withdrawETH(operator.address, 1n))
      .to.be.revertedWithCustomError(vault, 'OwnableUnauthorizedAccount')
      .withArgs(operator.address);

    await expect(vault.executeBatch([call], ethers.parseEther('2.25')))
      .to.emit(vault, 'BatchExecuted')
      .withArgs(1n, ethers.parseEther('2'), ethers.parseEther('2.25'));
  });

  it('executes an owner batch and enforces an absolute ending ETH balance floor', async function () {
    await owner.sendTransaction({ to: vault.target, value: ethers.parseEther('2') });
    await owner.sendTransaction({ to: revenue.target, value: ethers.parseEther('1') });

    const payBack = ethers.parseEther('0.25');
    const call = {
      target: revenue.target,
      value: 0n,
      data: revenue.interface.encodeFunctionData('payEth', [vault.target, payBack]),
    };

    await expect(vault.executeBatch([call], ethers.parseEther('2.25')))
      .to.emit(vault, 'BatchExecuted')
      .withArgs(1n, ethers.parseEther('2'), ethers.parseEther('2.25'));

    expect(await ethers.provider.getBalance(vault.target)).to.equal(ethers.parseEther('2.25'));

    await expect(vault.executeBatch([call], ethers.parseEther('3')))
      .to.be.revertedWithCustomError(vault, 'EndingBalanceTooLow');
  });

  it('rejects empty batches so accidental no-op transactions cannot pass', async function () {
    await expect(vault.executeBatch([], 0n))
      .to.be.revertedWithCustomError(vault, 'InvalidBatchSize')
      .withArgs(0n);
  });
});
