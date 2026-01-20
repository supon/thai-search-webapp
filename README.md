# 🚀 Thai Search & Chat Web Application

A modern web application for multi-format document search with AI-powered chat capabilities.

## ✨ Features

- 💬 **Chat & RAG**: AI-powered chat with document retrieval
- 🔍 **Advanced Search**: Semantic and hybrid search capabilities
- 📤 **Multi-format Upload**: Support for PDF, DOCX, TXT, XLSX, CSV, and more
- 📊 **System Monitoring**: Real-time performance metrics and status

## 🛠️ Prerequisites

Before running this application, ensure you have:

1. **Node.js** (v18 or higher)
2. **FastAPI Backend** running at `http://localhost:8000`
3. **Ollama** server running for LLM capabilities
4. **Indexed documents** in the backend

## 📦 Installation

```bash
# Install dependencies
npm install
```

## 🚀 Development

```bash
# Start development server
npm run dev
```

The application will open at `http://localhost:3000`

## 🏗️ Build for Production

```bash
# Build optimized production files
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
thai-search-webapp/
├── src/
│   ├── App.jsx          # Main application component
│   ├── main.jsx         # Application entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── package.json         # Dependencies
```

## 🎯 Available Tabs

### 1. Chat & RAG
- Toggle between RAG (document search + AI) and Direct LLM modes
- Adjustable temperature and search parameters
- View sources and performance metrics

### 2. Search Documents
- Semantic search using embeddings
- Hybrid search (semantic + keyword)
- Detailed results with similarity scores

### 3. Upload & Extract
- Upload documents in multiple formats
- Extract and preview text content
- View processing statistics

### 4. System Status
- Monitor document count and system uptime
- View cache performance
- Check available Ollama models

## 🔧 Configuration

### API Endpoint

Update the API base URL in `src/App.jsx` if your backend runs on a different port:

```javascript
const API_BASE_URL = 'http://localhost:8000';
```

### Development Port

Change the development server port in `vite.config.js`:

```javascript
export default defineConfig({
  server: {
    port: 3000, // Change to your preferred port
  }
})
```

## 🐛 Troubleshooting

### API Connection Issues

1. Verify FastAPI backend is running:
   ```bash
   curl http://localhost:8000/health
   ```

2. Check Ollama server:
   ```bash
   ollama list
   ```

### Styling Issues

If Tailwind styles aren't loading, ensure `@tailwind` directives are in `src/index.css`

### Port Already in Use

Change the port in `vite.config.js` or kill the process using port 3000

## 📚 Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library
- **FastAPI** - Backend API (separate project)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Anthropic Claude for AI capabilities
- Ollama for local LLM support
- The open-source community

---

Built with ❤️ using React + Vite + Tailwind CSS