'use client';

import React, { useEffect, useState } from "react";
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';

export const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const onScroll = () => {
      setIsVisible(window.pageYOffset > 300);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="fixed bottom-24 right-4 z-40">
      {isVisible && (
        <Button
          onClick={scrollToTop}
          size="icon"
          variant="outline"
          aria-label="Scroll to top"
          className="rounded-full shadow-sm bg-black/5 border-black/10 backdrop-blur-xl hover:bg-black/10 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
