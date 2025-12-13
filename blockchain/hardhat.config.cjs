require("hardhat-deploy");
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.20",
  namedAccounts: {
    deployer: 0,
  },
  networks: {
    sepolia: {
      url: "https://1rpc.io/sepolia",
      accounts: ["0x498899247e54953ac0aebaf7f3eca07857c5e9b61208d01af3830b9ac559b7f8"],
    },
  },
};



