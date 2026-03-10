"use client";

import React from 'react';
import { cn } from "@/lib/utils";

interface MainLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function MainLayout({ children, className, ...props }: MainLayoutProps) {
  return (
    <main 
      className={cn(
        "flex min-h-screen flex-col items-center justify-between p-4 md:p-8",
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
}