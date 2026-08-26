const { expect } = require('chai');
const { ethers, network } = require('hardhat');

const LIVE_VOXELFLIP = '0xa00758b05f96ef4409d97c3ffebb6794b2eafbde';
const DEPLOYMENT_TX = '0xc2f198a3730169bc5c61f0a1251301f16d40441c022b6cc30e9cf06bb8ea31bb';
const BASE_RPC_CANDIDATES = [
  process.env.BASE_FORK_URL,
  process.env.VOXELFLIP_RPC_URL,
  'https://base.blockscout.com/api/eth-rpc',
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
].filter(Boolean);

const PARENT_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function transferFrom(address from,address to,uint256 tokenId)',
  'function setApprovalForAll(address operator,bool approved)',
  'function isApprovedForAll(address owner,address operator) view returns (bool)',
  'function burn(uint256 tokenId)',
  'event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)',
];

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

async function resetToWorkingBaseFork() {
  let lastError;
  for (const jsonRpcUrl of BASE_RPC_CANDIDATES) {
    try {
      await network.provider.request({
        method: 'hardhat_reset',
        params: [{ forking: { jsonRpcUrl } }],
      });
      const code = await ethers.provider.getCode(LIVE_VOXELFLIP);
      if (!code || code === '0x') throw new Error('Live VoxelFlip bytecode was unavailable.');
      return jsonRpcUrl;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No Base fork RPC was available.');
}

async function deploymentBlock() {
  const receipt = await ethers.provider.getTransactionReceipt(DEPLOYMENT_TX);
  if (!receipt || !receipt.blockNumber) throw new Error('Could not locate the live VoxelFlip deployment block.');
  return receipt.blockNumber;
}

async function discoverThreeLiveTokens(parent) {
  const fromBlock = await deploymentBlock();
  const latest = await ethers.provider.getBlockNumber();
  const transferTopic = ethers.id('Transfer(address,address,uint256)');
  const latestOwnerByToken = new Map();
  const chunk = 1_500;

  for (let start = fromBlock; start <= latest; start += chunk) {
    const end = Math.min(latest, start + chunk - 1);
    const logs = await ethers.provider.getLogs({
      address: LIVE_VOXELFLIP,
      fromBlock: start,
      toBlock: end,
      topics: [transferTopic],
    });
    for (const log of logs) {
      if (!log.topics || log.topics.length < 4) continue;
      const to = ethers.getAddress(`0x${log.topics[2].slice(-40)}`);
      const tokenId = BigInt(log.topics[3]);
      latestOwnerByToken.set(tokenId.toString(), to);
    }
  }

  const eoaTokens = [];
  const otherTokens = [];
  for (const [tokenIdText, loggedOwner] of latestOwnerByToken.entries()) {
    if (loggedOwner === ethers.ZeroAddress) continue;
    const tokenId = BigInt(tokenIdText);
    try {
      const currentOwner = ethers.getAddress(await parent.ownerOf(tokenId));
      if (currentOwner !== loggedOwner) continue;
      const code = await ethers.provider.getCode(currentOwner);
      const item = { tokenId, owner: currentOwner };
      if (code === '0x') eoaTokens.push(item);
      else otherTokens.push(item);
    } catch {}
  }

  const selected = [...eoaTokens, ...otherTokens].slice(0, 3);
  if (selected.length < 3) {
    throw new Error(`Only ${selected.length} live VoxelFlip token(s) were discoverable; three are required to prove 3-to-1 Forge compatibility.`);
  }
  return selected;
}

async function consolidateLiveTokensOnFork(parent, selected, destination) {
  for (const { tokenId, owner } of selected) {
    if (owner.toLowerCase() === destination.toLowerCase()) continue;
    await network.provider.request({ method: 'hardhat_impersonateAccount', params: [owner] });
    await network.provider.send('hardhat_setBalance', [owner, '0x56BC75E2D63100000']); // fork-only test balance
    const sourceSigner = await ethers.getSigner(owner);
    await (await parent.connect(sourceSigner).transferFrom(owner, destination, tokenId)).wait();
    expect(await parent.ownerOf(tokenId)).to.equal(destination);
    await network.provider.request({ method: 'hardhat_stopImpersonatingAccount', params: [owner] });
  }
}

describe('VoxelForgeAtomic live Base fork', function () {
  this.timeout(180_000);

  it('proves the deployed VoxelFlip supports atomic transfer -> token-owner burn -> descendant mint', async function () {
    await resetToWorkingBaseFork();

    const [holder, owner, forgeSigner, feeRecipient] = await ethers.getSigners();
    const parent = new ethers.Contract(LIVE_VOXELFLIP, PARENT_ABI, ethers.provider);
    const selected = await discoverThreeLiveTokens(parent);
    const tokenIds = selected.map((item) => item.tokenId);

    // Consolidation happens only in the local fork. It never submits a transaction to Base mainnet.
    await consolidateLiveTokensOnFork(parent, selected, holder.address);

    const Forge = await ethers.getContractFactory('VoxelForgeAtomic');
    const forge = await Forge.deploy(
      owner.address,
      LIVE_VOXELFLIP,
      forgeSigner.address,
      feeRecipient.address,
      500
    );
    await forge.waitForDeployment();

    const parentAsHolder = parent.connect(holder);
    await (await parentAsHolder.setApprovalForAll(await forge.getAddress(), true)).wait();
    expect(await parent.isApprovedForAll(holder.address, await forge.getAddress())).to.equal(true);

    const uris = await Promise.all(tokenIds.map((tokenId) => parent.tokenURI(tokenId)));
    const latest = await ethers.provider.getBlock('latest');
    const descendantURI = 'ipfs://voxelforge-fork-proof/descendant.json';
    const feeWei = ethers.parseEther('0.002');
    const voucher = {
      account: holder.address,
      parentTokenId0: tokenIds[0],
      parentTokenId1: tokenIds[1],
      parentTokenId2: tokenIds[2],
      parentMetadataHash0: hashText(uris[0]),
      parentMetadataHash1: hashText(uris[1]),
      parentMetadataHash2: hashText(uris[2]),
      recipeHash: hashText(`base-fork:${tokenIds.join('-')}:recipe-v1`),
      descendantUriHash: hashText(descendantURI),
      feeWei,
      voucherId: hashText(`base-fork:${tokenIds.join('-')}:voucher-v1`),
      deadline: BigInt(latest.timestamp + 300),
    };

    const chain = await ethers.provider.getNetwork();
    const signature = await forgeSigner.signTypedData(
      {
        name: 'VoxelForge',
        version: '1',
        chainId: chain.chainId,
        verifyingContract: await forge.getAddress(),
      },
      voucherTypes,
      voucher
    );

    await expect(
      forge.connect(holder).forge(voucher, descendantURI, signature, { value: feeWei })
    ).to.emit(forge, 'Forged');

    for (const tokenId of tokenIds) {
      await expect(parent.ownerOf(tokenId)).to.be.reverted;
    }

    expect(await forge.ownerOf(1n)).to.equal(holder.address);
    expect(await forge.tokenURI(1n)).to.equal(descendantURI);
    expect(await ethers.provider.getBalance(await forge.getAddress())).to.equal(feeWei);

    const lineage = await forge.lineageOf(1n);
    expect([...lineage[0]]).to.deep.equal(tokenIds);
    expect(lineage[2]).to.equal(voucher.recipeHash);
  });
});
