'use client';

import { motion } from "motion/react";

interface HeroSectionProps {
    title: string;
    description: string;
}

export function HeroSection({ title, description }: HeroSectionProps) {
    return (
        <section className="relative pt-20 sm:pt-24 pb-6 px-4 overflow-hidden">
            <div className="max-w-4xl mx-auto text-center space-y-4 relative">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center"
                >
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-foreground">
                        {title}
                    </h1>
                </motion.div>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="text-sm sm:text-base text-foreground/50 max-w-xl mx-auto leading-relaxed font-medium"
                >
                    {description}
                </motion.p>
            </div>
        </section>
    );
}
