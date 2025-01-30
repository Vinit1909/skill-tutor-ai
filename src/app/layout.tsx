// import type { Metadata } from "next";
// import { Inter } from 'next/font/google'
// import "./globals.css";
// import { AuthProvider } from "@/context/authcontext";
// import { ThemeProvider } from "next-themes";

// const inter = Inter({
//   subsets: ['latin'],
//   display: 'swap',
// })

// export const metadata: Metadata = {
//   title: "SkillSpace",
//   description: "Generated by create next app",
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en">
//       <body
//         className={inter.className}
//       >
//         <ThemeProvider 
//           attribute="class" 
//           defaultTheme="system" 
//           enableSystem
//           disableTransitionOnChange
//         >
//           <AuthProvider>
//             {children}
//           </AuthProvider>
//         </ThemeProvider>
//       </body>
//     </html>
//   );
// }


import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/context/authcontext"
import { ThemeProvider } from "@/components/theme-provider"
import type React from "react" // Added import for React

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "SkillSpace",
  description: "Generated by create next app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

