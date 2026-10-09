import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { CustomThemeProvider } from "@/contexts/ThemeContext";
import StructuredData from "@/components/StructuredData";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Yuhao Cheng — ML Systems & Research Engineer",
    template: "%s | Yuhao Cheng Portfolio"
  },
  description: "M.S. Computer Science at UIUC. I build the systems underneath models — distributed training, multi-GPU inference and large-scale LLM evaluation. Experienced in React, Python, PyTorch, and modern web technologies.",
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
    title: "Yuhao Cheng — ML Systems & Research Engineer",
    description: "M.S. Computer Science at UIUC. I build the systems underneath models — distributed training, multi-GPU inference and large-scale LLM evaluation. Explore my research, publications, and projects.",
    siteName: "Yuhao Cheng Portfolio",
    images: [
      {
        url: "/profile_picture.png",
        width: 1200,
        height: 630,
        alt: "Yuhao Cheng — ML Systems & Research Engineer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yuhao Cheng — ML Systems & Research Engineer",
    description: "M.S. Computer Science at UIUC. I build the systems underneath models — distributed training, multi-GPU inference and large-scale LLM evaluation.",
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
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <CustomThemeProvider>
            {children}
          </CustomThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
