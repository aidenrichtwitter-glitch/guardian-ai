"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface AnimatedTabsProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (id: string) => void;
    className?: string;
    layoutId?: string;
}

export function AnimatedTabs({ tabs, activeTab, onTabChange, className, layoutId = "active-tab-bubble" }: AnimatedTabsProps) {
    return (
        <div className={cn("inline-flex items-center justify-center p-1.5 bg-muted/20 backdrop-blur-sm rounded-full border border-border/50", className)}>
	            {tabs.map((tab) => (
	                <button
	                    type="button"
	                    key={tab.id}
	                    onClick={() => onTabChange(tab.id)}
	                    className={cn(
	                        "relative px-6 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full min-w-[120px]",
	                        activeTab === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                    )}
                    style={{
                        WebkitTapHighlightColor: "transparent",
                    }}
                >
                    {activeTab === tab.id && (
                        <motion.div
                            layoutId={layoutId}
                            className="absolute inset-0 z-0 bg-background shadow-sm rounded-full border border-border/50"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {tab.icon}
                        {tab.label}
                    </span>
                </button>
            ))}
        </div>
    );
}
