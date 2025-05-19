"use client";

import { ReactNode } from "react";
import { FlowProvider } from "@onflow/kit";
import flowJson from "../../flow.json";
import { FlowConfig } from "@onflow/kit/types/core/context";

type FlowContextProviderProps = {
	children: ReactNode;
};

const APP_DETAILS = {
	appDetailTitle: "FlowGen",
	appDetailIcon: "https://www.flowgen.art/flowgen.png",
	appDetailUrl: "https://www.flowgen.art",
	appDetailDescription: "AI-generated pixel art on the Flow blockchain",
};

const TESTNET_CONFIG: FlowConfig = {
	...APP_DETAILS,
	accessNodeUrl: "https://rest-testnet.onflow.org",
	flowNetwork: "testnet",
	discoveryWallet: "https://fcl-discovery.onflow.org/testnet/authn",
	walletconnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
};
const EMULATOR_CONFIG: FlowConfig = {
	...APP_DETAILS,
	accessNodeUrl: "http://localhost:8888",
	flowNetwork: "emulator",
	discoveryWallet: "https://fcl-discovery.onflow.org/emulator/authn",
};
// Main Flow provider component
export function FlowContextProvider({ children }: FlowContextProviderProps) {
	return (
		<FlowProvider config={TESTNET_CONFIG} flowJson={flowJson}>
			{children}
		</FlowProvider>
	);
}
