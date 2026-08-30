function locked(action) {
  throw new Error(`${action} is unavailable because Galactic Trust is not connected to an approved banking provider.`);
}

export function createDemoNullProvider() {
  return Object.freeze({
    id: 'galactic-demo',
    provider: 'Galactic Trust Demo',
    environment: 'demo',
    connected: false,
    canMoveRealMoney: false,
    productionSupported: false,

    async inspect() {
      return {
        provider: 'Galactic Trust Demo',
        environment: 'demo',
        connected: false,
        canMoveRealMoney: false,
        productionSupported: false,
      };
    },

    async getDashboard() {
      return {
        provider: 'Galactic Trust Demo',
        environment: 'demo',
        connected: false,
        canMoveRealMoney: false,
        accounts: [],
        transactions: [],
        setupRequired: false,
      };
    },

    async simulateDeposit() {
      return locked('Provider funding');
    },

    async initiateTransfer() {
      return locked('Provider transfers');
    },
  });
}
