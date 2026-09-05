"use client"

export default function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Yuhao Cheng",
    jobTitle: ["Full Stack Developer", "Machine Learning Engineer", "Graduate Student"],
    description: "Master's student in Computer Science at UIUC, working on visual reasoning in generative models, LLM agents, and full-stack systems",
    url: "https://yuhaoc7.com",
    image: "https://yuhaoc7.com/profile_picture.png",
    email: "mailto:yuhaoc7@outlook.com",
    telephone: "+1-217-979-8890",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Urbana-Champaign",
      addressRegion: "IL",
      addressCountry: "US"
    },
    alumniOf: {
      "@type": "Organization",
      name: "University of Illinois Urbana-Champaign",
      url: "https://illinois.edu"
    },
    knowsAbout: [
      "JavaScript",
      "Python",
      "React",
      "Node.js",
      "Machine Learning",
      "PyTorch",
      "Full Stack Development",
      "Natural Language Processing",
      "Vue.js",
      "Express.js",
      "MySQL",
      "Docker",
      "FastAPI",
      "Visual Reasoning",
      "LLM Agents",
      "TypeScript",
      "Computer Science"
    ],
    hasOccupation: {
      "@type": "Occupation",
      name: "Graduate Student",
      occupationLocation: {
        "@type": "Place",
        name: "University of Illinois Urbana-Champaign"
      }
    },
    worksFor: {
      "@type": "Organization",
      name: "University of Illinois Urbana-Champaign",
      url: "https://illinois.edu"
    },
    sameAs: [
      "https://github.com/yuhaoc7",
      "https://www.linkedin.com/in/yuhao-cheng-50b473328/",
      // Add other social profiles
    ],
    mainEntity: {
      "@type": "WebSite",
      name: "Yuhao Cheng Portfolio",
      url: "https://yuhaoc7.com",
      description: "Personal portfolio showcasing full stack development and machine learning projects",
      author: {
        "@type": "Person",
        name: "Yuhao Cheng"
      }
    }
  };

  const websiteStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Yuhao Cheng Portfolio",
    url: "https://yuhaoc7.com",
    description: "Personal portfolio showcasing full stack development and machine learning projects",
    author: {
      "@type": "Person",
      name: "Yuhao Cheng",
      jobTitle: "Full Stack Developer & ML Engineer"
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://yuhaoc7.com/#search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  };

  const portfolioStructuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: "FinTrack Financial Tracking Platform",
    description: "Full-stack web application for comprehensive personal finance management with real-time multi-currency conversion and budgeting",
    author: {
      "@type": "Person",
      name: "Yuhao Cheng"
    },
    dateCreated: "2025",
    programmingLanguage: ["JavaScript", "Python", "SQL"],
    runtimePlatform: ["React", "Node.js", "MySQL"],
    applicationCategory: "WebApplication",
    operatingSystem: "Cross-platform"
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData, null, 2),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteStructuredData, null, 2),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(portfolioStructuredData, null, 2),
        }}
      />
    </>
  );
}
