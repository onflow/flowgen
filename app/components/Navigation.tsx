import Link from 'next/link'

export default function Navigation() {
    return (
        <nav className="fixed top-0 left-0 right-0 p-4 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-50">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <Link href="/" className="font-bold">
                    Flowgen
                </Link>
                <Link
                    href="/login"
                    className="rounded-full px-4 py-2 bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity"
                >
                    Login
                </Link>
            </div>
        </nav>
    );
}
