import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation";
import { FlowContextProvider } from "./context/flow-context";
import Header from "./components/header";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "FlowGen",
	description: "AI-generated pixel art on the Flow blockchain",

	icons: {
		icon: ["/favicon.ico", "/favicon-96x96.png"],
		apple: "/apple-touch-icon.png",

		other: {
			rel: "manifest",
			url: "/site.webmanifest",
		},
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			{/*
			  Next.js will automatically add a <head> tag.
			  You can add favicon links directly here, or manage them via the `metadata` object above for Next.js 13+.
			  If you use an online generator and it provides <link> and <meta> tags,
			  you can paste them here. For example:

			  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
			  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
			  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
			  <link rel="manifest" href="/site.webmanifest">
			  <meta name="theme-color" content="#ffffff">
			*/}
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<FlowContextProvider>
					<Header />
					{children}
				</FlowContextProvider>
			</body>
		</html>
	);
}
