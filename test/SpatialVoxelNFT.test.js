const { expect } = require('chai');
const { ethers } = require('hardhat');

async function voucherSignature(signer, wallet, uri, voucherId) {
  const uriHash = ethers.keccak256(ethers.toUtf8Bytes(uri));
  const digest = ethers.solidityPackedKeccak256(['address', 'bytes32', 'bytes32'], [wallet, uriHash, voucherId]);
  return signer.signMessage(ethers.getBytes(digest));
}

describe('SpatialVoxelNFT', function () {
  async function fixture() {
    const [owner, voucherSigner, feeRecipient, buyer, attacker] = await ethers.getSigners();
    const fee = ethers.parseEther('0.001');
    const Factory = await ethers.getContractFactory('SpatialVoxelNFT');
    const nft = await Factory.deploy(owner.address, voucherSigner.address, feeRecipient.address, fee);
    await nft.waitForDeployment();
    return { nft, owner, voucherSigner, feeRecipient, buyer, attacker, fee };
  }

  it('mints once with an explicit platform fee and routes only that fee to the configured recipient', async function () {
    const { nft, voucherSigner, feeRecipient, buyer, fee } = await fixture();
    const uri = 'https://voxelvault.example/metadata/1';
    const voucherId = ethers.keccak256(ethers.toUtf8Bytes('voucher-1'));
    const signature = await voucherSignature(voucherSigner, buyer.address, uri, voucherId);
    const before = await ethers.provider.getBalance(feeRecipient.address);

    await expect(nft.connect(buyer).mintWithVoucher(uri, voucherId, signature, { value: fee }))
      .to.emit(nft, 'SpatialVoxelMinted')
      .withArgs(1n, buyer.address, voucherId, uri);

    expect(await nft.ownerOf(1n)).to.equal(buyer.address);
    expect(await nft.tokenURI(1n)).to.equal(uri);
    expect(await nft.usedVouchers(voucherId)).to.equal(true);
    expect((await ethers.provider.getBalance(feeRecipient.address)) - before).to.equal(fee);
  });

  it('rejects a reused voucher', async function () {
    const { nft, voucherSigner, buyer, fee } = await fixture();
    const uri = 'https://voxelvault.example/metadata/replay';
    const voucherId = ethers.keccak256(ethers.toUtf8Bytes('voucher-replay'));
    const signature = await voucherSignature(voucherSigner, buyer.address, uri, voucherId);
    await nft.connect(buyer).mintWithVoucher(uri, voucherId, signature, { value: fee });
    await expect(nft.connect(buyer).mintWithVoucher(uri, voucherId, signature, { value: fee }))
      .to.be.revertedWithCustomError(nft, 'VoucherAlreadyUsed');
  });

  it('rejects signatures that do not authorize the connected buyer', async function () {
    const { nft, voucherSigner, buyer, attacker, fee } = await fixture();
    const uri = 'https://voxelvault.example/metadata/wrong-wallet';
    const voucherId = ethers.keccak256(ethers.toUtf8Bytes('voucher-wrong-wallet'));
    const signature = await voucherSignature(voucherSigner, buyer.address, uri, voucherId);
    await expect(nft.connect(attacker).mintWithVoucher(uri, voucherId, signature, { value: fee }))
      .to.be.revertedWithCustomError(nft, 'InvalidVoucherSignature');
  });

  it('rejects hidden or incorrect platform fee amounts', async function () {
    const { nft, voucherSigner, buyer, fee } = await fixture();
    const uri = 'https://voxelvault.example/metadata/fee';
    const voucherId = ethers.keccak256(ethers.toUtf8Bytes('voucher-fee'));
    const signature = await voucherSignature(voucherSigner, buyer.address, uri, voucherId);
    await expect(nft.connect(buyer).mintWithVoucher(uri, voucherId, signature, { value: fee - 1n }))
      .to.be.revertedWithCustomError(nft, 'IncorrectPlatformFee');
  });

  it('lets the owner pause all experimental mints', async function () {
    const { nft, owner, voucherSigner, buyer, fee } = await fixture();
    const uri = 'https://voxelvault.example/metadata/paused';
    const voucherId = ethers.keccak256(ethers.toUtf8Bytes('voucher-paused'));
    const signature = await voucherSignature(voucherSigner, buyer.address, uri, voucherId);
    await nft.connect(owner).pause();
    await expect(nft.connect(buyer).mintWithVoucher(uri, voucherId, signature, { value: fee }))
      .to.be.revertedWithCustomError(nft, 'EnforcedPause');
  });
});
