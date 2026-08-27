const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Voxel Vault real-property pilot contracts', function () {
  async function deployPilot() {
    const [owner, alice, bob] = await ethers.getSigners();
    const propertyId = ethers.keccak256(ethers.toUtf8Bytes('PILOT-0001'));
    const agreementHash = ethers.keccak256(ethers.toUtf8Bytes('executed-operating-agreement-v1'));
    const entityHash = ethers.keccak256(ethers.toUtf8Bytes('123 Main Street Property LLC'));
    const deedHash = ethers.keccak256(ethers.toUtf8Bytes('county-record-reference'));

    const Token = await ethers.getContractFactory('PropertyInterestToken');
    const token = await Token.deploy('Pilot Property Interests', 'PPI', propertyId, agreementHash, 100000n, owner.address);
    await token.waitForDeployment();

    const Registry = await ethers.getContractFactory('PropertyRegistry');
    const registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();

    const Passport = await ethers.getContractFactory('PropertyPassport');
    const passport = await Passport.deploy(owner.address, await registry.getAddress());
    await passport.waitForDeployment();

    const Vault = await ethers.getContractFactory('PropertyDistributionVault');
    const vault = await Vault.deploy(owner.address, await token.getAddress());
    await vault.waitForDeployment();

    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    return { owner, alice, bob, propertyId, agreementHash, entityHash, deedHash, token, registry, passport, vault, usdc };
  }

  it('blocks minting and transfers to wallets that are not allowlisted', async function () {
    const { alice, bob, token } = await deployPilot();

    await expect(token.mint(alice.address, 1000n))
      .to.be.revertedWithCustomError(token, 'RecipientNotAllowed')
      .withArgs(alice.address);

    await token.setAllowedBatch([alice.address, bob.address], true);
    await token.mint(alice.address, 1000n);
    expect(await token.balanceOf(alice.address)).to.equal(1000n);

    await token.connect(alice).transfer(bob.address, 125n);
    expect(await token.balanceOf(bob.address)).to.equal(125n);

    await token.setAllowed(bob.address, false);
    await expect(token.connect(alice).transfer(bob.address, 1n))
      .to.be.revertedWithCustomError(token, 'RecipientNotAllowed')
      .withArgs(bob.address);
  });

  it('enforces the fixed property-unit supply cap', async function () {
    const { alice, token } = await deployPilot();
    await token.setAllowed(alice.address, true);
    await token.mint(alice.address, 100000n);
    expect(await token.totalSupply()).to.equal(100000n);
    await expect(token.mint(alice.address, 1n)).to.be.revertedWithCustomError(token, 'SupplyCapExceeded');
  });

  it('keeps a property inactive until the registry owner verifies it', async function () {
    const { owner, propertyId, entityHash, deedHash, token, registry } = await deployPilot();

    await registry.registerProperty(
      propertyId,
      owner.address,
      await token.getAddress(),
      entityHash,
      deedHash,
      'ipfs://demo-property-metadata'
    );

    await expect(registry.setActive(propertyId, true)).to.be.revertedWith('PROPERTY_NOT_VERIFIED');
    await registry.setVerified(propertyId, true);
    await registry.setActive(propertyId, true);

    const record = await registry.getProperty(propertyId);
    expect(record.verified).to.equal(true);
    expect(record.active).to.equal(true);

    await registry.setVerified(propertyId, false);
    const resetRecord = await registry.getProperty(propertyId);
    expect(resetRecord.active).to.equal(false);
  });

  it('mints one non-transferable Property Passport only after property verification', async function () {
    const { owner, alice, bob, propertyId, entityHash, deedHash, token, registry, passport } = await deployPilot();
    const metadataURI = 'ipfs://verified-3d-property-passport';

    await registry.registerProperty(
      propertyId,
      owner.address,
      await token.getAddress(),
      entityHash,
      deedHash,
      metadataURI
    );

    await expect(passport.mintVerifiedPassport(propertyId, alice.address))
      .to.be.revertedWithCustomError(passport, 'PropertyNotVerified')
      .withArgs(propertyId);

    await registry.setVerified(propertyId, true);
    await passport.mintVerifiedPassport(propertyId, alice.address);

    const tokenId = BigInt(propertyId);
    expect(await passport.ownerOf(tokenId)).to.equal(alice.address);
    expect(await passport.tokenURI(tokenId)).to.equal(metadataURI);

    await expect(passport.mintVerifiedPassport(propertyId, owner.address))
      .to.be.revertedWithCustomError(passport, 'PassportAlreadyMinted')
      .withArgs(propertyId);

    await expect(passport.connect(alice).transferFrom(alice.address, bob.address, tokenId))
      .to.be.revertedWithCustomError(passport, 'PassportNonTransferable');
  });

  it('funds one audited distribution epoch and prevents double claims', async function () {
    const { owner, alice, token, vault, usdc } = await deployPilot();
    const amount = 600n * 10n ** 6n;
    const epochId = 1n;
    const statementHash = ethers.keccak256(ethers.toUtf8Bytes('approved-net-income-statement-2026-08'));
    const leaf = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'address', 'uint256'],
        [epochId, alice.address, amount]
      )
    );

    await token.setAllowed(alice.address, true);
    await usdc.mint(owner.address, amount);
    await usdc.approve(await vault.getAddress(), amount);
    await vault.createDistribution(await usdc.getAddress(), leaf, amount, statementHash);

    await vault.connect(alice).claim(epochId, amount, []);
    expect(await usdc.balanceOf(alice.address)).to.equal(amount);
    await expect(vault.connect(alice).claim(epochId, amount, [])).to.be.revertedWithCustomError(vault, 'AlreadyClaimed');
  });

  it('blocks a distribution claim if the wallet is no longer currently allowlisted', async function () {
    const { owner, alice, token, vault, usdc } = await deployPilot();
    const amount = 250n * 10n ** 6n;
    const epochId = 1n;
    const statementHash = ethers.keccak256(ethers.toUtf8Bytes('approved-net-income-statement-2026-09'));
    const leaf = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'address', 'uint256'],
        [epochId, alice.address, amount]
      )
    );

    await token.setAllowed(alice.address, true);
    await usdc.mint(owner.address, amount);
    await usdc.approve(await vault.getAddress(), amount);
    await vault.createDistribution(await usdc.getAddress(), leaf, amount, statementHash);

    await token.setAllowed(alice.address, false);
    await expect(vault.connect(alice).claim(epochId, amount, []))
      .to.be.revertedWithCustomError(vault, 'ClaimantNotAllowed')
      .withArgs(alice.address);
  });

  it('requires every distribution epoch to reference a nonzero approved statement hash', async function () {
    const { owner, alice, token, vault, usdc } = await deployPilot();
    const amount = 100n * 10n ** 6n;
    const epochId = 1n;
    const leaf = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'address', 'uint256'],
        [epochId, alice.address, amount]
      )
    );

    await token.setAllowed(alice.address, true);
    await usdc.mint(owner.address, amount);
    await usdc.approve(await vault.getAddress(), amount);

    await expect(vault.createDistribution(await usdc.getAddress(), leaf, amount, ethers.ZeroHash))
      .to.be.revertedWithCustomError(vault, 'InvalidStatementHash');
  });
});
