"use client";

import { ReactNode } from "react";
import { FlowProvider } from "@onflow/kit";
import flowJson from "../../flow.json";

type FlowContextProviderProps = {
	children: ReactNode;
};

// Main Flow provider component
export function FlowContextProvider({ children }: FlowContextProviderProps) {
	return (
		<FlowProvider
			config={{
				accessNodeUrl: "http://localhost:8888",
				flowNetwork: "emulator",
				appDetailTitle: "FlowGen",
				appDetailIcon: "https://flowgen.me/logo.png",
				appDetailUrl: "https://flowgen.me",
				appDetailDescription: "AI-generated pixel art on the Flow blockchain",
				discoveryWallet: "https://fcl-discovery.onflow.org/emulator/authn",
			}}
			flowJson={flowJson}
		>
			{children}
		</FlowProvider>
	);
}
