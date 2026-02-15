"use client"

import { useState, useEffect } from "react"
import { useCustomTheme } from "@/contexts/ThemeContext"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import ModeToggle from "@/components/mode-toggle"
import SpotlightCard from "@/components/SpotlightCard"
import Image from "next/image"
import TextTypeWrapper from "@/components/TextTypeWrapper"
import TiltedCard from "@/components/TiltedCard"
import { Github, Linkedin, Mail, Phone, MapPin, ExternalLink, Calendar, GraduationCap, Briefcase, Code, Globe } from "lucide-react"
import {
  SiJavascript, SiPython, SiCplusplus, SiSharp, SiMysql,
  SiPytorch, SiReact, SiVuedotjs, SiNodedotjs, SiExpress, SiDocker,
  SiFastapi, SiApacheecharts, SiChartdotjs, SiVite,
  SiUnity, SiGit, SiNvidia, SiLatex, SiGnubash,
  SiGooglecloud, SiNginx, SiPostgresql, SiRedis, SiPrometheus
} from "react-icons/si"
import { DiDatabase } from "react-icons/di"
import { MdTranslate } from "react-icons/md"
import { FaBrain, FaRobot, FaCode, FaServer, FaMicrochip, FaJava, FaAws } from "react-icons/fa"
import PillNav from "@/components/PillNav"

