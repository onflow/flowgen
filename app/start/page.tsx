'use client'
import React from 'react';
import "../config/flow";
import { useState, useEffect } from "react";
import * as fcl from "@onflow/fcl";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Start() {
    const [user, setUser] = useState({ loggedIn: false, addr: "" });
    const [txStatus, setTxStatus] = useState("");
    const [txid, setTxid] = useState("");
    const router = useRouter();

    useEffect(() => {
        // Subscribe to user authentication changes
        fcl.currentUser.subscribe(setUser);
    }, []);

    const handleLogin = () => {
        fcl.authenticate();
    };

    const handleLogout = () => {
        fcl.unauthenticate();
    };

    const handleSignTransaction = async () => {
        try {
            const transactionId = await fcl.mutate({
                cadence: `
                    transaction {
                        prepare(signer: AuthAccount) {
                            log("Hello from transaction")
                        }
                    }
                `,
                limit: 50
            });

            fcl.tx(transactionId).subscribe((transaction) => {
                setTxStatus(transaction.statusString ?? "PENDING");
                if (transaction.status === 4) {
                    setTxid(transaction.events[0].transactionId);
                }
                console.log(transaction);
            });
        } catch (error) {
            console.error("Error signing transaction:", error);
        }
    };

    return (
        <div className="grid min-h-screen place-items-center p-8">
            <div className="flex flex-col items-center gap-8 text-center">
                <Image
                    className="dark:invert"
                    src="/next.svg"
                    alt="Next.js logo"
                    width={180}
                    height={38}
                    priority
                />

                <div className="max-w-md space-y-4">
                    <h1 className="text-2xl font-bold">Connect Your Flow Wallet</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Sign in with your favorite Flow wallet to access the application
                    </p>
                </div>

                {user.loggedIn ? (
                    <div className="space-y-4">
                        <p className="font-mono">Connected: {user.addr}</p>
                        {txStatus && (
                            <p className="text-sm text-gray-600">
                                Transaction Status: {txStatus}
                            </p>
                        )}
                        {txid && (
                            <p className="text-sm text-gray-600">
                                Transaction ID: {txid}
                            </p>
                        )}
                        <div className="flex gap-4">
                            <button
                                onClick={handleSignTransaction}
                                className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-8"
                            >
                                Sign Transaction
                            </button>
                            <button
                                onClick={handleLogout}
                                className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-red-500 text-white hover:bg-red-600 font-medium text-sm sm:text-base h-10 sm:h-12 px-8"
                            >
                                Disconnect
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={handleLogin}
                        className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-8"
                    >
                        Connect Wallet
                    </button>
                )}
            </div>
        </div>
    );
}
