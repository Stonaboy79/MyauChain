require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.ALCHEMY_URL;

module.exports = {
  networks: {
    sepolia: {
      provider: () => new HDWalletProvider({
        privateKeys: [privateKey],   // ← ここ重要（配列 + オブジェクト形式）
        providerOrUrl: rpcUrl        // ← RPC
      }),
      network_id: 11155111,
      gas: 5000000,
      gasPrice: 20000000000
    }
  },

  contracts_build_directory: "./client/src/abis/",

  compilers: {
    solc: {
      version: "0.8.20",
      settings: { optimizer: { enabled: true, runs: 200 } }
    }
  }
};

