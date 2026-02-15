# Yuhao Cheng - Portfolio Website

A modern, responsive portfolio website built with Next.js 15, React 19, and TypeScript, showcasing my professional experience, projects, and skills as a Computer Science graduate student and Full Stack Developer.

## 🚀 Live Demo

Visit the live portfolio at: [yuhaoc7.com](https://yuhaoc7.com)

## ✨ Features

### 🎨 Modern UI/UX
- **Dark/Light Theme Toggle** with system preference detection
- **Interactive 3D Elements** using custom TiltedCard and SpotlightCard components
- **Smooth Animations** powered by Framer Motion and GSAP
- **Responsive Design** optimized for mobile, tablet, and desktop
- **Typing Animation** for dynamic text display

### 🧭 Navigation
- **Pill Navigation** with smooth transitions and active section highlighting
- **Sticky Header** for easy navigation across sections
- **Smooth Scrolling** between sections

### 📱 Performance & SEO
- **Server-Side Rendering (SSR)** with Next.js App Router
- **Image Optimization** with Next.js Image component
- **SEO Optimized** with structured data, meta tags, and sitemap
- **Progressive Web App (PWA)** ready with manifest.json
- **Performance Optimized** with code splitting and lazy loading

### 🎯 Sections
- **Hero Section** with animated profile card and contact information
- **Education** timeline with academic achievements
- **Projects** showcase with technology stacks and descriptions
- **Experience** section highlighting professional roles
- **Skills** grid with categorized technical expertise

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript
- **UI Library:** React 19
- **Styling:** Tailwind CSS 4
- **Components:** Radix UI primitives with shadcn/ui
- **Icons:** Lucide React & React Icons
- **Animations:** Framer Motion, GSAP
- **3D Graphics:** Three.js, OGL

### Development Tools
- **Package Manager:** npm
- **Linting:** ESLint with Next.js config
- **Type Checking:** TypeScript
- **Build Tool:** Next.js with Turbopack (dev)

### Deployment & DevOps
- **Containerization:** Docker with multi-stage builds
- **Process Management:** PM2 with ecosystem configuration
- **Web Server:** Nginx (reverse proxy)
- **Deployment:** Automated scripts for production

## 📦 Installation & Setup

### Prerequisites
- Node.js 20+ 
- npm or yarn
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/laserrr17/my-portfolio.git
   cd my-portfolio
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Alternative Development Port
```bash
npm run dev:10002  # Runs on port 10002
```

## 🐳 Docker Deployment

### Build and Run with Docker

1. **Build the Docker image**
   ```bash
   docker build -t my-portfolio .
   ```

2. **Run the container**
   ```bash
   docker run -p 10001:10001 my-portfolio
   ```

### Docker Compose
```bash
docker-compose up -d
```

## 🚀 Production Deployment

### Build for Production
```bash
npm run build
npm start
```

### Automated Deployment Scripts
- `./build-and-run.sh` - Build and run locally
- `./deploy.sh` - Deploy to production server
- `./auto-deploy.sh` - Automated deployment with PM2

### PM2 Process Management
```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs
```

## 📁 Project Structure

```
my-portfolio/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   ├── health/             # Health check endpoint
│   │   ├── robots.ts           # Robots.txt generation
│   │   └── sitemap.ts          # Sitemap generation
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── PortfolioContent.tsx # Main portfolio component
│   │   ├── SpotlightCard.jsx   # Interactive card component
│   │   ├── TiltedCard.jsx      # 3D tilted card component
│   │   ├── PillNav.jsx         # Navigation component
│   │   ├── TextType.tsx        # Typing animation component
│   │   └── theme-provider.tsx  # Theme context provider
│   ├── contexts/               # React contexts
│   │   └── ThemeContext.tsx    # Custom theme management
│   └── lib/                    # Utility functions
│       └── utils.ts            # Helper utilities
├── public/                     # Static assets
│   ├── profile_picture.png     # Profile image
│   ├── manifest.json           # PWA manifest
│   ├── robots.txt              # SEO robots file
│   └── sitemap.xml             # SEO sitemap
├── docker-compose.yml          # Docker Compose configuration
├── Dockerfile                  # Docker build instructions
├── ecosystem.config.js         # PM2 configuration
├── nginx.conf                  # Nginx configuration
└── package.json                # Project dependencies
```

## 🎨 Customization

### Theme Configuration
The portfolio uses a custom theme system with CSS variables. Modify theme colors in:
- `src/app/globals.css` - CSS custom properties
- `src/contexts/ThemeContext.tsx` - Theme logic

### Content Updates
Update personal information in:
- `src/components/PortfolioContent.tsx` - Main content
- `public/manifest.json` - PWA metadata
- `src/app/layout.tsx` - SEO metadata

### Styling
- **Tailwind CSS** for utility-first styling
- **CSS Modules** for component-specific styles
- **CSS Variables** for theme consistency

## 🔧 Configuration Files

- **next.config.ts** - Next.js configuration with performance optimizations
- **tsconfig.json** - TypeScript configuration
- **components.json** - shadcn/ui configuration
- **eslint.config.mjs** - ESLint rules and settings
- **postcss.config.mjs** - PostCSS configuration for Tailwind

## 📊 Performance Features

- **Image Optimization** with WebP/AVIF formats
- **Code Splitting** for optimal bundle sizes
- **Lazy Loading** for improved initial load times
- **Caching Headers** for static assets
- **Compression** enabled for all responses
- **Bundle Analysis** with optimized imports

## 🔒 Security Features

- **Content Security Policy** headers
- **X-Frame-Options** protection
- **X-Content-Type-Options** security
- **Referrer Policy** configuration
- **DNS Prefetch Control** optimization

## 📈 SEO Optimization

- **Structured Data** with JSON-LD
- **Meta Tags** for social media sharing
- **Sitemap Generation** for search engines
- **Robots.txt** for crawler guidance
- **Performance Metrics** optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

**Yuhao Cheng**
- Email: [yuhaoc7@outlook.com](mailto:yuhaoc7@outlook.com)
- LinkedIn: [Yuhao Cheng](https://www.linkedin.com/in/yuhao-cheng-50b473328/)
- GitHub: [@yuhaoc7](https://github.com/yuhaoc7)
- Location: Champaign, IL, USA

## 🙏 Acknowledgments

- **Next.js Team** for the amazing framework
- **Vercel** for deployment platform
- **shadcn/ui** for beautiful UI components
- **Tailwind CSS** for utility-first styling
- **Radix UI** for accessible primitives

---

Built with ❤️ by Yuhao Cheng