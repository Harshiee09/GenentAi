export function GenentLogo({ className = "w-24 h-24" }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 512 512"
      className={className}
    >
      <g stroke="white" strokeWidth="18" strokeLinecap="round">
        {/* 3 o'clock long bar */}
        <line x1="256" y1="60" x2="256" y2="256" transform="rotate(90 256 256)" />

        {/* remaining 15 bars */}
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(112.5 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(135 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(157.5 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(180 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(202.5 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(225 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(247.5 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(270 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(292.5 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(315 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(337.5 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(0 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(22.5 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(45 256 256)" />
        <line x1="256" y1="60" x2="256" y2="110" transform="rotate(67.5 256 256)" />
      </g>
    </svg>
  );
}