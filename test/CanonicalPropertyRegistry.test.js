const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('CanonicalPropertyRegistry', function () {
  async function deployRegistry() {
    const [owner, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory('CanonicalPropertyRegistry');
    const registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();
    return { owner, other, registry };
  }

  it('registers an identity unverified and requires a separate verification transaction', async function () {
    const { registry } = await deployRegistry();
    const propertyId = ethers.sha256(ethers.toUtf8Bytes('USNYERIE:1234500'));
    const claimHash = ethers.keccak256(ethers.toUtf8Bytes('claim-1'));
    const sourceHash = ethers.keccak256(ethers.toUtf8Bytes('assessor-source'));

    await expect(registry.registerIdentity(propertyId, claimHash, sourceHash, 'https://www.voxelvault.io/vault/properties'))
      .to.emit(registry, 'PropertyIdentityRegistered')
      .withArgs(propertyId, claimHash, sourceHash, 'https://www.voxelvault.io/vault/properties');

    const before = await registry.getIdentity(propertyId);
    expect(before.verified).to.equal(false);
    expect(before.verifiedAt).to.equal(0n);

    await expect(registry.setVerified(propertyId, true))
      .to.emit(registry, 'PropertyIdentityVerificationUpdated')
      .withArgs(propertyId, true);

    const after = await registry.getIdentity(propertyId);
    expect(after.verified).to.equal(true);
    expect(after.verifiedAt).to.be.greaterThan(0n);
  });

  it('prevents duplicate canonical identities and zero reference hashes', async function () {
    const { registry } = await deployRegistry();
    const propertyId = ethers.sha256(ethers.toUtf8Bytes('parcel'));
    const claimHash = ethers.keccak256(ethers.toUtf8Bytes('claim'));
    const sourceHash = ethers.keccak256(ethers.toUtf8Bytes('source'));

    await expect(registry.registerIdentity(ethers.ZeroHash, claimHash, sourceHash, ''))
      .to.be.revertedWithCustomError(registry, 'ZeroPropertyId');
    await expect(registry.registerIdentity(propertyId, ethers.ZeroHash, sourceHash, ''))
      .to.be.revertedWithCustomError(registry, 'ZeroClaimHash');
    await expect(registry.registerIdentity(propertyId, claimHash, ethers.ZeroHash, ''))
      .to.be.revertedWithCustomError(registry, 'ZeroSourceHash');

    await registry.registerIdentity(propertyId, claimHash, sourceHash, '');
    await expect(registry.registerIdentity(propertyId, claimHash, sourceHash, ''))
      .to.be.revertedWithCustomError(registry, 'PropertyAlreadyRegistered')
      .withArgs(propertyId);
  });

  it('is owner-controlled and carries no interest-token, rent, deed-transfer or minting surface', async function () {
    const { other, registry } = await deployRegistry();
    const propertyId = ethers.sha256(ethers.toUtf8Bytes('parcel'));
    const claimHash = ethers.keccak256(ethers.toUtf8Bytes('claim'));
    const sourceHash = ethers.keccak256(ethers.toUtf8Bytes('source'));

    await expect(registry.connect(other).registerIdentity(propertyId, claimHash, sourceHash, ''))
      .to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount')
      .withArgs(other.address);

    const functionNames = registry.interface.fragments
      .filter((fragment) => fragment.type === 'function')
      .map((fragment) => fragment.name)
      .join(',');
    expect(functionNames).not.to.match(/interestToken|mint|rent|distribution|deedTransfer/i);
  });
});
