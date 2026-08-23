const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Voxel Vault Ethereum marketplace', function () {
  async function deploy() {
    const [owner, creator, buyer, bidder] = await ethers.getSigners();
    const NFT = await ethers.getContractFactory('VoxelVaultNFT');
    const nft = await NFT.deploy(owner.address);
    await nft.waitForDeployment();

    const Market = await ethers.getContractFactory('VoxelVaultMarketplace');
    const market = await Market.deploy(owner.address, await nft.getAddress(), owner.address);
    await market.waitForDeployment();
    await nft.connect(owner).setMinter(await market.getAddress(), true);
    return { owner, creator, buyer, bidder, nft, market };
  }

  it('defaults public mint to disabled', async function () {
    const [owner, creator] = await ethers.getSigners();
    const NFT = await ethers.getContractFactory('VoxelVaultNFT');
    const nft = await NFT.deploy(owner.address);
    await nft.waitForDeployment();

    expect(await nft.publicMintEnabled()).to.equal(false);
    await expect(nft.connect(creator).mint('ipfs://public-mint-should-be-disabled', 0))
      .to.be.revertedWith('Public mint disabled');
  });

  it('mints and lists through the marketplace', async function () {
    const { creator, nft, market } = await deploy();
    await market.connect(creator).mintAndList('ipfs://asset-1', 500, ethers.parseEther('1'));
    expect(await nft.ownerOf(1)).to.equal(await market.getAddress());
    const listing = await market.listings(1);
    expect(listing.seller).to.equal(creator.address);
    expect(listing.price).to.equal(ethers.parseEther('1'));
  });

  it('completes a purchase and credits the creator, royalty, and platform fee correctly', async function () {
    const { owner, creator, buyer, nft, market } = await deploy();
    await market.connect(creator).mintAndList('ipfs://asset-2', 500, ethers.parseEther('1'));
    await market.connect(buyer).buy(1, { value: ethers.parseEther('1') });
    expect(await nft.ownerOf(1)).to.equal(buyer.address);
    expect(await market.pendingWithdrawals(creator.address)).to.equal(ethers.parseEther('0.975'));
    expect(await market.pendingWithdrawals(owner.address)).to.equal(ethers.parseEther('0.025'));
  });

  it('supports funded offers and refunds replaced offers', async function () {
    const { owner, creator, buyer, bidder, nft, market } = await deploy();
    await nft.connect(owner).setPublicMintEnabled(true);
    await nft.connect(creator).setApprovalForAll(await market.getAddress(), true);
    await nft.connect(creator).mint('ipfs://asset-3', 250);
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    await market.connect(buyer).makeOffer(1, expiry, { value: ethers.parseEther('0.5') });
    await market.connect(bidder).makeOffer(1, expiry, { value: ethers.parseEther('0.7') });
    expect(await market.pendingWithdrawals(buyer.address)).to.equal(ethers.parseEther('0.5'));
    expect((await market.offers(1)).amount).to.equal(ethers.parseEther('0.7'));
  });

  it('runs an auction and settles the winning bid', async function () {
    const { owner, creator, bidder, nft, market } = await deploy();
    await nft.connect(owner).setPublicMintEnabled(true);
    await nft.connect(creator).mint('ipfs://asset-4', 250);
    await nft.connect(creator).approve(await market.getAddress(), 1);
    await market.connect(creator).startAuction(1, ethers.parseEther('0.5'), 300);
    await market.connect(bidder).bid(1, { value: ethers.parseEther('0.8') });
    await ethers.provider.send('evm_increaseTime', [301]);
    await ethers.provider.send('evm_mine');
    await market.settleAuction(1);
    expect(await nft.ownerOf(1)).to.equal(bidder.address);
    expect(await market.pendingWithdrawals(creator.address)).to.equal(ethers.parseEther('0.78'));
  });
});
