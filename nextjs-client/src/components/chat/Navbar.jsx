'use client'
import ThemeToggle from '@/components/ThemeToggle'

export default function Navbar({
  strangerUsername, connectionStatus, promptActive, onPromptClick,
  liveCount, onLogout, tier, onUpgradeClick, onAccount, onCommunity
}) {
  return (
    <nav
      className="h-[58px] min-h-[58px] flex items-center px-5 gap-3 border-b z-[100] shrink-0 backdrop-blur-xl"
      style={{ background: 'var(--glass)', borderColor: 'var(--glass-b)' }}
    >
      {/* Logo */}
      <div
        className="font-display text-[20px] font-black text-accent flex items-center gap-[9px] shrink-0 cursor-pointer tracking-[-0.5px]"
        onClick={onCommunity}
      >
        <div className="w-[30px] h-[30px] bg-accent rounded-[9px] flex items-center justify-center text-white text-[14px] font-black font-body shrink-0">
          U
        </div>
        UniBuddy
      </div>

      {/* Center — stranger chip or searching */}
      <div className="flex-1 flex items-center justify-center">
        {connectionStatus ? (
          <div className="flex items-center gap-2 bg-elev border border-bdr rounded-2xl px-4 py-[6px] text-[14px] font-semibold text-t1">
            <span
              className="w-2 h-2 rounded-full bg-green shrink-0"
              style={{ animation: 'pulseDot 2.2s ease infinite' }}
            />
            {strangerUsername || 'Anonymous'}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-t3 text-[13px]">
            <span
              style={{
                width: 16, height: 16,
                border: '2.5px solid var(--border)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spinAnim .9s linear infinite',
                flexShrink: 0,
              }}
            />
            {liveCount > 0 ? `${liveCount} people waiting…` : 'Finding your match…'}
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Live badge */}
        {liveCount > 0 && (
          <span
            className="bg-green text-white rounded-2xl text-[12px] font-black px-3 py-1 flex items-center gap-1.5 tracking-[0.2px]"
            style={{ boxShadow: '0 0 12px var(--green-glow)' }}
          >
            <span className="w-[7px] h-[7px] rounded-full bg-white" style={{ boxShadow: '0 0 6px rgba(255,255,255,0.8)', flexShrink: 0 }} />
            {liveCount} live
          </span>
        )}

        {/* Prompt button */}
        <button
          onClick={onPromptClick}
          disabled={!connectionStatus}
          className={`h-[34px] px-3.5 rounded-2xl text-[13px] font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
            promptActive
              ? 'bg-accent border-accent text-white'
              : connectionStatus
              ? 'border-bdr text-t2 hover:border-accent hover:text-accent hover:bg-accent-glow'
              : 'opacity-35 cursor-not-allowed border-bdr text-t2'
          }`}
        >
          💬 {promptActive ? 'Hide Prompt' : 'Prompt'}
        </button>

        {/* Upgrade pill */}
        {tier === 'free' && (
          <button
            onClick={onUpgradeClick}
            className="h-[34px] px-3.5 rounded-2xl text-[13px] font-bold border border-bdr text-t2 transition-all flex items-center gap-1.5 whitespace-nowrap hover:border-amber hover:text-amber"
          >
            ⚡ Upgrade
          </button>
        )}

        {/* Account */}
        <button
          onClick={onAccount}
          className="w-[34px] h-[34px] rounded-2xl flex items-center justify-center border border-bdr text-t2 text-[15px] transition-all hover:border-accent hover:text-accent hover:bg-accent-glow"
        >
          👤
        </button>

        <ThemeToggle />

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-[34px] h-[34px] rounded-2xl flex items-center justify-center border border-bdr text-t2 text-[15px] transition-all hover:border-red hover:text-red hover:bg-red-sub"
          title="Log out"
        >
          🚪
        </button>
      </div>
    </nav>
  )
}
