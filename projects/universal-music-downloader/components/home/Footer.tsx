export function Footer({ text }: { text: string }) {
    return (
        <footer className="mt-12 border-t border-white/10 bg-white/5 backdrop-blur-xl">
            <div className="max-w-6xl mx-auto px-4 py-8 text-center space-y-3">
                <div className="text-sm font-black tracking-tight brightness-90">
                    <span className="text-foreground">UNIVERSAL</span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-foreground/55">
                    <a href="#privacy" className="transition hover:text-foreground">Privacy</a>
                    <a href="#terms" className="transition hover:text-foreground">Terms</a>
                    <a href="#support" className="transition hover:text-foreground">Support</a>
                    <span className="text-foreground/25">·</span>
                    <span>© {new Date().getFullYear()} — {text}</span>
                </div>
            </div>
        </footer>
    );
}
