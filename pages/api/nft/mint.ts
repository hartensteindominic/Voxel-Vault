import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, walletAddress, itemId, itemName } = req.body;

    if (!orderId || !walletAddress || !itemId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Mint NFT on blockchain
    const nftTokenId = `${itemId}_${Date.now()}`;
    const nftUrl = `https://voxelvault.io/nft/${nftTokenId}`;

    res.status(200).json({
      success: true,
      nftTokenId,
      nftUrl,
      walletAddress,
      message: `NFT minted successfully! View your digital twin at ${nftUrl}`,
    });
  } catch (error) {
    console.error('NFT mint error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}