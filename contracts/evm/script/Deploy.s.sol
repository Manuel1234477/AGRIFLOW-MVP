// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {AgriFlowGasMaster} from "../src/AgriFlowGasMaster.sol";
import {AgriFlowEscrow} from "../src/AgriFlowEscrow.sol";

contract DeployAgriFlowInfrastructure is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(deployerPrivateKey);

        address treasury = vm.envOr("AGRIFLOW_TREASURY", deployer);
        address relayer = vm.envOr("AGRIFLOW_RELAYER", deployer);

        console.log("Deploying AgriFlow Contracts with deployer:", deployer);
        console.log("Treasury:", treasury);
        console.log("Relayer:", relayer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy AgriFlowGasMaster first with deployer as owner
        address[] memory initialTargets = new address[](0);
        AgriFlowGasMaster gasMaster = new AgriFlowGasMaster(deployer, initialTargets);
        console.log("AgriFlowGasMaster deployed to:", address(gasMaster));

        // 2. Deploy AgriFlowEscrow referencing GasMaster as trusted forwarder
        AgriFlowEscrow escrow = new AgriFlowEscrow(treasury, relayer, address(gasMaster));
        console.log("AgriFlowEscrow deployed to:", address(escrow));

        // 3. Whitelist AgriFlowEscrow as an approved target in GasMaster
        gasMaster.setTargetWhitelist(address(escrow), true);
        console.log("AgriFlowEscrow whitelisted on AgriFlowGasMaster");

        // 4. If deployer is not treasury, transfer GasMaster ownership to treasury
        if (deployer != treasury) {
            gasMaster.transferOwnership(treasury);
            console.log("GasMaster ownership transferred to Treasury:", treasury);
        }

        vm.stopBroadcast();
    }
}
