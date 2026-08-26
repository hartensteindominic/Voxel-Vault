const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Forge launchpad', function () {
  let platformOwner;
  let platformTreasury;
  let creator;
  let creatorTreasury;
  let forgeSigner;
  let other;
  let implementation;
  let factory;
  let forge;

  const deployFee = ethers.parseEther('0.01');
  const platformBps = 1500n; // 15%
  const basePrice = ethers.parseEther('0.0005');
  const priceIncrement = ethers.parseEther('0.00001');

  const requestTypes = {
    ForgeRequest: [
      { name: 'account', type: 'address' },
      { name: 'parentTokenId0', type: 'uint256' },
      { name: 'parentTokenId1', type: 'uint256' },
      { name: 'parentTokenId2', type: 'uint256' },
      { name: 'outputTier', type: 'uint8' },
      { name: 'descendantUriHash', type: 'bytes32' },
      { name: 'feeWei', type: 'uint256' },
      { name: 'requestId', type: 'bytes32' },
      { name: 'deadline', type: 'uint64' },
    ],
  };

  function hashText(value) {
    return ethers.keccak256(ethers.toUtf8Bytes(value));
  }

  beforeEach(async function () {
    [platformOwner, platformTreasury, creator, creatorTreasury, forgeSigner, other] = await ethers.getSigners();

    const Implementation = await ethers.getContractFactory('ForgeClone');
    implementation = await Implementation.deploy();
    await implementation.waitForDeployment();

    const Factory = await ethers.getContractFactory('ForgeFactory');
    factory = await Factory.deploy(
      platformOwner.address,
      implementation.target,
      platformTreasury.address,
      platformBps,
      deployFee
    );
    await factory.waitForDeployment();

    await factory.connect(creator).createForge(
      'Demo Forge',
      'DFORGE',
      creatorTreasury.address,
      forgeSigner.address,
      basePrice,
      priceIncrement,
      { value: deployFee }
    );

    const forges = await factory.creatorForges(creator.address);
    const Forge = await ethers.getContractFactory('ForgeClone');
    forge = Forge.attach(forges[0]);
  });

  async function domain() {
    const network = await ethers.provider.getNetwork();
    return {
      name: 'VoxelForgeClone',
      version: '1',
      chainId: network.chainId,
      verifyingContract: forge.target,
    };
  }

  async function buildRequest(parentIds, outputTier, feeWei, descendantURI, suffix) {
    const latest = await ethers.provider.getBlock('latest');
    return {
      account: creator.address,
      parentTokenId0: BigInt(parentIds[0]),
      parentTokenId1: BigInt(parentIds[1]),
      parentTokenId2: BigInt(parentIds[2]),
      outputTier,
      descendantUriHash: hashText(descendantURI),
      feeWei,
      requestId: hashText(`launchpad:${suffix}:${latest.timestamp}`),
      deadline: BigInt(latest.timestamp + 3600),
    };
  }

  async function signRequest(request) {
    return forgeSigner.signTypedData(await domain(), requestTypes, request);
  }

  it('creates an EIP-1167 clone with creator ownership and fixed launch economics', async function () {
    expect(await factory.isForge(forge.target)).to.equal(true);
    expect(await factory.forgeCount()).to.equal(1n);
    expect(await factory.accruedDeployFees()).to.equal(deployFee);

    expect(await forge.owner()).to.equal(creator.address);
    expect(await forge.creatorTreasury()).to.equal(creatorTreasury.address);
    expect(await forge.platformTreasury()).to.equal(platformTreasury.address);
    expect(await forge.forgeSigner()).to.equal(forgeSigner.address);
    expect(await forge.platformBps()).to.equal(platformBps);
    expect(await forge.currentMergePrice()).to.equal(basePrice);

    const code = await ethers.provider.getCode(forge.target);
    expect(code.length).to.be.lessThan(200); // minimal proxy runtime is tiny
  });

  it('locks the standalone implementation against direct initialization', async function () {
    await expect(
      implementation.initialize({
        name: 'Bad',
        symbol: 'BAD',
        initialOwner: platformOwner.address,
        platformTreasury: platformTreasury.address,
        creatorTreasury: creatorTreasury.address,
        forgeSigner: forgeSigner.address,
        platformBps: 1500,
        basePriceWei: basePrice,
        priceIncrementWei: priceIncrement,
      })
    ).to.be.revertedWithCustomError(implementation, 'InvalidInitialization');
  });

  it('charges the exact deploy fee and can release it only to the configured platform treasury', async function () {
    await expect(
      factory.connect(other).createForge(
        'No Fee',
        'NOPE',
        other.address,
        other.address,
        basePrice,
        priceIncrement,
        { value: deployFee - 1n }
      )
    )
      .to.be.revertedWithCustomError(factory, 'IncorrectDeployFee')
      .withArgs(deployFee, deployFee - 1n);

    const before = await ethers.provider.getBalance(platformTreasury.address);
    await factory.connect(other).releaseDeployFees();
    const after = await ethers.provider.getBalance(platformTreasury.address);

    expect(after - before).to.equal(deployFee);
    expect(await factory.accruedDeployFees()).to.equal(0n);
  });

  it('burns three Commons, mints one Rare, advances the curve, and accounts for the 15% split', async function () {
    await forge.connect(creator).seedMintBatch(
      creator.address,
      0,
      ['ipfs://common-1', 'ipfs://common-2', 'ipfs://common-3']
    );

    const descendantURI = 'ipfs://rare-1';
    const request = await buildRequest([1, 2, 3], 1, basePrice, descendantURI, 'single');
    const signature = await signRequest(request);

    await expect(
      forge.connect(creator).forge(request, descendantURI, signature, { value: basePrice })
    )
      .to.emit(forge, 'Forged')
      .withArgs(4n, creator.address, 1n, 1n, 2n, 3n, basePrice, request.requestId);

    for (const id of [1n, 2n, 3n]) {
      await expect(forge.ownerOf(id)).to.be.reverted;
    }

    expect(await forge.ownerOf(4n)).to.equal(creator.address);
    expect(await forge.tierOf(4n)).to.equal(1n);
    expect(await forge.mergeCount()).to.equal(1n);
    expect(await forge.currentMergePrice()).to.equal(basePrice + priceIncrement);

    const platformShare = (basePrice * platformBps) / 10_000n;
    expect(await forge.platformAccrued()).to.equal(platformShare);
    expect(await forge.creatorAccrued()).to.equal(basePrice - platformShare);
    expect(await ethers.provider.getBalance(forge.target)).to.equal(basePrice);
  });

  it('batches sequentially-priced merges into one transaction and enforces the declared total', async function () {
    await forge.connect(creator).seedMintBatch(
      creator.address,
      0,
      [
        'ipfs://c1', 'ipfs://c2', 'ipfs://c3',
        'ipfs://c4', 'ipfs://c5', 'ipfs://c6',
      ]
    );

    const firstPrice = basePrice;
    const secondPrice = basePrice + priceIncrement;
    const uri1 = 'ipfs://rare-batch-1';
    const uri2 = 'ipfs://rare-batch-2';
    const request1 = await buildRequest([1, 2, 3], 1, firstPrice, uri1, 'batch-1');
    const request2 = await buildRequest([4, 5, 6], 1, secondPrice, uri2, 'batch-2');
    const signature1 = await signRequest(request1);
    const signature2 = await signRequest(request2);
    const merges = [
      { request: request1, descendantURI: uri1, signature: signature1 },
      { request: request2, descendantURI: uri2, signature: signature2 },
    ];
    const total = firstPrice + secondPrice;

    await expect(forge.connect(creator).batchForge(merges, { value: total - 1n }))
      .to.be.revertedWithCustomError(forge, 'IncorrectForgeFee')
      .withArgs(total, total - 1n);

    await forge.connect(creator).batchForge(merges, { value: total });

    expect(await forge.ownerOf(7n)).to.equal(creator.address);
    expect(await forge.ownerOf(8n)).to.equal(creator.address);
    expect(await forge.tierOf(7n)).to.equal(1n);
    expect(await forge.tierOf(8n)).to.equal(1n);
    expect(await forge.mergeCount()).to.equal(2n);
    expect(await forge.currentMergePrice()).to.equal(basePrice + (priceIncrement * 2n));
  });

  it('does not let future factory fee changes rewrite existing clone economics', async function () {
    await factory.connect(platformOwner).setPlatformBps(2000);
    expect(await factory.platformBps()).to.equal(2000n);
    expect(await forge.platformBps()).to.equal(1500n);
  });

  it('rejects a Common-to-Legendary jump even with a valid signature', async function () {
    await forge.connect(creator).seedMintBatch(
      creator.address,
      0,
      ['ipfs://common-a', 'ipfs://common-b', 'ipfs://common-c']
    );

    const descendantURI = 'ipfs://illegal-legendary';
    const request = await buildRequest([1, 2, 3], 2, basePrice, descendantURI, 'skip-tier');
    const signature = await signRequest(request);

    await expect(
      forge.connect(creator).forge(request, descendantURI, signature, { value: basePrice })
    )
      .to.be.revertedWithCustomError(forge, 'InvalidOutputTier')
      .withArgs(0n, 2n);
  });
});
