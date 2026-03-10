'use client';

import { Music } from "lucide-react";
import { motion } from "motion/react";
import { ModeToggle } from "./ModeToggle";

export function Header() {
    return (
        <header className="fixed top-0 left-0 w-full z-50 px-4 py-3 flex items-center justify-between pointer-events-none">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 pointer-events-auto"
            >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF5500] to-[#FF0000] flex items-center justify-center shadow-sm shadow-black/20 backdrop-blur-3xl border border-white/10">
                    <Music className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col -space-y-1">
                    <span className="text-base font-black tracking-tight text-foreground">UNIVERSAL</span>
                    <span className="text-[9px] font-black tracking-[0.28em] text-foreground/40 uppercase">Downloader</span>
                </div>
            </motion.div>

            <div className="flex items-center gap-2 pointer-events-auto">
                <ModeToggle />
            </div>
        </header>
    );
}
