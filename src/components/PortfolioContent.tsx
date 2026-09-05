"use client"

import { useState, useEffect } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import ModeToggle from "@/components/mode-toggle"
import SpotlightCard from "@/components/SpotlightCard"
import TextTypeWrapper from "@/components/TextTypeWrapper"
import TiltedCard from "@/components/TiltedCard"
import { Github, Linkedin, Mail, Phone, MapPin, ExternalLink, BookOpen, Calendar, GraduationCap, Briefcase, Code, Globe } from "lucide-react"
import {
  SiJavascript, SiPython, SiCplusplus, SiTypescript, SiMysql,
  SiPytorch, SiReact, SiVuedotjs, SiNodedotjs, SiExpress, SiDocker,
  SiFastapi, SiApacheecharts, SiVite,
  SiGit, SiNvidia, SiLinux, SiGnubash,
  SiGooglecloud, SiNginx, SiPostgresql, SiRedis, SiPrometheus
} from "react-icons/si"
import { DiDatabase } from "react-icons/di"
import { MdTranslate } from "react-icons/md"
import { FaBrain, FaRobot, FaCode, FaServer, FaJava, FaAws } from "react-icons/fa"
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
  const cardDimensions = useResponsiveCardDimensions()

  // Navigation items for PillNav
  const navItems = [
    { label: "Home", href: "#" },
    { label: "Photography", href: "/photography" },
    { label: "About", href: "#about" },
    { label: "Education", href: "#education" },
    { label: "Research", href: "#research" },
    { label: "Projects", href: "#projects" },
    { label: "Experience", href: "#experience" },
    { label: "Skills", href: "#skills" },
  ];

  // Simple active section tracking (you can enhance this with intersection observer)
  const [activeSection] = useState("#");

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
      { name: 'TypeScript', icon: <SiTypescript size={32} className="text-chart-4" /> },
      { name: 'JavaScript', icon: <SiJavascript size={32} className="text-chart-1" /> },
      { name: 'Python', icon: <SiPython size={32} className="text-chart-2" /> },
      { name: 'C/C++', icon: <SiCplusplus size={32} className="text-chart-3" /> },
      { name: 'Java', icon: <FaJava size={32} className="text-chart-4" /> },
      { name: 'SQL', icon: <DiDatabase size={32} className="text-primary" /> },
      { name: 'Bash', icon: <SiGnubash size={32} className="text-accent" /> },
    ],
    technologies: [
      { name: 'PyTorch', icon: <SiPytorch size={32} className="text-chart-3" /> },
      { name: 'React', icon: <SiReact size={32} className="text-chart-4" /> },
      { name: 'Vue 3', icon: <SiVuedotjs size={32} className="text-chart-5" /> },
      { name: 'Node.js', icon: <SiNodedotjs size={32} className="text-primary" /> },
      { name: 'Express', icon: <SiExpress size={32} className="text-accent" /> },
      { name: 'MySQL', icon: <SiMysql size={32} className="text-foreground" /> },
      { name: 'PostgreSQL', icon: <SiPostgresql size={32} className="text-chart-4" /> },
      { name: 'Docker', icon: <SiDocker size={32} className="text-chart-1" /> },
      { name: 'FastAPI', icon: <SiFastapi size={32} className="text-chart-2" /> },
      { name: 'Redis', icon: <SiRedis size={32} className="text-chart-4" /> },
      { name: 'ECharts', icon: <SiApacheecharts size={32} className="text-chart-3" /> },
      { name: 'Vite', icon: <SiVite size={32} className="text-chart-5" /> },
      { name: 'Nginx', icon: <SiNginx size={32} className="text-primary" /> },
      { name: 'Prometheus', icon: <SiPrometheus size={32} className="text-chart-2" /> },
    ],
    domains: [
      { name: 'Full Stack Development', icon: <FaCode size={32} className="text-chart-1" /> },
      { name: 'Machine Learning', icon: <FaBrain size={32} className="text-chart-2" /> },
      { name: 'NLP', icon: <MdTranslate size={32} className="text-chart-3" /> },
      { name: 'Reinforcement Learning', icon: <FaRobot size={32} className="text-chart-4" /> },
    ],
    tools: [
      { name: 'GCP', icon: <SiGooglecloud size={32} className="text-primary" /> },
      { name: 'AWS', icon: <FaAws size={32} className="text-foreground" /> },
      { name: 'Linux', icon: <SiLinux size={32} className="text-chart-2" /> },
      { name: 'CUDA', icon: <SiNvidia size={32} className="text-chart-3" /> },
      { name: 'Git', icon: <SiGit size={32} className="text-chart-5" /> },
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
                          "Visual Reasoning & LLM Agent Research"
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
                      I am an MCS student at UIUC, working on visual reasoning in generative models,
                      LLM agents, and full-stack systems. As a main contributor to VGI-Bench, I build
                      benchmarks and evaluate the reasoning capabilities of image and video generation models.
                    </p>

                    {/* Contact Information - Responsive grid layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-8 text-xs sm:text-sm opacity-90 w-full max-w-lg lg:max-w-none">
                      <div className="flex items-center justify-center lg:justify-start gap-2 min-w-0">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="truncate">Champaign, IL</span>
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                    <div>
                      <CardTitle>Master of Computer Science (MCS)</CardTitle>
                      <CardDescription className="text-base font-medium">
                        University of Illinois Urbana-Champaign
                      </CardDescription>
                    </div>
                    <Badge variant="color1" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Aug 2025 – Dec 2026 (Expected)
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                    <div>
                      <CardTitle>Bachelor of Science in Computer Engineering</CardTitle>
                      <CardDescription className="text-base font-medium">
                        University of Illinois Urbana-Champaign
                      </CardDescription>
                    </div>
                    <Badge variant="color1" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Aug 2021 – May 2025
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

        {/* Research & Publications Section */}
        <section id="research" className="py-16 scroll-mt-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-2"><BookOpen className="h-8 w-8" />Research & Publications</h2>
            <div className="space-y-6">
              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                    <div className="min-w-0">
                      <CardTitle className="leading-snug">VGI-Bench: Probing Visual Intelligence in Video Generation Models</CardTitle>
                      <CardDescription className="mt-2">Main Contributor · Visual reasoning benchmark</CardDescription>
                    </div>
                    <Badge variant="color1" className="shrink-0">2026</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    <li>Co-developed a benchmark with <strong>27 tasks and 810 instances</strong> across four task domains and seven capability dimensions.</li>
                    <li>Implemented and analyzed large-scale evaluations of state-of-the-art image and video generation models across task domains, capabilities, and difficulty levels.</li>
                    <li>Analyzed thousands of generated outputs to study failure modes, input sensitivity, synthetic fine-tuning transfer, and denoising dynamics; found self-correction in <strong>less than 1%</strong> of decoded transitions.</li>
                  </ul>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge variant="secondary">Visual Reasoning</Badge>
                    <Badge variant="secondary">Video Generation</Badge>
                    <Badge variant="secondary">Model Evaluation</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-5"><Button variant="outline" size="sm" className="bg-card text-foreground dark:bg-card" asChild><a href="https://arxiv.org/abs/2608.19583" target="_blank" rel="noopener noreferrer">Paper · arXiv<ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" /></a></Button><Button variant="outline" size="sm" className="bg-card text-foreground dark:bg-card" asChild><a href="https://hexuan21.github.io/VGI-Bench/" target="_blank" rel="noopener noreferrer">Project Page<ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" /></a></Button></div>
                </CardContent>
              </SpotlightCard>
              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                    <div className="min-w-0">
                      <CardTitle className="leading-snug">Web Navigation Agent Research Project</CardTitle>
                      <CardDescription className="mt-2">Reinforcement learning and long-horizon LLM agents</CardDescription>
                    </div>
                    <Badge variant="color1" className="shrink-0">Sep 2024 – May 2025</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    <li>Developed reinforcement-learning-based web agents across <strong>800+ WebArena tasks</strong>, designing dense reward functions for multi-step interaction and task completion.</li>
                    <li>Implemented agent memory mechanisms to preserve task-relevant context over extended trajectories and improve long-horizon decision making.</li>
                    <li>Fine-tuned <strong>8B-parameter LLMs</strong> using PyTorch and supervised fine-tuning on multi-GPU distributed infrastructure, with context lengths up to approximately <strong>16K tokens</strong>.</li>
                  </ul>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge variant="secondary">PyTorch</Badge>
                    <Badge variant="secondary">Reinforcement Learning</Badge>
                    <Badge variant="secondary">LLMs</Badge>
                    <Badge variant="secondary">WebArena</Badge>
                    <Badge variant="secondary">Multi-GPU Training</Badge>
                  </div>

                </CardContent>
              </SpotlightCard>
            </div>
          </div>
        </section>
        <Separator className="my-16" />

        {/* Projects Section */}
        <section id="projects" className="py-16 scroll-mt-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-2"><Code className="h-8 w-8" />Projects</h2>
            <div className="space-y-6">
              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                    <div className="min-w-0">
                      <CardTitle className="leading-snug">FinTrack Financial Tracking Platform</CardTitle>
                      <CardDescription className="mt-2">Full-stack financial platform</CardDescription>
                    </div>
                    <Badge variant="color1" className="shrink-0">Feb 2025 – Apr 2025</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    <li>Built a full-stack platform with <strong>React, Node.js, Express, and MySQL</strong>, supporting transaction management, budgeting, and real-time multi-currency conversion through external APIs.</li>
                    <li>Designed a normalized relational database with transactions, triggers, stored procedures, and transactional workflows; deployed the application stack on <strong>Google Cloud Platform</strong>.</li>
                  </ul>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge variant="secondary">React</Badge>
                    <Badge variant="secondary">Node.js</Badge>
                    <Badge variant="secondary">Express</Badge>
                    <Badge variant="secondary">MySQL</Badge>
                    <Badge variant="secondary">GCP</Badge>
                  </div>

                </CardContent>
              </SpotlightCard>
            </div>
          </div>
        </section>
        <Separator className="my-16" />

        {/* Experience Section */}
        <section id="experience" className="py-16 scroll-mt-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-2"><Briefcase className="h-8 w-8" />Experience</h2>
            <div className="space-y-6">
              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                    <div className="min-w-0">
                      <CardTitle className="leading-snug">Frontend Developer Intern</CardTitle>
                      <CardDescription className="mt-2">visibilityx.ai</CardDescription>
                    </div>
                    <Badge variant="color1" className="shrink-0">Jun 2025 – Aug 2025</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    <li>Built a <strong>Vue 3 and TypeScript</strong> single-page application with <strong>10+ dashboard views</strong> and reusable UI components, reducing duplicated frontend code by approximately <strong>25%</strong>.</li>
                    <li>Developed interactive analytics dashboards with ECharts and SQL-backed REST APIs, reducing average dashboard load time by approximately <strong>30%</strong> through optimized asynchronous fetching and state management.</li>
                    <li>Added Jest and Vitest unit tests for core frontend modules, increasing test coverage to approximately <strong>80%</strong>.</li>
                  </ul>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge variant="secondary">Vue 3</Badge>
                    <Badge variant="secondary">TypeScript</Badge>
                    <Badge variant="secondary">ECharts</Badge>
                    <Badge variant="secondary">REST APIs</Badge>
                    <Badge variant="secondary">Jest</Badge>
                    <Badge variant="secondary">Vitest</Badge>
                  </div>

                </CardContent>
              </SpotlightCard>
              <SpotlightCard className="custom-spotlight-card" spotlightColor="rgba(0, 229, 255, 0.2)">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                    <div className="min-w-0">
                      <CardTitle className="leading-snug">Backend Developer Intern</CardTitle>
                      <CardDescription className="mt-2">HiABR Lab</CardDescription>
                    </div>
                    <Badge variant="color1" className="shrink-0">May 2024 – Aug 2024</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    <li>Implemented a distributed URL-shortening service with <strong>FastAPI, PostgreSQL, and Redis</strong>, reducing redirect latency by approximately <strong>60%</strong> and database reads by approximately <strong>70%</strong> through caching.</li>
                    <li>Built REST APIs with sliding-window rate limiting, idempotency keys, and input validation, supporting approximately <strong>1,000+ requests per minute</strong> while preventing duplicate operations and abusive traffic.</li>
                    <li>Integrated Prometheus monitoring and containerized services with Docker, reducing deployment setup time by approximately <strong>50%</strong> and providing visibility into latency, traffic, and error rates.</li>
                  </ul>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge variant="secondary">FastAPI</Badge>
                    <Badge variant="secondary">PostgreSQL</Badge>
                    <Badge variant="secondary">Redis</Badge>
                    <Badge variant="secondary">Docker</Badge>
                    <Badge variant="secondary">Prometheus</Badge>
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
                captionText="Machine Learning - PyTorch, LLMs, Visual Reasoning"
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
                      </div>
                    ))}
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
