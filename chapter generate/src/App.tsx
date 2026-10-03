import { useState } from 'react';
import { TabId } from './types';
import StoryTab from './components/tabs/StoryTab';
import ScannerTab from './components/tabs/ScannerTab';
import LinksTab from './components/tabs/LinksTab';

const TABS: { id: TabId; icon: string; label: string; shortLabel: string }[] = [
  { id: 'story',   icon: '📖', label: 'Tạo Code Truyện',       shortLabel: 'Tạo Truyện' },
  { id: 'scanner', icon: '🔍', label: 'Quét Tên Nhân Vật',     shortLabel: 'Quét Tên'   },
  { id: 'links',   icon: '🔗', label: 'Tạo Link Mục Lục',      shortLabel: 'Mục Lục'    },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('story');

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(135deg, #060917 0%, #0f0a2e 40%, #060e1f 70%, #060917 100%)',
      }}
    >
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -right-24 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 left-1/2 w-96 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #4f46e5 0%, transparent 70%)' }}
        />
        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 sm:py-10">

        {/* ── HEADER ── */}
        <header className="glass rounded-2xl px-6 py-5 mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 animate-glow"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
            >
              🛠️
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
                Siêu Công Cụ Blogger
                <span
                  className="text-sm font-bold px-2.5 py-0.5 rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                    color: 'white',
                  }}
                >
                  Chuseoz
                </span>
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                Story Generator · Character Scanner · Link Generator · Pro SaaS Edition
              </p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-700/40 text-emerald-400 text-xs font-bold px-3.5 py-2 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
              Auto-Save Active
            </div>
            <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-700/40 text-indigo-300 text-xs font-bold px-3.5 py-2 rounded-full">
              ⚡ 100% Bug-Free
            </div>
          </div>
        </header>

        {/* ── MAIN CARD ── */}
        <main className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/10">

          {/* Tabs nav */}
          <nav className="flex bg-slate-50 border-b border-slate-100 p-1.5 gap-1.5">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-indigo-600 shadow-md'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                  }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                      style={{ background: 'linear-gradient(90deg, #6366f1, #818cf8)' }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Tab content */}
          <div key={activeTab} className="animate-fade-slide">
            {activeTab === 'story'   && <StoryTab />}
            {activeTab === 'scanner' && <ScannerTab />}
            {activeTab === 'links'   && <LinksTab />}
          </div>
        </main>

        {/* ── FOOTER ── */}
        <footer className="text-center mt-8 space-y-2">
          <p className="text-slate-500 text-xs">
            Powered by{' '}
            <a
              href="https://chuseoz.pythonanywhere.com"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
            >
              Chuseoz Backend
            </a>{' '}
            · Auto-Save Enabled · 100% DOM Algorithm Verified
          </p>
          <p className="text-slate-600 text-xs">
            © 2026 Chuseoz · Pro SaaS Edition · All rights reserved
          </p>
        </footer>

      </div>
    </div>
  );
}
