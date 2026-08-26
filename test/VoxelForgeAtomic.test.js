const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('VoxelForgeAtomic', function () {
  let owner;
  let user;
  let forgeSigner;
  let feeRecipient;
  let other;
  let parent;
  let forge;

  const parentUris = ['ipfs://parent-1', 'ipfs://parent-2', 'ipfs://parent-3'];
  const descendantURI = 'ipfs://descendant-1';
  const feeWei = ethers.parseEther('0.002');

  const voucherTypes = {
    ForgeVoucher: [
      { name: 'account', type: 'address' },
      { name: 'parentTokenId0', type: 'uint256' },
      { name: 'parentTokenId1', type: 'uint256' },
      { name: 'parentTokenId2', type: 'uint256' },
      { name: 'parentMetadataHash0', type: 'bytes32' },
      { name: 'parentMetadataHash1', type: 'bytes32' },
      { name: 'parentMetadataHash2', type: 'bytes32' },
      { name: 'recipeHash', type: 'bytes32' },
      { name: 'descendantUriHash', type: 'bytes32' },
      { name: 'feeWei', type: 'uint256' },
      { name: 'voucherId', type: 'bytes32' },
      { name: 'deadline', type: 'uint64' },
    ],
  };

  function hashText(value) {
    return ethers.keccak256(ethers.toUtf8Bytes(value));
  }

  async function domain() {
    const network = await ethers.provider.getNetwork();
    return {
      name: 'VoxelForge',
      version: '1',
      chainId: network.chainId,
      verifyingContract: await forge.getAddress(),
    };
  }

  async function buildVoucher(overrides = {}) {
    const latest = await ethers.provider.getBlock('latest');
    return {
      account: user.address,
      parentTokenId0: 1n,
      parentTokenId1: 2n,
      parentTokenId2: 3n,
      parentMetadataHash0: hashText(parentUris[0]),
      parentMetadataHash1: hashText(parentUris[1]),
      parentMetadataHash2: hashText(parentUris[2]),
      recipeHash: hashText('recipe:parents:1-2-3:v1'),
      descendantUriHash: hashText(descendantURI),
      feeWei,
      voucherId: hashText(`voucher:${latest.timestamp}:${Math.random()}`),
      deadline: BigInt(latest.timestamp + 3600),
      ...overrides,
    };
  }

  async function signVoucher(voucher, signer = forgeSigner) {
    return signer.signTypedData(await domain(), voucherTypes, voucher);
  }

  beforeEach(async function () {
    [owner, user, forgeSigner, feeRecipient, other] = await ethers.getSigners();

    const Parent = await ethers.getContractFactory('MockVoxelFlipParent');
    parent = await Parent.deploy();
    await parent.waitForDeployment();

    for (const uri of parentUris) {
      await parent.mint(user.address, uri);
    }

    const Forge = await ethers.getContractFactory('VoxelForgeAtomic');
    forge = await Forge.deploy(
      owner.address,
      await parent.getAddress(),
      forgeSigner.address,
      feeRecipient.address,
      500
    );
    await forge.waitForDeployment();

    await parent.connect(user).setApprovalForAll(await forge.getAddress(), true);
  });

  it('atomically burns three verified parents and mints one descendant', async function () {
    const voucher = await buildVoucher();
    const signature = await signVoucher(voucher);

    await expect(forge.connect(user).forge(voucher, descendantURI, signature, { value: feeWei }))
      .to.emit(forge, 'Forged')
      .withArgs(
        1n,
        user.address,
        voucher.recipeHash,
        1n,
        2n,
        3n,
        voucher.voucherId,
        feeWei
      );

    await expect(parent.ownerOf(1n)).to.be.reverted;
    await expect(parent.ownerOf(2n)).to.be.reverted;
    await expect(parent.ownerOf(3n)).to.be.reverted;

    expect(await forge.ownerOf(1n)).to.equal(user.address);
    expect(await forge.tokenURI(1n)).to.equal(descendantURI);
    expect(await forge.usedVouchers(voucher.voucherId)).to.equal(true);
    expect(await ethers.provider.getBalance(await forge.getAddress())).to.equal(feeWei);

    const lineage = await forge.lineageOf(1n);
    expect([...lineage[0]]).to.deep.equal([1n, 2n, 3n]);
    expect([...lineage[1]]).to.deep.equal([
      voucher.parentMetadataHash0,
      voucher.parentMetadataHash1,
      voucher.parentMetadataHash2,
    ]);
    expect(lineage[2]).to.equal(voucher.recipeHash);
    expect(lineage[3]).to.equal(voucher.voucherId);
  });

  it('rolls back every parent if a later parent burn fails', async function () {
    const voucher = await buildVoucher();
    const signature = await signVoucher(voucher);
    await parent.setFailBurnTokenId(2n);

    await expect(
      forge.connect(user).forge(voucher, descendantURI, signature, { value: feeWei })
    ).to.be.revertedWith('Forced burn failure');

    expect(await parent.ownerOf(1n)).to.equal(user.address);
    expect(await parent.ownerOf(2n)).to.equal(user.address);
    expect(await parent.ownerOf(3n)).to.equal(user.address);
    expect(await forge.usedVouchers(voucher.voucherId)).to.equal(false);
    expect(await ethers.provider.getBalance(await forge.getAddress())).to.equal(0n);
    await expect(forge.ownerOf(1n)).to.be.reverted;
  });

  it('fails before consuming parents if metadata changed after the recipe was signed', async function () {
    const voucher = await buildVoucher();
    const signature = await signVoucher(voucher);
    await parent.connect(user).setTokenURIForTest(2n, 'ipfs://parent-2-mutated');

    await expect(
      forge.connect(user).forge(voucher, descendantURI, signature, { value: feeWei })
    ).to.be.revertedWithCustomError(forge, 'ParentMetadataChanged').withArgs(2n);

    expect(await parent.ownerOf(1n)).to.equal(user.address);
    expect(await parent.ownerOf(2n)).to.equal(user.address);
    expect(await parent.ownerOf(3n)).to.equal(user.address);
    expect(await forge.usedVouchers(voucher.voucherId)).to.equal(false);
  });

  it('rejects a signature from anyone except the configured Forge signer', async function () {
    const voucher = await buildVoucher();
    const badSignature = await signVoucher(voucher, other);

    await expect(
      forge.connect(user).forge(voucher, descendantURI, badSignature, { value: feeWei })
    ).to.be.revertedWithCustomError(forge, 'InvalidForgeSignature');

    expect(await parent.ownerOf(1n)).to.equal(user.address);
  });

  it('rejects any fee other than the signed exact Forge fee', async function () {
    const voucher = await buildVoucher();
    const signature = await signVoucher(voucher);

    await expect(
      forge.connect(user).forge(voucher, descendantURI, signature, { value: feeWei - 1n })
    ).to.be.revertedWithCustomError(forge, 'IncorrectForgeFee');

    expect(await parent.ownerOf(1n)).to.equal(user.address);
    expect(await ethers.provider.getBalance(await forge.getAddress())).to.equal(0n);
  });

  it('rejects duplicate parent IDs', async function () {
    const voucher = await buildVoucher({ parentTokenId2: 2n });
    const signature = await signVoucher(voucher);

    await expect(
      forge.connect(user).forge(voucher, descendantURI, signature, { value: feeWei })
    ).to.be.revertedWithCustomError(forge, 'DuplicateParent');
  });

  it('rejects an expired voucher', async function () {
    const latest = await ethers.provider.getBlock('latest');
    const voucher = await buildVoucher({ deadline: BigInt(latest.timestamp - 1) });
    const signature = await signVoucher(voucher);

    await expect(
      forge.connect(user).forge(voucher, descendantURI, signature, { value: feeWei })
    ).to.be.revertedWithCustomError(forge, 'VoucherExpired');
  });

  it('cannot reuse a Forge voucher after a successful Forge', async function () {
    const voucher = await buildVoucher();
    const signature = await signVoucher(voucher);

    await forge.connect(user).forge(voucher, descendantURI, signature, { value: feeWei });

    await expect(
      forge.connect(user).forge(voucher, descendantURI, signature, { value: feeWei })
    ).to.be.revertedWithCustomError(forge, 'VoucherAlreadyUsed');
  });

  it('releases accrued fees only to the configured fee recipient', async function () {
    const voucher = await buildVoucher();
    const signature = await signVoucher(voucher);
    await forge.connect(user).forge(voucher, descendantURI, signature, { value: feeWei });

    const before = await ethers.provider.getBalance(feeRecipient.address);
    await forge.connect(other).releaseFees();
    const after = await ethers.provider.getBalance(feeRecipient.address);

    expect(after - before).to.equal(feeWei);
    expect(await ethers.provider.getBalance(await forge.getAddress())).to.equal(0n);
  });
});
