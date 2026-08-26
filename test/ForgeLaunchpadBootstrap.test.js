const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Forge launchpad bootstrap', function () {
  const deployFee = ethers.parseEther('0.01');
  const platformBps = 1500n;
  const basePrice = ethers.parseEther('0.0005');
  const priceIncrement = ethers.parseEther('0.00001');

  it('creates the implementation and factory in one deployment transaction', async function () {
    const [owner, platformTreasury] = await ethers.getSigners();

    const Bootstrap = await ethers.getContractFactory('ForgeLaunchpadBootstrap');
    const bootstrap = await Bootstrap.deploy(
      owner.address,
      platformTreasury.address,
      platformBps,
      deployFee
    );
    await bootstrap.waitForDeployment();

    const implementationAddress = await bootstrap.implementation();
    const factoryAddress = await bootstrap.factory();

    expect(implementationAddress).to.not.equal(ethers.ZeroAddress);
    expect(factoryAddress).to.not.equal(ethers.ZeroAddress);
    expect(await ethers.provider.getCode(implementationAddress)).to.not.equal('0x');
    expect(await ethers.provider.getCode(factoryAddress)).to.not.equal('0x');

    const factory = await ethers.getContractAt('ForgeFactory', factoryAddress);
    expect(await factory.owner()).to.equal(owner.address);
    expect(await factory.implementation()).to.equal(implementationAddress);
    expect(await factory.platformTreasury()).to.equal(platformTreasury.address);
    expect(await factory.platformBps()).to.equal(platformBps);
    expect(await factory.deployFeeWei()).to.equal(deployFee);
  });

  it('keeps the implementation locked and lets a creator create an independent clone', async function () {
    const [owner, platformTreasury, creator, creatorTreasury, forgeSigner] = await ethers.getSigners();

    const Bootstrap = await ethers.getContractFactory('ForgeLaunchpadBootstrap');
    const bootstrap = await Bootstrap.deploy(
      owner.address,
      platformTreasury.address,
      platformBps,
      deployFee
    );
    await bootstrap.waitForDeployment();

    const implementationAddress = await bootstrap.implementation();
    const factoryAddress = await bootstrap.factory();
    const implementation = await ethers.getContractAt('ForgeClone', implementationAddress);
    const factory = await ethers.getContractAt('ForgeFactory', factoryAddress);

    await expect(
      implementation.initialize({
        name: 'Should Fail',
        symbol: 'FAIL',
        initialOwner: owner.address,
        platformTreasury: platformTreasury.address,
        creatorTreasury: creatorTreasury.address,
        forgeSigner: forgeSigner.address,
        platformBps,
        basePriceWei: basePrice,
        priceIncrementWei: priceIncrement,
      })
    ).to.be.revertedWithCustomError(implementation, 'InvalidInitialization');

    await factory.connect(creator).createForge(
      'Creator Forge',
      'CFRG',
      creatorTreasury.address,
      forgeSigner.address,
      basePrice,
      priceIncrement,
      { value: deployFee }
    );

    const creatorForges = await factory.creatorForges(creator.address);
    expect(creatorForges).to.have.length(1);

    const forge = await ethers.getContractAt('ForgeClone', creatorForges[0]);
    expect(await forge.owner()).to.equal(creator.address);
    expect(await forge.platformTreasury()).to.equal(platformTreasury.address);
    expect(await forge.creatorTreasury()).to.equal(creatorTreasury.address);
    expect(await forge.forgeSigner()).to.equal(forgeSigner.address);
    expect(await forge.platformBps()).to.equal(platformBps);
    expect(await forge.currentMergePrice()).to.equal(basePrice);

    const cloneCode = await ethers.provider.getCode(creatorForges[0]);
    expect(cloneCode.length).to.be.lessThan(200);
  });

  it('rejects invalid bootstrap economics before creating child infrastructure', async function () {
    const [owner, platformTreasury] = await ethers.getSigners();
    const Bootstrap = await ethers.getContractFactory('ForgeLaunchpadBootstrap');

    await expect(
      Bootstrap.deploy(owner.address, platformTreasury.address, 3001, deployFee)
    ).to.be.revertedWithCustomError(await ethers.getContractFactory('ForgeFactory'), 'InvalidPlatformBps');
  });
});
