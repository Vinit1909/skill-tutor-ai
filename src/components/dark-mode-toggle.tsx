// "use client";

// import { useTheme } from "next-themes";
// import { Button } from "@/components/ui/button";
// import { MoonStar, Sun } from "lucide-react";

// export default function DarkModeToggle() {
//   const { theme, setTheme } = useTheme();

//   return (
//     <div className="pt-2 place-items-end">
//         <Button className="p-2.5 rounded-full" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
//             {theme === "dark" ? (
//                 <Sun className="h-4 w-4"/>
//             ) : (
//                 <MoonStar className="h-4 w-4"/>
//             )}
//         </Button>
//     </div>
//   );
// }

"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { MoonStar, Sun } from "lucide-react"
import { useEffect, useState } from "react"

export default function DarkModeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="place-items-end">
      <Button variant="ghost" className="size-12 rounded-xl transition ease-out" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      </Button>
    </div>
  )
}

