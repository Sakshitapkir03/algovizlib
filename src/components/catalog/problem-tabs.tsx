"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * The problem page body. "Explanation" is the only tab today; a "Practice" tab (editor + test runner) slots in
 * here later without restructuring the page. See "Practice mode (planned)" in CLAUDE.md.
 */
export function ProblemTabs({ explanation }: { explanation: ReactNode }) {
  return (
    <Tabs defaultValue="explanation">
      <TabsList variant="line" className="w-full justify-start border-b">
        <TabsTrigger value="explanation" className="flex-none font-mono text-xs">
          explanation
        </TabsTrigger>
      </TabsList>
      <TabsContent value="explanation" className="pt-6">
        {explanation}
      </TabsContent>
    </Tabs>
  );
}
