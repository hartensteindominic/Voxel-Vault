const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('VoxelFlipNFT', function () {
  async function deployFixture() {
    const [owner, mintSigner, collector, royaltyReceiver, nextRoyaltyReceiver] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('VoxelFlipNFT');
    const nft = await Factory.deploy(
      owner.address,
      mintSigner.address,
      royaltyReceiver.address,
      500,
      'https://www.voxelvault.io/voxelflip/collection.json',
    );
    await nft.waitForDeployment();
    return { nft, owner, mintSigner, collector, royaltyReceiver, nextRoyaltyReceiver };
  }

  async function mintAuthorized(nft, mintSigner, collector, uri, voucherId) {
    const uriHash = ethers.keccak256(ethers.toUtf8Bytes(uri));
    const digest = ethers.solidityPackedKeccak256(
      ['address', 'bytes32', 'bytes32'],
      [collector.address, uriHash, voucherId],
    );
    const signature = await mintSigner.signMessage(ethers.getBytes(digest));
    await nft.connect(collector).mintWithVoucher(uri, voucherId, signature);
  }

  it('applies an owner-updated collection royalty to an already-minted token', async function () {
    const { nft, owner, mintSigner, collector, royaltyReceiver, nextRoyaltyReceiver } = await deployFixture();
    const uri = 'https://cdn.voxelvault.io/voxelflip/1.json';
    const voucherId = ethers.keccak256(ethers.toUtf8Bytes('voucher-1'));

    await mintAuthorized(nft, mintSigner, collector, uri, voucherId);

    const salePrice = ethers.parseEther('1');
    const [initialReceiver, initialAmount] = await nft.royaltyInfo(1, salePrice);
    expect(initialReceiver).to.equal(royaltyReceiver.address);
    expect(initialAmount).to.equal(ethers.parseEther('0.05'));

    await nft.connect(owner).setRoyalty(nextRoyaltyReceiver.address, 250);

    const [updatedReceiver, updatedAmount] = await nft.royaltyInfo(1, salePrice);
    expect(updatedReceiver).to.equal(nextRoyaltyReceiver.address);
    expect(updatedAmount).to.equal(ethers.parseEther('0.025'));
  });

  it('rejects royalty changes from non-owners', async function () {
    const { nft, collector, nextRoyaltyReceiver } = await deployFixture();
    await expect(nft.connect(collector).setRoyalty(nextRoyaltyReceiver.address, 250))
      .to.be.revertedWithCustomError(nft, 'OwnableUnauthorizedAccount')
      .withArgs(collector.address);
  });

  it('keeps voucher minting single-use', async function () {
    const { nft, mintSigner, collector } = await deployFixture();
    const uri = 'https://cdn.voxelvault.io/voxelflip/1.json';
    const voucherId = ethers.keccak256(ethers.toUtf8Bytes('voucher-single-use'));
    const uriHash = ethers.keccak256(ethers.toUtf8Bytes(uri));
    const digest = ethers.solidityPackedKeccak256(
      ['address', 'bytes32', 'bytes32'],
      [collector.address, uriHash, voucherId],
    );
    const signature = await mintSigner.signMessage(ethers.getBytes(digest));

    await nft.connect(collector).mintWithVoucher(uri, voucherId, signature);
    await expect(nft.connect(collector).mintWithVoucher(uri, voucherId, signature))
      .to.be.revertedWith('Voucher already used');
  });
});
