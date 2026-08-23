// Voxel Vault cart recovery - abandoned cart tracking and recovery emails

export interface CartSession {
  id: string;
  userId?: string;
  email?: string;
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
  subtotal: number;
  abandonedAt?: number;
  recoveryEmailSentAt?: number;
  recoveryLink: string;
}

class CartRecoveryManager {
  private carts = new Map<string, CartSession>();
  private recoveryDelay = 3600000; // 1 hour
  private maxRetries = 3;

  createCart(userId?: string, email?: string): CartSession {
    const cartId = `cart_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const recoveryLink = `/recover-cart?token=${btoa(cartId)}`;

    const cart: CartSession = {
      id: cartId,
      userId,
      email,
      items: [],
      subtotal: 0,
      recoveryLink,
    };

    this.carts.set(cartId, cart);
    return cart;
  }

  addItem(
    cartId: string,
    itemId: string,
    name: string,
    price: number,
    quantity = 1
  ): boolean {
    const cart = this.carts.get(cartId);
    if (!cart) return false;

    const existingItem = cart.items.find((i) => i.id === itemId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ id: itemId, name, price, quantity });
    }

    cart.subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return true;
  }

  getCart(cartId: string): CartSession | undefined {
    return this.carts.get(cartId);
  }

  markAbandoned(cartId: string): void {
    const cart = this.carts.get(cartId);
    if (cart && cart.items.length > 0) {
      cart.abandonedAt = Date.now();
    }
  }

  async sendRecoveryEmail(
    cartId: string,
    emailService: any
  ): Promise<boolean> {
    const cart = this.carts.get(cartId);
    if (
      !cart ||
      !cart.email ||
      !cart.abandonedAt ||
      (cart.recoveryEmailSentAt &&
        Date.now() - cart.recoveryEmailSentAt < this.recoveryDelay)
    ) {
      return false;
    }

    try {
      await emailService.send({
        to: cart.email,
        subject: `Complete Your Purchase - ${cart.items.length} Items Waiting`,
        template: 'cart-recovery',
        data: {
          cartLink: cart.recoveryLink,
          items: cart.items,
          subtotal: cart.subtotal,
          discount: Math.round(cart.subtotal * 0.1), // 10% incentive
        },
      });

      cart.recoveryEmailSentAt = Date.now();
      return true;
    } catch (error) {
      console.error('Recovery email failed:', error);
      return false;
    }
  }

  clearCart(cartId: string): void {
    this.carts.delete(cartId);
  }
}

export const cartRecovery = new CartRecoveryManager();
