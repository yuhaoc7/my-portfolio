import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { CustomThemeProvider } from "@/contexts/ThemeContext";
import DotGrid from "@/components/DotGrid";
import StructuredData from "@/components/StructuredData";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Yuhao Cheng - Full Stack Developer & ML Engineer",
    template: "%s | Yuhao Cheng Portfolio"
  },
  description: "Master's student in Computer Science at UIUC, specializing in Full Stack Development, Machine Learning, and NLP. Experienced in React, Python, PyTorch, and modern web technologies.",
  keywords: [
    "Yuhao Cheng",
    "Full Stack Developer",
    "Machine Learning Engineer",
    "React Developer",
    "Python Developer",
    "UIUC Computer Science",
    "Web Development",
    "AI/ML",
    "PyTorch",
    "Node.js",
    "Portfolio",
    "Software Engineer"
  ],
  authors: [{ name: "Yuhao Cheng" }],
  creator: "Yuhao Cheng",
  publisher: "Yuhao Cheng",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://yuhaoc7.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://yuhaoc7.com",
    title: "Yuhao Cheng - Full Stack Developer & ML Engineer",
    description: "Master's student in Computer Science at UIUC, specializing in Full Stack Development, Machine Learning, and NLP. View my projects and experience.",
    siteName: "Yuhao Cheng Portfolio",
    images: [
      {
        url: "/profile_picture.png",
        width: 1200,
        height: 630,
        alt: "Yuhao Cheng - Full Stack Developer & ML Engineer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yuhao Cheng - Full Stack Developer & ML Engineer",
    description: "Master's student in Computer Science at UIUC, specializing in Full Stack Development, Machine Learning, and NLP.",
    images: ["/profile_picture.png"],
    creator: "@YuhaoCheng", // Update with actual Twitter handle if available
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add verification codes when you have them
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // yahoo: "your-yahoo-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <StructuredData />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <CustomThemeProvider>
            {/* Full-screen DotGrid Background */}
            <div className="fixed inset-0 w-full h-full z-0">
              <DotGrid
                dotSize={8}
                gap={12}
                baseColor="var(--dot-grid-base)"
                activeColor='var(--color-2)'
                proximity={120}
                shockRadius={150}
                shockStrength={5}
                resistance={750}
                returnDuration={1.5}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            {/* Content layer */}
            <div className="relative z-10">
              {children}
            </div>
          </CustomThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