// Custom hook for responsive card dimensions
const useResponsiveCardDimensions = () => {
  const [dimensions, setDimensions] = useState({
    containerHeight: '600px',
    imageHeight: '580px'
  })

  useEffect(() => {
    const updateDimensions = () => {
      if (window.innerWidth < 640) { // Mobile
        setDimensions({
          containerHeight: '700px', // Larger for mobile
          imageHeight: '680px'
        })
      } else if (window.innerWidth < 768) { // Tablet
        setDimensions({
          containerHeight: '650px',
          imageHeight: '630px'
        })
      } else { // Desktop
        setDimensions({
          containerHeight: '600px',
          imageHeight: '580px'
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  return dimensions
}

export default function PortfolioContent() {
  const { colorTheme } = useCustomTheme()
  const cardDimensions = useResponsiveCardDimensions()

  // Navigation items for PillNav
  const navItems = [
    { label: "Home", href: "#" },
    { label: "Photography", href: "/photography" },
    { label: "About", href: "#about" },
    { label: "Education", href: "#education" },
    { label: "Projects", href: "#projects" },
    { label: "Experience", href: "#experience" },
    { label: "Skills", href: "#skills" },
  ];

  // Simple active section tracking (you can enhance this with intersection observer)
  const [activeSection, setActiveSection] = useState("#");

  // Get theme-aware colors for PillNav using CSS variables
  const getNavColors = () => {
    return {
      baseColor: "var(--foreground)",
      pillColor: "var(--primary)",
      hoveredPillTextColor: "var(--background)",
      pillTextColor: "var(--primary-foreground)"
    }
  }

  const navColors = getNavColors();

  // Skills showcase data - using CSS variables for consistent theming
  const skillsData = {
    languages: [
      { name: 'JavaScript', icon: <SiJavascript size={32} className="text-chart-1" />, level: 'Advanced' },
      { name: 'Python', icon: <SiPython size={32} className="text-chart-2" />, level: 'Advanced' },
      { name: 'C/C++', icon: <SiCplusplus size={32} className="text-chart-3" />, level: 'Intermediate' },
      { name: 'Java', icon: <FaJava size={32} className="text-chart-4" />, level: 'Intermediate' },
      { name: 'C#', icon: <SiSharp size={32} className="text-chart-5" />, level: 'Intermediate' },
      { name: 'SQL', icon: <DiDatabase size={32} className="text-primary" />, level: 'Advanced' },
      { name: 'Bash', icon: <SiGnubash size={32} className="text-accent" />, level: 'Intermediate' },
      { name: 'SystemVerilog', icon: <FaMicrochip size={32} className="text-foreground" />, level: 'Intermediate' },
      { name: 'Assembly', icon: <FaCode size={32} className="text-chart-1" />, level: 'Intermediate' },
      { name: 'LaTeX', icon: <SiLatex size={32} className="text-chart-2" />, level: 'Intermediate' },
    ],
    technologies: [
      { name: 'PyTorch', icon: <SiPytorch size={32} className="text-chart-3" />, level: 'Advanced' },
      { name: 'React', icon: <SiReact size={32} className="text-chart-4" />, level: 'Advanced' },
      { name: 'Vue 3', icon: <SiVuedotjs size={32} className="text-chart-5" />, level: 'Advanced' },
      { name: 'Node.js', icon: <SiNodedotjs size={32} className="text-primary" />, level: 'Advanced' },
      { name: 'Express', icon: <SiExpress size={32} className="text-accent" />, level: 'Advanced' },
      { name: 'MySQL', icon: <SiMysql size={32} className="text-foreground" />, level: 'Advanced' },
      { name: 'Docker', icon: <SiDocker size={32} className="text-chart-1" />, level: 'Intermediate' },
      { name: 'FastAPI', icon: <SiFastapi size={32} className="text-chart-2" />, level: 'Advanced' },
      { name: 'ECharts', icon: <SiApacheecharts size={32} className="text-chart-3" />, level: 'Intermediate' },
      { name: 'Chart.js', icon: <SiChartdotjs size={32} className="text-chart-4" />, level: 'Intermediate' },
      { name: 'Vite', icon: <SiVite size={32} className="text-chart-5" />, level: 'Intermediate' },
      { name: 'Nginx', icon: <SiNginx size={32} className="text-primary" />, level: 'Intermediate' },
    ],
    domains: [
      { name: 'Full Stack Development', icon: <FaCode size={32} className="text-chart-1" />, level: 'Expert' },
      { name: 'Machine Learning', icon: <FaBrain size={32} className="text-chart-2" />, level: 'Advanced' },
      { name: 'NLP', icon: <MdTranslate size={32} className="text-chart-3" />, level: 'Advanced' },
      { name: 'Reinforcement Learning', icon: <FaRobot size={32} className="text-chart-4" />, level: 'Intermediate' },
    ],
    tools: [
      { name: 'GCP', icon: <SiGooglecloud size={32} className="text-primary" />, level: 'Intermediate' },
      { name: 'AWS', icon: <FaAws size={32} className="text-foreground" />, level: 'Intermediate' },
      { name: 'Git', icon: <SiGit size={32} className="text-chart-5" />, level: 'Advanced' },
      { name: 'VS Code', icon: <Code size={32} className="text-accent" />, level: 'Expert' },
    ]
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <div className="sticky top-0 z-50 w-full flex justify-center">
        <PillNav
          logo="/profile_picture.png"
          logoAlt="Yuhao Cheng"
          items={navItems}
          activeHref={activeSection}
          className="custom-nav"
          ease="power2.easeOut"
          baseColor={navColors.baseColor}
          pillColor={navColors.pillColor}
          hoveredPillTextColor={navColors.hoveredPillTextColor}
          pillTextColor={navColors.pillTextColor}
        />
        {/* Theme Toggle Button - Positioned to avoid nav overlap */}
        <div className="absolute right-4 top-16 sm:top-4 z-40">
          <ModeToggle />
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <section id="about" className="py-16 text-center min-h-[600px]">
          <div className="mx-auto max-w-4xl">

            <div className="w-full max-w-4xl mx-auto">
              <TiltedCard
                imageSrc="/city.jpg"
                altText="Yuhao Cheng Information"
                captionText={undefined}
                containerHeight={cardDimensions.containerHeight}
                containerWidth="100%"
                imageHeight={cardDimensions.imageHeight}
                imageWidth="100%"
                rotateAmplitude={6}
                scaleOnHover={1.02}
                showMobileWarning={false}
                showTooltip={false}
                displayOverlayContent={true}
                overlayContent={
                  <div className="w-full h-full flex flex-col items-center justify-center text-center px-4 py-6 sm:p-8 text-card-foreground">
                    {/* Hero Title - Responsive text sizing */}
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl mb-4 sm:mb-6">
                      Yuhao Cheng
                    </h1>

                    {/* Typing Animation - Better responsive sizing */}
                    <div className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 min-h-[2rem] sm:min-h-[2.5rem]">
                      <TextTypeWrapper
                        text={[
                          "Master's Student in Computer Science at UIUC",
                          "Full Stack Developer & ML Engineer",
                          "Passionate about innovative tech solutions"
                        ]}
                        typingSpeed={75}
                        pauseDuration={1500}
                        showCursor={true}
                        cursorCharacter="|"
                        className="text-base sm:text-lg md:text-xl"
                      />
                    </div>

                    {/* Description - Better mobile text sizing and spacing */}
                    <p className="text-sm sm:text-base md:text-lg mb-6 sm:mb-8 max-w-xs sm:max-w-md md:max-w-2xl mx-auto leading-relaxed">
                      Specializing in Full Stack Development, Machine Learning, and Natural Language Processing.
                      Currently supervised by <a href="https://czhai.cs.illinois.edu/" target="_blank" rel="noopener noreferrer" className="text-[var(--link-color)] hover:underline">Professor ChengXiang Zhai</a> as a research intern in the <a href="https://timan.cs.illinois.edu/ir/people.html" target="_blank" rel="noopener noreferrer" className="text-[var(--link-color)] hover:underline">TIMAN group</a>.
                      Passionate about building innovative solutions that bridge technology and real-world applications.
                    </p>

                    {/* Contact Information - Responsive grid layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-8 text-xs sm:text-sm opacity-90 w-full max-w-lg lg:max-w-none">
                      <div className="flex items-center justify-center lg:justify-start gap-2 min-w-0">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="truncate">603 E Clark St, IL 61820</span>
                      </div>
                      <div className="flex items-center justify-center lg:justify-start gap-2 min-w-0">
                        <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <a href="mailto:yuhaoc7@outlook.com" className="hover:underline truncate">
                          yuhaoc7@outlook.com
                        </a>
                      </div>
                      <div className="flex items-center justify-center lg:justify-start gap-2 min-w-0">
                        <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="truncate">US: +1 217-979-8890</span>
                      </div>
                      <div className="flex items-center justify-center lg:justify-start gap-2 min-w-0">
                        <Globe className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <a href="https://yuhaoc7.com" target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                          yuhaoc7.com
                        </a>
                      </div>
                    </div>

                    {/* Social Links - Responsive button sizing and layout */}
                    <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 w-full max-w-sm sm:max-w-none">
                      <Button variant="outline" size="sm" className="bg-card-foreground/10 hover:bg-card-foreground/20 text-xs sm:text-sm" asChild>
                        <a href="https://github.com/yuhaoc7" target="_blank" rel="noopener noreferrer">
                          <Github className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          GitHub
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="bg-card-foreground/10 hover:bg-card-foreground/20 text-xs sm:text-sm" asChild>
                        <a href="https://www.linkedin.com/in/yuhao-cheng-50b473328/" target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          LinkedIn
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="bg-card-foreground/10 hover:bg-card-foreground/20 text-xs sm:text-sm" asChild>
                        <a href="mailto:yuhaoc7@outlook.com">
                          <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          Contact
                        </a>
                      </Button>
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        </section>

        <Separator className="my-16" />

        {/* Education Section */}
        <section id="education" className="py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-2">
              <GraduationCap className="h-8 w-8" />
              Education
            </h2>

            <div className="space-y-6">
              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Master of Computer Science (MCS)</CardTitle>
                      <CardDescription className="text-base font-medium">
                        University of Illinois Urbana-Champaign
                      </CardDescription>
                    </div>
                    <Badge variant="color1" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Aug 2025 – Present
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-2">
                    <strong>Coursework:</strong> Software Engineering, Communication Networks, Text Information Systems
                  </p>
                </CardContent>
              </SpotlightCard>

              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Bachelor of Science in Computer Engineering</CardTitle>
                      <CardDescription className="text-base font-medium">
                        University of Illinois Urbana-Champaign
                      </CardDescription>
                    </div>
                    <Badge variant="color1" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      2021 – 2025
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    <strong>Coursework:</strong> Data Structures, Operating Systems, AI, Databases, Algorithms
                  </p>
                </CardContent>
              </SpotlightCard>
            </div>
          </div>
        </section>

        <Separator className="my-16" />

        {/* Projects Section */}
        <section id="projects" className="py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-2">
              <Code className="h-8 w-8" />
              Projects
            </h2>

            <div className="space-y-6">
              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Weather & City Insights App (Android)
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </CardTitle>
                      <CardDescription>Feature-rich Android application with Gemini LLM integration</CardDescription>
                    </div>
                    <Badge variant="color1">Sep 2025 – Dec 2025</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Developed a feature-rich Android application in a seven-person Agile team, serving as a core developer for UI customization and backend integration.</li>
                      <li>• Designed and implemented a dynamic theming engine, enabling user-customizable aesthetics and integrating Gemini LLM to generate UI themes from user prompts.</li>
                      <li>• Built robust weather data retrieval services, abstracting third-party API interactions to deliver real-time conditions and AI-powered "Weather Insights" for tracked cities.</li>
                      <li>• Engineered comprehensive automated test suites using JUnit, Robolectric, and Espresso, leveraging LLM-assisted tools to generate high-coverage test cases for user authentication flows.</li>
                    </ul>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Badge variant="secondary">Android</Badge>
                      <Badge variant="secondary">Java</Badge>
                      <Badge variant="secondary">Gemini LLM</Badge>
                      <Badge variant="secondary">JUnit</Badge>
                      <Badge variant="secondary">Robolectric</Badge>
                      <Badge variant="secondary">Espresso</Badge>
                    </div>
                  </div>
                </CardContent>
              </SpotlightCard>

              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        FinTrack Financial Tracking Platform
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </CardTitle>
                      <CardDescription>Full-stack financial tracking application with cloud deployment</CardDescription>
                    </div>
                    <Badge variant="color1">Feb 2025 – Apr 2025</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Designed and implemented a full-stack financial web application with React frontend and a Node.js/Express REST API, supporting real-time multi-currency conversion via external APIs.</li>
                      <li>• Designed a relational MySQL schema (transactions, triggers, stored procedures) to ensure data consistency for financial records.</li>
                      <li>• Deployed the system to Google Cloud Platform (GCP), hosting the Node.js API server, MySQL database, and frontend with cloud-based networking and storage.</li>
                    </ul>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Badge variant="secondary">React</Badge>
                      <Badge variant="secondary">Node.js</Badge>
                      <Badge variant="secondary">Express</Badge>
                      <Badge variant="secondary">MySQL</Badge>
                      <Badge variant="secondary">GCP</Badge>
                    </div>
                  </div>
                </CardContent>
              </SpotlightCard>

              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Web Navigation Agent Research Project
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </CardTitle>
                      <CardDescription>Advanced RL-based web agent with memory mechanisms</CardDescription>
                    </div>
                    <Badge variant="color1">Sep 2024 – May 2025</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Overcame the long-standing challenge of designing an effective reward function for RL-based web agents, enabling stable and efficient training</li>
                      <li>• Integrated agent memory mechanisms to mitigate forgetting issues in complex, multi-step tasks, significantly improving long-horizon task performance</li>
                      <li>• Fine-tuned LLMs with PyTorch using Supervised Fine-Tuning (SFT) and NLP techniques, achieving higher completion rates and stronger generalization on WebArena</li>
                    </ul>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Badge variant="secondary">PyTorch</Badge>
                      <Badge variant="secondary">Reinforcement Learning</Badge>
                      <Badge variant="secondary">NLP</Badge>
                      <Badge variant="secondary">LLMs</Badge>
                      <Badge variant="secondary">WebArena</Badge>
                    </div>
                  </div>
                </CardContent>
              </SpotlightCard>
            </div>
          </div>
        </section>

        <Separator className="my-16" />

        {/* Experience Section */}
        <section id="experience" className="py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-2">
              <Briefcase className="h-8 w-8" />
              Experience
            </h2>

            <div className="space-y-6">
              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Frontend Developer Intern</CardTitle>
                      <CardDescription className="text-base font-medium">visibilityx.ai</CardDescription>
                    </div>
                    <Badge variant="color1">Jun 2025 – Aug 2025</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Built a single-page application (SPA) with Vue 3 + TypeScript and Vuex state management, following modular and component-driven design principles.</li>
                      <li>• Developed data-intensive dashboards using ECharts, consuming SQL-backed REST APIs with robust loading, error handling, and state synchronization.</li>
                      <li>• Improved reliability and developer velocity by adding unit tests (Jest/Vitest) and optimizing the build pipeline with Vite.</li>
                    </ul>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Badge variant="secondary">Vue 3</Badge>
                      <Badge variant="secondary">TypeScript</Badge>
                      <Badge variant="secondary">Vuex</Badge>
                      <Badge variant="secondary">ECharts</Badge>
                      <Badge variant="secondary">Vite</Badge>
                      <Badge variant="secondary">Jest/Vitest</Badge>
                    </div>
                  </div>
                </CardContent>
              </SpotlightCard>

              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Backend Developer Intern</CardTitle>
                      <CardDescription className="text-base font-medium">HiABR Lab</CardDescription>
                    </div>
                    <Badge variant="color1">May 2024 – Aug 2024</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Designed and implemented a distributed URL shortening service using FastAPI and PostgreSQL, with Redis caching for hot-path redirects to reduce latency and database load.</li>
                      <li>• Built production-grade REST APIs with sliding-window rate limiting, idempotency keys, and input validation to ensure reliability and abuse prevention in a multi-tenant environment.</li>
                      <li>• Added observability and deployment infrastructure by integrating Prometheus metrics and containerizing microservices with Docker.</li>
                    </ul>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Badge variant="secondary">FastAPI</Badge>
                      <Badge variant="secondary">PostgreSQL</Badge>
                      <Badge variant="secondary">Redis</Badge>
                      <Badge variant="secondary">Docker</Badge>
                      <Badge variant="secondary">Prometheus</Badge>
                    </div>
                  </div>
                </CardContent>
              </SpotlightCard>
            </div>
          </div>
        </section>

        <Separator className="my-16" />

        {/* Skills Section */}
        <section id="skills" className="py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold mb-8 text-center">Skills & Expertise</h2>
            <p className="text-center text-muted-foreground mb-12">
              My technical proficiency across various domains and technologies
            </p>

            {/* Featured Skills Cards */}
            <div className="flex flex-wrap justify-center gap-8 mb-12">
              <TiltedCard
                backgroundColor="var(--chart-1)"
                altText="Full Stack Development"
                captionText="Full Stack Development - React, Node.js, Python"
                containerHeight="200px"
                containerWidth="200px"
                imageHeight="180px"
                imageWidth="180px"
                rotateAmplitude={8}
                scaleOnHover={1.05}
                showMobileWarning={false}
                showTooltip={true}
                displayOverlayContent={true}
                overlayContent={
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                    <FaCode size={32} className="mb-3 text-primary-foreground" />
                    <h4 className="text-lg font-bold mb-1 text-primary-foreground">Full Stack</h4>
                    <p className="text-sm opacity-90 text-primary-foreground">Development</p>
                  </div>
                }
              />

              <TiltedCard
                backgroundColor="var(--chart-2)"
                altText="Machine Learning"
                captionText="Machine Learning - PyTorch, TensorFlow, NLP"
                containerHeight="200px"
                containerWidth="200px"
                imageHeight="180px"
                imageWidth="180px"
                rotateAmplitude={8}
                scaleOnHover={1.05}
                showMobileWarning={false}
                showTooltip={true}
                displayOverlayContent={true}
                overlayContent={
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                    <FaBrain size={32} className="mb-3 text-primary-foreground" />
                    <h4 className="text-lg font-bold mb-1 text-primary-foreground">Machine</h4>
                    <p className="text-sm opacity-90 text-primary-foreground">Learning</p>
                  </div>
                }
              />

              <TiltedCard
                backgroundColor="var(--chart-3)"
                altText="Data Science"
                captionText="Data Science - Analytics, Visualization, AI"
                containerHeight="200px"
                containerWidth="200px"
                imageHeight="180px"
                imageWidth="180px"
                rotateAmplitude={8}
                scaleOnHover={1.05}
                showMobileWarning={false}
                showTooltip={true}
                displayOverlayContent={true}
                overlayContent={
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                    <FaRobot size={32} className="mb-3 text-primary-foreground" />
                    <h4 className="text-lg font-bold mb-1 text-primary-foreground">Data</h4>
                    <p className="text-sm opacity-90 text-primary-foreground">Science</p>
                  </div>
                }
              />
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

              {/* Languages - Large Card */}
              <SpotlightCard className="md:col-span-2 lg:col-span-2 custom-spotlight-card" spotlightColor="rgba(247, 223, 30, 0.2)">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Code className="h-6 w-6" />
                    Programming Languages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {skillsData.languages.map((skill, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-shrink-0">{skill.icon}</div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{skill.name}</div>
                          <div className="text-xs text-muted-foreground">{skill.level}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </SpotlightCard>

              {/* Technologies - Large Card */}
              <SpotlightCard className="md:col-span-2 lg:col-span-2 custom-spotlight-card" spotlightColor="rgba(238, 77, 44, 0.2)">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Briefcase className="h-6 w-6" />
                    Technologies & Frameworks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {skillsData.technologies.map((skill, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-shrink-0">{skill.icon}</div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{skill.name}</div>
                          <div className="text-xs text-muted-foreground">{skill.level}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </SpotlightCard>

              {/* Domains - Tall Card */}
              <SpotlightCard className="lg:row-span-2 custom-spotlight-card" spotlightColor="rgba(255, 107, 107, 0.2)">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FaBrain className="h-5 w-5" />
                    Domains
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {skillsData.domains.map((skill, index) => (
                      <div key={index} className="text-center p-4 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex justify-center mb-2">{skill.icon}</div>
                        <div className="font-medium text-sm mb-1">{skill.name}</div>
                        <div className="text-xs text-muted-foreground">{skill.level}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </SpotlightCard>

              {/* Tools - Tall Card */}
              <SpotlightCard className="lg:row-span-2 custom-spotlight-card" spotlightColor="rgba(118, 185, 0, 0.2)">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FaServer className="h-5 w-5" />
                    Tools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {skillsData.tools.map((skill, index) => (
                      <div key={index} className="text-center p-4 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex justify-center mb-2">{skill.icon}</div>
                        <div className="font-medium text-sm mb-1">{skill.name}</div>
                        <div className="text-xs text-muted-foreground">{skill.level}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </SpotlightCard>

              {/* Additional Skills - Wide Card */}
              <SpotlightCard className="md:col-span-2 custom-spotlight-card" spotlightColor="rgba(69, 183, 209, 0.2)">
                <CardHeader>
                  <CardTitle className="text-lg">Additional Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="flex items-center gap-2">
                      <FaMicrochip size={16} />
                      SystemVerilog
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-2">
                      <FaMicrochip size={16} />
                      Verilog
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-2">
                      <FaCode size={16} />
                      Assembly
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-2">
                      <SiApacheecharts size={16} />
                      ECharts
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-2">
                      <SiChartdotjs size={16} />
                      Chart.js
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-2">
                      <SiVite size={16} />
                      Vite
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-2">
                      <SiNginx size={16} />
                      Nginx
                    </Badge>
                  </div>
                </CardContent>
              </SpotlightCard>

            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
