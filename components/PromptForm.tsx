
import React, { useState } from 'react';
import SparklesIcon from './icons/SparklesIcon';

interface PromptFormProps {
  onSubmit: (prompt: string, style: string) => void;
  isLoading: boolean;
}

const artStyles = [
  "Photorealistic",
  "Cosmic Watercolor",
  "Retro Futurism",
  "Abstract Nebula",
  "Vintage Sci-Fi Poster",
  "Impressionist",
];

const PromptForm: React.FC<PromptFormProps> = ({ onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState<string>('A swirling purple and gold nebula with a newborn star at its center');
  const [selectedStyle, setSelectedStyle] = useState<string>(artStyles[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && selectedStyle) {
      onSubmit(prompt, selectedStyle);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-slate-700/50">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label htmlFor="prompt" className="block text-lg font-semibold mb-2 text-purple-300">
            Describe Your Vision
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., a galaxy inside a crystal ball"
            rows={5}
            className="w-full bg-slate-900/70 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-shadow duration-300 text-slate-200 placeholder-slate-500"
            required
          />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-3 text-purple-300">Choose a Style</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {artStyles.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setSelectedStyle(style)}
                className={`px-3 py-2 text-sm rounded-md transition-all duration-300 text-center ${
                  selectedStyle === style
                    ? 'bg-purple-600 text-white font-bold shadow-lg ring-2 ring-purple-400'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-400/50"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </>
          ) : (
            <>
              <SparklesIcon />
              Generate Artwork
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default PromptForm;
