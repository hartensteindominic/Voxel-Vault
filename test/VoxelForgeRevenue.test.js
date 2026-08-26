const { expect } = require('chai');
const { ethers } = require('hardhat');

const TYPES = {
  ForgeRequest: [
    { name: 'account', type: 'address' },
    { name: 'parentContract0', type: 'address' },
    { name: 'parentTokenId0', type: 'uint256' },
    { name: 'parentContract1', type: 'address' },
    { name: 'parentTokenId1', type: 'uint256' },
    { name: 'parentContract2', type: 'address' },
    { name: 'parentTokenId2', type: 'uint256' },
    { name: 'descendantUriHash', type: 'bytes32' },
    { name: 'feeWei', type: 'uint256' },
    { name: 'requestId', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
  ],
};

describe('VoxelForgeRevenue', function () {
  async function deploy() {
    const [owner, forgeSigner, treasury, customer, stranger] = await ethers.getSigners();

    const Parent = await ethers.getContractFactory('VoxelVaultNFT');
    const parent = await Parent.deploy(owner.address);
    await parent.waitForDeployment();
    await parent.connect(owner).setPublicMintEnabled(true);
    await parent.connect(customer).mint('ipfs://parent-1.json', 0);
    await parent.connect(customer).mint('ipfs://parent-2.json', 0);
    await parent.connect(customer).mint('ipfs://parent-3.json', 0);

    const fee = ethers.parseEther('0.001');
    const Forge = await ethers.getContractFactory('VoxelForgeRevenue');
    const forge = await Forge.deploy(
      owner.address,
      forgeSigner.address,
      treasury.address,
      await parent.getAddress(),
      fee,
      500
    );
    await forge.waitForDeployment();

    return { owner, forgeSigner, treasury, customer, stranger, parent, forge, fee };
  }

  async function signedRequest({ forge, forgeSigner, customer, parent, fee, overrides = {} }) {
    const { uri: overrideUri, ...requestOverrides } = overrides;
    const uri = overrideUri || 'ipfs://voxel-forge/descendant-1.json';
    const chainId = Number((await ethers.provider.getNetwork()).chainId);
    const request = {
      account: customer.address,
      parentContract0: await parent.getAddress(),
      parentTokenId0: 1n,
      parentContract1: await parent.getAddress(),
      parentTokenId1: 2n,
      parentContract2: await parent.getAddress(),
      parentTokenId2: 3n,
      descendantUriHash: ethers.keccak256(ethers.toUtf8Bytes(uri)),
      feeWei: fee,
      requestId: ethers.hexlify(ethers.randomBytes(32)),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      ...requestOverrides,
    };
    const domain = {
      name: 'VoxelForgeRevenue',
      version: '1',
      chainId,
      verifyingContract: await forge.getAddress(),
    };
    const signature = await forgeSigner.signTypedData(domain, TYPES, request);
    return { request, uri, signature };
  }

  it('mints a descendant, keeps all parents with the customer, and accrues the exact fee', async function () {
    const ctx = await deploy();
    const { request, uri, signature } = await signedRequest(ctx);

    await expect(ctx.forge.connect(ctx.customer).forge(request, uri, signature, { value: ctx.fee }))
      .to.emit(ctx.forge, 'Forged')
      .withArgs(
        1n,
        ctx.customer.address,
        ctx.fee,
        request.requestId,
        await ctx.parent.getAddress(),
        1n,
        await ctx.parent.getAddress(),
        2n,
        await ctx.parent.getAddress(),
        3n,
        request.descendantUriHash
      );

    expect(await ctx.forge.ownerOf(1)).to.equal(ctx.customer.address);
    expect(await ctx.forge.tokenURI(1)).to.equal(uri);
    expect(await ctx.parent.ownerOf(1)).to.equal(ctx.customer.address);
    expect(await ctx.parent.ownerOf(2)).to.equal(ctx.customer.address);
    expect(await ctx.parent.ownerOf(3)).to.equal(ctx.customer.address);
    expect(await ctx.forge.totalForges()).to.equal(1n);
    expect(await ctx.forge.totalFeesCollected()).to.equal(ctx.fee);
    expect(await ctx.forge.pendingRevenue()).to.equal(ctx.fee);

    const parents = await ctx.forge.parentsOf(1);
    expect(parents[0].collection).to.equal(await ctx.parent.getAddress());
    expect(parents[0].tokenId).to.equal(1n);
    expect(parents[2].tokenId).to.equal(3n);
  });

  it('rejects incorrect payment', async function () {
    const ctx = await deploy();
    const { request, uri, signature } = await signedRequest(ctx);
    await expect(
      ctx.forge.connect(ctx.customer).forge(request, uri, signature, { value: ctx.fee - 1n })
    ).to.be.revertedWith('Incorrect forge payment');
  });

  it('rejects replay of an already-used signed request', async function () {
    const ctx = await deploy();
    const { request, uri, signature } = await signedRequest(ctx);
    await ctx.forge.connect(ctx.customer).forge(request, uri, signature, { value: ctx.fee });
    await expect(
      ctx.forge.connect(ctx.customer).forge(request, uri, signature, { value: ctx.fee })
    ).to.be.revertedWith('Forge request already used');
  });

  it('rejects a caller that no longer owns every parent', async function () {
    const ctx = await deploy();
    const { request, uri, signature } = await signedRequest(ctx);
    await ctx.parent.connect(ctx.customer).transferFrom(ctx.customer.address, ctx.stranger.address, 2);
    await expect(
      ctx.forge.connect(ctx.customer).forge(request, uri, signature, { value: ctx.fee })
    ).to.be.revertedWith('Parent 2 not owned');
  });

  it('rejects duplicate parents even with a valid Forge signature', async function () {
    const ctx = await deploy();
    const { request, uri, signature } = await signedRequest({ ...ctx, overrides: { parentTokenId1: 1n } });
    await expect(
      ctx.forge.connect(ctx.customer).forge(request, uri, signature, { value: ctx.fee })
    ).to.be.revertedWith('Choose three different parents');
  });

  it('rejects an authorization signed by anyone except the configured Forge signer', async function () {
    const ctx = await deploy();
    const { request, uri } = await signedRequest(ctx);
    const chainId = Number((await ethers.provider.getNetwork()).chainId);
    const badSignature = await ctx.stranger.signTypedData(
      { name: 'VoxelForgeRevenue', version: '1', chainId, verifyingContract: await ctx.forge.getAddress() },
      TYPES,
      request
    );
    await expect(
      ctx.forge.connect(ctx.customer).forge(request, uri, badSignature, { value: ctx.fee })
    ).to.be.revertedWith('Invalid Forge authorization');
  });

  it('rejects oversized metadata URIs to keep mainnet gas bounded', async function () {
    const ctx = await deploy();
    const uri = `ipfs://${'x'.repeat(1100)}`;
    const { request, signature } = await signedRequest({ ...ctx, overrides: { uri } });
    await expect(
      ctx.forge.connect(ctx.customer).forge(request, uri, signature, { value: ctx.fee })
    ).to.be.revertedWith('Descendant URI too long');
  });

  it('lets only the owner withdraw collected revenue to the configured treasury', async function () {
    const ctx = await deploy();
    const { request, uri, signature } = await signedRequest(ctx);
    await ctx.forge.connect(ctx.customer).forge(request, uri, signature, { value: ctx.fee });

    await expect(ctx.forge.connect(ctx.customer).withdrawAllRevenue())
      .to.be.revertedWithCustomError(ctx.forge, 'OwnableUnauthorizedAccount')
      .withArgs(ctx.customer.address);

    const before = await ethers.provider.getBalance(ctx.treasury.address);
    await expect(ctx.forge.connect(ctx.owner).withdrawAllRevenue())
      .to.emit(ctx.forge, 'RevenueWithdrawn')
      .withArgs(ctx.treasury.address, ctx.fee);
    const after = await ethers.provider.getBalance(ctx.treasury.address);

    expect(after - before).to.equal(ctx.fee);
    expect(await ctx.forge.pendingRevenue()).to.equal(0n);
    expect(await ctx.forge.totalFeesWithdrawn()).to.equal(ctx.fee);
  });

  it('can be emergency-paused by the owner', async function () {
    const ctx = await deploy();
    const { request, uri, signature } = await signedRequest(ctx);
    await ctx.forge.connect(ctx.owner).pause();
    await expect(
      ctx.forge.connect(ctx.customer).forge(request, uri, signature, { value: ctx.fee })
    ).to.be.revertedWithCustomError(ctx.forge, 'EnforcedPause');
  });
});
