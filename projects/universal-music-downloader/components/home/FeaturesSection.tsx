'use client';

import { motion } from "motion/react";
import { Zap, ShieldCheck, Layers } from "lucide-react";

interface FeaturesSectionProps {
    title: string;
    features: {
        speed: { title: string; description: string };
        playlist: { title: string; description: string };
        safe: { title: string; description: string };
    };
}

export function FeaturesSection({ title, features }: FeaturesSectionProps) {
    return (
        <section className="py-12 relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 -z-10 opacity-[0.03] [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
                <div className="absolute inset-0 bg-[grid-black_1px_bg-transparent] h-full w-full bg-[size:20px_20px]" />
            </div>

            <div className="max-w-6xl mx-auto px-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center mb-8"
                >
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-3 text-foreground">
                        {title}
                    </h2>
                    <div className="h-1 w-16 bg-foreground/10 rounded-full mx-auto" />
                </motion.div>

                <div className="grid md:grid-cols-3 gap-4">
                    <FeatureCard
                        icon={<Zap className="w-5 h-5 text-foreground/40" />}
                        title={features.speed.title}
                        description={features.speed.description}
                        delay={0.1}
                    />
                    <FeatureCard
                        icon={<Layers className="w-5 h-5 text-foreground/40" />}
                        title={features.playlist.title}
                        description={features.playlist.description}
                        delay={0.2}
                    />
                    <FeatureCard
                        icon={<ShieldCheck className="w-5 h-5 text-foreground/40" />}
                        title={features.safe.title}
                        description={features.safe.description}
                        delay={0.3}
                    />
                </div>
            </div>
        </section>
    );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay }}
            whileHover={{ y: -4 }}
            className="group p-5 bg-card backdrop-blur-xl border border-border hover:border-foreground/20 shadow-lg shadow-black/5 dark:shadow-none rounded-2xl transition-all duration-500 relative overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

            <div className="mb-4 w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                {icon}
            </div>
            <h3 className="text-base font-bold mb-2 tracking-tight text-foreground">{title}</h3>
            <p className="text-foreground/50 leading-relaxed font-medium text-sm">{description}</p>
        </motion.div>
    );
}
