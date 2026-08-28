const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('VoxelTestLand', function () {
  async function deploy() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Land = await ethers.getContractFactory('VoxelTestLand');
    const land = await Land.deploy(owner.address);
    await land.waitForDeployment();
    return { owner, alice, bob, land };
  }

  it('mints one finite parcel for the exact fixed test price', async function () {
    const { alice, land } = await deploy();
    const price = await land.MINT_PRICE();

    await expect(land.connect(alice).mintParcel(9, { value: price }))
      .to.emit(land, 'TestParcelMinted')
      .withArgs(9n, alice.address, 1, 1);

    expect(await land.ownerOf(9)).to.equal(alice.address);
    expect(await land.totalMinted()).to.equal(1n);
    expect(await land.parcelOwner(9)).to.equal(alice.address);
  });

  it('blocks duplicate, out-of-range and incorrectly priced mints', async function () {
    const { alice, bob, land } = await deploy();
    const price = await land.MINT_PRICE();

    await expect(land.connect(alice).mintParcel(64, { value: price }))
      .to.be.revertedWithCustomError(land, 'ParcelOutOfRange')
      .withArgs(64n);

    await expect(land.connect(alice).mintParcel(3, { value: 0 }))
      .to.be.revertedWithCustomError(land, 'IncorrectPayment')
      .withArgs(price, 0n);

    await land.connect(alice).mintParcel(3, { value: price });
    await expect(land.connect(bob).mintParcel(3, { value: price }))
      .to.be.revertedWithCustomError(land, 'ParcelAlreadyMinted')
      .withArgs(3n);
  });

  it('exposes the complete 8x8 ownership map in one read', async function () {
    const { alice, land } = await deploy();
    const price = await land.MINT_PRICE();
    await land.connect(alice).mintParcel(0, { value: price });
    await land.connect(alice).mintParcel(63, { value: price });

    const owners = await land.parcelOwners();
    expect(owners.length).to.equal(64);
    expect(owners[0]).to.equal(alice.address);
    expect(owners[63]).to.equal(alice.address);
    expect(owners[1]).to.equal(ethers.ZeroAddress);

    expect(await land.parcelCoordinates(63)).to.deep.equal([7n, 7n]);
  });

  it('metadata explicitly disclaims real-property and investment rights', async function () {
    const { alice, land } = await deploy();
    const price = await land.MINT_PRICE();
    await land.connect(alice).mintParcel(12, { value: price });

    const uri = await land.tokenURI(12);
    expect(uri.startsWith('data:application/json;base64,')).to.equal(true);
    const json = Buffer.from(uri.split(',')[1], 'base64').toString('utf8');
    expect(json).to.include('Base Sepolia-only fictional 3D digital land collectible');
    expect(json).to.include('No deed, real property, rent, security, or investment rights');
  });

  it('only lets the owner withdraw accumulated test ETH', async function () {
    const { owner, alice, land } = await deploy();
    const price = await land.MINT_PRICE();
    await land.connect(alice).mintParcel(1, { value: price });

    await expect(land.connect(alice).withdrawTestFunds())
      .to.be.revertedWithCustomError(land, 'OwnableUnauthorizedAccount')
      .withArgs(alice.address);

    const before = await ethers.provider.getBalance(owner.address);
    const tx = await land.connect(owner).withdrawTestFunds();
    const receipt = await tx.wait();
    const gas = receipt.gasUsed * receipt.gasPrice;
    const after = await ethers.provider.getBalance(owner.address);
    expect(after + gas - before).to.equal(price);
  });
});
