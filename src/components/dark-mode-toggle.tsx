"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { MoonStar, Sun } from "lucide-react";

export default function DarkModeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="pt-2 place-items-end">
        <Button className="p-2.5 rounded-full" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? (
                <Sun className="h-4 w-4"/>
            ) : (
                <MoonStar className="h-4 w-4"/>
            )}
        </Button>
    </div>
  );
}