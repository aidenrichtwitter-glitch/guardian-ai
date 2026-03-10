import { Suspense } from "react";

import HomeClient from "./HomeClient";

export default async function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeClient />
    </Suspense>
  );
}
