const { expect } = require('chai');
const { ethers, network } = require('hardhat');

const LIVE_VOXELFLIP = '0xa00758b05f96ef4409d97c3ffebb6794b2eafbde';
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
  'function mintSigner() view returns (address)',
  'function mintWithVoucher(string uri,bytes32 voucherId,bytes signature) returns (uint256)',
  'function usedVouchers(bytes32 voucherId) view returns (bool)',
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
      // Hardhat 2/EDR can refuse historical execution on an unknown L2 at the
      // exact fork block even when a custom hardfork history is configured.
      // Mine one empty LOCAL block so all calls execute under the configured
      // current hardfork while preserving the forked Base state.
      await network.provider.send('hardhat_mine', ['0x1']);
      const code = await ethers.provider.getCode(LIVE_VOXELFLIP);
      if (!code || code === '0x') throw new Error('Live VoxelFlip bytecode was unavailable.');
      return jsonRpcUrl;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No Base fork RPC was available.');
}

async function replaceMintSignerStorageOnFork(parent, replacementSigner) {
  let currentSigner;
  try {
    currentSigner = ethers.getAddress(await parent.mintSigner());
  } catch (error) {
    throw new Error(`The deployed VoxelFlip does not expose mintSigner(): ${error?.shortMessage || error?.message || error}`);
  }

  const currentNeedle = currentSigner.slice(2).toLowerCase();
  const replacement = replacementSigner.slice(2).toLowerCase();

  for (let slot = 0n; slot < 96n; slot++) {
    const original = await ethers.provider.getStorage(LIVE_VOXELFLIP, slot);
    const word = original.slice(2).padStart(64, '0');
    const index = word.toLowerCase().indexOf(currentNeedle);
    if (index < 0) continue;

    const patched = `0x${word.slice(0, index)}${replacement}${word.slice(index + 40)}`;
    await network.provider.send('hardhat_setStorageAt', [LIVE_VOXELFLIP, ethers.toBeHex(slot), patched]);
    await network.provider.send('evm_mine');

    try {
      if (ethers.getAddress(await parent.mintSigner()) === replacementSigner) return slot;
    } catch {}

    await network.provider.send('hardhat_setStorageAt', [LIVE_VOXELFLIP, ethers.toBeHex(slot), original]);
    await network.provider.send('evm_mine');
  }

  throw new Error(`Could not locate mutable mintSigner storage for ${currentSigner} in the deployed VoxelFlip.`);
}

function mintedTokenId(receipt) {
  const transferTopic = ethers.id('Transfer(address,address,uint256)').toLowerCase();
  const zeroTopic = ethers.zeroPadValue(ethers.ZeroAddress, 32).toLowerCase();
  for (const log of receipt.logs || []) {
    if (String(log.address).toLowerCase() !== LIVE_VOXELFLIP.toLowerCase()) continue;
    if (log.topics?.[0]?.toLowerCase() !== transferTopic) continue;
    if (log.topics?.[1]?.toLowerCase() !== zeroTopic) continue;
    if (log.topics.length < 4) continue;
    return BigInt(log.topics[3]);
  }
  throw new Error('Synthetic VoxelFlip mint did not emit a readable ERC-721 Transfer mint event.');
}

async function mintThreeParentsThroughDeployedBytecode(parent, holder, voucherSigner) {
  await replaceMintSignerStorageOnFork(parent, voucherSigner.address);
  expect(ethers.getAddress(await parent.mintSigner())).to.equal(voucherSigner.address);

  const tokenIds = [];
  for (let i = 0; i < 3; i++) {
    const uri = `ipfs://voxelforge-live-bytecode-proof/parent-${i + 1}.json`;
    const voucherId = hashText(`voxelforge-live-bytecode-proof:${i + 1}:${holder.address}`);
    const uriHash = ethers.keccak256(ethers.toUtf8Bytes(uri));
    const digest = ethers.solidityPackedKeccak256(
      ['address', 'bytes32', 'bytes32'],
      [holder.address, uriHash, voucherId]
    );
    const signature = await voucherSigner.signMessage(ethers.getBytes(digest));

    expect(await parent.usedVouchers(voucherId)).to.equal(false);
    const tx = await parent.connect(holder).mintWithVoucher(uri, voucherId, signature);
    const receipt = await tx.wait();
    const tokenId = mintedTokenId(receipt);
    expect(await parent.ownerOf(tokenId)).to.equal(holder.address);
    expect(await parent.tokenURI(tokenId)).to.equal(uri);
    expect(await parent.usedVouchers(voucherId)).to.equal(true);
    tokenIds.push(tokenId);
  }
  return tokenIds;
}

describe('VoxelForgeAtomic live Base fork', function () {
  this.timeout(180_000);

  it('proves the deployed VoxelFlip bytecode supports atomic transfer -> token-owner burn -> descendant mint', async function () {
    await resetToWorkingBaseFork();

    const [holder, owner, voucherSigner, forgeSigner, feeRecipient] = await ethers.getSigners();
    const parent = new ethers.Contract(LIVE_VOXELFLIP, PARENT_ABI, ethers.provider);

    // Production currently has no live parents to consume. These three are minted only inside
    // the disposable Hardhat fork through the real deployed mintWithVoucher bytecode.
    const tokenIds = await mintThreeParentsThroughDeployedBytecode(parent, holder, voucherSigner);

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
