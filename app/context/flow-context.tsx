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
	appDetailIcon: "https://flowgen.me/logo.png",
	appDetailUrl: "https://flowgen.me",
	appDetailDescription: "AI-generated pixel art on the Flow blockchain",
};

const TESTNET_CONFIG: FlowConfig = {
	...APP_DETAILS,
	accessNodeUrl: "https://rest-testnet.onflow.org",
	flowNetwork: "testnet",
	discoveryWallet: "https://fcl-discovery.onflow.org/testnet/authn",
};
const EMULATOR_CONFIG: FlowConfig = {
	...APP_DETAILS,
	accessNodeUrl: "http://localhost:8080",
	flowNetwork: "emulator",
	discoveryWallet: "https://fcl-discovery.onflow.org/emulator/authn",
};
// Main Flow provider component
export function FlowContextProvider({ children }: FlowContextProviderProps) {
	return (
		<FlowProvider config={EMULATOR_CONFIG} flowJson={flowJson}>
			{children}
		</FlowProvider>
	);
}
