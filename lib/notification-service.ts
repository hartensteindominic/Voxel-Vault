// Voxel Vault notifications - email, push, webhooks

export interface Notification {
  id: string;
  type: 'order' | 'payment' | 'nft_mint' | 'referral' | 'system';
  recipient: string;
  subject: string;
  message: string;
  data?: Record<string, any>;
  sentAt?: number;
}

class NotificationService {
  async sendEmail(
    to: string,
    subject: string,
    template: string,
    data: Record<string, any>
  ): Promise<boolean> {
    try {
      console.log(`Sending email to ${to}: ${subject}`);
      return true;
    } catch (error) {
      console.error('Email send failed:', error);
      return false;
    }
  }

  async sendOrderConfirmation(email: string, orderId: string, items: any[]): Promise<boolean> {
    return this.sendEmail(email, `Order Confirmed: #${orderId}`, 'order_confirmation', {
      orderId,
      items,
      timestamp: Date.now(),
    });
  }

  async sendNFTMintedNotification(email: string, nftUrl: string, itemName: string): Promise<boolean> {
    return this.sendEmail(email, `Your Digital Twin is Ready: ${itemName}`, 'nft_minted', {
      nftUrl,
      itemName,
    });
  }
}

export const notifications = new NotificationService();