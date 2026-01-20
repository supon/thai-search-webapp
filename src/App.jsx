import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Upload, MessageSquare, FileText, Settings, BarChart, 
  Zap, Loader2, Send, Trash2, X 
} from 'lucide-react';

// API Configuration
const API_BASE_URL = 'http://10.223.72.14:8743';

// =============================================
// MAIN APP COMPONENT
// =============================================
const App = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [apiStatus, setApiStatus] = useState({ loaded: false, healthy: false });
  
  useEffect(() => {
    checkHealth();
  }, []);
  
  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const data = await res.json();
      setApiStatus({
        loaded: data.search_system?.loaded || false,
        healthy: data.status === 'healthy',
        ollamaStatus: data.ollama?.status
      });
    } catch (error) {
      setApiStatus({ loaded: false, healthy: false });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-md border-b-4 border-indigo-500">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Search className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Thai Search & Chat</h1>
                <p className="text-sm text-gray-600">Multi-format document search with AI</p>
              </div>
            </div>
            
            {/* Status Indicator */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${apiStatus.healthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {apiStatus.healthy ? 'API Connected' : 'API Disconnected'}
                </span>
              </div>
              <button 
                onClick={checkHealth}
                className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1">
            {[
              { id: 'chat', icon: MessageSquare, label: 'Chat & RAG' },
              { id: 'search', icon: Search, label: 'Search Documents' },
              { id: 'upload', icon: Upload, label: 'Upload & Extract' },
              { id: 'status', icon: BarChart, label: 'System Status' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'chat' && <ChatTab apiStatus={apiStatus} />}
        {activeTab === 'search' && <SearchTab />}
        {activeTab === 'upload' && <UploadTab />}
        {activeTab === 'status' && <StatusTab />}
      </div>
    </div>
  );
};

// =============================================
// CHAT TAB COMPONENT
// =============================================
const ChatTab = ({ apiStatus }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('rag'); // 'rag' or 'direct'
  const [expandedSources, setExpandedSources] = useState({}); // Track which messages have expanded sources
  const [settings, setSettings] = useState({
    model: 'gpt-oss:20b',
    temperature: 0.7,
    k: 5,
    searchMethod: 'Semantic',
    streaming: true // Enable streaming by default
  });
  const [availableModels, setAvailableModels] = useState([]);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadModels = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/ollama/models`);
      const data = await res.json();
      setAvailableModels(data.models || []);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      if (mode === 'rag') {
        if (settings.streaming) {
          // RAG with Streaming
          await handleRAGStreaming(currentInput);
        } else {
          // RAG without streaming (original)
          const res = await fetch(`${API_BASE_URL}/search/llm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: currentInput,
              k: settings.k,
              search_method: settings.searchMethod,
              llm_model: settings.model,
              temperature: settings.temperature,
              language: 'thai'
            }),
            signal: abortControllerRef.current.signal
          });

          const data = await res.json();
          
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.llm_answer,
            sources: data.search_results.map(r => ({ // Keep ALL sources
              file: r.metadata.source_file,
              page: r.metadata.page_number,
              score: r.similarity_score,
              content: r.content.substring(0, 200) + '...' // Preview
            })),
            stats: {
              searchTime: data.search_time,
              llmTime: data.llm_time,
              totalResults: data.search_results.length
            }
          }]);
        }
      } else {
        if (settings.streaming) {
          // Direct LLM with Streaming
          await handleDirectLLMStreaming(currentInput);
        } else {
          // Direct LLM without streaming (original)
          const res = await fetch(`${API_BASE_URL}/llm/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: currentInput,
              llm_model: settings.model,
              temperature: settings.temperature
            }),
            signal: abortControllerRef.current.signal
          });

          const data = await res.json();
          
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.response
          }]);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setMessages(prev => [...prev, {
          role: 'system',
          content: 'Generation cancelled by user'
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'error',
          content: `Error: ${error.message}`
        }]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleRAGStreaming = async (query) => {
    // Create placeholder message for streaming
    const messageIndex = messages.length + 1;
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      sources: null,
      stats: null,
      streaming: true
    }]);

    try {
      const res = await fetch(`${API_BASE_URL}/search/llm/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          k: settings.k,
          search_method: settings.searchMethod,
          llm_model: settings.model,
          temperature: settings.temperature,
          language: 'thai'
        }),
        signal: abortControllerRef.current.signal
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let searchResults = null;
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'search_results') {
                searchResults = data.results;
              } else if (data.type === 'llm_chunk') {
                accumulatedText += data.content;
                
                // Update message with accumulated text
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[messageIndex] = {
                    role: 'assistant',
                    content: accumulatedText,
                    sources: searchResults ? searchResults.map(r => ({
                      file: r.source || 'Unknown',
                      page: r.page || 0,
                      score: r.similarity_score || 0,
                      content: r.content ? r.content.substring(0, 200) + '...' : ''
                    })) : null,
                    streaming: true
                  };
                  return newMessages;
                });
              } else if (data.type === 'done') {
                // Mark as complete
                setMessages(prev => {
                  const newMessages = [...prev];
                  if (newMessages[messageIndex]) {
                    newMessages[messageIndex].streaming = false;
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const handleDirectLLMStreaming = async (prompt) => {
    // Create placeholder message for streaming
    const messageIndex = messages.length + 1;
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      streaming: true
    }]);

    try {
      const res = await fetch(`${API_BASE_URL}/llm/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          llm_model: settings.model,
          temperature: settings.temperature
        }),
        signal: abortControllerRef.current.signal
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'chunk') {
                accumulatedText += data.content;
                
                // Update message with accumulated text
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[messageIndex] = {
                    role: 'assistant',
                    content: accumulatedText,
                    streaming: true
                  };
                  return newMessages;
                });
              } else if (data.type === 'done') {
                // Mark as complete
                setMessages(prev => {
                  const newMessages = [...prev];
                  if (newMessages[messageIndex]) {
                    newMessages[messageIndex].streaming = false;
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  };

  const toggleSourcesExpanded = (messageIndex) => {
    setExpandedSources(prev => ({
      ...prev,
      [messageIndex]: !prev[messageIndex]
    }));
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Settings Panel */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            Chat Settings
          </h3>

          {/* Mode Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('rag')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === 'rag'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                RAG Search
              </button>
              <button
                onClick={() => setMode('direct')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === 'direct'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Direct LLM
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
            <select
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {availableModels.length > 0 ? (
                availableModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))
              ) : (
                <option value={settings.model}>{settings.model}</option>
              )}
            </select>
          </div>

          {/* Temperature */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature: {settings.temperature.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {mode === 'rag' && (
            <>
              {/* Number of Results */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Results (k): {settings.k}
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={settings.k}
                  onChange={(e) => setSettings({ ...settings, k: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Search Method */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Method</label>
                <select
                  value={settings.searchMethod}
                  onChange={(e) => setSettings({ ...settings, searchMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="semantic">Semantic</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </>
          )}

          {/* Streaming Toggle */}
          <div className="mb-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-gray-700">Enable Streaming</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.streaming}
                  onChange={(e) => setSettings({ ...settings, streaming: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  settings.streaming ? 'bg-indigo-600' : 'bg-gray-300'
                }`}>
                  <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform ${
                    settings.streaming ? 'transform translate-x-5' : ''
                  }`}></div>
                </div>
              </div>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Stream responses in real-time for faster feedback
            </p>
          </div>

          <button
            onClick={clearChat}
            className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Chat
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">API:</span>
              <span className={`font-medium ${apiStatus.healthy ? 'text-green-600' : 'text-red-600'}`}>
                {apiStatus.healthy ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ollama:</span>
              <span className={`font-medium ${apiStatus.ollamaStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                {apiStatus.ollamaStatus || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Index:</span>
              <span className={`font-medium ${apiStatus.loaded ? 'text-green-600' : 'text-yellow-600'}`}>
                {apiStatus.loaded ? 'Loaded' : 'Not Loaded'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-lg shadow-md h-[700px] flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Start a conversation</p>
                <p className="text-sm">
                  {mode === 'rag' 
                    ? 'Ask questions about your documents and get AI-powered answers'
                    : 'Chat directly with the AI model'}
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-4 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white'
                    : msg.role === 'error'
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : msg.role === 'system'
                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <div className="whitespace-pre-wrap">
                    {msg.content}
                    {msg.streaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-indigo-600 animate-pulse"></span>
                    )}
                  </div>
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-700">
                          Sources ({msg.sources.length})
                        </p>
                        {msg.sources.length > 3 && (
                          <button
                            onClick={() => toggleSourcesExpanded(idx)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            {expandedSources[idx] ? 'Show Less' : 'Show All'}
                          </button>
                        )}
                      </div>
                      
                      {/* Display sources */}
                      <div className="space-y-2">
                        {(expandedSources[idx] ? msg.sources : msg.sources.slice(0, 3)).map((src, i) => (
                          <div key={i} className="text-xs bg-white bg-opacity-50 rounded p-2 border border-gray-200">
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex items-center space-x-2 flex-1">
                                <div className="flex items-center space-x-1 flex-shrink-0">
                                  <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-xs font-bold">
                                    #{i + 1}
                                  </span>
                                  <FileText className="w-3 h-3 text-indigo-600" />
                                </div>
                                <span className="font-medium text-gray-800 truncate">
                                  {src.file}
                                </span>
                              </div>
                              <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-medium flex-shrink-0">
                                {(src.score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="text-gray-600 ml-5 pl-6">
                              Page {src.page}
                            </div>
                            {src.content && (
                              <div className="text-gray-500 text-xs mt-1 ml-5 pl-6 italic">
                                "{src.content}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {!expandedSources[idx] && msg.sources.length > 3 && (
                        <div className="text-xs text-gray-500 mt-2 text-center">
                          +{msg.sources.length - 3} more sources
                        </div>
                      )}
                    </div>
                  )}

                  {msg.stats && (
                    <div className="mt-2 text-xs text-gray-600">
                      ⚡ Search: {(msg.stats.searchTime * 1000).toFixed(0)}ms | 
                      LLM: {(msg.stats.llmTime * 1000).toFixed(0)}ms | 
                      Results: {msg.stats.totalResults}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={mode === 'rag' ? 'Ask a question about your documents...' : 'Type a message...'}
                disabled={loading}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
              />
              {loading ? (
                <button
                  onClick={stopGeneration}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center transition-colors"
                >
                  <X className="w-5 h-5" />
                  <span className="ml-2">Stop</span>
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              )}
            </div>
            {loading && settings.streaming && (
              <div className="mt-2 flex items-center text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span>Streaming response...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================
// SEARCH TAB COMPONENT
// =============================================
const SearchTab = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('hybrid');
  const [k, setK] = useState(10);

  const performSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const endpoint = searchType === 'hybrid' ? '/search/hybrid' : '/search';
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          k,
          nprobe: 10,
          semantic_weight: 0.7,
          keyword_weight: 0.3
        })
      });

      const data = await res.json();
      setResults(data);
    } catch (error) {
      alert('Search failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="space-y-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setSearchType('semantic')}
              className={`px-4 py-2 rounded-md transition-colors ${
                searchType === 'semantic'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Semantic Search
            </button>
            <button
              onClick={() => setSearchType('hybrid')}
              className={`px-4 py-2 rounded-md transition-colors ${
                searchType === 'hybrid'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Hybrid Search
            </button>
          </div>

          <div className="flex space-x-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && performSearch()}
              placeholder="Enter search query in Thai or English..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <select
              value={k}
              onChange={(e) => setK(parseInt(e.target.value))}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
            </select>
            <button
              onClick={performSearch}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 flex items-center transition-colors"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              <span className="ml-2">Search</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Found {results.total_results} results in {(results.processing_time * 1000).toFixed(0)}ms
            </h3>
            <span className="text-sm text-gray-600">{results.search_method}</span>
          </div>

          <div className="space-y-4">
            {results.results.map((result, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span className="font-medium text-gray-900">{result.metadata.source_file}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-600">Page {result.metadata.page_number}</span>
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-md font-medium">
                      {(result.similarity_score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{result.content.substring(0, 300)}...</p>
                
                {result.score_breakdown && (
                  <div className="mt-2 flex space-x-4 text-xs text-gray-500">
                    <span>Semantic: {(result.score_breakdown.semantic_score * 100).toFixed(1)}%</span>
                    <span>Keyword: {(result.score_breakdown.keyword_score * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================
// UPLOAD TAB COMPONENT
// =============================================
const UploadTab = () => {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/upload/extract-text`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Upload & Extract Text</h3>
        <p className="text-sm text-gray-600 mb-4">
          Supported formats: PDF, DOCX, DOC, TXT, ODT, XLSX, XLS, CSV
        </p>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            accept=".pdf,.docx,.doc,.txt,.odt,.xlsx,.xls,.csv"
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-700 font-medium">
              {file ? file.name : 'Click to upload or drag and drop'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Maximum file size: 50MB
            </p>
          </label>
        </div>

        {file && (
          <button
            onClick={handleUpload}
            disabled={loading}
            className="mt-4 w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 flex items-center justify-center transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Extract Text
              </>
            )}
          </button>
        )}
      </div>

      {result && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Extraction Results</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">File Type:</span>
                <span className="ml-2 font-medium">{result.file_type?.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-gray-600">Text Length:</span>
                <span className="ml-2 font-medium">{result.text_length.toLocaleString()} chars</span>
              </div>
              <div>
                <span className="text-gray-600">Processing Time:</span>
                <span className="ml-2 font-medium">{(result.processing_time * 1000).toFixed(0)}ms</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">{result.extracted_text}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================
// STATUS TAB COMPONENT
// =============================================
const StatusTab = () => {
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/status`),
        fetch(`${API_BASE_URL}/metrics`)
      ]);

      const statusData = await statusRes.json();
      const metricsData = await metricsRes.json();

      setStatus(statusData);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !status || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">Documents</h3>
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-indigo-600">{status.total_documents.toLocaleString()}</p>
          <p className="text-sm text-gray-600 mt-1">{status.total_files} files indexed</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">Uptime</h3>
            <Zap className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-600">
            {Math.floor(metrics.uptime_seconds / 3600)}h {Math.floor((metrics.uptime_seconds % 3600) / 60)}m
          </p>
          <p className="text-sm text-gray-600 mt-1">{metrics.total_requests.toLocaleString()} requests</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">Cache Hit Rate</h3>
            <BarChart className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-600">{(metrics.cache_hit_rate * 100).toFixed(1)}%</p>
          <p className="text-sm text-gray-600 mt-1">{metrics.cache_hits} hits / {metrics.cache_misses} misses</p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Avg Search Time</p>
            <p className="text-2xl font-bold text-indigo-600">{metrics.avg_search_time_ms.toFixed(0)}ms</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Avg LLM Time</p>
            <p className="text-2xl font-bold text-indigo-600">{metrics.avg_llm_time_ms.toFixed(0)}ms</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Active Requests</p>
            <p className="text-2xl font-bold text-indigo-600">{metrics.active_requests}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Requests/sec</p>
            <p className="text-2xl font-bold text-indigo-600">{metrics.requests_per_second.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">System Information</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Index Status:</span>
            <span className={`font-medium ${status.is_loaded ? 'text-green-600' : 'text-red-600'}`}>
              {status.is_loaded ? 'Loaded' : 'Not Loaded'}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Keyword Search:</span>
            <span className={`font-medium ${status.keyword_index_available ? 'text-green-600' : 'text-yellow-600'}`}>
              {status.keyword_index_available ? 'Available' : 'Not Available'}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Ollama Status:</span>
            <span className={`font-medium ${status.ollama_available ? 'text-green-600' : 'text-red-600'}`}>
              {status.ollama_available ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Available Models:</span>
            <span className="font-medium text-gray-900">{status.ollama_models?.length || 0}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Total Errors:</span>
            <span className="font-medium text-gray-900">{metrics.total_errors}</span>
          </div>
        </div>
      </div>

      {/* Available Ollama Models */}
      {status.ollama_models && status.ollama_models.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Available Ollama Models</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {status.ollama_models.map((model, idx) => (
              <div key={idx} className="px-4 py-2 bg-gray-50 rounded-md text-sm font-mono">
                {model}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={loadStatus}
        className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center transition-colors"
      >
        <Zap className="w-5 h-5 mr-2" />
        Refresh Status
      </button>
    </div>
  );
};

export default App;