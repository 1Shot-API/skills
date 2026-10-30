/**
 * `@metamask/delegation-deployments` lists Arc Testnet (5042002) but not Arc
 * mainnet (5042). Framework v1.3.0 is CREATE2-deployed at the same addresses on
 * both. Without this override, `getSmartAccountsEnvironment(5042)` throws
 * `No contracts found for version 1.3.0 chain 5042`.
 *
 * Import once before any kit environment lookup (side effect below).
 * Safe to re-run: skips if the kit already knows the chain.
 */

import {
  getSmartAccountsEnvironment,
  PREFERRED_VERSION,
} from "@metamask/smart-accounts-kit";
import { overrideDeployedEnvironment } from "@metamask/smart-accounts-kit/utils";

const ARC_MAINNET = 5042;
const ARC_TESTNET = 5042002;

export function registerSmartAccountsEnvironments() {
  try {
    getSmartAccountsEnvironment(ARC_MAINNET);
    return;
  } catch {
    // Not in the published registry yet — inject Arc Testnet's identical env.
  }

  const template = getSmartAccountsEnvironment(ARC_TESTNET);
  overrideDeployedEnvironment(ARC_MAINNET, PREFERRED_VERSION, template);
}

registerSmartAccountsEnvironments();
