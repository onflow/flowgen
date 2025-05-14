"use client";

import { Zap, Wallet } from "lucide-react";
import { useCurrentFlowUser } from "@onflow/kit";

export default function Header() {
	const { user, authenticate, unauthenticate } = useCurrentFlowUser();
	const address = user.addr;

	return (
		<header className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
			<div className="container mx-auto flex justify-between items-center">
				<h1 className="text-2xl font-bold flex items-center">
					<Zap className="mr-2" />
					FlowGen
				</h1>
				<div className="flex items-center space-x-4">
					{user.loggedIn ? (
						<div className="flex items-center space-x-2">
							<div className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium flex items-center">
								<Wallet className="mr-2 h-5 w-5" />
								{address?.slice(0, 6)}...{address?.slice(-4)}
							</div>
							<button
								className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium"
								onClick={() => unauthenticate()}
							>
								Disconnect
							</button>
						</div>
					) : (
						<button
							className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium flex items-center"
							onClick={() => authenticate()}
						>
							<Wallet className="mr-2 h-5 w-5" />
							Connect Wallet
						</button>
					)}
				</div>
			</div>
		</header>
	);
}
