module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy("CountryNFT", {
        from: deployer,
        args: [], // constructor引数があればここに書く
        log: true,
    });
};
